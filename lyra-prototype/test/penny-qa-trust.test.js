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

test('validateRuntimeArtifact supports configurable evidence and side-effect minima', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
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
