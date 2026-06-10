const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_MEMORY_LINKS_SCHEMA,
  PENNY_MEMORY_LINK_SEMANTIC_CONTRACT_SCHEMA,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_DIRECTIONALITY,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_RELATION_PREDICATE_IDS,
  MEMORY_LINK_SUPPORT_STATES,
  PENNY_MEMORY_LINK_TRACE_SCHEMA,
  buildMemoryLinkTraceForItem,
  findLinksForItem,
  invertDirectedLink,
  normalizeMemoryLink,
  normalizeMemoryLinkSet,
  relationToPredicateId,
  summarizeMemoryLinks,
  validateMemoryLink,
} = require('../lib/penny-memory-links');
const {
  SEMANTIC_ID_KINDS,
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticSourceId,
  validateSemanticId,
} = require('../lib/penny-semantic-ids');
const {
  SEMANTIC_DOMAIN_IDS,
} = require('../lib/penny-semantic-domains');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('../lib/penny-semantic-predicates');

const NOW = '2026-04-22T16:00:00.000Z';

function semanticClaimIdFor({ objectText, sourceId, temporalScope = 'current' }) {
  return buildSemanticClaimId({
    subjectId: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }),
    predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    objectText,
    sourceId,
    domainId: temporalScope === 'current'
      ? SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY
      : SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    temporalScope,
  });
}

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
  assert.equal(link.predicateId, SEMANTIC_PREDICATE_IDS.CORRECTION_OF);
  assert.equal(validateSemanticId(link.linkId, SEMANTIC_ID_KINDS.LINK).valid, true);
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

test('normalizes structured dynamic links with semantic ids and registered predicates', () => {
  const explicitSourceId = buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'memory:copper-rabbit' });
  const archiveSourceId = buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'archive:brass-fox' });
  const currentClaimId = semanticClaimIdFor({ objectText: 'copper rabbit', sourceId: explicitSourceId });
  const staleClaimId = semanticClaimIdFor({
    objectText: 'brass fox',
    sourceId: archiveSourceId,
    temporalScope: 'historical',
  });
  const link = normalizeMemoryLink({
    sourceClaimId: currentClaimId,
    targetClaimId: staleClaimId,
    predicateId: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    domainId: SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
    sourceAuthority: 'canonical',
    supportState: 'verified',
    evidence: [
      {
        sourceId: explicitSourceId,
        excerpt: 'Actually the coding mascot is copper rabbit now.',
        observedAt: NOW,
      },
    ],
    relation: 'correction-of',
    confidence: 'high',
    support: { state: 'explicit' },
    authorityEffect: 'current-truth-boost',
    createdAt: NOW,
  });
  const validation = validateMemoryLink(link);

  assert.equal(validation.valid, true);
  assert.equal(link.sourceId, currentClaimId);
  assert.equal(link.targetId, staleClaimId);
  assert.equal(link.sourceClaimId, currentClaimId);
  assert.equal(link.targetClaimId, staleClaimId);
  assert.equal(link.predicateId, SEMANTIC_PREDICATE_IDS.CORRECTION_OF);
  assert.equal(link.semanticContract.schema, PENNY_MEMORY_LINK_SEMANTIC_CONTRACT_SCHEMA);
  assert.equal(validateSemanticId(link.linkId, SEMANTIC_ID_KINDS.LINK).valid, true);
  assert.equal(link.sourceAuthority, 'canonical');
  assert.equal(link.supportState, 'verified');
  assert.equal(link.semanticContract.canonicality, 'not-canonical');
  assert.equal(link.canInfluenceRanking, true);
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

