const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_P0_EVAL_PACK_SCHEMA,
  P0_EVAL_LANES,
  buildP0EvalPackArtifact,
  summarizeP0EvalCases,
} = require('../lib/penny-p0-eval-pack');
const {
  parseP0EvalPackArgs,
  writeP0EvalPackArtifact,
} = require('../scripts/eval-penny-p0-fixture-pack');

test('P0 eval pack fixture covers every required Penny lane without live calls or writes', () => {
  const artifact = buildP0EvalPackArtifact({
    generatedAt: '2026-06-19T21:00:00.000Z',
  });
  const lanes = artifact.cases.map((item) => item.lane);

  assert.equal(artifact.schema, PENNY_P0_EVAL_PACK_SCHEMA);
  assert.equal(artifact.artifactKind, 'p0-fixture-eval-pack');
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.runnerMode, 'fixture-only');
  assert.deepEqual(lanes.sort(), [...P0_EVAL_LANES].sort());
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.lmStudioCalls, false);
  assert.equal(artifact.liveUserMemoryTouched, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.runtimeVoiceChanged, false);
  assert.equal(artifact.defaultContextChanged, false);
  assert.equal(artifact.defaultModelChanged, false);
  assert.equal(artifact.lmStudioModelStateChanged, false);
  assert.equal(artifact.summary.caseCount, P0_EVAL_LANES.length);
  assert.equal(artifact.summary.blockingFailureCount, 0);
  assert.equal(artifact.summary.trustVerdict, 'fixture-pass');
});

test('P0 eval pack keeps latency nullable and makes hallucination risks evaluable', () => {
  const artifact = buildP0EvalPackArtifact({
    generatedAt: '2026-06-19T21:05:00.000Z',
  });
  const latency = artifact.cases.find((item) => item.lane === 'latency-class');
  const hallucination = artifact.cases.find((item) => item.lane === 'hallucination-claim-risk');

  assert.equal(latency.fixture.liveLatencyMs, null);
  assert.equal(latency.fixture.firstTokenLatencyMs, null);
  assert.equal(latency.fixture.totalLatencyMs, null);
  assert.equal(latency.expected.latencyMeasured, false);
  assert.equal(hallucination.expected.rejectUnsupportedClaims, true);
  assert.match(hallucination.expected.blockedClaimTypes.join(' '), /fake test pass/);
  assert.match(hallucination.expected.blockedClaimTypes.join(' '), /candidate-only truth laundering/);
  assert.equal(hallucination.result.pass, true);
});

test('P0 eval pack summary blocks failed P0 cases', () => {
  const summary = summarizeP0EvalCases([
    { severity: 'P0', result: { pass: true } },
    { severity: 'P0', result: { pass: false, failureMode: 'unsupported-claim' } },
    { severity: 'P1', result: { pass: false } },
  ]);

  assert.equal(summary.caseCount, 3);
  assert.equal(summary.passingCaseCount, 1);
  assert.equal(summary.blockingFailureCount, 1);
  assert.equal(summary.trustVerdict, 'fixture-blocked');
});

test('P0 eval pack writer and args stay fixture-only', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-p0-eval-pack-'));
  const outputPath = path.join(dir, 'p0-eval.json');
  const artifact = buildP0EvalPackArtifact({
    generatedAt: '2026-06-19T21:10:00.000Z',
  });

  try {
    assert.equal(parseP0EvalPackArgs([]).fixture, true);
    assert.equal(parseP0EvalPackArgs([]).mode, 'fixture');
    assert.match(parseP0EvalPackArgs([]).outputPath, /p0-eval-pack-/);
    assert.deepEqual(parseP0EvalPackArgs(['--fixture', '--output', outputPath]), {
      fixture: true,
      mode: 'fixture',
      outputPath,
    });

    const result = writeP0EvalPackArtifact({ outputPath, artifact });
    const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

    assert.equal(result.outputPath, outputPath);
    assert.equal(written.schema, PENNY_P0_EVAL_PACK_SCHEMA);
    assert.equal(written.liveModelCalls, false);
    assert.equal(written.memoryWrites, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
