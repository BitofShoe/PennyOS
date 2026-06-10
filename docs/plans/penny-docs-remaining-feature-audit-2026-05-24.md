# Penny Docs Remaining Feature Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for implementation slices that can be split safely, or `superpowers:executing-plans` for single-thread execution with checkpoints. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the docs-folder archaeology into a precise backlog of planned-but-unimplemented Penny work, with build slices for the useful leftovers and explicit non-build decisions for ideas that should stay parked.

**Architecture:** Keep Penny local-first, single-user, companion-first, and receipt-driven. New runtime behavior should extend extracted owners in `lib/` or `public/js/` before growing `server.js` or `public/js/penny-app.js`; planning, QA, and status cleanup should stay in docs/scripts/tests unless a concrete runtime behavior is being implemented.

**Tech Stack:** Node.js 24, npm 11, local OpenAI-compatible LM Studio/llama.cpp lanes, browser UI modules under `public/js/`, backend helpers under `lib/`, Node test runner, fixture-first QA scripts, Tauri developer-preview shell.

---

## Audit Scope

Environment: `local/static`.

Not run: live LM Studio, model loading/unloading, LAN checks, browser smoke, Tauri build, `npm test`, or `npm run check`. This audit intentionally did not touch the user's live loaded model state or runtime memory.

Corpus:

- Root docs requested by the user: `docs/`
- Plan docs requested by the user: `docs/plans/`
- Unique markdown files inventoried under `docs/`: 112.
- Total markdown line count under `docs/`: about 34,877 lines.
- Six read-only subagents audited non-overlapping bands: release/public/operator docs, archive/review docs, memory/truth/research docs, external/link/sidecar docs, root `docs/plans`, and bounded-aliveness/semantic plan bundles.

Authority rule used throughout:

- `docs/README.md:3-6` says code, tests, and receipts outrank persuasive docs when they disagree.
- `docs/README.md:23-33` defines plans as future-facing, not proof of landed work.
- `docs/README.md:67-77` gives the enforcement order: contract doc, code path, test, runtime artifact, product principle, historical review, future plan.
- `docs/README.md:146-163` labels the implementation-plan band as useful for bounded next slices but not proof that behavior shipped.

The important conclusion: most big April/May systems are not missing anymore. PromptTruth v2, research ledger hardening, sidecar scaffolds, static embedding sidecar seams, open loops, bounded initiative, turn-state, frame-budget receipts, session reflection helpers, dynamic memory links, semantic contracts, release checks, Tauri preview scaffolding, and sidecar lab trials all have real code or test owners. The remaining useful work is narrower than the docs pile makes it feel.

## Priority Backlog

### P0: Cross-Platform Project Path Safety

Status: likely real safety gap.

Why this matters:

- Old review docs called out Windows-style `..\\outside.txt` traversal being treated as a literal filename on POSIX/WSL instead of as an escape attempt.
- `lib/penny-project-tools.js:90-107` currently normalizes aliases with `raw.replace(/\\/g, '/')`, but the non-alias fallback resolves `raw` directly at `lib/penny-project-tools.js:103`.
- `test/penny-project-tools.test.js:90-99` covers native `..` traversal but not explicit Windows backslash or mixed-separator traversal.

Build slices:

#### Slice P0.1: Add failing path tests

Files:

- Modify: `test/penny-project-tools.test.js`

Steps:

- [ ] Add cases to `project tool guards reject root escapes and oversized writes` for:
  - `..\\outside.txt`
  - `src\\..\\..\\outside.txt`
  - `obsidian-vault\\..\\outside.md` inside the alias test
  - URL-encoded or doubled slash variants only if the current project tool accepts those paths as raw path input
- [ ] Expected failure before the fix: at least one backslash traversal path is not rejected with the same "inside the Penny project" or alias-scoped message.

Run:

```bash
node --test test/penny-project-tools.test.js
```

#### Slice P0.2: Normalize before resolving

Files:

- Modify: `lib/penny-project-tools.js`

Implementation rule:

- Treat both `/` and `\\` as path separators for safety before resolving.
- Preserve public display paths with forward slashes.
- Keep alias roots scoped to the alias root.

Suggested shape:

```js
const normalizedRaw = raw.replace(/\\/g, '/');
const resolved = path.resolve(normalizedProjectRoot, normalizedRaw);
```

Do this carefully around alias handling so Windows paths do not break legitimate alias paths.

Run:

```bash
node --test test/penny-project-tools.test.js
git diff --check
```

Acceptance:

- Backslash and mixed-separator root escapes are rejected.
- Normal project reads/writes still work.
- Alias paths still work.
- Pending-write tests still pass.

### P0: Web Fetch DNS Rebinding / Final Socket Hardening

Status: planned and not implemented.

Why this matters:

