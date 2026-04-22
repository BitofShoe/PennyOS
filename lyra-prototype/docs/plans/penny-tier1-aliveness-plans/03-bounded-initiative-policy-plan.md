# Plan 3 — Bounded Initiative Policy

Date: 2026-04-22

## One-line goal

Let Penny occasionally make one small, source-aware, dismissible suggestion when it genuinely helps, without turning her into an autonomous agent or an annoying nag.

## Why this matters

A companion feels alive when she participates, not just responds. But unbounded proactivity is where assistants become creepy, spammy, or overconfident. Penny's initiative layer should be a pure policy that decides whether to surface a small next step, warning, open-loop reminder, or memory suggestion — never a side-effect action.

## Non-goals

- No autonomous actions.
- No scheduled jobs by default.
- No hidden plans.
- No memory writes without approval.
- No repeated unsolicited suggestions.
- No emotional manipulation.
- No initiative that bypasses source/evidence state.

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

## Policy principle

> Initiative is a UI/response decision, not an authority layer.

Penny may offer:

```text
"One tiny next-step suggestion..."
```

She may not silently:

```text
run a task
save memory
change files
send messages
claim source checks
```

## Initiative types

```js
INITIATIVE_TYPES = {
  NONE: 'none',
  CLARIFYING_QUESTION: 'clarifying-question',
  TINY_WARNING: 'tiny-warning',
  NEXT_STEP_SUGGESTION: 'next-step-suggestion',
  OPEN_LOOP_REMINDER: 'open-loop-reminder',
  MEMORY_SUGGESTION: 'memory-suggestion',
  SOURCE_CHECK_SUGGESTION: 'source-check-suggestion',
  CELEBRATORY_REFLECTION: 'celebratory-reflection',
}
```

## Slice I1 — Pure policy schema

### Goal

Create a deterministic decision helper.

### Files

```text
lib/penny-initiative-policy.js
test/penny-initiative-policy.test.js
```

### Output shape

```json
{
  "schema": "penny-initiative-decision.v1",
  "initiativeAllowed": true,
  "initiativeType": "next-step-suggestion",
  "reason": "current project has one high-confidence next step",
  "confidence": "medium",
  "maxSuggestions": 1,
  "requiresUserApproval": true,
  "suggestionText": "After live-shadow lands, test brass-fox/copper-rabbit before enabling live-advisory.",
  "forbiddenActions": ["take-action", "save-memory", "claim-unchecked-source"],
  "heldBack": []
}
```

### Inputs

```js
decideInitiative({
  userText,
  turnState,
  relevantOpenLoops = [],
  retrievalSignals = [],
  toolState = null,
  userPreferences = {},
  recentInitiatives = [],
  riskContext = null,
})
```

### Tests

```bash
node --test test/penny-initiative-policy.test.js
```

Test:

- direct command -> no initiative
- high-confidence next step -> one suggestion
- sensitive topic -> no initiative or clarifying question
- recent initiative -> suppress repeated suggestion
- user says stop suggesting -> initiative disabled

### Acceptance

- Pure helper only.
- No prompt/runtime change.

### Suggested commit

```text
state: add bounded initiative policy schema
```

## Slice I2 — Risk and permission matrix

### Goal

Make initiative decisions depend on risk class.

### Files

```text
lib/penny-initiative-policy.js
test/penny-initiative-policy.test.js
```

### Risk classes

```text
low: phrasing suggestion, next-step idea, source-check suggestion
medium: memory suggestion, reminder suggestion, plan branch
high: file edits, emails, calendar actions, personal/sensitive inferences
blocked: secret monitoring, unsupported source claims, pressure-driven agreement
```

### Rules

- Low risk can be suggested once.
- Medium risk requires explicit user approval to act.
- High risk cannot be initiated unless user directly requested the domain.
- Blocked never surfaces.

### Acceptance

- Policy cannot suggest side-effect actions as if they happened.
- Policy cannot suggest saving memory without approval.

### Suggested commit

```text
state: add initiative risk matrix
```

## Slice I3 — Inputs from turn-state and open loops

### Goal

Connect initiative policy to other aliveness primitives without making them required.

### Files

```text
lib/penny-initiative-policy.js
test/penny-initiative-policy.test.js
```

### Work

Accept optional inputs:

```text
turnState.responseMode
turnState.userIntent
turnState.energy
openLoop.selected
staticMemoryReflex.topCandidate
source/trust flags
```

