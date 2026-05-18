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

test('API security ignores malformed cookie encoding instead of throwing', () => {
  const security = buildSecurity();
  const url = new URL('http://localhost:4317/api/penny/memory/purge');
  const request = req({ method: 'POST', contentType: 'application/json' });
  request.headers.cookie = 'penny_access_token=%E0%A4%A';
  assert.doesNotThrow(() => security.validateApiRequest(request, url));
  assert.equal(security.validateApiRequest(request, url).code, 'token_required');
});

test('memory mutation and review routes require a local token outside LAN mode', () => {
  const security = buildSecurity();
  const cases = [
    ['POST', '/api/penny/memory'],
    ['PATCH', '/api/penny/memory'],
    ['POST', '/api/penny/memory/review'],
    ['POST', '/api/penny/memory/purge'],
    ['POST', '/api/penny/consolidate'],
  ];

  for (const [method, pathname] of cases) {
    const url = new URL(`http://localhost:4317${pathname}`);
    assert.equal(
      security.validateApiRequest(req({ method, contentType: 'application/json' }), url).code,
      'token_required',
      `${method} ${pathname} should require a token`,
    );
    assert.equal(
      security.validateApiRequest(req({ method, contentType: 'application/json', token: 'test-token' }), url).ok,
      true,
      `${method} ${pathname} should admit the configured token`,
    );
  }
});
