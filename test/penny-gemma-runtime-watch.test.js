const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GEMMA_RUNTIME_WATCH_SCHEMA,
  buildGemmaRuntimeWatchArtifact,
} = require('../lib/penny-gemma-runtime-watch');
const {
  buildLmStudioChatSamplingWatch,
  normalizeLmStudioTransportForWatch,
} = require('../lib/penny-lmstudio-transports');
const {
  createLmStudioStatusApi,
} = require('../lib/penny-lmstudio-status');
const {
  buildGemmaRuntimeWatchForRuntimeFit,
} = require('../scripts/eval-penny-runtime-fit');

function makeStatusApi({ models = [], loadedModels = [] } = {}) {
  const fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: models.map(id => ({ id })) }),
  });
  const fs = {
    existsSync: () => false,
    readFileSync: () => '',
  };
  const execFileText = async (_command, args = []) => {
    const action = Array.isArray(args) ? String(args[0] || '').trim() : '';
    if (action === 'ps') {
      return { stdout: JSON.stringify(loadedModels.map((id) => ({ identifier: id, status: 'idle' }))) };
    }
    return { stdout: '[]' };
  };
  return createLmStudioStatusApi({
    fetch,
    fs,
    execFileText,
    URL,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_SETTINGS_FILE: '',
    LMSTUDIO_STATUS_CACHE_MS: 10,
    LMSTUDIO_STATUS_ERROR_CACHE_MS: 10,
    LMSTUDIO_MODELS_PROBE_MS: 5000,
    LOCAL_LLM_TRANSPORT: 'chat',
    PENNY_LMSTUDIO_CHAT_MODEL: 'google/gemma-4-31b',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
  });
}

test('Gemma runtime watch records missing vision knob as watch data, not failure', () => {
  const artifact = buildGemmaRuntimeWatchArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    measurementMode: 'fixture-only',
    transport: 'chat',
    requestedModel: 'google/gemma-4-31b',
    resolvedModel: 'google/gemma-4-31b',
    visionBudget: {
      knobNames: [],
      notes: 'No separate vision budget knob in this fixture.',
    },
  });

  assert.equal(artifact.schema, GEMMA_RUNTIME_WATCH_SCHEMA);
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.servingPath.transport, 'chat-completions');
  assert.equal(artifact.watchItems.visionBudget.exposed, false);
  assert.equal(artifact.watchItems.visionBudget.adoptionStatus, 'not-adopted');
  assert.deepEqual(artifact.watchItems.visionBudget.knobNames, []);
  assert.match(artifact.watchItems.visionBudget.notes, /vision budget/i);
  assert.equal(artifact.defaultsUnchanged.contextLengthChanged, false);
  assert.equal(artifact.defaultsUnchanged.memoryFilesTouched, false);
  assert.ok(artifact.knownRuntimeWatchItems.includes('visionBudget'));
  assert.ok(artifact.limits.includes('This watch artifact does not change LM Studio defaults.'));
});

test('Gemma runtime watch records thinking control availability without default-enabling it', () => {
  const artifact = buildGemmaRuntimeWatchArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    measurementMode: 'fixture-only',
    thinkingControls: {
      exposed: true,
      defaultForCompanionChat: 'on',
      notes: 'LM Studio exposes a thinking toggle in this fixture.',
    },
  });

  assert.equal(artifact.watchItems.thinkingControls.exposed, true);
  assert.equal(artifact.watchItems.thinkingControls.requestPolicyForCompanionChat, 'not-requested');
  assert.equal(artifact.watchItems.thinkingControls.requestControl, 'omitted');
  assert.equal(artifact.watchItems.thinkingControls.effectiveState, 'unknown');
  assert.equal(artifact.reasoningContract.capability.state, 'supported');
  assert.equal(artifact.reasoningContract.requested.state, 'not-requested');
  assert.equal(artifact.reasoningContract.effective.state, 'unknown');
  assert.equal(artifact.reasoningContract.observed.state, 'unknown');
  assert.match(artifact.watchItems.thinkingControls.notes, /thinking toggle/i);
  assert.ok(artifact.limits.some(item => /provider-effective state remains unknown/i.test(item)));
});

