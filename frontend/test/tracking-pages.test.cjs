const assert = require('node:assert/strict');
const { test, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { JSDOM } = require('jsdom');

// React's event system must see a DOM before react-dom is loaded.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const originals = new Map();
for (const [name, value] of Object.entries({
  window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
  HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage,
  IS_REACT_ACT_ENVIRONMENT: true,
})) {
  originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}
const React = require('react');
const { act } = React;
const { createRoot } = require('react-dom/client');
const { MemoryRouter, useNavigate, useLocation } = require('react-router-dom');

after(() => {
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

function clock() {
  let now = 0;
  let serial = 0;
  const jobs = new Map();
  return {
    jobs,
    setTimeout(callback, delay) {
      const id = ++serial;
      jobs.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) { jobs.delete(id); },
    advance(ms) {
      now += ms;
      for (const [id, job] of [...jobs]) {
        if (job.at <= now) {
          jobs.delete(id);
          job.callback();
        }
      }
    },
  };
}

const statuses = ['received', 'preparing', 'baking', 'out_for_delivery', 'delivered'];
const labels = ['Received', 'Preparing', 'Baking', 'Out for delivery', 'Delivered'];
const times = statuses.map((_, i) => new Date(Date.UTC(2026, 10, 21, 12, i * 2)).toISOString());
const eta = times[4];
function tracking(status = 'received', id = 15) {
  return {
    order_id: id, status, estimated_delivery_at: eta,
    step_timestamps: Object.fromEntries(statuses.slice(0, statuses.indexOf(status) + 1).map((s, i) => [s, times[i]])),
  };
}
function order(id = 15) {
  return {
    id, status: 'paid', created_at: times[0], total_cents: 3817,
    customer_name: 'Oscar', customer_email: 'oscar@example.test', shipping_address: 'Hangar 18',
    items: [
      { id: 1, order_id: id, product_id: 5, name_snapshot: `Paid pizza #${id}`, quantity: 3, unit_price_cents: 1039 },
      { id: 2, order_id: id, product_id: 6, name_snapshot: 'Paid patch', quantity: 2, unit_price_cents: 350 },
    ],
  };
}
const merchandise = {
  id: 6, sku: 'PATCH', name: 'Cart patch', description: 'Patch', price_cents: 350,
  category: 'merch', image_url: '/patch.svg', stock: 20,
};

function loadProduction(timers) {
  const cache = new Map();
  function load(filename) {
    if (!path.extname(filename)) filename += fs.existsSync(`${filename}.tsx`) ? '.tsx' : '.ts';
    if (cache.has(filename)) return cache.get(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      // Vite supplies import.meta.env; this Node harness uses the default /api URL.
      transformers: { before: [(context) => {
        const visit = (node) => {
          if (ts.isPropertyAccessExpression(node) && node.name.text === 'env' &&
              ts.isMetaProperty(node.expression)) return ts.factory.createObjectLiteralExpression();
          return ts.visitEachChild(node, visit, context);
        };
        return (node) => ts.visitNode(node, visit);
      }] },
    }).outputText;
    const module = { exports: {} };
    cache.set(filename, module.exports);
    new Function('exports', 'require', output)(module.exports, (name) =>
      name.startsWith('.') ? load(path.resolve(path.dirname(filename), name)) : require(name));
    if (filename.endsWith(`${path.sep}orderTrackingStore.ts`)) {
      const create = module.exports.createOrderTrackingStore;
      // Only the external timer boundary is replaced; the page and store are production code.
      module.exports.createOrderTrackingStore = (id, api) => create(id, api, timers);
    }
    return module.exports;
  }
  const src = path.join(__dirname, '..', 'src');
  return {
    App: load(path.join(src, 'App.tsx')).default,
    CartProvider: load(path.join(src, 'context', 'CartContext.tsx')).CartProvider,
    DailyPromotionProvider: load(path.join(src, 'context', 'DailyPromotionContext.tsx')).DailyPromotionProvider,
  };
}

async function mount(t, url = '/orders/15/track', { strict = false, cart = [] } = {}) {
  const timers = clock();
  const requests = [];
  const priorFetch = globalThis.fetch;
  globalThis.fetch = (url, init = {}) => {
    if (url === '/api/pizza-of-the-day') {
      return Promise.resolve(response(503, { error: 'Daily promotion unavailable' }));
    }
    return new Promise((resolve, reject) => requests.push({
      url, init, resolve: (body, status = 200) => resolve(response(status, body)), reject,
    }));
  };
  function response(status, body) {
    return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
  }
  localStorage.clear();
  localStorage.setItem('planet-pizza-cart', JSON.stringify(cart));
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const { App, CartProvider, DailyPromotionProvider } = loadProduction(timers);
  let navigate;
  let location;
  let mounted = true;
  function Probe() {
    navigate = useNavigate();
    location = useLocation().pathname;
    return null;
  }
  const flush = (action = () => {}) => act(async () => {
    await action();
    await new Promise((resolve) => setImmediate(resolve));
  });
  async function unmount() {
    if (mounted) {
      await flush(() => root.unmount());
      mounted = false;
    }
  }
  t.after(async () => {
    try {
      await unmount();
      await flush(() => requests.forEach((r) => r.reject(new DOMException('Fixture disposed', 'AbortError'))));
    } finally {
      const remainingTimers = timers.jobs.size;
      timers.jobs.clear();
      host.remove();
      localStorage.clear();
      globalThis.fetch = priorFetch;
      assert.equal(remainingTimers, 0, 'page cleanup leaves no tracking timers');
      assert.equal(document.body.children.length, 0, 'DOM fixture removed');
    }
  });
  const tree = React.createElement(MemoryRouter, {
    initialEntries: [url],
  }, React.createElement(DailyPromotionProvider, null,
    React.createElement(CartProvider, null, React.createElement(Probe), React.createElement(App))));
  await flush(() => root.render(strict ? React.createElement(React.StrictMode, null, tree) : tree));
  return {
    host, requests, timers, flush, unmount,
    get location() { return location; },
    query: (selector) => host.querySelector(selector),
    text: () => host.textContent,
    calls: (suffix) => requests.filter((r) => r.url.endsWith(suffix)),
    go: (url) => flush(() => navigate(url)),
    advance: (ms) => flush(() => timers.advance(ms)),
    click: (node) => {
      assert.ok(node, 'click target exists');
      return flush(() => node.click());
    },
    input: (node, value) => flush(() => {
      const prototype = node.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
      node.dispatchEvent(new window.Event('input', { bubbles: true }));
    }),
    submit: (form) => flush(() => form.requestSubmit()),
    enter: (input) => flush(() => {
      // jsdom has no implicit keyboard default actions: perform the browser's
      // unprevented Enter -> form submission after dispatching the actual key event.
      const event = new window.KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true });
      if (input.dispatchEvent(event)) input.form.requestSubmit();
    }),
  };
}

