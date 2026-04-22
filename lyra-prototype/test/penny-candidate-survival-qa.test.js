const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CANDIDATE_FAILURE_MODES,
  CANDIDATE_SURVIVAL_OUTCOMES,
  CANDIDATE_SURVIVAL_QA_SCHEMA,
  applyPromptTruthToCandidateTrace,
  buildCandidateSurvivalArchiveUnitArtifact,
  buildCandidateSurvivalArchiveUnitCaseResult,
  buildCandidateSurvivalCorrelationSummary,
  buildCandidateSurvivalArchiveUnitSeedPlan,
  buildCandidateSurvivalQaFixture,
  buildEmbeddingProviderComparison,
  buildRerankerShadowArtifactSummary,
  buildRerankerShadowComparison,
  classifyCandidateFailureMode,
  classifyCandidateSurvival,
  matchCandidateAgainstForbidden,
  matchCandidateAgainstOracle,
  normalizeCandidateSurvivalCase,
  normalizeCandidateTraceItem,
  summarizeCandidateTrace,
  summarizeCandidateSurvivalCases,
} = require('../lib/penny-candidate-survival-qa');
const {
  PENNY_MEMORY_LINK_TRACE_SCHEMA,
} = require('../lib/penny-memory-links');

const ARCHIVE_CASE = {
  id: 'archive-test-case',
  query: 'What kind of mug was near the arcade register?',
  expected: {
    id: 'session:arcade-mug',
    subject: 'arcade register',
    relation: 'object near register',
    object: 'chipped moon mug',
  },
  forbidden: [
    {
      id: 'global:stale-oolong',
      object: 'oolong',
    },
  ],
  support: {
    owner: 'archive-candidate',
    authority: 'advisory',
  },
};

test('candidate-survival fixture is fixture-only and carries explicit outcome definitions', () => {
  const fixture = buildCandidateSurvivalQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });

  assert.equal(fixture.schema, CANDIDATE_SURVIVAL_QA_SCHEMA);
  assert.equal(fixture.measurementMode, 'fixture-only');
  assert.equal(fixture.liveModelCalls, false);
  assert.deepEqual(Object.values(CANDIDATE_SURVIVAL_OUTCOMES), [
    'rendered',
    'selected-held-back',
    'ranked-not-selected',
    'raw-only',
    'missing',
    'forbidden-selected',
    'forbidden-rendered',
    'not-applicable',
  ]);
  assert.deepEqual(Object.values(CANDIDATE_FAILURE_MODES), [
    'missing-from-raw',
    'filtered-out',
    'low-rank',
    'selected-not-rendered',
    'wrong-authority-selected',
    'forbidden-rendered',
    'answer-layer-failure',
    'no-failure',
    'not-applicable',
  ]);
  assert.equal(fixture.outcomeDefinitions.length, 8);
  assert.equal(fixture.failureModeDefinitions.length, 9);
  assert.ok(fixture.outcomeDefinitions.find((item) => (
    item.outcome === CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY
      && item.definition.includes('failed eligibility/gating/scoring')
  )));
  assert.ok(fixture.failureModeDefinitions.find((item) => (
    item.failureMode === CANDIDATE_FAILURE_MODES.SELECTED_NOT_RENDERED
      && item.recommendedInspection.includes('PromptTruth rendered ids')
  )));
  assert.ok(fixture.limits.includes('Candidate survival is retrieval evidence, not answer-quality evidence.'));
  assert.ok(fixture.limits.includes('PromptTruth remains prompt-context receipt only.'));
  assert.ok(fixture.limits.includes('Semantic candidates remain discovery-only unless rendered or canonized elsewhere.'));
  assert.ok(fixture.limits.includes('This artifact does not change default rendered context limits.'));
  assert.equal(fixture.candidateSurvivalCorrelation.measurementMode, 'fixture-only');
  assert.equal(fixture.candidateSurvivalCorrelation.liveModelCalls, false);
  assert.equal(fixture.candidateSurvivalCorrelation.liveAnswerDriftMeasured, false);
  assert.equal(fixture.candidateSurvivalCorrelation.candidateSurvival.comparisonState, 'not-run');
  assert.equal(fixture.candidateSurvivalCorrelation.contextPressure.answerDrift, 'not-run');
  assert.equal(fixture.candidateSurvivalCorrelation.latency.firstTokenLatencyDeltaMs, null);
  assert.equal(fixture.rerankerShadow.verdict, 'not-run');
});

