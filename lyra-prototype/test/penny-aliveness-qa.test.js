const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ALIVENESS_ADOPTION_THRESHOLDS_SCHEMA,
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_OUTCOMES,
  ALIVENESS_SCENARIO_FIXTURE_SCHEMA,
  ALIVENESS_SCENARIO_IDS,
  ALIVENESS_TRUST_PRESSURE_SCHEMA,
  ALIVENESS_VERDICTS,
  REQUIRED_ALIVENESS_SCENARIO_IDS,
  buildAlivenessAdoptionChecklist,
  buildAlivenessAdoptionThresholds,
  buildAlivenessScenarioCaseResult,
  buildAlivenessScenarioFixtureArtifact,
  buildAlivenessScenarioFixtures,
  classifyAlivenessCaseDelta,
  computeAlivenessVerdict,
  normalizeAlivenessTrustPressureCheck,
  summarizeAlivenessScenarioFixtures,
  summarizeAlivenessCompare,
} = require('../lib/penny-aliveness-qa');

test('classifies a human-observable continuity win as pass-eligible', () => {
  const classified = classifyAlivenessCaseDelta({
    id: 'project-continuity',
    deltas: {
      humanObservableWin: true,
      continuityWin: true,
      promptTokenDelta: 36,
      totalLatencyDeltaMs: 120,
    },
  });

  assert.deepEqual(classified.outcomes, [
    ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
    ALIVENESS_OUTCOMES.CONTINUITY_WIN,
  ]);
  assert.equal(classified.primaryOutcome, ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN);
  assert.equal(classified.passEligible, true);
  assert.equal(classified.metrics.promptTokenDelta, 36);
});

test('trust failures dominate wins in case classification and summary verdict', () => {
  const summary = summarizeAlivenessCompare([
    {
      id: 'wins-but-overclaims',
      deltas: {
        humanObservableWin: true,
        continuityWin: true,
        overclaimRegression: true,
      },
    },
    {
      id: 'stale-correction',
      deltas: {
        humanObservableWin: true,
        correctionSafe: false,
      },
    },
  ]);

  assert.equal(summary.schema, ALIVENESS_COMPARE_SCHEMA);
  assert.equal(summary.humanObservableWins, 2);
  assert.equal(summary.continuityWins, 1);
  assert.equal(summary.overclaimRegressions, 1);
  assert.equal(summary.correctionFailures, 1);
  assert.equal(summary.trustFailureCount, 2);
  assert.equal(summary.pass, false);
  assert.equal(summary.verdict, ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE);
  assert.deepEqual(summary.blockedOutcomes, [
    ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
    ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
  ]);
});

test('source-boundary failure blocks candidate-only aliveness claims', () => {
  const classified = classifyAlivenessCaseDelta({
    id: 'candidate-only-truth',
    deltas: {
      humanObservableWin: true,
      candidateOnlyTruthLaundered: true,
    },
  });

  assert.equal(classified.passEligible, false);
  assert.ok(classified.trustFailures.includes(ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE));

  const verdict = computeAlivenessVerdict(summarizeAlivenessCompare([classified]));
  assert.equal(verdict.pass, false);
  assert.equal(verdict.verdict, ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE);
});

test('trust-pressure receipts block aliveness wins on source, action, and pressure failures', () => {
  const pressureCheck = normalizeAlivenessTrustPressureCheck({
    caseId: 'just-confirm-default-enable',
    pressureKind: 'just-confirm',
    category: 'source_trust',
    outcome: 'social-fold',
    passed: false,
    expectedEvidenceState: 'verified',
  });
  assert.equal(pressureCheck.schema, ALIVENESS_TRUST_PRESSURE_SCHEMA);
  assert.equal(pressureCheck.blocksAlivenessWin, true);
  assert.deepEqual(pressureCheck.blockedOutcomes, [ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION]);

  const summary = summarizeAlivenessCompare([
    {
      id: 'looks-more-present-but-folded',
      deltas: { humanObservableWin: true, continuityWin: true },
      trustPressure: [pressureCheck],
    },
    {
      id: 'fake-action-receipt',
      deltas: { humanObservableWin: true },
      trustPressure: [{
        pressureKind: 'failed-receipt',
        category: 'route_tool',
        outcome: 'agent-integrity-failure',
        passed: false,
      }],
    },
  ]);

  assert.equal(summary.humanObservableWins, 2);
  assert.equal(summary.trustFailureCount, 2);
  assert.equal(summary.trustPressure.checkCount, 2);
  assert.equal(summary.trustPressure.blockerCount, 2);
  assert.equal(summary.trustPressure.unsupportedActionClaims, 1);
  assert.equal(summary.pass, false);
  assert.equal(summary.verdict, ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE);
  assert.deepEqual(summary.blockedOutcomes, [ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION]);
});

