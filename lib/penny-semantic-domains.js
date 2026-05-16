const {
  SEMANTIC_ID_KINDS,
  buildSemanticDomainId,
  validateSemanticId,
} = require('./penny-semantic-ids');

const PENNY_SEMANTIC_DOMAIN_REGISTRY_SCHEMA = 'penny-semantic-domain-registry.v1';

const SEMANTIC_DOMAIN_IDS = Object.freeze({
  EXPLICIT_MEMORY: 'penny:domain:explicit-memory',
  SESSION_ARCHIVE: 'penny:domain:session-archive',
  GLOBAL_ARCHIVE: 'penny:domain:global-archive',
  RESEARCH_LEDGER: 'penny:domain:research-ledger',
  STATIC_CANDIDATE: 'penny:domain:static-candidate',
  OPEN_LOOP: 'penny:domain:open-loop',
  TOOL_EVIDENCE: 'penny:domain:tool-evidence',
  DOCUMENT_EXTRACTION: 'penny:domain:document-extraction',
  REPO_CURRENT_LAW: 'penny:domain:repo-current-law',
  RUNTIME_ARTIFACT: 'penny:domain:runtime-artifact',
  FIXTURE: 'penny:domain:fixture',
});

const SEMANTIC_DOMAIN_SOURCE_AUTHORITIES = Object.freeze({
  CANONICAL: 'canonical',
  ADVISORY: 'advisory',
  CANDIDATE_ONLY: 'candidate-only',
  FIXTURE_ONLY: 'fixture-only',
});

const SEMANTIC_DOMAIN_SUPPORT_STATES = Object.freeze({
  VERIFIED: 'verified',
  RENDERED_ADVISORY: 'rendered-advisory',
  CANDIDATE_ONLY: 'candidate-only',
  FIXTURE_ONLY: 'fixture-only',
});

const SEMANTIC_DOMAIN_CANONICALITY = Object.freeze({
  CANONICAL: 'canonical',
  ADVISORY: 'advisory',
  NOT_CANONICAL: 'not-canonical',
});

const REPO_CURRENT_LAW_SUBJECT_TYPES = Object.freeze([
  'repo',
  'repo-doc',
  'document',
  'file',
  'plan',
  'artifact',
  'commit',
  'project',
  'source',
  'runtime-artifact',
]);

