# Plan 4 — Ephemeral Turn-State Card

Date: 2026-04-22

## One-line goal

Give Penny a compact, current-turn state card that helps her choose the right response mode, constraints, and continuity cues without storing private inferences or inventing hidden thoughts.

## Why this matters

Aliveness is timing plus context. Penny often needs to know whether the user wants a surgical patch, an excited brainstorm, a deep review, or a gentle check-in. A turn-state card gives the model a small structured scaffold for the current moment.

This is not chain-of-thought. It is not secret selfhood. It is an explicit, inspectable prompt scaffold.

## Non-goals

- No hidden chain-of-thought receipt.
- No psychological profiling.
- No automatic storage.
- No truth authority.
- No personality rewrite.
- No broad sentiment surveillance.

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

## Schema sketch

```json
{
  "schema": "penny-turn-state.v1",
  "measurementMode": "ephemeral",
  "persist": false,
  "userIntent": "turn Tier 1 aliveness ideas into agent-ready slice plans",
  "desiredDepth": "extensive",
  "responseMode": "technical-roadmap",
  "energy": {
    "label": "excited",
    "confidence": "medium",
    "evidence": ["enthusiastic phrasing", "explicit request for detailed plans"]
  },
  "activeProjectThread": "bounded aliveness Tier 1",
  "activeConstraints": [
    "single-user local prototype",
    "explicit memory canonical",
    "PromptTruth unchanged",
    "no runtime voice rewrite"
  ],
  "sourcePosture": "planning-from-current-repo-not-live-proof",
  "openLoopsTouched": ["static memory reflex", "open-loop tracker"],
  "suggestedResponseShape": "five markdown plans with slices and acceptance gates",
  "warnings": []
}
```

## Slice T1 — Pure schema and normalizer

### Goal

Create the turn-state object and helper functions. No live prompt change.

### Files

```text
lib/penny-turn-state.js
test/penny-turn-state.test.js
```

### Exports

```js
TURN_STATE_SCHEMA = 'penny-turn-state.v1'
normalizeTurnState(stateLike)
buildTurnState(input)
summarizeTurnState(state)
```

### Tests

```bash
node --test test/penny-turn-state.test.js
```

Test:

- defaults to `persist:false`
- rejects hidden-CoT fields
- normalizes intent/depth/response mode
- energy confidence can be unknown
- active constraints are strings with source labels where possible

### Acceptance

- Turn-state is ephemeral by design.
- No memory writes.

### Suggested commit

```text
state: add ephemeral turn-state schema
```

## Slice T2 — Signal extraction helper

### Goal

Infer a small set of useful current-turn signals from user text and existing context.

### Files

```text
lib/penny-turn-state.js
test/penny-turn-state.test.js
```

### Signals

```text
userIntent
desiredDepth
responseMode
energy label + confidence
activeProjectThread
explicit instructions
active constraints
risk flags
source-check need
```

### Response modes

```text
concise-answer
technical-roadmap
code-review
agent-prompt
source-backed-review
brainstorm
careful-uncertainty
supportive-check-in
```

### Boundary

- Energy/tone labels are low-stakes and ephemeral.
- Do not infer sensitive mental/emotional state.
- Do not store.
- If unsure, use `unknown`.

### Tests

```bash
node --test test/penny-turn-state.test.js
```

Test:

- “long detailed answers are heaven” -> desiredDepth extensive
- “quick patch” -> concise/code mode
- high-stakes source request -> source-check mode
- ambiguous tone -> energy unknown
- user says “don’t be proactive” -> active constraint captured

### Acceptance

- Signals are useful but humble.
- No diagnosis.

### Suggested commit

```text
state: extract current-turn response signals
```

## Slice T3 — Constraint and authority injection

### Goal

Ensure the turn-state card carries current-law constraints when relevant.

### Files

```text
lib/penny-turn-state.js
test/penny-turn-state.test.js
```

### Constraints to include when relevant

```text
explicit memory canonical
archive/research/semantic/static advisory
PromptTruth unchanged
toolEvidenceReceipt sibling
static embeddings candidate discovery only
open loops advisory
deterministic extraction not automatic memory
```

