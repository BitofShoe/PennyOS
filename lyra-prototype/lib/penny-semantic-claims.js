const {
  SEMANTIC_ID_KINDS,
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticSourceId,
  validateSemanticId,
} = require('./penny-semantic-ids');
const {
  normalizeSemanticPredicate,
} = require('./penny-semantic-predicates');
const {
  SEMANTIC_DOMAIN_IDS: DOMAIN_IDS,
  domainAllowsClaimSubjectType,
  domainCanBeCanonical,
  domainCanRenderToPrompt,
  domainDefaultAuthority,
  domainDefaultCanonicality,
  domainDefaultConfidence,
  domainDefaultSupportState,
  domainDefaultTemporalScope,
  domainIdForSourceType: defaultDomainForSourceType,
  domainIsCandidateOnly,
  normalizeSemanticDomainId: normalizeDomainId,
  sourceTypeForDomain,
  validateSemanticDomainId,
} = require('./penny-semantic-domains');

const PENNY_SEMANTIC_CLAIM_SCHEMA = 'penny-semantic-claim.v1';

const SEMANTIC_CLAIM_SOURCE_AUTHORITIES = Object.freeze({
  CANONICAL: 'canonical',
  ADVISORY: 'advisory',
  CANDIDATE_ONLY: 'candidate-only',
  FIXTURE_ONLY: 'fixture-only',
});

const SEMANTIC_CLAIM_SUPPORT_STATES = Object.freeze({
  VERIFIED: 'verified',
  RENDERED_ADVISORY: 'rendered-advisory',
  CANDIDATE_ONLY: 'candidate-only',
  FIXTURE_ONLY: 'fixture-only',
});

const SEMANTIC_CLAIM_CANONICALITY = Object.freeze({
  CANONICAL: 'canonical',
  ADVISORY: 'advisory',
  NOT_CANONICAL: 'not-canonical',
});

const SEMANTIC_CLAIM_TEMPORAL_SCOPES = Object.freeze({
  CURRENT: 'current',
  HISTORICAL: 'historical',
  UNKNOWN: 'unknown',
  EPHEMERAL: 'ephemeral',
});

const CONFIDENCE_VALUES = new Set(['high', 'medium', 'low', 'unknown']);
const SOURCE_AUTHORITY_VALUES = new Set(Object.values(SEMANTIC_CLAIM_SOURCE_AUTHORITIES));
const SUPPORT_STATE_VALUES = new Set(Object.values(SEMANTIC_CLAIM_SUPPORT_STATES));
const CANONICALITY_VALUES = new Set(Object.values(SEMANTIC_CLAIM_CANONICALITY));
const TEMPORAL_SCOPE_VALUES = new Set(Object.values(SEMANTIC_CLAIM_TEMPORAL_SCOPES));
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function cleanText(value = '', limit = 1000) {
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

function cleanIsoDate(value = '') {
  const text = cleanText(value, 80);
  return ISO_DATE_PATTERN.test(text) ? text : '';
}

function normalizeEnum(value, allowedValues, fallback) {
  const normalized = slugSegment(value, '');
  return allowedValues.has(normalized) ? normalized : fallback;
}

function arrayOfCleanStrings(value = [], limit = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, limit);
}

function hasStableSourceRef(source = {}) {
  if (!isPlainObject(source)) return false;
  return !!cleanText(
    source.sourceId
      || source.id
      || source.sourceKey
      || source.rawSourceId
      || source.sourceItemId
      || source.itemId
      || source.memoryId
      || source.episodeId
      || source.summaryId
      || source.topicId
      || source.turnId
      || source.artifactId
      || source.filePath
      || source.path
      || source.ref,
    500,
  );
}

function normalizeSubject(rawSubject = {}) {
  const subject = isPlainObject(rawSubject) ? rawSubject : {};
  const type = slugSegment(subject.type || subject.subjectType || 'entity', 'entity');
  const label = cleanText(subject.label || subject.name || subject.text || subject.id, 240);
  const rawId = cleanText(subject.id || subject.subjectId, 500);
  const id = validateSemanticId(rawId, SEMANTIC_ID_KINDS.ENTITY).valid
    ? rawId
    : buildSemanticEntityId({
        entityType: type,
        entityKey: rawId || label || type,
      });
  return {
    id,
    type,
    label,
  };
}

