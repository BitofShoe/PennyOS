# Penny Personality -> Runtime Voice Follow-through Plan

## Goal and success criteria

- Goal:
  Land the smallest useful runtime-voice refinement slice that better captures Penny's source-derived range without bloating the prompt stack or flattening her companion-first identity.
- User-facing or engineering success criteria:
  - Penny sounds more exact, more varied, and more personally present.
  - The runtime teaches better reaction shape, repair, and nonsexual attachment.
  - The example bank covers more moods without growing much.
  - Honesty, recall shape, and boundedness stay intact.
- What will be considered done:
  - Runtime voice files are updated with a minimal, high-signal diff.
  - A small QA pass confirms no generic-assistant drift and no obvious over-regularization.
  - The total prompt bundle stays close to current size.

## Decisions already locked

- Constraint or decision:
  Do not edit runtime voice files in this pass. This plan is for the next pass only.
- Constraint or decision:
  Preserve Penny as companion-first, local-first, bounded, and non-generic.
- Constraint or decision:
  Do not import raw source material or product-pitch language directly into live prompt context.
- Constraint or decision:
  Prefer one minimal coherent runtime patch over multiple layered prompt additions.

## Blind spots / what are we not considering?

- Unknown or risk:
  Model choice still changes voice quality a lot. A prompt improvement that helps Q8-off may read differently on Q6.
- Adjacent system that could drift:
  Lane routing and example-slot holdback behavior can change the observed effect of example edits.
- What would make this plan wrong:
  If the real bottleneck is model behavior rather than prompt teaching, a text-only patch may have smaller gains than expected.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  - Personality source extraction: Bernoulli
  - Runtime operational-blend read: Raman
  - Runtime directives read: Meitner
  - Runtime examples read: Leibniz
  - Repo guardrails and prompt-cost constraints: Hilbert
  - Recent voice continuity and model context: Bohr
- QA inspection tasks and assigned subagents:
  - None in this docs-only pass. Future QA should stay chat-only and bounded.
- Doc mapping tasks and assigned subagents:
  - Consolidated into the gap report plus this plan.
- Single primary editor per file boundary:
  - `penny-operational-blend.md`: one editor
  - `penny-chat-directives.md`: one editor
  - `penny-voice-examples.md`: one editor
  - QA harness/docs follow-through: separate owner if needed

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
  - `docs/penny-personality-runtime-voice-gap-report-2026-04-19.md`
  - `penny-voice/runtime/penny-operational-blend.md`
  - `penny-voice/runtime/penny-chat-directives.md`
  - `penny-voice/runtime/penny-voice-examples.md`
  - `lib/penny-prompt-stack.js`
  - `PENNY_MODEL_EVAL.md`
- Commands to run:
  - `git diff -- penny-voice/runtime`
  - `npm run qa:voice:tiebreak` only after the bounded patch lands, if the change is large enough to justify it
  - a small manual chat-only prompt sweep on the current leading model and baseline model
- Ownership boundaries to confirm:
  - Keep live voice work inside `penny-voice/runtime/*`
  - Do not grow new prompt layers unless the small patch clearly fails
- Known risks:
  - Example-file growth can increase budget pressure
  - Too much new softness can flatten Penny
  - Too much new range can become prompt soup if not kept compact

## Proposed change set

- File or doc:
  `penny-voice/runtime/penny-chat-directives.md`
- Reason:
  This is the highest-leverage place to teach reaction shape, rhythm, and repair without adding lore.
- Expected impact:
  More exact-detail pounce, less generic spicy filler, better soft/helpful turns.

- File or doc:
  `penny-voice/runtime/penny-voice-examples.md`
- Reason:
  The current example bank is compact but over-concentrated in flirty / teasing / bossy one-liners.
- Expected impact:
  Better mode coverage per token: repair, reassurance, refusal, protectiveness, plainspoken help, delight.

- File or doc:
  `penny-voice/runtime/penny-operational-blend.md`
- Reason:
  A tiny grounding addition can keep the voice from drifting into performance or trope soup.
- Expected impact:
  Stronger companion-presence anchor without changing the overall blend.

- File or doc:
  `PENNY_MODEL_EVAL.md` or a small adjacent QA note, only if needed
- Reason:
  If a runtime patch lands, future QA should explicitly check the newly targeted moods.
- Expected impact:
  Better alignment between intended voice changes and how they are judged.

## Verification plan

- Automated checks:
  - No mandatory automated check for the docs-only report itself.
  - After a runtime patch, run the smallest useful chat-only verification pass before broader QA.
- Manual checks:
  - Prompt Penny with turns that require:
    - exact-detail pounce
    - nonsexual protectiveness
    - warm repair after bite
    - refusal / boundary-setting
    - plainspoken practical help
    - delight / awe / alive play
  - Compare current leading premium chat config (`Q8 thinking-off`) against the practical baseline (`Q6`).
- What should stay unchanged:
  - Honesty rules
  - Recall-shape rule
  - Anti-generic guardrails
  - Mild-possessive-only-if-welcome boundary
  - Overall prompt bundle size staying near current levels
- What would count as out-of-scope drift:
  - Adding lore or source explanation to runtime files
  - Broadening the patch into memory, routing, or public-doc rewrite work
  - Re-litigating model ranking instead of evaluating the voice patch

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  - In the next pass, possibly one or two chat-only QA artifacts
- What should be persisted:
  - The gap report
  - Any minimal QA note that records whether the patch helped
- What should be cleaned up before sign-off:
  - Disposable QA artifacts only if they pollute later testing
  - Do not leave the repo with vague "maybe better" guidance and no concrete notes

## Out-of-scope list

- Explicitly out of scope:
  Editing runtime voice files during this analysis pass
- Explicitly out of scope:
  Memory-architecture changes
- Explicitly out of scope:
  Public-product-doc rewrites
- Explicitly out of scope:
  Broad model-selection debates beyond the already documented `Q8 thinking-off` / `Q6` context

## Notes

- Best first-pass runtime additions:
  - reaction-first detail mirroring
  - short-clause rhythm for sharp modes
  - quick repair after bite
  - nonsexual attachment / protectiveness
  - example swaps for reassurance, refusal, repair, delight, and plainspoken help
- Best first-pass runtime non-additions:
  - more lore
  - more safety/policy mass
  - bigger example sprawl
  - explicit screenshot-chasing language
- Keep the patch narrow enough that, if it works, it can become the new floor rather than another experimental branch of prompt clutter.
