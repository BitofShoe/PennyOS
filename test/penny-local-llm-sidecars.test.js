const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildLocalLlmAppRoadmap,
  findLocalLlmApp,
  REQUIRED_LOCAL_LLM_APP_BUCKETS,
} = require('../lib/penny-local-llm-app-catalog');
const {
  buildAllSidecarTrialContracts,
  buildSidecarTrialContract,
  createHomeEventSummaryCard,
  createResearchDigest,
  createRagAnswer,
  createTranscriptReview,
  createWorkflowToyFlow,
  createModelIdentityReceipt,
  createEvalScore,
  scoreSidecarTrialReport,
} = require('../lib/penny-sidecar-contracts');
const {
  buildSidecarDescriptorRegistry,
} = require('../lib/penny-sidecar-descriptors');
const {
  buildPatternProposal,
  proposalsFromRoadmap,
} = require('../lib/penny-sidecar-patterns');
const {
  normalizePromptTruth,
} = require('../lib/penny-prompttruth');

test('local LLM app roadmap includes all required buckets and keeps Penny as center', () => {
  const roadmap = buildLocalLlmAppRoadmap({ piDetected: true, generatedAt: '2026-05-11T12:00:00.000Z' });
  const bucketIds = roadmap.buckets.map((bucket) => bucket.bucket_id);

  assert.equal(roadmap.schema_version, 1);
  assert.equal(roadmap.penny_is_center, true);
  assert.equal(roadmap.sidecars_are_not_replacements, true);
  assert.deepEqual(bucketIds, REQUIRED_LOCAL_LLM_APP_BUCKETS);
  assert.ok(roadmap.do_not_add.some((item) => /replace Penny/i.test(item)));
  assert.ok(roadmap.safe_next_actions.some((item) => /Pi/i.test(item)));
});

test('roadmap marks core sidecars with safe priorities and no core replacement authority', () => {
  const roadmap = buildLocalLlmAppRoadmap({ piDetected: true });
  const pi = findLocalLlmApp(roadmap, 'Pi');
  const openWebui = findLocalLlmApp(roadmap, 'Open WebUI');
  const n8n = findLocalLlmApp(roadmap, 'n8n');
  const raglite = findLocalLlmApp(roadmap, 'RAGLite');
  const speaches = findLocalLlmApp(roadmap, 'Speaches');
  const llamaCpp = findLocalLlmApp(roadmap, 'llama.cpp');
  const promptfoo = findLocalLlmApp(roadmap, 'Promptfoo');

  assert.equal(pi.status, 'installed_or_present');
  assert.equal(pi.penny_core_status, 'operator_tool');
  assert.notEqual(pi.concrete_trial, 'install Pi from scratch');
  assert.equal(openWebui.penny_core_status, 'optional_sidecar');
  assert.match(openWebui.sidecar_boundary, /not.*replacement/i);
  assert.equal(n8n.bucket_id, 'workflow_automation');
  assert.equal(n8n.penny_core_status, 'optional_sidecar');
  assert.match(raglite.memory_policy, /review/i);
  assert.match(speaches.memory_policy, /transcript review/i);
  assert.equal(llamaCpp.default_permission_posture, 'read-only/status-only until an explicit operator trial');
  assert.equal(promptfoo.penny_core_status, 'eval_only');
});

test('roadmap represents every source-note app as unchecked and unapproved by default', () => {
  const roadmap = buildLocalLlmAppRoadmap({ piDetected: true });
  const sourceNoteApps = [
    'OpenCode',
    'Pi',
    'Aider',
    'aichat',
    'Fabric',
    'Open WebUI',
    'AnythingLLM',
    'Lobe Chat',
    'LibreChat',
    'Frigate',
    'Home Assistant',
    'n8n',
    'Windmill',
    'Activepieces',
    'SearXNG',
    'Local Deep Research',
    'Perplexica',
    'Morphic',
    'Paperless-ngx',
    'Kotaemon',
    'Onyx',
    'txtai',
    'RAGLite',
    'Qdrant',
    'Speaches',
    'openedai-speech',
    'faster-whisper-server',
    'Parler',
    'llama.cpp',
    'llama-swap',
    'Harbor',
    'vLLM',
    'SGLang',
    'Promptfoo',
    'lm-evaluation-harness',
    'Harbor Bench',
  ];

  for (const name of sourceNoteApps) {
    const item = findLocalLlmApp(roadmap, name);
    assert.ok(item, name);
    assert.equal(item.linked_project_license_checked, false, name);
    assert.equal(item.access_model, 'unchecked', name);
    assert.equal(item.approved_for_install, false, name);
    assert.equal(item.approved_for_core, false, name);
  }
});

