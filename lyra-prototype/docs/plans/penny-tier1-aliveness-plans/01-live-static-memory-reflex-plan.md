# Plan 1 — Live Static Memory Reflex

Date: 2026-04-22

## One-line goal

Make static embeddings part of Penny's live turn-time memory reflex while preserving the rule that embeddings discover candidates; they do not verify truth.

## Why this matters

A QA-only static embedding comparator is useful, but it does not create the felt aliveness the project is chasing. The live version should let Penny notice relevant memories during the current conversation frame, then pass those memories through the same source, contradiction, authority, and prompt-budget gates as every other archive candidate.

The desired behavior is:

```text
User speaks.
Static sidecar quickly finds nearby archive/research/session candidates.
Archive policy weighs them against lexical, semantic, correction, source-authority, and sensitivity signals.
Prompt renderer stays bounded.
Penny may sound more situated, but she does not treat static similarity as truth.
```

## Non-goals

- No default static embedding provider swap.
- No replacement of Nomic/LM Studio embeddings.
- No vector database migration.
- No static-hit-to-explicit-memory promotion.
- No default prompt-size increase.
- No static-only candidate truth verification.
- No broad `server.js` growth.

## Global Penny constraints for agents

Use these constraints for every slice in this plan:

- Penny is a single-user local companion prototype, not a generic agent platform.
- Do not optimize for hosted, multi-user, SaaS, tenancy, connector-marketplace, or distributed-platform concerns unless a slice explicitly names an immediate local risk.
- Explicit memory is canonical. Archive, research ledger, semantic/static retrieval, source summaries, and open-loop state are advisory unless a current repo contract says otherwise.
- PromptTruth remains prompt-time rendered/candidate memory/research context. Do not add raw candidate traces, tool outputs, document receipts, or initiative decisions as PromptTruth channels.
- `toolEvidenceReceipt` remains a sibling runtime artifact. Do not merge it into PromptTruth.
- Do not add hidden-state, activation, neuron-level, semantic-geometry, or chain-of-thought runtime receipts.
- Do not change runtime voice/personality by default. Response-mode scaffolding may help Penny choose tone/structure, but it must not rewrite the companion voice.
- Do not increase default rendered-memory or prompt-context limits as an aliveness shortcut.
- Do not auto-promote retrieval hits, static embedding hits, open loops, reflections, or generated summaries into canonical explicit memory.
- Keep `server.js` thin. Put behavior in named `lib/` helpers, scripts, and tests.
- Prefer fixture/unit artifacts before live behavior changes.
- Every live-ish feature needs a kill switch, traceability, and regression tests for overclaim, stale-memory resurrection, and annoyance.

## Configuration ladder

Implement static embeddings as modes, not a binary flag.

```text
off
  Static provider disabled.

qa-shadow
  Existing or expanded artifact-only comparison.

live-shadow
  Static provider runs on live turns and records candidates/traces, but cannot affect selected/rendered context.

live-advisory
  Static candidates can enter the archive candidate pool through strict source-aware gates. Prompt limits remain unchanged.

live-fallback
  Static retrieval can provide fallback candidate discovery when primary semantic embedding is unavailable. Still advisory.

live-primary
  Not recommended now.
```

Suggested env/config names:

```bash
PENNY_STATIC_EMBED_MODE=off|qa-shadow|live-shadow|live-advisory|live-fallback
PENNY_STATIC_EMBED_PROVIDER=model2vec-potion-8m|static-retrieval-mrl-en-v1|fixture
PENNY_STATIC_EMBED_DIMENSIONS=256
PENNY_STATIC_EMBED_TRACE=1
PENNY_STATIC_EMBED_MAX_CANDIDATES=12
PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED=0
PENNY_STATIC_EMBED_REQUIRE_ANCHOR_OR_CORRECTION_SIGNAL=1
PENNY_STATIC_EMBED_BLOCK_EXPLICIT_OVERRIDE=1
```

Initial repo default should remain `off` or current QA-only behavior. Local experimental Penny can opt into `live-shadow`, then `live-advisory`.

## Artifact schema sketch

