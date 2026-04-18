# Penny Progress Handoff - 2026-04-17

This is the compact continuity doc for the next agent session.

It is meant to answer four questions fast:

1. What changed today?
2. Why did we change it?
3. What is actually verified versus only believed?
4. What should happen next?

## Product Truths To Keep Fixed

- Penny is companion-first.
- Explicit memory is canonical.
- Archive memory is advisory, inspectable, and review-gated before promotion.
- Research ledger stays research-only.
- Background vectorization must stay bounded and secondary.
- Reasoning stays backstage. Do not turn it into a visible runtime language feature.
- Do not broaden this into platformization, connector sprawl, or personality flattening.

## What Landed Today

### 1. Memory trust / bounded platform pass

Implemented the approved bounded memory/platform slice:

- judged `write / retrieve / forget` memory QA on top of the existing harness
- archive utility scoring used for evals and shadow selection only
- bounded post-turn background vectorization
- native `ToolCapabilityDescriptor` seam without live connector expansion

Important files in that work:

- `lib/penny-memory-archive.js`
- `lib/penny-memory-archive-policy.js`
- `scripts/qa-penny-memory.js`
- `lib/penny-tool-registry.js`

Why:

- move memory quality forward without making Penny chaotic
- keep expensive work off the hot path
- create bounded eval surfaces before adding more memory cleverness

### 2. Review-driven truth hardening for vectorization and memory pressure

Implemented the external-review follow-up that tightened truthfulness:

- merge-aware embeddings-store writes so stale copies do not drop fresher vectors
- semantic-downgrade visibility instead of silent fallback
- stronger explicit-memory priority on natural direct-authority questions
- bounded inspector truth for background vectorization
- `sourceSessionId` added for background-vectorization inspector truth

Important files:

- `lib/penny-memory-archive.js`
- `lib/penny-memory.js`
- `public/js/penny-memory-panel.mjs`

Why:

- the real risk was not "more features" but hidden failure modes
- we needed to know when recall was downgraded, when canon was actually winning, and where vectorization state came from

### 3. Stability tightening for routing and advisory pressure

Implemented the bounded follow-up after the next external review:

- tightened memory-heavy trigger logic so borderline casual prompts stop drifting into semantic recall
- aligned `lib/penny-epistemics.js` with that same tighter predicate
- broadened canon-first handling for natural direct-memory-authority prompts
- added a judged canonical-vs-advisory conflict scenario

Important files:

- `lib/penny-latency-budget.js`
- `lib/penny-epistemics.js`
- `lib/penny-memory.js`
- `scripts/qa-penny-memory.js`

Why:

- the main architectural risk was not background vectorization itself
- it was the keyword-shaped routing gate causing ordinary chat to fall into heavier memory behavior too often

### 4. External-memory lessons imported carefully

Only the smallest safe lessons were actually imported:

- atomic JSON writes for Penny's persistent stores
- a small cross-session isolation tightening for research-ledger prompt eligibility

Important files:

- `lib/penny-atomic-json.js`
- `server.js`
- `lib/penny-memory-archive.js`
- `lib/penny-memory-books.js`
- `lib/penny-research-ledger.js`

Why:

- these reduce corruption and cross-session bleed without changing product behavior
- broader lessons like visible reasoning language or more automatic memory injection were explicitly deferred

## What Just Landed In The Latest Pass

This was the most recent patch before this handoff:

- visible-reply cleanup is now measured as a first-class runtime truth
- canonical-vs-advisory pressure is now measured as a first-class runtime truth
- research-ledger prompt eligibility no longer treats unrelated cross-session `open` topics as automatically eligible
- the memory inspector now shows compact cleanup and authority-pressure summaries
- a short runtime authority contract doc was added

Important files:

- `lib/penny-visible-reply.js`
- `lib/penny-lmstudio-transports.js`
- `lib/penny-runtime-artifacts.js`
- `lib/penny-route-handlers.js`
- `lib/penny-research-ledger.js`
- `public/js/penny-memory-panel.mjs`
- `scripts/qa-penny-memory.js`
- `docs/penny-runtime-authority-contract-2026-04-17.md`

New runtime-artifact fields:

- `artifact.modelAdvisory.cleanup`
- `artifact.modelAdvisory.authorityPressure`

What those fields mean:

- `cleanup` tells us whether the visible reply passed through cleanly, needed strip-only cleanup, or was materially reconstructed from draft/reasoning spill
- `authorityPressure` tells us whether canon was present, whether canon override was active, and how much advisory pressure came from same-session vs cross-session material

Why:

- external review was right that Penny already had enough machinery
- the highest-value work was making current behavior more truthful and more debuggable

## Important QA / Runtime Bugs Fixed Today

Several real bugs surfaced during QA and were fixed:

- duplicate LM Studio embedding-model loads
- memory QA harness accidentally using stateful transport and inheriting hidden LM Studio thread state
- incomplete disconnect handling for long-running routes
- smoke QA including an overlong obfuscated-routing probe
- research-ledger bleed into disposable QA state
- persistence writes that were less interruption-safe than they should have been

These fixes matter because some earlier "memory failures" were partially harness/runtime problems, not only Penny behavior problems.

## Verification Status

### Verified in repo tests

Latest full verification after the cleanup/authority pass:

- `npm test`
- result: `235 passing, 0 failing, 3 todo`

Also verified with the targeted slice for:

- visible reply cleanup classification
- LM Studio transport cleanup propagation
- runtime artifact normalization
- research-ledger prompt eligibility
- inspector rendering
- QA-script authority-pressure checks
- mock-LM-Studio route serialization

### Verified in live QA earlier today

The latest meaningful live judged memory QA artifact before the newest cleanup/authority pass was:

- `output/memory-qa-judged-2026-04-18T00-26-05-064Z.json`

That run showed:

- `write: 3/3`
- `retrieve: 2/3`
- `forget: 0/1`

Important nuance:

- the remaining `forget` red in that artifact was later identified as a scorer issue, and the scorer was patched afterward
- the latest cleanup/authority pass was **not** followed by another long live LM Studio QA run
- so the newest pass is repo-test verified and isolated-route verified, but not yet re-judged live end-to-end

## What Was Learned

### Good changes to keep

- bounded background vectorization is defensible for a companion-first product as long as it stays tiny, post-turn, and inspectable
- canon-first direct memory handling is worth preserving
- cleanup dependence should be measured, not hidden
- same-session versus cross-session advisory pressure is an important truth distinction
- research-ledger prompt eligibility should be relevance-shaped, not merely "open-topic"-shaped

### Things explicitly rejected

- no visible reasoning-language feature in runtime prompts or replies
- no broader memory policy engine
- no connector expansion in this phase
- no more archive cleverness unless it replaces older behavior or fixes a proven failure

## Current Honest State

Penny is in a much more truthful and inspectable state than at the start of the day.

What is stronger now:

- runtime artifacts tell the truth about cleanup and authority pressure
- research-ledger cross-session bleed is tighter
- the QA harness is much less likely to mislead us with hidden state or runaway smoke cases
- the inspector is materially more useful

What is still not fully closed:

- semantic archive retrieval is still the most likely next live-QA focus if work continues on memory quality
- the newest cleanup/authority pass has not yet been followed by another long judged live run

## Suggested Next Step For The Next Agent

If continuing memory work, the next agent should probably:

1. Read this doc.
2. Read `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and `docs/penny-runtime-authority-contract-2026-04-17.md`.
3. Treat the latest cleanup/authority fields as the current runtime truth contract.
4. If live QA is needed, run one bounded judged memory QA pass only after confirming LM Studio is clean and idle.
5. Prioritize real semantic archive retrieval behavior over adding more features.

If the next step is git hygiene instead of more memory work:

1. Curate the working tree carefully.
2. Do not commit `.lyra-server.pid` or `.lyra-server.meta.json`.
3. Keep the docs and tests with the code changes; they are part of the truth-hardening work, not optional garnish.

## Useful Reference Docs In This Repo

- `docs/penny-comparative-platform-memory-pass-2026-04-16.md`
- `docs/penny-ledger-prompt-compare-note-2026-04-17.md`
- `docs/penny-external-memory-lessons-2026-04-17.md`
- `docs/penny-runtime-authority-contract-2026-04-17.md`
- `docs/penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md`

## Short Version

Today's work was about making Penny's current memory/runtime behavior more truthful, bounded, and inspectable, not about making her bigger.

The next agent should preserve that framing.