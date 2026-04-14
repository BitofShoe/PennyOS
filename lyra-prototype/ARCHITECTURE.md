# Architecture

This file describes how Penny currently works in this repo as of 2026-04-13.

It is intentionally blunt about what is "real architecture" versus "current monolith that still needs to be split."

## Related docs

- [CODEBASE.md](./CODEBASE.md)
Practical repo map and "where to touch what" guide.
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

## System shape

Today the app is a single-process local web application with one large Node server and one browser UI:

- `server.js`
Main backend orchestration, API surface, durable memory handling, LM Studio transport selection, tool loop, semantic render pass, shadow lane, and static file serving.
- `lib/*`
Extracted backend modules for memory helpers, direct-intent parsing/replies, direct tool assist, and concrete project/web/git/runtime tools.
- `public/index.html`
Single-page shell for the Penny UI.
- `public/app.js`
Frontend bootstrap only.
- `public/styles.css`
UI styling and animation.
- `penny-voice/runtime/*`
The prompt-facing voice system actually injected into Penny's live runtime.

This is not a distributed system. It is a single-user local prototype with a monolithic server.

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
6. For chat-like turns, backend retrieves a bounded archive context from the hybrid memory layer
7. The selected lane resolves its preferred model and transport family
8. Reply comes back with a visible text response plus a hidden mood tag
9. Frontend parses the mood tag and updates Penny's visual state
10. Canonical explicit memory is written back to `data/penny-memory.json`
11. Archive consolidation runs after successful turns and writes episodic/derived memory to `data/penny-memory-archive.json`

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
  - session buckets with episodic history, summaries, open loops, and last retrieval provenance
- `data/penny-memory-embeddings.json`
  - embedding cache used for semantic archive retrieval when a local embed model is available

Important trust boundary:

- explicit memory remains canonical
- archive-derived summaries/patterns do not auto-overwrite `memories[]`
- promotion into stronger explicit memory requires inspector review

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

`server.js` now composes a deterministic direct-intent layer whose parser/reply helpers live in `lib/penny-direct-intents.js` and whose execution branch lives in `lib/penny-direct-tool-assist.js`.

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

### 6. Semantic render pass

Harder technical turns can go through a semantic render phase:

- tools gather verified facts
- the facts are compressed into a semantic core
- Penny does a final "say this like Penny" pass without inventing extra facts

This is useful, but it is also a latency multiplier and should be used selectively.

### 7. Mood / vessel presentation

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
  main SPA orchestration, memory inspector rendering, and review/purge controls
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
- `PENNY_LMSTUDIO_EMBED_MODEL`
Soft-dependency embedding model for semantic memory. If it is missing or unloaded, Penny falls back to keyword retrieval instead of failing chat.
- In-app local embedding backend
Considered and intentionally deferred for a later cycle. This branch uses LM Studio embeddings only.
- `scripts/penny-wait-ready.js`
Readiness poller used by the durable launcher and tests.
- `scripts/eval-penny-models.js`
Comparative chat-lane model harness with a fixed tool-lane model.
- `scripts/eval-penny-probes.js`
Tool-lane leaning probe harness that prefers E4B by default.
- `scripts/qa-penny-voice-redo.js`
Chat-lane voice QA harness that records lane/model/fallback metadata.

## Speed realities

The biggest runtime latency costs today are:

- first-turn prompt ingestion on a large local model
- overlapping requests against LM Studio
- large prompt/context processing
- extra semantic render passes on turns that do not need them

Recent mitigations already in place:

- live model resolution now prefers the actually loaded LM Studio runtime id
- quick QA defaults to the existing main server instead of spawning a second Penny server
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
