const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
} = require('../lib/penny-memory-links');
const {
  PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
  PENNY_MEMORY_LINK_ACTIVE_SCORE_SCHEMA,
  PENNY_MEMORY_LINK_SHADOW_SCORE_SCHEMA,
  MEMORY_LINK_SCORING_MODES,
  buildCorrectionLinks,
  normalizeMemoryLinkScoringMode,
  scoreMemoryLinkCorrectionActiveForCandidate,
  scoreMemoryLinkShadowForCandidate,
  scoreMemoryLinkShadowForCandidates,
} = require('../lib/penny-memory-link-policy');

const NOW = '2026-04-22T17:00:00.000Z';

function linkByRelation(artifact, relation) {
  return artifact.links.find((link) => link.relation === relation);
}

test('buildCorrectionLinks creates explicit brass fox to copper rabbit correction links without scoring', () => {
  const artifact = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'coding mascot',
    staleItem: {
      id: 'archive:brass-fox',
      text: 'The coding mascot was a brass fox.',
    },
    currentItem: {
      id: 'memory:copper-rabbit',
      text: 'The coding mascot is a copper rabbit now.',
    },
    staleObject: 'brass fox',
    currentObject: 'copper rabbit',
    supportState: 'explicit-user-correction',
    sourceReceipts: [
      { type: 'turn', id: 'turn-11', excerpt: 'Actually, the coding mascot is copper rabbit now, not brass fox.' },
    ],
  }, { now: NOW });

  const current = linkByRelation(artifact, MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR);
  const stale = linkByRelation(artifact, MEMORY_LINK_RELATIONS.STALE_PRIOR_OF);
  const correction = linkByRelation(artifact, MEMORY_LINK_RELATIONS.CORRECTION_OF);

  assert.equal(artifact.builderSchema, PENNY_CORRECTION_LINK_BUILDER_SCHEMA);
  assert.equal(artifact.generatedAt, NOW);
  assert.equal(artifact.links.length, 3);
  assert.equal(artifact.behaviorChanged, false);
  assert.equal(artifact.scoringActive, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.canonicalMemoryWrite, false);
  assert.equal(artifact.correctionTrace.strongSupport, true);
  assert.equal(artifact.correctionTrace.subject, 'coding mascot');
  assert.equal(artifact.correctionTrace.staleObject, 'brass fox');
  assert.equal(artifact.correctionTrace.currentObject, 'copper rabbit');
  assert.equal(current.sourceId, 'memory:copper-rabbit');
  assert.equal(current.targetId, 'archive:brass-fox');
  assert.equal(current.support.state, MEMORY_LINK_SUPPORT_STATES.EXPLICIT);
  assert.equal(current.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST);
  assert.equal(current.truthProof, false);
  assert.equal(stale.sourceId, 'archive:brass-fox');
  assert.equal(stale.targetId, 'memory:copper-rabbit');
  assert.equal(stale.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY);
  assert.equal(correction.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.NONE);
  assert.equal(artifact.summary.byRelation[MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR], 1);
  assert.equal(artifact.summary.byRelation[MEMORY_LINK_RELATIONS.STALE_PRIOR_OF], 1);
  assert.equal(artifact.summary.byRelation[MEMORY_LINK_RELATIONS.CORRECTION_OF], 1);
});

