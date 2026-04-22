const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createEmbeddingProvider,
} = require('../lib/penny-embedding-providers');
const {
  createStaticEmbeddingCacheApi,
} = require('../lib/penny-static-embedding-cache');
const {
  collectStaticMemorySourceItems,
  createStaticMemoryIndexApi,
  normalizeIndexScope,
  normalizeStaticEmbedMode,
} = require('../lib/penny-static-memory-index');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'penny-static-memory-index-'));
}

function makeProvider({ dimensions = 16, truncateDim = 8 } = {}) {
  return createEmbeddingProvider({
    provider: 'fixture',
    dimensions,
    truncateDim,
  });
}

function makeArchiveStore() {
  return {
    meta: { updatedAt: '2026-04-22T01:00:00.000Z' },
    global: {
      episodes: [{
        id: 'g-episode-1',
        type: 'episode',
        createdAt: '2026-04-22T01:00:00.000Z',
        updatedAt: '2026-04-22T01:00:00.000Z',
        text: 'Copper rabbit replaced the brass fox.',
        excerpt: 'Copper rabbit correction.',
      }],
      summaries: [{
        id: 'g-summary-1',
        type: 'summary',
        updatedAt: '2026-04-22T01:01:00.000Z',
        text: 'Longer-term themes: careful memory authority.',
      }],
      patterns: [],
      promotionQueue: [],
    },
    sessions: {
      demo: {
        episodes: [{
          id: 's-episode-1',
          type: 'episode',
          sessionId: 'demo',
          createdAt: '2026-04-22T01:02:00.000Z',
          updatedAt: '2026-04-22T01:02:00.000Z',
          userText: 'Remember the silver thermos.',
          assistantText: 'I will keep the silver thermos as an advisory episode.',
          excerpt: 'Remember the silver thermos.',
        }],
        summaries: [],
        chapters: [{
          id: 'chapter-1',
          type: 'chapter',
          updatedAt: '2026-04-22T01:03:00.000Z',
          text: 'Session chapter: silver thermos and notebook details.',
        }],
      },
    },
  };
}

function makeLedgerStore() {
  return {
    meta: { updatedAt: '2026-04-22T01:04:00.000Z' },
    topics: {
      'topic-static': {
        topicId: 'topic-static',
        topicLabel: 'static embedding sidecar',
        question: 'How should static embeddings stay advisory?',
        conclusion: 'Static candidates are retrieval hints, not memory truth.',
        openFollowUps: ['Add correction canaries before live-advisory.'],
        evidenceRefs: [{
          label: 'plan doc',
          ref: 'docs/plans/penny-static-embedding-live-advisory-plan-2026-04-22.md',
        }],
        lastTouchedAt: '2026-04-22T01:04:00.000Z',
      },
    },
  };
}

test('mode and scope normalization keep live modes explicit', () => {
  assert.equal(normalizeStaticEmbedMode(''), 'off');
  assert.equal(normalizeStaticEmbedMode('live'), 'live-shadow');
  assert.equal(normalizeStaticEmbedMode('advisory'), 'live-advisory');
  assert.equal(normalizeStaticEmbedMode('fallback'), 'live-fallback');
  assert.equal(normalizeStaticEmbedMode('definitely-not-a-mode'), 'off');
  assert.deepEqual(normalizeIndexScope('session,ledger'), ['session', 'research-ledger']);
  assert.deepEqual(normalizeIndexScope('all'), ['session', 'archive', 'research-ledger']);
});

test('source collection covers archive, session, and research-ledger items', () => {
  const sources = collectStaticMemorySourceItems({
    archiveStore: makeArchiveStore(),
    ledgerStore: makeLedgerStore(),
    scope: 'session,archive,research-ledger',
  });
  const ids = sources.map((item) => item.sourceItemId).sort();

  assert.deepEqual(ids, [
    'archive:episode:g-episode-1',
    'archive:summary:g-summary-1',
    'research-ledger:topic:topic-static',
    'session:demo:chapter:chapter-1',
    'session:demo:episode:s-episode-1',
  ]);
  assert.equal(sources.find((item) => item.sourceItemId === 'research-ledger:topic:topic-static').sourceAuthority, 'advisory');
});

test('disabled index never loads the provider and skips query without blocking', async () => {
  let providerLoads = 0;
  const index = createStaticMemoryIndexApi({
    fs,
    path,
    mode: 'off',
    providerFactory() {
      providerLoads += 1;
      return makeProvider();
    },
  });

  assert.equal(index.isEnabled(), false);
  assert.equal(index.getStatus().enabled, false);
  assert.equal(index.getStatus().ready, false);
  const result = await index.query('copper rabbit');
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'disabled');
  assert.deepEqual(result.candidates, []);
  assert.equal(result.queryMs, 0);
  assert.deepEqual(result.status, index.getStatus());
  assert.equal(result.frameBudgetSidecar.id, 'static-memory-query');
  assert.equal(result.frameBudgetSidecar.status, 'skipped');
  assert.equal(result.frameBudgetSidecar.budgetMs, 40);
  assert.equal(result.frameBudgetSidecar.candidateCount, 0);
  assert.equal(result.frameBudgetSidecar.promptTruthExpanded, false);
  assert.equal(providerLoads, 0);
});

