# Penny QA Release Reference

## Safe Run Order

1. `npm test`
2. `npm run preflight`
3. `npm run qa:voice-redo`
4. `npm run eval:probes`
5. `npm run eval:models` when needed

## Lane Expectations

- Voice redo: chat-lane leaning, practical default is Q6 `unsloth/gemma-4-31b-it`
- Probes: tool-lane leaning, target `google/gemma-4-e4b`
- Model evals: compare chat models while keeping the tool lane stable

## Artifact Expectations

- voice redo artifacts live under `output/voice-redo-qa-*.json`
- probe eval artifacts live under `output/probe-eval-*.json`
- model eval artifacts should identify the compared chat model and fallback truth

## Trust Rules

- Do not trust runs performed in parallel with other heavy evals.
- Do not trust runs against an old already-running server without checking the startup context.
- Treat LM Studio resource guardrails, missing models, or preset drift as setup issues first, not personality failures.
- Call out when a failure is harness drift rather than Penny regressions.
- `qa:voice-redo` reuses the live Penny server by default unless the operator explicitly isolates it.
- `eval:probes` and `eval:models` can unload and reload LM Studio models, so treat them as state-clobbering runs.

## Best Source Files

- [README.md](../../../../README.md)
- [CODEBASE.md](../../../../CODEBASE.md)
- [PENNY_MODEL_EVAL.md](../../../../PENNY_MODEL_EVAL.md)
- [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../../../../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
- [scripts/qa-penny-voice-redo.js](../../../../scripts/qa-penny-voice-redo.js)
- [scripts/eval-penny-probes.js](../../../../scripts/eval-penny-probes.js)
- [scripts/eval-penny-models.js](../../../../scripts/eval-penny-models.js)
- [scripts/penny-preflight.js](../../../../scripts/penny-preflight.js)

## Common Mistakes

- overloading LM Studio by stacking QA runs at once
- assuming the heavier Q8 chat path is the right automated default
- reading the JSON artifact summary without checking the scenario-level timings and failures
- forgetting to mention which lane/model combination a run actually used
