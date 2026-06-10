const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMemoryArchivePolicyApi,
  normalizeMemoryLinkScoringMode,
  normalizeArchiveScoringProfile,
} = require('../lib/penny-memory-archive-policy');
const {
  MEMORY_LINK_RELATIONS,
} = require('../lib/penny-memory-links');
const {
  buildCorrectionLinks,
} = require('../lib/penny-memory-link-policy');

function tokenizeMemoryText(text = '') {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
}

function cosineSimilarity(left = [], right = []) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index] || 0);
    const b = Number(right[index] || 0);
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

test('scoreArchiveCandidate exposes score components and reasons without changing the score total', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    cosineSimilarity: () => 0.6,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-21T00:00:00.000Z');

  const scored = policy.scoreArchiveCandidate({
    id: 'episode-1',
    text: 'Favorite tea detail.',
    sourceType: 'episode',
    scope: 'session',
    sensitivity: 'high',
    createdAt: '2026-04-14T00:00:00.000Z',
  }, new Set(['favorite', 'tea']), now, [1, 0], [0.6, 0.8]);

  const expectedScore = 2.5 + (2 * 2.25) + (0.6 * 8) + (1.5 - (7 / 14)) + 0.75 - 1.5;
  assert.equal(scored.score, expectedScore);
  assert.equal(scored.score, scored.components.sourceTypeBase
    + scored.components.lexicalOverlap
    + scored.components.semanticSimilarityScore
    + scored.components.staticSimilarityScore
    + scored.components.recency
    + scored.components.sessionScope
    + scored.components.sensitivityPenalty);
  assert.deepEqual(scored.overlapTokens, ['favorite', 'tea']);
  assert.deepEqual(scored.components, {
    sourceTypeBase: 2.5,
    lexicalOverlap: 4.5,
    semanticSimilarity: 0.6,
    semanticSimilarityScore: 4.8,
    staticSimilarityScore: 0,
    recency: 1,
    sessionScope: 0.75,
    sensitivityPenalty: -1.5,
  });
  assert.deepEqual(scored.reasons, [
    'source:episode',
    'lexical-overlap:favorite,tea',
    'semantic-similarity:0.60',
    'recency:+1.00',
    'session-scope:+0.75',
    'sensitivity-penalty:-1.50',
  ]);
  assert.equal(scored.evidenceSnippet, 'Favorite tea detail.');
  assert.equal(scored.confidence, 1);
});

test('normalizeArchiveScoringProfile keeps baseline as the default and gates hybrid-v1 explicitly', () => {
  assert.equal(normalizeArchiveScoringProfile(), 'baseline');
  assert.equal(normalizeArchiveScoringProfile(''), 'baseline');
  assert.equal(normalizeArchiveScoringProfile('bogus'), 'baseline');
  assert.equal(normalizeArchiveScoringProfile('baseline'), 'baseline');
  assert.equal(normalizeArchiveScoringProfile('hybrid-v1'), 'hybrid-v1');
});

test('scoreArchiveCandidate marks semantic similarity as unavailable when keyword fallback is active', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });

  const scored = policy.scoreArchiveCandidate({
    text: 'Longer-term themes: midnight rain.',
    sourceType: 'summary',
    scope: 'global',
    sensitivity: 'normal',
    createdAt: '',
  }, new Set(['midnight', 'rain']), Date.parse('2026-04-21T00:00:00.000Z'));

  assert.equal(scored.score, 3 + (2 * 2.25));
  assert.deepEqual(scored.components, {
    sourceTypeBase: 3,
    lexicalOverlap: 4.5,
    semanticSimilarity: null,
    semanticSimilarityScore: 0,
    staticSimilarityScore: 0,
    recency: 0,
    sessionScope: 0,
    sensitivityPenalty: 0,
  });
  assert.deepEqual(scored.reasons, [
    'source:summary',
    'lexical-overlap:midnight,rain',
  ]);
});

