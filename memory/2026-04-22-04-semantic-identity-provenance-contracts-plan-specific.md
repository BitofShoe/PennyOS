# 2026-04-22 - Semantic Identity + Provenance Contracts Plan-Specific Journal

- This journal was created because the main April 22 daily journal is already dense.
- Source plan read closely: `lyra-prototype/docs/plans/penny-semantic-identity-provenance-contracts-plan-2026-04-22.md`.
- Slice in this chat: S1 semantic identifier contract only.
- Core rule preserved: semantic IDs are local, opaque identifiers; they are not network fetch instructions, evidence, authority, memory promotion, PromptTruth expansion, or graph infrastructure.
- S1 target files: `lyra-prototype/lib/penny-semantic-ids.js`, `lyra-prototype/test/penny-semantic-ids.test.js`, `lyra-prototype/README.md`, `lyra-prototype/CODEBASE.md`, `lyra-prototype/ARCHITECTURE.md`, and `lyra-prototype/docs/README.md`.
- Behavior changed: Penny can mint, normalize, validate, and compare stable local semantic IDs in tests/helpers.
- Behavior not changed: no RDF/JSON-LD/SPARQL, no URL fetch, no graph DB, no runtime prompt bridge, no PromptTruth change, no `toolEvidenceReceipt` change, no memory promotion, no runtime voice change, and no `server.js` expansion.
- Adjacent docs cleanup: while updating the same current-law docs, stale dynamic-memory-linking wording was corrected to reflect the landed helper/fixture/QA/compare stack and gated `PENNY_MEMORY_LINK_SCORING=correction-v1` posture without changing runtime behavior.
- Next correct slice after S1 is S2 predicate registry, then S3 structured claim contracts. Do not jump to authority domains, candidate QA, dynamic-link integration, PromptTruth rendered-claim labels, or semantic export before those contracts exist.
- Verification before commit: `node --check lyra-prototype/lib/penny-semantic-ids.js` passed; `node --check lyra-prototype/test/penny-semantic-ids.test.js` passed; `node --test test/penny-semantic-ids.test.js` passed (`9 passing`); focused adjacency `node --test test/penny-semantic-ids.test.js test/penny-static-embedding-cache.test.js test/penny-prompttruth.test.js test/penny-memory-links.test.js test/penny-candidate-survival-qa.test.js` passed (`51 passing`); `git diff --check` passed; full `npm test` passed after final docs cleanup (`784 passing, 0 failing, 3 todo`).