function normalizeObject(rawObject = {}) {
  const object = isPlainObject(rawObject) ? rawObject : { text: rawObject };
  const text = cleanText(object.text || object.value || '', 1200);
  const label = cleanText(object.label || object.name || text || object.id, 240);
  const id = cleanText(object.id || object.objectId, 500);
  const type = slugSegment(object.type || object.objectType || (text ? 'text' : 'entity'), text ? 'text' : 'entity');
  return {
    id,
    type,
    label,
    text,
  };
}

function normalizeSource(rawSource = {}, domainId = '') {
  const source = isPlainObject(rawSource) ? rawSource : {};
  const fixtureOnly = source.fixtureOnly === true || source.sourceType === 'fixture-only';
  const sourceType = slugSegment(source.sourceType || source.type || sourceTypeForDomain(domainId), fixtureOnly ? 'fixture' : 'source');
  const stableRefPresent = hasStableSourceRef(source);
  const sourceId = stableRefPresent
    ? buildSemanticSourceId({ ...source, sourceType })
    : '';
  return {
    sourceId,
    sourceType,
    excerpt: cleanText(source.excerpt || source.sourceText || source.text || '', 800),
    observedAt: cleanIsoDate(source.observedAt),
    fixtureOnly,
  };
}

function normalizeTemporal(rawTemporal = {}, source = {}, domainId = '') {
  const temporal = isPlainObject(rawTemporal) ? rawTemporal : {};
  const fallback = domainDefaultTemporalScope(domainId) || SEMANTIC_CLAIM_TEMPORAL_SCOPES.UNKNOWN;
  return {
    temporalScope: normalizeEnum(temporal.temporalScope || temporal.scope, TEMPORAL_SCOPE_VALUES, fallback),
    observedAt: cleanIsoDate(temporal.observedAt || source.observedAt),
    validFrom: cleanIsoDate(temporal.validFrom),
    validUntil: cleanIsoDate(temporal.validUntil),
  };
}

function normalizeAuthority(rawAuthority = {}, domainId = '', source = {}) {
  const authority = isPlainObject(rawAuthority) ? rawAuthority : {};
  let fallbackSourceAuthority = domainDefaultAuthority(domainId) || SEMANTIC_CLAIM_SOURCE_AUTHORITIES.ADVISORY;
  let fallbackSupportState = domainDefaultSupportState(domainId) || SEMANTIC_CLAIM_SUPPORT_STATES.RENDERED_ADVISORY;
  let fallbackCanonicality = domainDefaultCanonicality(domainId) || SEMANTIC_CLAIM_CANONICALITY.ADVISORY;
  let fallbackConfidence = domainDefaultConfidence(domainId) || 'medium';

  if (source.fixtureOnly) {
    fallbackSourceAuthority = SEMANTIC_CLAIM_SOURCE_AUTHORITIES.FIXTURE_ONLY;
    fallbackSupportState = SEMANTIC_CLAIM_SUPPORT_STATES.FIXTURE_ONLY;
    fallbackCanonicality = SEMANTIC_CLAIM_CANONICALITY.NOT_CANONICAL;
    fallbackConfidence = 'low';
  }

  let sourceAuthority = normalizeEnum(
    authority.sourceAuthority || authority.authority,
    SOURCE_AUTHORITY_VALUES,
    fallbackSourceAuthority,
  );
  let supportState = normalizeEnum(
    authority.supportState || authority.support,
    SUPPORT_STATE_VALUES,
    fallbackSupportState,
  );
  let canonicality = normalizeEnum(authority.canonicality, CANONICALITY_VALUES, fallbackCanonicality);

  if (domainIsCandidateOnly(domainId)) {
    sourceAuthority = SEMANTIC_CLAIM_SOURCE_AUTHORITIES.CANDIDATE_ONLY;
    supportState = SEMANTIC_CLAIM_SUPPORT_STATES.CANDIDATE_ONLY;
    canonicality = SEMANTIC_CLAIM_CANONICALITY.NOT_CANONICAL;
  } else if (source.fixtureOnly || domainId === DOMAIN_IDS.FIXTURE) {
    sourceAuthority = SEMANTIC_CLAIM_SOURCE_AUTHORITIES.FIXTURE_ONLY;
    supportState = SEMANTIC_CLAIM_SUPPORT_STATES.FIXTURE_ONLY;
    canonicality = SEMANTIC_CLAIM_CANONICALITY.NOT_CANONICAL;
  } else if (!domainCanBeCanonical(domainId) && (sourceAuthority === SEMANTIC_CLAIM_SOURCE_AUTHORITIES.CANONICAL
    || canonicality === SEMANTIC_CLAIM_CANONICALITY.CANONICAL)) {
    sourceAuthority = SEMANTIC_CLAIM_SOURCE_AUTHORITIES.ADVISORY;
    canonicality = SEMANTIC_CLAIM_CANONICALITY.ADVISORY;
    if (supportState === SEMANTIC_CLAIM_SUPPORT_STATES.VERIFIED) {
      supportState = SEMANTIC_CLAIM_SUPPORT_STATES.RENDERED_ADVISORY;
    }
  }

  return {
    sourceAuthority,
    supportState,
    canonicality,
    confidence: normalizeEnum(authority.confidence, CONFIDENCE_VALUES, fallbackConfidence),
  };
}

