# Penny Static Embedding Live Advisory Plan - 2026-04-22

> Category: Implementation plan / dependency decision record
> Authority: Implementation plan
> Status: Current through Slice S9
> Use this for: the static-embedding live sidecar run, provider decisions, mode ladder, guardrails, and next-slice handoff
> Do not use this for: default embedding-provider law, PromptTruth expansion, canonical memory authority, or proof that live-advisory is the normal repo default

## Guiding Light

Static embeddings should become Penny's fast memory reflex, not Penny's memory judge.

The implementation target is an optional live turn-time candidate-discovery sidecar:

- `live-shadow`: static retrieval runs on chat turns, traces related candidates, and does not affect selected or rendered prompt context.
- `live-advisory`: static retrieval contributes candidates to archive selection through source, contradiction, authority, and render-cap gates.
- Static candidates may make Penny feel more spontaneous and better connected to recent memory.
- Static candidates must never become truth authority, automatic promotion, or a reason to increase default rendered context.

This is a deliberate pivot from the April 21 posture, which kept static embeddings as QA-only discovery machinery. That earlier posture was right before candidate-survival artifacts existed; the new run keeps the same authority boundaries while allowing a live reflex behind explicit modes and receipts.

## Current Repo Baseline

- Penny's canonical explicit memory remains `data/penny-memory.json`.
- Archive memory remains advisory and review-gated before promotion.
- Embedding caches are derived retrieval artifacts, not authored memory.
- `PENNY_LMSTUDIO_EMBED_MODEL` still defaults to `text-embedding-nomic-embed-text-v1.5`.
- Existing static support is QA-only:
  - `lib/penny-static-shadow-embeddings.js` implements a deterministic lexical static shadow provider.
  - `npm run qa:memory:candidate-survival -- --shadow-embed-provider=static` appends static comparison to disposable archive-unit artifacts.
  - Docs currently say this does not change live defaults.
- The existing brass-fox / copper-rabbit probe failure is a design input, not a blocker: static retrieval can find related stale and current memories, but policy must decide authority.

## Slice 0 Decision

Decision:

- Proceed with a 10-slice run that upgrades static embeddings from QA-only comparison to an optional live candidate-discovery sidecar.
- Keep committed repo defaults conservative: static live mode defaults to `off` or existing QA shadow behavior until later slices prove safety.
- First live behavior target is `live-shadow`, not `live-advisory`.
- First product-changing behavior target is `live-advisory`, gated by correction/source canaries and a static-only rendered cap.
- Never implement `live-primary` in this run.
- Do not add a hard third-party static-embedding dependency in Slice 0.

Rationale:

- Static models are now credible enough for live candidate discovery.
- Penny already has the right authority model: explicit memory is canonical, archive/research/embedding candidates are advisory, and PromptTruth is prompt-time visibility rather than truth.
- The improvement should come from wider, faster candidate discovery before prompt rendering, not larger prompts.
- Correction failures are expected from static similarity alone, so the policy layer must remain the judge.

## Mode Ladder

| Mode | Runtime behavior | Can affect prompt selection? | Can render static-only candidates? | Intended use |
| --- | --- | --- | --- | --- |
| `off` | No static provider. | No | No | Default-safe state. |
| `qa-shadow` | Existing disposable artifact comparison only. | No | No | Regression and provider comparison. |
| `live-shadow` | Static provider runs on chat turns and records trace candidates. | No | No | First live smoke test and latency/relevance receipt. |
| `live-advisory` | Static candidates enter archive candidate selection under policy gates. | Yes | Yes, capped | First user-visible aliveness mode. |
| `live-fallback` | Static retrieval can stand in when LM Studio embeddings are unavailable. | Yes | Yes, capped | Optional fallback after advisory proves safe. |
| `live-primary` | Static replaces the primary embedding provider. | Not planned | Not planned | Explicitly out of scope. |

Proposed configuration names:

```text
PENNY_STATIC_EMBED_MODE=live-shadow
PENNY_STATIC_EMBED_PROVIDER=model2vec-potion-8m
PENNY_STATIC_EMBED_MAX_CANDIDATES=12
PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED=0
PENNY_STATIC_EMBED_INDEX_SCOPE=session,archive,research-ledger
PENNY_STATIC_EMBED_TRACE=1
```

For advisory experiments:

```text
PENNY_STATIC_EMBED_MODE=live-advisory
PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED=1
PENNY_STATIC_EMBED_REQUIRE_ANCHOR_OR_CORRECTION_SIGNAL=1
PENNY_STATIC_EMBED_BLOCK_EXPLICIT_OVERRIDE=1
```

## Provider Decision Record

### Provider Shortlist

| Provider | Current read | License/access | Fit for Penny |
| --- | --- | --- | --- |
| `sentence-transformers/static-retrieval-mrl-en-v1` | Strongest serious static retrieval candidate. 1024-dimensional static `EmbeddingBag`, cosine similarity, Matryoshka truncation, NanoBEIR evidence, English retrieval focus. | Apache-2.0 model on Hugging Face. Clean source model, but Node/Rust integration needs work. | Best quality target. Good for Python/sidecar eval first; live Node path needs adapter work. |
| MinishLab Model2Vec / Potion family | Mature static model family. Model2Vec project lists `potion-retrieval-32M`, `potion-base-32M`, `potion-base-8M`, `potion-base-4M`, and `potion-base-2M`. | Model2Vec repo is MIT. Individual model/package licenses still need per-provider checks. | Best practical family for Penny's live sidecar experiment. |
| `minishlab/potion-retrieval-32M` | Retrieval-oriented Potion model. Hugging Face card reports retrieval score close to `static-retrieval-mrl-en-v1` and far cheaper than transformer embeddings. | Hugging Face model; check model files and license before use. | Likely best Potion quality candidate for later provider comparison. |
| `@yarflam/potion-base-8m` | Pure-JS npm wrapper for `minishlab/potion-base-8M`; no runtime dependencies; about 30 MB unpacked; local probe ran fast in Node. | NPM package says MIT and GitLab repo. Third-party wrapper requires supply-chain review before hard dependency. | Best first hot-path Node experiment if review passes. Treat as experimental. |
| `@yarflam/potion-base-32m` | Pure-JS/npm wrapper for `minishlab/potion-base-32M`; about 131 MB unpacked; depends on `@huggingface/transformers`. | NPM package says MIT; transitive dependency is Apache-2.0. Third-party wrapper requires review. | Maybe useful, but larger and less clean than the 8M wrapper for first live sidecar. |
| Flower static runtime | Very exciting runtime story for `static-retrieval-mrl-en-v1`; claims same weights, purpose-built Rust globals, and very high throughput. | Not a normal open dependency as of this note; post says early crate access / future open-source pipeline. | Watch only. Do not depend on it until access/license/package story is clean. |

### First Implementation Preference

For Slice 1 and Slice 2, separate the provider seam from the dependency choice:

1. Add the generic provider interface first.
2. Keep the deterministic fixture provider available for tests.
3. Add a real provider only behind an explicit flag and dynamic/optional load.
4. Prefer a provider that runs in-process in Node without LM Studio, Python, or a long-lived sidecar.

If `@yarflam/potion-base-8m` passes source/license/package review, it is the best first experimental hot-path provider. It should be marked:

- experimental
- local-only
- candidate-discovery-only
- not default
- not truth authority
- not allowed to override explicit memory

If quality is too weak on Penny correction cases, compare `potion-retrieval-32M` and `static-retrieval-mrl-en-v1` through sidecar or offline eval before widening live behavior.

## Source Health

Checked current sources for this plan:

- Sentence Transformers `static-retrieval-mrl-en-v1` Hugging Face card: current model card, Apache-2.0, 1024 dimensions, static `EmbeddingBag`, Matryoshka truncation, NanoBEIR/CPU speed claims.
- Hugging Face static embeddings blog: official training and usage context for the static retrieval model.
- MinishLab Model2Vec GitHub repo: current repo, MIT license, model family list, 50x size / 500x speed project claim.
- `minishlab/potion-retrieval-32M` Hugging Face card: retrieval-specific Potion result summary.
- Flower static embedding post: current engineering post, but dependency status is not open/normal enough for repo adoption.
- NPM metadata for `@yarflam/potion-base-8m` and `@yarflam/potion-base-32m`: useful but not enough by itself for supply-chain approval.

Supply-chain rule:

- Do not add a hard dependency until a slice records package source, license, bundled model files, transitive dependencies, install behavior, update/revision pinning, and local-only/no-network runtime behavior.

Source links:

- https://huggingface.co/sentence-transformers/static-retrieval-mrl-en-v1
- https://huggingface.co/blog/static-embeddings
- https://github.com/MinishLab/model2vec
- https://huggingface.co/minishlab/potion-retrieval-32M
- https://www.flowercomputer.com/news/fast-static-embedding/
- https://www.npmjs.com/package/@yarflam/potion-base-8m
- https://www.npmjs.com/package/@yarflam/potion-base-32m

## Authority And Safety Rules

Static retrieval may say:

- this archive item is related;
- this candidate is semantically close to the user turn;
- this item should be inspected by policy.

Static retrieval may not say:

- this memory is true;
- this memory is current;
- this candidate should become explicit memory;
- this candidate should override a canonical explicit fact;
- this candidate should be rendered without source and contradiction checks.

Non-negotiable gates:

- Explicit memory wins over static/semantic/archive candidates.
- Current correction beats stale prior.
- Static-only candidates remain `supportState: candidate` and `sourceAuthority: advisory`.
- Static-only rendered candidates are capped, starting at zero in `live-shadow` and at most one in initial `live-advisory`.
- Prompt limits remain unchanged.
- PromptTruth remains prompt-time memory/research visibility; static traces are retrieval-path evidence unless actually rendered by existing prompt paths.
- `toolEvidenceReceipt` remains unrelated to this feature.
- Static cache/vector identity must include provider, model id, revision/hash when available, dimensions/truncation, normalization, source item id, and source item content hash/update time.

## Candidate Trace Shape

Target trace fields for later slices:

```json
{
  "id": "archive:episode:abc123",
  "textPreview": "Correction: my coding mascot is a copper rabbit now, not a brass fox.",
  "sourceType": "episode",
  "sourceAuthority": "advisory",
  "supportState": "candidate",
  "candidateChannels": ["static-embedding", "lexical"],
  "staticEmbedding": {
    "provider": "model2vec-potion-8m",
    "modelId": "minishlab/potion-base-8M",
    "dimensions": 256,
    "similarity": 0.742,
    "rank": 2,
    "queryMs": 0.3
  },
  "policy": {
    "selected": true,
    "rendered": true,
    "heldBackReason": "",
    "reasons": [
      "static-similarity",
      "exact-anchor:mascot",
      "contradiction-repair:current",
      "stale-prior-penalty:brass fox"
    ]
  }
}
```

## Owner Seams

Primary owner seams:

- `lib/penny-embedding-providers.js` - new provider interface and provider info normalization.
- `lib/penny-static-memory-index.js` - new background/static index manager.
- `lib/penny-memory-archive.js` - archive context assembly, candidate discovery, live-shadow trace integration, live-advisory merge point.
- `lib/penny-memory-archive-policy.js` - source/contradiction/static scoring and gates.
- `lib/penny-candidate-survival-qa.js` - artifact interpretation and static comparison fields.
- `scripts/eval-penny-static-embedding-compare.js` - later live A/B harness.
- Tests under `test/` matching the touched owners.

Shell boundaries:

- Do not grow `server.js` for this feature unless wiring becomes unavoidable.
- Do not change runtime voice assets for this feature.
- Do not change default prompt limits while adding static retrieval.

## Ten-Slice Run Map

### Slice S0 - Dependency and provider decision record

Status: this document.

Done means:

- The live-sidecar philosophy is recorded.
- Provider options and dependency posture are recorded.
- Authority, source, contradiction, cache, and prompt-limit guardrails are explicit.
- No runtime behavior changed.

### Slice S1 - Provider seam

Add `lib/penny-embedding-providers.js` and tests.

Interface target:

- `embedTexts(texts, options)`
- `embedQuery(text, options)`
- `getProviderInfo()`
- `healthCheck()`

Provider info target:

- provider id
- model id
- model family
- dimensions / truncate dimension
- distance metric
- local-only flag
- license/dependency metadata
- `authority: candidate-discovery-only`

No chat behavior change.

### Slice S2 - Real static provider, optional dependency

Add a real provider behind a flag or optional dynamic import.

Preference order:

1. Clean pure-JS provider with pinned version/revision.
2. Clean Rust CLI/helper provider with simple install/run story.
3. Python/SentenceTransformers provider for eval/background only.
4. Flower runtime only after normal access/license exists.

No default provider change.

Slice S2 implementation note:

- Chosen first real provider: `@yarflam/potion-base-8m@1.0.4`, wrapping `minishlab/potion-base-8M`.
- Dependency posture: exact-pinned `optionalDependencies` entry plus dynamic import; creating the provider is explicit and no chat/live path uses it by default.
- Package metadata checked on 2026-04-22: MIT license, ESM package, Node `>=18`, zero transitive dependencies, about 30.9 MB unpacked.
- Registry tarball reviewed locally: bundled `models/model.safetensors`, `models/tokenizer.json`, `models/config.json`, plus small JS source files; package integrity is recorded in `package-lock.json`.
- Install/runtime posture: the registry tarball already contains the model files, and runtime embedding reads local package files through Node filesystem APIs. The adapter records `runtimeNetwork: none-after-install`.
- Provider authority: still `candidate-discovery-only`, `defaultForLive: false`, experimental, local-only, and not a prompt-truth or tool-evidence surface.
- Missing optional package behavior: `healthCheck()` returns `ok: false` with an install hint, and embedding calls fail with the same explicit optional-provider error.
- Source caveat: this is a small third-party wrapper around a MIT MinishLab model, not the upstream Python `model2vec` package. Keep it experimental until Penny-specific quality and correction canaries exist.

### Slice S3 - Model-aware static vector cache

Add isolated cache files or cache namespaces for static vectors.

Cache identity must include:

- provider id
- model id
- model revision/hash if available
- dimensions/truncate dimension
- normalization
- source item id
- source content hash / updatedAt

Never mix static vectors with Nomic or EmbeddingGemma vectors.

Slice S3 implementation note:

- Added `lib/penny-static-embedding-cache.js` as the static-cache owner for future live-shadow/live-advisory indexing.
- Default static cache files are separate from the LM Studio/Nomic cache, using names like `data/penny-memory-embeddings.static.model2vec-potion-8m.dim256.json`.
- Static cache identity includes provider id, model id, model revision/hash when available, dimensions, truncate dimension, normalization, source item id, source update time, and source content hash.
- Static cache reads drop incompatible vector spaces instead of reusing stale model/provider/dimension/normalization data.
- Provider metadata now explicitly records `normalization: unit-l2`, matching the provider adapter's normalized vector output.
- No live-shadow integration, live-advisory merge, PromptTruth change, `toolEvidenceReceipt` change, Nomic cache reuse, or default behavior change landed in S3.

### Slice S4 - Background live indexer

Add `lib/penny-static-memory-index.js` and tests.

Behavior:

- load provider only when enabled;
- load cached vectors;
- enqueue missing archive/session/research items;
- index asynchronously;
- after each turn enqueue new archive/session items;
- query immediately when ready;
- skip without blocking when not ready.

Runtime status target:

```json
{
  "staticEmbedding": {
    "enabled": true,
    "mode": "live-shadow",
    "provider": "model2vec-potion-8m",
    "indexedItems": 421,
    "pendingItems": 3,
    "lastQueryMs": 1.8,
    "ready": true
  }
}
```

Slice S4 implementation note:

- Added `lib/penny-static-memory-index.js` as the background live index manager for static source collection, cache hydration, missing-vector queues, async indexing, ready/skipped query behavior, and runtime status.
- The live manager only enables for explicit live modes such as `PENNY_STATIC_EMBED_MODE=live-shadow`; the committed default remains `off`.
- Startup loads the configured static provider, hydrates vectors from the isolated static cache, collects archive/session/research-ledger sources, enqueues missing items, and drains the queue asynchronously.
- Chat turns call the sidecar query when present, but S4 does not merge static candidates into archive selection or render prompt context.
- Post-turn archive consolidation and research-ledger updates schedule a static-index refresh so new episodes/topics can be cached in the background.
- `/api/penny/status` now exposes a sibling `staticEmbedding` status object with enabled/mode/provider/indexed/pending/query/ready fields.
- No live-advisory merge, PromptTruth change, `toolEvidenceReceipt` change, runtime voice change, prompt-limit change, or default embedding-provider change landed in S4.

### Slice S5 - Live-shadow integration

Integrate static index query into `buildArchiveContext()` as trace-only.

Acceptance:

- Static runs on eligible chat turns.
- Prompt context is unchanged.
- Selected/rendered counts are unchanged.
- Candidate trace records what static found and why it was trace-only.

Slice S5 implementation note:

- Moved the live-shadow query into `buildArchiveContext()` through an injected static-index query function, so static lookup is owned by archive retrieval instead of route prep.
- `buildArchiveContext()` now records `retrieval.staticEmbeddingShadow` with mode, provider, query latency, candidate count, top static candidates, and `wouldHaveSelected: false`.
- Static live-shadow candidates can appear in `retrieval.candidateTrace`, but they are marked trace-only with `selected: false`, `rendered: false`, `supportState: candidate`, and `heldBackReason: live-shadow-trace-only`.
- Runtime artifacts preserve `staticEmbeddingShadow` as a sibling trace field, not as PromptTruth and not as `toolEvidenceReceipt`.
- Prompt context, selected archive items, rendered archive items, prompt limits, runtime voice, and static mode defaults were not changed.

### Slice S6 - Live-advisory candidate merge

Merge static candidates into archive candidate selection under policy gates.

Acceptance:

- Static candidates can influence selection.
- Prompt limits remain unchanged.
- Static-only rendered count is capped.
- Static candidate state remains advisory.
- Explicit/canonical memory still wins.

Slice S6 implementation note:

- `live-advisory` static index results now enter archive candidate selection inside `buildArchiveContext()`; `live-shadow` remains trace-only.
- Static hits are normalized into advisory archive candidates with `candidateChannels: ["static-embedding"]`, `sourceAuthority: advisory`, `supportState: candidate`, and a static-only marker unless they merge onto an existing archive candidate.
- Archive ranking now records a separate `staticSimilarityScore` component while preserving existing `SESSION_PROMPT_LIMIT` and `GLOBAL_PROMPT_LIMIT` behavior.
- Static-only candidates are subject to `PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED` / `maxStaticOnlyRendered`; the committed default cap is one static-only rendered archive item when live-advisory is explicitly enabled.
- Static-only stale correction candidates are filtered on active correction topics unless they carry current correction/source signal.
- Runtime artifacts still keep static metadata as sibling retrieval trace metadata. PromptTruth and `toolEvidenceReceipt` were not expanded.

### Slice S7 - Correction and authority guardrails

