# Penny Weighted Automata Follow-Through Plan

## Goal and success criteria

- Goal:
Turn the weighted-automata lessons report into one bounded Penny hardening cycle focused on canonicalization, bounded ambiguity, transform safety, and behavioral QA.
- User-facing or engineering success criteria:
Penny stays companion-first, but her layered runtime becomes more explicit about what is canonical, what is advisory, what got merged, what got cleaned up, and what was only approximately good enough. Prompt-slot and lane composition become easier to reason about. Cleanup and summarization become more inspectable. QA gains better witness traces for false merge, ambiguity overload, and cleanup drift.
- What will be considered done:
The runtime has stronger contracts around memory state, prompt-slot composition, and visible-reply cleanup; the inspector and artifacts tell the truth about those contracts; targeted tests pass; and the docs honestly describe the bounded approximate behavior instead of implying exactness.

## Decisions already locked

- Constraint or decision:
Penny stays companion-first. No personality rewrite and no generic assistant flattening.
- Constraint or decision:
Explicit memory remains canonical. Archive, memory books, and research-ledger context remain advisory.
- Constraint or decision:
Visible-reply cleanup is presentation cleanup, not a truth authority layer.
- Constraint or decision:
`server.js` and `public/js/penny-app.js` remain orchestration shells. New logic should land in named owners under `lib/` and `public/js/`.
- Constraint or decision:
This pass is about discipline, instrumentation, and QA. It is not a green light for broader platformization, new connector layers, or a generalized memory OS.

## Blind spots / what are we not considering?

- Unknown or risk:
Behavioral merge checks may be more expensive or noisier than expected under live LM Studio conditions.
- Adjacent system that could drift:
Cleanup and transform metrics may expose deeper transport/model instability instead of a narrow cleanup issue.
- What would make this plan wrong:
If the formalized contracts make Penny less helpful or noticeably stiffer in ordinary companion chat, then the pass has over-corrected.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  - `Memory Contract Explorer`: inspect `lib/penny-memory.js`, `lib/penny-memory-state.js`, `lib/penny-memory-archive.js`, `lib/penny-research-ledger.js`, and `lib/penny-knowledge-contracts.js` for where canonicalization and merge metadata should live.
  - `Prompt/Lane Explorer`: inspect `lib/penny-prompt-stack.js`, `lib/penny-local-lanes.js`, `lib/penny-latency-budget.js`, and `lib/penny-route-handlers.js` for slot precedence, empty-slot semantics, and lane transition truth.
  - `Transform Explorer`: inspect `lib/penny-visible-reply.js`, `lib/penny-lmstudio-transports.js`, and `lib/penny-runtime-artifacts.js` for cleanup categories, provenance, and idempotence expectations.
  - `UI/Docs Explorer`: inspect `public/js/penny-memory-panel.mjs`, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, `docs/penny-runtime-authority-contract-2026-04-17.md`, and `docs/penny-weighted-automata-lessons-report-2026-04-17.md` for wording and inspector drift.
- QA inspection tasks and assigned subagents:
  - `Memory QA Explorer`: inspect `scripts/qa-penny-memory.js`, `test/penny-memory.test.js`, `test/penny-memory-state.test.js`, `test/penny-memory-archive.test.js`, `test/penny-research-ledger.test.js`, and `test/penny-memory-qa-script.test.js`.
  - `Route/Cleanup QA Explorer`: inspect `test/penny-prompt-stack.test.js`, `test/penny-local-lanes.test.js`, `test/penny-visible-reply.test.js`, `test/penny-lmstudio-transports.test.js`, `test/penny-runtime-artifacts.test.js`, `test/penny-memory-panel.test.js`, and `test/penny-routes.test.js`.
- Doc mapping tasks and assigned subagents:
  - `Docs Mapper`: map which claims are already landed versus which changes should only be documented after code lands.
- Single primary editor per file boundary:
  - One primary editor owns memory-state files and their tests.
  - One primary editor owns prompt/lane files and their tests.
  - One primary editor owns transform/runtime-artifact files and their tests.
  - One primary editor owns inspector/docs sync after the backend contracts are settled.

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
  - `lib/penny-memory.js`
  - `lib/penny-memory-state.js`
  - `lib/penny-memory-archive.js`
  - `lib/penny-research-ledger.js`
  - `lib/penny-knowledge-contracts.js`
  - `lib/penny-prompt-stack.js`
  - `lib/penny-local-lanes.js`
  - `lib/penny-latency-budget.js`
  - `lib/penny-route-handlers.js`
  - `lib/penny-visible-reply.js`
  - `lib/penny-lmstudio-transports.js`
  - `lib/penny-runtime-artifacts.js`
  - `public/js/penny-memory-panel.mjs`
  - `scripts/qa-penny-memory.js`
  - the relevant `test/*.test.js` files listed above
  - `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`
- Commands to run:
  - `npm test`
  - targeted test files for the touched boundaries
  - `npm run qa:memory:smoke`
  - `npm run qa:browser:smoke` if route/cleanup surfaces change materially
  - `npm run qa:voice:tiebreak` only if visible-reply cleanup changes start affecting Penny's final surface noticeably
- Ownership boundaries to confirm:
  - canonical explicit-memory truth stays in `lib/penny-memory.js` and `lib/penny-memory-state.js`
  - archive lifecycle and merge provenance stay in `lib/penny-memory-archive.js`
  - prompt-slot ordering and overlays stay in `lib/penny-prompt-stack.js`
  - lane and budget policy stay in `lib/penny-local-lanes.js` and `lib/penny-latency-budget.js`
  - cleanup stays in `lib/penny-visible-reply.js` and transport glue in `lib/penny-lmstudio-transports.js`
  - artifact truth stays in `lib/penny-runtime-artifacts.js`
  - inspector rendering stays in `public/js/penny-memory-panel.mjs`
