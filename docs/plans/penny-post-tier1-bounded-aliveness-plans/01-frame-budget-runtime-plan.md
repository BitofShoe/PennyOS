# Penny Frame Budget Runtime Plan

> Status: near-future implementation plan after Tier 1 bounded-aliveness primitives.
> Theme: make Penny more alive by spending runtime on relevance, source authority, and candidate selection before spending it on more rendered context.
> Scope: instrumentation first, then deadline-aware sidecars, then budget-aware retrieval/prompt assembly, then compare harnesses.

---

## The Penny Frame Budget Mantra

> **Every Penny turn has a frame budget. Spend it first on relevance, source authority, and candidate selection before spending it on more rendered context. Faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory.**

Shorter form for docs/headers:

> **More inspected candidates, not more prompt stuffing.**

Even shorter form for agents:

> **Optimize for better pre-prompt judgment, not bigger prompts.**

This is the unifying principle for static embeddings, open loops, turn-state cards, bounded initiative, session reflection, and future local pulse behavior.

---

## Source anchors and current-law reminders

Before implementing, agents should re-read current repo docs and treat them as current law over this plan. This plan is an implementation proposal, not proof that behavior shipped.

Relevant repo/source anchors:

- `docs/penny-sharper-candidate-selection-research-plan-2026-04-21.md`: says Penny turns have a frame-budget-like constraint, and faster retrieval should buy candidate inspection/ranking/filtering before prompt rendering; final prompt should stay small.
- `docs/penny-link-batch-research-pass-2026-04-21.md`: says harness quality, scoped context, tool receipts, deterministic checks, token-cost awareness, and Penny-shaped evals matter more than broad platform imports.
- `docs/penny-ledger-prompt-compare-note-2026-04-17.md`: shows the right continuity pattern is not “delete the bridge” or “inject everything,” but “keep the bounded bridge, then tighten relevance.”
- Current README/CODEBASE/ARCHITECTURE/docs/README: current law for PromptTruth, toolEvidenceReceipt, explicit memory, archive memory, static embeddings, and QA artifacts.

Non-negotiable boundaries:

- Explicit memory remains canonical.
- Archive/research/semantic/static retrieval remains advisory unless an existing contract says otherwise.
- PromptTruth remains prompt-time rendered/candidate memory/research context.
- toolEvidenceReceipt remains a sibling runtime artifact, not a PromptTruth channel.
- Runtime voice is not changed by this plan.
- Default rendered context limits are not increased by this plan.
- No hidden-state, activation, neuron-level, semantic-geometry, or chain-of-thought runtime receipts.
- No broad `server.js` expansion.
- No graph DB/vector DB/platform rewrite.
- No automatic memory promotion.

---

## What “frame budget” means for Penny

Penny has several budgets per turn. Do not collapse them into one latency number.

### 1. Wall-clock budget

User-visible time:

- time to first visible response/stream token
- total answer time
- dead-air before tool calls or model streaming

### 2. Pre-prompt work budget

Work done before the LM Studio chat call:

- turn-state card
- live static memory reflex
- keyword/exact-anchor extraction
- open-loop relevance scoring
- candidate merge/ranking/filtering
- source authority and stale-correction gates
- tool route decision
- prompt assembly

This is where optimization makes Penny smarter without stuffing the prompt.

### 3. Prompt-token budget

What actually reaches the model:

- system/developer prompt
- compact memory context
- research/open-loop bridge, if enabled
- tool instructions
- source snippets
- user message

More prompt tokens may help sometimes, but the default strategy is better selection, not larger context.

### 4. Tool budget

Tool calls cost time, tokens, and trust surface:

- source reads
- repo searches
- git/status reads
- web reads
- test runs
- document extraction

Tool descriptors may eventually carry output-cost/source-cost hints, but this plan starts with runtime measurement.

### 5. Background budget

Work that should happen after/between turns, not inside first-token critical path:

- embed new memory/archive items
- refresh static indexes
- update open loops
- prepare pulse cards
- write reflection artifacts
- summarize candidate traces

This is the “asset streaming” layer of Penny.

---

## Desired architecture

Think of one Penny turn as three nested frames:

```text
Frame A: Reflex frame
  Must be very fast and deadline-bound.
  Examples: turn-state card, static query, open-loop quick score, exact anchors.

Frame B: Answer frame
  Prompt assembly + LM Studio call + answer streaming + immediate artifacts.

Frame C: Background frame
  After-turn/between-turn work: indexing, reflection, open-loop updates, pulse prep.
```

The final implementation should let Penny say, via artifacts:

```text
I inspected 84 candidate memories in 23ms, selected 3, rendered 2, blocked 1 stale correction, preserved prompt token budget, and first-token latency stayed inside target.
```

---

## Proposed new artifact: `penny-frame-budget.v1`

This is a sibling runtime artifact/section, not PromptTruth.

```js
{
  schema: 'penny-frame-budget.v1',
  generatedAt,
  turnId,
  lane: 'chat' | 'tool' | 'direct-tool' | 'eval',
  mode: 'baseline' | 'static-live-shadow' | 'static-live-advisory' | 'open-loops' | 'bounded-aliveness',

  targets: {
    firstTokenMs: 1800,
    totalResponseMs: null,
    prePromptBudgetMs: 250,
    staticMemoryBudgetMs: 40,
    openLoopBudgetMs: 20,
    turnStateBudgetMs: 10,
    maxRenderedMemoryItems: 3,
    maxMemoryPromptTokens: 600,
    maxStaticOnlyRendered: 1
  },

  timings: {
    turnStateMs: null,
    staticMemoryQueryMs: null,
    openLoopQueryMs: null,
    exactAnchorMs: null,
    candidateMergeMs: null,
    authorityGateMs: null,
    promptBuildMs: null,
    lmStudioFirstTokenMs: null,
    lmStudioTotalMs: null,
    artifactWriteMs: null,
    totalPrePromptMs: null,
    totalTurnMs: null
  },

  workDone: {
    rawCandidatesInspected: 0,
    staticCandidatesInspected: 0,
    keywordCandidatesInspected: 0,
    openLoopsScored: 0,
    candidatesSelected: 0,
    candidatesRendered: 0,
    staticOnlyRendered: 0,
    staleCandidatesBlocked: 0,
    sourceChecksRun: 0,
    backgroundJobsQueued: 0
  },

  budgetEvents: [
    {
      id: 'static-query-deadline',
      status: 'met' | 'missed' | 'skipped' | 'degraded',
      budgetMs: 40,
      actualMs: 12,
      fallback: ''
    }
  ],

  quality: {
    candidateSurvival: 'not-run' | 'pass' | 'fail' | 'degraded',
    sourceAuthorityPreserved: true,
    staleCorrectionBlocked: true,
    overclaimRegression: false,
    promptTokenDelta: 0,
    firstTokenLatencyDeltaMs: null
  },

  limits: [
    'Frame budget receipts measure runtime shape; they do not prove answer quality by themselves.',
    'Faster runtime should improve pre-prompt selection before increasing rendered context.',
    'This artifact is not PromptTruth and does not expand memory authority.'
  ]
}
```

---

## Suggested repo seams

Likely owner modules:

```text
lib/penny-frame-budget.js                 // new pure helpers/schema/timers
lib/penny-frame-scheduler.js              // optional later, deadline-aware sidecar runner
lib/penny-runtime-artifacts.js            // attach/summarize receipt if this module exists/current seam
lib/penny-memory-archive.js               // candidate timing/counters, not huge logic growth
lib/penny-static-memory-index.js          // static query timing/counters if live sidecar exists
lib/penny-open-loops.js                   // open-loop scoring timing/counters if implemented
lib/penny-turn-state.js                   // turn-state timing/counters if implemented
scripts/eval-penny-frame-budget.js        // new compare/eval runner
scripts/eval-penny-runtime-fit.js         // optional appendix/correlation only
```

Tests:

```text
test/penny-frame-budget.test.js
test/penny-frame-scheduler.test.js
test/penny-runtime-artifacts.test.js
test/penny-memory-archive.test.js
test/penny-static-memory-index.test.js
test/penny-open-loops.test.js
test/penny-turn-state.test.js
test/penny-frame-budget-eval.test.js
```

Avoid:

```text
server.js mega-growth
PromptTruth channel expansion
toolEvidenceReceipt merge into PromptTruth
runtime voice edits
large prompt-limit changes
```

---

# Slice-by-slice implementation plan

## Slice F0 — Add the mantra/current-law doc note

### Goal

Pin the frame-budget principle as a planning rule before code starts.

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
docs/penny-runtime-authority-contract-2026-04-17.md
docs/plans/penny-post-tier1-bounded-aliveness-plans/01-frame-budget-runtime-plan.md
```

### Work

Add a short section such as:

```text
Penny Frame Budget Principle

Every turn has a runtime/context frame budget. Spend it first on relevance, source authority, and candidate selection before spending it on more rendered context. Faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory.
```

Explain that this principle applies to:

- static live memory reflex
- open-loop tracker
- turn-state card
- initiative policy
- session reflection
- dynamic memory linking
- aliveness/frame-budget compares

### Tests

```bash
git diff --check
```

### Acceptance

Docs clearly state the mantra and non-goals. No code behavior change.

### Suggested commit

```text
docs: add Penny frame budget principle
```

---

## Slice F1 — Frame budget receipt schema and pure helpers

### Goal

Create the artifact schema and normalization/summarization helpers.

### Files

```text
lib/penny-frame-budget.js
test/penny-frame-budget.test.js
```

### Exports

```js
const PENNY_FRAME_BUDGET_SCHEMA = 'penny-frame-budget.v1';

const FRAME_BUDGET_EVENT_STATUSES = Object.freeze({
  MET: 'met',
  MISSED: 'missed',
  SKIPPED: 'skipped',
  DEGRADED: 'degraded',
});

function normalizeFrameBudgetReceipt(receiptLike) {}
function createFrameBudgetReceipt(options = {}) {}
function addFrameTiming(receipt, key, ms) {}
function addFrameWorkCount(receipt, key, count) {}
function addFrameBudgetEvent(receipt, event) {}
function summarizeFrameBudget(receipts) {}
function classifyFrameBudgetHealth(receipt) {}
```

### Important design

Keep helpers pure and deterministic. Do not read files, call tools, call LM Studio, or import server runtime.

### Tests

Test:

- creates schema with defaults
- normalizes null/unknown timing fields
- records budget event statuses
- summarizes multiple receipts
- health classification catches first-token miss, prompt-token growth, static-only rendered cap breach
- limits text says receipt is not answer-quality proof

Run:

```bash
node --test test/penny-frame-budget.test.js
git diff --check
```

### Acceptance

Frame budget artifacts can exist without touching runtime behavior.

### Suggested commit

```text
runtime: add frame budget receipt schema
```

---

## Slice F2 — Minimal timers for existing runtime/eval paths

### Goal

Attach frame budget receipts to existing runtime/eval artifacts with minimal instrumentation.

### Files

```text
lib/penny-frame-budget.js
lib/penny-runtime-artifacts.js        // if current artifact owner
scripts/eval-penny-runtime-fit.js
test/penny-runtime-artifacts.test.js
test/penny-runtime-fit-script.test.js
```

### Work

Add timing/counter fields where current code already has measurements:

- prompt build start/end if available
- first-token latency if already measured
- total latency if already measured
- rendered memory count if already known
- selected/rendered candidate count if already known
- prompt-token estimate if already known

Do not add new heavy timers inside every function yet.

### Acceptance shape

Runtime-fit artifacts get:

```js
frameBudget: {
  schema: 'penny-frame-budget.v1',
  measurementMode: 'runtime-fit' | 'fixture-only',
  timings: {...},
  workDone: {...},
  limits: [...]
}
```

Fixture-only modes must keep live model fields null/not-run.

### Tests

```bash
node --test test/penny-frame-budget.test.js test/penny-runtime-fit-script.test.js
npm run eval:runtime-fit:context-pressure
git diff --check
```

### Acceptance

Artifacts report basic frame-budget fields without new behavior or live-default changes.

### Suggested commit

```text
eval: attach frame budget receipts to runtime-fit artifacts
```

---

## Slice F3 — Deadline-aware sidecar scheduler, fixture-only first

### Goal

Create a small helper for running current-turn sidecars under deadlines.

### Files

```text
lib/penny-frame-scheduler.js
test/penny-frame-scheduler.test.js
```

### Why

The live static reflex, turn-state card, and open-loop check should not jank first-token latency. They need deadlines and graceful degradation.

### API sketch

```js
async function runFrameSidecar({
  id,
  label,
  budgetMs,
  run,
  fallback = null,
  now = Date.now,
}) {}

