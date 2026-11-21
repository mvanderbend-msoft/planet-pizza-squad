const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

process.env.DB_PATH = ':memory:';
const { db, migrate } = require('../dist/db');
const { createOrdersRouter } = require('../dist/routes/orders');
const { createDailyPizzaRouter } = require('../dist/routes/daily-pizza');
after(() => db.close());

const customer = { name: 'Test Buyer', email: 'buyer@example.com', address: '1 Pizza Way' };
const beforeMidnight = '2026-11-21T23:59:59.999Z';
const afterMidnight = '2026-11-22T00:00:00.000Z';

function seed(connection) {
  migrate(connection);
  connection.exec('PRAGMA foreign_keys = ON');
  connection.exec(`
    INSERT INTO products (id, sku, name, description, price_cents, category, image_url, stock)
    VALUES
      (1, 'pizza-1', 'First pizza', '', 1299, 'pizza', '', 100),
      (2, 'pizza-2', 'Second pizza', '', 1299, 'pizza', '', 100),
      (3, 'merch', 'Shirt', '', 2000, 'merch', '', 100);
    INSERT INTO daily_pizza_selections (valid_date, product_id)
    VALUES ('2026-11-21', 1), ('2026-11-22', 2);
  `);
}

async function serve(t, connection, clock = () => new Date(beforeMidnight)) {
  const app = express();
  app.use(express.json());
  app.use('/api/pizza-of-the-day', createDailyPizzaRouter(connection, clock));
  app.use('/api/orders', createOrdersRouter(connection, clock));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const base = `http://127.0.0.1:${server.address().port}/api/orders`;
  return {
    async daily() {
      const response = await fetch(`${base.replace('/orders', '/pizza-of-the-day')}`);
      return { status: response.status, body: await response.json() };
    },
    async post(body) {
      const response = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json() };
    },
    async get(id) {
      const response = await fetch(`${base}/${id}`);
      return { status: response.status, body: await response.json() };
    },
  };
}

async function fixture(t, clock) {
  const connection = new DatabaseSync(':memory:');
  seed(connection);
  t.after(() => connection.close());
  const api = await serve(t, connection, clock);
  return { connection, ...api };
}

function counts(connection) {
  return ['orders', 'order_items'].map(table =>
    connection.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n);
}

test('advertised selection and checkout agree for both resolver entry paths, including zero and fractional cents', async t => {
  const { connection, daily, post, get } = await fixture(t);
  for (const [price, expected] of [[1001, 801], [0, 0]]) {
    connection.prepare('UPDATE products SET price_cents = ? WHERE id = 1').run(price);
    const advertised = await daily();
    assert.equal(advertised.status, 200);
    assert.equal(advertised.body.product.id, 1);
    assert.equal(advertised.body.product.price_cents, price);
    assert.equal(advertised.body.discounted_price_cents, expected);
    const paid = await post({ customer, promotion_date: advertised.body.valid_date,
      items: [{ productId: 1, quantity: 3, unit_price_cents: 99999 },
        { productId: 2, quantity: 1 }, { productId: 3, quantity: 2 }] });
    assert.equal(paid.status, 201);
    assert.deepEqual(paid.body.items.map(item => item.unit_price_cents), [expected, 1299, 2000]);
    assert.equal(paid.body.total_cents, expected * 3 + 1299 + 4000);
    assert.deepEqual(await get(paid.body.id), { status: 200, body: paid.body });
  }
  connection.exec('DELETE FROM daily_pizza_selections');
  const paid = await post({ customer, items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] });
  assert.equal(paid.status, 201);
  const advertised = await daily();
  assert.equal(advertised.status, 200);
  const selected = paid.body.items.find(item => item.product_id === advertised.body.product.id);
  assert.equal(selected.unit_price_cents, advertised.body.discounted_price_cents);
  assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM daily_pizza_selections').get().n, 1);
});

