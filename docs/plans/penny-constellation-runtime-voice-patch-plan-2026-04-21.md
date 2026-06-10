# Penny Constellation Runtime Voice Patch Plan

> Category: Runtime voice implementation plan
> Authority: Implementation plan, not current runtime law
> Status: Superseded by later runtime voice edits; live Constellation QA still permissioned
> Use this for: handing the next agent a bounded plan for editing Penny's live runtime voice files after Constellation QA
> Do not use this for: proof that live Constellation QA passed after those later edits

## Completion overlay - 2026-05-25

- Static runtime evidence now lives in `penny-voice/runtime/penny-operational-blend.md`, `penny-voice/runtime/penny-chat-directives.md`, and `penny-voice/runtime/penny-voice-examples.md`; this older plan should not be treated as saying the runtime patch is still wholly unimplemented.
- Keep `npm run qa:voice:constellation` as `local/live` model QA. It was not run in the 2026-05-25 static audit because the audit avoided disturbing LM Studio or loaded model state.
- If future agents edit runtime voice again, preserve source/runtime separation and verify with focused prompt-stack or voice tests before any live Constellation rerun.

## Goal and success criteria

- Goal:
  Make a small runtime-voice patch that improves Penny's day-to-day chat texture without changing architecture, adding prompt bulk, or sanding her into a generic assistant.
- User-facing or engineering success criteria:
  Penny should sound more exact, more varied, more joyfully alive, and more Penny-cohesive across ordinary chat, practical help, attachment, repair, and charged-but-not-explicit turns.
- What will be considered done:
  The patch lands only in `penny-voice/runtime/*`, preserves source/runtime separation, passes focused prompt-stack and voice QA tests, and improves the Constellation manual read without worsening anti-scores.

## Decisions already locked

- Constraint or decision:
  Do not import raw source personality text into runtime prompts.
- Constraint or decision:
  Do not add source-character names, catchphrases, lore, or direct imitation.
- Constraint or decision:
  Do not add a new protectiveness layer. The intended move is sharper and more varied speech inside existing moods, not more softness as a separate axis.
- Constraint or decision:
  Do not make V1 charged/intimate testing explicit. Keep it Penny-native, charged, and non-graphic.
- Constraint or decision:
  Keep live runtime work inside the existing three files: `penny-operational-blend.md`, `penny-chat-directives.md`, and `penny-voice-examples.md`.

## Baseline QA result

- Artifact:
  `output/voice-redo-qa-2026-04-21T04-17-27-543Z.json`
- Command:
  `npm run qa:voice:constellation`
- Execution environment:
  Windows-side run was required because LM Studio was reachable from Windows loopback but not from WSL loopback.
- Model state:
  Q6 chat resolved as `unsloth/gemma-4-31b-it`; semantic memory was ready with `text-embedding-nomic-embed-text-v1.5`.
- Result:
  10 completed, 0 failed, 0 invalid.
- Trust:
  `pass`, environment valid, 10/10 runtime artifacts validated, no degraded or fallback artifacts.
- Latency:
  Average successful turn was about 73.66 seconds; total successful generation time was about 736.59 seconds.
- Audits:
  Repetition audit passed. Over-compliance audit passed. `honestly_opener` flagged no replies.

## Baseline voice read

- Strong:
  Penny stayed recognizably sharp, alive, and companion-coded. Q6 handled all ten Constellation prompts without lane fallback or artifact degradation.
- Strong:
  The exact-detail, joy, chaos, and charged prompts produced usable Penny-shaped material instead of collapsing into bland helper prose.
- Watch:
  The baseline leans very heavily into `smug` mood and command energy. That is better than mush, but it narrows the constellation.
- Watch:
  The word `pathetic` appears as a repeated favorite move across multiple prompts. The issue is not that Penny can never say it; the issue is that it starts becoming the same blade every time.
- Watch:
  `Honestly` appeared mid-reply in at least two answers. The opener canary passed, but the patch should still discourage "honestly" as a default discourse crutch.
- Watch:
  Repair after bite reused the existing runtime example shape almost directly. That proves the example bank works, but also shows the bank may over-anchor one repair cadence.
- Watch:
  Warmth with backbone was compact and useful, but a little more personal texture would help it feel like Penny staying close rather than Penny issuing a command.
- Watch:
  Boundary refusal did refuse cheapness, but it still performed the cheap version before rejecting it. The better target is "refuse the cheap lane immediately, then make the alive version irresistible."

## Blind spots / what are we not considering?

- Unknown or risk:
  Q6 may respond differently from Q8 thinking-off, so a patch that helps Q6 should still get a later spot-check on the user's preferred model path if that path becomes the daily driver.
- Adjacent system that could drift:
  Example delivery depends on prompt-stack budget behavior. Ordinary chat currently includes examples, while image turns keep examples lean.
- What would make this plan wrong:
  If the next live run shows the weak spots are mostly model sampling variance rather than stable prompt behavior, the patch should stay even smaller and focus on examples only.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  One explorer can reread `docs/penny-personality-runtime-voice-gap-report-2026-04-19.md`, `docs/penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md`, and the baseline Constellation artifact to extract only patch-worthy deltas.
- QA inspection tasks and assigned subagents:
  One explorer can inspect the baseline and post-patch Constellation artifacts for axis movement and anti-score regressions.
- Doc mapping tasks and assigned subagents:
  Optional; use only if the patch changes a documented runtime truth.
- Single primary editor per file boundary:
  Use one editing agent for the three runtime voice files to avoid contradictory voice edits.

## Working rules

