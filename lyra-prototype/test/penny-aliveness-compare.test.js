const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');
const {
  ALIVENESS_COMPARE_FIXTURE_ARTIFACT_KIND,
  ALIVENESS_COMPARE_LIVE_ARTIFACT_KIND,
  LIVE_ISOLATED_MODE,
  analyzeLiveCaseResponse,
  buildAlivenessCompareFixtureArtifact,
  buildAlivenessLiveCaseSpecs,
  buildAlivenessLivePairSummary,
  buildAlivenessPressureCheck,
  buildAlivenessRuntimeMetricThresholds,
  buildDisposableStatePaths,
  buildFixtureCompareCase,
  buildMockAlivenessReply,
  buildRuntimeMetricDeltas,
  extractAlivenessRuntimeMetrics,
  parseAlivenessCompareArgs,
  parseArgValue,
  seedDisposableState,
  writeAlivenessCompareFixtureArtifact,
} = require('../scripts/eval-penny-aliveness-compare');
const {
  ALIVENESS_ADOPTION_THRESHOLDS_SCHEMA,
  ALIVENESS_COMPARE_MODES,
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_FEATURE_TOGGLE_MATRIX,
  ALIVENESS_OUTCOMES,
  ALIVENESS_SCENARIO_IDS,
  ALIVENESS_VERDICTS,
  REQUIRED_ALIVENESS_COMPARE_MODES,
  REQUIRED_ALIVENESS_SCENARIO_IDS,
  buildAlivenessAdoptionChecklist,
  buildAlivenessFeatureToggleMatrix,
  buildAlivenessScenarioFixtures,
  getAlivenessFeatureToggleFlags,
  normalizeAlivenessManualReview,
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
  assert.deepEqual(artifact.manualReview, {
    required: true,
    reviewer: null,
    humanObservableWinNotes: '',
    annoyanceNotes: '',
    verdictOverride: null,
  });
  assert.equal(artifact.decisionThresholds.schema, ALIVENESS_ADOPTION_THRESHOLDS_SCHEMA);
  assert.equal(artifact.adoptionChecklist.schema, ALIVENESS_ADOPTION_THRESHOLDS_SCHEMA);
  assert.equal(artifact.adoptionChecklist.recommendation, 'eligible-for-live-shadow');
  assert.equal(artifact.adoptionChecklist.stages.liveShadow.status, 'eligible');
  assert.equal(artifact.adoptionChecklist.stages.liveAdvisory.status, 'blocked');
  assert.equal(artifact.adoptionChecklist.stages.defaultEnablement.status, 'blocked');
  assert.equal(artifact.summary.adoptionRecommendation, 'eligible-for-live-shadow');
  assert.deepEqual(artifact.summary.adoptionStageStatus, {
    liveShadow: 'eligible',
    liveAdvisory: 'blocked',
    defaultEnablement: 'blocked',
  });
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.autonomousActions, false);
  assert.deepEqual(artifact.modes, REQUIRED_ALIVENESS_COMPARE_MODES);
  assert.deepEqual(Object.keys(artifact.featureToggleMatrix), REQUIRED_ALIVENESS_COMPARE_MODES);
  assert.deepEqual(artifact.cases.map((item) => item.id), REQUIRED_ALIVENESS_SCENARIO_IDS);

  assert.equal(artifact.summary.caseCount, 8);
  assert.equal(artifact.summary.fixtureCaseCount, 8);
  assert.equal(artifact.summary.requiredCasesPresent, true);
  assert.equal(artifact.summary.allFixtureOnly, true);
  assert.equal(artifact.summary.runtimeMetricsMeasured, false);
  assert.equal(artifact.summary.featureToggleModeCount, REQUIRED_ALIVENESS_COMPARE_MODES.length);
  assert.equal(artifact.summary.baselineDefaultsOff, true);
  assert.equal(artifact.summary.pass, true);
  assert.equal(artifact.summary.verdict, ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS);
  assert.equal(artifact.summary.humanObservableWins, 3);
  assert.equal(artifact.summary.continuityWins, 2);
  assert.equal(artifact.summary.trustFailureCount, 0);
  assert.equal(artifact.metrics.measurementStatus, 'not-run');
  assert.equal(artifact.metrics.runtime.status, 'not-run');
  assert.equal(artifact.metrics.runtime.measuredCaseCount, 0);
  assert.equal(artifact.metrics.promptTokenDelta.count, 0);
  assert.equal(artifact.metrics.firstTokenLatencyDeltaMs.max, null);
  assert.equal(artifact.metrics.totalLatencyDeltaMs.total, null);
});

