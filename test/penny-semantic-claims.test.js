const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SEMANTIC_ID_KINDS,
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticSourceId,
  validateSemanticId,
} = require('../lib/penny-semantic-ids');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('../lib/penny-semantic-predicates');
const {
  PENNY_SEMANTIC_CLAIM_SCHEMA,
  claimCanBeRendered,
  claimCanBeTreatedAsCanonical,
  claimIsCandidateOnly,
  claimIsStale,
  normalizeSemanticClaim,
  summarizeSemanticClaim,
  validateSemanticClaim,
} = require('../lib/penny-semantic-claims');

function explicitMemoryClaim(overrides = {}) {
  return {
    domainId: 'penny:domain:explicit-memory',
    subject: {
      id: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }),
      type: 'user',
      label: 'the user',
    },
    predicate: {
      id: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    },
    object: {
      type: 'text',
      label: 'lapsang souchong',
      text: 'lapsang souchong',
    },
    source: {
      sourceId: buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'favorite-tea' }),
      sourceType: 'explicit-memory',
      excerpt: 'favorite tea = lapsang souchong',
      observedAt: '2026-04-22T00:00:00.000Z',
    },
    temporal: {
      temporalScope: 'current',
      observedAt: '2026-04-22T00:00:00.000Z',
    },
    status: {
      stale: false,
    },
    ...overrides,
  };
}

test('explicit-memory claims normalize to canonical local claim contracts', () => {
  const claim = normalizeSemanticClaim(explicitMemoryClaim());
  const validation = validateSemanticClaim(claim);

  assert.equal(claim.schema, PENNY_SEMANTIC_CLAIM_SCHEMA);
  assert.equal(validateSemanticId(claim.claimId, SEMANTIC_ID_KINDS.CLAIM).valid, true);
  assert.equal(claim.domainId, 'penny:domain:explicit-memory');
  assert.equal(claim.authority.sourceAuthority, 'canonical');
  assert.equal(claim.authority.supportState, 'verified');
  assert.equal(claim.authority.canonicality, 'canonical');
  assert.equal(validation.valid, true);
  assert.equal(claimCanBeTreatedAsCanonical(claim), true);
  assert.equal(claimCanBeRendered(claim), true);
  assert.equal(claimIsCandidateOnly(claim), false);
  assert.equal(claimIsStale(claim), false);
});

test('claim validation requires subject, predicate, object, source, and stale status', () => {
  const validation = validateSemanticClaim({
    predicate: { id: 'penny:predicate:definitely-proves' },
    object: { type: 'text' },
    source: { sourceType: 'explicit-memory' },
    status: {},
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('missing subject'));
  assert.ok(validation.errors.includes('missing or unregistered predicate.id'));
  assert.ok(validation.errors.includes('missing object.id or object.text'));
  assert.ok(validation.errors.includes('missing source.sourceId'));
  assert.ok(validation.errors.includes('missing status.stale'));
});

test('archive claims default to advisory and renderable but not canonical', () => {
  const sourceId = buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'episode-abc123' });
  const claim = normalizeSemanticClaim({
    subject: { id: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }), type: 'user' },
    predicate: SEMANTIC_PREDICATE_IDS.USER_PREFERS_RESPONSE_STYLE,
    object: { type: 'text', text: 'short direct answers' },
    source: {
      sourceId,
      sourceType: 'archive-episode',
      excerpt: 'The user preferred short direct answers in this session.',
    },
    status: { stale: false },
  });
  const validation = validateSemanticClaim(claim);

  assert.equal(claim.domainId, 'penny:domain:session-archive');
  assert.equal(claim.authority.sourceAuthority, 'advisory');
  assert.equal(claim.authority.supportState, 'rendered-advisory');
  assert.equal(claim.authority.canonicality, 'advisory');
  assert.equal(claim.temporal.temporalScope, 'historical');
  assert.equal(validation.valid, true);
  assert.equal(claimCanBeTreatedAsCanonical(claim), false);
  assert.equal(claimCanBeRendered(claim), true);
});

test('static candidate claims stay candidate-only even if input overclaims authority', () => {
  const claim = normalizeSemanticClaim({
    domainId: 'penny:domain:static-candidate',
    subject: { id: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }), type: 'user' },
    predicate: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    object: { type: 'text', text: 'oolong' },
    source: {
      sourceId: buildSemanticSourceId({ sourceType: 'static-candidate', sourceId: 'candidate-1' }),
      sourceType: 'static-candidate',
      excerpt: 'User once said their favorite tea was oolong.',
    },
    authority: {
      sourceAuthority: 'canonical',
      supportState: 'verified',
      canonicality: 'canonical',
    },
    temporal: { temporalScope: 'current' },
    status: { stale: false },
  });
  const validation = validateSemanticClaim(claim);

  assert.equal(validation.valid, true);
  assert.equal(claim.authority.sourceAuthority, 'candidate-only');
  assert.equal(claim.authority.supportState, 'candidate-only');
  assert.equal(claim.authority.canonicality, 'not-canonical');
  assert.equal(claimIsCandidateOnly(claim), true);
  assert.equal(claimCanBeTreatedAsCanonical(claim), false);
  assert.equal(claimCanBeRendered(claim), false);
});