test('candidate-survival fixture includes Penny-native explicit archive semantic and absent cases', () => {
  const fixture = buildCandidateSurvivalQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });
  const byId = new Map(fixture.cases.map((item) => [item.id, item]));

  const explicitCase = byId.get('explicit-current-preference');
  const archiveCase = byId.get('archive-rendered-episodic-detail');
  const semanticCase = byId.get('semantic-candidate-not-canonical');
  const lowRankCase = byId.get('archive-reranker-low-rank-shadow');
  const absentCase = byId.get('fabricated-absent-tail-fact');

  assert.ok(explicitCase);
  assert.equal(explicitCase.expected.object, 'lapsang souchong');
  assert.equal(explicitCase.forbidden[0].object, 'oolong');
  assert.equal(explicitCase.support.owner, 'explicit-memory');
  assert.equal(explicitCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE);
  assert.equal(explicitCase.failureMode, CANDIDATE_FAILURE_MODES.NOT_APPLICABLE);
  assert.equal(explicitCase.retrievalExpectation.owner, 'explicit-memory');
  assert.equal(explicitCase.retrievalExpectation.allowedSurvivalOutcomes.includes(CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE), true);

  assert.equal(archiveCase.expected.object, 'chipped moon mug');
  assert.equal(archiveCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);
  assert.equal(archiveCase.failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);
  assert.equal(archiveCase.retrievalExpectation.owner, 'archive');
  assert.equal(archiveCase.retrievalExpectation.shouldRender, true);

  assert.equal(semanticCase.expected.object, 'silver thermos');
  assert.equal(semanticCase.support.authority, 'candidate-only/advisory');
  assert.equal(semanticCase.support.supportState, 'candidate-only');
  assert.equal(semanticCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);
  assert.equal(semanticCase.failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);
  assert.equal(semanticCase.retrievalExpectation.owner, 'archive-candidate');
  assert.equal(semanticCase.retrievalExpectation.shouldRender, true);
  assert.equal(semanticCase.retrievalExpectation.forbiddenOutcomes.includes(CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_RENDERED), true);
  assert.equal(semanticCase.notes.some((note) => (
    note.includes('Candidate survival is a retrieval-path diagnostic')
  )), true);

  assert.equal(lowRankCase.expected.object, 'violet cassette');
  assert.equal(lowRankCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED);
  assert.equal(lowRankCase.failureMode, CANDIDATE_FAILURE_MODES.LOW_RANK);
  assert.equal(lowRankCase.retrievalExpectation.owner, 'archive');
  assert.equal(lowRankCase.retrievalExpectation.shouldSelect, true);

  assert.equal(absentCase.support.supportState, 'absent');
  assert.equal(absentCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.MISSING);
  assert.equal(absentCase.failureMode, CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW);
  assert.equal(absentCase.retrievalExpectation.owner, 'none');
  assert.deepEqual(absentCase.retrievalExpectation.allowedSurvivalOutcomes, [CANDIDATE_SURVIVAL_OUTCOMES.MISSING]);
  assert.equal(fixture.summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.MISSING], 1);
  assert.equal(fixture.summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED], 1);
  assert.equal(fixture.summary.byFailureMode[CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW], 1);
  assert.equal(fixture.summary.byFailureMode[CANDIDATE_FAILURE_MODES.LOW_RANK], 1);
  assert.equal(fixture.summary.byFailureMode[CANDIDATE_FAILURE_MODES.NO_FAILURE], 5);
});

test('candidate-survival fixture carries source-sensitive retrieval expectations', () => {
  const fixture = buildCandidateSurvivalQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });
  const byId = new Map(fixture.cases.map((item) => [item.id, item]));

  assert.equal(fixture.cases.every((item) => (
    item.retrievalExpectation
      && item.retrievalExpectation.owner
      && Number.isInteger(item.retrievalExpectation.survivalAtK)
      && Array.isArray(item.retrievalExpectation.allowedSurvivalOutcomes)
      && Array.isArray(item.retrievalExpectation.forbiddenOutcomes)
  )), true);
  assert.equal(
    byId.get('semantic-candidate-not-canonical').retrievalExpectation.shouldRender,
    true,
  );
  assert.deepEqual(
    byId.get('fabricated-absent-tail-fact').retrievalExpectation.allowedSurvivalOutcomes,
    [CANDIDATE_SURVIVAL_OUTCOMES.MISSING],
  );
});

