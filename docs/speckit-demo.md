# Spec Kit Demo — Planet Pizza: "Build Your Own Pizza"

**Duration:** ~35 minutes
**Audience:** developers who know Git and basic web dev, may not have seen Spec Kit before
**Goal:** show every Spec Kit slash command end-to-end while shipping a real feature

> Speaker notes are written the way you'd actually say them out loud.
> `[ACTION]` lines describe what to do on screen.
> Prompts you'll paste into the chat are in fenced blocks labeled `PROMPT`.

---

## 0 · Cold open (1 min)

> "Hey everyone, thanks for joining. Today I want to show you something called
> Spec Kit. It's an open-source toolkit from GitHub that flips the usual
> 'vibe coding' workflow on its head.
>
> Normally when we use an AI assistant, we type 'hey, build me a feature' and
> hope for the best. Spec Kit asks us to slow down — just a little — and write
> down what we actually want, before any code gets generated. The result is
> way more predictable, and it actually scales to bigger features.
>
> We're going to demo this against a real little webshop I built last week
> called Planet Pizza. The feature we're going to ship together is letting
> customers build their own pizza — pick a size, pick toppings, pay accordingly.
> By the end of the next half hour, we'll have spec, plan, tasks, checklist,
> and the actual working code, all generated through Spec Kit."

---

## 1 · Repo walkthrough (5–7 min)

> "Before we touch Spec Kit, let me give you a quick tour of what we're working
> with, so the demo makes sense."

[ACTION] In VS Code, open the file explorer in the left sidebar.

> "This is Planet Pizza. It's an alien / Area 51 themed pizza-and-merch
> webshop. Two top-level folders: `backend` and `frontend`. Standard monorepo
> shape, no fancy workspaces tool — just one root `package.json` that uses
> `concurrently` to run both sides."

[ACTION] Open `package.json` at the root, point at the `dev`, `build`, and `install:all` scripts.

> "One command to install everything, one command to run everything."

[ACTION] Open `backend/src/index.ts`.

> "The backend is Express plus TypeScript. We run migrations and seed on boot,
> then we mount two routers — products and orders — under `/api`. That's it."

[ACTION] Open `backend/src/db/index.ts`.

> "For storage we're using `node:sqlite` — that's the SQLite module that ships
> built into Node 22 and up. No native compilation, no Docker. Three tables:
> products, orders, order_items. Money is stored as integer cents, which is
> important to remember for later."

[ACTION] Open `backend/src/routes/orders.ts`, scroll through.

> "Notice two things in the orders route. First, every request body is
> validated with Zod before we touch the database. Second — and this is
> important — we never trust the price the client sends. We always re-read
> the price from the products table and compute the total server-side.
> If we add customization, that rule has to keep holding."

[ACTION] Open `frontend/src/App.tsx`.

> "The frontend is React 18 plus Vite plus TypeScript plus Tailwind. Pages
> are listed right here in the route table: home, pizzas catalog, merch
> catalog, product detail, cart, checkout, and order confirmation."

[ACTION] Open `frontend/src/context/CartContext.tsx` briefly.

> "Cart state lives in a React Context that persists to localStorage. That's
> the only piece of global state in the app."

[ACTION] Open `frontend/public/images/`, click through 2–3 SVGs.

> "Product images are hand-drawn SVGs in the public folder. Each one is
> referenced by `image_url` in the seed data. Light, alien-themed."

[ACTION] Open the running site in the browser (`http://localhost:5173`).

> "And here's the running app. Light alien theme, pizzas and merch, click any
> product, add to cart, fake checkout — done. No real payment. This is an MVP."

[ACTION] Open `.github/copilot-instructions.md`.

> "Last stop on the tour. This is the Copilot instructions file. It's read
> automatically on every chat request and it tells Copilot the things that
> aren't obvious from the code alone — like 'we use node:sqlite, not
> better-sqlite3' or 'pizzas are fixed-menu, no customization yet.' Spec Kit
> will respect this too. It's basically free guardrails."

[ACTION] Briefly show the `.github/instructions/` folder.

