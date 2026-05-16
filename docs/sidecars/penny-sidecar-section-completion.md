# Penny Sidecar Section Completion

This is the compact status surface for the local-LLM sidecar sections 2-7 from `docs/penny-local-llm-apps-link-review-2026-05-10.md`.

Campaign checkpoint: `docs/sidecars/penny-local-llm-sidecar-campaign-checkpoint-2026-05-12.md`.

## Current Matrix

| Section | Cluster | Primary app/harness | Status | Artifact |
|---|---|---|---|---|
| 2 | Local lab cockpit | Open WebUI live mock model route via disposable OpenAI-compatible backend | LIVE_VERIFIED | `artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json` |
| 3 | Home/camera event | Frigate live version probe plus Home Assistant auth-blocker probe | LIVE_VERIFIED | `artifacts/sidecar-trials/section-3-home-camera-frigate.json` |
| 4 | Workflow automation | n8n live manual workflow import/export plus dry-run toy flow | LIVE_VERIFIED | `artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json` |
| 5 | Research/search | SearXNG live JSON query smoke plus review digest | LIVE_VERIFIED | `artifacts/sidecar-trials/section-5-research-searxng-digest.json` |
| 6 | Document/RAG | Qdrant live create/upsert/search/delete plus fixture RAG sandbox | LIVE_VERIFIED | `artifacts/sidecar-trials/section-6-rag-document-sandbox.json` |
| 7 | Audio/voice | Speaches live TTS fixture plus transcript review | LIVE_VERIFIED | `artifacts/sidecar-trials/section-7-audio-transcript-review.json` |

Completion gate:

```bash
npm run penny:sidecar:completion-gate -- --matrix artifacts/sidecar-trials/section-completion-matrix.json --out artifacts/sidecar-trials/section-completion-gate-result.json --json
```

Tests:

```bash
node --test test/penny-sidecar-section-completion-gate.test.js
```

## Boundaries

Penny remains the companion/runtime owner. Sidecars are labs, tools, toy harnesses, or pattern-mining targets. The JSON artifacts are review outputs, not Penny memory.

This completion pass does not import Penny memory, upload private runtime artifacts, auto-ingest outputs, change PromptTruth, merge tool evidence into PromptTruth, change the default model, alter runtime prompts, raise prompt/context limits, persist hidden reasoning, expose LAN/tunnels, create email/social/public automation, enable home control, or add ambient camera/microphone/screen/browser-history capture.

## Deferred Live Checks

Open WebUI, Frigate, Home Assistant, n8n, SearXNG, Qdrant, and Speaches were live-smoked in disposable Docker containers and then removed. WSL `curl` and Windows PowerShell both confirmed the safe endpoints used in their artifacts: Open WebUI `/health`, Frigate `/api/version`, Home Assistant `/api/` auth status, n8n `/healthz` plus `/rest/settings`, SearXNG `/search?q=penny-local-sidecar&format=json`, Qdrant `/collections`, and Speaches `/health` plus `/v1/models`. The refreshed Open WebUI pass used a disposable container on loopback port `13000` and a disposable Node mock OpenAI-compatible backend on loopback port `18081`; Open WebUI `/api/models` showed `penny-sidecar-toy-model`, `/api/chat/completions` returned an async task receipt, and mock backend stats showed the chat request count increasing by 1. The refreshed Frigate pass used a loopback-only disposable container on port `15000` with a no-camera config, confirmed version `0.17.1-416a9b7`, and did not request streams, camera history, event history, or control paths. Home Assistant was also started on loopback port `18123`; `/api/` returned `401` from WSL and Windows and is recorded as `blocked_by_auth=true` without attempting authenticated state or service-call endpoints. The refreshed n8n pass used a loopback-only disposable container on port `15678`, imported a manual/local-only toy workflow object through the n8n container CLI, and verified export; the workflow has no credentials, webhooks, schedules, email, cloud, public, home, or system actions. The refreshed Qdrant pass used a disposable container on port `16333`, created a temporary `penny_sidecar_trial_*` collection, upserted two non-sensitive fixture vectors, ran vector search, and deleted the collection. The refreshed Speaches pass used a loopback-only disposable container on port `18000`, requested `speaches-ai/Kokoro-82M-v1.0-ONNX`, confirmed it in `/v1/models`, generated fixture text to `audio/wav`, deleted the temp audio file immediately, and kept microphone access, recording, ambient capture, private audio, Penny-memory import, and memory writes false. SearXNG used `fixtures/sidecar-trials/searxng-json-settings.yml` to enable JSON for the disposable trial. Port 18080 was rejected because Windows already had a `llama.cpp` listener there even though WSL could reach Docker on that port.

Concrete repeat commands:

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
