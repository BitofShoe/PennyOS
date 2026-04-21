# Gemma 4 31B Follow-Through Completion Note

> Category: Implementation completion note
> Authority: Current checked-out tree, after tests
> Status: Active follow-through record
> Use this for: the Gemma 4 31B chat contract changes that landed after the research pass.
> Do not use this for: replacing runtime tests, LM Studio live model state, or future EmbeddingGemma adoption proof.

## Landed

- Chat-lane sampling now has explicit env/config knobs:
  - `PENNY_LMSTUDIO_CHAT_TEMPERATURE`, default `1.0`
  - `PENNY_LMSTUDIO_CHAT_TOP_P`, default `0.95`
  - `PENNY_LMSTUDIO_CHAT_TOP_K`, default `64`
- LM Studio chat transports apply those fields across native stateful chat, `/v1/chat/completions`, and `/v1/responses`, including streaming and non-streaming paths.
- Tool-lane, tool-summary, and semantic-render temperatures remain separate.
- Multimodal LM Studio prompt builders now emit the current image part before the text part and still keep the latest-image-only rule.
- Visible-reply cleanup has regressions for Gemma thought-channel, empty thought marker, turn, tool-call, and tool-response wrappers.
- Tool-loop coverage now includes an assistant message with both `reasoning_content` and `tool_calls`; the tool call is preserved while raw reasoning stays out of follow-up payloads, final text, and tool-evidence facts.
- Status/preflight tests assert exact requested chat model versus compatible fallback model where that status is surfaced.
- Embedding cache normalization is model-aware, so vectors from one embedding model are not reused in another vector space.
- EmbeddingGemma aliases can be normalized and probed as a candidate, but the default embedding model is still Nomic.

## Deferred

- Do not adopt EmbeddingGemma as the default until the isolated semantic-memory comparison beats or matches Nomic on Penny recall/correction cases without readiness, latency, cache, or fallback regressions.
- Do not enable thinking for normal companion chat.
- A later thinking-on verifier/control eval can test `reasoning=low` or equivalent thinking modes after the leak and tool-loop cleanup regressions remain green.

## Verification

- Targeted slice:
  - `node --test test/penny-lmstudio-transports.test.js test/penny-prompt-builders.test.js test/penny-visible-reply.test.js test/penny-tool-loop.test.js test/penny-preflight.test.js test/penny-lmstudio-automation.test.js test/penny-memory-archive.test.js`
- Full suite:
  - `npm test`

Latest local result: targeted slice passed with 90 passing, 0 failing; `npm test` passed with 363 passing, 0 failing, 3 todo.
