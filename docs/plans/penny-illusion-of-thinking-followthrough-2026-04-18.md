# Penny Illusion Of Thinking Follow-Through Plan

## Goal and success criteria

- Goal:
Turn the "Illusion of Thinking" lessons report into one bounded Penny hardening cycle focused on reasoning-budget policy, verifier-first exactness, overthinking/fixation detection, and trace-aware QA.
- User-facing or engineering success criteria:
Penny stays companion-first and does not become benchmark-brained, but the runtime gets better at distinguishing when extra reasoning is worth paying for, when exactness should move to tools or validators, and when a turn should stop instead of burning tokens in self-correction theater. Runtime artifacts and QA traces become better at showing where a run first drifted, whether it got stuck in a wrong path, and whether a failure was policy, environment, or capability related.
- What will be considered done:
Penny has an explicit reasoning-budget policy, better runtime receipts for approximate versus verifier-backed paths, targeted canaries for overthinking/fixation, and docs/tests that truthfully describe the behavior without equating verbosity with reliability.

## Decisions already locked

- Constraint or decision:
Penny stays a local single-user companion app, not a reasoning benchmark platform.
- Constraint or decision:
Explicit memory remains canonical. Archive, memory books, and research-ledger continuity remain advisory.
- Constraint or decision:
Raw reasoning traces are diagnostic only. They are not a user-facing trust surface and not a memory authority layer.
- Constraint or decision:
Exact or stateful tasks should prefer bounded tool execution and verification over longer chain-of-thought.
- Constraint or decision:
`server.js` and `public/js/penny-app.js` remain orchestration shells. New behavior should land in named owners under `lib/` and `public/js/`.
- Constraint or decision:
This pass is about runtime policy, instrumentation, and QA. It is not a green light for exposing chain-of-thought, adding new platforms, or redesigning Penny into a "reasoning agent" product.

## Blind spots / what are we not considering?

- Unknown or risk:
It is easy to misclassify task complexity and accidentally make Penny stiffer or more bureaucratic on ordinary chat turns.
- Adjacent system that could drift:
Reasoning-budget tightening could surface lane-selection bugs or fallback behavior that currently gets hidden by extra model verbosity.
- What would make this plan wrong:
If the changes reduce warmth, responsiveness, or ordinary companion helpfulness more than they improve exactness and honesty, then the pass has over-corrected.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  - `Reasoning Policy Explorer`: inspect `lib/penny-latency-budget.js`, `lib/penny-local-lanes.js`, and the route path that turns user intent into budget/lane choice.
  - `Runtime Artifact Explorer`: inspect `lib/penny-runtime-artifacts.js`, `lib/penny-visible-reply.js`, and any existing epistemic or repair metadata for where overthinking/fixation signals should live.
  - `Verifier/Tool Explorer`: inspect tool-lane and deterministic-tool seams to identify where exact-task verification already exists versus where Penny still trusts model-only execution too much.
  - `QA/Trace Explorer`: inspect `scripts/qa-penny-memory.js`, `lib/penny-qa-trace.js`, `lib/penny-qa-trust.js`, and related tests for where trace-aware canaries and first-drift evidence should be added.
  - `Inspector/Docs Explorer`: inspect `public/js/penny-memory-panel.mjs`, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and the new lessons report for wording drift.
- QA inspection tasks and assigned subagents:
  - `Budget QA Explorer`: inspect `test/penny-latency-budget.test.js`, `test/penny-local-lanes.test.js`, and any route tests that pin budget/lane behavior.
  - `Artifact QA Explorer`: inspect `test/penny-runtime-artifacts.test.js`, `test/penny-visible-reply.test.js`, and any trace/inspector tests that should gain overthinking/fixation assertions.
- Doc mapping tasks and assigned subagents:
  - `Plan Mapper`: map which claims belong in runtime docs immediately and which should wait until the code/test work lands.
