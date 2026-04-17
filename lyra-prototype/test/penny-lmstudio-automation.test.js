const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createLmStudioStatusApi } = require('../lib/penny-lmstudio-status');
const { createLmStudioAutomationApi } = require('../lib/penny-lmstudio-automation');

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture({
  installedDetailed,
  loadedModels,
  chatModel = 'google/gemma-4-31b',
  toolModel = 'google/gemma-4-e4b',
  embedModel = 'text-embedding-nomic-embed-text-v1.5',
} = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-lmstudio-'));
  const env = {
    APPDATA: path.join(root, 'appdata'),
    USERPROFILE: path.join(root, 'home'),
  };
  const settingsPath = path.join(env.APPDATA, 'LM Studio', 'settings.json');
  const conversationConfigPath = path.join(env.USERPROFILE, '.lmstudio', '.internal', 'conversation-config.json');
  const conversationPath = path.join(env.USERPROFILE, '.lmstudio', 'conversations', 'selected.conversation.json');
  const defaultsRoot = path.join(env.USERPROFILE, '.lmstudio', '.internal', 'user-concrete-model-default-config');

  writeJson(settingsPath, { developer: { experimentalLoadPresets: false } });
  writeJson(conversationConfigPath, { selectedConversation: 'selected.conversation.json' });
  writeJson(conversationPath, { preset: '', messages: [] });

  for (const filePath of [
    path.join(defaultsRoot, 'google', 'gemma-4-31b.json'),
    path.join(defaultsRoot, 'google', 'gemma-4-e4b.json'),
    path.join(defaultsRoot, 'google', 'gemma-4-31b@lmstudio-community', 'gemma-4-31B-it-GGUF', 'gemma-4-31B-it-Q8_0.gguf.json'),
    path.join(defaultsRoot, 'unsloth', 'gemma-4-31B-it-GGUF', 'gemma-4-31B-it-Q6_K.gguf.json'),
  ]) {
    writeJson(filePath, { preset: '' });
  }

  const state = {
    installedDetailed: installedDetailed || [
      {
        type: 'llm',
        modelKey: 'google/gemma-4-e4b',
        selectedVariant: 'google/gemma-4-e4b@q8_0',
      },
      {
        type: 'llm',
        modelKey: 'google/gemma-4-31b',
        selectedVariant: 'google/gemma-4-31b@q8_0',
      },
      {
        type: 'embedding',
        modelKey: 'text-embedding-nomic-embed-text-v1.5',
        path: 'nomic-ai/nomic-embed-text-v1.5-GGUF/nomic-embed-text-v1.5.Q4_K_M.gguf',
      },
    ],
    loaded: [...(loadedModels || ['google/gemma-4-e4b'])],
    embedReady: false,
    loadCommands: [],
  };

  const execFileText = async (command, args) => {
    assert.equal(command, 'lms');
    if (args[0] === '--help') return { stdout: 'help', stderr: '' };
    if (args[0] === 'ls') return { stdout: JSON.stringify(state.installedDetailed), stderr: '' };
    if (args[0] === 'ps') {
      return {
        stdout: JSON.stringify(state.loaded.map(modelKey => ({ modelKey, status: 'loaded' }))),
        stderr: '',
      };
    }
    if (args[0] === 'load') {
      const modelKey = args[1];
      state.loadCommands.push([...args]);
      if (String(modelKey).includes('text-embedding-nomic-embed-text-v1.5')) {
        state.embedReady = true;
      } else if (!state.loaded.includes(modelKey)) {
        state.loaded.push(modelKey);
      }
      return { stdout: `loaded ${modelKey}`, stderr: '' };
    }
    throw new Error(`Unexpected lms command: ${args.join(' ')}`);
  };

  const fetchImpl = async (url, options = {}) => {
    if (String(url).endsWith('/embeddings')) {
      const payload = JSON.parse(String(options.body || '{}'));
      const matchesEmbed = String(payload.model || '').includes('text-embedding-nomic-embed-text-v1.5');
      if (matchesEmbed && state.embedReady) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
        };
      }
      return {
        ok: false,
        status: 400,
        text: async () => 'embedding model not ready',
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: state.loaded.map(id => ({ id })) }),
    };
  };

  const statusApi = createLmStudioStatusApi({
    fetch: fetchImpl,
    fs,
    execFileText,
    URL,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_SETTINGS_FILE: settingsPath,
    LMSTUDIO_STATUS_CACHE_MS: 0,
    LMSTUDIO_STATUS_ERROR_CACHE_MS: 0,
    LMSTUDIO_MODELS_PROBE_MS: 5000,
    LOCAL_LLM_TRANSPORT: 'auto',
    PENNY_LMSTUDIO_CHAT_MODEL: chatModel,
    PENNY_LMSTUDIO_TOOL_MODEL: toolModel,
  });

  const automationApi = createLmStudioAutomationApi({
    fs,
    path,
    fetch: fetchImpl,
    execFileText,
    lmStudioStatusApi: statusApi,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    APPDATA: env.APPDATA,
    USER_HOME: env.USERPROFILE,
    LMSTUDIO_SETTINGS_FILE: settingsPath,
    PENNY_LMSTUDIO_CHAT_MODEL: chatModel,
    PENNY_LMSTUDIO_TOOL_MODEL: toolModel,
    PENNY_LMSTUDIO_EMBED_MODEL: embedModel,
    PENNY_LMSTUDIO_PRESET_IDENTIFIER: '@local:penny',
  });

  return {
    root,
    env,
    state,
    settingsPath,
    conversationPath,
    defaultsRoot,
    automationApi,
  };
}

