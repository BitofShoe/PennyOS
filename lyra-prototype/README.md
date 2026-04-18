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
- `public/app.js` is now bootstrap glue. The main browser logic lives under `public/js/`, with separate modules for LM Studio diagnostics/model UI, transcript rendering, expression runtime, ambient chrome/emoji behavior, memory-inspector rendering, attachments, and local persistence.
- Penny's live prompt stack comes from `penny-voice/runtime/`, not the giant raw personality docs.
- LM Studio is Penny's real primary brain.
- OpenClaw shadow exists, but it is optional and experimental.
- Browser storage uses the `penny:v3` key for local vessel/settings continuity.
- Durable memory now defaults to an untracked `data/penny-memory.json`, seeded from tracked `data/penny-memory.seed.json` when missing.
- Penny now has a hybrid memory stack:
  - canonical explicit facts/settings in `data/penny-memory.json`
  - archive + semantic recall in `data/penny-memory-archive.json` and `data/penny-memory-embeddings.json`
  - a bounded research continuity ledger in `data/penny-memory-ledger.json`
  - the archive layer is additive and reviewable; it does not silently overwrite explicit facts
- The archive layer can do bounded post-turn shadow vector prewarm for recent chat history, but only when explicitly enabled and only off the reply-latency path. It still shares the same process, embedding backend, and cache/store.
- The backend memory inspector now exposes runtime artifacts, trace provenance, research continuity topics, recency protection, bounded background-vectorization telemetry, compact prompt-slot composition, prompt-truth receipts, cleanup-transform class/materiality, reasoning-policy receipts, approximate-path policy, and advisory-merge provenance summaries. The in-app panel surfaces these as compact debugging summaries instead of raw dumps.
- The research continuity ledger is now question-scoped instead of file-scoped: one repo anchor can hold multiple bounded topics, and the inspector exposes each topic's anchor/scope identity instead of flattening them together.
- Question-scoped ledger topics only settle when verified non-`query` evidence supports an evidence-tight summary. Otherwise Penny keeps the topic provisional, leaves the durable conclusion empty, and falls back to the question or open follow-up instead of laundering assistant wording into continuity.
- Session archive buckets now keep a bounded `recentAuditTrail` with compact turn slices: selected lane/mode/path, compact retrieval ids, prompt-truth counts/holdbacks, artifact summary, and post-turn ledger update status. `lastRetrieval` keeps its old compatibility role but now carries the same compact summary so the two views stay aligned.
- Canon-first recall handling now covers more natural personal-memory shapes like "What color is my..." or "What do I like again?", but it is gated by question phrasing plus actual explicit-memory overlap so repo/file questions do not get misclassified as personal recall.

## Project layout

