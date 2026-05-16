## Goal and success criteria

- Goal: Turn the late research batch into one bounded implementation slice centered on a research continuity ledger, then use a clean `off` vs `synthesis-only` compare to decide whether `synthesis-only` can advance as Penny's candidate default.
- User-facing or engineering success criteria:
  - Penny gains a bounded internal ledger for ongoing investigations without polluting canonical explicit memory.
  - Tool-lane repo inspection stays bounded by runtime caps and ignore rules instead of relying on prompt restraint.
  - The compare harness can run an explicit primary pair, including `off` vs `synthesis-only`.
  - The branch ends this cycle with a documented default decision and a pragmatic readiness judgment against `origin/main`.
- What will be considered done:
  - Code lands for ledger + tool safety + compare path + lightweight skill manifest.
  - Targeted tests and `npm test` pass.
  - One valid fresh-server `off` vs `synthesis-only` compare artifact exists.
  - The final decision and branch-readiness judgment are summarized honestly.

## Decisions already locked

- Constraint or decision: The primary implementation slice is a research continuity ledger stored separately from canonical explicit memory and archive auto-promotion.
- Constraint or decision: Tool safety is the secondary priority; no widened autonomy, no per-turn model hot-swapping, and no lane collapse.
- Constraint or decision: `tie can advance` for `synthesis-only`, but only after a lightweight Penny-voice tie-break confirms no blandness or honesty regression.
- Constraint or decision: Preserve the repo fact captured at planning time: this branch is `16` commits ahead of `origin/main` and `0` behind.

## Blind spots / what are we not considering?

- Unknown or risk: The ledger heuristics could accidentally over-capture casual turns if the qualifying-turn rules are too loose.
- Adjacent system that could drift: LM Studio load state may still poison the compare if the watchdog misses duplicate or low-VRAM conditions.
- What would make this plan wrong: If the ledger noticeably bloats wake-state prompts or starts competing with explicit memory instead of staying advisory.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  - `Aquinas`: ledger wiring, runtime artifact, inspector, and memory-route touchpoints.
  - `Pauli`: bounded repo-inspection tool safety and likely test impacts.
  - `Epicurus`: explicit `off` vs `synthesis-only` compare path and lightweight voice tie-break mechanics.
- QA inspection tasks and assigned subagents:
  - Later in the cycle, a dedicated LM Studio watchdog subagent will monitor model loads, logs, and VRAM during live QA.
- Doc mapping tasks and assigned subagents:
  - Main agent only for this pass; documentation is intentionally narrow.
- Single primary editor per file boundary:
  - Main agent will own all edits across backend, scripts, tests, docs, and inspector UI in one coherent patch series.

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
  - `server.js`
  - `lib/penny-memory.js`
  - `lib/penny-memory-archive.js`
  - `lib/penny-runtime-artifacts.js`
  - `lib/penny-project-tools.js`
  - `lib/penny-route-handlers.js`
  - `public/js/penny-memory-panel.mjs`
  - `scripts/eval-penny-epistemic-compare.js`
  - `scripts/qa-penny-voice-redo.js`
  - relevant `test/*.test.js`
- Commands to run:
  - `npm test`
  - targeted script checks where needed
  - one fresh-server `off` vs `synthesis-only` compare
- Ownership boundaries to confirm:
  - `server.js` remains orchestration-only where practical.
  - Memory formatting lives in `lib/penny-memory.js`.
  - Runtime artifact / inspector contracts live in `lib/penny-runtime-artifacts.js` and `public/js/penny-memory-panel.mjs`.
  - Repo-inspection tool behavior lives in `lib/penny-project-tools.js`.
- Known risks:
  - dirty-tree files outside the repo scope must not be staged or reverted
  - QA-generated artifacts must not be mistaken for source changes
  - route tests must not leak ledger files into the real workspace

## Proposed change set

- File or doc: `lib/penny-research-ledger.js`
  - Reason: add the separate internal research continuity store and qualifying-turn update logic.
  - Expected impact: Penny can remember investigation state and follow-ups without canonicalizing them.
- File or doc: `server.js`, `lib/penny-memory.js`, `lib/penny-memory-archive.js`, `lib/penny-runtime-artifacts.js`, `lib/penny-route-handlers.js`, `public/js/penny-memory-panel.mjs`
  - Reason: wire ledger context into wake-state, artifacts, inspector, and route lifecycle.
  - Expected impact: compact advisory ledger context and inspectable topic state per turn.
- File or doc: `lib/penny-project-tools.js` and supporting prompt/tool descriptions
  - Reason: harden repo traversal caps and default ignores in runtime code.
  - Expected impact: safer bounded project inspection primitives by default.
- File or doc: `.codex/skills/manifest.json`
  - Reason: add lightweight machine-readable groundwork for the repo-local Penny skills.
  - Expected impact: better internal discipline and future orchestration clarity without user-facing product scope.
- File or doc: `scripts/eval-penny-epistemic-compare.js`, `scripts/qa-penny-voice-redo.js`, `package.json`
  - Reason: support an explicit `off` vs `synthesis-only` compare and lightweight tie-break path.
  - Expected impact: the QA step answers the actual product question instead of an adjacent one.
- File or doc: targeted tests and minimal docs if needed
  - Reason: keep the new contracts pinned down and honest.
  - Expected impact: regression coverage and durable branch-readiness evidence.

## Verification plan

- Automated checks:
  - targeted unit tests for ledger update rules, prompt injection, artifact exposure, project-tool safety, and compare-plan selection
  - `npm test`
- Manual checks:
  - inspect the memory panel for ledger visibility if the UI surface changes visibly
  - inspect the final compare artifact for environment validity and clear mode labeling
- What should stay unchanged:
  - public Penny routes
  - chat/tool lane split
  - canonical explicit memory as the source of truth
  - experiments still default-off unless the compare says otherwise
- What would count as out-of-scope drift:
  - new memory layers beyond the bounded ledger
  - automatic archive-to-canonical promotion
  - broader autonomy or model-routing churn
  - unrelated dirty-tree cleanup

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  - compare JSON output
  - disposable server logs
  - isolated QA memory/archive/embedding files
- What should be persisted:
  - this plan artifact
  - code and test changes that define the ledger/tool-safety/compare path
  - the final valid compare artifact path in the summary
- What should be cleaned up before sign-off:
  - disposable QA junk created by this cycle
  - no parent-workspace files or local server-state files should be staged

## Out-of-scope list

- Explicitly out of scope: flipping `synthesis-only` to the default without a valid compare.
- Explicitly out of scope: RL, fine-tuning, new memory auto-promotion pipelines, or model-lab detours.

## Notes

- This plan supersedes neither the earlier `penny-next-cycle` document nor the research synthesis docs; it operationalizes the late research batch into a bounded release-cycle slice.
- If `origin/main` moves before the cycle ends, branch divergence must be re-checked before the final supersede-main judgment.