test('buildCorrectionLinks handles explicit oolong to lapsang souchong correction aliases', () => {
  const artifact = buildCorrectionLinks({
    generatedAt: NOW,
    topic: 'favorite tea',
    oldValue: 'oolong',
    newValue: 'lapsang souchong',
    staleItem: { memoryId: 'archive:tea-oolong', text: 'Favorite tea is oolong.' },
    currentItem: { memoryId: 'memory:tea-lapsang', text: 'Favorite tea is lapsang souchong now.' },
    supportState: 'verified',
    receipts: ['user corrected favorite tea during direct memory write'],
  }, { now: NOW });

  const current = linkByRelation(artifact, MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR);
  const stale = linkByRelation(artifact, MEMORY_LINK_RELATIONS.STALE_PRIOR_OF);

  assert.equal(artifact.links.length, 3);
  assert.equal(artifact.correctionTrace.subject, 'favorite tea');
  assert.equal(artifact.correctionTrace.staleObject, 'oolong');
  assert.equal(artifact.correctionTrace.currentObject, 'lapsang souchong');
  assert.equal(artifact.correctionTrace.supportState, MEMORY_LINK_SUPPORT_STATES.EXPLICIT);
  assert.equal(artifact.correctionTrace.sourceReceiptCount, 1);
  assert.equal(current.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST);
  assert.equal(stale.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY);
});

test('buildCorrectionLinks can encode stronger stale suppression for silver watch to gold watch', () => {
  const artifact = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'cashier watch',
    staleItem: { id: 'archive:silver-watch', object: 'silver watch' },
    currentItem: { id: 'memory:gold-watch', object: 'gold watch' },
    supportState: 'explicit',
    staleAuthorityEffect: 'do-not-render-as-current',
    sourceReceipts: [{ type: 'artifact', id: 'candidate-survival-watch-correction' }],
  }, { now: NOW });

  const stale = linkByRelation(artifact, MEMORY_LINK_RELATIONS.STALE_PRIOR_OF);

  assert.equal(artifact.correctionTrace.staleObject, 'silver watch');
  assert.equal(artifact.correctionTrace.currentObject, 'gold watch');
  assert.equal(stale.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT);
  assert.equal(artifact.summary.authorityAffectingLinks, 2);
});

test('candidate-only correction links stay advisory and cannot become current-truth boosts', () => {
  const artifact = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'dryer three object',
    staleItem: { id: 'static:laundromat-silver-thermos', object: 'silver thermos' },
    currentItem: { id: 'semantic:laundromat-blue-bottle', object: 'blue bottle' },
    supportState: 'static-candidate',
    sourceReceipts: [{ type: 'static-sidecar', id: 'candidate-only' }],
  }, { now: NOW });

  const current = linkByRelation(artifact, MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR);
  const stale = linkByRelation(artifact, MEMORY_LINK_RELATIONS.STALE_PRIOR_OF);

  assert.equal(artifact.links.length, 3);
  assert.equal(artifact.correctionTrace.strongSupport, false);
  assert.equal(artifact.correctionTrace.candidateOnlyVerifiedSupport, false);
  assert.equal(current.support.state, MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE);
  assert.equal(current.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.NONE);
  assert.equal(stale.authorityEffect, MEMORY_LINK_AUTHORITY_EFFECTS.NONE);
  assert.equal(artifact.summary.authorityAffectingLinks, 0);
  assert.equal(current.truthProof, false);
  assert.equal(current.canonicalMemoryWrite, false);
});

test('buildCorrectionLinks holds back incomplete correction inputs instead of inventing proof', () => {
  const artifact = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'incomplete correction',
    currentItem: { id: 'memory:only-current', object: 'current value' },
    supportState: 'explicit',
  }, { now: NOW });

  assert.equal(artifact.links.length, 0);
  assert.equal(artifact.heldBack.length, 1);
  assert.equal(artifact.heldBack[0].reason, 'missing stale/current correction endpoints');
  assert.equal(artifact.correctionTrace.strongSupport, false);
  assert.equal(artifact.scoringActive, false);
  assert.equal(artifact.behaviorChanged, false);
});

