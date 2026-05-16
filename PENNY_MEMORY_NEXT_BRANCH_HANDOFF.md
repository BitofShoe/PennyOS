# Penny Current Branch Handoff

> Category: Branch handoff
> Authority: Deprecated/superseded
> Status: Superseded
> Use this for: branch-era history and older memory-work context.
> Do not use this for: the current first stop. Prefer [docs/penny-progress-handoff-2026-04-17.md](./docs/penny-progress-handoff-2026-04-17.md), [docs/README.md](./docs/README.md), and the current runtime docs first.

This is the shortest honest handoff for the current Penny branch state as of April 15, 2026.

Use this file when you need to know what landed recently, what is stable, what still needs follow-up, and what rules the next agent should not rediscover the hard way.

## What Landed

### 1. Penny-native memory and prompt work

These pieces are now in the repo and wired into the live app:

- prompt-slot assembly via [lib/penny-prompt-stack.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-prompt-stack.js)
- lane-aware overlays via [penny-voice/runtime/penny-overlays.json](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/penny-voice/runtime/penny-overlays.json)
- scoped memory books via [lib/penny-memory-books.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-books.js)
- archive session chapters and compression fallback via [lib/penny-memory-archive.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-archive.js)
- expression-pack manifest runtime via [public/sprites/packs/default/manifest.json](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/sprites/packs/default/manifest.json) and [public/js/penny-expression-runtime.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-expression-runtime.mjs)
- inspector visibility for matched books, compression, and retrieval provenance

Important trust boundary:

- explicit memory in `data/penny-memory.json` remains canonical
- archive, books, and chapters are additive and inspectable
- promotion into stronger explicit memory is still review-gated

### 2. Contradiction and drift hardening

The repo now has bounded correction provenance and tighter QA hooks for long-session truth drift.

What that means in practice:

- deterministic correction-style provenance is tracked in the archive layer
- last-retrieval metadata can show bounded provenance details
- chapter compression got a fact-first bias instead of pure scene scaffolding
- prompt slots and lane rules are stricter about what can influence chat, tool, and semantic-render turns

### 3. Boring engineering sprint

The recent cleanup pass was intentionally about structure, not new capability.

The main extractions that matter:

- backend route/runtime ownership:
  - [lib/penny-route-handlers.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-route-handlers.js)
  - [lib/penny-server-http.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-server-http.js)
  - [lib/penny-prompt-assets.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-prompt-assets.js)
  - [lib/penny-chat-runtime.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-chat-runtime.js)
- browser ownership:
  - [public/js/penny-expression-runtime.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-expression-runtime.mjs)
  - [public/js/penny-transcript-ui.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-transcript-ui.mjs)
  - [public/js/penny-memory-panel.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-memory-panel.mjs)

The follow-up cleanup pass also removed the dead duplicated wrapper bodies from [public/js/penny-app.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-app.js), so the browser shell is now much closer to a real orchestrator.

## Current Architecture Truths

- Penny is still a single-user, local, LM Studio-backed companion.
- `server.js` should be treated as a thin orchestration shell now, not as the default home for new subsystem logic.
- `public/js/penny-app.js` should be treated as a browser coordination shell now, not as the default home for new UI slices.
- Route shape is intentionally stable. Internal cleanup should prefer extracted owners over public API changes.
- The frontend and backend ownership maps are now documented in:
  - [server-js-section-map.md](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server-js-section-map.md)
  - [frontend-section-map.md](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/frontend-section-map.md)

## Testing Rules That Must Carry Forward

### 1. Do not hit the user's live LM Studio model for route regressions

This is no longer hypothetical. It has already been proven in-project.

The route regression suite now uses a mock LM Studio server in:

- [test/penny-routes.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-routes.test.js)

Rule going forward:

- route/regression verification should use an isolated mock or a dedicated temporary LM Studio server
- do not pound the user's live loaded model just to verify routes or serialization

