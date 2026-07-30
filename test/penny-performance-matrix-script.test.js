const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArgs,
  parseSseEvent,
  buildIsolatedMockMatrix,
} = require('../scripts/eval-penny-performance-matrix');

test('performance matrix CLI parses bounded warm-run and output arguments', () => {
  const args = parseArgs(['--warm-runs', '4', '--out', 'output/custom-performance.json']);
  assert.equal(args.warmRuns, 4);
  assert.match(args.outputPath, /output[\\/]custom-performance\.json$/i);
  assert.equal(parseArgs(['--warm-runs', '1']).warmRuns, 3);
});

test('performance matrix SSE parser separates hidden reasoning from visible deltas', () => {
  const reasoning = parseSseEvent('event: reasoning.delta\ndata: {"reasoning":"private"}');
  const visible = parseSseEvent('event: message.delta\ndata: {"content":"hello"}');
  assert.equal(reasoning.event, 'reasoning.delta');
  assert.equal(reasoning.data.reasoning, 'private');
  assert.equal(visible.event, 'message.delta');
  assert.equal(visible.data.content, 'hello');
});

test('isolated mock harness records repeated warm profiles without claiming real-model performance', async () => {
  const matrix = await buildIsolatedMockMatrix({ warmRuns: 3 });
  assert.equal(matrix.schema, 'penny-performance-matrix.v1');
  assert.equal(matrix.profiles.length, 2);
  assert.equal(matrix.claimAudit.liveInteractiveClaimable, false);
  assert.equal(matrix.mockProvider.modelStateTouched, false);
  assert.equal(matrix.mockProvider.primaryRequests, 8);
  assert.equal(matrix.mockProvider.repairRequests, 4);
  for (const result of matrix.profiles) {
    assert.equal(result.warmRunCount, 3);
    assert.deepEqual(result.missingDimensions, []);
    assert.equal(result.claim.claimable, true);
    assert.equal(result.claim.scope, 'transport-plumbing-only');
    assert.equal(result.timingSummary.firstProviderEventMs.count, 3);
    assert.equal(result.timingSummary.firstVisibleTokenMs.count, 3);
    assert.equal(result.timingSummary.pennyOverheadMs.count, 3);
  }
  const repaired = matrix.profiles.find((result) => result.profile.id === 'mock-cadence-repair');
  assert.ok(repaired.runs.every((run) => run.calls.cadenceRepairCalls === 1));
  assert.ok(repaired.runs.every((run) => run.timings.cadenceRepairMs > 0));
});
