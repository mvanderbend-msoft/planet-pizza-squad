# 🛸 Planet Pizza

An Alien / Area 51 themed webshop for pizzas and merchandise.

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript + SQLite (via built-in `node:sqlite`)

## Prerequisites

- **Node.js ≥ 22.5** (uses the built-in `node:sqlite` module — tested on Node 24).
- npm 10+

## Setup

From the repo root:

```sh
npm run install:all
```

This installs root tooling (`concurrently`) plus dependencies in `backend/` and `frontend/`.

## Run in development

```sh
npm run dev
```

- Backend: http://localhost:3001 (REST API under `/api`)
- Frontend: http://localhost:5173 (Vite dev server; `/api` is proxied to the backend)

The SQLite database is created at `backend/data/app.db` on first boot and auto-seeded with ~8 themed pizzas and ~6 merch items.

## Build for production

```sh
npm run build
npm start          # serves backend on port 3001
```

Frontend production assets are emitted to `frontend/dist/` — host them with any static file server (Vite preview, Nginx, etc.) and point them at the running backend via `VITE_API_URL`.

## Project layout

```
planet-pizza/
├── backend/
│   ├── src/
│   │   ├── db/           # SQLite connection, migrations, seed data
│   │   ├── routes/       # /api/products, /api/orders
│   │   └── index.ts      # Express bootstrap
│   └── data/             # SQLite file (gitignored)
└── frontend/
    ├── public/images/    # SVG assets (UFO logo, placeholder)
    └── src/
        ├── api/          # Typed fetch client
        ├── components/   # Layout, ProductCard
        ├── context/      # CartContext (localStorage-persisted)
        └── pages/        # Home, Catalog, ProductDetail, Cart, Checkout, OrderConfirmation, OrderLookup, OrderTracking
```

## API surface

| Method | Path                          | Description                                  |
|-------:|-------------------------------|----------------------------------------------|
| GET    | `/api/health`                 | Liveness probe                               |
| GET    | `/api/products?category=…`    | List products (optional `pizza` / `merch`)   |
| GET    | `/api/products/:id`           | Single product                               |
| GET    | `/api/pizza-of-the-day`       | Persisted daily pizza with 20% off unit price |
| POST   | `/api/orders`                 | Create order (prices recomputed server-side) |
| GET    | `/api/orders/:id`             | Fetch order with line items                  |
| GET    | `/api/orders/:id/status`      | Persisted simulated lifecycle and fixed ETA  |

### Daily pizza promotion

`GET /api/pizza-of-the-day` returns
`{ product: Product, original_price_cents: number, discounted_price_cents: number, valid_date: "YYYY-MM-DD" }`.
The full product retains its original `price_cents`; catalog and merchandise prices are unchanged.
Responses use `Cache-Control: no-store`.

Selections follow UTC calendar dates, rolling over at midnight UTC. All pizzas are
eligible regardless of stock; merchandise is excluded. A calendar-day rotation over
sorted pizza IDs chooses different pizzas on adjacent dates, even if no requests
were made on intervening days. SQLite persists each date's selection across requests,
concurrent callers, and restarts. An existing selection is never silently replaced.
Menu mutation during the day is outside the no-admin scope.
Fewer than two eligible pizzas returns HTTP 503
`{ "error": "Daily promotion unavailable" }`.

The reusable `resolveDailyPizza(connection, clock)` captures one server instant;
`discountedUnitPrice(priceCents)` rounds the 20%-off unit price half-up to integer
cents (`floor((priceCents * 80 + 50) / 100)`: 1299 → 1039, 1001 → 801).
Checkout reuses this rounded unit price before multiplying by quantity.

### Order pricing and rollover

`POST /api/orders` accepts `{ customer: { name, email, address }, items:
[{ productId, quantity }], promotion_date?: "YYYY-MM-DD" }`.
Prices are server-owned: every line for the daily pizza receives 20% off, rounded
per unit before multiplying by quantity (1299 × 3 becomes 1039 × 3 = 3117 cents).
Other pizzas and merchandise retain base prices; client prices and discount flags
are ignored. Existing validation and stock checks still apply.

One server instant determines the UTC promotion date for the entire checkout.
Clients may send the last reviewed `promotion_date`. A different valid date returns
HTTP 409 `{ "error": "Promotion date changed", "code": "PROMOTION_DATE_CHANGED" }`
without creating any order or items; refresh the promotion and require review
before retrying. Malformed or impossible calendar dates return HTTP 400.
Omitting the field remains supported and uses server-current prices.
When no viable daily promotion exists, ordering continues at base prices;
unexpected promotion/storage failures reject the order instead of dropping discounts.