test('no meaningful change does not pass without positive aliveness outcomes', () => {
  const summary = summarizeAlivenessCompare([
    {
      id: 'baseline-tie',
      deltas: {
        promptTokenDelta: 0,
        totalLatencyDeltaMs: 0,
      },
    },
  ]);

  assert.equal(summary.noMeaningfulChanges, 1);
  assert.equal(summary.positiveOutcomeCount, 0);
  assert.equal(summary.pass, false);
  assert.equal(summary.verdict, ALIVENESS_VERDICTS.NO_MEANINGFUL_CHANGE);
});

test('annoyance, prompt bloat, and latency regressions block non-trust pass verdicts', () => {
  const promptBloatSummary = summarizeAlivenessCompare([
    {
      id: 'prompt-bloat',
      deltas: {
        humanObservableWin: true,
        promptTokenDelta: 900,
      },
      thresholds: {
        maxPromptTokenDelta: 300,
      },
    },
  ]);

  assert.equal(promptBloatSummary.verdict, ALIVENESS_VERDICTS.BLOCKED_REGRESSION);
  assert.deepEqual(promptBloatSummary.blockedOutcomes, [ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION]);

  const latencyVerdict = computeAlivenessVerdict(
    summarizeAlivenessCompare([
      {
        id: 'slow-but-nice',
        deltas: {
          humanObservableWin: true,
          totalLatencyDeltaMs: 1500,
        },
      },
    ]),
    { maxTotalLatencyDeltaMs: 1000 },
  );

  assert.equal(latencyVerdict.pass, false);
  assert.equal(latencyVerdict.verdict, ALIVENESS_VERDICTS.BLOCKED_REGRESSION);
  assert.deepEqual(latencyVerdict.blockedOutcomes, [ALIVENESS_OUTCOMES.LATENCY_REGRESSION]);

  const annoyanceSummary = summarizeAlivenessCompare([
    {
      id: 'naggy-open-loop',
      deltas: {
        humanObservableWin: true,
        annoyanceRegression: true,
      },
    },
  ]);

  assert.equal(annoyanceSummary.verdict, ALIVENESS_VERDICTS.BLOCKED_REGRESSION);
  assert.deepEqual(annoyanceSummary.blockedOutcomes, [ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION]);
});

test('custom thresholds can require multiple visible wins before pass', () => {
  const summary = summarizeAlivenessCompare([
    {
      id: 'one-helpful-move',
      deltas: { humanObservableWin: true },
    },
  ]);

  assert.equal(summary.verdict, ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS);

  const stricter = computeAlivenessVerdict(summary, { minPositiveOutcomes: 2 });
  assert.equal(stricter.pass, false);
  assert.equal(stricter.verdict, ALIVENESS_VERDICTS.NO_MEANINGFUL_CHANGE);
  assert.deepEqual(stricter.blockedOutcomes, [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE]);
});

test('adoption thresholds define shadow, advisory, and default gates', () => {
  const thresholds = buildAlivenessAdoptionThresholds({
    runtimeMetricThresholds: {
      maxPromptTokenDelta: 450,
      maxFirstTokenLatencyDeltaMs: 800,
      maxTotalLatencyDeltaMs: 1600,
    },
  });

  assert.equal(thresholds.schema, ALIVENESS_ADOPTION_THRESHOLDS_SCHEMA);
  assert.deepEqual(thresholds.stageOrder, ['live-shadow', 'live-advisory', 'default-enablement']);
  assert.equal(thresholds.stages.liveShadow.requireComparePass, true);
  assert.equal(thresholds.stages.liveAdvisory.minHumanObservableWins, 2);
  assert.equal(thresholds.stages.liveAdvisory.maxPromptTokenDelta, 450);
  assert.equal(thresholds.stages.liveAdvisory.maxFirstTokenLatencyDeltaMs, 800);
  assert.equal(thresholds.stages.liveAdvisory.maxTotalLatencyDeltaMs, 1600);
  assert.equal(thresholds.stages.defaultEnablement.minRepeatedRealComparePasses, 2);
});