async function runFrameSidecars({
  sidecars,
  totalBudgetMs,
  parallel = true,
  now = Date.now,
}) {}
```

Return shape:

```js
{
  id,
  status: 'met' | 'missed' | 'skipped' | 'degraded',
  budgetMs,
  actualMs,
  result,
  fallbackUsed,
  error: null,
}
```

### Rules

- Missed deadline should not crash the answer path.
- Errors become degraded/skipped events with fallback.
- Results must be bounded.
- Scheduler should not implement Penny logic; it only manages time/deadlines.

### Tests

```bash
node --test test/penny-frame-scheduler.test.js test/penny-frame-budget.test.js
git diff --check
```

Test:

- sidecar completes within budget
- slow sidecar is marked missed/degraded
- fallback is used
- parallel sidecars respect total summary
- errors are recorded, not thrown through normal path unless explicitly configured

### Acceptance

A tiny deadline runner exists but no runtime path depends on it yet.

### Suggested commit

```text
runtime: add deadline-aware frame sidecar helper
```

---

## Slice F4 — Instrument live static reflex/open-loop/turn-state sidecars

### Goal

Once Tier 1 features exist, run them through the frame scheduler and report their timing/work counts.

### Files

```text
lib/penny-frame-scheduler.js
lib/penny-frame-budget.js
lib/penny-static-memory-index.js
lib/penny-open-loops.js
lib/penny-turn-state.js
lib/penny-memory-archive.js
test/penny-static-memory-index.test.js
test/penny-open-loops.test.js
test/penny-turn-state.test.js
test/penny-memory-archive.test.js
```

### Work

Attach budgets like:

```text
turn-state: 10ms
static memory query: 40ms
open-loop relevance: 20ms
exact anchors: 5ms
candidate merge: 25ms
```

These are starting values, not eternal law.

Record:

- sidecar status
- actual ms
- candidate/open-loop counts
- fallback/degraded reason

### Important

If any sidecar misses its budget, Penny should still answer. The receipt should say the sidecar missed/degraded.

### Tests

```bash
node --test test/penny-frame-scheduler.test.js test/penny-memory-archive.test.js test/penny-static-memory-index.test.js test/penny-open-loops.test.js test/penny-turn-state.test.js
git diff --check
```

### Acceptance

Tier 1 sidecars become frame-budgeted, bounded, and visible in artifacts.

### Suggested commit

```text
runtime: frame-budget live aliveness sidecars
```

---

## Slice F5 — Budget-aware candidate merge and degraded modes

### Goal

Let retrieval adapt to the frame budget without changing truth boundaries.

### Files

```text
lib/penny-memory-archive.js
lib/penny-memory-archive-policy.js
lib/penny-frame-budget.js
test/penny-memory-archive.test.js
test/penny-memory-archive-policy.test.js
```

### Behavior

If time budget is tight:

- reduce optional candidate expansion
- use cached static results if available
- skip low-priority open-loop candidates
- keep source/correction authority checks
- never skip explicit memory canonicality

If query is source-sensitive/high-risk:

- reserve budget for authority/correction gates
- prefer fewer rendered candidates with stronger receipts

### Degraded mode examples

```js
{
  id: 'static-expansion',
  status: 'skipped',
  reason: 'pre-prompt budget exhausted',
  fallback: 'keyword+cached-candidates'
}
```

### Tests

- budget tight -> optional static expansion skipped, explicit memory still honored
- budget tight -> no stale correction rendered
- enough budget -> more candidates inspected
- prompt/rendered limits unchanged

Run:

```bash
node --test test/penny-memory-archive.test.js test/penny-memory-archive-policy.test.js test/penny-frame-budget.test.js
git diff --check
```

### Acceptance

Budget adaptation improves runtime shape without weakening truth/source gates.

### Suggested commit

```text
memory: add budget-aware candidate merge degradation
```

---

## Slice F6 — Background frame queue

### Goal

Move non-critical work out of first-token path.

### Files

```text
lib/penny-background-frame.js
test/penny-background-frame.test.js
lib/penny-static-memory-index.js
lib/penny-open-loops.js
lib/penny-session-reflection.js       // once implemented
```

### Work

Create a tiny local queue abstraction:

```js
queueBackgroundFrameJob({
  id,
  kind,
  priority,
  run,
  deadlineMs,
  dedupeKey,
})
```

Job kinds:

- static-index-update
- open-loop-refresh
- session-reflection-prep
- memory-link-refresh
- pulse-card-prep
- artifact-summary

### Rules

- Jobs are local-only.
- Jobs are bounded.
- Jobs can be skipped/deduped.
- Jobs must not claim completion unless run.
- Jobs must not perform side effects that require approval.

### Tests

```bash
node --test test/penny-background-frame.test.js
git diff --check
```

### Acceptance

Penny has a safe place for post-turn/between-turn work.

### Suggested commit

```text
runtime: add bounded background frame queue
```

---

## Slice F7 — Frame budget eval harness

### Goal

Create a compare harness that measures bounded-aliveness modes against baseline.

### Files

```text
scripts/eval-penny-frame-budget.js
lib/penny-frame-budget.js
lib/penny-aliveness-qa.js             // if Tier 1 compare exists
test/penny-frame-budget-eval.test.js
package.json
```

### Command

```json
"eval:frame-budget": "node scripts/eval-penny-frame-budget.js"
```

Modes to compare:

```text
baseline
static-live-shadow
static-live-advisory
static+open-loops
bounded-aliveness
```

Metrics:

- first-token latency
- total latency
- pre-prompt budget ms
- candidates inspected
- candidates rendered
- static-only rendered count
- open loops scored/rendered
- prompt token delta
- stale correction failures
- overclaim regressions
- human-observable wins
- annoyance regressions

### Artifact

```text
output/frame-budget-compare-<stamp>.json
```

### Tests

```bash
node --test test/penny-frame-budget.test.js test/penny-frame-budget-eval.test.js
git diff --check
```

### Acceptance

The project can decide whether bounded-aliveness features are worth their runtime cost.

### Suggested commit

```text
eval: add Penny frame budget compare harness
```

---

## Slice F8 — Docs/status update

### Goal

Record what landed and what remains deferred.

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
docs/plans/penny-external-lessons-master-action-plan-2026-04-21.md
```

