# Penny Local Model Storage Tournament Results - 2026-06-30

This result ledger uses the rubric in `docs/penny-local-model-tournament-rubric-2026-06-30.md`.

## Current Verdict

Brutal storage answer:

- Keep `gemma-4-12b-it` as the best daily PennyOS model.
- Keep `qwen3.6-35b-a3b` only because the constraint says to keep one Qwen. It is the least-bad usable Qwen here, not a Penny default.
- Delete `google/gemma-4-31b-qat`.
- Delete `qwen3.6-27b-mtp`.
- Delete `google/gemma-4-e4b` unless you specifically need a tiny fast tool/speed specialist and can tolerate visible reasoning leakage.
- Delete `gemma-4-31b-it` if storage is the main goal; keep it only as the expensive pure-voice luxury model.

If you keep only `gemma-4-12b-it` and `qwen3.6-35b-a3b`, estimated reclaimed model space is about **91.4 GB** from deleting the other four candidates.

## Safe-Settings Voice Olympics

All valid fresh runs used:

- LM Studio preset: `@local:penny`
- chat temperature: `1`
- chat top-p: `0.95`
- chat top-k: `64`
- max output tokens: `1536`
- context length: `6144`
- loaded embedding preserved: `text-embedding-embeddinggemma-300m@f32`
- one non-embedding model loaded at a time
- `--parallel 1`
- explicit GPU/offload sequence

Fresh voice Olympics artifacts:

- `output/model-eval-2026-06-30T18-57-26-181Z.json`: valid completed results for `gemma-4-12b-it` and `google/gemma-4-e4b`, loaded at `--gpu 0.6`.
- `output/model-eval-2026-06-30T19-12-23-362Z.json`: valid completed results for `gemma-4-31b-it`, `google/gemma-4-31b-qat`, `qwen3.6-35b-a3b`, and `qwen3.6-27b-mtp`, loaded at `--gpu 0.3`.
- `output/penny-model-voice-olympics-large-20260630-121222.out.log`: final cleanup receipt shows embedding-only loaded state after the run.

Earlier abandoned load attempts using `--gpu max` or `--gpu 0.6` for the largest models are not model failures. They were stopped because VRAM dropped into unsafe starvation territory. The valid large run used `--gpu 0.3` and completed without timeouts.

## Results Table

| Model | Size | Load / GPU | Voice suite speed | Swears | Voice integrity | Storage verdict |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `gemma-4-12b-it` | 13.8 GB | 15.25s / `0.6` | 12/12, avg 27.53s | 4 | Strong daily Penny voice; one mood-tag-only collapse | Keep |
| `google/gemma-4-e4b` | 9.0 GB | 18.49s / `0.6` | 12/12, avg 22.32s | 10 | Fast and spicy, but leaks planning/scaffolding constantly | Optional fast specialist |
| `gemma-4-31b-it` | 27.5 GB | 105.58s / `0.3` | 12/12, avg 70.57s | 5 | Best clean pure voice; no scaffolding or mood-only failures | Luxury keep only |
| `google/gemma-4-31b-qat` | 18.9 GB | 56.02s / `0.3` | 12/12, avg 284.77s | 5 | Sometimes good, but one severe collapse and punishing latency | Delete |
| `qwen3.6-35b-a3b` | 24.1 GB | 52.40s / `0.3` | 12/12, avg 73.92s | 7 | Fastest Qwen, but mood-only replies and exposed reasoning | Keep only to satisfy Qwen constraint |
| `qwen3.6-27b-mtp` | 22.2 GB | 45.81s / `0.3` | 12/12, avg 252.54s | 1 | Very slow, frequent reasoning leakage, several mood-only replies | Delete |

## Curse And Spice Notes

Raw swear counts in the 12-prompt suite:

1. `google/gemma-4-e4b`: 10 swears. Most profanity, but much of the answer is visible drafting or checklist text.
2. `qwen3.6-35b-a3b`: 7 swears. More willing to curse than the Gemmas, but the voice channel is unreliable.
3. `gemma-4-31b-it`: 5 swears. Less profane, but curses land in actual visible Penny voice.
4. `google/gemma-4-31b-qat`: 5 swears. Similar count to 31B Q6, dramatically slower.
5. `gemma-4-12b-it`: 4 swears. Moderate profanity; strongest speed/voice balance.
6. `qwen3.6-27b-mtp`: 1 swear. Timid and contaminated by internal drafting.