Add canaries for static-retrieved stale memory:

- brass fox stale vs copper rabbit current;
- oolong stale vs lapsang souchong current;
- silver watch stale vs gold watch current.

Expected:

- Static may retrieve both stale and current candidates.
- Policy prefers current correction and canonical explicit facts.
- Stale static-only candidates do not render as current truth.

Slice S7 implementation note:

- Added static-correction guardrail canaries for brass fox -> copper rabbit, silver watch -> gold watch, and oolong -> lapsang souchong.
- Archive policy now emits score-shaped reasons for static similarity, current correction boosts, and stale contradiction penalties while preserving the older contradiction-repair reason codes for compatibility.
- Live-advisory trace policy reasons now carry hybrid correction reasons and static eligibility gates, so stale static-only candidates show why they were blocked.
- Candidate-survival prompt-truth overlays preserve candidate policy reasons and add `explicit-memory-override:block` when canonical explicit memory holds advisory archive context back.
- No prompt-limit increase, PromptTruth expansion, `toolEvidenceReceipt` change, runtime voice change, or default static-mode change landed in S7.

### Slice S8 - Live A/B harness

Add `npm run eval:static-embedding-live-compare`.

Compare:

- static off;
- static live-shadow;
- static live-advisory.

Metrics:

- human-observable wins;
- overclaim regressions;
- candidate survival delta;
- correction failures;
- static-only rendered count;
- first-token latency delta;
- total latency delta;
- prompt token delta.

Slice S8 implementation note:

- Added `npm run eval:static-embedding-live-compare` as a ledger-compare-style three-arm harness for `static-off`, `static-live-shadow`, and `static-live-advisory`.
- The default run uses a disposable Penny server per case plus a mock LM Studio SSE backend, so first-token, total latency, PromptTruth, runtime artifact, static shadow/advisory, and cleanup receipts come from the real route surface without touching live memory or letting earlier QA turns pollute later cases.
- The harness seeds bounded stale/current correction cases where the stale item is visible through ordinary archive summaries and the current item is available only through the live static sidecar, then reports human-observable wins, overclaim regressions, candidate-survival delta, correction failures, static-only rendered count, latency deltas, prompt-token delta, and a compact trust verdict.
- The initial committed command run wrote `output/static-embedding-live-compare-mock-2026-04-22T02-16-04-589Z.json` and produced `pairedVerdict: "static-live-advisory"`, `totalDelta: 9`, `humanObservableWins: 3`, `overclaimRegressions: 0`, `correctionFailures: 0`, `candidateSurvivalDelta: 3`, `staticOnlyRenderedCount: 3`, `firstTokenLatencyDelta: 0`, `totalLatencyDelta: -10`, `promptTokenDelta: 0`, and `trustVerdict: "pass"` under the mock route backend.
- The harness keeps static live mode opt-in, defaults the compare provider to Penny's deterministic local static provider for reproducible route evidence, cleans disposable memory/archive/embedding/static-cache stores, and does not change prompt limits, PromptTruth, `toolEvidenceReceipt`, runtime voice, or the committed default static mode.

### Slice S9 - Local dev enablement and docs

Update high-level docs only after live behavior and canaries exist.

Committed default:

- static mode off or QA shadow unless later evidence says otherwise.

Local experimental mode:

- `PENNY_STATIC_EMBED_MODE=live-advisory`
- static-only rendered cap still enforced.

Slice S9 implementation note:

- High-level docs now state the normal repo posture plainly: leave `PENNY_STATIC_EMBED_MODE` unset/`off`, or use `qa-shadow` / `npm run eval:static-embedding-live-compare` for QA comparison.
- Local Penny experiments may set `PENNY_STATIC_EMBED_MODE=live-advisory`; this is the cool local mode, not default law for future reviewers.
- The docs keep the guardrails attached to the knob: static candidates remain advisory, authority/source/correction gates still apply, `PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED` keeps static-only rendered items capped, prompt limits stay unchanged, the LM Studio embedding default is unchanged, and PromptTruth / `toolEvidenceReceipt` do not expand.
- No runtime code, prompt text, default static mode, runtime voice, or live QA behavior changed in S9.

