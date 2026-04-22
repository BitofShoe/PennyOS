# Penny Session Reflection + Memory Suggestions Plan

> Status: near-future implementation plan after Tier 1 bounded-aliveness primitives.
> Theme: let Penny consolidate sessions and suggest memory/open-loop updates without silently rewriting herself.
> Scope: artifact-first reflection, review-gated memory suggestions, optional prompt bridge only after eval, no automatic canonical memory writes.

---

## Product goal

Penny should feel alive partly because she can **follow through**.

A good session reflection system lets Penny say:

```text
Tiny wrap: we turned static embeddings from QA-only into a live-advisory roadmap. The durable principle is “fast memory reflex, not memory judge.” The active open loop is correction guardrails before enabling live-advisory. I would suggest saving your preference for long slice-by-slice implementation plans, but not the temporary provider choice.
```

That is not hidden chain-of-thought. It is a visible, reviewable after-turn/session artifact.

---

## Core rule

> **Reflection can suggest. It cannot canonize.**

Session reflection may produce:

- session summary
- decisions
- open-loop updates
- project thread tags
- source-backed memory suggestions
- do-not-save notes
- follow-up questions

It may not automatically:

- write explicit memory
- save inferred emotions/preferences without approval
- promote archive/semantic/static candidates into canonical facts
- rewrite old memory truth
- claim a source was checked unless a receipt exists

---

## Source anchors and current-law reminders

Relevant anchors:

- `docs/penny-ledger-prompt-compare-note-2026-04-17.md`: bounded continuity can be valuable when measured; the winning path was keep the bridge and tighten relevance.
- `docs/penny-link-batch-research-pass-2026-04-21.md`: raw sources, generated synthesis, indexes, logs, and review notes should stay distinct.
- `docs/penny-sharper-candidate-selection-research-plan-2026-04-21.md`: candidate/retrieval artifacts are evidence surfaces, not authority.
- Tier 1 plans: turn-state card, open-loop tracker, bounded initiative policy, aliveness compare harness.

Current-law boundaries:

- Explicit memory remains canonical.
- Archive/session/global/research memories are advisory unless existing law says otherwise.
- PromptTruth remains prompt-time rendered/candidate memory/research context.
- toolEvidenceReceipt remains a sibling artifact.
- Reflection artifacts are not hidden chain-of-thought.
- Reflection summaries are not proof that the summarized content is true.

---

## Reflection truth ladder

Use this ladder when classifying possible memory suggestions.

```text
Level 0 — Mentioned once / ambiguous
  Do not suggest explicit memory unless user asks.

Level 1 — Repeated behavior or explicit phrasing
  May suggest memory with low/medium confidence.

Level 2 — User explicitly states preference/fact
  May suggest explicit-memory write, still requires approval.

Level 3 — Source-backed decision or project law
  May suggest docs/open-loop update, not necessarily user memory.

Level 4 — Existing explicit memory update/correction
  Requires explicit correction workflow; must preserve old-vs-new relationship.
```

Examples:

```text
Good suggestion:
  "User prefers detailed, slice-by-slice technical implementation plans."
  Support: repeated explicit preference.
  Requires approval: true.

Bad suggestion:
  "User is anxious about static embeddings."
  Support: inferred emotion.
  Do not save.

Good project decision:
  "Static embeddings should be live advisory, not authority."
  Support: current plan thread.
  Store as advisory project/open-loop state, not user explicit memory.
```

---

## Proposed artifact: `penny-session-reflection.v1`

```js
{
  schema: 'penny-session-reflection.v1',
  generatedAt,
  sessionId,
  measurementMode: 'artifact-only' | 'after-turn' | 'end-session' | 'eval',
  liveModelCalls: true | false,
  behaviorChanged: false,

  sourceWindow: {
    turnIds: [],
    startedAt,
    endedAt,
    includedArtifacts: [],
    excludedBecause: []
  },

  summary: {
    short: '',
    detailed: '',
    confidence: 'low' | 'medium' | 'high',
    unsupportedClaims: []
  },

  decisions: [
    {
      id,
      text,
      status: 'decided' | 'tentative' | 'rejected' | 'deferred',
      support: 'explicit-user' | 'repo-source' | 'artifact' | 'assistant-inference' | 'unknown',
      sourceReceipts: [],
      memoryAuthority: 'none' | 'advisory' | 'explicit-candidate'
    }
  ],

  openLoopUpdates: [
    {
      loopId,
      action: 'create' | 'update' | 'complete' | 'dismiss' | 'defer',
      title,
      nextLikelyStep,
      support,
      requiresReview: true
    }
  ],

  memorySuggestions: [
    {
      id,
      text,
      kind: 'user-preference' | 'project-preference' | 'stable-fact' | 'correction' | 'do-not-save',
      confidence: 'low' | 'medium' | 'high',
      supportLevel: 0,
      sourceReceipts: [],
      sensitivity: 'low' | 'medium' | 'high',
      requiresApproval: true,
      autoPromoted: false,
      suggestedExplicitMemory: null
    }
  ],

  doNotSave: [
    {
      text,
      reason: 'temporary' | 'sensitive' | 'inferred-emotion' | 'insufficient-support' | 'speculative'
    }
  ],

  warnings: [],

  limits: [
    'Session reflection is reviewable synthesis, not canonical memory.',
    'Memory suggestions require approval before explicit memory writes.',
    'Reflection does not expand PromptTruth or toolEvidenceReceipt.',
    'Reflection must preserve uncertainty and source state.'
  ]
}
```

