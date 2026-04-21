const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CONTEXT_PRESSURE_QA_SCHEMA,
  SOURCE_SENSITIVE_OUTCOME_DEFINITIONS,
  SOURCE_SENSITIVE_OUTCOMES,
  SOURCE_SENSITIVE_MEMORY_CASES,
  buildContextPressureQaArtifact,
  buildSourceSensitiveMemoryQaFixture,
  classifyContextPressureDrift,
  classifySourceSensitiveMemoryOutcome,
  estimatePromptTokens,
  extractRuntimeContextMetrics,
} = require('../lib/penny-context-pressure-qa');

test('context-pressure fixture compares short, medium, and long rendered context without live-latency claims', () => {
  const artifact = buildContextPressureQaArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    defaults: {
      chatModel: 'q6',
      toolModel: 'e4b',
      embedModel: 'nomic',
    },
  });

  assert.equal(artifact.schema, CONTEXT_PRESSURE_QA_SCHEMA);
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.liveAnswerDriftMeasured, false);
  assert.deepEqual(artifact.contextVariants.map((variant) => variant.level), ['short', 'medium', 'long']);
  assert.ok(artifact.contextVariants[0].estimatedPromptTokens < artifact.contextVariants[1].estimatedPromptTokens);
  assert.ok(artifact.contextVariants[1].estimatedPromptTokens < artifact.contextVariants[2].estimatedPromptTokens);
  assert.equal(artifact.contextVariants[1].estimatedPromptTokensScope, 'fixture-prompt-plus-rendered-context-text');
  assert.deepEqual(artifact.contextVariants.map((variant) => variant.renderedMemoryCount), [1, 3, 7]);
  assert.equal(artifact.contextVariants[0].firstTokenLatencyMs, null);
  assert.equal(artifact.contextVariants[0].semanticReadiness.ready, null);
  assert.equal(artifact.contextVariants[1].semanticReadiness.ready, null);
  assert.equal(artifact.contextVariants[1].semanticReadiness.mode, 'fixture-assumed-ready');
  assert.equal(artifact.contextVariants[2].answerDrift.classification, 'not-run');
  assert.equal(artifact.comparisons[0].from, 'short');
  assert.equal(artifact.comparisons[0].to, 'medium');
  assert.equal(artifact.comparisons[0].answerDrift, 'not-run');
  assert.equal(artifact.candidateSurvivalCorrelation.measurementMode, 'fixture-only');
  assert.equal(artifact.candidateSurvivalCorrelation.liveModelCalls, false);
  assert.equal(artifact.candidateSurvivalCorrelation.liveAnswerDriftMeasured, false);
  assert.equal(artifact.candidateSurvivalCorrelation.candidateSurvival.comparisonState, 'not-run');
  assert.equal(artifact.candidateSurvivalCorrelation.contextPressure.answerDrift, 'not-run');
  assert.equal(artifact.candidateSurvivalCorrelation.contextPressure.renderedMemoryCountDelta, 0);
  assert.equal(artifact.candidateSurvivalCorrelation.contextPressure.estimatedPromptTokenDelta, 0);
  assert.equal(artifact.candidateSurvivalCorrelation.contextPressure.promptBloatInferred, false);
  assert.equal(artifact.candidateSurvivalCorrelation.latency.firstTokenLatencyDeltaMs, null);
  assert.equal(artifact.candidateSurvivalCorrelation.latency.totalLatencyDeltaMs, null);
  assert.equal(artifact.sourceSensitiveMemory.cases.length >= 4, true);
});

