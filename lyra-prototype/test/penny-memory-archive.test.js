const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createMemoryArchiveApi } = require('../lib/penny-memory-archive');

function makeTempFiles(prefix = 'penny-archive-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    archiveFile: path.join(root, 'penny-memory-archive.json'),
    embeddingsFile: path.join(root, 'penny-memory-embeddings.json'),
  };
}

function buildEmbeddingVector(text = '') {
  const source = String(text || '').toLowerCase();
  return [
    source.includes('midnight') ? 1 : 0,
    source.includes('rain') ? 1 : 0,
    source.includes('coffee') ? 1 : 0,
    source.includes('storm') ? 1 : 0,
    Math.min(1, source.length / 200),
  ];
}

function buildArchiveApi({
  archiveFile,
  embeddingsFile,
  embedReady = true,
  embedModel = 'text-embedding-nomic-embed-text-v1.5',
} = {}) {
  let fetchCalls = 0;
  const api = createMemoryArchiveApi({
    fs,
    path,
    fetch: async (_url, options = {}) => {
      fetchCalls += 1;
      let input = '';
      try {
        input = JSON.parse(options.body || '{}').input || '';
      } catch {}
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            data: [
              { embedding: buildEmbeddingVector(input) },
            ],
          });
        },
      };
    },
    ARCHIVE_FILE: archiveFile,
    EMBEDDINGS_FILE: embeddingsFile,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    PENNY_LMSTUDIO_EMBED_MODEL: embedModel,
    async getLmStudioConnectionStatus() {
      return {
        reachable: true,
        installedModels: embedReady ? [embedModel] : [],
        nativeAvailableModels: embedReady ? [embedModel] : [],
        availableModels: embedReady ? [embedModel] : [],
      };
    },
    nowMs: (() => {
      let current = Date.UTC(2026, 3, 13, 12, 0, 0);
      return () => (current += 1000);
    })(),
  });
  return { api, getFetchCalls: () => fetchCalls };
}

test('archiveCompletedTurn preserves raw episodes, summaries, patterns, and promotion queue', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Midnight rain always calms me down.',
      assistantText: 'You keep circling that midnight rain feeling.',
    });
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'I keep thinking about midnight rain and city lights.',
      assistantText: 'That midnight rain image really sticks with you.',
    });
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Midnight rain makes the whole city feel softer to me.',
      assistantText: 'That is definitely a recurring thread for you.',
    });

    const archive = api.readArchiveStore();
    assert.equal(archive.sessions.demo.episodes.length, 3);
    assert.match(archive.sessions.demo.summaries[0].text, /recent session threads/i);
    assert.ok(archive.global.patterns.some((item) => /midnight rain/i.test(item.text)));
    assert.ok(archive.global.promotionQueue.some((item) => /midnight rain/i.test(item.text)));

    const embeddings = api.readEmbeddingsStore();
    assert.ok(Object.keys(embeddings.items).length >= 3);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext falls back cleanly to keyword retrieval and keeps separate caps', async () => {
  const files = makeTempFiles();
  const { api, getFetchCalls } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        { id: 's1', type: 'episode', text: 'Midnight rain feels safe', excerpt: 'Midnight rain feels safe', userText: 'Midnight rain feels safe', createdAt: '2026-04-13T12:00:00.000Z' },
        { id: 's2', type: 'episode', text: 'Coffee helps in the storm', excerpt: 'Coffee helps in the storm', userText: 'Coffee helps in the storm', createdAt: '2026-04-13T12:01:00.000Z' },
        { id: 's3', type: 'episode', text: 'Midnight rain on windows again', excerpt: 'Midnight rain on windows again', userText: 'Midnight rain on windows again', createdAt: '2026-04-13T12:02:00.000Z' },
      ],
      summaries: [],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    archive.global.summaries = [
      { id: 'g1', type: 'summary', text: 'Longer-term themes: midnight rain; city lights.', createdAt: '2026-04-13T12:03:00.000Z' },
      { id: 'g2', type: 'summary', text: 'Longer-term themes: coffee; storms.', createdAt: '2026-04-13T12:04:00.000Z' },
      { id: 'g3', type: 'summary', text: 'Longer-term themes: music; late nights.', createdAt: '2026-04-13T12:05:00.000Z' },
    ];
    archive.global.patterns = [
      { id: 'p1', type: 'pattern', text: 'They keep returning to midnight rain.', createdAt: '2026-04-13T12:06:00.000Z', patternKey: 'midnight rain' },
      { id: 'p2', type: 'pattern', text: 'They keep returning to coffee.', createdAt: '2026-04-13T12:07:00.000Z', patternKey: 'coffee' },
      { id: 'p3', type: 'pattern', text: 'They keep returning to city lights.', createdAt: '2026-04-13T12:08:00.000Z', patternKey: 'city lights' },
    ];
    api.writeArchiveStore(archive);

    const result = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'Can you tell me about the midnight rain thing again?',
      lane: 'chat',
    });

    assert.equal(result.semanticMemory.ready, false);
    assert.equal(result.archiveContext.mode, 'keyword');
    assert.ok(result.archiveContext.session.length <= 2);
    assert.ok(result.archiveContext.global.length <= 2);
    assert.match(result.archiveContext.session[0].text, /midnight rain/i);
    assert.equal(getFetchCalls(), 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('reviewPromotion approves candidate text and purgeMemory clears session archive data', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Midnight rain helps me breathe.',
      assistantText: 'That image matters to you.',
    });
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Midnight rain makes the whole night feel softer.',
      assistantText: 'It keeps showing up for a reason.',
    });
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Midnight rain is one of my favorite moods.',
      assistantText: 'That one is probably worth remembering.',
    });

    const queueItem = api.readArchiveStore().global.promotionQueue[0];
    assert.ok(queueItem);
    const review = api.reviewPromotion({ queueId: queueItem.id, action: 'approve' });
    assert.equal(review.action, 'approve');
    assert.equal(review.promotedMemory.kind, 'observation');
    assert.match(review.promotedMemory.text, /midnight rain/i);

    api.purgeMemory({ sessionId: 'demo', clearSessionArchive: true });
    const archive = api.readArchiveStore();
    assert.equal(Boolean(archive.sessions.demo), false);
    assert.equal(archive.global.episodes.some((item) => item.sessionId === 'demo'), false);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});
