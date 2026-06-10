# Penny Docs Remaining Feature Audit Execution Ledger

> Category: Execution ledger
> Authority: Run receipt
> Status: Active
> Use this for: tracking the 2026-05-25 implementation run for `penny-docs-remaining-feature-audit-2026-05-24.md`.
> Do not use this for: proof that an unchecked slice shipped.

## Goal and success criteria

- Goal: Execute the Penny remaining-feature audit plan in recommended order, starting with P0 path safety and P0 web fetch TOCTOU hardening.
- User-facing or engineering success criteria: every P0/P1 build slice and docs-only reconciliation slice R1-R4 is implemented and verified, or explicitly blocked/deferred with concrete receipts.
- What will be considered done: focused tests and `git diff --check` pass for touched slices, final broader checks are run or labeled `not run`, generated QA artifacts are cleaned up, and this ledger records files read/edited, commands, blockers, and deferred items.

## Task fit

- Blockers: existing dirty/untracked baseline includes the four files the prompt says another agent touched; those edits must be preserved.
- Complexity: cross-cutting backend helpers, route tests, browser UI tests, QA scripts, and docs reconciliation.
- Confidence: medium; first P0 slices are narrow, later P1 slices touch more owners.
- Touched owners: `lib/`, `test/`, `public/js/`, `scripts/`, `docs/plans/`, and selected docs.
- Verification cost: mixed; unit and fixture tests are local/static, live model/browser/Tauri checks are permissioned or deferred unless explicitly needed.
- Cleanup risk: low for first P0 slices; higher for any QA that writes memory/archive/embedding artifacts, which must be cleaned before sign-off.
- Execution environment: mixed, with current work limited to `local/static`.

## Decisions already locked

- Preserve Penny as local, single-user, companion-first, and full-fat.
- Do not disturb live LM Studio, llama.cpp, loaded models, LAN state, user memory, or Tauri runtime.
- Use fixture tests, mocks, or isolated temporary servers for route/regression verification.
- Do not grow `server.js` or `public/js/penny-app.js` when an extracted owner exists.
- Do not commit, push, rewrite history, delete untracked files, or clean the workspace.
- Treat “Items That Should Not Be Built Now” in the audit as binding negative scope.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  - Path safety explorer: inspect `lib/penny-project-tools.js` and `test/penny-project-tools.test.js` for backslash/mixed-separator traversal risk.
  - Web safety explorer: inspect `lib/penny-web-url-safety.js` and `test/penny-web-url-safety.test.js` for final-peer verification seam.
- QA inspection tasks and assigned subagents: pending.
- Doc mapping tasks and assigned subagents: pending for R1-R4.
- Single primary editor per file boundary: main agent owns all edits in this run unless explicitly changed.
- Subagent closeout criteria: source URLs, local line refs, command receipts, artifacts, or advisory-only label.

## Task environment and receipts

- Environment-sensitive claims should be labeled `cloud/static`, `local/static`, `local/live`, or `not run`.
- Cloud-safe work: docs audits, fixture/unit tests that do not touch live runtime state.
- Local-only work: live Penny behavior, LM Studio readiness, LAN, VRAM-sensitive QA, user-memory cleanup, ignored local env behavior.
- Source/tool lookups used, if any: none.
- Sanitized query or data-withheld note, if source tools such as Context7 were used: not used.

### Baseline git status

Captured with `git status --short` from `/mnt/c/Users/malac/.openclaw/workspace-main` before edits:

```text
 M .env.example
 M .gitignore
 M .npmignore
 M ARCHITECTURE.md
 M CODEBASE.md
 M INSTALL.md
 M Install-Penny.ps1
 M README.md
 M docs/README.md
 M docs/penny-configuration-profiles.md
 M docs/penny-release-decisions-2026-05-18.md
 M lib/penny-lmstudio-status.js
 M lib/penny-project-tools.js
 M lib/penny-route-handlers.js
 M lib/penny-web-url-safety.js
 M package-lock.json
 M package.json
 M public/index.html
 M public/js/penny-app.js
 M public/js/penny-lmstudio-ui.js
 M public/js/penny-memory-panel.mjs
 M public/styles.css
 M server.js
 M test/penny-installer.test.js
 M test/penny-lmstudio-ui.test.js
 M test/penny-memory-panel.test.js
 M test/penny-preflight.test.js
 M test/penny-project-tools.test.js
 M test/penny-route-handlers.test.js
 M test/penny-routes.test.js
 M test/penny-web-url-safety.test.js
?? docs/penny-tauri-wrapper-options-2026-05-19.md
?? docs/plans/penny-docs-remaining-feature-audit-2026-05-24.md
?? docs/plans/penny-release-critique-goal-mode-handoff-2026-05-17.md
?? scripts/penny-tauri-cli.js
?? scripts/penny-tauri-prereq-check.js
?? scripts/penny-tauri-repair-native-cli.js
?? src-tauri/
?? start-penny-tauri.ps1
?? test/penny-tauri-wrapper.test.js
```

### Files read

- `lyra-prototype/AGENTS.md`
- `lyra-prototype/SOUL.md`
- `lyra-prototype/USER.md`
- `lyra-prototype/MEMORY.md`
- `README.md`
- `CODEBASE.md`
- `ARCHITECTURE.md`
- `docs/plans/TEMPLATE.md`
- `lyra-prototype/.codex/skills/README.md`
- `docs/plans/penny-docs-remaining-feature-audit-2026-05-24.md`
- `/mnt/c/Users/malac/.openclaw/workspace/main/obsidian-vault/Agent-Shared/pre penny plan prompt because goal mode prompts have to be 4000 charecters or less.md`

### Skills used

- `superpowers:using-superpowers`
- `superpowers:executing-plans`
- `superpowers:subagent-driven-development` as guidance, adapted to repo rule that the main thread remains primary editor.
- `superpowers:dispatching-parallel-agents`
- `superpowers:test-driven-development`
- `superpowers:verification-before-completion`
- `superpowers:using-git-worktrees` for detection only; user prompt requires working from the existing workspace root.
- `penny-qa-release`

### Commands/tests run

