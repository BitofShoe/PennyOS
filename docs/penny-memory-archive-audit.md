# Penny Memory Archive Audit

This note is the first Phase 2 deliverable from the complexity hardening roadmap.

It does not argue that Penny's archive is too smart.
It argues that the archive now owns enough meaningful behavior that we need explicit policy boundaries before the subsystem becomes the new monarchy.

## Responsibilities

`lib/penny-memory-archive.js` currently owns seven distinct bands:

1. Storage and schema
- archive file creation/loading
- embeddings cache creation/loading
- store normalization and trimming

2. Archive lifecycle
- episode capture
- summary/chapter rebuilds
- open-loop refresh
- global pattern refresh

3. Retrieval and ranking
- semantic vs keyword mode selection
- per-group ranking
- sensitivity filtering
- bounded session/global retrieval

4. Compression and chapter fallback
- chapter scoring
- contradiction-aware chapter text
- compression decisions when semantic retrieval is weak or unavailable

5. Promotion and review queue
- pattern-derived promotion candidates
- review decisions
- purge scope

6. Contradiction and provenance tracking
- bounded provenance capture
- active contradiction lifecycle
- dependent episode/chapter links

7. Inspector shaping
- bounded retrieval history
- contradiction state
- compression explanation

## Policy Rules

These rules should be treated as product truth, not emergent side effects of branch order:

1. Explicit memory is canonical.
- Archive recall may support or contextualize it.
- Archive recall must not silently overwrite it.

2. Archive recall is advisory.
- It can surface continuity, patterns, and supporting details.
- It cannot promote itself into truth without review.

3. Active contradictions outrank stale archive detail for the same fact.
- New truth may reference the old truth as replaced context.
- Old truth must not resurface as current truth.

4. Compression fallback is assistive, not authoritative.
- It exists to preserve recall under retrieval pressure.
- It must not invent facts or become a hidden source of truth.

5. Promotion candidates are proposals, not memory writes.
- Queue entries can suggest durable facts or patterns.
- They never silently mutate canonical explicit memory.

6. Emergent behavior is welcome when it stays advisory.
- Pattern surfacing, soft continuity, and expressive recall are good.
- Emergent inference must not overwrite explicit truth or deterministic inspection results.

## Hidden Coupling to Watch

The heaviest internal coupling today is between:

- retrieval ranking
- compression fallback
- contradiction handling
- inspector output

Those bands share the same session/archive shape and often reuse the same prioritization assumptions.
That means a small scoring tweak can quietly change:

- what is retrieved
- when chapters are used
- which contradictions get carried forward
- what the inspector claims happened

## First Extraction Target

The first safe extraction is the retrieval/compression policy band.

Why this cluster first:

- it is mostly pure decision logic
- it has the highest leverage for simplifying the archive owner
- it is already where contradiction-aware fallback quality lives
- it can be tested without dragging file IO and store mutation into every test

What stays in the archive owner for now:

- file IO
- store normalization
- embedding persistence
- archive/session mutation
- review queue mutation

What belongs in the extracted policy band:

- scaffolding detection
- chapter detail scoring
- contradiction-aware chapter text selection
- chapter build policy
- compression decision policy
- compression explanation shaping

## Red Flags

Do not add any of these without replacing or simplifying an older rule:

- another memory layer
- another summary type
- another compression mode
- another contradiction exception path
- another retrieval threshold branch that is only justified by one QA transcript

If a new rule cannot be stated as explicit policy, it is probably swamp complexity.
