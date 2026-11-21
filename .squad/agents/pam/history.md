# Project Context

- **Owner / requester:** mvanderbend (inferred repository owner; git user.name was empty).
- **Project:** Planet Pizza — Alien / Area 51 themed pizza and merchandise ordering web app.
- **Stack:** `frontend\`: React 18, Vite, TypeScript, Tailwind CSS. `backend\`: Node.js, Express, TypeScript, SQLite via `node:sqlite`.
- **Created:** 2026-11-21T11:55:40.330+01:00
- **Role:** Pam — Frontend Dev; menu/catalog, cart, checkout UI, client integration and accessibility.
- **Team:** Jim leads, Dwight owns backend, Oscar owns tests; Squad coordinates separately.
- **Naming universe:** The Office (US); identifiers only, not roleplay.

## Learnings

- README describes a localStorage-persisted cart, typed fetch client and mock checkout.
- Vite development runs on port 5173 and proxies `/api` to port 3001 per README.
- Fixed-menu pizzas and mock payments define the MVP; server totals remain authoritative.
