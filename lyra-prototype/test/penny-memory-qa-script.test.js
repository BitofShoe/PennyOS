const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQaServerEnv,
  buildSmokeScenarioSpecs,
  buildMemoryQaTrace,
  canonicalAuthorityPressureSatisfied,
  countNeedleHits,
  parseMemoryQaArgs,
  resolveChatRequestTimeoutMs,
  scoreTruthReplacement,
  summarizeSuites,
  MEMORY_QA_SEGMENT_IDS,
  MEMORY_QA_SEGMENT_ORDER,
} = require('../scripts/qa-penny-memory');

test('parseMemoryQaArgs defaults to combined mode when no flags are supplied', () => {
  const parsed = parseMemoryQaArgs([]);
  assert.equal(parsed.runMode, 'combined');
  assert.equal(parsed.runLabel, 'combined');
  assert.equal(parsed.segmentId, '');
  assert.equal(parsed.combinedMode, true);
});

test('parseMemoryQaArgs accepts known segment ids and smoke mode', () => {
  const segment = parseMemoryQaArgs(['--segment', MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT]);
  assert.equal(segment.runMode, 'segment');
  assert.equal(segment.segmentId, MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT);
  assert.equal(segment.runLabel, MEMORY_QA_SEGMENT_IDS.MIXED_DRIFT);

  const smoke = parseMemoryQaArgs(['--smoke']);
  assert.equal(smoke.runMode, 'smoke');
  assert.equal(smoke.runLabel, 'smoke');
});

test('parseMemoryQaArgs supports judged mode and keeps it isolated from combined mode', () => {
  const judged = parseMemoryQaArgs(['--judged']);
  assert.equal(judged.runMode, 'judged');
  assert.equal(judged.runLabel, 'judged');
  assert.equal(judged.judgedMode, true);
  assert.equal(judged.combinedMode, false);

  assert.throws(() => parseMemoryQaArgs(['--judged', '--smoke']), /cannot combine --judged with --smoke/i);
  assert.throws(() => parseMemoryQaArgs(['--judged', '--segment', MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE]), /cannot combine --judged with --segment/i);
});

test('parseMemoryQaArgs rejects invalid segment combinations', () => {
  assert.throws(() => parseMemoryQaArgs(['--smoke', '--segment', MEMORY_QA_SEGMENT_IDS.SEMANTIC_ARCHIVE]), /cannot combine --smoke with --segment/i);
  assert.throws(() => parseMemoryQaArgs(['--segment', 'bogus']), /Unknown memory QA segment/i);
  assert.deepEqual(MEMORY_QA_SEGMENT_ORDER, [
    'semantic-archive',
    'chapter-fallback',
    'contradiction-premise',
    'mixed-drift',
  ]);
});

test('buildQaServerEnv forces stateless chat transport for memory QA servers', () => {
  const env = buildQaServerEnv({
    suiteSlug: 'judged-semantic',
    suitePaths: {
      memoryFile: 'data/penny-memory.test.json',
      archiveFile: 'data/penny-memory-archive.test.json',
      embeddingsFile: 'data/penny-memory-embeddings.test.json',
      ledgerFile: 'data/penny-memory-ledger.test.json',
    },
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
  });

  assert.equal(env.PENNY_LOCAL_LLM_TRANSPORT, 'chat');
  assert.equal(env.PENNY_QA_SUITE, 'judged-semantic');
  assert.equal(env.PENNY_MEMORY_FILE, 'data/penny-memory.test.json');
  assert.equal(env.PENNY_MEMORY_ARCHIVE_FILE, 'data/penny-memory-archive.test.json');
  assert.equal(env.PENNY_MEMORY_EMBEDDINGS_FILE, 'data/penny-memory-embeddings.test.json');
  assert.equal(env.PENNY_MEMORY_LEDGER_FILE, 'data/penny-memory-ledger.test.json');
});

test('resolveChatRequestTimeoutMs keeps smoke runs bounded by a smaller default', () => {
  assert.equal(resolveChatRequestTimeoutMs(null, { smokeMode: true }), 120000);
  assert.equal(resolveChatRequestTimeoutMs(null, { smokeMode: false }), 420000);
  assert.equal(resolveChatRequestTimeoutMs(33000, { smokeMode: true }), 33000);
});

test('buildSmokeScenarioSpecs keeps the live smoke suite bounded and excludes the obfuscated routing probe', () => {
  const specIds = buildSmokeScenarioSpecs().map((spec) => spec.id);
  assert.deepEqual(specIds, [
    'short-term-explicit',
    'contradiction',
    'premise-drift',
    'chapter-fallback-smoke',
  ]);
});

test('scoreTruthReplacement accepts alternative expected phrasings after normalization', () => {
  assert.equal(
    scoreTruthReplacement(
      'It stays left of your keyboard. [MOOD:smug]',
      [['left of the keyboard', 'left of your keyboard']],
      ['right side of the keyboard'],
    ),
    1,
  );
  assert.equal(
    scoreTruthReplacement(
      'It stays on the right side of the keyboard.',
      [['left of the keyboard', 'left of your keyboard']],
      ['right side of the keyboard'],
    ),
    0,
  );
  assert.equal(countNeedleHits('Left of your keyboard.', [['left of the keyboard', 'left of your keyboard']]), 1);
});

