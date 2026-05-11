# Penny Local LLM Sidecars

Penny stays the companion interface, memory/runtime owner, explicit-memory owner, privacy owner, initiative-policy owner, and tool-loop owner. Sidecars are tools, labs, eval surfaces, or pattern-mining targets.

## First Trials

1. Pi + Qwen local coding/operator trial in a disposable repo.
2. OpenCode + Qwen local coding/operator trial if OpenCode is installed/configured.
3. Open WebUI isolated lab cockpit with non-sensitive prompts/docs.
4. Qwen-vs-Gemma compare prep or live run only when local model state is safe.
5. Endpoint compatibility and model-runtime watch.

## Commands

```bash
npm run penny:apps -- --shortlist
npm run penny:apps:license-review -- --json
npm run penny:sidecars -- --recommend-next
npm run penny:sidecars -- --trial Pi
npm run penny:endpoint:probe -- --endpoint http://127.0.0.1:1234/v1
npm run penny:endpoint:probe:model-call -- --endpoint http://127.0.0.1:1234/v1
npm run penny:model-watch -- --profile qwen --endpoint http://127.0.0.1:1234/v1
npm run penny:model-compare -- --profiles qwen-local,gemma-local --dry-run
npm run penny:pi:models-json -- --model-id <resolved-qwen-model-id> --out output/pi-models.local.json
npm run penny:patterns -- --list
```

`penny:apps -- --needs-license-review` is the explicit queue for linked projects that remain unchecked for license/access/dependency approval. It does not approve installs or core adoption.

`penny:endpoint:probe` is `/v1/models` only by default. Add `--probe-model-call` only when a tiny non-private compatibility call is acceptable; it checks chat completions, streaming, tool-call, structured-output, developer-role, reasoning_effort, and responses support without mutating Penny runtime state.

## Rules

- No Penny memory import.
- No private runtime artifact upload.
- No auto-ingest.
- No public action.
- No hidden memory writes.
- Review before any memory promotion.
- No default model swap.
- No hidden reasoning persistence.
- No LAN/tunnel exposure by default.
- No dependency or license approval implied.
