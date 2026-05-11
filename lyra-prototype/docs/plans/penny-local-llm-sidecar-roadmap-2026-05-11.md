# Penny Local LLM Sidecar Roadmap - 2026-05-11

> Category: Implementation plan / current scaffold map
> Authority: Implementation plan
> Status: Landed scaffold plus local Qwen/Gemma smoke receipts; installs and core adoption gated
> Use this for: repo-native commands, templates, fixtures, and safety contracts for local-LLM sidecars.
> Do not use this for: runtime law, dependency approval, license approval, model superiority, default model swaps, memory ingestion, PromptTruth expansion, or public/home/email automation.

Source note: [../penny-local-llm-apps-link-review-2026-05-10.md](../penny-local-llm-apps-link-review-2026-05-10.md).

## Landed Surfaces

- App roadmap/catalog: `lib/penny-local-llm-app-catalog.js`, `npm run penny:apps`.
- Sidecar contracts/trial scoring: `lib/penny-sidecar-contracts.js`, `npm run penny:sidecars`.
- Descriptor-only registry: `lib/penny-sidecar-descriptors.js`, `npm run penny:sidecar:descriptors`.
- Inert pattern queue: `lib/penny-sidecar-patterns.js`, `npm run penny:patterns`.
- Endpoint compatibility probe: `lib/penny-local-endpoint-compatibility.js`, `npm run penny:endpoint:probe`.
- Neutral model-runtime watch: `lib/penny-model-runtime-watch.js`, `npm run penny:model-watch`.
- Qwen/Gemma compare: `lib/penny-model-profile-compare.js`, `npm run penny:model-compare` supports prepared artifacts and tiny live smoke calls.
- Pi/OpenCode helpers: `scripts/penny-operator-sidecar.js`, `npm run penny:pi:*`, `npm run penny:opencode:*`.
- Disposable Pi trial fixture: `npm run penny:pi:trial-fixture -- --repo tmp/sidecars/pi-disposable-trial --endpoint-artifact output/local-endpoint-compatibility-2026-05-11.json --json`.
- Templates: `configs/sidecars/*.example.*`.
- Fixtures: `fixtures/*/*.example.json`.

## Delegation Findings

- Pi is installed in WSL and should be configured, not installed from scratch.
- OpenCode absence is a structured blocked state from `npm run penny:opencode:check -- --json`; install/config remains gated by explicit operator permission.
- Generated proof artifacts should go to `output/` when requested. CLI defaults are stdout-only.
- Generic OpenAI-compatible endpoint probing is separate from LM Studio preset/CLI management.
- Windows/live endpoint truth from the refreshed receipt: the llama.cpp router is available on `http://127.0.0.1:18080/v1`; `/v1/models` exposes `unsloth/qwen3.6-35b-a3b@ud-q4_k_xl` and `unsloth/gemma-4-31b-it`.
- Pi WSL dry-run is proven through a disposable repo with `PI_CODING_AGENT_DIR` scoped to `tmp/sidecars/pi-disposable-trial/.pi-agent`; do not copy to `~/.pi/agent/models.json` without operator review.
- OpenCode remains absent on WSL and Windows PATH; this is a clean blocked state, not an install approval.

## Verification

```bash
node --test test/penny-local-llm-sidecars.test.js
node --test test/penny-local-endpoint-model-watch.test.js
node --test test/penny-local-llm-sidecar-scripts.test.js
node scripts/penny-sidecar-test-fixtures.js --json
npm run penny:pi:trial-fixture -- --repo tmp/sidecars/pi-disposable-trial --endpoint-artifact output/local-endpoint-compatibility-2026-05-11.json --json
cmd.exe /c "cd /d C:\Users\malac\.openclaw\workspace-main\lyra-prototype && node scripts\penny-local-endpoint-compatibility.js --probe-model-call --endpoint http://127.0.0.1:18080/v1 --model-id unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --timeout-ms 300000 --out output\local-endpoint-compatibility-2026-05-11-router-qwen-model-call.json --markdown-out output\local-endpoint-compatibility-2026-05-11-router-qwen-model-call.md --json"
cmd.exe /c "cd /d C:\Users\malac\.openclaw\workspace-main\lyra-prototype && node scripts\penny-model-profile-compare.js --live --endpoint http://127.0.0.1:18080/v1 --qwen-model unsloth/qwen3.6-35b-a3b@ud-q4_k_xl --gemma-model unsloth/gemma-4-31b-it --timeout-ms 300000 --out output\model-profile-compare-qwen-gemma-2026-05-11-live-router.json --markdown-out output\model-profile-compare-qwen-gemma-2026-05-11-live-router.md --json"
git diff --check
```

## Deferred

Live sidecar installs, OpenCode install, Open WebUI install, workflow live flows, home/camera integrations, private RAG ingestion, voice UI wiring, model-serving swaps, provider/default model changes, and memory promotion stay gated.