test('structured dynamic links fail closed on unknown predicates or missing claim endpoints', () => {
  const sourceId = buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'memory:copper-rabbit' });
  const currentClaimId = semanticClaimIdFor({ objectText: 'copper rabbit', sourceId });
  const staleClaimId = semanticClaimIdFor({
    objectText: 'brass fox',
    sourceId: buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'archive:brass-fox' }),
    temporalScope: 'historical',
  });
  const unknownPredicate = validateMemoryLink({
    sourceClaimId: currentClaimId,
    targetClaimId: staleClaimId,
    predicateId: 'penny:predicate:definitely-proves',
    relation: 'correction-of',
  });
  const missingSourceClaim = validateMemoryLink({
    sourceId: 'memory:copper-rabbit',
    targetClaimId: staleClaimId,
    predicateId: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    relation: 'correction-of',
  });
  const labelOnlyPredicate = validateMemoryLink({
    sourceClaimId: currentClaimId,
    targetClaimId: staleClaimId,
    predicate: { label: 'correction of' },
    relation: 'correction-of',
  });

  assert.equal(unknownPredicate.valid, false);
  assert.equal(unknownPredicate.errors.includes('unregistered semantic predicate'), true);
  assert.equal(missingSourceClaim.valid, false);
  assert.equal(missingSourceClaim.errors.includes('missing or invalid sourceClaimId'), true);
  assert.equal(labelOnlyPredicate.valid, false);
  assert.equal(
    labelOnlyPredicate.errors.includes('predicate label cannot decide behavior without registered predicate id'),
    true,
  );
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

test('candidate-only semantic links stay advisory and cannot influence ranking', () => {
  const staticSourceId = buildSemanticSourceId({ sourceType: 'static-candidate', sourceId: 'static:candidate:rain' });
  const explicitSourceId = buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'memory:weather-note' });
  const candidateClaimId = semanticClaimIdFor({
    objectText: 'silver thermos',
    sourceId: staticSourceId,
    temporalScope: 'unknown',
  });
  const explicitClaimId = semanticClaimIdFor({ objectText: 'blue bottle', sourceId: explicitSourceId });
  const link = normalizeMemoryLink({
    sourceClaimId: candidateClaimId,
    targetClaimId: explicitClaimId,
    predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CORRECTION_FOR,
    sourceAuthority: 'canonical',
    supportState: 'candidate-only',
    relation: 'current-correction-for',
    support: { state: 'static-candidate' },
    authorityEffect: 'current-truth-boost',
    createdAt: NOW,
  });

  assert.equal(link.sourceAuthority, 'candidate-only');
  assert.equal(link.supportState, 'candidate-only');
  assert.equal(link.canInfluenceRanking, false);
  assert.equal(link.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.NONE);
  assert.equal(link.semanticContract.truthProof, false);
  assert.equal(link.semanticContract.canonicalMemoryWrite, false);
});

test('related-but-weak collision links stay non-authoritative even for near-name entities', () => {
  const localProject = buildSemanticEntityId({ entityType: 'project', entityKey: 'aim-labs-local' });
  const publicProject = buildSemanticEntityId({ entityType: 'project', entityKey: 'aim-labs-public' });
  const localClaimId = buildSemanticClaimId({
    subjectId: localProject,
    predicateId: SEMANTIC_PREDICATE_IDS.PROJECT_FOCUS,
    objectText: 'local runtime',
    sourceId: buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'local-runtime' }),
    domainId: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    temporalScope: 'current',
  });
  const publicClaimId = buildSemanticClaimId({
    subjectId: publicProject,
    predicateId: SEMANTIC_PREDICATE_IDS.PROJECT_FOCUS,
    objectText: 'public repo',
    sourceId: buildSemanticSourceId({ sourceType: 'static-candidate', sourceId: 'public-repo' }),
    domainId: SEMANTIC_DOMAIN_IDS.STATIC_MEMORY,
    temporalScope: 'current',
  });
  const link = normalizeMemoryLink({
    sourceClaimId: publicClaimId,
    targetClaimId: localClaimId,
    relation: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
    support: { state: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE },
    sourceAuthority: 'candidate-only',
    authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
    createdAt: NOW,
  });

  assert.equal(link.relation, MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK);
  assert.equal(link.canInfluenceRanking, false);
  assert.equal(link.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY);
  assert.equal(link.truthProof, false);
  assert.equal(link.canonicalMemoryWrite, false);
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

