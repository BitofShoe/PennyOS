const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildModePlan,
  buildPairSummary,
  classifyModeLabel,
  flattenServerStatus,
  shouldRunDiagnosticMatrix,
} = require('../scripts/eval-penny-epistemic-compare');

test('buildModePlan keeps off/on as the primary compare pair by default', () => {
  const modes = buildModePlan({ policy: 'never' });
  assert.deepEqual(modes.map((item) => item.key), ['off', 'on']);
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
  ]);
  assert.equal(invalid.pairedVerdict, 'invalid environment');

  const ambiguous = buildPairSummary([
    { mode: 'off', totalScore: 2, environment: { valid: true }, cases: [] },
    { mode: 'on', totalScore: 2.5, environment: { valid: true }, cases: [] },
  ]);
  assert.equal(ambiguous.pairedVerdict, 'ambiguous');

  const winner = buildPairSummary([
    { mode: 'off', totalScore: 1, environment: { valid: true }, cases: [] },
    { mode: 'on', totalScore: 3, environment: { valid: true }, cases: [] },
  ]);
  assert.equal(winner.pairedVerdict, 'on');
  assert.equal(winner.winner, 'on');
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
