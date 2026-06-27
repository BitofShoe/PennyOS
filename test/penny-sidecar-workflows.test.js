const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPennyRouteHandlers,
} = require('../lib/penny-route-handlers');
const {
  runSearchSidecarWorkflow,
  runDocsSidecarWorkflow,
  runAudioSidecarWorkflow,
} = require('../lib/penny-sidecar-workflows');

test('search sidecar workflow returns a Penny-facing review receipt without memory or prompt authority', () => {
  const receipt = runSearchSidecarWorkflow({
    query: 'local-first sidecar search',
    mode: 'fixture',
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, true);
  assert.equal(receipt.kind, 'search');
  assert.equal(receipt.activation.route, '/api/penny/sidecars/search');
  assert.equal(receipt.activation.mode, 'fixture');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.review.requiresReview, true);
  assert.equal(receipt.authority.memoryWrite, false);
  assert.equal(receipt.authority.promptTruthChanged, false);
  assert.equal(receipt.authority.toolEvidenceReceiptChanged, false);
  assert.equal(receipt.authority.defaultContextChanged, false);
  assert.equal(receipt.authority.runtimeVoiceChanged, false);
  assert.equal(receipt.authority.defaultModelChanged, false);
  assert.equal(receipt.authority.lmStudioModelStateChanged, false);
  assert.equal(receipt.pipelineProvenance.source.kind, 'search');
  assert.equal(receipt.pipelineProvenance.extraction.method, 'search-digest');
  assert.equal(receipt.pipelineProvenance.cleaning.status, 'normalized');
  assert.equal(receipt.pipelineProvenance.dedupe.status, 'stable-order');
  assert.equal(typeof receipt.pipelineProvenance.quality.supportScore, 'number');
  assert.equal(receipt.pipelineProvenance.privacy.flag, 'public-web-fixture');
  assert.equal(receipt.pipelineProvenance.review.status, 'review_required');
  assert.equal(receipt.pipelineProvenance.downstreamUse.memoryWrite, false);
  assert.equal(receipt.pipelineProvenance.downstreamUse.promptTruthChanged, false);
  assert.equal(receipt.pipelineProvenance.downstreamUse.runtimeVoiceChanged, false);
  assert.equal(receipt.digest.query, 'local-first sidecar search');
  assert.ok(receipt.digest.sources.length > 0);
  assert.equal(receipt.sourceReceipts[0].pipelineProvenance.extraction.method, 'search-result');
  assert.equal(receipt.sourceReceipts[0].pipelineProvenance.review.status, 'review_required');
  assert.deepEqual(
    receipt.sourceReceipts.map((source) => ({
      index: source.index,
      title: source.title,
      target: source.target,
      sourceType: source.sourceType,
    })),
    receipt.digest.sources.map((source, index) => ({
      index,
      title: source.title,
      target: source.url,
      sourceType: source.source_type || 'web',
    })),
  );
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'promptTruth'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'toolEvidenceReceipt'), false);
});

test('search sidecar workflow blocks live probes without explicit operator permission', () => {
  const receipt = runSearchSidecarWorkflow({
    query: 'current local search status',
    mode: 'live',
    allowLiveProbe: false,
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.failure.reason, 'operator_permission_required');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.authority.memoryWrite, false);
  assert.equal(receipt.authority.promptTruthChanged, false);
  assert.equal(receipt.authority.defaultContextChanged, false);
  assert.equal(receipt.pipelineProvenance.source.kind, 'search');
  assert.equal(receipt.pipelineProvenance.review.status, 'permission_required');
  assert.equal(receipt.pipelineProvenance.downstreamUse.memoryWrite, false);
});

test('sidecar search route exposes the search workflow as a review-only API path', async () => {
  let response = null;
  let runnerCall = null;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({ query: 'fixture route search', mode: 'fixture' });
    },
    runSidecarWorkflow(kind, payload) {
      runnerCall = { kind, payload };
      return {
        schema: 'penny-sidecar-workflow.v1',
        ok: true,
        status: 'ready',
        kind,
        activation: {
          route: '/api/penny/sidecars/search',
          mode: payload.mode,
        },
        authority: {
          memoryWrite: false,
          promptTruthChanged: false,
          toolEvidenceReceiptChanged: false,
          defaultContextChanged: false,
        },
      };
    },
    constants: {
      PENNY_ENABLE_REVIEW_SIDECARS: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://localhost/api/penny/sidecars/search'),
  });

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.ok, true);
  assert.equal(response.json.workflow.kind, 'search');
  assert.equal(response.json.workflow.authority.memoryWrite, false);
  assert.deepEqual(runnerCall, {
    kind: 'search',
    payload: {
      query: 'fixture route search',
      mode: 'fixture',
    },
  });
});

