# Plan 2 — Open-Loop Tracker

Date: 2026-04-22

## One-line goal

Give Penny a bounded, advisory way to remember unresolved project/session threads and surface the right one at the right time without treating open loops as canonical facts.

## Why this matters

Open loops are where companion continuity becomes visible. Penny should be able to remember that a thread is unresolved, know the likely next step, and mention it when it is relevant. This is not general autonomy. It is project/session continuity with explicit status, sources, expiry, and dismissal.

The product lesson from the ledger compare is directly relevant: bounded continuity can beat sterile amnesia when it is measured and relevance is tightened. The open-loop tracker should be built with the same philosophy: keep the bridge, bound it, and make relevance inspectable.

## Non-goals

- No autonomous task execution.
- No automatic explicit-memory writes.
- No broad project-management platform.
- No graph database migration.
- No always-on surveillance.
- No open-loop prompt dump.
- No claim that an open loop is verified truth.

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

## Core concepts

An open loop is an unresolved thread, not a fact about the user.

Examples:

```text
Static embeddings live-advisory implementation is halfway done.
Next risk: stale correction resurrection.

Candidate survival is landed, but live answer-drift remains deferred.

Deterministic extraction is a later branch; best first target is research-note extraction, not PDFs.
```

Open-loop state should include:

```json
{
  "id": "static-live-advisory",
  "title": "Static embeddings as live advisory memory reflex",
  "status": "in-progress",
  "priority": "high",
  "lastTouchedAt": "2026-04-22T00:00:00.000Z",
  "nextLikelyStep": "Finish live-shadow then test correction guardrails before live-advisory.",
  "sourceRefs": [
    { "type": "conversation", "id": "..." },
    { "type": "doc", "path": "docs/penny-sharper-candidate-selection-research-plan-2026-04-21.md" }
  ],
  "authority": "advisory",
  "confidence": "medium",
  "surfacePolicy": {
    "mode": "relevant-only",
    "maxSurfaceCount": 1,
    "expiresAt": "2026-05-22T00:00:00.000Z"
  },
  "dismissed": false,
  "completedAt": null
}
```

## Slice O1 — Schema and pure model

### Goal

Create the open-loop data model and pure helper functions. No live prompt bridge yet.

### Files

```text
lib/penny-open-loops.js
test/penny-open-loops.test.js
```

### Exports

```js
OPEN_LOOP_SCHEMA = 'penny-open-loop-state.v1'
OPEN_LOOP_STATUSES = {
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  BLOCKED: 'blocked',
  DEFERRED: 'deferred',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
}

normalizeOpenLoop(loopLike)
normalizeOpenLoopState(stateLike)
summarizeOpenLoopState(state)
classifyOpenLoopStatus(loop, now)
```

### Tests

```bash
node --test test/penny-open-loops.test.js
```

Test:

- normalizes required fields
- rejects missing id/title/status
- expires stale loops
- completed/dismissed loops do not surface
- authority defaults to advisory

### Acceptance

- Open-loop schema is deterministic and standalone.
- No runtime behavior changes.

### Suggested commit

```text
state: add open-loop tracker schema
```

## Slice O2 — Relevance scoring for open-loop surfacing

### Goal

Add a pure relevance function that decides which open loops are relevant to the current turn.

### Files

```text
lib/penny-open-loops.js
test/penny-open-loops.test.js
```

### Inputs

```js
selectRelevantOpenLoops({
  loops,
  userText,
  staticCandidates = [],
  turnState = null,
  maxLoops = 1,
  now = new Date(),
})
```

### Signals

- exact anchor overlap
- project-thread match
- recent touch
- priority
- explicit user mention
- static memory candidate relation
- dismissal/completion/expiry suppression

### Output

```json
{
  "selected": [
    {
      "id": "static-live-advisory",
      "surfaceReason": "explicit-anchor+recent-open-loop",
      "confidence": "high",
      "promptSnippet": "Open loop: static live-advisory is in progress; next risk is stale correction guardrails. Authority: advisory."
    }
  ],
  "heldBack": [
    { "id": "deterministic-extraction", "reason": "adjacent-not-central" }
  ]
}
```

### Tests

```bash
node --test test/penny-open-loops.test.js
```

Test:

- explicit anchor wins
- adjacent loop is held back
- dismissed loop never surfaces
- expired loop never surfaces
- maxLoops cap enforced

### Acceptance

- Relevance is inspectable.
- The default selected count should be 0 or 1.

### Suggested commit

```text
state: select relevant open loops for current turn
```

## Slice O3 — Storage adapter and disposable QA state

### Goal

Add local file storage for open loops, but keep QA isolated.

### Files

```text
lib/penny-open-loops.js
lib/penny-open-loop-store.js
test/penny-open-loop-store.test.js
```

### Behavior

- Load JSON state from a configured file.
- Write atomically.
- Use env/config path:

```bash
PENNY_OPEN_LOOP_FILE=data/penny-open-loops.json
```

- QA scripts must use disposable open-loop files.

### Tests

