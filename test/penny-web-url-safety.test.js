const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');

const {
  classifyHostTarget,
  createWebUrlSafetyApi,
  createVerifiedAddressFetch,
  normalizeWebUrl,
} = require('../lib/penny-web-url-safety');

function publicLookup() {
  return Promise.resolve([{ address: '93.184.216.34', family: 4 }]);
}

function createMockRequestModule({
  remoteAddress = '93.184.216.34',
  body = 'ok',
  statusCode = 200,
  headers = { 'content-type': 'text/plain; charset=utf-8' },
} = {}) {
  const calls = [];
  return {
    calls,
    request(options, onResponse) {
      calls.push(options);
      const req = new EventEmitter();
      req.setTimeout = () => req;
      req.destroy = (error) => {
        if (error) setImmediate(() => req.emit('error', error));
      };
      req.end = () => {
        const res = Readable.from([body]);
        res.statusCode = statusCode;
        res.statusMessage = 'OK';
        res.headers = headers;
        res.socket = { remoteAddress };
        setImmediate(() => onResponse(res));
      };
      return req;
    },
  };
}

test('web URL normalization unwraps DuckDuckGo redirect links', () => {
  const normalized = normalizeWebUrl('https://duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdoc');
  assert.equal(normalized, 'https://example.com/doc');
});

test('private and local network targets classify as private', () => {
  for (const host of [
    '127.0.0.1',
    '10.2.3.4',
    '192.168.1.4',
    '169.254.169.254',
    '198.18.0.1',
    '192.0.0.1',
    '203.0.113.1',
    '::1',
    '::ffff:93.184.216.34',
    '64:ff9b:1::1',
    '100::1',
    '2001:2::1',
    '2001:db8::1',
    '3fff::1',
    '5f00::1',
    'fd00::1',
    'localhost',
  ]) {
    assert.equal(classifyHostTarget(host).private, true, host);
  }
  for (const host of ['93.184.216.34', '192.0.0.9', '192.0.0.10', '2001:3::1', '2001:20::1']) {
    assert.equal(classifyHostTarget(host).private, false, host);
  }
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

test('web fetches reject private final peer metadata after safe DNS', async () => {
  const api = createWebUrlSafetyApi({
    lookup: publicLookup,
    verifyFinalPeer: async () => ({ address: '127.0.0.1', family: 4 }),
    fetchImpl: async () => new Response('ok'),
  });
  await assert.rejects(
    () => api.fetchTextWithLimit('https://example.com/'),
    /final peer.*loopback|loopback.*final peer/i,
  );
});

test('redirect responses reject private final peer metadata before following', async () => {
  let fetches = 0;
  const api = createWebUrlSafetyApi({
    lookup: publicLookup,
    verifyFinalPeer: async () => ({ address: '10.0.0.5', family: 4 }),
    fetchImpl: async () => {
      fetches += 1;
      return new Response('', {
        status: 302,
        headers: { location: 'https://example.org/next' },
      });
    },
  });
  await assert.rejects(
    () => api.fetchTextWithLimit('https://example.com/'),
    /final peer.*rfc1918|rfc1918.*final peer/i,
  );
  assert.equal(fetches, 1);
});

test('verified-address fetch connects to the prechecked address and preserves Host', async () => {
  const httpModule = createMockRequestModule();
  const fetchVerifiedAddress = createVerifiedAddressFetch({ httpModule });
  const response = await fetchVerifiedAddress('http://example.com:8080/path?q=1', {
    headers: { 'User-Agent': 'Penny test' },
    safety: {
      url: 'http://example.com:8080/path?q=1',
      addresses: [{ address: '93.184.216.34', family: 4, private: false }],
    },
  });
  assert.equal(httpModule.calls.length, 1);
  assert.equal(httpModule.calls[0].hostname, '93.184.216.34');
  assert.equal(httpModule.calls[0].port, '8080');
  assert.equal(httpModule.calls[0].path, '/path?q=1');
  assert.equal(httpModule.calls[0].headers.Host, 'example.com:8080');
  assert.equal(response.finalPeerAddress, '93.184.216.34');
  assert.equal(response.ok, true);
});

test('verified-address fetch final peer metadata is blocked when the socket is private', async () => {
  const httpModule = createMockRequestModule({ remoteAddress: '127.0.0.1' });
  const api = createWebUrlSafetyApi({
    lookup: publicLookup,
    fetchVerifiedAddress: createVerifiedAddressFetch({ httpModule }),
  });
  await assert.rejects(
    () => api.fetchTextWithLimit('http://example.com/'),
    /final peer.*loopback|loopback.*final peer/i,
  );
});

test('verified-address fetch allows private final peer only with explicit opt-in', async () => {
  const httpModule = createMockRequestModule({ remoteAddress: '127.0.0.1' });
  const api = createWebUrlSafetyApi({
    allowPrivateNetwork: true,
    lookup: async () => [{ address: '127.0.0.1', family: 4 }],
    fetchVerifiedAddress: createVerifiedAddressFetch({ httpModule }),
  });
  const fetched = await api.fetchTextWithLimit('http://example.test/');
  assert.equal(fetched.text, 'ok');
  assert.equal(httpModule.calls[0].hostname, '127.0.0.1');
});

test('server wires web safety through verified-address transport', () => {
  const serverSource = require('node:fs').readFileSync(require.resolve('../server.js'), 'utf8');
  assert.match(serverSource, /createVerifiedAddressFetch/);
  assert.match(serverSource, /fetchVerifiedAddress:\s*createVerifiedAddressFetch\(\{\s*httpModule:\s*http,\s*httpsModule:\s*https\s*\}\)/);
});

test('streaming web fetches enforce the byte cap while reading', async () => {
  const api = createWebUrlSafetyApi({
    lookup: publicLookup,
    fetchImpl: async () => new Response('abcdef'),
    formatBytes: (bytes) => `${bytes}b`,
  });
  await assert.rejects(() => api.fetchTextWithLimit('https://example.com/', { maxBytes: 3 }), /web fetch cap of 3b/);
});