test('scoreMemoryLinkShadowForCandidate boosts explicit current corrections without activating scoring', () => {
  const linkSet = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'coding mascot',
    staleItem: { id: 'archive:brass-fox', text: 'The mascot was a brass fox.' },
    currentItem: { id: 'memory:copper-rabbit', text: 'The mascot is a copper rabbit now.' },
    staleObject: 'brass fox',
    currentObject: 'copper rabbit',
    supportState: 'explicit',
    sourceReceipts: [{ type: 'turn', id: 'turn-correction' }],
  }, { now: NOW });

  const shadow = scoreMemoryLinkShadowForCandidate({
    id: 'memory:copper-rabbit',
    activeScore: 4.25,
    sourceAuthority: 'advisory',
  }, {
    memoryLinks: linkSet.links,
  });

  assert.equal(shadow.schema, PENNY_MEMORY_LINK_SHADOW_SCORE_SCHEMA);
  assert.equal(shadow.active, false);
  assert.equal(shadow.behaviorChanged, false);
  assert.equal(shadow.advisoryOnly, true);
  assert.equal(shadow.truthProof, false);
  assert.equal(shadow.promptTruthExpanded, false);
  assert.equal(shadow.toolEvidenceReceiptChanged, false);
  assert.equal(shadow.candidateOnlyVerifiedSupport, false);
  assert.equal(shadow.components.currentCorrectionBoost, 3);
  assert.equal(shadow.components.stalePriorPenalty, 0);
  assert.equal(shadow.score, 3);
  assert.equal(shadow.shadowAdjustedScore, 7.25);
  assert.equal(shadow.reasons.includes('current-correction-link:+3.00'), true);
  assert.equal(shadow.wouldChangeRank, false);
});

test('scoreMemoryLinkCorrectionActiveForCandidate activates only explicit correction components behind correction-v1', () => {
  const linkSet = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'coding mascot',
    staleItem: { id: 'archive:brass-fox', text: 'The mascot was a brass fox.' },
    currentItem: { id: 'memory:copper-rabbit', text: 'The mascot is a copper rabbit now.' },
    staleObject: 'brass fox',
    currentObject: 'copper rabbit',
    supportState: 'explicit',
    sourceReceipts: [{ type: 'turn', id: 'turn-correction' }],
  }, { now: NOW });
  const broadLinks = [
    ...linkSet.links,
    {
      id: 'project-thread-link',
      sourceId: 'memory:copper-rabbit',
      targetId: 'plan:static-live',
      relation: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
      confidence: 'medium',
      support: { state: 'research' },
      directionality: 'bidirectional',
    },
  ];

  const shadowMode = scoreMemoryLinkCorrectionActiveForCandidate({
    id: 'memory:copper-rabbit',
    activeScore: 4.25,
  }, {
    memoryLinks: broadLinks,
    memoryLinkScoring: 'shadow',
  });
  const activeMode = scoreMemoryLinkCorrectionActiveForCandidate({
    id: 'memory:copper-rabbit',
    activeScore: 4.25,
  }, {
    memoryLinks: broadLinks,
    memoryLinkScoring: 'correction-v1',
  });

  assert.equal(normalizeMemoryLinkScoringMode('correction'), MEMORY_LINK_SCORING_MODES.CORRECTION_V1);
  assert.equal(shadowMode.schema, PENNY_MEMORY_LINK_ACTIVE_SCORE_SCHEMA);
  assert.equal(shadowMode.active, false);
  assert.equal(shadowMode.score, 0);
  assert.equal(activeMode.active, true);
  assert.equal(activeMode.behaviorChanged, true);
  assert.equal(activeMode.score, 1.5);
  assert.equal(activeMode.components.currentCorrectionBoost, 1.5);
  assert.equal(activeMode.ignoredComponents.sameProjectThreadBoost, 0.45);
  assert.equal(activeMode.reasons.includes('active-current-correction-link:+1.50'), true);
  assert.equal(activeMode.reasons.includes('same-project-thread:shadow-only'), true);
  assert.equal(activeMode.truthProof, false);
});

