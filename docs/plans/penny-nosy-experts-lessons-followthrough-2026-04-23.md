# Penny Nosy Experts Lessons Follow-through Plan

> Category: Implementation plan
> Authority: Draft follow-through plan
> Status: Draft as of 2026-04-23
> Use this for: choosing bounded Penny and agent-workflow slices inspired by the Reddit "Nosy Experts" discussion.
> Do not use this for: proof that any slice shipped, permission to add fake internal reviewer personas to live runtime, or permission to widen PromptTruth, `toolEvidenceReceipt`, runtime voice, or prompt limits.

## Purpose

This plan translates the useful part of the Reddit thread into Penny-native follow-through:

- Source thread: <https://www.reddit.com/r/SillyTavernAI/comments/1sku7ak/anyone_else_have_an_unhealthy_obsession_with_ooc/>
- Comment-tree JSON used for analysis: <https://www.reddit.com/r/SillyTavernAI/comments/1sku7ak/anyone_else_have_an_unhealthy_obsession_with_ooc/.json?sort=top>

The core move is not "give Penny two fake internal reviewers."

The core move is:

- separate steering and revision from delivered output;
- keep correction patterns inspectable enough to prevent repeated mistakes;
- prefer the smallest scaffolding that works;
- keep any steering layer explicit, bounded, compare-tested, and easy to turn off.

This plan keeps only the ideas that survive Penny's current law:

- single-user local prototype;
- companion-first, not generic agent platform;
- explicit memory canonical;
- advisory bridges opt-in, capped, and non-canonical;
- PromptTruth and `toolEvidenceReceipt` separate;
- helper-owned slices before broad `server.js` or `public/js/penny-app.js` growth.

## Translation Rule

Keep the control pattern. Drop the theater.

Ideas worth carrying forward:

- Separate "steering" from "speaking."
- Give rewrite and correction flows a cleaner shape than raw OOC-style nudges.
- Preserve enough correction trace to stop the same mistake from immediately recurring.
- Keep the minimal core and demote optional wrapper machinery.
- Treat long-form drafting as a special mode, not as Penny's default way of chatting.

Ideas explicitly rejected from the source thread:

- Fake named internal reviewers in live runtime.
- Story-queue fiction.
- Hidden committee chatter or stored internal debate.
- Larger default prompts just to support the framing.
- Default multi-agent or corporate-hierarchy simulation inside Penny.
- Conflating "advisory steering worked in one model" with "this is now runtime law."

## Current-Law Anchors

Read these before implementing any slice below:

- [docs/README.md](../README.md)
- [README.md](../../README.md)
- [CODEBASE.md](../../CODEBASE.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md](../penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md)
- [docs/plans/penny-session-reflection-plan-2026-04-22.md](./penny-session-reflection-plan-2026-04-22.md)
- [AGENTS.md](../../AGENTS.md)
- [TEMPLATE.md](./TEMPLATE.md)

If code, tests, runtime artifacts, or contract docs disagree with this plan, trust those first and revise the next slice.

## Sequence Overview

| Chat | Slice | What we are actually trying to gain | Main owners | Verification shape |
| --- | --- | --- | --- | --- |
| 1 | NE1 | A better long-discussion review workflow for project agents | `.codex/skills/`, `docs/plans/`, `docs/README.md` | Docs-only: `git diff --check` |
| 2 | NE2 | A cleaner steer-revise-resend protocol for project agents | `AGENTS.md`, `.codex/skills/`, `docs/plans/TEMPLATE.md` | Docs-only: `git diff --check` |
| 3 | NE3 | A compare-only editorial steering bridge for long-form Penny turns | `lib/`, `scripts/`, tests | Fixture compare plus targeted tests |
| 4 | NE4 | A reply-level review-trace summary if any steering bridge lands | `lib/`, `public/js/`, tests | Targeted tests and browser smoke if UI changes |
| 5 | NE5 | An opt-in drafting mode only if the compare slice clearly wins | `lib/`, `public/js/`, docs, tests | Targeted tests, compare receipts, browser smoke |

## Chat 1 / Slice NE1 - Long Discussion Review Workflow For Agents

### Goal

Turn the repo's existing external-link workflow into something that handles one long discussion thread cleanly, especially Reddit-style threads with lots of comments, clarifications, edits, duplicates, and "the real idea is smaller than the original writeup" situations.

### Why this survives translation

The source thread itself needed this treatment:

- the first post looked larger and more elaborate than the core idea really was;
- the comments contained the most important corrections;
- the "real lesson" lived in the gap between the original writeup and the later simplifications.

Penny's agents should have a reusable workflow for that shape.

### Deliverable

Create or extend workflow guidance so a future agent reviewing one long thread explicitly captures:

- source health and duplicate-thread resolution;
- the post's headline claim;
- what the comments clarified, weakened, or simplified;
- the minimal core pattern;
- optional scaffolding that should not be mistaken for the core pattern;
- what applies to Penny;
- what applies only to agent workflow;
- what should not be added.

### Likely owners

