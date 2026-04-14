# Penny LM Studio Ops Reference

## Canonical Commands

- `npm run preflight`
- `npm run lmstudio:prepare`
- `npm run preset:lmstudio`
- `npm run start:durable`

## Healthy State

- LM Studio API reachable
- chat model installed and available from the current 31B family
- tool model `google/gemma-4-e4b` installed
- embed model `text-embedding-nomic-embed-text-v1.5` installed for full semantic-memory readiness
- `@local:penny` wired on the active conversation and relevant concrete model configs

## Fallback Truth

- Penny can still run if the embed model is missing. Semantic memory falls back.
- Penny can still start if only one lane model is ready. Preflight should warn clearly.
- Q6 `unsloth/gemma-4-31b-it` is the practical automated chat model for testing on this machine.
- Avoid auto-testing the heavier Q8 path unless explicitly needed.

## Best Source Files

- [README.md](../../../../README.md)
- [ARCHITECTURE.md](../../../../ARCHITECTURE.md)
- [package.json](../../../../package.json)
- [scripts/penny-lmstudio-prepare.js](../../../../scripts/penny-lmstudio-prepare.js)
- [scripts/penny-preflight.js](../../../../scripts/penny-preflight.js)
- [scripts/ensure-lmstudio-penny-preset.js](../../../../scripts/ensure-lmstudio-penny-preset.js)
- [lib/penny-lmstudio-automation.js](../../../../lib/penny-lmstudio-automation.js)
- [lib/penny-lmstudio-status.js](../../../../lib/penny-lmstudio-status.js)

## Common Mistakes

- blaming the UI when the problem is actually lane fallback or preset wiring
- assuming `/v1/models` alone proves the embed backend is usable
- running heavy QA while also swapping models
- treating the repo prompt stack and the LM Studio preset as the same source of truth
