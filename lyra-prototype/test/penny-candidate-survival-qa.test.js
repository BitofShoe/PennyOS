const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CANDIDATE_SURVIVAL_OUTCOMES,
  CANDIDATE_SURVIVAL_QA_SCHEMA,
  applyPromptTruthToCandidateTrace,
  buildCandidateSurvivalArchiveUnitArtifact,
  buildCandidateSurvivalArchiveUnitCaseResult,
  buildCandidateSurvivalArchiveUnitSeedPlan,
  buildCandidateSurvivalQaFixture,
  classifyCandidateSurvival,
  matchCandidateAgainstForbidden,
  matchCandidateAgainstOracle,
  normalizeCandidateSurvivalCase,
  normalizeCandidateTraceItem,
  summarizeCandidateTrace,
  summarizeCandidateSurvivalCases,
} = require('../lib/penny-candidate-survival-qa');

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
  assert.equal(fixture.outcomeDefinitions.length, 8);
  assert.ok(fixture.outcomeDefinitions.find((item) => (
    item.outcome === CANDIDATE_SURVIVAL_OUTCOMES.RAW_ONLY
      && item.definition.includes('failed eligibility/gating/scoring')
  )));
  assert.ok(fixture.limits.includes('Candidate survival is retrieval evidence, not answer-quality evidence.'));
  assert.ok(fixture.limits.includes('PromptTruth remains prompt-context receipt only.'));
  assert.ok(fixture.limits.includes('Semantic candidates remain discovery-only unless rendered or canonized elsewhere.'));
  assert.ok(fixture.limits.includes('This artifact does not change default rendered context limits.'));
});

test('candidate-survival fixture includes Penny-native explicit archive semantic and absent cases', () => {
  const fixture = buildCandidateSurvivalQaFixture({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });
  const byId = new Map(fixture.cases.map((item) => [item.id, item]));

  const explicitCase = byId.get('explicit-current-preference');
  const archiveCase = byId.get('archive-rendered-episodic-detail');
  const semanticCase = byId.get('semantic-candidate-not-canonical');
  const absentCase = byId.get('fabricated-absent-tail-fact');

  assert.ok(explicitCase);
  assert.equal(explicitCase.expected.object, 'lapsang souchong');
  assert.equal(explicitCase.forbidden[0].object, 'oolong');
  assert.equal(explicitCase.support.owner, 'explicit-memory');
  assert.equal(explicitCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE);
  assert.equal(explicitCase.retrievalExpectation.owner, 'explicit-memory');
  assert.equal(explicitCase.retrievalExpectation.allowedSurvivalOutcomes.includes(CANDIDATE_SURVIVAL_OUTCOMES.NOT_APPLICABLE), true);

  assert.equal(archiveCase.expected.object, 'chipped moon mug');
  assert.equal(archiveCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RENDERED);
  assert.equal(archiveCase.retrievalExpectation.owner, 'archive');
  assert.equal(archiveCase.retrievalExpectation.shouldRender, true);

  assert.equal(semanticCase.expected.object, 'silver thermos');
  assert.equal(semanticCase.support.authority, 'candidate-only/advisory');
  assert.equal(semanticCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.RANKED_NOT_SELECTED);
  assert.equal(semanticCase.retrievalExpectation.owner, 'archive-candidate');
  assert.equal(semanticCase.retrievalExpectation.shouldRender, false);
  assert.equal(semanticCase.retrievalExpectation.forbiddenOutcomes.includes(CANDIDATE_SURVIVAL_OUTCOMES.RENDERED), true);
  assert.equal(semanticCase.notes.some((note) => (
    note.includes('Candidate survival is a retrieval-path diagnostic')
  )), true);

  assert.equal(absentCase.support.supportState, 'absent');
  assert.equal(absentCase.expectedSurvival, CANDIDATE_SURVIVAL_OUTCOMES.MISSING);
  assert.equal(absentCase.retrievalExpectation.owner, 'none');
  assert.deepEqual(absentCase.retrievalExpectation.allowedSurvivalOutcomes, [CANDIDATE_SURVIVAL_OUTCOMES.MISSING]);
  assert.equal(fixture.summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.MISSING], 1);
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
  assert.equal(byId.get('semantic-candidate-not-canonical').retrievalExpectation.shouldRender, false);
  assert.equal(
    byId.get('semantic-candidate-not-canonical').retrievalExpectation.forbiddenOutcomes.includes(CANDIDATE_SURVIVAL_OUTCOMES.RENDERED),
    true,
  );
  assert.deepEqual(
    byId.get('fabricated-absent-tail-fact').retrievalExpectation.allowedSurvivalOutcomes,
    [CANDIDATE_SURVIVAL_OUTCOMES.MISSING],
  );
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

test('archive-unit seed plan keeps disposable stores deterministic', () => {
  const seed = buildCandidateSurvivalArchiveUnitSeedPlan({
    generatedAt: '2026-04-21T12:00:00.000Z',
  });

  assert.equal(seed.explicitMemory.memories[0].text, 'My favorite tea is lapsang souchong.');
  assert.ok(seed.archiveSessions[seed.sessionIds['explicit-current-preference']]);
  assert.ok(seed.archiveSessions[seed.sessionIds['archive-rendered-episodic-detail']]);
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
    },
  ], promptTruth);

  assert.equal(trace[0].selected, true);
  assert.equal(trace[0].rendered, false);
  assert.equal(trace[0].heldBackReason, 'canon-priority-suppression');
  assert.equal(summarizeCandidateTrace(trace).selectedCandidateCount, 1);
  assert.equal(summarizeCandidateTrace(trace).renderedCandidateCount, 0);
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
            eligibility: { eligible: true, filtered: false },
          },
        ],
      },
    },
  });

  assert.equal(result.archiveUnit.measurementMode, 'archive-unit');
  assert.equal(result.archiveUnit.liveModelCalls, false);
  assert.equal(result.archiveUnit.retrievalMode, 'keyword');
  assert.equal(result.survival.expectedObjectPresentRaw, true);
  assert.equal(result.survival.expectedObjectSelected, true);
  assert.equal(result.survival.expectedObjectRendered, true);
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
  assert.equal(artifact.summary.byOutcome[CANDIDATE_SURVIVAL_OUTCOMES.MISSING], 1);
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
  assert.deepEqual(summary.caseIdsByOutcome[CANDIDATE_SURVIVAL_OUTCOMES.RENDERED], ['archive-test-case']);
});
