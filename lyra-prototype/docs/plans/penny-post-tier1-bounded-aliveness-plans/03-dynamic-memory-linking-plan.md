# Penny Dynamic Memory Linking Plan

> Status: near-future implementation plan after Tier 1 bounded-aliveness primitives.
> Theme: let Penny notice relationships among memories, open loops, research notes, corrections, and project threads without migrating to a graph DB or promoting advisory links into truth.
> Scope: advisory relation fields first, link receipts/traces, correction/source guardrails, optional ranking boost only after QA.

---

## Product goal

Penny should not merely remember isolated snippets. She should notice relationships like:

```text
“This static embedding idea is the same pattern as the ledger bridge lesson: keep the live signal, tighten relevance, measure overclaim.”
```

or:

```text
“That archive note is related to the mascot correction, but it is the stale side of the correction chain, so I should not use it as current truth.”
```

That kind of connection creates aliveness. But the links must stay advisory.

---

## Core rule

> **A memory link is a retrieval/navigation hint, not proof that either side is true.**

Dynamic links may help:

- retrieval ranking
- open-loop resurfacing
- stale/current correction handling
- session reflection
- pulse cards
- candidate explanation

They may not:

- make advisory memory canonical
- override explicit memory
- auto-promote candidate-only support
- become hidden graph authority
- require a graph database migration

---

## Source anchors and current-law reminders

Relevant anchors:

- `docs/penny-link-batch-research-pass-2026-04-21.md`: BrainDB-style relations are maybe-later pattern references; do not migrate to a graph DB without measured failure. Raw sources, synthesis, indexes, logs, and review notes should remain separate layers.
- `docs/penny-ledger-prompt-compare-note-2026-04-17.md`: bounded continuity helped when measured; the right path was keep and tighten relevance.
- `docs/penny-sharper-candidate-selection-research-plan-2026-04-21.md`: companion memory, code search, imported chats, and research docs have different truth boundaries; do not collapse them into one universal index.

Current-law boundaries:

- Explicit memory remains canonical.
- Archive/research/semantic/static retrieval is advisory.
- Candidate survival/retrieval artifacts are not answer-quality proof.
- PromptTruth remains prompt-time rendered/candidate memory/research context.
- No graph DB or vector DB rewrite by default.

---

## Link types

Start small. Link types should be legible and useful.

Suggested v1 relation types:

```text
correction-of
stale-prior-of
current-correction-for
same-project-thread
follow-up-to
implements-plan
source-for
summary-of
contradicts
supports
evidence-for
open-loop-about
user-preference-evidence
research-pattern-for
related-but-weak
```

Each link should carry:

```text
source id
target id
relation type
confidence
support/source reason
authority effect
createdAt
updatedAt
expiry/decay if applicable
```

Important distinction:

```text
relation type = navigation/scoring hint
authority effect = how the policy is allowed to use it
```

For example:

```text
relation: stale-prior-of
authorityEffect: penalize-as-current-truth
```

versus:

```text
relation: same-project-thread
authorityEffect: retrieval-boost-only
```

---

## Proposed artifact/schema: `penny-memory-links.v1`

```js
{
  schema: 'penny-memory-links.v1',
  generatedAt,
  measurementMode: 'fixture' | 'archive-unit' | 'live-shadow' | 'live-advisory',
  behaviorChanged: false,

  links: [
    {
      id,
      sourceId,
      targetId,
      relation: 'correction-of',
      confidence: 'low' | 'medium' | 'high',
      support: {
        state: 'explicit' | 'rendered' | 'archive' | 'semantic-candidate' | 'research' | 'unknown',
        sourceReceipts: [],
        explanation: ''
      },
      authorityEffect: 'none' | 'retrieval-boost-only' | 'current-truth-boost' | 'stale-current-penalty' | 'do-not-render-as-current',
      directionality: 'directed' | 'bidirectional',
      createdAt,
      updatedAt,
      expiresAt: null,
      createdBy: 'deterministic' | 'reflection' | 'user-approved' | 'fixture' | 'model-assisted-review',
      reviewState: 'auto-safe' | 'needs-review' | 'approved' | 'rejected'
    }
  ],

  summary: {
    totalLinks: 0,
    byRelation: {},
    needsReview: 0,
    authorityAffectingLinks: 0
  },

  limits: [
    'Memory links are advisory retrieval/navigation hints.',
    'Links do not make advisory memory canonical.',
    'Correction links may affect ranking only through explicit policy gates.',
    'No graph database migration is implied.'
  ]
}
```

---

## Suggested repo seams

