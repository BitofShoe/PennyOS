const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  MODEL2VEC_POTION_8M_MODEL_ID,
  MODEL2VEC_POTION_8M_PROVIDER_ID,
  createEmbeddingProvider,
} = require('../lib/penny-embedding-providers');
const {
  STATIC_EMBEDDING_CACHE_SCHEMA,
  buildStaticEmbeddingCacheFileName,
  buildStaticEmbeddingCacheIdentity,
  buildStaticEmbeddingCacheKey,
  createStaticEmbeddingCacheApi,
} = require('../lib/penny-static-embedding-cache');

function makeProviderInfo(overrides = {}) {
  return {
    providerId: MODEL2VEC_POTION_8M_PROVIDER_ID,
    modelId: MODEL2VEC_POTION_8M_MODEL_ID,
    modelRevision: 'npm:sha512-test-revision',
    dimensions: 256,
    truncateDim: 256,
    normalization: 'unit-l2',
    distance: 'cosine',
    ...overrides,
  };
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'penny-static-embedding-cache-'));
}

test('static cache filename is isolated from the live LM Studio embedding cache', () => {
  const provider = createEmbeddingProvider({
    provider: 'model2vec-potion-8m',
    importModule: async () => ({ embed: async () => [] }),
  });
  const info = provider.getProviderInfo();

  assert.equal(
    buildStaticEmbeddingCacheFileName(info),
    'penny-memory-embeddings.static.model2vec-potion-8m.dim256.json',
  );
  assert.notEqual(buildStaticEmbeddingCacheFileName(info), 'penny-memory-embeddings.json');
  assert.equal(
    buildStaticEmbeddingCacheFileName({ ...info, truncateDim: 8 }),
    'penny-memory-embeddings.static.model2vec-potion-8m.dim8.json',
  );
});

test('cache identity records provider, model, revision, dimensions, normalization, and source identity', () => {
  const identity = buildStaticEmbeddingCacheIdentity({
    providerInfo: makeProviderInfo({ truncateDim: 8 }),
    sourceItem: {
      id: 'episode-1',
      updatedAt: '2026-04-22T01:00:00.000Z',
      text: 'The copper rabbit replaced the brass fox.',
    },
  });

  assert.deepEqual(identity, {
    vectorSpace: {
      providerId: MODEL2VEC_POTION_8M_PROVIDER_ID,
      modelId: MODEL2VEC_POTION_8M_MODEL_ID,
      modelRevision: 'npm:sha512-test-revision',
      dimensions: 256,
      truncateDim: 8,
      normalization: 'unit-l2',
      distance: 'cosine',
    },
    source: {
      sourceItemId: 'episode-1',
      sourceUpdatedAt: '2026-04-22T01:00:00.000Z',
      sourceHash: 'cbdb00be38d4a3533335cffbcd42917b82e982d5f8cde74194eff339ce6dcd1a',
    },
  });
});

test('cache keys change across vector-space and source-version boundaries', () => {
  const sourceItem = {
    id: 'archive:episode:abc123',
    updatedAt: '2026-04-22T01:00:00.000Z',
    text: 'The copper rabbit replaced the brass fox.',
  };
  const providerInfo = makeProviderInfo();
  const baseline = buildStaticEmbeddingCacheKey({ providerInfo, sourceItem });
  const variants = [
    buildStaticEmbeddingCacheKey({ providerInfo: { ...providerInfo, providerId: 'static' }, sourceItem }),
    buildStaticEmbeddingCacheKey({ providerInfo: { ...providerInfo, modelId: 'minishlab/potion-base-32M' }, sourceItem }),
    buildStaticEmbeddingCacheKey({ providerInfo: { ...providerInfo, modelRevision: 'different-revision' }, sourceItem }),
    buildStaticEmbeddingCacheKey({ providerInfo: { ...providerInfo, truncateDim: 8 }, sourceItem }),
    buildStaticEmbeddingCacheKey({ providerInfo: { ...providerInfo, normalization: 'none' }, sourceItem }),
    buildStaticEmbeddingCacheKey({ providerInfo, sourceItem: { ...sourceItem, id: 'archive:episode:def456' } }),
    buildStaticEmbeddingCacheKey({ providerInfo, sourceItem: { ...sourceItem, updatedAt: '2026-04-22T02:00:00.000Z' } }),
    buildStaticEmbeddingCacheKey({ providerInfo, sourceItem: { ...sourceItem, text: 'The brass fox was stale.' } }),
  ];

  assert.match(baseline, /^static:model2vec-potion-8m:archive-episode-abc123:/);
  for (const key of variants) {
    assert.notEqual(key, baseline);
  }
});

