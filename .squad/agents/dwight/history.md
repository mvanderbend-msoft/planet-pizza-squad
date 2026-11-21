# Project Context

- **Owner / requester:** mvanderbend (inferred repository owner; git user.name was empty).
- **Project:** Planet Pizza — Alien / Area 51 themed pizza and merchandise ordering web app.
- **Stack:** `frontend\`: React 18, Vite, TypeScript, Tailwind CSS. `backend\`: Node.js, Express, TypeScript, SQLite via `node:sqlite`.
- **Created:** 2026-11-21T11:55:40.330+01:00
- **Role:** Dwight — Backend Dev; Node APIs, ordering services, server validation and data persistence.
- **Team:** Jim leads, Pam owns frontend, Oscar owns tests; Squad coordinates separately.
- **Naming universe:** The Office (US); identifiers only, not roleplay.

## Learnings

- README requires Node >= 22.5 and documents SQLite at `backend\data\app.db`.
- README lists health, products and orders APIs; `POST /api/orders` recomputes prices server-side.
- Checkout is mock payment with persisted orders; real payments and auth/admin are outside MVP scope.