test('canonicalAuthorityPressureSatisfied requires canon-first pressure plus same-session advisory presence', () => {
  assert.equal(canonicalAuthorityPressureSatisfied({
    modelAdvisory: {
      authorityPressure: {
        canonicalFactsPresent: true,
        canonicalOverrideActive: true,
        advisoryItemsInjected: 2,
        sameSessionAdvisoryItems: 1,
      },
    },
  }), true);

  assert.equal(canonicalAuthorityPressureSatisfied({
    modelAdvisory: {
      authorityPressure: {
        canonicalFactsPresent: true,
        canonicalOverrideActive: false,
        advisoryItemsInjected: 2,
        sameSessionAdvisoryItems: 1,
      },
    },
  }), false);
});

test('buildMemoryQaTrace emits a fallback trust verdict when lane fallback polluted the run', () => {
  const trace = buildMemoryQaTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:10:00.000Z',
    runMode: 'segment',
    segmentId: 'semantic-archive',
    suites: [
      {
        environment: {
          valid: false,
          laneFallbackArtifacts: 1,
          usedFallbackArtifacts: 0,
          reasons: ['runtime artifacts reported lane fallback on 1 turn(s)'],
        },
        serverStatus: {
          resolvedChatModel: 'q6',
          toolPreferredModel: 'e4b',
          embedPreferredModel: 'nomic',
          availableModels: ['q6', 'e4b'],
          maxOutputTokens: 320,
        },
        scenarios: [
          {
            ok: true,
            seconds: 10,
            meta: {
              localLane: 'chat',
              laneFallback: true,
              artifact: {
                performance: { archiveRetrieval: { sessionItems: 1, globalItems: 0 } },
                readiness: { warmState: 'warm' },
              },
              toolsUsed: [],
            },
            memory: { memories: [] },
            inspectorAfter: { inspector: { archive: { global: { promotionQueue: [] } } } },
          },
        ],
      },
    ],
    summary: {
      completed: 1,
      failed: 0,
      invalid: 0,
      totalScenarioSeconds: 10,
      averageScenarioSeconds: 10,
    },
    preparation: {
      loadedModels: ['q6', 'e4b'],
    },
    qaModelPolicy: {
      chat: 'q6',
      tool: 'e4b',
      embed: 'nomic',
    },
  });

  assert.equal(trace.trust.verdict, 'fallback');
  assert.match(trace.trust.reasonCodes.join(','), /lane_fallback/);
});

test('summarizeSuites and buildMemoryQaTrace retain judged group totals', () => {
  const suites = [
    {
      name: 'judged',
      segmentId: 'judged',
      runLabel: 'judged',
      serverStatus: {
        resolvedChatModel: 'q6',
        toolPreferredModel: 'e4b',
        embedPreferredModel: 'nomic',
        availableModels: ['q6', 'e4b'],
        maxOutputTokens: 320,
      },
      environment: {
        valid: true,
        reasons: [],
      },
      scenarios: [
        { name: 'write', group: 'write', ok: true, seconds: 1.25, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 1, globalItems: 0 } }, readiness: { warmState: 'warm' } } } },
        { name: 'retrieve', group: 'retrieve', ok: true, seconds: 2.5, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 2, globalItems: 1 } }, readiness: { warmState: 'warm' } } } },
        { name: 'retrieve-canon-over-advisory', group: 'retrieve', ok: true, seconds: 1.1, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 1, globalItems: 1 } }, readiness: { warmState: 'warm' } } } },
        { name: 'forget', group: 'forget', ok: false, seconds: 0.75, meta: { artifact: { performance: { archiveRetrieval: { sessionItems: 0, globalItems: 0 } }, readiness: { warmState: 'warm' } } } },
      ],
    },
  ];

  const summary = summarizeSuites(suites);
  assert.equal(summary.completed, 3);
  assert.equal(summary.failed, 1);
  assert.equal(summary.groups.write.total, 1);
  assert.equal(summary.groups.retrieve.total, 2);
  assert.equal(summary.groups.retrieve.completed, 2);
  assert.equal(summary.groups.forget.failed, 1);

  const trace = buildMemoryQaTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:10:00.000Z',
    runMode: 'judged',
    runLabel: 'judged',
    suites,
    summary,
    preparation: {
      loadedModels: ['q6', 'e4b'],
    },
    qaModelPolicy: {
      chat: 'q6',
      tool: 'e4b',
      embed: 'nomic',
    },
  });

  assert.equal(trace.promptVersion, 'qa-penny-memory.judged.v1');
  assert.equal(trace.contextLength.judgedMode, true);
  assert.equal(trace.validation.judgedGroupCount, 3);
  assert.equal(trace.memoryWrites.judgedWriteScenarios, 1);
  assert.equal(trace.memoryReads.judgedRetrieveScenarios, 2);
  assert.equal(trace.outcome.judgedCompletedScenarios, 3);
  assert.equal(trace.outcome.judgedFailedScenarios, 1);
  assert.equal(trace.outcome.judgedGroupNames, 'write, retrieve, forget');
});
