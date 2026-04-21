const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  createMemoryArchiveApi,
  ARCHIVE_RETRIEVAL_REASON_CODES,
  ARCHIVE_COMPRESSION_REASON_CODES,
} = require('../lib/penny-memory-archive');

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

function buildProvenanceEntries(count = 0, {
  oldText = 'Favorite tea is oolong',
  newText = 'Favorite tea is lapsang souchong',
  conflictKey = 'favorite tea',
  trigger = 'actually',
  sourceEpisodeIdPrefix = 'episode',
} = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `prov-${index + 1}`,
    createdAt: `2026-04-13T12:${String(index).padStart(2, '0')}:00.000Z`,
    oldText,
    newText,
    conflictKey,
    trigger,
    sourceEpisodeId: `${sourceEpisodeIdPrefix}-${index + 1}`,
    confidence: 0.42 + (index * 0.01),
  }));
}

function buildArchiveApi({
  archiveFile,
  embeddingsFile,
  embedReady = true,
  embedModel = 'text-embedding-nomic-embed-text-v1.5',
  enableBackgroundChatVectors = false,
  backgroundChatVectorBatchLimit = 2,
  fetchImpl = null,
  statusInstalledModels = null,
  statusNativeAvailableModels = null,
  statusAvailableModels = null,
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
      if (typeof fetchImpl === 'function') {
        return fetchImpl(_url, options, { input, fetchCalls });
      }
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
    ENABLE_BACKGROUND_CHAT_VECTORS: enableBackgroundChatVectors,
    BACKGROUND_CHAT_VECTOR_BATCH_LIMIT: backgroundChatVectorBatchLimit,
    async getLmStudioConnectionStatus() {
      return {
        reachable: true,
        installedModels: Array.isArray(statusInstalledModels)
          ? statusInstalledModels
          : (embedReady ? [embedModel] : []),
        nativeAvailableModels: Array.isArray(statusNativeAvailableModels)
          ? statusNativeAvailableModels
          : (embedReady ? [embedModel] : []),
        availableModels: Array.isArray(statusAvailableModels)
          ? statusAvailableModels
          : (embedReady ? [embedModel] : []),
      };
    },
    nowMs: (() => {
      let current = Date.UTC(2026, 3, 13, 12, 0, 0);
      return () => (current += 1000);
    })(),
  });
  return { api, getFetchCalls: () => fetchCalls };
}

