const {
  buildGemmaRuntimeWatchArtifact,
} = require('./penny-gemma-runtime-watch');
const {
  buildRuntimeContractReceipt,
  renderRuntimeContractReceiptMarkdown,
} = require('./penny-runtime-contract-receipt');

const MODEL_RUNTIME_WATCH_SCHEMA = 'penny-model-runtime-watch.v1';

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function firstArrayValue(values = []) {
  return Array.isArray(values) ? cleanText(values[0]) : '';
}

function inferModelClass(profile = '', modelId = '') {
  const text = `${profile} ${modelId}`.toLowerCase();
  if (text.includes('embed')) return 'embedding_model';
  if (text.includes('qwen') || text.includes('coder')) return 'coding_tool_candidate';
  if (text.includes('gemma')) return 'companion_chat_candidate';
  if (text.includes('vision') || text.includes('vl')) return 'vision_candidate';
  if (text.includes('audio') || text.includes('whisper') || text.includes('tts')) return 'audio_candidate';
  return 'unknown';
}

function buildModelRuntimeWatchArtifact({
  generatedAt = new Date().toISOString(),
  profile = 'unknown',
  endpointCompatibility = {},
  endpoint = '',
  backend_family = '',
  loaded_model_id = '',
  resolved_model_id = '',
  quant = 'unknown',
  route_lane_selected = '',
  context_length = null,
  chat_template = 'unknown',
  prompt_kv_cache_exposed = 'unknown',
  qwen_thinking_controls = '',
  model_class = '',
  sampling_defaults = {},
  memory_lane_status = {},
  privacy_warning_state = '',
  smoke_prompt = {},
  warnings = [],
  recommended_next_verification = [],
} = {}) {
  const capabilities = endpointCompatibility.capabilities || {};
  const loaded = cleanText(loaded_model_id, firstArrayValue(endpointCompatibility.loaded_models));
  const resolved = cleanText(resolved_model_id, endpointCompatibility.resolved_model_id || loaded);
  const thinking = cleanText(qwen_thinking_controls, capabilities.qwen_thinking_controls || (profile === 'qwen' ? 'unknown' : 'unknown'));
  const runtimeContract = buildRuntimeContractReceipt({
    generatedAt,
    endpointCompatibility,
    endpoint: cleanText(endpoint, endpointCompatibility.endpoint || ''),
    backend: cleanText(backend_family, endpointCompatibility.backend_family || 'unknown'),
    requestedModelId: resolved || loaded,
    modelId: resolved,
    quant: cleanText(quant, endpointCompatibility.quant || 'unknown'),
    contextLength: context_length,
    chatTemplate: chat_template,
    promptTemplate: chat_template,
    samplingDefaults: sampling_defaults,
    capabilities,
    kvCache: {
      visibility: prompt_kv_cache_exposed,
    },
    memoryLaneStatus: memory_lane_status,
    privacyWarningState: privacy_warning_state,
    smokePrompt: smoke_prompt,
    statePreservation: {
      default_model_changed: false,
      memory_changed: false,
      runtime_voice_changed: false,
      prompt_defaults_changed: false,
    },
    warnings,
    recommendedNextVerification: recommended_next_verification,
  });

  return {
    schema: MODEL_RUNTIME_WATCH_SCHEMA,
    schema_version: 1,
    generated_at: generatedAt,
    measurement_mode: endpointCompatibility.model_calls ? 'explicit-model-probe' : 'status-only',
    profile: cleanText(profile, 'unknown'),
    endpoint: cleanText(endpoint, endpointCompatibility.endpoint || ''),
    backend_family: cleanText(backend_family, endpointCompatibility.backend_family || 'unknown'),
    loaded_model_id: loaded,
    resolved_model_id: resolved,
    quant: cleanText(quant, endpointCompatibility.quant || 'unknown'),
    supports_chat_completions: capabilities.chat_completions || 'unknown',
    supports_responses: capabilities.responses || 'unknown',
    supports_stateful_chat: capabilities.stateful_chat || 'unknown',
    tolerates_developer_role: capabilities.developer_role || 'unknown',
    tolerates_reasoning_effort: capabilities.reasoning_effort || 'unknown',
    qwen_thinking_controls: thinking,
    vision_available: capabilities.vision || 'unknown',
    audio_available: capabilities.audio || 'unknown',
    prompt_kv_cache_exposed,
    chat_template,
    context_length,
    route_lane_selected,
    model_class: cleanText(model_class, inferModelClass(profile, resolved || loaded)),
    current_default_changed: false,
    memory_changed: false,
    runtime_prompt_changed: false,
    hidden_reasoning_persisted: false,
    warnings: Array.isArray(warnings) ? warnings : [],
    recommended_next_verification: Array.isArray(recommended_next_verification) && recommended_next_verification.length
      ? recommended_next_verification
      : ['Run endpoint compatibility with --probe-model-call only when the local endpoint is safe to query.'],
    runtime_contract: runtimeContract,
  };
}