- `docs/penny-release-decisions-2026-05-18.md:80-93` says current URL safety is acceptable only because web reading is opt-in and off by default; the remaining work is closing DNS rebinding time-of-check/time-of-use before web reading becomes prominent or default-on.
- `lib/penny-web-url-safety.js:160-200` resolves and blocks private DNS answers.
- `lib/penny-web-url-safety.js:234-278` revalidates redirects and enforces byte caps.
- But `lib/penny-web-url-safety.js:245-253` still calls `fetchImpl(currentUrl)` after the safety check. There is no final peer verification or pinned resolved address in the current audited code.
- `test/penny-web-url-safety.test.js:26-62` covers private DNS, explicit private opt-in, redirect blocking, and byte caps, but not final-socket rebinding.

Build slices:

#### Slice W1: Model the TOCTOU failure in tests

Files:

- Modify: `test/penny-web-url-safety.test.js`

Steps:

- [ ] Add a test double where `lookup` returns a public IP at check time, but the fetch layer reports or simulates a private final address.
- [ ] Add a redirect test where the redirect hostname is safe at lookup but final peer metadata says private.
- [ ] Define the desired API surface for final peer metadata without requiring live network.

Run:

```bash
node --test test/penny-web-url-safety.test.js
```

#### Slice W2: Add verified-address fetch seam

Files:

- Modify: `lib/penny-web-url-safety.js`

Implementation options:

- Preferred: add an internal transport seam that can connect to a verified resolved address while preserving `Host` and SNI for HTTPS, then validate final peer address.
- Conservative fallback: make `fetchTextWithLimit` accept an optional `verifyFinalPeer` hook for Node/browser test doubles, and fail closed when final peer metadata is private.

Do not:

- Make web reading default-on.
- Allow private network targets by default.
- Add a broad browser automation or scraping stack.

Run:

```bash
node --test test/penny-web-url-safety.test.js
node --test test/penny-routes.test.js
git diff --check
```

Acceptance:

- Public fetches still work.
- Redirects are revalidated.
- Private final socket or final peer metadata is rejected unless `PENNY_WEB_ALLOW_PRIVATE_NET=1` is explicitly active for deliberate local testing.
- Existing byte caps and timeout behavior remain.

### P1: Pending Workspace Write Persistence

Status: planned and not implemented.

Why this matters:

- `docs/penny-release-decisions-2026-05-18.md:62-73` says pending writes are currently process-memory only and later persistence needs ignored local storage, base hash, creation time, TTL, exact path, and patch/content.
- Current code uses an in-memory map at `lib/penny-project-tools.js:57-58`.
- Staging stores base hash, next hash, TTL, patch, and metadata at `lib/penny-project-tools.js:367-405`.
- Approval rechecks the current hash before writing at `lib/penny-project-tools.js:554-575`.
- Tests cover staging, approval, denial, and changed-base conflict at `test/penny-project-tools.test.js:136-180`.

Build slices:

#### Slice P1.1: Add an ignored local store

Files:

- Modify: `.gitignore`
- Modify: `lib/penny-project-tools.js`
- Modify: `test/penny-project-tools.test.js`

Store:

- `data/penny-pending-workspace-writes.json`, or `tmp/penny-pending-workspace-writes.json`
- Must stay ignored.
- Must be local-only.

Schema:

```js
{
  schema: 'penny-pending-workspace-writes.v1',
  updatedAt: 'iso timestamp',
  pending: [
    {
      id,
      path,
      operation,
      action,
      before,
      after,
      baseHash,
      nextHash,
      bytes,
      lines,
      createdAt,
      expiresAt,
      patch,
      metadata
    }
  ]
}
```

#### Slice P1.2: Persist, reload, prune

Files:

- Modify: `lib/penny-project-tools.js`
- Modify: `test/penny-project-tools.test.js`

Steps:

- [ ] Load pending writes at API creation time.
- [ ] Drop expired entries immediately.
- [ ] Persist after stage, approve, deny, and prune.
- [ ] Recompute absolute `filePath` from stored relative `path` instead of trusting serialized absolute paths.
- [ ] Preserve base-hash conflict behavior on approval.

Run:

```bash
node --test test/penny-project-tools.test.js
git diff --check
```

Acceptance:

- Pending write survives API re-creation in a test.
- Expired pending write is removed from the store.
- Changed-base approval still rejects.
- Deny and approve delete the stored item.

### P1: Memory Export And Memory Surface Completion

Status: partially implemented; export is the clear missing polish.

Why this matters:

- `docs/penny-release-decisions-2026-05-18.md:17-22` says future Memory polish should include purge/export controls and plain-language labels.
- The visible Memory surface exists: `public/js/penny-memory-panel.mjs:362-406` renders explicit facts, pending suggestions, memory connections, and review controls.
- The app wires review/purge/forget actions in `public/js/penny-app.js:631-652` and `public/js/penny-app.js:1016-1060`.
- Inspector/review/purge routes exist in `lib/penny-route-handlers.js`, but the audit did not find a user memory export route or UI.

Build slices:

#### Slice M1: Export schema and route