> "We also have path-scoped instruction files — one for the backend, one for
> the frontend, one for styling, one for SVG assets. So when Spec Kit edits
> a React component, it picks up the styling rules without us having to
> repeat them every time."

---

## 2 · What is Spec Kit (2 min)

[ACTION] Open the Spec Kit GitHub page in a browser tab (https://github.com/github/spec-kit) — just to show it briefly.

> "Spec Kit gives you a small set of slash commands that walk you through
> spec-driven development. The workflow looks like this:
>
> First you write a **constitution** — the durable principles for your
> project. Then for each feature, you **specify** what it does, optionally
> **clarify** anything fuzzy, then **plan** the technical approach, break
> that into **tasks**, run an **analyze** pass to catch contradictions,
> generate a **checklist** for review, and finally **implement** it.
>
> Every step writes its output to a file in the repo. You can read it, edit
> it, commit it. Nothing is locked away in a chat history."

[ACTION] Open `.specify/` folder in the file explorer.

> "I've already installed Spec Kit in this repo. You can see the
> `.specify/` directory here. Installation is literally one command —
> `uvx --from git+https://github.com/github/spec-kit.git specify init .` —
> but I won't run it now because it's already done. The commands it adds
> show up as `/speckit.constitution`, `/speckit.specify`, and so on, in the
> chat panel."

---

## 3 · `/speckit.constitution` (3 min)

> "Let's start at the very top. The constitution is the document that
> describes the principles your project holds, no matter what feature you're
> building. Things like 'we always validate input', 'we never trust
> client-supplied prices', 'we're shipping an MVP, not a SaaS platform'.
>
> The Copilot instructions already capture some of this, but the constitution
> is the canonical version that Spec Kit reads at every step. Let's create it."

[ACTION] Open the Copilot chat panel. Make sure the agent is set to "Agent" mode.

[ACTION] Paste:

```
PROMPT
/speckit.constitution

Create a project constitution for Planet Pizza, an Alien / Area 51 themed pizza
and merch webshop. The principles are:

1. MVP first — no auth, no real payments, no admin UI, no email. If a feature
   needs any of these, surface it as a question before assuming.
2. Server authority over money — prices and totals are always recomputed on the
   backend from the products table. Clients can suggest items, never prices.
3. Validation at the edge — every request body and query string is parsed with
   Zod before it reaches the database. Invalid input returns 400 with details.
4. Typed end to end — TypeScript strict mode in both packages. API responses
   are snake_case on the wire and the frontend types mirror that exactly.
5. Theming consistency — we are light mode only, alien palette only (emerald
   primary, cosmic purple secondary). Use the shared component classes in
   index.css rather than re-inventing them per page.
6. Brand voice — playful, conspiratorial, deadpan. Cart is the "cargo bay",
   customers are "earthlings", orders are "confirmed by the mothership".

The stack is locked: Node.js with node:sqlite (not better-sqlite3), Express,
React 18 + Vite + Tailwind, no ORM, no state library beyond React Context.
```

[ACTION] Let it run. When it finishes, open `.specify/memory/constitution.md` and scroll through it on screen.

> "There we go. Spec Kit took our principles and wrote them out in its own
> structured format — versioned, with placeholders filled in. From now on,
> every other command will read this file as ground truth. If we later add
> a principle, we just re-run `/speckit.constitution` with the new wording
> and it bumps the version."

---

## 4 · `/speckit.specify` (4 min)

> "Now the feature itself. The command for that is `/speckit.specify`. Notice
> what we're *not* doing — we're not telling it which files to change, we're
> not picking a framework, we're not designing the API. We're describing the
> *what* and the *why*, in plain language. The technical decisions come later."

[ACTION] Paste:

```
PROMPT
/speckit.specify

Add a "Build Your Own Pizza" feature so customers can configure a custom pizza
instead of only ordering from the fixed menu.

User experience:
- A new "Build Your Own" entry point sits alongside the existing pizza catalog.
- The customer picks one size (Small, Medium, Large), one crust (Classic Hand-Tossed,
  Thin Cosmic Crust, Stuffed Mothership Crust), one sauce (Tomato, BBQ, Pesto,
  None), and any number of toppings from a list.
- Toppings are grouped by category: cheeses, meats, veggies, "extraterrestrial"
  (novelty toppings like "Little Green Olives" or "Probe Pepperoni").
- The price updates live as choices change. Base price depends on size; crust
  and sauce can add or subtract; each topping has its own price.
- When the customer is happy they add the custom pizza to their cart like any
  other product. The cart and checkout pages show the configuration in a
  human-readable summary.
- Custom pizzas are first-class line items in orders and appear on the
  confirmation page with their full breakdown.

Constraints:
- Stay in the alien / Area 51 brand voice for all copy.
- Don't break existing fixed-menu pizzas — they continue to work unchanged.
- This is still an MVP — no saving "favorite" pizzas, no user accounts.
```

[ACTION] When it finishes, open the new file under `specs/<branch-or-feature>/spec.md`.

> "Spec Kit creates a feature folder — usually named after the branch or a
> slug of the feature — and writes a `spec.md` inside it. Notice it's not
> just our text echoed back. It's been restructured: user stories with
> acceptance criteria, in-scope and out-of-scope sections, edge cases,
> open questions. This is the document you'd hand to a human engineer."

[ACTION] Scroll through the spec for about 20 seconds, point at the user stories and edge cases.

> "And notice — see those `[NEEDS CLARIFICATION]` markers? Spec Kit is
> honest with us. It flagged the parts that are still ambiguous. We'll deal
> with those in the next step."

---

## 5 · `/speckit.clarify` (4 min)

> "This is one of my favorite commands. `/speckit.clarify` reads the spec,
> finds the genuinely under-specified parts, and asks us up to five highly
> targeted questions. Then it writes our answers back into the spec.
>
> It's basically a built-in 'have you thought about…' interview. Watch."

[ACTION] Paste:

```
PROMPT
/speckit.clarify
```

[ACTION] Wait for it to ask its questions. Answer them out loud as they appear. Suggested answers (adapt to what it actually asks):

> "Pricing question: Small is 8 dollars base, Medium is 12, Large is 16.
> Toppings are flat — 1 dollar 50 each, no size scaling for simplicity.
> Stuffed crust adds 3 dollars. Thin and classic are no upcharge."
>
> "Max toppings: no hard limit, but warn after 10. The mothership has its limits."
>
> "Storage: store the custom pizza as a JSON blob on the order_items row.
> We do not need a separate custom_pizzas table — these are not reusable."
>
> "Display name in the cart and confirmation: something like 'Custom Pizza —
> Large, Stuffed Crust, BBQ + 4 toppings'. Detail goes underneath."
>
> "Cancellable selections: no, every choice is required to enable Add to Cart
> except toppings, which can be empty (we'll call that the 'Plain Sighting')."

[ACTION] After the back-and-forth, re-open `specs/.../spec.md` and scroll to the new "Clarifications" section it added.

> "See that? Spec Kit appended a session log to the spec. Now anyone reading
> this spec — including the next Spec Kit command — knows exactly what we
> decided and when. No tribal knowledge, no Slack scrollback."

---

## 6 · `/speckit.plan` (4 min)

> "We've nailed down *what* the feature does. Now we plan *how*. This is
> where Spec Kit actually looks at our codebase — the constitution, the
> instructions files, the existing code — and produces a technical plan.
>
> It will pick which files to add, which to change, what the data model
> looks like, what the API endpoints should be, and how the frontend pieces
> fit together. We can absolutely override its choices, but starting from a
> grounded plan is much faster than starting from a blank doc."

[ACTION] Paste:

```
PROMPT
/speckit.plan

Stick with the existing stack — node:sqlite on the backend, React + Tailwind on
the frontend, no new dependencies unless strictly necessary. Reuse the existing
products table for toppings, sizes, crusts, and sauces by introducing a new
category column value, so we don't need a separate table per option type.
Store the custom configuration as JSON on the order_items.config column.
```

[ACTION] When it finishes, open `specs/.../plan.md`.

> "Look at the structure. Architecture overview, data model changes,
> backend changes broken down per file, frontend changes per route, a section
> on edge cases and how we handle them. It even called out the migration
> story — since we have no migration framework, the plan tells us we need
> to add columns with defaults and document the local DB reset."

[ACTION] Scroll to the data model section.

> "Notice it respected our constraint — extending the products table with
> new categories instead of inventing new tables. And the JSON config column
> on order_items. Exactly what we asked for. If we hadn't liked the
> approach, this is the moment to push back and re-run the command."

---

## 7 · `/speckit.tasks` (3 min)

> "Now we go from plan to tasks. This breaks the plan into a dependency-
> ordered list of concrete units of work. Each task has a description, a
> set of files it touches, and a status."

[ACTION] Paste:

```
PROMPT
/speckit.tasks
```

[ACTION] When it finishes, open `specs/.../tasks.md` and scroll through.

> "There are probably fifteen or twenty tasks here. They're ordered so that
> if you executed them top to bottom, dependencies are satisfied — database
> changes before backend routes, backend routes before frontend types,
> frontend types before the React components that consume them.
>
> This is the file you'd use to estimate, to split work across a team, or
> just to keep yourself honest as you implement."

[ACTION] Point at the file paths column on each task.

> "Each task lists the files it expects to touch. That's how Spec Kit
> tracks progress later, and it's also great for code review."

---

## 8 · `/speckit.analyze` (2 min)

> "Before we start writing any code, we run an analyze pass. This is a
> safety net. Spec Kit reads the spec, the plan, the tasks, and the
> constitution all together and looks for contradictions — things like
> 'the spec says no user accounts but the plan introduces a sessions table',
> or 'task 7 depends on task 12, that's a cycle'.
>
> It's read-only, it doesn't change anything, but it surfaces problems
> before they become bugs."

[ACTION] Paste:

```
PROMPT
/speckit.analyze
```

[ACTION] Read the output on screen.

> "If it finds issues, we'd go back and fix them — re-run `/speckit.specify`,
> `/speckit.clarify`, or `/speckit.plan` as needed. In our case, hopefully
> it comes back clean. If not, we'll talk through what it flagged."

---

## 9 · `/speckit.checklist` (2 min)

> "Last bit of prep before implementation: a checklist. This is the human
> review document. Think of it as the 'definition of done' for this feature,
> generated from your spec."

[ACTION] Paste:

```
PROMPT
/speckit.checklist

Generate a manual QA checklist covering:
- Pricing math correctness (size base + crust delta + sum of topping prices,
  matches what the customer saw on the configurator)
- Empty-toppings ("Plain Sighting") happy path
- Max-toppings soft warning at 10
- Custom pizza round-trip — configurator -> cart -> checkout -> order
  confirmation, all showing the same configuration and price
- Existing fixed-menu pizza ordering still works
- Mobile layout for the configurator screen
- Brand voice and copy in all new UI strings
```

[ACTION] When it finishes, open the new `specs/.../checklists/<name>.md`.

> "Now you've got a manual QA script you can hand to anyone — yourself, a
> teammate, a product manager — and they can walk through it and tick off
> the boxes. Great for demos, great for sign-off."

---

## 10 · `/speckit.implement` (5–7 min — the longest step)

> "All right. Spec, plan, tasks, checklist — all written, all consistent.
> *Now* we let Spec Kit actually write the code.
>
> This is the step that takes the longest, because it's actually doing
> the work — creating files, modifying components, running validations.
> While it runs, I'll narrate what's happening."

[ACTION] Paste:

```
PROMPT
/speckit.implement
```

[ACTION] While it runs, do a slow narration:

> "Right now Spec Kit is reading the tasks file and going through it in
> order. For each task it picks the right files, generates the change,
> writes it, and updates the task's status. You can see the file tree on
> the left lighting up as it edits.
>
> A few things to notice about how it operates: it respects our Copilot
> instructions, so the new SQL uses our explicit BEGIN/COMMIT pattern, and
> the new React components use our shared `btn-primary` and `card` classes
> instead of reinventing the styling.
>
> It's also re-validating along the way. If a TypeScript compile fails or
> a test fails, it'll iterate, fix, and continue. We're not just generating
> code — we're generating *working* code."

[ACTION] When it finishes, switch to the terminal and run:

```
npm --prefix backend run build && npm --prefix frontend run build
```

> "Both packages build. That's our first proof that the generated code is
> at least type-safe and syntactically sound. Now the real test —"

[ACTION] Restart `npm run dev` if it's not already running. Switch to the browser.

> "— let's click through it."

[ACTION] Live demo: navigate to the new build-your-own page, configure a pizza, watch the price update, add to cart, go to checkout, complete the mock checkout, see the order confirmation with the custom pizza spelled out.

> "And there's the feature. Configurator. Live pricing. Cart line item with
> the configuration spelled out. Order confirmation. The whole loop, end
> to end, generated through Spec Kit."

---

## 11 · `/speckit.taskstoissues` (2 min — optional, depends on time)

> "One more command worth showing. If you work in a team and you live in
> GitHub Issues, Spec Kit can convert your tasks list directly into GitHub
> issues, dependency-ordered, with the right labels and links."

[ACTION] Paste:

```
PROMPT
/speckit.taskstoissues

Create issues in this repository. Use labels "spec-kit" and "build-your-own-pizza".
```

[ACTION] If you don't actually want to create issues live, *skip this command* and just talk through it:

> "I won't run this live to avoid spamming the repo, but the command takes
> the tasks file we already have and creates one GitHub issue per task,
> with the dependencies expressed as 'blocked by' relationships. Great for
> handing the feature off to a team to pick up in parallel."

---

## 12 · Wrap up (2 min)

> "So that's Spec Kit, every command, on a real feature, in about half an
> hour. Let me leave you with three things to remember.
>
> One: the artifacts are real files in your repo. Spec, plan, tasks,
> checklist — all of it is committable, reviewable, diffable. This isn't
> something locked inside a chat window.
>
> Two: each command builds on the one before it. The constitution feeds
> the spec, the spec feeds the plan, the plan feeds the tasks, the tasks
> feed the implementation. If you change something upstream, the
> `/speckit.analyze` command tells you what downstream is now stale.
>
> Three: it doesn't replace your judgment. Every step has a moment where
> you read the output and decide if it's right. The point isn't to remove
> humans from the loop — the point is to give humans a structured loop
> to be in.
>
> Thanks for watching. Happy to take questions, and the demo repo is on
> GitHub if you want to clone it and try the commands yourself."

---

## Appendix · Timing cheat sheet

| Section | Time |
|---|---|
| 0 · Cold open | 1 min |
| 1 · Repo walkthrough | 6 min |
| 2 · What is Spec Kit | 2 min |
| 3 · `/speckit.constitution` | 3 min |
| 4 · `/speckit.specify` | 4 min |
| 5 · `/speckit.clarify` | 4 min |
| 6 · `/speckit.plan` | 4 min |
| 7 · `/speckit.tasks` | 3 min |
| 8 · `/speckit.analyze` | 2 min |
| 9 · `/speckit.checklist` | 2 min |
| 10 · `/speckit.implement` | 6 min |
| 11 · `/speckit.taskstoissues` | 2 min (optional) |
| 12 · Wrap up | 2 min |
| **Total** | **~37–41 min** |

If you're running tight on time, cut `/speckit.taskstoissues` and shorten the
walkthrough by 2 min — that gets you reliably under 35.

## Appendix · Recovery tips during the live demo

- If `/speckit.implement` stalls or produces a broken build, **don't try to
  fix it live with another prompt**. Just say: "in a real workflow we'd
  re-run analyze to see what went wrong, but in the interest of time let
  me show you the working version from a branch I prepared earlier."
  Have a pre-baked branch ready.
- If a command asks a question you didn't anticipate, answer with whatever
  is consistent with the constitution. The constitution is your safety net.
- If the dev server isn't picking up Tailwind changes, restart `npm run dev`
  — the JIT compiler only re-reads `tailwind.config.js` on startup.
- If `node:sqlite` complains about being experimental, ignore the warning
  on screen — it's harmless. Mention it once and move on.