- Known risks:
  - overlapping edits across memory, transform, and inspector files
  - accidental prompt-budget growth while adding more metadata
  - QA artifact pollution in local memory/archive/embedding files
  - mistaking approximate behavior for exact guarantees in docs or tests

## Proposed change set

- File or doc: `lib/penny-knowledge-contracts.js`
  - Reason:
  If shared canonical packet shapes are needed for summary, merge, or review metadata, this is the cleanest existing seam to define them instead of inventing loose objects in multiple files.
  - Expected impact:
  More stable, inspectable object shapes for downstream merge/provenance work.
- File or doc: `lib/penny-memory-state.js`, `lib/penny-memory.js`
  - Reason:
  Tighten canonicalization rules for explicit facts, correction handling, and canon-first authority under advisory pressure.
  - Expected impact:
  Less ambiguity about what is explicit truth versus extracted or review-gated material.
- File or doc: `lib/penny-memory-archive.js`, `lib/penny-research-ledger.js`
  - Reason:
  Record merge basis, discarded detail, provenance, timing, and one-way consolidation semantics more explicitly.
  - Expected impact:
  Archive and ledger behavior become more auditable and less likely to launder advisory state into truth.
- File or doc: `lib/penny-prompt-stack.js`, `lib/penny-local-lanes.js`, `lib/penny-latency-budget.js`, `lib/penny-route-handlers.js`
  - Reason:
  Harden prompt-slot precedence, empty-slot/no-op semantics, lane transitions, and approximate budget metadata.
  - Expected impact:
  The runtime becomes easier to reason about, and hidden structure becomes explicit instead of emergent.
- File or doc: `lib/penny-visible-reply.js`, `lib/penny-lmstudio-transports.js`, `lib/penny-runtime-artifacts.js`
  - Reason:
  Treat cleanup as a typed transform class with explicit categories, provenance, and idempotence expectations.
  - Expected impact:
  Cleanup stops being a vague salvage blur and becomes a measurable presentation-normalization path.
- File or doc: `public/js/penny-memory-panel.mjs`
  - Reason:
  Surface the new contract truth in the inspector: canonical vs advisory pressure, approximate vs exact paths, transform categories, and merge/provenance summaries.
  - Expected impact:
  Operators can actually see what shaped the reply instead of inferring it from logs.
- File or doc: `scripts/qa-penny-memory.js`
  - Reason:
  Add witness-trace style slices for false merge, ambiguity overload, and cleanup-related drift.
  - Expected impact:
  QA better matches the risks surfaced in the lessons report.
- File or doc: targeted tests under `test/`
  - Reason:
  Pin down the new contracts with focused regressions instead of relying on broad vibe checks.
  - Expected impact:
  Safer iteration and less risk of accidental authority drift.
- File or doc: `docs/penny-runtime-authority-contract-2026-04-17.md`, `docs/penny-module-ownership.md`, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`
  - Reason:
  Keep the docs honest about the new boundaries and avoid over-claiming exactness.
  - Expected impact:
  Future agents can follow the same rules without rediscovering them.

## Verification plan

- Automated checks:
  - targeted `node --test` runs for touched files first
  - `npm test`
  - `npm run qa:memory:smoke`
  - `npm run qa:browser:smoke` if route-level output or inspector payloads changed
  - `npm run qa:voice:tiebreak` only if cleanup changes appear to affect Penny's final style or honesty envelope
- Manual checks:
  - inspect the memory panel for any new canonical/advisory/cleanup metadata
  - inspect one or two representative runtime artifacts for transform categories and approximate-path truth
  - sanity-check that ordinary companion turns still feel like Penny and not a bureaucracy
- What should stay unchanged:
  - Penny's voice identity and companion-first framing
  - the explicit-vs-advisory truth hierarchy
  - dual chat/tool lane architecture
  - bounded local-first posture
- What would count as out-of-scope drift:
  - a new always-on knowledge bank
  - broader platform DSL or connector expansion
  - memory auto-promotion or automatic forgetting policy
  - a large model-routing redesign
  - feature growth unrelated to canonicalization, composition, transform safety, or QA

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  - targeted test output
  - smoke QA logs
  - disposable QA memory/archive/embedding files
  - possible browser-smoke artifacts if that harness is run
- What should be persisted:
  - this plan
  - the lessons report
  - code, tests, and doc updates that land from the pass
- What should be cleaned up before sign-off:
  - disposable QA-generated explicit memory, archive memory, and embedding files
  - temporary logs or smoke artifacts not needed for the final handoff
  - no unrelated parent-workspace files should be staged or mutated

## Out-of-scope list

- Explicitly out of scope:
A generalized research/document knowledge bank in this pass.
- Explicitly out of scope:
New connector surfaces, plugin expansion, or platform ambitions.
- Explicitly out of scope:
Auto-promotion from archive or ledger into canonical memory.
- Explicitly out of scope:
Formal-methods-for-the-sake-of-formal-methods work that does not materially improve Penny's runtime truthfulness.

## Notes

- This plan operationalizes [penny-weighted-automata-lessons-report-2026-04-17.md](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/docs/penny-weighted-automata-lessons-report-2026-04-17.md).
- Recommended execution order:
  1. Contract and instrumentation hardening
  2. Memory canonicalization and merge provenance
  3. Prompt-slot and lane composition hardening
  4. Transform safety and cleanup telemetry
  5. Witness-trace QA and doc sync
- If schedule or attention is tight, stop after steps 1-3 before taking on deeper transform or QA work.
- Heavy LM Studio QA should happen one harness at a time, and any disposable QA memory artifacts should be cleaned immediately after the run.