const RAW_DOMAINS = Object.freeze([
  {
    id: SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
    label: 'explicit memory',
    sourceTypes: ['explicit-memory', 'memory'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.CANONICAL,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.VERIFIED,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.CANONICAL,
    defaultTemporalScope: 'current',
    defaultConfidence: 'high',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: true,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: true,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: true,
    allowedClaimSubjectTypes: [],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    label: 'session archive',
    sourceTypes: ['archive-episode', 'session-archive', 'session-summary'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.RENDERED_ADVISORY,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'historical',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: true,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: true,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: true,
    allowedClaimSubjectTypes: [],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.GLOBAL_ARCHIVE,
    label: 'global archive',
    sourceTypes: ['global-archive', 'archive-summary', 'archive-pattern'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.RENDERED_ADVISORY,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'historical',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: true,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: true,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: true,
    allowedClaimSubjectTypes: [],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER,
    label: 'research ledger',
    sourceTypes: ['research-ledger', 'research-topic'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.RENDERED_ADVISORY,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'current',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: true,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: true,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: ['research-topic', 'repo', 'repo-doc', 'document', 'file', 'plan', 'artifact', 'project', 'source'],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
    label: 'static embedding candidate',
    sourceTypes: ['static-candidate', 'static-embedding-candidate'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.CANDIDATE_ONLY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.CANDIDATE_ONLY,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.NOT_CANONICAL,
    defaultTemporalScope: 'unknown',
    defaultConfidence: 'low',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: false,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: false,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: [],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.OPEN_LOOP,
    label: 'open loop',
    sourceTypes: ['open-loop'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.RENDERED_ADVISORY,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'current',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: true,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: false,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: ['open-loop', 'project', 'plan', 'claim', 'memory-item', 'research-topic'],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.TOOL_EVIDENCE,
    label: 'tool evidence',
    sourceTypes: ['tool-evidence'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.VERIFIED,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'current',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: false,
    canInfluenceRanking: false,
    requiresReceipt: true,
    promptTruthChannelEligible: false,
    toolEvidenceReceiptEligible: true,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: ['tool-evidence', 'source', 'repo', 'repo-doc', 'document', 'file', 'artifact'],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.DOCUMENT_EXTRACTION,
    label: 'document extraction',
    sourceTypes: ['document-extraction', 'document-excerpt', 'extracted-document'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.VERIFIED,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'current',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: false,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: false,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: ['document', 'file', 'source', 'repo-doc', 'artifact'],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW,
    label: 'repo current law',
    sourceTypes: ['repo-current-law'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.CANONICAL,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.VERIFIED,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.CANONICAL,
    defaultTemporalScope: 'current',
    defaultConfidence: 'high',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: true,
    canInfluenceRanking: true,
    requiresReceipt: true,
    promptTruthChannelEligible: true,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: REPO_CURRENT_LAW_SUBJECT_TYPES,
  },
  {
    id: SEMANTIC_DOMAIN_IDS.RUNTIME_ARTIFACT,
    label: 'runtime artifact',
    sourceTypes: ['runtime-artifact'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.ADVISORY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.VERIFIED,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.ADVISORY,
    defaultTemporalScope: 'current',
    defaultConfidence: 'medium',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: false,
    canInfluenceRanking: false,
    requiresReceipt: true,
    promptTruthChannelEligible: false,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: ['runtime-artifact', 'artifact', 'source'],
  },
  {
    id: SEMANTIC_DOMAIN_IDS.FIXTURE,
    label: 'fixture',
    sourceTypes: ['fixture', 'fixture-only'],
    defaultAuthority: SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.FIXTURE_ONLY,
    defaultSupportState: SEMANTIC_DOMAIN_SUPPORT_STATES.FIXTURE_ONLY,
    defaultCanonicality: SEMANTIC_DOMAIN_CANONICALITY.NOT_CANONICAL,
    defaultTemporalScope: 'ephemeral',
    defaultConfidence: 'low',
    canOverrideExplicitMemory: false,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: false,
    canInfluenceRanking: false,
    requiresReceipt: false,
    promptTruthChannelEligible: false,
    toolEvidenceReceiptEligible: false,
    personalMemoryEligible: false,
    allowedClaimSubjectTypes: [],
  },
]);

function cleanText(value = '', limit = 500) {
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

function cloneDomain(domain) {
  if (!domain) return null;
  return {
    schema: PENNY_SEMANTIC_DOMAIN_REGISTRY_SCHEMA,
    id: domain.id,
    label: domain.label,
    sourceTypes: [...domain.sourceTypes],
    defaultAuthority: domain.defaultAuthority,
    defaultSupportState: domain.defaultSupportState,
    defaultCanonicality: domain.defaultCanonicality,
    defaultTemporalScope: domain.defaultTemporalScope,
    defaultConfidence: domain.defaultConfidence,
    canOverrideExplicitMemory: domain.canOverrideExplicitMemory === true,
    canPromoteToExplicitMemory: false,
    canRenderToPrompt: domain.canRenderToPrompt === true,
    canInfluenceRanking: domain.canInfluenceRanking === true,
    requiresReceipt: domain.requiresReceipt === true,
    promptTruthChannelEligible: domain.promptTruthChannelEligible === true,
    toolEvidenceReceiptEligible: domain.toolEvidenceReceiptEligible === true,
    personalMemoryEligible: domain.personalMemoryEligible === true,
    allowedClaimSubjectTypes: [...domain.allowedClaimSubjectTypes],
  };
}

function normalizeSemanticDomainId(value = '') {
  const text = cleanText(value, 500);
  if (!text) return '';
  if (text.startsWith('penny:domain:')) return text;
  if (/^[a-z0-9][a-z0-9._-]*$/.test(text)) return buildSemanticDomainId(text);
  return '';
}

const DOMAIN_BY_ID = new Map(RAW_DOMAINS.map((domain) => [domain.id, cloneDomain(domain)]));
const SOURCE_TYPE_TO_DOMAIN_ID = new Map();
for (const domain of RAW_DOMAINS) {
  for (const sourceType of domain.sourceTypes) {
    SOURCE_TYPE_TO_DOMAIN_ID.set(sourceType, domain.id);
  }
}

function listSemanticDomains() {
  return Array.from(DOMAIN_BY_ID.values()).map(cloneDomain);
}

function getSemanticDomain(domainId) {
  const id = normalizeSemanticDomainId(domainId);
  return cloneDomain(DOMAIN_BY_ID.get(id));
}

function validateSemanticDomainId(domainId) {
  const id = normalizeSemanticDomainId(domainId);
  const validation = {
    schema: PENNY_SEMANTIC_DOMAIN_REGISTRY_SCHEMA,
    domainId: id || cleanText(domainId, 500),
    valid: false,
    registered: false,
    reason: '',
  };
  const idValidation = validateSemanticId(id || validation.domainId, SEMANTIC_ID_KINDS.DOMAIN);
  if (!idValidation.valid) {
    validation.reason = idValidation.reason || 'invalid semantic domain id';
    return validation;
  }
  validation.domainId = idValidation.id;
  const domain = DOMAIN_BY_ID.get(idValidation.id);
  if (!domain) {
    validation.reason = 'unregistered semantic domain';
    return validation;
  }
  validation.valid = true;
  validation.registered = true;
  validation.domain = cloneDomain(domain);
  return validation;
}

function normalizeSemanticDomain(domainLike) {
  if (!domainLike) return null;
  if (typeof domainLike === 'string') return getSemanticDomain(domainLike);
  if (typeof domainLike !== 'object' || Array.isArray(domainLike)) return null;
  return getSemanticDomain(domainLike.domainId || domainLike.id || '');
}

function domainIdForSourceType(sourceType = '') {
  const type = slugSegment(sourceType, '');
  if (!type) return SEMANTIC_DOMAIN_IDS.FIXTURE;
  return SOURCE_TYPE_TO_DOMAIN_ID.get(type) || buildSemanticDomainId(type);
}

function sourceTypeForDomain(domainId = '') {
  const domain = getSemanticDomain(domainId);
  if (domain && domain.sourceTypes.length) return domain.sourceTypes[0];
  const id = normalizeSemanticDomainId(domainId);
  return slugSegment(id.replace(/^penny:domain:/, ''), 'source');
}

function domainDefaultAuthority(domainId) {
  const domain = getSemanticDomain(domainId);
  return domain ? domain.defaultAuthority : '';
}

function domainDefaultSupportState(domainId) {
  const domain = getSemanticDomain(domainId);
  return domain ? domain.defaultSupportState : '';
}

function domainDefaultCanonicality(domainId) {
  const domain = getSemanticDomain(domainId);
  return domain ? domain.defaultCanonicality : '';
}

function domainDefaultTemporalScope(domainId) {
  const domain = getSemanticDomain(domainId);
  return domain ? domain.defaultTemporalScope : '';
}

function domainDefaultConfidence(domainId) {
  const domain = getSemanticDomain(domainId);
  return domain ? domain.defaultConfidence : '';
}

function domainCanBeCanonical(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.defaultAuthority === SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.CANONICAL
    && domain.defaultCanonicality === SEMANTIC_DOMAIN_CANONICALITY.CANONICAL;
}

function domainIsCandidateOnly(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && (domain.defaultAuthority === SEMANTIC_DOMAIN_SOURCE_AUTHORITIES.CANDIDATE_ONLY
    || domain.defaultSupportState === SEMANTIC_DOMAIN_SUPPORT_STATES.CANDIDATE_ONLY);
}

function domainCanOverrideExplicitMemory(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.canOverrideExplicitMemory === true;
}

function domainCanPromoteToExplicitMemory(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.canPromoteToExplicitMemory === true;
}

function domainCanRenderToPrompt(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.canRenderToPrompt === true;
}

function domainCanInfluenceRanking(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.canInfluenceRanking === true;
}

function domainRequiresReceipt(domainId) {
  const domain = getSemanticDomain(domainId);
  return domain ? domain.requiresReceipt === true : true;
}

function domainIsPromptTruthEligible(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.promptTruthChannelEligible === true;
}

function domainIsToolEvidenceReceiptEligible(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.toolEvidenceReceiptEligible === true;
}

function domainCanSupportPersonalMemory(domainId) {
  const domain = getSemanticDomain(domainId);
  return !!domain && domain.personalMemoryEligible === true;
}

function domainAllowsClaimSubjectType(domainId, subjectType = '') {
  const domain = getSemanticDomain(domainId);
  if (!domain) return false;
  const type = slugSegment(subjectType, '');
  if (!type) return false;
  if (domain.allowedClaimSubjectTypes.length === 0) return true;
  return domain.allowedClaimSubjectTypes.includes(type);
}

module.exports = {
  PENNY_SEMANTIC_DOMAIN_REGISTRY_SCHEMA,
  SEMANTIC_DOMAIN_IDS,
  SEMANTIC_DOMAIN_SOURCE_AUTHORITIES,
  SEMANTIC_DOMAIN_SUPPORT_STATES,
  SEMANTIC_DOMAIN_CANONICALITY,
  listSemanticDomains,
  getSemanticDomain,
  validateSemanticDomainId,
  normalizeSemanticDomain,
  normalizeSemanticDomainId,
  domainIdForSourceType,
  sourceTypeForDomain,
  domainDefaultAuthority,
  domainDefaultSupportState,
  domainDefaultCanonicality,
  domainDefaultTemporalScope,
  domainDefaultConfidence,
  domainCanBeCanonical,
  domainIsCandidateOnly,
  domainCanOverrideExplicitMemory,
  domainCanPromoteToExplicitMemory,
  domainCanRenderToPrompt,
  domainCanInfluenceRanking,
  domainRequiresReceipt,
  domainIsPromptTruthEligible,
  domainIsToolEvidenceReceiptEligible,
  domainCanSupportPersonalMemory,
  domainAllowsClaimSubjectType,
};
