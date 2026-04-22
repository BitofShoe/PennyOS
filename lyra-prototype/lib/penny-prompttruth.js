const PROMPT_TRUTH_SCHEMA = 'penny-prompttruth.v1';

const {
  claimCanBeRendered,
  normalizeSemanticClaim,
  summarizeSemanticClaim,
} = require('./penny-semantic-claims');

const PROMPT_TRUTH_CHANNEL_KEYS = Object.freeze([
  'stableFacts',
  'memoryBooks',
  'sessionArchive',
  'globalArchive',
  'researchLedger',
]);

const PROMPT_TRUTH_ADVISORY_CHANNEL_KEYS = Object.freeze([
  'memoryBooks',
  'sessionArchive',
  'globalArchive',
  'researchLedger',
]);

const PROMPT_TRUTH_CHANNEL_STATES = Object.freeze([
  'rendered',
  'held_back',
  'candidate',
  'no_candidate',
  'ineligible',
  'disabled',
  'unavailable',
  'unknown',
]);

const PROMPT_TRUTH_HOLDBACK_REASONS = Object.freeze({
  CANON_PRIORITY: 'canon-priority-suppression',
  LEDGER_DISABLED: 'ledger-prompt-disabled',
});

const PROMPT_TRUTH_AUDIT_LIMITS = Object.freeze({
  sessionArchive: 6,
  globalArchive: 6,
  memoryBooks: 4,
  researchLedger: 4,
});

const PROMPT_TRUTH_RENDERED_CLAIM_LIMIT = 8;

const PROMPT_TRUTH_RENDERED_CLAIM_SOURCE_AUTHORITIES = new Set([
  'canonical',
  'advisory',
]);

const PROMPT_TRUTH_RENDERED_CLAIM_SUPPORT_STATES = new Set([
  'verified',
  'rendered-advisory',
]);

function compactText(value = '', limit = 500) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= limit ? text : text.slice(0, Math.max(0, limit)).trim();
}

function uniqueStrings(values = [], limit = 12) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = compactText(value);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function listRenderedClaimInputs(...values) {
  return values.flatMap((value) => {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null || value === '') return [];
    return [value];
  });
}

function renderedClaimAuthorityFromSemanticClaim(raw = {}) {
  const claim = normalizeSemanticClaim(raw);
  if (!claim || !claimCanBeRendered(claim)) return null;
  const summary = summarizeSemanticClaim(claim);
  if (!summary?.claimId || !summary?.domainId) return null;
  return {
    renderedClaimId: summary.claimId,
    domainId: summary.domainId,
    sourceAuthority: summary.authority?.sourceAuthority || '',
    supportState: summary.authority?.supportState || '',
    temporalScope: summary.temporalScope || '',
  };
}

function normalizePromptTruthRenderedClaim(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const semanticClaim = raw.claim || raw.semanticClaim || raw.structuredClaim;
  const compactRenderedClaim = Boolean(
    raw.renderedClaimId
      || (raw.claimId && raw.domainId && (raw.sourceAuthority || raw.supportState || raw.temporalScope)),
  );
  const semanticLike = semanticClaim
    || (!compactRenderedClaim && (
      raw.schema === 'penny-semantic-claim.v1'
      || raw.subject
      || raw.predicate
      || raw.object
      || raw.source
    ))
    ? (semanticClaim || raw)
    : null;
  const fromClaim = semanticLike ? renderedClaimAuthorityFromSemanticClaim(semanticLike) : null;
  const source = fromClaim || raw;
  if (source.stale === true || source.status?.stale === true) return null;
  const sourceAuthority = compactText(
    source.sourceAuthority
      || source.authority?.sourceAuthority
      || source.authority,
    80,
  ).toLowerCase();
  const supportState = compactText(
    source.supportState
      || source.authority?.supportState
      || source.support,
    80,
  ).toLowerCase();
  if (!PROMPT_TRUTH_RENDERED_CLAIM_SOURCE_AUTHORITIES.has(sourceAuthority)) return null;
  if (!PROMPT_TRUTH_RENDERED_CLAIM_SUPPORT_STATES.has(supportState)) return null;

  const renderedClaimId = compactText(
    source.renderedClaimId
      || source.claimId
      || source.id,
    500,
  );
  const domainId = compactText(source.domainId || source.domain?.id, 500);
  if (!renderedClaimId || !domainId) return null;

  return {
    renderedClaimId,
    domainId,
    sourceAuthority,
    supportState,
    temporalScope: compactText(
      source.temporalScope
        || source.temporal?.temporalScope
        || source.temporal?.scope
        || 'unknown',
      80,
    ).toLowerCase() || 'unknown',
  };
}