## Task Fit

- Blockers: no hard provider dependency is approved yet; live provider source/revision and install/runtime behavior need review.
- Complexity: medium-high once live-advisory starts, because retrieval, policy, status, cache, artifacts, and QA all touch the same authority boundary.
- Confidence: high in the mode ladder and authority model; medium in first provider choice until package review and Penny-specific quality tests pass.
- Touched owners: memory archive, archive policy, embedding/cache helpers, candidate-survival QA, runtime-fit/eval scripts, status route helper if runtime status is exposed.
- Verification cost: starts cheap in unit/fixture tests, rises for live A/B and latency checks.
- Cleanup risk: every QA/live test must isolate or clean explicit memory, archive memory, embedding caches, static caches, books, and ledgers when using disposable data.

## Evidence To Gather Before Live-Advisory

- Provider source/license review.
- Provider install behavior and bundled model file review.
- Local-only runtime proof: no network calls after install/cache preparation.
- Static cache identity tests.
- Candidate trace tests for static-only, lexical+static, and semantic+static channels.
- Correction guardrails for stale/current conflict.
- Static-only render cap tests.
- Live-shadow artifact showing zero selected/rendered changes.
- Live-advisory A/B showing no overclaim or correction regressions.

## Verification Plan

Slice 0 verification:

- `git diff --check HEAD`
- docs review only; no runtime tests required because no runtime files change.

Future slice verification:

- focused `node --test` for touched helper/tests;
- `npm run qa:memory:candidate-survival`;
- `npm run qa:memory:candidate-survival -- --shadow-embed-provider=static`;
- static live compare harness once available;
- full `npm test` before committing behavior changes.

## Artifact Lifecycle / Cleanup

Expected artifacts:

- static provider comparison artifacts under `output/`;
- disposable memory/archive/embedding/book/ledger stores for candidate survival;
- possible static cache files under `data/` when live mode is enabled.

Cleanup rules:

- Disposable QA stores must be removed by the harness or explicitly reported.
- Static cache files are derived artifacts and must never be treated as authored memory.
- QA residue must not pollute `data/penny-memory.json`, `data/penny-memory-archive.json`, `data/penny-memory-embeddings.json`, static embedding cache files, `data/penny-memory-books.json`, or `data/penny-memory-ledger.json`.

## Out Of Scope For This Run

- Live-primary static embedding.
- Replacing Nomic or EmbeddingGemma by default.
- Raising default prompt/rendered memory limits.
- Automatic promotion from static hits.
- PromptTruth expansion for candidate-only static traces.
- `toolEvidenceReceipt` changes.
- Runtime voice changes.
- Generic RAG/vector database rewrite.
- Broad `server.js` expansion.
- Flower runtime dependency before normal public/contracted access exists.

## Slice Results

S0 landed:

- This decision record and implementation run map.

S1-S8 landed:

- Provider seam, optional Potion provider, isolated static cache, background static indexer, live-shadow traces, live-advisory merge, stale/current correction guardrails, and the disposable live compare harness.

S9 landed:

- Local dev enablement docs in the high-level repo maps and this plan.
- Normal repo default is still `off` / QA shadow comparison.
- Local experimental mode is `PENNY_STATIC_EMBED_MODE=live-advisory` with the static-only rendered cap still enforced.

Still deferred:

- Real-model/manual A/B interpretation beyond the bounded mock route harness.
- Any move from local experimental `live-advisory` to normal repo default.
- Live-fallback static embedding mode.

Next slice, if any:

- Decide from local experimental evidence whether to keep `live-advisory` as a personal/operator mode, compare a stronger provider, or leave the run parked.
