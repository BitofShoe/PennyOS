# Penny-Facing Sidecar Workflows

Penny stays the companion runtime. These sidecar workflows are local review surfaces that let Penny ask outside tools for bounded help without importing those outputs into memory, PromptTruth, runtime voice, or default prompt context.

## Shared Rules

- Sidecar outputs are review artifacts.
- No sidecar workflow writes Penny memory.
- No sidecar workflow expands PromptTruth or `toolEvidenceReceipt`.
- Live probes are optional and require an explicit operator action.
- Fixture mode is the default safe path for tests and static verification.
- LM Studio and llama.cpp model state is not started, stopped, loaded, unloaded, or swapped by these workflows.

## Search: SearXNG

Activation paths:

- Browser: Settings -> Local sidecars -> SearXNG research query -> Run search digest.
- API: `POST /api/penny/sidecars/search`

Fixture payload:

```json
{
  "query": "local-first sidecar search",
  "mode": "fixture"
}
```

Optional live payload, only after operator permission:

```json
{
  "query": "local-first sidecar search",
  "mode": "live",
  "allowLiveProbe": true,
  "searxngBaseUrl": "http://127.0.0.1:18089"
}
```

Failure state:

- If `mode` is `live` without `allowLiveProbe: true`, Penny returns a blocked receipt with `failure.reason: "operator_permission_required"`.
- If the local SearXNG service is absent or does not return JSON sources, the workflow still returns a reviewable fixture or blocked/fallback receipt rather than pretending live research happened.

Receipts:

- `workflow.sourceReceipts[]` lists source titles and URLs.
- `workflow.authority.memoryWrite`, `promptTruthChanged`, `toolEvidenceReceiptChanged`, and `defaultContextChanged` remain `false`.
- Search digests can be read and reviewed, but there is no save-to-memory control in the UI.

## Docs/RAG: Qdrant and Fixture Docs

Activation paths:

- Browser: Settings -> Local sidecars -> Fixture document question -> Run document answer.
- API: `POST /api/penny/sidecars/docs`
- Compatibility API alias: `POST /api/penny/sidecars/rag`

Fixture payload:

```json
{
  "question": "What do the fixture docs say about sidecar memory boundaries?",
  "mode": "fixture"
}
```

Optional live payload, only after operator permission:

```json
{
  "question": "What do the fixture docs say about sidecar memory boundaries?",
  "mode": "live",
  "allowLiveProbe": true,
  "qdrantBaseUrl": "http://127.0.0.1:16333"
}
```

Optional Qdrant write-trial payload, only after separate operator permission:

```json
{
  "question": "What do the fixture docs say about sidecar memory boundaries?",
  "mode": "live",
  "allowLiveProbe": true,
  "qdrantWriteTrial": true,
  "allowQdrantWriteTrial": true,
  "qdrantBaseUrl": "http://127.0.0.1:16333"
}
```

Failure state:

- If `mode` is `live` without `allowLiveProbe: true`, Penny returns a blocked receipt with `failure.reason: "operator_permission_required"`.
- If `qdrantWriteTrial` is requested without `allowQdrantWriteTrial: true`, Penny returns a blocked receipt because the lower-level trial creates and deletes a temporary fixture collection.

Receipts:

- `workflow.ragAnswer.document_citations[]` lists cited chunks.
- `workflow.ragAnswer.document_says[]` stays separate from `workflow.ragAnswer.model_infers[]`.
- `workflow.sourceReceipts[]` mirrors the cited document chunks.
- `workflow.privateDocsUsed` and `workflow.pennyMemoryImported` remain `false` in fixture mode.
- `workflow.authority.memoryWrite`, `promptTruthChanged`, `toolEvidenceReceiptChanged`, and `defaultContextChanged` remain `false`.
- Document answers can be read and reviewed, but there is no save-to-memory control in the UI.

## TTS/Audio: Speaches

Activation paths:

- Browser: Settings -> Local sidecars -> Speaches TTS preview text -> Run audio review.
- API: `POST /api/penny/sidecars/audio`
- Compatibility API alias: `POST /api/penny/sidecars/tts`

Fixture payload:

```json
{
  "text": "Penny sidecar audio fixture.",
  "mode": "fixture"
}
```

Optional live payload, only after operator permission:

```json
{
  "text": "Penny sidecar audio fixture.",
  "mode": "live",
  "allowLiveProbe": true,
  "speachesBaseUrl": "http://127.0.0.1:18000"
}
```

Optional Speaches TTS payload, only after separate operator permission:

```json
{
  "text": "Penny sidecar audio fixture.",
  "mode": "live",
  "allowLiveProbe": true,
  "speachesTtsTrial": true,
  "allowSpeachesTtsTrial": true,
  "speachesBaseUrl": "http://127.0.0.1:18000"
}
```

Failure state:

- If `mode` is `live` without `allowLiveProbe: true`, Penny returns a blocked receipt with `failure.reason: "operator_permission_required"`.
- If `speachesTtsTrial` is requested without `allowSpeachesTtsTrial: true`, Penny returns a blocked receipt with `failure.reason: "speaches_tts_trial_permission_required"` because the lower-level trial can request a Speaches model and generate audio.

Receipts:

- `workflow.transcriptReview` records the fixture transcript or explicit preview text and review state.
- When the optional Speaches TTS trial is permitted, the workflow passes the explicit `text` into the local TTS request.
- `workflow.capture` records microphone, recording, ambient capture, and private-audio flags.
- `workflow.authority.memoryWrite`, `promptTruthChanged`, `toolEvidenceReceiptChanged`, and `defaultContextChanged` remain `false`.
- `workflow.authority.runtimeVoiceChanged` remains `false`.
- Audio reviews can be read and reviewed, but there is no save-to-memory control in the UI.
- The Speaches sidecar does not replace Penny's browser voice toggle or runtime voice assets.