- `git status --short` - local/static; captured dirty baseline above.
- `git rev-parse --git-dir` - local/static; result `.git`.
- `git rev-parse --git-common-dir` - local/static; result `.git`.
- `git branch --show-current` - local/static; result `codex/penny-installable-local-companion-release`.
- `git rev-parse --show-superproject-working-tree` - local/static; no superproject output.
- `node --test test/penny-project-tools.test.js` - local/static; 8 tests passed, 0 failed.
- `git diff --check -- lib/penny-project-tools.js test/penny-project-tools.test.js` - local/static; passed with no output.
- `node --test test/penny-web-url-safety.test.js` - local/static; initially 8/8 passed for the pre-existing hook, then red-failed 2 new verified-address transport tests, then passed 12/12 after transport/server wiring.
- `node --test test/penny-routes.test.js` - local/static; passed 13/13 before transport wiring, then one unrelated archive timing failure occurred after transport wiring, isolated `--test-name-pattern "memory inspector tracks archived turns"` passed 1/1, and a final full rerun passed 13/13.
- `git diff --check -- lib/penny-web-url-safety.js test/penny-web-url-safety.test.js test/penny-routes.test.js` - local/static; passed with no output.
- `node --test test/penny-project-tools.test.js` - local/static; red-failed 3 new persistence tests before implementation, then passed 11/11 after local-store persistence.
- `rg -n "pending workspace edits are temporary|process-memory only|disappear when Penny restarts|persistence later" INSTALL.md SECURITY.md docs/penny-for-new-developers.md docs/release-checklist.md docs/penny-release-decisions-2026-05-18.md` - local/static; no stale wording matches.
- `git diff --check -- .gitignore lib/penny-project-tools.js test/penny-project-tools.test.js INSTALL.md SECURITY.md docs/penny-for-new-developers.md docs/release-checklist.md docs/penny-release-decisions-2026-05-18.md` - local/static; passed with no output.
- `node --test test/penny-route-handlers.test.js` - local/static; red-failed new memory export route test before implementation, then passed 14/14 after export route/helper.
- `node --test test/penny-memory-panel.test.js` - local/static; red-failed new export affordance assertion before implementation, then passed 17/17 after UI action.
- `git diff --check -- lib/penny-memory-export.js lib/penny-route-handlers.js public/js/penny-memory-panel.mjs public/js/penny-app.js test/penny-route-handlers.test.js test/penny-memory-panel.test.js` - local/static; passed with no output.
- `node --test test/penny-api-security.test.js` - local/static; red-failed memory export token-gating assertion, then passed 8/8 after adding the route to strong-token checks.
- `node --test test/penny-route-handlers.test.js` - local/static; passed 14/14 after export payload hardening.
- `node --test test/penny-memory-panel.test.js` - local/static; passed 17/17 after export action copy/assertions.
- `node --test test/penny-knowledge-ingestion.test.js` - local/static; red-failed 4 source-artifact tests, then passed 7/7 after source artifact contracts, ingestion propagation, dedupe, and CLI raw checksum wiring.
- `node --test test/penny-memory-archive.test.js --test-name-pattern "reviewPromotion preserves offline ingestion source observations"` - local/static; Node still evaluated the file's 46 tests and all passed.
- `node --test test/penny-candidate-survival-qa.test.js` - local/static; passed 27/27 after sensitive suppressed-answer canary and classifier support-state update.
- `node --test test/penny-memory-archive-policy.test.js` - local/static; passed 15/15 after sensitivity and compression-gate assertions.
- `node --test test/penny-semantic-claims.test.js test/penny-memory-links.test.js test/penny-memory-link-policy.test.js` - local/static; passed 32/32 after entity-collision/link canaries.
- `node --test test/penny-qa-trust.test.js` - local/static; passed 18/18 after capability-honesty and failed-tool summary canaries.
- `node --test test/penny-memory-books.test.js` - local/static; passed 3/3 after memory-book prompt insertion owner test.
- `node --test test/penny-prompt-stack.test.js` - local/static; passed 5/5 after stack/memory-block separation assertions.
- `node --test test/penny-lane-compare.test.js` - local/static; passed 3/3 after fixture-only lane compare runner and package script.
- `node --check scripts/qa-penny-lane-compare.js && node --test test/penny-lane-compare.test.js` - local/static; passed.
- `node --test test/penny-skill-pack.test.js` - local/static; passed 2/2 after OpenClaw skill-intake docs update.
- `node --test test/penny-voice-redo.test.js` - local/static; passed 22/22 after Constellation voice status overlay. `npm run qa:voice:constellation` was not run because it is local/live model QA.
- Multiple focused `git diff --check -- ...` commands for source artifacts, canaries, native-upgrade owner tests, lane compare, and docs reconciliation - local/static; all passed with no output.
- `git diff --check` - local/static; passed with exit 0. Git printed an LF-to-CRLF warning for pre-existing `Install-Penny.ps1`.
- `npm test` - local/static; passed 1027/1027 tests. Node printed the existing `MODULE_TYPELESS_PACKAGE_JSON` warning for `public/js/penny-storage.js`.
- First `npm run check` - local/static; failed at `check:public-path-leaks` because a new test fixture used `C:\Users\malac\...` as sample text.
- `npm run check:public-path-leaks` - local/static; passed after replacing that fixture path with a neutral path.
- `node --test test/penny-knowledge-ingestion.test.js` - local/static; passed 7/7 after the fixture-path cleanup.
- Final `npm run check` - local/static; passed. It ran engine, required-files, release-artifacts, frontend-privacy, public-path-leaks, `node --check server.js`, and `npm test` with 1027/1027 tests passing.
- `git status --short` and `git diff --stat` - local/static; captured final dirty-tree shape. Many dirty files predated this run and are preserved.

