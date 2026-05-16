# Penny Session Reflection Current-Law Note

> Category: Implementation plan
> Status: Current planning handoff
> Slice: R0 docs-only boundary note
> Use this for: session-reflection boundaries before schema, policy, fixture, queue, or prompt-bridge work.
> Do not use this for: proof that reflection behavior shipped or permission to write memory automatically.

Full slice plan: [penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md](./penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md).

## Core Rule

Reflection can suggest. It cannot canonize.

Session reflection can summarize, suggest, and prepare reviewable updates. It cannot silently write canonical memory.

Memory suggestions require explicit approval or an existing explicit-memory workflow. Until an explicit approval slice routes a suggestion through the existing explicit-memory path, every suggestion must keep:

- support state
- sensitivity
- `requiresApproval: true`
- `autoPromoted: false`

## Authority Boundaries

Session reflection artifacts are reviewable synthesis, not truth proof. A generated summary does not prove that the summarized claim is true.

Reflection artifacts are not:

- PromptTruth
- `toolEvidenceReceipt`
- hidden chain-of-thought
- explicit memory
- runtime voice law
- permission to raise prompt or rendered-memory limits

Reflection must not:

- write `data/penny-memory.json`
- promote archive, semantic, static, or candidate-only support into canonical facts
- save inferred emotions or temporary states as memory
- rewrite old memory truth without the existing correction path
- claim source verification without receipts
- broaden `server.js`

## Memory-Suggestion Shape

Future schema/policy slices should keep memory suggestions review-gated and source-aware. A safe suggestion shape should include the support basis, sensitivity, approval status, and non-promotion status before any queue or prompt bridge can consume it.

Suggested minimum fields:

```js
{
  id,
  text,
  kind,
  confidence,
  supportState,
  supportLevel,
  sourceReceipts: [],
  sensitivity,
  requiresApproval: true,
  autoPromoted: false,
  suggestedExplicitMemory: null
}
```

Unsupported, sensitive, inferred-emotion, or temporary-state candidates should become `doNotSave`, warning, or review-held items rather than explicit-memory suggestions.

## Relationship To Existing State

Explicit memory remains canonical. Archive memory, semantic/static candidates, research-ledger continuity, open-loop state, and reflection artifacts are advisory unless an existing contract says otherwise.

Reflection may propose open-loop updates, but open loops remain advisory project/session state. Completing or dismissing an open loop still requires the existing allowed basis, not model vibes.

The frame-budget rule applies here too: spend runtime on source authority, support classification, and candidate selection before rendering more prompt context. A prompt bridge should come only after schema, policy, fixture, queue, and compare slices prove the behavior stays useful and bounded.

## Behavior Changed Vs Not Changed

Changed in R0:

- High-level docs now name the session-reflection memory boundary directly.
- The next implementation slices are routed toward schema, policy, and fixture work before live prompt bridges.
- Memory suggestions are documented as approval-gated and non-promoting by default.

Not changed in R0:

- No runtime behavior changed.
- No explicit memory write path changed.
- No PromptTruth or `toolEvidenceReceipt` schema changed.
- No hidden reasoning storage was added.
- No runtime voice files changed.
- No prompt/rendered-memory limits changed.

## Next Slice Routing

Start with deterministic helper work before any runtime/LLM reflection:

1. R1: `lib/penny-session-reflection.js` schema and pure helpers.
2. R2: `lib/penny-memory-suggestions.js` policy classification and unsafe-candidate rejection.
3. R3: fixture-only reflection builder and QA artifact.

Defer background queues, review queues, explicit approval routing, open-loop update bridges, and prompt-bridge compares until the fixture/schema/policy slices are in place.
