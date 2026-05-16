# Gemma 4 31B Slice 2 Investigation

> Category: Investigation and verification note
> Authority: Current checked-out tree plus local command output
> Status: Active slice-2 handoff
> Use this for: testing the deferred Gemma 4 follow-through topics without changing defaults prematurely.
> Do not use this for: proof that EmbeddingGemma should be the default, proof that live LM Studio thinking controls are available, or replacement for future QA artifacts.

## Goal and success criteria

- Goal: investigate and test the three deferred items from `gemma-4-31b-follow-through-2026-04-21.md` as a bounded slice 2.
- Done means:
  - the Gemma leak/tool-loop cleanup regressions remain green,
  - the full unit suite remains green,
  - live EmbeddingGemma-vs-Nomic and thinking-control runs happen only when LM Studio is actually ready,
  - normal companion chat stays thinking-off by default unless a later control eval proves otherwise.

## Delegation map

- Kuhn: EmbeddingGemma versus Nomic semantic-memory seams and cheapest trustworthy compare.
- Arendt: thinking-mode transport/config seams and verifier/control testability.
- Carson: QA/doc shape, artifact lifecycle, and slice-gating.
- Primary editor: this note plus a pointer in the follow-through note. No runtime code changes in this pass.

## Findings

- EmbeddingGemma is currently a candidate backend only. The repo already normalizes EmbeddingGemma aliases and keeps embedding caches model-aware, but there is no first-class Nomic-vs-EmbeddingGemma comparison command yet.
- The EmbeddingGemma paper (`https://arxiv.org/pdf/2509.20354`) supports testing quantized/lightweight variants: it describes a 300M, 768-dimensional embedding model and reports that its benchmark advantage persists under weight quantization and embedding truncation. That is useful prior, not Penny adoption proof.
- The existing `qa:memory:semantic` path can test each embedding backend with disposable memory/archive/embedding files by setting `PENNY_QA_EMBED_MODEL`.
- Penny does not currently request `reasoning=low`, `reasoning_effort`, `enableThinking`, or an equivalent thinking knob in normal chat payloads.
- The existing transport and visible-reply tests prove that if LM Studio emits hidden reasoning anyway, Penny keeps it out of visible replies, transcript text, tool-loop follow-up payloads, and tool-evidence facts.
- A real request-level thinking-control A/B would need either direct LM Studio API probes or a future explicit Penny pass-through knob. That is a control experiment, not a default product change.

## Verification completed

- Targeted Gemma follow-through slice:
  - `node --test test/penny-lmstudio-transports.test.js test/penny-prompt-builders.test.js test/penny-visible-reply.test.js test/penny-tool-loop.test.js test/penny-preflight.test.js test/penny-lmstudio-automation.test.js test/penny-memory-archive.test.js`
  - Result: 90 passing, 0 failing.
- Full unit suite:
  - `npm test`
  - Result: 363 passing, 0 failing, 3 todo.

## Live readiness result

- `npm run preflight` from WSL failed because `lms` was not on PATH and the WSL-side LM Studio API check could not reach `http://127.0.0.1:1234/v1`.
- PowerShell also could not find `lms`.
- PowerShell could reach `http://127.0.0.1:1234/v1/models` after the models were manually loaded in LM Studio.
- Live eval used PowerShell against a disposable Penny server because WSL could not reach the LM Studio API in this session.

## WSL-to-LM-Studio bridge note

In this session, WSL could not reach LM Studio through `127.0.0.1:1234`, but Windows PowerShell could. The workable pattern was:

1. Keep repo inspection, file edits, artifact parsing, and git work in WSL.
2. Use `powershell.exe` from WSL for direct LM Studio API probes:

```bash
powershell.exe -NoProfile -Command '$r = Invoke-RestMethod -Uri "http://127.0.0.1:1234/v1/models" -TimeoutSec 10; $r.data | ConvertTo-Json -Depth 4'
```

3. Use PowerShell for direct embedding and chat probes when no Penny memory writes are needed:

```bash
powershell.exe -NoProfile -Command '$body = @{ model = "text-embedding-embeddinggemma-300m@f32"; input = "penny semantic memory probe" } | ConvertTo-Json -Compress; Invoke-RestMethod -Uri "http://127.0.0.1:1234/v1/embeddings" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 30 | ConvertTo-Json -Depth 4'
```