Orders remain mock-paid. `total_cents` and each item's `unit_price_cents` are
persisted paid snapshots, shared by the POST response, subsequent order GET and
confirmation. Rollover, restart and later catalog-price changes never reprice them.
Order and item writes remain atomic.

Run focused backend behavior tests with `npm --prefix backend test` (Node ≥ 22.5).

### Order tracking

Every order (including merchandise) follows `received` at placement, `preparing`
at +2 minutes, `baking` at +4, `out_for_delivery` at +6 and `delivered` at +8.
Boundaries are inclusive; before placement the status stays received, and delivered
is terminal. `orders.status` remains `paid`; tracking never changes paid snapshots.
Checkout captures one injected server instant for pricing, `created_at` and the
received timestamp, saving tracking atomically with the order and items.

`GET /api/orders/:id/status` returns `Cache-Control: no-store` and:

```json
{
  "order_id": 1,
  "status": "preparing",
  "step_timestamps": {
    "received": "2026-11-21T12:00:00.000Z",
    "preparing": "2026-11-21T12:02:00.000Z"
  },
  "estimated_delivery_at": "2026-11-21T12:08:00.000Z"
}
```

Timestamps are UTC ISO 8601. Reached steps include the current step, not future
steps; ETA always stays placement +8 minutes, even after delivery. SQLite stores
steps separately with a unique order/step key. Status reads atomically materialize
all elapsed steps at their scheduled times, not polling times; no worker is needed.
Repeated/concurrent reads and restarts retain timestamps, and backward clocks do
not erase persisted progress. Migration is idempotent; legacy orders are backfilled
on first status access using their unchanged `created_at`. Legacy SQLite
`YYYY-MM-DD HH:mm:ss` strings are explicitly interpreted as UTC, never local time.
Unknown positive integer IDs return 404 `{ "error": "Order not found" }`;
invalid IDs return 400 `{ "error": "Invalid id" }`. Storage failures return JSON
500 `{ "error": "Order status failed" }`, never partially saved successful status.

#### Tracking page and refresh behavior

After checkout, the confirmation's **Track your order** button opens
`/orders/<persisted order.id>/track`. The shared header's **Track order** link opens
`/orders/track`, an order-number-only lookup form. Enter the digits from your
confirmation (no `#`, email or customer details); Enter or **Track order** submits.
Outer whitespace is trimmed and leading zeroes are normalized. Blank, zero,
negative, fractional, exponent/nondecimal and unsafe-integer numbers show an
inline error without making order requests. Valid numbers open the same tracker;
unknown orders and API outages use its not-found and retry behavior.

Open `/orders/:id/track` directly or reload it without cart or localStorage data.
The existing confirmation route remains `/order/:id`. Order numbers must be
positive decimal safe integers; invalid numbers make no order requests. Static
production hosts must fall back to `index.html` for these React Router URLs,
including `/orders/track`.

The page immediately requests status and the immutable paid order manifest
separately, using no-store requests. Five labeled steps expose the current step,
reached timestamps, the server's fixed ETA and persisted item names, quantities,
unit/line prices and total. No live catalog prices or client status transitions
are used. Status refreshes 15 seconds **after each completed attempt**, without
overlapping requests; paid items are not refetched on each poll. Delivered stops
refreshes, even on the first response, keeping progress and the historical ETA.

Network/server errors preserve all last-known data, show a retry notice and allow
manual Retry. Initial failures are retryable too; status retries automatically
while nonterminal. An independently failed item manifest can be recovered with
Retry, including after delivery. A 404 from either order endpoint shows
**Order not found** and stops work. Leaving the page or changing its order number
cancels requests/timers and ignores late responses, including React StrictMode
cleanup/restarts. Tracking never clears or modifies the cart.

`frontend/src/context/orderTrackingStore.ts` exports `createOrderTrackingStore`
(injectable API/timers, `start`, `stop`, `retry`, `subscribe`, `getSnapshot`) and
`parseOrderId`. Focused owner tests use the existing in-memory TypeScript/native
node:test pattern: `npm --prefix frontend test`. CI also discovers
`frontend/test/tracking-pages.test.cjs`: dev-only jsdom mounts the production
App routes, pages and providers with React DOM, compiling TS/TSX in memory.
Only fetch and the tracking store's timer boundary are injected. Deferred API
responses and a deterministic clock exercise visible progress/paid snapshots,
completion-based polling, terminal/not-found cleanup, route changes, StrictMode,
outage retention/recovery, lookup validation and cart→checkout→confirmation
tracking navigation without real polling sleeps. DOM, storage, fetch mocks and
timers are cleaned up per case. Router defaults match production.

