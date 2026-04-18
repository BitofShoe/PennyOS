# Architecture

This file describes how Penny currently works in this repo as of 2026-04-16.

It is intentionally blunt about what is "real architecture" versus "current monolith that still needs to be split."

## Related docs

- [CODEBASE.md](./CODEBASE.md)
Practical repo map and "where to touch what" guide.
- [frontend-section-map.md](./frontend-section-map.md)
Current browser-side ownership map for the orchestration shell.
- [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md)
Current verdict on whether shadow mode is actually worth keeping around.
- [LOCAL_LLAMA_THREAD_FINDINGS.md](./LOCAL_LLAMA_THREAD_FINDINGS.md)
Outside review notes pulled from the LocalLLaMA maintainability discussion and compared against this repo.
- [PENNY'S_BRAIN.md](./Penny's Playground/PENNY'S_BRAIN.md)
Higher-level Penny intent and personality source material.
- [Operational system prompt source](./Penny's Playground/PENNY — OPERATIONAL SYSTEM PROMPT.md)
Legacy/source operational prompt material.
- [Romantic overlay source](./Penny's Playground/PENNY — ROMANTIC OVERLAY.md)
Legacy/source romantic blend material.
- [High-intensity overlay source](./Penny's Playground/PENNY — HIGH-INTENSITY ROMANTIC + EROTIC OVERLAY.md)
Legacy/source high-intensity overlay material.

## Delegation note

When a task crosses backend, frontend, tests, and docs, break the work into read-only exploration, QA inspection, and doc mapping first, then consolidate into one primary editor per file boundary before any write happens.

## System shape

Today the app is a single-process local web application with one large Node server and one browser UI:

- `server.js`
Main backend orchestration, API surface, durable memory handling, LM Studio transport selection, tool loop, semantic render pass, shadow lane, and static file serving.
- `lib/*`
Extracted backend modules for memory helpers, research continuity, route/runtime artifact assembly, QA trace/trust helpers, direct-intent parsing/replies, direct tool assist, and concrete project/web/git/runtime tools.
- `public/index.html`
Single-page shell for the Penny UI.
- `public/app.js`
Frontend bootstrap only.
- `public/js/*`
Browser-side coordination plus extracted helpers for transcript rendering, expression runtime, ambient chrome/emoji behavior, memory-inspector rendering, attachments, and local persistence.
- `public/styles.css`
UI styling and animation.
- `penny-voice/runtime/*`
The prompt-facing voice system actually injected into Penny's live runtime.

This is not a distributed system. It is a single-user local prototype with a monolithic server.

## Boring-sprint ownership boundaries

The current cleanup sprint is about making the repo structurally boring, not adding new platform layers.

- `server.js` should stay a thin entrypoint, router, and wiring shell.
- `public/js/penny-app.js` should stay a UI orchestration shell.
- New backend behavior should land in a named `lib/` helper or a new route-specific module before it grows inside `server.js`.
- New browser behavior should land in a small `public/js/` module before it grows inside `penny-app.js`.
- If a helper starts answering more than one subsystem, split it before adding the next feature.
- If a route or UI path needs a one-off exception, document the reason code and keep the fallback local to the owning subsystem.

The same delegation rule applies to repo work:

- use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping
- remember the live-agent ceiling: Codex only gets six active subagents at once, so a spawn-limit error is a real workflow failure that should be fixed immediately by closing or reusing agents
- keep one primary editing agent per file boundary
- consolidate findings before writing, especially when a change touches both runtime ownership and the docs that describe it
- if the change is cross-cutting enough to need a written plan, start from [docs/plans/TEMPLATE.md](./docs/plans/TEMPLATE.md) so the delegation map, blind spots, and verification plan stay standardized

## Runtime modes

There are two runtime brain families:

1. Main lane: LM Studio

- This is Penny's real primary brain.
- The browser talks to `POST /api/penny/chat`.
- The backend automatically picks one of two LM Studio sub-lanes before any model call:
  - chat lane for companion turns, memory recall, softness, banter, and image chat
  - tool lane for direct inspect/search/read/edit/runtime/git/web turns and the full bounded tool loop
- The chosen lane stays fixed for the whole request. Penny does not do a second 31B restyle pass after tool work.
- Chat lane defaults to `google/gemma-4-31b`.
- Tool lane defaults to `google/gemma-4-e4b`.
- The settings-panel model picker is a chat-lane override only.
- The local `@local:penny` preset belongs to LM Studio; Penny only verifies and reasserts the local wiring for startup and QA flows.

1. Optional lane: OpenClaw shadow

- This is experimental and secondary.
- It is not the default brain.
- In the current implementation, the shadow path is just a prompt handoff to `openclaw/main`.
- It does not currently expose the richer OpenClaw browser/exec/task features through Penny's main runtime path.

See also: [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md)

## Request flow

Normal chat flow:

1. Browser sends `POST /api/penny/chat?stream=1`
2. `server.js` reads request body and attachments
3. Backend merges browser memory settings with durable disk memory
4. Backend chooses `brainMode`
5. For local mode, backend selects `chat` vs `tool` lane
6. For chat-like turns, backend retrieves bounded archive context plus bounded research-ledger context
7. The selected lane resolves its preferred model and transport family
8. Reply comes back with a visible text response plus a hidden mood tag, and Penny records a runtime artifact / trace summary for the turn
9. Frontend parses the mood tag and updates Penny's visual state
10. Canonical explicit memory is written back to `data/penny-memory.json`
11. Archive consolidation runs after successful turns and writes episodic/derived memory to `data/penny-memory-archive.json`
12. Research-ledger updates run after qualifying turns and write bounded advisory continuity to `data/penny-memory-ledger.json`

## Backend subsystems

### 1. Prompt assets

Prompt assets live in `penny-voice/runtime/` and are loaded by `server.js`.

Current live runtime assets:

- `penny-operational-blend.md`
- `penny-chat-directives.md`
- `penny-voice-examples.md`

These are the prompt-facing truth for Penny's normal chat voice.

Raw source docs and distilled sidecars are for refinement work, not normal runtime prompt baggage.

If you need the older canon/source stack that informed the runtime blend, start with:

- [penny-voice/canon-sources.md](./penny-voice/canon-sources.md)
- [Personality Reference (1).md](./Penny's Playground/Personality Reference (1).md)
- [BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md](./Penny's Playground/BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md)

### 2. Durable memory

Canonical explicit memory is stored in a local runtime file at `data/penny-memory.json`, seeded from tracked `data/penny-memory.seed.json` when missing.

The explicit memory model currently tracks:

- `sessionId`
- `userName`
- `memories[]`
- `voiceOn`
- `brainMode`
- `lmStudioThread`
- `updatedAt`

Important behavior:

- browser state is not the source of truth
- server merges browser settings with disk-backed state
- memory selection for prompts is relevance-scored, not full-dump
- obvious test sessions are purged on server startup

Hybrid archive overlay:

- `data/penny-memory-archive.json`
  - global episodes, summaries, patterns, and promotion queue
  - session buckets with episodic history, summaries, open loops, bounded `recentAuditTrail` turn slices, and `lastRetrieval` compatibility state aligned to that newest audit summary
- `data/penny-memory-embeddings.json`
  - embedding cache used for semantic archive retrieval when a local embed model is available
  - bounded background-vectorization status for default-on post-turn shadow prewarm work that can still be disabled by env
- `data/penny-memory-ledger.json`
  - bounded research continuity topics with evidence refs, contradictions, open follow-ups, source session/turn identity, additive question-scoped identity (`kind`, `anchorType`, `anchorRef`, `scopeKey`, `scopeLabel`), and truth metadata (`sourceClass`, `summaryClass`, `summaryEvidenceRefs`)
  - advisory only; this does not mutate canonical explicit memory by itself

Current archive-policy behavior:

- explicit memory is still canonical
- archive utility scoring lives in `lib/penny-memory-archive-policy.js`
- that utility score is currently used for evals plus live background-prewarm candidate ranking, not live auto-forgetting
- background chat vectorization now defaults on, but it still runs only after `archiveCompletedTurn`, never in prompt assembly, and can be disabled with `PENNY_ENABLE_BACKGROUND_CHAT_VECTORS=0`. It is off the reply-latency path, but it still shares process, embedding-backend, and cache/store capacity.
- inspector payloads expose background-vectorization telemetry, including the session `lastArchivedAt` timestamp, and the in-app panel now surfaces a compact background-vectorization summary so the behavior stays inspectable in practice

Important trust boundary:

- explicit memory remains canonical
- archive-derived summaries/patterns do not auto-overwrite `memories[]`
- promotion into stronger explicit memory requires inspector review
- research ledger context is advisory continuity, not canonical truth

### 3. LM Studio transport layer

LM Studio is the real engine behind Penny's main chat lane.

Current transport stack is owned by `lib/penny-lmstudio-transports.js`:

- stateful chat (`/api/v1/chat`) when available
- chat completions (`/v1/chat/completions`) fallback
- responses (`/v1/responses`) fallback

Important architecture detail:

- the server resolves the actually loaded runtime model instead of blindly trusting the configured pretty model id
- streamed chat is the normal frontend path
- the streamed stateful lane now preserves Penny's LM Studio thread across turns instead of clearing it after every reply

### 4. Direct tool intents

For certain technical or inspect-style requests, Penny does not need a full open-ended planning pass.

`server.js` now composes a deterministic direct-intent layer whose parser lives in `lib/penny-direct-intents.js`, whose reply-composition helpers live in `lib/penny-direct-intent-replies.js`, and whose execution branch lives in `lib/penny-direct-tool-assist.js`.

That layer can route things like:

- read/search project files
- runtime status
- git status / diff
- web search / fetch
- direct file write / replace / append

This exists to keep simple asks fast and honest.

### 5. Tool loop

If a request is more complex than a direct deterministic lane, Penny can use a local tool loop.

Tool categories currently include:

- project file listing / reading
- text search
- file editing
- syntax checking
- git inspection
- log reads
- lightweight web search and page fetch

The planner/manual tool loops now live in `lib/penny-tool-loop.js`, while the concrete tool implementations and dispatch switchboard live in:

- `lib/penny-project-tools.js`
- `lib/penny-web-tools.js`
- `lib/penny-git-tools.js`
- `lib/penny-runtime-tools.js`
- `lib/penny-tool-registry.js`

The tool registry now also exposes an internal `ToolCapabilityDescriptor` contract:

- current tools are all marked `surface: native`
- the contract is shaped for future `mcp` and `openapi` surfaces
- this is a planning seam only; Penny is not running live connector adapters in production

### 6. Research continuity and provenance

Penny now has an explicit research continuity layer in `lib/penny-research-ledger.js`:

- qualifying tool/research turns can update a bounded advisory ledger
- topic identity is now question-scoped, so one file or repo anchor can hold multiple bounded topics without collapsing into one ledger row
- settled non-contradiction topics require verified non-`query` evidence plus an evidence-tight summary; otherwise the topic stays provisional and the durable `conclusion` stays empty
- raw assistant synthesis is not persisted as a durable anchored-topic conclusion; prompt context falls back through open follow-up, evidence-tight conclusion, question, then topic label
- prompt assembly can surface a small number of open/provisional topics as wake context, preferring direct anchor-plus-scope overlap over adjacent same-file topics
- the memory inspector can render those topics with evidence refs, summary-evidence refs, truth/source class, and the additive anchor/scope identity summary

The runtime artifact layer in `lib/penny-runtime-artifacts.js` now carries:

- retrieval channels used or held back
- contradiction/open-loop/ongoing-investigation context
- accepted vs rejected evidence summaries
- a provenance block that exposes source identity for archive and research-ledger inputs
- cleanup metadata split into legacy visible-reply cleanup plus a typed `cleanupTransform` summary
- compact prompt-slot composition from `PROMPT_SLOT_REGISTRY`
- prompt-time `promptTruth` receipts for `stableFacts`, `memoryBooks`, `sessionArchive`, `globalArchive`, and `researchLedger`, including candidate vs rendered ids/counts plus holdback reasons
- a bounded `reasoningPolicy` receipt derived from latency budget plus execution path, with `minimal`, `deliberate`, `verifier-first`, and `attachment-bounded` modes instead of any raw reasoning text surface
- explicit approximate-path policy metadata from the latency budget and runtime fallback state
- advisory-merge summaries that distinguish lossy merge pressure from canonical memory authority
- a bounded session `recentAuditTrail` that freezes compact prompt-time/runtime-turn truth before post-turn ledger mutation and keeps `lastRetrieval` summary fields aligned with the newest slice
- headline summary text and wake-hierarchy prose derived from rendered `promptTruth`, so zero-rendered advisory channels are described as held back or not rendered instead of sounding like silent support

Important receipt rule:

- prompt assembly is the source of truth for advisory usage
- `researchLedgerPromptInjected` now means the ledger was actually rendered into the prompt
- post-reply ledger mutation stays in `researchLedgerUpdate` instead of being backfilled into prompt-use receipts
- direct canon-authority questions share one detector across latency policy, prompt/history suppression, and memory-state writes
- that detector now covers broader personal recall shapes such as preference, attribute, and location questions, but it is still gated by question phrasing, possessive framing, and explicit-memory overlap so repo questions do not bleed into canon recall
- verifier-first exactness is explicit for deterministic tool paths and other short-circuited verified turns, but Penny still does not expose chain-of-thought as a runtime trust surface

This is meant to improve auditability, not to create a new autonomous memory system.

### 7. Semantic render pass

Harder technical turns can go through a semantic render phase:

- tools gather verified facts
- the facts are compressed into a semantic core
- Penny does a final "say this like Penny" pass without inventing extra facts

This is useful, but it is also a latency multiplier and should be used selectively.

### 8. QA and eval trust surfaces

The QA/eval harnesses now share three small helper layers:

- `lib/penny-qa-trace.js`
  - normalized replayable trace envelopes for QA/eval runs, including a compact `runIdentity` canary for resolved models, loaded models, execution-path facts, semantic readiness, runtime-artifact version, and degraded/fallback counters
  - additive drift/fixation canaries such as first drift reason/turn, fixation repeat count, and recovered-after-drift
- `lib/penny-qa-validity.js`
  - environment/readiness validation so harnesses can mark runs invalid or degraded for machine reasons instead of blaming Penny
- `lib/penny-qa-trust.js`
  - normalized trust/verdict summaries such as `pass`, `invalid`, `ambiguous`, `fallback`, and `degraded`
- `scripts/qa-penny-memory.js`
  - combined segmented memory QA plus a judged `write / retrieve / forget` mode, with semantic replacement grading for premise-correction cases so wording noise does not create fake regressions
- `scripts/eval-penny-ledger-compare.js`
  - comparative ledger-prompt harness for bounded research/memory prompt strategies

This does not make Penny “judge herself” in production. It makes the existing harnesses more honest about whether a run is trustworthy, polluted by environment drift, or behaviorally red.

### 9. Mood / vessel presentation

The visible Penny vessel is driven by reply mood tags such as:

- `calm`
- `happy`
- `excited`
- `thinking`
- `surprised`
- `flirty`
- `smug`
- `annoyed`

Frontend sprite selection and animation are tied to these tags.

## How to extend without re-monolithing

When adding backend behavior, prefer the smallest named owner that already matches the job:

- routing and request glue stay in `server.js`
- stateful logic goes in `lib/`
- repeated prompt or transport behavior gets a dedicated helper module
- any new heuristic should come with a reason code and a small test fixture

When adding frontend behavior, keep `public/app.js` as bootstrap only and use `public/js/penny-app.js` as coordination only:

- UI state that belongs to one slice should move into a dedicated `public/js/` module
- transcript, memory, LM Studio diagnostics, and attachment handling should not be merged back together
- if a browser helper becomes reusable, extract it before adding more features to it

## API surface

Current important endpoints:

- `GET /api/penny/status`
- `GET /api/penny/memory`
- `POST /api/penny/memory`
- `GET /api/penny/memory/inspector`
- `POST /api/penny/memory/review`
- `POST /api/penny/memory/purge`
- `POST /api/penny/consolidate`
- `GET /api/penny/lmstudio/status`
- `POST /api/penny/lmstudio/model`
- `GET /api/penny/shadow-status`
- `POST /api/penny/chat`
- `POST /api/penny/chat/shadow`

`/api/companion/*` aliases also exist for the main status/chat route.

## Frontend architecture

The frontend is a single-page app with no build step.

Current split:

- `public/app.js`
tiny module bootstrap
- `public/js/penny-app.js`
main SPA orchestration and wiring shell
- `public/js/penny-transcript-ui.mjs`
transcript rendering and streaming presentation helpers
- `public/js/penny-expression-runtime.mjs`
expression/mood runtime helpers
- `public/js/penny-ambient-chrome.mjs`
boot overlay, emoji picker, particle, and idle/parallax chrome helpers
- `public/js/penny-memory-panel.mjs`
memory-inspector rendering for explicit memory, archive state, runtime artifacts, trace provenance, and research continuity
- `public/js/penny-lmstudio-ui.js`
LM Studio diagnostics/model UI helpers
- `public/js/penny-attachments.js`
image/file attachment prep and preview handling
- `public/js/penny-storage.js`
local browser persistence/session helpers; archive inspector data stays server-side

Main remaining responsibilities in `public/js/penny-app.js`:

- local browser state
- chat composer and transcript rendering
- SSE streaming consumption
- memory/settings UI
- mood-driven sprite swaps
- settings and model list fetches

This is intentionally dependency-light, but the tradeoff is that `public/js/penny-app.js` is still large and stateful even though `public/app.js` is only bootstrap glue.

## Operational scripts

Important scripts:

- `start-lyra.ps1`
Starts Penny in the background and writes PID / meta files.
- `stop-lyra.ps1`
Stops the background Penny server.
- `scripts/ensure-lmstudio-penny-preset.js`
Reasserts the LM Studio preset/default state Penny expects.
- `scripts/penny-lmstudio-prepare.js`
Shared LM Studio preparation flow used by startup, preflight, QA, and eval scripts.
- `scripts/penny-preflight.js`
Cheap local environment and LM Studio readiness checks.
- `scripts/penny-wait-ready.js`
Readiness poller used by the durable launcher and tests.
- `scripts/eval-penny-models.js`
Comparative chat-lane model harness with a fixed tool-lane model.
- `scripts/eval-penny-probes.js`
Tool-lane leaning probe harness that prefers E4B by default.
- `scripts/eval-penny-epistemic-compare.js`
Epistemic compare harness; current favored primary pair is `off` vs `synthesis-only`.
- `scripts/eval-penny-ledger-compare.js`
Ledger compare harness for bounded research-ledger prompt strategies.
- `scripts/eval-penny-runtime-fit.js`
Runtime-fit harness for context-length and semantic-fallback tradeoff measurement.
- `scripts/qa-penny-memory.js`
Segmented memory QA harness with trace-first runtime artifact validation plus judged `write / retrieve / forget` suites.
- `scripts/qa-penny-voice-redo.js`
Chat-lane voice QA harness that records prompt-set, lane/model/fallback metadata, and normalized trust.
- `scripts/qa-penny-browser-smoke.js`
Disposable-server browser smoke harness for the real streamed `/api/penny/chat?stream=1` path.
- `scripts/qa-penny-next-cycle.js`
Fixed-order wrapper for the standard next-cycle rerun sequence.
- `scripts/build-review-bundle.js`
Builds a filtered repo copy for outside review without dragging along runtime debris and local logs.
- Route/regression tests and similar local verification should use an isolated mock or a dedicated temporary LM Studio server, not the user's live loaded model.
- That isolation pattern has already proven itself in-project; keep carrying it forward so verification stays repeatable and does not disturb the live brain.

## Speed realities

The biggest runtime latency costs today are:

- first-turn prompt ingestion on a large local model
- overlapping requests against LM Studio
- large prompt/context processing
- extra semantic render passes on turns that do not need them

Recent mitigations already in place:

- live model resolution now prefers the actually loaded LM Studio runtime id
- high-trust QA favors disposable or restart-gated servers instead of the stale long-lived main process
- streamed stateful LM Studio chat now keeps the thread alive between turns
- normal chat output budget is capped lower than the tool/coding paths
- casual chat history is clipped more aggressively

## What is stable vs unstable

Reasonably stable:

- single-page UI shell
- durable memory file shape
- LM Studio as the main chat brain
- runtime voice asset layout in `penny-voice/runtime`

Still volatile:

- `server.js` internal shape
- tool loop heuristics
- semantic render heuristics
- shadow/OpenClaw integration boundary
- performance tuning

## Known architectural debt

The biggest architectural problem is straightforward:

- `server.js` is doing too many jobs

It currently mixes:

- config and environment parsing
- prompt asset loading
- memory model logic
- tool loop planning and LM Studio orchestration
- prompt building
- LM Studio transport handling
- shadow/OpenClaw transport
- SSE helpers
- route handling
- startup housekeeping

That is the first thing that should eventually be split if this repo keeps growing.

## If this repo were split cleanly later

A sensible future shape would probably look like:

- `src/config/*`
- `src/memory/*`
- `src/prompting/*`
- `src/lmstudio/*`
- `src/tools/*`
- `src/routes/*`
- `src/shadow/*`
- `src/ui-contract/*`

That is not the current state. This file describes the current state.