4. For Penny route QA, start a disposable Windows-side Penny server from WSL with isolated memory files:

```bash
cmd.exe /c "set PORT=4359&&set PENNY_MEMORY_FILE=data\penny-memory.some-run.json&&set PENNY_MEMORY_ARCHIVE_FILE=data\penny-memory-archive.some-run.json&&set PENNY_MEMORY_EMBEDDINGS_FILE=data\penny-memory-embeddings.some-run.json&&set PENNY_MEMORY_LEDGER_FILE=data\penny-memory-ledger.some-run.json&&set PENNY_LMSTUDIO_BASE=http://127.0.0.1:1234/v1&&set PENNY_LMSTUDIO_CHAT_MODEL=gemma-4-31b-it@q6_k&&set PENNY_LMSTUDIO_TOOL_MODEL=gemma-4-31b-it@q6_k&&set PENNY_LMSTUDIO_EMBED_MODEL=text-embedding-embeddinggemma-300m@f32&&set PENNY_LOCAL_LLM_TRANSPORT=chat&&set PENNY_OPENCLAW_ENABLED=0&&node server.js"
```

5. Probe the disposable server from PowerShell:

```bash
powershell.exe -NoProfile -Command '$r = Invoke-RestMethod -Uri "http://127.0.0.1:4359/api/penny/status" -TimeoutSec 15; $r | ConvertTo-Json -Depth 8'
```

Operational cautions:

- In `cmd.exe /c "set KEY=value&&..."`, do not put a space between the value and `&&`. `set PENNY_LMSTUDIO_BASE=http://127.0.0.1:1234/v1 &&...` stores a trailing space in the env var and causes bad URLs such as `/v1%20/models`.
- Use unique disposable memory/archive/embedding/ledger filenames per run, then delete them after the artifact is captured.
- Treat PowerShell API reachability as a workaround for this WSL networking mismatch, not as proof that WSL-side `npm run preflight` is healthy.

## Live EmbeddingGemma comparison

Artifacts:

- `output/embeddinggemma-live-smoke-2026-04-21T06-42-22-486Z.json`
- `output/embeddinggemma-f32-live-smoke-2026-04-21T06-57-02-689Z.json`

Setup:

- Chat model: `gemma-4-31b-it@q6_k`
- Transport: LM Studio chat transport, normal companion chat thinking-off
- Disposable memory/archive/embedding files were used for each run and removed after artifact capture.
- The test shape was five seed turns plus one recall turn asking for the red glove and chipped moon mug.

Results:

| Embed model | Result | Recall hits | Final retrieval | Archive retrieval | Full recall turn | Seed total | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `text-embedding-embeddinggemma-300m-qat` | Pass | `red glove`, `moon mug` | `semantic_query`, 2 session items | 277 ms | 107.83 s | 623.89 s | First run paid a large cold Q6 prompt/cache cost. |
| `text-embedding-embeddinggemma-300m@f32` | Pass | `red glove`, `moon mug` | `semantic_query`, 2 session items | 300 ms | 99.54 s | 218.58 s | Whole smoke was faster, but Q6 was already warm from the QAT run. |

Direct F32 embedding probe while loaded:

- Model: `text-embedding-embeddinggemma-300m@f32`
- Dimension: 768
- Five one-off `/v1/embeddings` calls: 84.9 ms, 14.0 ms, 40.5 ms, 26.5 ms, 12.5 ms

Interpretation:

- Both EmbeddingGemma variants passed this narrow Penny semantic recall smoke.
- The F32 run was faster end-to-end, but that is not clean proof that F32 embedding latency is better because Q6 prompt/cache warmth dominated the full-turn timing.
- Embed-side latency was small compared with Q6 generation in both runs; recall retrieval stayed in the hundreds of milliseconds.
- This smoke is enough to keep EmbeddingGemma as a viable candidate, but not enough to replace the existing Nomic default by itself.

## Live thinking-control probe

Artifact:

- `output/gemma-thinking-control-probe-2026-04-21T07-08-19-562Z.json`

Setup:

- Model: `gemma-4-31b-it@q6_k`
- Endpoint: direct LM Studio `POST /v1/chat/completions`
- Scope: no Penny server, no Penny memory writes
- Prompt: small arithmetic verifier prompt with visible answer constrained to `RESULT=323`

