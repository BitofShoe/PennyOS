const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');
const {
  ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND,
  buildAlivenessCompareFixtureArtifact,
  buildFixtureCompareCase,
  parseAlivenessCompareArgs,
  parseArgValue,
  writeAlivenessCompareFixtureArtifact,
} = require('../scripts/eval-penny-aliveness-compare');
const {
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_SCENARIO_IDS,
  ALIVENESS_VERDICTS,
  REQUIRED_ALIVENESS_SCENARIO_IDS,
  buildAlivenessScenarioFixtures,
} = require('../lib/penny-aliveness-qa');

const GENERATED_AT = '2026-04-22T12:00:00.000Z';

test('aliveness compare fixture runner exposes A2 cases with schema and metrics', () => {
  const artifact = buildAlivenessCompareFixtureArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, ALIVENESS_COMPARE_SCHEMA);
  assert.equal(artifact.artifactKind, ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND);
  assert.equal(artifact.measurementMode, 'fixture');
  assert.equal(artifact.runnerMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.lmStudioCalls, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.autonomousActions, false);
  assert.deepEqual(artifact.cases.map((item) => item.id), REQUIRED_ALIVENESS_SCENARIO_IDS);

  assert.equal(artifact.summary.caseCount, 8);
  assert.equal(artifact.summary.fixtureCaseCount, 8);
  assert.equal(artifact.summary.requiredCasesPresent, true);
  assert.equal(artifact.summary.allFixtureOnly, true);
  assert.equal(artifact.summary.runtimeMetricsMeasured, false);
  assert.equal(artifact.summary.pass, true);
  assert.equal(artifact.summary.verdict, ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS);
  assert.equal(artifact.summary.humanObservableWins, 3);
  assert.equal(artifact.summary.continuityWins, 2);
  assert.equal(artifact.summary.trustFailureCount, 0);
  assert.equal(artifact.metrics.measurementStatus, 'not-run');
  assert.equal(artifact.metrics.promptTokenDelta.count, 0);
  assert.equal(artifact.metrics.firstTokenLatencyDeltaMs.max, null);
  assert.equal(artifact.metrics.totalLatencyDeltaMs.total, null);
});

test('aliveness compare fixture cases are not-run placeholders, not live responses', () => {
  const fixtures = buildAlivenessScenarioFixtures();
  const directCommand = buildFixtureCompareCase(
    fixtures.find((item) => item.id === ALIVENESS_SCENARIO_IDS.INITIATIVE_RESTRAINT_DIRECT_COMMAND),
  );
  const continuity = buildFixtureCompareCase(
    fixtures.find((item) => item.id === ALIVENESS_SCENARIO_IDS.PROJECT_CONTINUITY_STATIC_IMPLEMENTATION),
  );

  assert.equal(directCommand.liveModelCalls, false);
  assert.equal(directCommand.serverSpawned, false);
  assert.equal(directCommand.lmStudioCalls, false);
  assert.equal(directCommand.baseline.responseStatus, 'not-run');
  assert.equal(directCommand.featureOn.responseStatus, 'not-run');
  assert.equal(directCommand.metrics.status, 'not-run');
  assert.equal(directCommand.metrics.runtimeMetricsMeasured, false);
  assert.equal(directCommand.deltas.annoyanceRegression, false);

  assert.equal(continuity.deltas.humanObservableWin, true);
  assert.equal(continuity.deltas.continuityWin, true);
  assert.equal(continuity.deltas.overclaimRegression, false);
});

test('aliveness compare fixture writer writes requested artifact path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-aliveness-compare-'));
  const outputPath = path.join(dir, 'fixture.json');
  const artifact = buildAlivenessCompareFixtureArtifact({ generatedAt: GENERATED_AT });

  const result = writeAlivenessCompareFixtureArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, ALIVENESS_COMPARE_SCHEMA);
  assert.equal(written.summary.requiredCasesPresent, true);
  assert.equal(written.liveModelCalls, false);
});

test('aliveness compare fixture args and npm script stay fixture-only', () => {
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--output=tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--other', 'tmp/out.json']), '');

  assert.deepEqual(parseAlivenessCompareArgs(['--fixture', '--output', 'tmp/out.json']), {
    fixture: true,
    mode: 'fixture',
    outputPath: 'tmp/out.json',
  });
  assert.deepEqual(parseAlivenessCompareArgs(['--mode=fixture']), {
    fixture: true,
    mode: 'fixture',
    outputPath: parseAlivenessCompareArgs([]).outputPath,
  });
  assert.equal(
    packageJson.scripts['eval:aliveness:fixture'],
    'node scripts/eval-penny-aliveness-compare.js --fixture',
  );
});
