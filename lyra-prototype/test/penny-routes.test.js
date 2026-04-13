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
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-route-test-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.test.json');
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_LMSTUDIO_BASE = 'http://127.0.0.1:1234/v1';
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = 'http://127.0.0.1:1234/api/v1';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';

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
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