```bash
node --test test/penny-open-loop-store.test.js
```

### Acceptance

- Open-loop storage is local and simple.
- No real local file touched in tests.
- Corrupt file produces safe fallback/error artifact, not silent data loss.

### Suggested commit

```text
state: add local open-loop store
```

## Slice O4 — Fixture extraction from session/reflection artifacts

### Goal

Generate candidate open loops from controlled fixture text/artifacts.

### Files

```text
lib/penny-open-loops.js
lib/penny-open-loop-extraction.js
test/penny-open-loop-extraction.test.js
```

### Important boundary

Extraction suggestions are not automatically written. This slice should produce:

```text
openLoopSuggestions
```

not mutate live state unless explicitly called.

### Fixture examples

- “Static live-advisory is halfway done; next risk is correction guardrails.”
- “Gemma watch landed; no follow-up unless LM Studio exposes vision budget.”
- “Deterministic extraction deferred until concrete document use case.”

### Tests

```bash
node --test test/penny-open-loop-extraction.test.js
```

### Acceptance

- Suggestions include source, confidence, status, nextLikelyStep.
- Sensitive/private inferences are not suggested.
- Speculation is labeled as speculation.

### Suggested commit

```text
state: extract advisory open-loop suggestions
```

## Slice O5 — Open-loop prompt bridge fixture

### Goal

Build a compact prompt bridge for selected open loops, but fixture-only first.

### Files

```text
lib/penny-open-loops.js
test/penny-open-loops.test.js
scripts/eval-penny-open-loop-bridge.js
test/penny-open-loop-bridge.test.js
```

### Prompt snippet constraints

- Max 1 loop initially.
- Max short snippet, e.g. 80–120 words.
- Include authority: advisory.
- Include source/relevance reason.
- Include instruction not to overclaim.

Example:

```text
Open loop candidate, advisory: Static live-advisory is in progress. The likely next risk is stale correction guardrails. Surface only if directly relevant to the user's current turn. Do not treat this as canonical memory.
```

### Acceptance

- Fixture shows selected vs held-back loops.
- Prompt bridge does not touch live chat yet.
- PromptTruth is not expanded; if rendered later, existing prompt-context accounting may report it as rendered research/memory context according to current law, but no new channel is added.

### Suggested commit

```text
eval: add open-loop prompt bridge fixture
```

## Slice O6 — Live bounded open-loop bridge

### Goal

Optionally inject one relevant open-loop snippet into live prompt context.

### Files

```text
lib/penny-open-loops.js
server prompt assembly seam or existing prompt builder
lib/penny-prompttruth.js only if current rendered context accounting needs normalization, not new channels
test/... relevant prompt assembly tests
```

### Config

```bash
PENNY_ENABLE_OPEN_LOOP_PROMPT=0|1
PENNY_OPEN_LOOP_MAX_RENDERED=1
PENNY_OPEN_LOOP_MAX_TOKENS=120
```

### Guardrails

- Off by default until compare passes.
- Max one open loop.
- Relevance threshold.
- Dismissed/completed/expired loops blocked.
- Advisory label mandatory.

### Tests

```bash
node --test test/penny-open-loops.test.js relevant-prompt-tests
```

### Acceptance

- Bridge can make Penny more continuous.
- Adjacent unresolved topics do not bleed in.
- No default context bloat.

### Suggested commit

```text
runtime: add bounded open-loop prompt bridge
```

## Slice O7 — Lifecycle operations

### Goal

Allow loops to be completed, dismissed, deferred, or updated safely.

### Files

```text
lib/penny-open-loop-store.js
lib/penny-open-loops.js
test/penny-open-loop-store.test.js
```

### Operations

```js
createOpenLoop()
updateOpenLoop()
completeOpenLoop()
dismissOpenLoop()
deferOpenLoop()
expireOpenLoops()
```

### Boundary

No autonomous completion based only on model vibes. Completion requires:

```text
explicit user statement
or deterministic artifact/test/source receipt
or manual command
```

### Acceptance

- User can stop a loop from resurfacing.
- Completed loops do not keep nagging.
- Updates keep history/source receipts.

### Suggested commit

```text
state: add open-loop lifecycle operations
```

## Slice O8 — Open-loop QA and compare

### Goal

Measure whether the bridge helps or annoys.

### Files

```text
scripts/eval-penny-open-loop-compare.js
test/penny-open-loop-compare.test.js
lib/penny-aliveness-qa.js, if available
```

### Metrics

```text
continuity wins
adjacent-topic bleed
annoyance regressions
overclaim regressions
prompt token delta
latency delta
```

### Acceptance

- Bridge stays off if adjacent-topic bleed appears.
- Bridge can be enabled only if wins > regressions.

### Suggested commit

```text
eval: compare open-loop prompt bridge
```

## Slice O9 — Docs

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
```

### Document

- Open loops are advisory continuity state.
- They are not explicit memory.
- They are dismissible and expire-able.
- Prompt bridge is bounded and measured.
- User controls.

### Suggested commit

```text
docs: explain bounded open-loop continuity
```