function buildGemmaCompatibleRuntimeWatch(options = {}) {
  const compatibility = buildGemmaRuntimeWatchArtifact({
    generatedAt: options.generatedAt,
    measurementMode: options.measurementMode || 'status-only',
    requestedModel: options.requestedModel || options.loaded_model_id || 'google/gemma-4-31b',
    resolvedModel: options.resolvedModel || options.resolved_model_id || '',
    status: options.status || {},
  });
  const neutral = buildModelRuntimeWatchArtifact({
    generatedAt: options.generatedAt,
    profile: 'gemma',
    endpointCompatibility: {
      endpoint: options.endpoint || '',
      backend_family: options.backend_family || 'lm_studio',
      loaded_models: [compatibility.watchItems.loadedModelIdentity.resolved].filter(Boolean),
      capabilities: {
        chat_completions: 'unknown',
        responses: 'unknown',
        developer_role: 'unknown',
        reasoning_effort: 'unknown',
        qwen_thinking_controls: 'unknown',
        vision: compatibility.watchItems.visionBudget.exposed === true ? 'unknown' : 'unknown',
        audio: 'unknown',
      },
    },
    loaded_model_id: compatibility.watchItems.loadedModelIdentity.resolved,
    resolved_model_id: compatibility.watchItems.loadedModelIdentity.resolved,
    model_class: 'companion_chat_candidate',
  });
  return {
    ...neutral,
    compatibility,
  };
}

function renderModelRuntimeWatchMarkdown(watch) {
  const lines = [
    '# Penny Model Runtime Watch',
    '',
    `Schema: ${watch.schema}`,
    `Profile: ${watch.profile}`,
    `Endpoint: ${watch.endpoint || 'unknown'}`,
    `Backend family: ${watch.backend_family}`,
    `Loaded model: ${watch.loaded_model_id || 'unknown'}`,
    `Resolved model: ${watch.resolved_model_id || 'unknown'}`,
    `Model class: ${watch.model_class}`,
    '',
    '## Compatibility',
    `- chat_completions: ${watch.supports_chat_completions}`,
    `- responses: ${watch.supports_responses}`,
    `- developer_role: ${watch.tolerates_developer_role}`,
    `- reasoning_effort: ${watch.tolerates_reasoning_effort}`,
    `- qwen_thinking_controls: ${watch.qwen_thinking_controls}`,
    `- vision: ${watch.vision_available}`,
    `- audio: ${watch.audio_available}`,
    '',
    '## Guardrails',
    `- current_default_changed: ${watch.current_default_changed}`,
    `- memory_changed: ${watch.memory_changed}`,
    `- runtime_prompt_changed: ${watch.runtime_prompt_changed}`,
    `- hidden_reasoning_persisted: ${watch.hidden_reasoning_persisted}`,
    '',
    '## Runtime Contract Receipt',
    `- schema: ${watch.runtime_contract?.schema || 'unknown'}`,
    `- measurement_mode: ${watch.runtime_contract?.measurement_mode || 'unknown'}`,
    `- local_cloud_mode: ${watch.runtime_contract?.runtime?.local_cloud_mode || 'unknown'}`,
    `- model_state_preserved: ${watch.runtime_contract?.state_preservation?.model_state_preserved === true}`,
    `- smoke_status: ${watch.runtime_contract?.smoke?.status || 'unknown'}`,
    '',
  ];
  if (watch.runtime_contract) {
    lines.push(renderRuntimeContractReceiptMarkdown(watch.runtime_contract));
  }
  return `${lines.join('\n')}\n`;
}

module.exports = {
  MODEL_RUNTIME_WATCH_SCHEMA,
  buildModelRuntimeWatchArtifact,
  buildGemmaCompatibleRuntimeWatch,
  renderModelRuntimeWatchMarkdown,
};
