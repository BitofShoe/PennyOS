const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  buildSidecarTrialContract,
  renderContractMarkdown,
} = require('../lib/penny-sidecar-contracts');
const {
  parseArgs,
  hasFlag,
  argValue,
  writeFileIfRequested,
  printJson,
  printText,
  detectCommand,
} = require('./penny-sidecar-cli-utils');

function helpText() {
  return `penny:pi:check / penny:opencode:check - operator sidecar helpers

Usage:
  npm run penny:pi:check
  npm run penny:pi:template
  npm run penny:pi:validate-template
  npm run penny:pi:models-json -- --model-id <resolved-qwen-model-id>
  npm run penny:pi:models-json -- --resolve-from-endpoint output/local-endpoint-compatibility-2026-05-11.json
  npm run penny:pi:copy-plan -- --generated-models-json output/pi-models.local.json
  npm run penny:pi:trial -- --repo tmp/sidecars/pi-disposable-trial --prepare-disposable-repo --endpoint-artifact output/local-endpoint-compatibility-2026-05-11.json --dry-run
  npm run penny:opencode:check
  npm run penny:opencode:template
  npm run penny:opencode:trial -- --repo <path> --model qwen-local-coding --dry-run

The helper never executes Pi/OpenCode trial actions. It detects presence, prints templates, can prepare a tiny disposable repo fixture, and builds dry-run receipts.
Pi template validation is local schema validation only; it does not write ~/.pi/agent/models.json.
`;
}

function normalizeApp(value = 'Pi') {
  if (/^opencode$/i.test(value)) return 'OpenCode';
  return 'Pi';
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function commandVersion(command) {
  const commandPath = detectCommand(command);
  if (!commandPath) return { present: false, command_path: '', version: '' };
  try {
    const { spawnSync } = require('node:child_process');
    let result = spawnSync(commandPath, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    if ((result.error || (!result.stdout && !result.stderr)) && commandPath.startsWith('/')) {
      result = spawnSync('bash', ['-lc', `${JSON.stringify(commandPath)} --version`], {
        encoding: 'utf8',
        timeout: 5000,
      });
    }
    const version = String(result.stdout || result.stderr || '').trim();
    return { present: true, command_path: commandPath, version };
  } catch (_err) {
    return { present: true, command_path: commandPath, version: 'unknown' };
  }
}

function piPaths() {
  const home = os.homedir();
  const agentDir = path.join(home, '.pi', 'agent');
  return {
    home,
    agent_dir: agentDir,
    settings_json: path.join(agentDir, 'settings.json'),
    models_json: path.join(agentDir, 'models.json'),
  };
}

function isUnsafeDisposableRepoPath(resolved) {
  const cwd = path.resolve(process.cwd());
  const home = path.resolve(os.homedir());
  const root = path.parse(resolved).root;
  return resolved === cwd
    || resolved === path.dirname(cwd)
    || resolved === home
    || resolved === root;
}

function disposableRepoFixtureFiles() {
  return {
    '.gitignore': [
      'node_modules/',
      'coverage/',
      '.env',
      'penny-memory*',
      'private-runtime-artifacts/',
      '',
    ].join('\n'),
    'README.md': [
      '# Penny Pi Disposable Trial Fixture',
      '',
      'This is a throwaway local-model operator sidecar workspace.',
      '',
      '- It contains no Penny memory.',
      '- It contains no private runtime artifacts.',
      '- It has no network, email, home, camera, or public-action wiring.',
      '- Delete it after the trial if you do not need the receipt.',
      '',
      'Suggested smoke task:',
      '',
      'Ask the operator sidecar to inspect `src/todo.js`, add one testable helper, run `npm test`, and report exact files changed.',
      '',
    ].join('\n'),
    'package.json': `${JSON.stringify({
      name: 'penny-pi-disposable-trial-fixture',
      version: '0.0.0',
      private: true,
      type: 'commonjs',
      scripts: {
        test: 'node --test test/*.test.js',
      },
    }, null, 2)}\n`,
    'src/todo.js': [
      'function summarizeTodo(todo = {}) {',
      "  const title = String(todo.title || '').trim();",
      "  const priority = String(todo.priority || 'normal').trim();",
      "  return `${title || 'untitled'} [${priority || 'normal'}]`;",
      '}',
      '',
      'module.exports = {',
      '  summarizeTodo,',
      '};',
      '',
    ].join('\n'),
    'test/todo.test.js': [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const { summarizeTodo } = require('../src/todo');",
      '',
      "test('summarizeTodo returns a compact title and priority', () => {",
      "  assert.equal(summarizeTodo({ title: 'write receipt', priority: 'high' }), 'write receipt [high]');",
      '});',
      '',
      "test('summarizeTodo falls back safely for blank input', () => {",
      "  assert.equal(summarizeTodo({}), 'untitled [normal]');",
      '});',
      '',
    ].join('\n'),
  };
}

function prepareDisposableRepoFixture({ repo = '', overwrite = false } = {}) {
  if (!repo) {
    throw new Error('--repo is required when preparing a disposable repo fixture');
  }
  const resolved = path.resolve(process.cwd(), repo);
  if (isUnsafeDisposableRepoPath(resolved)) {
    throw new Error(`Refusing to prepare disposable repo at unsafe path: ${resolved}`);
  }
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory()) {
    throw new Error(`Disposable repo path exists and is not a directory: ${resolved}`);
  }
  fs.mkdirSync(resolved, { recursive: true });
  const files = disposableRepoFixtureFiles();
  const written = [];
  const skipped = [];
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(resolved, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath) && !overwrite) {
      skipped.push(relativePath);
      continue;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    written.push(relativePath);
  }
  return {
    prepared: true,
    path: resolved,
    wrote_files: written,
    skipped_existing_files: skipped,
    overwrite: overwrite === true,
    contains_penny_memory: false,
    contains_private_runtime_artifacts: false,
    live_sidecar_executed: false,
    suggested_test_command: 'npm test',
  };
}

