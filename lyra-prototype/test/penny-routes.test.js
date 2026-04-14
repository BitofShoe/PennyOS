const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

test('GET /api/penny/status returns a health payload on an ephemeral port', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-test-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.test.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = archiveFile;
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = embeddingsFile;
  process.env.PENNY_LMSTUDIO_BASE = 'http://127.0.0.1:1234/v1';
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = 'http://127.0.0.1:1234/api/v1';
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
    assert.ok(address && typeof address === 'object' && address.port > 0);
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/status`);
    assert.equal(response.statusCode, 200);
    assert.equal(response.json.ok, true);
    assert.equal(response.json.name, 'Penny');
    assert.equal(response.json.backend, 'local-lmstudio');
    assert.ok(response.json.lmStudio);
    assert.ok(Object.prototype.hasOwnProperty.call(response.json.lmStudio, 'reachable'));

    const lmStatus = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/status`);
    assert.equal(lmStatus.statusCode, 200);
    assert.equal(lmStatus.json.chatPreferredModel, 'unsloth/gemma-4-31b-it');
    assert.equal(lmStatus.json.toolPreferredModel, 'google/gemma-4-e4b');
    assert.equal(lmStatus.json.embedPreferredModel, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(lmStatus.json.routingMode, 'auto');

    const updatedModel = await requestJson(`http://127.0.0.1:${address.port}/api/penny/lmstudio/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'google/gemma-4-31b' }),
    });
    assert.equal(updatedModel.statusCode, 200);
    assert.equal(updatedModel.json.runtimePreferredModel, 'google/gemma-4-31b');
    assert.equal(updatedModel.json.chatPreferredModel, 'google/gemma-4-31b');
    assert.equal(updatedModel.json.toolPreferredModel, 'google/gemma-4-e4b');

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
    assert.equal(toolTurn.json.meta.requestedModel, 'google/gemma-4-e4b');
    assert.equal(typeof toolTurn.json.meta.resolvedModel, 'string');
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_CHAT_MODEL == null) delete process.env.PENNY_LMSTUDIO_CHAT_MODEL; else process.env.PENNY_LMSTUDIO_CHAT_MODEL = originalEnv.PENNY_LMSTUDIO_CHAT_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_TOOL_MODEL == null) delete process.env.PENNY_LMSTUDIO_TOOL_MODEL; else process.env.PENNY_LMSTUDIO_TOOL_MODEL = originalEnv.PENNY_LMSTUDIO_TOOL_MODEL;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('direct write route survives semantic-render gating on side-effecting turns', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-write-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  const repoTempFile = path.join(__dirname, '..', 'tmp', 'route-semantic-render-bug.js');
  fs.mkdirSync(path.dirname(repoTempFile), { recursive: true });
  if (fs.existsSync(repoTempFile)) fs.rmSync(repoTempFile, { force: true });

  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_LMSTUDIO_BASE = 'http://127.0.0.1:1234/v1';
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = 'http://127.0.0.1:1234/api/v1';
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
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (fs.existsSync(repoTempFile)) fs.rmSync(repoTempFile, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('direct web inspect fallback stays deterministic on the public chat route', async () => {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-web-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_LMSTUDIO_BASE = 'http://127.0.0.1:1234/v1';
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = 'http://127.0.0.1:1234/api/v1';
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
    delete require.cache[modulePath];
    delete require.cache[toolRegistryModulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
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
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-archive-'));
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = path.join(tmpDir, 'penny-memory.test.json');
  process.env.PENNY_MEMORY_ARCHIVE_FILE = path.join(tmpDir, 'penny-memory-archive.test.json');
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  process.env.PENNY_LMSTUDIO_BASE = 'http://127.0.0.1:1234/v1';
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = 'http://127.0.0.1:1234/api/v1';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
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
    await new Promise((resolve) => setTimeout(resolve, 60));

    const inspector = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/inspector?sessionId=archive-route-test`);
    assert.equal(inspector.statusCode, 200);
    assert.ok(inspector.json.inspector.archive.session.episodeCount >= 3);
    assert.ok(inspector.json.inspector.archive.global.promotionQueue.length >= 1);

    const queueId = inspector.json.inspector.archive.global.promotionQueue[0].id;
    const review = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'archive-route-test',
        queueId,
        action: 'approve',
      }),
    });
    assert.equal(review.statusCode, 200);
    assert.ok(Array.isArray(review.json.memory.memories) && review.json.memory.memories.length >= 1);
    assert.ok(review.json.memory.memories.some((item) => item.text === review.json.reviewed.text));
  } finally {
    await new Promise((resolve) => started.close(() => resolve()));
    delete require.cache[modulePath];
    if (originalEnv.PORT == null) delete process.env.PORT; else process.env.PORT = originalEnv.PORT;
    if (originalEnv.PENNY_MEMORY_FILE == null) delete process.env.PENNY_MEMORY_FILE; else process.env.PENNY_MEMORY_FILE = originalEnv.PENNY_MEMORY_FILE;
    if (originalEnv.PENNY_MEMORY_ARCHIVE_FILE == null) delete process.env.PENNY_MEMORY_ARCHIVE_FILE; else process.env.PENNY_MEMORY_ARCHIVE_FILE = originalEnv.PENNY_MEMORY_ARCHIVE_FILE;
    if (originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE == null) delete process.env.PENNY_MEMORY_EMBEDDINGS_FILE; else process.env.PENNY_MEMORY_EMBEDDINGS_FILE = originalEnv.PENNY_MEMORY_EMBEDDINGS_FILE;
    if (originalEnv.PENNY_LMSTUDIO_BASE == null) delete process.env.PENNY_LMSTUDIO_BASE; else process.env.PENNY_LMSTUDIO_BASE = originalEnv.PENNY_LMSTUDIO_BASE;
    if (originalEnv.PENNY_LMSTUDIO_NATIVE_BASE == null) delete process.env.PENNY_LMSTUDIO_NATIVE_BASE; else process.env.PENNY_LMSTUDIO_NATIVE_BASE = originalEnv.PENNY_LMSTUDIO_NATIVE_BASE;
    if (originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS == null) delete process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS; else process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = originalEnv.PENNY_LMSTUDIO_MODELS_PROBE_MS;
    if (originalEnv.PENNY_LMSTUDIO_EMBED_MODEL == null) delete process.env.PENNY_LMSTUDIO_EMBED_MODEL; else process.env.PENNY_LMSTUDIO_EMBED_MODEL = originalEnv.PENNY_LMSTUDIO_EMBED_MODEL;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
