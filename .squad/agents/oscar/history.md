# Project Context

- **Owner / requester:** mvanderbend (inferred repository owner; git user.name was empty).
- **Project:** Planet Pizza — Alien / Area 51 themed pizza and merchandise ordering web app.
- **Stack:** `frontend\`: React 18, Vite, TypeScript, Tailwind CSS. `backend\`: Node.js, Express, TypeScript, SQLite via `node:sqlite`.
- **Created:** 2026-11-21T11:55:40.330+01:00
- **Role:** Oscar — Tester; tests, quality, ordering edge cases and reproducible regressions.
- **Team:** Jim leads, Pam owns frontend, Dwight owns backend; Squad coordinates separately.
- **Naming universe:** The Office (US); identifiers only, not roleplay.

## Learnings

- Test contracts should cover invalid product IDs/quantities, tampered client prices, cart consistency and persisted line items.
- README documents mock checkout, not a real payment processor; do not test unsupported payment flows as existing requirements.
- Bootstrap validated team state only; no app test suite has been executed or inferred.
