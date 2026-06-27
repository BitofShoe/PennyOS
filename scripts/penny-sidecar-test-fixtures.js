const path = require('node:path');

const {
  buildLocalLlmAppRoadmap,
} = require('../lib/penny-local-llm-app-catalog');
const {
  buildSidecarTrialContract,
  createHomeEventSummaryCard,
  createResearchDigest,
  createRagAnswer,
  createTranscriptReview,
  createWorkflowToyFlow,
  createModelIdentityReceipt,
  createEvalScore,
} = require('../lib/penny-sidecar-contracts');
const {
  buildSidecarDescriptorRegistry,
} = require('../lib/penny-sidecar-descriptors');
const {
  proposalsFromRoadmap,
} = require('../lib/penny-sidecar-patterns');
const {
  buildModelProfileCompareArtifact,
} = require('../lib/penny-model-profile-compare');
const {
  buildTrialDryRun,
} = require('./penny-operator-sidecar');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:sidecar:test-fixtures - deterministic sidecar fixture bundle

Usage:
  npm run penny:sidecar:test-fixtures
  npm run penny:sidecar:test-fixtures -- --out output/local-llm-sidecar-fixtures.json

This writes only when --out is provided. Fixtures are non-live and non-sensitive.
`;
}

function buildFixtureBundle() {
  const roadmap = buildLocalLlmAppRoadmap({ piDetected: true, generatedAt: '2026-05-11T12:00:00.000Z' });
  return {
    schema_version: 1,
    artifact_kind: 'penny-local-llm-sidecar-fixtures',
    generated_at: roadmap.generated_at,
    live_model_calls: false,
    memory_write: false,
    runtime_changed: false,
    roadmap,
    pi_trial_contract: buildSidecarTrialContract('Pi', { roadmap }),
    pi_disposable_repo_trial_dry_run: buildTrialDryRun({
      app: 'Pi',
      repo: 'tmp/sidecars/pi-disposable-trial',
      model: 'qwen-local-coding',
      commandStatus: { present: true, command_path: '/home/example/.local/bin/pi', version: '0.74.0' },
      endpointArtifact: {
        endpoint: 'http://127.0.0.1:1234/v1',
        health_status: 'available',
        backend_family: 'llama_cpp_or_lm_studio',
        loaded_models: ['unsloth/qwen3.6-35b-a3b@ud-q4_k_xl'],
        resolved_model_id: 'unsloth/qwen3.6-35b-a3b@ud-q4_k_xl',
      },
    }),
    openwebui_trial_contract: buildSidecarTrialContract('Open WebUI', { roadmap }),
    descriptor_registry: buildSidecarDescriptorRegistry(roadmap),
    pattern_proposals: proposalsFromRoadmap(roadmap).slice(0, 12),
    home_event_card: createHomeEventSummaryCard({ source: 'fixture', summary: 'Fixture event only.' }),
    research_digest: createResearchDigest({
      query: 'fixture local endpoint docs',
      sidecar: 'SearXNG',
      sources: [{ title: 'Fixture source', url: 'https://example.test/local-endpoint', retrieved_at: roadmap.generated_at }],
      claims: [{ claim: 'Fixture claims require review.', source_indexes: [0] }],
    }),
    rag_answer: createRagAnswer({
      workspace: 'fixture',
      question: 'What does the fixture doc say?',
      answer: 'The fixture answer is reviewable only.',
      document_says: ['Fixture document statement.'],
      model_infers: ['Fixture inference statement.'],
    }),
    transcript_review: createTranscriptReview({ sidecar: 'faster-whisper-server', transcript: 'fixture transcript' }),
    workflow_toy_flow: createWorkflowToyFlow({ app_id: 'n8n' }),
    model_identity_receipt: createModelIdentityReceipt({ backend: 'llama_cpp', endpoint: 'http://127.0.0.1:8080/v1' }),
    eval_score: createEvalScore({ scenario_id: 'strict-instruction-following', model_profile: 'qwen-local' }),
    compare_artifact: buildModelProfileCompareArtifact({
      generatedAt: roadmap.generated_at,
      profiles: [
        {
          profile_id: 'qwen-local',
          display_name: 'Qwen local coding candidate',
          model_id: '<resolved-qwen-model-id>',
          backend_family: 'llama_cpp_or_lm_studio',
          endpoint: 'http://127.0.0.1:1234/v1',
          quant: 'requires_check',
          thinking: 'explicit_only',
          developer_role: 'requires_check',
          reasoning_effort: 'requires_check',
        },
        {
          profile_id: 'gemma-local',
          display_name: 'Gemma local companion candidate',
          model_id: '<resolved-gemma-model-id>',
          backend_family: 'lm_studio_or_llama_cpp',
          endpoint: 'http://127.0.0.1:1234/v1',
          quant: 'requires_check',
          thinking: 'off',
          developer_role: 'requires_check',
          reasoning_effort: 'requires_check',
        },
      ],
    }),
  };
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = buildFixtureBundle();
  const out = argValue(args, 'out');
  if (out) writeFileIfRequested(out, `${JSON.stringify(payload, null, 2)}\n`);
  if (hasFlag(args, 'json') || !out) printJson(payload);
  else printText(`Wrote ${path.resolve(process.cwd(), out)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  }
}

module.exports = {
  buildFixtureBundle,
  main,
};