test('sidecar workflow routes are disabled by default in the consumer server surface', async () => {
  let response = null;
  let runnerCalled = false;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({ query: 'hidden consumer sidecar' });
    },
    runSidecarWorkflow() {
      runnerCalled = true;
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://localhost/api/penny/sidecars/search'),
  });

  assert.equal(handled, true);
  assert.equal(response.statusCode, 410);
  assert.equal(response.json.ok, false);
  assert.match(response.json.error, /PENNY_ENABLE_REVIEW_SIDECARS=1/);
  assert.equal(runnerCalled, false);
});

test('docs sidecar workflow returns a cited RAG answer without memory or prompt authority', () => {
  const receipt = runDocsSidecarWorkflow({
    question: 'What do the fixture docs say about sidecar memory boundaries?',
    mode: 'fixture',
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, true);
  assert.equal(receipt.kind, 'docs');
  assert.equal(receipt.activation.route, '/api/penny/sidecars/docs');
  assert.equal(receipt.activation.mode, 'fixture');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.ragAnswer.question, 'What do the fixture docs say about sidecar memory boundaries?');
  assert.ok(receipt.ragAnswer.document_citations.length > 0);
  assert.ok(receipt.ragAnswer.document_says.length > 0);
  assert.ok(receipt.ragAnswer.model_infers.length > 0);
  assert.equal(receipt.ragAnswer.memory_write, false);
  assert.equal(receipt.ragAnswer.memory_promotion_candidate, false);
  assert.equal(receipt.privateDocsUsed, false);
  assert.equal(receipt.pennyMemoryImported, false);
  assert.equal(receipt.authority.memoryWrite, false);
  assert.equal(receipt.authority.promptTruthChanged, false);
  assert.equal(receipt.authority.toolEvidenceReceiptChanged, false);
  assert.equal(receipt.authority.defaultContextChanged, false);
  assert.equal(receipt.authority.runtimeVoiceChanged, false);
  assert.equal(receipt.authority.defaultModelChanged, false);
  assert.equal(receipt.authority.lmStudioModelStateChanged, false);
  assert.equal(receipt.pipelineProvenance.source.kind, 'docs');
  assert.equal(receipt.pipelineProvenance.extraction.method, 'document-rag-fixture');
  assert.equal(receipt.pipelineProvenance.privacy.flag, 'fixture-docs-only');
  assert.equal(receipt.pipelineProvenance.review.status, 'review_required');
  assert.equal(receipt.pipelineProvenance.downstreamUse.toolEvidenceReceiptChanged, false);
  assert.equal(receipt.sourceReceipts[0].pipelineProvenance.extraction.method, 'document-chunk');
  assert.equal(receipt.sourceReceipts[0].pipelineProvenance.privacy.flag, 'fixture-docs-only');
  assert.deepEqual(
    receipt.sourceReceipts.map((source) => ({
      title: source.title,
      target: source.target,
      sourceType: source.sourceType,
    })),
    receipt.ragAnswer.document_citations.map((citation) => ({
      title: citation.title,
      target: citation.doc_id,
      sourceType: 'document-chunk',
    })),
  );
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'promptTruth'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'toolEvidenceReceipt'), false);
});

test('docs sidecar workflow blocks live Qdrant probes without explicit operator permission', () => {
  const receipt = runDocsSidecarWorkflow({
    question: 'What does Qdrant know?',
    mode: 'live',
    allowLiveProbe: false,
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.failure.reason, 'operator_permission_required');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.authority.memoryWrite, false);
  assert.equal(receipt.authority.promptTruthChanged, false);
  assert.equal(receipt.authority.defaultContextChanged, false);
  assert.equal(receipt.pipelineProvenance.source.kind, 'docs');
  assert.equal(receipt.pipelineProvenance.review.status, 'permission_required');
});