- [.codex/skills/penny-link-review/SKILL.md](../../.codex/skills/penny-link-review/SKILL.md)
- [docs/plans/TEMPLATE.md](./TEMPLATE.md)
- [docs/README.md](../README.md)

### Verification

- `git diff --check`

### Non-goals

- No runtime behavior changes.
- No PromptTruth or `toolEvidenceReceipt` changes.
- No memory changes.
- No Reddit-specific code or ingestion path.

### Suggested kickoff prompt

```md
Please extend Penny's external-link review workflow so it handles a single long discussion thread well, especially Reddit-style threads.

Goal:
- Add explicit guidance for "core mechanism vs optional scaffolding"
- Add comment-clarification tracking
- Add duplicate-thread/comment-count drift handling
- Keep the output Penny-native and anti-platformization

Touched owners:
- .codex/skills/penny-link-review/SKILL.md
- docs/plans/TEMPLATE.md
- docs/README.md only if the index needs a wording tweak

Constraints:
- Docs/process only
- No runtime edits
- No source ingestion
- Keep the buckets consistent with the existing link-review workflow

Verification:
- git diff --check
```

## Chat 2 / Slice NE2 - Steer, Revise, Resend Protocol For Agents

### Goal

Codify a repo-native workflow for revision-heavy tasks so project agents separate steering from final delivery without resorting to fake internal personas or hidden "committee" framing.

### Why this survives translation

This is the strongest general lesson from the thread:

- raw OOC-style steering is often sloppy;
- a separate correction channel can improve rewrites;
- keeping the correction path visible helps prevent repeated mistakes.

For Penny's coding/docs agents, the clean translation is a protocol, not a character gimmick.

### Deliverable

Add guidance that, for rewrite or correction-heavy tasks, agents should:

- state when they are in correction/revision mode;
- keep user-facing delivery separate from internal task steering;
- preserve "mistake -> correction -> fixed result" in receipts, artifacts, or handoff notes when it matters;
- prefer targeted rewrites over starting over when only one portion failed;
- never launder failed reads/tests/edits into a polished "done" claim.

### Likely owners

- [AGENTS.md](../../AGENTS.md)
- [.codex/skills/README.md](../../.codex/skills/README.md)
- [docs/plans/TEMPLATE.md](./TEMPLATE.md)

### Verification

- `git diff --check`

### Non-goals

- No new runtime feature for Penny yet.
- No fake expert voices.
- No hidden reasoning retention.
- No broad subagent policy rewrite beyond the correction-flow seam.

### Suggested kickoff prompt

```md
Please add a small repo-native "steer, revise, resend" workflow for Penny agents.

What to add:
- Distinguish correction mode from final delivery
- Keep receipts for failed reads/tests/edits instead of smoothing them over
- Encourage targeted rewrites and partial fixes
- Preserve the useful "mistake -> correction -> fixed result" pattern in artifacts/handoffs when relevant

Touched owners:
- AGENTS.md
- .codex/skills/README.md
- docs/plans/TEMPLATE.md if a plan-field tweak helps

Constraints:
- Process/docs only
- Do not introduce fake reviewer personas
- Do not change Penny runtime semantics

Verification:
- git diff --check
```

## Chat 3 / Slice NE3 - Compare-Only Editorial Steering Bridge For Long-Form Turns

### Goal

Test a tiny, explicit steering layer for long-form drafting or rewrite turns so Penny can accept compact revision guidance without dragging that pattern into normal companion chat.

### Why this survives translation

The direct product lesson is not "Penny needs Matt and Amy."

It is:

- some long-form tasks benefit from a small, separate steering note;
- rewrite or reflect-only turns should be allowed without pretending the user wants normal back-and-forth chat;
- smaller scaffolding is probably stronger than a full internal story queue.

### Shape of the feature

The safest Penny-native shape is:

- one compact editorial-steering note;
- explicit opt-in or direct drafting intent only;
- long-form drafting, rewriting, scene writing, essay shaping, or similar tasks only;
- may allow "rewrite," "reflect first," or "try again with this constraint";
- no named fake personas;
- no story queue;
- no memory writes;
- no hidden chain-of-thought retention;
- no PromptTruth expansion beyond a sibling advisory receipt if the note rendered.

### Likely owners

Prefer a new small helper instead of broad shell growth:

- `lib/penny-editorial-steering.js` or a similarly named helper
- `lib/penny-prompt-stack.js`
- `lib/penny-runtime-artifacts.js`
- `scripts/` compare harness, likely a new narrow compare rather than overloading existing broad evals
- targeted tests under `test/`

### Verification

Fixture-first compare:

- baseline
- compact editorial steering note
- deliberately too-verbose negative control

The compare should score for:

- rewrite quality;
- correction adherence;
- prompt cost;
- confusion or over-anchoring;
- whether the feature stays useful without becoming a default chat crutch.

### Non-goals

- No default enablement.
- No normal companion-chat behavior change.
- No memory authority change.
- No PromptTruth / `toolEvidenceReceipt` merge.
- No broader `server.js` growth.

### Suggested kickoff prompt