test('candidate-survival fixture pins source-sensitive and reranker-shadow regression cases', () => {
  const fixture = buildCandidateSurvivalQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });
  const byId = new Map(fixture.cases.map((item) => [item.id, item]));

  assert.deepEqual([...byId.keys()], [
    'explicit-current-preference',
    'archive-rendered-episodic-detail',
    'semantic-candidate-not-canonical',
    'archive-reranker-low-rank-shadow',
    'fabricated-absent-tail-fact',
    'archive-coding-mascot-correction',
    'archive-cashier-watch-correction',
    'sensitive-weak-match-suppressed',
  ]);

  const codingMascot = byId.get('archive-coding-mascot-correction');
  assert.equal(codingMascot.expected.object, 'copper rabbit');
  assert.equal(codingMascot.forbidden[0].object, 'brass fox');
  assert.equal(codingMascot.retrievalExpectation.owner, 'archive');
  assert.equal(codingMascot.retrievalExpectation.survivalAtK, 5);
  assert.equal(codingMascot.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);
  assert.equal(codingMascot.failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);

  const cashierWatch = byId.get('archive-cashier-watch-correction');
  assert.equal(cashierWatch.expected.object, 'gold watch');
  assert.equal(cashierWatch.forbidden[0].object, 'silver watch');
  assert.equal(cashierWatch.retrievalExpectation.survivalAtK, 5);
  assert.equal(cashierWatch.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);
  assert.equal(cashierWatch.failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);

  const sensitive = byId.get('sensitive-weak-match-suppressed');
  assert.equal(sensitive.expected.object, 'want to disappear');
  assert.equal(sensitive.support.supportState, 'suppressed');
  assert.equal(sensitive.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY);
  assert.equal(sensitive.failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);
  assert.equal(sensitive.retrievalExpectation.shouldSelect, false);
  assert.equal(sensitive.retrievalExpectation.shouldRender, false);
  assert.equal(sensitive.retrievalExpectation.forbiddenOutcomes.includes(CANDIDATE_SURVIVAL_OUTCOMES.RENDERED), true);
});

test('candidate matching uses ids and expected source/object anchors', () => {
  assert.equal(matchCandidateAgainstOracle({
    id: 'session:arcade-mug',
    text: 'A chipped moon mug was near the arcade register.',
  }, ARCHIVE_CASE.expected), true);

  assert.equal(matchCandidateAgainstOracle({
    id: 'session:other-mug',
    text: 'A chipped moon mug was near the arcade register.',
  }, ARCHIVE_CASE.expected), true);

  assert.equal(matchCandidateAgainstOracle({
    id: 'session:other-mug',
    text: 'A chipped moon mug was near the laundromat table.',
  }, ARCHIVE_CASE.expected), false);

  assert.equal(matchCandidateAgainstOracle({
    id: 'session:other-mug',
    text: 'A chipped moon mug was under the arcade register.',
  }, ARCHIVE_CASE.expected), false);

  assert.equal(matchCandidateAgainstForbidden({
    id: 'global:stale-oolong',
    object: 'oolong',
    selected: true,
  }, ARCHIVE_CASE.forbidden), true);

  assert.equal(matchCandidateAgainstForbidden({
    id: 'session:tea-correction-lapsang',
    text: 'Correction episode: my favorite tea is lapsang souchong now, not oolong.',
    selected: true,
  }, [{ id: 'session:tea-old-oolong', object: 'oolong' }]), false);
});

test('trace normalization infers stage booleans without runtime dependencies', () => {
  const rendered = normalizeCandidateTraceItem({
    id: 'session:arcade-mug',
    stage: 'rendered',
    rank: 0,
    object: 'chipped moon mug',
  });
  assert.equal(rendered.raw, true);
  assert.equal(rendered.ranked, true);
  assert.equal(rendered.selected, true);
  assert.equal(rendered.rendered, true);

  const rawOnly = normalizeCandidateTraceItem({
    id: 'session:arcade-mug',
    stage: 'filtered',
    eligible: false,
    textPreview: 'A chipped moon mug was near the arcade register.',
  });
  assert.equal(rawOnly.raw, true);
  assert.equal(rawOnly.ranked, false);
  assert.equal(rawOnly.selected, false);
  assert.equal(rawOnly.rendered, false);
  assert.equal(rawOnly.eligible, false);
  assert.equal(rawOnly.text, 'A chipped moon mug was near the arcade register.');
});

test('candidate survival classifier distinguishes expected trace stages', () => {
  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, [
    {
      id: 'session:arcade-mug',
      object: 'chipped moon mug',
      rendered: true,
    },
  ]).outcome, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);

  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, [
    {
      id: 'session:arcade-mug',
      object: 'chipped moon mug',
      selected: true,
      heldBackReason: 'prompt-limit',
    },
  ]).outcome, CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK);

  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, [
    {
      id: 'session:arcade-mug',
      object: 'chipped moon mug',
      rank: 3,
    },
  ]).outcome, CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED);

  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, [
    {
      id: 'session:arcade-mug',
      object: 'chipped moon mug',
      stage: 'raw-only',
      eligible: false,
    },
  ]).outcome, CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY);

  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, []).outcome, CANDIDATE_SURVIVAL_OUTCOMES.MISSING);
});

test('candidate survival keeps explicit staged traces even when raw pool flags are false', () => {
  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, {
    renderedCandidates: [
      {
        id: 'session:arcade-mug',
        object: 'chipped moon mug',
        inCandidatePool: false,
      },
    ],
  }).outcome, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);

  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, {
    selectedCandidates: [
      {
        id: 'session:arcade-mug',
        object: 'chipped moon mug',
        inCandidatePool: false,
      },
    ],
  }).outcome, CANDIDATE_SURVIVAL_OUTCOMES.SELECTED_HELD_BACK);
});

