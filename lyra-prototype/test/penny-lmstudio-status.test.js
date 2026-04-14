const test = require('node:test');
const assert = require('node:assert/strict');
const { createLmStudioStatusApi } = require('../lib/penny-lmstudio-status');

function makeStatusApi({ models = [] } = {}) {
  const fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: models.map(id => ({ id })) }),
  });
  const fs = {
    existsSync: () => false,
    readFileSync: () => '',
  };
  const execFileText = async () => ({ stdout: '[]' });
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

  const runtime = {};
  const chosen = await api.withLmStudioLaneModel('chat', async (model) => model, runtime);
  assert.equal(chosen, 'unsloth/gemma-4-31b-it');
  assert.equal(runtime.localLane, 'chat');
  assert.equal(runtime.requestedModel, 'unsloth/gemma-4-31b-it');
  assert.equal(runtime.resolvedModel, 'unsloth/gemma-4-31b-it');
  assert.equal(runtime.laneFallback, false);
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