test('sidecar docs route exposes the RAG workflow as a review-only API path', async () => {
  let response = null;
  let runnerCall = null;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({ question: 'fixture route docs', mode: 'fixture' });
    },
    runSidecarWorkflow(kind, payload) {
      runnerCall = { kind, payload };
      return {
        schema: 'penny-sidecar-workflow.v1',
        ok: true,
        status: 'ready',
        kind,
        activation: {
          route: '/api/penny/sidecars/docs',
          mode: payload.mode,
        },
        authority: {
          memoryWrite: false,
          promptTruthChanged: false,
          toolEvidenceReceiptChanged: false,
          defaultContextChanged: false,
        },
      };
    },
    constants: {
      PENNY_ENABLE_REVIEW_SIDECARS: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://localhost/api/penny/sidecars/docs'),
  });

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.ok, true);
  assert.equal(response.json.workflow.kind, 'docs');
  assert.equal(response.json.workflow.authority.memoryWrite, false);
  assert.deepEqual(runnerCall, {
    kind: 'docs',
    payload: {
      question: 'fixture route docs',
      mode: 'fixture',
    },
  });
});

test('audio sidecar workflow returns a Speaches/TTS review receipt without capture or memory authority', () => {
  const receipt = runAudioSidecarWorkflow({
    text: 'Penny sidecar audio fixture.',
    mode: 'fixture',
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, true);
  assert.equal(receipt.kind, 'audio');
  assert.equal(receipt.activation.route, '/api/penny/sidecars/audio');
  assert.equal(receipt.activation.mode, 'fixture');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.transcriptReview.transcript, 'Penny sidecar audio fixture.');
  assert.equal(receipt.transcriptReview.memory_write, false);
  assert.equal(receipt.microphoneAccess, false);
  assert.equal(receipt.recordingStarted, false);
  assert.equal(receipt.ambientCapture, false);
  assert.equal(receipt.privateAudioUsed, false);
  assert.equal(receipt.pennyMemoryImported, false);
  assert.equal(receipt.authority.memoryWrite, false);
  assert.equal(receipt.authority.promptTruthChanged, false);
  assert.equal(receipt.authority.toolEvidenceReceiptChanged, false);
  assert.equal(receipt.authority.defaultContextChanged, false);
  assert.equal(receipt.authority.runtimeVoiceChanged, false);
  assert.equal(receipt.authority.defaultModelChanged, false);
  assert.equal(receipt.authority.lmStudioModelStateChanged, false);
  assert.equal(receipt.pipelineProvenance.source.kind, 'audio');
  assert.equal(receipt.pipelineProvenance.extraction.method, 'transcript-review');
  assert.equal(receipt.pipelineProvenance.privacy.sensitivity, 'private-audio-blocked');
  assert.equal(receipt.pipelineProvenance.review.status, 'review_required');
  assert.equal(receipt.pipelineProvenance.downstreamUse.runtimeVoiceChanged, false);
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'promptTruth'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(receipt, 'toolEvidenceReceipt'), false);
});

test('audio sidecar workflow blocks live Speaches TTS without explicit operator permission', () => {
  const receipt = runAudioSidecarWorkflow({
    text: 'Say this locally.',
    mode: 'live',
    allowLiveProbe: false,
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.failure.reason, 'operator_permission_required');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.authority.memoryWrite, false);
  assert.equal(receipt.authority.runtimeVoiceChanged, false);
  assert.equal(receipt.pipelineProvenance.source.kind, 'audio');
  assert.equal(receipt.pipelineProvenance.review.status, 'permission_required');
});

test('audio sidecar workflow blocks Speaches model/TTS trial without separate permission', () => {
  const receipt = runAudioSidecarWorkflow({
    text: 'Say this locally.',
    mode: 'live',
    allowLiveProbe: true,
    speachesTtsTrial: true,
    allowSpeachesTtsTrial: false,
  });

  assert.equal(receipt.schema, 'penny-sidecar-workflow.v1');
  assert.equal(receipt.ok, false);
  assert.equal(receipt.status, 'blocked');
  assert.equal(receipt.failure.reason, 'speaches_tts_trial_permission_required');
  assert.equal(receipt.live.ran, false);
  assert.equal(receipt.authority.runtimeVoiceChanged, false);
});

