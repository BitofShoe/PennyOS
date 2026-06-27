const RUNTIME_CONTRACT_RECEIPT_SCHEMA = 'penny-runtime-contract-receipt.v1';

const STATE_MUTATION_FIELDS = Object.freeze([
  'started_models',
  'stopped_models',
  'loaded_models',
  'unloaded_models',
  'swapped_models',
  'downloaded_models',
  'memory_changed',
  'runtime_voice_changed',
  'prompt_defaults_changed',
  'default_model_changed',
]);

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function trimIso(value = '', fallback = '') {
  const text = cleanText(value);
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function uniqueStrings(values = [], limit = 24) {
  const out = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    const text = cleanText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeNullableNumber(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstKnown(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return 'unknown';
}

function normalizeEndpoint(endpoint = '') {
  return cleanText(endpoint).replace(/\/+$/g, '');
}

function inferLocalCloudMode(endpoint = '', explicitMode = '') {
  const mode = cleanText(explicitMode).toLowerCase();
  if (['local', 'cloud', 'unknown'].includes(mode)) return mode;
  const text = normalizeEndpoint(endpoint).toLowerCase();
  if (!text) return 'unknown';
  if (
    text.includes('127.0.0.1')
    || text.includes('localhost')
    || text.includes('[::1]')
    || /^https?:\/\/10\./.test(text)
    || /^https?:\/\/192\.168\./.test(text)
    || /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./.test(text)
  ) return 'local';
  return /^https?:\/\//.test(text) ? 'cloud' : 'unknown';
}

function normalizeSamplingDefaults(defaults = {}) {
  const value = defaults && typeof defaults === 'object' ? defaults : {};
  return {
    temperature: normalizeNullableNumber(value.temperature),
    top_p: normalizeNullableNumber(value.top_p),
    top_k: normalizeNullableNumber(value.top_k),
    min_p: normalizeNullableNumber(value.min_p),
    seed: normalizeNullableNumber(value.seed),
    max_tokens: normalizeNullableNumber(value.max_tokens ?? value.maxTokens),
  };
}

function normalizePromptContract({
  endpointCompatibility = {},
  chatTemplate = '',
  promptTemplate = '',
  systemPromptSupport = '',
  stopTokens = [],
  parserExpectations = '',
} = {}) {
  const capabilities = endpointCompatibility.capabilities || {};
  return {
    chat_template: firstKnown(chatTemplate, endpointCompatibility.template_or_chat_format),
    prompt_template: firstKnown(promptTemplate, chatTemplate, endpointCompatibility.template_or_chat_format),
    system_prompt_support: firstKnown(systemPromptSupport, capabilities.system_role),
    stop_tokens: uniqueStrings(stopTokens, 12),
    parser_expectations: cleanText(parserExpectations, 'unknown'),
  };
}

function normalizeCapabilities(endpointCompatibility = {}, explicit = {}) {
  const capabilities = endpointCompatibility.capabilities || {};
  const source = explicit && typeof explicit === 'object' ? explicit : {};
  return {
    models_endpoint: firstKnown(source.models_endpoint, capabilities.models_endpoint),
    chat_completions: firstKnown(source.chat_completions, capabilities.chat_completions),
    responses: firstKnown(source.responses, capabilities.responses),
    stateful_chat: firstKnown(source.stateful_chat, capabilities.stateful_chat),
    streaming: firstKnown(source.streaming, capabilities.streaming),
    tool_function_support: firstKnown(source.tool_function_support, capabilities.tool_calls),
    structured_output: firstKnown(source.structured_output, capabilities.structured_output),
    developer_role: firstKnown(source.developer_role, capabilities.developer_role),
    system_role: firstKnown(source.system_role, capabilities.system_role),
    reasoning_effort: firstKnown(source.reasoning_effort, capabilities.reasoning_effort),
    vision: firstKnown(source.vision, capabilities.vision),
    audio: firstKnown(source.audio, capabilities.audio),
  };
}

function normalizeStatePreservation(state = {}) {
  const source = state && typeof state === 'object' ? state : {};
  const normalized = {};
  for (const field of STATE_MUTATION_FIELDS) {
    normalized[field] = source[field] === true;
  }
  normalized.model_state_preserved = source.model_state_preserved === false
    ? false
    : !STATE_MUTATION_FIELDS.some((field) => normalized[field] === true);
  normalized.receipt_note = cleanText(
    source.receipt_note,
    normalized.model_state_preserved
      ? 'No start/stop/load/unload/swap/download/default/memory/runtime-voice mutation is recorded by this receipt.'
      : 'This receipt records a state mutation; verify operator permission before treating it as safe.',
  );
  return normalized;
}

function normalizeMemoryLane(status = {}) {
  const value = status && typeof status === 'object' ? status : {};
  return {
    status: cleanText(value.status, 'unknown'),
    semantic_ready: value.semanticReady === true || value.semantic_ready === true,
    semantic_known: typeof value.semanticKnown === 'boolean'
      ? value.semanticKnown
      : (typeof value.semantic_known === 'boolean' ? value.semantic_known : null),
    requested_embedding_model: cleanText(value.requestedEmbeddingModel || value.requested_embedding_model),
    privacy_flag: cleanText(value.privacyFlag || value.privacy_flag, 'unknown'),
    review_status: cleanText(value.reviewStatus || value.review_status, 'not_applicable'),
    downstream_use: cleanText(value.downstreamUse || value.downstream_use, 'runtime-readiness-only'),
  };
}

function normalizeSmoke(smoke = {}, endpointCompatibility = {}) {
  const value = smoke && typeof smoke === 'object' ? smoke : {};
  const prompt = cleanText(value.prompt);
  const output = cleanText(value.output);
  const modelCall = value.modelCall === true || value.model_call === true || endpointCompatibility.model_calls === true;
  const explicitStatus = cleanText(value.status);
  const status = explicitStatus || (output ? 'recorded' : 'not_run');
  return {
    status,
    prompt,
    output,
    model_call: modelCall,
    reason: cleanText(
      value.reason,
      status === 'not_run'
        ? 'No smoke model call was run for this receipt.'
        : 'Smoke result supplied by the caller.',
    ),
  };
}

function normalizePrivacy({ endpoint = '', localCloudMode = '', privacyWarningState = '', privateMemorySentToCloud = false } = {}) {
  const mode = inferLocalCloudMode(endpoint, localCloudMode);
  return {
    local_first: mode === 'local',
    cloud_warning_required: mode === 'cloud',
    warning_state: cleanText(
      privacyWarningState,
      mode === 'cloud' ? 'required' : (mode === 'local' ? 'local-first' : 'unknown'),
    ),
    private_memory_sent_to_cloud: privateMemorySentToCloud === true,
  };
}

function buildRuntimeContractReceipt({
  generatedAt = new Date().toISOString(),
  endpointCompatibility = {},
  endpoint = '',
  backend = '',
  backendFamily = '',
  requestedModelId = '',
  modelId = '',
  modelPath = '',
  fileFormat = '',
  quant = '',
  contextLength = null,
  chatTemplate = '',
  promptTemplate = '',
  systemPromptSupport = '',
  stopTokens = [],
  parserExpectations = '',
  samplingDefaults = {},
  capabilities = {},
  kvCache = {},
  offload = {},
  memoryLaneStatus = {},
  privacyWarningState = '',
  privateMemorySentToCloud = false,
  localCloudMode = '',
  smokePrompt = {},
  statePreservation = {},
  warnings = [],
  recommendedNextVerification = [],
  readinessSummary = null,
} = {}) {
  const normalizedEndpoint = normalizeEndpoint(endpoint || endpointCompatibility.endpoint || '');
  const loadedModels = uniqueStrings(endpointCompatibility.loaded_models || endpointCompatibility.loadedModels || [], 32);
  const resolvedId = cleanText(
    modelId,
    cleanText(endpointCompatibility.resolved_model_id, cleanText(endpointCompatibility.loaded_model_id, loadedModels[0] || '')),
  );
  const requestedId = cleanText(requestedModelId, resolvedId);
  const mode = endpointCompatibility.model_calls === true ? 'explicit-model-probe' : 'status-only';
  const normalizedBackend = firstKnown(backend, backendFamily, endpointCompatibility.backend_family);
  const normalizedContext = normalizeNullableNumber(
    contextLength ?? endpointCompatibility.max_context_advertised,
  );
  const promptContract = normalizePromptContract({
    endpointCompatibility,
    chatTemplate,
    promptTemplate,
    systemPromptSupport,
    stopTokens,
    parserExpectations,
  });
  const privacy = normalizePrivacy({
    endpoint: normalizedEndpoint,
    localCloudMode,
    privacyWarningState,
    privateMemorySentToCloud,
  });
  const smoke = normalizeSmoke(smokePrompt, endpointCompatibility);
  const recommendations = uniqueStrings([
    ...(Array.isArray(endpointCompatibility.recommendations) ? endpointCompatibility.recommendations : []),
    ...(Array.isArray(recommendedNextVerification) ? recommendedNextVerification : []),
    smoke.status === 'not_run' ? 'Run an explicit smoke prompt only after operator approval that model calls are safe.' : '',
  ], 12);

  return {
    schema: RUNTIME_CONTRACT_RECEIPT_SCHEMA,
    schema_version: 1,
    generated_at: trimIso(generatedAt, generatedAt),
    measurement_mode: mode,
    runtime: {
      endpoint: normalizedEndpoint,
      backend: normalizedBackend,
      local_cloud_mode: privacy.cloud_warning_required ? 'cloud' : inferLocalCloudMode(normalizedEndpoint, localCloudMode),
      health_status: cleanText(endpointCompatibility.health_status, 'unknown'),
      read_only_probe: endpointCompatibility.read_only !== false,
    },
    model: {
      requested_model_id: requestedId,
      model_id: resolvedId,
      model_path: cleanText(modelPath),
      id_or_path: cleanText(modelPath, resolvedId || requestedId),
      file_format: firstKnown(fileFormat, endpointCompatibility.file_format),
      quant: firstKnown(quant, endpointCompatibility.quant),
      context_length: normalizedContext,
    },
    loaded_models: loadedModels,
    prompt_contract: promptContract,
    sampling_defaults: normalizeSamplingDefaults(samplingDefaults),
    capabilities: normalizeCapabilities(endpointCompatibility, capabilities),
    performance_resources: {
      kv_cache: {
        visibility: firstKnown(kvCache.visibility, endpointCompatibility.kv_prompt_cache_visibility),
        detail: cleanText(kvCache.detail, 'unknown'),
      },
      offload: {
        layers: cleanText(offload.layers, 'unknown'),
        vram: cleanText(offload.vram, 'unknown'),
      },
    },
    memory_lane: normalizeMemoryLane(memoryLaneStatus),
    privacy,
    smoke,
    state_preservation: normalizeStatePreservation(statePreservation),
    readiness_summary: readinessSummary || null,
    warnings: uniqueStrings([
      ...(Array.isArray(endpointCompatibility.warnings) ? endpointCompatibility.warnings : []),
      ...(Array.isArray(warnings) ? warnings : []),
    ], 16),
    recommended_next_verification: recommendations,
  };
}

function renderRuntimeContractReceiptMarkdown(receipt = {}) {
  const runtime = receipt.runtime || {};
  const model = receipt.model || {};
  const prompt = receipt.prompt_contract || {};
  const capabilities = receipt.capabilities || {};
  const state = receipt.state_preservation || {};
  const smoke = receipt.smoke || {};
  const memory = receipt.memory_lane || {};
  const privacy = receipt.privacy || {};
  const lines = [
    '# Penny Runtime Contract Receipt',
    '',
    `Schema: ${receipt.schema || RUNTIME_CONTRACT_RECEIPT_SCHEMA}`,
    `Measurement mode: ${receipt.measurement_mode || 'unknown'}`,
    `Endpoint: ${runtime.endpoint || 'unknown'}`,
    `Backend: ${runtime.backend || 'unknown'}`,
    `Local/cloud mode: ${runtime.local_cloud_mode || 'unknown'}`,
    `Model id/path: ${model.id_or_path || 'unknown'}`,
    `Quant/file format: ${model.quant || 'unknown'} / ${model.file_format || 'unknown'}`,
    `Context length: ${model.context_length == null ? 'unknown' : model.context_length}`,
    `Prompt/chat template: ${prompt.chat_template || 'unknown'}`,
    `Sampling defaults: temperature=${receipt.sampling_defaults?.temperature ?? 'unknown'}, top_p=${receipt.sampling_defaults?.top_p ?? 'unknown'}, top_k=${receipt.sampling_defaults?.top_k ?? 'unknown'}`,
    `Tool/function support: ${capabilities.tool_function_support || 'unknown'}`,
    `Memory lane: ${memory.status || 'unknown'}`,
    `Privacy warning state: ${privacy.warning_state || 'unknown'}`,
    `Smoke status: ${smoke.status || 'unknown'}`,
    `Smoke prompt: ${smoke.prompt || '(not run)'}`,
    `Model state preserved: ${state.model_state_preserved === true}`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  RUNTIME_CONTRACT_RECEIPT_SCHEMA,
  buildRuntimeContractReceipt,
  renderRuntimeContractReceiptMarkdown,
};
