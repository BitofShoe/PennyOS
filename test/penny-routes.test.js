const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HOST_LMSTUDIO_ENV_KEYS = [
  'PENNY_LMSTUDIO_SETTINGS_FILE',
  'PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY',
];
const HOST_LMSTUDIO_ORIGINAL_ENV = Object.fromEntries(
  HOST_LMSTUDIO_ENV_KEYS.map((key) => [key, process.env[key]]),
);
const HOST_LMSTUDIO_TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-host-lmstudio-'));
process.env.PENNY_LMSTUDIO_SETTINGS_FILE = path.join(HOST_LMSTUDIO_TEST_DIR, 'settings.json');
process.env.PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY = '1';
test.after(() => {
  for (const [key, value] of Object.entries(HOST_LMSTUDIO_ORIGINAL_ENV)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(HOST_LMSTUDIO_TEST_DIR, { recursive: true, force: true });
});

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const body = typeof options.body === 'string' ? options.body : '';
    const headers = {
      ...(options.headers || {}),
    };
    if (body && !headers['Content-Length'] && !headers['content-length']) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request(url, {
      method: options.method || 'GET',
      headers,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            json: JSON.parse(body),
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function assertArtifactShape(artifact, { requireEvidence = true, requireSideEffects = true } = {}) {
  assert.ok(artifact && typeof artifact === 'object');
  assert.equal(artifact.version, 'penny-runtime-artifact.v1');
  assert.equal(typeof artifact.kind, 'string');
  assert.ok(artifact.scope && typeof artifact.scope === 'object');
  assert.ok(artifact.authority && typeof artifact.authority === 'object');
  assert.ok(artifact.summary && typeof artifact.summary === 'object');
  assert.ok(Array.isArray(artifact.evidence));
  assert.ok(Array.isArray(artifact.artifacts));
  assert.ok(Array.isArray(artifact.sideEffects));
  assert.ok(Array.isArray(artifact.reasonCodes));
  assert.ok(artifact.epistemics && typeof artifact.epistemics === 'object');
  assert.ok(Array.isArray(artifact.epistemics.signals));
  assert.ok(artifact.synthesis && typeof artifact.synthesis === 'object');
  assert.ok(Array.isArray(artifact.synthesis.evidenceSources));
  assert.ok(artifact.modelAdvisory && typeof artifact.modelAdvisory === 'object');
  assert.ok(artifact.modelAdvisory.cleanup && typeof artifact.modelAdvisory.cleanup === 'object');
  assert.ok(artifact.modelAdvisory.cleanupTransform && typeof artifact.modelAdvisory.cleanupTransform === 'object');
  assert.ok(artifact.modelAdvisory.authorityPressure && typeof artifact.modelAdvisory.authorityPressure === 'object');
  assert.ok(artifact.modelAdvisory.promptComposition && typeof artifact.modelAdvisory.promptComposition === 'object');
  assert.ok(artifact.modelAdvisory.approximatePath && typeof artifact.modelAdvisory.approximatePath === 'object');
  assert.ok(artifact.modelAdvisory.advisoryMerge && typeof artifact.modelAdvisory.advisoryMerge === 'object');
  assert.ok(artifact.modelAdvisory.turnStatePromptBridge && typeof artifact.modelAdvisory.turnStatePromptBridge === 'object');
  assert.equal(typeof artifact.modelAdvisory.cleanup.reasonCode, 'string');
  assert.equal(typeof artifact.modelAdvisory.cleanup.cleanupApplied, 'boolean');
  assert.equal(typeof artifact.modelAdvisory.cleanup.materialChange, 'boolean');
  assert.equal(typeof artifact.modelAdvisory.cleanup.reconstructedReply, 'boolean');
  assert.equal(typeof artifact.modelAdvisory.cleanup.usedReasoningFallback, 'boolean');
  assert.equal(typeof artifact.modelAdvisory.cleanupTransform.class, 'string');
  assert.ok(Array.isArray(artifact.modelAdvisory.cleanupTransform.operations));
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.canonicalFactsPresent, 'boolean');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.canonicalOverrideActive, 'boolean');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.advisoryChannelsRendered, 'number');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.advisoryItemsRendered, 'number');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.advisoryChannelsInjected, 'number');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.advisoryItemsInjected, 'number');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.sameSessionAdvisoryItems, 'number');
  assert.equal(typeof artifact.modelAdvisory.authorityPressure.crossSessionAdvisoryItems, 'number');
  assert.equal(typeof artifact.modelAdvisory.promptComposition.filledSlotCount, 'number');
  assert.equal(typeof artifact.modelAdvisory.approximatePath.status, 'string');
  assert.equal(typeof artifact.modelAdvisory.advisoryMerge.advisoryItems, 'number');
  assert.equal(typeof artifact.modelAdvisory.turnStatePromptBridge.livePromptBridge, 'boolean');
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.promptTruthExpanded, false);
  assert.ok(artifact.performance && typeof artifact.performance === 'object');
  assert.equal(typeof artifact.performance.latencyClass, 'string');
  for (const key of ['request', 'promptAssembly', 'archiveRetrieval', 'semanticRender', 'modelResolution', 'semanticProbe', 'firstToken', 'modelRoundTrip']) {
    assert.ok(artifact.performance[key] && typeof artifact.performance[key] === 'object');
  }
  assert.ok(artifact.readiness && typeof artifact.readiness === 'object');
  assert.equal(typeof artifact.readiness.chatModelReady, 'boolean');
  assert.equal(typeof artifact.readiness.toolModelReady, 'boolean');
  assert.equal(typeof artifact.readiness.embeddingReady, 'boolean');
  assert.equal(typeof artifact.readiness.fallbackActive, 'boolean');
  assert.ok(['warm', 'cold', 'degraded'].includes(artifact.readiness.warmState));
  assert.ok(artifact.timestamps && typeof artifact.timestamps === 'object');
  if (requireEvidence) assert.ok(artifact.evidence.length >= 1);
  if (requireSideEffects) assert.ok(artifact.sideEffects.length >= 1);
  for (const item of artifact.evidence) {
    assert.equal(typeof item.source, 'string');
    assert.ok(item.source.length >= 1);
  }
  for (const item of artifact.modelAdvisory.toolsUsed || []) {
    assert.ok(String(item.label || item.name || '').trim().length >= 1);
  }
}

function buildMockLmStudioReply(payload = {}) {
  const raw = JSON.stringify(payload);
  if (/tell me what you remember about my notebook/i.test(raw) || /cleanup-heavy-route-probe/i.test(raw)) {
    return 'Thinking Process:\nDraft: Fine. I remember where it goes.\n[MOOD:thinking]';
  }
  if (/route-semantic-render-bug\.js/i.test(raw)) {
    return 'Wrote tmp/route-semantic-render-bug.js with exactly console.log("hi"); [MOOD:thinking]';
  }
  if (/openclaw browser docs|browser tool/i.test(raw)) {
    return 'Browser Tool: Browser automation for websites and page interactions. [MOOD:thinking]';
  }
  if (/README\.md/i.test(raw)) {
    return 'README.md says Penny is a local companion prototype. [MOOD:thinking]';
  }
  return 'Mock Penny reply. [MOOD:thinking]';
}

function buildMockChatCompletion(body = {}, message = {}) {
  return {
    id: 'chatcmpl-mock',
    object: 'chat.completion',
    created: 0,
    model: body.model || 'unsloth/gemma-4-31b-it',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          ...message,
        },
      },
    ],
    usage: {
      prompt_tokens: 1,
      completion_tokens: 1,
      total_tokens: 2,
    },
  };
}

