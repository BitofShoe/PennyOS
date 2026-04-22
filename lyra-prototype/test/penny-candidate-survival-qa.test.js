const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CANDIDATE_FAILURE_MODES,
  CANDIDATE_LINK_FAILURE_MODES,
  CANDIDATE_LINK_VERDICTS,
  CANDIDATE_SURVIVAL_OUTCOMES,
  CANDIDATE_SURVIVAL_QA_SCHEMA,
  SEMANTIC_CLAIM_TRACE_SCHEMA,
  STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES,
  STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA,
  applyPromptTruthToCandidateTrace,
  buildCandidateSurvivalArchiveUnitArtifact,
  buildCandidateSurvivalArchiveUnitCaseResult,
  buildCandidateSurvivalCorrelationSummary,
  buildCandidateSurvivalArchiveUnitSeedPlan,
  buildCandidateSurvivalQaFixture,
  buildEmbeddingProviderComparison,
  buildRerankerShadowArtifactSummary,
  buildRerankerShadowComparison,
  buildStructuredCandidateContractQaFixture,
  classifyStructuredCandidateContract,
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
const {
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticSourceId,
} = require('../lib/penny-semantic-ids');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('../lib/penny-semantic-predicates');
const {
  SEMANTIC_DOMAIN_IDS,
} = require('../lib/penny-semantic-domains');

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

function makeStructuredContractCandidate({
  subject,
  predicateId = SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
  objectText = 'copper rabbit',
  domainId = SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
  sourceType = 'archive-episode',
  sourceId = buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'session:copper-rabbit' }),
  sourceAuthority = 'advisory',
  supportState = 'rendered-advisory',
  canonicality = 'advisory',
  temporalScope = 'current',
  stale = false,
  rendered = true,
  selected = true,
  claimId = undefined,
  claimTreatment = null,
} = {}) {
  const claimLike = {
    domainId,
    subject,
    predicate: { id: predicateId },
    object: { type: 'text', text: objectText },
    source: {
      ...(sourceId ? { sourceId } : {}),
      sourceType,
      excerpt: `${objectText} test fixture`,
      observedAt: '2026-04-22T12:00:00.000Z',
    },
    authority: {
      sourceAuthority,
      supportState,
      canonicality,
    },
    temporal: {
      temporalScope,
      observedAt: '2026-04-22T12:00:00.000Z',
    },
    status: { stale },
  };
  return {
    id: sourceId || 'candidate:missing-source',
    raw: true,
    ranked: true,
    selected,
    rendered,
    rank: 1,
    claim: {
      ...claimLike,
      claimId: claimId === undefined ? buildSemanticClaimId(claimLike) : claimId,
    },
    ...(claimTreatment ? { claimTreatment } : {}),
  };
}

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
  assert.equal(fixture.structuredCandidateContracts.schema, STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA);
  assert.equal(fixture.structuredCandidateContracts.measurementMode, 'fixture-only');
  assert.equal(fixture.structuredCandidateContracts.summary.behaviorChanged, false);
  assert.equal(fixture.structuredCandidateContracts.summary.promptTruthExpanded, false);
  assert.equal(fixture.structuredCandidateContracts.summary.toolEvidenceReceiptChanged, false);
});