test('Gemma runtime watch records known image payload policy', () => {
  const artifact = buildGemmaRuntimeWatchArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    measurementMode: 'fixture-only',
    imagePolicy: {
      currentTurnImageOnly: true,
      imagePartBeforeText: true,
    },
  });

  assert.equal(artifact.watchItems.currentTurnImageOnly.expected, true);
  assert.equal(artifact.watchItems.currentTurnImageOnly.observed, true);
  assert.equal(artifact.watchItems.imagePartBeforeText.expected, true);
  assert.equal(artifact.watchItems.imagePartBeforeText.observed, true);
  assert.ok(artifact.limits.includes('Image payload policy remains current-turn-only.'));
});

test('Gemma runtime watch distinguishes exact and compatible loaded-model fallback', () => {
  const artifact = buildGemmaRuntimeWatchArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    measurementMode: 'status-only',
    requestedModel: 'google/gemma-4-31b',
    resolvedModel: 'google/gemma-4-31b@q8_0',
  });

  assert.equal(artifact.watchItems.loadedModelIdentity.requested, 'google/gemma-4-31b');
  assert.equal(artifact.watchItems.loadedModelIdentity.resolved, 'google/gemma-4-31b@q8_0');
  assert.equal(artifact.watchItems.loadedModelIdentity.exactMatch, false);
  assert.equal(artifact.watchItems.loadedModelIdentity.compatibleMatch, true);
});

test('LM Studio status attaches a status-only Gemma runtime watch without changing resolution', async () => {
  const api = makeStatusApi({
    models: ['google/gemma-4-31b@q8_0', 'google/gemma-4-e4b'],
    loadedModels: ['google/gemma-4-31b@q8_0'],
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.resolvedChatModel, 'google/gemma-4-31b@q8_0');
  assert.equal(status.gemmaRuntimeWatch.schema, GEMMA_RUNTIME_WATCH_SCHEMA);
  assert.equal(status.gemmaRuntimeWatch.measurementMode, 'status-only');
  assert.equal(status.gemmaRuntimeWatch.liveModelCalls, false);
  assert.equal(status.gemmaRuntimeWatch.watchItems.loadedModelIdentity.exactMatch, false);
  assert.equal(status.gemmaRuntimeWatch.watchItems.loadedModelIdentity.compatibleMatch, true);
  assert.equal(status.gemmaRuntimeWatch.watchItems.currentTurnImageOnly.observed, true);
  assert.equal(status.gemmaRuntimeWatch.reasoningContract.requested.state, 'not-requested');
  assert.equal(status.gemmaRuntimeWatch.reasoningContract.effective.state, 'unknown');
  assert.equal(status.gemmaRuntimeWatch.reasoningContract.observed.state, 'unknown');
});

test('runtime-fit Gemma watch records transport and sampling without changing defaults', () => {
  const watch = buildGemmaRuntimeWatchForRuntimeFit({
    generatedAt: '2026-04-21T12:00:00.000Z',
    measurementMode: 'runtime-fit',
    contextLength: 10000,
    status: {
      localTransport: 'stateful',
      chatPreferredModel: 'google/gemma-4-31b',
      resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    },
  });

  assert.equal(normalizeLmStudioTransportForWatch('stateful'), 'stateful-chat');
  assert.deepEqual(buildLmStudioChatSamplingWatch({ temperature: 1, topP: 0.95, topK: 64 }), {
    temperature: 1,
    topP: 0.95,
    topK: 64,
  });
  assert.equal(watch.measurementMode, 'runtime-fit');
  assert.equal(watch.servingPath.transport, 'stateful-chat');
  assert.equal(watch.watchItems.promptCacheRamRisk.status, 'watch');
  assert.equal(watch.watchItems.promptCacheRamRisk.contextLength, 10000);
  assert.equal(watch.watchItems.chatSampling.temperature, 1);
  assert.equal(watch.watchItems.chatSampling.topP, 0.95);
  assert.equal(watch.watchItems.chatSampling.topK, 64);
  assert.equal(watch.watchItems.loadedModelIdentity.exactMatch, false);
  assert.equal(watch.watchItems.loadedModelIdentity.compatibleMatch, true);
});