Request variants:

| Variant | Extra request field | Result | Separate reasoning |
| --- | --- | --- | --- |
| `baseline` | none | `RESULT=323` | `reasoning_content` length 0, `reasoning_tokens` 0 |
| `reasoning_object_low` | `reasoning: { effort: "low" }` | `RESULT=323` | `reasoning_content` length 0, `reasoning_tokens` 0 |
| `reasoning_effort_low` | `reasoning_effort: "low"` | `RESULT=323` | `reasoning_content` length 0, `reasoning_tokens` 0 |
| `enable_thinking_true` | `enable_thinking: true` | `RESULT=323` | `reasoning_content` length 0, `reasoning_tokens` 0 |
| `enableThinking_true` | `enableThinking: true` | `RESULT=323` | `reasoning_content` length 0, `reasoning_tokens` 0 |

Interpretation:

- The currently loaded Q6 model/API state accepts those fields without a request error, but does not expose separate reasoning through them.
- This supports keeping normal Penny chat thinking-off by default.
- A true LM Studio UI/preset toggle test is still distinct: if the app-level "reasoning on" toggle changes the loaded instance configuration, the same direct probe should be rerun after toggling and should be judged by `reasoning_content`, `message.reasoning`, or nonzero `reasoning_tokens`.

## Slice 2 live test plan

Run these only after `lms` is available or another trustworthy model-management path is confirmed, and after LM Studio reports the intended chat/tool/embed models.

1. Nomic semantic-memory baseline:

```bash
PENNY_QA_CHAT_MODEL=unsloth/gemma-4-31b-it@q6_k \
PENNY_QA_TOOL_MODEL=google/gemma-4-e4b \
PENNY_QA_EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 \
PENNY_QA_SPAWN_SERVER=1 \
npm run qa:memory:semantic
```

2. EmbeddingGemma semantic-memory candidate:

```bash
PENNY_QA_CHAT_MODEL=unsloth/gemma-4-31b-it@q6_k \
PENNY_QA_TOOL_MODEL=google/gemma-4-e4b \
PENNY_QA_EMBED_MODEL=<loaded EmbeddingGemma id, for example text-embedding-embeddinggemma-300m-qat> \
PENNY_QA_SPAWN_SERVER=1 \
npm run qa:memory:semantic
```

3. If EmbeddingGemma matches the semantic archive baseline, run correction coverage:

```bash
PENNY_QA_EMBED_MODEL=text-embedding-nomic-embed-text-v1.5 npm run qa:memory:contradictions
PENNY_QA_EMBED_MODEL=google/embedding-gemma-300m npm run qa:memory:contradictions
```

4. Thinking-on verifier/control, only after direct LM Studio probing confirms a working request parameter or UI/preset mechanism:

```bash
PENNY_QA_MANAGE_MODELS=0 npm run qa:voice:tiebreak
PENNY_QA_MANAGE_MODELS=0 npm run eval:probes
```

## Adoption criteria

- Do not make EmbeddingGemma the default unless its artifact pair passes semantic recall/correction with no readiness, latency, cache, fallback, or degraded-artifact regression against Nomic.
- Do not enable thinking for normal companion chat.
- Do not add a Penny thinking knob unless the direct control probe proves LM Studio honors one and the app-level use case is specifically verifier/control work.

## Artifact lifecycle / cleanup

- Keep QA JSON/log outputs that prove the compare.
- Clean disposable runtime state after live runs:
  - `data/penny-memory.*qa*.json`
  - `data/penny-memory-archive.*qa*.json`
  - `data/penny-memory-embeddings.*qa*.json`
  - `data/penny-memory-ledger.*qa*.json`
  - `data/penny-memory.probes.json`
  - `data/penny-memory.model-eval.json`
  - `output/model-eval-*.js`

## Deferred

- Full EmbeddingGemma-vs-Nomic release-gate compare remains open; this pass used a recent Q6/Nomic semantic baseline plus two live EmbeddingGemma smokes rather than rerunning Nomic.
- Full thinking-control eval is deferred until direct LM Studio probes confirm a working request parameter or UI/preset mechanism. The current Q6 request-field probe did not produce separate reasoning.
- A first-class compare script remains optional; current evidence says it would be useful before treating EmbeddingGemma adoption as a one-command release gate.
