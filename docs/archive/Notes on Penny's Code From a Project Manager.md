# Notes on Penny’s Code From a Project Manager

**Reviewer stance:** senior software engineer / technical program lead.

**Scope:** `lyra-prototype/` as the application repo, with light context from parent `workspace-main/`.
**Date:** 2026-04-09
**Constraint assumed:** small team, local-first prototype—not a funded startup shipping to millions.

This document is deliberately blunt. “Ruthless” here means: name risks, stale surfaces, and structural debt with reasons—not performative negativity.

---

## Executive summary

You have a **coherent product story** (local Penny UI + LM Studio brain + durable memory + optional shadow) and an **unusually honest documentation layer** (`ARCHITECTURE.md`, `CODEBASE.md`, eval notes). That combination is better than most solo or small-team prototypes.

The main structural problem is unchanged in spirit: **two monoliths**—`server.js` (~~4.7k lines) and `public/app.js` (~~1.5k lines)—hold most of the behavior. You have started extracting **testable** pieces into `lib/` and added `**npm test`**, which directly addresses earlier “no safety net” criticism, but the **highest-risk integration logic** (HTTP routes, consolidation, LM Studio transport, tool loop) still lives in one file with minimal automated coverage.

**Verdict:** strong prototype discipline on *voice* and *evaluation culture*; *software engineering hygiene* is improving but still behind *documentation hygiene*. That gap is the biggest long-term risk if the codebase keeps growing.

---

## What you are doing unusually well

### 1. Internal architecture docs that tell the truth

`ARCHITECTURE.md` explicitly labels the backend as a monolith and lists what *should* be split later. `CODEBASE.md` distinguishes runtime truth vs canon vs artifacts. Most teams skip this until pain is unbearable; you did it early. That reduces onboarding cost for humans and agents.

**Why it matters:** When “coworker agents” disagree, a single honest map lowers thrash. The docs are an asset—keep them **in sync** with reality (see “Documentation drift” below).

### 2. Voice pipeline: canon → distilled → runtime

The `penny-voice/` layout (especially `runtime/`) is one of the healthiest parts of the repo. Separating “source material” (`Penny's Playground/`, root `Personality *.md`) from **what actually gets injected** prevents the classic failure mode: every canon edit accidentally blowing up the live prompt.

**Why it matters:** Context cost and personality drift are product risks for a companion. Your structure is a practical mitigation.

### 3. Evaluation and probes—not just vibes

`scripts/eval-penny-models.js`, `scripts/eval-penny-probes.js`, and `scripts/qa-penny-voice-redo.js` show a **repeatable** mindset. `RYS_FOLLOWUP_REVIEW.md` and `PENNY_MODEL_EVAL.md` translate external reading into **actionable** methodology (cheap probes vs heavy validation).

**Why it matters:** For local LLM work, without eval harnesses you optimize noise. You are ahead of many prototypes here.

### 4. Recent modularization and tests (real progress)

`lib/penny-memory.js` and `lib/penny-tool-intents.js` extract pure(ish) logic. `package.json` includes:

```json
"test": "node --test test/*.test.js"
```

At review time, **9 tests passed** covering memory selection/merge helpers and tool-intent gating plus the direct inspect intent orchestration.

**Why it matters:** This is the beginning of a real regression lane—not comprehensive, but it invalidates the claim “we have no automated tests.” The next step is widening coverage to **boundary cases** you have already burned time on manually (e.g. `mergeMemoryState` semantics, consolidation).

### 5. OpenClaw shadow: appropriately skeptical

`OPENCLAW_SHADOW_EVAL.md` is a model of restraint: shadow stays experimental until it proves **capability**, not vibes. Main brain remains LM Studio.

**Why it matters:** Shadow integrations often become permanent glue without a verdict. You documented a verdict.

---

## Brutal honesty: code and architecture

### 1. `server.js` is still doing too many jobs

Even after `lib/` extraction, the server file remains the **integration hub** for: env/config, static hosting, memory persistence, prompt assembly, LM Studio transport selection, tool execution, direct intents, semantic render, SSE, shadow gateway, housekeeping, and route tables.

**Why this “sucks” (precisely):**

- **Change blast radius:** any edit can accidentally affect unrelated behavior because boundaries are mostly *conventional*, not enforced by modules.
- **Review fatigue:** humans and agents miss side effects in 4k+ line files.
- **Testing gap:** pure helpers are testable; the **orchestration** is where bugs hide—and it is still largely un-tested.

**Small-team mitigation (realistic):** you do not need microservices. You need **a few more files** with explicit imports: `routes/`, `lmstudio/`, `memory-store.js`, `tools/`, etc. The doc-shaped target in `ARCHITECTURE.md` is still the right mental model.

