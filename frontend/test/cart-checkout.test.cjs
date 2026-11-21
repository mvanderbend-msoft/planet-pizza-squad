const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const modules = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', 'src', relative);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {};
  modules.set(filename, exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', compiled)(exports, (name) =>
    name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..', 'src'),
      path.resolve(path.dirname(filename), `${name}.ts`))) : require(name));
  return exports;
}
const { priceCart, addCartItem, restoreCartProducts } = load('context/cartPricing.ts');
const { submitReviewedCart } = load('context/checkoutPricing.ts');
const { ApiError } = load('api/ApiError.ts');
const pizza = { id: 7, category: 'pizza', price_cents: 1299, stock: 99, name: 'Pizza' };
const other = { ...pizza, id: 8, price_cents: 1001 };
const merch = { ...pizza, id: 9, category: 'merch', price_cents: 2000 };
const date = '2026-12-31';
const state = {
  promotion: { productId: 7, originalPriceCents: 1299, discountedPriceCents: 1039, validDate: date },
  loading: false, error: null, noOfferDate: null,
};
const priced = (items, promotionState = state, today = date) => priceCart(items, promotionState, today);

test('all add paths merge base snapshots and apply rounded unit cents once to mixed quantities', () => {
  let items = addCartItem([], pizza);
  items = addCartItem(items, pizza); // banner and catalog
  items = addCartItem(items, { ...pizza }, 1); // detail
  items = addCartItem(items, other, 2);
  items = addCartItem(items, merch);
  const restored = JSON.parse(JSON.stringify(items));
  const cart = priced(restored);
  assert.equal(restored[0].product.price_cents, 1299);
  assert.equal(cart.items[0].unitPriceCents, 1039);
  assert.equal(cart.items[0].quantity, 3);
  assert.equal(cart.items[0].unitPriceCents * 3, 3117);
  assert.equal(cart.totalCents, 3117 + 2002 + 2000);
  assert.equal(priced(addCartItem(restored, pizza)).items[0].quantity, 4);
  assert.equal(priced([{ product: pizza, quantity: 1 }]).totalCents, 1039);
  assert.equal(priced([]).totalCents, 0);
});

test('rollover reprices by ID without mutating restored snapshots or quantities', () => {
  const items = [{ product: pizza, quantity: 3 }, { product: other, quantity: 2 }];
  assert.equal(priced(items).totalCents, 5119);
  const tomorrow = { ...state, promotion: {
    productId: 8, originalPriceCents: 1001, discountedPriceCents: 801, validDate: '2027-01-01',
  } };
  const next = priced(items, tomorrow, '2027-01-01');
  assert.deepEqual(next.items.map((i) => [i.quantity, i.unitPriceCents]), [[3, 1299], [2, 801]]);
  assert.equal(next.totalCents, 5499);
  assert.equal(items[0].product.price_cents, 1299);
  const expired = priced(items, state, '2027-01-01');
  assert.equal(expired.status, 'unavailable');
  assert.equal(expired.totalCents, 5899);
});

test('restoration replaces discounted pizza snapshots with menu bases while preserving quantities and merchandise', () => {
  const oldItems = [{ product: { ...pizza, price_cents: 1039 }, quantity: 3 },
    { product: merch, quantity: 2 }];
  const restored = restoreCartProducts(oldItems, [pizza, other]);
  assert.equal(restored[0].product.price_cents, 1299);
  assert.equal(restored[0].quantity, 3);
  assert.equal(restored[1], oldItems[1]);
  assert.equal(priced(restored).totalCents, 3117 + 4000);
  const rotated = priced(restored, { ...state, promotion: {
    ...state.promotion, productId: 8, originalPriceCents: 1001, discountedPriceCents: 801,
  } });
  assert.equal(rotated.totalCents, 3897 + 4000);
  assert.equal(oldItems[0].product.price_cents, 1039);
  assert.throws(() => restoreCartProducts(oldItems, [other]), /no longer on the menu/);
});

