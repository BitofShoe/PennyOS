const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ENV_KEYS = [
  'PENNY_API_TOKEN',
  'PENNY_ACCESS_TOKEN',
  'PENNY_API_ALLOW_LOCAL_NO_TOKEN',
  'PENNY_DATA_DIR',
  'PENNY_MEMORY_FILE',
  'PENNY_MEMORY_ARCHIVE_FILE',
  'PENNY_MEMORY_EMBEDDINGS_FILE',
  'PENNY_MEMORY_LEDGER_FILE',
  'PENNY_MEMORY_BOOKS_FILE',
  'PENNY_SKIP_LMSTUDIO_PREP',
  'PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY',
];

function restoreEnvironment(original) {
  for (const [key, value] of original.entries()) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
}

function requestJson({ port, method, requestPath, body = null }) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method,
      headers: body == null ? {} : {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        try {
          resolve({ statusCode: response.statusCode, body: JSON.parse(raw) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('error', reject);
    if (body != null) request.write(body);
    request.end();
  });
}

test('memory routes return invalid-schema and preserve canonical store bytes', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-memory-route-schema-'));
  const memoryFile = path.join(root, 'penny-memory.json');
  const schemaCorrupt = '{"sessions":[]}';
  const originalEnvironment = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));
  let server;

  process.env.PENNY_API_TOKEN = '';
  process.env.PENNY_ACCESS_TOKEN = '';
  process.env.PENNY_API_ALLOW_LOCAL_NO_TOKEN = '1';
  process.env.PENNY_DATA_DIR = root;
  process.env.PENNY_MEMORY_FILE = memoryFile;
  process.env.PENNY_MEMORY_ARCHIVE_FILE = path.join(root, 'penny-memory-archive.json');
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = path.join(root, 'penny-memory-embeddings.json');
  process.env.PENNY_MEMORY_LEDGER_FILE = path.join(root, 'penny-memory-ledger.json');
  process.env.PENNY_MEMORY_BOOKS_FILE = path.join(root, 'penny-memory-books.json');
  process.env.PENNY_SKIP_LMSTUDIO_PREP = '1';
  process.env.PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY = '1';
  fs.writeFileSync(memoryFile, schemaCorrupt, 'utf8');

  try {
    ({ server } = require('../server'));
    const { startServer } = require('../server');
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.once('listening', resolve);
      startServer({ port: 0, host: '127.0.0.1', silent: true });
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const read = await requestJson({ port, method: 'GET', requestPath: '/api/penny/memory?sessionId=durable-schema-test' });
    assert.equal(read.statusCode, 409);
    assert.deepEqual(read.body, {
      ok: false,
      code: 'invalid-schema',
      error: 'Penny canonical memory store has an invalid schema. It remains untouched until it is repaired.',
    });

    const write = await requestJson({
      port,
      method: 'POST',
      requestPath: '/api/penny/memory',
      body: JSON.stringify({ sessionId: 'durable-schema-test', memory: { userName: 'Penny' } }),
    });
    assert.equal(write.statusCode, 409);
    assert.equal(write.body.ok, false);
    assert.equal(write.body.code, 'invalid-schema');
    assert.equal(fs.readFileSync(memoryFile, 'utf8'), schemaCorrupt);
  } finally {
    if (server?.listening) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    restoreEnvironment(originalEnvironment);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
