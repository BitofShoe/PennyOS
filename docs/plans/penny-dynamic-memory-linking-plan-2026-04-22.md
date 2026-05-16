# Penny Dynamic Memory Linking Current-Law Note

> Category: Implementation plan
> Authority: Current planning handoff for Slice L0
> Status: Docs/current-law note only; no runtime behavior changed
> Use this for: dynamic memory link boundaries, next-slice sequencing, and behavior-changed vs not-changed status.
> Do not use this for: proof that link scoring, graph storage, prompt rendering, PromptTruth changes, or memory authority changes shipped.

## Core Rule

A memory link is a retrieval/navigation hint, not proof that either side is true.

Dynamic memory links may later help retrieval, correction handling, open-loop resurfacing, session reflection, pulse prep, and candidate traces. They do not make advisory memories canonical, do not replace explicit memory, do not auto-promote candidate-only support, and do not create hidden graph authority.

## Current-Law Boundaries

- Explicit memory in `data/penny-memory.json` remains canonical.
- Archive, research-ledger, semantic, static, open-loop, reflection, and candidate-survival signals remain advisory unless an existing current-law contract says otherwise.
- Candidate survival and link traces are retrieval-path evidence, not answer-quality proof.
- PromptTruth remains prompt-time candidate/rendered/held-back memory and research context. Dynamic links do not expand PromptTruth.
- `toolEvidenceReceipt` remains sibling deterministic/provenance evidence. Dynamic links do not merge into it or broaden it.
- Runtime voice is unchanged.
- Prompt/rendered-memory limits are unchanged.
- `server.js` should not grow for this slice.
- No graph DB, vector DB rewrite, universal memory index, or broad source warehouse is implied.

## Behavior Changed Vs Not Changed

Changed in Slice L0:

- High-level docs now state the dynamic memory linking rule plainly.
- This note records the L0 guardrails and next-slice order.
- The docs index routes future agents to the current-law note before implementation.

Not changed in Slice L0:

- No runtime code.
- No tests beyond docs/whitespace verification.
- No live prompt bridge.
- No archive ranking change.
- No memory store migration.
- No PromptTruth or `toolEvidenceReceipt` change.
- No runtime voice change.
- No broad project-thread, open-loop, research-pattern, static, semantic, or candidate-only link scoring.

## Safe Slice Order

1. L1: Add schema and pure helpers for inspectable `penny-memory-links.v1` link sets.
2. L2: Add deterministic correction-link builders for current-vs-stale cases.
3. L3: Attach bounded link metadata to candidate traces without scoring changes.
4. L4: Add fixture QA so links are inspectable and behavior remains unchanged.
5. L5: Add scoring shadow only.
6. L6: Report link effects in candidate-survival artifacts without treating links as verified support.
7. L7: Activate only conservative correction-link scoring behind a gate, if tests and QA support it.
8. L8-L9: Keep reflection, project-thread, open-loop, and research-pattern links review-gated or shadow until separately measured.
9. L10: Update docs/status after code and QA land.

## Activation Rules

The only relation class eligible for later active scoring is current-vs-stale correction linking, and only behind a gate such as `PENNY_MEMORY_LINK_SCORING=correction-v1` after schema, fixture, shadow, and candidate-survival tests pass.

Disallowed active effects until separately measured:

- same-project-thread boosting
- research-pattern boosting
- open-loop boosting
- static-candidate support upgrades
- semantic-candidate support upgrades
- candidate-only truth upgrades
- advisory memory promotion

## Future Owner Seams

Future implementation should stay helper-owned:

- `lib/penny-memory-links.js` for schema, normalization, summaries, and bounded traces.
- `lib/penny-memory-link-policy.js` for scoring and authority rules.
- `lib/penny-memory-archive-policy.js` only after shadow scoring proves useful.
- `lib/penny-memory-archive.js` only for bounded trace attachment or gated policy integration.
- `lib/penny-candidate-survival-qa.js` and QA scripts for link-effect artifacts.
- `lib/penny-session-reflection.js` only for review-gated advisory link suggestions.

Do not use this plan as a reason to grow `server.js`, change prompt voice assets, import a graph database, or build a universal memory index.

## Verification Plan

For L0:

```bash
git diff --check
```

For later code slices, run the focused tests listed in `docs/plans/penny-post-tier1-bounded-aliveness-plans/03-dynamic-memory-linking-plan.md` plus `git diff --check` before committing each slice.

## Handoff

Next slice should be L1, not L7. Start with schema and fixture traces, then add correction-link shadows. Treat project-thread, open-loop, and research-pattern links as advisory/shadow until measured separately.
