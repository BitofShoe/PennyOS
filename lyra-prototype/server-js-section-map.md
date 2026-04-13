# `server.js` section map

**Purpose:** current-state map for the remaining `server.js` monolith after the 2026-04-13 direct-intent/tool extraction pass and the automatic dual-lane LM Studio split.  
**Companion docs:** [ARCHITECTURE.md](./ARCHITECTURE.md), [CODEBASE.md](./CODEBASE.md), [Notes on Penny's Code From a Project Manager.md](./Notes%20on%20Penny's%20Code%20From%20a%20Project%20Manager.md)

Line numbers will drift. Treat **function names and module boundaries** as the stable key.

---

## How to use this doc

1. Start here before touching `server.js`.
2. If the behavior already lives in `lib/`, edit the module there first.
3. If the behavior is still orchestration-heavy in `server.js`, use the section names below to find the right band.
4. Keep the `server.js` exports stable for tests and harnesses unless you intentionally replace them.

---

## Top-level symbols

Still in `server.js`:

- env/config constants
- `sessionState`
- MIME map
- prompt asset cache
- prompt fallback strings

Already moved out of the monolith:

- durable memory merge/consolidation helpers via [lib/penny-memory-state.js](./lib/penny-memory-state.js)
- local lane selection via [lib/penny-local-lanes.js](./lib/penny-local-lanes.js)
- LM Studio status/model resolution via [lib/penny-lmstudio-status.js](./lib/penny-lmstudio-status.js)
- visible reply salvage via [lib/penny-visible-reply.js](./lib/penny-visible-reply.js)
- tool-loop orchestration via [lib/penny-tool-loop.js](./lib/penny-tool-loop.js)
- LM Studio transports via [lib/penny-lmstudio-transports.js](./lib/penny-lmstudio-transports.js)
- direct-intent parsing/reply helpers via [lib/penny-direct-intents.js](./lib/penny-direct-intents.js)
- direct deterministic tool assist via [lib/penny-direct-tool-assist.js](./lib/penny-direct-tool-assist.js)
- concrete tool implementations via `lib/penny-*-tools.js`
- tool dispatch via [lib/penny-tool-registry.js](./lib/penny-tool-registry.js)

---

## HTTP API surface

All routes still live in the `http.createServer` callback near the bottom of `server.js`.

Key routes:

- `GET /api/penny/memory`
- `POST /api/penny/memory`
- `PATCH /api/penny/memory`
- `POST /api/penny/consolidate`
- `GET /api/penny/shadow-status`
- `GET /api/penny/lmstudio/status`
- `POST /api/penny/lmstudio/model`
- `POST /api/penny/chat/shadow`
- `POST /api/penny/chat`, `/api/companion/chat`
- `GET /api/penny/status`, `/api/companion/status`
- static file serving under `public/`

---

## Remaining `server.js` bands

### A. Bootstrap and config

Role:

- wire Node built-ins
- read env
- define operational limits

Future split target:

- `src/config/*`

### B. Prompt assets

Role:

- load `penny-voice/runtime/*`
- normalize cached prompt asset text

Still worth splitting later if prompt logic grows again.

### C. Durable memory store glue

Role:

- disk-backed session store read/write
- route-facing memory save/load
- `buildChatMemoryState(...)`

Important note:

- pure-ish memory semantics are already in `lib/penny-memory.js` and [lib/penny-memory-state.js](./lib/penny-memory-state.js)
- the remaining debt here is route/storage orchestration

### D. Text / HTML / URL helpers

Role:

- `hashText`
- `clampNumber`, `formatBytes`, `truncateText`, `collapseWhitespace`
- HTML stripping / entity decode
- URL extraction / normalization
- DuckDuckGo Lite parsing
- bounded HTTP fetch

These helpers are still central shared dependencies for the extracted modules.

### E. Chat sanitization and attachments

Role:

- code-fence stripping
- permissive tool-argument parsing
- message and attachment sanitization
- file attachment prompt context
- LM Studio error summaries

Future split target:

- `src/chat/sanitize.js`

### F. HTTP client helpers

Role:

- JSON send/read helpers
- long-running POST
- SSE POST

Future split target:

- `src/http/client.js`

### G. Mood tags and placeholder replies

Role:

- `[MOOD:x]` extraction/cleanup
- mood picking
- non-LLM fallback Penny replies
- OpenClaw shadow prompt assembly

### H. LM Studio desktop integration

Role:

- settings discovery
- model normalization and matching
- loaded/installed model inspection
- connection status probing
- transport preference hints

This is still one of the biggest isolated chunks left in `server.js`.
Primary ownership now lives in [lib/penny-lmstudio-status.js](./lib/penny-lmstudio-status.js). `server.js` mostly consumes the API output and exposes the routes.

### I. OpenClaw shadow

Role:

- gateway POST to `openclaw/main`

Still intentionally small and bounded.

### J. Concrete tools (historical band; extracted)

Now owned by:

- [lib/penny-project-tools.js](./lib/penny-project-tools.js)
- [lib/penny-web-tools.js](./lib/penny-web-tools.js)
- [lib/penny-git-tools.js](./lib/penny-git-tools.js)
- [lib/penny-runtime-tools.js](./lib/penny-runtime-tools.js)