test('stale claims require a semantic superseding or contradiction claim id', () => {
  const stale = validateSemanticClaim(explicitMemoryClaim({
    status: { stale: true },
  }));
  const currentClaimId = buildSemanticClaimId(explicitMemoryClaim({
    object: { type: 'text', text: 'lapsang souchong' },
  }));
  const validStale = validateSemanticClaim(explicitMemoryClaim({
    object: { type: 'text', text: 'oolong' },
    status: {
      stale: true,
      supersededBy: [currentClaimId],
    },
  }));

  assert.equal(stale.valid, false);
  assert.ok(stale.errors.includes('stale claim requires contradictedBy or supersededBy'));
  assert.equal(validStale.valid, true);
  assert.equal(claimIsStale(validStale.claim), true);
  assert.equal(claimCanBeTreatedAsCanonical(validStale.claim), false);
});

test('claims without source ids fail unless explicitly fixture-only', () => {
  const missingSource = validateSemanticClaim(explicitMemoryClaim({
    source: {
      sourceType: 'explicit-memory',
      excerpt: 'favorite tea = lapsang souchong',
    },
  }));
  const fixture = validateSemanticClaim({
    subject: { id: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }), type: 'user' },
    predicate: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    object: { type: 'text', text: 'lapsang souchong' },
    source: {
      sourceType: 'fixture-only',
      fixtureOnly: true,
      excerpt: 'Fixture-only claim for unit coverage.',
    },
    status: { stale: false },
  });

  assert.equal(missingSource.valid, false);
  assert.ok(missingSource.errors.includes('missing source.sourceId'));
  assert.equal(fixture.valid, true);
  assert.equal(fixture.claim.authority.sourceAuthority, 'fixture-only');
  assert.equal(claimCanBeTreatedAsCanonical(fixture.claim), false);
  assert.equal(claimCanBeRendered(fixture.claim), false);
});

test('claim summaries include relation, source, authority, and temporal state', () => {
  const summary = summarizeSemanticClaim(explicitMemoryClaim());

  assert.equal(summary.schema, 'penny-semantic-claim-summary.v1');
  assert.equal(summary.relation, SEMANTIC_PREDICATE_IDS.FAVORITE_TEA);
  assert.equal(summary.relationLabel, 'favorite tea');
  assert.equal(summary.source.sourceType, 'explicit-memory');
  assert.equal(summary.authority.sourceAuthority, 'canonical');
  assert.equal(summary.temporalScope, 'current');
  assert.equal(summary.canonical, true);
  assert.match(summary.text, /favorite tea/);
  assert.match(summary.text, /source=explicit-memory/);
  assert.match(summary.text, /authority=canonical\/verified\/canonical/);
  assert.match(summary.text, /temporal=current/);
});

test('semantic claims keep same-label entities distinct when stable ids differ', () => {
  const projectOne = buildSemanticEntityId({ entityType: 'project', entityKey: 'aim-labs-local' });
  const projectTwo = buildSemanticEntityId({ entityType: 'project', entityKey: 'aim-labs-public' });

  const localClaim = normalizeSemanticClaim(explicitMemoryClaim({
    subject: {
      id: projectOne,
      type: 'project',
      label: 'AIM Labs',
    },
    object: {
      type: 'text',
      label: 'local runtime',
      text: 'local runtime',
    },
  }));
  const publicClaim = normalizeSemanticClaim(explicitMemoryClaim({
    subject: {
      id: projectTwo,
      type: 'project',
      label: 'AIM Labs',
    },
    object: {
      type: 'text',
      label: 'public repo',
      text: 'public repo',
    },
  }));

  assert.equal(localClaim.subject.label, publicClaim.subject.label);
  assert.notEqual(localClaim.subject.id, publicClaim.subject.id);
  assert.equal(localClaim.subject.id, projectOne);
  assert.equal(publicClaim.subject.id, projectTwo);
  assert.notEqual(
    buildSemanticClaimId({ subjectId: localClaim.subject.id, predicateId: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA, objectText: 'local runtime' }),
    buildSemanticClaimId({ subjectId: publicClaim.subject.id, predicateId: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA, objectText: 'local runtime' }),
  );
});
