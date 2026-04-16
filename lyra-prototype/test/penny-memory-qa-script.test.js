const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMemoryQaTrace,
  parseMemoryQaArgs,
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