### 2. Heavy LM Studio QA should run one harness at a time

This remains an operational rule:

- do not overlap voice QA, memory QA, and probe/eval runs
- the local model setup is easy to overload, and overlapping runs create misleading failures

### 3. QA artifacts must clean up after themselves

Disposable QA runs should continue to isolate and then delete:

- explicit memory files
- archive memory files
- embedding files

This is already reinforced in the QA docs and should stay true.

## Current Test State

Most recent stable local verification after the cleanup pass:

- `npm test`
- result: `108 passing, 0 failing, 3 todo`

The remaining TODOs are explicit placeholder tests in:

- [test/penny-native-upgrades.todo.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-native-upgrades.todo.test.js)

They are reminders for:

- memory books bounded prompt behavior
- chapter compression fallback gating
- prompt-slot separation between overlays and verified facts

These are not failing tests.

## QA Notes That Matter

### Repetition audit

The voice QA harness now has a repetition audit in:

- [scripts/qa-penny-voice-redo.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/qa-penny-voice-redo.js)

Important current default:

- `disaster` is in the watchlist by default

That means the "Penny keeps calling people a disaster" issue is now supposed to be measured during voice QA rather than handled as a vague vibe complaint.

### Compression fallback

Compression fallback is working, but it is still the weakest memory path.

Current follow-up note:

- tighten compression fallback later so it prioritizes concrete nouns and scene facts more consistently and does not over-index on repeated scaffolding language

This is a real follow-up item, not a blocker.

### LM Studio setting preference

Operational preference from the user:

- LM Studio `Context Overflow = Rolling Window`

The app does not enforce that setting programmatically, but it is the preferred testing/runtime setting for this project right now.

## Most Important Files Right Now

Memory and provenance:

- [lib/penny-memory.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory.js)
- [lib/penny-memory-state.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-state.js)
- [lib/penny-memory-archive.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-archive.js)
- [lib/penny-memory-books.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-books.js)

Prompt and lane assembly:

- [lib/penny-prompt-stack.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-prompt-stack.js)
- [lib/penny-local-lanes.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-local-lanes.js)
- [lib/penny-direct-intents.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-direct-intents.js)
- [lib/penny-visible-reply.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-visible-reply.js)

Backend orchestration boundaries:

- [server.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js)
- [lib/penny-route-handlers.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-route-handlers.js)
- [lib/penny-server-http.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-server-http.js)
- [lib/penny-chat-runtime.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-chat-runtime.js)
- [lib/penny-prompt-assets.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-prompt-assets.js)

Frontend orchestration boundaries:

- [public/js/penny-app.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-app.js)
- [public/js/penny-expression-runtime.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-expression-runtime.mjs)
- [public/js/penny-transcript-ui.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-transcript-ui.mjs)
- [public/js/penny-memory-panel.mjs](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/js/penny-memory-panel.mjs)

QA and eval seams:

- [scripts/qa-penny-memory.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/qa-penny-memory.js)
- [scripts/qa-penny-voice-redo.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/qa-penny-voice-redo.js)
- [scripts/eval-penny-probes.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/eval-penny-probes.js)
- [test/penny-routes.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-routes.test.js)

## Recommended Next Steps

If the next agent wants the most leverage with the least chaos, this is the order:

1. Run the next QA round one harness at a time, with the repetition audit and cleanup rules respected.
2. Investigate whether `disaster` is still overused in fresh voice QA artifacts and adjust prompt guidance only if the metric stays noisy.
3. Tighten compression fallback so chapter summaries prefer durable concrete details over repeated framing language.
4. Only after that, start another research pass or new feature plan.

## What Not To Do

- Do not re-monolith the extracted browser or backend owners.
- Do not use the user's live LM Studio runtime for route regression verification.
- Do not overlap heavy QA runs.
- Do not treat archive/chapter/book layers as permission to silently rewrite canonical explicit memory.