test('structured candidate contract fixture covers semantic failure classes without runtime behavior', () => {
  const fixture = buildStructuredCandidateContractQaFixture({
    generatedAt: '2026-04-22T12:00:00.000Z',
  });
  const byId = new Map(fixture.cases.map((item) => [item.caseId, item]));

  assert.equal(fixture.schema, STRUCTURED_CANDIDATE_CONTRACT_QA_SCHEMA);
  assert.equal(fixture.measurementMode, 'fixture-only');
  assert.equal(fixture.liveModelCalls, false);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NONE], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_OBJECT_WRONG_PREDICATE], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_PREDICATE_STALE_OBJECT], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_SOURCE_WRONG_TEMPORAL_SCOPE], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.CANDIDATE_ONLY_TREATED_AS_VERIFIED], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RENDERED_ADVISORY_TREATED_AS_CANONICAL], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.FOUND_NOT_RENDERED], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.MISSING_SOURCE_ID], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.UNSTABLE_CLAIM_ID], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.AUTHORITY_DOMAIN_MISMATCH], 1);
  assert.equal(fixture.summary.byFailureMode[STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.SOURCE_ID_MISMATCH], 1);
  assert.equal(fixture.summary.candidateOnlyTreatedAsVerifiedCount, 1);
  assert.equal(fixture.summary.renderedAdvisoryTreatedAsCanonicalCount, 1);
  assert.equal(fixture.summary.canonicalMemoryWriteCount, 0);
  assert.equal(fixture.summary.defaultPromptLimitsRaised, false);
  assert.equal(
    byId.get('structured-contract-candidate-only-treated-verified').matchedCandidate.semanticClaim.candidateOnly,
    true,
  );
  assert.equal(
    byId.get('structured-contract-rendered-advisory-treated-canonical').matchedCandidate.semanticClaim.canonical,
    false,
  );
  assert.equal(
    byId.get('structured-contract-found-not-rendered').matchedCandidate.rendered,
    false,
  );
  assert.ok(fixture.limits.includes('Candidate-only claims cannot satisfy verified or canonical support contracts.'));
  assert.ok(fixture.failureModeDefinitions.find((item) => (
    item.failureMode === STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.SOURCE_ID_MISMATCH
      && item.definition.includes('source id')
  )));
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

test('structured candidate contract classifier distinguishes object predicate temporal and authority failures', () => {
  const subject = {
    id: buildSemanticEntityId({ entityType: 'project', entityKey: 'lyra-prototype' }),
    type: 'project',
  };
  const sourceId = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'session:copper-rabbit',
  });
  const baseCase = {
    id: 'contract-case',
    expectedClaim: {
      subjectId: subject.id,
      subjectType: subject.type,
      predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
      objectText: 'copper rabbit',
      temporalScope: 'current',
      sourceId,
      allowedDomainIds: [SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE],
      requiredSupportStates: ['rendered-advisory'],
      requireRendered: true,
    },
    forbiddenClaims: [
      {
        predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
        objectText: 'brass fox',
      },
    ],
  };
  const valid = makeStructuredContractCandidate({ subject, sourceId });
  const rebuiltValid = makeStructuredContractCandidate({ subject, sourceId });

  assert.equal(valid.claim.claimId, rebuiltValid.claim.claimId);
  assert.equal(
    classifyStructuredCandidateContract(baseCase, [valid]).failureMode,
    STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.NONE,
  );
  assert.equal(
    classifyStructuredCandidateContract(baseCase, [
      makeStructuredContractCandidate({
        subject,
        sourceId,
        predicateId: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
      }),
    ]).failureMode,
    STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_OBJECT_WRONG_PREDICATE,
  );
  assert.equal(
    classifyStructuredCandidateContract(baseCase, [
      makeStructuredContractCandidate({
        subject,
        sourceId,
        objectText: 'brass fox',
        stale: true,
      }),
    ]).failureMode,
    STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_PREDICATE_STALE_OBJECT,
  );
  assert.equal(
    classifyStructuredCandidateContract(baseCase, [
      makeStructuredContractCandidate({
        subject,
        sourceId,
        temporalScope: 'historical',
      }),
    ]).failureMode,
    STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.RIGHT_SOURCE_WRONG_TEMPORAL_SCOPE,
  );
  assert.equal(
    classifyStructuredCandidateContract({
      ...baseCase,
      expectedClaim: {
        ...baseCase.expectedClaim,
        allowedDomainIds: [SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE],
        requiredSupportStates: ['verified'],
        sourceId: buildSemanticSourceId({
          sourceType: 'static-candidate',
          sourceId: 'static:copper-rabbit',
        }),
      },
    }, [
      makeStructuredContractCandidate({
        subject,
        domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
        sourceType: 'static-candidate',
        sourceId: buildSemanticSourceId({
          sourceType: 'static-candidate',
          sourceId: 'static:copper-rabbit',
        }),
        sourceAuthority: 'candidate-only',
        supportState: 'candidate-only',
        canonicality: 'not-canonical',
        claimTreatment: { supportState: 'verified', verified: true },
      }),
    ]).failureMode,
    STRUCTURED_CANDIDATE_CONTRACT_FAILURE_MODES.CANDIDATE_ONLY_TREATED_AS_VERIFIED,
  );
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

