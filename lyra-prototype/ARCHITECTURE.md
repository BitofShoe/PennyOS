# Architecture

This file describes how Penny currently works in this repo as of 2026-04-12.

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
- [Operational system prompt source](./Penny's Playground/PENNY â€” OPERATIONAL SYSTEM PROMPT.md)
Legacy/source operational prompt material.
- [Romantic overlay source](./Penny's Playground/PENNY â€” ROMANTIC OVERLAY.md)
Legacy/source romantic blend material.
- [High-intensity overlay source](./Penny's Playground/PENNY â€” HIGH-INTENSITY ROMANTIC + EROTIC OVERLAY.md)
Legacy/source high-intensity overlay material.

## System shape

Today the app is a single-process local web application with one large Node server and one browser UI:

- `server.js`
Main backend, API surface, durable memory handling, LM Studio transport selection, direct-tool routing, tool loop, semantic render pass, shadow lane, static file serving.
- `public/index.html`
Single-page shell for the Penny UI.
- `public/app.js`
Frontend state, SSE chat streaming, panel switching, mood/sprite updates, settings, local browser persistence.
- `public/styles.css`
UI styling and animation.
- `penny-voice/runtime/*`
The prompt-facing voice system actually injected into Penny's live runtime.

This is not a distributed system. It is a local-first prototype with a monolithic server.

## Runtime modes

There are two conceptual chat lanes:

1. Main lane: LM Studio

- This is Penny's real primary brain.
- The browser talks to `POST /api/penny/chat`.
- The backend resolves the actually loaded LM Studio model, builds the prompt, and returns a reply.

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
5. For local mode, backend routes into LM Studio transport logic
6. Reply comes back with a visible text response plus a hidden mood tag
7. Frontend parses the mood tag and updates Penny's visual state
8. Durable memory is written back to `data/penny-memory.json`

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

Durable memory is stored in `data/penny-memory.json`.

The memory model currently tracks:

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

### 3. LM Studio transport layer

LM Studio is the real engine behind Penny's main chat lane.

Current transport stack in `server.js`:

- stateful chat (`/api/v1/chat`) when available
- chat completions (`/v1/chat/completions`) fallback
- responses (`/v1/responses`) fallback

Important architecture detail:

- the server resolves the actually loaded runtime model instead of blindly trusting the configured pretty model id
- streamed chat is the normal frontend path
- the streamed stateful lane now preserves Penny's LM Studio thread across turns instead of clearing it after every reply

### 4. Direct tool intents

For certain technical or inspect-style requests, Penny does not need a full open-ended planning pass.

`server.js` has a deterministic direct-intent layer that can route things like:

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

The tool loop is still inside `server.js`, which is one reason the file has turned into a giant beast.

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
- `POST /api/penny/consolidate`
- `GET /api/penny/lmstudio/status`
- `POST /api/penny/lmstudio/model`
- `GET /api/penny/shadow-status`
- `POST /api/penny/chat`
- `POST /api/penny/chat/shadow`

`/api/companion/*` aliases also exist for the main status/chat route.

## Frontend architecture

The frontend is a single-page app with no build step.

Main responsibilities in `public/app.js`:

- local browser state
- chat composer and transcript rendering
- SSE streaming consumption
- memory/settings UI
- mood-driven sprite swaps
- settings and model list fetches

This is intentionally dependency-light, but the tradeoff is that `public/app.js` is also growing large and stateful.

## Operational scripts

Important scripts:

- `start-lyra.ps1`
Starts Penny in the background and writes PID / meta files.
- `stop-lyra.ps1`
Stops the background Penny server.
- `scripts/ensure-lmstudio-penny-preset.js`
Reasserts the LM Studio preset/default state Penny expects.
- `scripts/eval-penny-models.js`
Comparative model harness.
- `scripts/qa-penny-voice-redo.js`
Lighter voice QA harness.

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
- web fetch helpers
- project-file tool implementations
- direct-intent parsing
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