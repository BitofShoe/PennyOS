const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');
const {
  FRAME_BUDGET_COMPARE_MODES,
  PENNY_FRAME_BUDGET_COMPARE_SCHEMA,
  REQUIRED_FRAME_BUDGET_COMPARE_MODES,
  normalizeFrameBudgetCompareMode,
} = require('../lib/penny-frame-budget');
const {
  FRAME_BUDGET_COMPARE_ARTIFACT_KIND,
  buildFrameBudgetCompareArtifact,
  buildFrameBudgetFeatureToggleMatrix,
  buildModeDeltas,
  parseFrameBudgetCompareArgs,
  writeFrameBudgetCompareArtifact,
} = require('../scripts/eval-penny-frame-budget');

const GENERATED_AT = '2026-04-22T12:00:00.000Z';

function byId(items = []) {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

test('frame budget compare fixture exposes required F7 modes without live claims', () => {
  const artifact = buildFrameBudgetCompareArtifact({ generatedAt: GENERATED_AT });
  const modes = byId(artifact.modes);

  assert.equal(artifact.schema, PENNY_FRAME_BUDGET_COMPARE_SCHEMA);
  assert.equal(artifact.artifactKind, FRAME_BUDGET_COMPARE_ARTIFACT_KIND);
  assert.equal(artifact.measurementMode, 'fixture');
  assert.equal(artifact.runnerMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.lmStudioCalls, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.runtimeVoiceChanged, false);
  assert.equal(artifact.defaultPromptLimitsRaised, false);
  assert.equal(artifact.defaultRenderedMemoryLimitsRaised, false);
  assert.deepEqual(artifact.modes.map((mode) => mode.id), REQUIRED_FRAME_BUDGET_COMPARE_MODES);
  assert.equal(artifact.summary.requiredModesPresent, true);
  assert.equal(artifact.summary.runtimeMetricsMeasured, false);
  assert.equal(artifact.summary.liveLatencyMeasured, false);
  assert.equal(artifact.summary.recommendation, 'eligible-for-live-frame-budget-measurement');
  assert.equal(artifact.summary.guardrails.answerQualityProof, false);

  assert.equal(modes.baseline.metrics.firstTokenLatencyMs, null);
  assert.equal(modes.baseline.metrics.totalLatencyMs, null);
  assert.equal(modes.baseline.metrics.candidatesRendered, 0);
  assert.equal(modes.baseline.metrics.promptTokenDelta, 0);

  assert.equal(modes['static-live-shadow'].metrics.candidatesInspected > modes.baseline.metrics.candidatesInspected, true);
  assert.equal(modes['static-live-shadow'].metrics.candidatesRendered, 0);
  assert.equal(modes['static-live-shadow'].metrics.staticOnlyRenderedCount, 0);

  assert.equal(modes['static-live-advisory'].metrics.staticOnlyRenderedCount, 2);
  assert.equal(modes['static-live-advisory'].metrics.openLoopsRendered, 0);
  assert.equal(modes['static-live-advisory'].featureFlags.PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(modes['static-live-advisory'].featureFlags.PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED, '1');

  assert.equal(modes['static+open-loops'].metrics.openLoopsScored, 2);
  assert.equal(modes['static+open-loops'].metrics.openLoopsRendered, 1);
  assert.equal(modes['static+open-loops'].featureFlags.PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(modes['static+open-loops'].featureFlags.PENNY_ENABLE_BOUNDED_INITIATIVE, '0');

  assert.equal(modes['bounded-aliveness'].metrics.humanObservableWins, 3);
  assert.equal(modes['bounded-aliveness'].metrics.annoyanceRegressions, 0);
  assert.equal(modes['bounded-aliveness'].metrics.overclaimRegressions, 0);
  assert.equal(modes['bounded-aliveness'].metrics.staleCorrectionFailures, 0);
  assert.equal(modes['bounded-aliveness'].featureFlags.PENNY_ENABLE_TURN_STATE_PROMPT, '1');
  assert.equal(modes['bounded-aliveness'].featureFlags.PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(modes['bounded-aliveness'].featureFlags.PENNY_ENABLE_BOUNDED_INITIATIVE, '1');
  assert.ok(modes['bounded-aliveness'].limits.some((line) => /do not prove answer quality/i.test(line)));
});

test('frame budget compare summary reports deltas from baseline without measuring fixture latency', () => {
  const artifact = buildFrameBudgetCompareArtifact({ generatedAt: GENERATED_AT });
  const deltas = artifact.summary.deltas;

  assert.equal(deltas['static-live-shadow'].firstTokenLatencyDeltaMs, null);
  assert.equal(deltas['static-live-shadow'].prePromptBudgetDeltaMs, 40);
  assert.equal(deltas['static-live-advisory'].staticOnlyRenderedDelta, 2);
  assert.equal(deltas['static+open-loops'].openLoopsRenderedDelta, 1);
  assert.equal(deltas['bounded-aliveness'].humanObservableWinDelta, 3);
  assert.equal(deltas['bounded-aliveness'].annoyanceRegressionDelta, 0);
  assert.equal(deltas['bounded-aliveness'].promptTokenDelta > deltas['static+open-loops'].promptTokenDelta, true);
  assert.equal(artifact.summary.frameBudgetSummary.schema, 'penny-frame-budget-summary.v1');
  assert.equal(artifact.summary.frameBudgetSummary.receiptCount, REQUIRED_FRAME_BUDGET_COMPARE_MODES.length);
  assert.ok(artifact.summary.frameBudgetSummary.reasons.includes('prompt-token-growth'));

  assert.deepEqual(buildModeDeltas([artifact.modes[0]]), {});
});

test('frame budget compare feature toggle matrix and mode aliases stay explicit', () => {
  const matrix = buildFrameBudgetFeatureToggleMatrix();

  assert.deepEqual(Object.keys(matrix), REQUIRED_FRAME_BUDGET_COMPARE_MODES);
  assert.equal(matrix.baseline.PENNY_STATIC_EMBED_MODE, 'off');
  assert.equal(matrix['static-live-shadow'].PENNY_STATIC_EMBED_MODE, 'live-shadow');
  assert.equal(matrix['static-live-advisory'].PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(matrix['static+open-loops'].PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(matrix['static+open-loops'].PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(matrix['bounded-aliveness'].PENNY_ENABLE_TURN_STATE_PROMPT, '1');
  assert.equal(matrix['bounded-aliveness'].PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(matrix['bounded-aliveness'].PENNY_ENABLE_BOUNDED_INITIATIVE, '1');

  assert.equal(normalizeFrameBudgetCompareMode('static-open-loops'), FRAME_BUDGET_COMPARE_MODES.STATIC_OPEN_LOOPS);
  assert.equal(normalizeFrameBudgetCompareMode('bounded-aliveness-on'), FRAME_BUDGET_COMPARE_MODES.BOUNDED_ALIVENESS);
  assert.equal(normalizeFrameBudgetCompareMode('unknown'), FRAME_BUDGET_COMPARE_MODES.BASELINE);
});

test('frame budget compare writer and npm script use the new fixture harness', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-frame-budget-compare-'));
  const outputPath = path.join(dir, 'frame-budget.json');
  const artifact = buildFrameBudgetCompareArtifact({ generatedAt: GENERATED_AT });

  const result = writeFrameBudgetCompareArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, PENNY_FRAME_BUDGET_COMPARE_SCHEMA);
  assert.equal(written.summary.requiredModesPresent, true);
  assert.equal(written.liveModelCalls, false);
  assert.equal(packageJson.scripts['eval:frame-budget'], 'node scripts/eval-penny-frame-budget.js');

  assert.deepEqual(parseFrameBudgetCompareArgs(['--fixture', '--output', outputPath]), {
    fixture: true,
    mode: 'fixture',
    outputPath,
  });
  assert.equal(parseFrameBudgetCompareArgs([]).fixture, true);
  assert.match(parseFrameBudgetCompareArgs([]).outputPath, /frame-budget-compare-/);
});
