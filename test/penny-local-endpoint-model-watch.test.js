const test = require('node:test');
const assert = require('node:assert/strict');

const {
  detectBackendFamily,
  probeLocalEndpointCompatibility,
  normalizeEndpointBaseUrl,
} = require('../lib/penny-local-endpoint-compatibility');
const {
  MODEL_RUNTIME_WATCH_SCHEMA,
  buildModelRuntimeWatchArtifact,
  buildGemmaCompatibleRuntimeWatch,
} = require('../lib/penny-model-runtime-watch');
const {
  buildModelProfileCompareArtifact,
  runLiveModelProfileCompare,
  validateModelProfileConfig,
} = require('../lib/penny-model-profile-compare');

function makeMockFetch({
  models = ['qwen-local'],
  chatStatus = 200,
  rejectDeveloper = false,
  rejectReasoning = false,
  rejectStreaming = false,
  rejectTools = false,
  rejectStructured = false,
} = {}) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/models')) {
      return {
        ok: true,
        status: 200,
        headers: new Map([['server', 'llama.cpp']]),
        text: async () => JSON.stringify({ data: models.map((id) => ({ id })) }),
      };
    }
    if (String(url).endsWith('/chat/completions')) {
      const body = JSON.parse(options.body || '{}');
      const hasDeveloper = (body.messages || []).some((message) => message.role === 'developer');
      if (rejectDeveloper && hasDeveloper) {
        return { ok: false, status: 400, headers: new Map(), text: async () => 'developer role unsupported' };
      }
      if (rejectReasoning && Object.prototype.hasOwnProperty.call(body, 'reasoning_effort')) {
        return { ok: false, status: 400, headers: new Map(), text: async () => 'reasoning_effort unsupported' };
      }
      if (rejectStreaming && body.stream === true) {
        return { ok: false, status: 400, headers: new Map(), text: async () => 'streaming unsupported' };
      }
      if (rejectTools && Array.isArray(body.tools)) {
        return { ok: false, status: 400, headers: new Map(), text: async () => 'tools unsupported' };
      }
      if (rejectStructured && body.response_format) {
        return { ok: false, status: 400, headers: new Map(), text: async () => 'structured output unsupported' };
      }
      return {
        ok: chatStatus >= 200 && chatStatus < 300,
        status: chatStatus,
        headers: new Map(),
        text: async () => JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
      };
    }
    return { ok: false, status: 404, headers: new Map(), text: async () => 'not found' };
  };
  fetch.calls = calls;
  return fetch;
}

test('endpoint compatibility defaults to read-only models probe without model calls', async () => {
  const fetch = makeMockFetch({ models: ['qwen3-35b-a3b-q4'] });
  const result = await probeLocalEndpointCompatibility({
    endpoint: 'http://127.0.0.1:8080/v1',
    fetch,
    generatedAt: '2026-05-11T12:00:00.000Z',
  });

  assert.equal(normalizeEndpointBaseUrl('http://127.0.0.1:8080/v1/'), 'http://127.0.0.1:8080/v1');
  assert.equal(result.read_only, true);
  assert.equal(result.model_calls, false);
  assert.equal(result.runtime_changed, false);
  assert.equal(result.memory_changed, false);
  assert.equal(result.capabilities.models_endpoint, 'supported');
  assert.equal(result.capabilities.chat_completions, 'unknown');
  assert.deepEqual(result.loaded_models, ['qwen3-35b-a3b-q4']);
  assert.equal(fetch.calls.length, 1);
});

test('endpoint backend detection treats llama.cpp ownership as router truth before model paths', () => {
  const backend = detectBackendFamily({
    endpoint: 'http://127.0.0.1:18080/v1',
    headers: new Map([['server', 'llama.cpp']]),
    bodyText: JSON.stringify({
      data: [{
        id: 'unsloth/gemma-4-31b-it',
        owned_by: 'llamacpp',
        status: { preset: 'model = C:\\LocalModels\\fixture.gguf' },
      }],
    }),
    loadedModels: ['unsloth/gemma-4-31b-it'],
  });

  assert.equal(backend, 'llama_cpp');
});

test('endpoint compatibility explicit model probe records developer, reasoning, streaming, tool, and structured support', async () => {
  const fetch = makeMockFetch({
    rejectDeveloper: true,
    rejectReasoning: true,
    rejectTools: true,
    rejectStructured: true,
  });
  const result = await probeLocalEndpointCompatibility({
    endpoint: 'http://127.0.0.1:8080/v1',
    fetch,
    probeModelCall: true,
  });

  assert.equal(result.model_calls, true);
  assert.equal(result.capabilities.models_endpoint, 'supported');
  assert.equal(result.capabilities.chat_completions, 'supported');
  assert.equal(result.capabilities.developer_role, 'unsupported');
  assert.equal(result.capabilities.reasoning_effort, 'unsupported');
  assert.equal(result.capabilities.streaming, 'supported');
  assert.equal(result.capabilities.tool_calls, 'unsupported');
  assert.equal(result.capabilities.structured_output, 'unsupported');
  assert.equal(result.capabilities.qwen_thinking_controls, 'unknown');
  assert.ok(fetch.calls.length >= 7);
  assert.ok(fetch.calls.some((call) => JSON.parse(call.options.body || '{}').model === 'qwen-local'));
});