function inspectDisposableRepo(repo = '') {
  if (!repo) {
    return {
      path: '',
      exists: false,
      has_package_json: false,
      has_test_dir: false,
      looks_like_penny_repo: false,
    };
  }
  const resolved = path.resolve(process.cwd(), repo);
  const exists = fs.existsSync(resolved);
  return {
    path: resolved,
    exists,
    has_package_json: exists && fs.existsSync(path.join(resolved, 'package.json')),
    has_test_dir: exists && fs.existsSync(path.join(resolved, 'test')),
    looks_like_penny_repo: exists && (
      fs.existsSync(path.join(resolved, 'data', 'penny-memory.json'))
      || fs.existsSync(path.join(resolved, 'server.js'))
    ),
  };
}

function checkPi() {
  const paths = piPaths();
  const settings = safeReadJson(paths.settings_json);
  const command = commandVersion('pi');
  return {
    schema_version: 1,
    app: 'Pi',
    read_only: true,
    executes_sidecar: false,
    command,
    config: {
      agent_dir_exists: fs.existsSync(paths.agent_dir),
      settings_json_exists: fs.existsSync(paths.settings_json),
      models_json_exists: fs.existsSync(paths.models_json),
      settings_summary: settings ? {
        defaultProvider: settings.defaultProvider || settings.provider || '',
        defaultModel: settings.defaultModel || settings.model || '',
        thinking: settings.thinking || settings.reasoning || '',
        telemetry: settings.telemetry || settings.installTelemetry || '',
      } : null,
    },
    warnings: fs.existsSync(paths.models_json) ? [] : ['~/.pi/agent/models.json is absent; use the repo example as a template, not a live write.'],
    guardrails: [
      'No Penny memory in Pi context.',
      'No private runtime artifacts in Pi context.',
      'Use disposable repo/worktree first.',
      'Explicit endpoint/model required.',
      'Review logs/transcript before pattern mining.',
    ],
  };
}