test('archive-unit claim trace distinguishes structured claims from unstructured advisory text', () => {
  const subjectId = buildSemanticEntityId({ entityType: 'project', entityKey: 'lyra-prototype' });
  const expectedClaim = {
    subjectId,
    predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    objectText: 'copper rabbit',
    allowedDomainIds: [SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE],
    requiredSupportStates: ['rendered-advisory'],
    requiredSourceAuthorities: ['advisory'],
    temporalScope: 'current',
  };
  const structuredCandidate = {
    ...makeStructuredContractCandidate({
      subject: { id: subjectId, type: 'project', label: 'lyra-prototype' },
      objectText: 'copper rabbit',
      rendered: true,
      selected: true,
    }),
    candidateChannels: ['lexical', 'static-embedding'],
  };
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'semantic-claim-trace-current-mascot',
      query: 'What is the coding mascot now?',
      expected: {
        subject: 'coding mascot',
        relation: 'current mascot',
        object: 'copper rabbit',
      },
      expectedClaim,
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
          structuredCandidate,
          {
            id: 'unstructured-copper-rabbit-note',
            textPreview: 'Copper rabbit appeared in unrelated scratch text.',
            raw: true,
            ranked: true,
            selected: false,
            rendered: false,
            rank: 2,
            candidateChannels: ['lexical'],
          },
        ],
      },
    },
  });
  const byId = new Map(result.semanticClaimTrace.candidates.map((item) => [item.candidateId, item]));

  assert.equal(result.semanticClaimTrace.schema, SEMANTIC_CLAIM_TRACE_SCHEMA);
  assert.equal(result.semanticClaimTrace.summary.structuredClaimCandidateCount, 1);
  assert.equal(result.semanticClaimTrace.summary.unstructuredAdvisoryCandidateCount, 1);
  assert.equal(result.semanticClaimTrace.summary.expectedClaimCandidateCount, 1);
  assert.equal(result.semanticClaimTrace.summary.promptTruthExpanded, false);
  assert.equal(result.semanticClaimTrace.summary.toolEvidenceReceiptChanged, false);
  assert.equal(result.traceSummary.semanticClaimTraceCandidateCount, 1);
  assert.deepEqual(byId.get(structuredCandidate.id).candidateChannels, ['lexical', 'static-embedding']);
  assert.equal(byId.get(structuredCandidate.id).claim.claimIdStable, true);
  assert.equal(byId.get(structuredCandidate.id).claim.predicateId, SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT);
  assert.equal(byId.get('unstructured-copper-rabbit-note').claimTraceStatus, 'unstructured-advisory');
  assert.equal(byId.get('unstructured-copper-rabbit-note').claimMatch, 'unstructured-advisory');
});

