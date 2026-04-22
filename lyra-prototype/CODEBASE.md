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
  Memory-inspector rendering, including the latest-reply summary, runtime artifact views, trace provenance, reasoning-policy summaries, question-scoped research continuity views, and compact recent-audit history.
- `public/js/penny-lmstudio-ui.js`
LM Studio diagnostics and chat-model picker helpers.
- `public/js/penny-attachments.js`
Attachment prep and preview handling. Images are compressed client-side, cleared after send, and treated as current-turn payloads rather than durable browser history.
- `public/js/penny-storage.js`
Browser persistence and session-id helpers. Saved chat snapshots keep `hadImage`/file metadata but intentionally drop raw image data URLs and attached file bodies.
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
- [scripts/eval-penny-static-embedding-live-compare.js](./scripts/eval-penny-static-embedding-live-compare.js)
Three-arm static embedding live sidecar compare harness for static-off, live-shadow, and live-advisory modes against disposable per-case servers and a mock LM Studio route backend.
- [scripts/eval-penny-open-loop-bridge.js](./scripts/eval-penny-open-loop-bridge.js)
Fixture-only open-loop prompt bridge artifact for selected vs held-back advisory loops.
- [scripts/eval-penny-open-loop-compare.js](./scripts/eval-penny-open-loop-compare.js)
Disposable mock-route compare harness for open-loop-off vs open-loop-on, with continuity, annoyance, overclaim, adjacent-topic bleed, and prompt-token metrics.
- [scripts/eval-penny-aliveness-compare.js](./scripts/eval-penny-aliveness-compare.js)
Bounded aliveness compare harness. Fixture mode adapts A2 scenarios without server/model calls; live-isolated mode runs paired baseline vs feature-on route prompts through disposable Penny servers and a mock LM Studio backend, recording runtime metrics, trust-pressure gates, manual-review fields, adoption thresholds, and disposable cleanup status.
- [scripts/eval-penny-frame-budget.js](./scripts/eval-penny-frame-budget.js)
Fixture-only frame-budget compare harness for baseline, static-live-shadow, static-live-advisory, static+open-loops, and bounded-aliveness modes. It records runtime-shape metrics, candidate/render counts, prompt-token deltas, expected wins/regressions, and nullable live latency without spawning a server or proving answer quality.
- [scripts/eval-penny-initiative-fixture.js](./scripts/eval-penny-initiative-fixture.js)
Fixture-only bounded initiative artifact for allowed vs held-back suggestions, pressure/annoyance cases, source-aware prompt scaffolds, and max-one rendering.
- [scripts/eval-penny-runtime-fit.js](./scripts/eval-penny-runtime-fit.js)
Latency/runtime-fit harness for context-length and semantic-readiness tradeoffs; `eval:runtime-fit:context-pressure` adds a fixture-only short/medium/long rendered-context artifact with nullable latency fields and `not-run` answer drift.
- [scripts/qa-penny-memory.js](./scripts/qa-penny-memory.js)
Segmented plus judged memory QA harness with trace-first runtime artifact validation; `qa:memory:source-sensitive` adds fixture-only subject/relation/object/source/surface cases, support outcome classes, and structured candidate-contract checks, `qa:memory:candidate-survival-fixture` writes the fixture-only candidate-survival schema plus structured semantic candidate-contract QA, and `qa:memory:candidate-survival` writes the model-answer-free archive-unit artifact against disposable stores.
- [scripts/qa-penny-semantic-source-audit.js](./scripts/qa-penny-semantic-source-audit.js)
Fixture-only source-ID continuity audit for explicit memory, archive, research ledger, static embedding cache, PromptTruth rendered IDs, tool-evidence receipt sources, open loops, dynamic memory links, candidate-survival traces, and semantic claims.
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
Embedding cache for semantic archive retrieval when a local embedding model is available, plus bounded default-on background-vectorization telemetry that can still be disabled by env. The cache is model-aware; vectors from Nomic and EmbeddingGemma are treated as different vector spaces.
- `penny-memory-embeddings.static.*.json`
Derived static embedding sidecar cache files when an explicit live static mode is enabled. These are local retrieval artifacts, not authored memory, and should stay separate from the LM Studio embedding cache.
- `penny-memory-ledger.json`
Research continuity ledger for bounded advisory topics, evidence refs, open follow-ups, additive question-scoped identity (`kind`, `anchorType`, `anchorRef`, `scopeKey`, `scopeLabel`), and truth metadata (`sourceClass`, `summaryClass`, `summaryEvidenceRefs`).
- `penny-open-loops.json`
Advisory open-loop continuity state for unresolved project/session threads. It is separate from explicit memory, carries source refs, expiry, lifecycle history, and dismissal/completion state, and can be redirected for QA with `PENNY_OPEN_LOOP_FILE`.
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
- [lib/penny-open-loops.js](./lib/penny-open-loops.js)
- [lib/penny-open-loop-store.js](./lib/penny-open-loop-store.js)
- [lib/penny-open-loop-extraction.js](./lib/penny-open-loop-extraction.js)
- [lib/penny-initiative-policy.js](./lib/penny-initiative-policy.js)
- [lib/penny-turn-state.js](./lib/penny-turn-state.js)
- [lib/penny-frame-budget.js](./lib/penny-frame-budget.js)
- [lib/penny-background-frame.js](./lib/penny-background-frame.js)
- [lib/penny-tool-intents.js](./lib/penny-tool-intents.js)
- [lib/penny-local-lanes.js](./lib/penny-local-lanes.js)
- [lib/penny-lmstudio-status.js](./lib/penny-lmstudio-status.js)
- [lib/penny-visible-reply.js](./lib/penny-visible-reply.js)
- [lib/penny-runtime-artifacts.js](./lib/penny-runtime-artifacts.js)
- [lib/penny-qa-trace.js](./lib/penny-qa-trace.js)
- [lib/penny-qa-validity.js](./lib/penny-qa-validity.js)
- [lib/penny-qa-trust.js](./lib/penny-qa-trust.js)
- [lib/penny-context-pressure-qa.js](./lib/penny-context-pressure-qa.js)
- [lib/penny-candidate-survival-qa.js](./lib/penny-candidate-survival-qa.js)
- [lib/penny-semantic-ids.js](./lib/penny-semantic-ids.js)
- [lib/penny-semantic-predicates.js](./lib/penny-semantic-predicates.js)
- [lib/penny-semantic-source-audit.js](./lib/penny-semantic-source-audit.js)
- [lib/penny-gemma-runtime-watch.js](./lib/penny-gemma-runtime-watch.js)
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
- image attachment carry-forward guards
- wording-recall routing and prompt instructions