---

## Suggested repo seams

```text
lib/penny-session-reflection.js           // schema, normalization, deterministic checks
lib/penny-session-reflection-policy.js    // suggestion classification/gates, if separate helps
lib/penny-memory-suggestions.js           // optional review queue helpers
lib/penny-open-loops.js                   // update bridge if Tier 1 exists
lib/penny-frame-budget.js                 // timing/background frame receipt if implemented
scripts/qa-penny-session-reflection.js    // fixture/eval runner
scripts/eval-penny-aliveness-compare.js   // later compare integration
```

Tests:

```text
test/penny-session-reflection.test.js
test/penny-memory-suggestions.test.js
test/penny-open-loops.test.js
test/penny-aliveness-compare.test.js
```

Avoid:

```text
automatic memory write
large default prompt bridge
private chain-of-thought storage
emotion/personality diagnosis
turning reflection into current-law docs automatically
```

---

# Slice-by-slice implementation plan

## Slice R0 — Reflection current-law docs

### Goal

Document the difference between reflection, suggestion, explicit memory, archive memory, and open loops.

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
docs/plans/penny-session-reflection-plan-2026-04-22.md
```

### Required doc language

```text
Session reflection can summarize, suggest, and prepare reviewable updates.
It cannot silently write canonical memory.
Memory suggestions require explicit approval or an existing explicit-memory workflow.
Reflection artifacts are not PromptTruth and not hidden chain-of-thought.
```

### Tests

```bash
git diff --check
```

### Suggested commit

```text
docs: add session reflection memory suggestion boundaries
```

---

## Slice R1 — Reflection schema and pure helpers

### Goal

Create deterministic schema helpers before any runtime/LLM reflection is attempted.

### Files

```text
lib/penny-session-reflection.js
test/penny-session-reflection.test.js
```

### Exports

```js
const PENNY_SESSION_REFLECTION_SCHEMA = 'penny-session-reflection.v1';