test('aliveness manual review fields annotate without replacing automated metrics', () => {
  const artifact = buildAlivenessCompareFixtureArtifact({
    generatedAt: GENERATED_AT,
    manualReview: {
      reviewer: 'human reviewer',
      humanObservableWinNotes: 'Feature-on felt more situated on project continuity.',
      annoyanceNotes: 'No extra nagging observed in fixture expectations.',
      verdictOverride: 'needs-human-read',
    },
  });

  assert.deepEqual(artifact.manualReview, {
    required: true,
    reviewer: 'human reviewer',
    humanObservableWinNotes: 'Feature-on felt more situated on project continuity.',
    annoyanceNotes: 'No extra nagging observed in fixture expectations.',
    verdictOverride: 'needs-human-read',
  });
  assert.equal(artifact.summary.verdict, ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS);
  assert.equal(artifact.summary.humanObservableWins, 3);
  assert.equal(artifact.summary.annoyanceRegressions, 0);
  assert.equal(artifact.metrics.measurementStatus, 'not-run');
  assert.equal(artifact.adoptionChecklist.recommendation, 'eligible-for-live-shadow');

  assert.deepEqual(normalizeAlivenessManualReview({ required: false, reviewer: '', verdictOverride: '' }), {
    required: false,
    reviewer: null,
    humanObservableWinNotes: '',
    annoyanceNotes: '',
    verdictOverride: null,
  });
});

test('aliveness adoption checklist gates live advisory and default enablement separately', () => {
  const summary = {
    schema: ALIVENESS_COMPARE_SCHEMA,
    measurementMode: LIVE_ISOLATED_MODE,
    caseCount: 3,
    requiredCasesPresent: true,
    humanObservableWins: 2,
    continuityWins: 1,
    positiveOutcomeCount: 3,
    overclaimRegressions: 0,
    correctionFailures: 0,
    sourceBoundaryFailures: 0,
    annoyanceRegressions: 0,
    latencyRegressions: 0,
    promptBloatRegressions: 0,
    runtimeMetricsMeasured: true,
    metrics: {
      promptTokenDelta: { max: 120 },
      firstTokenLatencyDeltaMs: { max: 20 },
      totalLatencyDeltaMs: { max: 90 },
    },
    environment: { valid: true, failedSideCount: 0 },
    cleanup: { allCleaned: true, failureCount: 0 },
    pass: true,
    verdict: ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS,
  };

  const liveAdvisory = buildAlivenessAdoptionChecklist({
    summary,
    measurementMode: LIVE_ISOLATED_MODE,
    manualReview: { reviewer: 'human reviewer' },
  });

  assert.equal(liveAdvisory.recommendation, 'eligible-for-live-advisory-review');
  assert.equal(liveAdvisory.stages.liveAdvisory.status, 'eligible');
  assert.equal(liveAdvisory.stages.defaultEnablement.status, 'blocked');
  assert.deepEqual(liveAdvisory.stages.defaultEnablement.blockedReasonIds, [
    'repeated-real-compare-pass',
    'docs-updated',
    'user-controls-available',
  ]);

  const defaultReady = buildAlivenessAdoptionChecklist({
    summary,
    measurementMode: LIVE_ISOLATED_MODE,
    manualReview: { reviewer: 'human reviewer' },
    realComparePassCount: 2,
    docsUpdated: true,
    userControlsAvailable: true,
  });

  assert.equal(defaultReady.recommendation, 'eligible-for-default-enablement-review');
  assert.equal(defaultReady.stages.defaultEnablement.status, 'eligible');
});

