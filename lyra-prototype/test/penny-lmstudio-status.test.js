const test = require('node:test');
const assert = require('node:assert/strict');
const { createLmStudioStatusApi } = require('../lib/penny-lmstudio-status');

function makeStatusApi({ models = [], loadedModels = [], installedDetailed = [] } = {}) {
  const fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: models.map(id => ({ id })) }),
  });
  const fs = {
    existsSync: () => false,
    readFileSync: () => '',
  };
  const execFileText = async (command, args = []) => {
    const action = Array.isArray(args) ? String(args[0] || '').trim() : '';
    if (action === 'ps') {
      return { stdout: JSON.stringify(loadedModels.map((id) => ({ identifier: id, status: 'idle' }))) };
    }
    if (action === 'ls') {
      return { stdout: JSON.stringify(installedDetailed) };
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
    LOCAL_LLM_TRANSPORT: 'auto',
    PENNY_LMSTUDIO_CHAT_MODEL: 'google/gemma-4-31b',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
  });
}

test('LM Studio status keeps chat override separate from tool preference', async () => {
  const api = makeStatusApi({
    models: ['google/gemma-4-31b', 'google/gemma-4-e4b', 'unsloth/gemma-4-31b-it'],
  });

  api.setRuntimePreferredChatModel('unsloth/gemma-4-31b-it');
  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.chatPreferredModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.toolPreferredModel, 'google/gemma-4-e4b');
  assert.equal(status.resolvedChatModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.resolvedToolModel, 'google/gemma-4-e4b');
  assert.equal(status.routingMode, 'auto');
  assert.equal(status.probe.cacheHit, false);
  assert.ok(Number.isFinite(Number(status.probe.durationMs)));

  const runtime = {};
  const chosen = await api.withLmStudioLaneModel('chat', async (model) => model, runtime);
  assert.equal(chosen, 'unsloth/gemma-4-31b-it');
  assert.equal(runtime.localLane, 'chat');
  assert.equal(runtime.requestedModel, 'unsloth/gemma-4-31b-it');
  assert.equal(runtime.resolvedModel, 'unsloth/gemma-4-31b-it');
  assert.equal(runtime.laneFallback, false);
  assert.equal(runtime.performance.modelResolution.available, true);
  assert.equal(runtime.performance.modelResolution.source, 'lmstudio-status');
});

test('LM Studio tool lane surfaces fallback when E4B is unavailable', async () => {
  const api = makeStatusApi({
    models: ['google/gemma-4-31b'],
  });

  const runtime = {};
  const chosen = await api.withLmStudioLaneModel('tool', async (model) => model, runtime);

  assert.equal(chosen, 'google/gemma-4-31b');
  assert.equal(runtime.localLane, 'tool');
  assert.equal(runtime.requestedModel, 'google/gemma-4-e4b');
  assert.equal(runtime.resolvedModel, 'google/gemma-4-31b');
  assert.equal(runtime.laneFallback, true);
  assert.equal(runtime.performance.modelResolution.available, true);
  assert.equal(runtime.performance.modelResolution.source, 'lmstudio-status');
});

test('LM Studio status treats quantized chat aliases as equivalent families', async () => {
  const api = makeStatusApi({
    models: ['google/gemma-4-31b@q8_0'],
  });

  const runtime = {};
  const chosen = await api.withLmStudioLaneModel('chat', async (model) => model, runtime);

  assert.equal(chosen, 'google/gemma-4-31b@q8_0');
  assert.equal(runtime.requestedModel, 'google/gemma-4-31b');
  assert.equal(runtime.laneFallback, false);
});

test('LM Studio status cache hits surface probe metadata without forcing a refetch', async () => {
  let fetchCalls = 0;
  const api = createLmStudioStatusApi({
    fetch: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ id: 'google/gemma-4-31b' }, { id: 'google/gemma-4-e4b' }] }),
      };
    },
    fs: {
      existsSync: () => false,
      readFileSync: () => '',
    },
    execFileText: async () => ({ stdout: '[]' }),
    URL,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_SETTINGS_FILE: '',
    LMSTUDIO_STATUS_CACHE_MS: 1000,
    LMSTUDIO_STATUS_ERROR_CACHE_MS: 1000,
    LMSTUDIO_MODELS_PROBE_MS: 5000,
    LOCAL_LLM_TRANSPORT: 'auto',
    PENNY_LMSTUDIO_CHAT_MODEL: 'google/gemma-4-31b',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
  });

  const first = await api.getLmStudioConnectionStatus({ force: true });
  const second = await api.getLmStudioConnectionStatus();

  assert.equal(fetchCalls, 1);
  assert.equal(first.probe.cacheHit, false);
  assert.equal(second.probe.cacheHit, true);
  assert.ok(Number.isFinite(Number(second.probe.cacheAgeMs)));
});

test('LM Studio status does not treat embed-only runtime state as chat or tool ready', async () => {
  const api = makeStatusApi({
    models: ['text-embedding-nomic-embed-text-v1.5'],
    loadedModels: ['text-embedding-nomic-embed-text-v1.5'],
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.resolvedChatModel, '');
  assert.equal(status.resolvedToolModel, '');
  assert.deepEqual(status.availableModels, []);
  assert.deepEqual(status.candidateModels, []);
  assert.deepEqual(status.toolCandidateModels, []);
  assert.deepEqual(status.loadedModels, ['text-embedding-nomic-embed-text-v1.5']);
  assert.deepEqual(status.nativeAvailableModels, ['text-embedding-nomic-embed-text-v1.5']);
  assert.match(status.hint, /no usable chat model/i);
});

test('LM Studio status keeps embedding installs in the installed inventory', async () => {
  const api = makeStatusApi({
    models: ['google/gemma-4-e4b', 'text-embedding-nomic-embed-text-v1.5'],
    loadedModels: ['google/gemma-4-e4b', 'text-embedding-nomic-embed-text-v1.5'],
    installedDetailed: [
      {
        type: 'llm',
        modelKey: 'google/gemma-4-e4b',
        selectedVariant: 'google/gemma-4-e4b@q8_0',
      },
      {
        type: 'embedding',
        modelKey: 'text-embedding-nomic-embed-text-v1.5',
      },
    ],
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.resolvedToolModel, 'google/gemma-4-e4b');
  assert.ok(status.installedModels.includes('google/gemma-4-e4b@q8_0'));
  assert.ok(status.installedModels.includes('text-embedding-nomic-embed-text-v1.5'));
});
