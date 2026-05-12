const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const {
  evaluateSectionCompletionMatrix,
} = require('../lib/penny-sidecar-section-completion');
const {
  normalizeSearxngJsonSources,
  buildResearchDigest,
  probeReadOnlyHttpEndpoints,
  homeCameraTrial,
  runOpenWebuiMockModelTrial,
  runN8nLiveWorkflowTrial,
  runQdrantLiveWriteTrial,
  requestSpeachesJson,
  runSpeachesTtsLiveTrial,
} = require('../lib/penny-sidecar-trials');

const ROOT = path.resolve(__dirname, '..');
const TMP = path.join(ROOT, 'tmp', 'sidecar-section-tests');

function runScript(script, args = []) {
  return execFileSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function baseSection(sectionId, status = 'HARNESS_VERIFIED') {
  return {
    section_id: sectionId,
    title: `Section ${sectionId}`,
    section_title: `Section ${sectionId}`,
    chosen_primary_app: `App ${sectionId}`,
    primary_app: `App ${sectionId}`,
    candidate_apps: [`App ${sectionId}`],
    availability_probe_command: `node scripts/section-${sectionId}.js --live-probe`,
    availability_result: 'not_found',
    status,
    harness_status: status === 'LIVE_VERIFIED' ? 'not_present' : 'HARNESS_VERIFIED',
    runnable_trial_command: `node scripts/section-${sectionId}.js --fixture`,
    artifact_path: `artifacts/sidecar-trials/section-${sectionId}.json`,
    artifact_schema: `penny-sidecar-section-${sectionId}.v1`,
    test_command: `node --test test/section-${sectionId}.test.js`,
    tests_added_or_updated: [`test/section-${sectionId}.test.js`],
    live_app_found: status === 'LIVE_VERIFIED',
    harness_ran: status !== 'LIVE_VERIFIED',
    recommended_next_live_command: `SECTION=${sectionId} npm run penny:sidecar:example -- --live-probe`,
    no_memory_write_proof: 'artifact memory flags are false',
    no_runtime_change_proof: 'artifact runtime_changed=false',
    no_default_model_change_proof: 'artifact default_model_changed=false',
    no_prompttruth_merge_proof: 'artifact prompttruth_changed=false',
    no_public_or_home_action_proof: 'artifact action flags are false',
    exact_files_changed: [`scripts/section-${sectionId}.js`],
    exact_evidence: [`section ${sectionId} artifact generated`],
    proof: {
      no_memory_write: true,
      no_runtime_change: true,
      no_default_model_change: true,
      no_prompttruth_merge: true,
      no_public_or_home_action: true,
    },
    files_changed: [`scripts/section-${sectionId}.js`],
    evidence: [`section ${sectionId} artifact generated`],
  };
}

function matrixWith(status = 'HARNESS_VERIFIED') {
  return {
    schema_version: 1,
    generated_at: '2026-05-11T12:00:00.000Z',
    project: 'Penny Local LLM Sidecar Section Completion Gate',
    required_sections: [2, 3, 4, 5, 6, 7],
    sections: [2, 3, 4, 5, 6, 7].map((sectionId) => baseSection(sectionId, status)),
  };
}

test('completion gate passes all sections when every section is LIVE_VERIFIED', () => {
  const result = evaluateSectionCompletionMatrix(matrixWith('LIVE_VERIFIED'));

  assert.equal(result.all_required_sections_complete, true);
  assert.equal(result.summary.live_verified, 6);
  assert.equal(result.summary.failing, 0);
  assert.deepEqual(result.failures, []);
});

test('completion gate passes all sections when every section is HARNESS_VERIFIED', () => {
  const result = evaluateSectionCompletionMatrix(matrixWith('HARNESS_VERIFIED'));

  assert.equal(result.all_required_sections_complete, true);
  assert.equal(result.summary.harness_verified, 6);
  assert.equal(result.summary.failing, 0);
});

test('completion gate validates the checked section-completion matrix for sections 2-7 only', () => {
  const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts', 'sidecar-trials', 'section-completion-matrix.json'), 'utf8'));
  const result = evaluateSectionCompletionMatrix(matrix);

  assert.deepEqual(matrix.required_sections, [2, 3, 4, 5, 6, 7]);
  assert.equal(matrix.required_sections.includes(1), false);
  assert.equal(matrix.required_sections.includes(8), false);
  assert.equal(matrix.required_sections.includes(9), false);
  assert.equal(result.all_required_sections_complete, true);
  assert.equal(
    result.summary.live_verified,
    matrix.sections.filter((section) => section.status === 'LIVE_VERIFIED').length,
  );
  assert.equal(
    result.summary.harness_verified,
    matrix.sections.filter((section) => section.status === 'HARNESS_VERIFIED').length,
  );
  assert.equal(result.summary.failing, 0);
  assert.deepEqual(result.failures, []);
});

test('checked section artifacts parse and match matrix schema/status claims', () => {
  const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts', 'sidecar-trials', 'section-completion-matrix.json'), 'utf8'));

  for (const section of matrix.sections) {
    const artifact = JSON.parse(fs.readFileSync(path.join(ROOT, section.artifact_path), 'utf8'));
    assert.equal(artifact.schema_version, 1, section.artifact_path);
    assert.equal(artifact.artifact_schema, section.artifact_schema, section.artifact_path);
    assert.equal(artifact.section_id, section.section_id, section.artifact_path);
    assert.equal(artifact.status, section.status, section.artifact_path);
    assert.equal(artifact.runtime_changed, false, section.artifact_path);
    assert.equal(artifact.default_model_changed, false, section.artifact_path);
    assert.equal(artifact.prompttruth_changed, false, section.artifact_path);
  }
});

test('completion gate fails section 2 DOC_ONLY status', () => {
  const matrix = matrixWith('HARNESS_VERIFIED');
  matrix.sections[0].status = 'DOC_ONLY';

  const result = evaluateSectionCompletionMatrix(matrix);

  assert.equal(result.all_required_sections_complete, false);
  assert.equal(result.summary.doc_only, 1);
  assert.match(result.failures.join('\n'), /section 2.*DOC_ONLY/i);
});

test('completion gate fails section 3 REPRESENTED_ONLY status', () => {
  const matrix = matrixWith('HARNESS_VERIFIED');
  matrix.sections[1].status = 'REPRESENTED_ONLY';

  const result = evaluateSectionCompletionMatrix(matrix);

  assert.equal(result.all_required_sections_complete, false);
  assert.equal(result.summary.represented_only, 1);
  assert.match(result.failures.join('\n'), /section 3.*REPRESENTED_ONLY/i);
});

test('completion gate fails INSTALL_BLOCKED without harness verification', () => {
  const matrix = matrixWith('HARNESS_VERIFIED');
  matrix.sections[2].status = 'INSTALL_BLOCKED';
  matrix.sections[2].harness_status = 'not_present';

  const result = evaluateSectionCompletionMatrix(matrix);

  assert.equal(result.all_required_sections_complete, false);
  assert.equal(result.summary.failing, 1);
  assert.match(result.failures.join('\n'), /section 4.*INSTALL_BLOCKED/i);
});

test('completion gate fails missing runnable trial command, artifact path, and no-mutation proof', () => {
  const matrix = matrixWith('HARNESS_VERIFIED');
  matrix.sections[0].runnable_trial_command = '';
  matrix.sections[1].artifact_path = '';
  matrix.sections[2].proof.no_memory_write = false;

  const result = evaluateSectionCompletionMatrix(matrix);

  assert.equal(result.all_required_sections_complete, false);
  assert.match(result.failures.join('\n'), /section 2.*runnable_trial_command/i);
  assert.match(result.failures.join('\n'), /section 3.*artifact_path/i);
  assert.match(result.failures.join('\n'), /section 4.*no_memory_write/i);
});

test('completion gate summary accurately counts mixed statuses', () => {
  const matrix = matrixWith('HARNESS_VERIFIED');
  matrix.sections[0].status = 'LIVE_VERIFIED';
  matrix.sections[0].harness_status = 'not_present';
  matrix.sections[1].status = 'INSTALL_BLOCKED';
  matrix.sections[1].harness_status = 'HARNESS_VERIFIED';
  matrix.sections[2].status = 'NOT_DONE';

  const result = evaluateSectionCompletionMatrix(matrix);

  assert.equal(result.summary.live_verified, 1);
  assert.equal(result.summary.harness_verified, 3);
  assert.equal(result.summary.install_blocked_with_harness, 1);
  assert.equal(result.summary.not_done, 1);
  assert.equal(result.summary.failing, 1);
});

test('section 2 lab cockpit fixture artifact is runnable and keeps Penny as owner', () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  const artifact = path.join(TMP, 'section-2-lab.json');
  const output = runScript('scripts/penny-lab-cockpit-trial.js', ['--fixture', '--json', '--artifact-out', artifact]);
  const parsed = JSON.parse(output);
  const written = JSON.parse(fs.readFileSync(artifact, 'utf8'));

  assert.equal(parsed.status, 'HARNESS_VERIFIED');
  assert.equal(written.artifact_schema, 'penny-sidecar-section-2-lab-cockpit.v1');
  assert.equal(written.penny_replacement, false);
  assert.equal(written.memory_imported, false);
  assert.equal(written.memory_write, false);
  assert.equal(written.runtime_changed, false);
  assert.equal(written.default_model_changed, false);
  assert.equal(written.trial.model_picker_checked, true);
  assert.equal(written.trial.rag_visibility_checked, true);
  assert.equal(written.trial.artifact_panel_pattern_checked, true);
});