function buildOpenCodeReadiness({ command = commandVersion('opencode'), candidateDirs = [] } = {}) {
  const blocked = command.present !== true;
  return {
    schema_version: 1,
    app: 'OpenCode',
    status: blocked ? 'blocked_missing_command' : 'ready_for_config_review',
    blocked,
    read_only: true,
    executes_sidecar: false,
    command,
    config: {
      candidate_dirs: candidateDirs,
    },
    blockers: blocked ? ['OpenCode command is not on PATH in this environment.'] : [],
    install_permission_required: blocked,
    warnings: blocked ? ['OpenCode is absent; do not install or write config without explicit operator permission.'] : [],
    install_or_config_next_steps: blocked ? [
      'Ask the operator before installing OpenCode.',
      'After installation, rerun npm run penny:opencode:check.',
      'Generate npm run penny:opencode:template for config review only.',
      'Run npm run penny:opencode:trial only in a disposable repo after endpoint/model verification.',
    ] : [
      'Review the local provider template before writing any OpenCode config.',
      'Run endpoint/model verification before a disposable repo trial.',
      'Keep Penny memory and private runtime artifacts out of context.',
    ],
    guardrails: [
      'OpenCode is an operator sidecar, not Penny runtime.',
      'No Penny memory or private runtime artifacts.',
      'Start in a throwaway repo/worktree.',
      'Do not change Penny default model or runtime prompt.',
    ],
  };
}

function checkOpenCode() {
  const home = os.homedir();
  const candidateDirs = [
    path.join(home, '.config', 'opencode'),
    path.join(home, '.opencode'),
  ].map((dir) => ({ path: dir, exists: fs.existsSync(dir) }));
  return buildOpenCodeReadiness({ candidateDirs });
}

function extractEndpointModelId(endpointArtifact = {}) {
  return String(
    endpointArtifact.resolved_model_id
      || endpointArtifact.loaded_model_id
      || (Array.isArray(endpointArtifact.loaded_models) ? endpointArtifact.loaded_models[0] : '')
      || '',
  ).trim();
}

function isResolvedModelId(value = '') {
  const text = String(value || '').trim();
  return Boolean(text) && !/^<.*>$/.test(text);
}

function buildPiModelsJson({
  providerName = 'lmstudio-local',
  endpoint = 'http://127.0.0.1:1234/v1',
  modelId = '<resolved-qwen-model-id>',
  modelName = 'qwen-local-coding',
  contextWindow = 128000,
  maxTokens = 4096,
} = {}) {
  return {
    providers: {
      [providerName]: {
        baseUrl: endpoint,
        api: 'openai-completions',
        apiKey: `${providerName}-no-auth`,
        compat: {
          supportsDeveloperRole: false,
          supportsReasoningEffort: false,
          thinkingFormat: 'qwen-chat-template',
        },
        models: [
          {
            id: modelId,
            name: modelName,
            reasoning: false,
            thinkingLevelMap: {},
            input: ['text'],
            contextWindow,
            maxTokens,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          },
        ],
      },
    },
  };
}

function buildPiTemplate(options = {}) {
  const template = options.providers ? options : buildPiModelsJson(options);
  return {
    app: 'Pi',
    executes_sidecar: false,
    target_path: '~/.pi/agent/models.json',
    pi_schema_source: 'local Pi 0.74.0 docs/models.md and dist/core/model-registry.js',
    note: 'Example only. Do not write live Pi config without operator review.',
    template,
  };
}

