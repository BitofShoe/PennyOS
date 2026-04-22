const fs = require('fs');
const path = require('path');

const {
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_OUTCOMES,
  ALIVENESS_SCENARIO_FIXTURE_SCHEMA,
  REQUIRED_ALIVENESS_SCENARIO_IDS,
  buildAlivenessScenarioCaseResult,
  buildAlivenessScenarioFixtures,
  classifyAlivenessCaseDelta,
  summarizeAlivenessScenarioFixtures,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

const ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND = 'bounded-aliveness-compare-fixture';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `aliveness-compare-fixture-${STAMP}.json`);

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function hasArgFlag(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  return argv.some((value) => String(value || '').trim() === dashed);
}

function parseAlivenessCompareArgs(argv = process.argv.slice(2)) {
  const mode = parseArgValue('mode', argv) || 'fixture';
  return {
    fixture: hasArgFlag('fixture', argv) || mode === 'fixture',
    mode,
    outputPath: parseArgValue('output', argv) || OUTPUT_PATH,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function omitCases(summary = {}) {
  const { cases, ...rest } = summary;
  return rest;
}

function outcomeDeltas(outcomes = []) {
  const set = new Set(Array.isArray(outcomes) ? outcomes : []);
  return {
    humanObservableWin: set.has(ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN),
    continuityWin: set.has(ALIVENESS_OUTCOMES.CONTINUITY_WIN),
    overclaimRegression: set.has(ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION),
    annoyanceRegression: set.has(ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION),
    sourceBoundaryFailure: set.has(ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE),
    correctionFailure: set.has(ALIVENESS_OUTCOMES.CORRECTION_FAILURE),
    latencyRegression: set.has(ALIVENESS_OUTCOMES.LATENCY_REGRESSION),
    promptBloatRegression: set.has(ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION),
  };
}

function notRunSide(expectation = {}) {
  return {
    ...expectation,
    responseStatus: 'not-run',
    liveModelCalls: false,
    estimatedPromptTokens: null,
    firstTokenLatencyMs: null,
    totalLatencyMs: null,
    renderedMemoryCount: null,
    selectedMemoryCount: null,
  };
}

function buildFixtureCompareCase(fixture = {}) {
  const expectedResult = buildAlivenessScenarioCaseResult(fixture, { outcomeSet: 'expected' });
  const classified = classifyAlivenessCaseDelta(expectedResult);
  return {
    id: fixture.id,
    title: fixture.title,
    category: fixture.category,
    featureMode: fixture.featureMode,
    prompt: fixture.prompt,
    variants: fixture.variants || [],
    measurementMode: 'fixture',
    liveModelCalls: false,
    serverSpawned: false,
    lmStudioCalls: false,
    baseline: notRunSide(fixture.baseline),
    featureOn: notRunSide(fixture.featureOn),
    expectedOutcomes: fixture.expectedOutcomes || [],
    blockedOutcomes: fixture.blockedOutcomes || [],
    guardrails: fixture.guardrails || [],
    notes: fixture.notes || [],
    outcomes: classified.outcomes,
    primaryOutcome: classified.primaryOutcome,
    passEligible: classified.passEligible,
    trustFailures: classified.trustFailures,
    regressions: classified.regressions,
    positiveOutcomes: classified.positiveOutcomes,
    deltas: outcomeDeltas(classified.outcomes),
    metrics: {
      promptTokenDelta: classified.metrics.promptTokenDelta,
      firstTokenLatencyDeltaMs: classified.metrics.firstTokenLatencyDeltaMs,
      totalLatencyDeltaMs: classified.metrics.totalLatencyDeltaMs,
      runtimeMetricsMeasured: false,
      status: 'not-run',
    },
  };
}

function buildAlivenessCompareFixtureArtifact({
  generatedAt = new Date().toISOString(),
  cases = buildAlivenessScenarioFixtures(),
} = {}) {
  const fixtureCases = (Array.isArray(cases) ? cases : []);
  const compareCases = fixtureCases.map((fixture) => buildFixtureCompareCase(fixture));
  const compareSummary = summarizeAlivenessCompare(compareCases);
  const fixtureSummary = summarizeAlivenessScenarioFixtures(fixtureCases);
  const featureModes = ['baseline']
    .concat(fixtureSummary.featureModes || [])
    .filter(Boolean);

  return {
    schema: ALIVENESS_COMPARE_SCHEMA,
    fixtureSchema: ALIVENESS_SCENARIO_FIXTURE_SCHEMA,
    artifactKind: ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND,
    generatedAt,
    modes: [...new Set(featureModes)],
    measurementMode: 'fixture',
    runnerMode: 'fixture-only',
    liveModelCalls: false,
    serverSpawned: false,
    lmStudioCalls: false,
    livePromptBridge: false,
    liveChatTouched: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    autonomousActions: false,
    cases: compareCases,
    summary: {
      ...omitCases(compareSummary),
      requiredCaseCount: REQUIRED_ALIVENESS_SCENARIO_IDS.length,
      requiredCasesPresent: fixtureSummary.requiredCasesPresent,
      missingRequiredCaseIds: fixtureSummary.missingRequiredCaseIds,
      duplicateCaseIds: fixtureSummary.duplicateCaseIds,
      fixtureCaseCount: fixtureSummary.caseCount,
      allFixtureOnly: fixtureSummary.allFixtureOnly,
      runtimeMetricsMeasured: false,
      serverSpawned: false,
      lmStudioCalls: false,
      fixtureSummary,
    },
    metrics: {
      ...compareSummary.metrics,
      measurementStatus: 'not-run',
      liveLatencyMeasured: false,
      livePromptTokensMeasured: false,
    },
    limits: [
      'Fixture-only aliveness compare skeleton; no server spawn and no LM Studio calls.',
      'Cases are A2 scenario fixtures adapted into compare-case records.',
      'Runtime latency and prompt-token metrics are null/not-run until a later live isolated slice.',
      'PromptTruth and toolEvidenceReceipt stay unchanged.',
      'Fixture wins do not justify default feature enablement.',
    ],
  };
}

function writeAlivenessCompareFixtureArtifact({
  outputPath = OUTPUT_PATH,
  artifact = buildAlivenessCompareFixtureArtifact(),
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

function main(argv = process.argv.slice(2)) {
  const args = parseAlivenessCompareArgs(argv);
  if (!args.fixture || args.mode !== 'fixture') {
    throw new Error('A3 aliveness compare runner supports fixture mode only.');
  }
  const generatedAt = new Date().toISOString();
  const artifact = buildAlivenessCompareFixtureArtifact({ generatedAt });
  const result = writeAlivenessCompareFixtureArtifact({
    outputPath: args.outputPath,
    artifact,
  });
  console.log(`Aliveness compare fixture complete: ${result.outputPath}`);
  console.log(JSON.stringify(result.artifact.summary, null, 2));
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

module.exports = {
  ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND,
  buildAlivenessCompareFixtureArtifact,
  buildFixtureCompareCase,
  hasArgFlag,
  main,
  parseAlivenessCompareArgs,
  parseArgValue,
  writeAlivenessCompareFixtureArtifact,
};
