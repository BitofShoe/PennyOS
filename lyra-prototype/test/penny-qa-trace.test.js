const test = require('node:test');
const assert = require('node:assert/strict');

const {
  QA_TRACE_VERSION,
  buildQaTrace,
  validateQaTrace,
} = require('../lib/penny-qa-trace');

test('qa trace normalizes a replayable harness envelope', () => {
  const trace = validateQaTrace(buildQaTrace({
    runId: 'memory-qa-demo',
    startedAt: '2026-04-15T12:00:00.000Z',
    finishedAt: '2026-04-15T12:05:00.000Z',
    promptVersion: 'qa-penny-memory.full.v1',
    laneDecision: { chatLaneTurns: 6, toolLaneTurns: 0, laneFallbackTurns: 1 },
    configuredModels: { chat: 'q6', tool: 'e4b', embed: 'nomic' },
    resolvedModels: { chat: 'q6', tool: 'e4b' },
    loadedModels: ['q6', 'e4b', 'q6'],
    contextLength: { suiteCount: 2, maxOutputTokens: 320 },
    memoryReads: { archiveItemsRetrieved: 4 },
    memoryWrites: { successfulTurns: 8 },
    toolCalls: { recordedTools: 0 },
    latency: { averageTurnSeconds: 12.4 },
    validation: { completedScenarios: 4, failedScenarios: 0 },
    outcome: { completedScenarios: 4, failedScenarios: 0, releaseReady: true },
  }));

  assert.equal(trace.version, QA_TRACE_VERSION);
  assert.deepEqual(trace.loadedModels, ['q6', 'e4b']);
  assert.equal(trace.laneDecision.chatLaneTurns, 6);
  assert.equal(trace.validation.failedScenarios, 0);
  assert.equal(trace.outcome.releaseReady, true);
});

test('qa trace validation fails closed when core metadata is missing', () => {
  assert.throws(() => validateQaTrace({
    runId: 'broken-trace',
    startedAt: '2026-04-15T12:00:00.000Z',
    finishedAt: '2026-04-15T12:05:00.000Z',
    promptVersion: 'broken.v1',
    laneDecision: {},
    configuredModels: {},
    resolvedModels: {},
    contextLength: {},
    memoryReads: {},
    memoryWrites: {},
    toolCalls: {},
    latency: {},
    validation: {},
    outcome: {},
  }), /missing validation details|missing outcome details/i);
});
