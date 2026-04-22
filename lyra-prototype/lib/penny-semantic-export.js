const {
  SEMANTIC_ID_KINDS,
  buildSemanticEntityId,
  buildSemanticSourceId,
  semanticIdIsDereferenceable,
  validateSemanticId,
} = require('./penny-semantic-ids');
const {
  SEMANTIC_DOMAIN_IDS,
  listSemanticDomains,
} = require('./penny-semantic-domains');
const {
  SEMANTIC_PREDICATE_IDS,
  listSemanticPredicates,
} = require('./penny-semantic-predicates');
const {
  claimCanBeTreatedAsCanonical,
  claimIsCandidateOnly,
  claimIsStale,
  normalizeSemanticClaim,
  summarizeSemanticClaim,
  validateSemanticClaim,
} = require('./penny-semantic-claims');
const {
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_RELATIONS,
  normalizeMemoryLinkSet,
} = require('./penny-memory-links');

const PENNY_SEMANTIC_EXPORT_SCHEMA = 'penny-semantic-export.v1';
const PENNY_SEMANTIC_EXPORT_FORMAT = 'penny-json';

const SEMANTIC_EXPORT_MODES = Object.freeze({
  FIXTURE: 'fixture',
  LOCAL_INPUT: 'local-input',
});

const SEMANTIC_EXPORT_LIMITS = Object.freeze([
  'Local debug export only.',
  'Not public Linked Data.',
  'No automatic dereferencing.',
  'No RDF/XML parsing.',
  'No JSON-LD/RDF library dependency.',
  'No SPARQL/triplestore dependency.',
  'No ontology inference or graph DB replacement.',
  'No PromptTruth or toolEvidenceReceipt expansion.',
  'No canonical memory writes or automatic memory promotion.',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function asArray(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function cleanText(value = '', limit = 1000) {
  const text = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, Math.max(0, limit));
}

function normalizeIso(value = '', fallback = new Date().toISOString()) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : fallback;
  }
  const text = cleanText(value, 120);
  if (!text) return fallback;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function normalizeSemanticExportMode(value = '') {
  const mode = cleanText(value, 80).toLowerCase().replace(/[_\s]+/g, '-');
  return Object.values(SEMANTIC_EXPORT_MODES).includes(mode)
    ? mode
    : SEMANTIC_EXPORT_MODES.FIXTURE;
}

function collectRawClaims(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return [
    ...asArray(source.claims),
    ...asArray(source.semanticClaims),
  ];
}

function collectRawLinks(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return [
    ...asArray(source.links),
    ...asArray(source.memoryLinks),
    ...asArray(source.dynamicMemoryLinks),
  ];
}

function buildSemanticExportFixtureInput(generatedAt = new Date().toISOString()) {
  const observedAt = normalizeIso(generatedAt);
  const userId = buildSemanticEntityId({ entityType: 'user', entityKey: 'self' });
  const explicitSourceId = buildSemanticSourceId({
    sourceType: 'explicit-memory',
    sourceId: 'semantic-export:favorite-tea-current',
  });
  const archiveSourceId = buildSemanticSourceId({
    sourceType: 'archive-episode',
    sourceId: 'semantic-export:favorite-tea-stale',
  });
  const staticSourceId = buildSemanticSourceId({
    sourceType: 'static-candidate',
    sourceId: 'semantic-export:favorite-tea-static-candidate',
  });

  const currentClaim = normalizeSemanticClaim({
    domainId: SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
    subject: {
      id: userId,
      type: 'user',
      label: 'the user',
    },
    predicate: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    object: {
      type: 'text',
      label: 'lapsang souchong',
      text: 'lapsang souchong',
    },
    source: {
      sourceId: explicitSourceId,
      sourceType: 'explicit-memory',
      excerpt: 'favorite tea = lapsang souchong',
      observedAt,
    },
    temporal: {
      temporalScope: 'current',
      observedAt,
    },
    status: {
      stale: false,
    },
  });
  const staleClaim = normalizeSemanticClaim({
    domainId: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    subject: {
      id: userId,
      type: 'user',
      label: 'the user',
    },
    predicate: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    object: {
      type: 'text',
      label: 'oolong',
      text: 'oolong',
    },
    source: {
      sourceId: archiveSourceId,
      sourceType: 'archive-episode',
      excerpt: 'Earlier archive note said the favorite tea was oolong.',
      observedAt,
    },
    temporal: {
      temporalScope: 'historical',
      observedAt,
    },
    status: {
      stale: true,
      supersededBy: [currentClaim.claimId],
    },
  });
  const staticCandidateClaim = normalizeSemanticClaim({
    domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
    subject: {
      id: userId,
      type: 'user',
      label: 'the user',
    },
    predicate: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    object: {
      type: 'text',
      label: 'jasmine',
      text: 'jasmine',
    },
    source: {
      sourceId: staticSourceId,
      sourceType: 'static-candidate',
      excerpt: 'A static candidate mentions jasmine tea near the user.',
      observedAt,
    },
    temporal: {
      temporalScope: 'unknown',
      observedAt,
    },
    status: {
      stale: false,
    },
  });

  return {
    claims: [currentClaim, staleClaim, staticCandidateClaim],
    links: [
      {
        sourceClaimId: currentClaim.claimId,
        targetClaimId: staleClaim.claimId,
        predicateId: SEMANTIC_PREDICATE_IDS.CURRENT_CORRECTION_FOR,
        relation: MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
        domainId: SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
        sourceAuthority: 'canonical',
        supportState: 'verified',
        support: {
          state: 'explicit',
          sourceReceipts: [
            {
              sourceId: explicitSourceId,
              type: 'explicit-memory',
              excerpt: 'favorite tea = lapsang souchong',
              observedAt,
            },
          ],
        },
        evidence: [
          {
            sourceId: explicitSourceId,
            excerpt: 'favorite tea = lapsang souchong',
            observedAt,
          },
        ],
        authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
        createdBy: 'fixture',
        createdAt: observedAt,
      },
      {
        sourceClaimId: staticCandidateClaim.claimId,
        targetClaimId: currentClaim.claimId,
        predicateId: SEMANTIC_PREDICATE_IDS.RELATED_BUT_WEAK,
        relation: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
        domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
        sourceAuthority: 'candidate-only',
        supportState: 'candidate-only',
        support: {
          state: 'semantic-candidate',
          sourceReceipts: [
            {
              sourceId: staticSourceId,
              type: 'static-candidate',
              excerpt: 'Static candidate similarity only.',
              observedAt,
            },
          ],
        },
        authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.NONE,
        createdBy: 'fixture',
        createdAt: observedAt,
      },
    ],
  };
}

function normalizeClaimsForExport(input = {}) {
  const claims = [];
  const summaries = [];
  const heldBack = [];

  collectRawClaims(input).forEach((rawClaim, index) => {
    const validation = validateSemanticClaim(rawClaim);
    if (!validation.valid) {
      heldBack.push({
        index,
        reason: validation.errors.join('; '),
      });
      return;
    }
    claims.push(validation.claim);
    summaries.push(summarizeSemanticClaim(validation.claim));
  });

  return { claims, summaries, heldBack };
}

function collectSemanticIdsFromExport({ claims = [], links = [], domains = [], predicates = [] } = {}) {
  const ids = new Set();
  const add = (value, expectedKind = null) => {
    const text = cleanText(value, 500);
    if (!text || !text.startsWith('penny:')) return;
    const validation = validateSemanticId(text, expectedKind);
    if (validation.valid) ids.add(validation.id);
  };

  for (const claim of claims) {
    add(claim.claimId, SEMANTIC_ID_KINDS.CLAIM);
    add(claim.domainId, SEMANTIC_ID_KINDS.DOMAIN);
    add(claim.subject?.id, SEMANTIC_ID_KINDS.ENTITY);
    add(claim.predicate?.id, SEMANTIC_ID_KINDS.PREDICATE);
    add(claim.object?.id, null);
    add(claim.source?.sourceId, SEMANTIC_ID_KINDS.SOURCE);
    for (const ref of [...asArray(claim.status?.contradictedBy), ...asArray(claim.status?.supersededBy)]) {
      add(ref, SEMANTIC_ID_KINDS.CLAIM);
    }
  }
  for (const link of links) {
    add(link.linkId, SEMANTIC_ID_KINDS.LINK);
    add(link.sourceClaimId, SEMANTIC_ID_KINDS.CLAIM);
    add(link.targetClaimId, SEMANTIC_ID_KINDS.CLAIM);
    add(link.predicateId, SEMANTIC_ID_KINDS.PREDICATE);
    add(link.domainId, SEMANTIC_ID_KINDS.DOMAIN);
    add(link.sourceId, null);
    add(link.targetId, null);
  }
  for (const domain of domains) add(domain.id, SEMANTIC_ID_KINDS.DOMAIN);
  for (const predicate of predicates) {
    add(predicate.id, SEMANTIC_ID_KINDS.PREDICATE);
    add(predicate.inversePredicateId, SEMANTIC_ID_KINDS.PREDICATE);
  }
  return [...ids].sort();
}

function summarizeSemanticExport({ claims = [], links = [], domains = [], predicates = [], heldBack = {}, semanticIds = [] } = {}) {
  return {
    claimCount: claims.length,
    linkCount: links.length,
    domainCount: domains.length,
    predicateCount: predicates.length,
    canonicalClaimCount: claims.filter(claimCanBeTreatedAsCanonical).length,
    candidateOnlyClaimCount: claims.filter(claimIsCandidateOnly).length,
    staleClaimCount: claims.filter(claimIsStale).length,
    heldBackClaimCount: asArray(heldBack.claims).length,
    heldBackLinkCount: asArray(heldBack.links).length,
    semanticIdCount: semanticIds.length,
    dereferenceableSemanticIdCount: semanticIds.filter((id) => semanticIdIsDereferenceable(id)).length,
    format: PENNY_SEMANTIC_EXPORT_FORMAT,
    localOnly: true,
    readOnly: true,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrites: false,
    memoryPromotion: false,
    uriDereferencing: false,
  };
}

function buildSemanticExportArtifact({
  generatedAt = new Date().toISOString(),
  mode = '',
  input = null,
} = {}) {
  const timestamp = normalizeIso(generatedAt);
  const measurementMode = normalizeSemanticExportMode(mode || (input ? SEMANTIC_EXPORT_MODES.LOCAL_INPUT : SEMANTIC_EXPORT_MODES.FIXTURE));
  const sourceInput = isPlainObject(input) ? input : buildSemanticExportFixtureInput(timestamp);
  const domains = listSemanticDomains();
  const predicates = listSemanticPredicates();
  const claimResult = normalizeClaimsForExport(sourceInput);
  const linkSet = normalizeMemoryLinkSet({
    generatedAt: timestamp,
    mode: measurementMode,
    links: collectRawLinks(sourceInput),
  }, { now: timestamp });
  const heldBack = {
    claims: claimResult.heldBack,
    links: linkSet.heldBack,
  };
  const semanticIds = collectSemanticIdsFromExport({
    claims: claimResult.claims,
    links: linkSet.links,
    domains,
    predicates,
  });
  const summary = summarizeSemanticExport({
    claims: claimResult.claims,
    links: linkSet.links,
    domains,
    predicates,
    heldBack,
    semanticIds,
  });

  return {
    schema: PENNY_SEMANTIC_EXPORT_SCHEMA,
    artifactKind: 'semantic-export',
    format: PENNY_SEMANTIC_EXPORT_FORMAT,
    generatedAt: timestamp,
    mode: measurementMode,
    localOnly: true,
    readOnly: true,
    behaviorChanged: false,
    liveModelCalls: false,
    liveChatTouched: false,
    runtimeVoiceChanged: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrites: false,
    memoryPromotion: false,
    defaultPromptLimitsRaised: false,
    rdfXmlParserAdded: false,
    jsonLdAdded: false,
    sparqlAdded: false,
    triplestoreDependency: false,
    ontologyInference: false,
    graphDbMigration: false,
    linkedDataPublishing: false,
    uriDereferencing: false,
    automaticDereferencing: false,
    semanticIdsDereferenceable: false,
    claims: claimResult.claims,
    claimSummaries: claimResult.summaries,
    links: linkSet.links,
    linkSummary: linkSet.summary,
    domains,
    predicates,
    semanticIds,
    heldBack,
    summary,
    limits: [...SEMANTIC_EXPORT_LIMITS],
  };
}

module.exports = {
  PENNY_SEMANTIC_EXPORT_SCHEMA,
  PENNY_SEMANTIC_EXPORT_FORMAT,
  SEMANTIC_EXPORT_MODES,
  SEMANTIC_EXPORT_LIMITS,
  buildSemanticExportArtifact,
  buildSemanticExportFixtureInput,
  collectRawClaims,
  collectRawLinks,
  normalizeClaimsForExport,
  normalizeSemanticExportMode,
  summarizeSemanticExport,
};