```md
Please inspect Penny's current turn-state / prompt-stack seams and design a compare-only editorial-steering bridge for long-form draft/rewrite turns.

Goal:
- One compact steering note for explicit drafting/rewrite use cases
- No fake personas
- No story queue
- No memory writes
- No PromptTruth expansion
- Compare artifact before any live/default adoption

Likely owners:
- lib/ helper owned slice
- lib/penny-prompt-stack.js
- lib/penny-runtime-artifacts.js
- tests
- a narrow compare harness in scripts/

Please produce:
- touched-owner map
- proposed helper shape
- compare modes
- verification commands
- explicit non-goals
```

## Chat 4 / Slice NE4 - Review-Trace Summary For Any Steering Bridge

### Goal

If an editorial steering bridge lands, make it inspectable in a quick reply-level summary rather than hiding it in opaque runtime behavior.

### Why this survives translation

One of the thread's genuinely good instincts is that correction context should be visible enough to stop repeated mistakes.

Penny should translate that as inspectable receipts, not as hidden roleplay.

### Deliverable

Add a compact reply-level summary showing:

- whether editorial steering was enabled;
- whether a steering note rendered or was held back;
- why it was held back if skipped;
- any compact reason codes that explain the result.

This should feel like the existing bounded-advisory surfaces:

- inspectable;
- local;
- small;
- clearly not memory;
- clearly not canonical truth.

### Likely owners

- `lib/penny-runtime-artifacts.js`
- `lib/penny-prompttruth.js` only if a tiny projection tweak is required
- `public/js/penny-memory-panel.mjs`

### Verification

- targeted `node --test` for touched helpers
- browser smoke if the inspector UI changes
- `git diff --check`

### Non-goals

- No full draft transcript history.
- No hidden internal debate viewer.
- No memory write or promotion path.
- No new authority layer.

### Suggested kickoff prompt

```md
If Penny gains a compact editorial-steering bridge, please add the smallest useful reply-level summary for it in the inspector/runtime-artifact surface.

Goal:
- Show on/off, rendered/held-back, and compact reason codes
- Keep it clearly advisory and non-memory
- Avoid a verbose draft-history viewer

Touched owners:
- lib/penny-runtime-artifacts.js
- public/js/penny-memory-panel.mjs
- lib/penny-prompttruth.js only if truly needed

Constraints:
- Small local summary only
- No new authority layer
- No PromptTruth expansion unless absolutely necessary and explicitly justified

Verification:
- targeted tests
- browser smoke if UI changes
- git diff --check
```

## Chat 5 / Slice NE5 - Opt-In Drafting Mode Only If The Compare Clearly Wins

### Goal

Expose a user-facing version of the feature only if the compare slice proves it is actually useful and does not distort normal chat.

### Why this survives translation

The thread points to a real use case:

- sometimes the user wants long-form drafting, watching, nudging, and rewriting;
- that is not the same as ordinary companion conversation.

If Penny should absorb that use case, it should do so explicitly and narrowly.

### Shape of the feature

Potential safe shape:

- explicit drafting mode, drafting command, or clear drafting intent path;
- only for writing-heavy tasks;
- steering note attached to that mode only;
- no default use in ordinary companion turns;
- easy to turn off;
- documented as a drafting aid, not as Penny's hidden internal committee.

### Likely owners

- `lib/penny-direct-intents.js`
- a small `public/js/` helper if UI plumbing is needed
- `public/js/penny-app.js` only as orchestration glue
- docs describing the mode once it is real

### Verification

- targeted tests for the intent/mode seam
- compare artifact from NE3
- browser smoke if a UI affordance lands
- `git diff --check`

### Non-goals

- No default runtime mode change.
- No ambient autonomous continuation.
- No memory promotion.
- No general "internal reviewers" feature for all chat.

### Suggested kickoff prompt

```md
Please inspect Penny's current direct-intent and UI seams and plan the smallest opt-in drafting mode that could sit on top of a proven editorial-steering bridge.

Goal:
- Explicit drafting-only use
- No default chat impact
- Easy to turn off
- No fake reviewer persona framing

Touched owners:
- lib/penny-direct-intents.js
- public/js/ helper first
- public/js/penny-app.js only for narrow orchestration
- docs only if the feature actually becomes real

Please produce:
- owner map
- minimal UI/intent shape
- verification path
- non-goals
```

## What This Source Should Not Become

Do not use this thread as justification for:

- runtime fake personas;
- hidden reviewer lore;
- bigger prompt stacks by default;
- more rendered memory or advisory context;
- chain-of-thought storage or inspection;
- agent-platform creep;
- multi-agent runtime theatrics inside Penny;
- replacing explicit memory with draft or revision state.

## Recommended Starting Point

If this follow-through is approved, the safest order is:

1. Chat 1 / NE1
2. Chat 2 / NE2
3. Chat 3 / NE3

Only continue to Chats 4 and 5 if Chat 3 produces clean compare evidence instead of just an interesting prompt trick.

## Notes

- This source is best treated as a control-pattern lesson, not a product doctrine.
- The parts that survive translation are mostly about bounded steering, receipts, and mode separation.
- The most dangerous failure mode is importing the vibe of "helpful internal experts" instead of the engineering lesson that steering should be explicit, inspectable, and limited.
