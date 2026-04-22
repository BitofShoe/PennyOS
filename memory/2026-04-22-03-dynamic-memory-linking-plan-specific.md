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
