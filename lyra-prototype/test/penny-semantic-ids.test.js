const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SEMANTIC_ID_KINDS,
  buildSemanticClaimId,
  buildSemanticDomainId,
  buildSemanticEntityId,
  buildSemanticLinkId,
  buildSemanticPredicateId,
  buildSemanticRenderedContextId,
  buildSemanticSourceId,
  buildSemanticVectorSourceId,
  normalizeSemanticIdParts,
  semanticIdIsDereferenceable,
  validateSemanticId,
} = require('../lib/penny-semantic-ids');

test('claim ids are stable for the same normalized claim', () => {
  const first = buildSemanticClaimId({
    subjectId: 'penny:entity:user:self',
    predicateId: 'penny:predicate:favorite-tea',
    objectText: ' Lapsang   Souchong ',
    sourceId: 'penny:source:explicit-memory:favorite-tea',
    temporalScope: 'current',
  });
  const second = buildSemanticClaimId({
    subject: { id: 'penny:entity:user:self' },
    predicate: { id: 'penny:predicate:favorite-tea' },
    object: { text: 'lapsang souchong' },
    source: { sourceId: 'penny:source:explicit-memory:favorite-tea' },
    temporal: { temporalScope: 'current' },
  });

  assert.equal(first, second);
  assert.equal(validateSemanticId(first, SEMANTIC_ID_KINDS.CLAIM).valid, true);
});

test('claim ids change when predicate or temporal scope changes', () => {
  const base = {
    subjectId: 'penny:entity:user:self',
    predicateId: 'penny:predicate:favorite-tea',
    objectTextNorm: 'lapsang souchong',
    sourceId: 'penny:source:explicit-memory:favorite-tea',
    temporalScope: 'current',
  };

  assert.notEqual(
    buildSemanticClaimId(base),
    buildSemanticClaimId({ ...base, predicateId: 'penny:predicate:former-favorite-tea' }),
  );
  assert.notEqual(
    buildSemanticClaimId(base),
    buildSemanticClaimId({ ...base, temporalScope: 'historical' }),
  );
});

test('source ids stay stable across rechunked text when a source ref is stable', () => {
  const first = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'archive:episode:abc123',
    chunkId: 'chunk-1',
    sourceText: 'The first chunk text.',
  });
  const second = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'archive:episode:abc123',
    chunkId: 'chunk-99',
    sourceText: 'A different chunking of the same source.',
  });
  const different = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'archive:episode:different',
    sourceText: 'A different source.',
  });

  assert.equal(first, second);
  assert.notEqual(first, different);
  assert.equal(validateSemanticId(first, SEMANTIC_ID_KINDS.SOURCE).valid, true);
});

test('semantic id kinds validate separately', () => {
  const sourceId = buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'favorite-tea' });
  const claimId = buildSemanticClaimId({
    subjectId: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }),
    predicateId: buildSemanticPredicateId('favorite tea'),
    objectText: 'lapsang souchong',
    sourceId,
    temporalScope: 'current',
  });

  assert.equal(validateSemanticId(sourceId, SEMANTIC_ID_KINDS.SOURCE).valid, true);
  assert.equal(validateSemanticId(claimId, SEMANTIC_ID_KINDS.CLAIM).valid, true);
  assert.equal(validateSemanticId(sourceId, SEMANTIC_ID_KINDS.CLAIM).valid, false);
  assert.equal(validateSemanticId(claimId, SEMANTIC_ID_KINDS.SOURCE).reason, 'semantic id kind mismatch');
});

test('readable predicate and domain ids are local identifiers, not behavior registries', () => {
  const predicateId = buildSemanticPredicateId('Favorite Tea');
  const domainId = buildSemanticDomainId('Explicit Memory');
  const predicateValidation = validateSemanticId(predicateId, SEMANTIC_ID_KINDS.PREDICATE);
  const domainValidation = validateSemanticId(domainId, SEMANTIC_ID_KINDS.DOMAIN);

  assert.equal(predicateId, 'penny:predicate:favorite-tea');
  assert.equal(domainId, 'penny:domain:explicit-memory');
  assert.equal(predicateValidation.valid, true);
  assert.equal(domainValidation.valid, true);
  assert.equal(predicateValidation.sourceAuthority, undefined);
  assert.equal(domainValidation.canonicality, undefined);
});

test('all slice-one semantic id kinds can be minted as local penny ids', () => {
  const ids = [
    buildSemanticSourceId({ sourceType: 'explicit-memory', sourceId: 'favorite-tea' }),
    buildSemanticClaimId({
      subjectId: 'penny:entity:user:self',
      predicateId: 'penny:predicate:favorite-tea',
      objectText: 'lapsang souchong',
      sourceId: 'penny:source:explicit-memory:favorite-tea',
      temporalScope: 'current',
    }),
    buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }),
    buildSemanticPredicateId('favorite-tea'),
    buildSemanticLinkId({
      sourceClaimId: 'penny:claim:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      predicateId: 'penny:predicate:correction-of',
      targetClaimId: 'penny:claim:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      supportState: 'explicit',
    }),
    buildSemanticDomainId('explicit-memory'),
    buildSemanticRenderedContextId({
      channel: 'session-archive',
      sourceId: 'archive:episode:abc123',
      promptTurnId: 'turn-1',
    }),
    buildSemanticVectorSourceId({
      providerId: 'fixture-provider',
      modelId: 'fixture-model',
      sourceId: 'archive:episode:abc123',
      sourceHash: 'source-hash',
    }),
  ];
  const expectedKinds = [
    SEMANTIC_ID_KINDS.SOURCE,
    SEMANTIC_ID_KINDS.CLAIM,
    SEMANTIC_ID_KINDS.ENTITY,
    SEMANTIC_ID_KINDS.PREDICATE,
    SEMANTIC_ID_KINDS.LINK,
    SEMANTIC_ID_KINDS.DOMAIN,
    SEMANTIC_ID_KINDS.RENDERED_CONTEXT,
    SEMANTIC_ID_KINDS.VECTOR_SOURCE,
  ];

  ids.forEach((id, index) => {
    assert.match(id, /^penny:/);
    assert.equal(validateSemanticId(id, expectedKinds[index]).valid, true);
  });
});

test('normalization sorts object keys and keeps arrays ordered', () => {
  assert.deepEqual(
    normalizeSemanticIdParts({ b: ' two  spaces ', a: [' First ', 'Second'] }),
    { a: ['First', 'Second'], b: 'two spaces' },
  );
});

test('semantic ids never imply dereference permission', () => {
  const sourceId = buildSemanticSourceId({
    sourceType: 'web-note',
    sourceId: 'https://example.invalid/private/path',
    sourceText: 'Do not fetch this while building an identifier.',
  });

  assert.equal(sourceId.includes('example'), false);
  assert.equal(semanticIdIsDereferenceable(sourceId), false);
  assert.equal(semanticIdIsDereferenceable('https://example.invalid/private/path'), false);
});

test('non-local and malformed ids fail validation', () => {
  assert.equal(validateSemanticId('https://example.invalid/claim').valid, false);
  assert.equal(validateSemanticId('penny:claim:not-a-digest').valid, false);
  assert.equal(validateSemanticId('penny:definitely-new-kind:abc').reason, 'unknown semantic id kind');
});
