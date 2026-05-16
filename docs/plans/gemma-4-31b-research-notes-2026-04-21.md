# Gemma 4 31B Research Notes

> Category: Research / planning note
> Authority: Historical evidence
> Status: Draft
> Use this for: preserving Gemma 4 31B findings before implementation planning.
> Do not use this for: proof that Penny behavior changed or as current runtime law.

## 2026-04-21 model.yaml / Unsloth pass snapshot

- Treat the LM Studio `model.yaml` as a Gemma 4 protocol map and validation target, not as something Penny should paste into prompts.
- Penny should keep sending normal structured chat messages and tool definitions; LM Studio / llama.cpp should own rendering native Gemma tokens like `<|turn>`, `<|tool_call>`, `<|tool_response>`, and `<|channel>thought`.
- Penny already has the right broad shape:
  - `server.js` builds normal structured messages.
  - `lib/penny-tool-loop.js` sends OpenAI-style `tools`, reads `tool_calls`, and appends `role: "tool"` results.
  - `lib/penny-lmstudio-transports.js` separates `reasoning_content` / `reasoning` from visible text.
  - `lib/penny-visible-reply.js` strips Gemma-style thought spans.
  - `toolEvidenceReceipt` remains a sibling runtime-artifact receipt, not a PromptTruth channel.
- Useful hardening target: add leak regressions for raw Gemma wrappers such as `<|turn>`, `<|tool_call>`, `<|tool_response>`, and full `<|channel>thought ... <channel|>` blocks.
- Useful tool-loop micro-slice to consider later: test whether `reasoning_content` on an assistant tool-call message should be deliberately dropped or preserved only inside the in-memory tool-loop follow-up payload. It must never enter transcript, memory, runtime artifacts as raw thought, or final visible text.
- Sampling defaults from LM Studio / Google / Unsloth are `temperature=1.0`, `top_p=0.95`, and `top_k=64`. Penny currently sends a chat temperature around `0.9`; do not blindly switch, but do run a small current-vs-YAML-ish chat voice A/B.
- `enableThinking` defaults on in the YAML, but Penny should keep thinking off by default for companion chat. Thinking-on remains a bounded eval axis, not everyday product behavior.
- The advertised 256K context is a ceiling, not a target. Penny should keep normal chat budgets conservative and use long context only for targeted long-input tests.
- Unsloth matters operationally because local status may resolve Gemma 4 31B to `unsloth/gemma-4-31b-it`; its page also calls out recent chat-template / llama.cpp fixes and exact quant sizes.
- Best next slice after research:
  - add Gemma-token leak tests,
  - add a tool-loop `reasoning_content + tool_calls` fixture,
  - add optional chat sampling envs for `top_p` / `top_k`,
  - tighten status/preflight language around exact requested model versus compatible fallback.

## 2026-04-21 Gemma docs / cookbook / Dex pass snapshot

Sources reviewed:

- `https://github.com/dcramer/dex` at commit `3f55b2a3ec9746fc56cf62037ca6a828555ce17d`
- `https://github.com/google-gemma/cookbook` at commit `f9afc4555861f56c4bbd0ccb19a9f820df92ecf9`
- `https://ai.google.dev/gemma/docs/core/model_card_4`
- `https://ai.google.dev/gemma/docs/core`
- `https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4`
- `https://ai.google.dev/gemma/docs/capabilities/text/function-calling-gemma4`
- `https://ai.google.dev/gemma/docs/capabilities/thinking`
- `https://ai.google.dev/gemma/docs/capabilities/vision/image`
- `https://ai.google.dev/gemma/docs/integrations/lmstudio`
- `https://deepmind.google/models/gemma/`

### Definitely useful for Penny