function normalizeStatus(rawStatus = {}) {
  const status = isPlainObject(rawStatus) ? rawStatus : {};
  const stale = status.stale === true ? true : status.stale === false ? false : null;
  return {
    stale,
    contradictedBy: arrayOfCleanStrings(status.contradictedBy),
    supersededBy: arrayOfCleanStrings(status.supersededBy),
  };
}

function normalizeSemanticClaim(claimLike = {}) {
  if (!isPlainObject(claimLike)) return null;

  const rawSource = isPlainObject(claimLike.source) ? claimLike.source : {};
  const sourceType = slugSegment(rawSource.sourceType || rawSource.type || claimLike.sourceType || '', '');
  const domainId = normalizeDomainId(
    claimLike.domainId
      || claimLike.domain?.id
      || defaultDomainForSourceType(sourceType),
  );
  const source = normalizeSource(rawSource, domainId);
  const subject = normalizeSubject(claimLike.subject || { id: claimLike.subjectId, type: claimLike.subjectType });
  const predicate = normalizeSemanticPredicate(claimLike.predicate || claimLike.predicateId || '');
  const object = normalizeObject(claimLike.object || {
    id: claimLike.objectId,
    type: claimLike.objectType,
    text: claimLike.objectText,
  });
  const temporal = normalizeTemporal(claimLike.temporal, source, domainId);
  const authority = normalizeAuthority(claimLike.authority, domainId, source);
  const status = normalizeStatus(claimLike.status);
  const claimId = buildSemanticClaimId({
    claimId: claimLike.claimId || claimLike.id,
    subject,
    predicate: predicate || { id: cleanText(claimLike.predicateId, 500) },
    object,
    source,
    domainId,
    temporal,
  });

  return {
    schema: PENNY_SEMANTIC_CLAIM_SCHEMA,
    claimId,
    domainId,
    subject,
    predicate,
    object,
    source,
    authority,
    temporal,
    status,
  };
}

function validateClaimIdRef(id = '') {
  const text = cleanText(id, 500);
  return text && validateSemanticId(text, SEMANTIC_ID_KINDS.CLAIM).valid;
}