### Artifact paths

- `docs/plans/penny-docs-remaining-feature-audit-execution-ledger-2026-05-25.md`

### Git actions

- None.

### Checks not run and why

- `npm test`: not run yet; implementation slices have not completed.
- `npm run check`: not run yet; broad final gate is reserved for final verification if the tree is coherent enough.
- Live LM Studio, LAN, browser smoke, Tauri build: not run; the prompt forbids disturbing live runtime state without explicit permission.

## Slice status

### P0: Cross-Platform Project Path Safety

- Status: verified from pre-existing dirty baseline edits.
- Landed: baseline diff already normalized backslashes before path resolution in `lib/penny-project-tools.js` and already added root/alias backslash traversal tests in `test/penny-project-tools.test.js`.
- Verified: `node --test test/penny-project-tools.test.js` passed 8/8; `git diff --check -- lib/penny-project-tools.js test/penny-project-tools.test.js` passed.
- Deferred:
- Cleanup completed:
- Notes: TDD red step could not be freshly witnessed without reverting user/other-agent work, which is forbidden. The slice was treated as existing WIP and verified rather than reauthored. Read-only path explorer confirmed with local line refs and the same focused command receipts.

### P0: Web Fetch DNS Rebinding / Final Socket Hardening

- Status: implemented and verified.
- Landed: baseline diff already added a `verifyFinalPeer` seam, final peer metadata normalization, and private final-peer rejection in `lib/penny-web-url-safety.js`; this run added `createVerifiedAddressFetch`, tests proving it connects to the prechecked address while preserving `Host`, blocks private final socket metadata by default, allows private peers only with explicit opt-in, and wires `server.js` to use the verified-address transport for Penny web tools.
- Verified: `node --test test/penny-web-url-safety.test.js` passed 12/12; final `node --test test/penny-routes.test.js` rerun passed 13/13; `git diff --check -- lib/penny-web-url-safety.js test/penny-web-url-safety.test.js test/penny-routes.test.js` passed.
- Deferred:
- Cleanup completed:
- Notes: Read-only web explorer caught that the pre-existing hook was not sufficient production hardening because native `fetch` does not expose peer metadata and `server.js` was not wiring a verifier. The final route-suite first rerun had an unrelated archive timing failure; the isolated test and a full rerun passed.

### P1: Pending Workspace Write Persistence

- Status: implemented and verified.
- Landed: added ignored local store `data/penny-pending-workspace-writes.json`, persisted pending writes without absolute `filePath`, reloaded pending writes at API creation, pruned expired entries into the store, persisted after stage/approve/deny, preserved changed-base conflict behavior, and updated stale docs.
- Verified: `node --test test/penny-project-tools.test.js` passed 11/11; stale wording scan returned no matches; focused `git diff --check` passed.
- Deferred:
- Cleanup completed:
- Notes: TDD red state was captured with three failing persistence tests before implementation. Read-only pending-write explorer confirmed target owner lines and doc update targets.

### P1: Memory Export And Memory Surface Completion

- Status: implemented and verified.
- Landed: added `lib/penny-memory-export.js`, `GET /api/penny/memory/export`, explicit-memory-only export shape, visible `Export remembered facts` action near remembered facts, and browser download wiring. Export intentionally omits archive memory, embeddings, runtime artifacts, PromptTruth, tool receipts, and raw diagnostics.
- Verified: `node --test test/penny-route-handlers.test.js` passed 14/14; `node --test test/penny-memory-panel.test.js` passed 17/17; focused `git diff --check` passed.
- Deferred:
- Cleanup completed:
- Notes: TDD red state was captured for both route shape and UI affordance before implementation. `penny-memory-inspector` skill was used to keep explicit memory separate from archive/embedding layers.