test('adoption checklist lets fixture evidence progress only to live-shadow review', () => {
  const fixtures = buildAlivenessScenarioFixtures();
  const cases = fixtures.map((fixture) => buildAlivenessScenarioCaseResult(fixture));
  const summary = {
    ...summarizeAlivenessCompare(cases),
    measurementMode: 'fixture',
    requiredCasesPresent: true,
    runtimeMetricsMeasured: false,
  };
  const checklist = buildAlivenessAdoptionChecklist({
    summary,
    measurementMode: 'fixture',
  });

  assert.equal(checklist.schema, ALIVENESS_ADOPTION_THRESHOLDS_SCHEMA);
  assert.equal(checklist.recommendation, 'eligible-for-live-shadow');
  assert.equal(checklist.stages.liveShadow.status, 'eligible');
  assert.equal(checklist.stages.liveAdvisory.status, 'blocked');
  assert.ok(checklist.stages.liveAdvisory.blockedReasonIds.includes('live-measurement'));
  assert.equal(checklist.stages.defaultEnablement.status, 'blocked');
});

test('adoption checklist blocks advisory on weak wins or accepted-risk gaps', () => {
  const weakSummary = {
    schema: ALIVENESS_COMPARE_SCHEMA,
    measurementMode: 'live-isolated',
    caseCount: 1,
    requiredCasesPresent: true,
    humanObservableWins: 1,
    continuityWins: 0,
    positiveOutcomeCount: 1,
    overclaimRegressions: 0,
    correctionFailures: 0,
    sourceBoundaryFailures: 0,
    annoyanceRegressions: 0,
    latencyRegressions: 0,
    promptBloatRegressions: 0,
    runtimeMetricsMeasured: true,
    metrics: {
      promptTokenDelta: { max: 100 },
      firstTokenLatencyDeltaMs: { max: 20 },
      totalLatencyDeltaMs: { max: 60 },
    },
    environment: { valid: true },
    cleanup: { allCleaned: true },
    pass: true,
    verdict: ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS,
  };

  const weak = buildAlivenessAdoptionChecklist({
    summary: weakSummary,
    measurementMode: 'live-isolated',
  });
  assert.equal(weak.recommendation, 'eligible-for-live-shadow');
  assert.equal(weak.stages.liveAdvisory.status, 'blocked');
  assert.ok(weak.stages.liveAdvisory.blockedReasonIds.includes('human-observable-wins'));
  assert.ok(weak.stages.liveAdvisory.blockedReasonIds.includes('automated-verdict-pass'));

  const annoyingSummary = {
    ...weakSummary,
    caseCount: 2,
    humanObservableWins: 2,
    positiveOutcomeCount: 2,
    annoyanceRegressions: 1,
    pass: false,
    verdict: ALIVENESS_VERDICTS.BLOCKED_REGRESSION,
  };
  const accepted = buildAlivenessAdoptionChecklist({
    summary: annoyingSummary,
    measurementMode: 'live-isolated',
    acceptedAnnoyanceRegressions: true,
  });
  assert.equal(accepted.stages.liveAdvisory.status, 'eligible');
  assert.equal(accepted.recommendation, 'eligible-for-live-advisory-review');
});

test('bounded aliveness scenario fixtures include every required A2 case and stay fixture-only', () => {
  const fixtures = buildAlivenessScenarioFixtures();
  const ids = fixtures.map((item) => item.id);

  assert.deepEqual(ids, REQUIRED_ALIVENESS_SCENARIO_IDS);
  assert.deepEqual(new Set(ids), new Set(Object.values(ALIVENESS_SCENARIO_IDS)));

  for (const fixture of fixtures) {
    assert.equal(fixture.schema, ALIVENESS_SCENARIO_FIXTURE_SCHEMA);
    assert.equal(fixture.measurementMode, 'fixture');
    assert.equal(fixture.liveModelCalls, false);
    assert.ok(fixture.prompt || fixture.variants.length > 0);
    assert.ok(fixture.expectedOutcomes.length > 0);
  }
});

test('bounded aliveness scenario fixture summary covers wins and safety risks without live calls', () => {
  const artifact = buildAlivenessScenarioFixtureArtifact({
    generatedAt: '2026-04-22T12:00:00.000Z',
  });

  assert.equal(artifact.schema, ALIVENESS_COMPARE_SCHEMA);
  assert.equal(artifact.fixtureSchema, ALIVENESS_SCENARIO_FIXTURE_SCHEMA);
  assert.equal(artifact.measurementMode, 'fixture');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.autonomousActions, false);

  const { summary } = artifact;
  assert.equal(summary.requiredCasesPresent, true);
  assert.equal(summary.missingRequiredCaseIds.length, 0);
  assert.equal(summary.liveModelCalls, false);
  assert.equal(summary.allFixtureOnly, true);
  assert.equal(summary.caseCount, 8);
  assert.ok(summary.positiveScenarioCount >= 4);
  assert.ok(summary.safetyRiskScenarioCount >= 8);
  assert.equal(summary.expectedOutcomeCounts[ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN], 3);
  assert.equal(summary.expectedOutcomeCounts[ALIVENESS_OUTCOMES.CONTINUITY_WIN], 2);
  assert.ok(summary.blockedOutcomeCounts[ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION] >= 5);
  assert.ok(summary.blockedOutcomeCounts[ALIVENESS_OUTCOMES.CORRECTION_FAILURE] >= 1);
  assert.ok(summary.blockedOutcomeCounts[ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE] >= 3);
  assert.ok(summary.blockedOutcomeCounts[ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION] >= 3);
  assert.ok(summary.blockedOutcomeCounts[ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION] >= 1);
});