Likely modules you will touch:

- durable memory handling in `lib/penny-memory*.js`
- hybrid archive recall/promotion/background-vectorization logic in `lib/penny-memory-archive.js`
- archive utility scoring and pruning heuristics for evals plus live background-prewarm candidate ranking in `lib/penny-memory-archive-policy.js`
- research continuity topic tracking in `lib/penny-research-ledger.js`
- advisory open-loop continuity in `lib/penny-open-loops.js`, `lib/penny-open-loop-store.js`, and `lib/penny-open-loop-extraction.js`; the live bridge is off by default, bounded to one relevant advisory snippet when opted in, and must not become explicit memory or autonomous task execution
- bounded initiative policy in `lib/penny-initiative-policy.js`; the live bridge is off by default via `PENNY_ENABLE_BOUNDED_INITIATIVE`, capped at one optional suggestion, cooldown-aware, user-dismissible, and must not write memory, take side effects, or claim unchecked source support
- ephemeral turn-state response shaping in `lib/penny-turn-state.js`; the live prompt bridge is off by default via `PENNY_ENABLE_TURN_STATE_PROMPT`, capped by `PENNY_TURN_STATE_MAX_TOKENS`, and must stay current-turn-only, sanitized, non-persistent, non-CoT, and non-authoritative
- frame-budget receipts and scheduling in `lib/penny-frame-budget.js`; these artifacts describe runtime shape, deadline behavior, and candidate selection/rendering pressure without becoming PromptTruth, tool evidence, answer-quality proof, or permission to raise limits
- bounded background frame work in `lib/penny-background-frame.js`; queued work must stay local-only, bounded, dedupable/skippable, and unable to claim completion unless it actually ran
- prompt composition and transport shaping in `server.js`
- prompt-builder regressions in `test/penny-prompt-builders.test.js`
- lane selection in `lib/penny-local-lanes.js`
- direct tool intent routing in `lib/penny-direct-intents.js`
- direct deterministic tool execution in `lib/penny-direct-tool-assist.js`
- concrete tool implementations in `lib/penny-*-tools.js`
- internal tool capability descriptors in `lib/penny-tool-registry.js`, including advisory output/source-cost metadata that can be echoed into runtime artifact `toolCostSummary` without changing planner behavior or becoming runtime authority by itself
- LM Studio status/model resolution in `lib/penny-lmstudio-status.js`
- LM Studio transport selection in `lib/penny-lmstudio-transports.js`
- Gemma chat sampling defaults and transport payload fields in `lib/penny-lmstudio-transports.js`, with env wiring in `server.js`
- Gemma runtime watch artifacts in `lib/penny-gemma-runtime-watch.js`, `lib/penny-lmstudio-status.js`, `scripts/penny-preflight.js`, and `scripts/eval-penny-runtime-fit.js`; this is fixture/status evidence only, not a default-thinking, context-increase, or embedding-provider change
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
- tool-evidence receipt build/normalize in `lib/penny-runtime-artifacts.js`, with source facts emitted by `lib/penny-direct-tool-assist.js`, `lib/penny-tool-loop.js`, and the semantic-render seam in `server.js`
- bounded reasoning-policy receipt generation in `lib/penny-runtime-artifacts.js`
- turn-state prompt bridge receipt normalization in `lib/penny-runtime-artifacts.js`; it stores only a redacted summary and retention policy, not the full turn-state card or raw private inference
- research-ledger identity/settled-state rules in `lib/penny-research-ledger.js`
- local semantic identifier contracts in `lib/penny-semantic-ids.js`; these mint opaque `penny:*` IDs for later claims, links, traces, vector sources, and rendered-context receipts without making the IDs fetchable, authoritative, canonical, or prompt-visible by themselves
- local semantic domain contracts in `lib/penny-semantic-domains.js`; these register explicit-memory, archive, research-ledger, static-candidate, open-loop, tool-evidence, document-extraction, repo-current-law, runtime-artifact, and fixture authority defaults without making unknown domains trusted, letting tool evidence become PromptTruth, or turning repo-current-law into personal-memory authority
- local semantic claim contracts in `lib/penny-semantic-claims.js`; these normalize, validate, and summarize source-attributed claims against registered authority domains without making candidate-only/static/archive assertions canonical or wiring them into PromptTruth, `toolEvidenceReceipt`, runtime ranking, memory promotion, or prompt rendering
- local semantic source-ID audits in `lib/penny-semantic-source-audit.js`; these check fixture/local source continuity across explicit memory, archive, ledger, static vectors, PromptTruth rendered IDs, tool evidence, open loops, links, candidates, and claims without becoming runtime authority
- route assembly in `lib/penny-route-handlers.js`
- combined inspector construction in `server.js` / `lib/penny-runtime-artifacts.js`
- QA trace/trust helpers in `lib/penny-qa-trace.js` and `lib/penny-qa-trust.js`

