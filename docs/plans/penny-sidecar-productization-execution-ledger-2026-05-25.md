# Penny Sidecar Productization Execution Ledger - 2026-05-25

> Category: Execution ledger
> Authority: Receipt trail for this implementation run
> Status: Complete for local/static productization
> Use this for: files read, edits, commands, verification, live checks not run, deferred work, and cleanup notes.
> Do not use this for: proof that a live sidecar service is installed or running.

## Goal and Success Criteria

- Goal: turn the existing SearXNG, Qdrant/fixture-RAG, and Speaches sidecar trial surfaces into Penny-facing local workflows.
- Success criteria: each slice has an API/UI activation path, review-only receipts, a clear failure state, focused tests, docs, and no memory/PromptTruth/default-context ingestion.
- Work order: search, then docs/RAG, then TTS/audio.

## Task Fit

- Blockers: live sidecar probes require explicit operator permission; current shell started in `lyra-prototype` while git root is the parent workspace; the worktree already has many unrelated changes.
- Complexity: cross-cutting backend route, browser UI, tests, and docs, but the sidecar trial helpers already exist.
- Confidence: medium-high for fixture/static productization; live behavior remains not run.
- Touched owners: `lib/` helper and route handlers, `public/index.html`, `public/js/`, `public/styles.css`, `test/`, `docs/`.
- Verification cost: focused `node --test` per slice, then broad safe checks.
- Cleanup risk: avoid writing artifacts unless a test/fixture explicitly needs them; no live model or sidecar lifecycle changes.
- Execution environment: local/static for implementation and tests; live sidecar checks are `not run`.

## Delegation Map

- Read-only sidecar inventory scout: spawned `019e60a6-296c-7d71-bf15-6eb5d0bb6190` with full-context fork, no edits/live probes.
- Read-only integration seams scout: spawned `019e60a6-5653-7aa2-81cc-8210695ddca7` with full-context fork, no edits/live probes.
- Read-only tests/docs scout: spawned `019e60a6-9f0d-74b0-a2dc-b0a1adb80dbe` with full-context fork, no edits/live probes.
- Single primary editor: parent agent for shared routes, UI, registry/boundaries, docs, and tests.

## Receipts

### Files Read

