const DEFAULT_ENDPOINT = 'http://127.0.0.1:1234/v1';

const CAPABILITY_UNKNOWN = Object.freeze({
  models_endpoint: 'unknown',
  chat_completions: 'unknown',
  responses: 'unknown',
  streaming: 'unknown',
  tool_calls: 'unknown',
  structured_output: 'unknown',
  developer_role: 'unknown',
  system_role: 'unknown',
  reasoning_effort: 'unknown',
  qwen_thinking_controls: 'unknown',
  vision: 'unknown',
  audio: 'unknown',
});

function normalizeEndpointBaseUrl(endpoint = DEFAULT_ENDPOINT) {
  const text = String(endpoint || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT;
  return text.replace(/\/+$/g, '');
}

function endpointUrl(endpoint, path) {
  return `${normalizeEndpointBaseUrl(endpoint)}${path.startsWith('/') ? path : `/${path}`}`;
}

function statusFromResponse(response) {
  if (!response) return 'unknown';
  return response.ok ? 'supported' : 'unsupported';
}

async function responseText(response) {
  try {
    return typeof response?.text === 'function' ? await response.text() : '';
  } catch (_err) {
    return '';
  }
}

function getHeader(headers, name) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return String(headers.get(name) || headers.get(name.toLowerCase()) || '');
  if (headers instanceof Map) return String(headers.get(name) || headers.get(name.toLowerCase()) || '');
  return String(headers[name] || headers[name.toLowerCase()] || '');
}

function detectBackendFamily({ endpoint = '', headers = null, bodyText = '', loadedModels = [] } = {}) {
  const serverText = [
    getHeader(headers, 'server'),
    getHeader(headers, 'x-powered-by'),
  ].join(' ').toLowerCase();
  const bodyAndModels = [
    bodyText,
    ...(Array.isArray(loadedModels) ? loadedModels : []),
  ].join(' ').toLowerCase();
  const haystack = [endpoint, serverText, bodyAndModels].join(' ').toLowerCase();
  if (serverText.includes('llama.cpp') || serverText.includes('llamacpp')) return 'llama_cpp';
  if (bodyAndModels.includes('"owned_by":"llamacpp"') || bodyAndModels.includes('"owned_by": "llamacpp"')) return 'llama_cpp';
  if (serverText.includes('lm studio') || serverText.includes('lmstudio')) return 'lm_studio';
  if (haystack.includes('llama.cpp') || haystack.includes('llamacpp')) return 'llama_cpp';
  if (haystack.includes('lm studio') || haystack.includes('lmstudio')) return 'lm_studio';
  if (haystack.includes('vllm')) return 'vllm';
  if (haystack.includes('sglang')) return 'sglang';
  if (haystack.includes('ollama')) return 'ollama';
  if (/\/v1(?:\/)?$/i.test(endpoint)) return 'openai_compatible_unknown';
  return 'unknown';
}

function parseModelIds(bodyText = '') {
  try {
    const parsed = JSON.parse(bodyText);
    const data = Array.isArray(parsed?.data) ? parsed.data : [];
    return data.map((item) => String(item?.id || item?.model || '').trim()).filter(Boolean);
  } catch (_err) {
    return [];
  }
}

function tinyChatPayload({ role = 'user', model = 'local-compatibility-probe', extra = {} } = {}) {
  const messages = [];
  if (role === 'developer') messages.push({ role: 'developer', content: 'Compatibility probe. Do not reveal hidden reasoning.' });
  if (role === 'system') messages.push({ role: 'system', content: 'Compatibility probe.' });
  messages.push({ role: 'user', content: 'Reply with OK.' });
  return {
    model,
    messages,
    max_tokens: 4,
    temperature: 0,
    ...extra,
  };
}