### Change UI behavior or visuals

Start here:

- `public/js/penny-app.js`
- `public/styles.css`
- `public/index.html`

Memory inspector note:

- the debug Memory tab now starts with a latest-reply summary, then shows canonical explicit memory plus archive inspector data, runtime artifacts, trace provenance, reasoning-policy summaries, research continuity topics, recency protection, prompt-slot composition, prompt-truth receipts, tool-evidence receipts, cleanup-transform metadata, approximate-path policy, and advisory-merge summaries
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
- `lib/penny-context-pressure-qa.js`
- `lib/penny-candidate-survival-qa.js`
- `scripts/eval-penny-static-embedding-live-compare.js`
- `lib/penny-gemma-runtime-watch.js`
- `scripts/eval-penny-aliveness-compare.js`
- `lib/penny-aliveness-qa.js`
- `scripts/qa-penny-voice-redo.js`
- `lib/penny-qa-trace.js`
- `lib/penny-qa-validity.js`
- `lib/penny-qa-trust.js`
- `lib/penny-session-reflection.js`
- `lib/penny-memory-suggestions.js`
- `lib/penny-memory-suggestion-queue.js`
- `scripts/qa-penny-session-reflection.js`
- `scripts/eval-penny-session-reflection-compare.js`
- `PENNY_MODEL_EVAL.md`

