const {
  SEMANTIC_ID_KINDS,
  buildSemanticPredicateId,
  validateSemanticId,
} = require('./penny-semantic-ids');

const PENNY_SEMANTIC_PREDICATE_REGISTRY_SCHEMA = 'penny-semantic-predicate-registry.v1';

const SEMANTIC_PREDICATE_IDS = Object.freeze({
  FAVORITE_TEA: 'penny:predicate:favorite-tea',
  CURRENT_CODING_MASCOT: 'penny:predicate:current-coding-mascot',
  CORRECTED_TO: 'penny:predicate:corrected-to',
  CORRECTION_OF: 'penny:predicate:correction-of',
  STALE_PRIOR: 'penny:predicate:stale-prior',
  CONTRADICTS: 'penny:predicate:contradicts',
  SOURCE_FOR: 'penny:predicate:source-for',
  IMPLEMENTS: 'penny:predicate:implements',
  FOLLOW_UP_TO: 'penny:predicate:follow-up-to',
  OPEN_LOOP_ABOUT: 'penny:predicate:open-loop-about',
  SAME_PROJECT_THREAD: 'penny:predicate:same-project-thread',
  USER_PREFERS_RESPONSE_STYLE: 'penny:predicate:user-prefers-response-style',
});

const AUTHORITY_BEHAVIORS = Object.freeze({
  DOES_NOT_CANONIZE: 'does-not-canonize',
});

const STALENESS_BEHAVIORS = Object.freeze({
  NONE: 'none',
  MARKS_TARGET_STALE_WHEN_SOURCE_CURRENT: 'marks-target-stale-when-source-current',
  MARKS_SOURCE_STALE_WHEN_TARGET_CURRENT: 'marks-source-stale-when-target-current',
  MUTUAL_CONTRADICTION_REQUIRES_REVIEW: 'mutual-contradiction-requires-review',
});

