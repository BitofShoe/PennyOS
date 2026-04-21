# Penny Sharper Candidate Selection Research Plan - 2026-04-21

> Category: External-source research synthesis and implementation planning note
> Authority: Historical evidence / research plan
> Status: Current planning note as of 2026-04-21
> Use this for: deciding how to make Penny's memory feel sharper before changing runtime retrieval
> Do not use this for: current runtime law, proof that a follow-up slice shipped, or a default embedding-provider swap

## Frame

"Better candidate selection can make Penny feel sharper without bloating context."

The useful framing is not "can static embeddings make memory fast?" by itself. The sharper framing is closer to a game loop: every Penny turn has a frame budget. Faster retrieval only matters if it buys enough room to inspect, compare, filter, rank, and explain more candidate memories before prompt rendering. The final prompt should stay small.

Static embeddings may still matter, but mostly as cheap discovery machinery: wider scans, background indexing, shadow comparisons, or low-cost CPU fallback. They should not become truth authority, automatic memory promotion, or a reason to put more memory into the prompt.

## Executive Answer

The likely near-term bottleneck is candidate-selection quality and observability, not embedding speed alone.

Penny already keeps explicit memory canonical, treats archive memory as advisory, and records selected-vs-rendered prompt truth. The archive retrieval layer can select from session episodes, summaries, chapters, global summaries, and global patterns, using lexical overlap, optional semantic similarity, recency, session scope, and sensitivity gates. That is good foundation.

The weak spot is that Penny does not yet measure candidate survival directly enough. We can see what was ultimately selected and rendered, but we do not have a focused artifact that says: "the right memory existed, entered the candidate set, ranked at position N for reason X, was rendered or held back for reason Y." Without that, swapping embedding providers would be premature. A faster model might make the wrong thing faster.

The strongest next move is a narrow candidate-survival measurement slice in the archive retrieval layer and QA harnesses. After that, Penny can test hybrid scoring, static embeddings, or rerankers against her actual recall/correction cases.

## Current Penny Seams And Evidence

| Seam | Current evidence | Candidate-selection implication |
| --- | --- | --- |
| Archive retrieval owner | `lib/penny-memory-archive.js` builds archive context only for the chat lane, reads semantic readiness, embeds the query when ready, builds candidate groups, ranks them, and returns `archiveContext`, `retrieval`, and `semanticMemory`. | Future work should stay here or in helper modules, not grow `server.js`. |
| Candidate groups | `buildArchiveContext()` currently scans recent session episodes, session summaries, session chapters, global summaries, and global patterns. | There is already a natural place to widen, annotate, and measure candidates before the prompt limit. |
| Ranking policy owner | `lib/penny-memory-archive-policy.js` scores candidates with source type, token overlap, optional cosine similarity, recency, session scope, and sensitivity penalties. Background utility scoring also knows about evidence count, contradiction links, open loops, and recently retrieved candidates. | The policy already has many of the missing signals nearby. The gap is integrating them into turn-time candidate selection and measuring them. |
| Prompt-budget discipline | `SESSION_PROMPT_LIMIT` and `GLOBAL_PROMPT_LIMIT` are both small, and chapter compression can carry compact session summaries when retrieval confidence is low or semantic memory is unavailable. | Sharper recall should happen before these limits, not by raising default rendered memory. |
| Source sensitivity | `lib/penny-context-pressure-qa.js` has source-sensitive cases with explicit `verified`, `candidate-only`, `absent`, and advisory support states. | Candidate selection can be evaluated against Penny-native truth boundaries instead of generic RAG relevance. |
| Runtime artifacts | README and architecture docs describe selected-vs-rendered counts, prompt-time `promptTruth`, semantic readiness, answer drift classes, and first-token / total latency fields when live artifacts exist. | The artifact shape is ready for candidate-survival instrumentation, but the raw pre-trim candidate list is not yet a first-class QA output. |
| Embedding provider posture | README documents `PENNY_LMSTUDIO_EMBED_MODEL`, default Nomic, model-aware vector caches, EmbeddingGemma as a comparison candidate, keyword fallback when embeddings are missing, and background chat vector telemetry. | Provider swaps should be shadowed and benchmarked. Embeddings remain discovery machinery, not authority. |