test('scoreArchiveCandidate adds static similarity as a separate advisory component', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });

  const scored = policy.scoreArchiveCandidate({
    text: 'Copper rabbit memory.',
    sourceType: 'episode',
    scope: 'session',
    sensitivity: 'normal',
    createdAt: '',
    candidateChannels: ['static-embedding'],
    staticEmbedding: {
      similarity: 0.8,
    },
  }, new Set(['copper', 'rabbit']), Date.parse('2026-04-21T00:00:00.000Z'));

  assert.equal(scored.components.staticSimilarityScore, 4);
  assert.equal(scored.reasons.includes('static-similarity:+4.00'), true);
  assert.equal(scored.reasons.includes('static-similarity-raw:0.80'), true);
  assert.equal(scored.score, 2.5 + (2 * 2.25) + 0.75 + 4);
});

test('scoreArchiveCandidateWithProfile prefers current corrections when stale static similarity is stronger', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-21T00:00:00.000Z');
  const cases = [
    {
      queryText: 'coding mascot',
      staleId: 'brass-fox-stale',
      currentId: 'copper-rabbit-current',
      staleText: 'Remember this exactly: my coding mascot is a brass fox.',
      currentText: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.',
      oldText: 'Coding mascot is a brass fox',
      newText: 'Coding mascot is a copper rabbit',
      conflictKey: 'coding mascot',
    },
    {
      queryText: 'arcade cashier watch',
      staleId: 'silver-watch-stale',
      currentId: 'gold-watch-current',
      staleText: 'My first anchor detail: the arcade cashier wore a silver watch with a cracked face.',
      currentText: 'Correction: the arcade cashier watch is gold now, not silver.',
      oldText: 'Arcade cashier watch is silver',
      newText: 'Arcade cashier watch is gold',
      conflictKey: 'arcade cashier watch',
    },
    {
      queryText: 'favorite tea',
      staleId: 'oolong-stale',
      currentId: 'lapsang-current',
      staleText: 'Favorite tea is oolong.',
      currentText: 'Correction: my favorite tea is lapsang souchong now, not oolong.',
      oldText: 'Favorite tea is oolong',
      newText: 'Favorite tea is lapsang souchong',
      conflictKey: 'favorite tea',
    },
  ];

  for (const item of cases) {
    const queryTokens = new Set(tokenizeMemoryText(item.queryText));
    const activeContradictions = [
      {
        id: `contr-${item.conflictKey.replace(/\s+/g, '-')}`,
        oldText: item.oldText,
        newText: item.newText,
        conflictKey: item.conflictKey,
        status: 'active',
        sourceEpisodeId: item.currentId,
      },
    ];
    const stale = policy.scoreArchiveCandidateWithProfile({
      id: item.staleId,
      text: item.staleText,
      sourceType: 'episode',
      scope: 'session',
      sourceAuthority: 'advisory',
      candidateChannels: ['static-embedding'],
      staticEmbedding: { similarity: 0.99 },
    }, {
      scoringProfile: 'hybrid-v1',
      queryText: item.queryText,
      queryTokens,
      now,
      activeContradictions,
    });
    const current = policy.scoreArchiveCandidateWithProfile({
      id: item.currentId,
      text: item.currentText,
      sourceType: 'episode',
      scope: 'session',
      sourceAuthority: 'advisory',
      candidateChannels: ['static-embedding'],
      staticEmbedding: { similarity: 0.62 },
    }, {
      scoringProfile: 'hybrid-v1',
      queryText: item.queryText,
      queryTokens,
      now,
      activeContradictions,
    });

    assert.ok(stale.baselineScore > current.baselineScore);
    assert.ok(stale.baselineScoreReasons.includes('static-similarity:+4.95'));
    assert.ok(current.baselineScoreReasons.includes('static-similarity:+3.10'));
    assert.ok(current.activeScore > stale.activeScore);
    assert.equal(
      current.activeScoreReasons.includes(`current-correction-boost:${item.conflictKey}:+2.40`),
      true,
    );
    assert.equal(
      stale.activeScoreReasons.includes(`stale-contradiction-penalty:${item.conflictKey}:-3.20`),
      true,
    );
  }
});