test('scoreMemoryLinkShadowForCandidate penalizes explicit stale priors without changing active rank', () => {
  const linkSet = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'cashier watch',
    staleItem: { id: 'archive:silver-watch', object: 'silver watch' },
    currentItem: { id: 'memory:gold-watch', object: 'gold watch' },
    supportState: 'explicit',
    staleAuthorityEffect: 'do-not-render-as-current',
    sourceReceipts: [{ type: 'artifact', id: 'watch-correction' }],
  }, { now: NOW });

  const shadow = scoreMemoryLinkShadowForCandidate({
    id: 'archive:silver-watch',
    activeScore: 8.1,
  }, {
    memoryLinks: linkSet.links,
    activeRank: 1,
    shadowRank: 3,
  });

  assert.equal(shadow.active, false);
  assert.equal(shadow.components.currentCorrectionBoost, 0);
  assert.equal(shadow.components.stalePriorPenalty, -4.6);
  assert.equal(shadow.score, -4.6);
  assert.equal(shadow.shadowAdjustedScore, 3.5);
  assert.equal(shadow.rankDelta, -2);
  assert.equal(shadow.wouldChangeRank, true);
  assert.equal(shadow.reasons.includes('stale-prior-link:-4.60'), true);
});

test('link shadow scoring keeps broad advisory links weaker than correction links', () => {
  const correction = buildCorrectionLinks({
    generatedAt: NOW,
    subject: 'coding mascot',
    staleItem: { id: 'archive:brass-fox', object: 'brass fox' },
    currentItem: { id: 'memory:copper-rabbit', object: 'copper rabbit' },
    supportState: 'explicit',
  }, { now: NOW });
  const broadLinks = [
    ...correction.links,
    {
      id: 'project-thread-link',
      sourceId: 'plan:static-live',
      targetId: 'memory:frame-budget',
      relation: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
      confidence: 'medium',
      support: { state: 'research' },
      directionality: 'bidirectional',
    },
    {
      id: 'open-loop-link',
      sourceId: 'open-loop:correction-check',
      targetId: 'memory:frame-budget',
      relation: MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
      confidence: 'medium',
      support: { state: 'unknown' },
    },
  ];

  const ranked = scoreMemoryLinkShadowForCandidates([
    {
      id: 'plan:static-live',
      activeScore: 6.2,
    },
    {
      id: 'memory:copper-rabbit',
      activeScore: 4.9,
    },
    {
      id: 'memory:frame-budget',
      activeScore: 4.8,
    },
  ], { memoryLinks: broadLinks });
  const byId = new Map(ranked.map((item) => [item.candidate.id, item.linkShadowScore]));

  assert.equal(byId.get('plan:static-live').components.sameProjectThreadBoost, 0.45);
  assert.equal(byId.get('memory:frame-budget').components.openLoopRelevanceBoost, 0.35);
  assert.ok(
    byId.get('memory:copper-rabbit').components.currentCorrectionBoost
      > byId.get('plan:static-live').components.sameProjectThreadBoost,
  );
  assert.ok(byId.get('memory:copper-rabbit').shadowRank < byId.get('plan:static-live').shadowRank);
  assert.equal(byId.get('plan:static-live').active, false);
});

test('candidate-only weak links cannot become verified support or override source authority', () => {
  const shadow = scoreMemoryLinkShadowForCandidate({
    id: 'memory:verified-rain',
    activeScore: 9,
    sourceAuthority: 'verified',
  }, {
    memoryLinks: [
      {
        id: 'weak-rain-link',
        sourceId: 'semantic:rain-candidate',
        targetId: 'memory:verified-rain',
        relation: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
        confidence: 'low',
        support: { state: 'semantic-candidate' },
        authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
      },
    ],
  });

  assert.equal(shadow.components.weakRelationPenalty, 0);
  assert.equal(shadow.score, 0);
  assert.equal(shadow.shadowAdjustedScore, 9);
  assert.equal(shadow.candidateOnlyVerifiedSupport, false);
  assert.equal(shadow.truthProof, false);
  assert.equal(shadow.reasons.includes('related-but-weak:ignored-source-authority'), true);
});
