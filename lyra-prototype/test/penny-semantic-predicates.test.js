const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SEMANTIC_ID_KINDS,
  validateSemanticId,
} = require('../lib/penny-semantic-ids');
const {
  PENNY_SEMANTIC_PREDICATE_REGISTRY_SCHEMA,
  SEMANTIC_PREDICATE_IDS,
  getSemanticPredicate,
  listSemanticPredicates,
  normalizeSemanticPredicate,
  predicateCanInfluenceRanking,
  predicateIsMemorySensitive,
  predicateRequiresReceipt,
  validateSemanticPredicateId,
} = require('../lib/penny-semantic-predicates');

test('registered predicates validate as local semantic predicate ids', () => {
  const predicates = listSemanticPredicates();
  const ids = predicates.map((predicate) => predicate.id);

  assert.equal(predicates.length, 12);
  assert.equal(new Set(ids).size, predicates.length);
  assert.deepEqual(ids, [
    SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    SEMANTIC_PREDICATE_IDS.CORRECTED_TO,
    SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    SEMANTIC_PREDICATE_IDS.STALE_PRIOR,
    SEMANTIC_PREDICATE_IDS.CONTRADICTS,
    SEMANTIC_PREDICATE_IDS.SOURCE_FOR,
    SEMANTIC_PREDICATE_IDS.IMPLEMENTS,
    SEMANTIC_PREDICATE_IDS.FOLLOW_UP_TO,
    SEMANTIC_PREDICATE_IDS.OPEN_LOOP_ABOUT,
    SEMANTIC_PREDICATE_IDS.SAME_PROJECT_THREAD,
    SEMANTIC_PREDICATE_IDS.USER_PREFERS_RESPONSE_STYLE,
  ]);

  for (const predicate of predicates) {
    assert.equal(predicate.schema, PENNY_SEMANTIC_PREDICATE_REGISTRY_SCHEMA);
    assert.equal(validateSemanticId(predicate.id, SEMANTIC_ID_KINDS.PREDICATE).valid, true);
    assert.equal(validateSemanticPredicateId(predicate.id).valid, true);
    assert.equal(predicate.canPromoteToExplicitMemory, false);
  }
  assert.equal(validateSemanticPredicateId('favorite-tea').predicateId, SEMANTIC_PREDICATE_IDS.FAVORITE_TEA);
  assert.equal(validateSemanticPredicateId('favorite-tea').valid, true);
});

test('unknown and malformed predicates fail closed', () => {
  const unknown = validateSemanticPredicateId('penny:predicate:definitely-proves');
  const malformed = validateSemanticPredicateId('https://example.invalid/predicate/corrects');

  assert.equal(unknown.valid, false);
  assert.equal(unknown.registered, false);
  assert.equal(unknown.reason, 'unregistered semantic predicate');
  assert.equal(getSemanticPredicate('penny:predicate:definitely-proves'), null);
  assert.equal(normalizeSemanticPredicate('definitely-proves'), null);
  assert.equal(predicateCanInfluenceRanking('definitely-proves'), false);
  assert.equal(predicateRequiresReceipt('definitely-proves'), true);
  assert.equal(predicateIsMemorySensitive('definitely-proves'), false);

  assert.equal(malformed.valid, false);
  assert.equal(malformed.reason, 'semantic id must use local penny prefix');
});

test('inverse relations are declared for correction predicates', () => {
  const correction = getSemanticPredicate(SEMANTIC_PREDICATE_IDS.CORRECTION_OF);
  const stalePrior = getSemanticPredicate(SEMANTIC_PREDICATE_IDS.STALE_PRIOR);
  const correctedTo = getSemanticPredicate(SEMANTIC_PREDICATE_IDS.CORRECTED_TO);
  const contradicts = getSemanticPredicate(SEMANTIC_PREDICATE_IDS.CONTRADICTS);

  assert.equal(correction.inversePredicateId, SEMANTIC_PREDICATE_IDS.STALE_PRIOR);
  assert.equal(stalePrior.inversePredicateId, SEMANTIC_PREDICATE_IDS.CORRECTION_OF);
  assert.equal(correctedTo.inversePredicateId, SEMANTIC_PREDICATE_IDS.STALE_PRIOR);
  assert.equal(contradicts.inversePredicateId, SEMANTIC_PREDICATE_IDS.CONTRADICTS);
});

test('correction and contradiction predicates require source receipts', () => {
  for (const predicateId of [
    SEMANTIC_PREDICATE_IDS.CORRECTED_TO,
    SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    SEMANTIC_PREDICATE_IDS.STALE_PRIOR,
    SEMANTIC_PREDICATE_IDS.CONTRADICTS,
  ]) {
    const predicate = getSemanticPredicate(predicateId);

    assert.equal(predicate.requiresSourceReceipt, true);
    assert.equal(predicateRequiresReceipt(predicateId), true);
    assert.equal(predicate.canPromoteToExplicitMemory, false);
    assert.equal(predicate.authorityBehavior, 'does-not-canonize');
  }
});

test('ranking-enabled predicates are explicitly marked', () => {
  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.CORRECTION_OF), true);
  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.STALE_PRIOR), true);
  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.SOURCE_FOR), true);
  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.OPEN_LOOP_ABOUT), true);
  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.SAME_PROJECT_THREAD), true);

  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.FAVORITE_TEA), false);
  assert.equal(predicateCanInfluenceRanking(SEMANTIC_PREDICATE_IDS.USER_PREFERS_RESPONSE_STYLE), false);
});

test('memory-sensitive predicates are explicitly marked', () => {
  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.FAVORITE_TEA), true);
  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT), true);
  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.CORRECTION_OF), true);
  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.CONTRADICTS), true);
  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.USER_PREFERS_RESPONSE_STYLE), true);

  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.SOURCE_FOR), false);
  assert.equal(predicateIsMemorySensitive(SEMANTIC_PREDICATE_IDS.SAME_PROJECT_THREAD), false);
});

test('predicate labels do not decide behavior; registered ids do', () => {
  assert.equal(normalizeSemanticPredicate({ label: 'correction of' }), null);

  const normalized = normalizeSemanticPredicate({
    id: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    label: 'favorite tea',
    canInfluenceRanking: false,
    requiresSourceReceipt: false,
  });

  assert.equal(normalized.id, SEMANTIC_PREDICATE_IDS.CORRECTION_OF);
  assert.equal(normalized.label, 'correction of');
  assert.equal(normalized.canInfluenceRanking, true);
  assert.equal(normalized.requiresSourceReceipt, true);
});

test('registry access returns copies instead of mutable shared definitions', () => {
  const first = getSemanticPredicate(SEMANTIC_PREDICATE_IDS.SOURCE_FOR);
  first.subjectTypes.push('mutated');
  first.canInfluenceRanking = false;

  const second = getSemanticPredicate(SEMANTIC_PREDICATE_IDS.SOURCE_FOR);
  assert.equal(second.subjectTypes.includes('mutated'), false);
  assert.equal(second.canInfluenceRanking, true);
});
