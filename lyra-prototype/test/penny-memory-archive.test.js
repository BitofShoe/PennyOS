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
  archiveScoringProfile = 'baseline',
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
    PENNY_ARCHIVE_SCORING_PROFILE: archiveScoringProfile,
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

test('embedding cache keys include provider/model space for newly written vectors', async () => {
  const text = 'The copper rabbit sat beside the coding notebook.';
  const nomicFiles = makeTempFiles();
  const staticFiles = makeTempFiles();
  const nomic = buildArchiveApi({
    ...nomicFiles,
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
  }).api;
  const staticShadow = buildArchiveApi({
    ...staticFiles,
    embedModel: 'penny-static-shadow-lexical-v1',
    statusInstalledModels: ['penny-static-shadow-lexical-v1'],
    statusNativeAvailableModels: ['penny-static-shadow-lexical-v1'],
    statusAvailableModels: ['penny-static-shadow-lexical-v1'],
  }).api;

  try {
    await nomic.archiveCompletedTurn({
      sessionId: 'demo',
      userText: text,
      assistantText: 'I have the coding notebook image.',
    });
    await staticShadow.archiveCompletedTurn({
      sessionId: 'demo',
      userText: text,
      assistantText: 'I have the coding notebook image.',
    });

    const normalizedText = text.replace(/\.$/, '');
    const nomicEntry = Object.entries(nomic.readEmbeddingsStore().items)
      .find(([, item]) => item.text === normalizedText);
    const staticEntry = Object.entries(staticShadow.readEmbeddingsStore().items)
      .find(([, item]) => item.text === normalizedText);

    assert.ok(nomicEntry);
    assert.ok(staticEntry);
    assert.notEqual(nomicEntry[0], staticEntry[0]);
    assert.equal(nomicEntry[1].hash, nomicEntry[0]);
    assert.equal(staticEntry[1].hash, staticEntry[0]);
    assert.equal(nomicEntry[1].model, 'text-embedding-nomic-embed-text-v1.5');
    assert.equal(staticEntry[1].model, 'penny-static-shadow-lexical-v1');
  } finally {
    fs.rmSync(nomicFiles.root, { recursive: true, force: true });
    fs.rmSync(staticFiles.root, { recursive: true, force: true });
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
    assert.equal(Object.prototype.hasOwnProperty.call(result.retrieval, 'candidateTrace'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result.archiveContext, 'candidateTrace'), false);
    assert.ok(result.archiveContext.session.length <= 2);
    assert.ok(result.archiveContext.global.length <= 2);
    assert.match(result.archiveContext.session[0].text, /midnight rain/i);
    assert.ok(result.archiveContext.session[0].scoreComponents);
    assert.equal(result.archiveContext.session[0].scoreComponents.semanticSimilarity, null);
    assert.equal(result.archiveContext.session[0].scoreComponents.semanticSimilarityScore, 0);
    assert.equal(result.archiveContext.session[0].scoreReasons.includes('source:episode'), true);
    assert.equal(result.archiveContext.session[0].scoreReasons.some((reason) => reason.startsWith('lexical-overlap:')), true);
    assert.equal(getFetchCalls(), 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext includes bounded candidate trace only when explicitly requested', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        { id: 's1', type: 'episode', text: 'Midnight rain on the arcade window.', excerpt: 'Midnight rain on the arcade window.', userText: 'Midnight rain on the arcade window.', createdAt: '2026-04-13T12:00:00.000Z' },
        { id: 's2', type: 'episode', text: 'Coffee helped during the late storm.', excerpt: 'Coffee helped during the late storm.', userText: 'Coffee helped during the late storm.', createdAt: '2026-04-13T12:01:00.000Z' },
        { id: 's3', type: 'episode', text: 'City lights looked softer after midnight.', excerpt: 'City lights looked softer after midnight.', userText: 'City lights looked softer after midnight.', createdAt: '2026-04-13T12:02:00.000Z' },
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
    archive.global.summaries = [
      { id: 'g1', type: 'summary', text: 'Longer-term themes: midnight rain; city lights.', createdAt: '2026-04-13T12:03:00.000Z' },
    ];
    archive.global.patterns = [
      { id: 'p1', type: 'pattern', text: 'They keep returning to midnight rain.', createdAt: '2026-04-13T12:04:00.000Z', patternKey: 'midnight rain' },
    ];
    api.writeArchiveStore(archive);

    const request = {
      sessionId: 'demo',
      userText: 'Tell me about midnight rain and coffee again.',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
    };

    const defaultResult = await api.buildArchiveContext(request);
    const tracedResult = await api.buildArchiveContext({
      ...request,
      includeCandidateTrace: true,
      candidateTraceLimit: 3,
    });

    assert.equal(Object.prototype.hasOwnProperty.call(defaultResult.retrieval, 'candidateTrace'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(tracedResult.archiveContext, 'candidateTrace'), false);
    assert.equal(tracedResult.retrieval.candidateTrace.length, 3);
    assert.deepEqual(
      tracedResult.archiveContext.session.map((item) => ({ id: item.id, text: item.text })),
      defaultResult.archiveContext.session.map((item) => ({ id: item.id, text: item.text })),
    );
    assert.deepEqual(
      tracedResult.archiveContext.global.map((item) => ({ id: item.id, text: item.text })),
      defaultResult.archiveContext.global.map((item) => ({ id: item.id, text: item.text })),
    );

    const selectedTrace = tracedResult.retrieval.candidateTrace.find((item) => item.id === 's1');
    assert.ok(selectedTrace);
    assert.equal(selectedTrace.group, 'session');
    assert.equal(selectedTrace.raw, true);
    assert.equal(selectedTrace.ranked, true);
    assert.equal(selectedTrace.selected, true);
    assert.equal(selectedTrace.rendered, true);
    assert.equal(selectedTrace.scoringProfile, 'baseline');
    assert.equal(selectedTrace.activeScore, selectedTrace.score);
    assert.equal(selectedTrace.eligibility.eligible, true);
    assert.equal(selectedTrace.eligibility.filtered, false);
    assert.ok(selectedTrace.rank >= 1);
    assert.ok(selectedTrace.selectedRank >= 1);
    assert.ok(selectedTrace.scoreComponents);
    assert.equal(selectedTrace.scoreComponents.semanticSimilarity, null);
    assert.equal(selectedTrace.scoreReasons.some((reason) => reason.startsWith('lexical-overlap:')), true);
    assert.ok(selectedTrace.shadowScores?.hybridV1);
    assert.equal(selectedTrace.hybridShadowScore, selectedTrace.shadowScores.hybridV1.score);
    assert.ok(selectedTrace.shadowScores.hybridV1.rank >= 1);
    assert.equal(typeof selectedTrace.shadowScores.hybridV1.wouldSelect, 'boolean');
    assert.equal(selectedTrace.shadowScores.hybridV1.components.baselineScore, selectedTrace.score);
    assert.equal(
      selectedTrace.shadowScores.hybridV1.reasons.some((reason) => reason.startsWith('source-strength:')),
      true,
    );
    assert.match(selectedTrace.textPreview, /midnight rain/i);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext records static live-shadow trace without changing selected archive context', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 's1',
          type: 'episode',
          text: 'Midnight rain on the arcade window.',
          excerpt: 'Midnight rain on the arcade window.',
          userText: 'Midnight rain on the arcade window.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 's2',
          type: 'episode',
          text: 'Coffee helped during the late storm.',
          excerpt: 'Coffee helped during the late storm.',
          userText: 'Coffee helped during the late storm.',
          createdAt: '2026-04-13T12:01:00.000Z',
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

    const request = {
      sessionId: 'demo',
      userText: 'What do you remember about the copper rabbit?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
    };
    const baseline = await api.buildArchiveContext(request);
    const queryCalls = [];
    const traced = await api.buildArchiveContext({
      ...request,
      queryStaticMemoryIndex: async (text) => {
        queryCalls.push(text);
        return {
          skipped: false,
          queryMs: 1.2,
          status: {
            enabled: true,
            mode: 'live-shadow',
            provider: 'model2vec-potion-8m',
            ready: true,
          },
          frameBudgetSidecar: {
            id: 'static-memory-query',
            label: 'Static memory query',
            spendClass: 'candidate-selection',
            status: 'scheduled',
            budgetMs: 40,
            actualMs: 1.2,
            candidateCount: 1,
            promptTruthExpanded: false,
            toolEvidenceReceiptChanged: false,
          },
          candidates: [
            {
              id: 'archive:episode:static-copper-rabbit',
              textPreview: 'Copper rabbit replaced the brass fox.',
              sourceType: 'archive-episode',
              sourceAuthority: 'advisory',
              supportState: 'candidate',
              candidateChannels: ['static-embedding'],
              staticEmbedding: {
                provider: 'model2vec-potion-8m',
                modelId: 'minishlab/potion-base-8M',
                dimensions: 256,
                similarity: 0.742,
                rank: 1,
                queryMs: 1.2,
              },
            },
          ],
        };
      },
    });

    assert.deepEqual(queryCalls, [request.userText]);
    assert.deepEqual(
      traced.archiveContext.session.map((item) => ({ id: item.id, text: item.text })),
      baseline.archiveContext.session.map((item) => ({ id: item.id, text: item.text })),
    );
    assert.deepEqual(
      traced.archiveContext.global.map((item) => ({ id: item.id, text: item.text })),
      baseline.archiveContext.global.map((item) => ({ id: item.id, text: item.text })),
    );
    assert.equal(traced.retrieval.staticEmbeddingShadow.mode, 'live-shadow');
    assert.equal(traced.retrieval.staticEmbeddingShadow.provider, 'model2vec-potion-8m');
    assert.equal(traced.retrieval.staticEmbeddingShadow.queryMs, 1.2);
    assert.equal(traced.retrieval.staticEmbeddingShadow.candidateCount, 1);
    assert.equal(traced.retrieval.staticEmbeddingShadow.frameBudgetSidecar.id, 'static-memory-query');
    assert.equal(traced.retrieval.staticEmbeddingShadow.frameBudgetSidecar.status, 'scheduled');
    assert.equal(traced.retrieval.staticEmbeddingShadow.frameBudgetSidecar.actualMs, 1.2);
    assert.equal(traced.retrieval.staticEmbeddingShadow.frameBudgetSidecar.candidateCount, 1);
    assert.equal(traced.retrieval.staticEmbeddingShadow.wouldHaveSelected, false);
    const topCandidate = traced.retrieval.staticEmbeddingShadow.topCandidates[0];
    assert.equal(topCandidate.id, 'archive:episode:static-copper-rabbit');
    assert.equal(topCandidate.selected, false);
    assert.equal(topCandidate.rendered, false);
    assert.equal(topCandidate.policy.selected, false);
    assert.equal(topCandidate.policy.rendered, false);
    assert.equal(topCandidate.policy.heldBackReason, 'live-shadow-trace-only');
    assert.equal(topCandidate.staticEmbedding.similarity, 0.742);
    const staticTrace = traced.retrieval.candidateTrace.find((item) => item.id === 'archive:episode:static-copper-rabbit');
    assert.ok(staticTrace);
    assert.equal(staticTrace.group, 'static-embedding');
    assert.equal(staticTrace.selected, false);
    assert.equal(staticTrace.rendered, false);
    assert.equal(staticTrace.wouldHaveSelected, false);
    assert.equal(staticTrace.eligibility.filtered, true);
    assert.equal(staticTrace.eligibility.filterReason, 'live-shadow-trace-only');
    assert.equal(traced.retrieval.session.some((item) => item.id === 'archive:episode:static-copper-rabbit'), false);
    assert.equal(traced.retrieval.global.some((item) => item.id === 'archive:episode:static-copper-rabbit'), false);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext merges live-advisory static candidates under the static-only render cap', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 's1',
          type: 'episode',
          text: 'Midnight rain on the arcade window.',
          excerpt: 'Midnight rain on the arcade window.',
          userText: 'Midnight rain on the arcade window.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 's2',
          type: 'episode',
          text: 'Coffee helped during the late storm.',
          excerpt: 'Coffee helped during the late storm.',
          userText: 'Coffee helped during the late storm.',
          createdAt: '2026-04-13T12:01:00.000Z',
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
      userText: 'What do you remember about the copper rabbit?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 2,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      maxStaticOnlyRendered: 1,
      queryStaticMemoryIndex: async () => ({
        skipped: false,
        queryMs: 1.4,
        status: {
          enabled: true,
          mode: 'live-advisory',
          provider: 'model2vec-potion-8m',
          ready: true,
        },
        candidates: [
          {
            id: 'session:demo:episode:static-copper-rabbit',
            text: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
            textPreview: 'Copper rabbit replaced the brass fox.',
            sourceType: 'session-episode',
            sourceAuthority: 'advisory',
            supportState: 'candidate',
            candidateChannels: ['static-embedding'],
            staticEmbedding: {
              provider: 'model2vec-potion-8m',
              modelId: 'minishlab/potion-base-8M',
              dimensions: 256,
              similarity: 0.92,
              rank: 1,
              queryMs: 1.4,
            },
          },
          {
            id: 'session:demo:episode:static-moon-mug',
            text: 'The chipped moon mug was beside the arcade register.',
            textPreview: 'Moon mug beside the arcade register.',
            sourceType: 'session-episode',
            sourceAuthority: 'advisory',
            supportState: 'candidate',
            candidateChannels: ['static-embedding'],
            staticEmbedding: {
              provider: 'model2vec-potion-8m',
              modelId: 'minishlab/potion-base-8M',
              dimensions: 256,
              similarity: 0.87,
              rank: 2,
              queryMs: 1.4,
            },
          },
        ],
      }),
    });

    assert.deepEqual(result.archiveContext.session.map((item) => item.id), ['static-copper-rabbit', 's2']);
    assert.equal(result.archiveContext.session.length, 2);
    assert.equal(result.archiveContext.global.length, 0);
    assert.equal(result.retrieval.staticEmbeddingShadow.mode, 'live-advisory');
    assert.equal(result.retrieval.staticEmbeddingShadow.candidatePoolMerged, true);
    assert.equal(result.retrieval.staticEmbeddingAdvisory.candidateCount, 2);
    assert.equal(result.retrieval.staticEmbeddingAdvisory.staticOnlyCandidateCount, 2);
    assert.equal(result.retrieval.staticEmbeddingAdvisory.staticOnlyRenderedCap, 1);
    assert.equal(result.retrieval.staticEmbeddingAdvisory.staticOnlyRenderedCount, 1);

    const renderedStatic = result.retrieval.candidateTrace.find((item) => item.id === 'static-copper-rabbit');
    const cappedStatic = result.retrieval.candidateTrace.find((item) => item.id === 'static-moon-mug');
    assert.ok(renderedStatic);
    assert.ok(cappedStatic);
    assert.equal(renderedStatic.selected, true);
    assert.equal(renderedStatic.rendered, true);
    assert.equal(renderedStatic.sourceAuthority, 'advisory');
    assert.equal(renderedStatic.supportState, 'candidate');
    assert.equal(renderedStatic.staticOnly, true);
    assert.deepEqual(renderedStatic.candidateChannels, ['static-embedding']);
    assert.ok(renderedStatic.activeScoreComponents.staticSimilarityScore > 4.5);
    assert.equal(renderedStatic.policy.selected, true);
    assert.equal(cappedStatic.selected, false);
    assert.equal(cappedStatic.rendered, false);
    assert.equal(cappedStatic.heldBackReason, 'static-only-render-cap');
    assert.equal(cappedStatic.policy.heldBackReason, 'static-only-render-cap');
    assert.equal(
      result.retrieval.candidateTrace.some((item) => item.group === 'static-embedding'),
      false,
    );
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext skips optional static expansion under tight frame budget without raising limits', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'tea-current',
          type: 'episode',
          text: 'Favorite tea is lapsang souchong now.',
          excerpt: 'Favorite tea is lapsang souchong now.',
          userText: 'Favorite tea is lapsang souchong now.',
          createdAt: '2026-04-13T12:00:00.000Z',
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

    let queryCalls = 0;
    const result = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'What is my favorite tea?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      maxStaticOnlyRendered: 1,
      queryStaticMemoryIndex: async () => {
        queryCalls += 1;
        return {
          skipped: false,
          queryMs: 0.8,
          status: { enabled: true, mode: 'live-advisory', provider: 'model2vec-potion-8m', ready: true },
          candidates: [
            {
              id: 'session:demo:episode:static-extra',
              text: 'The chipped moon mug was beside the arcade register.',
              textPreview: 'Moon mug beside arcade register.',
              sourceType: 'session-episode',
              sourceAuthority: 'advisory',
              supportState: 'candidate',
              candidateChannels: ['static-embedding'],
              staticEmbedding: { provider: 'model2vec-potion-8m', similarity: 0.99, rank: 1, queryMs: 0.8 },
            },
          ],
        };
      },
      frameBudget: {
        prePromptBudgetMs: 5,
        prePromptElapsedMs: 5,
        staticMode: 'live-advisory',
      },
    });

    assert.equal(queryCalls, 0);
    assert.deepEqual(result.archiveContext.session.map((item) => item.id), ['tea-current']);
    assert.equal(result.retrieval.staticEmbeddingShadow.skipped, true);
    assert.equal(result.retrieval.staticEmbeddingShadow.skippedReason, 'pre-prompt-budget-exhausted');
    assert.equal(result.retrieval.staticEmbeddingShadow.frameBudgetSidecar.id, 'static-expansion');
    assert.equal(result.retrieval.staticEmbeddingShadow.frameBudgetSidecar.status, 'skipped');
    assert.equal(result.retrieval.candidateMergeBudget.staticExpansion.mode, 'skipped');
    assert.equal(result.retrieval.candidateMergeBudget.status, 'degraded');
    assert.equal(result.retrieval.candidateMergeBudget.guardrails.explicitMemoryCanonicalityPreserved, true);
    assert.equal(result.retrieval.candidateMergeBudget.guardrails.sourceAuthorityChecksPreserved, true);
    assert.equal(result.retrieval.candidateMergeBudget.guardrails.promptLimitChanged, false);
    assert.equal(result.retrieval.candidateMergeBudget.guardrails.renderedLimitChanged, false);
    assert.equal(result.archiveContext.session.length, 1);
    assert.equal(result.archiveContext.global.length, 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext uses cached static candidates under budget pressure while preserving correction gates', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [
        {
          id: 'contr-tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          status: 'active',
          sourceEpisodeId: 'tea-current-static',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
      ],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    api.writeArchiveStore(archive);

    let queryCalls = 0;
    const cachedStaticMemoryIndexResult = {
      skipped: false,
      queryMs: 4,
      status: { enabled: true, mode: 'live-advisory', provider: 'model2vec-potion-8m', ready: true },
      candidates: [
        {
          id: 'session:demo:episode:tea-stale-static',
          text: 'Favorite tea is oolong.',
          textPreview: 'Favorite tea is oolong.',
          sourceType: 'session-episode',
          sourceAuthority: 'advisory',
          supportState: 'candidate',
          candidateChannels: ['static-embedding'],
          staticEmbedding: { provider: 'model2vec-potion-8m', similarity: 0.99, rank: 1, queryMs: 4 },
        },
        {
          id: 'session:demo:episode:tea-current-static',
          text: 'Correction: my favorite tea is lapsang souchong now, not oolong.',
          textPreview: 'Favorite tea is lapsang souchong now.',
          sourceType: 'session-episode',
          sourceAuthority: 'advisory',
          supportState: 'candidate',
          candidateChannels: ['static-embedding'],
          staticEmbedding: { provider: 'model2vec-potion-8m', similarity: 0.62, rank: 2, queryMs: 4 },
        },
      ],
    };
    const result = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'What is my favorite tea now?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      maxStaticOnlyRendered: 1,
      queryStaticMemoryIndex: async () => {
        queryCalls += 1;
        return { skipped: true, reason: 'should-not-run', candidates: [] };
      },
      frameBudget: {
        deadlineMs: 12,
        elapsedMs: 10,
        cachedStaticMemoryIndexResult,
      },
    });

    assert.equal(queryCalls, 0);
    assert.deepEqual(result.archiveContext.session.map((item) => item.id), ['tea-current-static']);
    assert.equal(result.retrieval.staticEmbeddingShadow.frameBudgetSidecar.id, 'static-expansion');
    assert.equal(result.retrieval.staticEmbeddingShadow.frameBudgetSidecar.status, 'degraded');
    assert.equal(result.retrieval.candidateMergeBudget.staticExpansion.mode, 'cached-only');
    assert.equal(result.retrieval.candidateMergeBudget.staticExpansion.maxCandidates, 2);
    assert.equal(result.retrieval.candidateMergeBudget.workDone.staleCandidatesBlocked, 1);
    assert.equal(result.retrieval.candidateMergeBudget.guardrails.correctionGatesPreserved, true);

    const stale = result.retrieval.candidateTrace.find((item) => item.id === 'tea-stale-static');
    const current = result.retrieval.candidateTrace.find((item) => item.id === 'tea-current-static');
    assert.ok(stale);
    assert.ok(current);
    assert.equal(current.selected, true);
    assert.equal(current.rendered, true);
    assert.equal(stale.selected, false);
    assert.equal(stale.rendered, false);
    assert.equal(stale.eligibility.filtered, true);
    assert.equal(stale.eligibility.filterReason, 'static-stale-correction-gate');
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext inspects more optional candidates when frame budget is roomy', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 's1',
          type: 'episode',
          text: 'Midnight rain on the arcade window.',
          excerpt: 'Midnight rain on the arcade window.',
          userText: 'Midnight rain on the arcade window.',
          createdAt: '2026-04-13T12:00:00.000Z',
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

    const staticResult = {
      skipped: false,
      queryMs: 1,
      status: { enabled: true, mode: 'live-advisory', provider: 'model2vec-potion-8m', ready: true },
      candidates: [
        {
          id: 'session:demo:episode:static-copper-rabbit',
          text: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
          textPreview: 'Copper rabbit replaced the brass fox.',
          sourceType: 'session-episode',
          sourceAuthority: 'advisory',
          supportState: 'candidate',
          candidateChannels: ['static-embedding'],
          staticEmbedding: { provider: 'model2vec-potion-8m', similarity: 0.92, rank: 1, queryMs: 1 },
        },
        {
          id: 'session:demo:episode:static-moon-mug',
          text: 'The chipped moon mug was beside the arcade register.',
          textPreview: 'Moon mug beside arcade register.',
          sourceType: 'session-episode',
          sourceAuthority: 'advisory',
          supportState: 'candidate',
          candidateChannels: ['static-embedding'],
          staticEmbedding: { provider: 'model2vec-potion-8m', similarity: 0.87, rank: 2, queryMs: 1 },
        },
      ],
    };
    let roomyCalls = 0;
    const roomy = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'What do you remember about the copper rabbit?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 2,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      maxStaticOnlyRendered: 1,
      queryStaticMemoryIndex: async () => {
        roomyCalls += 1;
        return staticResult;
      },
      frameBudget: {
        deadlineMs: 80,
        elapsedMs: 3,
      },
    });
    let tightCalls = 0;
    const tight = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'What do you remember about the copper rabbit?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 2,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      maxStaticOnlyRendered: 1,
      queryStaticMemoryIndex: async () => {
        tightCalls += 1;
        return staticResult;
      },
      frameBudget: {
        deadlineMs: 5,
        elapsedMs: 5,
        staticMode: 'live-advisory',
      },
    });

    assert.equal(roomyCalls, 1);
    assert.equal(tightCalls, 0);
    assert.equal(roomy.retrieval.candidateMergeBudget.staticExpansion.mode, 'full');
    assert.equal(tight.retrieval.candidateMergeBudget.staticExpansion.mode, 'skipped');
    assert.equal(roomy.retrieval.candidateMergeBudget.workDone.staticCandidatesInspected, 2);
    assert.equal(tight.retrieval.candidateMergeBudget.workDone.staticCandidatesInspected, 0);
    assert.ok(
      roomy.retrieval.candidateMergeBudget.workDone.rawCandidatesInspected
        > tight.retrieval.candidateMergeBudget.workDone.rawCandidatesInspected,
    );
    assert.equal(roomy.retrieval.candidateMergeBudget.guardrails.promptLimitChanged, false);
    assert.equal(roomy.retrieval.candidateMergeBudget.guardrails.renderedLimitChanged, false);
    assert.equal(roomy.archiveContext.session.length <= 2, true);
    assert.equal(tight.archiveContext.session.length <= 2, true);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext blocks stale live-advisory static-only candidates on active correction topics', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'tea-current',
          type: 'episode',
          text: 'Favorite tea is lapsang souchong now.',
          excerpt: 'Favorite tea is lapsang souchong now.',
          userText: 'Favorite tea is lapsang souchong now.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [
        {
          id: 'contr-tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          status: 'active',
          sourceEpisodeId: 'tea-current',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
      ],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    api.writeArchiveStore(archive);

    const result = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'What is my favorite tea?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      maxStaticOnlyRendered: 1,
      queryStaticMemoryIndex: async () => ({
        skipped: false,
        queryMs: 0.9,
        status: {
          enabled: true,
          mode: 'live-advisory',
          provider: 'model2vec-potion-8m',
          ready: true,
        },
        candidates: [
          {
            id: 'session:demo:episode:tea-stale-static',
            text: 'Favorite tea is oolong.',
            textPreview: 'Favorite tea is oolong.',
            sourceType: 'session-episode',
            sourceAuthority: 'advisory',
            supportState: 'candidate',
            candidateChannels: ['static-embedding'],
            staticEmbedding: {
              provider: 'model2vec-potion-8m',
              modelId: 'minishlab/potion-base-8M',
              dimensions: 256,
              similarity: 0.99,
              rank: 1,
              queryMs: 0.9,
            },
          },
        ],
      }),
    });

    assert.deepEqual(result.archiveContext.session.map((item) => item.id), ['tea-current']);
    const current = result.retrieval.candidateTrace.find((item) => item.id === 'tea-current');
    const staleStatic = result.retrieval.candidateTrace.find((item) => item.id === 'tea-stale-static');
    assert.ok(current);
    assert.ok(staleStatic);
    assert.equal(current.selected, true);
    assert.equal(current.rendered, true);
    assert.equal(staleStatic.selected, false);
    assert.equal(staleStatic.rendered, false);
    assert.equal(staleStatic.supportState, 'candidate');
    assert.equal(staleStatic.eligibility.filtered, true);
    assert.equal(staleStatic.eligibility.filterReason, 'static-stale-correction-gate');
    assert.equal(result.retrieval.staticEmbeddingAdvisory.staticOnlyRenderedCount, 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext live-advisory prefers current static corrections over stale static similarity', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  const cases = [
    {
      sessionId: 'coding-static',
      query: 'What is the coding mascot now?',
      staleId: 'brass-fox-stale-static',
      currentId: 'copper-rabbit-current-static',
      staleText: 'Remember this exactly: my coding mascot is a brass fox.',
      currentText: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
      oldText: 'Coding mascot is a brass fox',
      newText: 'Coding mascot is a copper rabbit',
      conflictKey: 'coding mascot',
    },
    {
      sessionId: 'watch-static',
      query: 'What color is the arcade cashier watch now?',
      staleId: 'silver-watch-stale-static',
      currentId: 'gold-watch-current-static',
      staleText: 'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
      currentText: 'Correction: the arcade cashier watch is gold now, not silver.',
      oldText: 'Arcade cashier watch is silver',
      newText: 'Arcade cashier watch is gold',
      conflictKey: 'arcade cashier watch',
    },
    {
      sessionId: 'tea-static',
      query: 'What is my favorite tea now?',
      staleId: 'oolong-stale-static',
      currentId: 'lapsang-current-static',
      staleText: 'Favorite tea is oolong.',
      currentText: 'Correction: my favorite tea is lapsang souchong now, not oolong.',
      oldText: 'Favorite tea is oolong',
      newText: 'Favorite tea is lapsang souchong',
      conflictKey: 'favorite tea',
    },
  ];

  try {
    const archive = api.buildArchiveStore();
    for (const item of cases) {
      archive.sessions[item.sessionId] = {
        sessionId: item.sessionId,
        episodes: [],
        summaries: [],
        chapters: [],
        provenance: [],
        activeContradictions: [
          {
            id: `contr-${item.sessionId}`,
            oldText: item.oldText,
            newText: item.newText,
            conflictKey: item.conflictKey,
            status: 'active',
            sourceEpisodeId: item.currentId,
            createdAt: '2026-04-13T12:00:00.000Z',
          },
        ],
        openLoops: [],
        lastRetrieval: null,
        lastArchivedAt: '',
        updatedAt: '',
      };
    }
    api.writeArchiveStore(archive);

    for (const item of cases) {
      const result = await api.buildArchiveContext({
        sessionId: item.sessionId,
        userText: item.query,
        lane: 'chat',
        now: Date.parse('2026-04-13T12:10:00.000Z'),
        sessionPromptLimit: 1,
        globalPromptLimit: 0,
        allowArchiveCompression: false,
        maxStaticOnlyRendered: 1,
        queryStaticMemoryIndex: async () => ({
          skipped: false,
          queryMs: 0.7,
          status: {
            enabled: true,
            mode: 'live-advisory',
            provider: 'model2vec-potion-8m',
            ready: true,
          },
          candidates: [
            {
              id: `session:${item.sessionId}:episode:${item.staleId}`,
              text: item.staleText,
              textPreview: item.staleText,
              sourceType: 'session-episode',
              sourceAuthority: 'advisory',
              supportState: 'candidate',
              candidateChannels: ['static-embedding'],
              staticEmbedding: {
                provider: 'model2vec-potion-8m',
                modelId: 'minishlab/potion-base-8M',
                dimensions: 256,
                similarity: 0.99,
                rank: 1,
                queryMs: 0.7,
              },
            },
            {
              id: `session:${item.sessionId}:episode:${item.currentId}`,
              text: item.currentText,
              textPreview: item.currentText,
              sourceType: 'session-episode',
              sourceAuthority: 'advisory',
              supportState: 'candidate',
              candidateChannels: ['static-embedding'],
              staticEmbedding: {
                provider: 'model2vec-potion-8m',
                modelId: 'minishlab/potion-base-8M',
                dimensions: 256,
                similarity: 0.62,
                rank: 2,
                queryMs: 0.7,
              },
            },
          ],
        }),
      });

      assert.deepEqual(result.archiveContext.session.map((entry) => entry.id), [item.currentId]);
      assert.equal(result.retrieval.staticEmbeddingAdvisory.candidateCount, 2);
      assert.equal(result.retrieval.staticEmbeddingAdvisory.staticOnlyCandidateCount, 2);
      assert.equal(result.retrieval.staticEmbeddingAdvisory.staticOnlyRenderedCount, 1);

      const stale = result.retrieval.candidateTrace.find((entry) => entry.id === item.staleId);
      const current = result.retrieval.candidateTrace.find((entry) => entry.id === item.currentId);
      assert.ok(stale);
      assert.ok(current);
      assert.equal(current.selected, true);
      assert.equal(current.rendered, true);
      assert.equal(current.staticOnly, true);
      assert.equal(current.policy.reasons.includes('static-similarity:+3.10'), true);
      assert.equal(
        current.policy.reasons.includes(`current-correction-boost:${item.conflictKey}:+2.40`),
        true,
      );
      assert.equal(stale.selected, false);
      assert.equal(stale.rendered, false);
      assert.equal(stale.supportState, 'candidate');
      assert.equal(stale.eligibility.filtered, true);
      assert.equal(stale.eligibility.filterReason, 'static-stale-correction-gate');
      assert.equal(stale.policy.heldBackReason, 'static-stale-correction-gate');
      assert.equal(stale.policy.reasons.includes('static-similarity:+4.95'), true);
      assert.equal(
        stale.policy.reasons.includes(`stale-contradiction-penalty:${item.conflictKey}:-3.20`),
        true,
      );
    }
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext computes hybrid shadow rank without changing active selection or rendered context', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'exact-dryer-three',
          type: 'episode',
          text: 'A silver thermos was sitting on dryer three at the laundromat.',
          excerpt: 'A silver thermos was sitting on dryer three at the laundromat.',
          userText: 'A silver thermos was sitting on dryer three at the laundromat.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 'split-dryer-three',
          type: 'episode',
          text: 'Dryer four had a blue sticker, and table three held a mug.',
          excerpt: 'Dryer four had a blue sticker, and table three held a mug.',
          userText: 'Dryer four had a blue sticker, and table three held a mug.',
          createdAt: '2026-04-13T12:01:00.000Z',
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

    const request = {
      sessionId: 'demo',
      userText: 'dryer three',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
    };
    const defaultResult = await api.buildArchiveContext(request);
    const tracedResult = await api.buildArchiveContext({
      ...request,
      includeCandidateTrace: true,
      candidateTraceLimit: 4,
    });

    assert.deepEqual(
      tracedResult.archiveContext.session.map((item) => item.id),
      defaultResult.archiveContext.session.map((item) => item.id),
    );
    assert.deepEqual(defaultResult.archiveContext.session.map((item) => item.id), ['split-dryer-three']);

    const activeWinner = tracedResult.retrieval.candidateTrace.find((item) => item.id === 'split-dryer-three');
    const hybridWinner = tracedResult.retrieval.candidateTrace.find((item) => item.id === 'exact-dryer-three');
    assert.ok(activeWinner);
    assert.ok(hybridWinner);
    assert.equal(activeWinner.rank, 1);
    assert.equal(activeWinner.selected, true);
    assert.equal(activeWinner.rendered, true);
    assert.equal(hybridWinner.rank, 2);
    assert.equal(hybridWinner.selected, false);
    assert.equal(hybridWinner.rendered, false);
    assert.equal(hybridWinner.shadowScores.hybridV1.rank, 1);
    assert.equal(hybridWinner.shadowScores.hybridV1.wouldSelect, true);
    assert.equal(hybridWinner.shadowScores.hybridV1.rankDelta, 1);
    assert.equal(hybridWinner.shadowScores.hybridV1.components.exactAnchorScore, 1.75);
    assert.equal(activeWinner.shadowScores.hybridV1.rank, 2);
    assert.equal(activeWinner.shadowScores.hybridV1.wouldSelect, false);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext runs fixture reranker shadow without changing active selection or rendered context', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'violet-cassette',
          type: 'episode',
          text: 'A violet cassette was tucked under the checkout fern.',
          excerpt: 'A violet cassette was tucked under the checkout fern.',
          userText: 'A violet cassette was tucked under the checkout fern.',
          createdAt: '2026-04-13T12:00:00.000Z',
          evidenceCount: 6,
        },
        {
          id: 'paper-receipt',
          type: 'episode',
          text: 'A paper receipt was tucked under the checkout fern.',
          excerpt: 'A paper receipt was tucked under the checkout fern.',
          userText: 'A paper receipt was tucked under the checkout fern.',
          createdAt: '2026-04-13T12:01:00.000Z',
          evidenceCount: 1,
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

    const request = {
      sessionId: 'demo',
      userText: 'What was under the checkout fern?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
    };
    const defaultResult = await api.buildArchiveContext(request);
    const tracedResult = await api.buildArchiveContext({
      ...request,
      includeCandidateTrace: true,
      includeRerankShadow: true,
      rerankShadowProvider: 'fixture-reranker',
      candidateTraceLimit: 4,
    });

    assert.deepEqual(defaultResult.archiveContext.session.map((item) => item.id), ['paper-receipt']);
    assert.deepEqual(
      tracedResult.archiveContext.session.map((item) => item.id),
      defaultResult.archiveContext.session.map((item) => item.id),
    );
    assert.equal(tracedResult.retrieval.rerankShadow.provider, 'fixture-reranker');
    assert.equal(tracedResult.retrieval.rerankShadow.measurementMode, 'shadow-fixture');
    assert.equal(tracedResult.retrieval.rerankShadow.inputTopK, 2);
    assert.equal(tracedResult.retrieval.rerankShadow.outputTopK, 1);
    assert.equal(typeof tracedResult.retrieval.rerankShadow.latencyMs, 'number');

    const activeWinner = tracedResult.retrieval.candidateTrace.find((item) => item.id === 'paper-receipt');
    const rerankWinner = tracedResult.retrieval.candidateTrace.find((item) => item.id === 'violet-cassette');
    assert.ok(activeWinner);
    assert.ok(rerankWinner);
    assert.equal(activeWinner.selected, true);
    assert.equal(activeWinner.rendered, true);
    assert.equal(rerankWinner.rank, 2);
    assert.equal(rerankWinner.selected, false);
    assert.equal(rerankWinner.rendered, false);
    assert.equal(rerankWinner.rerankShadow.provider, 'fixture-reranker');
    assert.equal(rerankWinner.rerankShadow.inputRank, 2);
    assert.equal(rerankWinner.rerankShadow.outputRank, 1);
    assert.equal(rerankWinner.rerankShadow.wouldSelect, true);
    assert.equal(typeof rerankWinner.rerankShadow.latencyMs, 'number');
    assert.equal(
      rerankWinner.rerankShadow.reasons.some((reason) => reason.startsWith('evidence-count:')),
      true,
    );
    assert.equal(activeWinner.rerankShadow.outputRank > rerankWinner.rerankShadow.outputRank, true);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext reports unavailable reranker shadow without crashing', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'moon-mug',
          type: 'episode',
          text: 'The chipped moon mug was beside the arcade register.',
          excerpt: 'The chipped moon mug was beside the arcade register.',
          userText: 'The chipped moon mug was beside the arcade register.',
          createdAt: '2026-04-13T12:00:00.000Z',
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
      userText: 'What mug was beside the arcade register?',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      includeCandidateTrace: true,
      includeRerankShadow: true,
      rerankShadowProvider: 'local-cross-encoder',
    });

    assert.deepEqual(result.archiveContext.session.map((item) => item.id), ['moon-mug']);
    assert.equal(result.retrieval.rerankShadow.provider, 'local-cross-encoder');
    assert.equal(result.retrieval.rerankShadow.measurementMode, 'unavailable');
    assert.equal(result.retrieval.rerankShadow.latencyMs, null);
    assert.match(result.retrieval.rerankShadow.unavailableReason, /unsupported-reranker-provider/);
    const trace = result.retrieval.candidateTrace.find((item) => item.id === 'moon-mug');
    assert.ok(trace);
    assert.equal(trace.selected, true);
    assert.equal(trace.rendered, true);
    assert.equal(trace.rerankShadow.provider, 'local-cross-encoder');
    assert.equal(trace.rerankShadow.outputRank, null);
    assert.equal(trace.rerankShadow.score, null);
    assert.equal(trace.rerankShadow.latencyMs, null);
    assert.equal(trace.rerankShadow.wouldSelect, false);
    assert.equal(trace.rerankShadow.reasons.some((reason) => reason.includes('unsupported-reranker-provider')), true);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext gates active hybrid-v1 scoring behind explicit profile config', async () => {
  const files = makeTempFiles();
  const baselineApi = buildArchiveApi({ ...files, embedReady: false }).api;
  const hybridFiles = makeTempFiles();
  const hybridApi = buildArchiveApi({ ...hybridFiles, embedReady: false, archiveScoringProfile: 'hybrid-v1' }).api;

  function seed(api) {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'exact-dryer-three',
          type: 'episode',
          text: 'A silver thermos was sitting on dryer three at the laundromat.',
          excerpt: 'A silver thermos was sitting on dryer three at the laundromat.',
          userText: 'A silver thermos was sitting on dryer three at the laundromat.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 'split-dryer-three',
          type: 'episode',
          text: 'Dryer four had a blue sticker, and table three held a mug.',
          excerpt: 'Dryer four had a blue sticker, and table three held a mug.',
          userText: 'Dryer four had a blue sticker, and table three held a mug.',
          createdAt: '2026-04-13T12:01:00.000Z',
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
  }

  try {
    assert.equal(baselineApi.archiveScoringProfile, 'baseline');
    assert.equal(hybridApi.archiveScoringProfile, 'hybrid-v1');
    seed(baselineApi);
    seed(hybridApi);
    const request = {
      sessionId: 'demo',
      userText: 'dryer three',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      includeCandidateTrace: true,
      candidateTraceLimit: 4,
    };
    const baselineResult = await baselineApi.buildArchiveContext(request);
    const hybridResult = await hybridApi.buildArchiveContext(request);

    assert.equal(baselineResult.retrieval.scoringProfile, 'baseline');
    assert.equal(hybridResult.retrieval.scoringProfile, 'hybrid-v1');
    assert.deepEqual(baselineResult.archiveContext.session.map((item) => item.id), ['split-dryer-three']);
    assert.deepEqual(hybridResult.archiveContext.session.map((item) => item.id), ['exact-dryer-three']);
    assert.equal(baselineResult.archiveContext.session.length, hybridResult.archiveContext.session.length);

    const hybridWinner = hybridResult.retrieval.candidateTrace.find((item) => item.id === 'exact-dryer-three');
    assert.ok(hybridWinner);
    assert.equal(hybridWinner.scoringProfile, 'hybrid-v1');
    assert.equal(hybridWinner.selected, true);
    assert.equal(hybridWinner.rendered, true);
    assert.equal(hybridWinner.activeScore, hybridWinner.score);
    assert.ok(hybridWinner.baselineScore < hybridWinner.activeScore);
    assert.equal(Object.prototype.hasOwnProperty.call(hybridWinner, 'hybridShadowScore'), false);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
    fs.rmSync(hybridFiles.root, { recursive: true, force: true });
  }
});

