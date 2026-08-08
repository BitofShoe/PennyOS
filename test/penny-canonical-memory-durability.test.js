const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

function requestJson(url, { method = 'GET', headers = {}, body = '' } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          statusCode: response.statusCode,
          json: text ? JSON.parse(text) : null,
        });
      });
    });
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

test('canonical memory reads fall back safely but API writes leave malformed bytes untouched', async () => {
  const envKeys = [
    'PORT',
    'PENNY_ENV_FILE',
    'PENNY_MEMORY_FILE',
    'PENNY_MEMORY_ARCHIVE_FILE',
    'PENNY_MEMORY_EMBEDDINGS_FILE',
    'PENNY_MEMORY_BOOKS_FILE',
    'PENNY_MEMORY_LEDGER_FILE',
    'PENNY_API_TOKEN',
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-canonical-memory-corrupt-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.json');
  const corrupt = '{"sessions":';
  const modulePath = require.resolve('../server.js');
  let started = null;

  try {
    fs.writeFileSync(memoryFile, corrupt, 'utf8');
    process.env.PORT = '0';
    process.env.PENNY_ENV_FILE = path.join(tmpDir, 'missing.env');
    process.env.PENNY_MEMORY_FILE = memoryFile;
    process.env.PENNY_MEMORY_ARCHIVE_FILE = path.join(tmpDir, 'archive.json');
    process.env.PENNY_MEMORY_EMBEDDINGS_FILE = path.join(tmpDir, 'embeddings.json');
    process.env.PENNY_MEMORY_BOOKS_FILE = path.join(tmpDir, 'books.json');
    process.env.PENNY_MEMORY_LEDGER_FILE = path.join(tmpDir, 'ledger.json');
    process.env.PENNY_API_TOKEN = 'durability-test-token';

    delete require.cache[modulePath];
    const serverModule = require('../server.js');
    started = serverModule.startServer({ port: 0, silent: true });
    await new Promise((resolve, reject) => {
      if (started.listening) return resolve();
      started.once('listening', resolve);
      started.once('error', reject);
    });

    const address = started.address();
    const response = await requestJson(`http://127.0.0.1:${address.port}/api/penny/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer durability-test-token',
      },
      body: JSON.stringify({
        sessionId: 'corrupt-memory-test',
        memory: { userName: 'Penny tester' },
      }),
    });

    assert.equal(response.statusCode, 500);
    assert.match(response.json.error, /remains untouched until it is repaired/i);
    assert.equal(fs.readFileSync(memoryFile, 'utf8'), corrupt);
  } finally {
    if (started) await new Promise((resolve) => started.close(() => resolve()));
    delete require.cache[modulePath];
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