test('endpoint compatibility can target an explicit visible model id', async () => {
  const fetch = makeMockFetch({
    models: ['default', 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl'],
  });
  const result = await probeLocalEndpointCompatibility({
    endpoint: 'http://127.0.0.1:18080/v1',
    fetch,
    probeModelCall: true,
    modelId: 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
  });

  assert.equal(result.probe_model_id, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.equal(result.resolved_model_id, 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl');
  assert.ok(fetch.calls.some((call) => {
    if (!String(call.url).endsWith('/chat/completions')) return false;
    return JSON.parse(call.options.body || '{}').model === 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl';
  }));
});

test('endpoint compatibility handles unknown endpoint without mutating runtime', async () => {
  const fetch = async () => ({ ok: false, status: 503, headers: new Map(), text: async () => 'down' });
  const result = await probeLocalEndpointCompatibility({
    endpoint: 'http://127.0.0.1:9999/v1',
    fetch,
    probeModelCall: true,
  });

  assert.equal(result.health_status, 'unavailable');
  assert.equal(result.backend_family, 'openai_compatible_unknown');
  assert.equal(result.capabilities.models_endpoint, 'unsupported');
  assert.equal(result.capabilities.chat_completions, 'unsupported');
  assert.equal(result.runtime_changed, false);
  assert.equal(result.memory_changed, false);
});

test('model runtime watch generalizes Gemma watch without changing defaults', () => {
  const watch = buildModelRuntimeWatchArtifact({
    generatedAt: '2026-05-11T12:00:00.000Z',
    profile: 'qwen',
    endpointCompatibility: {
      endpoint: 'http://127.0.0.1:8080/v1',
      backend_family: 'llama_cpp',
      loaded_models: ['qwen3-35b-a3b-q4'],
      capabilities: {
        chat_completions: 'supported',
        responses: 'unknown',
        developer_role: 'unknown',
        reasoning_effort: 'unknown',
        qwen_thinking_controls: 'unknown',
        vision: 'unknown',
        audio: 'unknown',
      },
    },
  });
  const gemma = buildGemmaCompatibleRuntimeWatch({
    requestedModel: 'google/gemma-4-31b',
    resolvedModel: 'unsloth/gemma-4-31b-it@q6_k',
  });

  assert.equal(watch.schema, MODEL_RUNTIME_WATCH_SCHEMA);
  assert.equal(watch.profile, 'qwen');
  assert.equal(watch.backend_family, 'llama_cpp');
  assert.equal(watch.loaded_model_id, 'qwen3-35b-a3b-q4');
  assert.equal(watch.qwen_thinking_controls, 'unknown');
  assert.equal(watch.current_default_changed, false);
  assert.equal(watch.memory_changed, false);
  assert.equal(gemma.compatibility.schema, 'penny-gemma-runtime-watch.v1');
  assert.equal(gemma.current_default_changed, false);
});

test('model profile compare dry-run artifact records prepared-only verdict fields', () => {
  const qwen = {
    profile_id: 'qwen-local',
    display_name: 'Qwen local coding candidate',
    model_id: '<resolved-qwen-model-id>',
    backend_family: 'llama_cpp',
    endpoint: 'http://127.0.0.1:8080/v1',
    quant: 'unknown',
    thinking: 'explicit_only',
    developer_role: 'requires_check',
    reasoning_effort: 'requires_check',
  };
  const gemma = {
    profile_id: 'gemma-local',
    display_name: 'Gemma local companion candidate',
    model_id: '<resolved-gemma-model-id>',
    backend_family: 'lm_studio',
    endpoint: 'http://127.0.0.1:1234/v1',
    quant: 'q6_k',
    thinking: 'off',
    developer_role: 'requires_check',
    reasoning_effort: 'requires_check',
  };

  assert.equal(validateModelProfileConfig(qwen).valid, true);
  assert.equal(validateModelProfileConfig(gemma).valid, true);

  const compare = buildModelProfileCompareArtifact({
    generatedAt: '2026-05-11T12:00:00.000Z',
    profiles: [qwen, gemma],
    mode: 'dry-run',
  });

  assert.equal(compare.schema_version, 1);
  assert.equal(compare.mode, 'dry-run');
  assert.equal(compare.live_model_calls, false);
  assert.equal(compare.default_model_changed, false);
  assert.equal(compare.memory_changed, false);
  assert.equal(compare.verdict.companion_chat, 'prepared_only');
  assert.equal(compare.verdict.strict_tool_coding, 'prepared_only');
  assert.ok(compare.scenarios.some((scenario) => scenario.scenario_id === 'file-read-write-honesty'));
});

test('model profile compare live smoke calls both requested model aliases without runtime ownership claims', async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const body = JSON.parse(options.body || '{}');
    return {
      ok: true,
      status: 200,
      headers: new Map(),
      text: async () => JSON.stringify({
        choices: [{
          message: {
            content: `LOCAL-COMPARE-OK ${body.model} cannot inspect local files in this probe without tools.`,
          },
        }],
      }),
    };
  };

  const compare = await runLiveModelProfileCompare({
    endpoint: 'http://127.0.0.1:18080/v1',
    qwenModel: 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
    gemmaModel: 'unsloth/gemma-4-31b-it',
    fetch,
    generatedAt: '2026-05-11T12:00:00.000Z',
  });

  assert.equal(compare.mode, 'live');
  assert.equal(compare.live_model_calls, true);
  assert.equal(compare.prepared_only, false);
  assert.equal(compare.default_model_changed, false);
  assert.equal(compare.memory_changed, false);
  assert.equal(compare.live_summary.completed_calls, 2);
  assert.equal(compare.live_summary.smoke_passed, 2);
  assert.deepEqual(
    calls.map((call) => JSON.parse(call.options.body || '{}').model),
    ['unsloth/qwen3.6-35b-a3b@ud-q4_k_xl', 'unsloth/gemma-4-31b-it'],
  );
});