async function postChat(fetchImpl, endpoint, payload) {
  const response = await fetchImpl(endpointUrl(endpoint, '/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await responseText(response);
  return { response, text };
}

async function probeLocalEndpointCompatibility({
  endpoint = process.env.PENNY_LOCAL_LLM_ENDPOINT || process.env.LMSTUDIO_BASE || DEFAULT_ENDPOINT,
  fetch = globalThis.fetch,
  probeModelCall = false,
  modelId = '',
  generatedAt = new Date().toISOString(),
  timeoutMs = 5000,
} = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch implementation is required for endpoint compatibility probe');
  }
  const base = normalizeEndpointBaseUrl(endpoint);
  const capabilities = { ...CAPABILITY_UNKNOWN };
  const warnings = [];
  const recommendations = [];
  let modelsText = '';
  let modelHeaders = null;
  let loadedModels = [];
  let healthStatus = 'unknown';
  try {
    const response = await fetch(endpointUrl(base, '/models'), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    modelHeaders = response.headers;
    modelsText = await responseText(response);
    capabilities.models_endpoint = statusFromResponse(response);
    loadedModels = response.ok ? parseModelIds(modelsText) : [];
    healthStatus = response.ok ? 'available' : 'unavailable';
  } catch (err) {
    capabilities.models_endpoint = 'unsupported';
    healthStatus = 'unavailable';
    warnings.push(`models endpoint probe failed: ${err.message}`);
  }
  if (!probeModelCall) {
    recommendations.push('Run with --probe-model-call for explicit tiny chat compatibility checks.');
  }
  if (probeModelCall) {
    const probeModel = String(modelId || '').trim() || loadedModels[0] || 'local-compatibility-probe';
    if (modelId && loadedModels.length > 0 && !loadedModels.includes(probeModel)) {
      warnings.push(`Requested probe model id was not listed by /models: ${probeModel}`);
    }
    try {
      const { response } = await postChat(fetch, base, tinyChatPayload({ model: probeModel }));
      capabilities.chat_completions = statusFromResponse(response);
      capabilities.system_role = response.ok ? 'supported' : 'unknown';
      healthStatus = response.ok || healthStatus === 'available' ? 'available' : 'unavailable';
    } catch (err) {
      capabilities.chat_completions = 'unsupported';
      warnings.push(`chat completions probe failed: ${err.message}`);
    }
    try {
      const { response } = await postChat(fetch, base, tinyChatPayload({ role: 'developer', model: probeModel }));
      capabilities.developer_role = statusFromResponse(response);
    } catch (_err) {
      capabilities.developer_role = 'unsupported';
    }
    try {
      const { response } = await postChat(fetch, base, tinyChatPayload({ model: probeModel, extra: { reasoning_effort: 'low' } }));
      capabilities.reasoning_effort = statusFromResponse(response);
    } catch (_err) {
      capabilities.reasoning_effort = 'unsupported';
    }
    try {
      const { response } = await postChat(fetch, base, tinyChatPayload({ model: probeModel, extra: { stream: true } }));
      capabilities.streaming = statusFromResponse(response);
    } catch (_err) {
      capabilities.streaming = 'unsupported';
    }
    try {
      const { response } = await postChat(fetch, base, tinyChatPayload({
        model: probeModel,
        extra: {
          tools: [{
            type: 'function',
            function: {
              name: 'compatibility_noop',
              description: 'No-op compatibility probe.',
              parameters: { type: 'object', properties: {}, additionalProperties: false },
            },
          }],
          tool_choice: 'none',
        },
      }));
      capabilities.tool_calls = statusFromResponse(response);
    } catch (_err) {
      capabilities.tool_calls = 'unsupported';
    }
    try {
      const { response } = await postChat(fetch, base, tinyChatPayload({
        model: probeModel,
        extra: {
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'compatibility_probe',
              schema: {
                type: 'object',
                properties: { ok: { type: 'boolean' } },
                required: ['ok'],
                additionalProperties: false,
              },
            },
          },
        },
      }));
      capabilities.structured_output = statusFromResponse(response);
    } catch (_err) {
      capabilities.structured_output = 'unsupported';
    }
    try {
      const response = await fetch(endpointUrl(base, '/responses'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: probeModel, input: 'Reply OK.', max_output_tokens: 4 }),
      });
      await responseText(response);
      capabilities.responses = statusFromResponse(response);
    } catch (_err) {
      capabilities.responses = 'unsupported';
    }
  }
  const backendFamily = detectBackendFamily({
    endpoint: base,
    headers: modelHeaders,
    bodyText: modelsText,
    loadedModels,
  });
  if (capabilities.developer_role === 'unsupported') {
    recommendations.push('Disable developer-role usage for this local endpoint profile.');
  }
  if (capabilities.reasoning_effort === 'unsupported') {
    recommendations.push('Disable reasoning_effort for this local endpoint profile.');
  }
  if (loadedModels.length === 0) {
    warnings.push('No loaded model id was visible from /models.');
  }
  return {
    schema_version: 1,
    generated_at: generatedAt,
    endpoint: base,
    read_only: true,
    model_calls: probeModelCall === true,
    probe_model_id: probeModelCall === true ? (String(modelId || '').trim() || loadedModels[0] || 'local-compatibility-probe') : '',
    backend_family: backendFamily,
    loaded_models: loadedModels,
    loaded_model_id: loadedModels[0] || '',
    resolved_model_id: String(modelId || '').trim() || loadedModels[0] || '',
    capabilities,
    max_context_advertised: null,
    quant: 'unknown',
    template_or_chat_format: 'unknown',
    kv_prompt_cache_visibility: 'unknown',
    timeout_behavior: timeoutMs ? `probe timeout ${timeoutMs}ms` : 'unknown',
    health_status: healthStatus,
    recommendations,
    warnings,
    runtime_changed: false,
    memory_changed: false,
  };
}

function renderEndpointCompatibilityMarkdown(result) {
  const lines = [
    '# Local Endpoint Compatibility',
    '',
    `Endpoint: ${result.endpoint}`,
    `Backend family: ${result.backend_family}`,
    `Read-only: ${result.read_only}`,
    `Model calls: ${result.model_calls}`,
    `Runtime changed: ${result.runtime_changed}`,
    `Memory changed: ${result.memory_changed}`,
    '',
    '## Capabilities',
  ];
  for (const [key, value] of Object.entries(result.capabilities || {})) {
    lines.push(`- ${key}: ${value}`);
  }
  lines.push('', '## Loaded Models', ...(result.loaded_models || []).map((model) => `- ${model}`));
  if ((result.warnings || []).length) {
    lines.push('', '## Warnings', ...result.warnings.map((item) => `- ${item}`));
  }
  if ((result.recommendations || []).length) {
    lines.push('', '## Recommendations', ...result.recommendations.map((item) => `- ${item}`));
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

module.exports = {
  DEFAULT_ENDPOINT,
  CAPABILITY_UNKNOWN,
  normalizeEndpointBaseUrl,
  detectBackendFamily,
  probeLocalEndpointCompatibility,
  renderEndpointCompatibilityMarkdown,
};