Files:

- Modify: `lib/penny-route-handlers.js`
- Modify: `lib/penny-memory.js` or a new helper such as `lib/penny-memory-export.js`
- Test: `test/penny-route-handlers.test.js` or new `test/penny-memory-export.test.js`

Route:

- `GET /api/penny/memory/export`

Export shape:

```js
{
  schema: 'penny-memory-export.v1',
  generatedAt,
  source: 'local-explicit-memory',
  canonicalExplicitMemory: {
    userName,
    memories,
    voiceOn,
    brainMode,
    updatedAt
  },
  advisoryArchiveIncluded: false,
  archiveExportHint: 'Archive memory is advisory/debug-only and is not included in this explicit-memory export.'
}
```

Rules:

- Token-gated when API token is configured.
- Local-only route behavior should match existing memory route security.
- Do not include archive, embeddings, runtime artifacts, PromptTruth, tool receipts, or raw diagnostics in the default export.

#### Slice M2: UI affordance

Files:

- Modify: `public/js/penny-memory-panel.mjs`
- Modify: `public/js/penny-app.js`
- Test: `test/penny-memory-panel.test.js`

Steps:

- [ ] Add a visible export action near explicit remembered facts, not inside raw diagnostics.
- [ ] Label it "Export remembered facts" or equivalent plain language.
- [ ] Make archive/advisory export intentionally absent from the default control.

Run:

```bash
node --test test/penny-memory-panel.test.js test/penny-route-handlers.test.js
git diff --check
```

Acceptance:

- Export returns explicit memory only.
- UI label distinguishes canonical memory from advisory archive.
- No PromptTruth/toolEvidence/runtime artifact content leaks into the default export.

### P1: Source Artifact / Offline Knowledge Provenance Bank

Status: real partial gap.

Why this matters:

- `docs/penny-comparative-platform-memory-pass-2026-04-16.md` and `docs/penny-external-codebase-lessons-2026-04-20.md` planned a durable distinction between raw sources, derived chunks, review packets, and memory promotion.
- Current `lib/penny-knowledge-contracts.js` and `lib/penny-knowledge-ingestion.js` support conversation-thread/chunk/promotion artifacts, but the audit did not find a raw source artifact bank with checksum, dedup, processing status, and capability/degraded state.
- This is the right prerequisite before broader document/source ingestion work.

Build slices:

#### Slice K1: Add source artifact contracts

Files:

- Modify: `lib/penny-knowledge-contracts.js`
- Test: `test/penny-knowledge-ingestion.test.js` or new `test/penny-knowledge-contracts.test.js`

Contract:

```js
{
  schema: 'penny-source-artifact.v1',
  sourceId,
  sourceType: 'conversation-export' | 'markdown' | 'text' | 'json',
  originalPath,
  originalName,
  checksumSha256,
  bytes,
  importedAt,
  processingStatus: 'ready' | 'degraded' | 'failed',
  capabilityState: {
    normalizedText: true,
    sections: false,
    sourceReceipts: true
  },
  privacyClass: 'local-private',
  memoryAuthority: 'none'
}
```

Rules:

- This artifact is not canonical memory.
- It cannot write explicit memory.
- It can only support review packets and future source maps.

#### Slice K2: Write source artifacts during offline import

Files:

- Modify: `lib/penny-knowledge-ingestion.js`
- Modify: `scripts/import-penny-conversations.js`
- Test: `test/penny-knowledge-ingestion.test.js`

Steps:

- [ ] Compute checksum from raw import text.
- [ ] Deduplicate by checksum and source type.
- [ ] Attach source artifact ID to derived chunks.
- [ ] Preserve current review-gated promotion packet behavior.

Run:

```bash
node --test test/penny-knowledge-ingestion.test.js
git diff --check
```

Acceptance:

- Import artifacts identify original source and derived chunks.
- Duplicate source imports are visible as duplicates or no-ops, not silent new truth.
- No automatic memory promotion.

### P1: Memory Canary Completion

Status: partially implemented; targeted fixtures are missing.

Why this matters:

- `docs/penny-memory-agent-link-review-2026-05-12.md:42-64` asks for stale, contradicted, sensitive, or tone-poisoning archive candidates and visible replies that do not over-personalize from those items.
- Existing archive policy tests cover stale contradiction and sensitive holdback, but the audit did not find a focused visible-reply assertion for emotionally loaded unsupported memory.

Build slices:

#### Slice C1: Tone-poisoning candidate fixture

Files:

- Modify: `test/penny-memory-archive-policy.test.js`
- Modify: `test/penny-candidate-survival-qa.test.js`
- Possibly modify: `scripts/qa-penny-memory.js`

Cases:

- Stale candidate is semantically close but contradicted.
- Sensitive candidate is emotionally loaded but unsupported.
- Advisory candidate is relevant but not canonical.

Expected:

- Candidate is held back or demoted with inspectable reason.
- Visible reply does not personalize from held-back memory.
- PromptTruth schema does not expand.