test('candidate survival classifier flags stale or forbidden candidates separately', () => {
  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, [
    {
      id: 'global:stale-oolong',
      object: 'oolong',
      selected: true,
    },
  ]).outcome, CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_SELECTED);

  assert.equal(classifyCandidateSurvival(ARCHIVE_CASE, [
    {
      id: 'global:stale-oolong',
      object: 'oolong',
      rendered: true,
    },
  ]).outcome, CANDIDATE_SURVIVAL_OUTCOMES.FORBIDDEN_RENDERED);
});

test('candidate failure-mode classifier covers every diagnostic layer', () => {
  const renderExpectedCase = {
    ...ARCHIVE_CASE,
    retrievalExpectation: {
      owner: 'archive',
      shouldSelect: true,
      shouldRender: true,
      survivalAtK: 5,
      forbiddenOutcomes: [],
    },
  };
  const renderForbiddenCase = {
    ...ARCHIVE_CASE,
    retrievalExpectation: {
      owner: 'archive-candidate',
      shouldSelect: true,
      shouldRender: false,
      survivalAtK: 5,
      forbiddenOutcomes: [CANDIDATE_SURVIVAL_OUTCOMES.RENDERED],
    },
  };
  const explicitCase = {
    id: 'explicit-current-preference',
    expected: { object: 'lapsang souchong', supportOwner: 'explicit-memory' },
    support: { owner: 'explicit-memory', authority: 'canonical', supportState: 'verified' },
  };

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, []), []).failureMode,
    CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      {
        id: 'session:arcade-mug',
        object: 'chipped moon mug',
        stage: 'filtered',
        eligible: false,
        heldBackReason: 'sensitive-low-confidence',
      },
    ]), [
      {
        id: 'session:arcade-mug',
        object: 'chipped moon mug',
        stage: 'filtered',
        eligible: false,
        heldBackReason: 'sensitive-low-confidence',
      },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.FILTERED_OUT,
  );

  const expectedSuppressedCase = {
    ...renderForbiddenCase,
    id: 'sensitive-weak-match-suppressed',
    expected: { object: 'want to disappear' },
    support: { owner: 'archive-candidate', authority: 'sensitive/advisory', supportState: 'suppressed' },
    expectedSurvival: CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY,
    retrievalExpectation: {
      owner: 'archive',
      shouldSelect: false,
      shouldRender: false,
      allowedSurvivalOutcomes: [CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY],
      forbiddenOutcomes: [CANDIDATE_SURVIVAL_OUTCOMES.RENDERED],
    },
  };
  assert.equal(
    classifyCandidateFailureMode(expectedSuppressedCase, classifyCandidateSurvival(expectedSuppressedCase, [
      {
        id: 'session:sensitive-weak-match',
        text: 'I feel broken and want to disappear tonight.',
        stage: 'filtered',
        eligible: false,
        heldBackReason: 'sensitive-low-confidence',
      },
    ]), [
      {
        id: 'session:sensitive-weak-match',
        text: 'I feel broken and want to disappear tonight.',
        stage: 'filtered',
        eligible: false,
        heldBackReason: 'sensitive-low-confidence',
      },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.NO_FAILURE,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rank: 12 },
    ]), [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rank: 12 },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.LOW_RANK,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      { id: 'session:arcade-mug', object: 'chipped moon mug', selected: true, heldBackReason: 'prompt-limit' },
    ]), [
      { id: 'session:arcade-mug', object: 'chipped moon mug', selected: true, heldBackReason: 'prompt-limit' },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.SELECTED_NOT_RENDERED,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      { id: 'global:stale-oolong', object: 'oolong', selected: true },
    ]), [
      { id: 'global:stale-oolong', object: 'oolong', selected: true },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.WRONG_AUTHORITY_SELECTED,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      { id: 'global:stale-oolong', object: 'oolong', rendered: true },
    ]), [
      { id: 'global:stale-oolong', object: 'oolong', rendered: true },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.FORBIDDEN_RENDERED,
  );

  assert.equal(
    classifyCandidateFailureMode(renderForbiddenCase, classifyCandidateSurvival(renderForbiddenCase, [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ]), [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ]).failureMode,
    CANDIDATE_FAILURE_MODES.FORBIDDEN_RENDERED,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ]), [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ], { outcome: 'correct-but-unsupported' }).failureMode,
    CANDIDATE_FAILURE_MODES.ANSWER_LAYER_FAILURE,
  );

  assert.equal(
    classifyCandidateFailureMode(renderExpectedCase, classifyCandidateSurvival(renderExpectedCase, [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ]), [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ], { outcome: 'verified' }).failureMode,
    CANDIDATE_FAILURE_MODES.NO_FAILURE,
  );

  assert.equal(
    classifyCandidateFailureMode(explicitCase, classifyCandidateSurvival(explicitCase, []), []).failureMode,
    CANDIDATE_FAILURE_MODES.NOT_APPLICABLE,
  );
});

