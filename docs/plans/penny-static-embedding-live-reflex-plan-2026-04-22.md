# Penny Static Embedding Live Reflex Provider Posture - 2026-04-22

> Category: Implementation plan / provider decision record
> Authority: Implementation plan
> Status: Slice S1 complete
> Use this for: the provider and dependency posture behind Tier 1 Plan 1, Slice S1
> Do not use this for: default embedding-provider law, PromptTruth expansion, canonical memory authority, or proof that live-advisory is the normal repo default

## North Star

Penny should feel alive because she notices, remembers, follows through, and times small helpful moves well - not because she treats weak evidence as certainty, bloats the prompt, or takes initiative the user did not grant.

For static memory, that means:

- static embeddings are candidate discovery only;
- explicit memory remains canonical;
- Nomic / LM Studio semantic memory remains the default embedding path;
- static hits do not auto-promote, verify truth, override corrections, or justify bigger prompts;
- any live behavior stays behind explicit modes and inspectable traces.

## Slice S1 Decision

Plan 1's first slice is a provider decision record, not a behavior change.

Decision:

- Keep the committed default static posture conservative: unset / `off`, with QA shadow comparison and local experimental live modes only.
- Treat the current in-repo deterministic static provider as approved for tests, fixtures, and reproducible compare harnesses.
- Treat the pinned Potion 8M wrapper as the first experimental Node hot-path provider, already optional and explicit.
- Treat stronger/larger providers as watch or offline-compare candidates until Penny-specific quality, correction, install, and supply-chain evidence justifies adoption.
- Do not add another dependency in this slice.
- Do not change prompt limits, runtime voice, PromptTruth, `toolEvidenceReceipt`, or canonical memory authority.

This record reconciles the newer Tier 1 plan bundle with the checked-out repo, which already has later static-sidecar work documented in [penny-static-embedding-live-advisory-plan-2026-04-22.md](./penny-static-embedding-live-advisory-plan-2026-04-22.md). Future agents should verify the live tree before assuming the Tier 1 plan's numbered slices are still unimplemented.

## Provider Status

| Provider / package | Current status | License and supply-chain posture | Penny posture |
| --- | --- | --- | --- |
| In-repo static shadow provider: `static` / `penny-static-shadow-lexical-v1` | Present in `lib/penny-static-shadow-embeddings.js` and wrapped by `lib/penny-embedding-providers.js`. | Repo-local code, no external dependency, deterministic lexical vectors. | Approved for tests, fixtures, QA shadow, and reproducible live-compare evidence. Not a quality/authority provider. |
| Fixture provider | Present in `lib/penny-embedding-providers.js`. | Repo-local test fixture, no dependency. | Test-only; useful for provider contract coverage. |
| `@yarflam/potion-base-8m@1.0.4` | Present as an exact-pinned optional dependency in `package.json`. | `npm view` on 2026-04-22 reports MIT license, Node `>=18.0.0`, zero dependencies, and about 30.9 MB unpacked. The package source points to `gitlab.com/Yarflam/potion-base-8m`. | Approved as an experimental, explicit, local-only, candidate-discovery-only provider. Not default; not truth authority. |
| MinishLab Model2Vec / Potion family | Useful upstream family for future provider comparison. | Upstream project/model cards need per-provider license and model-file review before adoption. | Good comparison family, but do not import broad package surface without a narrow reason. |
| `@yarflam/potion-base-32m` | Not adopted. Latest `npm view` on 2026-04-22 reports version `1.1.5`, MIT license, `@huggingface/transformers` dependency, Node `>=18.0.0`, and about 130.7 MB unpacked. | Larger package plus transformer dependency raises install/runtime review cost. | Watch-only unless 8M quality is inadequate and a slice explicitly justifies the larger dependency. |
| `sentence-transformers/static-retrieval-mrl-en-v1` | Strong serious static retrieval candidate for offline or sidecar eval. | Hugging Face model card currently records Apache-2.0; Node hot-path integration is not already approved here. | Likely best quality baseline for provider comparison, not a default swap. |
| Flower static runtime | Interesting runtime direction for static retrieval. | Dependency/access story is not clean enough for repo adoption from the current plan evidence. | Watch-only; do not depend on it until package, license, and access are normal. |

## Current Repo Evidence

The checked-out repo already contains static-reflex implementation seams beyond this Slice S1 decision:

- `lib/penny-embedding-providers.js` normalizes fixture, repo-local static, and experimental Potion 8M providers with `authority: candidate-discovery-only`.
- `package.json` keeps `@yarflam/potion-base-8m` in `optionalDependencies`.
- `lib/penny-static-embedding-cache.js` and `lib/penny-static-memory-index.js` keep static vectors model-aware and separate from LM Studio/Nomic embeddings.
- `lib/penny-memory-archive.js` and `lib/penny-memory-archive-policy.js` contain live-shadow / live-advisory seams and correction/source gates.
- `scripts/eval-penny-static-embedding-live-compare.js` provides a disposable compare harness for static-off, live-shadow, and live-advisory.

That evidence does not change the default law:

- normal repo posture remains static mode unset / `off`, or QA shadow comparison;
- local experiments may opt into `PENNY_STATIC_EMBED_MODE=live-advisory`;
- static candidates remain advisory;
- static-only rendered items stay capped; the checked-out live-advisory implementation documents an explicit cap of at most one static-only rendered archive item, so do not silently change that cap in this docs-only slice;
- prompt limits stay unchanged;
- PromptTruth and `toolEvidenceReceipt` do not expand.

## Acceptance

Slice S1 is complete when:

- provider options and statuses are recorded;
- license and supply-chain posture are visible enough for the next agent;
- candidate-discovery-only authority is explicit;
- Nomic / LM Studio remains the default embedding path;
- no dependency or runtime behavior was added by the slice.

## Verification

Docs-only verification:

```bash
git diff --check
```

Useful focused checks if a later agent touches provider code:

```bash
node --test test/penny-embedding-providers.test.js
node --test test/penny-static-embedding-cache.test.js test/penny-static-memory-index.test.js
node --test test/penny-memory-archive-policy.test.js test/penny-memory-archive.test.js
```

## Next Slice Guidance

Before implementing another Plan 1 slice, inspect the checked-out tree and the existing live-advisory
plan. The Tier 1 plan's newer numbering maps to the older/current static-sidecar run like this:

- Tier Plan 1 S1 maps to the provider posture in this note plus the older live-advisory S0 decision.
- Tier Plan 1 S2-S10 map to the older live-advisory S1-S9 implementation/docs run.

Current verification on 2026-04-22 found no genuinely missing Plan 1 runtime slice in the checked-out
tree. Provider seam, optional provider, isolated cache, static memory index, live-shadow trace,
live-advisory merge, correction guardrails, runtime status/trace metadata, compare harness, and
local enablement docs are already represented in code/tests/docs.

Do not duplicate provider/cache/live-shadow/live-advisory code just because the new Tier 1 bundle
describes it as future work. Future work should be evidence-led: compare a stronger provider, interpret
local experimental `live-advisory` results, make a separate live-fallback decision, or park the run.
