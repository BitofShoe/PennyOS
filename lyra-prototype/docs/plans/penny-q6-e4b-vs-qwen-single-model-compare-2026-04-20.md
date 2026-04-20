# Q6+E4B Vs Qwen Single-Model Compare

> Category: Planning scaffold
> Authority: Implementation plan
> Status: Draft
> Use this for: setting up a future bounded compare between Penny's default split-lane QA profile and a single-model dual-lane Qwen profile.
> Do not use this for: proof that the compare already ran, proof that either profile already won, or as a substitute for the actual future artifact set.

## Goal and success criteria

- Goal: stage one apples-to-apples Penny QA compare between these two local usage profiles:
  - split default: `unsloth/gemma-4-31b-it@q6_k` chat + `google/gemma-4-e4b` tool + `text-embedding-nomic-embed-text-v1.5`
  - single-model dual-lane: `qwen/qwen3.6-35b-a3b` chat + `qwen/qwen3.6-35b-a3b` tool + `text-embedding-nomic-embed-text-v1.5`
- User-facing or engineering success criteria:
  - both profiles run the same bounded scenario matrix
  - every scenario records lane, execution path, resolved model, semantic-memory readiness, and tool/write evidence
  - the compare mirrors likely real usage instead of a synthetic benchmark-only topology
  - the run is clean enough to answer "can Penny stay dual-lane while only one main LLM is loaded?" with evidence instead of hand-waving
- What will be considered done:
  - one valid artifact set exists for each profile
  - one short compare summary exists that points to the exact artifact paths
  - cleanup leaves no disposable QA memory files or Playground scratch files behind

## Decisions already locked

- Constraint or decision: the embed model stays loaded in both profiles because that mirrors intended real usage.
- Constraint or decision: this compare is bounded. No Q8-class chat path, no broad model-family tournament, and no overlapping heavy evals.
- Constraint or decision: the compare should use disposable Penny memory, archive, embeddings, and ledger files rather than Penny's real state.
- Constraint or decision: image upload and attached-file read are separate rows. Image upload does not count as file-attachment coverage by itself.
- Constraint or decision: the web scenario should use Digital Foundry top stories on the actual run date and record that absolute date in the artifact.
- Constraint or decision: the single-model profile still counts as dual-lane only if the chat and tool turns both route through their expected lanes while resolving to the same Qwen model.

## Blind spots / what are we not considering?

- Unknown or risk: `qa:memory:mixed` is still behaviorally red on the default split profile today, so a future compare may show "both imperfect" rather than a clean winner.
- Unknown or risk: Qwen's bounded Playground write succeeded live, but only with manual-fallback / write-rescue help inside the tool loop.
- Adjacent system that could drift: Digital Foundry search results can reorder by date, headlines, or search-engine behavior.
- Adjacent system that could drift: file attachment currently has backend/deterministic coverage but not a dedicated browser-smoke harness.
- What would make this plan wrong: if LM Studio readiness, preset wiring, or model availability changes enough that one profile cannot be loaded cleanly, the compare must stop and be treated as an environment issue first.

## Delegation map

- Read-only exploration tasks and assigned subagents: none for this setup slice.
- QA inspection tasks and assigned subagents: none for this setup slice.
- Doc mapping tasks and assigned subagents: none for this setup slice.
- Single primary editor per file boundary: this plan file only.

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
  - `scripts/qa-penny-voice-redo.js`
  - `scripts/qa-penny-memory.js`
  - `scripts/qa-penny-browser-smoke.js`
  - `scripts/eval-penny-probes.js`
  - `lib/penny-local-lanes.js`
  - `lib/penny-direct-intents.js`
  - `lib/penny-direct-tool-assist.js`
  - `test/penny-local-lanes.test.js`
  - `test/penny-direct-intents.test.js`
  - `test/penny-direct-tool-assist.test.js`
- Commands to run:
  - `npm test`
  - `npm run preflight`
  - `npm run qa:voice:tiebreak`
  - `npm run qa:memory:semantic`
  - `npm run qa:memory:mixed`
  - `npm run qa:browser:smoke` with `PENNY_BROWSER_SMOKE_IMAGE_ONLY=1`
  - one future disposable compare runner for the remaining custom scenarios
- Ownership boundaries to confirm:
  - voice and memory keep using the existing harnesses
  - image upload keeps using the browser-smoke harness
  - attached-file read, direct repo read, Playground write, and Digital Foundry search belong in one future disposable compare runner
- Known risks:
  - stale or conflicting LM Studio loads
  - mis-scoring attached-file reads as image coverage
  - leaving QA residue in Penny's real memory

## Proposed change set

- File or doc: this plan file
  - Reason: lock the compare shape before the future run so we do not drift prompt wording, cleanup rules, or loadout assumptions mid-flight.
  - Expected impact: future agents can execute the compare without rediscovering the scenario matrix.
- File or doc: future `scripts/qa-penny-lane-compare.js`
  - Reason: run the compare-only custom scenarios under disposable server/memory state for both profiles.
  - Expected impact: a single bounded artifact per profile for attached-file read, repo read, Playground write, and Digital Foundry search.

## Verification plan

- Automated checks:
  - `npm test`
  - `npm run preflight`
  - `npm run qa:voice:tiebreak` once per profile
  - `npm run qa:memory:semantic` once per profile
  - `npm run qa:memory:mixed` once per profile
  - `PENNY_BROWSER_SMOKE_IMAGE_ONLY=1 npm run qa:browser:smoke` once per profile
  - future disposable compare runner once per profile