```text
lib/penny-memory-links.js              // schema, normalization, link store helpers
lib/penny-memory-link-policy.js        // scoring/authority use rules, optional separate module
lib/penny-memory-archive-policy.js     // later ranking integration
lib/penny-memory-archive.js            // candidate trace/link attachment
lib/penny-session-reflection.js        // proposed link suggestions from reflection
lib/penny-open-loops.js                // open-loop-about links
lib/penny-candidate-survival-qa.js     // link-aware survival artifacts
scripts/qa-penny-memory-links.js       // fixture/archive-unit runner
```

Tests:

```text
test/penny-memory-links.test.js
test/penny-memory-link-policy.test.js
test/penny-memory-archive-policy.test.js
test/penny-candidate-survival-qa.test.js
test/penny-session-reflection.test.js
```

Avoid:

```text
graph DB migration
universal index for all sources
link-based truth promotion
hidden uninspectable relation inference
large prompt bridge of link graph
```

---

# Slice-by-slice implementation plan

## Slice L0 — Docs/current-law note

### Goal

Define dynamic memory links as advisory hints, not graph authority.

### Files

```text
README.md
ARCHITECTURE.md
CODEBASE.md
docs/README.md
docs/plans/penny-dynamic-memory-linking-plan-2026-04-22.md
```

### Required doc language

```text
Dynamic memory links help retrieval, correction handling, open-loop resurfacing, and reflection.
They do not make advisory memories canonical.
They do not replace explicit memory.
They do not require a graph DB.
```

### Tests

```bash
git diff --check
```

### Suggested commit

```text
docs: add dynamic memory linking boundaries
```

---

## Slice L1 — Memory link schema and pure helpers

### Goal

Create the link schema and normalization/summarization helpers.

### Files

```text
lib/penny-memory-links.js
test/penny-memory-links.test.js
```

### Exports

```js
const PENNY_MEMORY_LINKS_SCHEMA = 'penny-memory-links.v1';

const MEMORY_LINK_RELATIONS = Object.freeze({
  CORRECTION_OF: 'correction-of',
  STALE_PRIOR_OF: 'stale-prior-of',
  CURRENT_CORRECTION_FOR: 'current-correction-for',
  SAME_PROJECT_THREAD: 'same-project-thread',
  FOLLOW_UP_TO: 'follow-up-to',
  IMPLEMENTS_PLAN: 'implements-plan',
  SOURCE_FOR: 'source-for',
  SUMMARY_OF: 'summary-of',
  CONTRADICTS: 'contradicts',
  SUPPORTS: 'supports',
  EVIDENCE_FOR: 'evidence-for',
  OPEN_LOOP_ABOUT: 'open-loop-about',
  USER_PREFERENCE_EVIDENCE: 'user-preference-evidence',
  RESEARCH_PATTERN_FOR: 'research-pattern-for',
  RELATED_BUT_WEAK: 'related-but-weak',
});

function normalizeMemoryLink(input) {}
function normalizeMemoryLinkSet(input) {}
function summarizeMemoryLinks(links) {}
function findLinksForItem(links, itemId, options = {}) {}
function invertDirectedLink(link) {}
function validateMemoryLink(link) {}
```

### Tests

```bash
node --test test/penny-memory-links.test.js
git diff --check
```

Test:

- valid relation types normalize
- invalid relation rejected
- authority effect defaults to none/retrieval-only
- link summary counts relation types
- directed vs bidirectional behavior clear
- support state defaults to unknown/advisory

### Acceptance

Links can be represented and inspected without ranking/runtime changes.

### Suggested commit

```text
memory: add dynamic memory link schema
```

---

## Slice L2 — Deterministic correction-link builder

### Goal

Create safe links for explicit correction cases.

### Files

```text
lib/penny-memory-links.js
lib/penny-memory-link-policy.js
test/penny-memory-links.test.js
test/penny-memory-link-policy.test.js
```

### Why first

Correction links are the safest high-value link type because Penny already needs current-vs-stale protection.

### Helper

```js
buildCorrectionLinks({
  staleItem,
  currentItem,
  subject,
  staleObject,
  currentObject,
  supportState,
  sourceReceipts,
})
```

Output links:

```text
current-correction-for
stale-prior-of
contradicts or correction-of, depending direction
```

Authority effects:

```text
current-correction-for -> current-truth-boost only if source support strong enough
stale-prior-of -> stale-current-penalty / do-not-render-as-current
```

### Tests

Cases:

- brass fox -> copper rabbit
- oolong -> lapsang souchong
- silver watch -> gold watch
- weak candidate correction cannot become current-truth-boost without support

Run:

```bash
node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js
git diff --check
```

### Acceptance

Correction links exist and encode authority effects without changing ranking yet.

### Suggested commit

```text
memory: add deterministic correction memory links
```

---

## Slice L3 — Link-aware candidate trace, no scoring changes

### Goal

