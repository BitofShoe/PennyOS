# PromptTruth v2 Slice 6 - Tool Evidence Receipt Design

> Category: Implementation plan
> Authority: Implementation plan
> Status: Draft
> Use this for: the sibling runtime-artifact receipt for post-tool evidence visibility, render form, and prompt-hop shape.
> Do not use this for: changing PromptTruth, changing runtime semantics, or treating tool evidence as a first-class PromptTruth channel.

## Goal and success criteria

- Goal: design a truthful runtime-artifact-owned sibling receipt for tool-evidence visibility without widening PromptTruth.
- User-facing or engineering success criteria: the receipt can distinguish deterministic-only tool replies, provenance-only tool evidence, raw JSON prompt-visible tool evidence, summarized post-tool seams, and unknown instrumentation gaps without inferring from artifact summaries.
- What will be considered done: additive source facts are identified, the artifact owner is clear, the schema is bounded, compatibility rules are explicit, and the next implementation slice is small and testable.

## Decisions already locked

- Do not add `toolEvidence` as a PromptTruth channel.
- Do not add unavailable or excluded PromptTruth states just to model tool paths.
- Keep `server.js` as a forwarding seam, not the owner of tool-evidence truth semantics.
- Keep runtime semantics unchanged. This slice is about receipts, not behavior.
- Do not duplicate bulky raw tool output into the receipt.

## Blind spots / what are we not considering?

- Current `executionPath` and `modelUsed` are too coarse to derive this receipt safely.
- The direct single-tool LM-assist path calls `runLmStudioToolContextAnswer(...)`, but `runDirectToolAssist(...)` does not currently emit a distinct source fact for that model hop.
- A single tool-loop turn can expose tool evidence across multiple model hops, so PromptTruth-style single rendered counts do not map cleanly here.
- Old artifacts and audit snapshots do not carry enough path facts to backfill this receipt honestly.

## Delegation map

- Read-only exploration tasks and assigned subagents: none; this slice stayed read-only in the main agent because no delegation request was made.
- QA inspection tasks and assigned subagents: none.
- Doc mapping tasks and assigned subagents: none.
- Single primary editor per file boundary: one docs-only edit in `docs/plans/`.

## Working rules

- Treat this as a runtime-artifact sibling receipt, not a prompt-assembly receipt.
- Prefer explicit upstream source facts over artifact-side inference.
- Keep the final receipt under the artifact root and keep any internal source-fact contract private to the runtime.
- Keep old artifacts valid when the receipt is absent.

## Evidence to gather

- Files to read: `lib/penny-tool-loop.js`, `lib/penny-direct-tool-assist.js`, `server.js`, `lib/penny-route-handlers.js`, `lib/penny-runtime-artifacts.js`, `public/js/penny-memory-panel.mjs`, `scripts/eval-penny-ledger-compare.js`, `scripts/eval-penny-probes.js`, `test/penny-runtime-artifacts.test.js`, `test/penny-memory-panel.test.js`, `test/penny-direct-tool-assist.test.js`, `test/penny-tool-loop.test.js`, `docs/penny-prompttruth-contract-2026-04-19.md`, `docs/penny-runtime-authority-contract-2026-04-17.md`.
- Commands to run: local repo inspection, targeted `rg`/snippet reads, and route/tool test subsets before any implementation.
- Ownership boundaries to confirm: prompt truth stays with prompt assembly; tool-evidence receipt is built in runtime-artifact code from source facts emitted by tool-path owners.
- Known risks: overclaiming prompt visibility, inventing multi-hop counts, or normalizing old artifacts into fake certainty.

## Design answers

1. What should the receipt be named?

- Use `toolEvidenceReceipt`.
- Reason: the repo already uses `toolRecords`, `verified-tool-evidence`, and tool-lane language. `verifiedEvidenceReceipt` would sound broader than the actual problem and would blur retrieval, provenance, and route evidence into the same bucket.

2. Where should it live?

- Put it at the runtime-artifact root as `artifact.toolEvidenceReceipt`.
- Do not store it under `artifact.evidence`, `artifact.trace`, or `artifact.modelAdvisory`.
- Reason: it is a truth receipt sibling like `promptTruth`, not a preview entry list, trace summary, or advisory/policy block.

3. Which module should construct and normalize it?

- `lib/penny-runtime-artifacts.js` should own `buildToolEvidenceReceipt(...)` and `normalizeToolEvidenceReceipt(...)`.
- `lib/penny-route-handlers.js` should only forward already-collected source facts.
- `server.js` should forward semantic-render source facts only where it is the actual seam owner.

4. Which modules can provide source facts without inference?

- `lib/penny-direct-tool-assist.js`
  Direct deterministic replies, direct single-tool LM answers, direct open-ended edit sequences.
- `lib/penny-tool-loop.js`
  Native tool-loop raw tool-result messages, manual tool-loop raw tool-result messages, auto-verification messages, write-rescue summarized context.
- `server.js`
  Semantic-render summarized context, because `buildSemanticCore(...)` and `renderSemanticReplyAsPenny(...)` are still owned there.
