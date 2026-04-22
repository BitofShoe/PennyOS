const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createMemoryArchivePolicyApi,
  normalizeArchiveScoringProfile,
} = require('../lib/penny-memory-archive-policy');

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
});