test('sidecar trial contracts forbid risky authority by default', () => {
  const contracts = buildAllSidecarTrialContracts({ piDetected: true });
  const pi = buildSidecarTrialContract('Pi', { piDetected: true });
  const openCode = buildSidecarTrialContract('OpenCode');
  const openWebui = buildSidecarTrialContract('Open WebUI');
  const frigate = buildSidecarTrialContract('Frigate');
  const n8n = buildSidecarTrialContract('n8n');
  const searxng = buildSidecarTrialContract('SearXNG');
  const qdrant = buildSidecarTrialContract('Qdrant');
  const fasterWhisper = buildSidecarTrialContract('faster-whisper-server');
  const llamaSwap = buildSidecarTrialContract('llama-swap');

  assert.ok(contracts.length >= 30);
  for (const contract of contracts) {
    assert.equal(contract.memory_allowed, false, contract.app_id);
    assert.equal(contract.private_runtime_artifacts_allowed, false, contract.app_id);
    assert.equal(contract.public_action_allowed, false, contract.app_id);
    assert.equal(contract.destructive_actions_allowed, false, contract.app_id);
    assert.equal(contract.review_before_memory, true, contract.app_id);
  }
  assert.equal(pi.shell_allowed, true);
  assert.match(pi.inputs_allowed.join(' '), /disposable/i);
  assert.equal(openCode.shell_allowed, true);
  assert.match(openWebui.inputs_forbidden.join(' '), /Penny memory/i);
  assert.equal(frigate.camera_allowed, 'read_only_fixture_or_explicit_trial');
  assert.match(n8n.forbidden_integrations.join(' '), /email/i);
  assert.match(searxng.outputs_expected.join(' '), /citation/i);
  assert.match(qdrant.inputs_allowed.join(' '), /non-sensitive/i);
  assert.equal(fasterWhisper.ambient_capture_allowed, false);
  assert.equal(llamaSwap.default_model_change_allowed, false);
});

test('sidecar artifact schemas stay reviewable and cannot write Penny memory by default', () => {
  const home = createHomeEventSummaryCard({ source: 'frigate', summary: 'Fixture driveway event.' });
  const research = createResearchDigest({
    query: 'local endpoint compatibility',
    sidecar: 'SearXNG',
    sources: [{ title: 'Fixture', url: 'https://example.test', retrieved_at: '2026-05-11T12:00:00.000Z' }],
    claims: [{ claim: 'Fixture claim', source_indexes: [0] }],
  });
  const rag = createRagAnswer({
    workspace: 'fixture',
    question: 'What does the doc say?',
    answer: 'Fixture answer.',
    document_says: ['The document says this.'],
    model_infers: ['The model infers this.'],
  });
  const transcript = createTranscriptReview({ sidecar: 'faster-whisper-server', transcript: 'hello' });
  const flow = createWorkflowToyFlow({ app_id: 'n8n', output_path: 'tmp/sidecars/toy-flow.json' });
  const identity = createModelIdentityReceipt({ backend: 'llama_cpp', endpoint: 'http://127.0.0.1:8080/v1' });
  const evalScore = createEvalScore({ scenario_id: 'strict-tool', model_profile: 'qwen-local' });

  assert.equal(home.read_only, true);
  assert.equal(home.home_control_action, false);
  assert.equal(home.memory_write, false);
  assert.equal(research.memory_write, false);
  assert.equal(research.claims[0].verified, false);
  assert.equal(rag.memory_write, false);
  assert.equal(rag.memory_promotion_candidate, false);
  assert.deepEqual(rag.document_says, ['The document says this.']);
  assert.deepEqual(rag.model_infers, ['The model infers this.']);
  assert.equal(transcript.ambient_capture, false);
  assert.equal(transcript.reviewed, false);
  assert.equal(flow.dry_run, true);
  assert.match(flow.forbidden_integrations.join(' '), /webhook/i);
  assert.equal(identity.default_model_changed, false);
  assert.equal(identity.memory_changed, false);
  assert.equal(identity.qwen_thinking, 'unknown');
  assert.equal(evalScore.verdict, 'unknown');
});

