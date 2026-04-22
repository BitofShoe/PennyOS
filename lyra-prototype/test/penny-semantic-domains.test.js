const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SEMANTIC_ID_KINDS,
  buildSemanticEntityId,
  buildSemanticSourceId,
  validateSemanticId,
} = require('../lib/penny-semantic-ids');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('../lib/penny-semantic-predicates');
const {
  PENNY_SEMANTIC_DOMAIN_REGISTRY_SCHEMA,
  SEMANTIC_DOMAIN_IDS,
  domainAllowsClaimSubjectType,
  domainCanBeCanonical,
  domainCanInfluenceRanking,
  domainCanOverrideExplicitMemory,
  domainCanPromoteToExplicitMemory,
  domainCanRenderToPrompt,
  domainCanSupportPersonalMemory,
  domainDefaultAuthority,
  domainDefaultSupportState,
  domainIdForSourceType,
  domainIsCandidateOnly,
  domainIsPromptTruthEligible,
  domainIsToolEvidenceReceiptEligible,
  domainRequiresReceipt,
  getSemanticDomain,
  listSemanticDomains,
  sourceTypeForDomain,
  validateSemanticDomainId,
} = require('../lib/penny-semantic-domains');
const {
  claimCanBeTreatedAsCanonical,
  normalizeSemanticClaim,
  validateSemanticClaim,
} = require('../lib/penny-semantic-claims');

test('registered authority domains validate as local semantic domain ids', () => {
  const domains = listSemanticDomains();
  const ids = domains.map((domain) => domain.id);

  assert.equal(domains.length, 11);
  assert.equal(new Set(ids).size, domains.length);
  assert.deepEqual(ids, [
    SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY,
    SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    SEMANTIC_DOMAIN_IDS.GLOBAL_ARCHIVE,
    SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER,
    SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
    SEMANTIC_DOMAIN_IDS.OPEN_LOOP,
    SEMANTIC_DOMAIN_IDS.TOOL_EVIDENCE,
    SEMANTIC_DOMAIN_IDS.DOCUMENT_EXTRACTION,
    SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW,
    SEMANTIC_DOMAIN_IDS.RUNTIME_ARTIFACT,
    SEMANTIC_DOMAIN_IDS.FIXTURE,
  ]);

  for (const domain of domains) {
    assert.equal(domain.schema, PENNY_SEMANTIC_DOMAIN_REGISTRY_SCHEMA);
    assert.equal(validateSemanticId(domain.id, SEMANTIC_ID_KINDS.DOMAIN).valid, true);
    assert.equal(validateSemanticDomainId(domain.id).valid, true);
    assert.equal(domain.canOverrideExplicitMemory, false);
    assert.equal(domain.canPromoteToExplicitMemory, false);
  }
  assert.equal(validateSemanticDomainId('explicit-memory').domainId, SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY);
  assert.equal(validateSemanticDomainId('explicit-memory').valid, true);
});

test('explicit memory domain is canonical but still does not auto-promote', () => {
  const domain = getSemanticDomain(SEMANTIC_DOMAIN_IDS.EXPLICIT_MEMORY);

  assert.equal(domain.defaultAuthority, 'canonical');
  assert.equal(domain.defaultSupportState, 'verified');
  assert.equal(domain.defaultCanonicality, 'canonical');
  assert.equal(domainCanBeCanonical(domain.id), true);
  assert.equal(domainCanRenderToPrompt(domain.id), true);
  assert.equal(domainCanInfluenceRanking(domain.id), true);
  assert.equal(domainCanOverrideExplicitMemory(domain.id), false);
  assert.equal(domainCanPromoteToExplicitMemory(domain.id), false);
  assert.equal(domainRequiresReceipt(domain.id), true);
  assert.equal(domainIsPromptTruthEligible(domain.id), true);
  assert.equal(domainIsToolEvidenceReceiptEligible(domain.id), false);
  assert.equal(domainCanSupportPersonalMemory(domain.id), true);
});

test('advisory continuity domains stay advisory', () => {
  for (const domainId of [
    SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    SEMANTIC_DOMAIN_IDS.GLOBAL_ARCHIVE,
    SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER,
    SEMANTIC_DOMAIN_IDS.OPEN_LOOP,
  ]) {
    assert.equal(domainDefaultAuthority(domainId), 'advisory');
    assert.equal(domainDefaultSupportState(domainId), 'rendered-advisory');
    assert.equal(domainCanBeCanonical(domainId), false);
    assert.equal(domainCanOverrideExplicitMemory(domainId), false);
    assert.equal(domainCanPromoteToExplicitMemory(domainId), false);
  }

  assert.equal(domainCanSupportPersonalMemory(SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE), true);
  assert.equal(domainCanSupportPersonalMemory(SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER), false);
  assert.equal(domainIsPromptTruthEligible(SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER), true);
  assert.equal(domainIsPromptTruthEligible(SEMANTIC_DOMAIN_IDS.OPEN_LOOP), false);
});

