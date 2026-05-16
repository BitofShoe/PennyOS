const crypto = require('crypto');

const PENNY_SEMANTIC_ID_SCHEMA = 'penny-semantic-id.v1';

const SEMANTIC_ID_KINDS = Object.freeze({
  SOURCE: 'source',
  CLAIM: 'claim',
  ENTITY: 'entity',
  PREDICATE: 'predicate',
  LINK: 'link',
  DOMAIN: 'domain',
  RENDERED_CONTEXT: 'rendered-context',
  VECTOR_SOURCE: 'vector-source',
});

const KIND_VALUES = new Set(Object.values(SEMANTIC_ID_KINDS));
const HASH_SEGMENT = 'sha256';
const SEGMENT_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function cleanText(value = '', limit = 1600) {
  const text = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, Math.max(0, limit));
}

function slugSegment(value = '', fallback = 'item') {
  const slug = cleanText(value, 240)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || fallback;
}

function normalizeKind(value = '') {
  const kind = slugSegment(value, '');
  return KIND_VALUES.has(kind) ? kind : '';
}

function normalizeClaimText(value = '') {
  return cleanText(value, 1200).toLowerCase();
}

function normalizeSemanticIdParts(parts) {
  if (parts === undefined) return null;
  if (parts === null) return null;
  if (parts instanceof Date) {
    const time = parts.getTime();
    return Number.isFinite(time) ? parts.toISOString() : null;
  }
  if (Array.isArray(parts)) {
    return parts.map(normalizeSemanticIdParts);
  }
  if (isPlainObject(parts)) {
    const out = {};
    for (const key of Object.keys(parts).sort()) {
      const value = normalizeSemanticIdParts(parts[key]);
      if (value === undefined) continue;
      out[key] = value;
    }
    return out;
  }
  if (typeof parts === 'string') return cleanText(parts);
  if (typeof parts === 'number') return Number.isFinite(parts) ? parts : null;
  if (typeof parts === 'boolean') return parts;
  return cleanText(parts);
}

function stableJson(parts) {
  return JSON.stringify(normalizeSemanticIdParts(parts));
}

function stableHash(parts) {
  return crypto.createHash('sha256').update(stableJson(parts), 'utf8').digest('hex');
}

function makeHashedId(kind, parts, middleSegments = []) {
  const normalizedKind = normalizeKind(kind);
  if (!normalizedKind) {
    throw new TypeError('Unknown semantic id kind.');
  }
  const cleanMiddle = middleSegments.map((segment) => slugSegment(segment, '')).filter(Boolean);
  return ['penny', normalizedKind, ...cleanMiddle, HASH_SEGMENT, stableHash(parts)].join(':');
}

function semanticIdFromString(value = '') {
  const id = cleanText(value, 500);
  return id.startsWith('penny:') ? id : '';
}

function firstClean(...values) {
  for (const value of values) {
    const text = cleanText(value, 600);
    if (text) return text;
  }
  return '';
}

function sourceStableRef(parts = {}) {
  const source = isPlainObject(parts) ? parts : {};
  return firstClean(
    source.sourceId,
    source.sourceKey,
    source.rawSourceId,
    source.sourceItemId,
    source.itemId,
    source.memoryId,
    source.episodeId,
    source.summaryId,
    source.topicId,
    source.turnId,
    source.artifactId,
    source.filePath,
    source.path,
    source.ref,
    source.id,
  );
}

function buildSemanticSourceId(parts = {}) {
  if (typeof parts === 'string') {
    const existing = semanticIdFromString(parts);
    if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.SOURCE).valid) return existing;
    return buildSemanticSourceId({ sourceId: parts });
  }
  const existing = semanticIdFromString(parts?.sourceId || parts?.id || '');
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.SOURCE).valid) return existing;
  const sourceType = slugSegment(
    parts?.sourceType || parts?.type || parts?.domain || parts?.domainId || 'source',
    'source',
  );
  const stableRef = sourceStableRef(parts);
  const identity = stableRef
    ? { sourceType, stableRef }
    : {
        sourceType,
        textHash: stableHash({
          text: firstClean(parts?.sourceText, parts?.text, parts?.content, parts?.excerpt),
        }),
      };
  return makeHashedId(SEMANTIC_ID_KINDS.SOURCE, identity, [sourceType]);
}

