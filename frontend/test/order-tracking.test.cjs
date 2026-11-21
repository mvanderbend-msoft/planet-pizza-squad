const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function compile(relativePath, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const result = { exports: {} };
  new Function('exports', 'require', output)(result.exports, (name) => dependencies[name] ?? require(name));
  return result.exports;
}

const errors = compile('../src/api/ApiError.ts');
const { ApiError } = errors;
const { createOrderTrackingStore, parseOrderId } = compile('../src/context/orderTrackingStore.ts', {
  '../api/ApiError': errors,
});
const settle = () => new Promise((resolve) => setImmediate(resolve));
const tracking = (status = 'preparing', id = 15) => ({
  order_id: id, status,
  step_timestamps: { received: '2026-11-21T12:00:00.000Z', [status]: '2026-11-21T12:02:00.000Z' },
  estimated_delivery_at: '2026-11-21T12:08:00.000Z',
});
const order = {
  id: 15, total_cents: 3117, status: 'paid',
  items: [{ id: 1, name_snapshot: 'Original cargo name', quantity: 3, unit_price_cents: 1039 }],
};

function harness(id = 15) {
  const requests = { status: [], order: [] };
  const timers = new Map();
  let nextTimer = 0;
  const request = (kind) => (id, signal) => new Promise((resolve, reject) => {
    requests[kind].push({ id, signal, resolve, reject });
  });
  const store = createOrderTrackingStore(id, {
    getOrder: request('order'), getOrderStatus: request('status'),
  }, {
    setTimeout: (callback, delay) => {
      const id = ++nextTimer;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  return {
    store, requests, timers,
    fire() {
      assert.equal(timers.size, 1, 'only one polling timer');
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.callback();
    },
  };
}

test('delivered on entry stops polling but still loads immutable paid items', async () => {
  const h = harness();
  h.store.start();
  h.store.start();
  assert.equal(h.requests.status.length, 1);
  assert.equal(h.requests.order.length, 1);
  assert.equal(h.timers.size, 0, 'no timer while request is pending');
  const delivered = tracking('delivered');
  h.requests.status[0].resolve(delivered);
  await settle();
  assert.equal(h.timers.size, 0, 'terminal first response must not schedule a poll');
  h.requests.order[0].resolve(order);
  await settle();
  h.store.retry();
  assert.equal(h.requests.status.length, 1, 'manual retry cannot poll delivered');
  assert.equal(h.requests.order.length, 1, 'loaded paid snapshots are never refetched');
  assert.equal(h.store.getSnapshot().tracking, delivered);
  assert.equal(h.store.getSnapshot().order, order);
  h.store.stop();
});

test('outages retain progress, server ETA and paid snapshots; successful manual retry clears notice', async () => {
  const h = harness();
  h.store.start();
  const previous = tracking();
  h.requests.status[0].resolve(previous);
  h.requests.order[0].resolve(order);
  await settle();
  assert.equal([...h.timers.values()][0].delay, 15_000);
  h.fire();
  h.store.retry();
  assert.equal(h.requests.status.length, 2, 'retry during slow request must not overlap');
  assert.equal(h.timers.size, 0);
  h.requests.status[1].reject(new ApiError(503, { error: 'Unavailable' }));
  await settle();
  assert.equal(h.store.getSnapshot().tracking, previous);
  assert.equal(h.store.getSnapshot().tracking.estimated_delivery_at, previous.estimated_delivery_at);
  assert.equal(h.store.getSnapshot().order, order);
  assert.match(h.store.getSnapshot().statusError, /retry/i);
  assert.equal([...h.timers.values()][0].delay, 15_000);
  h.store.retry();
  assert.equal(h.timers.size, 0, 'manual retry replaces the waiting timer');
  const delivered = tracking('delivered');
  h.requests.status[2].resolve(delivered);
  await settle();
  assert.equal(h.store.getSnapshot().statusError, null);
  assert.equal(h.store.getSnapshot().tracking, delivered);
  assert.equal(h.timers.size, 0);
  assert.equal(h.requests.order.length, 1);
  h.store.stop();
});

test('initial network failure is retryable automatically; items failure recovers independently after delivery', async () => {
  const h = harness();
  h.store.start();
  h.requests.status[0].reject(new TypeError('Failed to fetch'));
  h.requests.order[0].reject(new ApiError(500, { error: 'Unavailable' }));
  await settle();
  assert.equal(h.store.getSnapshot().statusLoading, false);
  assert.equal(h.store.getSnapshot().orderLoading, false);
  assert.match(h.store.getSnapshot().statusError, /retry/i);
  assert.match(h.store.getSnapshot().orderError, /manifest/i);
  h.fire();
  h.requests.status[1].resolve(tracking('delivered'));
  await settle();
  assert.equal(h.store.getSnapshot().statusError, null);
  assert.notEqual(h.store.getSnapshot().orderError, null);
  assert.equal(h.requests.order.length, 1, 'status polls do not refetch items');
  h.store.retry();
  h.requests.order[1].resolve(order);
  await settle();
  assert.equal(h.store.getSnapshot().orderError, null);
  assert.equal(h.store.getSnapshot().order, order);
  assert.equal(h.requests.status.length, 2);
  assert.equal(h.timers.size, 0);
  h.store.stop();
});

test('cleanup aborts both channels and StrictMode restart ignores old success and failure', async () => {
  const h = harness();
  h.store.start();
  h.store.stop();
  assert.equal(h.requests.status[0].signal.aborted, true);
  assert.equal(h.requests.order[0].signal.aborted, true);
  h.store.start();
  h.requests.status[1].resolve(tracking());
  h.requests.order[1].resolve(order);
  await settle();
  h.requests.status[0].reject(new ApiError(404, { error: 'Order not found' }));
  h.requests.order[0].resolve({ ...order, id: 99 });
  await settle();
  assert.equal(h.store.getSnapshot().notFound, false);
  assert.equal(h.store.getSnapshot().order.id, 15);
  assert.equal(h.timers.size, 1);
  h.store.stop();
  assert.equal(h.timers.size, 0, 'unmount removes scheduled polling');
});

test('changing IDs creates isolated snapshots and discards old late responses', async () => {
  const old = harness(15);
  old.store.start();
  old.store.stop();
  const next = harness(16);
  next.store.start();
  assert.equal(next.store.getSnapshot().order, null);
  assert.equal(next.store.getSnapshot().tracking, null);
  assert.equal(next.requests.status[0].id, 16);
  old.requests.status[0].resolve(tracking());
  old.requests.order[0].reject(new TypeError('Offline'));
  next.requests.status[0].resolve(tracking('baking', 16));
  next.requests.order[0].resolve({ ...order, id: 16 });
  await settle();
  assert.equal(next.store.getSnapshot().order.id, 16);
  assert.equal(next.store.getSnapshot().tracking.order_id, 16);
  assert.equal(old.timers.size, 0);
  assert.equal(old.store.getSnapshot().orderError, null);
  next.store.stop();
});

for (const endpoint of ['status', 'order']) {
  test(`404 from ${endpoint} stops all work and shows not-found instead of outage`, async () => {
    const h = harness();
    h.store.start();
    const other = endpoint === 'status' ? 'order' : 'status';
    h.requests[other][0].resolve(other === 'status' ? tracking() : order);
    await settle();
    h.requests[endpoint][0].reject(new ApiError(404, { error: 'Order not found' }));
    await settle();
    assert.equal(h.store.getSnapshot().notFound, true);
    assert.equal(h.store.getSnapshot().tracking, null);
    assert.equal(h.store.getSnapshot().order, null);
    assert.equal(h.timers.size, 0);
    h.store.retry();
    h.store.start();
    assert.equal(h.requests.status.length, 1);
    assert.equal(h.requests.order.length, 1);
  });
}

test('route validation rejects nondecimal, zero and unsafe IDs before starting requests', () => {
  for (const input of [undefined, '', '0', '-1', '+1', '1.5', '1e3', '0x10', ' 15 ', 'NaN', '9007199254740992']) {
    assert.equal(parseOrderId(input), null, `reject ${input}`);
    const h = harness(parseOrderId(input));
    h.store.start();
    h.store.retry();
    assert.equal(h.store.getSnapshot().invalidId, true);
    assert.equal(h.requests.status.length + h.requests.order.length, 0);
  }
  assert.equal(parseOrderId('00015'), 15);
  assert.equal(parseOrderId('9007199254740991'), 9007199254740991);
});