- Single primary editor per file boundary:
  - One primary editor owns reasoning-budget and lane-policy files plus their tests.
  - One primary editor owns runtime-artifact and trace files plus their tests.
  - One primary editor owns inspector/docs sync after the runtime contracts settle.

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses runtime policy, tools, QA, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
  - `lib/penny-latency-budget.js`
  - `lib/penny-local-lanes.js`
  - `lib/penny-route-handlers.js`
  - `lib/penny-runtime-artifacts.js`
  - `lib/penny-visible-reply.js`
  - `lib/penny-qa-trace.js`
  - `lib/penny-qa-trust.js`
  - `scripts/qa-penny-memory.js`
  - `public/js/penny-memory-panel.mjs`
  - `test/penny-latency-budget.test.js`
  - `test/penny-local-lanes.test.js`
  - `test/penny-runtime-artifacts.test.js`
  - `test/penny-visible-reply.test.js`
  - `test/penny-routes.test.js`
  - `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`
- Commands to run:
  - targeted `node --test` runs for touched files first
  - `npm test`
  - `npm run qa:memory:smoke`
  - `npm run eval:probes` if new trace-style reasoning canaries are added there instead of memory QA
  - `npm run qa:browser:smoke` only if inspector surfaces change materially
- Ownership boundaries to confirm:
  - reasoning-budget classification stays in `lib/penny-latency-budget.js`
  - lane intent selection stays in `lib/penny-local-lanes.js`
  - route-time policy wiring stays in `lib/penny-route-handlers.js`
  - runtime truth and advisory receipts stay in `lib/penny-runtime-artifacts.js`
  - cleanup remains a typed presentation transform rather than a truth rewrite
  - trace/trust verdicting stays in `lib/penny-qa-trace.js` and `lib/penny-qa-trust.js`
- Known risks:
  - adding "complexity-aware" logic that is actually just brittle heuristics
  - letting overthinking detection become a fake confidence score
  - prompt or artifact bloat while adding more telemetry
  - quietly routing too many ordinary turns into tool-heavy or verifier-heavy paths
  - accidental staging or editing of unrelated dirty files already present in the worktree

## Proposed change set

- File or doc: `lib/penny-latency-budget.js`
  - Reason:
  Add a more explicit reasoning-budget policy so Penny can distinguish simple turns, medium-complexity turns that deserve deliberate reasoning, and exactness-heavy turns that should bias toward verifier-first paths.
  - Expected impact:
  Less accidental overthinking on easy turns and more honest policy around where extra model deliberation is actually useful.
- File or doc: `lib/penny-local-lanes.js`, `lib/penny-route-handlers.js`
  - Reason:
  Teach the route path to use the new reasoning-budget signals without turning complexity classification into a giant hidden ruleset.
  - Expected impact:
  Lane and execution-path selection become more explainable and easier to audit in runtime artifacts.
- File or doc: `lib/penny-runtime-artifacts.js`
  - Reason:
  Record reasoning-budget class, verifier-backed execution status, stop/short-circuit reasons, and any loop/fixation signals in a way that stays clearly advisory and inspectable.
  - Expected impact:
  Operators can tell whether Penny answered quickly because the turn was easy, because a verifier path took over, or because a collapse-like loop was cut off.
- File or doc: `lib/penny-visible-reply.js`
  - Reason:
  If stop conditions or short-circuit policies affect final wording, Penny's visible reply layer may need explicit categories so "early stop", "verified deterministic result", and "honest bounded failure" do not blur together.
  - Expected impact:
  Cleaner final responses that stay companion-like without laundering uncertainty.
- File or doc: `lib/penny-qa-trace.js`, `lib/penny-qa-trust.js`
  - Reason:
  Add trace fields and trust logic for first-drift, fixation, repeated self-correction, verifier usage, and collapse-like overthinking patterns.
  - Expected impact:
  QA becomes better at separating "bad answer because the model drifted" from "bad answer because the runtime let it drift too long."
