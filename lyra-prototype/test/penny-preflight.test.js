const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const {
  buildGemmaRuntimeWatchForPreflight,
  runPreflight,
} = require('../scripts/penny-preflight');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createEnvFixture({ presetReady = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-preflight-'));
  const env = {
    APPDATA: path.join(root, 'appdata'),
    USERPROFILE: path.join(root, 'home'),
  };
  const settingsPath = path.join(env.APPDATA, 'LM Studio', 'settings.json');
  const conversationConfigPath = path.join(env.USERPROFILE, '.lmstudio', '.internal', 'conversation-config.json');
  const conversationPath = path.join(env.USERPROFILE, '.lmstudio', 'conversations', 'selected.conversation.json');
  const defaultsRoot = path.join(env.USERPROFILE, '.lmstudio', '.internal', 'user-concrete-model-default-config');

  writeJson(settingsPath, { developer: { experimentalLoadPresets: presetReady } });
  writeJson(conversationConfigPath, { selectedConversation: 'selected.conversation.json' });
  writeJson(conversationPath, { preset: presetReady ? '@local:penny' : '' });
  writeJson(path.join(defaultsRoot, 'google', 'gemma-4-31b.json'), { preset: presetReady ? '@local:penny' : '' });
  writeJson(path.join(defaultsRoot, 'google', 'gemma-4-e4b.json'), { preset: presetReady ? '@local:penny' : '' });

  return { env };
}

function makeSpawnSyncImpl({ installed, loaded }) {
  return function spawnSyncImpl(command, args) {
    assert.equal(command, 'lms');
    if (args[0] === '--help') return { status: 0, stdout: 'ok', stderr: '' };
    if (args[0] === 'ls') return { status: 0, stdout: JSON.stringify(installed), stderr: '' };
    if (args[0] === 'ps') return { status: 0, stdout: JSON.stringify(loaded.map(modelKey => ({ modelKey, status: 'loaded' }))), stderr: '' };
    return { status: 1, stdout: '', stderr: `Unexpected lms command: ${args.join(' ')}` };
  };
}

test('runPreflight passes with dual-lane models ready and preset wiring present', async () => {
  const fixture = createEnvFixture({ presetReady: true });
  const installed = [
    { type: 'llm', modelKey: 'google/gemma-4-31b', selectedVariant: 'google/gemma-4-31b@q8_0' },
    { type: 'llm', modelKey: 'google/gemma-4-e4b', selectedVariant: 'google/gemma-4-e4b@q8_0' },
  ];
  const loaded = ['google/gemma-4-31b', 'google/gemma-4-e4b'];

  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: loaded.map(id => ({ id })) }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const report = await runPreflight({
      packageJson: { engines: { node: '>=24 <25' } },
      nodeVersion: '24.14.0',
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      env: fixture.env,
      spawnSyncImpl: makeSpawnSyncImpl({ installed, loaded }),
    });

    assert.equal(report.ok, true);
    assert.equal(report.checks.find(check => check.name === 'lmstudio-readiness').ok, true);
    assert.equal(report.checks.find(check => check.name === 'lmstudio-preset').level, 'pass');
    assert.equal(report.readinessSummary.coLoadedChatTool, true);
    assert.match(report.readinessSummary.policy.coLoading, /co-loading is okay/i);
    assert.equal(report.gemmaRuntimeWatch.schema, 'penny-gemma-runtime-watch.v1');
    assert.equal(report.gemmaRuntimeWatch.measurementMode, 'status-only');
    assert.equal(report.gemmaRuntimeWatch.liveModelCalls, false);
    assert.equal(report.gemmaRuntimeWatch.behaviorChanged, false);
    assert.equal(report.gemmaRuntimeWatch.watchItems.visionBudget.exposed, false);
    assert.equal(report.gemmaRuntimeWatch.watchItems.visionBudget.adoptionStatus, 'not-adopted');
    assert.equal(report.gemmaRuntimeWatch.defaultsUnchanged.memoryFilesTouched, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('buildGemmaRuntimeWatchForPreflight records unknown knob exposure as not adopted, not failed', () => {
  const watch = buildGemmaRuntimeWatchForPreflight({
    generatedAt: '2026-04-21T12:00:00.000Z',
    preflightReport: {
      report: { requestedChatModel: 'google/gemma-4-31b' },
      status: {
        localTransport: 'stateful',
        resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
      },
    },
    env: {
      PENNY_LMSTUDIO_CHAT_TEMPERATURE: '1',
      PENNY_LMSTUDIO_CHAT_TOP_P: '0.95',
      PENNY_LMSTUDIO_CHAT_TOP_K: '64',
    },
  });

  assert.equal(watch.measurementMode, 'status-only');
  assert.equal(watch.servingPath.transport, 'stateful-chat');
  assert.equal(watch.watchItems.visionBudget.exposed, false);
  assert.equal(watch.watchItems.visionBudget.adoptionStatus, 'not-adopted');
  assert.match(watch.watchItems.visionBudget.notes, /max_soft_tokens|vision-budget/i);
  assert.notEqual(watch.watchItems.visionBudget.adoptionStatus, 'failed');
  assert.equal(watch.watchItems.loadedModelIdentity.compatibleMatch, true);
  assert.deepEqual(watch.watchItems.chatSampling, { temperature: 1, topP: 0.95, topK: 64 });
});

test('runPreflight fails clearly when LM Studio reports zero loaded models', async () => {
  const fixture = createEnvFixture({ presetReady: true });
  const installed = [
    { type: 'llm', modelKey: 'google/gemma-4-31b', selectedVariant: 'google/gemma-4-31b@q8_0' },
    { type: 'llm', modelKey: 'google/gemma-4-e4b', selectedVariant: 'google/gemma-4-e4b@q8_0' },
  ];
  const loaded = [];

  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [] }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const report = await runPreflight({
      packageJson: { engines: { node: '>=24 <25' } },
      nodeVersion: '24.14.0',
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      env: fixture.env,
      spawnSyncImpl: makeSpawnSyncImpl({ installed, loaded }),
    });

    assert.equal(report.ok, false);
    assert.match(report.report.blockers.join('\n'), /no usable models|load penny's chat\/tool models/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('runPreflight warns when preset wiring is missing but fallback-ready models exist', async () => {
  const fixture = createEnvFixture({ presetReady: false });
  const installed = [
    { type: 'llm', modelKey: 'unsloth/gemma-4-31b-it', path: 'unsloth/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q6_K.gguf' },
    { type: 'llm', modelKey: 'google/gemma-4-e4b', selectedVariant: 'google/gemma-4-e4b@q8_0' },
  ];
  const loaded = ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b'];

  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: loaded.map(id => ({ id })) }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const report = await runPreflight({
      packageJson: { engines: { node: '>=24 <25' } },
      nodeVersion: '24.14.0',
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      env: fixture.env,
      chatModel: 'google/gemma-4-31b',
      toolModel: 'google/gemma-4-e4b',
      spawnSyncImpl: makeSpawnSyncImpl({ installed, loaded }),
    });

    assert.equal(report.ok, true);
    const presetCheck = report.checks.find(check => check.name === 'lmstudio-preset');
    assert.equal(presetCheck.level, 'warn');
    assert.match(presetCheck.detail, /preset wiring/i);
    const readiness = report.checks.find(check => check.name === 'lmstudio-readiness');
    assert.match(readiness.detail, /requested chat=google\/gemma-4-31b/i);
    assert.match(readiness.detail, /resolved chat=unsloth\/gemma-4-31b-it/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('runPreflight reports semantic memory fallback when embedding model is not installed', async () => {
  const fixture = createEnvFixture({ presetReady: true });
  const installed = [
    { type: 'llm', modelKey: 'google/gemma-4-31b', selectedVariant: 'google/gemma-4-31b@q8_0' },
    { type: 'llm', modelKey: 'google/gemma-4-e4b', selectedVariant: 'google/gemma-4-e4b@q8_0' },
  ];
  const loaded = ['google/gemma-4-31b', 'google/gemma-4-e4b'];

  const server = http.createServer((req, res) => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: loaded.map(id => ({ id })) }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const report = await runPreflight({
      packageJson: { engines: { node: '>=24 <25' } },
      nodeVersion: '24.14.0',
      baseUrl: `http://127.0.0.1:${address.port}/v1`,
      env: fixture.env,
      embedModel: 'text-embedding-nomic-embed-text-v1.5',
      spawnSyncImpl: makeSpawnSyncImpl({ installed, loaded }),
    });

    assert.equal(report.ok, true);
    const readiness = report.checks.find(check => check.name === 'lmstudio-readiness');
    assert.match(readiness.detail, /semantic memory=fallback/i);
    assert.equal(report.readinessSummary.state, 'ready_with_optional_fallback');
    assert.match(report.readinessSummary.semanticMemory.message, /optional fallback/i);
    assert.match(report.report.warnings.join('\n'), /embedding model .*not installed/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