- `lib/penny-runtime-artifacts.js`
  Provenance-only fallback classification when upstream facts explicitly say a path never re-entered a model prompt.

5. What are the minimal states and types needed?

- Recommended item fields:

```json
{
  "path": "direct_single_tool_context_answer",
  "promptVisibility": "prompt_visible",
  "nonPromptUse": "none",
  "renderForm": "raw_json",
  "modelHop": "single",
  "sourceRefs": [
    { "toolRecordIndex": 0, "toolName": "read_project_file", "target": "README.md" }
  ],
  "truncated": false
}
```

- Recommended enums:
  - `path`: `direct_deterministic`, `direct_single_tool_context_answer`, `direct_open_ended_sequence`, `native_tool_loop`, `manual_tool_loop`, `write_rescue`, `semantic_render`, `artifact_provenance_fallback`, `unknown`
  - `promptVisibility`: `prompt_visible`, `not_prompt_visible`, `unknown`
  - `nonPromptUse`: `none`, `deterministic_only`, `provenance_only`, `unknown`
  - `renderForm`: `raw_json`, `auto_verification_json`, `summarized_write_rescue`, `summarized_semantic_core`, `none`, `unknown`
  - `modelHop`: `none`, `single`, `multi`, `unknown`

6. How should the receipt represent multiple prompt hops in tool loops?

- Do not try to backfill exact hop counts.
- Use `modelHop: "multi"` for native and manual tool loops, because the same tool result can stay in the conversation across more than one later model call.
- Use `modelHop: "single"` for `runLmStudioToolContextAnswer(...)`, write rescue, and semantic render.
- Use `modelHop: "none"` for deterministic-only and provenance-only paths.

7. How should it distinguish raw JSON from summarized evidence?

- Use `renderForm`.
- `raw_json` means the prompt got raw tool-result JSON.
- `auto_verification_json` means the prompt got the automatic post-edit verification JSON.
- `summarized_write_rescue` means the prompt got the lossy `Verified tool context` rescue summary.
- `summarized_semantic_core` means the prompt got the lossy semantic-core summary built from tool records.

8. How should it distinguish prompt-visible evidence from provenance-only evidence?

- Split this into two fields instead of overloading one:
  - `promptVisibility`
  - `nonPromptUse`
- Direct deterministic tool replies become `promptVisibility: "not_prompt_visible"` plus `nonPromptUse: "deterministic_only"`.
- Provenance-only tool evidence becomes `promptVisibility: "not_prompt_visible"` plus `nonPromptUse: "provenance_only"`.
- Prompt-visible tool evidence keeps `nonPromptUse: "none"`.

9. How should it avoid duplicating bulky raw tool output?

- Do not store raw tool JSON in the receipt.
- Store only compact `sourceRefs` with `toolRecordIndex`, `toolName`, and a small `target` hint when one already exists.
- Keep any `truncated` flag optional and only set it when the path owner already knows truncation happened.

10. How should inspector UI display it without implying PromptTruth support?

- Add one separate artifact row in `public/js/penny-memory-panel.mjs` labeled `Tool evidence receipt`.
- Suggested wording:
  - `Tool evidence receipt: prompt-visible 2 | deterministic-only 1 | provenance-only 1`
  - `raw json 2 | semantic summary 1 | multi-hop 2`
- Add a small note in the row copy: `runtime artifact receipt only; not a PromptTruth channel`.
- Do not merge it into the existing `Prompt truth` row, `authorityPressure`, or `researchLedgerPrompt` wording.

11. What compatibility concerns exist for old artifacts?

- Old artifacts should normalize to `toolEvidenceReceipt: null` or absence, not to synthetic unknown items.
- New code may emit `unknown` items only for live turns where the new source-fact contract is present but an individual path was not classified.
- Keep `RUNTIME_ARTIFACT_VERSION` at `penny-runtime-artifact.v1`; this is additive, not a semantic rewrite.
- Do not duplicate the receipt under `artifact.modelAdvisory`.

12. What tests are required before implementation?

- `test/penny-direct-tool-assist.test.js`
  Add cases for `toolEvidenceFacts` on direct deterministic replies, direct LM-assisted replies, and direct open-ended sequences.
- `test/penny-tool-loop.test.js`
  Add cases for native raw tool JSON, manual raw tool JSON, auto-verification JSON, and write-rescue summarized context.
- `test/penny-runtime-artifacts.test.js`
  Add receipt build/normalize tests for each path class plus old-artifact absence behavior.
- `test/penny-memory-panel.test.js`
  Add UI rendering checks for the new row and for old artifacts with no receipt.
- `test/penny-routes.test.js` or `test/penny-route-handlers.test.js`
  Add one deterministic route case and one LM-assisted tool case that prove the receipt survives route assembly.
- Recommended pre-merge command set:
  - `node --test test/penny-direct-tool-assist.test.js`
  - `node --test test/penny-tool-loop.test.js`
  - `node --test test/penny-runtime-artifacts.test.js`
  - `node --test test/penny-memory-panel.test.js`
  - `node --test test/penny-routes.test.js`