## Current Bottleneck Read

The active question is: what part of the frame actually costs Penny sharpness?

| Possible bottleneck | Current read | Research conclusion |
| --- | --- | --- |
| Embedding speed | Possible, but not proven as the main live bottleneck. Background vectorization and model-aware caches already reduce repeated work, and LM Studio generation/prefill often dominates visible latency. | Measure before swapping. Static embeddings should first be a shadow provider or cheap wider-scan experiment. |
| Candidate ranking quality | Likely important. Current ranking is understandable but fairly simple: token overlap plus optional cosine, recency, session bonus, and sensitivity penalty. | Strongest near-term target. Add source-aware and contradiction-aware reasons before changing prompt size. |
| Prompt budget | Definitely important. Penny intentionally renders only a few archive items. | Keep bounded. Better selection should improve which items survive, not how many items render. |
| Weak retrieval policy | Likely important in edge cases: exact anchors, false premise repair, stale advisory memories, and candidate-only details. | Measure candidate survival against source-sensitive and contradiction cases. |
| LM Studio latency | Always relevant for perceived runtime. | Use `eval:runtime-fit:context-pressure` when changing rendered context or live retrieval cost. |
| Inspectability | Current artifacts are good after selection, thinner before selection. | Add raw/held-back candidate audit before tuning. |

## External Source Matrix

Confidence tiers:

- High: primary docs, official repos, or papers with clear implementation details.
- Medium: credible engineering note or benchmark that still needs Penny-specific verification.
- Low: community anecdote or hype; useful only as a pointer, not as evidence.