test('archive-unit seed plan keeps disposable stores deterministic', () => {
  const seed = buildCandidateSurvivalArchiveUnitSeedPlan({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });

  assert.equal(seed.explicitMemory.memories[0].text, 'My favorite tea is lapsang souchong.');
  assert.ok(seed.archiveSessions[seed.sessionIds['explicit-current-preference']]);
  assert.ok(seed.archiveSessions[seed.sessionIds['archive-rendered-episodic-detail']]);
  assert.ok(seed.archiveSessions[seed.sessionIds['archive-reranker-low-rank-shadow']]);
  assert.ok(seed.archiveSessions[seed.sessionIds['archive-coding-mascot-correction']]);
  assert.ok(seed.archiveSessions[seed.sessionIds['archive-cashier-watch-correction']]);
  assert.ok(seed.archiveSessions[seed.sessionIds['sensitive-weak-match-suppressed']]);
  assert.equal(seed.memoryBooks.books.length, 0);
  assert.deepEqual(seed.researchLedger.topics, {});
});

test('archive-unit classification overlays prompt rendered and held-back state', () => {
  const promptTruth = {
    channels: {
      sessionArchive: {
        candidateSourceIds: ['session:tea-correction-lapsang'],
        renderedSourceIds: [],
        heldBackReason: 'canon-priority-suppression',
      },
      globalArchive: {
        candidateSourceIds: [],
        renderedSourceIds: [],
      },
    },
  };
  const trace = applyPromptTruthToCandidateTrace([
    {
      id: 'session:tea-correction-lapsang',
      textPreview: 'Correction episode: my favorite tea is lapsang souchong now, not oolong.',
      sourceType: 'episode',
      raw: true,
      ranked: true,
      selected: true,
      rendered: true,
      rank: 1,
      score: 11,
      policy: {
        reasons: [
          'static-similarity:+3.10',
          'current-correction-boost:favorite tea:+2.40',
        ],
      },
    },
  ], promptTruth);

  assert.equal(trace[0].selected, true);
  assert.equal(trace[0].rendered, false);
  assert.equal(trace[0].heldBackReason, 'canon-priority-suppression');
  assert.equal(trace[0].policyReasons.includes('static-similarity:+3.10'), true);
  assert.equal(trace[0].policyReasons.includes('current-correction-boost:favorite tea:+2.40'), true);
  assert.equal(trace[0].policyReasons.includes('explicit-memory-override:block'), true);
  assert.equal(summarizeCandidateTrace(trace).selectedCandidateCount, 1);
  assert.equal(summarizeCandidateTrace(trace).renderedCandidateCount, 0);
});

test('candidate-survival trace normalization preserves advisory memory link metadata', () => {
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'archive-coding-mascot-correction',
      query: 'What is the coding mascot now?',
      expected: {
        subject: 'coding mascot',
        relation: 'current correction',
        object: 'copper rabbit',
      },
      forbidden: [{ object: 'brass fox' }],
      support: {
        owner: 'archive-candidate',
        authority: 'advisory',
        supportState: 'rendered',
      },
    },
    retrievalResult: {
      semanticMemory: { ready: false },
      retrieval: {
        mode: 'keyword',
        candidateTrace: [
          {
            id: 'memory:copper-rabbit',
            textPreview: 'The coding mascot is a copper rabbit now.',
            sourceType: 'episode',
            raw: true,
            ranked: true,
            selected: true,
            rendered: true,
            rank: 1,
            memoryLinks: {
              linkTraceLimit: 6,
              incoming: [
                {
                  sourceId: 'archive:brass-fox',
                  targetId: 'memory:copper-rabbit',
                  relation: 'stale-prior-of',
                  support: { state: 'archive' },
                },
              ],
              outgoing: [
                {
                  sourceId: 'memory:copper-rabbit',
                  targetId: 'archive:brass-fox',
                  relation: 'current-correction-for',
                  support: { state: 'archive' },
                },
              ],
            },
          },
        ],
      },
    },
  });

  assert.equal(result.traceSummary.linkTraceCandidateCount, 1);
  assert.equal(result.traceSummary.linkTraceTotalLinks, 2);
  assert.equal(result.topCandidates[0].memoryLinks.schema, PENNY_MEMORY_LINK_TRACE_SCHEMA);
  assert.equal(result.topCandidates[0].memoryLinks.advisoryOnly, true);
  assert.equal(result.topCandidates[0].memoryLinks.truthProof, false);
  assert.equal(result.topCandidates[0].memoryLinks.scoringActive, false);
  assert.equal(result.topCandidates[0].memoryLinks.behaviorChanged, false);
  assert.equal(result.topCandidates[0].memoryLinks.relationSummary.currentCorrectionFor, 1);
  assert.equal(result.topCandidates[0].memoryLinks.relationSummary.stalePriorOf, 1);
});

