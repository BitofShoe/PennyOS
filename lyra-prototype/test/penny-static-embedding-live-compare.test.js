const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MODE_CONFIGS,
  analyzeCaseResponse,
  buildCases,
  buildPairSummary,
  buildStaticCompareTrace,
  estimatePromptTokens,
  renderedArchiveIds,
  resolveCompareBackend,
} = require('../scripts/eval-penny-static-embedding-live-compare');

test('resolveCompareBackend defaults unknown values to mock and allows real as an explicit parse value', () => {
  assert.equal(resolveCompareBackend(''), 'mock');
  assert.equal(resolveCompareBackend('mock'), 'mock');
  assert.equal(resolveCompareBackend('real'), 'real');
  assert.equal(resolveCompareBackend('weird'), 'mock');
});

test('static live compare exposes the expected three-arm mode set and correction cases', () => {
  assert.deepEqual(Object.keys(MODE_CONFIGS), [
    'static-off',
    'static-live-shadow',
    'static-live-advisory',
  ]);
  assert.deepEqual(buildCases().map((item) => item.name), [
    'coding_mascot_current_correction',
    'cashier_watch_current_correction',
    'favorite_tea_current_correction',
  ]);
  assert.equal(MODE_CONFIGS['static-live-shadow'].flags.PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED, '0');
  assert.equal(MODE_CONFIGS['static-live-advisory'].flags.PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED, '1');
});

test('analyzeCaseResponse rewards current rendered support and flags stale overclaims', () => {
  const scenario = buildCases()[0];
  const current = analyzeCaseResponse(
    'Copper rabbit now.',
    scenario,
    {
      promptTruth: {
        channels: {
          globalArchive: { renderedSourceIds: [scenario.currentId] },
        },
      },
    },
  );
  const stale = analyzeCaseResponse(
    'Looks like brass fox.',
    scenario,
    {
      promptTruth: {
        channels: {
          globalArchive: { renderedSourceIds: [scenario.staleId] },
        },
      },
    },
  );
  assert.ok(current.score > stale.score);
  assert.equal(current.correctionFailure, false);
  assert.equal(stale.overclaiming, true);
  assert.equal(stale.correctionFailure, true);
});

test('renderedArchiveIds combines session and global PromptTruth rendered ids', () => {
  assert.deepEqual(renderedArchiveIds({
    promptTruth: {
      channels: {
        sessionArchive: { renderedSourceIds: ['session-a'] },
        globalArchive: { renderedSourceIds: ['global-b'] },
      },
    },
  }), ['session-a', 'global-b']);
});

test('buildPairSummary emits the requested static-live-advisory verdict shape on clean wins', () => {
  const cases = buildCases();
  const makeCase = (scenario, {
    score,
    currentHits = [],
    staleHits = [],
    currentRendered = false,
    staticMode = '',
    firstTokenMs = 10,
    seconds = 0.05,
  } = {}) => ({
    name: scenario.name,
    ok: true,
    score,
    seconds,
    artifact: {},
    artifactSummary: {
      selectedLane: 'chat',
      staticMode,
      firstTokenMs,
      promptTokenEstimate: 6,
    },
    analysis: {
      currentHits,
      staleHits,
      currentRendered,
      overclaiming: staleHits.length > 0 && !currentHits.length,
      correctionFailure: !currentRendered || !currentHits.length,
    },
  });

  const off = {
    mode: 'static-off',
    totalScore: 0,
    environment: { valid: true },
    cases: cases.map((scenario) => makeCase(scenario, {
      score: 0,
      staleHits: scenario.staleNeedles.slice(0, 1),
      currentRendered: false,
    })),
  };
  const shadow = {
    mode: 'static-live-shadow',
    totalScore: 0,
    environment: { valid: true },
    cases: off.cases.map((item) => ({ ...item, artifactSummary: { ...item.artifactSummary, staticMode: 'live-shadow' } })),
  };
  const advisory = {
    mode: 'static-live-advisory',
    totalScore: 9,
    environment: { valid: true },
    cases: cases.map((scenario) => makeCase(scenario, {
      score: 3,
      currentHits: scenario.currentNeedles.slice(0, 1),
      currentRendered: true,
      staticMode: 'live-advisory',
    })),
  };

  const summary = buildPairSummary([off, shadow, advisory]);
  assert.equal(summary.pairedVerdict, 'static-live-advisory');
  assert.equal(summary.totalDelta, 9);
  assert.equal(summary.humanObservableWins, 3);
  assert.equal(summary.overclaimRegressions, 0);
  assert.equal(summary.correctionFailures, 0);
  assert.equal(summary.staticOnlyRenderedCount, 3);
  assert.equal(summary.promptTokenDelta, 0);
  assert.equal(summary.trustVerdict, 'pass');
});

test('buildStaticCompareTrace preserves summary verdict metrics in QA trace outcome', () => {
  const trace = buildStaticCompareTrace({
    startedAt: '2026-04-22T12:00:00.000Z',
    finishedAt: '2026-04-22T12:01:00.000Z',
    loadedModels: ['mock/static-compare-chat'],
    modes: [
      {
        mode: 'static-off',
        serverStatus: { resolvedChatModel: 'mock/static-compare-chat', resolvedToolModel: 'google/gemma-4-e4b' },
        environment: { valid: true },
        cases: [{ ok: true, artifact: {}, artifactSummary: { selectedLane: 'chat' } }],
      },
      {
        mode: 'static-live-shadow',
        serverStatus: { resolvedChatModel: 'mock/static-compare-chat', resolvedToolModel: 'google/gemma-4-e4b' },
        staticStatus: { provider: 'static' },
        environment: { valid: true },
        cases: [{ ok: true, artifact: {}, artifactSummary: { selectedLane: 'chat', staticMode: 'live-shadow' } }],
      },
      {
        mode: 'static-live-advisory',
        serverStatus: { resolvedChatModel: 'mock/static-compare-chat', resolvedToolModel: 'google/gemma-4-e4b' },
        staticStatus: { provider: 'static' },
        environment: { valid: true },
        cases: [{ ok: true, artifact: {}, artifactSummary: { selectedLane: 'chat', staticMode: 'live-advisory' } }],
      },
    ],
    summary: {
      pairedVerdict: 'static-live-advisory',
      humanObservableWins: 3,
      overclaimRegressions: 0,
      correctionFailures: 0,
      candidateSurvivalDelta: 3,
      staticOnlyRenderedCount: 3,
      promptTokenDelta: 0,
      trustVerdict: 'pass',
      perMode: {
        'static-off': 'baseline',
        'static-live-shadow': 'trace-only',
        'static-live-advisory': 'valid win',
      },
    },
  });

  assert.equal(trace.trust.verdict, 'pass');
  assert.equal(trace.outcome.winner, 'static-live-advisory');
  assert.equal(trace.outcome.humanObservableWins, 3);
  assert.equal(trace.memoryReads.candidateSurvivalDelta, 3);
  assert.equal(trace.memoryReads.staticOnlyRenderedCount, 3);
});

test('estimatePromptTokens is stable for word-heavy and compact strings', () => {
  assert.equal(estimatePromptTokens('Current coding mascot is copper rabbit now.'), 11);
  assert.equal(estimatePromptTokens('abcdefghijklmnop'), 4);
});