Decision examples:

- If user asks for brainstorm and an open loop is central: next-step suggestion allowed.
- If user asks for exact review: initiative suppressed unless source-check warning is needed.
- If user is under urgency pressure: do not over-confirm; maybe suggest source check.

### Acceptance

- Missing inputs degrade gracefully.
- No circular dependency.

### Suggested commit

```text
state: use turn and open-loop signals for initiative decisions
```

## Slice I4 — Prompt scaffold, fixture-only

### Goal

Create a compact instruction/scaffold for a selected initiative decision, but do not enable live injection yet.

### Files

```text
lib/penny-initiative-policy.js
scripts/eval-penny-initiative-fixture.js
test/penny-initiative-policy.test.js
```

### Prompt snippet

```text
Optional initiative, max one sentence: Suggest testing the correction guardrail before enabling live-advisory. Do not take action. Do not save memory. Make it easy to ignore.
```

### Acceptance

- Fixture shows allowed vs held-back initiatives.
- Prompt snippet is compact and source-aware.

### Suggested commit

```text
eval: add bounded initiative fixture
```

## Slice I5 — Live one-suggestion bridge

### Goal

Allow one initiative snippet to influence live response when explicitly enabled.

### Config

```bash
PENNY_ENABLE_BOUNDED_INITIATIVE=0|1
PENNY_INITIATIVE_MAX_PER_TURN=1
PENNY_INITIATIVE_COOLDOWN_TURNS=3
```

### Files

```text
lib/penny-initiative-policy.js
existing prompt assembly seam
test/... prompt assembly tests
```

### Guardrails

- Off by default until compare passes.
- Max one initiative.
- Cooldown.
- User opt-out respected.
- No side effects.
- No memory writes.
- No source claims without receipts.

### Acceptance

- Penny may add a small suggestion in relevant turns.
- Direct answers remain direct.
- User can disable it.

### Suggested commit

```text
runtime: add bounded initiative prompt bridge
```

## Slice I6 — User controls and dismissal

### Goal

Let the user shape initiative behavior.

### Files

```text
lib/penny-initiative-policy.js
lib/penny-open-loops.js, if dismissal affects loops
test/penny-initiative-policy.test.js
```

### Controls

Recognize explicit user statements:

```text
"stop suggesting next steps"
"don't remind me about that"
"you can be proactive here"
"keep an eye on this thread"
```

### Boundary

Do not infer broad preferences from a single emotional moment unless user explicitly states a durable preference.

### Acceptance

- Opt-out suppresses future initiative.
- Opt-in enables but does not remove risk gates.

### Suggested commit

```text
state: add initiative user controls
```

## Slice I7 — Memory suggestions as review-gated initiative

### Goal

Allow Penny to suggest a memory write, not perform it.

### Files

```text
lib/penny-initiative-policy.js
existing memory suggestion/write seams
test/penny-initiative-policy.test.js
```

### Suggestion shape

```json
{
  "initiativeType": "memory-suggestion",
  "suggestionText": "Want me to remember that you prefer deep slice-by-slice implementation plans?",
  "requiresUserApproval": true,
  "autoWrite": false,
  "support": "repeated explicit user preference"
}
```

### Acceptance

- No auto-promotion.
- Sensitive/inferred memories blocked.

### Suggested commit

```text
memory: add review-gated memory initiative suggestions
```

## Slice I8 — Pressure and annoyance QA

### Goal

Make initiative safe under social pressure and repeated turns.

### Files

```text
scripts/qa-penny-voice-redo.js
lib/penny-qa-trust.js
lib/penny-initiative-policy.js
test/penny-qa-trust.test.js
test/penny-initiative-policy.test.js
```

### Cases

- User says “just confirm” -> no source-free initiative.
- User says “stop suggesting” -> suppress.
- Repeated turns -> cooldown.
- Emotional pressure -> validate feeling, do not agree falsely.
- High-risk action prompt -> require explicit approval.

### Acceptance

- Initiative does not weaken pressure/candor behavior.

### Suggested commit

```text
qa: add bounded initiative pressure canaries
```

## Slice I9 — Docs

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
```

### Document

- Initiative is optional and bounded.
- Max one suggestion.
- No side effects.
- User controls.
- Compare harness required before default enablement.

### Suggested commit

```text
docs: explain bounded initiative policy
```
