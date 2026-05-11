# Qwen vs Gemma Compare

Prepared command:

```bash
npm run penny:model-compare -- --profiles qwen-local,gemma-local --dry-run
```

Optional live commands remain separate:

```bash
npm run preflight
PENNY_EVAL_MODELS=<qwen-local-model-id>,<gemma-local-model-id> npm run eval:models
npm run eval:runtime-fit
```

Live runs must use disposable Penny state, one heavy model harness at a time, and no runtime code changes mid-compare. A prepared artifact is not evidence that Qwen beats Gemma or Gemma beats Qwen.
