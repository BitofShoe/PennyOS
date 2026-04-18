# Codebase Guide

This file is the practical map of the repo: what is source, what is support material, what is generated junk, and where to touch things for common changes.

## Repo purpose

This project is a single-user local Penny companion prototype:

- browser UI
- Node backend
- LM Studio as the main brain
- durable local memory
- runtime voice system
- experimental OpenClaw shadow lane

## Root-level files that matter most

### Core runtime

- [server.js](./server.js)
Main backend orchestration. This is still the operational center of gravity.
- [package.json](./package.json)
Minimal npm script entrypoints.
- [start-lyra.ps1](./start-lyra.ps1)
Background launcher with readiness gating.
- [stop-lyra.ps1](./stop-lyra.ps1)
Background stopper.

### Current high-value docs

- [README.md](./README.md)
Quick run/use notes.
- [ARCHITECTURE.md](./ARCHITECTURE.md)
Runtime architecture overview.
- [frontend-section-map.md](./frontend-section-map.md)
Current-state map for the browser-side orchestration split.
- [LOCAL_LLAMA_THREAD_FINDINGS.md](./LOCAL_LLAMA_THREAD_FINDINGS.md)
Outside-eye review notes on maintainability patterns that do and do not fit this repo.
- [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md)
Current verdict on shadow mode.
- [PENNY_MODEL_EVAL.md](./PENNY_MODEL_EVAL.md)
Model and QA harness notes.
- [server-js-section-map.md](./server-js-section-map.md)
`server.js` function-to-responsibility bands, route table, and suggested module split order.

Delegation note:

- when a task crosses backend, frontend, tests, and docs, split the read-only exploration, QA inspection, and doc mapping before any writing
- codex only supports six active subagents at once; if spawning another one fails because of that ceiling, close or reuse agents immediately instead of silently continuing
- keep one primary editing agent per file boundary and consolidate the evidence before patching
- when the task needs a written cross-cutting plan, start from [docs/plans/TEMPLATE.md](./docs/plans/TEMPLATE.md) instead of inventing a fresh handoff format

### Planning / handoff docs

These are useful for project continuity, but they are not runtime code:

- `Today's Plan.md`
- `PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md`
- `PENNY_REDESIGN_PLAN.md`
- `PENNY_UI_HANDOFF.md`
- `LOCAL_LLAMA_THREAD_FINDINGS.md`
- `docs/penny-document-chunking-notes.md`

## Main directories

### `public/`

Browser-side app.

Key files:

- [public/index.html](./public/index.html)
HTML shell.
- [public/app.js](./public/app.js)
Frontend bootstrap only.
- `public/js/penny-app.js`
Main browser orchestration, transcript flow, mood/sprite updates, memory/settings actions, and inspector wiring.
- `public/js/penny-transcript-ui.mjs`
Transcript rendering helpers and chat-stream presentation.
- `public/js/penny-expression-runtime.mjs`
Mood/expression runtime helpers for Penny's visible vessel.
- `public/js/penny-ambient-chrome.mjs`
Ambient chrome helpers such as the boot overlay, emoji picker, particle effects, and idle/parallax behavior.
- `public/js/penny-memory-panel.mjs`
  Memory-inspector rendering, including runtime artifact, trace provenance, reasoning-policy summaries, question-scoped research continuity views, and compact recent-audit history.
- `public/js/penny-lmstudio-ui.js`
LM Studio diagnostics and chat-model picker helpers.
- `public/js/penny-attachments.js`
Attachment prep and preview handling.
- `public/js/penny-storage.js`
Browser persistence and session-id helpers.
- [public/styles.css](./public/styles.css)
Visual styling.
- `public/sprites/`
Penny mood art and decor assets.

Touch this area when:

- changing UI behavior
- changing composer/chat rendering
- changing settings panel behavior
- changing mood presentation or sprite logic

For the boring-sprint ownership boundary:

- `public/app.js` stays bootstrap only
- `public/js/penny-app.js` stays the coordination layer
- new browser behavior should go into a small named `public/js/` helper before it grows into the orchestrator again
- if a behavior slice becomes reusable, extract it instead of teaching `penny-app.js` another job

### `penny-voice/`

Voice system workspace.

Substructure:

- [penny-voice/canon-sources.md](./penny-voice/canon-sources.md)
What counts as source material.
- `penny-voice/distilled/`
Distilled sidecars and influence summaries.
- `penny-voice/runtime/`
Live prompt-facing runtime assets.

The runtime files are the important ones for normal behavior:

- [penny-operational-blend.md](./penny-voice/runtime/penny-operational-blend.md)
- [penny-chat-directives.md](./penny-voice/runtime/penny-chat-directives.md)
- [penny-voice-examples.md](./penny-voice/runtime/penny-voice-examples.md)

Touch this area when:

- changing Penny's voice
- changing what should be injected into prompts
- refining personality from canon without blowing up context size

For the boring-sprint ownership boundary:

- backend route glue stays in `server.js` only when the logic is truly request-specific
- stateful or heuristic backend behavior should move into a named `lib/` module
- add a small reason code and a test fixture whenever a helper has more than one valid path
- avoid adding one-off fallback logic directly to the monolith unless there is no better owner yet

### `Penny's Playground/`

Canon and semi-canon Penny-specific docs used as source material for voice work.

This is not the live runtime prompt stack. It is source/reference material.

High-signal files in this folder:

- [PENNY'S_BRAIN.md](./Penny's Playground/PENNY'S_BRAIN.md)
- [Operational system prompt source](./Penny's Playground/PENNY — OPERATIONAL SYSTEM PROMPT.md)
- [Romantic overlay source](./Penny's Playground/PENNY — ROMANTIC OVERLAY.md)
- [High-intensity overlay source](./Penny's Playground/PENNY — HIGH-INTENSITY ROMANTIC + EROTIC OVERLAY.md)
- [Personality Reference (1).md](./Penny's Playground/Personality Reference (1).md)
- [BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md](./Penny's Playground/BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md)

Touch this area when:

- auditing canon
- refining distilled sidecars
- comparing old and new Penny prompt ideas

### raw `Personality *.md` files

Large source personality references for influence blending.

These are canon-ish source material, not normal runtime prompt inputs.

Touch these when:

- refining the blend
- making new distillations
- checking whether a line or trait is actually grounded in source

### `scripts/`

Operational and QA helpers.

Important scripts:

- [scripts/ensure-lmstudio-penny-preset.js](./scripts/ensure-lmstudio-penny-preset.js)
Reasserts the LM Studio Penny preset/default behavior.
- [scripts/penny-lmstudio-prepare.js](./scripts/penny-lmstudio-prepare.js)
Shared LM Studio preparation flow for startup, preflight, QA, and evals.
- [scripts/penny-preflight.js](./scripts/penny-preflight.js)
Cheap local environment and LM Studio readiness checks.
- [scripts/penny-wait-ready.js](./scripts/penny-wait-ready.js)
Readiness poller used by the durable launcher and tests.
- [scripts/eval-penny-models.js](./scripts/eval-penny-models.js)
Comparative chat-lane evaluation harness.
- [scripts/eval-penny-probes.js](./scripts/eval-penny-probes.js)
Bounded tool-lane probe harness.
- [scripts/eval-penny-epistemic-compare.js](./scripts/eval-penny-epistemic-compare.js)
Epistemic compare harness for `off`, `synthesis-only`, and diagnostic modes.
- [scripts/eval-penny-ledger-compare.js](./scripts/eval-penny-ledger-compare.js)
Comparative ledger-prompt harness for the current off vs synthesis-focused research/memory modes.
- [scripts/eval-penny-runtime-fit.js](./scripts/eval-penny-runtime-fit.js)
Latency/runtime-fit harness for context-length and semantic-readiness tradeoffs.
- [scripts/qa-penny-memory.js](./scripts/qa-penny-memory.js)
Segmented plus judged memory QA harness with trace-first runtime artifact validation.
- [scripts/qa-penny-voice-redo.js](./scripts/qa-penny-voice-redo.js)
Chat-lane voice QA harness.
- [scripts/qa-penny-browser-smoke.js](./scripts/qa-penny-browser-smoke.js)
Disposable-server browser smoke harness for the real streaming UI path.
- [scripts/qa-penny-next-cycle.js](./scripts/qa-penny-next-cycle.js)
Fixed-order wrapper for the next-cycle rerun sequence.
- [scripts/import-penny-conversations.js](./scripts/import-penny-conversations.js)
Conversation-ingest helper for bringing prior Penny logs into local memory artifacts.
- [scripts/build-review-bundle.js](./scripts/build-review-bundle.js)
Filtered outside-review bundle builder.
- `scripts/strip_sprite_backgrounds.py`
Asset utility.

Touch this area when:

- adding repeatable QA
- changing LM Studio preset workflows
- improving dev tooling around Penny

### `data/`

Durable runtime state.

Important contents:

- `penny-memory.seed.json`
Tracked seed used to initialize the live memory store when it is missing.
- `penny-memory.json`
Untracked runtime memory store created on first run.
- `penny-memory-archive.json`
Hybrid archive runtime store for episodic recall, summaries, patterns, the promotion queue, and bounded per-session `recentAuditTrail` turn slices.
- `penny-memory-embeddings.json`
Embedding cache for semantic archive retrieval when a local embedding model is available, plus bounded default-on background-vectorization telemetry that can still be disabled by env.
- `penny-memory-ledger.json`
Research continuity ledger for bounded advisory topics, evidence refs, open follow-ups, additive question-scoped identity (`kind`, `anchorType`, `anchorRef`, `scopeKey`, `scopeLabel`), and truth metadata (`sourceClass`, `summaryClass`, `summaryEvidenceRefs`).
- various QA/eval memory files
Disposable artifacts from benchmarking or smoke tests.

Treat this directory carefully. It is runtime state, not source code.

### `memory/`

Project/session notes and handoff memory.

This is operational context for agents, not app runtime logic.

### `output/`

Generated artifacts.

Typical contents:

- model eval JSON
- voice QA JSON
- temporary logs
- smoke outputs
- screenshots or generated helper files

This directory is useful, but it is noisy. Do not confuse it with source code.

### `logs/`, `tmp/`, `test-results/`, `.qa-pw/`, `.playwright-cli/`

Operational and test artifact areas.

These are mostly support/generated directories, not core source.

### `lib/`

Extracted backend helpers that now carry some of the highest-value test coverage.

Current modules worth knowing:

- [lib/penny-memory.js](./lib/penny-memory.js)
- [lib/penny-memory-state.js](./lib/penny-memory-state.js)
- [lib/penny-memory-archive.js](./lib/penny-memory-archive.js)
- [lib/penny-memory-archive-policy.js](./lib/penny-memory-archive-policy.js)
- [lib/penny-research-ledger.js](./lib/penny-research-ledger.js)
- [lib/penny-tool-intents.js](./lib/penny-tool-intents.js)
- [lib/penny-local-lanes.js](./lib/penny-local-lanes.js)
- [lib/penny-lmstudio-status.js](./lib/penny-lmstudio-status.js)
- [lib/penny-visible-reply.js](./lib/penny-visible-reply.js)
- [lib/penny-runtime-artifacts.js](./lib/penny-runtime-artifacts.js)
- [lib/penny-qa-trace.js](./lib/penny-qa-trace.js)
- [lib/penny-qa-validity.js](./lib/penny-qa-validity.js)
- [lib/penny-qa-trust.js](./lib/penny-qa-trust.js)
- [lib/penny-route-handlers.js](./lib/penny-route-handlers.js)
- [lib/penny-server-http.js](./lib/penny-server-http.js)
- [lib/penny-chat-runtime.js](./lib/penny-chat-runtime.js)
- [lib/penny-tool-loop.js](./lib/penny-tool-loop.js)
- [lib/penny-lmstudio-transports.js](./lib/penny-lmstudio-transports.js)
- [lib/penny-direct-intents.js](./lib/penny-direct-intents.js)
- [lib/penny-direct-intent-replies.js](./lib/penny-direct-intent-replies.js)
- [lib/penny-direct-tool-assist.js](./lib/penny-direct-tool-assist.js)
- [lib/penny-project-tools.js](./lib/penny-project-tools.js)
- [lib/penny-web-tools.js](./lib/penny-web-tools.js)
- [lib/penny-git-tools.js](./lib/penny-git-tools.js)
- [lib/penny-runtime-tools.js](./lib/penny-runtime-tools.js)
- [lib/penny-tool-registry.js](./lib/penny-tool-registry.js)

## What to edit for common tasks

### Change Penny's live voice

Start here:

- `penny-voice/runtime/*`

Then check:

- `server.js` prompt asset loading

Only go into raw personality source files if the runtime blend needs canon-grounded refinement.

### Change chat behavior or backend logic

Start here:

- `server.js`
- `lib/penny-local-lanes.js`
- `lib/penny-lmstudio-status.js`
- `lib/penny-tool-loop.js`
- `lib/penny-lmstudio-transports.js`
- `lib/penny-direct-intents.js`
- `lib/penny-direct-tool-assist.js`
- `lib/penny-tool-registry.js`

Likely sections you will touch:

- prompt building
- LM Studio tool loop orchestration
- semantic render heuristics
- HTTP route behavior

Likely modules you will touch:

- durable memory handling in `lib/penny-memory*.js`
- hybrid archive recall/promotion/background-vectorization logic in `lib/penny-memory-archive.js`
- archive utility scoring and pruning heuristics for evals plus live background-prewarm candidate ranking in `lib/penny-memory-archive-policy.js`
- research continuity topic tracking in `lib/penny-research-ledger.js`
- lane selection in `lib/penny-local-lanes.js`
- direct tool intent routing in `lib/penny-direct-intents.js`
- direct deterministic tool execution in `lib/penny-direct-tool-assist.js`
- concrete tool implementations in `lib/penny-*-tools.js`
- internal tool capability descriptors in `lib/penny-tool-registry.js`
- LM Studio status/model resolution in `lib/penny-lmstudio-status.js`
- LM Studio transport selection in `lib/penny-lmstudio-transports.js`
- route/runtime artifact assembly in `lib/penny-route-handlers.js` and `lib/penny-runtime-artifacts.js`

### Change trace/provenance or inspector surfaces

Start here:

- `lib/penny-runtime-artifacts.js`
- `lib/penny-research-ledger.js`
- `public/js/penny-memory-panel.mjs`
- `test/penny-runtime-artifacts.test.js`
- `test/penny-memory-panel.test.js`

Likely modules you will touch:

- archive retrieval/provenance normalization in `lib/penny-memory-archive.js`
- shared packet normalization in `lib/penny-knowledge-contracts.js`
- prompt-slot registry and composition summaries in `lib/penny-prompt-stack.js`
- prompt-truth receipt generation in `lib/penny-memory.js` and `lib/penny-prompt-stack.js`
- bounded reasoning-policy receipt generation in `lib/penny-runtime-artifacts.js`
- research-ledger identity/settled-state rules in `lib/penny-research-ledger.js`
- route assembly in `lib/penny-route-handlers.js`
- combined inspector construction in `server.js` / `lib/penny-runtime-artifacts.js`
- QA trace/trust helpers in `lib/penny-qa-trace.js` and `lib/penny-qa-trust.js`

### Change UI behavior or visuals

Start here:

- `public/js/penny-app.js`
- `public/styles.css`
- `public/index.html`

Memory inspector note:

- the debug Memory tab now shows canonical explicit memory plus archive inspector data, runtime artifacts, trace provenance, reasoning-policy summaries, research continuity topics, recency protection, prompt-slot composition, prompt-truth receipts, cleanup-transform metadata, approximate-path policy, and advisory-merge summaries
- research-ledger rows now expose anchor/scope identity plus `sourceClass`, `summaryClass`, and `summaryEvidenceRefs`
- archive review/purge actions still live in `public/js/penny-app.js`, while rendering logic now lives in `public/js/penny-memory-panel.mjs`
- `public/js/penny-storage.js` still sends only explicit browser memory settings to the server; archive state is not browser-owned
- `public/js/penny-ambient-chrome.mjs` owns lightweight vessel chrome and composer niceties; keep that behavior out of `penny-app.js`

### Change model QA or speed QA

Start here:

- `scripts/eval-penny-models.js`
- `scripts/eval-penny-probes.js`
- `scripts/eval-penny-epistemic-compare.js`
- `scripts/qa-penny-memory.js`
- `scripts/qa-penny-browser-smoke.js`
- `scripts/eval-penny-runtime-fit.js`
- `scripts/qa-penny-voice-redo.js`
- `lib/penny-qa-trace.js`
- `lib/penny-qa-validity.js`
- `lib/penny-qa-trust.js`
- `PENNY_MODEL_EVAL.md`

`scripts/qa-penny-memory.js` now also carries semantic-correction grading plus `runIdentity` harness canaries; treat those traces as first-pass environment drift checks, not as a new benchmark platform.

### Change shadow/OpenClaw behavior

Start here:

- `server.js`
- `OPENCLAW_SHADOW_EVAL.md`
- `README.md`

## Runtime vs source-of-truth

This repo has a lot of text files. Not all of them mean the same thing.

Use this hierarchy:

1. Live behavior
  `server.js`, `lib/*`, `public/*`, runtime files in `penny-voice/runtime/`
2. Operational docs
  `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, eval docs
3. Refinement source material
  `Penny's Playground/*`, raw `Personality *.md`, distilled sidecars
4. Artifact noise
  `output/*`, many QA files, logs, temp files

## Current codebase pain points

These matter when navigating the repo:

- `server.js` is still too large and still owns orchestration-heavy subsystems that should be split further
- `public/js/penny-app.js` is still getting big enough to deserve more structure even though `public/app.js` is now only bootstrap glue
- there are many artifact and handoff files at repo root, which makes the root noisier than it should be
- planning docs, evaluation docs, and runtime code are all close together, so it is easy to read the wrong thing first
- the boring-sprint docs now define the intended ownership boundary: thin entrypoints, named subsystem owners, and no new feature work directly in the orchestration shells

## Good defaults for future contributors

If you are trying to understand the repo quickly, read in this order:

1. [README.md](./README.md)
2. [ARCHITECTURE.md](./ARCHITECTURE.md)
3. [CODEBASE.md](./CODEBASE.md)
4. `server.js`
5. `public/js/penny-app.js`
6. `penny-voice/runtime/*`

If you are trying to change Penny's personality, read in this order:

1. `penny-voice/runtime/*`
2. `penny-voice/distilled/*`
3. `Penny's Playground/*`
4. raw `Personality *.md` files only as needed

If you are trying to improve performance or routing, read in this order:

1. `server.js`
2. `PENNY_MODEL_EVAL.md`
3. `scripts/qa-penny-voice-redo.js`
4. `scripts/eval-penny-models.js`

## What this file is not

This is not a design manifesto and it is not a promise that the repo is cleanly modular.

It is a working map of the codebase as it exists today.
