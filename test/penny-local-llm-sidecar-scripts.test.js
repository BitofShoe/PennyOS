const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const {
  validateModelProfileConfig,
} = require('../lib/penny-model-profile-compare');
const {
  validatePiModelsConfig,
  buildOpenCodeReadiness,
  buildTrialDryRun,
  prepareDisposableRepoFixture,
  piModelsJsonHasResolvedModel,
} = require('../scripts/penny-operator-sidecar');

const ROOT = path.resolve(__dirname, '..');

function listJsonFiles(relativeDirectory, { recursive = false } = {}) {
  const absoluteDirectory = path.join(ROOT, relativeDirectory);
  return fs.readdirSync(absoluteDirectory, { withFileTypes: true })
    .flatMap((entry) => {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isDirectory()) {
        return recursive ? listJsonFiles(relativePath, { recursive: true }) : [];
      }
      return entry.isFile() && entry.name.endsWith('.json') ? [relativePath] : [];
    })
    .sort();
}

function runScript(script, args = []) {
  return execFileSync(process.execPath, [path.join(ROOT, script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

test('penny local LLM app CLI prints shortlist JSON to stdout', () => {
  const output = runScript('scripts/penny-local-llm-apps.js', ['--shortlist', '--json']);
  const parsed = JSON.parse(output);

  assert.equal(parsed.schema_version, 1);
  assert.ok(parsed.apps.some((app) => app.display_name === 'Pi'));
  assert.ok(parsed.apps.some((app) => app.display_name === 'Open WebUI'));
});

test('sidecar trial CLI recommends Pi trial without writing files', () => {
  const output = runScript('scripts/penny-sidecar-trial.js', ['--recommend-next', '--json']);
  const parsed = JSON.parse(output);

  assert.equal(parsed.schema_version, 1);
  assert.equal(parsed.app_id, 'Pi');
  assert.match(parsed.command, /penny:pi:trial/);
});

test('operator sidecar CLI emits Pi template JSON and does not execute Pi', () => {
  const output = runScript('scripts/penny-operator-sidecar.js', ['--app', 'Pi', '--template', '--json']);
  const parsed = JSON.parse(output);

  assert.equal(parsed.app, 'Pi');
  assert.equal(parsed.executes_sidecar, false);
  assert.equal(parsed.template.providers['lmstudio-local'].api, 'openai-completions');
  assert.equal(parsed.template.providers['lmstudio-local'].compat.supportsReasoningEffort, false);
  assert.equal(parsed.template.providers['lmstudio-local'].models[0].contextWindow, 128000);
});

test('operator sidecar CLI validates Pi template and prints copy plan without live writes', () => {
  const validationOutput = runScript('scripts/penny-operator-sidecar.js', ['--app', 'Pi', '--validate-template', '--json']);
  const validation = JSON.parse(validationOutput);
  const copyPlanOutput = runScript('scripts/penny-operator-sidecar.js', ['--app', 'Pi', '--copy-plan', '--json']);
  const copyPlan = JSON.parse(copyPlanOutput);

  assert.equal(validation.valid, true);
  assert.equal(validation.writes_live_config, false);
  assert.equal(copyPlan.action, 'copy_plan_only');
  assert.equal(copyPlan.writes_live_config, false);
  assert.match(copyPlan.copy_commands_for_operator_review.join(' '), /cp configs\/sidecars\/pi-local-models\.example\.json/);
});

test('operator sidecar helper prepares a disposable Pi repo fixture without live sidecar execution', () => {
  const repo = path.join(ROOT, 'tmp', 'test-pi-disposable-trial-fixture');
  fs.rmSync(repo, { recursive: true, force: true });

  const prepared = prepareDisposableRepoFixture({ repo });
  const receipt = buildTrialDryRun({
    app: 'Pi',
    repo,
    model: 'qwen-local-coding',
    preparedFixture: prepared,
    commandStatus: { present: true, command_path: '/usr/local/bin/pi', version: '0.74.0' },
    endpointArtifact: {
      endpoint: 'http://127.0.0.1:1234/v1',
      health_status: 'available',
      backend_family: 'llama_cpp',
      loaded_models: ['qwen3-local-fixture'],
      resolved_model_id: 'qwen3-local-fixture',
    },
  });

  assert.equal(prepared.prepared, true);
  assert.equal(prepared.contains_penny_memory, false);
  assert.equal(prepared.contains_private_runtime_artifacts, false);
  assert.ok(fs.existsSync(path.join(repo, 'package.json')));
  assert.ok(fs.existsSync(path.join(repo, 'src', 'todo.js')));
  assert.ok(fs.existsSync(path.join(repo, 'test', 'todo.test.js')));
  assert.equal(receipt.executes_sidecar, false);
  assert.equal(receipt.readiness.ready_to_run, true);
  assert.deepEqual(receipt.blocked_until, []);
  assert.equal(receipt.readiness.endpoint.resolved_model_id, 'qwen3-local-fixture');
});

test('operator sidecar CLI can prepare a disposable Pi trial receipt from an endpoint artifact', () => {
  const repo = path.join(ROOT, 'tmp', 'test-pi-disposable-trial-cli');
  const artifact = path.join(ROOT, 'tmp', 'test-pi-live-endpoint-artifact.json');
  fs.rmSync(repo, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(artifact), { recursive: true });
  fs.writeFileSync(artifact, JSON.stringify({
    endpoint: 'http://127.0.0.1:1234/v1',
    health_status: 'available',
    backend_family: 'llama_cpp',
    loaded_models: ['qwen3-local-fixture'],
    resolved_model_id: 'qwen3-local-fixture',
  }), 'utf8');

  const output = runScript('scripts/penny-operator-sidecar.js', [
    '--app',
    'Pi',
    '--trial',
    '--repo',
    repo,
    '--prepare-disposable-repo',
    '--endpoint-artifact',
    artifact,
    '--json',
  ]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.dry_run, true);
  assert.equal(parsed.executes_sidecar, false);
  assert.equal(parsed.readiness.prepared_fixture.prepared, true);
  assert.equal(parsed.readiness.endpoint.resolved_model_id, 'qwen3-local-fixture');
  assert.ok(fs.existsSync(path.join(repo, 'README.md')));
});

test('Pi disposable trial blocks placeholder endpoint model ids', () => {
  const receipt = buildTrialDryRun({
    app: 'Pi',
    repo: 'tmp/sidecars/pi-disposable-trial',
    model: 'qwen-local-coding',
    commandStatus: { present: true, command_path: '/usr/local/bin/pi', version: '0.74.0' },
    endpointArtifact: {
      endpoint: 'http://127.0.0.1:1234/v1',
      health_status: 'available',
      backend_family: 'llama_cpp',
      loaded_models: ['<resolved-qwen-model-id>'],
      resolved_model_id: '<resolved-qwen-model-id>',
    },
  });

  assert.equal(receipt.readiness.endpoint.model_resolved, false);
  assert.equal(receipt.readiness.ready_to_run, false);
  assert.match(receipt.blocked_until.join(' '), /non-placeholder resolved_model_id/i);
});

test('operator sidecar CLI emits raw Pi models.json with resolved model id', () => {
  const output = runScript('scripts/penny-operator-sidecar.js', [
    '--app',
    'Pi',
    '--models-json',
    '--model-id',
    'qwen3-local-fixture',
    '--endpoint',
    'http://127.0.0.1:8080/v1',
    '--json',
  ]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.providers['lmstudio-local'].baseUrl, 'http://127.0.0.1:8080/v1');
  assert.equal(parsed.providers['lmstudio-local'].models[0].id, 'qwen3-local-fixture');
  assert.equal(parsed.providers['lmstudio-local'].api, 'openai-completions');
  assert.equal(validatePiModelsConfig(parsed).valid, true);
  assert.equal(piModelsJsonHasResolvedModel(parsed), true);
});

test('operator sidecar CLI can resolve Pi models.json from endpoint artifact', () => {
  const temp = path.join(ROOT, 'tmp', 'test-pi-endpoint-artifact.json');
  fs.mkdirSync(path.dirname(temp), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify({
    endpoint: 'http://127.0.0.1:9999/v1',
    loaded_models: ['resolved-from-artifact'],
  }), 'utf8');

  const output = runScript('scripts/penny-operator-sidecar.js', [
    '--app',
    'Pi',
    '--models-json',
    '--resolve-from-endpoint',
    temp,
    '--json',
  ]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.providers['lmstudio-local'].baseUrl, 'http://127.0.0.1:9999/v1');
  assert.equal(parsed.providers['lmstudio-local'].models[0].id, 'resolved-from-artifact');
  assert.equal(piModelsJsonHasResolvedModel(parsed), true);
});

test('Pi copy plan does not treat placeholder models.json as resolved', () => {
  const temp = path.join(ROOT, 'tmp', 'test-pi-placeholder-models.json');
  fs.mkdirSync(path.dirname(temp), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify({
    providers: {
      'lmstudio-local': {
        baseUrl: 'http://127.0.0.1:1234/v1',
        api: 'openai-completions',
        apiKey: 'lmstudio-local-no-auth',
        models: [{ id: '<resolved-qwen-model-id>', name: 'qwen-local-coding' }],
      },
    },
  }), 'utf8');

  const output = runScript('scripts/penny-operator-sidecar.js', [
    '--app',
    'Pi',
    '--copy-plan',
    '--generated-models-json',
    temp,
    '--json',
  ]);
  const parsed = JSON.parse(output);

  assert.equal(parsed.model_resolved, false);
  assert.match(parsed.blockers_before_copy.join(' '), /placeholder/i);
});

test('checked-in sidecar config and fixture JSON examples validate structurally', () => {
  const piConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'configs/sidecars/pi-local-models.example.json'), 'utf8'));
  const qwenProfile = JSON.parse(fs.readFileSync(path.join(ROOT, 'configs/sidecars/qwen-local-model-profile.example.json'), 'utf8'));
  const gemmaProfile = JSON.parse(fs.readFileSync(path.join(ROOT, 'configs/sidecars/gemma-local-model-profile.example.json'), 'utf8'));
  const jsonFiles = [
    ...listJsonFiles('configs/sidecars'),
    ...listJsonFiles('fixtures', { recursive: true }),
  ];

  for (const file of jsonFiles) {
    assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), file);
  }
  assert.equal(validatePiModelsConfig(piConfig).valid, true);
  assert.equal(validateModelProfileConfig(qwenProfile).valid, true);
  assert.equal(validateModelProfileConfig(gemmaProfile).valid, true);
});

