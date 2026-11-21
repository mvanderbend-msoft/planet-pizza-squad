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
        └── pages/        # Home, Catalog, ProductDetail, Cart, Checkout, OrderConfirmation
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

## Notes & scope

- **MVP scope**: catalog browsing, cart, mock checkout, persisted orders.
- **No real payment** — the "Pay" button just creates the order with status `paid`.
- **No auth / admin** — out of scope for the MVP.
- **Pizzas are fixed-menu items** — no size or topping customization.
- Product images reference per-item SVGs that don't exist; the UI falls back to a generic neon-UFO placeholder.

👽 *This site does not officially exist.*


