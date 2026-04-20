# PromptTruth v2 Completion Note

> Category: Completion note
> Authority: Historical/current handoff
> Status: Current as of 2026-04-19; live full-suite recheck also run on 2026-04-20
> Use this for: understanding what landed in PromptTruth v2 and toolEvidenceReceipt.
> Do not use this for: overriding current-law contracts, code, tests, or runtime artifacts.

## 1. Status

- PromptTruth v2 implementation and validation are complete as of this note.
- `artifact.toolEvidenceReceipt` implementation and validation are complete as a sibling runtime-artifact receipt.
- The original Slice 6 design doc is now historical design input only; its planned receipt shape landed through the later implementation/validation slices.
- The current live checkout passes the full test suite at `331 passing, 0 failing, 3 todo` via `npm test --silent` on 2026-04-20.
- Slice 8's practical outcome still stands: no corrective runtime slice is currently indicated.

## 2. What PromptTruth now means

- PromptTruth is the prompt-time receipt for prompt-assembly memory, research, and advisory context.
- Construction stays with `lib/penny-memory.js` because it owns memory-channel selection and holdback decisions.
- `lib/penny-prompttruth.js` owns shared read, normalization, and projection helpers.
- `buildPromptStack(...)` uses a shared prompt-memory construction result so the rendered memory block and PromptTruth receipt come from the same pass.
- `selected*Ids` are candidate-continuity fields.
- `rendered*Ids` are prompt-visible identity fields.
- Canonical rendered names are primary.
- Old injected aliases are compatibility-only.
- `researchLedgerPromptInjected` remains compatibility-only and means the same thing as rendered ledger truth.

## 3. PromptTruth channel states

- `stableFacts`: `rendered`, `no_candidate`
- `memoryBooks`: `rendered`, `no_candidate`, `unknown`
- `sessionArchive` / `globalArchive`: `rendered`, `held_back`, `no_candidate`, `ineligible`, `unknown`
- `researchLedger`: `rendered`, `held_back`, `no_candidate`, `disabled`, `unknown`
- `candidate` is supported by shared normalization when supplied, but the live builder does not emit a separate candidate-only path yet.
- `unavailable` and `excluded_before_candidate` remain deferred.

## 4. What toolEvidenceReceipt now means

- `artifact.toolEvidenceReceipt` is a sibling runtime-artifact receipt.
- It is not a PromptTruth channel.
- It is built and normalized in `lib/penny-runtime-artifacts.js`.
- It is populated from explicit `toolEvidenceFacts` emitted by source owners.
- It does not infer from `executionPath`, `modelUsed`, or generic `toolRecords` alone.
- Old artifacts without the receipt normalize to `null` / absence, not synthetic `unknown` items.
- It stores compact `sourceRefs`, not bulky raw tool payloads.
- The memory inspector renders it as a separate `Tool evidence receipt` row.

## 5. Tool evidence path coverage

- `direct_deterministic` | `not_prompt_visible` | `deterministic_only` | `none` | `none`
- `direct_single_tool_context_answer` | `prompt_visible` | `none` | `raw_json` | `single`
- `direct_open_ended_sequence` | `not_prompt_visible` | `provenance_only` | `none` | `none`
- `native_tool_loop` | `prompt_visible` | `none` | `raw_json` | `multi`
- `manual_tool_loop` | `prompt_visible` | `none` | `raw_json` | `multi`
- `native` / `manual` auto-verification | `prompt_visible` | `none` | `auto_verification_json` | `multi` | only on proven re-prompted paths
- `write_rescue` | `prompt_visible` | `none` | `summarized_write_rescue` | `single`
- `semantic_render` | `prompt_visible` | `none` | `summarized_semantic_core` | `single`

## 6. Server.js ownership

- `server.js` does not own PromptTruth semantics.
- `server.js` forwards `promptTruth` and related context.
- `server.js` owns only the exact `semantic_render` source-fact seam because semantic render still lives there.
- Generic tool-evidence fact dedupe now lives in `lib/penny-runtime-artifacts.js`.
- `server.js` should not become a general evidence classifier.

## 7. Compatibility still present

- `researchLedgerPromptInjected`
- retrieval `injected` alias
- `authorityPressure.advisoryChannelsInjected` / `authorityPressure.advisoryItemsInjected`
- QA `promptInjectedCases`
- route, artifact, trace, and inspector readers still accept old injected-name fallbacks while canonical rendered-name fields stay primary

These are compatibility aliases. Do not treat them as canonical names or broader semantics.

## 8. Deferred / do not implement casually

- `unavailable` PromptTruth state
- `excluded_before_candidate` PromptTruth state
- removing old injected aliases
- exact tool-loop hop counts
- backfilling old artifacts with synthetic `unknown` `toolEvidenceReceipt` items
- adding `toolEvidence` to PromptTruth
- using `executionPath`, `modelUsed`, or `toolRecords` alone to infer `toolEvidenceReceipt`
- broad `server.js` refactor
- redoing the finished sibling-receipt decision as if tool evidence still needs to become a PromptTruth channel

## 9. Tests / verification map

- PromptTruth normalization and rendered/candidate IDs: `test/penny-prompttruth.test.js`, `test/penny-memory.test.js`
- Prompt stack single-pass construction: `test/penny-prompt-stack.test.js`
- Route/runtime/archive compatibility fields: `test/penny-runtime-artifacts.test.js`, `test/penny-memory-archive.test.js`, `test/penny-ledger-compare.test.js`, `test/penny-memory-qa-script.test.js`
- Memory panel rendering: `test/penny-memory-panel.test.js`
- Direct tool evidence facts: `test/penny-direct-tool-assist.test.js`
- Tool-loop evidence facts: `test/penny-tool-loop.test.js`
- Write rescue: `test/penny-tool-loop.test.js`, `test/penny-runtime-artifacts.test.js`
- Semantic render: `test/penny-semantic-render-tool-evidence.test.js`, `test/penny-runtime-artifacts.test.js`
- Route-level combined receipt: `test/penny-route-handlers.test.js`, `test/penny-routes.test.js`
- Persisted readback: `test/penny-routes.test.js`
- No coarse `toolRecords` inference: `test/penny-runtime-artifacts.test.js`, `test/penny-routes.test.js`

## 10. Future safe follow-ups

- Alias removal can happen only after repo search proves no live consumers still need old names.
- `unavailable` / `excluded_before_candidate` need upstream state modeling first.
- `server.js` de-centralization should remain bounded and behavior-preserving.
- This completion note is not current law if it conflicts with contracts, code, tests, or runtime artifacts.