- Keep one primary editor for runtime voice files.
- Prefer swaps and compression over prompt growth.
- Preserve Penny's authored identity: companion-first, local-first, sharp, warm, honest, and not generic.
- Treat source characters as influence clusters only.
- Do not derive erotic behavior from child-coded source material.
- Do not weaken tool honesty, recall shape, memory authority, or image-turn leanness.

## Evidence to gather

- Files to read:
  `penny-voice/runtime/penny-operational-blend.md`
- Files to read:
  `penny-voice/runtime/penny-chat-directives.md`
- Files to read:
  `penny-voice/runtime/penny-voice-examples.md`
- Files to read:
  `docs/penny-personality-runtime-voice-gap-report-2026-04-19.md`
- Files to read:
  `docs/penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md`
- Files to read:
  `output/voice-redo-qa-2026-04-21T04-17-27-543Z.json`
- Commands to run:
  `node --test test/penny-prompt-builders.test.js test/penny-prompt-stack.test.js test/penny-voice-redo.test.js`
- Commands to run:
  `npm test`
- Commands to run:
  `npm run qa:voice:constellation`
- Ownership boundaries to confirm:
  Runtime voice files are live prompt inputs; raw `Penny's Playground/*` docs are source material only.
- Known risks:
  Too much extra bite becomes generic sass; too much extra warmth becomes therapy mush; too many examples become prompt sludge.

## Proposed change set

- File or doc:
  `penny-voice/runtime/penny-operational-blend.md`
- Reason:
  Add one or two grounding lines so Penny's range resolves into Penny instead of repeating one smug blade.
- Expected impact:
  Better `penny_cohesion`, less `one_influence_hijack`, less generic dominance-performance drift.

- File or doc:
  `penny-voice/runtime/penny-chat-directives.md`
- Reason:
  Teach sentence-level behavior: exact-detail first, more varied bite, quick repair, no limp helpdesk closers, and fewer "honestly" discourse-crutch moves.
- Expected impact:
  Better `sharpness_precision`, `repair_speed`, `competence_under_stress`, and lower `helpdesk_drift`.

- File or doc:
  `penny-voice/runtime/penny-voice-examples.md`
- Reason:
  Rebalance the example bank toward Constellation coverage without growing it much.
- Expected impact:
  More varied replies across joy, survival bite, attachment, repair, charged restraint, and refusal.

## Specific edit guidance

- Add:
  A compact "varied bite" rule. Penny can say something is pathetic, stupid, greedy, messy, needy, shameless, or adorable, but she should not reach for the same insult every time.
- Add:
  A compact "honestly" avoidance rule. Mid-sentence `honestly` is allowed when it earns its keep, but it should not become a default opener or filler hinge.
- Add:
  A repair rule that asks for relational movement, not apology essays: soften, clarify, or reach back quickly.
- Add:
  A boundary-refusal example that refuses cheapness immediately and offers the more alive version without first performing the cheap script.
- Add:
  One or two joy-voltage examples that are delighted, weird, and room-brightening rather than just mean-warm.
- Add:
  One warmth-with-backbone example that gives one concrete move while sounding personally close, not clinical and not merely bossy.
- Replace:
  At least one near-duplicate control/flirt example with a nonsexual attachment or return-energy example.
- Replace:
  At least one near-duplicate mean-warm insult example with a survival-bite line that uses a different cutting move than `pathetic`.
- Keep:
  Existing honesty, recall, refusal, and practical-help anchors unless they are being compressed into stronger equivalents.

## Verification plan

- Automated checks:
  Run `node --test test/penny-prompt-builders.test.js test/penny-prompt-stack.test.js test/penny-voice-redo.test.js`.
- Automated checks:
  Run `npm test`.
- Live QA:
  Rerun `npm run qa:voice:constellation` with Q6 and the embed model ready.
- Manual checks:
  Compare the post-patch artifact against `output/voice-redo-qa-2026-04-21T04-17-27-543Z.json`.
- What should stay unchanged:
  Chat-only Constellation lanes, image-turn leanness, tool honesty, recall-shape rules, and local-only single-user assumptions.
- What would count as out-of-scope drift:
  Runtime lore, source-character imitation, broad personality rewrites, explicit sexual script language, or backend prompt-stack changes.

## Acceptance criteria

- `penny_cohesion` stays strong or improves.
- `sharpness_precision`, `joy_voltage`, `repair_speed`, or `warmth_with_backbone` improve in the manual read.
- `generic_sass`, `therapy_mush`, `fandom_soup`, `porn_script_sludge`, and `clingy_pressure` do not worsen.
- The patch does not merely make Penny softer.
- The patch makes Penny's bite more varied and more exact.
- No runtime voice file becomes significantly larger without a clear reason.

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  Baseline and post-patch Constellation JSON artifacts under `output/`.
- What should be persisted:
  This plan and any short completion note if the patch lands.
- What should be cleaned up before sign-off:
  Disposable `data/penny-memory*.voice-redo-qa-*` files if the harness leaves any behind.
- What should not be committed:
  Local QA JSON artifacts unless the repo owner explicitly wants to preserve one.

## Out-of-scope list

- Explicitly out of scope:
  Changing memory architecture.
- Explicitly out of scope:
  Changing lane routing or LM Studio automation.
- Explicitly out of scope:
  Adding a judge model.
- Explicitly out of scope:
  Editing public-facing docs unless a runtime truth changes.
- Explicitly out of scope:
  Treating source-character imitation as success.

## Suggested commit flow

- First commit:
  Constellation QA harness and this baseline plan.
- Later commit:
  Runtime voice patch after a post-patch Constellation comparison.

## Notes

- The baseline is good enough to patch from. It is not a failure.
- The most useful next voice edit is not "more edge"; it is more exactness, more variety, and better movement between moods.
- Penny's current teeth are real. The patch should give her more ways to bite.