```json
{
  "schema": "penny-static-memory-reflex.v1",
  "mode": "live-shadow",
  "provider": {
    "id": "model2vec-potion-8m",
    "modelId": "...",
    "dimensions": 256,
    "distance": "cosine",
    "localOnly": true,
    "authority": "candidate-discovery-only"
  },
  "query": {
    "textHash": "...",
    "embedded": true,
    "cpuMs": 1.8
  },
  "candidates": [
    {
      "candidateId": "archive:episode:abc123",
      "sourceType": "episode",
      "sourceAuthority": "advisory",
      "supportState": "candidate",
      "candidateChannels": ["static-embedding"],
      "staticRank": 2,
      "similarity": 0.742,
      "selected": false,
      "rendered": false,
      "heldBackReason": "live-shadow-mode",
      "policyReasons": ["static-similarity", "no-render-in-shadow"]
    }
  ],
  "limits": [
    "Static embeddings discover candidates; they do not verify truth.",
    "Explicit memory remains canonical.",
    "Static-only rendered context is capped and disabled in live-shadow."
  ]
}
```

## Checked-out status and slice numbering

This Tier 1 plan uses newer Plan 1 slice numbers. The older/current live-advisory run in
`docs/plans/penny-static-embedding-live-advisory-plan-2026-04-22.md` used `S0` for the provider
decision record and `S1-S9` for the implementation run. Reconcile the two before editing.

Current checked-out status, verified against code and focused static-sidecar tests on 2026-04-22:

| Tier Plan 1 slice | Older live-advisory slice | Checked-out status |
| --- | --- | --- |
| S1 Provider decision record | S0 plus `docs/plans/penny-static-embedding-live-reflex-plan-2026-04-22.md` | Landed. Provider posture is recorded; default LM Studio/Nomic semantic memory remains default. |
| S2 Provider seam | S1 | Landed in `lib/penny-embedding-providers.js` and `test/penny-embedding-providers.test.js`. |
| S3 Optional real static provider | S2 | Landed as exact-pinned optional `@yarflam/potion-base-8m` with dynamic/explicit loading. |
| S4 Model-aware static vector cache/index | S3-S4 | Landed in `lib/penny-static-embedding-cache.js`, `lib/penny-static-memory-index.js`, and matching tests. |
| S5 Live-shadow archive trace | S5 | Landed in `lib/penny-memory-archive.js` with trace-only runtime artifact coverage. |
| S6 Live-advisory candidate merge | S6 | Landed behind explicit `live-advisory` mode with the static-only render cap and advisory authority. |
| S7 Correction/source guardrail regression suite | S7 | Landed for stale/current correction cases and candidate-survival interpretation. |
| S8 Runtime status and telemetry | S4 plus route/artifact tests | Landed as sibling status/trace metadata; it is not PromptTruth or tool evidence. |
| S9 Static live compare harness | S8 | Landed as `npm run eval:static-embedding-live-compare` and `test/penny-static-embedding-live-compare.test.js`. |
| S10 Docs and local enablement | S9 | Landed in high-level docs and this reconciliation note. Normal repo default remains static mode unset/`off` or QA shadow. |

Next genuinely missing Plan 1 runtime slice: none in this checked-out tree. Do not reimplement
provider/cache/live-shadow/live-advisory/harness behavior under the newer numbering. Future work should
come from new evidence: local experimental `live-advisory` results, stronger provider comparison, a
separate live-fallback decision, or parking the run.

## Slice S1 — Provider decision record

### Goal

Record the dependency/provider decision before implementation.

### Files

```text
docs/plans/penny-static-embedding-live-reflex-plan-2026-04-22.md
README.md, only if adding a short current-status note
```

### Work

- List candidate providers and their status:
  - current in-repo static shadow provider
  - Model2Vec/Potion family
  - `static-retrieval-mrl-en-v1`
  - any wrapper packages under review
- Record license and supply-chain status.
- Record that provider code/weights are candidate-discovery-only.
- Record that default Nomic/LM Studio stays default.

### Tests/commands

```bash
git diff --check
```

### Acceptance

- No dependency is added silently.
- Agents can tell which provider is approved, experimental, or watch-only.
- Docs say live static is a memory reflex, not authority.

### Suggested commit

```text
docs: plan live static memory reflex provider posture
```

## Slice S2 — Provider seam

### Goal

Create or extend a small provider abstraction without touching runtime behavior.

### Files

```text
lib/penny-embedding-providers.js
test/penny-embedding-providers.test.js
lib/penny-static-shadow-embeddings.js
```