test('claim trace exposes wrong-predicate and candidate-only static claim boundaries', () => {
  const subjectId = buildSemanticEntityId({ entityType: 'project', entityKey: 'lyra-prototype' });
  const expectedClaim = {
    subjectId,
    predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    objectText: 'copper rabbit',
    allowedDomainIds: [SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE, SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE],
    temporalScope: 'current',
  };
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'semantic-claim-trace-wrong-predicate',
      query: 'What is the coding mascot now?',
      expected: {
        subject: 'coding mascot',
        relation: 'current mascot',
        object: 'copper rabbit',
      },
      expectedClaim,
      support: {
        owner: 'archive-candidate',
        authority: 'candidate-only/advisory',
        supportState: 'candidate-only',
      },
    },
    retrievalResult: {
      semanticMemory: { ready: false },
      retrieval: {
        mode: 'keyword',
        candidateTrace: [
          makeStructuredContractCandidate({
            subject: { id: subjectId, type: 'project', label: 'lyra-prototype' },
            predicateId: SEMANTIC_PREDICATE_IDS.SAME_PROJECT_THREAD,
            objectText: 'copper rabbit',
            rendered: false,
            selected: false,
          }),
          {
            ...makeStructuredContractCandidate({
              subject: { id: subjectId, type: 'project', label: 'lyra-prototype' },
              objectText: 'copper rabbit',
              domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
              sourceType: 'static-candidate',
              sourceId: buildSemanticSourceId({
                sourceType: 'static-candidate',
                sourceId: 'static:copper-rabbit',
              }),
              sourceAuthority: 'canonical',
              supportState: 'verified',
              canonicality: 'canonical',
              rendered: false,
              selected: false,
            }),
            id: 'static-candidate-copper-rabbit',
            candidateChannels: ['static-embedding'],
          },
        ],
      },
    },
  });
  const byMatch = new Map(result.semanticClaimTrace.candidates.map((item) => [item.claimMatch, item]));
  const staticCandidate = result.semanticClaimTrace.candidates.find((item) => item.candidateId === 'static-candidate-copper-rabbit');

  assert.equal(result.semanticClaimTrace.summary.rightObjectWrongPredicateCount, 1);
  assert.equal(byMatch.get('right-object-wrong-predicate').claim.objectText, 'copper rabbit');
  assert.equal(staticCandidate.claim.candidateOnly, true);
  assert.equal(staticCandidate.claim.sourceAuthority, 'candidate-only');
  assert.equal(staticCandidate.claim.supportState, 'candidate-only');
  assert.equal(result.semanticClaimTrace.summary.candidateOnlyClaimCount, 1);
  assert.equal(result.semanticClaimTrace.summary.truthProof, false);
  assert.equal(result.semanticClaimTrace.summary.behaviorChanged, false);
});

test('link analysis classifies missing correction links in candidate-survival results', () => {
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'archive-coding-mascot-correction',
      query: 'What is the coding mascot now?',
      expected: {
        subject: 'coding mascot',
        relation: 'current correction',
        object: 'copper rabbit',
      },
      forbidden: [{ id: 'archive:brass-fox', object: 'brass fox', reason: 'Stale prior.' }],
      support: {
        owner: 'archive-candidate',
        authority: 'advisory',
        supportState: 'ranked-not-selected',
      },
    },
    retrievalResult: {
      semanticMemory: { ready: false },
      retrieval: {
        mode: 'keyword',
        candidateTrace: [
          {
            id: 'archive:brass-fox',
            textPreview: 'The coding mascot is a brass fox.',
            raw: true,
            ranked: true,
            selected: true,
            rendered: false,
            rank: 1,
            score: 7,
          },
          {
            id: 'memory:copper-rabbit',
            textPreview: 'Correction: the coding mascot is a copper rabbit now.',
            raw: true,
            ranked: true,
            selected: false,
            rendered: false,
            rank: 3,
            score: 5,
          },
        ],
      },
    },
  });

  assert.equal(result.failureMode, CANDIDATE_FAILURE_MODES.WRONG_AUTHORITY_SELECTED);
  assert.equal(result.linkAnalysis.linkFailureMode, CANDIDATE_LINK_FAILURE_MODES.MISSING_LINK);
  assert.equal(result.linkAnalysis.verdict, CANDIDATE_LINK_VERDICTS.NOT_RUN);
  assert.deepEqual(result.linkAnalysis.expectedCandidateLinks, []);
  assert.equal(result.linkAnalysis.truthProof, false);
  assert.equal(result.linkAnalysis.behaviorChanged, false);
});