jsdom does not render CSS or implement implicit keyboard default actions. The
Enter case dispatches the key event and performs its unprevented native form
submission explicitly; the optional real-browser smoke below additionally checks
actual Enter behavior, layout and narrow-screen navigation.

### Frontend promotion state

Home's top banner and the selected pizza's catalog badge share one
`DailyPromotionProvider` above the cart provider. `useDailyPromotion()` exposes
`promotion` (`productId`, `originalPriceCents`, `discountedPriceCents`, `validDate`),
the unmodified `product` for display/add, `loading`, `error`, and
`refresh(): Promise<DailyPromotion | null>`. Cart-pricing integration should reuse
this provider/refresh rather than create another promotion cache.

The provider expires yesterday's selection at midnight UTC and refreshes on tab
visibility, window focus and page restoration. Superseded responses are ignored;
failed or out-of-date responses clear the banner and badges, independently of
ordinary product loading. Banner Add uses the existing cart operation, retaining
base product prices. Cart entries retain the same localStorage key and base-product
snapshot/quantity shape; displayed unit and line totals derive from the shared
current promotion, never from a discount locked at Add. Restored pizza snapshots
are reconciled with the current menu before checkout, retaining quantities.

Cart and checkout show provisional totals while pizza prices are loading or
unverified, with explicit retry and no submission on transient errors. The exact
insufficient-menu 503 response permits reviewed base prices with a clear notice.
Merchandise-only checkout does not depend on promotion availability.

Pay refreshes pizza pricing immediately before submitting. Changed totals require
review and another Pay click; verified pizza checkout sends `promotion_date` but
never client prices. A stale-date 409 refreshes pricing and requests review without
automatically resubmitting or clearing the cart. Other failures likewise preserve
the cart; only success clears it. Confirmation continues to use server snapshots.

Run focused frontend promotion tests with `npm --prefix frontend test`.

## Regression tests and isolated UI smoke

Run `npm test` from the root for all native `node:test` regressions. `npm run build`
compiles both packages and runs the same tests once; the required CI `build` job
uses this root command on Node 24. Frontend mounted-page tests use dev-only jsdom;
no additional test runner or browser installation is needed.
SQLite fixtures use memory or disposable databases underneath `backend/test`,
never `backend/data/app.db`; clocks are injected/fixed and concurrency uses worker
connections. Frontend tests compile production pricing/state modules and mounted
React pages in memory.
Order lifecycle regressions check every transition ±1 ms without real lifecycle
waits, skipped-poll catch-up across independently synchronized SQLite workers,
rollback/retry and restart durability. Legacy UTC interpretation is also checked
in separate non-UTC Node processes. Servers, workers, connections and disposable
`backend/test/.order-status-*` fixtures are closed/removed after each test.

For a repeatable real-browser smoke, run `npm run build`, then `npm run smoke:serve`.
Open http://127.0.0.1:4177 in an isolated browser profile. This server uses the real
product, daily and order routes with an in-memory three-product fixture and fixed
UTC clock; it does not boot the production server, seed or read its database.
Stop it with Ctrl+C when finished.

`frontend/test/ui-smoke.cjs` contains an executable `async (page) => …` Playwright
snippet (use an already-available Playwright browser runner, e.g. its MCP
`browser_run_code_unsafe` filename option; no browser package is installed here).
If that tool is unavailable, an optional standalone runner works with an existing
Edge installation: `npm exec --package=playwright -- node frontend/test/run-ui-smoke.cjs`.
This obtains a browser runtime in npm's cache without adding dependencies to the
project; set `SMOKE_BROWSER=chrome` to use installed Chrome instead of Edge.
It resets fixture orders/localStorage, controls browser/server clocks without
sleeps, and asserts the top banner/image/struck price, catalog-only badge, all
three Add sources, merged/restored quantities, mixed-cart cents, midnight review,
stale-date no-write/no-auto-retry, submitted date/ID-only payload, persisted
confirmation snapshots, and failed-promotion hiding with ordinary browsing/Add.
It also checks the persisted-ID confirmation tracking link, header lookup,
accessible inline validation/no invalid requests, Enter/submit normalization,
single-tracker fetching, unknown/direct/reloaded routes, fallback and 320px
navigation with a preserved cart count.
The fixture-only `/__smoke` control endpoint exists solely in this local helper,
bound to loopback. Never expose it as a deployed application.

## Notes & scope

- **MVP scope**: catalog browsing, cart, mock checkout, persisted orders.
- **No real payment** — the "Pay" button just creates the order with status `paid`.
- **No auth / admin** — out of scope for the MVP.
- **Pizzas are fixed-menu items** — no size or topping customization.
- Product images reference per-item SVGs that don't exist; the UI falls back to a generic neon-UFO placeholder.

👽 *This site does not officially exist.*


