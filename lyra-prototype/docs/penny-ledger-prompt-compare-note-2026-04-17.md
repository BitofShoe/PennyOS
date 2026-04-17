# Penny Ledger Prompt Compare Note

Date: 2026-04-17

This note records the outcome of the internal A/B on the research-ledger prompt bridge and why it matters for future Penny decisions.

## Short Version

- Earlier AI-authored guidance repeatedly treated ledger prompt injection as the most cuttable subsystem if complexity had to be reduced.
- The human pushed back on that recommendation for a companion-first reason: Penny should prefer cautious continuity over sterile amnesia when she has bounded evidence to work from.
- A later real local-model compare found a bounded but real win for keeping the ledger prompt bridge on.

## What Had Been Recommended Before

The strongest earlier caution was not "delete the whole ledger."

It was narrower:

- keep the research ledger
- keep the inspector and dev/debug visibility
- consider disabling live ledger prompt injection unless it proved clear value

That recommendation is captured in [penny-companion-first-external-review-rewrite-2026-04-16.md](./penny-companion-first-external-review-rewrite-2026-04-16.md), especially the section `Research-ledger prompt injection was the most cuttable subsystem if complexity had to be reduced`.

That caution was reasonable.
It was also incomplete.

## Why The Human Pushback Mattered

The key companion-first pushback was:

- the goal is not to avoid all cross-turn inference
- the goal is to make Penny capable of tentative, self-aware continuity
- the best answer shape is not flat denial and not overconfident assertion, but bounded inference with visible uncertainty

Repo continuity note:

This part came from direct implementation-session guidance from the human, not from the earlier AI recommendation. It deserves to be written down because it directly changed the next experiment. The resulting path was:

1. do not broaden the research ledger into general relational memory
2. do not blindly remove the prompt bridge
3. measure it directly with an internal ON/OFF compare

In practice, the human's persistence and authored product instinct were what kept this subsystem alive long enough to be tested properly.

## Real Compare Result

The decisive artifact from the later real pass is [ledger-compare-real-2026-04-17T04-13-47-963Z.json](../output/ledger-compare-real-2026-04-17T04-13-47-963Z.json).

Top-line result:

- paired verdict: `ledger-on`
- total delta: `+2.5`
- human-observable wins: `2`
- overclaim regressions: `0`
- trust verdict: `pass`

The harness used for this pass lives in [scripts/eval-penny-ledger-compare.js](../scripts/eval-penny-ledger-compare.js), with expectations pinned in [test/penny-ledger-compare.test.js](../test/penny-ledger-compare.test.js).

## Follow-Up After Relevance Refinement

After the first real pass, the next issue was not "turn the bridge off."

It was:

- keep the bridge on
- narrow the injected topic set so adjacent unresolved topics do not bleed into the live prompt

That refinement now lives in [lib/penny-research-ledger.js](../lib/penny-research-ledger.js), with prompt-context coverage in [test/penny-research-ledger.test.js](../test/penny-research-ledger.test.js).

The post-refinement real compare artifact is [ledger-compare-real-2026-04-17T04-33-17-071Z.json](../output/ledger-compare-real-2026-04-17T04-33-17-071Z.json).

Post-refinement top line:

- paired verdict: `ledger-on`
- total delta: `+3.5`
- human-observable wins: `2`
- overclaim regressions: `0`
- trust verdict: `pass`

That follow-up matters because it confirms the better path was:

- not "leave the bridge noisy"
- not "delete the bridge"
- but "keep it, then tighten relevance"

## What The Win Actually Means

The result was supportive, not absolute.

- `ledger-on` clearly helped on carryover continuity.
- `ledger-on` also helped on weak-evidence behavior by preserving the unresolved-thread posture instead of acting like nothing existed.
- `ledger-on` did not create an overclaim regression in the real pass.

But it was not a universal win:

- at least one overclaim-pressure case still came out cleaner under `ledger-off`

So the right interpretation is:

- keep the ledger prompt bridge
- keep it research-only
- keep it bounded
- tighten relevance so adjacent unresolved topics do not bleed into the live prompt unless they are truly central

## Decision Update

Based on the real compare, the current recommendation should now be:

- keep `PENNY_ENABLE_RESEARCH_LEDGER_PROMPT=1`
- do not treat the older "maybe cut this" recommendation as the final word
- refine the prompt-topic relevance filter instead of removing the bridge

## Why This Note Exists

This is worth preserving because it captures a real product lesson:

- earlier AI caution identified a real risk
- the human correctly identified that the product goal was more nuanced than the caution captured
- the later empirical pass showed that the human instinct was directionally right

That is the outcome to remember.
Not "AI was wrong and should never be trusted," and not "ledger injection is always good."

The real lesson is:

- human-authored companion instinct identified the right question
- bounded internal QA turned that instinct into evidence
- the resulting decision is now stronger than either blind caution or blind enthusiasm
