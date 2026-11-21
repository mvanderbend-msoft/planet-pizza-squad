const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Compile the production store in memory using the existing frontend compiler.
const source = fs.readFileSync(path.join(__dirname, '../src/context/dailyPromotionStore.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storeModule = { exports: {} };
new Function('exports', 'require', compiled)(storeModule.exports, require);
const { createDailyPromotionStore } = storeModule.exports;

function daily(date = '2026-12-31', id = 7) {
  return {
    product: { id, sku: `pizza-${id}`, name: 'Hangar Pizza', description: 'Pizza',
      category: 'pizza', price_cents: 1299, image_url: '/missing.svg', stock: 10 },
    original_price_cents: 1299,
    discounted_price_cents: 1039,
    valid_date: date,
  };
}

function harness(instant = '2026-12-31T23:59:59.000Z') {
  let now = Date.parse(instant);
  let timer;
  const requests = [];
  const store = createDailyPromotionStore((signal) => new Promise((resolve, reject) => {
    requests.push({ signal, resolve, reject });
  }), {
    now: () => now,
    setTimeout: (callback, delay) => { timer = { callback, delay }; return 1; },
    clearTimeout: () => { timer = undefined; },
  });
  return {
    store, requests,
    setNow: (instant) => { now = Date.parse(instant); },
    getTimer: () => timer,
    fireTimer: () => timer.callback(),
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('one shared selection exposes cents/date and retains the base product for cart Add', async () => {
  const { store, requests } = harness();
  const home = [];
  const catalog = [];
  const unsubscribe = store.subscribe(() => home.push(store.getSnapshot()));
  store.subscribe(() => catalog.push(store.getSnapshot()));
  const response = daily();
  const result = store.refresh();
  requests[0].resolve(response);
  assert.deepEqual(await result, {
    productId: 7, originalPriceCents: 1299, discountedPriceCents: 1039, validDate: '2026-12-31',
  });
  assert.equal(home.at(-1), catalog.at(-1));
  assert.equal(store.getSnapshot().product, response.product);
  assert.equal(response.product.price_cents, 1299);
  assert.equal(store.getSnapshot().loading, false);
  unsubscribe();
  store.stop();
});

test('UTC midnight clears yesterday synchronously and publishes the new selection to all consumers', async () => {
  const h = harness();
  h.store.start();
  assert.equal(h.getTimer().delay, 1000);
  h.requests[0].resolve(daily());
  await settle();
  h.setNow('2027-01-01T00:00:00Z');
  h.fireTimer();
  assert.equal(h.store.getSnapshot().promotion, null);
  assert.equal(h.store.getSnapshot().product, null);
  assert.equal(h.store.getSnapshot().loading, true);
  assert.equal(h.getTimer().delay, 86_400_000);
  h.requests[1].resolve(daily('2027-01-01', 8));
  await settle();
  assert.equal(h.store.getSnapshot().promotion.productId, 8);
  assert.equal(h.store.getSnapshot().promotion.validDate, '2027-01-01');
  h.store.stop();
});

test('resume after suspension expires the old day and rejects stale/out-of-order successes and failures', async () => {
  const h = harness();
  let result = h.store.refresh();
  h.requests[0].resolve(daily());
  await result;
  const oldRequest = h.store.refresh();
  h.setNow('2027-01-02T08:00:00Z');
  result = h.store.resume();
  assert.equal(h.store.getSnapshot().promotion, null);
  assert.equal(h.requests[1].signal.aborted, true);
  h.requests[2].resolve(daily('2027-01-02', 9));
  await result;
  h.requests[1].resolve(daily());
  assert.equal(await oldRequest, null);
  assert.equal(h.store.getSnapshot().promotion.productId, 9);
  const obsolete = h.store.refresh();
  result = h.store.refresh();
  h.requests[4].resolve(daily('2027-01-02', 10));
  await result;
  h.requests[3].reject(new Error('late failure'));
  await obsolete;
  assert.equal(h.store.getSnapshot().promotion.productId, 10);
  assert.equal(h.store.getSnapshot().error, null);
  h.store.stop();
});

test('failure, wrong UTC dates and non-pizza responses remove only promotional state; refresh recovers', async () => {
  const h = harness();
  let result = h.store.refresh();
  h.requests[0].resolve(daily());
  await result;
  result = h.store.refresh();
  h.requests[1].reject(new Error('API 503'));
  assert.equal(await result, null);
  assert.equal(h.store.getSnapshot().promotion, null);
  assert.equal(h.store.getSnapshot().product, null);
  assert.match(h.store.getSnapshot().error, /503/);
  assert.equal(h.store.getSnapshot().loading, false);
  for (const response of [daily('2026-12-30'), daily('2027-01-01'),
    { ...daily(), product: { ...daily().product, category: 'merch' } }]) {
    result = h.store.refresh();
    h.requests.at(-1).resolve(response);
    assert.equal(await result, null);
    assert.equal(h.store.getSnapshot().promotion, null);
  }
  result = h.store.refresh();
  h.requests.at(-1).resolve(daily());
  assert.equal((await result).productId, 7);
  assert.equal(h.store.getSnapshot().error, null);
  h.store.stop();
});

test('a response crossing midnight without a timer is rejected; stopped/StrictMode requests cannot publish', async () => {
  const h = harness();
  const result = h.store.refresh();
  h.setNow('2027-01-01T00:00:00Z');
  h.requests[0].resolve(daily());
  assert.equal(await result, null);
  h.store.start();
  h.store.stop();
  assert.equal(h.getTimer(), undefined);
  assert.equal(h.requests[1].signal.aborted, true);
  h.store.start();
  h.requests[2].resolve(daily('2027-01-01', 8));
  await settle();
  h.requests[1].resolve(daily('2027-01-01', 9));
  await settle();
  assert.equal(h.store.getSnapshot().promotion.productId, 8);
  h.store.stop();
});
