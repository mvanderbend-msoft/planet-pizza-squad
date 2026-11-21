# Spec Kit Demo — Deep Dive: `/speckit.constitution`

**Duration:** ~6–8 minutes
**Focus:** the **why** before the **how**
**Audience:** developers who've heard of Spec Kit but aren't sure why a
"constitution" matters

> Speaker notes are written the way you'd actually say them out loud.
> `[ACTION]` lines describe what to do on screen.
> Prompts you'll paste into the chat are in fenced blocks labeled `PROMPT`.

---

## 0 · Setting the stage (1 min)

[ACTION] Have the Planet Pizza repo open in VS Code. Copilot chat panel visible on the right.

> "Before I show you the command, I want to spend a couple of minutes on
> the question 'why does this even exist'. Because honestly, the first time
> I saw Spec Kit, I looked at `/speckit.constitution` and thought —
> 'I already have a README, I already have Copilot instructions, why do I
> need a third thing?'
>
> Turns out, there's a really good answer. And once you see it, the rest
> of Spec Kit makes a lot more sense."

---

## 1 · The problem we're actually solving (3 min)

### Problem 1 — AI assistants drift

> "Think about how you normally work with an AI assistant on a real
> codebase. You ask for one feature. It writes something reasonable. You
> ask for the next feature, in a new chat. It writes something reasonable
> *but slightly different*. Different naming, different error handling,
> different layering.
>
> No single change is wrong. But over twenty changes, your codebase starts
> to feel like it was written by twenty different people with twenty
> different opinions. That's drift. And it happens because the assistant
> has no memory of *what your project believes in*. Every chat is a fresh
> start."

### Problem 2 — Tribal knowledge isn't in the code

> "The really important rules in a project are rarely in the code. They're
> in someone's head. 'We never trust client-supplied prices.' 'We're
> shipping an MVP, don't add auth without asking.' 'We use node:sqlite
> because better-sqlite3 doesn't build on ARM Windows.'
>
> If you look at any single file, you can't see those rules. A new
> contributor — human *or* AI — will violate them, not out of malice, but
> because the rules are invisible.
>
> READMEs help, but READMEs describe *what the project does*. They don't
> describe *what the project refuses to do*."

### Problem 3 — Specs answer 'what', not 'what we believe'

> "Even when you do spec-driven development, each spec is about one
> feature. The spec for 'add a wishlist' doesn't tell you 'and by the way,
> we don't trust the client'. It assumes you know that already.
>
> So you end up repeating yourself in every spec, or worse, *not*
> repeating yourself and quietly contradicting your own values."

### Problem 4 — Disagreements have no referee

> "Pop quiz: it's three weeks into the project. Someone on the team —
> human or AI — proposes adding Stripe. Where do you go to decide if
> that's in scope? If the answer is 'we'll discuss it in standup', that's
> a process smell. If the answer is 'check the constitution', that's a
> codified value system."

[ACTION] Pause for a beat.

> "So that's the gap. We need a single document that captures the durable
> beliefs of the project — the things that don't change feature to feature
> — in a place where every later step of the workflow can read it,
> including the AI."

---

## 2 · What a constitution actually is (1 min)

> "OK, so what *is* it concretely? A constitution is a short, version-controlled
> markdown file that lives at `.specify/memory/constitution.md` in your repo.
> It lists your project's principles — usually five to ten of them — each
> with a name, a one-sentence statement, and a bit of reasoning.
>
> Critically, Spec Kit reads this file at the start of *every* other command.
> When you run `/speckit.specify`, the constitution is in the prompt. When
> you run `/speckit.plan`, it's there too. When `/speckit.analyze` checks
> for contradictions, this is the document it checks against.
>
> Which means: write your principles once, enforce them forever."

---

## 3 · Why not just put it in copilot-instructions.md? (1 min)

> "Fair question. Some of you are looking at the Copilot instructions file
> in our `.github` folder and thinking 'isn't that already this?'
>
> The honest answer is: they overlap, and that's fine. Copilot instructions
> apply to *every* chat, including ad-hoc 'help me debug this' moments.
> The constitution applies specifically to the spec-driven workflow.
>
> The constitution is also *versioned and structured* — it has a schema,
> Spec Kit can bump its version, and other Spec Kit commands can reason
> about it programmatically. The Copilot instructions are free-form prose.
>
> In practice, I keep both. Short tone-of-voice and stack notes in the
> Copilot file. Hard architectural principles in the constitution. The
> constitution is the one I'd point to in a PR review and say
> 'this change violates principle 2'."

---

## 4 · Now let's actually write one (2 min)

[ACTION] Open the chat panel. Make sure agent mode is on.

> "Right. Let me show you how this looks in practice. I'm going to write
> the constitution for Planet Pizza. Notice I'm not asking it to *guess*
> our principles — I'm telling it, in plain language, what we believe.
> The command's job is to take my plain-language list and turn it into the
> structured, versioned format Spec Kit expects."

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

[ACTION] Let it run.

---

## 5 · Reading the output — what to point at (1 min)

[ACTION] When the command finishes, open `.specify/memory/constitution.md`.

> "Let's look at what came out. Three things I want you to notice.
>
> First — it kept all six of our principles, but it gave each one a clear
> name and a 'rationale' section. It turned a flat bullet list into
> something a reader can actually navigate."

[ACTION] Scroll down to the version footer.

> "Second — see the version at the bottom? That'll be bumped automatically
> the next time we change the constitution. Which means a PR that modifies
> this file will show up *as* a constitutional change in code review — not
> as a hidden tweak buried in some other diff."

[ACTION] Scroll to any explicit non-goals or guardrails Spec Kit added.

> "Third — and this is my favorite part — it took our 'MVP first' principle
> and turned it into a list of specific things to ask about before adding.
> Auth, payments, admin, email. Now if any future Spec Kit command starts
> drifting toward one of those, it has explicit instructions to stop and ask.
>
> That's the payoff. We spent three minutes writing this file. Every
> command we run for the rest of this project — for the rest of the
> project's *life* — will respect it. And if we change our mind later,
> we just re-run `/speckit.constitution` with new wording. The version
> bumps. The downstream commands pick up the change. Done."

---

## 6 · The three things to take home (1 min)

> "I'll leave you with the same three takeaways I land on every time
> someone asks me 'do I really need a constitution':
>
> One. The constitution is not documentation about your code. It's
> documentation about your *values* as a project. It exists to make the
> implicit explicit.
>
> Two. It's the single referee for every later decision. When `/specify`
> writes a spec, when `/plan` picks an architecture, when `/analyze`
> catches a contradiction — they're all checking against this file.
>
> Three. It scales with you. On day one it has six bullets. On day three
> hundred it might have fifteen. Each change is a PR. Each PR can be
> reviewed. There's no Slack thread you have to dig up to find out
> 'wait, did we agree to use Postgres or not?'.
>
> That's why this command runs first, before any of the others. Skip it,
> and everything downstream is built on quicksand. Run it once, and every
> later command stands on solid ground."

---

## Appendix · If someone asks 'when do I update it?'

Quick answer to use live:

> "Update the constitution whenever a principle changes — never to fix a
> typo, never to capture a one-off decision. If you find yourself wanting
> to put a feature-specific rule in there, that's a sign it belongs in the
> spec instead. The constitution is for things that are true across every
> feature you'll ever build in this repo."

## Appendix · If someone asks 'what if my project doesn't have principles yet?'

> "That's the most useful time to run this command. Spec Kit will give you
> a template, and the act of filling it in forces you to make the decisions
> you've been avoiding. It's a forcing function. Start with three
> principles. You'll discover the other four within a week."