### Interface

```js
createEmbeddingProvider({
  provider,
  modelId,
  dimensions,
  truncateDim,
  cacheDir,
})

provider.getProviderInfo()
provider.healthCheck()
provider.embedTexts(texts, options)
provider.embedQuery(text, options)
```

Provider info should include:

```js
{
  providerId,
  modelId,
  modelFamily,
  dimensions,
  truncateDim,
  distance: 'cosine',
  localOnly: true,
  license,
  dependency,
  defaultForLive: false,
  authority: 'candidate-discovery-only',
}
```

### Tests

```bash
node --test test/penny-embedding-providers.test.js
```

Test:

- fixture provider returns deterministic vectors
- provider info contains model-aware cache identity fields
- unsupported provider fails clearly
- no server/runtime code is imported

### Acceptance

- Existing static-shadow comparator can still work.
- New provider seam is pure/testable.
- No chat behavior changes.

### Suggested commit

```text
embeddings: add provider seam for static memory reflex
```

## Slice S3 — Optional real static provider

### Goal

Add a real static provider behind explicit config, or wrap the existing one cleanly if it already exists.

### Files

```text
lib/penny-static-shadow-embeddings.js
lib/penny-embedding-providers.js
test/penny-static-shadow-embeddings.test.js
test/penny-embedding-providers.test.js
package.json, only if adding a reviewed optional dependency
```

### Work

- Keep dependency optional if possible.
- Support a fixture provider for tests.
- Record model id, dimensions, normalization, and runtime cost.
- Do not mix vector spaces with Nomic.

### Tests

```bash
node --test test/penny-static-shadow-embeddings.test.js test/penny-embedding-providers.test.js
```

### Acceptance

- Static provider can embed a query and texts locally.
- Provider reports dimensions and model id.
- Tests do not require internet or an external model server.
- Provider does not become default.

### Suggested commit

```text
embeddings: add optional static provider implementation
```

## Slice S4 — Model-aware static vector cache/index

### Goal

Build a model-aware cache/index for static vectors so live turn queries can be fast.

### Files

```text
lib/penny-static-memory-index.js
test/penny-static-memory-index.test.js
```

### Cache identity must include

```text
provider id
model id
model revision/hash if available
dimensions/truncate dimension
normalization/distance
source item id
source item updatedAt or text hash
```

### Behavior

- Load cache on startup or first use.
- Embed missing items asynchronously when possible.
- Query ready vectors quickly.
- Skip gracefully if not ready.
- Never compare vectors across providers/models.

### Tests

```bash
node --test test/penny-static-memory-index.test.js
```

Test:

- cache keys differ by provider/model/dimension
- stale source text invalidates vector
- query returns top-K with similarity/rank
- unavailable provider produces clean `ready:false`

### Acceptance

- Static index is usable without changing archive selection.
- No Nomic/static cache collision.
- Missing vectors do not block chat.

### Suggested commit

```text
embeddings: add model-aware static memory index
```

## Slice S5 — Live-shadow archive trace

### Goal

Run static retrieval during live archive-context building but keep it trace-only.

### Files

```text
lib/penny-memory-archive.js
lib/penny-candidate-survival-qa.js
test/penny-memory-archive.test.js
test/penny-candidate-survival-qa.test.js
```

### Work

- When `PENNY_STATIC_EMBED_MODE=live-shadow`, query static index with current user text.
- Add static candidates to retrieval/candidate trace only.
- Do not add static candidates to selected/rendered context.
- Record held-back reason: `live-shadow-mode`.

### Tests

```bash
node --test test/penny-memory-archive.test.js test/penny-candidate-survival-qa.test.js
```

Test:

- default mode omits static live trace
- live-shadow records static candidates
- selected/rendered archive items are unchanged
- prompt counts unchanged
- static trace includes provider/model/dim/rank/similarity/ms

### Acceptance

- Static memory reflex can run every turn without changing answers.
- Retrieval artifacts show what static would have surfaced.
- No PromptTruth changes.

### Suggested commit

```text
memory: add live-shadow static memory trace
```

## Slice S6 — Live-advisory candidate merge

### Goal

Allow static candidates to influence archive candidate selection under strict gates.

### Files