Attach relevant link metadata to candidate traces without changing selection/rendering.

### Files

```text
lib/penny-memory-archive.js
lib/penny-memory-links.js
lib/penny-candidate-survival-qa.js
test/penny-memory-archive.test.js
test/penny-candidate-survival-qa.test.js
```

### Trace addition

Candidate trace item may include:

```js
memoryLinks: {
  incoming: [],
  outgoing: [],
  relationSummary: {
    stalePriorOf: 1,
    currentCorrectionFor: 0,
    sameProjectThread: 2
  },
  authorityEffects: ['stale-current-penalty'],
  linkTraceLimit: 6
}
```

### Rules

- Bounded link trace.
- No prompt rendering of raw link graph.
- No scoring/ranking change yet.
- Links in trace are diagnostic.

### Tests

- trace includes links when requested
- trace omitted/bounded by default or option
- selected/rendered counts unchanged
- correction case shows stale/current link metadata

Run:

```bash
node --test test/penny-memory-archive.test.js test/penny-candidate-survival-qa.test.js test/penny-memory-links.test.js
git diff --check
```

### Suggested commit

```text
memory: trace dynamic links on archive candidates
```

---

## Slice L4 — Link fixture/QA runner

### Goal

Create a QA artifact that shows link extraction and interpretation on fixture cases.

### Files

```text
scripts/qa-penny-memory-links.js
lib/penny-memory-links.js
lib/penny-memory-link-policy.js
test/penny-memory-links-script.test.js
package.json
```

### Command

```json
"qa:memory:links": "node scripts/qa-penny-memory-links.js --fixture"
```

### Fixture cases

1. Correction chain:
  - brass fox stale, copper rabbit current.
2. Same project thread:
  - static embeddings live-advisory plan linked to frame budget principle.
3. Open-loop relation:
  - “correction guardrails” open loop linked to static live-advisory feature.
4. Research-pattern relation:
  - ledger bridge lesson linked to bounded-aliveness design.
5. Weak relation:
  - two semantically similar but authority-unrelated memories should be related-but-weak only.

### Artifact path

```text
output/memory-links-fixture-<stamp>.json
```

### Tests

```bash
node --test test/penny-memory-links.test.js test/penny-memory-link-policy.test.js test/penny-memory-links-script.test.js
npm run qa:memory:links
git diff --check
```

### Acceptance

Memory links are inspectable and do not change runtime behavior.

### Suggested commit

```text
qa: add dynamic memory link fixture runner
```

---

## Slice L5 — Link-aware scoring shadow

### Goal

Compute how links would affect ranking without activating it.

### Files

```text
lib/penny-memory-archive-policy.js
lib/penny-memory-link-policy.js
test/penny-memory-archive-policy.test.js
test/penny-memory-link-policy.test.js
```

### Shadow fields

```js
linkShadowScore: {
  score,
  components: {
    currentCorrectionBoost,
    stalePriorPenalty,
    sameProjectThreadBoost,
    openLoopRelevanceBoost,
    weakRelationPenalty
  },
  reasons: [],
  wouldChangeRank: true | false,
  active: false
}
```

### Rules

- Current active rank unchanged.
- Shadow can say “would help/hurt.”
- Correction links get stronger effect than project-thread links.
- Weak relations cannot override source authority.

### Tests

- brass fox stale gets shadow penalty
- copper rabbit current gets shadow boost
- same-project-thread boosts but does not outrank current correction/source authority
- active selected/rendered unchanged

