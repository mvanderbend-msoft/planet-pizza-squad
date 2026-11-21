async (page) => {
  const base = 'http://127.0.0.1:4177';
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  const control = async (body) => {
    const response = await page.request.post(`${base}/__smoke`, { data: body });
    check(response.ok(), 'fixture control failed');
  };
  const cargo = async () => (await page.request.get(`${base}/__smoke`)).json();
  const card = (name) => page.locator('.card').filter({
    has: page.getByRole('link', { name, exact: true }),
  }).last();
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.unrouteAll();
  await control({ reset: true, instant: '2026-12-31T12:00:00Z' });
  await page.clock.install({ time: new Date('2026-12-31T12:00:00Z') });
  await page.goto(base);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const banner = page.getByRole('region', { name: 'Pizza of the Day' });
  await banner.waitFor();
  check(await page.locator('main > div > section').first().getAttribute('aria-labelledby') ===
    'daily-pizza-title', 'banner is not the first home section');
  check(await banner.locator('del').innerText() === '$12.99', 'original banner cents');
  check((await banner.innerText()).includes('$10.39'), 'discounted banner cents');
  check(await banner.getByRole('img').evaluate(img => img.complete && img.naturalWidth > 0), 'banner image');
  await banner.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.getByRole('link', { name: 'Order Pizza', exact: true }).click();
  await card('Smoke Pizza One').waitFor();
  check(await page.getByText('Pizza of the Day', { exact: true }).count() === 1, 'catalog badge count');
  check((await card('Smoke Pizza One').innerText()).includes('Pizza of the Day'), 'wrong catalog badge');
  check(!(await card('Smoke Pizza Two').innerText()).includes('Pizza of the Day'), 'nonfeatured badge');
  await card('Smoke Pizza One').getByRole('button', { name: 'Add', exact: true }).click();
  await card('Smoke Pizza One').getByRole('link', { name: 'Smoke Pizza One', exact: true }).last().click();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  await page.waitForURL('**/cart');
  await page.getByRole('spinbutton').first().waitFor();
  check(await page.getByRole('spinbutton').first().inputValue() === '3', 'three Add sources did not merge');
  await page.reload();
  await page.getByRole('spinbutton').first().waitFor();
  await page.getByText('$31.17', { exact: true }).first().waitFor();
  check(await page.getByRole('spinbutton').first().inputValue() === '3', 'restored quantity');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('planet-pizza-cart')));
  check(stored.length === 1 && stored[0].product.price_cents === 1299, 'stored base snapshot');
  await page.locator('header').getByRole('link', { name: 'Pizzas', exact: true }).click();
  await card('Smoke Pizza Two').getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('header').getByRole('link', { name: 'Merch', exact: true }).click();
  await card('Smoke Shirt').waitFor();
  check(await page.getByText('Pizza of the Day', { exact: true }).count() === 0, 'merch badge');
  await card('Smoke Shirt').getByRole('button', { name: 'Add', exact: true }).click();
  await page.locator('header').getByRole('link', { name: /^Cart/ }).click();
  await page.getByText('$61.18', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  const pay = page.getByRole('button', { name: /^Pay / });
  await pay.waitFor({ state: 'visible' });
  await page.locator('form input').nth(0).fill('Smoke Buyer');
  await page.locator('form input').nth(1).fill('smoke@example.com');
  await page.locator('form textarea').fill('Isolated Hangar');
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
  check(await pay.textContent() === 'Pay $61.18 (mock)', `checkout cents: ${await pay.textContent()}`);
  const submitted = [];
  const onRequest = request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/orders')) submitted.push(request.postDataJSON());
  };
  page.on('request', onRequest);
  await control({ instant: '2027-01-01T00:00:00Z' });
  await page.clock.setSystemTime(new Date('2027-01-01T00:00:00Z'));
  await pay.click();
  await page.getByRole('alert').filter({ hasText: 'click Pay again' }).waitFor();
  check(submitted.length === 0 && (await cargo()).orders.length === 0, 'rollover submitted before review');
  check(await pay.textContent() === 'Pay $66.98 (mock)', 'rollover cents');
  await control({ rejectNextOrder: true });
  await pay.click();
  await page.getByRole('alert').filter({ hasText: 'daily offer changed' }).waitFor();
  check(submitted.length === 1 && (await cargo()).orders.length === 0, 'stale-date rejection retried or wrote');
  check(await page.locator('aside').getByText('Smoke Pizza One × 3', { exact: true }).count() === 1, 'lost cargo');
  await pay.click();
  await page.waitForURL('**/order/*');
  await page.getByText('$66.98', { exact: true }).waitFor();
  check(submitted.length === 2, 'unexpected submission count');
  check(submitted[1].promotion_date === '2027-01-01', 'wrong submitted date');
  check(submitted[1].items.every(item => Object.keys(item).sort().join() === 'productId,quantity'), 'client prices submitted');
  const paid = await cargo();
  check(paid.orders.length === 1 && paid.orders[0].total_cents === 6698, 'persisted total');
  check(paid.items.map(item => item.unit_price_cents).join() === '1299,801,2000', 'persisted units');
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('planet-pizza-cart')))).length === 0, 'success did not clear cart');
  check(await page.getByText('$38.97', { exact: true }).count() === 1, 'confirmation pizza line');
  check(await page.getByText('$8.01', { exact: true }).count() === 1, 'confirmation discount line');
  const paidId = paid.orders[0].id;
  await page.goto(`${base}/order/000${paidId}`);
  await page.getByRole('heading', { name: `Order #${paidId} confirmed 👽`, exact: true }).waitFor();
  const confirmationTrack = page.getByRole('link', { name: 'Track your order', exact: true });
  check(await confirmationTrack.getAttribute('href') === `/orders/${paidId}/track`, 'tracking must use persisted ID');
  check(await page.getByText('Smoke Pizza One × 3', { exact: true }).count() === 1, 'confirmation manifest lost');
  check(await page.getByText('$66.98', { exact: true }).count() === 1, 'confirmation total lost');
  check(await page.getByText('Isolated Hangar', { exact: true }).count() === 1, 'confirmation address lost');
  check(await page.getByRole('link', { name: 'Return to base', exact: true }).getAttribute('href') === '/', 'confirmation home lost');
  await confirmationTrack.click();
  await page.waitForURL(`${base}/orders/${paidId}/track`);
  await page.getByText('$66.98', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('$66.98', { exact: true }).waitFor();
  const headerTrack = () => page.locator('header').getByRole('link', { name: 'Track order', exact: true });
  check(await headerTrack().getAttribute('href') === '/orders/track', 'header lookup destination');
  await headerTrack().click();
  await page.waitForURL(`${base}/orders/track`);
  await page.reload();
  const number = page.getByRole('textbox', { name: 'Order number', exact: true });
  await number.waitFor();
  check(await page.locator('form input').count() === 1, 'lookup must not require customer details');
  const orderRequests = [];
  const onOrderRequest = request => {
    if (request.method() === 'GET' && /\/api\/orders\/[^/]+(?:\/status)?$/.test(request.url())) {
      orderRequests.push(request.url());
    }
  };
  page.on('request', onOrderRequest);
  const invalidNumbers = ['', '   ', '0', '0000', '-1', '+1', '1.5', '1e3', '0x10',
    'pizza', '#1', '1 2', '9007199254740992'];
  for (const [index, invalid] of invalidNumbers.entries()) {
    await number.fill(invalid);
    if (index % 2) await number.press('Enter');
    else await page.getByRole('button', { name: 'Track order', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'positive whole-number order number' }).waitFor();
    check(await number.getAttribute('aria-invalid') === 'true', `invalid accessibility: ${invalid}`);
    check(await number.getAttribute('aria-describedby') === 'order-number-help order-number-error', 'error not associated');
    check(page.url() === `${base}/orders/track`, `invalid number navigated: ${invalid}`);
    check(orderRequests.length === 0, `invalid number requested an order: ${invalid}`);
  }
  await number.fill(`  000${paidId}  `);
  check(await page.getByRole('alert').count() === 0, 'editing must clear validation error');
  await number.press('Enter');
  await page.waitForURL(`${base}/orders/${paidId}/track`);
  await page.getByText('$66.98', { exact: true }).waitFor();
  check(orderRequests.filter(url => url.endsWith(`/api/orders/${paidId}`)).length === 1, 'lookup duplicated order fetch');
  check(orderRequests.filter(url => url.endsWith(`/api/orders/${paidId}/status`)).length === 1, 'lookup duplicated status fetch');
  await headerTrack().click();
  await number.fill('9007199254740991');
  await page.getByRole('button', { name: 'Track order', exact: true }).click();
  await page.waitForURL(`${base}/orders/9007199254740991/track`);
  await page.getByRole('heading', { name: 'Order not found', exact: true }).waitFor();
  await page.goto(`${base}/orders/not-a-number/track`);
  await page.getByRole('heading', { name: 'Invalid order number', exact: true }).waitFor();
  await page.goto(`${base}/signal-lost`);
  await page.getByText('404 — signal lost.', { exact: true }).waitFor();
  page.off('request', onOrderRequest);
  await control({ failPromotion: true });
  await page.goto(base);
  await card('Smoke Pizza One').waitFor();
  await page.waitForFunction(() => !document.querySelector('#daily-pizza-title'));
  check(await page.getByText('Pizza of the Day', { exact: true }).count() === 0, 'failed promotion badge/banner remains');
  await card('Smoke Pizza One').getByRole('button', { name: 'Add', exact: true }).click();
  await page.goto(`${base}/pizzas`);
  await card('Smoke Pizza Two').waitFor();
  check(await page.getByText('Pizza of the Day', { exact: true }).count() === 0, 'failed catalog badge');
  await page.goto(`${base}/cart`);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('planet-pizza-cart')).length === 1);
  await page.setViewportSize({ width: 320, height: 720 });
  const beforeLookup = await page.evaluate(() => localStorage.getItem('planet-pizza-cart'));
  const cartLink = page.locator('header').getByRole('link', { name: 'Cart 1', exact: true });
  await cartLink.waitFor();
  for (const name of ['Pizzas', 'Merch', 'Track order', 'Cart 1']) {
    const bounds = await page.locator('header').getByRole('link', { name, exact: true }).boundingBox();
    check(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320, `narrow header link clipped: ${name}`);
  }
  check(await page.locator('header').evaluate(header => header.scrollWidth <= window.innerWidth), 'narrow header overflows');
  await headerTrack().click();
  await number.waitFor();
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'narrow lookup overflows');
  check(await page.evaluate(() => localStorage.getItem('planet-pizza-cart')) === beforeLookup, 'lookup modified cart');
  await cartLink.click();
  await page.waitForURL(`${base}/cart`);
  await page.getByRole('spinbutton').first().waitFor();
  check(errors.length === 0, `browser errors: ${errors.join('; ')}`);
  page.off('request', onRequest);
  page.off('pageerror', onError);
  return { passed: true, addedFrom: ['banner', 'catalog', 'detail'], restoredQuantity: 3,
    beforeRolloverCents: 6118, paidCents: paid.orders[0].total_cents,
    unitCents: paid.items.map(item => item.unit_price_cents), submissions: submitted.length,
    failureBrowsing: true, trackingEntryPoints: true, rejectedLookupNumbers: invalidNumbers.length,
    narrowNavigation: true, browserErrors: errors };
}
