# Penny Next Cycle - 2026-04-16

## Goal and success criteria

- Goal:
  - implement the runtime-truth, acting-balance, and release-hygiene cycle anchored by the master synthesis doc
- User-facing or engineering success criteria:
  - OFF-vs-ON compare artifacts clearly distinguish valid wins, valid failures, invalid environments, and aborted runs
  - Penny improves premise resistance, uncertainty handling, and degraded-memory honesty without flattening her voice
  - acting/expression behavior becomes sharper without reopening anatomy work or changing the backend mood contract
  - repo hygiene leaves one clear master research entrypoint and keeps generated debris out of the staged release set
- What will be considered done:
  - code/tests/docs land
  - focused local verification passes
  - agreed files are staged, committed in two commits, and pushed

## Decisions already locked

- OFF means `PENNY_ENABLE_EPISTEMIC_CAUTION=0` plus `PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS=0`
- ON means both flags are `1`
- OFF-vs-ON is a release gate, not the first coding blocker
- short-context Q6 baseline stays the working default for focused QA and compare runs
- Penny stays companion-first with the existing chat/tool lane split intact
- repo hygiene is conservative archive/clarify work, not mass deletion

## Blind spots / what are we not considering?

- LM Studio load drift can still poison compare or QA conclusions even after harness hardening
- a valid compare may remain inconclusive; default-off must still be acceptable
- acting polish can regress browser behavior if it leaks into broad app-shell surgery
- unrelated dirty-tree changes must not be swept into the release

## Delegation map

- Read-only exploration tasks and assigned subagents:
  - compare harness readout
  - expression runtime readout
  - doc-hygiene mapping
- QA inspection tasks and assigned subagents:
  - none beyond read-only artifact interpretation
- Doc mapping tasks and assigned subagents:
  - source-doc consolidation and rename/reference impact mapping
- Single primary editor per file boundary:
  - main thread owns all edits

## Working rules

- use subagents only for independent read-only exploration
- keep one primary editing thread for all write paths
- do not overlap heavy LM Studio QA harnesses
- do not stage unrelated workspace files or parent memory/ritual docs

## Evidence to gather

- Files to read:
  - `scripts/eval-penny-epistemic-compare.js`
  - `lib/penny-qa-validity.js`
  - `lib/penny-epistemics.js`
  - `public/js/penny-expression-runtime.mjs`
  - related route/runtime/expression/doc tests and docs
- Commands to run:
  - targeted `node --test ...`
  - `npm test`
  - focused QA/eval commands one at a time
- Ownership boundaries to confirm:
  - compare harness remains internal-only
  - mood contract stays unchanged
  - master synthesis becomes canonical doc entrypoint
- Known risks:
  - invalid compare environments
  - UI polish drift
  - staging unrelated dirty-tree files

## Proposed change set

- Compare harness and tests:
  - add per-mode validity, flag manifests, mode-labeled summaries, and optional secondary diagnostics
- Runtime truth:
  - tighten experimental epistemic/synthesis behavior and reporting around weak evidence and false premises
- Acting/runtime:
  - sharpen expression/runtime transitions and intensity with bounded changes
- Docs/hygiene:
  - add canonical pointers, rename the document-ingestion note, update references, and clean generated debris before sign-off

## Verification plan

- Automated checks:
  - targeted compare/runtime/expression tests
  - `npm test`
- Manual checks:
  - inspect compare artifact and per-mode logs
  - browser smoke against a fresh server
- What should stay unchanged:
  - public routes
  - five-mood backend contract
  - experiments default-off unless a clean compare proves otherwise
- What would count as out-of-scope drift:
  - anatomy redesign work
  - new memory layers
  - broad repo cleanup beyond agreed docs/artifacts

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  - new compare outputs
  - focused QA/eval artifacts
  - disposable server logs
- What should be persisted:
  - the final clean compare artifact used for the decision
  - the canonical plan and master synthesis docs
- What should be cleaned up before sign-off:
  - stale compare/server logs not needed for the release
  - `tmp/review-bundle/`
  - `.lyra-server.pid`
  - `.lyra-server.meta.json`
  - disposable QA memory/archive/embedding files

## Out-of-scope list

- broad model-family exploration beyond the current compare/eval needs
- full UI redesign or anatomy pass
- lane collapse or shadow-first rewrite

## Notes

- If OFF-vs-ON remains mixed but valid, ship with experiments default-off and document the outcome plainly.
- Final clean compare on 2026-04-16: [output/epistemic-compare-2026-04-16T17-20-25-054Z.json](../../output/epistemic-compare-2026-04-16T17-20-25-054Z.json)
- Final compare verdict: `off` won cleanly over `on` (`off = 2`, `on = 0.5`) on a valid environment with one chat model, one tool model, and one embed model loaded.
- Product decision for this branch: keep `PENNY_ENABLE_EPISTEMIC_CAUTION` and `PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS` default-off. The current combined mode is not release-better than the baseline.
- Harness note: the compare harness now treats duplicate LM Studio loads as an invalid environment and no longer preloads the embed model by default, which removed the earlier duplicate-embed poisoning path.
- Use two commits:
  - runtime/QA/acting
  - docs/hygiene