test('scoreArchiveCandidateHybridShadow reports exact-anchor boost without changing active score', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-21T00:00:00.000Z');
  const queryTokens = new Set(['favorite', 'tea']);
  const candidate = {
    id: 'tea-current',
    text: 'Correction episode: my favorite tea is lapsang souchong now.',
    sourceType: 'episode',
    scope: 'session',
    sensitivity: 'normal',
    createdAt: '2026-04-21T00:00:00.000Z',
  };

  const active = policy.scoreArchiveCandidate(candidate, queryTokens, now);
  const shadow = policy.scoreArchiveCandidateHybridShadow(candidate, {
    queryText: 'what is my favorite tea now?',
    queryTokens,
    now,
    baselineScore: active.score,
  });

  assert.equal(active.score, 2.5 + (2 * 2.25) + 1.5 + 0.75);
  assert.equal(shadow.components.baselineScore, active.score);
  assert.equal(shadow.components.exactAnchorScore, 1.75);
  assert.equal(shadow.components.sourceAuthorityScore, 0.7);
  assert.equal(shadow.reasons.includes('exact-anchor:favorite tea'), true);
  assert.equal(shadow.rank, null);
  assert.equal(shadow.wouldSelect, false);
});

test('scoreArchiveCandidateWithProfile activates hybrid-v1 without changing baseline score math', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-21T00:00:00.000Z');
  const queryTokens = new Set(['dryer', 'three']);
  const candidate = {
    id: 'exact-dryer-three',
    text: 'A silver thermos was sitting on dryer three at the laundromat.',
    sourceType: 'episode',
    scope: 'session',
    sensitivity: 'normal',
    createdAt: '2026-04-21T00:00:00.000Z',
  };

  const baseline = policy.scoreArchiveCandidateWithProfile(candidate, {
    scoringProfile: 'baseline',
    queryText: 'dryer three',
    queryTokens,
    now,
  });
  const hybrid = policy.scoreArchiveCandidateWithProfile(candidate, {
    scoringProfile: 'hybrid-v1',
    queryText: 'dryer three',
    queryTokens,
    now,
  });

  assert.equal(baseline.scoringProfile, 'baseline');
  assert.equal(hybrid.scoringProfile, 'hybrid-v1');
  assert.equal(baseline.activeScore, baseline.baselineScore);
  assert.equal(hybrid.baselineScore, baseline.baselineScore);
  assert.equal(hybrid.activeScore, hybrid.hybridV1Score);
  assert.ok(hybrid.activeScore > baseline.activeScore);
  assert.equal(hybrid.activeScoreComponents.baselineScore, baseline.baselineScore);
  assert.equal(hybrid.activeScoreReasons.some((reason) => reason.startsWith('exact-anchor:')), true);
});

test('scoreArchiveCandidateHybridShadow boosts current contradiction repairs and penalizes stale-only text', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const queryTokens = new Set(['favorite', 'tea']);
  const activeContradictions = [
    {
      id: 'contr-tea',
      oldText: 'Favorite tea is oolong',
      newText: 'Favorite tea is lapsang souchong',
      conflictKey: 'favorite tea',
      status: 'active',
    },
  ];

  const current = policy.scoreArchiveCandidateHybridShadow({
    id: 'tea-current',
    text: 'Favorite tea is lapsang souchong now.',
    sourceType: 'episode',
    scope: 'session',
  }, {
    queryText: 'favorite tea',
    queryTokens,
    baselineScore: 7,
    activeContradictions,
  });
  const stale = policy.scoreArchiveCandidateHybridShadow({
    id: 'tea-stale',
    text: 'Favorite tea is oolong.',
    sourceType: 'episode',
    scope: 'session',
  }, {
    queryText: 'favorite tea',
    queryTokens,
    baselineScore: 7,
    activeContradictions,
  });

  assert.equal(current.components.contradictionRepairScore, 2.4);
  assert.equal(stale.components.contradictionRepairScore, -3.2);
  assert.ok(current.score > stale.score);
  assert.equal(current.reasons.includes('contradiction-repair:favorite tea:+2.40'), true);
  assert.equal(stale.reasons.includes('stale-contradiction:favorite tea:-3.20'), true);
});

