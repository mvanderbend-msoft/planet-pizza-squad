const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { Worker } = require('node:worker_threads');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

process.env.DB_PATH = ':memory:';
const { db, migrate } = require('../dist/db');
const { resolveDailyPizza, discountedUnitPrice } = require('../dist/services/daily-pizza');
const { createDailyPizzaRouter } = require('../dist/routes/daily-pizza');
const { productsRouter } = require('../dist/routes/products');

function seed(connection, count = 8) {
  migrate(connection);
  const insert = connection.prepare(`
    INSERT INTO products (id, sku, name, description, price_cents, category, image_url, stock)
    VALUES (?, ?, ?, 'Description', ?, ?, '/image.svg', ?)
  `);
  for (let i = 1; i <= count; i++) {
    insert.run(i * 3, `pizza-${i}`, `Pizza ${i}`, 1299, 'pizza', 0);
  }
  insert.run(1, 'merch', 'T-shirt', 2000, 'merch', 100);
}

function at(connection, instant) {
  return resolveDailyPizza(connection, () => new Date(instant));
}

test('UTC rotation crosses month/year boundaries and skipped request days', () => {
  const connection = new DatabaseSync(':memory:');
  try {
    seed(connection);
    for (const [before, after] of [
      ['2026-11-30T23:59:59Z', '2026-12-01T00:00:00Z'],
      ['2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z'],
    ]) {
      const previous = at(connection, before);
      const next = at(connection, after);
      assert.notEqual(previous.product.id, next.product.id);
      assert.equal(previous.valid_date, before.slice(0, 10));
      assert.equal(next.valid_date, after.slice(0, 10));
      assert.equal(next.product.category, 'pizza');
    }
    const first = at(connection, '2027-02-01T12:00:00Z');
    const skipped = at(connection, '2027-02-04T12:00:00Z');
    const ids = connection.prepare("SELECT id FROM products WHERE category = 'pizza' ORDER BY id")
      .all().map(({ id }) => id);
    assert.equal(skipped.product.id, ids[(ids.indexOf(first.product.id) + 3) % ids.length]);
    assert.notEqual(skipped.product.id, at(connection, '2027-02-05T00:00:00Z').product.id);
    assert.deepEqual(at(connection, '2027-02-04T04:00:00-08:00'), skipped);
    let calls = 0;
    resolveDailyPizza(connection, () => {
      calls++;
      return new Date('2027-02-04T12:00:00Z');
    });
    assert.equal(calls, 1);
  } finally {
    connection.close();
  }
});

test('two pizzas rotate daily; fewer than two are unavailable and stock is irrelevant', () => {
  for (const count of [0, 1, 2]) {
    const connection = new DatabaseSync(':memory:');
    try {
      seed(connection, count);
      const selection = at(connection, '2026-11-21T12:00:00Z');
      if (count < 2) {
        assert.equal(selection, null);
        assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM daily_pizza_selections').get().n, 0);
      } else {
        assert.equal(selection.product.stock, 0);
        connection.prepare('UPDATE products SET stock = 100 WHERE id = ?').run(selection.product.id);
        assert.equal(at(connection, '2026-11-21T23:59:59Z').product.id, selection.product.id);
        assert.notEqual(at(connection, '2026-11-22T00:00:00Z').product.id, selection.product.id);
      }
    } finally {
      connection.close();
    }
  }
});

test('persisted picks survive reopened databases and concurrent first callers', async () => {
  const directory = fs.mkdtempSync(path.join(__dirname, '.daily-pizza-'));
  const filename = path.join(directory, 'test.db');
  let connection;
  try {
    connection = new DatabaseSync(filename);
    connection.exec('PRAGMA journal_mode = WAL');
    seed(connection);
    // Choose a non-calendar pick to prove the persisted row, not recomputation, wins.
    const normal = at(connection, '2026-11-21T12:00:00Z');
    const other = connection.prepare("SELECT id FROM products WHERE category = 'pizza' AND id != ?")
      .get(normal.product.id).id;
    connection.prepare('UPDATE daily_pizza_selections SET product_id = ?').run(other);
    connection.close();
    connection = new DatabaseSync(filename);
    assert.equal(at(connection, '2026-11-21T23:00:00Z').product.id, other);
    connection.close();
    connection = undefined;

    const modulePath = require.resolve('../dist/services/daily-pizza');
    const results = await Promise.all(Array.from({ length: 6 }, () => new Promise((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        const { DatabaseSync } = require('node:sqlite');
        const { resolveDailyPizza } = require(workerData.modulePath);
        const connection = new DatabaseSync(workerData.filename);
        connection.exec('PRAGMA busy_timeout = 5000');
        const result = resolveDailyPizza(connection, () => new Date('2026-11-22T00:00:00Z'));
        connection.close();
        parentPort.postMessage(result);
      `, { eval: true, workerData: { filename, modulePath } });
      worker.once('message', resolve);
      worker.once('error', reject);
      worker.once('exit', code => {
        if (code !== 0) reject(new Error(`Worker exited ${code}`));
      });
    })));
    results.forEach(result => assert.deepEqual(result, results[0]));
    connection = new DatabaseSync(filename);
    assert.equal(connection.prepare(
      "SELECT COUNT(*) AS n FROM daily_pizza_selections WHERE valid_date = '2026-11-22'"
    ).get().n, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(at(connection, '2026-11-22T23:59:59Z'))), results[0]);
  } finally {
    if (connection) connection.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('discount rounds unit cents once before quantity multiplication', () => {
  assert.equal(discountedUnitPrice(1299), 1039);
  assert.equal(discountedUnitPrice(1001), 801);
  assert.equal(discountedUnitPrice(1002), 802);
  assert.equal(discountedUnitPrice(0), 0);
  assert.equal(discountedUnitPrice(1001) * 3, 2403);
});

test('HTTP contract, no-store, rollover, unavailable responses and catalog compatibility', async () => {
  seed(db);
  let instant = '2026-12-31T23:59:59Z';
  const app = express();
  app.use('/api/pizza-of-the-day', createDailyPizzaRouter(db, () => new Date(instant)));
  app.use('/api/products', productsRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const catalog = await (await fetch(`${base}/api/products`)).json();
    const response = await fetch(`${base}/api/pizza-of-the-day`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const promotion = await response.json();
    assert.deepEqual(promotion, {
      product: catalog.find(p => p.id === promotion.product.id),
      original_price_cents: 1299,
      discounted_price_cents: 1039,
      valid_date: '2026-12-31',
    });
    const repeated = await Promise.all(Array.from({ length: 5 }, async () =>
      (await fetch(`${base}/api/pizza-of-the-day`)).json()));
    repeated.forEach(result => assert.deepEqual(result, promotion));
    instant = '2027-01-01T00:00:00Z';
    const next = await (await fetch(`${base}/api/pizza-of-the-day`)).json();
    assert.equal(next.valid_date, '2027-01-01');
    assert.notEqual(next.product.id, promotion.product.id);
    assert.deepEqual(await (await fetch(`${base}/api/products`)).json(), catalog);
    assert.deepEqual(await (await fetch(`${base}/api/products/1`)).json(), catalog[0]);
    assert.deepEqual(await (await fetch(`${base}/api/products?category=merch`)).json(), [catalog[0]]);
    db.exec("UPDATE products SET category = 'merch'");
    for (const count of [0, 1]) {
      if (count) db.exec("UPDATE products SET category = 'pizza' WHERE id = 3");
      const unavailable = await fetch(`${base}/api/pizza-of-the-day`);
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await unavailable.json(), { error: 'Daily promotion unavailable' });
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  }
});