- `lyra-prototype/AGENTS.md` from the user prompt.
- `lyra-prototype/SOUL.md`, `lyra-prototype/USER.md`, `lyra-prototype/MEMORY.md`; their parent canonical targets were not present in this checkout.
- `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, `docs/README.md`.
- `.codex/skills/README.md`, `.codex/skills/penny-qa-release/SKILL.md`, `.codex/skills/penny-lmstudio-ops/SKILL.md`.
- `docs/penny-local-llm-apps-link-review-2026-05-10.md`, `docs/plans/penny-local-llm-sidecar-roadmap-2026-05-11.md`, `docs/sidecars/*`.
- `package.json`, `lib/penny-sidecar-trials.js`, `lib/penny-sidecar-contracts.js`, `lib/penny-route-handlers.js`, `server.js`.
- `public/index.html`, `public/js/penny-app.js`, `public/styles.css`.
- `test/penny-local-llm-sidecars.test.js`, `test/penny-route-handlers.test.js`, `test/penny-routes.test.js`, `test/penny-lmstudio-ui.test.js`, `test/penny-expression-runtime.test.js`.

### Files Edited

- `test/penny-sidecar-workflows.test.js` added for the search-slice red tests.
- `lib/penny-sidecar-workflows.js` added as the Penny-facing workflow helper over existing sidecar trial builders; extended for docs/RAG and TTS/audio.
- `lib/penny-sidecar-trials.js` extended so the optional Speaches TTS trial can receive Penny-facing preview text.
- `lib/penny-route-handlers.js` extended with sidecar API routing for search, docs/RAG, TTS/audio, and permission-required sidecar blocks.
- `server.js` wires the sidecar workflow helper into route handlers.
- `test/penny-sidecar-panel.test.js` added for the browser sidecar panel contract and extended for docs/RAG and TTS/audio.
- `public/js/penny-sidecar-panel.mjs` added as the browser rendering owner for sidecar receipts; extended for document citation/inference and audio capture/TTS review rendering.
- `public/index.html`, `public/js/penny-app.js`, and `public/styles.css` expose the Settings-side search, docs/RAG, and TTS/audio workflow activation paths and result panels.
- `docs/sidecars/penny-sidecar-productized-workflows.md` added for honest Penny-facing workflow docs and extended for docs/RAG and TTS/audio.
- `docs/sidecars/penny-local-llm-sidecars.md` now links to the productized workflow doc.
- `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and `docs/README.md` now point to the productized sidecar workflow surface without claiming live sidecars are installed or running.
- `docs/plans/penny-sidecar-productization-execution-ledger-2026-05-25.md` created.

### Commands Run

- `git rev-parse --show-toplevel` -> `/mnt/c/Users/malac/.openclaw/workspace-main`.
- `git status --short` -> many pre-existing modified/untracked files; treat as user-owned unless touched by this run.
- `rg`/`sed`/`find` static inspection commands for docs, sidecar helpers, route handlers, frontend, and tests.
- `node --test test/penny-sidecar-workflows.test.js` -> RED, failed with `Cannot find module '../lib/penny-sidecar-workflows'`.
- `node --test test/penny-sidecar-workflows.test.js` -> GREEN, 3 pass.
- `node --test test/penny-sidecar-panel.test.js` -> RED, failed because `public/js/penny-sidecar-panel.mjs` and `sidecarSearch*` controls did not exist.
- `node --test test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js` -> GREEN, 5 pass.
- `node --test test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> RED for docs/RAG, failed because helper export, route, view model behavior, and HTML controls were missing.
- `node --test test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> GREEN, 10 pass.
- `node --test test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js` -> RED for TTS/audio, failed because helper export, route, view model behavior, HTML controls, audio workflow docs, optional TTS trial injection, and subtrial permission status were incomplete.
- `node --test test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js` -> GREEN, 20 pass.
- `node --test test/penny-local-llm-sidecars.test.js test/penny-sidecar-section-completion-gate.test.js test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> GREEN, 54 pass.
- `node --test test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js test/penny-sidecar-section-completion-gate.test.js` -> GREEN, 46 pass after final TTS fixture-input cleanup.
- `node --test --test-name-pattern='search sidecar|sidecar search|settings HTML exposes search' test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> GREEN, 5 pass.
- `node --test --test-name-pattern='docs sidecar|sidecar docs|settings HTML exposes docs|productized workflow docs describe docs' test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> GREEN, 6 pass.
- `node --test --test-name-pattern='audio sidecar|sidecar audio|settings HTML exposes audio' test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> GREEN, 6 pass.
- `node --test --test-name-pattern='Penny-facing text|subtrial permission' test/penny-sidecar-workflows.test.js` -> RED, failed because `runAudioSidecarWorkflow` did not pass text to a trial runner and permission-required subtrial failures returned HTTP 200.
- `node --test --test-name-pattern='Penny-facing text|subtrial permission' test/penny-sidecar-workflows.test.js` -> GREEN, 2 pass.
- `node --test --test-name-pattern='productized workflow docs describe Speaches|Penny-facing text|subtrial permission' test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js` -> GREEN, 3 pass.
- `node --test test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js` -> GREEN, 20 pass.
- `node --test test/penny-sidecar-section-completion-gate.test.js` -> GREEN, 26 pass.
- `node --test test/penny-local-llm-sidecars.test.js` -> GREEN, 8 pass.
- `node --check lib/penny-sidecar-workflows.js && node --check public/js/penny-sidecar-panel.mjs && node --check public/js/penny-app.js` -> GREEN, no syntax output.
- `npm test` -> GREEN, 1047 pass; Node emitted an existing `MODULE_TYPELESS_PACKAGE_JSON` warning for `public/js/penny-storage.js`.
- `git diff --check` -> GREEN; Git warned that `Install-Penny.ps1` line endings will be replaced by CRLF next time Git touches it.
- `git status --short` -> many modified/untracked files remain in the shared dirty worktree, including unrelated pre-existing work.
- `node --test test/penny-sidecar-section-completion-gate.test.js` -> GREEN, 26 pass.
- `node --test test/penny-route-handlers.test.js` -> GREEN, 14 pass.
- `node --check server.js` -> GREEN, syntax check passed.
- `git diff --check` -> GREEN, no whitespace errors; Git printed an LF/CRLF warning for existing `Install-Penny.ps1`.
- `npm test` -> GREEN, 1047 pass.
- `git status --short` -> run; worktree remains broadly dirty from pre-existing unrelated changes plus the sidecar files touched here.
- `test -d artifacts/sidecar-trials ...` -> `artifacts/sidecar-trials not present`.

### Live Checks Not Run

- SearXNG live probe: not run; fixture/static only until explicit operator permission.
- Qdrant live probe/write trial: not run.
- Speaches live probe/TTS trial: not run.
- LM Studio/llama.cpp start/stop/load/unload/swap: not run and out of scope.

## Search Slice

- Status: landed and focused verification passed.
- Target workflow: POST `/api/penny/sidecars/search` returns a review-only SearXNG/fixture digest receipt with source receipts and authority guardrails.
- UI activation: Settings -> Local sidecars -> SearXNG research query -> Run search digest.
- Failure state: live mode without explicit `allowLiveProbe: true` returns a blocked `operator_permission_required` receipt.
- Receipts: `sourceReceipts[]`; `authority.memoryWrite`, `promptTruthChanged`, `toolEvidenceReceiptChanged`, and `defaultContextChanged` are false.
- Focused verification: `node --test test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js`.

## Docs/RAG Slice

- Status: landed and focused verification passed.
- Target workflow: POST `/api/penny/sidecars/docs` and compatibility alias `/api/penny/sidecars/rag` return review-only fixture document/RAG answers.
- UI activation: Settings -> Local sidecars -> Fixture document question -> Run document answer.
- Failure state: live mode without explicit `allowLiveProbe: true` returns a blocked `operator_permission_required` receipt; Qdrant write trials additionally require `allowQdrantWriteTrial: true`.
- Receipts: cited `ragAnswer.document_citations[]`, `document_says[]`, `model_infers[]`, mirrored `sourceReceipts[]`, `privateDocsUsed=false`, and `pennyMemoryImported=false` in fixture mode.
- Authority guardrails: `memoryWrite`, `promptTruthChanged`, `toolEvidenceReceiptChanged`, and `defaultContextChanged` remain false.
- Focused verification: `node --test test/penny-sidecar-workflows.test.js test/penny-sidecar-panel.test.js`.

## TTS/Audio Slice

- Status: landed and focused verification passed.
- Target workflow: POST `/api/penny/sidecars/audio` and compatibility alias `/api/penny/sidecars/tts` return review-only fixture audio/TTS receipts over the existing Speaches/audio sidecar trial helper.
- UI activation: Settings -> Local sidecars -> Speaches TTS preview text -> Run audio review.
- Failure state: live mode without explicit `allowLiveProbe: true` returns a blocked `operator_permission_required` receipt; Speaches TTS/model generation additionally requires `allowSpeachesTtsTrial: true`.
- Receipts: `transcriptReview`, capture facts, no microphone access, no recording start, no ambient capture, no private audio use, and no Penny memory import.
- Authority guardrails: `memoryWrite`, `promptTruthChanged`, `toolEvidenceReceiptChanged`, `defaultContextChanged`, and `runtimeVoiceChanged` remain false.
- TTS input: the explicit `text` payload is passed to the optional Speaches TTS trial when separately permitted.
- Focused verification: `node --test test/penny-sidecar-panel.test.js test/penny-sidecar-workflows.test.js`.

## Broad Safe Verification

- `node --test test/penny-sidecar-section-completion-gate.test.js`: passed.
- `node --test test/penny-route-handlers.test.js`: passed.
- `node --check server.js`: passed.
- `git diff --check`: passed; only an LF/CRLF warning for `Install-Penny.ps1`.
- `npm test`: passed with 1047 tests.
- `git status --short`: run; many modified/untracked files were already present in the worktree and were not reverted.

## Deferred Work and Cleanup Notes

- Live SearXNG/Qdrant/Speaches checks remain optional and were not run in this implementation pass.
- No sidecar output was added to Penny memory, PromptTruth, tool evidence, runtime voice, or default context.
- No LM Studio or llama.cpp model was started, stopped, loaded, unloaded, or swapped.
- No disposable QA memory, archive memory, or embedding files were created by this run.
- No `artifacts/sidecar-trials/` directory was present or created during the final verification pass.
- No cleanup of unrelated dirty worktree files was attempted.