- `server.js`
Main backend orchestration: routes, memory persistence, lane-aware local routing, semantic render gating, and static file serving.
- `public/`
Browser UI shell, styles, sprites, and client logic.
- `penny-voice/runtime/`
Live runtime voice assets injected into prompts.
- `lib/`
Extracted backend helpers with cheap regression tests. Current high-value modules include local lane routing, LM Studio status/model resolution, visible reply salvage, transports, tool-loop orchestration, direct intents, direct tool assist, concrete tool implementations, hybrid memory helpers, runtime artifacts, QA trace/trust helpers, and the research continuity ledger.
- `scripts/`
QA, eval, browser-smoke, review-bundle, and LM Studio helper scripts.
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
npm run qa:memory:smoke
npm run qa:memory
npm run qa:memory:judged
npm run qa:voice:tiebreak
npm run qa:browser:smoke
npm run qa:next-cycle
npm run eval:probes
npm run eval:epistemic-compare
npm run eval:epistemic-compare:synthesis
npm run eval:ledger-compare
npm run eval:runtime-fit
npm run qa:voice-redo
npm run eval:models
npm run ingest:conversations
npm run preset:lmstudio
npm run bundle:review
```

Practical notes:

- `npm run qa:browser:smoke` checks the real streaming browser path against a disposable current-code server and mock LM Studio.
- `npm run eval:runtime-fit` measures latency/context/semantic-readiness tradeoffs instead of only correctness.
- `npm run bundle:review` builds a filtered copy under `tmp/review-bundle/` for outside review.

## Memory model

Penny stores two different kinds of continuity:

- Browser-side vessel/settings state in `localStorage`
This is lightweight UI continuity like voice toggle, selected brain mode, and other client-side preferences.
- Durable server-side memory in `data/penny-memory.json`
This is the actual runtime memory store used for prompt relevance and longer continuity. The repo tracks `data/penny-memory.seed.json`; the live `data/penny-memory.json` is created on first run and stays local.

Penny's runtime memory is now hybrid:

- Canonical explicit memory in `data/penny-memory.json`
  This stays the source of truth for direct facts, preferences, user name, brain mode, and other explicit state.
- Archive memory in `data/penny-memory-archive.json`
  This stores raw episodic turns, rolling summaries, longer-term patterns, utility-scored archive candidates, the review queue for candidate promotions, and a bounded per-session `recentAuditTrail` for compact "what Penny actually used on this turn" slices.
- Embedding cache in `data/penny-memory-embeddings.json`
  This supports semantic recall when a local embedding model is available, and can optionally record bounded post-turn background-vectorization telemetry, including eager-vs-background counts.
- Research continuity ledger in `data/penny-memory-ledger.json`
  This stores bounded advisory topics, evidence refs, open follow-ups, source session/turn identity, additive topic identity metadata (`kind`, `anchorType`, `anchorRef`, `scopeKey`, `scopeLabel`), and ledger truth metadata (`sourceClass`, `summaryClass`, `summaryEvidenceRefs`) so Penny can keep multiple distinct questions about the same file or repo area separate without overstating what has actually been verified.
- Prompt-truth receipts in runtime artifacts
  These record what advisory context was selected, what was actually rendered into the prompt, what was held back canon-first, and which post-turn ledger changes happened after the reply instead of before it.
- Bounded reasoning-policy receipts in runtime artifacts
  Penny now records whether a turn was `minimal`, `deliberate`, `verifier-first`, or `attachment-bounded`, whether verifier-style evidence actually drove the turn, and whether the runtime short-circuited early. This is a policy/execution receipt, not exposed chain-of-thought.
- Artifact prose derived from prompt truth
  Human-facing artifact summaries and wake-hierarchy notes now derive from rendered `promptTruth` counts and holdback reasons, so "held back" and "not rendered" stay honest instead of implying advisory support Penny did not actually use.

For memory QA, use `npm run qa:memory:smoke` for the fast regression slice, `npm run qa:memory` for the full combined release-style run, and `npm run qa:memory:judged` for the grouped `write / retrieve / forget` trust pass. On the current Q6 setup the full combined run is expected to take roughly 80-90 minutes end to end.
For automated QA, the standard baseline is Q6 chat/memory plus `google/gemma-4-e4b` tooling. Do not treat a Q8-class chat model or a dual-lane stress setup as the default unless that is the specific thing under test.
The QA/eval artifacts now also carry a normalized trust summary (`pass`, `invalid`, `ambiguous`, `fallback`, `degraded`) so outside review can distinguish Penny-behavior failures from environment drift.
They also carry a compact `runIdentity` canary with the resolved models, loaded-model snapshot, execution-path facts, runtime-artifact version, semantic-readiness state, and fallback/degraded counters so harness drift is easier to spot before blaming Penny.
They now also carry additive drift/fixation canaries such as first drift reason/turn, fixation repeat count, and whether the run recovered after drift. These are diagnostic facts derived from artifacts, not a thinking-quality score.

For handoffs and outside review, use `npm run bundle:review` to build a filtered copy under `tmp/review-bundle/` without QA artifacts, local logs, or runtime debris.

The browser cache is not the source of truth for long-term memory.

## LM Studio notes

- Penny resolves the actually loaded LM Studio model instead of blindly trusting the configured pretty model id.
- Chat lane and tool lane have separate preferred models:
  - `PENNY_LMSTUDIO_CHAT_MODEL` defaults to `google/gemma-4-31b`
  - `PENNY_LMSTUDIO_TOOL_MODEL` defaults to `google/gemma-4-e4b`
- Semantic memory uses a separate soft-dependency model:
- `PENNY_LMSTUDIO_EMBED_MODEL` defaults to `text-embedding-nomic-embed-text-v1.5`
  - if that model is missing or unloaded, Penny falls back to keyword-style archive retrieval instead of failing chat
- `PENNY_ENABLE_BACKGROUND_CHAT_VECTORS` defaults to on for bounded post-turn background vectorization of recent chat-history candidates. Set it to `0` to turn that shadow prewarm work off.
- `PENNY_BACKGROUND_CHAT_VECTOR_BATCH_LIMIT` defaults to `2` and caps that background vector work per archived turn.
- `npm run lmstudio:prepare` verifies local preset wiring, checks installed/loaded models, and tries to load the requested chat model for QA/startup flows.
- The settings-panel model picker is now a chat-lane override only. Tool-lane selection is config-driven.
- The local `@local:penny` preset is operator-owned LM Studio state. Penny can verify and reassert the wiring, but the repo does not own the preset body.
- Depending on the loaded model, Penny may use native stateful chat, chat completions, or responses-style fallbacks.
- LM Studio `Context Length` still matters even though Penny chats through this app instead of the LM Studio UI. Penny still sends her prompt stack, recent conversation, and memory context into the loaded LM Studio runtime each turn, and the native stateful lane can preserve a live LM Studio thread across turns.
- Practical default on this machine is roughly `10k-12k` context for normal Penny use. Raising it helps with longer pasted inputs, longer live threads, and heavier prompt injection, but it also increases prompt-eval latency and memory pressure.
- `PENNY_CHAT_HISTORY_LIMIT` counts individual recent messages, not user/assistant pairs. The main chat path now defaults to `6`, while the shadow path keeps its own tighter handling.
- In Penny's UI, `New chat` creates a fresh Penny session and a fresh LM Studio thread context. `Clear memory` is the stronger reset if you also want to wipe the current session's saved memory state.
- Large local models can be slow, especially on first turn and on image turns.
- The max output token cap is a ceiling, not a target. Raising it prevents clipping; it does not force Penny to ramble if the model naturally stops earlier.
- An in-app local embedding path was considered and intentionally deferred. This cycle uses LM Studio embeddings only, with graceful fallback when they are unavailable.

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