function buildAuditSlice({
  turnId = 'turn-1',
  usedAt = '2026-04-13T12:00:00.000Z',
  userTextExcerpt = 'Audit excerpt',
  selectedLane = 'chat',
  requestedMode = 'local',
  executionPath = 'llm-chat',
  retrieval = {},
  promptTruth = {},
  artifactSummary = {},
  researchLedger = {},
} = {}) {
  return {
    turnId,
    usedAt,
    userTextExcerpt,
    selectedLane,
    requestedMode,
    executionPath,
    retrieval: {
      mode: retrieval.mode || 'keyword',
      reasonCode: retrieval.reasonCode || ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK,
      selectedSessionIds: retrieval.selectedSessionIds || [],
      selectedGlobalIds: retrieval.selectedGlobalIds || [],
      selectedBookIds: retrieval.selectedBookIds || [],
      selectedLedgerIds: retrieval.selectedLedgerIds || [],
      renderedSessionIds: retrieval.renderedSessionIds || [],
      renderedGlobalIds: retrieval.renderedGlobalIds || [],
      renderedBookIds: retrieval.renderedBookIds || [],
      renderedLedgerIds: retrieval.renderedLedgerIds || [],
      compression: {
        used: retrieval.compression?.used === true,
      },
      semanticReady: retrieval.semanticReady === true,
      semanticDowngrade: retrieval.semanticDowngrade === true,
    },
    promptTruth: {
      channels: {
        stableFacts: promptTruth.stableFacts || { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
        memoryBooks: promptTruth.memoryBooks || { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
        sessionArchive: promptTruth.sessionArchive || { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
        globalArchive: promptTruth.globalArchive || { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
        researchLedger: promptTruth.researchLedger || { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
      },
    },
    artifactSummary: {
      kind: artifactSummary.kind || 'chat-turn',
      authority: {
        reply: artifactSummary.authority?.reply || 'stable-companion',
      },
      approximatePath: {
        status: artifactSummary.approximatePath?.status || 'exact',
      },
      researchLedgerRendered: artifactSummary.researchLedgerRendered === true
        ? true
        : (artifactSummary.researchLedgerRendered === false
          ? false
          : artifactSummary.researchLedgerPromptInjected === true),
      researchLedgerPromptInjected: artifactSummary.researchLedgerRendered === true
        ? true
        : (artifactSummary.researchLedgerRendered === false
          ? false
          : artifactSummary.researchLedgerPromptInjected === true),
    },
    researchLedger: {
      updateStatus: researchLedger.updateStatus || 'skipped',
      topicId: researchLedger.topicId || '',
      topicLabel: researchLedger.topicLabel || '',
    },
  };
}

test('scoreArchiveUtilityCandidate favors recent contradiction-linked anchors over older low-signal episodes', () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    const highUtility = api.scoreArchiveUtilityCandidate({
      sourceType: 'episode',
      createdAt: '2026-04-13T11:59:59.000Z',
      evidenceCount: 3,
      contradictionLinked: true,
      openLoopLinked: false,
      recentlyRetrieved: true,
    }, Date.UTC(2026, 3, 13, 12, 0, 5));
    const lowUtility = api.scoreArchiveUtilityCandidate({
      sourceType: 'episode',
      createdAt: '2026-03-20T12:00:00.000Z',
      evidenceCount: 1,
      contradictionLinked: false,
      openLoopLinked: false,
      recentlyRetrieved: false,
    }, Date.UTC(2026, 3, 13, 12, 0, 5));

    assert.ok(highUtility.score > lowUtility.score);
    assert.equal(highUtility.contradictionLinked, true);
    assert.equal(highUtility.recentlyRetrieved, true);
    assert.equal(lowUtility.openLoopLinked, false);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('writeEmbeddingsStore merges additive writes from a stale copy instead of dropping prior vectors', () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    const firstWrite = api.readEmbeddingsStore();
    const staleWrite = api.readEmbeddingsStore();

    firstWrite.items['hash-a'] = {
      hash: 'hash-a',
      text: 'Red glove on dryer three.',
      model: 'text-embedding-nomic-embed-text-v1.5',
      updatedAt: '2026-04-13T12:00:00.000Z',
      vector: buildEmbeddingVector('red glove on dryer three'),
      sensitivity: 'normal',
    };
    firstWrite.meta.updatedAt = '2026-04-13T12:00:00.000Z';

    staleWrite.items['hash-b'] = {
      hash: 'hash-b',
      text: 'Photo booth curtain missing two silver hooks.',
      model: 'text-embedding-nomic-embed-text-v1.5',
      updatedAt: '2026-04-13T12:00:01.000Z',
      vector: buildEmbeddingVector('photo booth curtain missing two silver hooks'),
      sensitivity: 'normal',
    };
    staleWrite.meta.updatedAt = '2026-04-13T12:00:01.000Z';

    api.writeEmbeddingsStore(firstWrite);
    api.writeEmbeddingsStore(staleWrite);

    const merged = api.readEmbeddingsStore();
    assert.ok(merged.items['hash-a']);
    assert.ok(merged.items['hash-b']);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('readEmbeddingsStore drops cached vectors from a different embedding model space', () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({
    ...files,
    embedModel: 'google/embedding-gemma-300m',
    statusInstalledModels: ['google/embedding-gemma-300m'],
    statusNativeAvailableModels: ['google/embedding-gemma-300m'],
    statusAvailableModels: ['google/embedding-gemma-300m'],
  });

  try {
    api.writeEmbeddingsStore({
      meta: {
        schemaVersion: 1,
        embedModel: 'text-embedding-nomic-embed-text-v1.5',
        updatedAt: '2026-04-13T12:00:00.000Z',
      },
      items: {
        'hash-nomic': {
          hash: 'hash-nomic',
          text: 'Red glove on dryer three.',
          model: 'text-embedding-nomic-embed-text-v1.5',
          updatedAt: '2026-04-13T12:00:00.000Z',
          vector: buildEmbeddingVector('red glove on dryer three'),
          sensitivity: 'normal',
        },
      },
    });

    const store = api.readEmbeddingsStore();
    assert.equal(store.meta.embedModel, 'google/embedding-gemma-300m');
    assert.deepEqual(Object.keys(store.items), []);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

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
    assert.equal(archive.sessions.demo.summaries[0].consolidation.lossy, true);
    assert.ok(archive.global.patterns.some((item) => /midnight rain/i.test(item.text)));
    assert.ok(archive.global.promotionQueue.some((item) => /midnight rain/i.test(item.text)));
    assert.ok(archive.global.promotionQueue.every((item) => item.promotionPacket && item.promotionPacket.sourceThreadId));
    assert.ok(archive.global.promotionQueue.every((item) => item.probation?.reviewStatus === 'pending'));
    assert.ok(archive.global.promotionQueue.every((item) => item.consolidation?.lossy === true));

    const embeddings = api.readEmbeddingsStore();
    assert.ok(Object.keys(embeddings.items).length >= 3);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn suppresses low-signal filler themes in stylized chat', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: "I'm just saying the black cherry perfume is unreal.",
      assistantText: 'So that one is already etched into your soul.',
    });
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: "Honestly I'm still saying the black cherry perfume wins.",
      assistantText: 'That scent is definitely getting promoted in your internal rankings.',
    });

    let archive = api.readArchiveStore();
    assert.equal(archive.global.summaries.length, 0);
    assert.equal(archive.global.patterns.length, 0);

    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: "Black cherry perfume again. I'm high on that one.",
      assistantText: 'Okay, so that is a real recurring thing now.',
    });

    archive = api.readArchiveStore();
    const summaryText = archive.global.summaries[0]?.text || '';
    const patternText = archive.global.patterns.map((item) => item.text).join('\n');

    assert.match(summaryText, /black cherry perfume/i);
    assert.doesNotMatch(summaryText, /\bi'm\b|honestly|high\b|just saying|still saying/i);
    assert.match(patternText, /black cherry perfume/i);
    assert.doesNotMatch(patternText, /\bi'm\b|honestly|high\b|just saying|still saying/i);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('createMemoryArchiveApi enables bounded background vectorization by default', async () => {
  const files = makeTempFiles();
  const api = createMemoryArchiveApi({
    fs,
    path,
    fetch: async () => ({
      ok: true,
      async text() {
        return JSON.stringify({ data: [] });
      },
    }),
    ARCHIVE_FILE: files.archiveFile,
    EMBEDDINGS_FILE: files.embeddingsFile,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
    async getLmStudioConnectionStatus() {
      return {
        reachable: true,
        installedModels: ['text-embedding-nomic-embed-text-v1.5'],
        nativeAvailableModels: ['text-embedding-nomic-embed-text-v1.5'],
        availableModels: ['text-embedding-nomic-embed-text-v1.5'],
      };
    },
  });

  try {
    const inspector = await api.getMemoryInspector({
      sessionId: 'default',
      explicitMemory: { memories: [] },
    });

    assert.equal(inspector.embeddings.backgroundVectorization.enabled, true);
    assert.equal(inspector.embeddings.backgroundVectorization.status, 'skipped');
    assert.equal(inspector.embeddings.backgroundVectorization.batchLimit, 2);
    assert.equal(inspector.embeddings.backgroundVectorization.sourceSessionId, '');
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
    assert.equal(result.archiveContext.reasonCode, ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK);
    assert.ok(result.archiveContext.session.length <= 2);
    assert.ok(result.archiveContext.global.length <= 2);
    assert.match(result.archiveContext.session[0].text, /midnight rain/i);
    assert.equal(getFetchCalls(), 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext suppresses weak sensitive matches instead of surfacing nonsense', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'safe-1',
          type: 'episode',
          text: 'Midnight rain on the windows felt safe again.',
          excerpt: 'Midnight rain on the windows felt safe again.',
          userText: 'Midnight rain on the windows felt safe again.',
          createdAt: '2026-04-13T12:00:00.000Z',
          sensitivity: 'normal',
        },
        {
          id: 'sensitive-1',
          type: 'episode',
          text: 'I feel broken and want to disappear tonight.',
          excerpt: 'I feel broken and want to disappear tonight.',
          userText: 'I feel broken and want to disappear tonight.',
          createdAt: '2026-04-13T12:01:00.000Z',
          sensitivity: 'high',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    api.writeArchiveStore(archive);

    const result = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'Can you tell me about the midnight rain again?',
      lane: 'chat',
    });

    const surfacedTexts = [
      ...result.archiveContext.session.map((item) => item.text),
      ...result.archiveContext.global.map((item) => item.text),
    ].join('\n');
    assert.match(surfacedTexts, /midnight rain/i);
    assert.doesNotMatch(surfacedTexts, /want to disappear|feel broken/i);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn preserves retrieval provenance and the inspector surfaces bounded lastRetrieval details', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    const retrieval = {
      usedAt: '2026-04-13T12:00:00.000Z',
      mode: 'semantic',
      embedModel: 'text-embedding-nomic-embed-text-v1.5',
      session: Array.from({ length: 8 }, (_, index) => ({
        id: `session-${index + 1}`,
        text: `Session hit ${index + 1}`,
        excerpt: `Session hit ${index + 1}`,
        sourceType: 'episode',
        scope: 'session',
        sensitivity: 'normal',
        createdAt: `2026-04-13T12:0${index}:00.000Z`,
        score: 8 + index,
        confidence: 0.35 + (index * 0.05),
      })),
      global: Array.from({ length: 8 }, (_, index) => ({
        id: `global-${index + 1}`,
        text: `Global hit ${index + 1}`,
        excerpt: `Global hit ${index + 1}`,
        sourceType: 'pattern',
        scope: 'global',
        sensitivity: 'normal',
        createdAt: `2026-04-13T12:1${index}:00.000Z`,
        score: 6 + index,
        confidence: 0.25 + (index * 0.05),
      })),
      books: [
        {
          id: 'appearance',
          text: 'Penny has coral hair when the user explicitly asks.',
          placement: 'memory',
          priority: 90,
          score: 104,
          sensitivity: 'normal',
          source: 'seed',
          matchedPhrases: ['what do you look like'],
          matchedOn: { lane: 'chat', attachmentType: 'none' },
        },
      ],
      compression: {
        used: true,
        reason: 'low-retrieval-confidence',
        chapters: [
          {
            id: 'chapter-1',
            text: 'Session chapter: midnight rain; city lights.',
            sourceType: 'chapter',
            scope: 'session',
            sensitivity: 'normal',
            createdAt: '2026-04-13T12:20:00.000Z',
            score: 5.5,
            confidence: 0.44,
          },
        ],
        explanation: {
          selectedSignals: ['active-contradiction', 'named-object-anchor'],
          penalties: ['scaffolding-filter'],
          omittedEpisodeCount: 9,
          carriedContradictions: [
            {
              id: 'contr-1',
              conflictKey: 'favorite tea',
              oldText: 'Favorite tea is oolong',
              newText: 'Favorite tea is lapsang souchong',
              status: 'active',
            },
          ],
        },
      },
    };

    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Midnight rain always calms me down.',
      assistantText: 'That image matters to you.',
      retrieval,
    });

    const inspector = await api.getMemoryInspector({
      sessionId: 'demo',
      explicitMemory: {
        memories: [
          { text: 'Favorite tea is lapsang souchong', kind: 'preference' },
        ],
      },
    });

    assert.equal(inspector.archive.session.lastRetrieval.mode, 'semantic');
    assert.equal(inspector.archive.session.lastRetrieval.embedModel, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(inspector.archive.session.lastRetrieval.session.length, 6);
    assert.equal(inspector.archive.session.lastRetrieval.global.length, 6);
    assert.equal(inspector.archive.session.lastRetrieval.session[0].text, 'Session hit 1');
    assert.equal(inspector.archive.session.lastRetrieval.global[0].text, 'Global hit 1');
    assert.equal(inspector.archive.session.lastRetrieval.session[5].text, 'Session hit 6');
    assert.equal(inspector.archive.session.lastRetrieval.global[5].text, 'Global hit 6');
    assert.equal(inspector.archive.session.lastRetrieval.reasonCode, ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY);
    assert.equal(inspector.archive.session.lastRetrieval.session[0].sourceLabel, 'archive-session');
    assert.equal(inspector.archive.session.lastRetrieval.global[0].sourceLabel, 'archive-global');
    assert.equal(inspector.archive.session.lastRetrieval.session[0].evidenceSnippet, 'Session hit 1');
    assert.equal(inspector.archive.session.lastRetrieval.session[0].consolidation.sourceScope, 'session');
    assert.equal(inspector.archive.session.lastRetrieval.session[0].consolidation.freshnessLabel, 'recent');
    assert.equal(inspector.archive.session.lastRetrieval.session[0].probation, null);
    assert.equal(inspector.archive.session.lastRetrieval.books.length, 1);
    assert.equal(inspector.archive.session.lastRetrieval.books[0].id, 'appearance');
    assert.equal(inspector.archive.session.lastRetrieval.books[0].sourceLabel, 'book');
    assert.equal(inspector.archive.session.lastRetrieval.compression.used, true);
    assert.equal(inspector.archive.session.lastRetrieval.compression.reasonCode, ARCHIVE_COMPRESSION_REASON_CODES.LOW_RETRIEVAL_CONFIDENCE);
    assert.equal(inspector.archive.session.lastRetrieval.compression.chapters[0].sourceType, 'chapter');
    assert.equal(inspector.archive.session.lastRetrieval.compression.chapters[0].consolidation.lossy, true);
    assert.deepEqual(inspector.archive.session.lastRetrieval.compression.explanation.selectedSignals, ['active-contradiction', 'named-object-anchor']);
    assert.deepEqual(inspector.archive.session.lastRetrieval.compression.explanation.penalties, ['scaffolding-filter']);
    assert.equal(inspector.archive.session.lastRetrieval.compression.explanation.omittedEpisodeCount, 9);
    assert.equal(inspector.archive.session.lastRetrieval.compression.explanation.carriedContradictions[0].conflictKey, 'favorite tea');
    assert.equal(inspector.archive.session.lastRetrieval.compression.consolidation.lossy, true);
    assert.equal(inspector.archive.session.lastRetrieval.compression.consolidation.mergeBasis.includes('active-contradiction'), true);
    assert.match(inspector.archive.session.lastArchivedAt, /^2026-04-13T12:00:0\d\.000Z$/);
    assert.equal(inspector.archive.session.updatedAt, inspector.archive.session.lastArchivedAt);
    assert.equal(inspector.explicit.memories.length, 1);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn preserves bounded correction provenance in lastRetrieval and inspector output', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    const retrieval = {
      usedAt: '2026-04-13T12:00:00.000Z',
      mode: 'semantic',
      embedModel: 'text-embedding-nomic-embed-text-v1.5',
      session: [],
      global: [],
      books: [],
      provenance: buildProvenanceEntries(8),
      compression: {
        used: false,
        reason: '',
        chapters: [],
      },
    };

    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'Actually, my favorite tea is lapsang souchong now.',
      assistantText: 'That is the new truth I should remember.',
      retrieval,
      provenance: buildProvenanceEntries(8),
    });

    const archive = api.readArchiveStore();
    assert.equal(archive.sessions.demo.lastRetrieval.provenance.length, 6);
    assert.equal(archive.sessions.demo.lastRetrieval.provenance[0].id, 'prov-1');
    assert.equal(archive.sessions.demo.lastRetrieval.provenance[5].id, 'prov-6');
    assert.match(archive.sessions.demo.lastRetrieval.provenance[0].newText, /lapsang souchong/i);
    assert.equal(archive.sessions.demo.lastRetrieval.provenance[0].conflictKey, 'favorite tea');
    assert.equal(archive.sessions.demo.lastRetrieval.reasonCode, ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY);
    assert.equal(archive.sessions.demo.lastRetrieval.compression.reasonCode, ARCHIVE_COMPRESSION_REASON_CODES.NOT_NEEDED);
    assert.equal(archive.sessions.demo.activeContradictions.length, 1);
    assert.equal(archive.sessions.demo.activeContradictions[0].conflictKey, 'favorite tea');
    assert.equal(archive.sessions.demo.activeContradictions[0].status, 'active');

    const inspector = await api.getMemoryInspector({
      sessionId: 'demo',
      explicitMemory: {
        memories: [
          { text: 'Favorite tea is lapsang souchong', kind: 'preference' },
        ],
      },
    });

    assert.equal(inspector.archive.session.lastRetrieval.provenance.length, 6);
    assert.equal(inspector.archive.session.lastRetrieval.provenance[0].trigger, 'actually');
    assert.equal(inspector.archive.session.lastRetrieval.provenance[0].sourceEpisodeId, 'episode-1');
    assert.equal(inspector.archive.session.lastRetrieval.reasonCode, ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY);
    assert.equal(inspector.archive.session.activeContradictions.length, 1);
    assert.equal(inspector.archive.session.activeContradictions[0].newText, 'Favorite tea is lapsang souchong');
    assert.equal(inspector.archive.session.activeContradictions[0].oldText, 'Favorite tea is oolong');
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext can surface session chapter fallback when semantic retrieval is unavailable after a shorter session', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    for (let index = 0; index < 7; index += 1) {
      await api.archiveCompletedTurn({
        sessionId: 'chapter-demo',
        userText: `Midnight rain and city lights memory ${index + 1}.`,
        assistantText: `Answer ${index + 1}.`,
      });
    }

    const archive = api.readArchiveStore();
    assert.ok(archive.sessions['chapter-demo'].chapters.length >= 1);

    const result = await api.buildArchiveContext({
      sessionId: 'chapter-demo',
      userText: 'Can you tell me the midnight rain thing again?',
      lane: 'chat',
    });

    assert.equal(result.archiveContext.compression.used, true);
    assert.equal(result.archiveContext.compression.reasonCode, ARCHIVE_COMPRESSION_REASON_CODES.SEMANTIC_UNAVAILABLE);
    assert.equal(result.retrieval.compression.used, true);
    assert.equal(result.retrieval.compression.reasonCode, ARCHIVE_COMPRESSION_REASON_CODES.SEMANTIC_UNAVAILABLE);
    assert.ok(result.retrieval.compression.chapters.length >= 1);
    assert.equal(result.retrieval.compression.chapters[0].sourceType, 'chapter');
    assert.ok(Array.isArray(result.retrieval.compression.explanation.selectedSignals));
    assert.ok(Array.isArray(result.retrieval.compression.explanation.penalties));
    assert.ok(Number.isFinite(result.retrieval.compression.explanation.omittedEpisodeCount));
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext marks semantic downgrade when query embedding creation fails under semantic-ready recall', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({
    ...files,
    fetchImpl: async (_url, _options, { input }) => ({
      ok: true,
      async text() {
        if (/semantic downgrade sentinel/i.test(input)) {
          return JSON.stringify({ data: [{ embedding: [] }] });
        }
        return JSON.stringify({
          data: [
            { embedding: buildEmbeddingVector(input) },
          ],
        });
      },
    }),
  });

  try {
    await api.archiveCompletedTurn({
      sessionId: 'semantic-downgrade',
      userText: 'The red glove stayed on dryer three.',
      assistantText: 'I can keep that red glove detail in view.',
    });

    const result = await api.buildArchiveContext({
      sessionId: 'semantic-downgrade',
      userText: 'semantic downgrade sentinel: what happened with the red glove again?',
      lane: 'chat',
    });

    assert.equal(result.semanticMemory.ready, true);
    assert.equal(result.archiveContext.mode, 'keyword');
    assert.equal(result.archiveContext.reasonCode, ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK);
    assert.equal(result.archiveContext.semanticReady, true);
    assert.equal(result.archiveContext.semanticAttempted, true);
    assert.equal(result.archiveContext.semanticDowngrade, true);
    assert.equal(result.archiveContext.semanticDowngradeReason, 'query-vector-unavailable');
    assert.equal(result.retrieval.semanticDowngrade, true);
    assert.equal(result.retrieval.semanticDowngradeReason, 'query-vector-unavailable');
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('getSemanticMemoryStatus treats a loaded embed model plus a live probe as ready even if the installed inventory lags', async () => {
  const files = makeTempFiles();
  const { api, getFetchCalls } = buildArchiveApi({
    ...files,
    embedReady: false,
    statusInstalledModels: [],
    statusNativeAvailableModels: ['text-embedding-nomic-embed-text-v1.5'],
    statusAvailableModels: [],
  });

  try {
    const status = await api.getSemanticMemoryStatus({ force: true });

    assert.equal(status.installed, true);
    assert.equal(status.loaded, true);
    assert.equal(status.ready, true);
    assert.equal(status.active, true);
    assert.equal(status.mode, 'semantic');
    assert.equal(status.fallback, false);
    assert.equal(status.reason, '');
    assert.equal(getFetchCalls(), 1);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('chapter compression carries the newest contradiction truth instead of resurfacing the superseded value', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    await api.archiveCompletedTurn({
      sessionId: 'contr-demo',
      userText: 'My favorite tea is oolong.',
      assistantText: 'Oolong it is.',
    });
    await api.archiveCompletedTurn({
      sessionId: 'contr-demo',
      userText: 'Actually, my favorite tea is lapsang souchong now.',
      assistantText: 'Lapsang souchong is the new truth.',
      provenance: buildProvenanceEntries(1),
    });
    for (let index = 0; index < 10; index += 1) {
      await api.archiveCompletedTurn({
        sessionId: 'contr-demo',
        userText: `Midnight rain memory ${index + 1} with the striped mug on the counter.`,
        assistantText: `Answer ${index + 1}.`,
      });
    }

    const result = await api.buildArchiveContext({
      sessionId: 'contr-demo',
      userText: 'What tea detail did I correct earlier?',
      lane: 'chat',
    });

    assert.equal(result.retrieval.compression.used, true);
    const chapterText = result.retrieval.compression.chapters[0]?.text || '';
    assert.match(chapterText, /lapsang souchong/i);
    assert.doesNotMatch(chapterText, /favorite tea is oolong(?!\))/i);
    assert.equal(result.retrieval.compression.explanation.carriedContradictions[0].conflictKey, 'favorite tea');
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
      retrieval: {
        usedAt: '2026-04-13T12:30:00.000Z',
        mode: 'semantic',
        embedModel: 'text-embedding-nomic-embed-text-v1.5',
        session: [],
        global: [],
        books: [],
        provenance: buildProvenanceEntries(2),
        compression: {
          used: false,
          reason: '',
          chapters: [],
        },
      },
    });

    const archiveBeforePurge = api.readArchiveStore();
    assert.equal(archiveBeforePurge.sessions.demo.lastRetrieval.provenance.length, 2);

    const queueItem = api.readArchiveStore().global.promotionQueue[0];
    assert.ok(queueItem);
    assert.ok(queueItem.promotionPacket);
    assert.ok(queueItem.promotionPacket.sourceThreadId);
    const review = api.reviewPromotion({ queueId: queueItem.id, action: 'approve' });
    assert.equal(review.action, 'approve');
    assert.equal(review.promotedMemory.kind, 'observation');
    assert.match(review.promotedMemory.text, /midnight rain/i);
    assert.equal(review.promotedMemory.source, 'review-candidate');
    assert.equal(review.promotedMemory.origin.queueId, queueItem.id);
    assert.equal(review.promotedMemory.origin.sourceThreadId, queueItem.promotionPacket.sourceThreadId);
    assert.ok(Array.isArray(review.promotedMemory.origin.sourceTurnIds) && review.promotedMemory.origin.sourceTurnIds.length >= 1);
    assert.equal(review.packet.sourceThreadId, queueItem.promotionPacket.sourceThreadId);
    assert.ok(review.packet.sourceTurnIds.length >= 1);

    api.purgeMemory({ sessionId: 'demo', clearSessionArchive: true });
    const archive = api.readArchiveStore();
    assert.equal(Boolean(archive.sessions.demo), false);
    assert.equal(archive.global.episodes.some((item) => item.sessionId === 'demo'), false);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn routes heuristic review candidates into the existing promotion queue', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    await api.archiveCompletedTurn({
      sessionId: 'demo',
      userText: 'I am into rainy cyberpunk vibes.',
      assistantText: 'That tracks.',
      reviewCandidates: [
        {
          text: 'They like rainy cyberpunk vibes',
          kind: 'preference',
          source: 'review-candidate',
          evidence: ['I am into rainy cyberpunk vibes.'],
          origin: {
            sourceType: 'heuristic-chat',
            evidenceSnippet: 'I am into rainy cyberpunk vibes.',
          },
        },
      ],
    });

    const archive = api.readArchiveStore();
    assert.equal(archive.global.promotionQueue.length, 1);
    assert.equal(archive.global.promotionQueue[0].sourceType, 'review-candidate');
    assert.equal(archive.global.promotionQueue[0].sourceLabel, 'review-candidate');
    assert.match(archive.global.promotionQueue[0].evidenceSnippet, /rainy cyberpunk vibes/i);
    assert.equal(archive.global.promotionQueue[0].promotionPacket.sourceThreadId, 'demo');
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn records skipped background vectorization telemetry when semantic memory is unavailable', async () => {
  const files = makeTempFiles();
  const { api, getFetchCalls } = buildArchiveApi({
    ...files,
    embedReady: false,
    enableBackgroundChatVectors: true,
    backgroundChatVectorBatchLimit: 1,
  });

  try {
    const result = await api.archiveCompletedTurn({
      sessionId: 'background-skip',
      userText: 'The silver thermos stayed on dryer three.',
      assistantText: 'I can keep that tucked away.',
    });
    const inspector = await api.getMemoryInspector({
      sessionId: 'background-skip',
      explicitMemory: { memories: [] },
    });

    assert.equal(result.backgroundVectorization.status, 'skipped');
    assert.equal(result.backgroundVectorization.skippedReason, 'semantic-memory-not-ready');
    assert.equal(result.backgroundVectorization.archivePending, false);
    assert.equal(result.backgroundVectorization.eagerEmbeddingCount, 0);
    assert.equal(result.backgroundVectorization.eagerCreatedCount, 0);
    assert.equal(result.backgroundVectorization.backgroundCandidateCount, 0);
    assert.equal(result.backgroundVectorization.backgroundCreatedCount, 0);
    assert.equal(result.backgroundVectorization.sourceSessionId, 'background-skip');
    assert.equal(inspector.embeddings.backgroundVectorization.status, 'skipped');
    assert.equal(inspector.embeddings.backgroundVectorization.batchLimit, 1);
    assert.equal(inspector.embeddings.backgroundVectorization.sourceSessionId, 'background-skip');
    assert.equal(inspector.embeddings.backgroundVectorization.eagerEmbeddingCount, 0);
    assert.equal(inspector.embeddings.backgroundVectorization.backgroundCandidateCount, 0);
    assert.equal(inspector.archive.meta.backgroundVectorization.sourceSessionId, 'background-skip');
    assert.equal(inspector.archive.meta.backgroundVectorization.status, 'skipped');
    assert.equal(getFetchCalls(), 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn prewarms bounded background chat vectors and records inspector telemetry when enabled', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({
    ...files,
    enableBackgroundChatVectors: true,
    backgroundChatVectorBatchLimit: 1,
  });

  try {
    await api.archiveCompletedTurn({
      sessionId: 'background-apply',
      userText: 'The photo booth curtain was missing two silver hooks.',
      assistantText: 'Right, the curtain with the missing hooks.',
    });
    const inspector = await api.getMemoryInspector({
      sessionId: 'background-apply',
      explicitMemory: { memories: [] },
      semanticMemory: { ready: true, configuredModel: 'text-embedding-nomic-embed-text-v1.5' },
    });
    const embeddings = api.readEmbeddingsStore();
    const selectedCandidates = api.selectBackgroundVectorizationCandidates({
      session: api.readArchiveStore().sessions['background-apply'],
      embeddings,
      now: Date.UTC(2026, 3, 13, 12, 0, 30),
    });

    assert.equal(inspector.embeddings.backgroundVectorization.status, 'applied');
    assert.equal(inspector.embeddings.backgroundVectorization.batchLimit, 1);
    assert.equal(inspector.embeddings.backgroundVectorization.sourceSessionId, 'background-apply');
    assert.ok(inspector.embeddings.backgroundVectorization.eagerEmbeddingCount >= 1);
    assert.ok(inspector.embeddings.backgroundVectorization.eagerCreatedCount >= 1);
    assert.equal(inspector.embeddings.backgroundVectorization.backgroundCandidateCount, 1);
    assert.equal(inspector.embeddings.backgroundVectorization.backgroundCreatedCount, 1);
    assert.equal(inspector.embeddings.backgroundVectorization.selectedCount, 1);
    assert.equal(inspector.embeddings.backgroundVectorization.createdCount, 1);
    assert.equal(inspector.embeddings.backgroundVectorization.candidates.length, 1);
    assert.match(inspector.embeddings.backgroundVectorization.candidates[0].evidenceSnippet, /photo booth curtain/i);
    assert.ok(Object.values(embeddings.items).some((item) => /missing two silver hooks/i.test(item.text)));
    assert.equal(selectedCandidates.length, 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn appends bounded recent audit slices and keeps lastRetrieval summary aligned', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    for (let index = 0; index < 9; index += 1) {
      const turnNumber = index + 1;
      const usedAt = `2026-04-13T12:${String(index).padStart(2, '0')}:00.000Z`;
      await api.archiveCompletedTurn({
        sessionId: 'audit-demo',
        userText: `Audit turn ${turnNumber} about midnight rain.`,
        assistantText: `Reply ${turnNumber}.`,
        retrieval: {
          usedAt,
          mode: turnNumber % 2 === 0 ? 'keyword' : 'semantic',
          reasonCode: turnNumber % 2 === 0
            ? ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK
            : ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY,
          semanticReady: turnNumber % 2 === 1,
          semanticAttempted: turnNumber % 2 === 1,
          semanticDowngrade: false,
          session: [
            {
              id: `session-${turnNumber}`,
              text: `Session hit ${turnNumber}`,
              excerpt: `Session hit ${turnNumber}`,
              sourceType: 'episode',
              scope: 'session',
              sensitivity: 'normal',
              createdAt: usedAt,
              score: 8,
              confidence: 0.6,
            },
          ],
          global: [],
          books: [],
          compression: {
            used: false,
            chapters: [],
          },
        },
        audit: buildAuditSlice({
          turnId: `turn-${turnNumber}`,
          usedAt,
          userTextExcerpt: `Audit turn ${turnNumber} about midnight rain.`,
          retrieval: {
            mode: turnNumber % 2 === 0 ? 'keyword' : 'semantic',
            reasonCode: turnNumber % 2 === 0
              ? ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK
              : ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY,
            selectedSessionIds: [`session-${turnNumber}`],
            renderedSessionIds: [`session-${turnNumber}`],
            compression: { used: false },
            semanticReady: turnNumber % 2 === 1,
            semanticDowngrade: false,
          },
          promptTruth: {
            stableFacts: { candidateCount: 1, renderedCount: 1, heldBackReason: '' },
            sessionArchive: { candidateCount: 1, renderedCount: 1, heldBackReason: '' },
          },
          artifactSummary: {
            kind: 'chat-turn',
            authority: { reply: 'stable-companion' },
            approximatePath: { status: 'exact' },
          },
        }),
      });
    }

    const archive = api.readArchiveStore();
    const session = archive.sessions['audit-demo'];
    const inspector = await api.getMemoryInspector({
      sessionId: 'audit-demo',
      explicitMemory: { memories: [] },
    });

    assert.equal(session.recentAuditTrail.length, 8);
    assert.equal(session.recentAuditTrail[0].turnId, 'turn-9');
    assert.equal(session.recentAuditTrail[7].turnId, 'turn-2');
    assert.deepEqual(session.lastRetrieval.summary.selectedSessionIds, ['session-9']);
    assert.deepEqual(session.lastRetrieval.summary.renderedSessionIds, ['session-9']);
    assert.equal(session.lastRetrieval.reasonCode, session.recentAuditTrail[0].retrieval.reasonCode);
    assert.equal(inspector.archive.session.recentAuditTrail.length, 8);
    assert.equal(inspector.archive.session.recentAuditTrail[0].turnId, 'turn-9');
    assert.deepEqual(inspector.archive.session.recentAuditTrail[0].retrieval.renderedSessionIds, ['session-9']);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn preserves held-back prompt-truth reasons inside compact audit slices', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    await api.archiveCompletedTurn({
      sessionId: 'audit-held-back',
      userText: 'What tea do I like again?',
      assistantText: 'Lapsang souchong.',
      retrieval: {
        usedAt: '2026-04-13T12:00:00.000Z',
        mode: 'keyword',
        reasonCode: ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK,
        semanticReady: false,
        semanticAttempted: false,
        semanticDowngrade: false,
        session: [
          {
            id: 'session-held',
            text: 'Favorite tea is lapsang souchong.',
            excerpt: 'Favorite tea is lapsang souchong.',
            sourceType: 'episode',
            scope: 'session',
            sensitivity: 'normal',
            createdAt: '2026-04-13T11:59:00.000Z',
            score: 8,
            confidence: 0.7,
          },
        ],
        global: [],
        books: [],
        compression: {
          used: false,
          chapters: [],
        },
      },
      audit: buildAuditSlice({
        turnId: 'held-back-1',
        userTextExcerpt: 'What tea do I like again?',
        retrieval: {
          mode: 'keyword',
          reasonCode: ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK,
          selectedSessionIds: ['session-held'],
        },
        promptTruth: {
          stableFacts: { candidateCount: 1, renderedCount: 1, heldBackReason: '' },
          sessionArchive: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
          researchLedger: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
        },
        artifactSummary: {
          kind: 'chat-turn',
          authority: { reply: 'explicit-canonical' },
          approximatePath: { status: 'exact' },
          researchLedgerPromptInjected: false,
        },
        researchLedger: {
          updateStatus: 'skipped',
        },
      }),
    });

    const archive = api.readArchiveStore();
    const slice = archive.sessions['audit-held-back'].recentAuditTrail[0];

    assert.equal(slice.promptTruth.channels.sessionArchive.heldBackReason, 'canon-priority-suppression');
    assert.equal(slice.promptTruth.channels.researchLedger.heldBackReason, 'canon-priority-suppression');
    assert.equal(slice.promptTruth.channels.researchLedger.renderedCount, 0);
    assert.equal(slice.retrieval.selectedSessionIds[0], 'session-held');
    assert.deepEqual(slice.retrieval.renderedSessionIds, []);
    assert.equal(slice.artifactSummary.researchLedgerRendered, false);
    assert.equal(slice.artifactSummary.researchLedgerPromptInjected, false);
    assert.equal(slice.artifactSummary.researchLedgerPromptInjected, slice.artifactSummary.researchLedgerRendered);
    assert.equal(slice.researchLedger.updateStatus, 'skipped');
    assert.deepEqual(archive.sessions['audit-held-back'].lastRetrieval.summary.renderedSessionIds, []);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('archiveCompletedTurn can store truthful empty-advisory audit slices for deterministic or no-model paths', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    await api.archiveCompletedTurn({
      sessionId: 'audit-tool-path',
      userText: 'Open README.md and do not edit anything.',
      assistantText: 'README.md says Penny is a local companion prototype.',
      retrieval: null,
      audit: buildAuditSlice({
        turnId: 'tool-path-1',
        usedAt: '2026-04-13T12:00:00.000Z',
        userTextExcerpt: 'Open README.md and do not edit anything.',
        selectedLane: 'tool',
        executionPath: 'deterministic-tool',
        retrieval: {
          mode: 'keyword',
          reasonCode: ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK,
          selectedSessionIds: [],
          selectedGlobalIds: [],
          selectedBookIds: [],
          selectedLedgerIds: [],
          compression: { used: false },
          semanticReady: false,
          semanticDowngrade: false,
        },
        promptTruth: {
          stableFacts: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
          memoryBooks: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
          sessionArchive: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
          globalArchive: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
          researchLedger: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
        },
        artifactSummary: {
          kind: 'tool-turn',
          authority: { reply: 'verified-tool-evidence' },
          approximatePath: { status: 'bounded-approximate' },
          researchLedgerPromptInjected: false,
        },
        researchLedger: {
          updateStatus: 'applied',
          topicId: 'path-readme-md',
          topicLabel: 'README.md',
        },
      }),
    });

    const inspector = await api.getMemoryInspector({
      sessionId: 'audit-tool-path',
      explicitMemory: { memories: [] },
    });
    const slice = inspector.archive.session.recentAuditTrail[0];

    assert.equal(slice.selectedLane, 'tool');
    assert.equal(slice.executionPath, 'deterministic-tool');
    assert.equal(slice.promptTruth.channels.sessionArchive.candidateCount, 0);
    assert.equal(slice.promptTruth.channels.researchLedger.renderedCount, 0);
    assert.equal(slice.researchLedger.updateStatus, 'applied');
    assert.deepEqual(slice.retrieval.selectedSessionIds, []);
    assert.deepEqual(slice.retrieval.renderedSessionIds, []);
    assert.equal(slice.artifactSummary.kind, 'tool-turn');
    assert.equal(inspector.archive.session.lastRetrieval.summary.selectedSessionIds.length, 0);
    assert.equal(inspector.archive.session.lastRetrieval.summary.renderedSessionIds.length, 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('memory inspector exposes recency protection for the newest archived session turns', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    for (let index = 0; index < 10; index += 1) {
      await api.archiveCompletedTurn({
        sessionId: 'demo',
        userText: `Turn ${index + 1} mentions the red glove detail.`,
        assistantText: `Reply ${index + 1}.`,
      });
    }

    const inspector = await api.getMemoryInspector({
      sessionId: 'demo',
      explicitMemory: { memories: [] },
      semanticMemory: { ready: true, configuredModel: 'text-embedding-nomic-embed-text-v1.5' },
    });

    assert.equal(inspector.archive.session.recencyProtection.enabled, true);
    assert.equal(inspector.archive.session.recencyProtection.protectedEpisodeCount, 6);
    assert.equal(inspector.archive.session.recencyProtection.protectedEpisodeIds.length, 6);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});