test('archive-unit case result uses required survival and trace summary shape', () => {
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'archive-rendered-episodic-detail',
      query: 'What kind of mug was beside the arcade register?',
      expected: {
        subject: 'arcade register',
        relation: 'object beside register',
        object: 'chipped moon mug',
      },
      forbidden: [{ object: 'orange backup mug' }],
      support: {
        owner: 'archive-candidate',
        authority: 'advisory',
        supportState: 'rendered',
      },
    },
    retrievalResult: {
      semanticMemory: { ready: false },
      retrieval: {
        mode: 'keyword',
        candidateTrace: [
          {
            id: 'session:arcade-register-moon-mug',
            textPreview: 'The clerk kept a chipped moon mug beside the arcade register.',
            sourceType: 'episode',
            raw: true,
            ranked: true,
            selected: true,
            rendered: true,
            rank: 1,
            score: 12,
            shadowScores: {
              hybridV1: {
                score: 13.75,
                rank: 1,
                wouldSelect: true,
                rankDelta: 0,
              },
            },
            rerankShadow: {
              provider: 'fixture-reranker',
              inputRank: 1,
              outputRank: 1,
              score: 18.5,
              wouldSelect: true,
              latencyMs: 0,
              reasons: ['exact-anchor:arcade register'],
            },
            eligibility: { eligible: true, filtered: false },
          },
        ],
        rerankShadow: {
          provider: 'fixture-reranker',
          measurementMode: 'shadow-fixture',
          inputTopK: 1,
          outputTopK: 1,
          latencyMs: 0,
        },
      },
    },
  });

  assert.equal(result.archiveUnit.measurementMode, 'archive-unit');
  assert.equal(result.archiveUnit.liveModelCalls, false);
  assert.equal(result.archiveUnit.retrievalMode, 'keyword');
  assert.equal(result.survival.expectedObjectPresentRaw, true);
  assert.equal(result.survival.expectedObjectSelected, true);
  assert.equal(result.survival.expectedObjectRendered, true);
  assert.equal(result.failureMode, CANDIDATE_FAILURE_MODES.NO_FAILURE);
  assert.equal(result.recommendedInspection, 'No retrieval inspection is indicated by this diagnostic.');
  assert.equal(result.traceSummary.rawCandidateCount, 1);
  assert.equal(result.topCandidates[0].matchedExpected, true);
  assert.deepEqual(result.shadowComparison, {
    profile: 'hybrid-v1',
    activeBestRank: 1,
    shadowBestRank: 1,
    activeSelected: true,
    shadowWouldSelect: true,
    rankDelta: 0,
  });
  assert.equal(result.topCandidates[0].shadowHybridV1.rank, 1);
  assert.equal(result.rerankerShadowComparison.provider, 'fixture-reranker');
  assert.equal(result.rerankerShadowComparison.rerankBestRank, 1);
  assert.equal(result.rerankerShadowComparison.rerankWouldSelect, true);
  assert.equal(result.topCandidates[0].rerankShadow.outputRank, 1);
});

test('archive-unit artifact records no live model or server behavior', () => {
  const artifact = buildCandidateSurvivalArchiveUnitArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    filePaths: {
      explicitMemoryFile: '/tmp/penny-memory.json',
      archiveFile: '/tmp/penny-memory-archive.json',
      embeddingsFile: '/tmp/penny-memory-embeddings.json',
      booksFile: '/tmp/penny-memory-books.json',
      ledgerFile: '/tmp/penny-memory-ledger.json',
    },
    cleanup: {
      attempted: true,
      allRemoved: true,
      files: [],
    },
    cases: [
      {
        id: 'fabricated-absent-tail-fact',
        survival: { outcome: CANDIDATE_SURVIVAL_OUTCOMES.MISSING },
      },
    ],
  });

  assert.equal(artifact.schema, CANDIDATE_SURVIVAL_QA_SCHEMA);
  assert.equal(artifact.measurementMode, 'archive-unit');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.serverSpawned, false);
  assert.equal(artifact.apiChatCalls, false);
  assert.equal(artifact.files.ledgerFile, '/tmp/penny-memory-ledger.json');
  assert.equal(artifact.failureModeDefinitions.length, 9);
  assert.equal(artifact.summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.MISSING], 1);
  assert.equal(artifact.summary.byFailureMode[CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW], 1);
  assert.equal(artifact.candidateSurvivalCorrelation.measurementMode, 'archive-unit');
  assert.equal(artifact.candidateSurvivalCorrelation.candidateSurvival.comparisonState, 'not-run');
  assert.equal(artifact.candidateSurvivalCorrelation.contextPressure.answerDrift, 'not-run');
  assert.equal(artifact.candidateSurvivalCorrelation.latency.totalLatencyDeltaMs, null);
  assert.equal(artifact.rerankerShadow.verdict, 'not-run');
});