const RAW_PREDICATES = Object.freeze([
  {
    id: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    label: 'favorite tea',
    subjectTypes: ['user'],
    objectTypes: ['text'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: false,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT,
    label: 'current coding mascot',
    subjectTypes: ['user', 'project', 'claim'],
    objectTypes: ['text', 'entity'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: false,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.CORRECTED_TO,
    label: 'corrected to',
    subjectTypes: ['claim', 'memory-item', 'archive-episode'],
    objectTypes: ['claim', 'memory-item', 'archive-episode'],
    inversePredicateId: SEMANTIC_PREDICATE_IDS.STALE_PRIOR,
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.MARKS_SOURCE_STALE_WHEN_TARGET_CURRENT,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    label: 'correction of',
    subjectTypes: ['claim', 'memory-item', 'archive-episode'],
    objectTypes: ['claim', 'memory-item', 'archive-episode'],
    inversePredicateId: SEMANTIC_PREDICATE_IDS.STALE_PRIOR,
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.MARKS_TARGET_STALE_WHEN_SOURCE_CURRENT,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.STALE_PRIOR,
    label: 'stale prior',
    subjectTypes: ['claim', 'memory-item', 'archive-episode'],
    objectTypes: ['claim', 'memory-item', 'archive-episode'],
    inversePredicateId: SEMANTIC_PREDICATE_IDS.CORRECTION_OF,
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.MARKS_SOURCE_STALE_WHEN_TARGET_CURRENT,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.CONTRADICTS,
    label: 'contradicts',
    subjectTypes: ['claim', 'memory-item', 'archive-episode', 'research-topic'],
    objectTypes: ['claim', 'memory-item', 'archive-episode', 'research-topic'],
    inversePredicateId: SEMANTIC_PREDICATE_IDS.CONTRADICTS,
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.MUTUAL_CONTRADICTION_REQUIRES_REVIEW,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.SOURCE_FOR,
    label: 'source for',
    subjectTypes: ['source', 'tool-evidence', 'research-topic'],
    objectTypes: ['claim', 'plan', 'memory-item', 'research-topic'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: false,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.IMPLEMENTS,
    label: 'implements',
    subjectTypes: ['commit', 'artifact', 'claim', 'plan'],
    objectTypes: ['plan', 'open-loop', 'claim'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: false,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.FOLLOW_UP_TO,
    label: 'follow-up to',
    subjectTypes: ['open-loop', 'plan', 'claim', 'session'],
    objectTypes: ['claim', 'plan', 'session', 'open-loop'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: false,
    memorySensitive: false,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.OPEN_LOOP_ABOUT,
    label: 'open loop about',
    subjectTypes: ['open-loop'],
    objectTypes: ['project', 'plan', 'claim', 'memory-item'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: false,
    memorySensitive: false,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.SAME_PROJECT_THREAD,
    label: 'same project thread',
    subjectTypes: ['claim', 'memory-item', 'archive-episode', 'research-topic', 'open-loop'],
    objectTypes: ['claim', 'memory-item', 'archive-episode', 'research-topic', 'open-loop'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: false,
    memorySensitive: false,
  },
  {
    id: SEMANTIC_PREDICATE_IDS.USER_PREFERS_RESPONSE_STYLE,
    label: 'user prefers response style',
    subjectTypes: ['user'],
    objectTypes: ['text', 'preference'],
    authorityBehavior: AUTHORITY_BEHAVIORS.DOES_NOT_CANONIZE,
    stalenessBehavior: STALENESS_BEHAVIORS.NONE,
    canInfluenceRanking: false,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: true,
    memorySensitive: true,
  },
]);

function clonePredicate(predicate) {
  if (!predicate) return null;
  return {
    schema: PENNY_SEMANTIC_PREDICATE_REGISTRY_SCHEMA,
    id: predicate.id,
    label: predicate.label,
    subjectTypes: [...predicate.subjectTypes],
    objectTypes: [...predicate.objectTypes],
    inversePredicateId: predicate.inversePredicateId || null,
    authorityBehavior: predicate.authorityBehavior,
    stalenessBehavior: predicate.stalenessBehavior,
    canInfluenceRanking: predicate.canInfluenceRanking === true,
    canPromoteToExplicitMemory: false,
    requiresSourceReceipt: predicate.requiresSourceReceipt === true,
    memorySensitive: predicate.memorySensitive === true,
  };
}

function cleanText(value = '', limit = 500) {
  const text = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, Math.max(0, limit));
}

function normalizePredicateId(value = '') {
  const text = cleanText(value, 500);
  if (!text) return '';
  if (text.startsWith('penny:predicate:')) return text;
  if (/^[a-z0-9][a-z0-9._-]*$/.test(text)) return buildSemanticPredicateId(text);
  return '';
}

const PREDICATE_BY_ID = new Map(RAW_PREDICATES.map((predicate) => [predicate.id, clonePredicate(predicate)]));

function listSemanticPredicates() {
  return Array.from(PREDICATE_BY_ID.values()).map(clonePredicate);
}

function getSemanticPredicate(predicateId) {
  const id = normalizePredicateId(predicateId);
  return clonePredicate(PREDICATE_BY_ID.get(id));
}

function validateSemanticPredicateId(predicateId) {
  const id = normalizePredicateId(predicateId);
  const validation = {
    schema: PENNY_SEMANTIC_PREDICATE_REGISTRY_SCHEMA,
    predicateId: id || cleanText(predicateId, 500),
    valid: false,
    registered: false,
    reason: '',
  };
  const idValidation = validateSemanticId(id || validation.predicateId, SEMANTIC_ID_KINDS.PREDICATE);
  if (!idValidation.valid) {
    validation.reason = idValidation.reason || 'invalid semantic predicate id';
    return validation;
  }
  validation.predicateId = idValidation.id;
  const predicate = PREDICATE_BY_ID.get(idValidation.id);
  if (!predicate) {
    validation.reason = 'unregistered semantic predicate';
    return validation;
  }
  validation.valid = true;
  validation.registered = true;
  validation.predicate = clonePredicate(predicate);
  return validation;
}

function normalizeSemanticPredicate(predicateLike) {
  if (!predicateLike) return null;
  if (typeof predicateLike === 'string') return getSemanticPredicate(predicateLike);
  if (typeof predicateLike !== 'object' || Array.isArray(predicateLike)) return null;
  return getSemanticPredicate(predicateLike.predicateId || predicateLike.id || '');
}

function predicateCanInfluenceRanking(predicateId) {
  const predicate = getSemanticPredicate(predicateId);
  return predicate ? predicate.canInfluenceRanking === true : false;
}

function predicateRequiresReceipt(predicateId) {
  const predicate = getSemanticPredicate(predicateId);
  return predicate ? predicate.requiresSourceReceipt === true : true;
}

function predicateIsMemorySensitive(predicateId) {
  const predicate = getSemanticPredicate(predicateId);
  return predicate ? predicate.memorySensitive === true : false;
}

module.exports = {
  PENNY_SEMANTIC_PREDICATE_REGISTRY_SCHEMA,
  SEMANTIC_PREDICATE_IDS,
  AUTHORITY_BEHAVIORS,
  STALENESS_BEHAVIORS,
  listSemanticPredicates,
  getSemanticPredicate,
  validateSemanticPredicateId,
  normalizeSemanticPredicate,
  predicateCanInfluenceRanking,
  predicateRequiresReceipt,
  predicateIsMemorySensitive,
};