test('live-shadow start hydrates cached vectors, enqueues missing sources, and builds asynchronously', async () => {
  const root = makeTempDir();
  const cacheFile = path.join(root, 'static-cache.json');
  const provider = makeProvider();
  const providerInfo = provider.getProviderInfo();
  const cache = createStaticEmbeddingCacheApi({
    fs,
    path,
    CACHE_FILE: cacheFile,
    providerInfo,
  });
  cache.upsertVector({
    sourceItem: {
      id: 'archive:episode:g-episode-1',
      updatedAt: '2026-04-22T01:00:00.000Z',
      text: 'Copper rabbit replaced the brass fox.',
    },
    vector: await provider.embedQuery('Copper rabbit replaced the brass fox.'),
    textPreview: 'Copper rabbit correction.',
  });

  const index = createStaticMemoryIndexApi({
    fs,
    path,
    CACHE_FILE: cacheFile,
    mode: 'live-shadow',
    provider: 'fixture',
    providerFactory: () => provider,
    readArchiveStore: makeArchiveStore,
    readLedgerStore: makeLedgerStore,
    autoSchedule: false,
  });

  try {
    const started = await index.start();
    assert.equal(started.enabled, true);
    assert.equal(started.mode, 'live-shadow');
    assert.equal(started.provider, 'fixture');
    assert.equal(started.ready, true);
    assert.equal(started.indexedItems, 1);
    assert.equal(started.pendingItems, 4);

    const drained = await index.drainPending();
    assert.equal(drained.indexedItems, 5);
    assert.equal(drained.pendingItems, 0);
    assert.equal(drained.ready, true);

    const result = await index.query('What did I say about the copper rabbit?', { budgetMs: 10000 });
    assert.equal(result.skipped, false);
    assert.ok(result.candidates.some((item) => item.id === 'archive:episode:g-episode-1'));
    assert.equal(result.status.lastQueryMs, result.queryMs);
    assert.equal(result.status.ready, true);
    assert.equal(result.frameBudgetSidecar.id, 'static-memory-query');
    assert.equal(result.frameBudgetSidecar.status, 'scheduled');
    assert.equal(result.frameBudgetSidecar.budgetMs, 10000);
    assert.equal(result.frameBudgetSidecar.actualMs, result.queryMs);
    assert.equal(result.frameBudgetSidecar.candidateCount, result.candidates.length);
    assert.equal(result.frameBudgetSidecar.promptTruthExpanded, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('enqueueSourceItems indexes new and updated turn items with one cache entry per source id', async () => {
  const root = makeTempDir();
  const cacheFile = path.join(root, 'static-cache.json');
  let now = Date.UTC(2026, 3, 22, 1, 0, 0);
  const provider = makeProvider({ dimensions: 12, truncateDim: 6 });
  const index = createStaticMemoryIndexApi({
    fs,
    path,
    CACHE_FILE: cacheFile,
    mode: 'live-shadow',
    provider: 'fixture',
    providerFactory: () => provider,
    readArchiveStore: () => ({}),
    readLedgerStore: () => ({}),
    autoSchedule: false,
    nowMs: () => (now += 1000),
  });

  try {
    await index.start();
    index.enqueueSourceItems([{
      id: 'session:demo:episode:new-turn',
      updatedAt: '2026-04-22T01:00:00.000Z',
      text: 'The silver thermos is beside the notebook.',
    }], { schedule: false });
    await index.drainPending();
    assert.equal(index.getStatus().indexedItems, 1);

    index.enqueueSourceItems([{
      id: 'session:demo:episode:new-turn',
      updatedAt: '2026-04-22T01:05:00.000Z',
      text: 'The gold watch replaced the silver watch.',
    }], { schedule: false });
    await index.drainPending();

    const cacheStore = createStaticEmbeddingCacheApi({
      fs,
      path,
      CACHE_FILE: cacheFile,
      providerInfo: provider.getProviderInfo(),
    }).readCacheStore();
    assert.equal(Object.keys(cacheStore.items).length, 1);

    const result = await index.query('gold watch');
    assert.equal(result.skipped, false);
    assert.equal(result.candidates[0].id, 'session:demo:episode:new-turn');
    assert.match(result.candidates[0].textPreview, /gold watch/i);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('provider health failure leaves the live index inspectable but not ready', async () => {
  const root = makeTempDir();
  const index = createStaticMemoryIndexApi({
    fs,
    path,
    DATA_DIR: root,
    mode: 'live-shadow',
    provider: 'fixture',
    providerFactory: () => ({
      getProviderInfo: () => makeProvider().getProviderInfo(),
      healthCheck: async () => ({ ok: false, error: 'mock provider offline' }),
      embedTexts: async () => {
        throw new Error('should not embed');
      },
      embedQuery: async () => {
        throw new Error('should not query');
      },
    }),
    readArchiveStore: makeArchiveStore,
    readLedgerStore: makeLedgerStore,
    autoSchedule: false,
  });

  try {
    const status = await index.start();
    assert.equal(status.enabled, true);
    assert.equal(status.ready, false);
    assert.equal(status.indexedItems, 0);
    assert.equal(status.pendingItems, 0);
    assert.match(status.error, /mock provider offline/);

    const result = await index.query('copper rabbit');
    assert.equal(result.skipped, true);
    assert.match(result.reason, /mock provider offline/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
