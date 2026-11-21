const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { Worker } = require('node:worker_threads');
const { execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

process.env.DB_PATH = ':memory:';
const { db, migrate } = require('../dist/db');
const { createOrdersRouter } = require('../dist/routes/orders');
after(() => db.close());

const placement = '2026-11-21T12:00:00.123Z';
const customer = { name: 'Buyer', email: 'buyer@example.com', address: '1 Pizza Way' };
const terminal = {
  order_id: 1, status: 'delivered', estimated_delivery_at: '2026-11-21T12:08:00.123Z',
  step_timestamps: {
    received: placement, preparing: '2026-11-21T12:02:00.123Z',
    baking: '2026-11-21T12:04:00.123Z', out_for_delivery: '2026-11-21T12:06:00.123Z',
    delivered: '2026-11-21T12:08:00.123Z',
  },
};

function records(connection) {
  return connection.prepare(
    'SELECT rowid, order_id, status, reached_at FROM order_tracking_steps ORDER BY order_id, reached_at'
  ).all().map(row => ({ ...row }));
}

async function serve(connection, clock) {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', createOrdersRouter(connection, clock));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const base = `http://127.0.0.1:${server.address().port}/api/orders`;
  return {
    async request(suffix, body) {
      const response = await fetch(base + suffix, body === undefined ? undefined : {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      assert.match(response.headers.get('content-type'), /^application\/json\b/);
      return { status: response.status, cacheControl: response.headers.get('cache-control'),
        body: await response.json() };
    },
    async close() {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
  };
}

async function concurrentCatchup(t, filename, orderId) {
  const gate = new SharedArrayBuffer(4);
  const workers = [];
  const modulePath = require.resolve('../dist/services/order-status');
  t.after(async () => { await Promise.all(workers.map(worker => worker.terminate())); });
  const jobs = Array.from({ length: 6 }, () => {
    let ready;
    const started = new Promise(resolve => { ready = resolve; });
    let result;
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads');
      const { DatabaseSync } = require('node:sqlite');
      const { resolveOrderStatus } = require(workerData.modulePath);
      const connection = new DatabaseSync(workerData.filename);
      connection.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
      parentPort.postMessage({ ready: true });
      Atomics.wait(new Int32Array(workerData.gate), 0, 0);
      try {
        const result = resolveOrderStatus(connection, workerData.orderId, new Date('2027-11-21T12:00:00Z'));
        parentPort.postMessage({ result });
      } finally {
        connection.close();
      }
    `, { eval: true, workerData: { modulePath, filename, orderId, gate } });
    workers.push(worker);
    const completed = new Promise((resolve, reject) => {
      worker.on('message', message => {
        if (message.ready) ready();
        else result = message.result;
      });
      worker.once('error', error => { ready(); reject(error); });
      worker.once('exit', code => {
        ready();
        if (code !== 0) reject(new Error(`Tracking worker exited ${code}`));
        else if (!result) reject(new Error('Tracking worker returned no result'));
        else resolve(result);
      });
    });
    return { started, completed };
  });
  // All independent connections are ready before any can materialize the skipped steps.
  const completion = Promise.all(jobs.map(job => job.completed));
  completion.catch(() => {});
  try {
    await Promise.all(jobs.map(job => job.started));
    Atomics.store(new Int32Array(gate), 0, 1);
    Atomics.notify(new Int32Array(gate), 0, workers.length);
    return await completion;
  } finally {
    await Promise.all(workers.map(worker => worker.terminate()));
  }
}

test('independent concurrent catch-up is durable, unique and immutable through restart and backward HTTP reads',
  { timeout: 20000 }, async t => {
    const directory = path.join(__dirname, `.order-status-${randomUUID()}`);
    fs.mkdirSync(directory);
    const filename = path.join(directory, 'test.db');
    let connection;
    let api;
    t.after(async () => {
      if (api) await api.close();
      if (connection) connection.close();
      fs.rmSync(directory, { recursive: true, force: true });
    });
    connection = new DatabaseSync(filename);
    connection.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000');
    migrate(connection);
    connection.exec(`
      INSERT INTO products (id, sku, name, description, price_cents, category, image_url, stock)
      VALUES (1, 'pizza-1', 'First pizza', '', 1299, 'pizza', '', 100),
        (2, 'pizza-2', 'Second pizza', '', 1001, 'pizza', '', 100),
        (3, 'shirt', 'Shirt', '', 2000, 'merch', '', 100);
      INSERT INTO daily_pizza_selections (valid_date, product_id) VALUES ('2026-11-21', 1);
    `);
    let calls = 0;
    api = await serve(connection, () => new Date(calls++ === 0 ? placement : '2026-11-22T00:00:00Z'));
    const paid = await api.request('', { customer,
      items: [{ productId: 1, quantity: 3 }, { productId: 2, quantity: 2 }, { productId: 3, quantity: 1 }] });
    assert.equal(paid.status, 201);
    assert.equal(calls, 1);
    assert.equal(paid.body.created_at, placement);
    assert.equal(paid.body.status, 'paid');
    assert.equal(paid.body.total_cents, 7119);
    assert.deepEqual(paid.body.items.map(item =>
      [item.name_snapshot, item.quantity, item.unit_price_cents]),
    [['First pizza', 3, 1039], ['Second pizza', 2, 1001], ['Shirt', 1, 2000]]);
    const received = records(connection);
    assert.deepEqual(received.map(({ order_id, status, reached_at }) => ({ order_id, status, reached_at })),
      [{ order_id: paid.body.id, status: 'received', reached_at: placement }]);
    const catalog = connection.prepare('SELECT * FROM products ORDER BY id').all();
    await api.close();
    api = undefined;
    connection.close();
    connection = undefined;

    const results = await concurrentCatchup(t, filename, paid.body.id);
    results.forEach(result => assert.deepEqual(result, terminal));
    connection = new DatabaseSync(filename);
    migrate(connection);
    migrate(connection);
    const deliveredRows = records(connection);
    assert.deepEqual(deliveredRows.map(({ status, reached_at }) => [status, reached_at]),
      Object.entries(terminal.step_timestamps));
    assert.deepEqual(deliveredRows[0], received[0]);
    assert.throws(() => connection.prepare(
      'INSERT INTO order_tracking_steps (order_id, status, reached_at) VALUES (?, ?, ?)'
    ).run(1, 'delivered', '2027-01-01T00:00:00Z'), /UNIQUE constraint failed/);
    assert.deepEqual(connection.prepare('SELECT * FROM products ORDER BY id').all(), catalog);
    connection.exec("UPDATE products SET name = 'Changed', price_cents = 9999");
    (await concurrentCatchup(t, filename, paid.body.id)).forEach(result => assert.deepEqual(result, terminal));
    assert.deepEqual(records(connection), deliveredRows);
    connection.close();
    connection = new DatabaseSync(filename);
    migrate(connection);
    api = await serve(connection, () => new Date('2026-11-20T00:00:00Z'));
    const expected = { status: 200, cacheControl: 'no-store', body: terminal };
    const repeated = await Promise.all(Array.from({ length: 6 }, () => api.request('/1/status')));
    repeated.forEach(result => assert.deepEqual(result, expected));
    assert.deepEqual(records(connection), deliveredRows);
    assert.deepEqual(await api.request('/1'), { status: 200, cacheControl: null, body: paid.body });
  });

test('legacy SQLite UTC backfill and failed first-access rollback work in non-UTC processes', () => {
  const dbModule = require.resolve('../dist/db');
  const statusModule = require.resolve('../dist/services/order-status');
  for (const [timezone, expectedOffset] of [['America/Los_Angeles', 480], ['Asia/Kolkata', -330]]) {
    const output = execFileSync(process.execPath, ['-e', `
      const { DatabaseSync } = require('node:sqlite');
      const { db, migrate } = require(${JSON.stringify(dbModule)});
      const { resolveOrderStatus } = require(${JSON.stringify(statusModule)});
      const connection = new DatabaseSync(':memory:');
      try {
        migrate(connection);
        connection.exec(\`
          PRAGMA foreign_keys = ON;
          DROP TABLE order_tracking_steps;
          INSERT INTO products (id, sku, name, description, price_cents, category, image_url)
          VALUES (1, 'legacy-shirt', 'Legacy shirt', '', 2000, 'merch', '');
          INSERT INTO orders (created_at, customer_name, customer_email, shipping_address, total_cents)
          VALUES ('2026-11-21 12:00:00', 'Legacy', 'buyer@example.com', 'Address', 6000);
          INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents, name_snapshot)
          VALUES (1, 1, 3, 2000, 'Legacy shirt');
        \`);
        const paid = { ...connection.prepare('SELECT * FROM orders').get(),
          items: connection.prepare('SELECT * FROM order_items').all() };
        migrate(connection);
        migrate(connection);
        connection.exec(\`
          CREATE TRIGGER fail_legacy BEFORE INSERT ON order_tracking_steps WHEN NEW.status = 'delivered'
          BEGIN SELECT RAISE(ABORT, 'Legacy write failed'); END;
        \`);
        let error;
        try {
          resolveOrderStatus(connection, 1, new Date('2027-01-01T00:00:00Z'));
        } catch (failure) { error = failure.message; }
        const failedRows = connection.prepare('SELECT * FROM order_tracking_steps').all();
        connection.exec('DROP TRIGGER fail_legacy');
        const result = resolveOrderStatus(connection, 1, new Date('2027-01-01T00:00:00Z'));
        const rows = connection.prepare(
          'SELECT rowid, status, reached_at FROM order_tracking_steps ORDER BY reached_at'
        ).all();
        migrate(connection);
        const backward = resolveOrderStatus(connection, 1, new Date('2026-01-01T00:00:00Z'));
        const repeatedRows = connection.prepare(
          'SELECT rowid, status, reached_at FROM order_tracking_steps ORDER BY reached_at'
        ).all();
        const after = { ...connection.prepare('SELECT * FROM orders').get(),
          items: connection.prepare('SELECT * FROM order_items').all() };
        console.log(JSON.stringify({
          offset: new Date('2026-11-21T12:00:00Z').getTimezoneOffset(),
          error, failedRows, result, backward, rows, repeatedRows, paid, after,
        }));
      } finally { connection.close(); db.close(); }
    `], { env: { ...process.env, DB_PATH: ':memory:', TZ: timezone }, encoding: 'utf8',
      timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'] });
    const observed = JSON.parse(output);
    assert.equal(observed.offset, expectedOffset, `child process must actually use ${timezone}`);
    assert.match(observed.error, /Legacy write failed/);
    assert.deepEqual(observed.failedRows, [], 'legacy received and all partial catch-up writes roll back');
    const expected = JSON.parse(JSON.stringify(terminal).replaceAll('.123Z', '.000Z'));
    assert.deepEqual(observed.result, expected, timezone);
    assert.deepEqual(observed.backward, expected, timezone);
    assert.equal(observed.rows.length, 5);
    assert.deepEqual(observed.rows.map(row => [row.status, row.reached_at]),
      Object.entries(expected.step_timestamps));
    assert.deepEqual(observed.repeatedRows, observed.rows);
    assert.deepEqual(observed.after, observed.paid);
    assert.equal(observed.after.created_at, '2026-11-21 12:00:00');
    assert.equal(observed.after.status, 'paid');
    assert.equal(observed.after.total_cents, 6000);
    assert.deepEqual(observed.after.items.map(item =>
      [item.name_snapshot, item.quantity, item.unit_price_cents]), [['Legacy shirt', 3, 2000]]);
  }
});