function buildSemanticClaimId(parts = {}) {
  const existing = semanticIdFromString(parts?.claimId || parts?.id || '');
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.CLAIM).valid) return existing;
  const objectText = firstClean(
    parts?.objectTextNorm,
    parts?.objectText,
    parts?.object?.text,
    parts?.object?.label,
  );
  const identity = {
    subjectId: firstClean(parts?.subjectId, parts?.subject?.id),
    predicateId: firstClean(parts?.predicateId, parts?.predicate?.id),
    objectId: firstClean(parts?.objectId, parts?.object?.id),
    objectTextNorm: normalizeClaimText(objectText),
    sourceId: firstClean(parts?.sourceId, parts?.source?.sourceId),
    domainId: firstClean(parts?.domainId, parts?.domain?.id),
    temporalScope: slugSegment(parts?.temporalScope || parts?.temporal?.temporalScope || 'unknown', 'unknown'),
  };
  return makeHashedId(SEMANTIC_ID_KINDS.CLAIM, identity);
}

function buildSemanticEntityId(parts = {}) {
  if (typeof parts === 'string') {
    const existing = semanticIdFromString(parts);
    if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.ENTITY).valid) return existing;
    return buildSemanticEntityId({ entityKey: parts });
  }
  const existing = semanticIdFromString(parts?.entityId || parts?.id || '');
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.ENTITY).valid) return existing;
  const entityType = slugSegment(parts?.entityType || parts?.type || 'entity', 'entity');
  const identity = {
    entityType,
    entityKey: firstClean(parts?.entityKey, parts?.stableKey, parts?.sourceId, parts?.label, parts?.name),
  };
  return makeHashedId(SEMANTIC_ID_KINDS.ENTITY, identity, [entityType]);
}

function buildSemanticPredicateId(name = '') {
  const existing = semanticIdFromString(name);
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.PREDICATE).valid) return existing;
  return `penny:${SEMANTIC_ID_KINDS.PREDICATE}:${slugSegment(name, 'predicate')}`;
}

function buildSemanticDomainId(name = '') {
  const existing = semanticIdFromString(name);
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.DOMAIN).valid) return existing;
  return `penny:${SEMANTIC_ID_KINDS.DOMAIN}:${slugSegment(name, 'domain')}`;
}

function buildSemanticLinkId(parts = {}) {
  const existing = semanticIdFromString(parts?.linkId || parts?.id || '');
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.LINK).valid) return existing;
  const identity = {
    sourceClaimId: firstClean(parts?.sourceClaimId, parts?.sourceId),
    predicateId: firstClean(parts?.predicateId, parts?.relation),
    targetClaimId: firstClean(parts?.targetClaimId, parts?.targetId),
    domainId: firstClean(parts?.domainId),
    sourceAuthority: firstClean(parts?.sourceAuthority, parts?.authority),
    supportState: firstClean(parts?.supportState, parts?.support?.state),
  };
  return makeHashedId(SEMANTIC_ID_KINDS.LINK, identity);
}

function buildSemanticRenderedContextId(parts = {}) {
  const existing = semanticIdFromString(parts?.renderedContextId || parts?.id || '');
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.RENDERED_CONTEXT).valid) return existing;
  const channel = slugSegment(parts?.channel || parts?.contextChannel || parts?.sourceChannel || 'context', 'context');
  const identity = {
    channel,
    sourceId: firstClean(parts?.sourceId),
    claimId: firstClean(parts?.claimId),
    promptTurnId: firstClean(parts?.promptTurnId, parts?.turnId),
    renderedAt: ISO_DATE_PATTERN.test(cleanText(parts?.renderedAt || '')) ? cleanText(parts.renderedAt) : '',
  };
  return makeHashedId(SEMANTIC_ID_KINDS.RENDERED_CONTEXT, identity, [channel]);
}

