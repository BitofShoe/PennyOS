const {
  buildLocalLlmAppRoadmap,
  allApps,
  findLocalLlmApp,
} = require('./penny-local-llm-app-catalog');

const TRIAL_STATUSES = Object.freeze([
  'not_started',
  'configured',
  'smoke_tested',
  'evaluated',
  'rejected',
  'pattern_mined',
  'adopted_as_optional_sidecar',
  'deferred',
]);

const SCORING_DIMENSIONS = Object.freeze([
  'setup_friction',
  'local_endpoint_compatibility',
  'tool_coding_honesty',
  'source_citation_behavior',
  'data_boundary_clarity',
  'latency',
  'reliability',
  'failure_honesty',
  'cleanup_ease',
  'pattern_worth_stealing',
  'should_remain_sidecar',
  'danger_of_platformization',
]);

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanArray(values = [], fallback = []) {
  const source = Array.isArray(values) ? values : fallback;
  const out = [];
  const seen = new Set();
  for (const value of source) {
    const text = cleanText(value);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text);
  }
  return out;
}

function normalizeScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(5, Math.round(score)));
}

function normalizeSidecarName(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function defaultEndpointForApp(app = {}) {
  if (app.bucket_id === 'coding_operator') return 'http://127.0.0.1:1234/v1';
  if (app.bucket_id === 'local_lab_cockpit') return 'http://127.0.0.1:1234/v1';
  if (app.bucket_id === 'model_server_ops') return 'http://127.0.0.1:8080/v1';
  return '';
}

function modelSuggestionsForApp(app = {}) {
  if (app.bucket_id === 'coding_operator') return ['qwen-local-coding', 'gemma-local-tool'];
  if (app.bucket_id === 'local_lab_cockpit') return ['qwen-local', 'gemma-local'];
  if (app.bucket_id === 'model_server_ops') return ['qwen-local', 'gemma-local', 'embedding-local'];
  if (app.bucket_id === 'eval_cluster') return ['qwen-local', 'gemma-local'];
  return [];
}

function buildSidecarTrialContract(appName, options = {}) {
  const roadmap = options.roadmap || buildLocalLlmAppRoadmap({
    piDetected: options.piDetected === true,
    openCodeDetected: options.openCodeDetected === true,
  });
  const app = typeof appName === 'object' ? appName : findLocalLlmApp(roadmap, appName);
  if (!app) {
    throw new Error(`Unknown sidecar app: ${appName}`);
  }
  const normalizedName = normalizeSidecarName(app.display_name);
  const isCodingOperator = app.bucket_id === 'coding_operator';
  const isPiOrOpenCode = ['pi', 'opencode'].includes(normalizedName);
  const isHomeCamera = app.bucket_id === 'home_camera_event';
  const isAudio = app.bucket_id === 'audio_voice';
  const isModelOps = app.bucket_id === 'model_server_ops';
  const localEndpointRequired = ['coding_operator', 'local_lab_cockpit', 'model_server_ops', 'eval_cluster'].includes(app.bucket_id);
  const trial = {
    schema_version: 1,
    trial_id: `${app.app_id || normalizedName}-sidecar-trial`,
    app_id: app.display_name,
    bucket_id: app.bucket_id,
    trial_name: `${app.display_name} sidecar trial`,
    purpose: app.concrete_trial,
    local_endpoint_required: localEndpointRequired,
    endpoint_url_default: defaultEndpointForApp(app),
    model_profile_suggestions: modelSuggestionsForApp(app),
    setup_status: app.status === 'installed_or_present' ? 'installed' : 'unknown',
    status: 'not_started',
    inputs_allowed: cleanArray(app.allowed_inputs, ['non-sensitive fixture inputs']),
    inputs_forbidden: cleanArray(app.forbidden_inputs, ['Penny memory', 'private runtime artifacts', 'secrets']),
    outputs_expected: cleanArray(app.allowed_outputs, ['reviewable stdout/local artifact']),
    outputs_forbidden: cleanArray(app.forbidden_outputs, ['automatic memory write', 'public action']),
    memory_allowed: false,
    private_runtime_artifacts_allowed: false,
    shell_allowed: isPiOrOpenCode ? true : false,
    shell_scope: isPiOrOpenCode ? 'explicit disposable repo/worktree only' : 'forbidden by default',
    browser_allowed: false,
    camera_allowed: isHomeCamera ? 'read_only_fixture_or_explicit_trial' : false,
    home_control_allowed: false,
    email_allowed: false,
    public_network_allowed: app.bucket_id === 'local_research_search' ? 'explicit sidecar trial only' : false,
    public_action_allowed: false,
    writes_allowed: isPiOrOpenCode ? 'explicit disposable workspace only' : false,
    destructive_actions_allowed: false,
    ambient_capture_allowed: false,
    default_model_change_allowed: false,
    review_before_memory: true,
    cleanup_required: true,
    scoring_dimensions: [...SCORING_DIMENSIONS],
    pass_fail_checks: [
      'scope explicit before trial',
      'no Penny memory in input',
      'no private runtime artifacts in input',
      'no default model/runtime prompt/context change',
      'outputs are review artifacts only',
      'cleanup recorded',
    ],
    evidence_to_capture: [
      'config used',
      'endpoint/model id',
      'inputs supplied',
      'outputs generated',
      'files changed if any',
      'tests run if any',
      'failures and refusals',
      'cleanup actions',
    ],
    skip_conditions: cleanArray(app.skip_conditions, ['sidecar absent', 'endpoint absent']),
    forbidden_integrations: [
      'email',
      'cloud webhooks',
      'public posting',
      'home control',
      'browser history',
      'Penny memory',
      'private runtime artifacts',
    ],
    memory_policy: app.memory_policy,
    privacy_notes: app.privacy_notes,
    sidecar_boundary: app.sidecar_boundary,
  };
  if (app.bucket_id === 'local_lab_cockpit') {
    trial.inputs_forbidden = cleanArray([
      ...trial.inputs_forbidden,
      'Penny memory import',
      'private runtime artifact upload',
      'personal documents by default',
      'auto-ingest knowledge base',
    ]);
    trial.outputs_expected = cleanArray([...trial.outputs_expected, 'model/RAG/tool visibility notes']);
  }
  if (app.bucket_id === 'local_research_search') {
    trial.outputs_expected = cleanArray([...trial.outputs_expected, 'citation-first digest', 'unknown/not-verified list']);
  }
  if (app.bucket_id === 'document_rag_workspace') {
    trial.outputs_expected = cleanArray([...trial.outputs_expected, 'RAG answer with provenance']);
  }
  if (app.bucket_id === 'workflow_automation') {
    trial.outputs_expected = cleanArray([...trial.outputs_expected, 'dry-run action queue or local disposable output']);
  }
  if (isAudio) {
    trial.inputs_allowed = cleanArray([...trial.inputs_allowed, 'explicit recording only']);
    trial.outputs_expected = cleanArray([...trial.outputs_expected, 'reviewable transcript or TTS quality note']);
  }
  if (isModelOps) {
    trial.outputs_expected = cleanArray([...trial.outputs_expected, 'model identity receipt']);
  }
  return trial;
}

function buildAllSidecarTrialContracts(options = {}) {
  const roadmap = options.roadmap || buildLocalLlmAppRoadmap({
    piDetected: options.piDetected === true,
    openCodeDetected: options.openCodeDetected === true,
  });
  return allApps(roadmap).map((item) => buildSidecarTrialContract(item, { roadmap }));
}

function recommendedFirstTrial(options = {}) {
  const pi = buildSidecarTrialContract('Pi', options);
  return {
    schema_version: 1,
    recommended_trial_id: pi.trial_id,
    app_id: pi.app_id,
    reason: 'Pi is the first coding/operator sidecar candidate; run it in a disposable repo against an explicit local Qwen profile.',
    command: 'npm run penny:pi:trial -- --repo <disposable-repo-path> --model qwen-local-coding --dry-run',
  };
}

function createHomeEventSummaryCard({
  source = 'fixture',
  generated_at = new Date().toISOString(),
  summary = '',
  events = [],
  source_receipts = [],
  privacy_warnings = [],
} = {}) {
  return {
    schema_version: 1,
    source,
    generated_at,
    read_only: true,
    home_control_action: false,
    camera_history_persisted: false,
    summary: cleanText(summary, 'No event summary provided.'),
    events: Array.isArray(events) ? events : [],
    source_receipts: Array.isArray(source_receipts) ? source_receipts : [],
    privacy_warnings: cleanArray(privacy_warnings),
    memory_write: false,
    requires_user_review: true,
  };
}

function createResearchDigest({
  query = '',
  generated_at = new Date().toISOString(),
  sidecar = 'unknown',
  sources = [],
  summary = '',
  claims = [],
  unknowns = [],
} = {}) {
  const normalizedSources = (Array.isArray(sources) ? sources : []).map((source) => ({
    title: cleanText(source.title, 'Untitled source'),
    url: cleanText(source.url, ''),
    retrieved_at: cleanText(source.retrieved_at, generated_at),
    source_type: cleanText(source.source_type, 'web'),
    confidence: cleanText(source.confidence, 'unknown'),
  }));
  return {
    schema_version: 1,
    query: cleanText(query),
    generated_at,
    sidecar,
    sources: normalizedSources,
    summary: cleanText(summary, normalizedSources.length ? 'Review source list before drawing conclusions.' : 'No verified sources supplied.'),
    claims: (Array.isArray(claims) ? claims : []).map((claim) => ({
      claim: cleanText(claim.claim),
      source_indexes: Array.isArray(claim.source_indexes) ? claim.source_indexes : [],
      confidence: cleanText(claim.confidence, 'unknown'),
      verified: claim.verified === true,
    })),
    unknowns: cleanArray(unknowns),
    memory_write: false,
    requires_review: true,
  };
}

function createRagAnswer({
  workspace = '',
  question = '',
  answer = '',
  document_citations = [],
  document_says = [],
  model_infers = [],
} = {}) {
  return {
    schema_version: 1,
    workspace: cleanText(workspace, 'fixture'),
    question: cleanText(question),
    answer: cleanText(answer),
    document_citations: (Array.isArray(document_citations) ? document_citations : []).map((citation) => ({
      doc_id: cleanText(citation.doc_id),
      title: cleanText(citation.title),
      chunk_id: cleanText(citation.chunk_id),
      quote_or_snippet: cleanText(citation.quote_or_snippet),
      confidence: cleanText(citation.confidence, 'unknown'),
    })),
    document_says: cleanArray(document_says),
    model_infers: cleanArray(model_infers),
    memory_promotion_candidate: false,
    memory_write: false,
    requires_review: true,
  };
}

function createTranscriptReview({
  sidecar = 'unknown',
  audio_source = 'fixture',
  transcript = '',
  confidence = 'unknown',
  latency_ms = null,
  quality_notes = [],
} = {}) {
  const latency = Number(latency_ms);
  return {
    schema_version: 1,
    sidecar,
    audio_source,
    ambient_capture: false,
    transcript: cleanText(transcript),
    confidence,
    reviewed: false,
    memory_write: false,
    tts_output_generated: false,
    latency_ms: Number.isFinite(latency) ? latency : null,
    quality_notes: cleanArray(quality_notes),
    requires_review: true,
  };
}

function createWorkflowToyFlow({
  flow_id = 'toy-local-summary',
  app_id = 'n8n',
  input_kind = 'text_fixture',
  model_endpoint = 'http://127.0.0.1:1234/v1',
  output_path = '',
  dry_run = true,
} = {}) {
  return {
    schema_version: 1,
    flow_id,
    app_id,
    local_only: true,
    input_kind,
    model_endpoint,
    output_path,
    dry_run: dry_run !== false,
    side_effect_label: output_path ? 'local_disposable_file_write_if_explicit' : 'stdout_only',
    user_review_required: true,
    forbidden_integrations: ['email', 'cloud webhook', 'public posting', 'home control', 'cron autonomy'],
    cleanup: output_path ? `Delete disposable output if not needed: ${output_path}` : 'No output file requested.',
  };
}

function createModelIdentityReceipt({
  generated_at = new Date().toISOString(),
  backend = 'unknown',
  endpoint = '',
  loaded_model_id = '',
  resolved_model_id = '',
  quant = 'unknown',
  context_length = null,
  chat_template = 'unknown',
  supports_chat_completions = 'unknown',
  supports_tool_calls = 'unknown',
  supports_developer_role = 'unknown',
  supports_reasoning_effort = 'unknown',
  qwen_thinking = 'unknown',
  vision = 'unknown',
  recommendations = [],
} = {}) {
  return {
    schema_version: 1,
    generated_at,
    backend,
    endpoint,
    loaded_model_id,
    resolved_model_id,
    quant,
    context_length,
    chat_template,
    supports_chat_completions,
    supports_tool_calls,
    supports_developer_role,
    supports_reasoning_effort,
    qwen_thinking: ['off', 'on', 'unknown'].includes(qwen_thinking) ? qwen_thinking : 'unknown',
    vision,
    default_model_changed: false,
    memory_changed: false,
    recommendations: cleanArray(recommendations),
  };
}

function createEvalScore({
  scenario_id = '',
  model_profile = '',
  output_summary = '',
  scores = {},
  regressions = [],
  artifact_paths = [],
  verdict = 'unknown',
} = {}) {
  return {
    schema_version: 1,
    scenario_id,
    model_profile,
    output_summary,
    scores: {
      instruction_following: scores.instruction_following ?? null,
      honesty: scores.honesty ?? null,
      tool_use: scores.tool_use ?? null,
      source_pressure: scores.source_pressure ?? null,
      companion_fit: scores.companion_fit ?? null,
      latency: scores.latency ?? null,
    },
    regressions: cleanArray(regressions),
    artifact_paths: cleanArray(artifact_paths),
    verdict: ['pass', 'fail', 'mixed', 'unknown'].includes(verdict) ? verdict : 'unknown',
  };
}

function scoreSidecarTrialReport(report = {}) {
  const scores = {};
  let total = 0;
  let count = 0;
  for (const dimension of SCORING_DIMENSIONS) {
    const normalized = normalizeScore(report?.scores?.[dimension]);
    scores[dimension] = normalized;
    if (normalized !== null) {
      total += normalized;
      count += 1;
    }
  }
  const platformizationDanger = scores.danger_of_platformization ?? 5;
  let recommendation = 'deferred';
  if (count >= 8 && total >= 42 && platformizationDanger <= 2) recommendation = 'pattern_mined';
  if (count >= 8 && total >= 48 && platformizationDanger <= 1 && report.status === 'evaluated') recommendation = 'adopted_as_optional_sidecar';
  if (platformizationDanger >= 4) recommendation = 'rejected';
  return {
    schema_version: 1,
    app_id: cleanText(report.app_id, 'unknown'),
    status: TRIAL_STATUSES.includes(report.status) ? report.status : 'not_started',
    scores,
    scored_dimensions: count,
    total_score: total,
    recommendation,
    memory_write: false,
    runtime_changed: false,
    default_model_changed: false,
  };
}

function renderContractMarkdown(contract) {
  const lines = [
    `# ${contract.app_id} Sidecar Trial Contract`,
    '',
    `Trial: ${contract.trial_id}`,
    '',
    `Purpose: ${contract.purpose}`,
    '',
    '## Boundaries',
    `- Memory allowed: ${contract.memory_allowed}`,
    `- Private runtime artifacts allowed: ${contract.private_runtime_artifacts_allowed}`,
    `- Shell allowed: ${contract.shell_allowed} (${contract.shell_scope})`,
    `- Writes allowed: ${contract.writes_allowed}`,
    `- Public actions allowed: ${contract.public_action_allowed}`,
    `- Cleanup required: ${contract.cleanup_required}`,
    '',
    '## Inputs Allowed',
    ...contract.inputs_allowed.map((item) => `- ${item}`),
    '',
    '## Inputs Forbidden',
    ...contract.inputs_forbidden.map((item) => `- ${item}`),
    '',
    '## Evidence To Capture',
    ...contract.evidence_to_capture.map((item) => `- ${item}`),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  TRIAL_STATUSES,
  SCORING_DIMENSIONS,
  buildSidecarTrialContract,
  buildAllSidecarTrialContracts,
  recommendedFirstTrial,
  createHomeEventSummaryCard,
  createResearchDigest,
  createRagAnswer,
  createTranscriptReview,
  createWorkflowToyFlow,
  createModelIdentityReceipt,
  createEvalScore,
  scoreSidecarTrialReport,
  renderContractMarkdown,
};
