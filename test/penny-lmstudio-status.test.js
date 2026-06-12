const test = require('node:test');
const assert = require('node:assert/strict');
const { createLmStudioStatusApi } = require('../lib/penny-lmstudio-status');

function makeStatusApi({
  models = [],
  loadedModels = [],
  installedDetailed = [],
  chatModel = 'google/gemma-4-31b',
  toolModel = 'google/gemma-4-e4b',
  runtimePreferredModel = '',
  disableModelFallback = false,
} = {}) {
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
    PENNY_LMSTUDIO_CHAT_MODEL: chatModel,
    PENNY_LMSTUDIO_TOOL_MODEL: toolModel,
    PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL: runtimePreferredModel,
    PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK: disableModelFallback,
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

test('LM Studio status allows runtime setup to choose chat, tool, and strict fallback independently', async () => {
  const api = makeStatusApi({
    models: ['google/gemma-4-31b', 'google/gemma-4-e4b', 'unsloth/gemma-4-31b-it'],
  });

  api.setRuntimePreferredChatModel('unsloth/gemma-4-31b-it');
  api.setRuntimePreferredToolModel('google/gemma-4-31b');
  api.setRuntimeModelFallbackDisabled(true);
  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.modelFallbackDisabled, true);
  assert.equal(status.runtimePreferredModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.runtimePreferredChatModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.runtimePreferredToolModel, 'google/gemma-4-31b');
  assert.equal(status.chatPreferredModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.toolPreferredModel, 'google/gemma-4-31b');
  assert.equal(status.resolvedChatModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.resolvedToolModel, 'google/gemma-4-31b');

  const toolRuntime = {};
  const toolChosen = await api.withLmStudioLaneModel('tool', async (model) => model, toolRuntime);

  assert.equal(toolChosen, 'google/gemma-4-31b');
  assert.equal(toolRuntime.requestedModel, 'google/gemma-4-31b');
  assert.equal(toolRuntime.resolvedModel, 'google/gemma-4-31b');
  assert.equal(toolRuntime.laneFallback, false);
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

test('LM Studio lane resolution refreshes cached status when the preferred lane model changed', async () => {
  let fetchCalls = 0;
  let loadedModels = ['unsloth/gemma-4-31b-it'];
  const api = createLmStudioStatusApi({
    fetch: async () => {
      fetchCalls += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          data: [
            { id: 'unsloth/gemma-4-31b-it' },
            { id: 'google/gemma-4-e4b' },
          ],
        }),
      };
    },
    fs: {
      existsSync: () => false,
      readFileSync: () => '',
    },
    execFileText: async (_command, args = []) => {
      const action = Array.isArray(args) ? String(args[0] || '').trim() : '';
      if (action === 'ps') {
        return { stdout: JSON.stringify(loadedModels.map((id) => ({ identifier: id, status: 'idle' }))) };
      }
      return { stdout: '[]' };
    },
    URL,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_SETTINGS_FILE: '',
    LMSTUDIO_STATUS_CACHE_MS: 1000,
    LMSTUDIO_STATUS_ERROR_CACHE_MS: 1000,
    LMSTUDIO_MODELS_PROBE_MS: 5000,
    LOCAL_LLM_TRANSPORT: 'auto',
    PENNY_LMSTUDIO_CHAT_MODEL: 'unsloth/gemma-4-31b-it',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
  });

  const cachedChatState = await api.getLmStudioConnectionStatus({ force: true });
  assert.equal(cachedChatState.resolvedToolModel, 'unsloth/gemma-4-31b-it');

  loadedModels = ['google/gemma-4-e4b'];

  const runtime = {};
  const chosen = await api.withLmStudioLaneModel('tool', async (model) => model, runtime);

  assert.equal(chosen, 'google/gemma-4-e4b');
  assert.equal(runtime.requestedModel, 'google/gemma-4-e4b');
  assert.equal(runtime.resolvedModel, 'google/gemma-4-e4b');
  assert.equal(runtime.laneFallback, false);
  assert.equal(runtime.performance.modelResolution.cacheHit, false);
  assert.equal(fetchCalls, 2);
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

test('LM Studio status can disable host lms CLI discovery for server-level tests', async () => {
  const cliCalls = [];
  const api = createLmStudioStatusApi({
    fetch: async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [{ id: 'unsloth/gemma-4-31b-it' }] }),
    }),
    fs: {
      existsSync: () => false,
      readFileSync: () => '',
    },
    execFileText: async (_command, args = []) => {
      cliCalls.push(args);
      return { stdout: JSON.stringify([{ identifier: 'host-only-model', status: 'idle' }]) };
    },
    URL,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_SETTINGS_FILE: '',
    LMSTUDIO_STATUS_CACHE_MS: 10,
    LMSTUDIO_STATUS_ERROR_CACHE_MS: 10,
    LMSTUDIO_MODELS_PROBE_MS: 5000,
    LOCAL_LLM_TRANSPORT: 'auto',
    PENNY_LMSTUDIO_CHAT_MODEL: 'unsloth/gemma-4-31b-it',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
    PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY: '1',
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.deepEqual(cliCalls, []);
  assert.doesNotMatch(JSON.stringify(status), /host-only-model/);
  assert.deepEqual(status.nativeAvailableModels, ['unsloth/gemma-4-31b-it']);
  assert.deepEqual(status.installedModels, ['unsloth/gemma-4-31b-it']);
  assert.equal(status.resolvedChatModel, 'unsloth/gemma-4-31b-it');
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

test('LM Studio status keeps local OpenAI runtime model ids visible for the web picker', async () => {
  const api = makeStatusApi({
    models: [
      'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
      'google/embedding-gemma-300m',
    ],
    loadedModels: ['unsloth/gemma-4-31b-it'],
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.resolvedChatModel, 'unsloth/gemma-4-31b-it');
  assert.ok(status.installedModels.includes('unsloth/qwen3.6-35b-a3b@ud-q4_k_xl'));
  assert.ok(status.installedModels.includes('google/embedding-gemma-300m'));
});

test('LM Studio strict model selection honors the runtime-picked chat model over a loaded default', async () => {
  const api = makeStatusApi({
    models: [
      'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
      'unsloth/gemma-4-31b-it',
      'google/embedding-gemma-300m',
    ],
    loadedModels: ['unsloth/gemma-4-31b-it', 'google/embedding-gemma-300m'],
    chatModel: 'unsloth/gemma-4-31b-it',
    toolModel: 'unsloth/gemma-4-31b-it',
    disableModelFallback: true,
  });

  api.setRuntimePreferredChatModel('unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.modelFallbackDisabled, true);
  assert.equal(status.chatPreferredModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(status.toolPreferredModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(status.resolvedChatModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(status.resolvedToolModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.deepEqual(status.candidateModels, ['unsloth/qwen3.6-35b-a3b@ud-q4_k_xl']);
  assert.deepEqual(status.toolCandidateModels, ['unsloth/qwen3.6-35b-a3b@ud-q4_k_xl']);
  assert.ok(status.availableModels.includes('unsloth/gemma-4-31b-it'));
  assert.ok(status.availableModels.includes('unsloth/qwen3.6-35b-a3b@ud-q4_k_xl'));

  const runtime = {};
  const chosen = await api.withLmStudioLaneModel('chat', async (model) => model, runtime);

  assert.equal(chosen, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(runtime.requestedModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(runtime.resolvedModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(runtime.laneFallback, false);

  const toolRuntime = {};
  const toolChosen = await api.withLmStudioLaneModel('tool', async (model) => model, toolRuntime);

  assert.equal(toolChosen, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(toolRuntime.requestedModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(toolRuntime.resolvedModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(toolRuntime.laneFallback, false);
});

test('LM Studio strict model selection can start from a persisted runtime preference', async () => {
  const api = makeStatusApi({
    models: [
      'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
      'unsloth/gemma-4-31b-it',
      'google/embedding-gemma-300m',
    ],
    chatModel: 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
    toolModel: 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
    runtimePreferredModel: 'unsloth/gemma-4-31b-it',
    disableModelFallback: true,
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.modelFallbackDisabled, true);
  assert.equal(status.configuredChatModel, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(status.runtimePreferredModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.chatPreferredModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.toolPreferredModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.resolvedChatModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.resolvedToolModel, 'unsloth/gemma-4-31b-it');
});

test('LM Studio strict model selection fails closed instead of falling back to a loaded model', async () => {
  const api = makeStatusApi({
    models: ['unsloth/gemma-4-31b-it'],
    loadedModels: ['unsloth/gemma-4-31b-it'],
    chatModel: 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
    disableModelFallback: true,
  });

  const status = await api.getLmStudioConnectionStatus({ force: true });

  assert.equal(status.modelFallbackDisabled, true);
  assert.equal(status.resolvedChatModel, '');
  assert.deepEqual(status.candidateModels, []);
  await assert.rejects(
    () => api.withLmStudioLaneModel('chat', async (model) => model, {}),
    /fallback is disabled/i,
  );
});

test('LM Studio status treats UD quant suffixes as aliases for the same model family', () => {
  const api = makeStatusApi();

  assert.equal(
    api.modelsLookEquivalent(
      'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
      'qwen3.6-35b-a3b',
    ),
    true,
  );
});
