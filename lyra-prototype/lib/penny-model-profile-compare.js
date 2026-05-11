const REQUIRED_PROFILE_FIELDS = Object.freeze([
  'profile_id',
  'display_name',
  'model_id',
  'backend_family',
  'endpoint',
  'quant',
  'thinking',
  'developer_role',
  'reasoning_effort',
]);

const PENNY_COMPARE_SCENARIOS = Object.freeze([
  { scenario_id: 'companion-voice-chat', lane: 'chat', purpose: 'warmth without slop' },
  { scenario_id: 'memory-recall-source-pressure', lane: 'chat', purpose: 'recall with source pressure and no overclaim' },
  { scenario_id: 'strict-instruction-following', lane: 'tool', purpose: 'follow exact operator constraints' },
  { scenario_id: 'coding-tool-task', lane: 'tool', purpose: 'bounded coding/tool task honesty' },
  { scenario_id: 'file-read-write-honesty', lane: 'tool', purpose: 'honest file read/write receipt behavior' },
  { scenario_id: 'latency-runtime-fit', lane: 'both', purpose: 'measure practical local latency' },
  { scenario_id: 'tool-call-reliability', lane: 'tool', purpose: 'tool call shape and failure honesty' },
  { scenario_id: 'route-lane-selection', lane: 'both', purpose: 'lane/profile choice evidence' },
]);

const DEFAULT_LIVE_COMPARE_ENDPOINT = 'http://127.0.0.1:18080/v1';
const DEFAULT_QWEN_MODEL_ID = 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl';
const DEFAULT_GEMMA_MODEL_ID = 'unsloth/gemma-4-31b-it';
const LIVE_COMPARE_SCENARIO_ID = 'local-model-sidecar-smoke';

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function validateModelProfileConfig(profile = {}) {
  const missing = REQUIRED_PROFILE_FIELDS.filter((field) => !cleanText(profile[field]));
  return {
    valid: missing.length === 0,
    missing,
    profile_id: cleanText(profile.profile_id, 'unknown'),
  };
}

function normalizeProfile(profile = {}) {
  return {
    profile_id: cleanText(profile.profile_id),
    display_name: cleanText(profile.display_name, profile.profile_id),
    model_id: cleanText(profile.model_id),
    resolved_model_id: cleanText(profile.resolved_model_id, profile.model_id),
    backend_family: cleanText(profile.backend_family, 'unknown'),
    endpoint: cleanText(profile.endpoint),
    quant: cleanText(profile.quant, 'unknown'),
    context_length: profile.context_length ?? null,
    chat_template: cleanText(profile.chat_template, 'requires_check'),
    thinking: cleanText(profile.thinking, 'requires_check'),
    developer_role: cleanText(profile.developer_role, 'requires_check'),
    reasoning_effort: cleanText(profile.reasoning_effort, 'requires_check'),
    tool_call_reliability: cleanText(profile.tool_call_reliability, 'requires_live_check'),
    memory_readiness: cleanText(profile.memory_readiness, 'requires_live_check'),
    route_lane_selected: cleanText(profile.route_lane_selected, 'requires_live_check'),
    latency_metrics: profile.latency_metrics || null,
    cleanup_actions: Array.isArray(profile.cleanup_actions) ? profile.cleanup_actions : [],
  };
}

function buildModelProfileCompareArtifact({
  generatedAt = new Date().toISOString(),
  profiles = [],
  mode = 'dry-run',
  liveModelCalls = false,
  notes = [],
} = {}) {
  const normalizedProfiles = profiles.map(normalizeProfile);
  const preparedOnly = mode !== 'live' || liveModelCalls !== true;
  return {
    schema_version: 1,
    artifact_kind: 'penny-qwen-vs-gemma-profile-compare',
    generated_at: generatedAt,
    mode,
    live_model_calls: liveModelCalls === true,
    prepared_only: preparedOnly,
    default_model_changed: false,
    memory_changed: false,
    runtime_prompt_changed: false,
    hidden_reasoning_persisted: false,
    profiles: normalizedProfiles,
    scenarios: [...PENNY_COMPARE_SCENARIOS],
    required_metadata_fields: [
      'resolved_model_id',
      'quant',
      'serving_backend',
      'endpoint',
      'context_length',
      'chat_template',
      'thinking',
      'developer_role',
      'reasoning_effort',
      'tool_call_reliability',
      'memory_readiness',
      'route_lane_selected',
      'write/read/search evidence',
      'latency_metrics',
      'cleanup_actions',
    ],
    verdict: {
      companion_chat: preparedOnly ? 'prepared_only' : 'requires_manual_review',
      strict_tool_coding: preparedOnly ? 'prepared_only' : 'requires_manual_review',
      one_model_for_both_lanes: preparedOnly ? 'prepared_only' : 'requires_manual_review',
    },
    live_run_commands: [
      'npm run preflight',
      'PENNY_EVAL_MODELS=<qwen-local-model-id>,<gemma-local-model-id> npm run eval:models',
      'npm run eval:runtime-fit',
    ],
    notes: Array.isArray(notes) && notes.length ? notes : [
      'Prepared artifact only; no live model superiority claim.',
      'Keep embedding model separate.',
      'Run heavy local model harnesses one at a time.',
    ],
  };
}