function normalizePromptTruthRenderedClaims(values = [], limit = PROMPT_TRUTH_RENDERED_CLAIM_LIMIT) {
  const max = Math.max(0, Math.floor(Number(limit || 0)));
  if (max <= 0) return [];
  const seen = new Set();
  const output = [];
  for (const raw of Array.isArray(values) ? values : [values]) {
    const claim = normalizePromptTruthRenderedClaim(raw);
    if (!claim) continue;
    const key = claim.renderedClaimId.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(claim);
    if (output.length >= max) break;
  }
  return output;
}

function normalizePromptTruthChannelState(value = '') {
  const text = String(value || '').trim().toLowerCase();
  return PROMPT_TRUTH_CHANNEL_STATES.includes(text) ? text : '';
}

function preferRenderedCompatibilityBoolean(renderedValue, aliasValue, fallback = false) {
  if (renderedValue === true) return true;
  if (renderedValue === false) return false;
  if (aliasValue === true) return true;
  if (aliasValue === false) return false;
  return fallback === true;
}

function derivePromptTruthChannelState(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const explicitState = normalizePromptTruthChannelState(value.state);
  if (explicitState) return explicitState;
  const candidateCount = Math.max(0, Number(value.candidateCount || 0) || 0);
  const renderedCount = Math.max(0, Number(value.renderedCount || 0) || 0);
  const renderedClaimCount = normalizePromptTruthRenderedClaims(
    listRenderedClaimInputs(value.renderedClaims, value.renderedClaim, value.renderedClaimSummary),
    1,
  ).length;
  const heldBackReason = String(value.heldBackReason || '').trim();
  if (renderedCount > 0 || renderedClaimCount > 0) return 'rendered';
  if (heldBackReason === PROMPT_TRUTH_HOLDBACK_REASONS.LEDGER_DISABLED) return 'disabled';
  if (candidateCount > 0 && heldBackReason) return 'held_back';
  if (candidateCount > 0) return 'candidate';
  return 'unknown';
}

function normalizePromptTruthChannel(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    state: derivePromptTruthChannelState(value),
    candidateCount: Math.max(0, Number(value.candidateCount || 0) || 0),
    renderedCount: Math.max(0, Number(value.renderedCount || 0) || 0),
    candidateSourceIds: uniqueStrings(value.candidateSourceIds || [], 12),
    renderedSourceIds: uniqueStrings(value.renderedSourceIds || [], 12),
    renderedClaims: normalizePromptTruthRenderedClaims(
      listRenderedClaimInputs(value.renderedClaims, value.renderedClaim, value.renderedClaimSummary),
      PROMPT_TRUTH_RENDERED_CLAIM_LIMIT,
    ),
    heldBackReason: String(value.heldBackReason || '').trim(),
  };
}

function normalizePromptTruth(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const channels = value.channels && typeof value.channels === 'object' ? value.channels : {};
  const normalizedChannels = {};
  for (const key of PROMPT_TRUTH_CHANNEL_KEYS) {
    normalizedChannels[key] = normalizePromptTruthChannel(channels[key]);
  }
  return {
    schema: String(value.schema || PROMPT_TRUTH_SCHEMA).trim() || PROMPT_TRUTH_SCHEMA,
    canonicalFactsPresent: value.canonicalFactsPresent === true,
    canonicalOverrideActive: value.canonicalOverrideActive === true,
    channels: normalizedChannels,
  };
}

function promptTruthChannel(promptTruth = null, channel = '') {
  const normalized = normalizePromptTruth(promptTruth);
  return normalized.channels?.[channel] || normalizePromptTruth().channels[channel];
}

function promptTruthRenderedSourceIds(promptTruth = null, channel = '', limit = 12) {
  return uniqueStrings(promptTruthChannel(promptTruth, channel).renderedSourceIds || [], limit);
}

function promptTruthCandidateSourceIds(promptTruth = null, channel = '', limit = 12) {
  return uniqueStrings(promptTruthChannel(promptTruth, channel).candidateSourceIds || [], limit);
}

function promptTruthRenderedCount(promptTruth = null, channel = '') {
  return Math.max(0, Number(promptTruthChannel(promptTruth, channel).renderedCount || 0));
}

function promptTruthRenderedClaims(promptTruth = null, channel = '', limit = PROMPT_TRUTH_RENDERED_CLAIM_LIMIT) {
  return normalizePromptTruthRenderedClaims(promptTruthChannel(promptTruth, channel).renderedClaims || [], limit);
}

function promptTruthCandidateCount(promptTruth = null, channel = '') {
  return Math.max(0, Number(promptTruthChannel(promptTruth, channel).candidateCount || 0));
}

function promptTruthHeldBackReason(promptTruth = null, channel = '') {
  return String(promptTruthChannel(promptTruth, channel).heldBackReason || '').trim();
}

function promptTruthChannelState(promptTruth = null, channel = '') {
  return normalizePromptTruthChannelState(promptTruthChannel(promptTruth, channel).state) || 'unknown';
}