Run:

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-candidate-survival-qa.test.js
git diff --check
```

### P1: Entity Collision And Capability Honesty Fixtures

Status: partially implemented primitives; missing explicit tests.

Why this matters:

- `docs/penny-memory-agent-link-review-2026-05-12.md:66-88` asks for near-name people/projects/relationships and behavior that prefers unknown or clarification instead of merging by embedding similarity.
- `docs/penny-memory-agent-link-review-2026-05-12.md:90-107` asks for capability-profile canaries: do not say "I cannot access that" when files/commands are available, and do not bluff when access is absent.

Build slices:

#### Slice E1: Entity and relationship collision tests

Files:

- Modify: `test/penny-memory-links.test.js`
- Modify: `test/penny-memory-link-policy.test.js`
- Modify: `test/penny-semantic-claims.test.js`

Cases:

- Two people with similar names but different relationship predicates.
- Two projects sharing a keyword but different owners/status.
- A stale relationship claim versus a current relationship claim.

Expected:

- Unknown/clarify beats merging.
- Wrong-predicate match is flagged.
- Stale object is not promoted to current truth.

Run:

```bash
node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js test/penny-semantic-claims.test.js
```

#### Slice E2: Positive and negative capability canaries

Files:

- Modify: `test/penny-qa-trust.test.js`
- Possibly modify: `lib/penny-qa-trust.js`

Cases:

- Available local file read/search receipt means Penny should not claim she cannot inspect local files.
- Absent command or not-run check must be reported as `not run`, `not checked`, or `unknown`.
- Failed command must not become a successful receipt.

Run:

```bash
node --test test/penny-qa-trust.test.js
git diff --check
```

### P1: Activate Native Memory Upgrade Coverage

Status: explicit placeholder tests remain.

Why this matters:

- `test/penny-native-upgrades.todo.test.js:3-5` still contains three placeholder tests.
- `docs/archive/PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md:110-144` says these are reminders for memory books prompt behavior, chapter compression fallback gating, and prompt-slot separation.

Build slices:

#### Slice N1: Convert placeholders to real tests

Files:

- Modify: `test/penny-native-upgrades.todo.test.js`, or split into focused test files if local owners are clearer.
- Likely owners: `lib/penny-memory-books.js`, `lib/penny-memory-archive.js`, `lib/penny-prompt-stack.js`, `lib/penny-memory.js`.

Tests:

- Memory books trigger bounded, inspectable prompt inserts without mutating canonical explicit memory.
- Chapter compression fallback appears only after long-session pressure or weak semantic retrieval.
- Prompt-slot assembly keeps lane overlays separate from verified facts and runtime voice layers.

Run:

```bash
node --test test/penny-native-upgrades.todo.test.js test/penny-memory-books.test.js test/penny-prompt-stack.test.js
git diff --check
```

Acceptance:

- No `test.todo` remains unless a new placeholder has a fresh reason.
- Tests prove existing behavior or expose drift before code changes.
- No new memory policy layer is added.

### P1: Q6+E4B Versus Qwen Lane Compare Runner

Status: planned but unimplemented as a dedicated runner.

Why this matters:

- `docs/plans/penny-q6-e4b-vs-qwen-single-model-compare-2026-04-20.md:85-93` names a future `scripts/qa-penny-lane-compare.js`.
- `docs/plans/penny-q6-e4b-vs-qwen-single-model-compare-2026-04-20.md:136-141` explicitly says actual replacement claims are out of scope until artifacts exist.
- Current package scripts include endpoint/model watch and model compare scaffolding at `package.json:127-130`, but there is no audited `scripts/qa-penny-lane-compare.js`.

Build slices:

#### Slice Q1: Fixture-first runner skeleton

Files:

- Create: `scripts/qa-penny-lane-compare.js`
- Create: `test/penny-lane-compare.test.js`
- Modify: `package.json`

Modes:

- `--fixture`: no live model, no server, validates artifact schema and scenario matrix.
- `--live-isolated`: only with explicit operator approval; disposable server/memory state.

Artifact:

```js
{
  schema: 'penny-lane-compare.v1',
  generatedAt,
  environment: 'fixture' | 'local-live-isolated',
  profiles: ['split-q6-e4b', 'single-qwen'],
  scenarios: [],
  cleanup: {
    disposableMemoryRemoved: true,
    playgroundFilesRemoved: true
  },
  verdict: 'fixture-only' | 'needs-manual-review' | 'blocked' | 'candidate'
}
```

#### Slice Q2: Live runbook only after explicit model permission

Files:

- Modify: `docs/PENNY_MODEL_EVAL.md`
- Modify: `docs/plans/penny-q6-e4b-vs-qwen-single-model-compare-2026-04-20.md`

Rules:

- Do not run two heavy harnesses in parallel.
- Preserve loaded model state unless the operator explicitly allows model management.
- Clean disposable memory/archive/embedding files after the run.
- Do not declare Qwen a replacement without artifacts.

Run:

```bash
node --test test/penny-lane-compare.test.js
git diff --check
```

### P2: Deterministic Document Extraction QA

Status: intentionally unimplemented; build only the fixture runner when a concrete document workflow appears.

Why this matters:

- `docs/plans/penny-deterministic-extraction-qa-plan-2026-04-21.md:11-17` says no runtime code, OCR tool, hosted connector, document-management surface, or QA runner exists until a future slice proves document ingestion matters.
- `docs/plans/penny-deterministic-extraction-qa-plan-2026-04-21.md:78-87` names future owner files.
- `docs/plans/penny-deterministic-extraction-qa-plan-2026-04-21.md:99-117` forbids OCR wiring, hosted tools, CMS/source warehouse behavior, runtime routes, and memory promotion before a real need exists.

Build only when triggered by a real document use case:

- Create: `lib/penny-document-extraction-qa.js`
- Create: `scripts/qa-penny-document-extraction.js`
- Create: `test/penny-document-extraction-qa.test.js`

First artifact:

```js
{
  schema: 'penny-document-extraction-qa.v1',
  sourceType: 'pdf' | 'csv' | 'image-table' | 'text',
  extractionMode: 'deterministic' | 'ocr-assisted' | 'llm-summarized',
  expectedFields: [],
  numericChecks: [],
  sourceReceipts: [],
  manualReviewRequired: true,
  llmReasoningAllowed: false
}
```

Acceptance:

- LLM summaries cannot pass numeric extraction alone.
- Every important field has a source receipt.
- Manual review is explicit.
- No runtime ingestion route exists in the first slice.

### P2: Generic Document Source Map / Chapter Index

Status: adjacent to the knowledge-source bank; not a runtime memory feature yet.

Why this matters:

- `docs/penny-document-chunking-notes.md` argues for normalized text, meaningful sections, indexes, and source references instead of reasoning over raw PDFs or giant documents.
- Current ingestion mainly covers conversation exports and review packets, not a generic document/folder source map.

Build slices:

#### Slice D1: Markdown/text source-map fixture

Files:

- Create: `lib/penny-source-map.js`
- Create: `test/penny-source-map.test.js`

Input:

- Safe checked-in fixture markdown/text only.

Output:

```js
{
  schema: 'penny-source-map.v1',
  sourceId,
  sections: [
    {
      sectionId,
      title,
      startLine,
      endLine,
      checksumSha256,
      summaryHint
    }
  ],
  index: []
}
```

Rules:

- No OCR.
- No hosted connector.
- No auto memory write.
- No raw private document ingestion.

### P2: Per-Turn Trace Artifact Panel

Status: many pieces exist; explicit consolidated panel is missing.

Why this matters:

- Earlier synthesis docs asked for a Penny Trace Artifact panel.
- Current pieces already exist: prompt-slot registry, PromptTruth, runtime artifacts, research-ledger rows, recent audit trail, and advanced diagnostics.
- The missing product work is consolidation and labeling, not a new truth surface.

Build slices:

#### Slice T1: View model only

Files:

- Modify: `public/js/penny-memory-panel.mjs`
- Test: `test/penny-memory-panel.test.js`

View model sections:

- Prompt slots rendered.
- PromptTruth rendered/held-back counts.
- ToolEvidenceReceipt sibling summary.
- Research ledger source classes.
- Open-loop/initiative/turn-state bridge status.
- Cleanup transform.
- Approximate-path policy.

Rules:

- No raw chain-of-thought.
- No PromptTruth expansion.
- No tool evidence merge.

Run:

```bash
node --test test/penny-memory-panel.test.js test/penny-runtime-artifacts.test.js
git diff --check
```

### P2: Eval Score Schema Polish

Status: partially implemented; schema unification remains.

Why this matters:

- `docs/PENNY_MODEL_EVAL.md` lists future scoring additions.
- `scripts/eval-penny-probes.js` and `scripts/qa-penny-voice-redo.js` already have probe, voice, caveat-order, and trust evaluations.
- The gap is a shared scoring schema and richer memory-quality/mock-web-backed prompt fixtures.

Build slices:

#### Slice V1: Shared eval score contract

Files:

- Create: `lib/penny-eval-score-schema.js`
- Test: `test/penny-eval-score-schema.test.js`
- Modify incrementally: `scripts/eval-penny-probes.js`, `scripts/qa-penny-voice-redo.js`, `scripts/eval-penny-models.js`

Schema:

```js
{
  schema: 'penny-eval-score.v1',
  harness,
  caseId,
  dimensions: {
    factuality: null,
    memory: null,
    toolHonesty: null,
    voiceFit: null,
    cautionOrder: null
  },
  blockers: [],
  receiptRefs: []
}
```

Acceptance:

- Existing artifacts remain readable.
- New summary fields are additive.
- No model-default decision is made from fixture-only results.

### P2: Frame Scheduler Decision

Status: plan and implementation disagree in shape.

Why this matters:

- `docs/plans/penny-post-tier1-bounded-aliveness-plans/01-frame-budget-runtime-plan.md:455-530` planned `lib/penny-frame-scheduler.js` and async `runFrameSidecar(s)`.
- Current implementation has scheduling/receipt planning in `lib/penny-frame-budget.js:622-705` and a bounded background queue in `lib/penny-background-frame.js:13-46`.
- There is no audited `lib/penny-frame-scheduler.js`.

Decision slice:

- Option A: implement the tiny async runner exactly as planned.
- Option B: amend plan/status docs to say `buildDeadlineAwareSidecarSchedule` plus `penny-background-frame` replaced it.

Recommended decision:

- Choose Option B unless a real runtime sidecar needs an async current-turn deadline runner. Current code already gives inspectable schedule receipts and background bounded jobs without adding more answer-path complexity.

Acceptance for Option B:

```bash
git diff --check
node --test test/penny-frame-budget.test.js test/penny-background-frame.test.js
```

### P2: Static Provider Comparison And Adoption Evidence

Status: primitives exist; provider comparison and default enablement remain deferred.

Why this matters:

- Static sidecar code exists, but `.env.example:61-63` keeps `PENNY_STATIC_EMBED_MODE=off`.
- `server.js:323-328` defaults static mode to `off` and caps static-only rendered items.
- Plans name stronger providers and real comparison as future work.

Build slices:

#### Slice S1: Offline provider comparison harness

Files:

- Modify: `lib/penny-embedding-providers.js`
- Modify: `scripts/eval-penny-static-embedding-live-compare.js`
- Test: `test/penny-embedding-providers.test.js`, `test/penny-static-embedding-live-compare.test.js`

Rules:

- Optional dependencies only.
- No default provider switch.
- No PromptTruth expansion.
- No prompt-limit increase.

#### Slice S2: Adoption evidence pack

Run only when operator wants local evidence:

```bash
npm run eval:static-embedding-live-compare
npm run eval:aliveness:fixture
```

Local/live isolated compare remains separate and permissioned.

### P2: Session Reflection Live-Shadow Review

Status: helper/fixture/compare code exists; default broad live rendering remains disabled.

Why this matters:

- Post-tier plan records R1-R8 as helper/fixture/status work and says broad/default live reflection prompt bridge remains disabled.
- Reflection suggestions must remain review-gated and not canonical.

Build only if compare evidence justifies it:

- Add a raw-server-off env flag for compact live-shadow review.
- Do not add default broad/live rendering.
- Do not write explicit memory without approval.
- Do not store hidden reasoning.

Run:

```bash
node --test test/penny-session-reflection.test.js test/penny-session-reflection-compare.test.js test/penny-memory-suggestion-queue.test.js
```

### P2: Dynamic Links Evidence Expansion

Status: correction scoring is gated; broader link classes remain shadow.

Why this matters:

- Current plan allows conservative correction-link scoring behind a gate, but project-thread, research-pattern, open-loop, semantic, static, and candidate-only links remain advisory/shadow until separately measured.

Build slices:

- Add compare cases for project/open-loop/research links.
- Keep active effects shadow-only.
- Only promote a link scoring class after compare artifacts show fewer stale/wrong merges and no PromptTruth/toolEvidence drift.

Run:

```bash
node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js test/penny-memory-links-compare.test.js
npm run eval:memory-links
```

### P3: Tauri Readiness Polish And Later Consumer Packaging

Status: developer preview exists; final packaging is intentionally not implemented.

Why this matters:

- `docs/penny-tauri-wrapper-options-2026-05-19.md:3-16` says current Tauri is not a final installer, bundled Node runtime, sidecar binary, tray app, updater, or model/runtime bundle.
- `README.md:113` says the wrapper does not bundle Node, Penny server, LM Studio, llama.cpp, or a model.
- `src-tauri/tauri.conf.json` has no external sidecars.
- Tests assert the preview boundary.

Near-term slice:

- Improve readiness display only: server, model endpoint, embed readiness, web/LAN posture, and log path.
- Do not add sidecars, tray, updater, bundled models, or Node bundling in the same slice.

Future packaging slice, only if explicitly requested:

- Decide Node sidecar versus external prerequisite.
- Decide signing/notarization.
- Decide updater policy.
- Preserve local memory/log/env posture.
- Keep `npm start` source install path working.

### P3: Slim Runtime Bundle

Status: planned; not needed for current technical-preview release.

Why this matters:

- `docs/penny-release-decisions-2026-05-18.md:44-60` explicitly says `npm pack` is a source/dev bundle for this release.
- `package.json:24-64` intentionally includes tests, fixtures, docs, scripts, and Tauri source.

Build only after packaging direction is chosen:

- Add a separate packaging target, not a mutation of the source/dev bundle.
- Exclude tests/eval fixtures/historical docs/generated QA output.
- Keep the reviewable source/dev bundle available.

### P3: Server And Frontend Thin-Shell Cleanup

Status: continuing engineering debt, not a missing user feature.

Evidence:

- `server.js`: 3,633 lines.
- `public/js/penny-app.js`: 1,121 lines.
- `ARCHITECTURE.md` and `CODEBASE.md` still say these should stay thin orchestration shells.

Rule:

- Do not schedule a broad refactor by itself.
- When implementing one of the feature slices above, extend or create a focused owner first.

Recommended extraction opportunities:

- Memory export -> `lib/penny-memory-export.js`
- Pending writes -> `lib/penny-pending-workspace-writes.js` if `penny-project-tools.js` grows too much.
- Web fetch TOCTOU -> `lib/penny-web-fetch-transport.js`
- Trace panel -> `public/js/penny-trace-panel.mjs`

## Docs-Only Reconciliation Slices

These should happen because the docs folder now contains stale plans that look scarier than the current code.

### R1: Release Plan Ledger

Create or update a status note mapping the two release handoffs to landed/deferred evidence:

- `docs/plans/penny-installable-local-companion-goal-mode-handoff-2026-05-16.md`
- `docs/plans/penny-release-critique-goal-mode-handoff-2026-05-17.md`

Purpose:

- Stop future agents from treating already-landed release/security work as open.
- Preserve the real leftovers: pending-write persistence, memory export polish, web fetch TOCTOU, final packaging, live mixed-drift QA.

### R2: Runtime Voice Completion Note

The Constellation runtime voice plan appears stale: it says not implemented, while runtime files now contain the relevant voice patch.

Slice:

- Add a completion note or update docs status.
- Keep live Constellation QA separate and permissioned.
- Verify with:

```bash
node --test test/penny-voice-redo.test.js
npm run qa:voice:constellation
```

The second command is local/live model QA and should only be run when the operator wants it.

### R3: OpenClaw Skill Intake And Shadow Retest Wording

Evidence:

- `docs/penny-openclaw-docs-applicability-review-2026-04-23.md:110-118` asks for OpenClaw skill intake questions and Codex Harness retest wording.
- `docs/OPENCLAW_SHADOW_EVAL.md:29-51` currently says shadow is parked until browser/exec/scheduled-task features produce a capability win.

Slice:

- Add the specific OpenClaw skill intake questions to `docs/plans/TEMPLATE.md` or `.codex/skills/penny-link-review/SKILL.md`.
- Add the disposable Codex Harness retest condition to `docs/OPENCLAW_SHADOW_EVAL.md`.

Run:

```bash
node --test test/penny-skill-pack.test.js
git diff --check
```

### R4: Stale Review Annotation

Docs such as `docs/LOCAL_LLAMA_THREAD_FINDINGS.md` and `docs/RYS_FOLLOWUP_REVIEW.md` include older claims about missing architecture docs or test lanes. Many are now partially superseded.

Slice:

- Add a short status overlay, not a rewrite.
- Mark what has landed.
- Keep the true remaining debt: `server.js` and `public/js/penny-app.js` are still large; fixture coverage can still broaden; live model QA still depends on runtime state.

## Items That Should Not Be Built Now

### Do Not Add Graph DB / RDF Infrastructure / Public Linked Data

Do not build:

- RDF/XML
- JSON-LD
- SPARQL
- triplestore
- graph DB
- public URI dereferencing
- crawler/reasoner infrastructure

Reasoning:

- Penny already has local semantic IDs, predicates, domains, claims, source audits, rendered-claim labels, and export artifacts.
- The value of those helpers is discipline: stable local IDs, source authority, support state, temporal scope, and failure modes.
- A graph database would increase dependency, migration, query, privacy, and prompt-surface complexity without solving the current failures better than local helper contracts.
- Current docs explicitly forbid treating semantic helpers as PromptTruth expansion, canonical memory, public Linked Data, or graph infrastructure.

What would change this:

- A repeated, measured failure where local semantic helpers cannot represent a needed relationship.
- A concrete local-only graph artifact that proves better inspection without memory promotion, prompt expansion, or network dereference.

### Do Not Adopt Sidecar Apps Into Penny Core

Do not build into core:

- Open WebUI replacement UI
- n8n / Dify / Flowise / LangFlow / Windmill / Activepieces as core workflow layer
- MCP gateway/control plane as default layer
- Home/camera/email/social/public automation
- Ambient microphone, camera, screen, browser history, or camera history capture
- OpenCode/Pi as bundled Penny runtime

Reasoning:

- Sidecar work has been useful because it is isolated, disposable, and receipt-producing.
- Moving sidecars into core would cross privacy, license, dependency, memory, prompt, and authority boundaries.
- Penny is a local single-user companion, not a workflow platform or connector marketplace.
- Current sidecar artifacts explicitly prove lab-only behavior and no Penny memory import.

What would change this:

- A user-requested sidecar adoption slice with explicit install permission, scope, data boundary, license review, and cleanup rules.
- A disposable trial proving the value without touching Penny memory or live model state.

### Do Not Enable Default Static Live-Advisory / EmbeddingGemma / Global Thinking / Huge Context

Reasoning:

- Static live-advisory is useful as opt-in candidate discovery, not truth.
- Embedding providers can change vector space behavior and stale-match risk.
- Global thinking/default high context risks latency, VRAM/RAM pressure, hidden reasoning leakage, and different behavior without receipts.
- Current evidence supports fixture/live-shadow review, not default enablement.

What would change this:

- Repeated isolated artifacts showing quality wins, trust safety, latency budget fit, cleanup success, and no PromptTruth/toolEvidence/context-limit drift.

### Do Not Expand PromptTruth Or Merge ToolEvidenceReceipt

Reasoning:

- PromptTruth means what was candidate/rendered into the prompt, not everything the app knows.
- Tool evidence is a sibling runtime artifact because deterministic tool output, raw JSON, source refs, and verification receipts have different authority.
- Merging them would make receipts look like prompt-visible truth and weaken the current audit model.

What would change this:

- Nothing in the current docs justifies it. If a future feature needs a new receipt, add a sibling receipt with explicit authority instead.

### Do Not Auto-Promote Reflections, Links, Static Hits, Semantic Claims, Or Emotional Salience

Reasoning:

- Explicit memory is canonical.
- Archive, ledger, open loops, reflection, static candidates, semantic claims, and links are advisory unless review-gated.
- Emotional salience can guide care or review priority, but it is not a durable fact about the user.
- Auto-promotion would turn retrieval confidence into personal truth.

What would change this:

- User-approved memory write through the existing explicit memory path.
- A review queue item with support state, source, sensitivity, and approval.

### Do Not Build Hosted OCR / CMS / Broad Document Chat Without A Concrete Use Case

Reasoning:

- Deterministic extraction is a preserved lesson, not current product need.
- Finance/tax/table extraction needs OCR/table/source receipts/manual review before LLM reasoning.
- Hosted document tools, CMS/source warehouses, scanner/email ingestion, and broad document chat are a product expansion with privacy and correctness risk.

What would change this:

- A concrete local document workflow the user asks Penny to support.
- A fixture-only deterministic QA runner first.

### Do Not Revive Rich OpenClaw Shadow Until It Clears The Capability Bar

Reasoning:

- OpenClaw shadow is currently parked.
- Penny is not wired to OpenClaw browser control, exec, cron, or visible multi-step routing.
- LM Studio remains the main brain.
- Adding shadow complexity without gateway health and capability proof would create another brittle lane.

What would change this:

- Healthy gateway.
- Disposable Codex Harness smoke proving routing, fallback, tool availability, and a real browser/exec/background-task capability win.
- No Penny memory or live LM Studio disturbance.

### Do Not Build Hidden-State / Neuron / Chain-Of-Thought Runtime Features

Reasoning:

- H-Neurons, LLM geometry, and RYS docs are research inspiration, not runtime law.
- Penny's trust model is source evidence, deterministic tools, prompt receipts, and reviewable memory.
- Hidden-state truth vectors or stored reasoning traces would be hard to verify locally and easy to oversell.

What would change this:

- Offline eval-only experiment on a narrow task, with no live runtime effect, no hidden reasoning persistence, and no claim of truth authority.

## Recommended Execution Order

1. P0 path safety.
2. P0 web fetch TOCTOU hardening.
3. P1 pending workspace write persistence.
4. P1 memory export.
5. P1 source artifact/provenance bank.
6. P1 memory canaries and entity/capability fixtures.
7. P1 native memory upgrade tests.
8. P1 Q6+E4B versus Qwen fixture runner.
9. Docs-only reconciliation slices R1-R4.
10. P2/P3 slices only when the immediate feature pressure appears.

This order favors small, concrete safety/trust improvements before broader eval, sidecar, packaging, or adoption decisions.

## Verification Plan For This Audit Artifact

Run after editing this document:

```bash
test -f docs/plans/penny-docs-remaining-feature-audit-2026-05-24.md
rg -n "T[B]D|TO[D]O|fill[ ]in details|implement[ ]later|similar[ ]to Task" docs/plans/penny-docs-remaining-feature-audit-2026-05-24.md
git diff --check -- docs/plans/penny-docs-remaining-feature-audit-2026-05-24.md
```

Expected:

- File exists.
- Placeholder scan returns no planning-placeholder language except factual references to existing `test.todo` code if present.
- `git diff --check` reports no whitespace errors.

Checks intentionally not run for this audit:

- `npm test`: not needed because this turn writes a planning artifact only.
- `npm run check`: not needed for a docs-only audit artifact.
- Any LM Studio/model/LAN/browser/Tauri live check: out of scope and would touch local runtime state.
