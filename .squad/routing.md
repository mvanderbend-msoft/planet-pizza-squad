# Work Routing

How to decide who handles what.

## Routing Table

| Work Type | Route To | Examples |
|-----------|----------|----------|
| Scope, architecture, contracts, code review | Jim | MVP boundaries, API/frontend contracts, cross-layer decisions, reviewer selection |
| Frontend | Pam | React menu/catalog, cart, checkout, responsive UI, keyboard access and accessibility |
| Backend | Dwight | Node/Express APIs, order services, server validation, SQLite persistence, authoritative totals |
| Tests and quality | Oscar | Unit/integration/UI tests, invalid orders, quantity and price edge cases, failure states |
| Unmatched or cross-domain work | Jim | Triage unclear ownership, split work by contract, identify missing expertise |

Only the four cast specialists are ordinary routing destinations. Squad invokes
Scribe for accepted durable decision merges, Ralph for requested monitoring, and
Rai or Fact Checker for targeted advisory work or a selected review gate. Preserve
their canonical charter/policy boundaries; no automatic support-agent fan-out.

## Issue Routing

| Label | Action | Who |
|-------|--------|-----|
| `squad` | Triage: analyze issue, assign a cast specialist label | Jim |
| `squad:jim` | Scope, architecture, contracts and review | Jim |
| `squad:pam` | React frontend and accessibility | Pam |
| `squad:dwight` | Node APIs, order services and data | Dwight |
| `squad:oscar` | Tests, quality and ordering edge cases | Oscar |

### How Issue Assignment Works

1. When a GitHub issue gets the `squad` label, **Jim** triages it — analyzing content, assigning the right `squad:{member}` label, and commenting with triage notes.
2. When a `squad:{member}` label is applied, that member picks up the issue in their next session.
3. Members can reassign by removing their label and adding another member's label.
4. The `squad` label is the "inbox" — untriaged issues waiting for Lead review.

## Rules

1. **Bounded routing** — Squad selects the smallest relevant set of specialists; parallel work requires independent ownership and an agreed contract.
2. **Support boundaries** — Scribe merges accepted durable decisions only; Ralph monitors/routes, never implements. Rai and Fact Checker run only when requested or selected as a bounded gate.
3. **Quick facts → coordinator answers directly.** Don't spawn an agent for "what port does the server run on?"
4. **When two agents could handle it**, pick the one whose domain is the primary concern.
5. **"Team, ..." → coordinated work.** Jim defines scope and contracts; Squad assigns relevant specialist work without activating unrelated supports.
6. **Test ownership** — Oscar covers changed behavior and ordering edge cases; collaborate early when requirements permit independent test design.
7. **Issue-labeled work** — route cast specialist labels to their named member. Jim handles all `squad` (base label) triage.
8. **Review rejection** — the rejected author does not own the immediate revision. Squad assigns a different qualified owner; the rejecting reviewer may perform a focused rereview.