function advisoryPromptTruthChannels() {
  return [...PROMPT_TRUTH_ADVISORY_CHANNEL_KEYS];
}

function hasPromptTruthReceipt(promptTruth = null) {
  const normalized = normalizePromptTruth(promptTruth);
  if (normalized.canonicalFactsPresent === true || normalized.canonicalOverrideActive === true) return true;
  return Object.values(normalized.channels || {}).some((channel) => (
    Number(channel?.candidateCount || 0) > 0
    || Number(channel?.renderedCount || 0) > 0
    || (Array.isArray(channel?.candidateSourceIds) && channel.candidateSourceIds.length > 0)
    || (Array.isArray(channel?.renderedSourceIds) && channel.renderedSourceIds.length > 0)
    || (Array.isArray(channel?.renderedClaims) && channel.renderedClaims.length > 0)
    || !!String(channel?.heldBackReason || '').trim()
    || normalizePromptTruthChannelState(channel?.state) === 'rendered'
    || normalizePromptTruthChannelState(channel?.state) === 'held_back'
    || normalizePromptTruthChannelState(channel?.state) === 'candidate'
    || normalizePromptTruthChannelState(channel?.state) === 'no_candidate'
    || normalizePromptTruthChannelState(channel?.state) === 'ineligible'
    || normalizePromptTruthChannelState(channel?.state) === 'disabled'
    || normalizePromptTruthChannelState(channel?.state) === 'unavailable'
  ));
}

function deriveResearchLedgerRendered(promptTruth = null, fallback = false) {
  const normalized = normalizePromptTruth(promptTruth);
  if (!hasPromptTruthReceipt(normalized)) return fallback === true;
  return promptTruthRenderedCount(normalized, 'researchLedger') > 0;
}

function deriveResearchLedgerPromptInjected(promptTruth = null, fallback = false) {
  // Compatibility alias: old "promptInjected" naming now delegates to rendered prompt truth.
  return deriveResearchLedgerRendered(promptTruth, fallback);
}

function projectAuditRetrievalFromPromptTruth(promptTruth = null) {
  const normalized = normalizePromptTruth(promptTruth);
  return {
    selectedSessionIds: promptTruthCandidateSourceIds(normalized, 'sessionArchive', PROMPT_TRUTH_AUDIT_LIMITS.sessionArchive),
    selectedGlobalIds: promptTruthCandidateSourceIds(normalized, 'globalArchive', PROMPT_TRUTH_AUDIT_LIMITS.globalArchive),
    selectedBookIds: promptTruthCandidateSourceIds(normalized, 'memoryBooks', PROMPT_TRUTH_AUDIT_LIMITS.memoryBooks),
    selectedLedgerIds: promptTruthCandidateSourceIds(normalized, 'researchLedger', PROMPT_TRUTH_AUDIT_LIMITS.researchLedger),
    renderedSessionIds: promptTruthRenderedSourceIds(normalized, 'sessionArchive', PROMPT_TRUTH_AUDIT_LIMITS.sessionArchive),
    renderedGlobalIds: promptTruthRenderedSourceIds(normalized, 'globalArchive', PROMPT_TRUTH_AUDIT_LIMITS.globalArchive),
    renderedBookIds: promptTruthRenderedSourceIds(normalized, 'memoryBooks', PROMPT_TRUTH_AUDIT_LIMITS.memoryBooks),
    renderedLedgerIds: promptTruthRenderedSourceIds(normalized, 'researchLedger', PROMPT_TRUTH_AUDIT_LIMITS.researchLedger),
  };
}

module.exports = {
  PROMPT_TRUTH_SCHEMA,
  PROMPT_TRUTH_CHANNEL_KEYS,
  PROMPT_TRUTH_ADVISORY_CHANNEL_KEYS,
  PROMPT_TRUTH_CHANNEL_STATES,
  PROMPT_TRUTH_HOLDBACK_REASONS,
  PROMPT_TRUTH_AUDIT_LIMITS,
  PROMPT_TRUTH_RENDERED_CLAIM_LIMIT,
  normalizePromptTruthChannelState,
  normalizePromptTruthRenderedClaim,
  normalizePromptTruthRenderedClaims,
  preferRenderedCompatibilityBoolean,
  derivePromptTruthChannelState,
  normalizePromptTruthChannel,
  normalizePromptTruth,
  promptTruthChannel,
  promptTruthRenderedSourceIds,
  promptTruthRenderedClaims,
  promptTruthCandidateSourceIds,
  promptTruthRenderedCount,
  promptTruthCandidateCount,
  promptTruthHeldBackReason,
  promptTruthChannelState,
  advisoryPromptTruthChannels,
  hasPromptTruthReceipt,
  deriveResearchLedgerRendered,
  deriveResearchLedgerPromptInjected,
  projectAuditRetrievalFromPromptTruth,
};