function buildSemanticVectorSourceId(parts = {}) {
  const existing = semanticIdFromString(parts?.vectorSourceId || parts?.id || '');
  if (existing && validateSemanticId(existing, SEMANTIC_ID_KINDS.VECTOR_SOURCE).valid) return existing;
  const provider = slugSegment(parts?.providerId || parts?.provider || parts?.modelId || 'vector', 'vector');
  const identity = {
    provider,
    modelId: firstClean(parts?.modelId, parts?.model),
    modelRevision: firstClean(parts?.modelRevision, parts?.revision),
    sourceId: firstClean(parts?.sourceId, parts?.sourceItemId, parts?.source?.sourceItemId),
    sourceHash: firstClean(parts?.sourceHash, parts?.source?.sourceHash),
  };
  return makeHashedId(SEMANTIC_ID_KINDS.VECTOR_SOURCE, identity, [provider]);
}

function validateSegments(segments = []) {
  if (segments.length < 3) return 'semantic id requires at least three segments';
  for (const segment of segments) {
    if (!SEGMENT_PATTERN.test(segment)) return `invalid semantic id segment: ${segment || '(empty)'}`;
  }
  return '';
}

function validateHashedTail(kind, segments = []) {
  if (kind === SEMANTIC_ID_KINDS.PREDICATE || kind === SEMANTIC_ID_KINDS.DOMAIN) return '';
  const hashIndex = segments.indexOf(HASH_SEGMENT);
  if (hashIndex < 2) return 'semantic id requires sha256 digest';
  const digest = segments[hashIndex + 1] || '';
  if (!/^[a-f0-9]{64}$/.test(digest)) return 'semantic id sha256 digest is invalid';
  if (segments.length !== hashIndex + 2) return 'semantic id has trailing data after digest';
  return '';
}

function validateSemanticId(id, expectedKind = null) {
  const normalizedId = cleanText(id, 500);
  const result = {
    schema: PENNY_SEMANTIC_ID_SCHEMA,
    id: normalizedId,
    valid: false,
    kind: '',
    expectedKind: expectedKind ? normalizeKind(expectedKind) : null,
    dereferenceable: false,
    reason: '',
  };
  if (!normalizedId) {
    result.reason = 'missing semantic id';
    return result;
  }
  const segments = normalizedId.split(':');
  if (segments[0] !== 'penny') {
    result.reason = 'semantic id must use local penny prefix';
    return result;
  }
  const segmentError = validateSegments(segments);
  if (segmentError) {
    result.reason = segmentError;
    return result;
  }
  const kind = segments[1];
  result.kind = kind;
  if (!KIND_VALUES.has(kind)) {
    result.reason = 'unknown semantic id kind';
    return result;
  }
  if (result.expectedKind && kind !== result.expectedKind) {
    result.reason = 'semantic id kind mismatch';
    return result;
  }
  const hashError = validateHashedTail(kind, segments);
  if (hashError) {
    result.reason = hashError;
    return result;
  }
  result.valid = true;
  return result;
}

function semanticIdIsDereferenceable() {
  return false;
}

module.exports = {
  PENNY_SEMANTIC_ID_SCHEMA,
  SEMANTIC_ID_KINDS,
  normalizeSemanticIdParts,
  buildSemanticSourceId,
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticPredicateId,
  buildSemanticDomainId,
  buildSemanticLinkId,
  buildSemanticRenderedContextId,
  buildSemanticVectorSourceId,
  validateSemanticId,
  semanticIdIsDereferenceable,
};