test('trial scoring and descriptor registry are deterministic and descriptor-only', () => {
  const score = scoreSidecarTrialReport({
    app_id: 'Pi',
    status: 'smoke_tested',
    scores: {
      setup_friction: 4,
      local_endpoint_compatibility: 5,
      tool_coding_honesty: 4,
      source_citation_behavior: 3,
      data_boundary_clarity: 5,
      latency: 3,
      reliability: 4,
      failure_honesty: 5,
      cleanup_ease: 4,
      pattern_worth_stealing: 5,
      should_remain_sidecar: 5,
      danger_of_platformization: 1,
    },
  });
  const descriptors = buildSidecarDescriptorRegistry(buildLocalLlmAppRoadmap({ piDetected: true }));

  assert.equal(score.status, 'smoke_tested');
  assert.equal(score.total_score, 48);
  assert.equal(score.recommendation, 'pattern_mined');
  assert.ok(descriptors.descriptors.length >= 30);
  for (const descriptor of descriptors.descriptors) {
    assert.equal(descriptor.descriptor_only, true, descriptor.app_id);
    assert.equal(descriptor.live_adapter_enabled, false, descriptor.app_id);
    assert.equal(descriptor.writes_memory, false, descriptor.app_id);
    assert.equal(descriptor.public_action, false, descriptor.app_id);
  }
});

test('pattern proposals are inert and require review before promotion', () => {
  const proposal = buildPatternProposal({
    pattern_id: 'open-webui-model-picker',
    source_app: 'Open WebUI',
    source_bucket: 'local_lab_cockpit',
    pattern_name: 'Model picker ergonomics',
    pattern_to_steal: 'Per-chat model/provider settings.',
    penny_native_candidate: 'A clearer local lane/profile selector.',
  });
  const proposals = proposalsFromRoadmap(buildLocalLlmAppRoadmap({ piDetected: true }));

  assert.equal(proposal.status, 'proposed');
  assert.equal(proposal.requires_memory_change, false);
  assert.equal(proposal.requires_runtime_change, false);
  assert.equal(proposal.reviewed, false);
  assert.ok(proposals.some((item) => item.source_app === 'Open WebUI'));
  assert.ok(proposals.some((item) => /reviewable action queues/i.test(item.pattern_to_steal)));
});

test('sidecar outputs do not become PromptTruth or tool evidence by normalization', () => {
  const digest = createResearchDigest({
    query: 'fixture',
    sidecar: 'SearXNG',
    sources: [{ title: 'Fixture', url: 'https://example.test', retrieved_at: '2026-05-11T12:00:00.000Z' }],
    claims: [{ claim: 'Sidecar claim', source_indexes: [0] }],
  });
  const normalized = normalizePromptTruth({
    schema: 'penny-prompttruth.v1',
    sidecarResearchDigest: digest,
    toolEvidenceReceipt: { leaked: true },
    channels: {
      sidecarResearchDigest: {
        candidateCount: 99,
        renderedCount: 99,
        renderedClaims: [{ renderedClaimId: 'sidecar-claim', toolEvidenceReceipt: { leaked: true } }],
      },
      stableFacts: {
        state: 'no_candidate',
        candidateCount: 0,
        renderedCount: 0,
      },
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'sidecarResearchDigest'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized, 'toolEvidenceReceipt'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalized.channels, 'sidecarResearchDigest'), false);
  assert.equal(normalized.channels.stableFacts.renderedCount, 0);
});