test('scoreArchiveCandidateWithProfile reports inactive link shadow scores without changing active score', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-22T17:30:00.000Z');
  const queryTokens = new Set(['coding', 'mascot']);
  const correctionLinks = buildCorrectionLinks({
    generatedAt: '2026-04-22T17:30:00.000Z',
    subject: 'coding mascot',
    staleItem: { id: 'archive:brass-fox', text: 'Coding mascot is a brass fox.' },
    currentItem: { id: 'memory:copper-rabbit', text: 'Coding mascot is a copper rabbit now.' },
    staleObject: 'brass fox',
    currentObject: 'copper rabbit',
    supportState: 'explicit',
    sourceReceipts: [{ type: 'turn', id: 'turn-correction' }],
  }, { now: '2026-04-22T17:30:00.000Z' });
  const currentCandidate = {
    id: 'memory:copper-rabbit',
    text: 'Coding mascot is a copper rabbit now.',
    sourceType: 'episode',
    scope: 'session',
    sourceAuthority: 'advisory',
  };
  const staleCandidate = {
    id: 'archive:brass-fox',
    text: 'Coding mascot is a brass fox.',
    sourceType: 'episode',
    scope: 'session',
    sourceAuthority: 'advisory',
  };

  const currentNoLinks = policy.scoreArchiveCandidateWithProfile(currentCandidate, {
    scoringProfile: 'baseline',
    queryText: 'coding mascot',
    queryTokens,
    now,
  });
  const currentWithLinks = policy.scoreArchiveCandidateWithProfile(currentCandidate, {
    scoringProfile: 'baseline',
    queryText: 'coding mascot',
    queryTokens,
    now,
    memoryLinks: correctionLinks.links,
  });
  const staleWithLinks = policy.scoreArchiveCandidateWithProfile(staleCandidate, {
    scoringProfile: 'baseline',
    queryText: 'coding mascot',
    queryTokens,
    now,
    memoryLinks: correctionLinks.links,
  });

  assert.equal(currentWithLinks.activeScore, currentNoLinks.activeScore);
  assert.deepEqual(currentWithLinks.activeScoreComponents, currentNoLinks.activeScoreComponents);
  assert.deepEqual(currentWithLinks.activeScoreReasons, currentNoLinks.activeScoreReasons);
  assert.equal(currentWithLinks.linkShadowScore.active, false);
  assert.equal(currentWithLinks.linkShadowScore.behaviorChanged, false);
  assert.equal(currentWithLinks.linkShadowScore.components.currentCorrectionBoost, 3);
  assert.equal(currentWithLinks.linkShadowScore.score, 3);
  assert.equal(
    currentWithLinks.linkShadowScore.shadowAdjustedScore,
    currentWithLinks.activeScore + 3,
  );
  assert.equal(staleWithLinks.linkShadowScore.components.stalePriorPenalty, -3.4);
  assert.equal(staleWithLinks.linkShadowScore.active, false);
});

