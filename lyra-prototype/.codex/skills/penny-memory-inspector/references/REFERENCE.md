# Penny Memory Inspector Reference

## Memory Layers

- Explicit memory: `data/penny-memory.json`
  - canonical facts, preferences, name, client/runtime state
- Archive memory: `data/penny-memory-archive.json`
  - episodes, summaries, patterns, promotion queue, session/global continuity
- Embedding cache: `data/penny-memory-embeddings.json`
  - retrieval support only, not human-readable truth

## Core Rules

- Explicit memory is canonical.
- Archive memory can store much more, including emotional or intimate content, but it is still review-gated before promotion.
- Sensitive archive content may be stored but must never auto-promote.
- Semantic retrieval is a soft enhancement. Keyword fallback is normal when embeddings are unavailable.

## What to Check First

- whether the question is about explicit facts or archive continuity
- whether the embed model was ready when the memory was created or retrieved
- whether a promotion candidate was reviewed, approved, rejected, or still queued
- whether the reported issue is actually a retrieval problem, not a storage problem

## Best Source Files

- [README.md](../../../../README.md)
- [ARCHITECTURE.md](../../../../ARCHITECTURE.md)
- [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../../../../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
- [lib/penny-memory.js](../../../../lib/penny-memory.js)
- [lib/penny-memory-state.js](../../../../lib/penny-memory-state.js)
- [lib/penny-memory-archive.js](../../../../lib/penny-memory-archive.js)
- [test/penny-memory-archive.test.js](../../../../test/penny-memory-archive.test.js)

## Common Mistakes

- treating archive summaries as canonical explicit facts
- confusing the embedding cache with the actual memory content
- forgetting that archive writes happen after successful replies
- purging the wrong layer because scope labels were not checked first