test('reranker shadow summary reports improved low-rank candidates without answer-quality claims', () => {
  const trace = [
    normalizeCandidateTraceItem({
      id: 'receipt',
      textPreview: 'A paper receipt was tucked under the checkout fern.',
      rank: 1,
      raw: true,
      ranked: true,
      selected: true,
      rendered: true,
      rerankShadow: {
        provider: 'fixture-reranker',
        inputRank: 1,
        outputRank: 2,
        score: 7,
        wouldSelect: false,
        latencyMs: 1,
        reasons: ['lexical-overlap:checkout,fern'],
      },
    }),
    normalizeCandidateTraceItem({
      id: 'cassette',
      textPreview: 'A violet cassette was tucked under the checkout fern.',
      rank: 2,
      raw: true,
      ranked: true,
      selected: false,
      rendered: false,
      rerankShadow: {
        provider: 'fixture-reranker',
        inputRank: 2,
        outputRank: 1,
        score: 13,
        wouldSelect: true,
        latencyMs: 1,
        reasons: ['evidence-count:6:+2.40'],
      },
    }),
  ];
  const caseLike = normalizeCandidateSurvivalCase({
    id: 'archive-reranker-low-rank-shadow',
    expected: {
      subject: 'checkout fern',
      relation: 'object under fern',
      object: 'violet cassette',
    },
    support: { owner: 'archive-candidate', authority: 'advisory', supportState: 'ranked-not-selected' },
    retrievalExpectation: { owner: 'archive', survivalAtK: 5, shouldSelect: true, shouldRender: true },
  });
  const comparison = buildRerankerShadowComparison(caseLike, trace, {
    provider: 'fixture-reranker',
    measurementMode: 'shadow-fixture',
    inputTopK: 2,
    outputTopK: 1,
    latencyMs: 1,
  });
  const summary = buildRerankerShadowArtifactSummary([
    {
      id: caseLike.id,
      support: caseLike.support,
      retrievalExpectation: caseLike.retrievalExpectation,
      survival: { outcome: CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED },
      rerankerShadowComparison: comparison,
    },
  ]);

  assert.equal(comparison.activeBestRank, 2);
  assert.equal(comparison.rerankBestRank, 1);
  assert.equal(comparison.rerankWouldSelect, true);
  assert.deepEqual(summary.improvedCases, ['archive-reranker-low-rank-shadow']);
  assert.deepEqual(summary.regressedCases, []);
  assert.equal(summary.verdict, 'shadow-improved-ordering');
  assert.equal(Object.prototype.hasOwnProperty.call(summary, 'promptTruth'), false);
});

test('embedding provider comparison summarizes shadow survival without answer-quality claims', () => {
  const comparison = buildEmbeddingProviderComparison({
    primary: {
      provider: 'primary',
      model: 'text-embedding-nomic-embed-text-v1.5',
      retrievalMode: 'keyword',
    },
    primaryCases: [
      {
        id: 'archive-coding-mascot-correction',
        expected: { object: 'copper rabbit', supportOwner: 'session-archive' },
        support: { owner: 'archive-candidate', authority: 'advisory', supportState: 'rendered' },
        retrievalExpectation: { owner: 'archive', survivalAtK: 5, shouldSelect: true, shouldRender: true },
        survival: { outcome: 'rendered', bestRank: 4, expectedObjectSelected: true, expectedObjectRendered: true },
      },
    ],
    shadow: {
      provider: 'static',
      model: 'penny-static-shadow-lexical-v1',
      retrievalMode: 'semantic-shadow',
      cpuMs: 4.4,
    },
    shadowCases: [
      {
        id: 'archive-coding-mascot-correction',
        expected: { object: 'copper rabbit', supportOwner: 'session-archive' },
        support: { owner: 'archive-candidate', authority: 'advisory', supportState: 'rendered' },
        retrievalExpectation: { owner: 'archive', survivalAtK: 5, shouldSelect: true, shouldRender: true },
        survival: { outcome: 'rendered', bestRank: 1, expectedObjectSelected: true, expectedObjectRendered: true },
      },
    ],
  });

  assert.equal(comparison.primary.provider, 'primary');
  assert.equal(comparison.primary.survivalAtK.eligible, 1);
  assert.equal(comparison.primary.survivalAtK.rate, 1);
  assert.equal(comparison.primary.averageBestRank, 4);
  assert.equal(comparison.shadow.provider, 'static');
  assert.equal(comparison.shadow.cpuMs, 4);
  assert.equal(comparison.shadow.averageBestRank, 1);
  assert.equal(comparison.verdict, 'shadow-improved-average-rank');
  assert.deepEqual(comparison.limits, [
    'Shadow provider is discovery-only.',
    'Default embedding provider unchanged.',
    'Retrieved candidates are not canonized.',
  ]);
});