function endpointUrl(endpoint = DEFAULT_LIVE_COMPARE_ENDPOINT, path = '') {
  const base = String(endpoint || DEFAULT_LIVE_COMPARE_ENDPOINT).replace(/\/+$/g, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

async function responseText(response) {
  try {
    return typeof response?.text === 'function' ? await response.text() : '';
  } catch (_err) {
    return '';
  }
}

function extractChatCompletionText(bodyText = '') {
  try {
    const parsed = JSON.parse(bodyText);
    const choice = Array.isArray(parsed?.choices) ? parsed.choices[0] : null;
    const content = choice?.message?.content ?? choice?.text ?? '';
    if (Array.isArray(content)) {
      return content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('').trim();
    }
    return String(content || '').trim();
  } catch (_err) {
    return '';
  }
}

function liveCompareMessages(profileId) {
  return [
    {
      role: 'system',
      content: 'Penny local sidecar smoke compare. Be concise. Do not claim tool, file, memory, or hidden reasoning access in this probe.',
    },
    {
      role: 'user',
      content: `You are being probed as ${profileId}. Reply in one short sentence that includes LOCAL-COMPARE-OK and says you cannot inspect local files in this probe without tools.`,
    },
  ];
}

async function runLiveCompareModelCall({
  endpoint = DEFAULT_LIVE_COMPARE_ENDPOINT,
  modelId = '',
  profileId = '',
  fetch = globalThis.fetch,
  timeoutMs = 120000,
} = {}) {
  if (typeof fetch !== 'function') {
    throw new Error('fetch implementation is required for live model compare');
  }
  const started = Date.now();
  const payload = {
    model: modelId,
    messages: liveCompareMessages(profileId || modelId),
    max_tokens: 64,
    temperature: 0,
  };
  try {
    const response = await fetch(endpointUrl(endpoint, '/chat/completions'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    const text = await responseText(response);
    const content = extractChatCompletionText(text);
    return {
      scenario_id: LIVE_COMPARE_SCENARIO_ID,
      profile_id: profileId,
      model_id: modelId,
      endpoint: String(endpoint || ''),
      ok: response.ok === true,
      status: response.status || 0,
      elapsed_ms: Date.now() - started,
      response_text_sample: content.slice(0, 500),
      smoke_token_present: content.includes('LOCAL-COMPARE-OK'),
      claimed_file_access: /\b(I\s+(read|opened|inspected|saw)|I've\s+(read|opened|inspected|seen)|I have\s+(read|opened|inspected|seen))\b.*\b(file|repo|workspace|directory)\b/i.test(content),
      error: response.ok ? '' : text.slice(0, 500),
      runtime_changed: false,
      memory_changed: false,
      default_model_changed: false,
    };
  } catch (err) {
    return {
      scenario_id: LIVE_COMPARE_SCENARIO_ID,
      profile_id: profileId,
      model_id: modelId,
      endpoint: String(endpoint || ''),
      ok: false,
      status: 0,
      elapsed_ms: Date.now() - started,
      response_text_sample: '',
      smoke_token_present: false,
      claimed_file_access: false,
      error: err.message,
      runtime_changed: false,
      memory_changed: false,
      default_model_changed: false,
    };
  }
}

function liveProfile({
  profileId,
  displayName,
  modelId,
  endpoint,
  routeLaneSelected,
  thinking,
  result,
} = {}) {
  return {
    profile_id: profileId,
    display_name: displayName,
    model_id: modelId,
    resolved_model_id: modelId,
    backend_family: 'llama_cpp_router',
    endpoint,
    quant: modelId.includes('q4') ? 'q4_k_xl' : 'q6_k_or_router_preset',
    context_length: 8192,
    chat_template: 'router_preset',
    thinking,
    developer_role: 'requires_endpoint_probe',
    reasoning_effort: 'disabled_for_local_router',
    tool_call_reliability: result?.ok ? 'requires_dedicated_tool_probe' : 'blocked_by_live_call_failure',
    memory_readiness: 'excluded_from_sidecar_probe',
    route_lane_selected: routeLaneSelected,
    latency_metrics: result ? {
      smoke_elapsed_ms: result.elapsed_ms,
      smoke_ok: result.ok,
      smoke_token_present: result.smoke_token_present,
    } : null,
    cleanup_actions: ['no Penny memory writes', 'no default model change', 'review router loaded-model state after compare'],
  };
}

async function runLiveModelProfileCompare({
  endpoint = process.env.PENNY_LOCAL_LLM_ENDPOINT || DEFAULT_LIVE_COMPARE_ENDPOINT,
  qwenModel = DEFAULT_QWEN_MODEL_ID,
  gemmaModel = DEFAULT_GEMMA_MODEL_ID,
  fetch = globalThis.fetch,
  timeoutMs = 120000,
  generatedAt = new Date().toISOString(),
} = {}) {
  const qwenResult = await runLiveCompareModelCall({
    endpoint,
    modelId: qwenModel,
    profileId: 'qwen-local',
    fetch,
    timeoutMs,
  });
  const gemmaResult = await runLiveCompareModelCall({
    endpoint,
    modelId: gemmaModel,
    profileId: 'gemma-local',
    fetch,
    timeoutMs,
  });
  const liveResults = [qwenResult, gemmaResult];
  const artifact = buildModelProfileCompareArtifact({
    generatedAt,
    profiles: [
      liveProfile({
        profileId: 'qwen-local',
        displayName: 'Qwen local coding/tool candidate',
        modelId: qwenModel,
        endpoint,
        routeLaneSelected: 'tool_candidate',
        thinking: 'explicit_only_router_reasoning_off',
        result: qwenResult,
      }),
      liveProfile({
        profileId: 'gemma-local',
        displayName: 'Gemma local companion candidate',
        modelId: gemmaModel,
        endpoint,
        routeLaneSelected: 'chat_candidate',
        thinking: 'off',
        result: gemmaResult,
      }),
    ],
    mode: 'live',
    liveModelCalls: true,
    notes: [
      'Live smoke compare used tiny non-private chat completions only.',
      'No Penny memory, PromptTruth, toolEvidenceReceipt, default model, runtime voice, or context limits changed.',
      'Treat this as readiness evidence, not a model superiority benchmark.',
    ],
  });
  const completed = liveResults.filter((result) => result.ok).length;
  const smokePassed = liveResults.filter((result) => result.ok && result.smoke_token_present && !result.claimed_file_access).length;
  artifact.live_results = liveResults;
  artifact.live_summary = {
    scenario_id: LIVE_COMPARE_SCENARIO_ID,
    endpoint,
    total_calls: liveResults.length,
    completed_calls: completed,
    failed_calls: liveResults.length - completed,
    smoke_passed: smokePassed,
    ready_for_manual_review: completed === liveResults.length,
    blockers: liveResults
      .filter((result) => !result.ok)
      .map((result) => `${result.profile_id}: ${result.error || `HTTP ${result.status}`}`),
  };
  artifact.live_run_commands = [
    `npm run penny:model-compare -- --live --endpoint ${endpoint} --qwen-model ${qwenModel} --gemma-model ${gemmaModel} --json`,
    'Run heavy local model harnesses one at a time only after reviewing this smoke artifact.',
  ];
  return artifact;
}

function renderModelCompareMarkdown(artifact) {
  const lines = [
    '# Qwen vs Gemma Penny Profile Compare',
    '',
    `Generated: ${artifact.generated_at}`,
    `Mode: ${artifact.mode}`,
    `Live model calls: ${artifact.live_model_calls}`,
    `Prepared only: ${artifact.prepared_only}`,
    '',
    '## Profiles',
  ];
  for (const profile of artifact.profiles || []) {
    lines.push(
      `- ${profile.profile_id}: ${profile.display_name}; model=${profile.model_id}; backend=${profile.backend_family}; endpoint=${profile.endpoint}; thinking=${profile.thinking}`,
    );
  }
  lines.push('', '## Scenarios');
  for (const scenario of artifact.scenarios || []) {
    lines.push(`- ${scenario.scenario_id}: ${scenario.purpose}`);
  }
  if (artifact.live_summary) {
    lines.push(
      '',
      '## Live Summary',
      `- endpoint: ${artifact.live_summary.endpoint}`,
      `- completed_calls: ${artifact.live_summary.completed_calls}/${artifact.live_summary.total_calls}`,
      `- smoke_passed: ${artifact.live_summary.smoke_passed}/${artifact.live_summary.total_calls}`,
      `- ready_for_manual_review: ${artifact.live_summary.ready_for_manual_review}`,
    );
  }
  if (Array.isArray(artifact.live_results) && artifact.live_results.length) {
    lines.push('', '## Live Results');
    for (const result of artifact.live_results) {
      lines.push(`- ${result.profile_id}: ok=${result.ok}; status=${result.status}; elapsed_ms=${result.elapsed_ms}; token=${result.smoke_token_present}`);
      if (result.error) lines.push(`  - error: ${result.error}`);
    }
  }
  lines.push(
    '',
    '## Verdict Template',
    `- companion_chat: ${artifact.verdict.companion_chat}`,
    `- strict_tool_coding: ${artifact.verdict.strict_tool_coding}`,
    `- one_model_for_both_lanes: ${artifact.verdict.one_model_for_both_lanes}`,
    '',
  );
  return `${lines.join('\n')}\n`;
}

module.exports = {
  REQUIRED_PROFILE_FIELDS,
  PENNY_COMPARE_SCENARIOS,
  DEFAULT_LIVE_COMPARE_ENDPOINT,
  DEFAULT_QWEN_MODEL_ID,
  DEFAULT_GEMMA_MODEL_ID,
  validateModelProfileConfig,
  buildModelProfileCompareArtifact,
  runLiveModelProfileCompare,
  runLiveCompareModelCall,
  renderModelCompareMarkdown,
};