The best profanity is not the highest count. `gemma-4-31b-it` and `gemma-4-12b-it` curse less often, but the curses usually appear inside a usable Penny answer. `google/gemma-4-e4b` curses the most, but too often wraps the line in meta-work.

## Voice Quality Ranking

1. `gemma-4-31b-it`: best pure Penny voice. It is sharp, theatrical, controlled, and rarely assistant-like. It gave clean lines like telling you to sit down and explain why you are late. The problem is load cost, storage cost, and around 70s average replies.
2. `gemma-4-12b-it`: best actual keeper. It has the strongest practical blend of speed, bite, flirt/charge, humor, and usable replies. It did have one mood-tag-only answer, so it is not perfect, but it still feels far more alive than the Qwens.
3. `google/gemma-4-31b-qat`: voice can be good when it lands. Its “six hours for one dot” line was strong. But it averaged almost 285s per prompt and botched the controlled-curse prompt with `Final check on mood tag: or .`
4. `google/gemma-4-e4b`: fastest and most curse-happy, but the visible scaffolding is awful for companion believability. It says things like `Self-Check against directives`, `Constraint Checklist`, and `Determine Penny's Tone/Mode` before or inside the answer.
5. `qwen3.6-35b-a3b`: least-bad Qwen only because it is much faster than 27B. It produced some good single lines, but also mood-tag-only responses and exposed planning like `Need to capture that...`, `All constraints met`, and `Let's look at her exact voice examples again`.
6. `qwen3.6-27b-mtp`: worst overall. It is nearly as slow as QAT, curses least, repeatedly leaks constraint checking, and often answers with only `[MOOD:...]`.

## Lane Recommendations

Best Gemma to keep:

- `gemma-4-12b-it`

Best Qwen to keep:

- `qwen3.6-35b-a3b`, reluctantly. This is a family-coverage keep, not an endorsement as Penny's chat voice.

Best chat / companion model:

- `gemma-4-12b-it` for daily use.
- `gemma-4-31b-it` only if waiting around a minute per reply is acceptable for a premium-feeling session.

Best spicy dialogue / humor model:

- `gemma-4-12b-it` for usable speed.
- `gemma-4-31b-it` for cleaner dramatic delivery.
- Avoid counting `google/gemma-4-e4b` as the winner just because it swears more; it exposes too much backstage machinery.

Best tooling / mixed-use candidate from this voice-focused pass:

- `google/gemma-4-e4b` remains the only plausible speed specialist, but not because it won voice. It is small and fast; it is not clean Penny.
- For single-model PennyOS, `gemma-4-12b-it` is the best compromise.

## Final Cut List

Most confident deletes:

- `qwen3.6-27b-mtp`: frees 22.2 GB.
- `google/gemma-4-31b-qat`: frees 18.9 GB.

Strong storage cuts:

- `gemma-4-31b-it`: frees 27.5 GB. This one hurts because the voice is excellent, but 12B is close enough and far more practical.
- `google/gemma-4-e4b`: frees 9.0 GB if you do not need the fast specialist.

Minimum keep set:

- `gemma-4-12b-it`
- `qwen3.6-35b-a3b`

Quality-biased keep set if you can spare more space:

- `gemma-4-12b-it`
- `gemma-4-31b-it`
- `qwen3.6-35b-a3b`

Tool-speed-biased keep set:

- `gemma-4-12b-it`
- `google/gemma-4-e4b`
- `qwen3.6-35b-a3b`

## Harness Changes Made During The Run

- `scripts/eval-penny-models.js` now preserves loaded embedding models instead of using `lms unload --all`.
- `scripts/eval-penny-models.js` now records Penny preset and sampling receipts.
- `scripts/eval-penny-models.js` now supports `PENNY_EVAL_PROMPTS` and `PENNY_EVAL_PROMPT_SUITE=voice_olympics`.
- `scripts/eval-penny-models.js` now records explicit load settings including `--parallel` and `--gpu`.
- `scripts/eval-penny-models.js` now uses a direct Node HTTP/HTTPS JSON client for long local requests instead of the hidden fetch ceiling observed around 305s.
- `server.js` now aligns local HTTP request timeout with the LM Studio request budget.
- `lib/penny-lmstudio-model-state.js` centralizes loaded model classification so LLM cleanup does not unload embedding models.