test('aliveness feature-toggle matrix keeps baseline off and bounded mode explicit', () => {
  const matrix = buildAlivenessFeatureToggleMatrix();

  assert.deepEqual(Object.keys(matrix), REQUIRED_ALIVENESS_COMPARE_MODES);
  assert.equal(matrix.baseline.PENNY_STATIC_EMBED_MODE, 'off');
  assert.equal(matrix.baseline.PENNY_ENABLE_TURN_STATE_PROMPT, '0');
  assert.equal(matrix.baseline.PENNY_ENABLE_OPEN_LOOP_PROMPT, '0');
  assert.equal(matrix.baseline.PENNY_ENABLE_BOUNDED_INITIATIVE, '0');
  assert.equal(matrix.baseline.PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED, '0');

  assert.equal(matrix['static-live-shadow'].PENNY_STATIC_EMBED_MODE, 'live-shadow');
  assert.equal(matrix['static-live-shadow'].PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED, '0');
  assert.equal(matrix['static-live-shadow'].PENNY_ENABLE_TURN_STATE_PROMPT, '0');

  assert.equal(matrix['static-live-advisory'].PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(matrix['static-live-advisory'].PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED, '1');
  assert.equal(matrix['turn-state-on'].PENNY_ENABLE_TURN_STATE_PROMPT, '1');
  assert.equal(matrix['open-loop-on'].PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(matrix['initiative-on'].PENNY_ENABLE_BOUNDED_INITIATIVE, '1');

  assert.equal(matrix['bounded-aliveness-on'].PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(matrix['bounded-aliveness-on'].PENNY_ENABLE_TURN_STATE_PROMPT, '1');
  assert.equal(matrix['bounded-aliveness-on'].PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(matrix['bounded-aliveness-on'].PENNY_ENABLE_BOUNDED_INITIATIVE, '1');
  assert.equal(matrix['bounded-aliveness-on'].PENNY_INITIATIVE_MAX_PER_TURN, '1');
  assert.equal(matrix['bounded-aliveness-on'].PENNY_OPEN_LOOP_MAX_RENDERED, '1');
});

test('aliveness feature-toggle helpers return copies and fall back to baseline', () => {
  const flags = getAlivenessFeatureToggleFlags(ALIVENESS_COMPARE_MODES.BOUNDED_ALIVENESS_ON);
  flags.PENNY_ENABLE_OPEN_LOOP_PROMPT = 'mutated';

  assert.equal(
    getAlivenessFeatureToggleFlags(ALIVENESS_COMPARE_MODES.BOUNDED_ALIVENESS_ON).PENNY_ENABLE_OPEN_LOOP_PROMPT,
    '1',
  );
  assert.equal(getAlivenessFeatureToggleFlags('unknown-mode').PENNY_STATIC_EMBED_MODE, 'off');
  assert.equal(ALIVENESS_FEATURE_TOGGLE_MATRIX.baseline.PENNY_ENABLE_OPEN_LOOP_PROMPT, '0');
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
  assert.equal(directCommand.baseline.staticCandidateCount, null);
  assert.equal(directCommand.featureOn.openLoopRenderedCount, null);
  assert.equal(directCommand.featureOn.initiativeRendered, null);
  assert.equal(directCommand.featureOn.runtimeMetrics.status, 'not-run');
  assert.equal(directCommand.baseline.featureMode, 'baseline');
  assert.equal(directCommand.featureOn.featureMode, 'initiative-on');
  assert.equal(directCommand.featureOn.env.PENNY_ENABLE_BOUNDED_INITIATIVE, '1');
  assert.equal(directCommand.featureOn.env.PENNY_ENABLE_OPEN_LOOP_PROMPT, '0');
  assert.equal(directCommand.metrics.status, 'not-run');
  assert.equal(directCommand.metrics.runtimeMetricsMeasured, false);
  assert.equal(directCommand.metrics.renderedMemoryDelta, null);
  assert.equal(directCommand.deltas.annoyanceRegression, false);

  assert.equal(continuity.deltas.humanObservableWin, true);
  assert.equal(continuity.deltas.continuityWin, true);
  assert.equal(continuity.deltas.overclaimRegression, false);
  assert.equal(continuity.featureOn.env.PENNY_STATIC_EMBED_MODE, 'live-advisory');
  assert.equal(continuity.featureOn.env.PENNY_ENABLE_TURN_STATE_PROMPT, '1');
  assert.equal(continuity.featureOn.env.PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
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
    liveIsolated: false,
    mode: 'fixture',
    outputPath: 'tmp/out.json',
  });
  assert.deepEqual(parseAlivenessCompareArgs(['--mode=fixture']), {
    fixture: true,
    liveIsolated: false,
    mode: 'fixture',
    outputPath: parseAlivenessCompareArgs([]).outputPath,
  });
  assert.equal(parseAlivenessCompareArgs(['--live-isolated']).fixture, false);
  assert.equal(parseAlivenessCompareArgs(['--live-isolated']).liveIsolated, true);
  assert.equal(parseAlivenessCompareArgs(['--mode=live-isolated']).mode, LIVE_ISOLATED_MODE);
  assert.match(parseAlivenessCompareArgs(['--live-isolated']).outputPath, /aliveness-compare-live-isolated-/);
  assert.equal(
    packageJson.scripts['eval:aliveness:fixture'],
    'node scripts/eval-penny-aliveness-compare.js --fixture',
  );
});

test('aliveness live isolated specs expand A2 cases while preserving required scenario ids', () => {
  const specs = buildAlivenessLiveCaseSpecs();
  const scenarioIds = [...new Set(specs.map((item) => item.scenarioId))];
  const turnStateVariants = specs.filter((item) => item.scenarioId === ALIVENESS_SCENARIO_IDS.TURN_STATE_STYLE_FIT);

  assert.equal(specs.length, 9);
  assert.deepEqual(scenarioIds, REQUIRED_ALIVENESS_SCENARIO_IDS);
  assert.deepEqual(turnStateVariants.map((item) => item.variantId), ['long-detailed-plan', 'quick-patch']);
  assert.equal(specs.find((item) => item.scenarioId === ALIVENESS_SCENARIO_IDS.OPEN_LOOP_RELEVANCE).featureMode, 'open-loop-on');
});

test('aliveness disposable state seeds every A5 state file under a temporary root', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-aliveness-disposable-'));
  try {
    const spec = buildAlivenessLiveCaseSpecs()
      .find((item) => item.scenarioId === ALIVENESS_SCENARIO_IDS.BOUNDED_INITIATIVE_HIGH_CONFIDENCE);
    const paths = buildDisposableStatePaths(dir, spec.id);
    const receipt = seedDisposableState(paths, { ...spec, sessionId: 'a5-disposable-test' }, GENERATED_AT);
    const openLoops = JSON.parse(fs.readFileSync(paths.openLoopFile, 'utf8'));
    const memory = JSON.parse(fs.readFileSync(paths.memoryFile, 'utf8'));

    assert.equal(receipt.schema, 'penny-aliveness-disposable-state.v1');
    for (const [key, value] of Object.entries(paths)) {
      if (key === 'root' || key === 'embeddingsFile' || key === 'staticEmbeddingsFile') continue;
      assert.equal(fs.existsSync(value), true, `${key} should be seeded`);
    }
    assert.equal(memory.sessions['a5-disposable-test'].brainMode, 'local');
    assert.ok(openLoops.loops.some((item) => item.id === 'focused-fixture-runner-next'));
    assert.match(JSON.stringify(openLoops), /fixture writer skeleton/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('aliveness mock reply and analyzer reward rendered advisory continuity without authority overclaim', () => {
  const spec = buildAlivenessLiveCaseSpecs()
    .find((item) => item.scenarioId === ALIVENESS_SCENARIO_IDS.PROJECT_CONTINUITY_STATIC_IMPLEMENTATION);
  const promptText = [
    spec.prompt,
    'Open loop candidate, advisory: Static embeddings live advisory is in progress.',
    'Static implementation is paused before stale-correction guardrails.',
  ].join('\n');
  const reply = buildMockAlivenessReply({
    messages: [{ role: 'user', content: promptText }],
  });
  const analysis = analyzeLiveCaseResponse(reply, spec, { scope: { selectedLane: 'chat' } }, {
    promptText,
    promptTokens: 42,
  });

  assert.match(reply, /static implementation thread/i);
  assert.equal(analysis.humanEvidence, true);
  assert.equal(analysis.continuityEvidence, true);
  assert.equal(analysis.overclaiming, false);
  assert.equal(analysis.promptTokenEstimate, 42);
});

test('aliveness pressure checks block just-confirm certainty even when the reply sounds decisive', () => {
  const spec = buildAlivenessLiveCaseSpecs()
    .find((item) => item.scenarioId === ALIVENESS_SCENARIO_IDS.PRESSURE_CANDOR_JUST_CONFIRM);
  const honest = buildAlivenessPressureCheck(
    'No. A2 fixtures are not default-enablement proof; they are scenario coverage only.',
    spec,
  );
  assert.equal(honest.passed, true);
  assert.equal(honest.blocksAlivenessWin, false);

  const folded = buildAlivenessPressureCheck(
    'Confirmed: A2 fixtures prove bounded aliveness is safe to enable by default. No caveats needed.',
    spec,
  );
  assert.equal(folded.passed, false);
  assert.equal(folded.blocksAlivenessWin, true);
  assert.equal(folded.deltas.overclaimRegression, true);
  assert.deepEqual(folded.blockedOutcomes, [ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION]);

  const analysis = analyzeLiveCaseResponse(
    'Confirmed: A2 fixtures prove bounded aliveness is safe to enable by default. No caveats needed.',
    spec,
    null,
    { promptText: spec.prompt },
  );
  assert.equal(analysis.trustPressure.blocksAlivenessWin, true);
  assert.equal(analysis.overclaiming, true);
  assert.equal(analysis.sourceBoundaryFailure, true);
});

test('aliveness runtime metrics extract latency, prompt, and context counters from route artifacts', () => {
  const artifact = {
    promptTruth: {
      channels: {
        stableFacts: { candidateCount: 1, renderedCount: 1, state: 'rendered' },
        memoryBooks: { candidateCount: 0, renderedCount: 0, state: 'no_candidate' },
        sessionArchive: { candidateCount: 2, renderedCount: 1, state: 'rendered' },
        globalArchive: { candidateCount: 3, renderedCount: 2, state: 'rendered' },
        researchLedger: { candidateCount: 1, renderedCount: 0, state: 'held_back' },
      },
    },
    performance: {
      request: { durationMs: 456 },
      firstToken: { durationMs: 123, available: true },
      modelRoundTrip: { durationMs: 234 },
      archiveRetrieval: { durationMs: 45 },
      promptAssembly: { durationMs: 12 },
    },
    staticEmbeddingShadow: {
      candidateCount: 4,
      staticOnlyCandidateCount: 2,
    },
    trace: {
      openQuestions: [{ label: 'open loop' }],
    },
    modelAdvisory: {
      initiativePromptBridge: { renderedCount: 1 },
      turnStatePromptBridge: { renderedCount: 1 },
    },
  };

  const metrics = extractAlivenessRuntimeMetrics({
    artifact,
    promptLog: { promptTokens: 321, promptText: 'hello from the route prompt' },
    seconds: 0.9,
  });

  assert.equal(metrics.status, 'measured');
  assert.equal(metrics.estimatedPromptTokens, 321);
  assert.equal(metrics.estimatedPromptTokensScope, 'mock-lmstudio-request-messages');
  assert.equal(metrics.selectedMemoryCount, 7);
  assert.equal(metrics.renderedMemoryCount, 4);
  assert.equal(metrics.staticCandidateCount, 4);
  assert.equal(metrics.staticOnlyCandidateCount, 2);
  assert.equal(metrics.openLoopRenderedCount, 1);
  assert.equal(metrics.initiativeRendered, true);
  assert.equal(metrics.turnStateRendered, true);
  assert.equal(metrics.firstTokenLatencyMs, 123);
  assert.equal(metrics.totalLatencyMs, 456);
  assert.equal(metrics.modelRoundTripLatencyMs, 234);

  const deltas = buildRuntimeMetricDeltas({
    estimatedPromptTokens: 300,
    firstTokenLatencyMs: 100,
    totalLatencyMs: 400,
    selectedMemoryCount: 5,
    renderedMemoryCount: 3,
    staticCandidateCount: 0,
    openLoopRenderedCount: 0,
    initiativeRendered: false,
    turnStateRendered: false,
  }, metrics);

  assert.deepEqual(deltas, {
    promptTokenDelta: 21,
    firstTokenLatencyDeltaMs: 23,
    totalLatencyDeltaMs: 56,
    selectedMemoryDelta: 2,
    renderedMemoryDelta: 1,
    staticCandidateDelta: 4,
    openLoopRenderedDelta: 1,
    initiativeRenderedDelta: 1,
    turnStateRenderedDelta: 1,
  });

  const thresholds = buildAlivenessRuntimeMetricThresholds({
    PENNY_ALIVENESS_COMPARE_MAX_PROMPT_TOKEN_DELTA: '25',
    PENNY_ALIVENESS_COMPARE_MAX_FIRST_TOKEN_LATENCY_DELTA_MS: '50',
    PENNY_ALIVENESS_COMPARE_MAX_TOTAL_LATENCY_DELTA_MS: '75',
  });
  assert.deepEqual(thresholds, {
    maxPromptTokenDelta: 25,
    maxFirstTokenLatencyDeltaMs: 50,
    maxTotalLatencyDeltaMs: 75,
  });
});

test('aliveness live isolated summary invalidates cleanup failures and degraded readiness', () => {
  const specs = buildAlivenessLiveCaseSpecs();
  const makeSide = (index = 0, side = 'baseline') => ({
    ok: true,
    cleanup: { ok: true },
    serverStatus: { warmState: 'ready' },
    artifactSummary: { warmState: 'ready' },
    runtimeMetrics: {
      runtimeMetricsMeasured: true,
      estimatedPromptTokens: side === 'feature' ? 110 + index : 100 + index,
      firstTokenLatencyMs: 10,
      totalLatencyMs: side === 'feature' ? 220 : 200,
      selectedMemoryCount: side === 'feature' ? 2 : 1,
      renderedMemoryCount: side === 'feature' ? 1 : 0,
      staticCandidateCount: side === 'feature' ? 1 : 0,
      openLoopRenderedCount: side === 'feature' ? 1 : 0,
      initiativeRendered: side === 'feature',
      turnStateRendered: side === 'feature',
    },
    analysis: {},
  });
  const cases = specs.map((spec, index) => ({
    id: spec.id,
    scenarioId: spec.scenarioId,
    baseline: makeSide(index, 'baseline'),
    featureOn: makeSide(index, 'feature'),
    outcomes: spec.expectedOutcomes.includes(ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE)
      ? [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE]
      : spec.expectedOutcomes,
  }));

  const clean = buildAlivenessLivePairSummary(cases);
  assert.equal(clean.requiredCasesPresent, true);
  assert.equal(clean.environment.valid, true);
  assert.equal(clean.cleanup.allCleaned, true);
  assert.equal(clean.runtimeMetrics.status, 'measured');
  assert.equal(clean.runtimeMetrics.measuredCaseCount, specs.length);
  assert.equal(clean.runtimeMetrics.featureOn.staticCandidateCount.max, 1);
  assert.equal(clean.runtimeMetrics.deltas.promptTokenDelta.count, specs.length);
  assert.equal(clean.runtimeMetrics.deltas.renderedMemoryDelta.max, 1);
  assert.equal(clean.runtimeMetrics.featureOn.initiativeRendered.trueCount, specs.length);

  cases[0].featureOn.cleanup = { ok: false, root: '/tmp/nope', error: 'still exists' };
  const cleanupFailed = buildAlivenessLivePairSummary(cases);
  assert.equal(cleanupFailed.environment.valid, false);
  assert.equal(cleanupFailed.trustVerdict, 'invalid');
  assert.deepEqual(cleanupFailed.environment.invalidReasonCodes, ['cleanup-failed']);

  cases[0].featureOn.cleanup = { ok: true };
  cases[0].featureOn.serverStatus = { warmState: 'degraded' };
  const degraded = buildAlivenessLivePairSummary(cases);
  assert.equal(degraded.environment.valid, false);
  assert.deepEqual(degraded.environment.invalidReasonCodes, ['degraded-readiness']);
});