test('package exposes direct aliases for operator-ready sidecar commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  assert.match(pkg.scripts['penny:pi:models-json'], /--models-json/);
  assert.match(pkg.scripts['penny:pi:validate-template'], /--validate-template/);
  assert.match(pkg.scripts['penny:pi:copy-plan'], /--copy-plan/);
  assert.match(pkg.scripts['penny:pi:trial-fixture'], /--prepare-disposable-repo/);
  assert.match(pkg.scripts['penny:apps:license-review'], /--needs-license-review/);
  assert.match(pkg.scripts['penny:endpoint:probe:model-call'], /--probe-model-call/);
});

test('OpenCode readiness reports a clean blocked state when the command is absent', () => {
  const blocked = buildOpenCodeReadiness({
    command: { present: false, command_path: '', version: '' },
    candidateDirs: [{ path: '/tmp/opencode-fixture', exists: false }],
  });

  assert.equal(blocked.app, 'OpenCode');
  assert.equal(blocked.status, 'blocked_missing_command');
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.install_permission_required, true);
  assert.match(blocked.blockers.join(' '), /not on PATH/i);
  assert.match(blocked.install_or_config_next_steps.join(' '), /Ask the operator/i);
  assert.equal(blocked.executes_sidecar, false);
});

test('apps CLI exposes license/access review queue with no approval implied', () => {
  const output = runScript('scripts/penny-local-llm-apps.js', ['--needs-license-review', '--json']);
  const parsed = JSON.parse(output);

  assert.equal(parsed.install_or_core_approval_implied, false);
  assert.ok(parsed.apps.length >= 30);
  assert.ok(parsed.apps.some((app) => app.display_name === 'Pi'));
  assert.ok(parsed.apps.every((app) => app.approved_for_install === false));
  assert.ok(parsed.apps.every((app) => app.approved_for_core === false));
});

test('model compare CLI emits prepared-only dry-run artifact', () => {
  const output = runScript('scripts/penny-model-profile-compare.js', ['--profiles', 'qwen-local,gemma-local', '--dry-run', '--json']);
  const parsed = JSON.parse(output);

  assert.equal(parsed.prepared_only, true);
  assert.equal(parsed.live_model_calls, false);
  assert.equal(parsed.default_model_changed, false);
});

test('pattern CLI emits inert proposals', () => {
  const output = runScript('scripts/penny-sidecar-patterns.js', ['--list', '--json']);
  const parsed = JSON.parse(output);

  assert.ok(parsed.proposals.length > 0);
  assert.equal(parsed.proposals[0].status, 'proposed');
  assert.equal(parsed.proposals[0].runtime_changed, false);
});

test('endpoint probe help is available without touching network', () => {
  const output = runScript('scripts/penny-local-endpoint-compatibility.js', ['--help']);
  assert.match(output, /penny:endpoint:probe/);
  assert.match(output, /--probe-model-call/);
});