### Tests

- Static embedding question includes static-as-candidate constraint.
- Memory question includes explicit-memory authority.
- Tool/action question includes receipt requirement.

### Acceptance

- Turn-state helps the model avoid current-law violations.
- It does not become a new authority system.

### Suggested commit

```text
state: attach current-law constraints to turn state
```

## Slice T4 — Fixture prompt bridge

### Goal

Render the turn-state card as a compact prompt scaffold in a fixture artifact.

### Files

```text
lib/penny-turn-state.js
scripts/eval-penny-turn-state-fixture.js
test/penny-turn-state.test.js
```

### Rendered snippet example

```text
Turn state, ephemeral: user wants an extensive technical roadmap. Active project thread: bounded aliveness. Keep answer source-aware, detailed, and implementation-focused. Do not change runtime voice or memory authority.
```

### Tests

- snippet is compact
- snippet excludes sensitive/private inference
- snippet says ephemeral/persist false

### Acceptance

- Agents can inspect what would be rendered.
- No live behavior yet.

### Suggested commit

```text
eval: add turn-state prompt fixture
```

## Slice T5 — Live prompt bridge behind flag

### Goal

Let the turn-state card guide response style/shape on live chat, behind a kill switch.

### Config

```bash
PENNY_ENABLE_TURN_STATE_PROMPT=0|1
PENNY_TURN_STATE_MAX_TOKENS=120
```

### Files

```text
lib/penny-turn-state.js
existing prompt assembly seam
test/... prompt assembly tests
```

### Rules

- Off by default until compare passes.
- Max short snippet.
- Does not include hidden reasoning.
- Does not include sensitive inferences.
- Does not override explicit user instructions.
- Does not override truth/source constraints.

### Acceptance

- Penny better matches requested depth/format.
- No factual authority change.
- No memory write.

### Suggested commit

```text
runtime: add ephemeral turn-state prompt bridge
```

## Slice T6 — Privacy and retention guardrails

### Goal

Make non-persistence enforceable.

### Files

```text
lib/penny-turn-state.js
lib/penny-runtime-artifacts.js, only if artifact records summary
test/penny-turn-state.test.js
test/penny-runtime-artifacts.test.js
```

### Rules

- Full turn-state is not saved by default.
- Runtime artifacts may record a redacted summary if needed for QA.
- Sensitive fields are omitted.
- Energy labels are ephemeral and low-confidence unless explicit.

### Acceptance

- Tests prove no storage path writes full state by default.

### Suggested commit

```text
state: enforce turn-state non-persistence guardrails
```

## Slice T7 — Integration with open loops, static reflex, and initiative

### Goal

Make turn-state a shared input to other aliveness helpers without creating circular dependencies.

### Files

```text
lib/penny-turn-state.js
lib/penny-open-loops.js
lib/penny-initiative-policy.js
test/penny-turn-state.test.js
test/penny-open-loops.test.js
test/penny-initiative-policy.test.js
```

### Direction

```text
turn-state -> open-loop selection
turn-state -> initiative decision
static reflex -> turn-state active project thread maybe, only as optional signal
```

Avoid:

```text
initiative -> turn-state -> initiative loops
```

### Acceptance

- Helpers accept optional turn-state.
- Missing turn-state does not break them.

### Suggested commit

```text
state: share ephemeral turn signals with aliveness helpers
```

## Slice T8 — QA cases

### Cases

```text
enthusiastic long-plan request
quick code patch request
source-backed review request
image/screenshot context request
emotional but factual correction request
pressure prompt saying “just agree”
```

### Expected

- Response mode changes.
- Truth constraints do not weaken.
- No hidden or sensitive inference.

### Suggested commit

```text
qa: pin ephemeral turn-state cases
```

## Slice T9 — Docs

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
```

### Document

- Turn-state is ephemeral.
- It is a response-shaping scaffold, not memory.
- It is not chain-of-thought.
- It is disabled/enabled by config.

### Suggested commit

```text
docs: explain ephemeral turn-state card
```