test('context-pressure fixture can attach archive-unit candidate survival profile correlation', () => {
  const artifact = buildContextPressureQaArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    candidateSurvivalArtifact: {
      measurementMode: 'archive-unit',
      liveModelCalls: false,
      cases: [
        {
          id: 'archive-coding-mascot-correction',
          profileComparison: {
            baseline: { bestRank: 3, selected: false, rendered: false },
            hybridV1: { bestRank: 1, selected: true, rendered: true },
            renderedCountDelta: 0,
            verdict: 'hybrid-ranked-better',
          },
        },
      ],
    },
  });

  const correlation = artifact.candidateSurvivalCorrelation;
  assert.equal(correlation.measurementMode, 'archive-unit');
  assert.equal(correlation.liveModelCalls, false);
  assert.equal(correlation.liveAnswerDriftMeasured, false);
  assert.equal(correlation.candidateSurvival.expectedObjectBestRankBefore, 3);
  assert.equal(correlation.candidateSurvival.expectedObjectBestRankAfter, 1);
  assert.equal(correlation.candidateSurvival.selectedBefore, 0);
  assert.equal(correlation.candidateSurvival.selectedAfter, 1);
  assert.equal(correlation.candidateSurvival.renderedBefore, 0);
  assert.equal(correlation.candidateSurvival.renderedAfter, 1);
  assert.deepEqual(correlation.candidateSurvival.improvedCaseIds, ['archive-coding-mascot-correction']);
  assert.equal(correlation.candidateSurvival.selectionVerdict, 'improved-without-rendered-count-growth');
  assert.equal(correlation.contextPressure.renderedMemoryCountDelta, 0);
  assert.equal(correlation.contextPressure.estimatedPromptTokenDelta, null);
  assert.equal(correlation.contextPressure.estimatedPromptTokenDeltaMode, 'not-measured-in-archive-unit-profile-comparison');
  assert.equal(correlation.contextPressure.promptBloatInferred, false);
  assert.equal(correlation.contextPressure.answerDrift, 'not-run');
  assert.equal(correlation.latency.firstTokenLatencyDeltaMs, null);
  assert.equal(correlation.latency.totalLatencyDeltaMs, null);
});

test('source-sensitive memory fixture separates subject relation object source and surface wording', () => {
  const fixture = buildSourceSensitiveMemoryQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
    defaults: { chatModel: 'q6', toolModel: 'e4b', embedModel: 'nomic' },
  });
  const semanticCase = fixture.cases.find((item) => item.id === 'semantic-candidate-not-canonical');
  const absentCase = fixture.cases.find((item) => item.id === 'fabricated-absent-tail-fact');

  assert.ok(semanticCase);
  assert.equal(semanticCase.subject, 'laundromat dryer three');
  assert.equal(semanticCase.relation, 'object sitting on top');
  assert.equal(semanticCase.object, 'silver thermos');
  assert.equal(semanticCase.source.supportState, 'candidate-only');
  assert.equal(semanticCase.expectedClassifierOutcome, SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED);
  assert.equal(semanticCase.passingAnswerOutcomes.includes(SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED), false);
  assert.deepEqual(semanticCase.diagnosticAnswerOutcomes, [SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED]);
  assert.equal(fixture.outcomeDefinitions[SOURCE_SENSITIVE_OUTCOMES.VERIFIED], SOURCE_SENSITIVE_OUTCOME_DEFINITIONS[SOURCE_SENSITIVE_OUTCOMES.VERIFIED]);
  assert.match(fixture.outcomeDefinitions[SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED], /diagnostic/);
  assert.equal(semanticCase.retrievalExpectation.owner, 'archive-candidate');
  assert.equal(semanticCase.retrievalExpectation.shouldRender, false);
  assert.ok(Array.isArray(semanticCase.surfaceWording));
  assert.equal(absentCase.source.supportState, 'absent');
  assert.equal(absentCase.retrievalExpectation.owner, 'none');
  assert.deepEqual(absentCase.retrievalExpectation.allowedSurvivalOutcomes, ['missing']);
  assert.deepEqual(absentCase.passingAnswerOutcomes, [
    SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED,
    SOURCE_SENSITIVE_OUTCOMES.UNKNOWN,
  ]);
  assert.equal(fixture.outcomeClasses.includes(SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED), true);
});