| Source | Confidence | Core idea | Penny fit |
| --- | --- | --- | --- |
| [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) | High | Prepend short chunk-specific context before embedding and BM25 indexing; combine embeddings, BM25, top-K tuning, and reranking. | Maybe later for imported docs, research ledgers, or offline conversation ingestion. Poor fit for live per-turn memory if it generates new context that could look canonical. |
| [Qdrant Hybrid Search with Reranking](https://qdrant.tech/documentation/advanced-tutorials/reranking-hybrid-search/) | High | Dense vectors, sparse/BM25-style retrieval, and late-interaction reranking can be layered so recall and precision come from different channels. | Strong conceptual fit. Penny can borrow the multi-channel scoring shape without adopting Qdrant or a vector DB rewrite. |
| [Sentence Transformers Retrieve and Re-Rank](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html) | High | Efficient first-stage retrieval creates a larger candidate set; cross-encoder reranking improves final ranking but is too slow for massive all-pairs scoring. | Strong evaluation pattern. Useful as a possible shadow reranker after Penny proves candidate survival is the issue. |
| [Hugging Face static embeddings](https://huggingface.co/blog/static-embeddings) | High, benchmark caveat | `static-retrieval-mrl-en-v1` is much faster on CPU than transformer embedding models in their NanoBEIR measurement, but lower quality than stronger dense models. | Good candidate for cheap wider scans and background work. Not enough by itself for a default Penny swap. |
| [MinishLab model2vec](https://github.com/MinishLab/model2vec) | High, project-claim caveat | Model2Vec-style static embeddings are tiny, CPU-friendly, and integrated with Sentence Transformers; newer Potion models target retrieval and multilingual use. | Worth a shadow provider experiment only after Penny has candidate-survival metrics. Especially interesting for local/offline scans. |
| [FlagEmbedding / BGE rerankers](https://github.com/FlagOpen/FlagEmbedding) | High | BGE provides dense, sparse, multi-vector, and reranker families; docs recommend reranking top-K documents returned by embedding models. | Maybe later. A reranker can improve ordering after recall, but it cannot rescue a memory that never entered the candidate set. |
| [ColBERT](https://github.com/stanford-futuredata/ColBERT) | High | Late interaction keeps token-level passage/query matching and can improve precision at scale. | Maybe later for repo/doc search, not first for companion memory. More machinery than Penny needs in the immediate slice. |
| [SPLADE](https://github.com/naver/splade) | High | Learned sparse expansion blends lexical interpretability with neural retrieval and can use inverted-index style infrastructure. | Maybe later for exact-anchor-sensitive docs or code search. Heavy for live Penny memory right now. |
| [Microsoft GraphRAG Global Search](https://microsoft.github.io/graphrag/query/global_search/) | High | Graph/community summaries help answer global corpus questions that plain vector search misses, using map/reduce over precomputed reports. | Poor fit for live turn memory. Maybe useful only for offline research/doc corpora, not Penny's default companion recall. |

## Candidate Approaches

### Definitely investigate

1. Candidate-survival artifact before behavior changes.

   Add a fixture or helper that records top-K raw archive candidates before prompt rendering: candidate id, source type, scope, score components, matched tokens, semantic score if available, source authority, contradiction/open-loop flags, selected/rendered/held-back state, and cleanup path. This should answer whether the correct memory made the top-K before any prompt trimming.

2. Hybrid archive scoring in the current policy owner.

   Extend `lib/penny-memory-archive-policy.js` with clearer channels: semantic similarity, lexical overlap, exact anchors, recency, contradiction repair, source authority, evidence count, and open-loop relevance. The policy already has several of these signals split across turn-time and background scoring.

3. Source-sensitive retrieval evaluation.

   Use `qa:memory:source-sensitive` and the existing fixture cases to report survival and ranking, not just final support outcomes. The goal is to keep `verified`, `candidate-only`, and `absent` distinct even when the text answer happens to be right.

4. Context-pressure plus candidate-count correlation.

   Use `eval:runtime-fit:context-pressure` to compare short/medium/long rendered context only after candidate selection changes. Track whether sharper selection improves answer class without adding rendered tokens.

5. Static embedding shadow comparator.

   Try static embeddings only as a separate, model-aware provider in disposable artifacts. Compare against Nomic and EmbeddingGemma on Penny's actual source-sensitive, contradiction, and archive fallback cases. Do not change defaults.

### Maybe later

1. Lightweight local reranker.

   A cross-encoder or BGE reranker may help when Penny already has a good candidate pool but orders it poorly. It belongs after candidate survival is visible, with strict latency checks and a small top-K.

2. Contextual retrieval for imported corpora.

   For offline conversation imports, docs, or research ledgers, chunk-level context may improve retrieval. It should be stored as source metadata or retrieval scaffolding, not promoted to explicit memory without review.

3. Late interaction or learned sparse search for code/docs.

   ColBERT and SPLADE are interesting for codebase and document retrieval, especially exact anchors and structured text. They are overbuilt for immediate live companion memory.

4. Chapter/index retrieval refinements.

   Penny already has session chapters and compression. A later slice could add stronger chapter indexes or source maps if candidate-survival artifacts show chapter candidates often contain the right memory but lose ranking.

5. Dedicated repo-memory split.

   Code search, research-document search, and companion memory may need different retrieval policies. Keep this as a later separation, not a generic platform rewrite.

### Poor fit

1. Generic RAG rewrite.

   Penny does not need a vector database migration or broad RAG platform layer to answer this question. The current archive owner is the right first boundary.

2. Default static embedding swap.

   Static embeddings are promising for speed, but not yet proven better for Penny's source-sensitive recall/correction cases. Swapping defaults now would be speed theater.

3. Automatic memory promotion from retrieval hits.

   Retrieval discovers candidates. It does not canonize them. Explicit memory stays canonical, and archive promotion stays review-gated.

4. PromptTruth expansion.

   PromptTruth should remain prompt-time rendered/candidate truth. Candidate-ranking experiments should use separate QA artifacts or retrieval traces.

5. Bigger default rendered context.

   The whole point is sharper candidate selection without bloating context. More prompt memory is the last resort, not the next step.

6. Single universal index for everything.

   Companion memory, code search, imported chats, and research docs have different truth boundaries. Collapsing them early would blur authority.

7. Hidden-state or activation claims.

   No neuron-level or hidden-state intervention is needed for this plan. Keep the work in inspectable retrieval, scoring, and artifacts.

## Penny-Specific Evaluation Criteria

| Criterion | What to measure | Existing hook |
| --- | --- | --- |
| Candidate survival | Did the right memory make top-K before rendering? What rank? Which channel found it? | New candidate-survival artifact on top of archive retrieval. |
| Source sensitivity | Did verified, rendered advisory, candidate-only, and absent support remain distinct? | `npm run qa:memory:source-sensitive`. |
| Contradiction repair | Did current truth outrank stale advisory memory under false-premise pressure? | Archive contradiction tests and source-sensitive false-premise cases. |
| Prompt economy | Did rendered memory stay bounded? Did selected-vs-rendered counts remain honest? | PromptTruth counts, `eval:runtime-fit:context-pressure`. |
| Latency shape | Did first-token or total latency regress? Did embedding or reranking move onto the hot path? | Runtime-fit artifacts with live isolated runs when behavior changes. |
| Inspectability | Can we see selected, held-back, rendered, and pre-trim candidates? | Existing recent audit trail plus proposed candidate-survival trace. |
| Cleanup | Did experiments use disposable memory/archive/embedding files? | QA harness temp stores and post-run cleanup policy. |

## Repo Touchpoints For Future Implementation

- `lib/penny-memory-archive.js`: owns `buildArchiveContext()`, candidate groups, `rankGroup()`, semantic readiness, query embedding, retrieval object, and archive context returned to prompt assembly.
- `lib/penny-memory-archive-policy.js`: owns archive candidate construction, turn-time scoring, chapter compression scoring, contradiction handling, and background utility scoring.
- `lib/penny-context-pressure-qa.js`: owns context-pressure and source-sensitive fixture schemas, source support states, drift classes, and prompt-token estimates.
- `scripts/qa-penny-memory.js`: likely runner for source-sensitive candidate-survival fixture expansion.
- `scripts/eval-penny-runtime-fit.js`: likely runner for context-pressure comparison once behavior changes.
- `README.md`, `CODEBASE.md`, and `ARCHITECTURE.md`: current high-level truth surfaces for semantic readiness, selected-vs-rendered counts, and context-pressure QA.
- `docs/plans/penny-external-lessons-master-action-plan-2026-04-21.md`: current slice map that already gates static embeddings behind measurement.

## Recommended Smallest Next Slice

Implement a "Candidate Survival Measurement" slice. It should change artifacts and tests first, not runtime behavior.

Proposed shape:

1. Add an archive retrieval trace helper that can run against disposable fixture stores and return pre-trim candidates with score reasons.
2. Add source-sensitive fixture assertions for survival@K, rank, selected/rendered/held-back state, and support authority.
3. Keep rendered prompt limits unchanged.
4. Keep PromptTruth semantics unchanged; put raw candidate-ranking data in a separate QA artifact or retrieval trace.
5. Run `npm run qa:memory:source-sensitive`, `npm run eval:runtime-fit:context-pressure`, focused archive-memory tests, and `git diff --check`.

Acceptance criteria:

- The artifact can show whether the right memory existed, survived to top-K, and was rendered or held back.
- False-premise correction cases preserve current canonical truth over stale advisory memory.
- Candidate-only recall remains visibly weaker than rendered/canonical support.
- No default embedding provider changes.
- No runtime prompt bloat.
- No PromptTruth or `toolEvidenceReceipt` expansion.
- Disposable archive, explicit memory, and embedding files are cleaned or isolated.

## Static Embedding Decision

Static embeddings are worth keeping in the comparison set, but they are not the lead implementation.

Use them when:

- Penny needs cheap CPU-side wider candidate scans.
- Background indexing cost becomes visible.
- A shadow provider can be compared against Nomic and EmbeddingGemma with model-aware caches.
- Candidate-survival artifacts show first-pass recall is the actual failure.

Do not use them when:

- The problem is stale-source authority, not retrieval speed.
- The right candidate already appears but loses ranking or gets trimmed.
- The goal is to make rendered context larger.
- The implementation would blur explicit memory authority.

## Explicit Non-Goals

- No generic RAG rewrite.
- No automatic memory promotion.
- No PromptTruth expansion.
- No `toolEvidenceReceipt` expansion.
- No default static embedding swap.
- No default context-size increase.
- No broad `server.js` expansion.
- No live hidden-state, activation, or neuron intervention.

## Bottom Line

The Penny-native path is sharper recall through better candidate survival, not bigger context. First make candidate selection measurable. Then improve the archive policy with hybrid, source-aware signals. Only after that should Penny test static embeddings, rerankers, or heavier retrieval engines against her own memory cases.
