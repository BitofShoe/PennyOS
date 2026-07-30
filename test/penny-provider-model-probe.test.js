const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PROVIDER_MODEL_PROBE_SCHEMA,
  normalizeModelIds,
  probeProviderModels,
} = require('../lib/penny-provider-model-probe');

test('provider-neutral model probe accepts OpenAI-compatible data and models shapes', () => {
  assert.deepEqual(normalizeModelIds({
    data: [{ id: 'chat-a' }, { model: 'tool-b' }, 'embed-c', { id: 'chat-a' }],
  }), ['chat-a', 'tool-b', 'embed-c']);
  assert.deepEqual(normalizeModelIds({
    models: [{ name: 'provider-model' }],
  }), ['provider-model']);
});

test('provider-neutral model probe uses only the configured HTTP endpoint', async () => {
  const calls = [];
  const result = await probeProviderModels({
    baseUrl: 'http://provider.example/v1/',
    apiKey: 'private-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        async json() {
          return { data: [{ id: 'chat-a' }, { id: 'tool-b' }] };
        },
      };
    },
  });

  assert.equal(result.schema, PROVIDER_MODEL_PROBE_SCHEMA);
  assert.equal(result.ok, true);
  assert.deepEqual(result.models, ['chat-a', 'tool-b']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://provider.example/v1/models');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer private-key');
});

test('provider-neutral model probe returns a fixed failure without exposing response bodies', async () => {
  const canary = 'PRIVATE_PROVIDER_BODY_CANARY_77f1';
  const result = await probeProviderModels({
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      async json() {
        return { error: canary };
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(canary));
});
