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
| POST   | `/api/orders`                 | Create order (prices recomputed server-side) |
| GET    | `/api/orders/:id`             | Fetch order with line items                  |

## Notes & scope

- **MVP scope**: catalog browsing, cart, mock checkout, persisted orders.
- **No real payment** — the "Pay" button just creates the order with status `paid`.
- **No auth / admin** — out of scope for the MVP.
- **Pizzas are fixed-menu items** — no size or topping customization.
- Product images reference per-item SVGs that don't exist; the UI falls back to a generic neon-UFO placeholder.

👽 *This site does not officially exist.*