test('mixed checkout discounts every matching line per unit and persists paid snapshots', async t => {
  const { connection, post, get } = await fixture(t);
  const result = await post({
    customer,
    promotion_date: '2026-11-21',
    total_cents: 1,
    discounted: false,
    items: [
      { productId: 1, quantity: 3, price_cents: 1, discounted: false },
      { productId: 2, quantity: 2, unit_price_cents: 0, discounted: true },
      { productId: 3, quantity: 1, discount: 100 },
      { productId: 1, quantity: 1 },
    ],
  });
  assert.equal(result.status, 201);
  assert.equal(result.body.status, 'paid');
  assert.equal(result.body.total_cents, 8754);
  assert.deepEqual(result.body.items.map(item => [item.product_id, item.quantity, item.unit_price_cents]),
    [[1, 3, 1039], [2, 2, 1299], [3, 1, 2000], [1, 1, 1039]]);
  assert.equal(result.body.items[0].unit_price_cents * result.body.items[0].quantity, 3117);
  assert.equal(connection.prepare('SELECT total_cents FROM orders').get().total_cents, 8754);
  assert.deepEqual(connection.prepare('SELECT unit_price_cents FROM order_items ORDER BY id')
    .all().map(item => item.unit_price_cents), [1039, 1299, 2000, 1039]);
  assert.deepEqual(await get(result.body.id), { status: 200, body: result.body });
  assert.deepEqual(connection.prepare('SELECT price_cents FROM products ORDER BY id')
    .all().map(p => p.price_cents), [1299, 1299, 2000]);
});

test('rollover guard rejects stale dates before writes and validates calendar dates', async t => {
  const { connection, post } = await fixture(t);
  const order = { customer, items: [{ productId: 1, quantity: 1 }] };
  connection.exec('DELETE FROM daily_pizza_selections');
  for (const promotion_date of ['2026-11-20', '2026-11-22']) {
    const result = await post({ ...order, promotion_date });
    assert.deepEqual(result, {
      status: 409,
      body: { error: 'Promotion date changed', code: 'PROMOTION_DATE_CHANGED' },
    });
    assert.deepEqual(counts(connection), [0, 0]);
    assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM daily_pizza_selections').get().n, 0);
  }
  for (const promotion_date of ['2026-2-01', '2026-02-29', '2026-11-31', '2026-11-21T00:00:00Z', '', null, 20261121]) {
    const result = await post({ ...order, promotion_date });
    assert.equal(result.status, 400, String(promotion_date));
    assert.equal(result.body.error, 'Invalid order');
    assert.deepEqual(counts(connection), [0, 0]);
  }
  assert.equal((await post({ ...order, promotion_date: '2026-11-21' })).status, 201);
});

test('legacy checkout captures one instant across midnight and the next order uses the new day', async t => {
  let clockCalls = 0;
  const { post } = await fixture(t, () => new Date(clockCalls++ === 0 ? beforeMidnight : afterMidnight));
  const order = { customer, items: [{ productId: 1, quantity: 3 }, { productId: 2, quantity: 1 }] };
  const first = await post(order);
  assert.equal(first.status, 201);
  assert.equal(clockCalls, 1);
  assert.deepEqual(first.body.items.map(item => item.unit_price_cents), [1039, 1299]);
  assert.equal(first.body.total_cents, 4416);
  const next = await post({ ...order, promotion_date: '2026-11-22' });
  assert.equal(next.status, 201);
  assert.equal(clockCalls, 2);
  assert.deepEqual(next.body.items.map(item => item.unit_price_cents), [1299, 1039]);
  assert.equal(next.body.total_cents, 4936);
});