test('scoreArchiveCandidateWithProfile gates active correction-link scoring behind correction-v1', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-22T18:05:00.000Z');
  const queryTokens = new Set(['coding', 'mascot']);
  const correctionLinks = buildCorrectionLinks({
    generatedAt: '2026-04-22T18:05:00.000Z',
    subject: 'coding mascot',
    staleItem: { id: 'archive:brass-fox', text: 'Coding mascot is a brass fox.' },
    currentItem: { id: 'memory:copper-rabbit', text: 'Coding mascot is a copper rabbit now.' },
    staleObject: 'brass fox',
    currentObject: 'copper rabbit',
    supportState: 'explicit',
    sourceReceipts: [{ type: 'turn', id: 'turn-correction' }],
  }, { now: '2026-04-22T18:05:00.000Z' });
  const currentCandidate = {
    id: 'memory:copper-rabbit',
    text: 'Coding mascot is a copper rabbit now.',
    sourceType: 'episode',
    scope: 'session',
    sourceAuthority: 'advisory',
  };
  const staleCandidate = {
    id: 'archive:brass-fox',
    text: 'Coding mascot is a brass fox.',
    sourceType: 'episode',
    scope: 'session',
    sourceAuthority: 'advisory',
  };

  const defaultScore = policy.scoreArchiveCandidateWithProfile(currentCandidate, {
    queryText: 'coding mascot',
    queryTokens,
    now,
    memoryLinks: correctionLinks.links,
  });
  const activeCurrent = policy.scoreArchiveCandidateWithProfile(currentCandidate, {
    queryText: 'coding mascot',
    queryTokens,
    now,
    memoryLinks: correctionLinks.links,
    memoryLinkScoring: 'correction-v1',
  });
  const activeStale = policy.scoreArchiveCandidateWithProfile(staleCandidate, {
    queryText: 'coding mascot',
    queryTokens,
    now,
    memoryLinks: correctionLinks.links,
    memoryLinkScoring: 'correction-v1',
  });

  assert.equal(normalizeMemoryLinkScoringMode('bogus'), 'shadow');
  assert.equal(defaultScore.memoryLinkScoring, 'shadow');
  assert.equal(defaultScore.activeScore, defaultScore.baselineScore);
  assert.equal(defaultScore.linkActiveScore.active, false);
  assert.equal(activeCurrent.memoryLinkScoring, 'correction-v1');
  assert.equal(activeCurrent.linkActiveScore.active, true);
  assert.equal(activeCurrent.linkActiveScore.behaviorChanged, true);
  assert.equal(activeCurrent.activeScore, activeCurrent.baselineScore + 1.5);
  assert.equal(activeCurrent.activeScoreComponents.memoryLinkCorrectionScore, 1.5);
  assert.equal(activeCurrent.activeScoreReasons.includes('active-current-correction-link:+1.50'), true);
  assert.equal(activeStale.activeScore, activeStale.baselineScore - 2.2);
  assert.equal(activeStale.activeScoreComponents.memoryLinkCorrectionScore, -2.2);
  assert.equal(activeStale.activeScoreReasons.includes('active-stale-prior-link:-2.20'), true);
});

test('correction-v1 active scoring ignores broad and candidate-only link authority', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-22T18:10:00.000Z');
  const queryTokens = new Set(['static', 'memory']);
  const candidateOnlyCorrection = buildCorrectionLinks({
    generatedAt: '2026-04-22T18:10:00.000Z',
    subject: 'static mascot',
    staleItem: { id: 'static:old-mascot', object: 'old mascot' },
    currentItem: { id: 'semantic:new-mascot', object: 'new mascot' },
    supportState: 'static-candidate',
  }, { now: '2026-04-22T18:10:00.000Z' });
  const broadLinks = [
    ...candidateOnlyCorrection.links,
    {
      id: 'same-project-thread',
      sourceId: 'plan:static-memory',
      targetId: 'memory:frame-budget',
      relation: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
      confidence: 'medium',
      support: { state: 'research' },
      directionality: 'bidirectional',
    },
  ];

  const project = policy.scoreArchiveCandidateWithProfile({
    id: 'plan:static-memory',
    text: 'Static memory sidecar plan.',
    sourceType: 'summary',
    scope: 'global',
  }, {
    queryText: 'static memory',
    queryTokens,
    now,
    memoryLinks: broadLinks,
    memoryLinkScoring: 'correction-v1',
  });
  const semanticCurrent = policy.scoreArchiveCandidateWithProfile({
    id: 'semantic:new-mascot',
    text: 'Semantic candidate says the mascot is new.',
    sourceType: 'episode',
    scope: 'session',
  }, {
    queryText: 'static memory',
    queryTokens,
    now,
    memoryLinks: broadLinks,
    memoryLinkScoring: 'correction-v1',
  });

  assert.equal(project.linkShadowScore.components.sameProjectThreadBoost, 0.45);
  assert.equal(project.linkActiveScore.active, true);
  assert.equal(project.linkActiveScore.score, 0);
  assert.equal(project.activeScore, project.baselineScore);
  assert.equal(project.activeScoreComponents.memoryLinkCorrectionScore, 0);
  assert.equal(project.linkActiveScore.reasons.includes('same-project-thread:shadow-only'), true);
  assert.equal(semanticCurrent.linkShadowScore.components.currentCorrectionBoost, 0);
  assert.equal(semanticCurrent.linkActiveScore.score, 0);
  assert.equal(semanticCurrent.activeScore, semanticCurrent.baselineScore);
  assert.equal(semanticCurrent.linkActiveScore.truthProof, false);
  assert.equal(semanticCurrent.linkActiveScore.candidateOnlyVerifiedSupport, false);
});