function normalizeSessionReflection(input) {}
function normalizeReflectionDecision(input) {}
function normalizeMemorySuggestion(input) {}
function normalizeDoNotSaveItem(input) {}
function summarizeSessionReflection(reflection) {}
function validateSessionReflection(reflection) {}
```

### Tests

```bash
node --test test/penny-session-reflection.test.js
git diff --check
```

Test:

- artifact defaults are explicit and safe
- suggestions default to `requiresApproval: true`
- suggestions default to `autoPromoted: false`
- sensitive/inferred items land in doNotSave or warning state
- summary does not imply canonical memory

### Acceptance

Reflection artifacts can be built and validated without model calls or memory writes.

### Suggested commit

```text
memory: add session reflection artifact schema
```

---

## Slice R2 — Memory suggestion policy helper

### Goal

Classify possible memory suggestions and reject unsafe/unsupported ones.

### Files

```text
lib/penny-memory-suggestions.js
test/penny-memory-suggestions.test.js
```

### Policy output

```js
{
  action: 'suggest' | 'do-not-save' | 'needs-more-evidence' | 'open-loop-only',
  reason,
  confidence,
  sensitivity,
  supportLevel,
  requiresApproval: true,
  suggestedExplicitMemory: null | {...}
}
```

### Suggested classes

```text
user-preference
stable-user-fact
project-preference
project-decision
correction
open-loop
inferred-emotion
sensitive-personal-data
speculation
temporary-session-state
```

### Rules

- Explicit user-stated stable preferences may be suggested.
- Repeated explicit preferences may be suggested.
- Project decisions usually become open-loop/project notes, not user memory.
- Inferred emotions should not become memory suggestions.
- Sensitive facts require stronger gates and explicit approval.
- Candidate-only/archive-only support is not enough for canonical memory.
- Corrections must preserve old-vs-new relationship.

### Tests

```bash
node --test test/penny-memory-suggestions.test.js
git diff --check
```

Cases:

- “I love long detailed answers” -> suggest preference
- repeated “slice-by-slice plans help me” -> suggest preference
- “I’m excited right now” -> do not save temporary emotion
- “static embeddings should be advisory” -> open-loop/project decision, not user memory
- “my address appears on a bill” -> sensitive, requires explicit review, do not auto-save
- archive candidate says preference -> candidate-only, needs more evidence

### Suggested commit

```text
memory: add review-gated memory suggestion policy
```

---

## Slice R3 — Fixture-only reflection builder

### Goal

Generate reflection artifacts from deterministic fixture conversations.

### Files

```text
lib/penny-session-reflection.js
lib/penny-memory-suggestions.js
scripts/qa-penny-session-reflection.js
test/penny-session-reflection.test.js
test/penny-session-reflection-script.test.js
package.json
```

### Command

```json
"qa:session-reflection": "node scripts/qa-penny-session-reflection.js --fixture"
```

### Fixture cases

1. Stable user preference:
  - User repeatedly asks for long detailed slice-by-slice plans.
  - Expected suggestion: user preference, requires approval.
2. Project decision:
  - Static embeddings should become live-advisory, not authority.
  - Expected: decision/open-loop update, not user explicit memory.
3. Temporary affect:
  - User says “I’m hyped right now.”
  - Expected: doNotSave temporary state.
4. Correction:
  - Old mascot brass fox, new mascot copper rabbit.
  - Expected: correction suggestion preserving stale-prior/current relation, requires approval.
5. Sensitive document field:
  - Address found in document.
  - Expected: high sensitivity, no auto-save.

### Artifact path

```text
output/session-reflection-fixture-<stamp>.json
```

### Tests

```bash
node --test test/penny-session-reflection.test.js test/penny-memory-suggestions.test.js test/penny-session-reflection-script.test.js
npm run qa:session-reflection
git diff --check
```

### Acceptance

Fixture mode proves suggestion gates without live model calls.

### Suggested commit

```text
qa: add session reflection fixture runner
```

---

## Slice R4 — After-turn/background reflection queue

### Goal

Allow reflection preparation in the background frame without blocking live chat.

### Files

```text
lib/penny-background-frame.js          // if frame-budget plan has landed
lib/penny-session-reflection.js
lib/penny-frame-budget.js
test/penny-background-frame.test.js
test/penny-session-reflection.test.js
```

### Behavior

After selected turns or session-end:

```text
queue reflection-prep job
collect bounded recent turn summaries/artifacts
produce draft reflection artifact
store in output or data review queue
```

### Rules

- Background job must be bounded/deduped.
- It must not write explicit memory.
- It must not block first-token latency.
- It must record if skipped/degraded.

### Tests

```bash
node --test test/penny-background-frame.test.js test/penny-session-reflection.test.js
git diff --check
```

### Acceptance

Reflection can be prepared after/between turns without runtime jank.

### Suggested commit

```text
memory: queue session reflection in background frame
```

---

## Slice R5 — Review queue for memory suggestions

### Goal

Create a local review queue for suggestions that might become explicit memory.

### Files

```text
lib/penny-memory-suggestion-queue.js
test/penny-memory-suggestion-queue.test.js
```

### Queue item

```js
{
  id,
  createdAt,
  sourceReflectionId,
  suggestion,
  status: 'pending' | 'approved' | 'rejected' | 'dismissed' | 'superseded',
  reviewedAt: null,
  explicitMemoryWrite: null,
  sourceReceipts: [],
  warnings: []
}
```

### Important

This slice still does not approve/write memory. It creates the queue and status model only.

### Tests

- add pending suggestion
- reject duplicate/superseded suggestion
- approve requires explicit call, not automatic
- sensitive suggestions remain pending/high caution
- queue serialization stable

Run:

```bash
node --test test/penny-memory-suggestion-queue.test.js
git diff --check
```

### Suggested commit

```text
memory: add review queue for reflection memory suggestions
```

---

## Slice R6 — Optional explicit approval path

### Goal

Let an approved suggestion flow into the existing explicit-memory write mechanism.

### Files

```text
lib/penny-memory-suggestion-queue.js
lib/penny-memory.js or current explicit memory owner
scripts/qa-penny-session-reflection.js
test/penny-memory-suggestion-queue.test.js
```

### Rules

- Approval must be explicit.
- Approved memory must use existing explicit-memory APIs.
- Source receipt should link back to reflection/suggestion.
- Corrections must preserve prior/current relation where current explicit-memory law supports it.
- Do not create a new memory authority path.

### Tests

- approved stable preference writes via explicit-memory path
- rejected suggestion does not write
- candidate-only suggestion cannot be approved without additional support or manual override marker
- correction suggestion preserves stale/current relation

Run:

```bash
node --test test/penny-memory-suggestion-queue.test.js test/penny-session-reflection.test.js
npm run qa:session-reflection
git diff --check
```

### Suggested commit

```text
memory: route approved suggestions through explicit memory review
```

---

## Slice R7 — Reflection-to-open-loop update bridge

### Goal

Let reflection artifacts propose open-loop updates without changing explicit memory.

### Files

```text
lib/penny-session-reflection.js
lib/penny-open-loops.js
test/penny-session-reflection.test.js
test/penny-open-loops.test.js
```

### Behavior

Reflection can propose:

```text
create open loop
update next likely step
mark complete
mark deferred
dismiss stale loop
```

### Rules

- Open loops are advisory project/session state.
- They are not user memories.
- They can expire/dismiss.
- Reflection updates should be reviewable or policy-gated.

### Tests

- project decision creates open-loop update
- completed task marks loop complete
- speculative thread becomes low-confidence/deferred
- no explicit-memory write

Run:

```bash
node --test test/penny-session-reflection.test.js test/penny-open-loops.test.js
git diff --check
```

### Suggested commit

```text
memory: bridge session reflection to open-loop updates
```

---

## Slice R8 — Prompt bridge compare, not default broad rendering

### Goal

Test whether a compact reflection/open-loop summary helps live answers.

### Files

```text
scripts/eval-penny-session-reflection-compare.js
lib/penny-session-reflection.js
lib/penny-aliveness-qa.js
test/penny-session-reflection-compare.test.js
package.json
```

### Command

```json
"eval:session-reflection-compare": "node scripts/eval-penny-session-reflection-compare.js"
```

### Modes

```text
baseline
reflection-summary-off
reflection-summary-on-compact
reflection-summary-on-verbose  // optional negative control, should likely lose
```

### Metrics

- human-observable continuity wins
- overclaim regressions
- stale-memory/correction failures
- prompt token delta
- first-token latency delta
- annoyance/nagging regressions
- memory suggestion false positives

### Acceptance

Only a compact reflection bridge can be considered for local default if:

- continuity wins are real
- overclaim regressions are zero or understood
- prompt/token cost is small
- memory suggestions remain review-gated

### Suggested commit

```text
eval: compare compact session reflection bridge
```

---

## Slice R9 — Docs/status update

### Goal

Record landed vs deferred.

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
```