`scripts/qa-penny-memory.js` now also carries semantic-correction grading, source-sensitive fixture cases, candidate-survival fixture/archive-unit modes, structured candidate-contract checks, and `runIdentity` harness canaries; treat those traces as first-pass environment drift checks, not as a new benchmark platform. `lib/penny-memory-archive.js` owns archive retrieval, `lib/penny-memory-archive-policy.js` owns ranking policy, `lib/penny-candidate-survival-qa.js` owns candidate-survival artifact interpretation and structured candidate-contract QA, `lib/penny-context-pressure-qa.js` owns context-pressure/source-sensitive answer fixtures, `lib/penny-semantic-source-audit.js` owns source-ID continuity artifacts, and `scripts/qa-penny-memory.js` / `scripts/qa-penny-semantic-source-audit.js` are the QA runners. `eval:runtime-fit:context-pressure`, `qa:memory:source-sensitive`, `qa:memory:candidate-survival-fixture`, `qa:memory:candidate-survival`, and `qa:semantic:source-audit` are cheap fixture/archive-unit artifact runs; they define and record fields, may use fixture-assumed semantic readiness, and do not prove live LM Studio answer drift without a separate isolated runtime-fit run.

Static embedding live sidecar work is opt-in. Normal repo work should leave `PENNY_STATIC_EMBED_MODE` unset or `off`, while QA comparison can use `qa-shadow` / `npm run eval:static-embedding-live-compare`. Local experimental Penny runs may set `PENNY_STATIC_EMBED_MODE=live-advisory`; that lets static candidates enter archive selection under gates, but it does not make static retrieval truth authority, does not replace the LM Studio embedding default, does not raise prompt limits, and keeps static-only rendered items capped.

Open-loop continuity work is also opt-in at the live prompt bridge. The state/store/extraction/lifecycle helpers are real code, but normal runtime prompt injection requires `PENNY_ENABLE_OPEN_LOOP_PROMPT=1` and stays capped by `PENNY_OPEN_LOOP_MAX_RENDERED=1` plus `PENNY_OPEN_LOOP_MAX_TOKENS`. `npm run eval:open-loop-compare` is the current compare harness; passing it means eligible for local opt-in, not permission to raise prompt limits, expand PromptTruth, or let Penny surface unrelated follow-ups.

Bounded initiative work is opt-in at the live prompt bridge. The pure policy, fixture scaffold, user controls, review-gated memory suggestion checks, and pressure canaries are real code, but normal runtime prompt injection requires `PENNY_ENABLE_BOUNDED_INITIATIVE=1` and stays capped by `PENNY_INITIATIVE_MAX_PER_TURN=1` plus cooldown suppression. It records `modelAdvisory.initiativePromptBridge` as sibling advisory metadata; it is not PromptTruth, not `toolEvidenceReceipt`, not an automatic memory write, and not autonomous task execution. Default enablement should follow the bounded aliveness adoption checklist, not just the fixture canaries.

Ephemeral turn-state work is opt-in at the live prompt bridge. The schema, signal extractor, fixture renderer, live bridge, retention guardrails, helper-level aliveness inputs, and T8 QA cases are real code, but normal runtime prompt injection requires `PENNY_ENABLE_TURN_STATE_PROMPT=1` and stays capped by `PENNY_TURN_STATE_MAX_TOKENS`. It records `modelAdvisory.turnStatePromptBridge` as sibling advisory metadata; it is not memory, not chain-of-thought, not PromptTruth, not `toolEvidenceReceipt`, and not truth authority. Default enablement should follow the bounded aliveness adoption checklist, not just fixture coverage.

Bounded aliveness compare work is the current adoption evidence layer for the combined static-live, turn-state, open-loop, and bounded-initiative stack. `npm run eval:aliveness:fixture` is fixture-only and can recommend only live-shadow review. `node scripts/eval-penny-aliveness-compare.js --live-isolated` spawns disposable Penny servers and a mock LM Studio backend, then writes `penny-aliveness-compare.v1` artifacts with human-observable wins, continuity wins, trust-pressure blockers, prompt/latency deltas, rendered advisory counts, manual-review fields, `decisionThresholds`, and `adoptionChecklist`. Live-isolated state is disposable: memory, archive, embeddings, static embedding cache, research ledger, open-loop state, initiative-session state, and memory books are isolated per side and cleanup failure invalidates the run. Passing live-isolated evidence can make local live-advisory review eligible; it is not default enablement.

