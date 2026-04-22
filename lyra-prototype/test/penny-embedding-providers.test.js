const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EMBEDDING_PROVIDER_AUTHORITY,
  FIXTURE_MODEL_ID,
  STATIC_PROVIDER_ID,
  createEmbeddingProvider,
  normalizeProviderId,
} = require('../lib/penny-embedding-providers');
const {
  STATIC_SHADOW_EMBED_MODEL,
  createStaticShadowEmbedding,
} = require('../lib/penny-static-shadow-embeddings');

test('fixture provider normalizes provider info and stays candidate-discovery-only', async () => {
  const provider = createEmbeddingProvider({
    provider: 'fixture',
    modelId: 'custom-fixture-v1',
    dimensions: 12,
    truncateDim: 8,
    cacheDir: '/tmp/not-used-in-s1',
  });
  const info = provider.getProviderInfo();
  const health = await provider.healthCheck();

  assert.deepEqual(info, {
    providerId: 'fixture',
    modelId: 'custom-fixture-v1',
    modelFamily: 'deterministic-fixture',
    dimensions: 12,
    truncateDim: 8,
    distance: 'cosine',
    localOnly: true,
    license: 'repo-test-fixture',
    dependency: 'none',
    defaultForLive: false,
    authority: EMBEDDING_PROVIDER_AUTHORITY,
  });
  assert.equal(health.ok, true);
  assert.equal(health.providerId, 'fixture');
  assert.equal(health.defaultForLive, false);
  assert.equal(health.authority, 'candidate-discovery-only');
  assert.equal(Object.prototype.hasOwnProperty.call(info, 'promptTruth'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(info, 'toolEvidenceReceipt'), false);
});

test('fixture provider embeds texts and queries deterministically without dependencies', async () => {
  const provider = createEmbeddingProvider({ provider: 'test-fixture', dimensions: 16, truncateDim: 6 });
  const firstBatch = await provider.embedTexts([
    'Copper rabbit beside the notebook',
    'Silver watch near the arcade cashier',
  ]);
  const secondBatch = await provider.embedTexts([
    'Copper rabbit beside the notebook',
    'Silver watch near the arcade cashier',
  ]);
  const query = await provider.embedQuery('Copper rabbit beside the notebook');

  assert.equal(provider.getProviderInfo().modelId, FIXTURE_MODEL_ID);
  assert.equal(firstBatch.length, 2);
  assert.equal(firstBatch[0].length, 6);
  assert.equal(firstBatch[1].length, 6);
  assert.deepEqual(firstBatch, secondBatch);
  assert.deepEqual(query, firstBatch[0]);
  assert.notDeepEqual(firstBatch[0], firstBatch[1]);
  assert.deepEqual(await provider.embedTexts([]), []);
});

test('static-shadow adapter reuses the existing deterministic static embedding helper', async () => {
  const provider = createEmbeddingProvider({
    provider: 'static-shadow',
    dimensions: 16,
  });
  const info = provider.getProviderInfo();
  const text = 'A copper rabbit sat beside the coding notebook.';
  const embedding = await provider.embedQuery(text);

  assert.equal(info.providerId, STATIC_PROVIDER_ID);
  assert.equal(info.modelId, STATIC_SHADOW_EMBED_MODEL);
  assert.equal(info.modelFamily, 'penny-static-shadow');
  assert.equal(info.dimensions, 16);
  assert.equal(info.truncateDim, 16);
  assert.equal(info.defaultForLive, false);
  assert.deepEqual(embedding, createStaticShadowEmbedding(text, { dimensions: 16 }));
});

test('provider normalization accepts aliases and rejects unknown providers', () => {
  assert.equal(normalizeProviderId(''), 'fixture');
  assert.equal(normalizeProviderId('deterministic-fixture'), 'fixture');
  assert.equal(normalizeProviderId('static-shadow'), 'static');
  assert.equal(normalizeProviderId('penny-static-shadow-lexical'), 'static');
  assert.throws(
    () => createEmbeddingProvider({ provider: 'model2vec-potion-8m' }),
    /Unknown embedding provider: model2vec-potion-8m/,
  );
});

test('embedTexts validates input shape and provider info is a defensive copy', async () => {
  const provider = createEmbeddingProvider();
  const info = provider.getProviderInfo();
  info.providerId = 'mutated';

  assert.equal(provider.getProviderInfo().providerId, 'fixture');
  await assert.rejects(
    () => provider.embedTexts('not-an-array'),
    /embedTexts expects an array of texts/,
  );
});