test('createMemoryArchiveApi falls back to baseline for invalid archive scoring profile', () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, archiveScoringProfile: 'not-a-profile' });

  try {
    assert.equal(api.archiveScoringProfile, 'baseline');
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext hybrid shadow demotes stale contradiction-only candidates when metadata exists', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'tea-current',
          type: 'episode',
          text: 'Favorite tea is lapsang souchong now.',
          excerpt: 'Favorite tea is lapsang souchong now.',
          userText: 'Favorite tea is lapsang souchong now.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 'tea-stale',
          type: 'episode',
          text: 'Favorite tea is oolong.',
          excerpt: 'Favorite tea is oolong.',
          userText: 'Favorite tea is oolong.',
          createdAt: '2026-04-13T12:02:00.000Z',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [
        {
          id: 'contr-tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          status: 'active',
          createdAt: '2026-04-13T12:02:00.000Z',
        },
      ],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    api.writeArchiveStore(archive);

    const request = {
      sessionId: 'demo',
      userText: 'favorite tea',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
    };
    const defaultResult = await api.buildArchiveContext(request);
    const tracedResult = await api.buildArchiveContext({
      ...request,
      includeCandidateTrace: true,
      candidateTraceLimit: 4,
    });

    assert.deepEqual(
      tracedResult.archiveContext.session.map((item) => item.id),
      defaultResult.archiveContext.session.map((item) => item.id),
    );
    assert.deepEqual(defaultResult.archiveContext.session.map((item) => item.id), ['tea-stale']);

    const stale = tracedResult.retrieval.candidateTrace.find((item) => item.id === 'tea-stale');
    const current = tracedResult.retrieval.candidateTrace.find((item) => item.id === 'tea-current');
    assert.ok(stale);
    assert.ok(current);
    assert.equal(stale.selected, true);
    assert.equal(stale.rendered, true);
    assert.ok(stale.shadowScores.hybridV1.components.contradictionRepairScore < 0);
    assert.ok(current.shadowScores.hybridV1.components.contradictionRepairScore > 0);
    assert.equal(current.shadowScores.hybridV1.rank, 1);
    assert.equal(current.shadowScores.hybridV1.wouldSelect, true);
    assert.equal(stale.shadowScores.hybridV1.rank > current.shadowScores.hybridV1.rank, true);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext attaches correction memory links to candidate trace without scoring changes', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'tea-current',
          type: 'episode',
          text: 'Favorite tea is lapsang souchong.',
          excerpt: 'Favorite tea is lapsang souchong.',
          userText: 'Favorite tea is lapsang souchong.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 'tea-stale',
          type: 'episode',
          text: 'Favorite tea is oolong.',
          excerpt: 'Favorite tea is oolong.',
          userText: 'Favorite tea is oolong.',
          createdAt: '2026-04-13T12:02:00.000Z',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [
        {
          id: 'contr-tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          status: 'active',
          createdAt: '2026-04-13T12:02:00.000Z',
        },
      ],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    api.writeArchiveStore(archive);

    const request = {
      sessionId: 'demo',
      userText: 'favorite tea',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      includeCandidateTrace: true,
      candidateTraceLimit: 4,
    };
    const defaultResult = await api.buildArchiveContext(request);
    const linkedResult = await api.buildArchiveContext({
      ...request,
      includeCandidateTraceLinks: true,
      candidateTraceLinkLimit: 6,
    });

    assert.deepEqual(
      linkedResult.archiveContext.session.map((item) => item.id),
      defaultResult.archiveContext.session.map((item) => item.id),
    );
    assert.deepEqual(
      linkedResult.retrieval.candidateTrace.map((item) => ({
        id: item.id,
        selected: item.selected,
        rendered: item.rendered,
        rank: item.rank,
      })),
      defaultResult.retrieval.candidateTrace.map((item) => ({
        id: item.id,
        selected: item.selected,
        rendered: item.rendered,
        rank: item.rank,
      })),
    );

    const unlinkedCurrent = defaultResult.retrieval.candidateTrace.find((item) => item.id === 'tea-current');
    const current = linkedResult.retrieval.candidateTrace.find((item) => item.id === 'tea-current');
    const stale = linkedResult.retrieval.candidateTrace.find((item) => item.id === 'tea-stale');
    assert.ok(unlinkedCurrent);
    assert.equal(Object.prototype.hasOwnProperty.call(unlinkedCurrent, 'memoryLinks'), false);
    assert.ok(current);
    assert.ok(stale);
    assert.equal(current.memoryLinks.schema, 'penny-memory-link-trace.v1');
    assert.equal(current.memoryLinks.advisoryOnly, true);
    assert.equal(current.memoryLinks.truthProof, false);
    assert.equal(current.memoryLinks.scoringActive, false);
    assert.equal(current.memoryLinks.behaviorChanged, false);
    assert.equal(current.memoryLinks.relationSummary.currentCorrectionFor, 1);
    assert.equal(current.memoryLinks.relationSummary.stalePriorOf, 1);
    assert.equal(stale.memoryLinks.relationSummary.currentCorrectionFor, 1);
    assert.equal(stale.memoryLinks.relationSummary.stalePriorOf, 1);
    assert.deepEqual(current.memoryLinks.authorityEffects, ['none']);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext active hybrid-v1 demotes stale contradiction-only candidates', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false, archiveScoringProfile: 'hybrid-v1' });

  try {
    const archive = api.buildArchiveStore();
    archive.sessions.demo = {
      sessionId: 'demo',
      episodes: [
        {
          id: 'tea-current',
          type: 'episode',
          text: 'Favorite tea is lapsang souchong now.',
          excerpt: 'Favorite tea is lapsang souchong now.',
          userText: 'Favorite tea is lapsang souchong now.',
          createdAt: '2026-04-13T12:00:00.000Z',
        },
        {
          id: 'tea-stale',
          type: 'episode',
          text: 'Favorite tea is oolong.',
          excerpt: 'Favorite tea is oolong.',
          userText: 'Favorite tea is oolong.',
          createdAt: '2026-04-13T12:02:00.000Z',
        },
      ],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [
        {
          id: 'contr-tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          conflictKey: 'favorite tea',
          status: 'active',
          createdAt: '2026-04-13T12:02:00.000Z',
        },
      ],
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
    api.writeArchiveStore(archive);

    const result = await api.buildArchiveContext({
      sessionId: 'demo',
      userText: 'favorite tea',
      lane: 'chat',
      now: Date.parse('2026-04-13T12:10:00.000Z'),
      sessionPromptLimit: 1,
      globalPromptLimit: 0,
      allowArchiveCompression: false,
      includeCandidateTrace: true,
      candidateTraceLimit: 4,
    });

    assert.deepEqual(result.archiveContext.session.map((item) => item.id), ['tea-current']);
    const stale = result.retrieval.candidateTrace.find((item) => item.id === 'tea-stale');
    const current = result.retrieval.candidateTrace.find((item) => item.id === 'tea-current');
    assert.ok(stale);
    assert.ok(current);
    assert.equal(current.selected, true);
    assert.equal(current.rendered, true);
    assert.equal(stale.selected, false);
    assert.equal(stale.rendered, false);
    assert.equal(stale.scoringProfile, 'hybrid-v1');
    assert.ok(stale.activeScoreComponents.contradictionRepairScore < 0);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext pins source-sensitive archive correction survival cases', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false, archiveScoringProfile: 'hybrid-v1' });

  const cases = [
    {
      sessionId: 'coding',
      query: 'What is the coding mascot now?',
      currentId: 'coding-current',
      staleId: 'coding-stale',
      currentText: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
      staleText: 'Remember this exactly: my coding mascot is a brass fox.',
      oldText: 'Coding mascot is a brass fox',
      newText: 'Coding mascot is a copper rabbit',
      conflictKey: 'coding mascot',
    },
    {
      sessionId: 'watch',
      query: 'What color is the cashier watch now?',
      currentId: 'watch-current',
      staleId: 'watch-stale',
      currentText: 'Correction: the arcade cashier watch is gold now, not silver.',
      staleText: 'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
      oldText: 'Arcade cashier watch is silver',
      newText: 'Arcade cashier watch is gold',
      conflictKey: 'arcade cashier watch',
    },
  ];

  try {
    const archive = api.buildArchiveStore();
    for (const [index, item] of cases.entries()) {
      archive.sessions[item.sessionId] = {
        sessionId: item.sessionId,
        episodes: [
          {
            id: item.staleId,
            type: 'episode',
            text: item.staleText,
            excerpt: item.staleText,
            userText: item.staleText,
            createdAt: `2026-04-13T12:0${index}:00.000Z`,
            sensitivity: 'normal',
          },
          {
            id: item.currentId,
            type: 'episode',
            text: item.currentText,
            excerpt: item.currentText,
            userText: item.currentText,
            createdAt: `2026-04-13T12:1${index}:00.000Z`,
            sensitivity: 'normal',
          },
        ],
        summaries: [],
        chapters: [],
        provenance: [],
        activeContradictions: [
          {
            id: `contr-${item.sessionId}`,
            oldText: item.oldText,
            newText: item.newText,
            conflictKey: item.conflictKey,
            status: 'active',
            createdAt: `2026-04-13T12:1${index}:00.000Z`,
            sourceEpisodeId: item.currentId,
          },
        ],
        openLoops: [],
        lastRetrieval: null,
        lastArchivedAt: '',
        updatedAt: '',
      };
    }
    api.writeArchiveStore(archive);

    for (const item of cases) {
      const result = await api.buildArchiveContext({
        sessionId: item.sessionId,
        userText: item.query,
        lane: 'chat',
        now: Date.parse('2026-04-13T12:30:00.000Z'),
        sessionPromptLimit: 1,
        globalPromptLimit: 0,
        allowArchiveCompression: false,
        includeCandidateTrace: true,
        candidateTraceLimit: 4,
      });

      assert.deepEqual(result.archiveContext.session.map((entry) => entry.id), [item.currentId]);
      const current = result.retrieval.candidateTrace.find((entry) => entry.id === item.currentId);
      const stale = result.retrieval.candidateTrace.find((entry) => entry.id === item.staleId);
      assert.ok(current);
      assert.ok(stale);
      assert.equal(current.rank <= 1, true);
      assert.equal(current.selected, true);
      assert.equal(current.rendered, true);
      assert.equal(stale.selected, false);
      assert.equal(stale.rendered, false);
      assert.ok(current.activeScoreComponents.contradictionRepairScore > 0);
      assert.ok(stale.activeScoreComponents.contradictionRepairScore < 0);
    }
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
      includeCandidateTrace: true,
    });

    const surfacedTexts = [
      ...result.archiveContext.session.map((item) => item.text),
      ...result.archiveContext.global.map((item) => item.text),
    ].join('\n');
    assert.match(surfacedTexts, /midnight rain/i);
    assert.doesNotMatch(surfacedTexts, /want to disappear|feel broken/i);
    const filtered = result.retrieval.candidateTrace.find((item) => item.id === 'sensitive-1');
    assert.ok(filtered);
    assert.equal(filtered.raw, true);
    assert.equal(filtered.ranked, false);
    assert.equal(filtered.selected, false);
    assert.equal(filtered.rendered, false);
    assert.equal(filtered.eligibility.eligible, false);
    assert.equal(filtered.eligibility.filtered, true);
    assert.equal(filtered.eligibility.filterReason, 'sensitive-low-confidence');
    assert.ok(filtered.scoreComponents);
    assert.equal(filtered.scoreReasons.includes('sensitivity-penalty:-1.50'), true);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('buildArchiveContext keeps weak sensitive matches suppressed under active hybrid-v1', async () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi({ ...files, embedReady: false, archiveScoringProfile: 'hybrid-v1' });

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
      includeCandidateTrace: true,
    });

    assert.equal(result.retrieval.scoringProfile, 'hybrid-v1');
    assert.doesNotMatch(
      result.archiveContext.session.map((item) => item.text).join('\n'),
      /want to disappear|feel broken/i,
    );
    const filtered = result.retrieval.candidateTrace.find((item) => item.id === 'sensitive-1');
    assert.ok(filtered);
    assert.equal(filtered.ranked, false);
    assert.equal(filtered.selected, false);
    assert.equal(filtered.rendered, false);
    assert.equal(filtered.eligibility.filterReason, 'sensitive-low-confidence');
    assert.equal(filtered.scoringProfile, 'hybrid-v1');
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

test('reviewPromotion preserves offline ingestion source observations', () => {
  const files = makeTempFiles();
  const { api } = buildArchiveApi(files);

  try {
    const archive = api.buildArchiveStore();
    archive.global.promotionQueue.push({
      id: 'queue-offline-1',
      type: 'promotion',
      text: 'favorite tea is lapsang souchong',
      excerpt: 'favorite tea is lapsang souchong',
      createdAt: '2024-02-03T10:00:00.000Z',
      updatedAt: '2024-02-03T10:00:00.000Z',
      patternKey: 'offline:favorite-tea',
      sourceType: 'offline-ingestion',
      sourceLabel: 'offline-ingestion',
      originSource: 'preference',
      evidenceSnippet: 'Now I love lapsang souchong.',
      promotionPacket: {
        id: 'packet-offline-1',
        kind: 'preference',
        proposedMemoryText: 'favorite tea is lapsang souchong',
        sourceType: 'offline-ingestion',
        originSource: 'preference',
        sourceThreadId: 'thread:tea',
        sourceChunkId: 'thread:tea:chunk:1',
        sourceTurnIds: ['turn:tea:1'],
        archiveExcerpt: 'Now I love lapsang souchong.',
        evidenceSnippet: 'Now I love lapsang souchong.',
        sourceObservations: [
          {
            threadId: 'thread:tea',
            chunkId: 'thread:tea:chunk:1',
            turnIds: ['turn:tea:1'],
            observedAt: '2024-02-03T10:00:00.000Z',
            value: 'lapsang souchong',
            sourceExcerpt: 'Now I love lapsang souchong.',
            temporalScope: {
              label: 'current',
              observedAt: '2024-02-03T10:00:00.000Z',
            },
          },
        ],
        temporalScope: {
          label: 'current',
          observedAt: '2024-02-03T10:00:00.000Z',
        },
        reviewStatus: 'pending',
        createdAt: '2024-02-03T10:00:00.000Z',
      },
    });
    api.writeArchiveStore(archive);

    const queueItem = api.readArchiveStore().global.promotionQueue[0];
    assert.equal(queueItem.sourceSessionIds[0], 'thread:tea');
    assert.equal(queueItem.promotionPacket.sourceChunkId, 'thread:tea:chunk:1');
    assert.equal(queueItem.promotionPacket.sourceObservations.length, 1);

    const review = api.reviewPromotion({ queueId: queueItem.id, action: 'approve' });
    assert.equal(review.action, 'approve');
    assert.equal(review.promotedMemory.origin.sourceThreadId, 'thread:tea');
    assert.equal(review.promotedMemory.origin.sourceChunkId, 'thread:tea:chunk:1');
    assert.deepEqual(review.promotedMemory.origin.sourceTurnIds, ['turn:tea:1']);
    assert.equal(review.promotedMemory.origin.sourceObservations[0].sourceExcerpt, 'Now I love lapsang souchong.');
    assert.equal(review.promotedMemory.origin.sourceObservations[0].observedAt, '2024-02-03T10:00:00.000Z');
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