async function createMockLmStudioServer({ handleChatCompletion = null } = {}) {
  const stats = {
    modelsRequests: 0,
    embeddingsRequests: 0,
    chatRequests: 0,
  };
  const chatBodies = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      stats.modelsRequests += 1;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: 'unsloth/gemma-4-31b-it', object: 'model', owned_by: 'local' },
          { id: 'google/gemma-4-31b', object: 'model', owned_by: 'local' },
          { id: 'google/gemma-4-e4b', object: 'model', owned_by: 'local' },
          { id: 'text-embedding-nomic-embed-text-v1.5', object: 'model', owned_by: 'local' },
        ],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/embeddings') {
      stats.embeddingsRequests += 1;
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        model: body.model || 'text-embedding-nomic-embed-text-v1.5',
        data: [
          {
            object: 'embedding',
            index: 0,
            embedding: [0.11, 0.22, 0.33, 0.44],
          },
        ],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      stats.chatRequests += 1;
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      chatBodies.push(body);
      if (typeof handleChatCompletion === 'function') {
        const scripted = await handleChatCompletion({ body, chatBodies, stats });
        if (scripted && typeof scripted === 'object') {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(scripted));
          return;
        }
      }
      const reply = buildMockLmStudioReply(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(buildMockChatCompletion(body, {
        content: reply,
      })));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Unhandled mock LM Studio route: ${req.method} ${url.pathname}` }));
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    nativeBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    stats,
    chatBodies,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function buildProvenanceEntries(count = 0, {
  oldText = 'Favorite tea is oolong',
  newText = 'Favorite tea is lapsang souchong',
  trigger = 'actually',
  sourceEpisodeIdPrefix = 'episode',
} = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `prov-${index + 1}`,
    createdAt: `2026-04-13T12:${String(index).padStart(2, '0')}:00.000Z`,
    oldText,
    newText,
    trigger,
    sourceEpisodeId: `${sourceEpisodeIdPrefix}-${index + 1}`,
    confidence: 0.5,
  }));
}

test('GET /api/penny/status returns a health payload on an ephemeral port', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_EMBED_BASE: process.env.PENNY_LMSTUDIO_EMBED_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_BACKEND: process.env.PENNY_LOCAL_LLM_BACKEND,
    PENNY_LOCAL_RUNTIME_LABEL: process.env.PENNY_LOCAL_RUNTIME_LABEL,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
    PENNY_LOCAL_RUNTIME_PREFERRED_MODEL: process.env.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL,
    PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL: process.env.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL,
    PENNY_LOCAL_MODEL_PREFERENCE_FILE: process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE,
    PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL: process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL,
    PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL: process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL,
    PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE: process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE,
    PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK: process.env.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_API_TOKEN: process.env.PENNY_API_TOKEN,
    PENNY_WEB_SEARCH_ENABLED: process.env.PENNY_WEB_SEARCH_ENABLED,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-test-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const localPreferenceFile = path.join(tmpDir, 'penny-local-preferences.test.json');
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_EMBED_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_BACKEND = 'lm_studio';
  delete process.env.PENNY_LOCAL_RUNTIME_LABEL;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';
  process.env.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL = 'text-embedding-nomic-embed-text-v1.5';
  process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE = localPreferenceFile;
  delete process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL;
  delete process.env.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL;
  delete process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL;
  delete process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE;
  delete process.env.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK;
  delete process.env.PENNY_WEB_SEARCH_ENABLED;
  process.env.PENNY_API_TOKEN = 'route-test-token';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    assert.ok(address && typeof address === 'object' && address.port > 0);
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/status`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.name, 'Penny');
    assert.equal(response.json.backend, 'local-lmstudio');
    assert.equal(response.json.localLlmBackend, 'lm_studio');
    assert.equal(response.json.localRuntimeLabel, 'LM Studio');
    assert.equal(response.json.localEndpointBase, mockLmStudio.baseUrl);
    assert.equal(response.json.lmStudioEmbedBase, mockLmStudio.baseUrl);
    assert.equal(response.json.webSearchEnabled, false);
    assert.ok(response.json.lmStudio);
    assert.ok(Object.prototype.hasOwnProperty.call(response.json.lmStudio, 'reachable'));
    assert.ok(response.json.performance && typeof response.json.performance === 'object');
    assert.ok(response.json.readiness && typeof response.json.readiness === 'object');
    assert.ok(['warm', 'cold', 'degraded'].includes(response.json.readiness.warmState));
    assert.equal(response.json.readiness.chatModelReady, true);
    assert.equal(response.json.readiness.embeddingReady, true);
    assert.equal(response.json.readiness.cacheHit, false);
    assert.equal(response.json.performance.modelResolution.source, 'lmstudio-status');
    assert.equal(response.json.performance.semanticProbe.source, 'semantic-memory-status');

    const lmStatus = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/status`);
    assert.equal(lmStatus.statusCode, 200);
    assert.equal(lmStatus.json.chatPreferredModel, 'unsloth/gemma-4-31b-it');
    assert.equal(lmStatus.json.toolPreferredModel, 'google/gemma-4-e4b');
    assert.equal(lmStatus.json.embedPreferredModel, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(lmStatus.json.embedBase, mockLmStudio.baseUrl);
    assert.equal(lmStatus.json.localLlmBackend, 'lm_studio');
    assert.equal(lmStatus.json.localRuntimeLabel, 'LM Studio');
    assert.equal(lmStatus.json.localEndpointBase, mockLmStudio.baseUrl);
    assert.equal(lmStatus.json.routingMode, 'auto');
    assert.ok(lmStatus.json.performance && typeof lmStatus.json.performance === 'object');
    assert.ok(lmStatus.json.readiness && typeof lmStatus.json.readiness === 'object');
    assert.equal(lmStatus.json.readiness.cacheHit, true);
    assert.equal(lmStatus.json.readiness.warmState, 'warm');
    assert.equal(mockLmStudio.stats.modelsRequests, 1);
    assert.equal(mockLmStudio.stats.embeddingsRequests, 1);

    const refreshedLmStatus = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/status?refresh=1`);
    assert.equal(refreshedLmStatus.statusCode, 200);
    assert.equal(refreshedLmStatus.json.readiness.cacheHit, false);
    assert.equal(mockLmStudio.stats.modelsRequests, 2);
    assert.equal(mockLmStudio.stats.embeddingsRequests, 2);

    const updatedModel = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-test-token' },
      body: JSON.stringify({ model: 'google/gemma-4-31b' }),
    });
    assert.equal(updatedModel.statusCode, 200);
    assert.equal(updatedModel.json.runtimePreferredModel, 'google/gemma-4-31b');
    assert.equal(updatedModel.json.runtimePreferredChatModel, 'google/gemma-4-31b');
    assert.equal(updatedModel.json.chatPreferredModel, 'google/gemma-4-31b');
    assert.equal(updatedModel.json.toolPreferredModel, 'google/gemma-4-e4b');
    const savedPreference = JSON.parse(fs.readFileSync(localPreferenceFile, 'utf8'));
    assert.equal(savedPreference.localModel.runtimePreferredChatModel, 'google/gemma-4-31b');

    const updatedSetup = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-test-token' },
      body: JSON.stringify({
        chatModel: 'unsloth/gemma-4-31b-it',
        toolModel: 'google/gemma-4-31b',
        embedModel: 'text-embedding-nomic-embed-text-v1.5',
        disableModelFallback: true,
      }),
    });
    assert.equal(updatedSetup.statusCode, 200);
    assert.equal(updatedSetup.json.runtimePreferredChatModel, 'unsloth/gemma-4-31b-it');
    assert.equal(updatedSetup.json.runtimePreferredToolModel, 'google/gemma-4-31b');
    assert.equal(updatedSetup.json.runtimePreferredEmbedModel, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(updatedSetup.json.embedPreferredModel, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(updatedSetup.json.chatPreferredModel, 'unsloth/gemma-4-31b-it');
    assert.equal(updatedSetup.json.toolPreferredModel, 'google/gemma-4-31b');
    assert.equal(updatedSetup.json.modelFallbackDisabled, true);
    const savedSetupPreference = JSON.parse(fs.readFileSync(localPreferenceFile, 'utf8'));
    assert.equal(savedSetupPreference.localModel.runtimePreferredChatModel, 'unsloth/gemma-4-31b-it');
    assert.equal(savedSetupPreference.localModel.runtimePreferredToolModel, 'google/gemma-4-31b');
    assert.equal(savedSetupPreference.localModel.runtimePreferredEmbedModel, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(savedSetupPreference.localModel.disableModelFallback, true);

    const rejectedEmbedModel = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-test-token' },
      body: JSON.stringify({ model: 'text-embedding-nomic-embed-text-v1.5' }),
    });
    assert.equal(rejectedEmbedModel.statusCode, 400);
    assert.match(rejectedEmbedModel.json.error, /Embedding models cannot be used/i);

    const toolTurn = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-tool-lane-test',
        messages: [
          { role: 'user', content: 'Open README.md and do not edit anything. Just tell me what it says.' },
        ],
        memories: { brainMode: 'local' },
      }),
    });
    assert.equal(toolTurn.statusCode, 200);
    assert.equal(toolTurn.json.meta.localLane, 'tool');
    assert.equal(toolTurn.json.meta.requestedModel, 'google/gemma-4-31b');
    assert.equal(toolTurn.json.meta.resolvedModel, '');
    assert.equal(toolTurn.json.meta.executionPath, 'deterministic-tool');
    assert.equal(toolTurn.json.meta.researchLedgerRendered, false);
    assert.equal(toolTurn.json.meta.researchLedgerPromptInjected, false);
    assert.equal(toolTurn.json.meta.researchLedgerPromptInjected, toolTurn.json.meta.researchLedgerRendered);
    assert.equal(toolTurn.json.meta.researchLedgerUpdate.status, 'applied');
    assert.equal(typeof toolTurn.json.meta.semanticMemoryReady, 'boolean');
    assert.equal(typeof toolTurn.json.meta.semanticMemoryMode, 'string');
    assert.equal(typeof toolTurn.json.meta.laneFallback, 'boolean');
    assert.ok(toolTurn.json.meta.performance && typeof toolTurn.json.meta.performance === 'object');
    assert.ok(toolTurn.json.meta.readiness && typeof toolTurn.json.meta.readiness === 'object');
    assert.equal(toolTurn.json.meta.performance.latencyClass, 'tool-heavy');
    assert.equal(toolTurn.json.meta.performance.modelRoundTrip.available, false);
    assert.equal(toolTurn.json.meta.readiness.modelUsage, 'not-used');
    assert.equal(toolTurn.json.meta.readiness.toolModelReady, true);
    assertArtifactShape(toolTurn.json.meta.artifact);
    assert.equal(toolTurn.json.meta.artifact.scope.selectedLane, 'tool');
    assert.equal(toolTurn.json.meta.artifact.executionPath, 'deterministic-tool');
    assert.equal(toolTurn.json.meta.artifact.context.resolvedModel, '');
    assert.equal(toolTurn.json.meta.artifact.researchLedgerRendered, false);
    assert.equal(toolTurn.json.meta.artifact.researchLedgerPromptInjected, false);
    assert.equal(toolTurn.json.meta.artifact.researchLedgerPromptInjected, toolTurn.json.meta.artifact.researchLedgerRendered);
    assert.equal(toolTurn.json.meta.artifact.authority.reply, 'verified-tool-evidence');
    assert.equal(toolTurn.json.meta.artifact.epistemics.enabled, false);
    assert.equal(toolTurn.json.meta.artifact.synthesis.generated, false);
    assert.equal(toolTurn.json.meta.artifact.evidence.some((item) => item.source === 'verified-tool'), true);
    assert.equal(toolTurn.json.meta.artifact.modelAdvisory.toolsUsed.some((item) => String(item.label || '').trim().length >= 1), true);

    const seededCleanupMemory = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-test-token' },
      body: JSON.stringify({
        sessionId: 'route-cleanup-probe',
        memory: {
          brainMode: 'local',
          memories: [
            { text: 'My coding notebook stays left of the keyboard.', kind: 'explicit', source: 'explicit', ts: Date.UTC(2026, 3, 16) },
          ],
        },
      }),
    });
    assert.equal(seededCleanupMemory.statusCode, 200);

    const cleanupTurn = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-cleanup-probe',
        messages: [
          { role: 'user', content: 'Tell me what you remember about my notebook.' },
        ],
        memories: { brainMode: 'local' },
      }),
    });
    assert.equal(cleanupTurn.statusCode, 200);
    assertArtifactShape(cleanupTurn.json.meta.artifact);
    assert.equal(cleanupTurn.json.meta.artifact.modelAdvisory.cleanup.cleanupApplied, true);
    assert.equal(cleanupTurn.json.meta.artifact.modelAdvisory.cleanup.reconstructedReply, true);
    assert.equal(cleanupTurn.json.meta.artifact.modelAdvisory.cleanupTransform.class, 'salvage-reconstruction');
    assert.equal(cleanupTurn.json.meta.artifact.modelAdvisory.authorityPressure.canonicalFactsPresent, true);
    assert.equal(cleanupTurn.json.meta.artifact.modelAdvisory.authorityPressure.canonicalOverrideActive, true);
    assert.equal(cleanupTurn.json.meta.artifact.modelAdvisory.promptComposition.lane, 'chat');
    assert.equal(typeof cleanupTurn.json.meta.artifact.modelAdvisory.approximatePath.policyMode, 'string');
    assert.equal(typeof cleanupTurn.json.meta.artifact.modelAdvisory.advisoryMerge.lossyItems, 'number');

    const inspectorTurn = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=route-cleanup-probe`);
    assert.equal(inspectorTurn.statusCode, 200);
    assertArtifactShape(inspectorTurn.json.inspector.artifact, { requireEvidence: false });
    assert.equal(inspectorTurn.json.inspector.artifact.modelAdvisory.cleanup.cleanupApplied, true);
    assert.equal(inspectorTurn.json.inspector.artifact.modelAdvisory.authorityPressure.canonicalFactsPresent, true);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_BASE == null) delete process.env.PENNY_LMSTUDIO_EMBED_BASE; else process.env.PENNY_LMSTUDIO_EMBED_BASE = originalEnv.PENNY_LMSTUDIO_EMBED_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_BACKEND == null) delete process.env.PENNY_LOCAL_LLM_BACKEND; else process.env.PENNY_LOCAL_LLM_BACKEND = originalEnv.PENNY_LOCAL_LLM_BACKEND;
    if (originalEnv.PENNY_LOCAL_RUNTIME_LABEL == null) delete process.env.PENNY_LOCAL_RUNTIME_LABEL; else process.env.PENNY_LOCAL_RUNTIME_LABEL = originalEnv.PENNY_LOCAL_RUNTIME_LABEL;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_CHAT_MODEL == null) delete process.env.PENNY_LMSTUDIO_CHAT_MODEL; else process.env.PENNY_LMSTUDIO_CHAT_MODEL = originalEnv.PENNY_LMSTUDIO_CHAT_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    if (originalEnv.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL == null) delete process.env.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL; else process.env.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL = originalEnv.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL;
    if (originalEnv.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL == null) delete process.env.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL; else process.env.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL = originalEnv.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL;
    if (originalEnv.PENNY_LOCAL_MODEL_PREFERENCE_FILE == null) delete process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE; else process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE = originalEnv.PENNY_LOCAL_MODEL_PREFERENCE_FILE;
    if (originalEnv.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL == null) delete process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL; else process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL = originalEnv.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE == null) delete process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE; else process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE = originalEnv.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE;
    if (originalEnv.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK == null) delete process.env.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK; else process.env.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK = originalEnv.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_WEB_SEARCH_ENABLED == null) delete process.env.PENNY_WEB_SEARCH_ENABLED; else process.env.PENNY_WEB_SEARCH_ENABLED = originalEnv.PENNY_WEB_SEARCH_ENABLED;
    if (originalEnv.PENNY_API_TOKEN == null) delete process.env.PENNY_API_TOKEN; else process.env.PENNY_API_TOKEN = originalEnv.PENNY_API_TOKEN;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('public chat route integration: request to mocked model to rendered reply to persisted lastRoute', async () => {
  const envKeys = [
    'PORT',
    'PENNY_MEMORY_FILE',
    'PENNY_MEMORY_ARCHIVE_FILE',
    'PENNY_MEMORY_EMBEDDINGS_FILE',
    'PENNY_MEMORY_BOOKS_FILE',
    'PENNY_LMSTUDIO_BASE',
    'PENNY_LMSTUDIO_EMBED_BASE',
    'PENNY_LMSTUDIO_NATIVE_BASE',
    'PENNY_LOCAL_LLM_BACKEND',
    'PENNY_LOCAL_RUNTIME_LABEL',
    'PENNY_LOCAL_LLM_TRANSPORT',
    'PENNY_LMSTUDIO_MODELS_PROBE_MS',
    'PENNY_LMSTUDIO_CHAT_MODEL',
    'PENNY_LMSTUDIO_TOOL_MODEL',
    'PENNY_LMSTUDIO_EMBED_MODEL',
    'PENNY_LOCAL_MODEL_PREFERENCE_FILE',
    'PENNY_ENABLE_BACKGROUND_CHAT_VECTORS',
    'PENNY_WEB_SEARCH_ENABLED',
    'PENNY_API_TOKEN',
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-full-chat-route-'));
  const mockLmStudio = await createMockLmStudioServer({
    handleChatCompletion({ body }) {
      return buildMockChatCompletion(body, {
        content: 'Full route integration reply rendered cleanly. [MOOD:calm]',
      });
    },
  });

  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = path.join(tmpDir, 'penny-memory.test.json');
  process.env.PENNY_MEMORY_ARCHIVE_FILE = path.join(tmpDir, 'penny-memory-archive.test.json');
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  process.env.PENNY_MEMORY_BOOKS_FILE = path.join(tmpDir, 'penny-memory-books.test.json');
  process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE = path.join(tmpDir, 'penny-local-preferences.test.json');
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_EMBED_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_BACKEND = 'lm_studio';
  delete process.env.PENNY_LOCAL_RUNTIME_LABEL;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';
  process.env.PENNY_ENABLE_BACKGROUND_CHAT_VECTORS = '0';
  process.env.PENNY_WEB_SEARCH_ENABLED = '0';
  delete process.env.PENNY_API_TOKEN;

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    assert.ok(address && typeof address === 'object' && address.port > 0);

    const chat = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'full-route-integration',
        messages: [
          { role: 'user', content: 'Say good morning in one sentence.' },
        ],
        memories: { brainMode: 'local', memories: [] },
      }),
    });

    assert.equal(chat.statusCode, 200);
    assert.match(chat.json.text, /Full route integration reply rendered cleanly/i);
    assert.equal(chat.json.meta.localLane, 'chat');
    assert.equal(chat.json.meta.resolvedModel, 'unsloth/gemma-4-31b-it');
    assert.equal(chat.json.meta.artifact.scope.route, '/api/penny/chat');
    assert.equal(chat.json.meta.artifact.scope.selectedLane, 'chat');
    assert.equal(mockLmStudio.stats.chatRequests, 1);
    assert.equal(mockLmStudio.chatBodies[0].model, 'unsloth/gemma-4-31b-it');

    const stored = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory?sessionId=full-route-integration`,
    );
    assert.equal(stored.statusCode, 200);
    assert.equal(stored.json.memory?.lastRoute?.artifact?.scope?.route, '/api/penny/chat');
    assert.equal(stored.json.memory?.lastRoute?.artifact?.scope?.selectedLane, 'chat');
    assert.equal(stored.json.memory?.lastRoute?.artifact?.context?.resolvedModel, 'unsloth/gemma-4-31b-it');
    assert.match(stored.json.memory?.lastRoute?.artifact?.summary?.text || '', /ordinary turn|chat/i);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('server loads runtime settings from PENNY_ENV_FILE before constants are read', async () => {
  const envKeys = [
    'PORT',
    'HOST',
    'PENNY_ENV_FILE',
    'PENNY_MEMORY_FILE',
    'PENNY_MEMORY_ARCHIVE_FILE',
    'PENNY_MEMORY_EMBEDDINGS_FILE',
    'PENNY_MEMORY_BOOKS_FILE',
    'PENNY_LMSTUDIO_BASE',
    'PENNY_LMSTUDIO_NATIVE_BASE',
    'PENNY_LOCAL_LLM_TRANSPORT',
    'PENNY_LMSTUDIO_MODELS_PROBE_MS',
    'PENNY_LMSTUDIO_CHAT_MODEL',
    'PENNY_LMSTUDIO_TOOL_MODEL',
    'PENNY_LMSTUDIO_EMBED_MODEL',
    'PENNY_LOCAL_MODEL_PREFERENCE_FILE',
    'PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE',
    'PENNY_LOCAL_RUNTIME_PREFERRED_MODEL',
    'PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL',
    'PENNY_LAN_SHARE',
    'PENNY_API_TOKEN',
    'PENNY_WEB_SEARCH_ENABLED',
    'PENNY_ENABLE_DIRECT_WORKSPACE_WRITES',
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-env-route-'));
  const envFile = path.join(tmpDir, '.env');
  const repoTempFile = path.join(__dirname, '..', 'tmp', 'env-loader-direct-write.js');
  const mockLmStudio = await createMockLmStudioServer();

  try {
    for (const key of envKeys) delete process.env[key];
    fs.mkdirSync(path.dirname(repoTempFile), { recursive: true });
    if (fs.existsSync(repoTempFile)) fs.rmSync(repoTempFile, { force: true });
    fs.writeFileSync(envFile, [
      'PORT=0',
      'HOST=127.0.0.1',
      `PENNY_MEMORY_FILE=${path.join(tmpDir, 'penny-memory.test.json')}`,
      `PENNY_MEMORY_ARCHIVE_FILE=${path.join(tmpDir, 'penny-memory-archive.test.json')}`,
      `PENNY_MEMORY_EMBEDDINGS_FILE=${path.join(tmpDir, 'penny-memory-embeddings.test.json')}`,
      `PENNY_MEMORY_BOOKS_FILE=${path.join(tmpDir, 'penny-memory-books.test.json')}`,
      `PENNY_LMSTUDIO_BASE=${mockLmStudio.baseUrl}`,
      `PENNY_LMSTUDIO_NATIVE_BASE=${mockLmStudio.nativeBaseUrl}`,
      'PENNY_LOCAL_LLM_TRANSPORT=chat',
      'PENNY_LMSTUDIO_MODELS_PROBE_MS=1500',
      'PENNY_LMSTUDIO_CHAT_MODEL=google/gemma-4-31b',
      'PENNY_LMSTUDIO_TOOL_MODEL=google/gemma-4-e4b',
      'PENNY_LMSTUDIO_EMBED_MODEL=text-embedding-nomic-embed-text-v1.5',
      `PENNY_LOCAL_MODEL_PREFERENCE_FILE=${path.join(tmpDir, 'penny-local-preferences.test.json')}`,
      'PENNY_LAN_SHARE=1',
      'PENNY_API_TOKEN=env-route-token',
      'PENNY_WEB_SEARCH_ENABLED=1',
      'PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1',
    ].join('\n'));
    process.env.PENNY_ENV_FILE = envFile;

    const modulePath = require.resolve('../server.js');
    delete require.cache[modulePath];
    const serverModule = require('../server.js');
    const started = serverModule.startServer({ port: 0, silent: true });

    try {
      await new Promise((resolve, reject) => {
        if (started.listening) {
          resolve();
          return;
        }
        started.once('listening', resolve);
        started.once('error', reject);
      });

      const address = started.address();
      const statusUrl = `http://127.0.0.1:${address.port}/api/penny/status`;
      const unauthorized = await requestJson(statusUrl);
      assert.equal(unauthorized.statusCode, 401);
      assert.equal(unauthorized.json.code, 'token_required');

      const authorized = await requestJson(statusUrl, {
        headers: { Authorization: 'Bearer env-route-token' },
      });
      assert.equal(authorized.statusCode, 200);
      assert.equal(authorized.json.webSearchEnabled, true);
      assert.equal(authorized.json.lmStudioBase, mockLmStudio.baseUrl);
      assert.equal(authorized.json.lmStudio.configuredChatModel, 'google/gemma-4-31b');
      assert.equal(authorized.json.lmStudio.chatPreferredModel, 'google/gemma-4-31b');
      assert.equal(authorized.json.lmStudio.toolPreferredModel, 'google/gemma-4-e4b');

      const writeTurn = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer env-route-token',
        },
        body: JSON.stringify({
          sessionId: 'env-loader-direct-write',
          messages: [
            { role: 'user', content: 'Write tmp/env-loader-direct-write.js with exactly this line: console.log("env loaded");' },
          ],
          memories: { brainMode: 'local' },
        }),
      });
      assert.equal(writeTurn.statusCode, 200);
      assert.equal(fs.existsSync(repoTempFile), true);
    } finally {
      await new Promise((resolve) => started.close(() => resolve()));
      delete require.cache[modulePath];
    }
  } finally {
    await mockLmStudio.close();
    if (fs.existsSync(repoTempFile)) fs.rmSync(repoTempFile, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('chat route injects the turn-state prompt bridge only when the flag is enabled', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
    PENNY_ENABLE_TURN_STATE_PROMPT: process.env.PENNY_ENABLE_TURN_STATE_PROMPT,
    PENNY_TURN_STATE_MAX_TOKENS: process.env.PENNY_TURN_STATE_MAX_TOKENS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-turn-state-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const mockLmStudio = await createMockLmStudioServer({
    handleChatCompletion({ body }) {
      return buildMockChatCompletion(body, {
        content: 'I will keep this as a detailed roadmap and stay source-aware. [MOOD:thinking]',
      });
    },
  });
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';
  process.env.PENNY_ENABLE_TURN_STATE_PROMPT = '1';
  process.env.PENNY_TURN_STATE_MAX_TOKENS = '70';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-turn-state-live',
        messages: [
          {
            role: 'user',
            content: 'Long detailed answers are heaven. Please give me a detailed roadmap and keep PromptTruth unchanged.',
          },
        ],
        memories: { brainMode: 'local' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.meta.localLane, 'chat');
    assert.equal(mockLmStudio.chatBodies.length, 1);
    const requestPrompt = JSON.stringify(mockLmStudio.chatBodies[0]);
    assert.match(requestPrompt, /Wake state - current turn state \(ephemeral\):/);
    assert.match(requestPrompt, /Turn state, ephemeral \(persist=false\)/);
    assert.match(requestPrompt, /extensive technical roadmap/);
    assert.match(requestPrompt, /PromptTruth unchanged/);

    const bridge = response.json.meta.artifact.modelAdvisory.turnStatePromptBridge;
    assert.equal(bridge.schema, 'penny-turn-state-prompt-bridge.v1');
    assert.equal(bridge.enabled, true);
    assert.equal(bridge.measurementMode, 'live-prompt');
    assert.equal(bridge.turnStateMeasurementMode, 'ephemeral');
    assert.equal(bridge.persist, false);
    assert.equal(bridge.livePromptBridge, true);
    assert.equal(bridge.renderedCount, 1);
    assert.equal(bridge.maxTokens, 70);
    assert.doesNotMatch(bridge.promptBridge.promptText, /hidden reasoning|private inference|energy evidence/i);
    assert.equal(bridge.turnStateSummary.userIntent, undefined);
    assert.equal(bridge.promptTruthExpanded, false);
    assert.equal(bridge.promptTruthChannelAdded, false);
    assert.equal(bridge.toolEvidenceReceiptChanged, false);
    assert.equal(bridge.memoryWrites, false);
    assert.equal(bridge.retentionPolicy.fullStateStored, false);
    assert.equal(bridge.retentionPolicy.summaryStored, true);
    assert.ok(bridge.retentionPolicy.omittedFields.includes('userIntent'));
    assert.ok(bridge.retentionPolicy.omittedFields.includes('energy.evidence'));
    assert.equal(Object.prototype.hasOwnProperty.call(response.json.meta.artifact.promptTruth.channels, 'turnStatePromptBridge'), false);

    const storedMemory = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory?sessionId=route-turn-state-live`,
    );
    assert.equal(storedMemory.statusCode, 200);
    const storedBridge = storedMemory.json.memory?.lastRoute?.artifact?.modelAdvisory?.turnStatePromptBridge;
    assert.equal(storedBridge?.renderedCount, 1);
    assert.equal(storedBridge?.retentionPolicy?.fullStateStored, false);
    assert.equal(storedBridge?.turnStateSummary?.userIntent, undefined);
    assert.doesNotMatch(JSON.stringify(storedBridge), /Long detailed answers are heaven/i);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_CHAT_MODEL == null) delete process.env.PENNY_LMSTUDIO_CHAT_MODEL; else process.env.PENNY_LMSTUDIO_CHAT_MODEL = originalEnv.PENNY_LMSTUDIO_CHAT_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    if (originalEnv.PENNY_ENABLE_TURN_STATE_PROMPT == null) delete process.env.PENNY_ENABLE_TURN_STATE_PROMPT; else process.env.PENNY_ENABLE_TURN_STATE_PROMPT = originalEnv.PENNY_ENABLE_TURN_STATE_PROMPT;
    if (originalEnv.PENNY_TURN_STATE_MAX_TOKENS == null) delete process.env.PENNY_TURN_STATE_MAX_TOKENS; else process.env.PENNY_TURN_STATE_MAX_TOKENS = originalEnv.PENNY_TURN_STATE_MAX_TOKENS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('shadow chat route uses the same runtime artifact contract on fallback replies', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-shadow-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat/shadow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-shadow-fallback-test',
        messages: [
          { role: 'user', content: 'Tell me something nice about README.md.' },
        ],
        memories: { brainMode: 'shadow' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.usedFallback, true);
    assert.equal(response.json.meta.requestedMode, 'shadow');
    assert.equal(response.json.meta.localLane, 'shadow');
    assert.equal(response.json.meta.shadowAvailable, false);
    assertArtifactShape(response.json.meta.artifact);
    assert.equal(response.json.meta.artifact.scope.selectedLane, 'shadow');
    assert.equal(response.json.meta.artifact.scope.requestedMode, 'shadow');
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_CHAT_MODEL == null) delete process.env.PENNY_LMSTUDIO_CHAT_MODEL; else process.env.PENNY_LMSTUDIO_CHAT_MODEL = originalEnv.PENNY_LMSTUDIO_CHAT_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('direct write route survives semantic-render gating on side-effecting turns', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_ENABLE_DIRECT_WORKSPACE_WRITES: process.env.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-write-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const repoTempFile = path.join(__dirname, '..', 'tmp', 'route-semantic-render-bug.js');
  const mockLmStudio = await createMockLmStudioServer();
  fs.mkdirSync(path.dirname(repoTempFile), { recursive: true });
  if (fs.existsSync(repoTempFile)) fs.rmSync(repoTempFile, { force: true });

  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES = '1';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-semantic-render-bug',
        messages: [
          { role: 'user', content: 'Write tmp/route-semantic-render-bug.js with exactly this line: console.log("hi");' },
        ],
        memories: { brainMode: 'local' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.meta.localLane, 'tool');
    assert.match(response.json.text, /tmp\/route-semantic-render-bug\.js/i);
    assert.equal(fs.existsSync(repoTempFile), true);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES == null) delete process.env.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES; else process.env.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES = originalEnv.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (fs.existsSync(repoTempFile)) fs.rmSync(repoTempFile, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('public chat route persists tool-loop and semantic_render receipt items into lastRoute and inspector without widening PromptTruth', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-tool-evidence-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const userPrompt = 'Compare README.md with docs/README.md and tell me the short takeaway.';
  const mockLmStudio = await createMockLmStudioServer({
    async handleChatCompletion({ body }) {
      const messages = Array.isArray(body?.messages) ? body.messages : [];
      const raw = JSON.stringify(body);
      const semanticPrompt = messages.find((message) => /Verified semantic core:/i.test(String(message?.content || '')));
      if (semanticPrompt) {
        return buildMockChatCompletion(body, {
          content: 'README.md frames Penny as the local companion prototype, and docs/README.md is the docs authority map.\n[MOOD:thinking]',
        });
      }
      if (!new RegExp(userPrompt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(raw)) {
        return null;
      }
      const hasToolResults = messages.some((message) => message?.role === 'tool');
      if (!hasToolResults) {
        return buildMockChatCompletion(body, {
          content: '',
          tool_calls: [
            {
              id: 'call-readme',
              type: 'function',
              function: {
                name: 'read_project_file',
                arguments: JSON.stringify({ path: 'README.md' }),
              },
            },
            {
              id: 'call-docs-readme',
              type: 'function',
              function: {
                name: 'read_project_file',
                arguments: JSON.stringify({ path: 'docs/README.md' }),
              },
            },
          ],
        });
      }
      return buildMockChatCompletion(body, {
        content: 'README says Penny is the local companion prototype, and docs/README is the docs authority map.\n[MOOD:thinking]',
        tool_calls: [],
      });
    },
  });

  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-tool-evidence-semantic',
        messages: [
          { role: 'user', content: userPrompt },
        ],
        memories: { brainMode: 'local' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.meta.localLane, 'tool');
    assert.equal(response.json.meta.executionPath, 'llm-tool-loop');
    assertArtifactShape(response.json.meta.artifact);

    const artifact = response.json.meta.artifact;
    const receipt = artifact.toolEvidenceReceipt;
    assert.ok(receipt && typeof receipt === 'object');
    assert.equal(receipt.schema, 'penny-tool-evidence-receipt.v1');

    const nativeLoopItems = receipt.items.filter((item = {}) => (
      item.path === 'native_tool_loop'
      && item.promptVisibility === 'prompt_visible'
      && item.renderForm === 'raw_json'
      && item.modelHop === 'multi'
    ));
    assert.equal(nativeLoopItems.length, 2);
    assert.deepEqual(
      nativeLoopItems
        .map((item) => String(item?.sourceRefs?.[0]?.target || ''))
        .sort(),
      ['README.md', 'docs/README.md'],
    );

    const semanticRenderItems = receipt.items.filter((item = {}) => (
      item.path === 'semantic_render'
      && item.promptVisibility === 'prompt_visible'
      && item.renderForm === 'summarized_semantic_core'
      && item.modelHop === 'single'
    ));
    assert.equal(semanticRenderItems.length, 1);
    assert.deepEqual(
      semanticRenderItems[0].sourceRefs.map((entry) => entry.target).sort(),
      ['README.md', 'docs/README.md'],
    );

    assert.equal(receipt.summary.itemCount, 3);
    assert.equal(receipt.summary.promptVisibleItemCount, 3);
    assert.equal(receipt.summary.rawJsonItemCount, 2);
    assert.equal(receipt.summary.summarizedItemCount, 1);
    assert.equal(receipt.summary.multiHopItemCount, 2);

    assert.equal(artifact.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'toolEvidence'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth, 'toolEvidenceReceipt'), false);
    assert.equal(artifact.modelAdvisory.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(Object.prototype.hasOwnProperty.call(artifact.modelAdvisory.promptTruth.channels, 'toolEvidence'), false);

    const storedMemory = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory?sessionId=route-tool-evidence-semantic`,
    );
    assert.equal(storedMemory.statusCode, 200);
    const storedArtifact = storedMemory.json.memory?.lastRoute?.artifact;
    assertArtifactShape(storedArtifact);
    assert.deepEqual(storedArtifact.toolEvidenceReceipt, receipt);
    assert.equal(storedArtifact.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(Object.prototype.hasOwnProperty.call(storedArtifact.promptTruth.channels, 'toolEvidence'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(storedArtifact.promptTruth, 'toolEvidenceReceipt'), false);

    const inspectorResponse = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=route-tool-evidence-semantic`,
    );
    assert.equal(inspectorResponse.statusCode, 200);
    assertArtifactShape(inspectorResponse.json.inspector.artifact);
    assert.deepEqual(inspectorResponse.json.inspector.artifact.toolEvidenceReceipt, receipt);
    assert.deepEqual(inspectorResponse.json.inspector.routing.artifact.toolEvidenceReceipt, receipt);
    assert.equal(inspectorResponse.json.inspector.artifact.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(
      Object.prototype.hasOwnProperty.call(inspectorResponse.json.inspector.artifact.promptTruth.channels, 'toolEvidence'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(inspectorResponse.json.inspector.artifact.promptTruth, 'toolEvidenceReceipt'),
      false,
    );

    assert.equal(mockLmStudio.stats.chatRequests, 3);
    const semanticPrompt = mockLmStudio.chatBodies
      .flatMap((body) => (Array.isArray(body?.messages) ? body.messages : []))
      .find((message) => /Verified semantic core:/i.test(String(message?.content || '')));
    assert.ok(semanticPrompt);
    assert.match(String(semanticPrompt.content || ''), /Tool: read_project_file/i);
    assert.match(String(semanticPrompt.content || ''), /README\.md/i);
    assert.match(String(semanticPrompt.content || ''), /docs\/README\.md/i);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_CHAT_MODEL == null) delete process.env.PENNY_LMSTUDIO_CHAT_MODEL; else process.env.PENNY_LMSTUDIO_CHAT_MODEL = originalEnv.PENNY_LMSTUDIO_CHAT_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('seeded persisted lastRoute toolEvidenceReceipt survives disk readback into memory and inspector without a chat turn', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-seeded-tool-evidence-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const seededSessionId = 'seeded-route-tool-evidence-readback';
  const oldSessionId = 'seeded-route-tool-evidence-old-artifact';
  const seededPromptTruth = {
    schema: 'penny-prompttruth.v1',
    canonicalFactsPresent: false,
    canonicalOverrideActive: false,
    channels: {
      stableFacts: { state: 'no_candidate', renderedCount: 0, candidateCount: 0, heldBackReason: '' },
      memoryBooks: { state: 'no_candidate', renderedCount: 0, candidateCount: 0, heldBackReason: '' },
      sessionArchive: { state: 'no_candidate', renderedCount: 0, candidateCount: 0, heldBackReason: '' },
      globalArchive: { state: 'no_candidate', renderedCount: 0, candidateCount: 0, heldBackReason: '' },
      researchLedger: { state: 'no_candidate', renderedCount: 0, candidateCount: 0, heldBackReason: '' },
    },
  };
  const seededReceipt = {
    schema: 'penny-tool-evidence-receipt.v1',
    summary: {
      toolRecordCount: 2,
      itemCount: 2,
      promptVisibleItemCount: 2,
      deterministicOnlyItemCount: 0,
      provenanceOnlyItemCount: 0,
      unknownItemCount: 0,
      rawJsonItemCount: 1,
      autoVerificationItemCount: 0,
      summarizedItemCount: 1,
      multiHopItemCount: 1,
    },
    items: [
      {
        path: 'native_tool_loop',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'raw_json',
        modelHop: 'multi',
        sourceRefs: [
          { toolRecordIndex: 0, toolName: 'read_project_file', target: 'README.md' },
        ],
        truncated: false,
      },
      {
        path: 'semantic_render',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'summarized_semantic_core',
        modelHop: 'single',
        sourceRefs: [
          { toolRecordIndex: 0, toolName: 'read_project_file', target: 'README.md' },
          { toolRecordIndex: 1, toolName: 'read_project_file', target: 'docs/README.md' },
        ],
        truncated: false,
      },
    ],
  };
  const seededArtifact = {
    version: 'penny-runtime-artifact.v1',
    kind: 'tool-turn',
    executionPath: 'llm-tool-loop',
    scope: {
      sessionId: seededSessionId,
      route: '/api/penny/chat',
      requestedMode: 'local',
      selectedLane: 'tool',
    },
    authority: {
      reply: 'verified-tool-evidence',
      memory: 'explicit-canonical',
      archive: 'advisory',
      toolClaims: 'verified-required',
    },
    summary: {
      label: 'tool-turn',
      text: 'Seeded tool-evidence receipt persisted on disk.',
      backend: 'local-lmstudio-tools',
    },
    context: {
      backend: 'local-lmstudio-tools',
      requestedModel: 'google/gemma-4-e4b',
      resolvedModel: 'google/gemma-4-e4b',
      executionPath: 'llm-tool-loop',
      semanticMemoryReady: true,
      semanticMemoryMode: 'semantic',
      usedFallback: false,
      laneFallback: false,
      shadowEnabled: false,
    },
    promptTruth: seededPromptTruth,
    toolEvidenceReceipt: seededReceipt,
  };
  const oldArtifact = {
    version: 'penny-runtime-artifact.v1',
    kind: 'tool-turn',
    executionPath: 'llm-tool-loop',
    scope: {
      sessionId: oldSessionId,
      route: '/api/penny/chat',
      requestedMode: 'local',
      selectedLane: 'tool',
    },
    authority: {
      reply: 'verified-tool-evidence',
      memory: 'explicit-canonical',
      archive: 'advisory',
      toolClaims: 'verified-required',
    },
    summary: {
      label: 'tool-turn',
      text: 'Older artifact seeded without a receipt.',
      backend: 'local-lmstudio-tools',
    },
    context: {
      backend: 'local-lmstudio-tools',
      requestedModel: 'google/gemma-4-e4b',
      resolvedModel: 'google/gemma-4-e4b',
      executionPath: 'llm-tool-loop',
      semanticMemoryReady: false,
      semanticMemoryMode: 'disabled',
      usedFallback: false,
      laneFallback: false,
      shadowEnabled: false,
    },
    promptTruth: seededPromptTruth,
  };

  fs.writeFileSync(memoryFile, `${JSON.stringify({
    sessions: {
      [seededSessionId]: {
        sessionId: seededSessionId,
        userName: 'Malac',
        memories: [],
        voiceOn: false,
        brainMode: 'local',
        lastRoute: {
          sessionId: seededSessionId,
          selectedLane: 'tool',
          requestedMode: 'local',
          reason: 'seeded-persisted-readback',
          backend: 'local-lmstudio-tools',
          executionPath: 'llm-tool-loop',
          usedFallback: false,
          laneFallback: false,
          requestedModel: 'google/gemma-4-e4b',
          resolvedModel: 'google/gemma-4-e4b',
          semanticMemoryReady: true,
          semanticMemoryMode: 'semantic',
          promptTruth: seededPromptTruth,
          artifact: seededArtifact,
          usedAt: '2026-04-19T22:11:00.000Z',
        },
        updatedAt: '2026-04-19T22:11:00.000Z',
      },
      [oldSessionId]: {
        sessionId: oldSessionId,
        userName: 'Malac',
        memories: [],
        voiceOn: false,
        brainMode: 'local',
        lastRoute: {
          sessionId: oldSessionId,
          selectedLane: 'tool',
          requestedMode: 'local',
          reason: 'seeded-old-artifact',
          backend: 'local-lmstudio-tools',
          executionPath: 'llm-tool-loop',
          usedFallback: false,
          laneFallback: false,
          requestedModel: 'google/gemma-4-e4b',
          resolvedModel: 'google/gemma-4-e4b',
          semanticMemoryReady: false,
          semanticMemoryMode: 'disabled',
          promptTruth: seededPromptTruth,
          artifact: oldArtifact,
          usedAt: '2026-04-19T22:12:00.000Z',
        },
        updatedAt: '2026-04-19T22:12:00.000Z',
      },
    },
  }, null, 2)}\n`);

  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const memoryResponse = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory?sessionId=${seededSessionId}`,
    );
    assert.equal(memoryResponse.statusCode, 200);
    const storedArtifact = memoryResponse.json.memory?.lastRoute?.artifact;
    assertArtifactShape(storedArtifact);
    assert.deepEqual(storedArtifact.toolEvidenceReceipt, seededReceipt);
    assert.equal(storedArtifact.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(Object.prototype.hasOwnProperty.call(storedArtifact.promptTruth.channels, 'toolEvidence'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(storedArtifact.promptTruth, 'toolEvidenceReceipt'), false);
    assert.equal(storedArtifact.toolEvidenceReceipt.items.filter((item) => item.path === 'native_tool_loop').length, 1);
    assert.equal(storedArtifact.toolEvidenceReceipt.items.filter((item) => item.path === 'semantic_render').length, 1);

    const inspectorResponse = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=${seededSessionId}`,
    );
    assert.equal(inspectorResponse.statusCode, 200);
    assertArtifactShape(inspectorResponse.json.inspector.artifact);
    assert.deepEqual(inspectorResponse.json.inspector.artifact.toolEvidenceReceipt, seededReceipt);
    assert.deepEqual(inspectorResponse.json.inspector.routing.artifact.toolEvidenceReceipt, seededReceipt);
    assert.equal(inspectorResponse.json.inspector.artifact.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(
      Object.prototype.hasOwnProperty.call(inspectorResponse.json.inspector.artifact.promptTruth.channels, 'toolEvidence'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(inspectorResponse.json.inspector.artifact.promptTruth, 'toolEvidenceReceipt'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(inspectorResponse.json.inspector.routing.artifact.promptTruth.channels, 'toolEvidence'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(inspectorResponse.json.inspector.routing.artifact.promptTruth, 'toolEvidenceReceipt'),
      false,
    );

    const oldMemoryResponse = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory?sessionId=${oldSessionId}`,
    );
    assert.equal(oldMemoryResponse.statusCode, 200);
    const oldStoredArtifact = oldMemoryResponse.json.memory?.lastRoute?.artifact;
    assertArtifactShape(oldStoredArtifact);
    assert.equal(oldStoredArtifact.toolEvidenceReceipt, null);
    assert.equal(oldStoredArtifact.promptTruth.schema, 'penny-prompttruth.v1');
    assert.equal(Object.prototype.hasOwnProperty.call(oldStoredArtifact.promptTruth.channels, 'toolEvidence'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(oldStoredArtifact.promptTruth, 'toolEvidenceReceipt'), false);

    const oldInspectorResponse = await requestJson(
      `http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=${oldSessionId}`,
    );
    assert.equal(oldInspectorResponse.statusCode, 200);
    assertArtifactShape(oldInspectorResponse.json.inspector.artifact);
    assert.equal(oldInspectorResponse.json.inspector.artifact.toolEvidenceReceipt, null);
    assert.equal(oldInspectorResponse.json.inspector.routing.artifact.toolEvidenceReceipt, null);

    assert.equal(mockLmStudio.stats.chatRequests, 0);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_CHAT_MODEL == null) delete process.env.PENNY_LMSTUDIO_CHAT_MODEL; else process.env.PENNY_LMSTUDIO_CHAT_MODEL = originalEnv.PENNY_LMSTUDIO_CHAT_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('direct web inspect fallback stays deterministic on the public chat route', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-web-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';

  const toolRegistryModulePath = require.resolve('../lib/penny-tool-registry');
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  delete require.cache[toolRegistryModulePath];
  require.cache[toolRegistryModulePath] = {
    id: toolRegistryModulePath,
    filename: toolRegistryModulePath,
    loaded: true,
    exports: {
      createToolRegistry() {
        return {
          toolLabelFromResult() {
            return '';
          },
          async executePennyTool(name, args = {}) {
            if (name === 'search_web') {
              return {
                ok: true,
                label: 'searched the web',
                data: {
                  query: args.query,
                  results: [
                    {
                      title: 'Browser Tool',
                      url: 'https://docs.openclaw.ai/tools/browser',
                      snippet: 'Browser automation for websites and page interactions.',
                    },
                  ],
                },
              };
            }
            if (name === 'read_web_page') {
              return {
                ok: false,
                label: 'failed to read browser docs',
                data: {
                  error: 'too large',
                  url: 'https://docs.openclaw.ai/tools/browser',
                },
              };
            }
            throw new Error(`Unexpected tool ${name}`);
          },
        };
      },
    },
  };

  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-web-fallback-test',
        messages: [
          { role: 'user', content: 'Search the web for the OpenClaw browser docs and tell me what it is.' },
        ],
        memories: { brainMode: 'local' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.meta.localLane, 'tool');
    assert.match(response.json.text, /Browser Tool/);
    assert.match(response.json.text, /Browser automation for websites and page interactions\./);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    delete require.cache[toolRegistryModulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('natural top-stories site asks stay deterministic on the public chat route', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-web-natural-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';

  const toolRegistryModulePath = require.resolve('../lib/penny-tool-registry');
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  delete require.cache[toolRegistryModulePath];
  require.cache[toolRegistryModulePath] = {
    id: toolRegistryModulePath,
    filename: toolRegistryModulePath,
    loaded: true,
    exports: {
      createToolRegistry() {
        return {
          toolLabelFromResult() {
            return '';
          },
          async executePennyTool(name, args = {}) {
            if (name === 'search_web') {
              return {
                ok: true,
                label: 'searched the web',
                data: {
                  query: args.query,
                  results: [
                    {
                      title: 'Digital Foundry Stories',
                      url: 'https://digitalfoundry.com/news',
                      snippet: 'Latest stories from Digital Foundry.',
                    },
                  ],
                },
              };
            }
            throw new Error(`Unexpected tool ${name}`);
          },
        };
      },
    },
  };

  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'route-web-natural-test',
        messages: [
          { role: 'user', content: 'hey penny, can you tell me what some of the top stories on digitalfoundry.com are, today?' },
        ],
        memories: { brainMode: 'local' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json.meta.localLane, 'tool');
    assert.match(response.json.text, /here's the pile/i);
    assert.match(response.json.text, /pick one and i'll crack it open/i);
    assert.match(response.json.text, /Digital Foundry Stories/);
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    delete require.cache[toolRegistryModulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('memory inspector tracks archived turns and review approval promotes a pending pattern', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
    PENNY_API_TOKEN: process.env.PENNY_API_TOKEN,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-archive-'));
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = path.join(tmpDir, 'penny-memory.test.json');
  process.env.PENNY_MEMORY_ARCHIVE_FILE = path.join(tmpDir, 'penny-memory-archive.test.json');
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  process.env.PENNY_MEMORY_BOOKS_FILE = path.join(tmpDir, 'penny-memory-books.test.json');
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';
  process.env.PENNY_API_TOKEN = 'route-test-token';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const sendShadowTurn = async (content) => requestJson(`http://127.0.0.1:${address.port}/api/penny/chat/shadow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'archive-route-test',
        messages: [{ role: 'user', content }],
        memories: { brainMode: 'shadow' },
      }),
    });

    await sendShadowTurn('Midnight rain always calms me down.');
    await sendShadowTurn('I keep thinking about midnight rain and city lights.');
    await sendShadowTurn('Midnight rain makes the whole night feel softer.');
    let inspector = null;
    const inspectorDeadline = Date.now() + 2000;
    while (Date.now() < inspectorDeadline) {
      inspector = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=archive-route-test`);
      const episodeCount = Number(inspector?.json?.inspector?.archive?.session?.episodeCount || 0);
      const queueCount = Number(inspector?.json?.inspector?.archive?.global?.promotionQueue?.length || 0);
      const backgroundStatus = String(inspector?.json?.inspector?.embeddings?.backgroundVectorization?.status || '');
      if (episodeCount >= 3 && queueCount >= 1 && backgroundStatus === 'applied') break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    assert.equal(inspector.statusCode, 200);
    assert.ok(inspector.json.inspector.archive.session.episodeCount >= 3);
    assert.ok(inspector.json.inspector.archive.global.promotionQueue.length >= 1);
    assert.ok(Object.prototype.hasOwnProperty.call(inspector.json.inspector, 'memoryBooks'));
    assert.ok(Object.prototype.hasOwnProperty.call(inspector.json.inspector, 'compression'));
    assert.equal(inspector.json.inspector.embeddings.backgroundVectorization.enabled, true);
    assert.equal(inspector.json.inspector.embeddings.backgroundVectorization.status, 'applied');
    assert.equal(inspector.json.inspector.embeddings.backgroundVectorization.batchLimit, 2);
    assertArtifactShape(inspector.json.inspector.artifact);

    const queueId = inspector.json.inspector.archive.global.promotionQueue[0].id;
    const review = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer route-test-token' },
      body: JSON.stringify({
        sessionId: 'archive-route-test',
        queueId,
        action: 'approve',
      }),
    });
    assert.equal(review.statusCode, 200);
    assert.ok(Array.isArray(review.json.memory.memories) && review.json.memory.memories.length >= 1);
    assert.ok(review.json.memory.memories.some((item) => item.text === review.json.reviewed.text));
    assert.equal(review.json.memory.memories[0].source, 'review-candidate');
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    if (originalEnv.PENNY_API_TOKEN == null) delete process.env.PENNY_API_TOKEN; else process.env.PENNY_API_TOKEN = originalEnv.PENNY_API_TOKEN;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('memory inspector route serializes bounded provenance details from lastRetrieval', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-provenance-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    fs.writeFileSync(archiveFile, `${JSON.stringify({
      meta: {
        schemaVersion: 2,
        embedModel: 'text-embedding-nomic-embed-text-v1.5',
        reviewDecisions: {},
      },
      global: {
        episodes: [],
        summaries: [],
        patterns: [],
        promotionQueue: [],
      },
      sessions: {
        'provenance-route-test': {
          sessionId: 'provenance-route-test',
          episodes: [],
          summaries: [],
          chapters: [],
          activeContradictions: [
            {
              id: 'contr-1',
              conflictKey: 'favorite tea',
              oldText: 'Favorite tea is oolong',
              newText: 'Favorite tea is lapsang souchong',
              status: 'active',
              dependentEpisodeIds: ['episode-1'],
              dependentChapterIds: ['chapter-1'],
            },
          ],
          openLoops: [],
          lastRetrieval: {
            usedAt: '2026-04-13T12:00:00.000Z',
            mode: 'semantic',
            embedModel: 'text-embedding-nomic-embed-text-v1.5',
            session: [],
            global: [],
            books: [],
            provenance: buildProvenanceEntries(8),
            compression: {
              used: false,
              reason: '',
              chapters: [],
              explanation: {
                selectedSignals: ['active-contradiction'],
                penalties: ['scaffolding-filter'],
                omittedEpisodeCount: 4,
                carriedContradictions: [
                  {
                    id: 'contr-1',
                    conflictKey: 'favorite tea',
                    oldText: 'Favorite tea is oolong',
                    newText: 'Favorite tea is lapsang souchong',
                    status: 'active',
                  },
                ],
              },
            },
          },
          lastArchivedAt: '2026-04-13T12:00:00.000Z',
          updatedAt: '2026-04-13T12:00:00.000Z',
        },
      },
    }, null, 2)}\n`);
    fs.writeFileSync(memoryFile, `${JSON.stringify({
      sessions: {
        'provenance-route-test': {
          sessionId: 'provenance-route-test',
          userName: 'Malac',
          memories: [],
          voiceOn: false,
          brainMode: 'local',
          lastRoute: {
            selectedLane: 'tool',
            requestedMode: 'local',
            backend: 'local-lmstudio-tools',
            repair: {
              firstPassGuardCodes: ['contradiction_stale_value'],
              repairAttempted: true,
              repairAccepted: true,
              finalCandidateSource: 'repair',
              scope: 'semantic-render',
            },
          },
          updatedAt: '2026-04-13T12:00:00.000Z',
        },
      },
    }, null, 2)}\n`);

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=provenance-route-test`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json.inspector.archive.session.lastRetrieval.mode, 'semantic');
    assert.equal(response.json.inspector.archive.session.lastRetrieval.provenance.length, 6);
    assert.equal(response.json.inspector.archive.session.lastRetrieval.provenance[0].id, 'prov-1');
    assert.equal(response.json.inspector.archive.session.lastRetrieval.provenance[5].id, 'prov-6');
    assert.match(response.json.inspector.archive.session.lastRetrieval.provenance[0].newText, /lapsang souchong/i);
    assert.equal(response.json.inspector.archive.session.activeContradictions.length, 1);
    assert.equal(response.json.inspector.archive.session.activeContradictions[0].conflictKey, 'favorite tea');
    assert.equal(response.json.inspector.archive.session.lastRetrieval.compression.explanation.selectedSignals[0], 'active-contradiction');
    assert.equal(response.json.inspector.routing.repair.finalCandidateSource, 'repair');
    assert.equal(response.json.inspector.routing.repair.firstPassGuardCodes[0], 'contradiction_stale_value');
    assert.equal(response.json.inspector.archive.session.lastArchivedAt, '2026-04-13T12:00:00.000Z');
    assert.equal(response.json.inspector.embeddings.backgroundVectorization.enabled, true);
    assert.equal(response.json.inspector.embeddings.backgroundVectorization.status, 'skipped');
    assert.equal(response.json.inspector.embeddings.backgroundVectorization.batchLimit, 2);
    assertArtifactShape(response.json.inspector.artifact);
    assert.equal(response.json.inspector.artifact.scope.selectedLane, 'tool');
    assert.equal(response.json.inspector.routing.artifact.version, 'penny-runtime-artifact.v1');
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_MEMORY_BOOKS_FILE == null) delete process.env.PENNY_MEMORY_BOOKS_FILE; else process.env.PENNY_MEMORY_BOOKS_FILE = originalEnv.PENNY_MEMORY_BOOKS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LOCAL_LLM_TRANSPORT == null) delete process.env.PENNY_LOCAL_LLM_TRANSPORT; else process.env.PENNY_LOCAL_LLM_TRANSPORT = originalEnv.PENNY_LOCAL_LLM_TRANSPORT;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('chat route reports experimental epistemic caution and archive synthesis when the flags are enabled', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
    PENNY_ENABLE_EPISTEMIC_CAUTION: process.env.PENNY_ENABLE_EPISTEMIC_CAUTION,
    PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS: process.env.PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-epistemic-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  const booksFile = path.join(tmpDir, 'penny-memory-books.test.json');
  const mockLmStudio = await createMockLmStudioServer();
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_MEMORY_BOOKS_FILE = booksFile;
  process.env.PENNY_LMSTUDIO_BASE = mockLmStudio.baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = mockLmStudio.nativeBaseUrl;
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'qa-missing-embed-model';
  process.env.PENNY_ENABLE_EPISTEMIC_CAUTION = '1';
  process.env.PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS = '1';

  fs.writeFileSync(archiveFile, `${JSON.stringify({
    meta: {
      schemaVersion: 2,
      embedModel: 'qa-missing-embed-model',
      reviewDecisions: {},
    },
    global: {
      episodes: [],
      summaries: [
        {
          id: 'summary-global-1',
          type: 'summary',
          text: 'Longer-term themes: midnight rain and city lights.',
          createdAt: '2026-04-15T11:58:00.000Z',
          updatedAt: '2026-04-15T11:58:00.000Z',
          sourceType: 'summary',
        },
      ],
      patterns: [],
      promotionQueue: [],
    },
    sessions: {
      'epistemic-route-test': {
        sessionId: 'epistemic-route-test',
        episodes: [
          {
            id: 'episode-1',
            type: 'episode',
            text: 'Favorite tea is oolong.',
            excerpt: 'Favorite tea is oolong.',
            userText: 'Favorite tea is oolong.',
            assistantText: 'Oolong it is.',
            createdAt: '2026-04-15T11:55:00.000Z',
            updatedAt: '2026-04-15T11:55:00.000Z',
            sourceType: 'episode',
          },
          {
            id: 'episode-2',
            type: 'episode',
            text: 'Actually, favorite tea is lapsang souchong now.',
            excerpt: 'Actually, favorite tea is lapsang souchong now.',
            userText: 'Actually, favorite tea is lapsang souchong now.',
            assistantText: 'Lapsang souchong is the new truth.',
            createdAt: '2026-04-15T11:56:00.000Z',
            updatedAt: '2026-04-15T11:56:00.000Z',
            sourceType: 'episode',
          },
        ],
        summaries: [],
        chapters: [],
        provenance: [],
        activeContradictions: [
          {
            id: 'contr-1',
            conflictKey: 'favorite tea',
            oldText: 'Favorite tea is oolong',
            newText: 'Favorite tea is lapsang souchong',
            status: 'active',
            createdAt: '2026-04-15T11:56:00.000Z',
            updatedAt: '2026-04-15T11:56:00.000Z',
          },
        ],
        openLoops: [],
        lastRetrieval: null,
        lastArchivedAt: '2026-04-15T11:56:00.000Z',
        updatedAt: '2026-04-15T11:56:00.000Z',
      },
    },
  }, null, 2)}\n`);
  fs.writeFileSync(memoryFile, `${JSON.stringify({
    sessions: {
      'epistemic-route-test': {
        sessionId: 'epistemic-route-test',
        userName: 'Malac',
        memories: [
          { text: 'Favorite tea is lapsang souchong', kind: 'preference', source: 'explicit', ts: Date.UTC(2026, 3, 15, 11, 56, 0) },
        ],
        voiceOn: false,
        brainMode: 'local',
        lastRoute: null,
        updatedAt: '2026-04-15T11:56:00.000Z',
      },
    },
  }, null, 2)}\n`);

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  const started = serverModule.startServer({ port: 0, silent: true });

  try {
    await new Promise((resolve, reject) => {
      if (started.listening) {
        resolve();
        return;
      }
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'epistemic-route-test',
        messages: [
          { role: 'user', content: 'Since my favorite tea is oolong, tell me what tea I like now.' },
        ],
        memories: { brainMode: 'local' },
      }),
    });

    assert.equal(response.statusCode, 200);
    assertArtifactShape(response.json.meta.artifact);
    assert.equal(response.json.meta.artifact.epistemics.enabled, true);
    assert.equal(response.json.meta.artifact.epistemics.triggered, true);
    assert.equal(response.json.meta.artifact.epistemics.stance, 'correct');
    assert.ok(response.json.meta.artifact.epistemics.signals.includes('active_contradiction'));
    assert.equal(response.json.meta.artifact.synthesis.enabled, true);
    assert.equal(response.json.meta.artifact.synthesis.generated, true);
    assert.match(response.json.meta.artifact.synthesis.summary, /lapsang souchong/i);

    const inspector = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=epistemic-route-test`);
    assert.equal(inspector.statusCode, 200);
    assertArtifactShape(inspector.json.inspector.artifact);
    assert.equal(inspector.json.inspector.artifact.epistemics.triggered, true);
    assert.equal(inspector.json.inspector.artifact.synthesis.generated, true);
    assert.ok(Number.isFinite(Date.parse(inspector.json.inspector.archive.session.lastArchivedAt)));
    assert.ok(Date.parse(inspector.json.inspector.archive.session.lastArchivedAt) >= Date.parse('2026-04-15T11:56:00.000Z'));
    assert.ok(Array.isArray(inspector.json.inspector.archive.session.recentAuditTrail));
    assert.equal(inspector.json.inspector.archive.session.recentAuditTrail.length >= 1, true);
    assert.equal(inspector.json.inspector.archive.session.recentAuditTrail[0].retrieval.selectedSessionIds.length >= 1, true);
    assert.ok(Array.isArray(inspector.json.inspector.archive.session.recentAuditTrail[0].retrieval.renderedSessionIds));
    assert.equal(typeof inspector.json.inspector.archive.session.recentAuditTrail[0].promptTruth.channels.sessionArchive.renderedCount, 'number');
    assert.ok(['', 'canon-priority-suppression'].includes(
      inspector.json.inspector.archive.session.recentAuditTrail[0].promptTruth.channels.sessionArchive.heldBackReason,
    ));
    assert.equal(inspector.json.inspector.archive.session.lastRetrieval.summary.selectedSessionIds.length >= 1, true);
    assert.ok(Array.isArray(inspector.json.inspector.archive.session.lastRetrieval.summary.renderedSessionIds));
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    await mockLmStudio.close();
    delete require.cache[modulePath];
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
