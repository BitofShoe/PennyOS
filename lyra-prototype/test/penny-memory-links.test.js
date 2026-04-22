const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_MEMORY_LINKS_SCHEMA,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_DIRECTIONALITY,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
  findLinksForItem,
  invertDirectedLink,
  normalizeMemoryLink,
  normalizeMemoryLinkSet,
  summarizeMemoryLinks,
  validateMemoryLink,
} = require('../lib/penny-memory-links');

const NOW = '2026-04-22T16:00:00.000Z';

test('normalizes valid relation types into advisory memory links', () => {
  const link = normalizeMemoryLink({
    id: 'Mascot correction link',
    sourceId: 'memory:new-mascot',
    targetId: 'memory:old-mascot',
    relation: 'correction of',
    confidence: 'high',
    support: {
      state: 'explicit memory',
      sourceReceipts: [
        { type: 'turn', id: 'turn-7', excerpt: 'Actually, the mascot is copper rabbit now.' },
      ],
      explanation: 'User explicitly corrected the mascot.',
    },
    authorityEffect: 'stale-current-penalty',
    directionality: 'directed',
    createdBy: 'deterministic',
    createdAt: NOW,
  });

  assert.equal(link.id, 'mascot-correction-link');
  assert.equal(link.sourceId, 'memory:new-mascot');
  assert.equal(link.targetId, 'memory:old-mascot');
  assert.equal(link.relation, MEMORY_LINK_RELATIONS.CORRECTION_OF);
  assert.equal(link.confidence, 'high');
  assert.equal(link.support.state, MEMORY_LINK_SUPPORT_STATES.EXPLICIT);
  assert.equal(link.support.authority, 'advisory');
  assert.equal(link.support.sourceReceipts[0].type, 'turn');
  assert.equal(link.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY);
  assert.equal(link.directionality, MEMORY_LINK_DIRECTIONALITY.DIRECTED);
  assert.equal(link.reviewState, 'needs-review');
  assert.equal(link.advisoryOnly, true);
  assert.equal(link.truthProof, false);
  assert.equal(link.canonicalMemoryWrite, false);
  assert.equal(link.promptTruthExpanded, false);
  assert.equal(link.toolEvidenceReceiptChanged, false);
});

test('rejects invalid relation types without inventing a link', () => {
  assert.equal(normalizeMemoryLink({
    sourceId: 'memory:a',
    targetId: 'memory:b',
    relation: 'definitely-proves',
  }), null);

  const validation = validateMemoryLink({
    sourceId: 'memory:a',
    targetId: 'memory:b',
    relation: 'definitely-proves',
  });
  assert.equal(validation.valid, false);
  assert.deepEqual(validation.errors, ['invalid relation']);

  const set = normalizeMemoryLinkSet({
    generatedAt: NOW,
    links: [
      { sourceId: 'memory:a', targetId: 'memory:b', relation: 'supports' },
      { sourceId: 'memory:a', targetId: 'memory:c', relation: 'definitely-proves' },
    ],
  });
  assert.equal(set.links.length, 1);
  assert.equal(set.heldBack.length, 1);
  assert.equal(set.heldBack[0].reason, 'invalid relation');
});

test('defaults safe authority effects and advisory support state', () => {
  const projectThread = normalizeMemoryLink({
    sourceId: 'archive:static-embedding',
    targetId: 'ledger:prompttruth-boundary',
    relation: 'same project thread',
    createdAt: NOW,
  });
  const correction = normalizeMemoryLink({
    sourceId: 'memory:new-fact',
    targetId: 'memory:old-fact',
    relation: 'correction-of',
    createdAt: NOW,
  });

  assert.equal(projectThread.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY);
  assert.equal(projectThread.support.state, MEMORY_LINK_SUPPORT_STATES.UNKNOWN);
  assert.equal(projectThread.support.authority, 'advisory');
  assert.equal(projectThread.reviewState, 'auto-safe');
  assert.equal(correction.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.NONE);
  assert.equal(correction.support.state, MEMORY_LINK_SUPPORT_STATES.UNKNOWN);
});

test('candidate-only static and semantic links cannot become verified support', () => {
  const link = normalizeMemoryLink({
    sourceId: 'static:candidate-1',
    targetId: 'memory:explicit-1',
    relation: 'supports',
    support: {
      state: 'static-candidate',
      sourceReceipts: ['static sidecar candidate only'],
    },
    authorityEffect: 'current-truth-boost',
    createdAt: NOW,
  });
  const validation = validateMemoryLink({
    sourceId: 'static:candidate-1',
    targetId: 'memory:explicit-1',
    relation: 'supports',
    support: { state: 'semantic-candidate' },
    authorityEffect: 'current-truth-boost',
    createdAt: NOW,
  });

  assert.equal(link.support.state, MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE);
  assert.equal(link.support.authority, 'advisory');
  assert.equal(link.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY);
  assert.equal(link.truthProof, false);
  assert.equal(link.canonicalMemoryWrite, false);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.warnings, ['authority effect was downgraded for advisory-only support']);
});