test('static candidate domain cannot override explicit memory or render as proof', () => {
  const domain = getSemanticDomain(SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE);

  assert.equal(domain.defaultAuthority, 'candidate-only');
  assert.equal(domain.defaultSupportState, 'candidate-only');
  assert.equal(domain.defaultCanonicality, 'not-canonical');
  assert.equal(domainIsCandidateOnly(domain.id), true);
  assert.equal(domainCanBeCanonical(domain.id), false);
  assert.equal(domainCanRenderToPrompt(domain.id), false);
  assert.equal(domainCanInfluenceRanking(domain.id), true);
  assert.equal(domainCanOverrideExplicitMemory(domain.id), false);
  assert.equal(domainIsPromptTruthEligible(domain.id), false);
  assert.equal(domainCanSupportPersonalMemory(domain.id), false);
});

test('repo current-law domain supports repo claims but not personal memory claims', () => {
  assert.equal(domainCanBeCanonical(SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW), true);
  assert.equal(domainAllowsClaimSubjectType(SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW, 'repo-doc'), true);
  assert.equal(domainAllowsClaimSubjectType(SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW, 'project'), true);
  assert.equal(domainAllowsClaimSubjectType(SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW, 'user'), false);
  assert.equal(domainCanSupportPersonalMemory(SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW), false);

  const overclaimedPersonalClaim = normalizeSemanticClaim({
    domainId: SEMANTIC_DOMAIN_IDS.REPO_CURRENT_LAW,
    subject: { id: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }), type: 'user' },
    predicate: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA,
    object: { type: 'text', text: 'lapsang souchong' },
    source: {
      sourceId: buildSemanticSourceId({ sourceType: 'repo-current-law', sourceId: 'docs-readme' }),
      sourceType: 'repo-current-law',
      excerpt: 'Repo docs cannot canonize personal memory.',
    },
    status: { stale: false },
  });
  const validation = validateSemanticClaim(overclaimedPersonalClaim);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes('subject.type is not allowed for domain'));
  assert.equal(claimCanBeTreatedAsCanonical(overclaimedPersonalClaim), false);
});

test('tool evidence domain remains sibling evidence, not PromptTruth', () => {
  const domain = getSemanticDomain(SEMANTIC_DOMAIN_IDS.TOOL_EVIDENCE);

  assert.equal(domain.defaultAuthority, 'advisory');
  assert.equal(domain.defaultSupportState, 'verified');
  assert.equal(domainCanRenderToPrompt(domain.id), false);
  assert.equal(domainCanInfluenceRanking(domain.id), false);
  assert.equal(domainIsPromptTruthEligible(domain.id), false);
  assert.equal(domainIsToolEvidenceReceiptEligible(domain.id), true);
  assert.equal(domainRequiresReceipt(domain.id), true);
});

test('source type mapping stays local and registered where expected', () => {
  assert.equal(domainIdForSourceType('archive-episode'), SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE);
  assert.equal(domainIdForSourceType('document-excerpt'), SEMANTIC_DOMAIN_IDS.DOCUMENT_EXTRACTION);
  assert.equal(sourceTypeForDomain(SEMANTIC_DOMAIN_IDS.RUNTIME_ARTIFACT), 'runtime-artifact');

  const unknownDomainId = domainIdForSourceType('future-external-graph');
  assert.equal(unknownDomainId, 'penny:domain:future-external-graph');
  assert.equal(validateSemanticDomainId(unknownDomainId).valid, false);
});

test('unknown domains fail closed', () => {
  const unknown = 'penny:domain:definitely-authoritative';
  const validation = validateSemanticDomainId(unknown);

  assert.equal(validation.valid, false);
  assert.equal(validation.registered, false);
  assert.equal(validation.reason, 'unregistered semantic domain');
  assert.equal(getSemanticDomain(unknown), null);
  assert.equal(domainCanBeCanonical(unknown), false);
  assert.equal(domainCanRenderToPrompt(unknown), false);
  assert.equal(domainCanInfluenceRanking(unknown), false);
  assert.equal(domainCanOverrideExplicitMemory(unknown), false);
  assert.equal(domainCanPromoteToExplicitMemory(unknown), false);
  assert.equal(domainIsPromptTruthEligible(unknown), false);
  assert.equal(domainIsToolEvidenceReceiptEligible(unknown), false);
  assert.equal(domainAllowsClaimSubjectType(unknown, 'user'), false);
  assert.equal(domainRequiresReceipt(unknown), true);
});

test('domain access returns copies instead of mutable shared definitions', () => {
  const first = getSemanticDomain(SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER);
  first.sourceTypes.push('mutated');
  first.canRenderToPrompt = false;

  const second = getSemanticDomain(SEMANTIC_DOMAIN_IDS.RESEARCH_LEDGER);
  assert.equal(second.sourceTypes.includes('mutated'), false);
  assert.equal(second.canRenderToPrompt, true);
});