test('source-sensitive cases bind retrieval expectations separately from answer outcomes', () => {
  const fixture = buildSourceSensitiveMemoryQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });
  assert.equal(SOURCE_SENSITIVE_MEMORY_CASES.length, fixture.cases.length);
  assert.equal(fixture.cases.every((item) => (
    item.retrievalExpectation
      && item.retrievalExpectation.owner
      && Number.isInteger(item.retrievalExpectation.survivalAtK)
      && Array.isArray(item.retrievalExpectation.allowedSurvivalOutcomes)
      && Array.isArray(item.retrievalExpectation.forbiddenOutcomes)
      && Array.isArray(item.passingAnswerOutcomes)
      && Array.isArray(item.diagnosticAnswerOutcomes)
      && Array.isArray(item.failingAnswerOutcomes)
  )), true);

  const byId = new Map(fixture.cases.map((item) => [item.id, item]));
  assert.equal(
    byId.get('semantic-candidate-not-canonical').passingAnswerOutcomes.includes(SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED),
    false,
  );
  assert.deepEqual(
    byId.get('semantic-candidate-not-canonical').diagnosticAnswerOutcomes,
    [SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED],
  );
  assert.deepEqual(
    byId.get('fabricated-absent-tail-fact').retrievalExpectation.allowedSurvivalOutcomes,
    ['missing'],
  );
  assert.equal(
    byId.get('explicit-current-preference').passingAnswerOutcomes.includes(SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED),
    true,
  );
});

test('source-sensitive outcome classifier distinguishes support and abstention classes', () => {
  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'Your favorite tea is lapsang souchong.',
    object: 'lapsang souchong',
    supportState: 'verified',
  }), SOURCE_SENSITIVE_OUTCOMES.VERIFIED);

  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'The silver thermos was on dryer three.',
    object: 'silver thermos',
    supportState: 'candidate-only',
  }), SOURCE_SENSITIVE_OUTCOMES.CORRECT_BUT_UNSUPPORTED);

  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'Small correction: it is lapsang souchong now, not oolong.',
    object: 'lapsang souchong',
    forbiddenObjects: ['oolong'],
    falsePremiseObjects: ['oolong'],
    supportState: 'verified',
    expectsPremiseRepair: true,
  }), SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED);

  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'Your favorite tea is oolong.',
    object: 'lapsang souchong',
    forbiddenObjects: ['oolong'],
    falsePremiseObjects: ['oolong'],
    supportState: 'verified',
    expectsPremiseRepair: true,
  }), SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED);

  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'I cannot verify that from memory yet.',
    object: 'aurora-17',
    supportState: 'absent',
  }), SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED);

  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'I do not know.',
    object: 'aurora-17',
    supportState: 'unknown',
  }), SOURCE_SENSITIVE_OUTCOMES.UNKNOWN);

  assert.equal(classifySourceSensitiveMemoryOutcome({
    answerText: 'The constellation password was aurora-17.',
    object: 'aurora-17',
    supportState: 'absent',
  }), SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED);
});

test('false-premise repair can name stale objects when explicitly rejecting them', () => {
  const repairTexts = [
    'Not oolong anymore; it is lapsang souchong.',
    'Not oolong now; it is lapsang souchong.',
    'No longer oolong; it is lapsang souchong.',
    'It is lapsang souchong instead of oolong.',
    'It is lapsang souchong rather than oolong.',
  ];
  for (const answerText of repairTexts) {
    assert.equal(classifySourceSensitiveMemoryOutcome({
      answerText,
      object: 'lapsang souchong',
      forbiddenObjects: ['oolong'],
      falsePremiseObjects: ['oolong'],
      supportState: 'verified',
      expectsPremiseRepair: true,
    }), SOURCE_SENSITIVE_OUTCOMES.PREMISE_REPAIRED);
  }
});

