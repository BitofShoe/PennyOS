const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
} = require('../lib/penny-memory-links');
const {
  PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
  buildCorrectionLinks,
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