function validatePiModelsConfig(config = {}) {
  const errors = [];
  const warnings = [];
  const providers = config.providers;
  const supportedApis = new Set([
    'openai-completions',
    'openai-responses',
    'anthropic-messages',
    'google-generative-ai',
    'azure-openai-responses',
    'openai-codex-responses',
    'mistral-conversations',
    'google-vertex',
    'bedrock-converse-stream',
  ]);
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) {
    errors.push('root providers object is required');
  } else {
    for (const [providerName, provider] of Object.entries(providers)) {
      if (!provider || typeof provider !== 'object' || Array.isArray(provider)) {
        errors.push(`provider ${providerName} must be an object`);
        continue;
      }
      if (!provider.baseUrl) errors.push(`provider ${providerName} requires baseUrl for custom models`);
      if (!provider.apiKey && !provider.oauth) errors.push(`provider ${providerName} requires apiKey or oauth for custom models`);
      if (provider.api && !supportedApis.has(provider.api)) errors.push(`provider ${providerName} has unsupported api ${provider.api}`);
      if (!Array.isArray(provider.models) || provider.models.length === 0) {
        errors.push(`provider ${providerName} requires a non-empty models array`);
        continue;
      }
      for (const model of provider.models) {
        const modelId = model?.id || '<missing-id>';
        const api = model?.api || provider.api;
        if (!model?.id) errors.push(`provider ${providerName} model missing id`);
        if (!api) errors.push(`provider ${providerName}, model ${modelId}: no api specified`);
        if (api && !supportedApis.has(api)) errors.push(`provider ${providerName}, model ${modelId}: unsupported api ${api}`);
        for (const field of ['contextWindow', 'maxTokens']) {
          if (Object.prototype.hasOwnProperty.call(model, field) && !(Number.isFinite(model[field]) && model[field] > 0)) {
            errors.push(`provider ${providerName}, model ${modelId}: ${field} must be a positive number when present`);
          }
        }
        if (model.reasoning === true && !model.thinkingLevelMap) {
          warnings.push(`provider ${providerName}, model ${modelId}: reasoning true without thinkingLevelMap review`);
        }
      }
    }
  }
  return {
    schema_version: 1,
    validator: 'penny-pi-models-json-local-schema',
    valid: errors.length === 0,
    errors,
    warnings,
    writes_live_config: false,
  };
}

function piModelsJsonHasResolvedModel(config = {}) {
  const providers = config?.providers;
  if (!providers || typeof providers !== 'object' || Array.isArray(providers)) return false;
  const modelIds = Object.values(providers)
    .flatMap((provider) => (Array.isArray(provider?.models) ? provider.models : []))
    .map((model) => String(model?.id || '').trim())
    .filter(Boolean);
  return modelIds.length > 0 && modelIds.every(isResolvedModelId);
}

function buildPiCopyPlan({
  sourcePath = 'configs/sidecars/pi-local-models.example.json',
  generatedModelsJsonPath = '',
  modelResolved = false,
  modelsJson = null,
} = {}) {
  const copySource = generatedModelsJsonPath || sourcePath;
  const resolved = modelResolved === true || piModelsJsonHasResolvedModel(modelsJson || {});
  return {
    schema_version: 1,
    app: 'Pi',
    action: 'copy_plan_only',
    writes_live_config: false,
    source_path: copySource,
    target_path: '~/.pi/agent/models.json',
    model_resolved: resolved,
    blockers_before_copy: resolved ? [] : ['models.json still has a placeholder or missing model id; resolve from a live /v1/models artifact before copying'],
    preflight: [
      'Run npm run penny:pi:template -- --validate-template',
      'Run npm run penny:endpoint:probe -- --endpoint http://127.0.0.1:1234/v1',
      resolved
        ? 'Review the resolved model id against the endpoint artifact before copying'
        : 'Replace <resolved-qwen-model-id> with a model id visible from /v1/models',
      'Review that no Penny memory, private runtime artifact, or secret is referenced',
    ],
    copy_commands_for_operator_review: [
      'mkdir -p ~/.pi/agent',
      `cp ${copySource} ~/.pi/agent/models.json`,
      'pi --list-models qwen-local-coding --offline',
    ],
  };
}

function buildOpenCodeTemplate() {
  return {
    app: 'OpenCode',
    executes_sidecar: false,
    note: 'Example only. Adapt to current OpenCode docs before writing live config.',
    template: {
      provider: 'local-openai-compatible',
      baseURL: 'http://127.0.0.1:1234/v1',
      model: '<resolved-qwen-model-id>',
      compatibility: {
        developerRole: false,
        reasoningEffort: false,
        toolCalls: 'requires_check',
        qwenThinkingControls: 'explicit_only',
      },
      guardrails: {
        pennyMemory: 'forbidden',
        privateRuntimeArtifacts: 'forbidden',
        workspace: 'disposable_repo_or_throwaway_worktree',
      },
    },
  };
}

