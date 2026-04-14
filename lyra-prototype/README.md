# Penny Companion Prototype

Local-first Penny companion app with:

- a single-page browser UI
- a single Node backend
- LM Studio as the main chat brain
- durable disk-backed memory
- runtime voice assets under `penny-voice/runtime/`
- an optional experimental OpenClaw shadow lane

If you landed here from the wider `workspace-main/` ritual docs, start with [CODEBASE.md](./CODEBASE.md) for the actual runnable app map.

## Start here

Read these in order if you need the current truth:

1. [CODEBASE.md](./CODEBASE.md)
2. [ARCHITECTURE.md](./ARCHITECTURE.md)
3. [server-js-section-map.md](./server-js-section-map.md)

## Current runtime truth

- Penny now routes local turns through two automatic LM Studio lanes:
  - chat lane for companion turns and memory-heavy conversation
  - tool lane for bounded inspect/search/read/edit/runtime/git/web turns
- `server.js` is still the main backend monolith, but lane selection, LM Studio status/model resolution, visible-reply salvage, tool-loop orchestration, transports, direct-intent parsing/replies, direct tool-assist, and concrete tools now live under `lib/`.
- `public/app.js` is now bootstrap glue. The main browser logic lives under `public/js/`, with separate modules for LM Studio diagnostics/model UI, attachments, and local persistence.
- Penny's live prompt stack comes from `penny-voice/runtime/`, not the giant raw personality docs.
- LM Studio is Penny's real primary brain.
- OpenClaw shadow exists, but it is optional and experimental.
- Browser storage uses the `penny:v3` key for local vessel/settings continuity.
- Durable memory now defaults to an untracked `data/penny-memory.json`, seeded from tracked `data/penny-memory.seed.json` when missing.

## Project layout

- `server.js`
Main backend orchestration: routes, memory persistence, lane-aware local routing, semantic render gating, and static file serving.
- `public/`
Browser UI shell, styles, sprites, and client logic.
- `penny-voice/runtime/`
Live runtime voice assets injected into prompts.
- `lib/`
Extracted backend helpers with cheap regression tests. Current high-value modules include local lane routing, LM Studio status/model resolution, visible reply salvage, transports, tool-loop orchestration, direct intents, direct tool assist, concrete tool implementations, and memory helpers.
- `scripts/`
QA, eval, and LM Studio helper scripts.
- `data/`
Durable runtime state.

For the fuller map, use [CODEBASE.md](./CODEBASE.md).

## Run

### Durable launcher

Recommended:

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\start-lyra.ps1
```

That launcher now waits for `GET /api/penny/status` before it claims Penny is up.
It also runs `npm run lmstudio:prepare` in best-effort mode first unless `PENNY_SKIP_LMSTUDIO_PREP=1`.

Then open:

- [http://localhost:4317](http://localhost:4317)

Stop it later with:

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\stop-lyra.ps1
```

### Foreground mode

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
npm start
```

## Useful commands

```powershell
npm run preflight
npm run lmstudio:prepare
npm test
npm run eval:probes
npm run qa:voice-redo
npm run eval:models
npm run preset:lmstudio
```

## Memory model

Penny stores two different kinds of continuity:

- Browser-side vessel/settings state in `localStorage`
This is lightweight UI continuity like voice toggle, selected brain mode, and other client-side preferences.
- Durable server-side memory in `data/penny-memory.json`
This is the actual runtime memory store used for prompt relevance and longer continuity. The repo tracks `data/penny-memory.seed.json`; the live `data/penny-memory.json` is created on first run and stays local.

The browser cache is not the source of truth for long-term memory.

## LM Studio notes

- Penny resolves the actually loaded LM Studio model instead of blindly trusting the configured pretty model id.
- Chat lane and tool lane have separate preferred models:
  - `PENNY_LMSTUDIO_CHAT_MODEL` defaults to `google/gemma-4-31b`
  - `PENNY_LMSTUDIO_TOOL_MODEL` defaults to `google/gemma-4-e4b`
- `npm run lmstudio:prepare` verifies local preset wiring, checks installed/loaded models, and tries to load the requested chat model for QA/startup flows.
- The settings-panel model picker is now a chat-lane override only. Tool-lane selection is config-driven.
- The local `@local:penny` preset is operator-owned LM Studio state. Penny can verify and reassert the wiring, but the repo does not own the preset body.
- Depending on the loaded model, Penny may use native stateful chat, chat completions, or responses-style fallbacks.
- Large local models can be slow, especially on first turn and on image turns.
- The max output token cap is a ceiling, not a target. Raising it prevents clipping; it does not force Penny to ramble if the model naturally stops earlier.

## Shadow mode

- `PENNY_OPENCLAW_ENABLED=1` enables the optional shadow lane.
- LM Studio remains Penny's main chat brain.
- Shadow mode should stay parked unless it proves a real capability win.

See [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md) for the current verdict.

## Local security posture

This is a single-user local prototype. Treat it that way:

- keep it bound to local/private use
- do not expose the raw server to the public internet
- be careful with tool-enabled routes, because this app can inspect and edit project files by design

## Known limits

- `server.js` is still too large and still owns too many subsystems, even after the lane/status/transport/tool extractions.
- `public/js/penny-app.js` is still large and stateful even though `public/app.js` is now just bootstrap glue.
- Local 31B models can be painfully slow on commodity hardware, especially for image turns and long generations.
- The docs are more honest than the codebase is modular, which is useful but also a trap if you stop there.

## Source material vs runtime assets

Use this hierarchy:

1. Runtime behavior
  `server.js`, `public/*`, `penny-voice/runtime/*`
2. Operational docs
  `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, eval docs
3. Canon/source material
  `Penny's Playground/*`, raw `Personality *.md`, distilled sidecars

Do not load the giant raw personality files into normal runtime prompt context unless you are doing deliberate refinement work.