- File or doc: `scripts/qa-penny-memory.js`
  - Reason:
  Extend witness traces with canaries that reflect the paper's lessons: early wrong-path fixation, overthinking after an answer is already available, and honest handoff/fallback on exact tasks.
  - Expected impact:
  Memory/runtime QA better matches real Penny risk instead of only checking final recall outcomes.
- File or doc: targeted tests under `test/`
  - Reason:
  Pin down the new reasoning-budget and artifact contracts with focused regressions.
  - Expected impact:
  Future changes are less likely to reintroduce hidden "more thinking must be better" assumptions.
- File or doc: `public/js/penny-memory-panel.mjs`
  - Reason:
  Surface the new runtime truth compactly: reasoning budget, verifier-backed path, stop reason, and any overthinking/fixation flags.
  - Expected impact:
  Debugging stays inspector-first instead of log-diving or guesswork.
- File or doc: `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and the new lessons report if needed
  - Reason:
  Keep docs honest about what Penny is doing: bounded reasoning, verifier-first exactness, and diagnostic traces rather than exposed chain-of-thought.
  - Expected impact:
  Future agents inherit the correct mental model instead of adding more "thinking" by default.

## Verification plan

- Automated checks:
  - targeted `node --test` runs for touched boundaries first
  - `npm test`
  - `npm run qa:memory:smoke`
  - `npm run eval:probes` if any reasoning/fixation canaries land there
  - `npm run qa:browser:smoke` only if inspector payload/rendering changed materially
- Manual checks:
  - inspect one casual chat turn and confirm it still stays lean and warm
  - inspect one medium-complexity multi-step turn and confirm the reasoning budget expands only when justified
  - inspect one exact/tool-style turn and confirm verifier or deterministic execution is reflected honestly in artifacts
  - inspect the memory panel and confirm the new signals read like receipts, not fake confidence theater
- What should stay unchanged:
  - Penny's companion voice and warmth
  - the canonical-vs-advisory memory hierarchy
  - dual chat/tool lane architecture
  - local-first posture and bounded ambiguity framing
- What would count as out-of-scope drift:
  - exposing raw chain-of-thought to users
  - adding generic confidence scores as a truth proxy
  - turning every non-trivial turn into tool-heavy bureaucracy
  - large benchmark harness growth unrelated to Penny's real runtime risks
  - any feature work unrelated to reasoning-budget policy, verifier-first exactness, or trace-aware QA

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  - targeted test output
  - smoke QA logs
  - possible probe/eval artifacts if reasoning canaries are added there
  - disposable QA memory/archive/embedding files if memory QA is run
- What should be persisted:
  - this follow-through plan
  - the lessons report
  - any code, tests, and doc updates that land from the pass
- What should be cleaned up before sign-off:
  - disposable QA-generated memory, archive, ledger, and embedding artifacts
  - temporary smoke or probe artifacts not needed for the final handoff
  - no unrelated dirty worktree files should be staged or rewritten

## Out-of-scope list

- Explicitly out of scope:
Replacing Penny's ordinary companion chat with a visible "thinking mode" UX.
- Explicitly out of scope:
General-purpose benchmark platform work or puzzle-suite expansion for its own sake.
- Explicitly out of scope:
Treating raw reasoning traces as truth, memory, or user-facing evidence.
- Explicitly out of scope:
New connectors, new platform layers, or a broad route-architecture rewrite.

## Notes

- This plan operationalizes [penny-illusion-of-thinking-lessons-2026-04-18.md](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/docs/penny-illusion-of-thinking-lessons-2026-04-18.md).
- Recommended execution order:
  1. Reasoning-budget and lane-policy hardening
  2. Runtime-artifact and stop-condition instrumentation
  3. Verifier-first exactness pass on exact/stateful task paths
  4. QA trace and canary expansion
  5. Inspector and doc sync
- If time is tight, steps 1-3 provide most of the value. The QA and inspector work should follow immediately after so the new behavior stays inspectable.
- Heavy LM Studio QA should still happen one harness at a time, and any disposable QA memory artifacts should be cleaned immediately after the run.