function summarizeEndpointArtifact(endpointArtifact = null) {
  const provided = endpointArtifact && typeof endpointArtifact === 'object';
  const resolvedModelId = provided ? extractEndpointModelId(endpointArtifact) : '';
  const healthStatus = provided ? String(endpointArtifact.health_status || 'unknown') : 'not_provided';
  return {
    provided: Boolean(provided),
    endpoint: provided ? String(endpointArtifact.endpoint || '') : '',
    health_status: healthStatus,
    available: healthStatus === 'available',
    model_calls: endpointArtifact?.model_calls === true,
    resolved_model_id: resolvedModelId,
    model_resolved: isResolvedModelId(resolvedModelId),
    loaded_models: Array.isArray(endpointArtifact?.loaded_models) ? endpointArtifact.loaded_models : [],
    backend_family: provided ? String(endpointArtifact.backend_family || 'unknown') : 'unknown',
  };
}

function buildTrialDryRun({
  app = 'Pi',
  repo = '',
  model = 'qwen-local-coding',
  endpointArtifact = null,
  preparedFixture = null,
  commandStatus = null,
} = {}) {
  const contract = buildSidecarTrialContract(app, { piDetected: app === 'Pi' });
  const command = commandStatus || commandVersion(app === 'Pi' ? 'pi' : 'opencode');
  const repoStatus = inspectDisposableRepo(repo);
  const endpoint = summarizeEndpointArtifact(endpointArtifact);
  const blockers = [];
  if (command.present !== true) blockers.push(`${app} command present on PATH`);
  if (!repo) blockers.push('disposable repo/worktree selected');
  else if (!repoStatus.exists) blockers.push('disposable repo path exists or is prepared with --prepare-disposable-repo');
  else if (repoStatus.looks_like_penny_repo) blockers.push('selected repo is not the Penny repo or a private runtime workspace');
  if (!endpoint.provided) blockers.push('endpoint artifact supplied with --endpoint-artifact after a live probe');
  else if (!endpoint.available) blockers.push(`endpoint artifact health_status is available, got ${endpoint.health_status}`);
  else if (!endpoint.model_resolved) blockers.push('endpoint artifact includes a non-placeholder resolved_model_id or visible model id');
  const readyToRun = blockers.length === 0;
  return {
    schema_version: 1,
    app,
    dry_run: true,
    executes_sidecar: false,
    repo,
    model,
    command,
    command_preview: app === 'Pi'
      ? `pi --provider lmstudio-local --model ${model} --no-session --no-context-files --tools read,grep,find,ls -p "<task>" # cwd=${repo || '<disposable-repo>'}`
      : `opencode --model ${model} # cwd=${repo || '<disposable-repo>'}`,
    readiness: {
      ready_to_run: readyToRun,
      repo: repoStatus,
      endpoint,
      prepared_fixture: preparedFixture || null,
    },
    contract,
    blocked_until: blockers,
    guardrails: [
      'Penny memory/private artifacts excluded',
      'operator reviews planned log capture and cleanup',
      'no live Pi/OpenCode config writes from this helper',
    ],
    next_commands: [
      repo ? `cd ${repo}` : 'cd <disposable-repo>',
      'npm test',
      app === 'Pi'
        ? `pi --provider lmstudio-local --model ${model} --no-session --no-context-files --tools read,grep,find,ls -p "<task>"`
        : `opencode --model ${model}`,
    ],
  };
}