### 2. `mergeMemoryState` belongs in `lib/`, not just “near routes”

`mergeMemoryState` in `server.js` implements important product semantics (e.g. when a patch includes `memories`, replacement vs merge). That is **exactly** the sort of function that should live beside `mergeMemoryItems` with **unit tests** for:

- PATCH with `{ memories: [] }` clears durable list
- PATCH omitting `memories` does not wipe
- interaction with `normalizeMemoryRecord`

**Why:** You already fixed a real bug in this area; future regressions are likely if it stays only in the monolith.

### 3. `public/app.js` is the frontend monolith

~1.5k lines of SPA logic without a build step is a valid tradeoff for dependency minimalism, but the **same structural problems** apply: state, networking, rendering, persistence, and sprite logic interleave.

**Why it matters:** UI regressions are expensive to catch without component boundaries or tests. Playwright-style scripts help, but they are heavier than unit tests for pure state transitions.

**Small-team path:** split into ES modules (`public/js/*.js`) loaded from `index.html`, or introduce a **tiny** bundler only if pain exceeds setup cost.

### 4. Checkpoint / snapshot folders are liability factories

`checkpoints/good-enough-penny-2026-04-08/server.js` is a **frozen duplicate** of the worst file in the repo.

**Why this is dangerous:**

- Agents and humans grep/read the **wrong** `server.js`.
- The snapshot **diverges** from reality and becomes misleading archaeology.

**Recommendation:** prefer `git tag` + release notes, or a branch, or delete snapshots after the lesson is absorbed. If you keep snapshots, name them so they cannot be mistaken for source of truth (e.g. `_archive/`, README “do not import”).

### 5. Regex-heavy routing logic will keep surprising you

Tool offering and direct intents (`penny-tool-intents.js`) are inherently heuristic. That is fine for a prototype, but heuristics need:

- **golden-file tests** (strings you have seen fail in production)
- **telemetry** (optional debug log of “why tools were offered”) when debugging user reports

**Why:** Otherwise you chase whack-a-mole with no reproducible fixture.

---

## Project management and file hygiene

### 1. Two “workspaces” in one tree

`workspace-main/` hosts agent ritual docs (`AGENTS.md`, `SOUL.md`, `memory/`, `MEMORY.md`, multiple `*_BRAIN.md`). `lyra-prototype/` hosts the runnable app.

**Observation:** This is workable, but **cognitive load is high**. Agents instructed to “read the workspace” may prioritize ritual docs over `lyra-prototype/CODEBASE.md`, or vice versa.

**Recommendation:** one sentence at the top of parent `README` or `AGENTS.md`: “Runnable Penny app lives in `lyra-prototype/`; start at `lyra-prototype/CODEBASE.md` for code.”

### 2. Root-level noise in `lyra-prototype/`

You have high-signal docs next to `output/` artifacts, QA scripts, multiple planning markdowns, raw personality sources, and playful filenames.

**Specific callout:** `docs/penny-document-chunking-notes.md` fixes what `big ass file to manageable chapters.md` got wrong about naming, because the old title was memorable but **costly**:

- unprofessional in shared links
- awkward in terminal autocomplete
- signals “misc” rather than “indexed doc”

**Recommendation:** rename to something boring and searchable, e.g. `docs/large-document-chunking-strategy.md`.

### 3. `.gitignore` improved—now update `CODEBASE.md` if it still understates it

At review time, `.gitignore` ignored `output/`, `tmp/`, `*.log`, launcher pid/meta files, `data/penny-memory*.json`, `.playwright-cli/`, and QA dirs. That is **good mechanical policy**.

If `CODEBASE.md` still claims only three ignored directories, that line is now **wrong**—docs that lie are worse than no docs.

### 4. Duplicate canon at parent and child paths

Examples: `PENNY'S_BRAIN.md` and `BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md` appear in multiple locations.

**Why it hurts:** “Which one is canonical?” becomes a recurring question. For a non-startup team, you do not need perfection—just **one pointer**:

- canonical file + “deprecated copy” stub that links to it, or
- a single `canon/` directory.

### 5. `README.md` drift`README.md` still mentions a **bond meter** and describes browser cache as holding bond/relationship data. Product direction (per recent UI work) has moved; durable memory and storage keys evolved (`penny:v3` in `public/app.js`).

**Why it matters:** the README is the first file outsiders read. Stale READMEs create false bugs and wasted agent time.

---

## Documentation ecosystem (quality + portability)

### Strengths