function validateSemanticClaim(claimLike = {}) {
  const claim = normalizeSemanticClaim(claimLike);
  const raw = isPlainObject(claimLike) ? claimLike : {};
  const rawIsNormalizedClaim = raw.schema === PENNY_SEMANTIC_CLAIM_SCHEMA;
  const validation = {
    schema: PENNY_SEMANTIC_CLAIM_SCHEMA,
    valid: false,
    errors: [],
    claim,
  };
  if (!claim) {
    validation.errors.push('semantic claim must be an object');
    return validation;
  }
  if (!rawIsNormalizedClaim && !isPlainObject(raw.subject) && !raw.subjectId) validation.errors.push('missing subject');
  if (!rawIsNormalizedClaim && !isPlainObject(raw.predicate) && !raw.predicate && !raw.predicateId) {
    validation.errors.push('missing predicate');
  }
  if (!rawIsNormalizedClaim && !Object.prototype.hasOwnProperty.call(raw, 'object') && !raw.objectId && !raw.objectText) {
    validation.errors.push('missing object');
  }
  if (!rawIsNormalizedClaim && !isPlainObject(raw.source)) validation.errors.push('missing source');
  if (claim.schema !== PENNY_SEMANTIC_CLAIM_SCHEMA) validation.errors.push('invalid semantic claim schema');
  if (!validateSemanticId(claim.claimId, SEMANTIC_ID_KINDS.CLAIM).valid) validation.errors.push('missing or invalid claimId');
  if (!validateSemanticDomainId(claim.domainId).valid) validation.errors.push('missing or unregistered domainId');
  if (!validateSemanticId(claim.subject.id, SEMANTIC_ID_KINDS.ENTITY).valid) validation.errors.push('missing or invalid subject.id');
  if (!claim.subject.type) validation.errors.push('missing subject.type');
  if (!domainAllowsClaimSubjectType(claim.domainId, claim.subject.type)) {
    validation.errors.push('subject.type is not allowed for domain');
  }
  if (!claim.predicate || !claim.predicate.id) validation.errors.push('missing or unregistered predicate.id');
  if (!claim.object.type) validation.errors.push('missing object.type');
  if (!claim.object.id && !claim.object.text) validation.errors.push('missing object.id or object.text');
  if (!claim.source.sourceType) validation.errors.push('missing source.sourceType');
  if (!claim.source.fixtureOnly && !claim.source.sourceId) validation.errors.push('missing source.sourceId');
  if (claim.source.sourceId && !validateSemanticId(claim.source.sourceId, SEMANTIC_ID_KINDS.SOURCE).valid) {
    validation.errors.push('invalid source.sourceId');
  }
  if (!claim.authority.sourceAuthority) validation.errors.push('missing authority.sourceAuthority');
  if (!claim.authority.supportState) validation.errors.push('missing authority.supportState');
  if (!claim.authority.canonicality) validation.errors.push('missing authority.canonicality');
  if (!claim.temporal.temporalScope) validation.errors.push('missing temporal.temporalScope');
  if (claim.status.stale === null) validation.errors.push('missing status.stale');

  if (claim.predicate) {
    if (claim.predicate.subjectTypes.length && !claim.predicate.subjectTypes.includes(claim.subject.type)) {
      validation.errors.push('subject.type is not allowed for predicate');
    }
    if (claim.predicate.objectTypes.length && !claim.predicate.objectTypes.includes(claim.object.type)) {
      validation.errors.push('object.type is not allowed for predicate');
    }
  }

  if (claim.status.stale === true && claim.status.contradictedBy.length === 0 && claim.status.supersededBy.length === 0) {
    validation.errors.push('stale claim requires contradictedBy or supersededBy');
  }
  for (const ref of [...claim.status.contradictedBy, ...claim.status.supersededBy]) {
    if (!validateClaimIdRef(ref)) validation.errors.push('stale status reference must be a semantic claim id');
  }
  if (claimIsCandidateOnly(claim) && claim.authority.canonicality === SEMANTIC_CLAIM_CANONICALITY.CANONICAL) {
    validation.errors.push('candidate-only claim cannot be canonical');
  }
  if (claimCanBeTreatedAsCanonical(claim) && !domainCanBeCanonical(claim.domainId)) {
    validation.errors.push('non-canonical domain cannot produce canonical claim');
  }

  validation.valid = validation.errors.length === 0;
  return validation;
}

function claimIsCandidateOnly(claimLike = {}) {
  const claim = claimLike && claimLike.schema === PENNY_SEMANTIC_CLAIM_SCHEMA
    ? claimLike
    : normalizeSemanticClaim(claimLike);
  if (!claim) return false;
  return domainIsCandidateOnly(claim.domainId)
    || claim.authority.sourceAuthority === SEMANTIC_CLAIM_SOURCE_AUTHORITIES.CANDIDATE_ONLY
    || claim.authority.supportState === SEMANTIC_CLAIM_SUPPORT_STATES.CANDIDATE_ONLY
    || claim.authority.canonicality === SEMANTIC_CLAIM_CANONICALITY.NOT_CANONICAL
      && claim.domainId === DOMAIN_IDS.STATIC_CANDIDATE;
}

