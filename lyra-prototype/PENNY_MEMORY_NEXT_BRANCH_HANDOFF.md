# Penny Memory Branch Handoff

This is the current handoff for the experimental branch `codex/penny-memory-next` as of April 13, 2026.

Use this file if you want the shortest honest explanation of what was built on this branch, why it was built, what worked, what was tricky, and what future agents should know before touching it.

## What This Branch Was For

The branch goal was not "make memory bigger."

It was:

- keep Penny's existing explicit fact memory stable
- add a richer archive memory that feels more human over time
- make that richer memory useful without slowing every turn to a crawl
- keep everything local-first
- avoid turning Penny into a brittle science project

The product target was a Penny who feels more continuous across weeks or months, not just better at parroting explicit remembered facts.

## Branch and Key Commits

Branch:

- `codex/penny-memory-next`

Key commits on this branch:

- `4d2d2d3` - `Add Penny hybrid memory archive`
- `6a1adb0` - `Ready Penny semantic memory and fix mojibake QA`
- `95c8af0` - `Relax Penny mood tag steering`

Those sit on top of the earlier dual-lane and LM Studio prep work from mainline:

- `d2a226e` - `Harden Penny runtime and LM Studio prep`

## Goals Established and Completed

### 1. Hybrid memory instead of replacing explicit memory

Completed.

The current design keeps explicit memory canonical in `data/penny-memory.json`, and adds a separate archive layer for richer continuity:

- `data/penny-memory-archive.json`
- `data/penny-memory-embeddings.json`

The explicit fact store was not demoted or replaced.

### 2. Post-reply archive consolidation

Completed.

Archive writes happen after successful turns rather than in the middle of the live reply path. That keeps the hot path bounded and avoids making normal chat pay the full cost of memory processing before Penny can answer.

### 3. Semantic retrieval with graceful fallback

Completed.

The archive layer can use LM Studio embeddings when available, but Penny still works if the embedding model is missing or not ready. In fallback mode, the archive retrieval drops back to keyword-style retrieval instead of breaking chat.

### 4. Review-gated promotion

Completed.

Derived patterns and summaries do not silently become canonical explicit memories. Candidate promotions go through a queue and require inspector review.

### 5. Better LM Studio readiness and cleaner QA artifacts

Completed.

This branch fixed two important practical problems:

- the embedding model naming/readiness story
- mojibake corruption in saved outputs

## The Most Important Files

Hybrid memory core:

- [lib/penny-memory-archive.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-archive.js)
- [lib/penny-memory.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory.js)
- [lib/penny-memory-state.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-memory-state.js)
- [server.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js)

LM Studio prep and readiness:

- [lib/penny-lmstudio-automation.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-lmstudio-automation.js)
- [scripts/penny-lmstudio-prepare.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/penny-lmstudio-prepare.js)
- [scripts/penny-preflight.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/penny-preflight.js)

Visible text cleanup:

- [lib/penny-visible-reply.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/lib/penny-visible-reply.js)

QA and eval harnesses:

- [scripts/qa-penny-voice-redo.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/qa-penny-voice-redo.js)
- [scripts/eval-penny-probes.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/eval-penny-probes.js)

Main test coverage:

- [test/penny-memory-archive.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-memory-archive.test.js)
- [test/penny-lmstudio-automation.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-lmstudio-automation.test.js)
- [test/penny-visible-reply.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-visible-reply.test.js)
- [test/penny-routes.test.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/test/penny-routes.test.js)

## The Memory Model, Plainly

Penny now has three different memory ideas, and they are intentionally not the same thing.

### 1. Canonical explicit memory

This is still the source of truth for direct known facts and preferences.

Examples:

- user name
- durable preference statements
- direct "remember this" facts
- client settings and stable runtime state

This lives in `data/penny-memory.json`.

This layer is deliberately conservative and controllable.

### 2. Archive memory

This is the richer continuity layer.

It stores:

- episodes
- summaries
- repeated patterns
- session-specific continuity
- a promotion queue for candidate long-term items

This layer is allowed to remember much more of normal conversation, including emotional and intimate content, but it does not automatically rewrite the canonical explicit fact store.

### 3. Embedding cache

This is not "memory" in the human-readable sense. It is support infrastructure for semantic retrieval.

It stores embedding vectors and metadata so archive retrieval can find older or less keyword-obvious context by meaning rather than exact word overlap.

## Why This Design Was Chosen

Pure explicit fact memory was too shallow.

Pure RAG/journal memory would have been too slippery and too hard to trust.

So the branch uses a hybrid design:

- explicit facts stay stable and readable
- archive memory gives Penny deeper continuity
- promotion into stronger long-term memory is review-gated
- the runtime can still fall back safely if semantic retrieval is unavailable

That balance is the core design decision of this branch.

## How Retrieval Works

Prompt memory is assembled in layers with caps.

The intended order is:

1. explicit facts first
2. session archive recalls second
3. global archive summaries and patterns third

The point is not to stuff the prompt with memory.

The point is to keep the memory block bounded while still making room for:

- direct personal facts
- recent session continuity
- older thematic continuity

The archive layer is not allowed to explode the prompt window.

## Promotion Rules

Promotion was intentionally designed to be cautious.

Important rule:

- derived archive items do not silently become explicit memory

What can happen automatically:

- archive episodes can be stored
- archive summaries can be derived
- patterns can be detected
- candidate promotions can be queued

What cannot happen automatically:

- sensitive archive content becoming canonical explicit memory
- patterns silently entering the explicit `memories[]` list

Inspector review is required for promotion.

## The LM Studio Integration Story

This was one of the trickiest parts of the work.

### Chat lane and tool lane

Penny already had lane splitting before this branch:

- chat lane on the 31B family
- tool lane on `google/gemma-4-e4b`

This branch did not change the architecture of that split.

What it did change was the semantic-memory readiness story on top of LM Studio.

### What went wrong at first

The repo was using the embedding model identifier:

- `nomic-ai/nomic-embed-text-v1.5`

But on this machine, LM Studio actually exposes the loaded embedding model under:

- `text-embedding-nomic-embed-text-v1.5`

That mismatch mattered.

It made Penny think the embedding model was absent or not ready even when LM Studio already had the model downloaded and usable.

### The actual fix

The branch now normalizes any `nomic-embed-text-v1.5` family reference to LM Studio's real identifier:

- `text-embedding-nomic-embed-text-v1.5`

That normalization happens in:

- `server.js`
- `lib/penny-lmstudio-automation.js`
- `lib/penny-memory-archive.js`
- prep/preflight/test paths

### Why `lms ps` was not enough

Another important wrinkle:

- `lms ps --json` did not reliably list the embedding model as "loaded"

So "is the embedding model active?" could not be answered just by looking at loaded-model lists.

The real fix was to probe the embedding API directly:

- POST to `/v1/embeddings`

If that returns a vector, semantic memory is truly ready.

That is now the readiness check that matters.

### Final result

`npm run lmstudio:prepare -- --json` now reports semantic memory honestly.

When the embedding model is installed and actually callable, Penny reports:

- `embedInstalled: true`
- `embedLoaded: true`
- `semanticMemoryReady: true`

If embeddings are unavailable, Penny falls back gracefully instead of pretending everything is fine.

## The Mojibake Problem

This branch also fixed a real output cleanliness issue.

Symptoms looked like:

- `â€™`
- `â€”`
- `Â `

This was not a logic bug in Penny's personality. It was text corruption at the boundary between local model output, Windows logging, and saved QA artifacts.

The practical fix was:

- centralize visible reply cleanup in `lib/penny-visible-reply.js`
- normalize common mojibake sequences into safe ASCII punctuation
- remove duplicate helper definitions that had started to drift
- clean the startup banner so logs do not keep introducing ugly Unicode noise

Result:

- fresh QA artifacts now save cleanly
- no `â€™`/`â€”` style corruption remained in the final verified branch artifacts

## QA Results That Matter

### Clean Q6 voice run before the mood-line experiment

Artifact:

- [voice-redo-qa-2026-04-14T04-38-17-131Z.json](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/output/voice-redo-qa-2026-04-14T04-38-17-131Z.json)

Summary:

- `8/8` completed
- `0` failures
- `0` bland tells
- no mojibake corruption

### Clean E4B probe run after the probe-fix cleanup

Artifact:

- [probe-eval-2026-04-14T04-50-50-395Z.json](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/output/probe-eval-2026-04-14T04-50-50-395Z.json)

Summary:

- `4/4`
- inspect route and read-only honesty were both clean

### Mood-line experiment

The line removed was:

- `Most banter should be happy, smug, or excited.`

Result:

- it did not change the mood-tag distribution
- both compared clean runs came out `smug: 5, calm: 2, annoyed: 1`

So this line was not the actual cause of smug-heavy tagging.

However, the more recent pass felt slightly better in wording, so the line-removal change was kept.

Artifact:

- [voice-redo-qa-2026-04-14T05-19-14-855Z.json](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/output/voice-redo-qa-2026-04-14T05-19-14-855Z.json)

## Important Process Lesson

Do not run heavy QA flows in parallel on the same local model setup.

This happened once during the branch work:

- a full voice QA run
- a full test run or probe flow
- both hitting LM Studio at the same time

That overloaded the machine and created misleading failures.

For this repo, with Q6 chat plus local tooling:

- run one heavy thing at a time
- especially do not overlap full voice QA with tool-probe harnesses
- probe harnesses may unload/reload models, so they can sabotage chat QA if run in parallel

This is an engineering rule now, not just a convenience note.

## What Still Needs Investigation Later

Two interesting questions remain open, but they are not blockers:

### 1. Why some later passes sounded slightly better but took longer

There is likely a real interaction between:

- prompt shape
- local load state
- lane/model resolution
- LM Studio scheduling behavior

This is worth investigating later, but it is not needed to trust the branch.

### 2. Why smug still dominates mood tags

The removed instruction line was not the root cause.

Possibilities include:

- the 31B model's natural preference under this prompt stack
- other Penny instructions weighting toward smug cadence
- the prompt mix in the voice QA suite

If this becomes important later, it should be studied directly rather than by guessing through one sentence at a time.

## Bottom-Line Verdict

This branch succeeded.

It added a real hybrid memory system, a real semantic-memory readiness story, a real embedding integration that works with LM Studio on this machine, cleaner output handling, and branch-local QA evidence that Penny still feels like Penny.

The biggest design win is that the new memory depth was added without replacing the stable explicit memory layer.

That is the reason this branch feels ambitious without becoming a fragile science project.