test('link shadow broad boosts stay advisory and weaker than correction shadows', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-22T17:35:00.000Z');
  const queryTokens = new Set(['static', 'memory']);
  const projectLinks = [
    {
      id: 'same-project-thread',
      sourceId: 'plan:static-memory',
      targetId: 'memory:frame-budget',
      relation: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
      confidence: 'medium',
      support: { state: 'research' },
      directionality: 'bidirectional',
    },
  ];
  const correctionLinks = buildCorrectionLinks({
    generatedAt: '2026-04-22T17:35:00.000Z',
    subject: 'memory mascot',
    staleItem: { id: 'archive:old-mascot', object: 'old mascot' },
    currentItem: { id: 'memory:new-mascot', object: 'new mascot' },
    supportState: 'explicit',
  }, { now: '2026-04-22T17:35:00.000Z' });

  const project = policy.scoreArchiveCandidateWithProfile({
    id: 'plan:static-memory',
    text: 'Static memory sidecar plan.',
    sourceType: 'summary',
    scope: 'global',
  }, {
    queryText: 'static memory',
    queryTokens,
    now,
    memoryLinks: projectLinks,
  });
  const current = policy.scoreArchiveCandidateWithProfile({
    id: 'memory:new-mascot',
    text: 'Memory mascot is new mascot now.',
    sourceType: 'episode',
    scope: 'session',
  }, {
    queryText: 'static memory',
    queryTokens,
    now,
    memoryLinks: correctionLinks.links,
  });

  assert.equal(project.linkShadowScore.components.sameProjectThreadBoost, 0.45);
  assert.equal(project.linkShadowScore.active, false);
  assert.ok(
    current.linkShadowScore.components.currentCorrectionBoost
      > project.linkShadowScore.components.sameProjectThreadBoost,
  );
  assert.equal(project.activeScore, project.baselineScore);
  assert.equal(current.activeScore, current.baselineScore);
});

test('selectOpenLoopsForCandidateMergeBudget skips low-priority loops only under tight budget', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const loops = [
    { id: 'urgent', text: 'Copper rabbit follow-up', priority: 'high' },
    { id: 'background', text: 'Someday polish docs', priority: 'low' },
    { id: 'numeric', text: 'Check receipt source', priorityScore: 0.82 },
  ];

  const normal = policy.selectOpenLoopsForCandidateMergeBudget(loops);
  const tight = policy.selectOpenLoopsForCandidateMergeBudget(loops, { skipLowPriority: true });

  assert.deepEqual(normal.openLoops.map((item) => item.id), ['urgent', 'background', 'numeric']);
  assert.equal(normal.skippedLowPriorityCount, 0);
  assert.deepEqual(tight.openLoops.map((item) => item.id), ['urgent', 'numeric']);
  assert.equal(tight.totalCount, 3);
  assert.equal(tight.scoredCount, 2);
  assert.equal(tight.skippedLowPriorityCount, 1);
});

