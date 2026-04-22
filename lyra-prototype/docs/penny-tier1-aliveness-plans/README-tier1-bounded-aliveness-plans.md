# Penny Tier 1 Bounded Aliveness Plans — Agent Handoff Index

Date: 2026-04-22

> Category: Implementation-plan bundle
> Authority: Implementation plan
> Status: Current planning handoff, not proof of shipped behavior
> Use this for: Tier 1 bounded-aliveness slice selection, guardrails, and next-agent prompts
> Do not use this for: current runtime law, default feature enablement, PromptTruth expansion, or proof that any listed slice has landed without checking code/tests/artifacts

This bundle turns the Tier 1 bounded-aliveness roadmap into five handoff-ready implementation plans:

1. **Live Static Memory Reflex** — static embeddings as a live turn-time candidate-discovery sidecar, not truth authority.
2. **Open-Loop Tracker** — advisory project/session continuity that helps Penny remember unresolved threads without pretending they are canonical facts.
3. **Bounded Initiative Policy** — a small pure policy that lets Penny make one useful, dismissible, source-aware suggestion when appropriate.
4. **Ephemeral Turn-State Card** — a structured current-turn scaffold for intent, energy, desired depth, active constraints, and response mode.
5. **Aliveness Compare Harness** — an evaluation harness that measures human-observable wins against overclaim, annoyance, latency, and prompt-bloat regressions.

These plans are intentionally separate. Do not hand an implementation agent all five as one mega-slice. Use one plan, one slice, one commit.

## Global Penny constraints for agents

Use these constraints for every slice in this plan:

- Penny is a single-user local companion prototype, not a generic agent platform.
- Do not optimize for hosted, multi-user, SaaS, tenancy, connector-marketplace, or distributed-platform concerns unless a slice explicitly names an immediate local risk.
- Explicit memory is canonical. Archive, research ledger, semantic/static retrieval, source summaries, and open-loop state are advisory unless a current repo contract says otherwise.
- PromptTruth remains prompt-time rendered/candidate memory/research context. Do not add raw candidate traces, tool outputs, document receipts, or initiative decisions as PromptTruth channels.
- `toolEvidenceReceipt` remains a sibling runtime artifact. Do not merge it into PromptTruth.
- Do not add hidden-state, activation, neuron-level, semantic-geometry, or chain-of-thought runtime receipts.
- Do not change runtime voice/personality by default. Response-mode scaffolding may help Penny choose tone/structure, but it must not rewrite the companion voice.
- Do not increase default rendered-memory or prompt-context limits as an aliveness shortcut.
- Do not auto-promote retrieval hits, static embedding hits, open loops, reflections, or generated summaries into canonical explicit memory.
- Keep `server.js` thin. Put behavior in named `lib/` helpers, scripts, and tests.
- Prefer fixture/unit artifacts before live behavior changes.
- Every live-ish feature needs a kill switch, traceability, and regression tests for overclaim, stale-memory resurrection, and annoyance.

## Recommended build order

The safest and most exciting order is:

```text
1. Live static memory reflex, through live-shadow first.
2. Ephemeral turn-state card, fixture/prompt-bridge only.
3. Open-loop tracker, advisory state plus fixture bridge.
4. Bounded initiative policy, pure helper then one-suggestion bridge.
5. Aliveness compare harness, then use it to decide which live bridges stay on.
```

Why this order:

- Static reflex supplies fast live memory cues.
- Turn-state explains what the current user moment is asking for.
- Open loops provide continuity targets.
- Initiative policy decides whether to surface anything beyond the direct answer.
- The compare harness keeps the whole stack honest.

## North-star sentence

> Penny should feel alive because she notices, remembers, follows through, and times small helpful moves well — not because she treats weak evidence as certainty, bloats the prompt, or takes initiative the user did not grant.

## Source-aligned rationale

The April 21 link-batch research note says Penny should prefer scoped context, tool/source receipts, Penny-shaped evals, token-cost awareness, raw-source/synthesis separation, and pressure canaries over broad platform imports. The ledger compare note shows the companion-first lesson: bounded continuity can beat sterile amnesia when it is measured and relevance is tightened. The sharper candidate-selection plan says static embeddings are useful as cheap discovery machinery, but not truth authority, memory promotion, or prompt-bloat justification.

## Artifact naming suggestions

Use clear, versioned schemas:

```text
penny-static-memory-reflex.v1
penny-open-loop-state.v1
penny-initiative-decision.v1
penny-turn-state.v1
penny-aliveness-compare.v1
```

## Repo-seam overview

Likely owner seams across the five plans:

```text
lib/penny-static-shadow-embeddings.js
lib/penny-embedding-providers.js          // new or expanded
lib/penny-static-memory-index.js          // new
lib/penny-memory-archive.js
lib/penny-memory-archive-policy.js
lib/penny-candidate-survival-qa.js

lib/penny-turn-state.js                   // new
lib/penny-open-loops.js                   // new
lib/penny-initiative-policy.js            // new
lib/penny-aliveness-qa.js                 // new

scripts/qa-penny-memory.js
scripts/eval-penny-runtime-fit.js
scripts/eval-penny-aliveness-compare.js   // new

test/penny-static-shadow-embeddings.test.js
test/penny-embedding-providers.test.js
test/penny-static-memory-index.test.js
test/penny-turn-state.test.js
test/penny-open-loops.test.js
test/penny-initiative-policy.test.js
test/penny-aliveness-qa.test.js
test/penny-aliveness-compare.test.js
```

## Universal acceptance gates

Before any Tier 1 feature becomes live by default, it must pass:

```text
- no PromptTruth expansion
- no toolEvidenceReceipt merge
- no default prompt/rendered-memory limit increase
- no automatic explicit-memory writes
- no stale correction resurrection
- no candidate-only truth laundering
- no unsupported source/action claims
- no material latency regression without an explicit opt-in
- no recurring annoyance in initiative/open-loop surfacing
- all new live bridges have env/config kill switches
```
