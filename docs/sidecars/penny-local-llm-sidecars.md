# Penny Local LLM Sidecars

Penny stays the companion interface, memory/runtime owner, explicit-memory owner, privacy owner, initiative-policy owner, and tool-loop owner. Sidecars are tools, labs, eval surfaces, or pattern-mining targets.

Current campaign checkpoint: `docs/sidecars/penny-local-llm-sidecar-campaign-checkpoint-2026-05-12.md`.

Penny-facing workflow docs: `docs/sidecars/penny-sidecar-productized-workflows.md`. That document covers the browser/API activation path for productized workflows. The section trial commands below remain the lower-level harness and live-smoke surface.

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

## Section 2-7 Trial Commands

These commands are the current runnable completion surface for the missing app clusters from the 2026-05-10 link review. They probe local availability safely and then run deterministic fixture harnesses when live services are absent.

```bash
OPEN_WEBUI_BASE_URL=http://127.0.0.1:13000 PENNY_MOCK_OPENAI_BASE_URL=http://127.0.0.1:18081/v1 npm run penny:sidecar:lab-cockpit -- --fixture --live-probe --openwebui-mock-model-trial --openwebui-base-url http://127.0.0.1:13000 --mock-openai-base-url http://127.0.0.1:18081/v1 --openwebui-auth-token-file /tmp/penny-openwebui-signup.json --json --artifact-out artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json
FRIGATE_URL=http://127.0.0.1:15000 HOME_ASSISTANT_URL=http://127.0.0.1:18123 npm run penny:sidecar:home-camera -- --fixture --live-probe --frigate-base-url http://127.0.0.1:15000 --home-assistant-base-url http://127.0.0.1:18123 --json --artifact-out artifacts/sidecar-trials/section-3-home-camera-frigate.json
npm run penny:sidecar:workflow -- --fixture --live-probe --n8n-workflow-trial --n8n-base-url http://127.0.0.1:15678 --n8n-container-name penny-n8n-workflow-trial --json --artifact-out artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json
npm run penny:sidecar:research -- --fixture --live-probe --json --artifact-out artifacts/sidecar-trials/section-5-research-searxng-digest.json
npm run penny:sidecar:rag -- --fixture --live-probe --qdrant-write-trial --qdrant-base-url http://127.0.0.1:16333 --json --artifact-out artifacts/sidecar-trials/section-6-rag-document-sandbox.json
SPEACHES_BASE_URL=http://127.0.0.1:18000 npm run penny:sidecar:audio -- --fixture --live-probe --speaches-tts-trial --speaches-base-url http://127.0.0.1:18000 --json --artifact-out artifacts/sidecar-trials/section-7-audio-transcript-review.json
npm run penny:sidecar:completion-gate -- --matrix artifacts/sidecar-trials/section-completion-matrix.json --out artifacts/sidecar-trials/section-completion-gate-result.json --json
```

Current section statuses: sections 2, 3, 4, 5, 6, and 7 are `LIVE_VERIFIED`. Disposable Docker smokes verified Open WebUI on port 13000 with a mock OpenAI-compatible backend on port 18081, Frigate on port 15000, Home Assistant auth status on port 18123, n8n on port 15678, SearXNG on port 18089, Qdrant on port 16333, and Speaches on port 18000. WSL `curl` and Windows PowerShell both returned HTTP 200 from the safe live endpoints captured in the artifacts, except Home Assistant `/api/`, which returned HTTP 401 from both sides and is recorded as `blocked_by_auth=true`. The Open WebUI artifact now records a live route trial: `/api/models` showed `penny-sidecar-toy-model`, `/api/chat/completions` returned an async task receipt, and mock backend stats showed the chat request count increasing by 1; it used no live LM Studio state and did not replace Penny's UI. The Frigate artifact uses a no-camera config and records only `/api/version`; no streams, camera history, Home Assistant states, service calls, device controls, or ambient capture paths were requested. The n8n artifact now records a live workflow-object trial: a manual/local-only workflow was imported through the disposable container CLI and export-checked, with credentials/webhooks/schedules/email/cloud/public/home/system actions all false. The Qdrant artifact now records a live write trial: temporary collection created, two non-sensitive fixture vectors upserted, vector search run, collection deleted, and all private-doc/Penny-memory write flags false. The Speaches artifact now records a live TTS fixture trial: the disposable container checked the TTS registry, requested `speaches-ai/Kokoro-82M-v1.0-ONNX`, confirmed it in `/v1/models`, generated `244780` bytes of `audio/wav` from fixture text, deleted the temp audio output, and kept microphone access, recording, ambient capture, private audio, Penny-memory import, and memory writes false. SearXNG used `fixtures/sidecar-trials/searxng-json-settings.yml` to enable JSON for the disposable trial and now records live source titles/URLs as review-only digest rows. Port 18080 was rejected because Windows already had a `llama.cpp` listener there even though WSL could reach Docker on that port. No live openedai-speech, faster-whisper, or Parler service was found during the read-only probes. To repeat the live smokes:

```bash
docker network create penny-openwebui-mock-net
docker run --detach --rm --name penny-openai-mock --network penny-openwebui-mock-net -p 127.0.0.1:18081:18081 -v "$PWD/scripts/penny-openai-compatible-mock-server.js:/app/mock.js:ro" node:24-alpine node /app/mock.js --host 0.0.0.0 --port 18081 --model-id penny-sidecar-toy-model
docker run --detach --rm --name penny-openwebui-mock-trial --network penny-openwebui-mock-net -p 127.0.0.1:13000:8080 -e WEBUI_AUTH=False -e ENABLE_PERSISTENT_CONFIG=False -e ENABLE_OLLAMA_API=False -e OPENAI_API_BASE_URL=http://penny-openai-mock:18081/v1 -e OPENAI_API_KEY=penny-sidecar-mock-key ghcr.io/open-webui/open-webui:main
until curl -fsS http://127.0.0.1:18081/health >/dev/null && curl -fsS http://127.0.0.1:13000/health >/dev/null; do sleep 2; done
curl -sS -X POST http://127.0.0.1:13000/api/v1/auths/signup -H 'Content-Type: application/json' --data-binary '{"name":"Penny Sidecar Trial","email":"penny-sidecar-trial@example.invalid","password":"penny-sidecar-local-only"}' > /tmp/penny-openwebui-signup.json
OPEN_WEBUI_BASE_URL=http://127.0.0.1:13000 PENNY_MOCK_OPENAI_BASE_URL=http://127.0.0.1:18081/v1 npm run penny:sidecar:lab-cockpit -- --fixture --live-probe --openwebui-mock-model-trial --openwebui-base-url http://127.0.0.1:13000 --mock-openai-base-url http://127.0.0.1:18081/v1 --openwebui-auth-token-file /tmp/penny-openwebui-signup.json --json --artifact-out artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json
docker stop penny-openwebui-mock-trial penny-openai-mock
docker network rm penny-openwebui-mock-net
rm -f /tmp/penny-openwebui-signup.json

docker run --detach --rm --name penny-frigate-version-trial --shm-size=128m -p 127.0.0.1:15000:5000 -v "$PWD/fixtures/sidecar-trials/frigate-health-only.config.yml:/config/config.yml:ro" ghcr.io/blakeblackshear/frigate:stable
docker run --detach --rm --name penny-homeassistant-health-trial -p 127.0.0.1:18123:8123 -e TZ=America/Los_Angeles ghcr.io/home-assistant/home-assistant:stable
FRIGATE_URL=http://127.0.0.1:15000 HOME_ASSISTANT_URL=http://127.0.0.1:18123 npm run penny:sidecar:home-camera -- --fixture --live-probe --frigate-base-url http://127.0.0.1:15000 --home-assistant-base-url http://127.0.0.1:18123 --json --artifact-out artifacts/sidecar-trials/section-3-home-camera-frigate.json

docker run --rm -p 127.0.0.1:15678:5678 -e N8N_SECURE_COOKIE=false -e N8N_DIAGNOSTICS_ENABLED=false -e N8N_VERSION_NOTIFICATIONS_ENABLED=false -e N8N_TEMPLATES_ENABLED=false -e N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false n8nio/n8n:latest
npm run penny:sidecar:workflow -- --fixture --live-probe --n8n-workflow-trial --n8n-base-url http://127.0.0.1:15678 --n8n-container-name penny-n8n-workflow-trial --json --artifact-out artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json

docker run --rm -p 18089:8080 -v "$PWD/fixtures/sidecar-trials/searxng-json-settings.yml:/etc/searxng/settings.yml:ro" searxng/searxng:latest
npm run penny:sidecar:research -- --fixture --live-probe --searxng-base-url http://127.0.0.1:18089 --json --artifact-out artifacts/sidecar-trials/section-5-research-searxng-digest.json

docker run --rm -p 16333:6333 qdrant/qdrant:latest
npm run penny:sidecar:rag -- --fixture --live-probe --qdrant-write-trial --qdrant-base-url http://127.0.0.1:16333 --json --artifact-out artifacts/sidecar-trials/section-6-rag-document-sandbox.json

docker run --detach --rm -p 127.0.0.1:18000:8000 --name penny-speaches-tts-trial ghcr.io/speaches-ai/speaches:latest-cpu
SPEACHES_BASE_URL=http://127.0.0.1:18000 npm run penny:sidecar:audio -- --fixture --live-probe --speaches-tts-trial --speaches-base-url http://127.0.0.1:18000 --json --artifact-out artifacts/sidecar-trials/section-7-audio-transcript-review.json
```

Artifacts are review outputs, not memory, and sidecars stay sidecars. None of these commands make a sidecar Penny's replacement UI, change the default model, change runtime prompts, merge tool evidence into PromptTruth, or enable public/email/home-control/ambient-capture behavior.

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