Run:

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-memory-link-policy.test.js
git diff --check
```

### Suggested commit

```text
memory: add dynamic link scoring shadow
```

---

## Slice L6 — Link-aware candidate survival artifact

### Goal

Extend candidate-survival QA to report whether links would have prevented/helped failures.

### Files

```text
lib/penny-candidate-survival-qa.js
scripts/qa-penny-memory.js
test/penny-candidate-survival-qa.test.js
test/penny-memory-qa-script.test.js
```

### Artifact addition

```js
linkAnalysis: {
  expectedCandidateLinks: [],
  staleCandidateLinks: [],
  linkFailureMode: 'none' | 'missing-link' | 'wrong-link' | 'weak-link' | 'link-ignored' | 'link-would-help',
  shadowRankDelta: null,
  verdict: 'not-run' | 'helps' | 'hurts' | 'neutral'
}
```

### Tests

- missing correction link classified
- stale candidate has stale-prior link
- link shadow would improve rank in correction case
- candidate-only link does not create verified support

Run:

```bash
node --test test/penny-candidate-survival-qa.test.js test/penny-memory-qa-script.test.js
npm run qa:memory:candidate-survival
git diff --check
```

### Suggested commit

```text
qa: report dynamic link analysis in candidate survival
```

---

## Slice L7 — Activate conservative correction-link scoring behind gate

### Goal

Use only the safest link relation class in live/advisory ranking: current-vs-stale correction links.

### Files

```text
lib/penny-memory-archive-policy.js
lib/penny-memory-link-policy.js
lib/penny-memory-archive.js
test/penny-memory-archive-policy.test.js
test/penny-memory-archive.test.js
```

### Config

```text
PENNY_MEMORY_LINK_SCORING=off|shadow|correction-v1
```

Default should be off or shadow unless current repo law says otherwise.

### Allowed active effects in `correction-v1`

```text
current-correction-for -> modest boost
stale-prior-of -> penalty or do-not-render-as-current
```

Disallowed active effects for now:

```text
same-project-thread boosting
research-pattern boosting
open-loop boosting
weak relation boosting
```

Those stay shadow until measured.

### Tests

- default unchanged
- correction-v1 improves current correction ranking
- stale old value not rendered as current
- prompt limits unchanged
- static/candidate-only support not promoted

Run:

```bash
node --test test/penny-memory-archive-policy.test.js test/penny-memory-archive.test.js test/penny-candidate-survival-qa.test.js
npm run qa:memory:candidate-survival
git diff --check
```

### Suggested commit

```text
memory: gate correction-link archive scoring
```

---

## Slice L8 — Reflection-generated link suggestions

### Goal

Let session reflection propose memory links, review-gated.

### Files

```text
lib/penny-session-reflection.js
lib/penny-memory-links.js
lib/penny-memory-link-policy.js
test/penny-session-reflection.test.js
test/penny-memory-links.test.js
```

### Behavior

Reflection can suggest:

- same-project-thread
- follow-up-to
- implements-plan
- research-pattern-for
- open-loop-about

But these suggestions should default to:

```text
reviewState: needs-review
authorityEffect: none or retrieval-boost-only shadow
```

### Tests

- static plan links to frame budget principle as same-project-thread/research-pattern
- open-loop links generated from reflection
- link suggestions do not activate ranking
- sensitive/user facts not linked without support

Run:

```bash
node --test test/penny-session-reflection.test.js test/penny-memory-links.test.js test/penny-memory-link-policy.test.js
git diff --check
```

### Suggested commit

```text
memory: let session reflection suggest advisory memory links
```

---

## Slice L9 — Dynamic link compare harness

### Goal

Measure whether dynamic links improve continuity/retrieval without overclaim.

### Files

```text
scripts/eval-penny-memory-links-compare.js
lib/penny-memory-links.js
lib/penny-aliveness-qa.js
test/penny-memory-links-compare.test.js
package.json
```

### Command

```json
"eval:memory-links": "node scripts/eval-penny-memory-links-compare.js"
```

### Modes

```text
links-off
links-trace-only
links-shadow
correction-links-active
project-links-shadow
```

### Metrics

- correction current-truth wins
- stale-memory regressions
- source authority failures
- continuity wins
- prompt token delta
- first-token latency delta
- candidate-survival rank delta
- overclaim regressions

### Acceptance

Only correction links should become active if they show clear wins and no truth regressions. Project-thread/open-loop links stay shadow until separately proven.

### Suggested commit

```text
eval: compare dynamic memory link modes
```

---

## Slice L10 — Docs/status update

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

- Dynamic links are advisory retrieval/navigation hints.
- Correction links may be used by gated policy if proven.
- Project/research/open-loop links remain shadow/advisory until measured.
- No graph DB or universal index migration.
- Links do not promote memory authority.

### Tests

```bash
git diff --check
npm test
```

### Suggested commit

```text
docs: record dynamic memory linking status
```

---

## Overall acceptance gate

The dynamic memory-linking train is successful only if:

```text
- links are inspectable and bounded
- correction/stale links improve current-vs-stale handling
- advisory/project links help traces/reflection without becoming truth authority
- candidate-survival artifacts can show link effects
- default prompt size does not grow
- no graph DB/platform migration occurs
- explicit memory remains canonical
```

---

## Agent handoff prompt

```text
You are implementing Penny Dynamic Memory Linking.

The core rule is:
A memory link is a retrieval/navigation hint, not proof that either side is true.

Do not migrate to a graph DB.
Do not build a universal memory index.
Do not promote advisory memories through links.
Do not expand PromptTruth.
Do not change runtime voice.
Do not activate broad project/research link scoring before shadow QA.
Do not let candidate-only/static/semantic links become verified support.

Start with schema and fixture traces.
Then add correction-link shadows.
Only activate conservative correction-link scoring behind a gate after tests.
Project-thread, open-loop, and research-pattern links stay advisory/shadow until separately measured.

Run focused tests and git diff --check for every slice.
```