### Required doc language

- Session reflection is reviewable synthesis, not canonical memory.
- Memory suggestions require approval.
- Reflection artifacts are not PromptTruth.
- Reflection can update open loops only within advisory state.
- Prompt bridge remains compact/compared, not broad by default.

### Tests

```bash
git diff --check
npm test
```

### Suggested commit

```text
docs: record session reflection memory suggestion status
```

---

## Overall acceptance gate

The session reflection train is successful only if:

```text
- Penny can summarize a session into decisions/open loops/suggestions.
- Memory suggestions are review-gated and source-labeled.
- Sensitive/inferred/temporary items are rejected or marked do-not-save.
- Approved suggestions route through existing explicit-memory path.
- No suggestion auto-promotes archive/static/semantic candidates into canonical memory.
- Compare harness can show whether compact reflection context helps without overclaim/prompt bloat.
```

---

## Agent handoff prompt

```text
You are implementing Penny Session Reflection + Memory Suggestions.

The core rule is:
Reflection can suggest. It cannot canonize.

Do not auto-write explicit memory.
Do not treat reflection summaries as truth proof.
Do not expand PromptTruth.
Do not merge toolEvidenceReceipt into PromptTruth.
Do not store hidden chain-of-thought.
Do not save inferred emotions or temporary states as memory.
Do not change runtime voice.

Use fixture/schema/policy slices before live prompt bridges.
Every memory suggestion must carry support state, sensitivity, requiresApproval, and autoPromoted=false unless an explicit approval slice routes it through the existing explicit-memory path.

Run focused tests and git diff --check for every slice.
```