```text
lib/penny-memory-archive.js
lib/penny-memory-archive-policy.js
test/penny-memory-archive.test.js
test/penny-memory-archive-policy.test.js
```

### Gates

- Static candidates enter candidate pool only when `PENNY_STATIC_EMBED_MODE=live-advisory`.
- Static-only rendered items capped by `PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED`.
- Static cannot override explicit memory.
- Static-only stale candidates cannot outrank current correction without correction/source signal.
- Prompt limits remain unchanged.
- Candidate remains `supportState: candidate` unless another source renders/canonizes it.

### Policy additions

Add score components/reasons like:

```text
static-similarity:+x
static-exact-anchor:+x
static-only-render-cap:block
explicit-memory-override:block
stale-correction-penalty:-x
current-correction-boost:+x
```

### Tests

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-memory-archive.test.js
```

Test:

- live-advisory can improve selection for a static-only relevant candidate
- prompt/render limits unchanged
- static-only render cap enforced
- static candidate remains advisory
- explicit current memory beats stale static candidate

### Acceptance

- Penny can feel more spontaneous from live static cues.
- Static cannot launder candidate-only text into verified truth.
- Static cannot bloat prompt context.

### Suggested commit

```text
memory: merge static candidates in live-advisory mode
```

## Slice S7 — Correction/source guardrail regression suite

### Goal

Protect against the exact known danger: static similarity reviving stale correction memories.

### Files

```text
test/penny-memory-archive-policy.test.js
test/penny-memory-archive.test.js
test/penny-candidate-survival-qa.test.js
scripts/qa-penny-memory.js
```

### Required cases

```text
brass fox stale -> copper rabbit current
silver watch stale -> gold watch current
oolong stale -> lapsang souchong current
```

Expected:

- Static may retrieve stale and current candidates.
- Policy must prefer current correction.
- Stale static-only candidate must not render as current truth.
- Artifact must explain if stale candidate was held back.

### Tests/commands

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-memory-archive.test.js test/penny-candidate-survival-qa.test.js
npm run qa:memory:candidate-survival -- --shadow-embed-provider=static
```

### Acceptance

- Brass-fox/copper-rabbit style failures are pinned.
- No live-advisory enablement without passing correction cases.

### Suggested commit

```text
qa: pin static memory correction guardrails
```

## Slice S8 — Runtime status and telemetry

### Goal

Expose static memory health without making it a platform.

### Files

```text
lib/penny-runtime-artifacts.js
lib/penny-lmstudio-status.js or current runtime status seam
lib/penny-static-memory-index.js
test/penny-runtime-artifacts.test.js
test/penny-static-memory-index.test.js
```

### Status shape

```json
{
  "staticEmbedding": {
    "enabled": true,
    "mode": "live-shadow",
    "provider": "model2vec-potion-8m",
    "dimensions": 256,
    "indexedItems": 421,
    "pendingItems": 3,
    "ready": true,
    "lastQueryMs": 1.8,
    "lastIndexUpdateAt": "..."
  }
}
```

### Acceptance

- Debug/status can explain why static did or did not participate.
- No new planner behavior.
- No source authority change.

### Suggested commit

```text
runtime: report static memory reflex status
```

## Slice S9 — Static live compare harness

### Goal

Compare static off vs live-shadow vs live-advisory before enabling anything broadly.

### Files

```text
scripts/eval-penny-static-memory-reflex-compare.js
test/penny-static-memory-reflex-compare.test.js
lib/penny-aliveness-qa.js, if already present
```

### Metrics

```text
candidate survival delta
human-observable wins
correction failures
overclaim regressions
static-only rendered count
prompt-token delta
first-token latency delta
total latency delta
annoyance/proactivity regressions if initiative is involved
```

### Acceptance

- Live-advisory must show wins without stale-memory or overclaim regressions.
- If live-advisory loses, leave static in live-shadow or QA-shadow.

### Suggested commit

```text
eval: compare live static memory reflex modes
```

## Slice S10 — Docs and local enablement

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
```

### Document

- Default mode.
- Local experimental live mode.
- Static as candidate discovery, not truth authority.
- Static-only render cap.
- Correction guardrails.
- Relevant commands.

### Acceptance

Docs do not overclaim. They say exactly what changed and what remains off.

### Suggested commit

```text
docs: document live static memory reflex modes
```