test('candidate-survival correlation summarizes archive-unit profile comparisons without live drift claims', () => {
  const correlation = buildCandidateSurvivalCorrelationSummary({
    generatedAt: '2026-04-21T12:00:00.000Z',
    artifact: {
      measurementMode: 'archive-unit',
      cases: [
        {
          id: 'archive-coding-mascot-correction',
          profileComparison: {
            baseline: { bestRank: 4, selected: false, rendered: false },
            hybridV1: { bestRank: 1, selected: true, rendered: true },
            renderedCountDelta: 0,
            verdict: 'hybrid-ranked-better',
          },
        },
        {
          id: 'archive-cashier-watch-correction',
          profileComparison: {
            baseline: { bestRank: 2, selected: true, rendered: true },
            hybridV1: { bestRank: 2, selected: true, rendered: true },
            renderedCountDelta: 0,
            verdict: 'same',
          },
        },
      ],
    },
  });

  assert.equal(correlation.measurementMode, 'archive-unit');
  assert.equal(correlation.liveModelCalls, false);
  assert.equal(correlation.liveAnswerDriftMeasured, false);
  assert.equal(correlation.candidateSurvival.comparisonState, 'profile-comparison');
  assert.equal(correlation.candidateSurvival.expectedObjectBestRankBefore, 3);
  assert.equal(correlation.candidateSurvival.expectedObjectBestRankAfter, 1.5);
  assert.equal(correlation.candidateSurvival.selectedBefore, 1);
  assert.equal(correlation.candidateSurvival.selectedAfter, 2);
  assert.equal(correlation.candidateSurvival.renderedBefore, 1);
  assert.equal(correlation.candidateSurvival.renderedAfter, 2);
  assert.deepEqual(correlation.candidateSurvival.improvedCaseIds, ['archive-coding-mascot-correction']);
  assert.deepEqual(correlation.candidateSurvival.unchangedCaseIds, ['archive-cashier-watch-correction']);
  assert.equal(correlation.candidateSurvival.selectionVerdict, 'improved-without-rendered-count-growth');
  assert.equal(correlation.contextPressure.renderedMemoryCountDelta, 0);
  assert.equal(correlation.contextPressure.estimatedPromptTokenDelta, null);
  assert.equal(correlation.contextPressure.estimatedPromptTokenDeltaMode, 'not-measured-in-archive-unit-profile-comparison');
  assert.equal(correlation.contextPressure.promptBloatInferred, false);
  assert.equal(correlation.contextPressure.answerDrift, 'not-run');
  assert.equal(correlation.latency.firstTokenLatencyDeltaMs, null);
  assert.equal(correlation.latency.totalLatencyDeltaMs, null);
});

test('explicit-memory-owned case can be not applicable for archive candidate survival', () => {
  const result = classifyCandidateSurvival({
    id: 'explicit-current-preference',
    query: 'Since my favorite tea is oolong, remind me what tea I like now.',
    expected: {
      subject: 'favorite tea',
      relation: 'current preference',
      object: 'lapsang souchong',
      supportOwner: 'explicit-memory',
    },
    forbiddenObjects: ['oolong'],
    support: {
      owner: 'explicit-memory',
      authority: 'canonical',
      supportState: 'verified',
    },
  }, []);

  assert.equal(result.outcome, CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE);
  assert.equal(result.outcomeDefinition, 'Case is not owned by archive/candidate retrieval.');
});

test('summary counts normalized cases and classification results by retrieval-path outcome', () => {
  const cases = [
    normalizeCandidateSurvivalCase({
      id: 'explicit-current-preference',
      expected: { object: 'lapsang souchong', supportOwner: 'explicit-memory' },
      support: { owner: 'explicit-memory', supportState: 'verified' },
    }),
    classifyCandidateSurvival(ARCHIVE_CASE, [
      { id: 'session:arcade-mug', object: 'chipped moon mug', rendered: true },
    ]),
    classifyCandidateSurvival(ARCHIVE_CASE, []),
  ];

  const summary = summarizeCandidateSurvivalCases(cases);
  assert.equal(summary.totalCases, 3);
  assert.equal(summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE], 1);
  assert.equal(summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.RENDERED], 1);
  assert.equal(summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.MISSING], 1);
  assert.equal(summary.byFailureMode[CANDIDATE_FAILURE_MODES.NOT_APPLICABLE], 1);
  assert.equal(summary.byFailureMode[CANDIDATE_FAILURE_MODES.NO_FAILURE], 1);
  assert.equal(summary.byFailureMode[CANDIDATE_FAILURE_MODES.MISSING_FROM_RAW], 1);
  assert.deepEqual(summary.caseIdsByOutcome[CANDIDATE_SURVIVAL_OUTCOMES.RENDERED], ['archive-test-case']);
});
