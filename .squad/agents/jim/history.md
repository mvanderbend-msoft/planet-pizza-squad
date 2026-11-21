# Project Context

- **Owner / requester:** mvanderbend (inferred repository owner; git user.name was empty).
- **Project:** Planet Pizza — Alien / Area 51 themed pizza and merchandise ordering web app.
- **Stack:** `frontend\`: React 18, Vite, TypeScript, Tailwind CSS. `backend\`: Node.js, Express, TypeScript, SQLite via `node:sqlite`.
- **Created:** 2026-11-21T11:55:40.330+01:00
- **Role:** Jim — Lead; scope, architecture, API/frontend contracts, technical review and unmatched-work triage.
- **Team:** Pam — Frontend Dev; Dwight — Backend Dev; Oscar — Tester. Squad is the separate coordinator.
- **Naming universe:** The Office (US); identifiers only, not roleplay.

## Learnings

- README documents catalog, cart, mock checkout and persisted orders; no real payments, auth/admin or pizza customization.
- README documents `/api` on port 3001 and the Vite frontend on port 5173; order prices are recomputed server-side.
- Bootstrap establishes team configuration only; it does not implement app features or start backlog work.
