const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyHostTarget,
  createWebUrlSafetyApi,
  normalizeWebUrl,
} = require('../lib/penny-web-url-safety');

function publicLookup() {
  return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
}

test('web URL normalization unwraps DuckDuckGo redirect links', () => {
  const normalized = normalizeWebUrl('https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdoc');
  assert.equal(normalized, 'https://example.com/doc');
});

test('private and local network targets classify as private', () => {
  for (const host of ['127.0.0.1', '10.2.3.4', '192.168.1.4', '169.254.169.254', '::1', 'fd00::1', 'localhost']) {
    assert.equal(classifyHostTarget(host).private, true, host);
  }
  assert.equal(classifyHostTarget('93.184.216.34').private, false);
});

test('DNS resolution blocks hostnames that resolve to private addresses', async () => {
  const api = createWebUrlSafetyApi({
    lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    fetchImpl: async () => new Response('ok'),
  });
  await assert.rejects(() => api.assertUrlAllowed('https://example.test/'), /Blocked private or unsafe web target/);
});

test('private network fetches require explicit opt-in', async () => {
  const api = createWebUrlSafetyApi({
    allowPrivateNetwork: true,
    lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    fetchImpl: async () => new Response('ok'),
  });
  const safety = await api.assertUrlAllowed('https://example.test/');
  assert.equal(safety.ok, true);
});

test('redirects to private addresses are blocked before following', async () => {
  const api = createWebUrlSafetyApi({
    lookup: publicLookup,
    fetchImpl: async () => new Response('', {
      status: 302,
      headers: { location: 'http://127.0.0.1:1234/private' },
    }),
  });
  await assert.rejects(() => api.fetchTextWithLimit('https://example.com/'), /Blocked private or unsafe web target/);
});

test('streaming web fetches enforce the byte cap while reading', async () => {
  const api = createWebUrlSafetyApi({
    lookup: publicLookup,
    fetchImpl: async () => new Response('abcdef'),
    formatBytes: (bytes) => `${bytes}b`,
  });
  await assert.rejects(() => api.fetchTextWithLimit('https://example.com/', { maxBytes: 3 }), /web fetch cap of 3b/);
});
