# 2026-04-22 - Dynamic Memory Linking Plan-Specific Journal

- This journal was created because the main April 22 daily journal is already dense.
- Source plan read closely: `lyra-prototype/docs/plans/penny-post-tier1-bounded-aliveness-plans/03-dynamic-memory-linking-plan.md`.
- Slice in this chat: L0 docs/current-law note only.
- Core rule preserved: a memory link is a retrieval/navigation hint, not proof that either side is true.
- L0 target files: `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, `docs/README.md`, and `docs/plans/penny-dynamic-memory-linking-plan-2026-04-22.md`.
- Behavior changed: high-level docs and the docs index now route future agents to the dynamic-linking boundary before implementation.
- Behavior not changed: no runtime code, no prompt bridge, no archive ranking change, no PromptTruth expansion, no `toolEvidenceReceipt` change, no runtime voice change, no graph DB or universal memory index, and no broad project/research/open-loop link scoring.
- Next correct slice after L0 is L1 schema and pure helpers, then fixture traces and correction-link shadows. Do not jump straight to active scoring.
- Verification completed before commit: `git diff --check` passed, and staged `git diff --cached --check` passed with the new plan note and this journal included.

## Slice L1 - Memory link schema and pure helpers

- Slice L1 landed as schema/pure-helper work only.
- Added `lyra-prototype/lib/penny-memory-links.js` with `penny-memory-links.v1`, the v1 relation enum, support-state normalization, safe authority-effect normalization, link-set artifacts, summaries, item lookup, directed-link inversion, and validation receipts.
- Added `lyra-prototype/test/penny-memory-links.test.js` covering valid/invalid relations, safe authority defaults, summary counts, directed vs bidirectional lookup, artifact behavior, and static/semantic candidate-only downgrade behavior.
- Behavior changed: Penny can now represent, normalize, summarize, validate, and inspect advisory memory links in tests/fixtures.
- Behavior not changed: no runtime wiring, no archive ranking/scoring, no prompt bridge, no PromptTruth expansion, no `toolEvidenceReceipt` change, no runtime voice change, no graph DB/universal index, no memory store migration, no default feature flag, and no project-thread/open-loop/research-pattern scoring activation.
- Guardrail preserved: candidate-only/static/semantic links normalize as advisory support and cannot retain `current-truth-boost` style authority effects.
- Verification before journal update: `node --check lib/penny-memory-links.js` passed, `node --check test/penny-memory-links.test.js` passed, `node --test test/penny-memory-links.test.js` passed (`7 passing`), and `git diff --check` passed.

## Slice L2 - Deterministic correction-link builder

- Slice L2 landed as deterministic correction-link builder work only.
- Added `lyra-prototype/lib/penny-memory-link-policy.js` with `penny-correction-link-builder.v1` and `buildCorrectionLinks`.
- Added `lyra-prototype/test/penny-memory-link-policy.test.js` covering brass fox -> copper rabbit, oolong -> lapsang souchong, silver watch -> gold watch, weak candidate/static support, and incomplete correction holdback.
- Behavior changed: fixture/policy helpers can now build inspectable correction link sets with `current-correction-for`, `stale-prior-of`, and `correction-of` links plus a bounded correction trace.
- Behavior not changed: no runtime wiring, no archive ranking/scoring, no prompt bridge, no PromptTruth expansion, no `toolEvidenceReceipt` change, no runtime voice change, no graph DB/universal index, no memory store migration, no default feature flag, and no project-thread/open-loop/research-pattern scoring activation.
- Guardrails preserved: explicit correction support can encode future-gated `current-truth-boost`, `stale-current-penalty`, or `do-not-render-as-current` hints, but the artifact marks `behaviorChanged: false` and `scoringActive: false`. Candidate-only/static/semantic correction links stay advisory and cannot become verified support or current-truth boosts.
- Verification before journal update: `node --check lib/penny-memory-link-policy.js` passed, `node --check test/penny-memory-link-policy.test.js` passed, `node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js` passed (`12 passing`), and `git diff --check` passed.

## Slice L3 - Link-aware candidate trace, no scoring changes

- Slice L3 landed as optional candidate-trace metadata only.
- Added `penny-memory-link-trace.v1` via `buildMemoryLinkTraceForItem` in `lyra-prototype/lib/penny-memory-links.js`, with bounded incoming/outgoing links, camel-case `relationSummary`, authority-effect listing, and explicit advisory/no-truth/no-scoring/no-behavior-change receipts.
- Updated `lyra-prototype/lib/penny-memory-archive.js` so `buildArchiveContext` can attach correction link metadata to `retrieval.candidateTrace` only when `includeCandidateTraceLinks` is requested. The archive path derives only active correction/contradiction links for trace inspection and can also normalize supplied trace links; selection, rendering, rank, prompt context, and archive scoring are unchanged.
- Updated `lyra-prototype/lib/penny-candidate-survival-qa.js` so candidate-survival normalization preserves bounded `memoryLinks` metadata and summarizes link-trace candidate counts without treating links as answer-quality evidence.
- Behavior changed: optional candidate traces can now show advisory memory-link metadata for stale/current correction cases.
- Behavior not changed: no archive scoring/ranking change, no active link scoring gate, no runtime prompt bridge, no PromptTruth expansion, no `toolEvidenceReceipt` change, no runtime voice change, no graph DB/universal index, no memory store migration, no broad project-thread/open-loop/research-pattern scoring activation, and no candidate-only/static/semantic links upgraded to verified support.
- Guardrails preserved: derived archive correction links use advisory archive support, so their authority effects remain trace-only (`none` in the archive correction test); explicit authority effects can still be inspected only when supplied by already-normalized explicit link data.
- Verification before journal update: changed-owner `node --check` passed, test-owner `node --check` passed, `node --test test/penny-memory-links.test.js test/penny-candidate-survival-qa.test.js` passed (`28 passing`), `node --test test/penny-memory-archive.test.js` passed (`42 passing`), exact focused L3 command `node --test test/penny-memory-archive.test.js test/penny-candidate-survival-qa.test.js test/penny-memory-links.test.js` passed (`70 passing`), and `git diff --check` passed.

## Slice L4 - Link fixture/QA runner

- Slice L4 landed as a fixture-only QA runner for dynamic memory links.
- Added `lyra-prototype/scripts/qa-penny-memory-links.js` with `penny-memory-links-fixture.v1`, deterministic `--fixture` mode, `--output` / `--generated-at` support, five L4 fixture cases, link-set traces, interpretation summaries, and explicit no-runtime/no-scoring/no-truth-promotion receipts.
- Added `lyra-prototype/test/penny-memory-links-script.test.js` covering fixture shape, case order, correction-vs-broad advisory behavior, weak semantic candidate handling, writer output, and fixture-only argument parsing.
- Added `npm run qa:memory:links`, which writes ignored artifacts at `lyra-prototype/output/memory-links-fixture-<stamp>.json`.
- Fresh artifact: `lyra-prototype/output/memory-links-fixture-2026-04-22T10-55-48-232Z.json`.
- Fresh artifact summary: 5 cases passing, 7 total links, 3 correction links, 4 broad advisory links, 2 correction authority-affecting hints, 0 broad authority-affecting links, 0 candidate-only verified-support links, 0 truth-proof links, 0 canonical-memory writes, 0 PromptTruth/tool-evidence changes, and scoring inactive.
- Behavior changed: repo now has a repeatable fixture/QA command for inspecting dynamic memory links across correction-chain, same-project-thread, open-loop-about, research-pattern-for, and related-but-weak cases.
- Behavior not changed: no runtime wiring, no archive ranking/scoring activation, no prompt bridge, no PromptTruth expansion, no `toolEvidenceReceipt` change, no runtime voice change, no graph DB/universal index, no memory store migration, no active broad project-thread/open-loop/research-pattern scoring, and no candidate-only/static/semantic support promotion.
- Guardrails preserved: only the explicit correction chain carries future-gated authority hints; project-thread/open-loop/research-pattern links remain retrieval/navigation metadata with scoring inactive; weak semantic relation uses `related-but-weak` with `authorityEffect: none` and cannot become verified support.
- Verification before journal update: `node --check scripts/qa-penny-memory-links.js` passed, `node --check test/penny-memory-links-script.test.js` passed, `package.json` parsed as JSON, focused `node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js test/penny-memory-links-script.test.js` passed (`17 passing`), `npm run qa:memory:links` passed and wrote the artifact above, artifact spot-check passed, and `git diff --check` passed.

## Slice L5 - Link-aware scoring shadow

- Slice L5 landed as inactive link-aware scoring shadow only.
- Added `penny-memory-link-shadow-score.v1` in `lyra-prototype/lib/penny-memory-link-policy.js` with `scoreMemoryLinkShadowForCandidate` and `scoreMemoryLinkShadowForCandidates`.
- The shadow receipt reports `currentCorrectionBoost`, `stalePriorPenalty`, `sameProjectThreadBoost`, `openLoopRelevanceBoost`, `weakRelationPenalty`, reasons, active/shadow rank metadata, and `wouldChangeRank`, while keeping `active: false`, `behaviorChanged: false`, `truthProof: false`, and no PromptTruth/tool-evidence/canonical-memory effects.
- Updated `lyra-prototype/lib/penny-memory-archive-policy.js` so `scoreArchiveCandidateWithProfile` returns a `linkShadowScore` receipt when links are supplied, but active score, active reasons, scoring profile behavior, selection, and rendering remain unchanged.
- Behavior changed: policy/fixture code can now compute how explicit correction links and broad advisory links would help or hurt candidate ranking in shadow.
- Behavior not changed: no active archive ranking/scoring change, no live runtime wiring, no prompt bridge, no PromptTruth expansion, no `toolEvidenceReceipt` change, no runtime voice change, no graph DB/universal index, no memory store migration, no correction scoring gate activation, no broad project-thread/open-loop/research-pattern active scoring, and no candidate-only/static/semantic support promotion.
- Guardrails preserved: only explicit correction support produces current/stale authority shadows; candidate-only/static/semantic links remain non-proof; same-project/open-loop broad links are weaker advisory shadow components; weak links cannot override verified source authority.
- Verification before journal update: changed-owner `node --check` passed, focused `node --test test/penny-memory-archive-policy.test.js test/penny-memory-link-policy.test.js` passed (`21 passing`), adjacent `node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js test/penny-memory-archive-policy.test.js test/penny-memory-archive.test.js` passed (`71 passing`), `npm run qa:memory:links` passed and wrote `lyra-prototype/output/memory-links-fixture-2026-04-22T11-03-19-135Z.json`, and `git diff --check` passed.