test('section 2 Open WebUI mock model trial routes toy prompt without Penny changes', () => {
  const calls = [];
  const result = runOpenWebuiMockModelTrial({
    run: true,
    found: true,
    openWebuiBaseUrl: 'http://openwebui.test',
    mockOpenAiBaseUrl: 'http://mock-openai.test/v1',
    openWebuiAuthToken: 'jwt-for-disposable-test',
    requestJson: (request) => {
      calls.push(request);
      if (request.baseUrl === 'http://openwebui.test') {
        assert.equal(request.headers.Authorization, 'Bearer jwt-for-disposable-test');
      }
      if (request.baseUrl === 'http://mock-openai.test/v1' && request.pathSuffix === '/models') {
        return { ok: true, status_code: 200, json: { data: [{ id: 'penny-sidecar-toy-model' }] } };
      }
      if (request.baseUrl === 'http://mock-openai.test/v1' && request.pathSuffix === '/chat/completions') {
        return { ok: true, status_code: 200, json: { choices: [{ message: { content: 'mock endpoint reply' } }] } };
      }
      if (request.baseUrl === 'http://openwebui.test' && request.pathSuffix === '/api/models') {
        return { ok: true, status_code: 200, json: { data: [{ id: 'penny-sidecar-toy-model' }] } };
      }
      if (request.baseUrl === 'http://openwebui.test' && request.pathSuffix === '/api/chat/completions') {
        return { ok: true, status_code: 200, json: { choices: [{ message: { content: 'mock endpoint reply via Open WebUI' } }] } };
      }
      return { ok: false, status_code: 404, sample: 'not found' };
    },
  });

  assert.equal(result.ran, true);
  assert.equal(result.direct_mock_models_ran, true);
  assert.equal(result.direct_mock_chat_ran, true);
  assert.equal(result.openwebui_models_checked, true);
  assert.equal(result.openwebui_model_visible, true);
  assert.equal(result.openwebui_chat_routed, true);
  assert.equal(result.toy_response_seen, true);
  assert.equal(result.live_lmstudio_used, false);
  assert.equal(result.penny_ui_replaced, false);
  assert.equal(result.memory_imported, false);
  assert.equal(result.private_runtime_artifacts_uploaded, false);
  assert.equal(result.memory_write, false);
  assert.equal(result.runtime_changed, false);
  assert.equal(result.default_model_changed, false);
  assert.equal(result.prompttruth_changed, false);
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.baseUrl}${call.pathSuffix}`),
    [
      'GET http://mock-openai.test/v1/models',
      'POST http://mock-openai.test/v1/chat/completions',
      'GET http://mock-openai.test/v1/stats',
      'GET http://openwebui.test/api/models',
      'POST http://openwebui.test/api/chat/completions',
    ],
  );
});

test('section 2 Open WebUI mock model trial accepts async route proof from mock stats', () => {
  let statsCalls = 0;
  const result = runOpenWebuiMockModelTrial({
    run: true,
    found: true,
    openWebuiBaseUrl: 'http://openwebui.test',
    mockOpenAiBaseUrl: 'http://mock-openai.test/v1',
    requestJson: (request) => {
      if (request.baseUrl === 'http://mock-openai.test/v1' && request.pathSuffix === '/models') {
        return { ok: true, status_code: 200, json: { data: [{ id: 'penny-sidecar-toy-model' }] } };
      }
      if (request.baseUrl === 'http://mock-openai.test/v1' && request.pathSuffix === '/chat/completions') {
        return { ok: true, status_code: 200, json: { choices: [{ message: { content: 'mock endpoint reply' } }] } };
      }
      if (request.baseUrl === 'http://mock-openai.test/v1' && request.pathSuffix === '/stats') {
        statsCalls += 1;
        return { ok: true, status_code: 200, json: { chat_requests: statsCalls === 1 ? 1 : 2 } };
      }
      if (request.baseUrl === 'http://openwebui.test' && request.pathSuffix === '/api/models') {
        return { ok: true, status_code: 200, json: { data: [{ id: 'penny-sidecar-toy-model' }] } };
      }
      if (request.baseUrl === 'http://openwebui.test' && request.pathSuffix === '/api/chat/completions') {
        return { ok: true, status_code: 200, json: { status: true, task_ids: ['toy-task'], chat_id: 'toy-chat' } };
      }
      return { ok: false, status_code: 404, sample: 'not found' };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.toy_response_seen, false);
  assert.equal(result.openwebui_chat_reached_mock, true);
  assert.equal(result.openwebui_chat_routed, true);
  assert.equal(result.mock_chat_requests_before_openwebui, 1);
  assert.equal(result.mock_chat_requests_after_openwebui, 2);
  assert.equal(result.live_lmstudio_used, false);
  assert.equal(result.memory_write, false);
});

test('section 3 home/camera event fixture artifact is read-only and review-gated', () => {
  const artifact = path.join(TMP, 'section-3-home-camera.json');
  const output = runScript('scripts/penny-home-camera-event-trial.js', ['--fixture', '--json', '--artifact-out', artifact]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, 'HARNESS_VERIFIED');
  assert.equal(parsed.artifact_schema, 'penny-sidecar-section-3-home-camera.v1');
  assert.equal(parsed.event_summary_card.home_control_action, false);
  assert.equal(parsed.event_summary_card.camera_history_persisted, false);
  assert.equal(parsed.event_summary_card.ambient_capture, false);
  assert.equal(parsed.event_summary_card.memory_write, false);
  assert.equal(parsed.event_summary_card.requires_user_review, true);
  assert.ok(parsed.event_summary_card.source_labels.length > 0);
});

test('section 3 read-only endpoint probe records auth blockers without unsafe actions', () => {
  const result = probeReadOnlyHttpEndpoints({
    run: true,
    urls: ['http://homeassistant.test/api/'],
    requestStatus: () => ({ ok: false, status_code: 401, sample: 'Unauthorized' }),
    windowsRequestStatus: () => ({ ok: false, status_code: 401, sample: 'Unauthorized' }),
  });

  assert.equal(result.ran, true);
  assert.equal(result.found, false);
  assert.equal(result.blocked_by_auth, true);
  assert.equal(result.read_only_endpoints_only, true);
  assert.equal(result.streams_requested, false);
  assert.equal(result.camera_history_requested, false);
  assert.equal(result.home_control_action, false);
  assert.equal(result.service_call_requested, false);
});

test('section 3 home/camera trial can live-verify configured Home Assistant health without controls', () => {
  const result = homeCameraTrial({
    liveProbe: true,
    frigateBaseUrl: 'http://frigate.test',
    homeAssistantBaseUrl: 'http://homeassistant.test',
    readOnlyProbe: ({ urls }) => {
      const isHomeAssistant = urls.some((url) => url.startsWith('http://homeassistant.test'));
      return {
        ran: true,
        found: isHomeAssistant,
        blocked_by_auth: false,
        details: urls.map((url) => ({
          url,
          checked: true,
          wsl: { ok: isHomeAssistant, status_code: isHomeAssistant ? 200 : 0 },
          windows: { ok: isHomeAssistant, status_code: isHomeAssistant ? 200 : 0 },
        })),
        docker_containers: [],
        env_hits: [],
        read_only_endpoints_only: true,
        streams_requested: false,
        camera_history_requested: false,
        home_control_action: false,
        service_call_requested: false,
      };
    },
  });

  assert.equal(result.status, 'LIVE_VERIFIED');
  assert.equal(result.primary_app, 'Home Assistant health probe');
  assert.equal(result.live_probe.home_assistant.found, true);
  assert.equal(result.live_probe.home_assistant.blocked_by_auth, false);
  assert.equal(result.live_probe.home_assistant.streams_requested, false);
  assert.equal(result.event_summary_card.home_control_action, false);
  assert.equal(result.event_summary_card.camera_history_persisted, false);
  assert.equal(result.event_summary_card.ambient_capture, false);
  assert.equal(result.event_summary_card.memory_write, false);
  assert.match(result.recommended_next_live_command, /--home-assistant-base-url http:\/\/homeassistant\.test/);
});

test('section 4 workflow toy-flow fixture artifact has no external action paths', () => {
  const artifact = path.join(TMP, 'section-4-workflow.json');
  const output = runScript('scripts/penny-workflow-sidecar-trial.js', ['--fixture', '--json', '--artifact-out', artifact]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, 'HARNESS_VERIFIED');
  assert.equal(parsed.artifact_schema, 'penny-sidecar-section-4-workflow.v1');
  assert.equal(parsed.toy_flow.dry_run, true);
  assert.equal(parsed.toy_flow.local_only, true);
  assert.equal(parsed.toy_flow.email_used, false);
  assert.equal(parsed.toy_flow.webhook_used, false);
  assert.equal(parsed.toy_flow.cloud_used, false);
  assert.equal(parsed.toy_flow.public_action, false);
  assert.equal(parsed.toy_flow.home_or_system_action, false);
  assert.equal(parsed.toy_flow.cron_or_schedule, false);
  assert.ok(parsed.toy_flow.side_effect_labels.length > 0);
});

test('section 4 n8n live workflow trial imports a local-only manual workflow without external actions', () => {
  const calls = [];
  const result = runN8nLiveWorkflowTrial({
    run: true,
    found: true,
    containerName: 'penny-n8n-unit',
    docker: (args) => {
      calls.push(args);
      if (args.includes('import:workflow')) return 'Successfully imported 1 workflow.';
      if (args.includes('export:workflow')) return 'Successfully exported 1 workflow.';
      return '';
    },
  });

  assert.equal(result.ran, true);
  assert.equal(result.workflow_object_created, true);
  assert.equal(result.workflow_imported, true);
  assert.equal(result.workflow_export_checked, true);
  assert.equal(result.workflow_id, 'penny-sidecar-local-toy-flow');
  assert.equal(result.local_only, true);
  assert.equal(result.credentials_used, false);
  assert.equal(result.webhook_used, false);
  assert.equal(result.schedule_used, false);
  assert.equal(result.email_used, false);
  assert.equal(result.cloud_used, false);
  assert.equal(result.public_action, false);
  assert.equal(result.home_or_system_action, false);
  assert.equal(result.memory_write, false);
  assert.equal(calls[0][0], 'cp');
  assert.match(calls[0][1], /penny-sidecar-n8n-workflow\.json$/);
  assert.equal(calls[0][2], 'penny-n8n-unit:/tmp/penny-sidecar-n8n-workflow.json');
  assert.deepEqual(calls[1], ['exec', 'penny-n8n-unit', 'n8n', 'import:workflow', '--input', '/tmp/penny-sidecar-n8n-workflow.json']);
  assert.deepEqual(calls[2], ['exec', 'penny-n8n-unit', 'n8n', 'export:workflow', '--all', '--output', '/tmp/penny-sidecar-n8n-workflows-export.json']);
});

test('section 5 research digest fixture artifact separates sources, claims, and unknowns', () => {
  const artifact = path.join(TMP, 'section-5-research.json');
  const output = runScript('scripts/penny-research-sidecar-trial.js', ['--fixture', '--json', '--artifact-out', artifact]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, 'HARNESS_VERIFIED');
  assert.equal(parsed.artifact_schema, 'penny-sidecar-section-5-research.v1');
  assert.ok(parsed.digest.sources.length > 0);
  assert.ok(parsed.digest.claims.length > 0);
  for (const claim of parsed.digest.claims) {
    assert.ok(claim.source_indexes.length > 0 || parsed.digest.unknowns.includes(claim.claim));
  }
  assert.equal(parsed.digest.memory_write, false);
  assert.equal(parsed.digest.requires_review, true);
  assert.equal(parsed.prompttruth_changed, false);
});

test('section 5 research digest can use live SearXNG JSON sources without memory promotion', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'sidecar-trials', 'search-results.fixture.json'), 'utf8'));
  const liveSources = normalizeSearxngJsonSources({
    results: [
      {
        title: 'Penny sidecar live result',
        url: 'https://example.test/live-sidecar-result',
        content: 'A live SearXNG JSON result used only as a reviewable digest source.',
      },
      {
        title: 'Missing URL should be ignored',
        content: 'No source URL.',
      },
    ],
  });
  const digest = buildResearchDigest({
    fixture,
    liveJsonSources: liveSources,
    liveJsonOk: true,
    jsonFormatBlocked: false,
  });

  assert.equal(digest.mode, 'live_json');
  assert.deepEqual(digest.sources, [{
    title: 'Penny sidecar live result',
    url: 'https://example.test/live-sidecar-result',
    source_type: 'web',
    confidence: 'unknown',
    snippet: 'A live SearXNG JSON result used only as a reviewable digest source.',
  }]);
  assert.match(digest.summary, /Live SearXNG JSON/);
  assert.equal(digest.memory_write, false);
  assert.equal(digest.requires_review, true);
  assert.equal(digest.claims[0].verified, false);
  assert.deepEqual(digest.claims[0].source_indexes, [0]);
});

test('section 6 RAG fixture artifact cites documents without importing private memory', () => {
  const artifact = path.join(TMP, 'section-6-rag.json');
  const output = runScript('scripts/penny-rag-workspace-trial.js', ['--fixture', '--json', '--artifact-out', artifact]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, 'HARNESS_VERIFIED');
  assert.equal(parsed.artifact_schema, 'penny-sidecar-section-6-rag.v1');
  assert.ok(parsed.rag_answer.document_citations.length > 0);
  assert.ok(parsed.rag_answer.document_says.length > 0);
  assert.ok(parsed.rag_answer.model_infers.length > 0);
  assert.equal(parsed.rag_answer.memory_write, false);
  assert.equal(parsed.private_docs_used, false);
  assert.equal(parsed.penny_memory_imported, false);
  assert.equal(parsed.prompttruth_changed, false);
});

test('section 6 Qdrant live write trial records collection lifecycle without private memory', () => {
  const calls = [];
  const result = runQdrantLiveWriteTrial({
    run: true,
    found: true,
    baseUrl: 'http://qdrant.test',
    collectionName: 'penny_sidecar_trial_unit',
    requestJson: (request) => {
      calls.push(request);
      if (request.pathSuffix.endsWith('/points/search')) {
        return { ok: true, json: { result: [{ id: 1, score: 0.97, payload: { doc_id: 'fixture-doc' } }] } };
      }
      return { ok: true, json: { result: true } };
    },
  });

  assert.equal(result.ran, true);
  assert.equal(result.collection_created, true);
  assert.equal(result.vectors_upserted, 2);
  assert.equal(result.search_ran, true);
  assert.equal(result.search_result_count, 1);
  assert.equal(result.collection_deleted, true);
  assert.equal(result.private_docs_used, false);
  assert.equal(result.penny_memory_imported, false);
  assert.equal(result.memory_write, false);
  assert.deepEqual(
    calls.map((call) => `${call.method} ${call.pathSuffix}`),
    [
      'PUT /collections/penny_sidecar_trial_unit',
      'PUT /collections/penny_sidecar_trial_unit/points?wait=true',
      'POST /collections/penny_sidecar_trial_unit/points/search',
      'DELETE /collections/penny_sidecar_trial_unit',
    ],
  );
});

test('section 7 audio fixture artifact never attempts ambient capture', () => {
  const artifact = path.join(TMP, 'section-7-audio.json');
  const output = runScript('scripts/penny-audio-voice-sidecar-trial.js', ['--fixture', '--json', '--artifact-out', artifact]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.status, 'HARNESS_VERIFIED');
  assert.equal(parsed.artifact_schema, 'penny-sidecar-section-7-audio.v1');
  assert.equal(parsed.transcript_review.audio_source, 'fixture');
  assert.equal(parsed.transcript_review.ambient_capture, false);
  assert.equal(parsed.transcript_review.memory_write, false);
  assert.equal(parsed.transcript_review.requires_review, true);
  assert.equal(parsed.transcript_review.reviewed, false);
  assert.equal(parsed.runtime_changed, false);
  assert.equal(parsed.default_model_changed, false);
});

test('section 7 Speaches live TTS trial downloads model and generates fixture audio without capture', () => {
  const jsonCalls = [];
  const binaryCalls = [];
  const result = runSpeachesTtsLiveTrial({
    run: true,
    found: true,
    baseUrl: 'http://speaches.test',
    requestJson: (request) => {
      jsonCalls.push(request);
      return { ok: true, json: { data: [{ id: 'speaches-ai/Kokoro-82M-v1.0-ONNX' }] } };
    },
    requestBinary: (request) => {
      binaryCalls.push(request);
      return { ok: true, bytes: 12345, contentType: 'audio/wav' };
    },
  });

  assert.equal(result.ran, true);
  assert.equal(result.registry_checked, true);
  assert.equal(result.model_download_requested, true);
  assert.equal(result.model_available, true);
  assert.equal(result.tts_request_ran, true);
  assert.equal(result.audio_bytes_generated, 12345);
  assert.equal(result.response_format, 'wav');
  assert.equal(result.microphone_access, false);
  assert.equal(result.recording_started, false);
  assert.equal(result.ambient_capture, false);
  assert.equal(result.input_audio_uploaded, false);
  assert.equal(result.audio_output_persisted, false);
  assert.equal(result.memory_write, false);
  assert.deepEqual(
    jsonCalls.map((call) => `${call.method} ${call.pathSuffix}`),
    [
      'GET /v1/registry?task=text-to-speech',
      'POST /v1/models/speaches-ai/Kokoro-82M-v1.0-ONNX',
      'GET /v1/models',
    ],
  );
  assert.deepEqual(binaryCalls.map((call) => `${call.method} ${call.pathSuffix}`), ['POST /v1/audio/speech']);
});

test('section 7 Speaches JSON helper accepts successful plain text model-download responses', () => {
  const response = requestSpeachesJson({
    baseUrl: 'http://speaches.test',
    pathSuffix: '/v1/models/speaches-ai/Kokoro-82M-v1.0-ONNX',
    method: 'POST',
    execFile: () => 'Model downloaded',
  });

  assert.equal(response.ok, true);
  assert.equal(response.json, null);
  assert.match(response.sample, /Model downloaded/);
});

test('trial CLIs expose help without touching live services', () => {
  const scripts = [
    'scripts/penny-lab-cockpit-trial.js',
    'scripts/penny-home-camera-event-trial.js',
    'scripts/penny-workflow-sidecar-trial.js',
    'scripts/penny-research-sidecar-trial.js',
    'scripts/penny-rag-workspace-trial.js',
    'scripts/penny-audio-voice-sidecar-trial.js',
    'scripts/penny-sidecar-section-completion-gate.js',
  ];

  for (const script of scripts) {
    const output = runScript(script, ['--help']);
    assert.match(output, /--json/);
    assert.match(output, /--artifact-out|--matrix/);
  }
});

test('package exposes direct aliases for sections 2-7 trial commands and completion gate', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.match(pkg.scripts['penny:sidecar:lab-cockpit'], /penny-lab-cockpit-trial\.js/);
  assert.match(pkg.scripts['penny:sidecar:home-camera'], /penny-home-camera-event-trial\.js/);
  assert.match(pkg.scripts['penny:sidecar:workflow'], /penny-workflow-sidecar-trial\.js/);
  assert.match(pkg.scripts['penny:sidecar:research'], /penny-research-sidecar-trial\.js/);
  assert.match(pkg.scripts['penny:sidecar:rag'], /penny-rag-workspace-trial\.js/);
  assert.match(pkg.scripts['penny:sidecar:audio'], /penny-audio-voice-sidecar-trial\.js/);
  assert.match(pkg.scripts['penny:sidecar:completion-gate'], /penny-sidecar-section-completion-gate\.js/);
});