test('buildCompressionState gates chapter fallback on session length and weak semantic retrieval', async () => {
  const policy = createMemoryArchivePolicyApi({
    sessionChapterTriggerCount: 7,
    compressionRetrievalConfidence: 0.48,
    sessionPromptLimit: 3,
    archiveCompressionReasonCodes: {
      NOT_NEEDED: 'compression_not_needed',
      SEMANTIC_UNAVAILABLE: 'compression_semantic_unavailable',
      LOW_RETRIEVAL_CONFIDENCE: 'compression_low_retrieval_confidence',
    },
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const chapter = { id: 'chapter-1', sourceType: 'chapter', text: 'Long-session tea details.' };
  const rankGroup = async (items = []) => items.slice(0, 1);
  const sessionWith = (count) => ({
    episodes: Array.from({ length: count }, (_item, index) => ({ id: `ep-${index + 1}`, text: `Episode ${index + 1}` })),
  });

  const tooShort = await policy.buildCompressionState({
    candidateGroups: { chapters: [chapter] },
    session: sessionWith(6),
    semanticMemory: { ready: false },
    strongestConfidence: 0,
    rankGroup,
  });
  const strongSemantic = await policy.buildCompressionState({
    candidateGroups: { chapters: [chapter] },
    session: sessionWith(7),
    semanticMemory: { ready: true },
    strongestConfidence: 0.49,
    rankGroup,
  });
  const weakSemantic = await policy.buildCompressionState({
    candidateGroups: { chapters: [chapter] },
    session: sessionWith(7),
    semanticMemory: { ready: true },
    strongestConfidence: 0.47,
    rankGroup,
  });
  const unavailableSemantic = await policy.buildCompressionState({
    candidateGroups: { chapters: [chapter] },
    session: sessionWith(7),
    semanticMemory: { ready: false },
    strongestConfidence: 0.8,
    rankGroup,
  });

  assert.equal(tooShort.compression.used, false);
  assert.equal(strongSemantic.compression.used, false);
  assert.equal(weakSemantic.compression.used, true);
  assert.equal(weakSemantic.compression.reasonCode, 'compression_low_retrieval_confidence');
  assert.equal(unavailableSemantic.compression.used, true);
  assert.equal(unavailableSemantic.compression.reasonCode, 'compression_semantic_unavailable');
});

test('scoreArchiveCandidate preserves lexical semantic and sensitivity ordering signals', () => {
  const policy = createMemoryArchivePolicyApi({
    tokenizeMemoryText,
    cosineSimilarity,
    trimText: (value = '', limit = 1600) => String(value || '').slice(0, limit),
  });
  const now = Date.parse('2026-04-21T00:00:00.000Z');
  const baseCandidate = {
    sourceType: 'episode',
    scope: 'session',
    sensitivity: 'normal',
    createdAt: '2026-04-21T00:00:00.000Z',
  };

  const lexicalWinner = policy.scoreArchiveCandidate({
    ...baseCandidate,
    id: 'candidate-a',
    text: 'Favorite tea detail.',
  }, new Set(['favorite', 'tea']), now);
  const lexicalLoser = policy.scoreArchiveCandidate({
    ...baseCandidate,
    id: 'candidate-b',
    text: 'Favorite coffee detail.',
  }, new Set(['favorite', 'tea']), now);

  assert.ok(lexicalWinner.score > lexicalLoser.score);

  const semanticWinner = policy.scoreArchiveCandidate({
    ...baseCandidate,
    id: 'semantic-a',
    text: 'Unrelated archive detail A.',
  }, new Set(), now, [1, 0], [1, 0]);
  const semanticLoser = policy.scoreArchiveCandidate({
    ...baseCandidate,
    id: 'semantic-b',
    text: 'Unrelated archive detail B.',
  }, new Set(), now, [1, 0], [0, 1]);

  assert.ok(semanticWinner.score > semanticLoser.score);

  const sensitiveWinner = policy.scoreArchiveCandidate({
    ...baseCandidate,
    id: 'candidate-a-sensitive',
    text: 'Favorite tea detail.',
    sensitivity: 'high',
  }, new Set(['favorite', 'tea']), now);

  assert.equal(sensitiveWinner.score, lexicalWinner.score - 1.5);
  assert.equal(sensitiveWinner.components.sensitivityPenalty, -1.5);
  assert.equal(sensitiveWinner.reasons.includes('sensitivity-penalty:-1.50'), true);
});