Penny Frame Budget Principle: every turn has a runtime/context frame budget. Spend it first on relevance, source authority, and candidate selection before spending it on more rendered context. Faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory. Apply this to static live memory reflex, open-loop tracking, turn-state cards, initiative policy, session reflection, dynamic memory linking, and aliveness/frame-budget compares. Do not use it to expand PromptTruth, merge `toolEvidenceReceipt` into PromptTruth, change runtime voice, raise default prompt/rendered-memory limits, treat frame-budget artifacts as answer-quality proof, or grow `server.js`.

The frame-budget owners are now real code, but still deliberately bounded: `lib/penny-frame-budget.js` owns `penny-frame-budget.v1`, sidecar schedules, sidecar receipts, candidate-merge budget plans, health summaries, and compare-mode aliases; `lib/penny-background-frame.js` owns local-only bounded background jobs. Runtime/eval artifacts may show sidecar deadlines, degraded or missed work, candidate counts, selected/rendered counts, prompt-token deltas, and latency fields when measured. Missed optional work should degrade or skip before prompt/rendered-memory limits change.

Session reflection and memory suggestions have moved from docs-only boundary into helper-owned fixture/status code, while keeping the same authority line. `lib/penny-session-reflection.js` owns normalization, summaries, prep artifacts, and compare-only prompt bridge shaping; `lib/penny-memory-suggestions.js` owns unsafe/support classification; `lib/penny-memory-suggestion-queue.js` owns the local review queue and explicit approval handoff; `lib/penny-open-loops.js` can apply source-backed reflection updates only as advisory open-loop state. Reflection may summarize, suggest, and prepare reviewable updates, but it may not write explicit memory without explicit approval through the existing path, canonize its summaries, store hidden reasoning, expand PromptTruth, merge `toolEvidenceReceipt`, change runtime voice, or bypass approval. The compact prompt bridge is fixture-compare evidence with default broad/live rendering still disabled.

Dynamic memory linking has helper/fixture/QA/compare code in `lib/penny-memory-links.js`, `lib/penny-memory-link-policy.js`, archive trace/QA helpers, and the memory-link compare runner. Links now carry semantic contract metadata when available: local `linkId`, registered `predicateId`, optional source/target claim IDs, source authority, support state, bounded evidence receipts, and an explicit non-canonical semantic-contract receipt. A memory link is still a retrieval/navigation hint, not proof that either side is true: links cannot promote advisory/archive/semantic/static candidates into canonical explicit memory, cannot turn candidate-only support into verified support, cannot expand PromptTruth or `toolEvidenceReceipt`, cannot change runtime voice, and cannot justify a graph DB or universal memory index. Conservative correction-link scoring can become active only behind `PENNY_MEMORY_LINK_SCORING=correction-v1`; project-thread, research-pattern, and open-loop links stay advisory/shadow until separately measured.

Semantic identity and provenance contracts have started with helper-owned slices: `lib/penny-semantic-ids.js` plus `test/penny-semantic-ids.test.js` mint stable local IDs for source, claim, entity, predicate, link, domain, rendered-context, and vector-source objects; `lib/penny-semantic-predicates.js` plus `test/penny-semantic-predicates.test.js` define the small typed predicate registry; `lib/penny-semantic-claims.js` plus `test/penny-semantic-claims.test.js` define the structured claim schema for subject, predicate, object, source, authority, temporal, and stale-status fields; candidate/source-sensitive QA now includes fixture-only structured candidate-contract checks for wrong predicate, stale object, temporal, source id, claim id, domain, and authority-overclaim failures; and `lib/penny-semantic-source-audit.js` plus `test/penny-semantic-source-audit.test.js` define fixture/local source-ID continuity audits across semantic, static, link, rendered, and tool-evidence surfaces. These slices do not adopt IDs, predicates, or claim contracts into existing PromptTruth, archive, static-cache, memory-link, or route surfaces yet; future slices should dual-write or explicitly migrate consumers instead of replacing serialized IDs in place.

Pressure-watch trust work lives in the QA/eval layer: `scripts/qa-penny-voice-redo.js`, `lib/penny-qa-trust.js`, `lib/penny-qa-trace.js`, and their tests cover social pressure, companion-feedback bias, remote/source pressure, and agent-integrity receipt canaries. Gemma runtime watch lives in `lib/penny-gemma-runtime-watch.js` plus status/preflight/runtime-fit artifacts. Tool output-cost descriptors live in `lib/penny-tool-registry.js` and optional sibling runtime artifact cost summaries. None of those status surfaces change runtime voice, expand `promptTruth`, switch default embeddings, enable default thinking, raise default context, or import external dependencies.

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