test('static cache api writes isolated model-aware stores and rejects incompatible spaces', () => {
  const root = makeTempDir();
  const cacheFile = path.join(root, buildStaticEmbeddingCacheFileName(makeProviderInfo()));
  const firstProvider = makeProviderInfo();
  const api = createStaticEmbeddingCacheApi({
    fs,
    path,
    CACHE_FILE: cacheFile,
    providerInfo: firstProvider,
    nowMs: () => Date.UTC(2026, 3, 22, 1, 0, 0),
  });

  try {
    const sourceItem = {
      id: 'archive:episode:abc123',
      updatedAt: '2026-04-22T01:00:00.000Z',
      contentHash: 'content-v1',
    };
    const vector = Array.from({ length: 256 }, (_, index) => (index === 3 ? 1 : 0));
    const written = api.upsertVector({ sourceItem, vector, textPreview: 'Copper rabbit correction.' });
    const key = api.keyForSource(sourceItem);

    assert.equal(api.cacheFile, cacheFile);
    assert.equal(written.schema, STATIC_EMBEDDING_CACHE_SCHEMA);
    assert.ok(written.items[key]);
    assert.deepEqual(api.getVectorForSource(sourceItem), vector);

    const incompatible = createStaticEmbeddingCacheApi({
      fs,
      path,
      CACHE_FILE: cacheFile,
      providerInfo: makeProviderInfo({ modelId: 'minishlab/potion-base-32M' }),
    });
    assert.deepEqual(incompatible.readCacheStore().items, {});
    assert.equal(incompatible.getVectorForSource(sourceItem), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('upserting an updated source item removes the prior source-version vector', () => {
  const root = makeTempDir();
  const cacheFile = path.join(root, buildStaticEmbeddingCacheFileName(makeProviderInfo({ truncateDim: 4 })));
  let current = Date.UTC(2026, 3, 22, 1, 0, 0);
  const api = createStaticEmbeddingCacheApi({
    fs,
    path,
    CACHE_FILE: cacheFile,
    providerInfo: makeProviderInfo({ truncateDim: 4 }),
    nowMs: () => (current += 1000),
  });

  try {
    const firstSource = { id: 'episode-1', updatedAt: '2026-04-22T01:00:00.000Z', contentHash: 'v1' };
    const secondSource = { id: 'episode-1', updatedAt: '2026-04-22T01:01:00.000Z', contentHash: 'v2' };
    api.upsertVector({ sourceItem: firstSource, vector: [1, 0, 0, 0] });
    const firstKey = api.keyForSource(firstSource);
    api.upsertVector({ sourceItem: secondSource, vector: [0, 1, 0, 0] });
    const secondKey = api.keyForSource(secondSource);
    const store = api.readCacheStore();

    assert.equal(Object.keys(store.items).length, 1);
    assert.equal(store.items[firstKey], undefined);
    assert.deepEqual(store.items[secondKey].vector, [0, 1, 0, 0]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('static cache api rejects vectors whose length does not match truncateDim', () => {
  const root = makeTempDir();
  const api = createStaticEmbeddingCacheApi({
    fs,
    path,
    CACHE_FILE: path.join(root, 'cache.json'),
    providerInfo: makeProviderInfo({ truncateDim: 8 }),
  });

  try {
    assert.throws(
      () => api.upsertVector({
        sourceItem: { id: 'episode-1', contentHash: 'v1' },
        vector: [1, 0, 0],
      }),
      /vector length 3 did not match truncateDim 8/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
