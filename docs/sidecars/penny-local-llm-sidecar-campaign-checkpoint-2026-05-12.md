# Penny Local LLM Sidecar Campaign Checkpoint - 2026-05-12

This checkpoint packages the section 2-7 implementation campaign from `docs/penny-local-llm-apps-link-review-2026-05-10.md`.

## Verdict

The scaffold-only gap is closed. Sections 2, 3, 4, 5, 6, and 7 now have runnable local trial commands, JSON artifacts, fixture-backed tests, disposable live-service receipts where safe, and a completion gate.

The gate result is:

```json
{
  "all_required_sections_complete": true,
  "summary": {
    "live_verified": 6,
    "harness_verified": 0,
    "install_blocked_with_harness": 0,
    "doc_only": 0,
    "represented_only": 0,
    "not_done": 0,
    "failing": 0
  }
}
```

## Section Receipts

| Section | Cluster | Status | Receipt |
|---|---|---|---|
| 2 | Local lab cockpit | LIVE_VERIFIED | Open WebUI on loopback port `13000` saw `penny-sidecar-toy-model` from a disposable mock OpenAI-compatible backend on port `18081`; Open WebUI chat returned an async task receipt and mock backend stats showed `chat_requests` increasing by 1. |
| 3 | Home/camera event | LIVE_VERIFIED | Frigate no-camera disposable container on port `15000` returned version `0.17.1-416a9b7`; Home Assistant disposable container on port `18123` returned `/api/` HTTP 401 and was recorded as auth-blocked. |
| 4 | Workflow automation | LIVE_VERIFIED | n8n disposable container on port `15678` imported and exported a manual/local-only toy workflow object with no credentials, webhooks, schedules, email, cloud, public, home, or system actions. |
| 5 | Research/search | LIVE_VERIFIED | SearXNG disposable container on port `18089` returned JSON search results with source titles/URLs; the digest remains review-only and does not write memory. |
| 6 | Document/RAG | LIVE_VERIFIED | Qdrant disposable container on port `16333` created a temporary `penny_sidecar_trial_*` collection, upserted 2 non-sensitive fixture vectors, ran vector search, and deleted the collection. |
| 7 | Audio/voice | LIVE_VERIFIED | Speaches disposable container on port `18000` requested `speaches-ai/Kokoro-82M-v1.0-ONNX`, confirmed it in `/v1/models`, and generated fixture text to WAV without microphone, recording, input-audio upload, or ambient capture. |

## Artifacts

- `artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json`
- `artifacts/sidecar-trials/section-3-home-camera-frigate.json`
- `artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json`
- `artifacts/sidecar-trials/section-5-research-searxng-digest.json`
- `artifacts/sidecar-trials/section-6-rag-document-sandbox.json`
- `artifacts/sidecar-trials/section-7-audio-transcript-review.json`
- `artifacts/sidecar-trials/section-completion-matrix.json`
- `artifacts/sidecar-trials/section-completion-gate-result.json`

## Implementation Surface

- `lib/penny-sidecar-trials.js`
- `lib/penny-sidecar-section-completion.js`
- `scripts/penny-lab-cockpit-trial.js`
- `scripts/penny-home-camera-event-trial.js`
- `scripts/penny-workflow-sidecar-trial.js`
- `scripts/penny-research-sidecar-trial.js`
- `scripts/penny-rag-workspace-trial.js`
- `scripts/penny-audio-voice-sidecar-trial.js`
- `scripts/penny-sidecar-section-completion-gate.js`
- `scripts/penny-openai-compatible-mock-server.js`
- `test/penny-sidecar-section-completion-gate.test.js`
- `fixtures/sidecar-trials/*`
- `package.json` sidecar command aliases

## Verification Commands

```bash
node --test test/penny-local-llm-sidecars.test.js test/penny-local-llm-sidecar-scripts.test.js test/penny-sidecar-section-completion-gate.test.js
npm run penny:sidecar:completion-gate -- --matrix artifacts/sidecar-trials/section-completion-matrix.json --out artifacts/sidecar-trials/section-completion-gate-result.json --json
git diff --check
npm test
docker ps --filter name=penny-
```

Latest full verification from this checkpoint campaign:

- Targeted sidecar tests: `51/51` pass.
- Completion gate: `all_required_sections_complete=true`, `live_verified=6`, `failing=0`.
- `git diff --check`: pass.
- `npm test`: `932` tests, `929` pass, `0` fail, `3` todo.
- Disposable Penny sidecar cleanup: no `penny-` containers left running.

## Boundaries Preserved

This checkpoint does not approve any sidecar as core runtime. Penny remains companion/runtime owner.

The campaign did not import Penny memory, auto-ingest sidecar outputs, upload private runtime artifacts, change PromptTruth, merge tool evidence into PromptTruth, change the default model, change runtime prompts, raise prompt/context limits, persist hidden reasoning, expose LAN/tunnels, create public/email/social automation, enable Home Assistant control actions, request camera streams/history, or add ambient camera/microphone/screen/browser-history capture.

## Blockers and Notes

- Home Assistant live probe stopped at `/api/` auth status; HTTP 401 is recorded as `blocked_by_auth=true`.
- Port `18080` was rejected for SearXNG because Windows already had a `llama.cpp` listener there even though WSL could reach Docker on that port.
- No live openedai-speech, faster-whisper-server, or Parler service was found during safe read-only probes.
- Open WebUI's API needed a disposable local signup token. The token was stored only in `/tmp/penny-openwebui-signup.json` for the trial and removed after cleanup.
- Open WebUI returned an async chat task receipt rather than direct model text; the route proof is the mock backend's observed `chat_requests` increment.
- Open WebUI startup downloaded its own embedding assets inside the disposable container; those assets were not imported into Penny and were removed with the container.

## Optional From-Empty Rerun

"All-sections-from-empty disposable rerun" means starting from no `penny-` sidecar containers, no temporary Open WebUI token, and no temporary Open WebUI mock Docker network, then recreating every disposable service and regenerating all section 2-7 artifacts in one continuous receipt pass.

It is useful when you want one fresh-run proof that the whole campaign can be reproduced from a clean local sidecar state. It is not required for acceptance of this checkpoint because each section already has a live artifact, the section matrix, gate output, targeted tests, full tests, and cleanup receipts.

## Next Slice

The next useful slice is git packaging: review the final diff, stage only the sidecar campaign files, commit with a concise checkpoint message, and optionally open a PR or preserve the branch for another review pass.