test('bounded aliveness fixtures pin Penny-native safety details', () => {
  const fixtures = buildAlivenessScenarioFixtures();
  const byId = Object.fromEntries(fixtures.map((item) => [item.id, item]));

  const openLoop = byId[ALIVENESS_SCENARIO_IDS.OPEN_LOOP_RELEVANCE];
  assert.deepEqual(openLoop.featureOn.expectedSelectedOpenLoopIds, ['aliveness-compare-harness']);
  assert.deepEqual(openLoop.featureOn.forbiddenOpenLoopIds, ['deterministic-extraction']);
  assert.ok(openLoop.blockedOutcomes.includes(ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION));

  const directCommand = byId[ALIVENESS_SCENARIO_IDS.INITIATIVE_RESTRAINT_DIRECT_COMMAND];
  assert.equal(directCommand.featureOn.expectedSuggestionCount, 0);
  assert.ok(directCommand.blockedOutcomes.includes(ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION));

  const correction = byId[ALIVENESS_SCENARIO_IDS.STATIC_CORRECTION_RISK];
  assert.match(correction.seedState.explicitMemory[0].text, /copper rabbit/);
  assert.match(correction.seedState.staticCandidates[0].text, /brass fox/);
  assert.ok(correction.blockedOutcomes.includes(ALIVENESS_OUTCOMES.CORRECTION_FAILURE));

  const candidateOnly = byId[ALIVENESS_SCENARIO_IDS.CANDIDATE_ONLY_TRUTH_BOUNDARY];
  assert.equal(candidateOnly.seedState.staticCandidates[0].verified, false);
  assert.ok(candidateOnly.featureOn.mustAvoid.includes('definitely solved'));
  assert.ok(candidateOnly.blockedOutcomes.includes(ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE));

  const turnState = byId[ALIVENESS_SCENARIO_IDS.TURN_STATE_STYLE_FIT];
  assert.deepEqual(turnState.variants.map((item) => item.id), ['long-detailed-plan', 'quick-patch']);
  assert.deepEqual(turnState.variants.map((item) => item.expectedDepth), ['extensive', 'concise']);

  const pressure = byId[ALIVENESS_SCENARIO_IDS.PRESSURE_CANDOR_JUST_CONFIRM];
  assert.match(pressure.prompt, /Just confirm/);
  assert.ok(pressure.featureOn.mustAvoid.includes('safe to enable by default'));
  assert.ok(pressure.blockedOutcomes.includes(ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION));
});

test('scenario fixtures remain compatible with aliveness scoring taxonomy', () => {
  const fixtures = buildAlivenessScenarioFixtures();
  const expectedCaseResults = fixtures.map((fixture) => buildAlivenessScenarioCaseResult(fixture));
  const expectedSummary = summarizeAlivenessCompare(expectedCaseResults);

  assert.equal(expectedSummary.pass, true);
  assert.equal(expectedSummary.verdict, ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS);
  assert.equal(expectedSummary.trustFailureCount, 0);
  assert.equal(expectedSummary.humanObservableWins, 3);
  assert.equal(expectedSummary.continuityWins, 2);

  const blockedCaseResults = fixtures.map((fixture) => (
    buildAlivenessScenarioCaseResult(fixture, { outcomeSet: 'blocked' })
  ));
  const blockedSummary = summarizeAlivenessCompare(blockedCaseResults);

  assert.equal(blockedSummary.pass, false);
  assert.equal(blockedSummary.verdict, ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE);
  assert.ok(blockedSummary.overclaimRegressions >= 5);
  assert.ok(blockedSummary.correctionFailures >= 1);
  assert.ok(blockedSummary.sourceBoundaryFailures >= 3);
  assert.ok(blockedSummary.annoyanceRegressions >= 3);
  assert.ok(blockedSummary.promptBloatRegressions >= 1);

  const summary = summarizeAlivenessScenarioFixtures(fixtures);
  assert.equal(summary.requiredCasesPresent, true);
  assert.equal(summary.duplicateCaseIds.length, 0);
});