function assertProgress(h, status) {
  const steps = [...h.host.querySelectorAll('ol[aria-label="Delivery progress"] > li')];
  assert.equal(steps.length, 5);
  assert.deepEqual(steps.map((li) => li.querySelector('p').textContent.split(' — ')[0]),
    labels.map((label, i) => `${i + 1}. ${label}`));
  const index = statuses.indexOf(status);
  assert.deepEqual(steps.flatMap((li, i) => li.hasAttribute('aria-current') ? [i] : []), [index]);
  assert.equal(steps[index].getAttribute('aria-current'), 'step');
  assert.match(steps[index].className, /bg-alien-50/);
  assert.match(steps[index].className, /ring-2/);
  assert.deepEqual(steps.flatMap((li, i) => li.classList.contains('ring-2') ? [i] : []), [index]);
  steps.forEach((li, i) => {
    assert.equal(li.querySelector('time')?.dateTime, i <= index ? times[i] : undefined);
    if (i <= index) assert.equal(li.querySelector('time').textContent, new Date(times[i]).toLocaleString());
    assert.match(li.textContent, new RegExp(i === index ? 'Current step' : i < index ? 'Completed' : 'Pending'));
  });
  const live = h.query('[aria-live="polite"]');
  assert.equal(live.getAttribute('role'), 'status');
  assert.match(live.textContent, new RegExp(`Current step: ${labels[index]}`));
  const etaNode = [...h.host.querySelectorAll('p')].find((p) => p.textContent.startsWith('Estimated delivery:'));
  assert.equal(etaNode.querySelector('time').dateTime, eta);
  assert.equal(etaNode.querySelector('time').textContent, new Date(eta).toLocaleString());
}