### Remaining P1 slices

- Status: implemented and verified for required P1 build slices in this audit.
- Landed:
  - `penny-source-artifact.v1` contract, raw-file SHA-256 source artifact receipts, source artifact dedupe, chunk/review-packet provenance propagation, and CLI import checksum wiring.
  - Sensitive-memory canary coverage for suppressed weak matches plus `suppressed` support-state abstention classification.
  - Entity-collision and weak-link fixture coverage so same-label entities stay ID-distinct and related-but-weak links cannot become truth or active score changes.
  - Capability-honesty canaries for false local-file inability, not-run state, failed command success claims, and failed-tool summary partitioning.
  - Memory-book prompt insertion, chapter-compression gate, prompt-stack separation, and deletion of the native-upgrades todo-only test file.
  - Fixture-only lane compare runner, test, package script, and model-eval/runbook docs.
- Verified: focused tests listed above all passed; focused `git diff --check` commands passed.
- Deferred:
  - Live isolated lane comparison, live Constellation QA, live browser smoke, live mixed-drift QA, Tauri packaging/build checks, phone/LAN checks, and any model loading/unloading remain permissioned `local/live` work.
- Cleanup completed:
  - Tests used temporary directories and removed their own temp files. No user memory, archive, embedding, LM Studio, LAN, browser, or Tauri state was intentionally touched.
- Notes:
  - The lane compare runner is fixture-only by default and blocks live-isolated use unless explicit operator approval is represented by `--allow-live-isolated`.

### Docs-only reconciliation R1-R4

- Status: implemented and verified with local/static docs-adjacent tests.
- Landed:
  - R1: created `docs/plans/penny-release-plan-ledger-2026-05-25.md` mapping older release handoffs to landed, still-real, and deferred work.
  - R2: added a 2026-05-25 completion overlay to `docs/plans/penny-constellation-runtime-voice-patch-plan-2026-04-21.md` without claiming live Constellation QA.
  - R3: added OpenClaw skill-intake questions to `docs/plans/TEMPLATE.md` and a disposable Codex Harness retest condition to `docs/OPENCLAW_SHADOW_EVAL.md`.
  - R4: added status overlays to `docs/LOCAL_LLAMA_THREAD_FINDINGS.md` and `docs/RYS_FOLLOWUP_REVIEW.md` to mark stale missing-doc/test-lane claims while preserving the real orchestration-shell debt.
- Verified:
  - `node --test test/penny-skill-pack.test.js` passed 2/2.
  - `node --test test/penny-voice-redo.test.js` passed 22/22.
  - focused docs `git diff --check` passed.
- Deferred:
  - `npm run qa:voice:constellation` not run; it is `local/live` model QA.
- Cleanup completed:
  - No generated docs QA artifacts were created.
- Notes:
  - Status overlays were used instead of rewriting historical reviews or older handoffs.

## Out-of-scope list

- Graph DB, RDF, JSON-LD, SPARQL, triplestore, public URI dereferencing, crawler/reasoner infrastructure.
- Sidecar apps as Penny core.
- Default static live-advisory, EmbeddingGemma, global thinking, or huge context changes.
- PromptTruth expansion or ToolEvidenceReceipt merge.
- Auto-promotion of reflections, links, static hits, semantic claims, or emotional salience.
- Hosted OCR, CMS, or broad document chat without a concrete use case.
- Rich OpenClaw shadow revival without capability proof.
- Hidden-state, neuron, or chain-of-thought runtime features.

## Notes

- Existing dirty WIP is treated as user/other-agent work and must not be reverted.
- The prompt specifically notes unwanted local edits in `lib/penny-project-tools.js`, `test/penny-project-tools.test.js`, `lib/penny-web-url-safety.js`, and `test/penny-web-url-safety.test.js`; this run will work with those files carefully and only add necessary hunks.