function buildPiModelsJsonFromArgs(args) {
  const endpointArtifactPath = argValue(args, 'resolve-from-endpoint') || argValue(args, 'endpoint-artifact');
  const endpointArtifact = endpointArtifactPath ? safeReadJson(path.resolve(process.cwd(), endpointArtifactPath)) : null;
  const modelId = argValue(args, 'model-id') || extractEndpointModelId(endpointArtifact || {}) || '<resolved-qwen-model-id>';
  const endpoint = argValue(args, 'endpoint')
    || endpointArtifact?.endpoint
    || 'http://127.0.0.1:1234/v1';
  return buildPiModelsJson({
    providerName: argValue(args, 'provider-name', 'lmstudio-local'),
    endpoint,
    modelId,
    modelName: argValue(args, 'model-name', 'qwen-local-coding'),
    contextWindow: Number(argValue(args, 'context-window', '128000')),
    maxTokens: Number(argValue(args, 'max-tokens', '4096')),
  });
}

function selectPayload(args) {
  const app = normalizeApp(argValue(args, 'app', 'Pi'));
  if (app === 'Pi' && hasFlag(args, 'validate-template')) {
    const templateFile = argValue(args, 'template-file');
    const config = templateFile ? safeReadJson(path.resolve(process.cwd(), templateFile)) : buildPiModelsJsonFromArgs(args);
    return validatePiModelsConfig(config || {});
  }
  if (app === 'Pi' && hasFlag(args, 'models-json')) return buildPiModelsJsonFromArgs(args);
  if (app === 'Pi' && hasFlag(args, 'copy-plan')) {
    const generatedModelsJsonPath = argValue(args, 'generated-models-json');
    const generatedModelsJson = generatedModelsJsonPath
      ? safeReadJson(path.resolve(process.cwd(), generatedModelsJsonPath))
      : null;
    return buildPiCopyPlan({
      sourcePath: argValue(args, 'source', 'configs/sidecars/pi-local-models.example.json'),
      generatedModelsJsonPath,
      modelResolved: hasFlag(args, 'model-resolved'),
      modelsJson: generatedModelsJson,
    });
  }
  if (hasFlag(args, 'template')) return app === 'Pi' ? buildPiTemplate(buildPiModelsJsonFromArgs(args)) : buildOpenCodeTemplate();
  if (hasFlag(args, 'trial')) {
    const repo = argValue(args, 'repo');
    const endpointArtifactPath = argValue(args, 'endpoint-artifact') || argValue(args, 'resolve-from-endpoint');
    const endpointArtifact = endpointArtifactPath ? safeReadJson(path.resolve(process.cwd(), endpointArtifactPath)) : null;
    const preparedFixture = hasFlag(args, 'prepare-disposable-repo')
      ? prepareDisposableRepoFixture({ repo, overwrite: hasFlag(args, 'overwrite') })
      : null;
    return buildTrialDryRun({
      app,
      repo,
      model: argValue(args, 'model', 'qwen-local-coding'),
      endpointArtifact,
      preparedFixture,
    });
  }
  if (hasFlag(args, 'contract')) return buildSidecarTrialContract(app, { piDetected: app === 'Pi' });
  return app === 'Pi' ? checkPi() : checkOpenCode();
}

function markdownForPayload(payload) {
  if (payload.trial_id) return renderContractMarkdown(payload);
  return `# ${payload.app} Operator Sidecar\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n`;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (hasFlag(args, 'help') || hasFlag(args, 'h')) {
    printText(helpText());
    return;
  }
  const payload = selectPayload(args);
  const markdown = markdownForPayload(payload);
  writeFileIfRequested(argValue(args, 'out'), `${JSON.stringify(payload, null, 2)}\n`);
  writeFileIfRequested(argValue(args, 'markdown-out'), markdown);
  if (hasFlag(args, 'json')) printJson(payload);
  else printText(markdown);
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
  checkPi,
  checkOpenCode,
  buildOpenCodeReadiness,
  buildPiTemplate,
  buildPiModelsJson,
  extractEndpointModelId,
  validatePiModelsConfig,
  buildPiCopyPlan,
  piModelsJsonHasResolvedModel,
  isResolvedModelId,
  buildPiModelsJsonFromArgs,
  buildOpenCodeTemplate,
  prepareDisposableRepoFixture,
  inspectDisposableRepo,
  summarizeEndpointArtifact,
  buildTrialDryRun,
  selectPayload,
  main,
};