test('link analysis records stale-prior links and helpful shadow rank movement', () => {
  const correctionLinks = [
    {
      id: 'current-correction',
      sourceId: 'memory:copper-rabbit',
      targetId: 'archive:brass-fox',
      relation: 'current-correction-for',
      support: { state: 'explicit' },
      authorityEffect: 'current-truth-boost',
    },
    {
      id: 'stale-prior',
      sourceId: 'archive:brass-fox',
      targetId: 'memory:copper-rabbit',
      relation: 'stale-prior-of',
      support: { state: 'explicit' },
      authorityEffect: 'do-not-render-as-current',
    },
  ];
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'archive-coding-mascot-correction',
      query: 'What is the coding mascot now?',
      expected: {
        subject: 'coding mascot',
        relation: 'current correction',
        object: 'copper rabbit',
      },
      forbidden: [{ id: 'archive:brass-fox', object: 'brass fox', reason: 'Stale prior.' }],
      support: {
        owner: 'archive-candidate',
        authority: 'advisory',
        supportState: 'ranked-not-selected',
      },
    },
    retrievalResult: {
      semanticMemory: { ready: false },
      retrieval: {
        mode: 'keyword',
        candidateTrace: [
          {
            id: 'archive:brass-fox',
            textPreview: 'The coding mascot is a brass fox.',
            raw: true,
            ranked: true,
            selected: true,
            rendered: false,
            rank: 1,
            score: 7,
            activeScore: 7,
            memoryLinks: { links: correctionLinks },
          },
          {
            id: 'memory:filler',
            textPreview: 'A nearby project mascot note mentioned a blue owl.',
            raw: true,
            ranked: true,
            selected: false,
            rendered: false,
            rank: 2,
            score: 6,
            activeScore: 6,
          },
          {
            id: 'memory:copper-rabbit',
            textPreview: 'Correction: the coding mascot is a copper rabbit now.',
            raw: true,
            ranked: true,
            selected: false,
            rendered: false,
            rank: 3,
            score: 5,
            activeScore: 5,
            memoryLinks: { links: correctionLinks },
          },
        ],
      },
    },
  });

  assert.equal(result.linkAnalysis.linkFailureMode, CANDIDATE_LINK_FAILURE_MODES.LINK_WOULD_HELP);
  assert.equal(result.linkAnalysis.verdict, CANDIDATE_LINK_VERDICTS.HELPS);
  assert.equal(result.linkAnalysis.shadowRankDelta, 2);
  assert.equal(
    result.linkAnalysis.staleCandidateLinks.some((link) => link.relation === 'stale-prior-of'),
    true,
  );
  assert.equal(result.linkAnalysis.expectedLinkShadow.wouldChangeRank, true);
  assert.equal(result.linkAnalysis.expectedLinkShadow.active, false);
  assert.equal(result.linkAnalysis.expectedLinkShadow.behaviorChanged, false);
});

test('candidate-only correction links stay weak and never become verified support', () => {
  const candidateOnlyLinks = [
    {
      id: 'candidate-only-current',
      sourceId: 'memory:copper-rabbit',
      targetId: 'archive:brass-fox',
      relation: 'current-correction-for',
      support: { state: 'semantic-candidate' },
      authorityEffect: 'current-truth-boost',
    },
  ];
  const result = buildCandidateSurvivalArchiveUnitCaseResult({
    caseLike: {
      id: 'archive-coding-mascot-correction',
      query: 'What is the coding mascot now?',
      expected: {
        subject: 'coding mascot',
        relation: 'current correction',
        object: 'copper rabbit',
      },
      forbidden: [{ id: 'archive:brass-fox', object: 'brass fox', reason: 'Stale prior.' }],
      support: {
        owner: 'archive-candidate',
        authority: 'candidate-only/advisory',
        supportState: 'candidate-only',
      },
    },
    retrievalResult: {
      semanticMemory: { ready: false },
      retrieval: {
        mode: 'keyword',
        candidateTrace: [
          {
            id: 'archive:brass-fox',
            textPreview: 'The coding mascot is a brass fox.',
            raw: true,
            ranked: true,
            selected: true,
            rank: 1,
            score: 7,
            memoryLinks: { links: candidateOnlyLinks },
          },
          {
            id: 'memory:copper-rabbit',
            textPreview: 'Correction candidate: the coding mascot is a copper rabbit now.',
            raw: true,
            ranked: true,
            selected: false,
            rank: 2,
            score: 5,
            memoryLinks: { links: candidateOnlyLinks },
          },
        ],
      },
    },
  });

  assert.equal(result.linkAnalysis.linkFailureMode, CANDIDATE_LINK_FAILURE_MODES.WEAK_LINK);
  assert.equal(result.linkAnalysis.verdict, CANDIDATE_LINK_VERDICTS.NEUTRAL);
  assert.equal(result.linkAnalysis.candidateOnlyVerifiedSupport, false);
  assert.equal(result.linkAnalysis.candidateOnlyLinkCount > 0, true);
  assert.equal(result.linkAnalysis.expectedCandidateLinks[0].supportState, 'semantic-candidate');
  assert.notEqual(result.linkAnalysis.expectedCandidateLinks[0].authorityEffect, 'current-truth-boost');
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
