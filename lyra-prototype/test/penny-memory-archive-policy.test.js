const test = require('node:test');
const assert = require('node:assert/strict');

const { createMemoryArchivePolicyApi } = require('../lib/penny-memory-archive-policy');

function tokenizeMemoryText(text = '') {
  return String(text || '')
    .toLowerCase()
    .match(/[a-z0-9]+/g) || [];
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
    + scored.components.recency
    + scored.components.sessionScope
    + scored.components.sensitivityPenalty);
  assert.deepEqual(scored.overlapTokens, ['favorite', 'tea']);
  assert.deepEqual(scored.components, {
    sourceTypeBase: 2.5,
    lexicalOverlap: 4.5,
    semanticSimilarity: 0.6,
    semanticSimilarityScore: 4.8,
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
    recency: 0,
    sessionScope: 0,
    sensitivityPenalty: 0,
  });
  assert.deepEqual(scored.reasons, [
    'source:summary',
    'lexical-overlap:midnight,rain',
  ]);
});