test('context-pressure fixture semantic readiness is fixture-shaped, not runtime proof', () => {
  const artifact = buildContextPressureQaArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    defaults: { chatModel: 'q6', toolModel: 'e4b', embedModel: 'nomic' },
  });

  assert.equal(artifact.measurementMode, 'fixture-only');
  for (const variant of artifact.contextVariants) {
    assert.equal(variant.semanticReadiness.ready, null);
    assert.match(variant.semanticReadiness.mode, /^fixture-/);
    assert.equal(variant.semanticReadiness.fallbackActive, false);
  }
  assert.equal(artifact.contextVariants[2].semanticReadiness.assumedReady, true);
});

test('runtime context metrics pull latency, lane, model, semantic readiness, and prompt-truth counts', () => {
  const metrics = extractRuntimeContextMetrics({
    label: 'memoryHeavy',
    prompt: 'What is my favorite tea?',
    answerText: 'lapsang souchong',
    totalLatencyMs: 1234,
    artifact: {
      executionPath: 'llm-chat',
      scope: { selectedLane: 'chat' },
      context: {
        resolvedModel: 'q6',
        semanticMemoryReady: true,
        semanticMemoryMode: 'semantic',
      },
      performance: {
        firstToken: { durationMs: 321 },
        request: { durationMs: 999 },
        archiveRetrieval: { semanticReady: true },
      },
      readiness: {
        embeddingReady: true,
        fallbackActive: false,
      },
      promptTruth: {
        channels: {
          stableFacts: { candidateCount: 1, renderedCount: 1, candidateSourceIds: ['memory:tea'], renderedSourceIds: ['memory:tea'] },
          sessionArchive: { candidateCount: 2, renderedCount: 1, candidateSourceIds: ['s1', 's2'], renderedSourceIds: ['s1'] },
        },
      },
    },
  });

  assert.equal(metrics.estimatedRequestMessageTokens, estimatePromptTokens('What is my favorite tea?'));
  assert.equal(metrics.estimatedPromptTokens, metrics.estimatedRequestMessageTokens);
  assert.equal(metrics.estimatedPromptTokensScope, 'request-message-text');
  assert.equal(metrics.selectedMemoryCount, 3);
  assert.equal(metrics.renderedMemoryCount, 2);
  assert.equal(metrics.firstTokenLatencyMs, 321);
  assert.equal(metrics.totalLatencyMs, 1234);
  assert.equal(metrics.lane, 'chat');
  assert.equal(metrics.modelIdentity, 'q6');
  assert.equal(metrics.semanticReadiness.ready, true);
});

test('context-pressure drift classification uses outcome direction without pretending to inspect hidden state', () => {
  assert.equal(classifyContextPressureDrift([
    { level: 'short', answerPreview: 'I cannot verify that.', qualityOutcome: SOURCE_SENSITIVE_OUTCOMES.APPROPRIATELY_ABSTAINED },
    { level: 'long', answerPreview: 'Your tea is lapsang souchong.', qualityOutcome: SOURCE_SENSITIVE_OUTCOMES.VERIFIED },
  ]), 'improved');
  assert.equal(classifyContextPressureDrift([
    { level: 'short', answerPreview: 'Your tea is lapsang souchong.', qualityOutcome: SOURCE_SENSITIVE_OUTCOMES.VERIFIED },
    { level: 'long', answerPreview: 'Your tea is oolong.', qualityOutcome: SOURCE_SENSITIVE_OUTCOMES.UNSUPPORTED },
  ]), 'degraded');
  assert.equal(classifyContextPressureDrift([
    { level: 'short', answerPreview: 'Your tea is lapsang souchong.', qualityOutcome: SOURCE_SENSITIVE_OUTCOMES.VERIFIED },
    { level: 'long', answerPreview: 'Lapsang souchong is still the tea.', qualityOutcome: SOURCE_SENSITIVE_OUTCOMES.VERIFIED },
  ]), 'drifted');
});
