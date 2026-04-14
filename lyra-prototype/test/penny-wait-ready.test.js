const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const {
  waitForPennyReady,
} = require('../scripts/penny-wait-ready');

test('waitForPennyReady succeeds against a healthy Penny status endpoint', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/api/penny/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name: 'Penny' }));
      return;
    }
    res.writeHead(404).end();
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const result = await waitForPennyReady({
      url: `http://127.0.0.1:${address.port}/api/penny/status`,
      timeoutMs: 2000,
      pollMs: 100,
    });

    assert.equal(result.ok, true);
    assert.equal(result.body.ok, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('waitForPennyReady fails clearly when the status endpoint never comes up', async () => {
  const result = await waitForPennyReady({
    url: 'http://127.0.0.1:65531/api/penny/status',
    timeoutMs: 600,
    pollMs: 100,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /(fetch failed|connect|timed out|refused)/i);
});