13. Should this slice produce only a plan doc, or is there a tiny safe skeleton implementation?

- Recommendation: plan doc only.
- Reason: current artifact inputs do not carry enough non-inferential path facts to build a truthful receipt yet.
- A placeholder receipt built only from `toolRecords`, `executionPath`, or `modelUsed` would overclaim certainty, especially for direct LM-assisted single-tool replies and multi-hop loop paths.

## Proposed schema

```json
{
  "schema": "penny-tool-evidence-receipt.v1",
  "summary": {
    "toolRecordCount": 0,
    "itemCount": 0,
    "promptVisibleItemCount": 0,
    "deterministicOnlyItemCount": 0,
    "provenanceOnlyItemCount": 0,
    "unknownItemCount": 0,
    "rawJsonItemCount": 0,
    "autoVerificationItemCount": 0,
    "summarizedItemCount": 0,
    "multiHopItemCount": 0
  },
  "items": []
}
```

## Population map by tool path

- Direct deterministic intent
  `path: direct_deterministic`, `promptVisibility: not_prompt_visible`, `nonPromptUse: deterministic_only`, `renderForm: none`, `modelHop: none`
- Direct single-tool LM answer
  `path: direct_single_tool_context_answer`, `promptVisibility: prompt_visible`, `nonPromptUse: none`, `renderForm: raw_json`, `modelHop: single`
- Direct open-ended edit sequence
  `path: direct_open_ended_sequence`, `promptVisibility: not_prompt_visible`, `nonPromptUse: provenance_only`, `renderForm: none`, `modelHop: none`
- Native tool loop tool result
  `path: native_tool_loop`, `promptVisibility: prompt_visible`, `nonPromptUse: none`, `renderForm: raw_json`, `modelHop: multi`
- Native tool loop auto verification
  `path: native_tool_loop`, `promptVisibility: prompt_visible`, `nonPromptUse: none`, `renderForm: auto_verification_json`, `modelHop: multi`
- Manual tool loop tool result
  `path: manual_tool_loop`, `promptVisibility: prompt_visible`, `nonPromptUse: none`, `renderForm: raw_json`, `modelHop: multi`
- Write rescue
  `path: write_rescue`, `promptVisibility: prompt_visible`, `nonPromptUse: none`, `renderForm: summarized_write_rescue`, `modelHop: single`
- Semantic render
  `path: semantic_render`, `promptVisibility: prompt_visible`, `nonPromptUse: none`, `renderForm: summarized_semantic_core`, `modelHop: single`
- Provenance-only artifact seam
  `path: artifact_provenance_fallback`, `promptVisibility: not_prompt_visible`, `nonPromptUse: provenance_only`, `renderForm: none`, `modelHop: none`
- Unknown or not instrumented
  `path: unknown`, `promptVisibility: unknown`, `nonPromptUse: unknown`, `renderForm: unknown`, `modelHop: unknown`

## Proposed change set

- `lib/penny-direct-tool-assist.js`
  Emit additive internal `toolEvidenceFacts` for deterministic, direct LM-assist, and open-ended sequence paths.
- `lib/penny-tool-loop.js`
  Emit additive internal `toolEvidenceFacts` for raw tool-result messages, auto-verification messages, and write-rescue summaries.
- `server.js`
  Emit additive semantic-render `toolEvidenceFacts` and forward all collected facts without becoming the semantic owner.
- `lib/penny-runtime-artifacts.js`
  Build and normalize `toolEvidenceReceipt` from explicit source facts plus compact `sourceRefs`.
- `public/js/penny-memory-panel.mjs`
  Render one dedicated `Tool evidence receipt` row.
- Tests
  Additive coverage only; no PromptTruth or runtime-behavior changes.

## Verification plan

- Automated checks: the targeted Node test files listed above, then `npm test` if the slice lands cleanly.
- Manual checks: inspect one deterministic direct read turn, one direct LM-assisted single-tool turn, one native tool-loop turn with auto verification, and one semantic-render turn in the memory inspector.
- What should stay unchanged: PromptTruth counts, authority-pressure math, research-ledger rendered semantics, route behavior, and tool-loop behavior.
- What would count as out-of-scope drift: any change to lane selection, prompt assembly, tool-loop semantics, semantic-render policy, or `server.js` ownership beyond fact forwarding.

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created: none for this design-only slice.
- What should be persisted: this compact plan note.
- What should be cleaned up before sign-off: nothing else.

## Out-of-scope list

- Changing PromptTruth.
- Reworking `server.js` ownership.
- Backfilling old artifacts with inferred receipt states.
- Copying raw tool payloads into runtime artifacts.

## Notes

- The key repo-grounded lesson is that prompt truth stays honest because prompt assembly owns it early. Tool evidence is later, mixed, and path-specific.
- The clean shape is therefore not `promptTruth.toolEvidence`; it is an additive artifact sibling built from explicit source facts.
- The next implementation slice should be a narrow plumbing slice: `toolEvidenceFacts` upstream, `toolEvidenceReceipt` in runtime artifacts, one inspector row, and targeted tests.