test('semantic correction inverses are generated only when configured', () => {
  const explicitSourceId = buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'memory:copper-rabbit' });
  const archiveSourceId = buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'archive:brass-fox' });
  const currentClaimId = semanticClaimIdFor({ objectText: 'copper rabbit', sourceId: explicitSourceId });
  const staleClaimId = semanticClaimIdFor({
    objectText: 'brass fox',
    sourceId: archiveSourceId,
    temporalScope: 'historical',
  });
  const link = {
    sourceClaimId: currentClaimId,
    targetClaimId: staleClaimId,
    predicateId: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    relation: 'correction-of',
    support: { state: 'explicit' },
    createdAt: NOW,
  };
  const defaultSet = normalizeMemoryLinkSet({ links: [link], generatedAt: NOW });
  const inverseSet = normalizeMemoryLinkSet({
    links: [link],
    includeSemanticInverses: true,
    generatedAt: NOW,
  });
  const inverse = inverseSet.links.find((item) => item.relation === MEMORY_LINK_RELATIONS.STALE_PRIOR_OF);

  assert.equal(defaultSet.links.length, 1);
  assert.equal(inverseSet.links.length, 2);
  assert.equal(inverse.sourceClaimId, staleClaimId);
  assert.equal(inverse.targetClaimId, currentClaimId);
  assert.equal(inverse.predicateId, SEMANTIC_PREDICATE_IDS.STALE_PRIOR);
  assert.equal(relationToPredicateId(MEMORY_LINK_RELATIONS.STALE_PRIOR_OF), SEMANTIC_PREDICATE_IDS.STALE_PRIOR);
  assert.equal(MEMORY_LINK_RELATION_PREDICATE_IDS[MEMORY_LINK_RELATIONS.CORRECTION_OF], SEMANTIC_PREDICATE_IDS.CORRECTION_OF);
});

test('buildMemoryLinkTraceForItem returns bounded advisory-only trace metadata', () => {
  const links = normalizeMemoryLinkSet({
    generatedAt: NOW,
    measurementMode: 'live-shadow',
    links: [
      {
        sourceId: 'memory:copper-rabbit',
        targetId: 'archive:brass-fox',
        relation: 'current-correction-for',
        support: { state: 'explicit' },
        authorityEffect: 'current-truth-boost',
      },
      {
        sourceId: 'archive:brass-fox',
        targetId: 'memory:copper-rabbit',
        relation: 'stale-prior-of',
        support: { state: 'explicit' },
        authorityEffect: 'stale-current-penalty',
      },
      {
        sourceId: 'memory:copper-rabbit',
        targetId: 'project:frame-budget',
        relation: 'same-project-thread',
      },
    ],
  });

  const bounded = buildMemoryLinkTraceForItem(links, 'memory:copper-rabbit', { linkTraceLimit: 2 });
  const full = buildMemoryLinkTraceForItem(links, 'memory:copper-rabbit', { linkTraceLimit: 6 });

  assert.equal(bounded.schema, PENNY_MEMORY_LINK_TRACE_SCHEMA);
  assert.equal(bounded.totalLinks, 2);
  assert.equal(bounded.advisoryOnly, true);
  assert.equal(bounded.truthProof, false);
  assert.equal(bounded.scoringActive, false);
  assert.equal(bounded.behaviorChanged, false);
  assert.equal(bounded.incoming.length + bounded.outgoing.length, 2);
  assert.equal(full.relationSummary.currentCorrectionFor, 1);
  assert.equal(full.relationSummary.stalePriorOf, 1);
  assert.equal(full.relationSummary.sameProjectThread, 1);
  assert.equal(full.authorityEffects.includes(MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST), true);
  assert.equal(full.authorityEffects.includes(MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY), true);
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