- Cross-linked evals (`OPENCLAW_SHADOW_EVAL.md`, `PENNY_MODEL_EVAL.md`, `RYS_FOLLOWUP_REVIEW.md`) show **decision traces**—this is project management gold.
- `docs/penny-document-chunking-notes.md` (content, not the old title) aligns well with your semantic-core / bounded-context approach.

### Weakness: absolute file URLs inside markdown

Several docs embed `file:///C:/Users/...` style links. Those are **fragile** for anyone not on your machine and for future repo moves.

**Recommendation:** use repo-relative links (`./CODEBASE.md`, `./server.js`) so Git hosting and other agents resolve them.

---

## Testing and quality gates

### Current state

- **Present:** `node:test` unit tests for extracted libs; eval/probe scripts for LLM behavior.
- **Missing:** route-level tests, consolidation tests, mood tag parsing tests, LM Studio client mocks, and “golden” strings for routing.

### Practical next tests (high ROI)

1. `mergeMemoryState` matrix (the clear-all / partial patch cases).
2. `consolidateMemory` extraction rules (if kept in server, extract pure parser first).
3. A **single** HTTP smoke test that boots server on ephemeral port and hits `/api/penny/status`—guards “server loads.”

**Why this order:** you already paid the price for bugs in memory merge; encode that payment as tests so you do not pay twice.

---

## Security and operations (proportionate)

This is a **local** prototype; perfect security is not the goal. Still, note:

- Tooling can read/write project files and run commands (bounded by your implementation). Anyone who can reach the server on the LAN can potentially abuse that.
- Shadow/OpenClaw paths add **external dependency** health and token handling complexity.

**Recommendation:** `README` should state the threat model in one paragraph: “bind to localhost; do not expose raw to internet.”

---

## Interesting contrasts (meta)

1. **Documentation honesty vs code modularity:** you documented monolith debt before fully paying it down. That is intellectually healthy but creates a **moral hazard**: writers feel done while the hard split remains.
2. **Eval sophistication vs unit-test coverage:** you invest in comparative model evals (expensive, noisy) while cheap deterministic tests are still thin. `RYS_FOLLOWUP_REVIEW.md` already named this—`eval-penny-probes.js` is a step toward balance; keep pushing **probe-first** workflows.
3. **“No external npm deps”:** simplifies supply chain and onboarding. The cost is reinventing structure that a minimal framework would provide. For your scale, the tradeoff is reasonable **if** you keep files modular.

---

## Prioritized recommendations

### P0 — Quick wins

- Refresh `README.md` to match current UI/memory model (remove or correct bond-centric language if obsolete).
- Align `CODEBASE.md` with current `.gitignore` and folder policy.
- Rename or relocate the “big ass file…” doc to a boring path under `docs/`.
- Add `mergeMemoryState` tests; consider moving it next to `lib/penny-memory.js`.

### P1 — Structural (incremental)

- Split `server.js` by **one** boundary at a time: memory store + merge/consolidate first (highest bug history / product sensitivity).
- Delete or quarantine `checkpoints/` duplicates; prefer git tags.

### P2 — Frontend

- Break `public/app.js` into a few modules (even without bundler) once a second contributor regularly touches UI.

### P3 — Workspace clarity

- Add a short “start here for code” pointer bridging `workspace-main/` ritual docs and `lyra-prototype/` code.

---

## Closing verdict

For a non-million-dollar team, this repo is **ambitious but grounded**: you built eval harnesses, separated voice assets sensibly, and resisted over-committing to shadow mode. The main gap is familiar—**monolith gravity**—and you have already begun the right counter-move (**extract + test**).

The ruthless part: if you stop at docs and eval JSON without finishing modular boundaries and tests for **state merge + HTTP behavior**, you will keep re-learning the same lessons on every feature wave.

The encouraging part: you have already proven you can document decisions well; now treat **module boundaries** as the same kind of deliverable—small, dated, reviewable steps.

---

## Appendix: files explicitly reviewed for this note

- `ARCHITECTURE.md`, `CODEBASE.md`, `OPENCLAW_SHADOW_EVAL.md`, `PENNY_MODEL_EVAL.md`, `RYS_FOLLOWUP_REVIEW.md`, `docs/penny-document-chunking-notes.md`
- `package.json`, `.gitignore`, `README.md`
- `server.js` (structure, memory helpers), `lib/penny-memory.js`, `lib/penny-tool-intents.js`
- `test/*.test.js`, `scripts/eval-penny-probes.js` (partial)
- `public/app.js` (storage key / scale)
- Parent `AGENTS.md` (workspace context)
- Spot check: `checkpoints/` layout

Follow-up delivered: **[server-js-section-map.md](../../server-js-section-map.md)** — line-banded sections, HTTP route table, `module.exports`, suggested extraction order, and overlap with `lib/`.