test('unverified pizza prices block Pay; explicit no-offer base prices and merch remain orderable', async () => {
  const pizzaItems = [{ product: pizza, quantity: 1 }];
  let submits = 0;
  for (const failure of [
    { ...state, loading: true },
    { ...state, promotion: null, error: 'network' },
    { ...state, promotion: null, noOfferDate: '2026-12-30' },
  ]) {
    const result = await submitReviewedCart(priced(pizzaItems), async () => priced(pizzaItems, failure),
      async () => { submits++; });
    assert.match(result.review, /unavailable/);
  }
  assert.equal(submits, 0);
  const noOffer = { ...state, promotion: null, noOfferDate: date };
  const base = priced(pizzaItems, noOffer);
  assert.equal(base.status, 'base');
  assert.equal(base.totalCents, 1299);
  const result = await submitReviewedCart(base, async () => base, async (fresh) => {
    assert.equal(fresh.promotionDate, date);
    return 'base order';
  });
  assert.equal(result.order, 'base order');
  const onlyMerch = priced([{ product: merch, quantity: 2 }], { ...noOffer, loading: true });
  assert.equal(onlyMerch.status, 'ready');
  assert.equal(onlyMerch.totalCents, 4000);
  assert.equal(onlyMerch.promotionDate, undefined);
});

test('pre-submit changes publish a review gate; a second Pay sends the freshly reviewed date', async () => {
  const items = [{ product: pizza, quantity: 3 }, { product: merch, quantity: 1 }];
  const reviewed = priced(items);
  const fresh = priced(items, { ...state, promotion: null, noOfferDate: date });
  let submits = 0;
  const submit = async (cart) => { submits++; return { date: cart.promotionDate }; };
  const first = await submitReviewedCart(reviewed, async () => fresh, submit);
  assert.match(first.review, /click Pay again/);
  assert.equal(submits, 0);
  const second = await submitReviewedCart(fresh, async () => fresh, submit);
  assert.deepEqual(second.order, { date });
  assert.equal(submits, 1);
  const changedQuantity = priced([{ product: pizza, quantity: 1 }]);
  assert.ok('review' in await submitReviewedCart(reviewed, async () => changedQuantity, submit));
});

test('stale-date 409 refreshes exactly once after submission, never resubmits, and preserves cargo', async () => {
  const items = [{ product: pizza, quantity: 3 }, { product: merch, quantity: 1 }];
  const original = JSON.stringify(items);
  const reviewed = priced(items);
  let refreshes = 0, submits = 0;
  const result = await submitReviewedCart(reviewed, async () => { refreshes++; return reviewed; },
    async () => { submits++; throw new ApiError(409, { code: 'PROMOTION_DATE_CHANGED' }); });
  assert.match(result.review, /daily offer changed/);
  assert.equal(refreshes, 2);
  assert.equal(submits, 1);
  assert.equal(JSON.stringify(items), original);
  await assert.rejects(submitReviewedCart(reviewed, async () => reviewed,
    async () => { throw new ApiError(409, { error: 'Insufficient stock' }); }), /Insufficient stock/);
  await assert.rejects(submitReviewedCart(reviewed, async () => reviewed,
    async () => { throw new Error('network'); }), /network/);
  assert.equal(JSON.stringify(items), original);
});

test('changed line prices require review even when their changes cancel in the total', async () => {
  const twin = { ...pizza, id: 8 };
  const items = [{ product: pizza, quantity: 1 }, { product: twin, quantity: 1 }];
  const reviewed = priced(items);
  const fresh = priced(items, { ...state, promotion: { ...state.promotion, productId: 8 } });
  assert.equal(reviewed.totalCents, fresh.totalCents);
  let submitted = false;
  const result = await submitReviewedCart(reviewed, async () => fresh,
    async () => { submitted = true; });
  assert.match(result.review, /click Pay again/);
  assert.equal(submitted, false);
});