function claimIsStale(claimLike = {}) {
  const claim = claimLike && claimLike.schema === PENNY_SEMANTIC_CLAIM_SCHEMA
    ? claimLike
    : normalizeSemanticClaim(claimLike);
  if (!claim) return false;
  return claim.status.stale === true;
}

function claimCanBeTreatedAsCanonical(claimLike = {}) {
  const claim = claimLike && claimLike.schema === PENNY_SEMANTIC_CLAIM_SCHEMA
    ? claimLike
    : normalizeSemanticClaim(claimLike);
  if (!claim) return false;
  return domainCanBeCanonical(claim.domainId)
    && domainAllowsClaimSubjectType(claim.domainId, claim.subject.type)
    && !claimIsCandidateOnly(claim)
    && !claimIsStale(claim)
    && claim.source.fixtureOnly !== true
    && !!claim.source.sourceId
    && claim.authority.sourceAuthority === SEMANTIC_CLAIM_SOURCE_AUTHORITIES.CANONICAL
    && claim.authority.supportState === SEMANTIC_CLAIM_SUPPORT_STATES.VERIFIED
    && claim.authority.canonicality === SEMANTIC_CLAIM_CANONICALITY.CANONICAL;
}

function claimCanBeRendered(claimLike = {}) {
  const claim = claimLike && claimLike.schema === PENNY_SEMANTIC_CLAIM_SCHEMA
    ? claimLike
    : normalizeSemanticClaim(claimLike);
  if (!claim) return false;
  if (claim.source.fixtureOnly || !claim.source.sourceId || claimIsStale(claim) || claimIsCandidateOnly(claim)) return false;
  if (!domainCanRenderToPrompt(claim.domainId)) return false;
  return claim.authority.supportState === SEMANTIC_CLAIM_SUPPORT_STATES.VERIFIED
    || claim.authority.supportState === SEMANTIC_CLAIM_SUPPORT_STATES.RENDERED_ADVISORY;
}

function summarizeSemanticClaim(claimLike = {}) {
  const claim = claimLike && claimLike.schema === PENNY_SEMANTIC_CLAIM_SCHEMA
    ? claimLike
    : normalizeSemanticClaim(claimLike);
  if (!claim) return null;
  const subjectLabel = cleanText(claim.subject.label || claim.subject.id, 180);
  const objectLabel = cleanText(claim.object.label || claim.object.text || claim.object.id, 180);
  const relationLabel = claim.predicate ? claim.predicate.label : '';
  const staleLabel = claimIsStale(claim) ? 'stale' : 'not-stale';
  return {
    schema: 'penny-semantic-claim-summary.v1',
    claimId: claim.claimId,
    domainId: claim.domainId,
    relation: claim.predicate ? claim.predicate.id : '',
    relationLabel,
    subject: {
      id: claim.subject.id,
      type: claim.subject.type,
      label: subjectLabel,
    },
    object: {
      id: claim.object.id,
      type: claim.object.type,
      label: objectLabel,
      text: claim.object.text,
    },
    source: {
      sourceId: claim.source.sourceId,
      sourceType: claim.source.sourceType,
    },
    authority: { ...claim.authority },
    temporalScope: claim.temporal.temporalScope,
    stale: claimIsStale(claim),
    candidateOnly: claimIsCandidateOnly(claim),
    canonical: claimCanBeTreatedAsCanonical(claim),
    renderable: claimCanBeRendered(claim),
    text: `${subjectLabel || claim.subject.type} ${relationLabel || 'relates to'} ${objectLabel || claim.object.type}; source=${claim.source.sourceType || 'unknown'}; authority=${claim.authority.sourceAuthority}/${claim.authority.supportState}/${claim.authority.canonicality}; temporal=${claim.temporal.temporalScope}; status=${staleLabel}`,
  };
}

module.exports = {
  PENNY_SEMANTIC_CLAIM_SCHEMA,
  SEMANTIC_CLAIM_SOURCE_AUTHORITIES,
  SEMANTIC_CLAIM_SUPPORT_STATES,
  SEMANTIC_CLAIM_CANONICALITY,
  SEMANTIC_CLAIM_TEMPORAL_SCOPES,
  normalizeSemanticClaim,
  validateSemanticClaim,
  summarizeSemanticClaim,
  claimCanBeTreatedAsCanonical,
  claimCanBeRendered,
  claimIsCandidateOnly,
  claimIsStale,
};
