const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REASONING_CONTRACT_SCHEMA,
  buildStatusReasoningContract,
  normalizeReasoningContract,
  recordReasoningObservation,
  recordReasoningRequest,
} = require('../lib/penny-reasoning-contract');

test('status reasoning contract does not confuse request policy with provider-effective state', () => {
  const contract = buildStatusReasoningContract();

  assert.equal(contract.schema, REASONING_CONTRACT_SCHEMA);
  assert.equal(contract.modelCall, false);
  assert.equal(contract.capability.state, 'unknown');
  assert.equal(contract.requested.state, 'not-requested');
  assert.equal(contract.requested.control, 'omitted');
  assert.equal(contract.effective.state, 'unknown');
  assert.equal(contract.observed.state, 'unknown');
});

test('an omitted reasoning request stays distinct from a completed response with no reasoning signal', () => {
  const laneRuntime = {};
  recordReasoningRequest(laneRuntime, { state: 'not-requested', control: 'omitted' });
  recordReasoningObservation(laneRuntime, { responseCompleted: true });

  assert.equal(laneRuntime.reasoningContract.requested.state, 'not-requested');
  assert.equal(laneRuntime.reasoningContract.effective.state, 'unknown');
  assert.equal(laneRuntime.reasoningContract.observed.state, 'not-observed');
});

test('reasoning metadata proves support and effective use without retaining hidden text', () => {
  const laneRuntime = {};
  recordReasoningRequest(laneRuntime);
  recordReasoningObservation(laneRuntime, {
    source: 'stateful-reasoning-delta',
    signal: 'reasoning.delta',
    reasoningChars: 64000,
    reasoningTokens: 700,
    truncated: true,
  });

  const serialized = JSON.stringify(laneRuntime.reasoningContract);
  assert.equal(laneRuntime.reasoningContract.capability.state, 'supported');
  assert.equal(laneRuntime.reasoningContract.effective.state, 'enabled');
  assert.equal(laneRuntime.reasoningContract.observed.state, 'reasoning-observed');
  assert.equal(laneRuntime.reasoningContract.observed.reasoningChars, 64000);
  assert.equal(laneRuntime.reasoningContract.observed.reasoningTokens, 700);
  assert.equal(laneRuntime.reasoningContract.observed.truncated, true);
  assert.doesNotMatch(serialized, /hidden text/i);
});

test('normalization refuses unsupported state labels and remains conservative', () => {
  const contract = normalizeReasoningContract({
    capability: { state: 'probably' },
    requested: { state: 'off-ish' },
    effective: { state: 'surely-off' },
    observed: { state: 'maybe' },
  });

  assert.equal(contract.capability.state, 'unknown');
  assert.equal(contract.requested.state, 'unknown');
  assert.equal(contract.effective.state, 'unknown');
  assert.equal(contract.observed.state, 'unknown');
});