function assertManifest(h, id = 15) {
  assert.match(h.text(), new RegExp(`Paid pizza #${id} × 3`));
  assert.match(h.text(), /Paid patch × 2/);
  assert.match(h.text(), /\$10\.39 each/);
  assert.match(h.text(), /\$31\.17/);
  assert.match(h.text(), /\$3\.50 each/);
  assert.match(h.text(), /\$7\.00/);
  assert.match(h.text(), /Total charged\$38\.17/);
}

test('direct production route renders paid snapshots and five-step server progress; completed-attempt cadence never overlaps', async (t) => {
  const h = await mount(t);
  assert.match(h.text(), /Tracking order #15/);
  assert.match(h.text(), /Contacting the mothership/);
  assert.deepEqual(h.requests.map((r) => r.url), ['/api/orders/15/status', '/api/orders/15']);
  for (const request of h.requests) {
    assert.equal(request.init.cache, 'no-store');
    assert.equal(request.init.signal.aborted, false);
  }
  await h.advance(90_000);
  assert.equal(h.requests.length, 2, 'slow initial requests do not overlap');
  assert.equal(h.timers.jobs.size, 0, 'cadence starts only after completion');
  await h.flush(() => {
    h.calls('/status')[0].resolve(tracking());
    h.calls('/15')[0].resolve(order());
  });
  assertManifest(h);
  assertProgress(h, 'received');
  for (const [i, status] of statuses.entries()) {
    if (i === 0) continue;
    await h.advance(14_999);
    assert.equal(h.calls('/status').length, i);
    await h.advance(1);
    assert.equal(h.calls('/status').length, i + 1);
    assert.equal(h.timers.jobs.size, 0);
    await h.advance(60_000);
    assert.equal(h.calls('/status').length, i + 1, 'no polls while slow response is pending');
    await h.flush(() => h.calls('/status')[i].resolve(tracking(status)));
    assertProgress(h, status);
    assertManifest(h);
    assert.equal(h.calls('/15').length, 1, 'immutable items are not polled');
  }
  assert.match(h.query('[aria-live]').textContent, /Delivery complete\. Automatic refresh stopped/);
  assert.equal(h.timers.jobs.size, 0);
  await h.advance(120_000);
  assert.equal(h.calls('/status').length, 5, 'delivery terminates all future polls');
});

test('StrictMode aborts discarded mount requests, ignores stale 404/success and leaves one loop; unmount cancels waiting work', async (t) => {
  const h = await mount(t, undefined, { strict: true });
  assert.equal(h.calls('/status').length, 2, 'StrictMode replays effect setup');
  assert.equal(h.calls('/15').length, 2);
  assert.equal(h.calls('/status')[0].init.signal.aborted, true);
  assert.equal(h.calls('/15')[0].init.signal.aborted, true);
  await h.flush(() => {
    h.calls('/status')[1].resolve(tracking('preparing'));
    h.calls('/15')[1].resolve(order());
  });
  await h.flush(() => {
    h.calls('/status')[0].resolve({ error: 'Order not found' }, 404);
    h.calls('/15')[0].resolve(order(99));
  });
  assertProgress(h, 'preparing');
  assertManifest(h);
  assert.equal(h.query('[role="alert"]'), null);
  assert.equal(h.timers.jobs.size, 1);
  await h.advance(15_000);
  assert.equal(h.calls('/status').length, 3, 'one active StrictMode loop');
  await h.flush(() => h.calls('/status')[2].resolve(tracking('baking')));
  await h.unmount();
  assert.equal(h.timers.jobs.size, 0, 'scheduled refresh is cancelled');
  await h.advance(120_000);
  assert.equal(h.calls('/status').length, 3);
});

test('ID changes cancel pending work; stale success/errors and AbortError cannot overwrite the new route or become outages', async (t) => {
  const h = await mount(t);
  await h.go('/orders/16/track');
  const oldStatus = h.calls('/status')[0];
  const oldOrder = h.calls('/15')[0];
  assert.equal(oldStatus.init.signal.aborted, true);
  assert.equal(oldOrder.init.signal.aborted, true);
  assert.match(h.text(), /Tracking order #16/);
  assert.doesNotMatch(h.text(), /Paid pizza/);
  await h.flush(() => {
    h.calls('/status')[1].resolve(tracking('baking', 16));
    h.calls('/16')[0].resolve(order(16));
  });
  await h.flush(() => {
    oldStatus.resolve(tracking('delivered'));
    oldOrder.reject(new TypeError('stale offline error'));
  });
  assertProgress(h, 'baking');
  assertManifest(h, 16);
  assert.doesNotMatch(h.text(), /Paid pizza #15/);
  assert.equal(h.query('[role="alert"]'), null);
  await h.go('/orders/17/track');
  assert.equal(h.timers.jobs.size, 0, 'ID change removes previous waiting timer');
  await h.go('/orders/18/track');
  await h.flush(() => {
    h.calls('/status')[2].reject(new DOMException('Cancelled', 'AbortError'));
    h.calls('/17')[0].reject(new DOMException('Cancelled', 'AbortError'));
  });
  assert.match(h.text(), /Tracking order #18/);
  assert.equal(h.query('[role="alert"]'), null, 'cleanup is not an outage');
  await h.unmount();
  const current = [h.calls('/status')[3], h.calls('/18')[0]];
  assert.ok(current.every((r) => r.init.signal.aborted), 'unmount aborts both pending endpoints');
  await h.flush(() => {
    current[0].reject(new DOMException('Cancelled', 'AbortError'));
    current[1].resolve(order(18));
  });
  await h.advance(120_000);
  assert.equal(h.requests.length, 8, 'unmounted page starts no more work');
  assert.equal(h.host.textContent, '');
});

for (const endpoint of ['status', 'details']) {
  test(`mounted 404 from ${endpoint} clears visible data, aborts sibling and stops work`, async (t) => {
    const h = await mount(t);
    const failed = endpoint === 'status' ? h.calls('/status')[0] : h.calls('/15')[0];
    const sibling = endpoint === 'status' ? h.calls('/15')[0] : h.calls('/status')[0];
    await h.flush(() => failed.resolve({ error: 'Order not found' }, 404));
    assert.equal(h.query('h1').textContent, 'Order not found');
    assert.equal(sibling.init.signal.aborted, true);
    await h.flush(() => sibling.resolve(endpoint === 'status' ? order() : tracking()));
    assert.equal(h.query('h1').textContent, 'Order not found');
    assert.equal(h.query('[role="alert"]'), null);
    assert.equal(h.query('ol'), null);
    assert.equal(h.timers.jobs.size, 0);
    await h.advance(120_000);
    assert.equal(h.requests.length, 2);
    await h.go('/orders/16/track');
    await h.flush(() => h.calls('/status')[1].resolve(tracking('preparing', 16)));
    assertProgress(h, 'preparing');
    if (endpoint === 'status') {
      await h.flush(() => h.calls('/16')[0].resolve(order(16)));
      assertManifest(h, 16);
      await h.advance(15_000);
      await h.flush(() => h.calls('/status')[2].resolve({ error: 'Order not found' }, 404));
    } else {
      assert.equal(h.timers.jobs.size, 1, 'successful status scheduled a refresh before details 404');
      await h.flush(() => h.calls('/16')[0].resolve({ error: 'Order not found' }, 404));
    }
    assert.equal(h.query('h1').textContent, 'Order not found', '404 replaces previously visible information');
    assert.doesNotMatch(h.text(), /Paid pizza|Estimated delivery|Current step/);
    assert.equal(h.timers.jobs.size, 0, '404 cancels scheduled status work');
    const count = h.requests.length;
    await h.advance(120_000);
    assert.equal(h.requests.length, count);
  });
}

test('mounted invalid direct IDs do not contact either endpoint', async (t) => {
  const h = await mount(t, '/orders/0/track');
  for (const id of ['0', '-1', '1.5', '1e3', 'NaN', '9007199254740992', '%20']) {
    await h.go(`/orders/${id}/track`);
    assert.equal(h.query('h1').textContent, 'Invalid order number', id);
    assert.equal(h.requests.length, 0, id);
    assert.equal(h.timers.jobs.size, 0);
  }
});

test('mounted initial failures retry automatically; delivered-on-entry items recover independently by Retry', async (t) => {
  const h = await mount(t);
  await h.flush(() => {
    h.calls('/status')[0].reject(new TypeError('Failed to fetch'));
    h.calls('/15')[0].resolve({ error: 'Unavailable' }, 500);
  });
  const notice = h.query('[role="alert"]');
  assert.match(notice.textContent, /Status transmission interrupted/);
  assert.match(notice.textContent, /Cargo manifest unavailable/);
  assert.equal(notice.querySelector('button').disabled, false);
  await h.advance(15_000);
  await h.flush(() => h.calls('/status')[1].resolve(tracking('delivered')));
  assertProgress(h, 'delivered');
  assert.doesNotMatch(h.query('[role="alert"]').textContent, /Status transmission interrupted/);
  assert.match(h.query('[role="alert"]').textContent, /Cargo manifest unavailable/);
  assert.equal(h.timers.jobs.size, 0);
  await h.click(h.query('[role="alert"] button'));
  assert.equal(h.calls('/status').length, 2, 'terminal retry only reloads failed items');
  assert.equal(h.calls('/15').length, 2);
  await h.flush(() => h.calls('/15')[1].resolve(order()));
  assert.equal(h.query('[role="alert"]'), null);
  assertManifest(h);
  await h.advance(120_000);
  assert.equal(h.requests.length, 4);
});

test('mounted outages after success retain visible progress/ETA/items; automatic and manual recovery clear notice', async (t) => {
  const h = await mount(t);
  await h.flush(() => {
    h.calls('/status')[0].resolve(tracking('preparing'));
    h.calls('/15')[0].resolve(order());
  });
  for (const [i, failure] of [
    (r) => r.reject(new TypeError('Network unavailable')),
    (r) => r.resolve({ error: 'Service unavailable' }, 503),
  ].entries()) {
    await h.advance(15_000);
    await h.flush(() => failure(h.calls('/status').at(-1)));
    assertProgress(h, i === 0 ? 'preparing' : 'baking');
    assertManifest(h);
    assert.match(h.query('[role="alert"]').textContent, /Last known delivery information is kept/);
    assert.equal(h.query('[role="alert"] button').disabled, false);
    if (i === 0) await h.advance(15_000);
    else await h.click(h.query('[role="alert"] button'));
    assert.equal(h.timers.jobs.size, 0, 'manual retry replaces the pending timer');
    assert.equal(h.query('[role="alert"] button').disabled, true);
    await h.click(h.query('[role="alert"] button'));
    assert.equal(h.calls('/status').length, (i + 1) * 2 + 1, 'disabled retry cannot overlap');
    await h.flush(() => h.calls('/status').at(-1).resolve(tracking(i === 0 ? 'baking' : 'delivered')));
    assert.equal(h.query('[role="alert"]'), null);
  }
  assertProgress(h, 'delivered');
  assertManifest(h);
  assert.equal(h.calls('/15').length, 1);
  assert.equal(h.timers.jobs.size, 0);
});

test('delivered on the first mounted response never starts a poll loop', async (t) => {
  const h = await mount(t);
  await h.flush(() => {
    h.calls('/status')[0].resolve(tracking('delivered'));
    h.calls('/15')[0].resolve(order());
  });
  assertProgress(h, 'delivered');
  assertManifest(h);
  await h.advance(120_000);
  assert.equal(h.requests.length, 2);
  assert.equal(h.timers.jobs.size, 0);
});

test('header lookup rejects invalid local input; Enter and button submit normalize IDs into the real tracker without touching cart', async (t) => {
  const cart = [{ product: merchandise, quantity: 2 }];
  const h = await mount(t, '/cart', { cart });
  const stored = localStorage.getItem('planet-pizza-cart');
  const headerLink = h.query('header a[href="/orders/track"]');
  assert.equal(headerLink.textContent, 'Track order');
  await h.click(headerLink);
  assert.equal(h.location, '/orders/track');
  assert.equal(h.query('label').htmlFor, 'order-number');
  for (const value of ['', '   ', '0', '-1', '1.5', '1e3', 'hello', '9007199254740992']) {
    const input = h.query('#order-number');
    await h.input(input, value);
    await h.click(h.query('form button[type="submit"]'));
    assert.equal(h.location, '/orders/track', value);
    assert.match(h.query('[role="alert"]').textContent, /positive whole-number/);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.match(input.getAttribute('aria-describedby'), /order-number-error/);
    assert.equal(h.requests.length, 0, 'local validation never requests an order');
  }
  await h.input(h.query('#order-number'), '  00015  ');
  assert.equal(h.query('[role="alert"]'), null, 'editing clears validation notice');
  await h.enter(h.query('#order-number'));
  assert.equal(h.location, '/orders/15/track');
  assert.deepEqual(h.requests.map((r) => r.url), ['/api/orders/15/status', '/api/orders/15']);
  await h.click(h.query('header a[href="/orders/track"]'));
  assert.ok(h.requests.every((r) => r.init.signal.aborted));
  await h.input(h.query('#order-number'), ' 00016 ');
  await h.click(h.query('form button[type="submit"]'));
  assert.equal(h.location, '/orders/16/track');
  assert.deepEqual(h.requests.slice(2).map((r) => r.url), ['/api/orders/16/status', '/api/orders/16']);
  assert.equal(localStorage.getItem('planet-pizza-cart'), stored, 'lookup/tracking preserve existing cart');
  assert.match(h.query('header a[href="/cart"]').textContent, /Cart 2/);
  await h.click(h.query('header a[href="/cart"]'));
  assert.equal(h.location, '/cart');
  assert.match(h.text(), /Cargo Bay/);
  assert.match(h.text(), /Cart patch/);
  assert.match(h.text(), /Total: \$7\.00/);
});

test('existing cart/checkout submit still reaches singular confirmation and its persisted-ID tracking destination', async (t) => {
  const h = await mount(t, '/cart', { cart: [{ product: merchandise, quantity: 2 }] });
  await h.click(h.query('a[href="/checkout"]'));
  assert.equal(h.location, '/checkout');
  assert.match(h.text(), /Mock Checkout/);
  const fields = h.host.querySelectorAll('form input, form textarea');
  for (const [i, value] of ['Oscar', 'oscar@example.test', 'Hangar 18'].entries()) await h.input(fields[i], value);
  await h.click(h.query('form button[type="submit"]'));
  const post = h.requests.find((r) => r.init.method === 'POST');
  assert.equal(post.url, '/api/orders');
  assert.deepEqual(JSON.parse(post.init.body), {
    customer: { name: 'Oscar', email: 'oscar@example.test', address: 'Hangar 18' },
    items: [{ productId: 6, quantity: 2 }],
  });
  await h.flush(() => post.resolve(order(27)));
  assert.equal(h.location, '/order/27', 'existing singular confirmation route is preserved');
  assert.equal(localStorage.getItem('planet-pizza-cart'), '[]', 'successful checkout still clears cart');
  await h.flush(() => h.calls('/27')[0].resolve(order(27)));
  assert.match(h.query('h1').textContent, /Order #27 confirmed/);
  const track = h.query('main a[href="/orders/27/track"]');
  assert.equal(track.textContent, 'Track your order');
  await h.click(track);
  assert.equal(h.location, '/orders/27/track');
  await h.flush(() => {
    h.calls('/status')[0].resolve(tracking('preparing', 27));
    h.calls('/27')[1].resolve(order(27));
  });
  assertProgress(h, 'preparing');
  assertManifest(h, 27);
  assert.doesNotMatch(h.query('header a[href="/cart"]').textContent, /\d/);
});
