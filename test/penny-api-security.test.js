const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPennyApiSecurity,
  resolveBindHost,
} = require('../lib/penny-api-security');

function buildSecurity(env = {}) {
  return createPennyApiSecurity({
    env,
    accessToken: 'test-token',
    lanAddresses: () => ['192.168.1.50'],
    sendJson: () => {},
  });
}

function req({
  method = 'GET',
  host = 'localhost:4317',
  origin = '',
  contentType = '',
  token = '',
  remoteAddress = '127.0.0.1',
} = {}) {
  const headers = { host };
  if (origin) headers.origin = origin;
  if (contentType) headers['content-type'] = contentType;
  if (token) headers.authorization = `Bearer ${token}`;
  return { method, headers, socket: { remoteAddress } };
}

test('API bind host defaults to loopback unless LAN sharing is enabled', () => {
  assert.equal(resolveBindHost({ lanShare: false }), '127.0.0.1');
  assert.equal(resolveBindHost({ lanShare: true }), '0.0.0.0');
  assert.equal(resolveBindHost({ lanShare: true, host: '127.0.0.1' }), '127.0.0.1');
});

test('API security rejects unexpected host and origin headers', () => {
  const security = buildSecurity();
  const statusUrl = new URL('http://localhost:4317/api/penny/status');

  assert.equal(security.validateApiRequest(req({ host: 'evil.example' }), statusUrl).code, 'host_rejected');
  assert.equal(security.validateApiRequest(req({ origin: 'https://evil.example' }), statusUrl).code, 'origin_rejected');
  assert.equal(security.validateApiRequest(req({ origin: 'http://localhost:4317' }), statusUrl).ok, true);
});

test('API mutations require JSON content type', () => {
  const security = buildSecurity();
  const chatUrl = new URL('http://localhost:4317/api/penny/chat');
  const result = security.validateApiRequest(req({ method: 'POST', contentType: 'text/plain' }), chatUrl);
  assert.equal(result.code, 'json_required');
});

test('LAN mode requires token on every API route and admits configured LAN host', () => {
  const security = buildSecurity({ PENNY_LAN_SHARE: '1' });
  const statusUrl = new URL('http://192.168.1.50:4317/api/penny/status');
  assert.equal(security.validateApiRequest(req({ host: '192.168.1.50:4317', remoteAddress: '192.168.1.51' }), statusUrl).code, 'token_required');
  assert.equal(security.validateApiRequest(req({
    host: '192.168.1.50:4317',
    remoteAddress: '192.168.1.51',
    token: 'test-token',
  }), statusUrl).ok, true);
});

test('sensitive mutation routes require a token outside LAN mode', () => {
  const security = buildSecurity();
  const modelUrl = new URL('http://localhost:4317/api/penny/lmstudio/model');
  assert.equal(security.validateApiRequest(req({ method: 'POST', contentType: 'application/json' }), modelUrl).code, 'token_required');
  assert.equal(security.validateApiRequest(req({
    method: 'POST',
    contentType: 'application/json',
    token: 'test-token',
  }), modelUrl).ok, true);
});