test('ensurePresetWiring repairs settings, conversation, and requested concrete model configs', async () => {
  const fixture = createFixture();
  const report = await fixture.automationApi.ensurePresetWiring({
    chatModel: 'google/gemma-4-31b',
    toolModel: 'google/gemma-4-e4b',
  });

  assert.ok(report.repairedPaths.includes(fixture.settingsPath));
  assert.ok(report.repairedPaths.includes(fixture.conversationPath));
  assert.ok(report.chatConfigs.some(item => /google[\\/]+gemma-4-31b\.json$/i.test(item.path) && item.presetOk));
  assert.ok(report.chatConfigs.some(item => /Q8_0\.gguf\.json$/i.test(item.path) && item.presetOk));
  assert.ok(report.toolConfigs.some(item => /google[\\/]+gemma-4-e4b\.json$/i.test(item.path) && item.presetOk));

  const settings = JSON.parse(fs.readFileSync(fixture.settingsPath, 'utf8'));
  const conversation = JSON.parse(fs.readFileSync(fixture.conversationPath, 'utf8'));
  assert.equal(settings.developer.experimentalLoadPresets, true);
  assert.equal(conversation.preset, '@local:penny');
});

test('prepareLmStudio loads the requested chat model when it is installed but not loaded', async () => {
  const fixture = createFixture({
    loadedModels: ['google/gemma-4-e4b'],
  });

  const report = await fixture.automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: true,
    loadChatModel: true,
    chatModel: 'google/gemma-4-31b',
    toolModel: 'google/gemma-4-e4b',
  });

  assert.equal(report.ok, true);
  assert.equal(report.chatLoadAttempted, true);
  assert.equal(report.chatLoadSucceeded, true);
  assert.ok(report.loadedModels.some((model) => /google\/gemma-4-31b/i.test(model)));
  assert.equal(report.laneFallback.chat, false);
});

test('loadModel resolves installed aliases before calling the LM Studio CLI', async () => {
  const fixture = createFixture({
    installedDetailed: [
      {
        type: 'llm',
        modelKey: 'unsloth/gemma-4-31b-it',
        path: 'unsloth/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q6_K.gguf',
      },
    ],
    loadedModels: [],
  });

  await fixture.automationApi.loadModel('unsloth/gemma-4-31b-it@q6_k', 'chat model', {
    contextLength: 6144,
    ttlSeconds: 1800,
  });

  assert.equal(fixture.state.loadCommands.length, 1);
  assert.deepEqual(
    fixture.state.loadCommands[0],
    ['load', 'unsloth/gemma-4-31b-it', '-y', '-c', '6144', '--ttl', '1800'],
  );
});

