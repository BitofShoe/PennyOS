const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const {
  beginEventStream,
  safeReadBody,
  sendEventStream,
  sendJson,
} = require('../lib/penny-server-http');

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

test('sendJson writes json response headers and body', () => {
  const res = {
    statusCode: 0,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };

  sendJson(res, 201, { ok: true });

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.headers, { 'Content-Type': 'application/json; charset=utf-8' });
  assert.match(res.body, /"ok": true/);
});

test('safeReadBody resolves a bounded request body', async () => {
  const req = new EventEmitter();
  req.destroy = () => {};

  const promise = safeReadBody(req, {
    maxBytes: 32,
    createHttpError,
    formatBytes: (value) => `${value} B`,
  });

  req.emit('data', 'hello ');
  req.emit('data', 'penny');
  req.emit('end');

  await assert.doesNotReject(promise);
  await assert.strictEqual(await promise, 'hello penny');
});

test('safeReadBody rejects once the request body exceeds the cap', async () => {
  const req = new EventEmitter();
  req.destroy = () => {};

  const promise = safeReadBody(req, {
    maxBytes: 4,
    createHttpError,
    formatBytes: (value) => `${value} B`,
  });

  req.emit('data', 'hello');

  await assert.rejects(promise, /Request body too large/);
});

test('SSE helpers write a proper event stream frame', () => {
  const res = {
    statusCode: 0,
    headers: null,
    flushed: false,
    writes: [],
    writableEnded: false,
    destroyed: false,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    flushHeaders() {
      this.flushed = true;
    },
    write(chunk) {
      this.writes.push(chunk);
    },
  };

  beginEventStream(res);
  sendEventStream(res, 'done', { ok: true });

  assert.equal(res.statusCode, 200);
  assert.equal(res.flushed, true);
  assert.equal(res.headers['Content-Type'], 'text/event-stream; charset=utf-8');
  assert.match(res.writes.join(''), /event: done/);
  assert.match(res.writes.join(''), /data: {"ok":true}/);
});
