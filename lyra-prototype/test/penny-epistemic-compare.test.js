const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCompareTrace,
  buildModePlan,
  buildPairSummary,
  classifyModeLabel,
  flattenServerStatus,
  resolvePrimaryModeKeys,
  shouldRunDiagnosticMatrix,
} = require('../scripts/eval-penny-epistemic-compare');

test('buildModePlan keeps off/synthesis-only as the primary compare pair by default', () => {
  const modes = buildModePlan({ policy: 'never' });
  assert.deepEqual(modes.map((item) => item.key), ['off', 'synthesis-only']);
});

test('resolvePrimaryModeKeys accepts an explicit off/synthesis-only pair', () => {
  assert.deepEqual(resolvePrimaryModeKeys('off,synthesis-only'), ['off', 'synthesis-only']);
  assert.deepEqual(resolvePrimaryModeKeys('off,not-a-mode'), ['off', 'synthesis-only']);
});

test('buildModePlan dedupes diagnostic modes that are already in the primary pair', () => {
  const modes = buildModePlan({
    primaryModeKeys: ['off', 'synthesis-only'],
    pairedSummary: { pairedVerdict: 'ambiguous' },
    policy: 'auto',
  });
  assert.deepEqual(modes.map((item) => item.key), ['off', 'synthesis-only', 'caution-only']);
});

test('diagnostic matrix only auto-runs after a clean ambiguous paired compare', () => {
  assert.equal(shouldRunDiagnosticMatrix({ pairedVerdict: 'ambiguous' }, 'auto'), true);
  assert.equal(shouldRunDiagnosticMatrix({ pairedVerdict: 'on' }, 'auto'), false);
  assert.equal(shouldRunDiagnosticMatrix({ pairedVerdict: 'ambiguous' }, 'never'), false);
  assert.equal(shouldRunDiagnosticMatrix({ pairedVerdict: 'on' }, 'always'), true);
});

test('buildPairSummary distinguishes invalid environments, ambiguous compares, and clear winners', () => {
  const invalid = buildPairSummary([
    { mode: 'off', totalScore: 1, environment: { valid: false }, cases: [] },
    { mode: 'on', totalScore: 2, environment: { valid: true }, cases: [] },
  ], ['off', 'on']);
  assert.equal(invalid.pairedVerdict, 'invalid environment');

  const ambiguous = buildPairSummary([
    { mode: 'off', totalScore: 2, environment: { valid: true }, cases: [] },
    { mode: 'synthesis-only', totalScore: 2.5, environment: { valid: true }, cases: [] },
  ], ['off', 'synthesis-only']);
  assert.equal(ambiguous.pairedVerdict, 'ambiguous');
  assert.deepEqual(ambiguous.primaryModes, ['off', 'synthesis-only']);

  const winner = buildPairSummary([
    { mode: 'off', totalScore: 1, environment: { valid: true }, cases: [] },
    { mode: 'synthesis-only', totalScore: 3, environment: { valid: true }, cases: [] },
  ], ['off', 'synthesis-only']);
  assert.equal(winner.pairedVerdict, 'synthesis-only');
  assert.equal(winner.winner, 'synthesis-only');
});

test('buildCompareTrace records an ambiguous trust verdict for inconclusive primary compares', () => {
  const trace = buildCompareTrace({
    startedAt: '2026-04-16T12:00:00.000Z',
    finishedAt: '2026-04-16T12:05:00.000Z',
    diagnosticsPolicy: 'auto',
    primaryModes: ['off', 'synthesis-only'],
    modes: [
      {
        mode: 'off',
        manifest: { diagnostic: false, resolvedModels: { chat: 'q6', tool: 'e4b' } },
        prepare: { loadedModels: ['q6', 'e4b'] },
        serverStatus: { availableModels: ['q6', 'e4b'] },
        environment: { valid: true },
        cases: [
          {
            ok: true,
            seconds: 10,
            artifact: {},
            artifactSummary: { selectedLane: 'chat' },
          },
        ],
      },
      {
        mode: 'synthesis-only',
        manifest: { diagnostic: true, resolvedModels: { chat: 'q6', tool: 'e4b' } },
        prepare: { loadedModels: ['q6', 'e4b'] },
        serverStatus: { availableModels: ['q6', 'e4b'] },
        environment: { valid: true },
        cases: [
          {
            ok: true,
            seconds: 11,
            artifact: {},
            artifactSummary: { selectedLane: 'chat' },
          },
        ],
      },
    ],
    summary: {
      pairedVerdict: 'ambiguous',
      ambiguous: true,
      winner: '',
      bestScore: 2.5,
      primaryModes: ['off', 'synthesis-only'],
      perMode: {
        off: 'ambiguous',
        'synthesis-only': 'ambiguous',
      },
    },
  });

  assert.equal(trace.trust.verdict, 'ambiguous');
  assert.deepEqual(trace.trust.reasonCodes, ['paired_compare_ambiguous']);
  assert.equal(trace.outcome.primaryPair, 'off, synthesis-only');
});

test('flattenServerStatus lifts nested LM Studio readiness into the compare harness shape', () => {
  const status = flattenServerStatus({
    semanticMemory: {
      configuredModel: 'text-embedding-nomic-embed-text-v1.5',
      ready: true,
    },
    lmStudio: {
      resolvedChatModel: 'unsloth/gemma-4-31b-it',
      resolvedToolModel: 'google/gemma-4-e4b',
      availableModels: ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b'],
    },
  });

  assert.equal(status.resolvedChatModel, 'unsloth/gemma-4-31b-it');
  assert.equal(status.resolvedToolModel, 'google/gemma-4-e4b');
  assert.deepEqual(status.availableModels, ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b']);
  assert.equal(status.semanticReady, true);
  assert.equal(status.semanticMemory.embedModel, 'text-embedding-nomic-embed-text-v1.5');
});

test('classifyModeLabel reports invalid environment and aborted run separately from valid scoring', () => {
  assert.equal(classifyModeLabel({
    environment: { valid: false },
    cases: [],
    totalScore: 3,
  }, 3), 'invalid environment');

  assert.equal(classifyModeLabel({
    environment: { valid: true },
    cases: [{ ok: false }],
    totalScore: 3,
  }, 3), 'aborted run');

  assert.equal(classifyModeLabel({
    environment: { valid: true },
    cases: [{ ok: true }],
    totalScore: 3,
  }, 3), 'valid win');

  assert.equal(classifyModeLabel({
    environment: { valid: true },
    cases: [{ ok: true }],
    totalScore: 1,
  }, 3), 'valid failure');
});