### Required doc language

- Frame budget receipts are runtime-shape evidence, not answer-quality proof.
- Faster runtime is spent first on pre-prompt selection/source checks, not prompt bloat.
- Background frame work is bounded and local.
- Missed sidecar deadlines degrade gracefully.
- PromptTruth/toolEvidenceReceipt boundaries remain unchanged.

### Tests

```bash
git diff --check
npm test
```

### Suggested commit

```text
docs: record frame budget runtime follow-through
```

---

## Suggested overall acceptance gate

The frame-budget train is successful only if Penny can show, per run:

```text
- pre-prompt sidecar timings
- candidates/open-loops inspected
- selected/rendered counts
- budget misses/degraded modes
- prompt token delta
- first-token/total latency
- stale correction guardrail status
- overclaim/annoyance regressions
```

And the docs can truthfully say:

```text
Penny got more situated by inspecting/selecting better signals, not by defaulting to more rendered context.
```

---

## Agent handoff prompt

```text
You are implementing Penny Frame Budget Runtime slices.

Treat the Penny Frame Budget Mantra as law for this work:
"Every Penny turn has a frame budget. Spend it first on relevance, source authority, and candidate selection before spending it on more rendered context. Faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory."

Do not expand PromptTruth.
Do not merge toolEvidenceReceipt into PromptTruth.
Do not change runtime voice.
Do not raise default prompt/rendered memory limits.
Do not treat frame budget artifacts as answer-quality proof.
Do not broaden server.js.

Start each slice with:
- git status --short
- git rev-parse --short HEAD
- inspect the files named in the slice

End each slice with:
- focused tests
- git diff --check
- summary of behavior changed vs not changed
- suggested commit message
```