test('unavailable promotion preserves base pricing but resolver failures reject checkout', async t => {
  const { connection, post } = await fixture(t);
  connection.exec("UPDATE products SET category = 'merch' WHERE id = 2");
  const order = { customer, items: [{ productId: 1, quantity: 3 }, { productId: 3, quantity: 1 }] };
  const ordinary = await post(order);
  assert.equal(ordinary.status, 201);
  assert.equal(ordinary.body.total_cents, 5897);
  assert.deepEqual(ordinary.body.items.map(item => item.unit_price_cents), [1299, 2000]);
  connection.exec("UPDATE products SET category = 'pizza' WHERE id = 2; DROP TABLE daily_pizza_selections");
  const failed = await post(order);
  assert.equal(failed.status, 500);
  assert.match(failed.body.error, /daily_pizza_selections/);
  assert.deepEqual(counts(connection), [1, 2]);
});

test('existing validation and stock errors leave no orders; item-write failures roll back all writes', async t => {
  const { connection, post } = await fixture(t);
  const order = { customer, items: [{ productId: 1, quantity: 1 }] };
  for (const body of [
    { ...order, customer: { ...customer, email: 'invalid' } },
    { ...order, customer: { ...customer, name: '' } },
    { ...order, customer: { ...customer, address: '' } },
    { ...order, items: [] },
    { ...order, items: [{ productId: 1, quantity: 0 }] },
    { ...order, items: [{ productId: 1, quantity: 100 }] },
    { ...order, items: [{ productId: 1, quantity: 1.5 }] },
    { ...order, items: [{ productId: 0, quantity: 1 }] },
  ]) {
    assert.equal((await post(body)).status, 400);
    assert.deepEqual(counts(connection), [0, 0]);
  }
  const unknown = await post({ ...order, items: [...order.items, { productId: 999, quantity: 1 }] });
  assert.deepEqual(unknown, { status: 400, body: { error: 'Product 999 not found' } });
  connection.exec('UPDATE products SET stock = 0 WHERE id = 2');
  const unavailable = await post({ ...order, items: [...order.items, { productId: 2, quantity: 1 }] });
  assert.deepEqual(unavailable, { status: 409, body: { error: 'Insufficient stock for Second pizza' } });
  assert.deepEqual(counts(connection), [0, 0]);
  connection.exec(`
    DELETE FROM daily_pizza_selections;
    CREATE TRIGGER fail_second_item BEFORE INSERT ON order_items WHEN NEW.product_id = 3
    BEGIN SELECT RAISE(ABORT, 'Item write failed'); END;
  `);
  const failed = await post({ ...order, items: [...order.items, { productId: 3, quantity: 1 }] });
  assert.deepEqual(failed, { status: 500, body: { error: 'Item write failed' } });
  assert.deepEqual(counts(connection), [0, 0]);
  assert.equal(connection.prepare('SELECT COUNT(*) AS n FROM daily_pizza_selections').get().n, 0);
  connection.exec('DROP TRIGGER fail_second_item');
  assert.equal((await post(order)).status, 201);
});

test('paid snapshots survive rollover, catalog changes and a reopened database', async t => {
  const directory = fs.mkdtempSync(path.join(__dirname, '.orders-'));
  const filename = path.join(directory, 'test.db');
  let connection = new DatabaseSync(filename);
  t.after(() => {
    connection.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  seed(connection);
  const initial = await serve(t, connection);
  const paid = await initial.post({ customer, items: [{ productId: 1, quantity: 3 }] });
  assert.equal(paid.status, 201);
  assert.equal(paid.body.total_cents, 3117);
  connection.exec("UPDATE products SET price_cents = 9999, name = 'Changed name'");
  connection.close();
  connection = new DatabaseSync(filename);
  const restarted = await serve(t, connection, () => new Date(afterMidnight));
  assert.deepEqual(await restarted.get(paid.body.id), { status: 200, body: paid.body });
  assert.equal(paid.body.items[0].unit_price_cents, 1039);
  assert.equal(paid.body.items[0].name_snapshot, 'First pizza');
  const next = await restarted.post({ customer, items: [{ productId: 1, quantity: 1 }] });
  assert.equal(next.status, 201);
  assert.equal(next.body.total_cents, 9999);
  assert.deepEqual(await restarted.get(paid.body.id), { status: 200, body: paid.body });
});
