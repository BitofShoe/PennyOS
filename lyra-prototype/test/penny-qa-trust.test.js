const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRuntimeArtifact,
} = require('../lib/penny-runtime-artifacts');
const {
  buildQaTrust,
  validateRuntimeArtifact,
} = require('../lib/penny-qa-trust');

test('buildQaTrust distinguishes ambiguous, degraded, fallback, and clean runs', () => {
  const ambiguous = buildQaTrust({
    ambiguous: true,
    reasonCodes: ['paired_compare_ambiguous'],
  });
  assert.equal(ambiguous.verdict, 'ambiguous');
  assert.equal(ambiguous.scope, 'compare');

  const degraded = buildQaTrust({
    environment: {
      valid: false,
      degradedArtifacts: 2,
      reasons: ['runtime artifacts reported degraded readiness on 2 turn(s)'],
    },
  });
  assert.equal(degraded.verdict, 'degraded');
  assert.match(degraded.reasonCodes.join(','), /runtime_degraded/);

  const fallback = buildQaTrust({
    environment: {
      valid: false,
      laneFallbackArtifacts: 1,
      usedFallbackArtifacts: 0,
      reasons: ['runtime artifacts reported lane fallback on 1 turn(s)'],
    },
  });
  assert.equal(fallback.verdict, 'fallback');
  assert.match(fallback.reasonCodes.join(','), /lane_fallback/);

  const clean = buildQaTrust({
    environment: { valid: true, reasons: [] },
    artifactValidatedCount: 3,
    expectedArtifactCount: 3,
  });
  assert.equal(clean.verdict, 'pass');
  assert.deepEqual(clean.reasonCodes, ['checks_clean']);
});

test('buildQaTrust treats caller failure reason codes as invalid checks', () => {
  const trust = buildQaTrust({
    environment: { valid: true, reasons: [] },
    artifactValidatedCount: 7,
    expectedArtifactCount: 7,
    reasonCodes: [
      'over_compliance_watchlist_failed',
      'over_compliance_source_trust',
    ],
    reasons: ['Over-compliance audit flagged the current prompt set.'],
  });

  assert.equal(trust.verdict, 'invalid');
  assert.equal(trust.scope, 'behavior');
  assert.equal(trust.environmentValid, true);
  assert.deepEqual(trust.reasonCodes, [
    'over_compliance_watchlist_failed',
    'over_compliance_source_trust',
  ]);
});

test('validateRuntimeArtifact supports configurable evidence and side-effect minima', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    resolvedModel: 'google/gemma-4-e4b',
    retrieval: {
      session: [
        {
          id: 'episode-1',
          text: 'Favorite tea is lapsang souchong now.',
          scope: 'session',
          sourceLabel: 'archive-session',
          sourceType: 'episode',
          sourceEpisodeIds: ['episode-1'],
        },
      ],
    },
    toolRecords: [
      {
        name: 'get_git_status',
        result: {
          ok: true,
          label: 'git status',
          data: {},
        },
      },
    ],
  });

  assert.doesNotThrow(() => validateRuntimeArtifact(artifact, {
    label: 'tool artifact',
    minEvidence: 1,
    minSideEffects: 1,
  }));

  assert.throws(() => validateRuntimeArtifact(artifact, {
    label: 'tool artifact',
    minEvidence: 4,
    minSideEffects: 1,
  }), /missing verified evidence/i);
});

test('validateRuntimeArtifact rejects deterministic turns that falsely claim model use', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'deterministic-tool',
    requestedModel: 'google/gemma-4-e4b',
    resolvedModel: 'google/gemma-4-e4b',
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-16T12:00:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
    performance: {
      latencyClass: 'tool-heavy',
      request: { available: true },
      promptAssembly: { available: true },
      archiveRetrieval: { available: true },
      semanticRender: { available: false, attempted: false, used: false },
      modelResolution: { available: true },
      semanticProbe: { available: true },
      firstToken: { available: false },
      modelRoundTrip: {
        available: true,
        startedAt: '2026-04-16T12:00:00.000Z',
        finishedAt: '2026-04-16T12:00:01.000Z',
        durationMs: 1000,
        transport: 'local-lmstudio',
      },
    },
    toolRecords: [
      {
        name: 'read_project_file',
        result: {
          ok: true,
          label: 'read README.md',
          data: { path: 'README.md', textPreview: 'Penny is a local companion prototype.' },
        },
      },
    ],
  });

  assert.throws(() => validateRuntimeArtifact(artifact), /deterministic turn/i);
});