test('audio sidecar workflow passes Penny-facing text into the optional Speaches TTS trial', () => {
  let trialOptions = null;
  const receipt = runAudioSidecarWorkflow({
    text: 'Say this exact Penny-facing sentence.',
    mode: 'live',
    allowLiveProbe: true,
    speachesTtsTrial: true,
    allowSpeachesTtsTrial: true,
    trialRunner(options) {
      trialOptions = options;
      return {
        section_id: 7,
        section_title: 'Audio/voice sidecars',
        artifact_schema: 'penny-sidecar-section-7-audio.v1',
        status: 'HARNESS_VERIFIED',
        generated_at: '2026-05-25T00:00:00.000Z',
        primary_app: 'Speaches fixture harness',
        candidate_apps: ['Speaches'],
        live_probe: {
          speaches: { found: false },
          openedai_speech: { found: false },
          faster_whisper: { found: false },
          parler: { found: false },
          speaches_tts_live_trial: { ran: false },
        },
        transcript_review: {
          transcript: 'old fixture text',
          memory_write: false,
          tts_output_generated: false,
          requires_review: true,
        },
        microphone_access: false,
        recording_started: false,
        ambient_capture: false,
        private_audio_used: false,
        penny_memory_imported: false,
        recommended_next_live_command: '',
      };
    },
  });

  assert.equal(trialOptions.ttsInput, 'Say this exact Penny-facing sentence.');
  assert.equal(receipt.transcriptReview.transcript, 'Say this exact Penny-facing sentence.');
  assert.equal(receipt.authority.runtimeVoiceChanged, false);
});

test('sidecar audio route exposes the TTS workflow as a review-only API path', async () => {
  let response = null;
  let runnerCall = null;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({ text: 'fixture route audio', mode: 'fixture' });
    },
    runSidecarWorkflow(kind, payload) {
      runnerCall = { kind, payload };
      return {
        schema: 'penny-sidecar-workflow.v1',
        ok: true,
        status: 'ready',
        kind,
        activation: {
          route: '/api/penny/sidecars/audio',
          mode: payload.mode,
        },
        authority: {
          memoryWrite: false,
          promptTruthChanged: false,
          toolEvidenceReceiptChanged: false,
          defaultContextChanged: false,
          runtimeVoiceChanged: false,
        },
      };
    },
    constants: {
      PENNY_ENABLE_REVIEW_SIDECARS: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://localhost/api/penny/sidecars/audio'),
  });

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.json.ok, true);
  assert.equal(response.json.workflow.kind, 'audio');
  assert.equal(response.json.workflow.authority.runtimeVoiceChanged, false);
  assert.deepEqual(runnerCall, {
    kind: 'audio',
    payload: {
      text: 'fixture route audio',
      mode: 'fixture',
    },
  });
});

test('sidecar routes return 403 for explicit subtrial permission failures', async () => {
  let response = null;
  const handlers = createPennyRouteHandlers({
    sendJson(_res, statusCode, json) {
      response = { statusCode, json };
    },
    async safeReadBody() {
      return JSON.stringify({
        text: 'fixture route audio',
        mode: 'live',
        allowLiveProbe: true,
        speachesTtsTrial: true,
      });
    },
    runSidecarWorkflow() {
      return {
        schema: 'penny-sidecar-workflow.v1',
        ok: false,
        status: 'blocked',
        kind: 'audio',
        failure: {
          reason: 'speaches_tts_trial_permission_required',
          message: 'The Speaches TTS trial needs separate permission.',
        },
        authority: {
          memoryWrite: false,
          promptTruthChanged: false,
          toolEvidenceReceiptChanged: false,
          defaultContextChanged: false,
          runtimeVoiceChanged: false,
        },
      };
    },
    constants: {
      PENNY_ENABLE_REVIEW_SIDECARS: true,
    },
  });

  const handled = await handlers.handleApiRoute({
    req: { method: 'POST' },
    res: {},
    url: new URL('http://localhost/api/penny/sidecars/audio'),
  });

  assert.equal(handled, true);
  assert.equal(response.statusCode, 403);
  assert.equal(response.json.ok, false);
  assert.equal(response.json.workflow.failure.reason, 'speaches_tts_trial_permission_required');
});