### K. Tool dispatch (historical band; extracted)

Now owned by:

- [lib/penny-tool-registry.js](./lib/penny-tool-registry.js)

### L. Direct intents (historical band; mostly extracted)

Now owned by:

- [lib/penny-direct-intents.js](./lib/penny-direct-intents.js)
- [lib/penny-direct-tool-assist.js](./lib/penny-direct-tool-assist.js)
- [lib/penny-tool-intents.js](./lib/penny-tool-intents.js)

Still in `server.js` for this lane:

- the top-level orchestration that chooses direct deterministic handling versus the full tool loop

### M. Full tool loop

Primary ownership now lives in [lib/penny-tool-loop.js](./lib/penny-tool-loop.js).

### N. Tool system prompt

Role:

- `buildLmStudioToolSystemPrompt(...)`

### O. Semantic render

Role:

- semantic-core summarization
- semantic render gating
- final Penny restyle pass for hard technical turns

### P. Main chat prompts

Role:

- lean/full system prompt assembly
- message builders for completions and stateful chat

### Q. Reply cleanup and LM response parsing

Primary ownership now lives in [lib/penny-visible-reply.js](./lib/penny-visible-reply.js).

### R. SSE helpers

Role:

- begin/send/keepalive stream helpers

### S. LM Studio transports

Primary ownership now lives in [lib/penny-lmstudio-transports.js](./lib/penny-lmstudio-transports.js).

Still in `server.js` for this lane:

- `runLmStudioLocalSmart(...)`
- `streamLmStudioLocalSmart(...)`
- route-level orchestration and semantic-render gating

### T. Memory extraction

Role:

- light heuristic memory extraction from user turns

This is smaller now because `lib/penny-memory-state.js` owns most memory semantics.

### U. Static files

Role:

- `serveFile(...)`

### V. Router closure

Role:

- payload parsing
- stream vs JSON reply handling
- memory save/update
- endpoint dispatch

### W. Startup

Role:

- LAN URL printing
- purge test sessions on boot
- `startServer(...)`

---

## Current exports

`server.js` still exports:

- `server`
- `startServer`
- `getLmStudioConnectionStatus`
- `buildLmStudioMessages`
- `coercePennyVisibleReply`
- `textFromChatMessage`
- `extractExplicitProjectPath`
- `shouldForceLocalToolLoop`
- `resolveDirectToolIntent`
- `composeToolRecordFallback`
- `looksLikeWeakToolReply`

Those direct-intent helpers are re-exported from the extracted module so the regression tests can stay simple.

---

## Already extracted

| Module | Role |
|--------|------|
| [lib/penny-memory.js](./lib/penny-memory.js) | Memory scoring, merge, prompt formatting |
| [lib/penny-memory-state.js](./lib/penny-memory-state.js) | Memory patch semantics, consolidation, chat-memory layering |
| [lib/penny-tool-intents.js](./lib/penny-tool-intents.js) | Tool-offer gating, `executeDirectProjectInspectIntent` |
| [lib/penny-local-lanes.js](./lib/penny-local-lanes.js) | Chat-vs-tool lane selection before any LM Studio call |
| [lib/penny-lmstudio-status.js](./lib/penny-lmstudio-status.js) | Chat/tool preferred models, runtime chat override, connection status |
| [lib/penny-visible-reply.js](./lib/penny-visible-reply.js) | Thinking-spill cleanup and speakable reply salvage |
| [lib/penny-tool-loop.js](./lib/penny-tool-loop.js) | Planner/manual tool loop orchestration plus tool-context answer |
| [lib/penny-lmstudio-transports.js](./lib/penny-lmstudio-transports.js) | Stateful chat, chat completions, responses, and transport selection |
| [lib/penny-direct-intents.js](./lib/penny-direct-intents.js) | Direct path extraction, routing heuristics, deterministic reply helpers |
| [lib/penny-direct-tool-assist.js](./lib/penny-direct-tool-assist.js) | Direct sequence runner, targeted web inspect flow, one-shot direct tool handling |
| [lib/penny-project-tools.js](./lib/penny-project-tools.js) | Project path resolution, file read/search/edit helpers, `node --check` |
| [lib/penny-web-tools.js](./lib/penny-web-tools.js) | Web search and page fetch helpers |
| [lib/penny-git-tools.js](./lib/penny-git-tools.js) | Git status/diff helpers |
| [lib/penny-runtime-tools.js](./lib/penny-runtime-tools.js) | Runtime status and log-tail helpers |
| [lib/penny-tool-registry.js](./lib/penny-tool-registry.js) | `executePennyTool` switchboard plus user-facing tool labels |

---

## Suggested next splits

1. Router closure
2. Remaining `server.js` duplicates that still shadow the extracted LM Studio helpers
3. Tool system prompt and semantic-render glue
4. Prompt-asset loading and config cleanup

That order keeps chipping away at `server.js` where the remaining risk is now concentrated: orchestration, route glue, and the last duplicate legacy bands.