- Manual checks:
  - confirm the split profile resolves chat to Q6 and tool to E4B
  - confirm the single-model profile resolves both chat and tool turns to Qwen while keeping the lane split
  - confirm the write scenario verifies the actual file path before cleanup
  - confirm the Digital Foundry scenario records the absolute run date in the artifact
- What should stay unchanged:
  - Penny's real `data/penny-memory*.json` state
  - runtime behavior outside the QA slice
  - the current voice, memory, and browser harness source files during the compare run itself
- What would count as out-of-scope drift:
  - changing runtime heuristics to improve a compare score mid-run
  - broadening the compare into a multi-model tournament
  - using a long-lived already-running Penny server without validating its startup context

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  - `output/voice-redo-qa-*.json`
  - `output/memory-qa-semantic-archive-*.json`
  - `output/memory-qa-mixed-drift-*.json`
  - `output/playwright/penny-browser-smoke-*.json`
  - future compare artifacts such as `output/lane-compare-<profile>-*.json`
  - temporary server stdout/stderr logs for each disposable run
- What should be persisted:
  - the final per-profile QA artifacts
  - one short compare note that lists the exact artifact paths and verdict
- What should be cleaned up before sign-off:
  - disposable `data/penny-memory*.json` files created for the compare
  - disposable ledger files
  - any temporary Playground files created by the write scenario
  - stale server logs not needed for the verdict

## Out-of-scope list

- Explicitly out of scope: actually running this compare in this setup slice.
- Explicitly out of scope: declaring the single-model profile good enough to replace the split default before the artifact set exists.
- Explicitly out of scope: broad runtime refactors, prompt rewrites, or lane-policy changes.
- Explicitly out of scope: Q8, extra tool models, or stress-testing more than one heavy run at a time.

## Notes

### Compare profiles

- Split profile:
  - `PENNY_QA_CHAT_MODEL=unsloth/gemma-4-31b-it@q6_k`
  - `PENNY_QA_TOOL_MODEL=google/gemma-4-e4b`
  - `PENNY_QA_EMBED_MODEL=text-embedding-nomic-embed-text-v1.5`
- Single-model profile:
  - `PENNY_QA_CHAT_MODEL=qwen/qwen3.6-35b-a3b`
  - `PENNY_QA_TOOL_MODEL=qwen/qwen3.6-35b-a3b`
  - `PENNY_QA_EMBED_MODEL=text-embedding-nomic-embed-text-v1.5`

### Future run order

1. `npm test`
2. Run the split profile end to end.
3. Clean up the split profile disposable files.
4. Run the single-model profile end to end.
5. Clean up the single-model disposable files.
6. Write one compare note after both profiles finish.

### Scenario matrix

| Row | Surface | Planned owner | Prompt / action | Expected lane | Key assertions |
| --- | --- | --- | --- | --- | --- |
| 1 | Penny-style voice | `qa:voice:tiebreak` | reuse `casual_banter`, `softness`, `spirit_first_recall`, `exact_memory_recall` | `chat` | companion shape stays strong; no generic blandness; single-model profile still feels like Penny |
| 2 | Memory semantic recall | `qa:memory:semantic` | existing semantic archive segment | `chat` | long-ish recall works with embed loaded in both profiles |
| 3 | Memory drift / correction | `qa:memory:mixed` | existing mixed-drift segment | `chat` | capture whether either profile loses corrected facts under longer mixed sessions |
| 4 | Image upload | `qa:browser:smoke` image-only | existing browser image upload flow | `chat` | attachment stays on `attachment-bounded` chat path and sets visible reply cleanly |
| 5 | File attachment | future compare runner | attach a small markdown or text file and ask "tell me what this file says" | `tool` direct intent | route must resolve as `read_attached_file`; deterministic read; no workspace tools or fake edits |
| 6 | Light agentic read | future compare runner | `Open package.json and tell me the current npm test script. Then say whether you changed anything or only verified the repo state.` | `tool` direct intent | deterministic repo read; honest "verified only" wording; no phantom edits |
| 7 | Complex agentic write | future compare runner | `Inside Penny's Playground, create one new markdown file, choose the filename yourself, and write one short paragraph in your own Penny voice.` | `tool` tool loop | file must really land; artifact must record path, write evidence, and any rescue/fallback truth |
| 8 | Web search | future compare runner | `hey penny, can you tell me what some of the top stories on digitalfoundry.com are, today?` | `tool` direct intent | route should become `search_web`; artifact should record run date and top verified results |
| 9 | Optional web follow-up | future compare runner | `Open the Digital Foundry news page you found and tell me the first two story titles you can verify.` | `tool` direct intent or tool loop | converts the search hit into a bounded read instead of stopping at the search pile |

### Compare scoring priorities

- lane correctness first
- honesty second
- verified evidence over stylish bluffing
- companion voice quality in chat rows
- write verification over self-reported success
- cleanup truth over nice-looking but polluted artifacts

### Implementation note for the future custom runner

- It should spawn a disposable Penny server.
- It should set disposable memory, archive, embeddings, and ledger paths.
- It should capture `selectedLane`, `executionPath`, `resolvedModel`, `toolOutcome`, `promptTruth`, and `reasoningPolicy` per scenario.
- It should delete any created Playground file after verification and record that cleanup result in the artifact.
- It should record the absolute date for the Digital Foundry row so "today" is not ambiguous later.