test('link summaries count relation types and authority effects', () => {
  const links = [
    normalizeMemoryLink({
      sourceId: 'memory:new-mascot',
      targetId: 'memory:old-mascot',
      relation: 'correction-of',
      support: { state: 'explicit' },
      authorityEffect: 'stale-current-penalty',
      createdAt: NOW,
    }),
    normalizeMemoryLink({
      sourceId: 'archive:static-memory',
      targetId: 'ledger:prompttruth',
      relation: 'research-pattern-for',
      support: { state: 'research' },
      createdAt: NOW,
    }),
    normalizeMemoryLink({
      sourceId: 'open-loop:memory-links',
      targetId: 'plan:l1',
      relation: 'follow-up-to',
      directionality: 'bidirectional',
      createdAt: NOW,
    }),
  ];
  const summary = summarizeMemoryLinks(links);

  assert.equal(summary.totalLinks, 3);
  assert.equal(summary.byRelation[MEMORY_LINK_RELATIONS.CORRECTION_OF], 1);
  assert.equal(summary.byRelation[MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR], 1);
  assert.equal(summary.byRelation[MEMORY_LINK_RELATIONS.FOLLOW_UP_TO], 1);
  assert.equal(summary.byAuthorityEffect[MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY], 1);
  assert.equal(summary.byAuthorityEffect[MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY], 2);
  assert.equal(summary.needsReview, 1);
  assert.equal(summary.authorityAffectingLinks, 1);
  assert.equal(summary.directedCount, 2);
  assert.equal(summary.bidirectionalCount, 1);
});

test('directed and bidirectional lookup behavior stays explicit', () => {
  const links = [
    {
      id: 'directed',
      sourceId: 'memory:new-mascot',
      targetId: 'memory:old-mascot',
      relation: 'current-correction-for',
      directionality: 'directed',
      createdAt: NOW,
    },
    {
      id: 'bidirectional',
      sourceId: 'project:static-memory',
      targetId: 'project:prompttruth',
      relation: 'same-project-thread',
      directionality: 'bidirectional',
      createdAt: NOW,
    },
  ];

  assert.deepEqual(findLinksForItem(links, 'memory:new-mascot', { direction: 'outgoing' }).map((link) => link.id), ['directed']);
  assert.deepEqual(findLinksForItem(links, 'memory:new-mascot', { direction: 'incoming' }), []);
  assert.deepEqual(findLinksForItem(links, 'project:prompttruth', { direction: 'outgoing' }).map((link) => link.id), ['bidirectional']);
  assert.deepEqual(findLinksForItem(links, 'project:prompttruth', { direction: 'outgoing', includeBidirectional: false }), []);

  const inverted = invertDirectedLink(links[0]);
  assert.equal(inverted.id, 'directed:inverse');
  assert.equal(inverted.sourceId, 'memory:old-mascot');
  assert.equal(inverted.targetId, 'memory:new-mascot');
  assert.equal(inverted.relation, MEMORY_LINK_RELATIONS.STALE_PRIOR_OF);
  assert.equal(inverted.invertedFrom, 'directed');
});

test('normalizes a memory link set artifact without behavior changes', () => {
  const artifact = normalizeMemoryLinkSet({
    generatedAt: NOW,
    measurementMode: 'archive-unit',
    behaviorChanged: true,
    links: [
      {
        sourceId: 'memory:new-tea',
        targetId: 'memory:old-tea',
        relation: 'current-correction-for',
        support: { state: 'explicit' },
        authorityEffect: 'do-not-render-as-current',
      },
      {
        sourceId: 'research:ledger-bridge',
        targetId: 'research:static-embedding',
        relation: 'research-pattern-for',
        supportState: 'research-ledger',
      },
    ],
  });

  assert.equal(artifact.schema, PENNY_MEMORY_LINKS_SCHEMA);
  assert.equal(artifact.generatedAt, NOW);
  assert.equal(artifact.measurementMode, 'archive-unit');
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.links.length, 2);
  assert.equal(artifact.summary.totalLinks, 2);
  assert.equal(artifact.summary.authorityAffectingLinks, 1);
  assert.equal(artifact.summary.bySupportState[MEMORY_LINK_SUPPORT_STATES.EXPLICIT], 1);
  assert.equal(artifact.summary.bySupportState[MEMORY_LINK_SUPPORT_STATES.RESEARCH], 1);
  assert.match(artifact.limits.join('\n'), /advisory retrieval\/navigation hints/);
  assert.match(artifact.limits.join('\n'), /do not make advisory memory canonical/);
});