- Keep Penny on structured chat/tool messages and let LM Studio render native Gemma control tokens. Do not paste `<|turn>`, `<|tool_call>`, `<|tool_response>`, `<|image|>`, or `<|channel>thought` into Penny-owned prompt text.
- Gemma 4 officially supports native role-style conversation for current models; Penny should preserve the system/user/model shape rather than falling back to older flattened Gemma prompt patterns.
- Google's thinking guidance strongly supports Penny's existing rule: generated thoughts must not be replayed in later multi-turn history. Preserve only final visible assistant content in history. The one exception to study is an active single tool-calling turn, where transport-only reasoning may need to stay in memory just long enough for the tool loop to complete, but it must not become transcript, memory, visible text, or a runtime artifact.
- Gemma 4 26B/31B use an empty thought-channel marker when thinking is off. That makes leak cleanup important even for thinking-off chat; test both full thought blocks and empty/partial channel fragments.
- Official sampling matches the prior model.yaml finding: `temperature=1.0`, `top_p=0.95`, `top_k=64`. Penny should A/B this as an explicit Gemma 4 chat preset before changing current companion-chat defaults.
- Tool-calling docs reinforce Penny's current architecture: JSON-schema tool declarations, model-generated tool calls, developer-side validation/execution, then final response synthesis. Keep `toolEvidenceReceipt` as a sibling runtime receipt, not a PromptTruth channel.
- Multimodal docs add one concrete check: image/audio content should come before text when using Gemma multimodal inputs. Penny's current-turn-only image policy remains right; test whether LM Studio accepts image-first content order cleanly.
- RAG cookbook examples support Penny's truth posture: retrieve first, answer only from returned context, and say when context is insufficient. Useful for memory/research wording and eval fixtures, not as a stack import.
- LM Studio integration docs are basic but confirm local GGUF/MLX serving and local API use. Penny's local `lmstudio:prepare`, status parsing, and lane fallback logic remain the project-specific source of truth.
- Dex is not Gemma runtime material, but its "tickets, not todos" shape is useful for implementation handoffs: task descriptions should include what/why/how/done, and results should capture decisions plus verification.
- Dex's test-isolation posture supports Penny's existing QA rule: use temp/disposable local state, mock or isolate network/model paths where possible, and avoid testing against live user memory by accident.

### Maybe later

- Add optional `top_p` / `top_k` transport configuration if LM Studio's active API honors them, then compare current Penny chat against the official sampling preset.
- Try a bounded low-thinking / thinking-on experiment only as a verifier-heavy control. Do not make it companion-chat default.
- Compare Gemma 4 26B A4B only if LM Studio availability looks good and the test is explicitly about latency/quality tradeoff against 31B Q6/Q8.
- Consider EmbeddingGemma only if the current Nomic embedding path becomes a proven bottleneck. Treat it as an embedding backend candidate, not as a chat-lane change.
- Borrow the Gemma HDP app's irreversibility classes for future tool-safety docs if Penny gains external/destructive actions. The signed-token system is overkill for the current single-user local prototype.
- Borrow Dex's JSONL-plus-schema and archive-compaction patterns only if Penny later grows a task/work ledger. Do not reshape explicit/archive memory around Dex.

### Do not add from this pass

- Do not import Google ADK, Qdrant, OPIK, LangChain, Cloud Run proxies, Dex, or HDP as Penny runtime dependencies right now.
- Do not enable thinking globally just because the YAML/cookbook can do it.
- Do not treat 262K context as a normal operating target. Keep normal chat budgets conservative and use long context only for deliberate long-input tests.
- Do not promise audio/video for the 31B lane. Gemma 4 31B is the text/image-to-text primary chat lane; audio/video belongs to other Gemma 4 variants.
- Do not replace Penny's tool lane with FunctionGemma 270M. Its docs are useful for schema discipline, but it is not Penny's primary tool brain.
- Do not wire Dex sync or task management into Penny chat. It is project-management behavior, not companion runtime behavior.

### Tests / docs worth doing before runtime changes

- Add visible-reply leak regressions for full and partial Gemma wrappers: `<|channel>thought ... <channel|>`, empty 31B thought markers, `<|turn>`, `<|tool_call>`, and `<|tool_response>`.
- Add a tool-loop fixture where an assistant response contains both `reasoning_content` and `tool_calls`; assert raw reasoning is not visible, not persisted, and not folded into `toolEvidenceReceipt`.
- Add prompt-builder/transport coverage proving Penny emits structured chat/tool/image parts, not Gemma native sentinel text.
- Add image payload-order coverage around current-turn-only images and the `attachment-bounded` route artifact; flip to image-first only after confirming LM Studio compatibility.
- Add exact-model versus compatible-fallback status/preflight assertions for `google/gemma-4-31b` resolving to local compatible GGUFs such as Unsloth or LM Studio community quantizations.
- Add one invalid-tool or invalid-arguments probe so Gemma 4 tool calling proves "validate before execute," not just "can call a tool."
- Keep this note as research evidence. If implementation lands, record landed/deferred results in a separate plan or completion note rather than silently upgrading this file into runtime law.