test('loadModel prefers the family model key before variant aliases when loading', async () => {
  const fixture = createFixture({
    installedDetailed: [
      {
        type: 'llm',
        modelKey: 'google/gemma-4-e4b',
        selectedVariant: 'google/gemma-4-e4b@q8_0',
        variants: ['google/gemma-4-e4b@q8_0'],
      },
    ],
    loadedModels: [],
  });

  await fixture.automationApi.loadModel('google/gemma-4-e4b@q8_0', 'tool model');

  assert.equal(fixture.state.loadCommands.length, 1);
  assert.equal(fixture.state.loadCommands[0][1], 'google/gemma-4-e4b');
});

test('loadModel short-circuits when an equivalent model is already loaded', async () => {
  const fixture = createFixture({
    installedDetailed: [
      {
        type: 'embedding',
        modelKey: 'text-embedding-nomic-embed-text-v1.5',
        path: 'nomic-ai/nomic-embed-text-v1.5-GGUF/nomic-embed-text-v1.5.Q4_K_M.gguf',
      },
    ],
    loadedModels: ['text-embedding-nomic-embed-text-v1.5'],
  });

  const result = await fixture.automationApi.loadModel('text-embedding-nomic-embed-text-v1.5', 'embedding model');

  assert.equal(fixture.state.loadCommands.length, 0);
  assert.equal(result.skippedLoad, true);
  assert.match(result.stdout, /already loaded/i);
});

test('loadModel refuses to mix conflicting 31B chat models', async () => {
  const fixture = createFixture({
    installedDetailed: [
      {
        type: 'llm',
        modelKey: 'google/gemma-4-31b',
        selectedVariant: 'google/gemma-4-31b@q8_0',
      },
      {
        type: 'llm',
        modelKey: 'unsloth/gemma-4-31b-it',
        path: 'unsloth/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q6_K.gguf',
      },
    ],
    loadedModels: ['google/gemma-4-31b@q8_0'],
  });

  await assert.rejects(
    fixture.automationApi.loadModel('unsloth/gemma-4-31b-it@q6_k', 'chat model'),
    /Refusing to load .*conflicting 31B chat model/i,
  );
  assert.equal(fixture.state.loadCommands.length, 0);
});

test('prepareLmStudio normalizes and readies the embedding model through the live embeddings probe', async () => {
  const fixture = createFixture({
    loadedModels: ['google/gemma-4-e4b'],
    embedModel: 'nomic-ai/nomic-embed-text-v1.5',
  });

  const report = await fixture.automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: true,
    loadChatModel: false,
    loadEmbedModel: true,
    chatModel: 'google/gemma-4-31b',
    toolModel: 'google/gemma-4-e4b',
    embedModel: 'nomic-ai/nomic-embed-text-v1.5',
  });

  assert.equal(report.requestedEmbedModel, 'text-embedding-nomic-embed-text-v1.5');
  assert.equal(report.embedInstalled, true);
  assert.equal(report.embedLoadAttempted, true);
  assert.equal(report.embedLoadSucceeded, true);
  assert.equal(report.embedLoaded, true);
  assert.equal(report.semanticMemoryReady, true);
});

test('prepareLmStudio warns when the requested chat model is missing but a chat fallback is already loaded', async () => {
  const fixture = createFixture({
    installedDetailed: [
      {
        type: 'llm',
        modelKey: 'google/gemma-4-e4b',
        selectedVariant: 'google/gemma-4-e4b@q8_0',
      },
      {
        type: 'llm',
        modelKey: 'unsloth/gemma-4-31b-it',
        path: 'unsloth/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q6_K.gguf',
      },
    ],
    loadedModels: ['google/gemma-4-e4b', 'unsloth/gemma-4-31b-it'],
    chatModel: 'google/gemma-4-31b',
  });

  const report = await fixture.automationApi.prepareLmStudio({
    reportOnly: true,
    repairPreset: false,
    loadChatModel: false,
    chatModel: 'google/gemma-4-31b',
    toolModel: 'google/gemma-4-e4b',
  });

  assert.equal(report.ok, true);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.laneFallback.chat, true);
  assert.match(report.warnings.join('\n'), /fallback/i);
});
