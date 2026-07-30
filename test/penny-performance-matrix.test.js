const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PERFORMANCE_DIMENSIONS,
  normalizeRun,
  buildPerformanceMatrix,
  assertPerformanceClaim,
} = require('../lib/penny-performance-matrix');

function profile(overrides = {}) {
  return {
    id: 'mock-chat',
    label: 'Mock chat',
    provider: 'isolated-mock',
    transport: 'sse',
    model: 'mock/penny',
    hardwareAcceleration: { state: 'not-applicable' },
    reasoning: {
      capability: 'supported',
      requested: 'not-requested',
      effective: 'enabled',
      observed: 'reasoning-observed',
    },
    projector: { state: 'not-applicable' },
    outputTokenLimit: 64,
    ...overrides,
  };
}

function run(repetition, overrides = {}) {
  return {
    id: `run-${repetition}`,
    profileId: 'mock-chat',
    repetition,
    measurementMode: 'isolated-mock',
    workload: {
      promptChars: 100,
      promptBytes: 100,
      promptTokenEstimate: 25,
      messageCount: 2,
      outputTokenLimit: 64,
    },
    cache: { state: 'warm', promptCacheHit: true, providerCacheHit: true },
    calls: { primaryModelCalls: 1, cadenceRepairCalls: 0, totalModelCalls: 1 },
    timings: {
      endToEndMs: 40 + repetition,
      pennyPreProviderMs: 2,
      providerRoundTripMs: 34,
      promptEvaluationMs: 3,
      firstProviderEventMs: 10,
      firstVisibleTokenMs: 18,
      visibleGenerationMs: 16,
      pennyPostProviderMs: 4,
      pennyOverheadMs: 6,
      cadenceRepairMs: 0,
    },
    output: {
      visibleChars: 24,
      visibleTokenEstimate: 6,
      reasoningCharsObserved: 12,
    },
    ...overrides,
  };
}

test('performance matrix exposes every agreed decomposition dimension', () => {
  assert.deepEqual(PERFORMANCE_DIMENSIONS, [
    'hardwareAcceleration',
    'reasoning',
    'promptSize',
    'projector',
    'caching',
    'promptEvaluation',
    'firstProviderEvent',
    'firstVisibleToken',
    'visibleGeneration',
    'pennyOverhead',
    'cadenceRepair',
    'repeatedWarmRuns',
  ]);
});

test('isolated mock profile becomes claimable only for transport plumbing after repeated warm runs', () => {
  const matrix = buildPerformanceMatrix({
    profiles: [profile()],
    runs: [run(1), run(2), run(3), run(4)],
  });
  const result = matrix.profiles[0];
  assert.deepEqual(result.missingDimensions, []);
  assert.equal(result.warmRunCount, 4);
  assert.equal(result.claim.claimable, true);
  assert.equal(result.claim.scope, 'transport-plumbing-only');
  assert.equal(matrix.claimAudit.liveInteractiveClaimable, false);
  assert.equal(assertPerformanceClaim(matrix, {
    profileId: 'mock-chat',
    scope: 'transport-plumbing-only',
  }).profile.id, 'mock-chat');
  assert.throws(() => assertPerformanceClaim(matrix, {
    profileId: 'mock-chat',
    scope: 'exact-profile-only',
  }), /supports transport-plumbing-only, not exact-profile-only/i);
});

test('missing prompt-evaluation timing and repeated warm runs block claims explicitly', () => {
  const incomplete = run(1);
  delete incomplete.timings.promptEvaluationMs;
  const matrix = buildPerformanceMatrix({
    profiles: [profile()],
    runs: [incomplete],
  });
  assert.equal(matrix.profiles[0].claim.claimable, false);
  assert.ok(matrix.profiles[0].missingDimensions.includes('promptEvaluation'));
  assert.ok(matrix.profiles[0].missingDimensions.includes('repeatedWarmRuns'));
  assert.throws(() => assertPerformanceClaim(matrix, { profileId: 'mock-chat' }), /not claimable/i);
});

test('cadence repair must be recorded as a distinct second call and timing', () => {
  const repaired = run(1, {
    calls: { primaryModelCalls: 1, cadenceRepairCalls: 1, totalModelCalls: 2 },
    timings: {
      ...run(1).timings,
      cadenceRepairMs: 22,
    },
  });
  const normalized = normalizeRun(repaired);
  assert.equal(normalized.calls.primaryModelCalls, 1);
  assert.equal(normalized.calls.cadenceRepairCalls, 1);
  assert.equal(normalized.calls.totalModelCalls, 2);
  assert.equal(normalized.timings.cadenceRepairMs, 22);
});

test('unknown hardware, reasoning, projector, and cache states stay visible instead of being inferred', () => {
  const matrix = buildPerformanceMatrix({
    profiles: [profile({
      hardwareAcceleration: { state: 'unknown' },
      reasoning: { capability: 'unknown', requested: 'unknown', effective: 'unknown', observed: 'unknown' },
      projector: { state: 'unknown' },
    })],
    runs: [run(1, { cache: { state: 'unknown' } }), run(2), run(3)],
  });
  assert.deepEqual(
    matrix.profiles[0].missingDimensions.filter((item) => (
      ['hardwareAcceleration', 'reasoning', 'projector', 'caching'].includes(item)
    )),
    ['hardwareAcceleration', 'reasoning', 'projector', 'caching'],
  );
  assert.equal(matrix.profiles[0].claim.claimable, false);
});
