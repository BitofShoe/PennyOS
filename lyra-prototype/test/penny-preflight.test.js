const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

const {
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
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
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
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
