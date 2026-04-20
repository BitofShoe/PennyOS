const PROMPT_TRUTH_SCHEMA = 'penny-prompttruth.v1';

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

const PROMPT_TRUTH_AUDIT_LIMITS = Object.freeze({
  sessionArchive: 6,
  globalArchive: 6,
  memoryBooks: 4,
  researchLedger: 4,
});

function uniqueStrings(values = [], limit = 12) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizePromptTruthChannel(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    candidateCount: Math.max(0, Number(value.candidateCount || 0) || 0),
    renderedCount: Math.max(0, Number(value.renderedCount || 0) || 0),
    candidateSourceIds: uniqueStrings(value.candidateSourceIds || [], 12),
    renderedSourceIds: uniqueStrings(value.renderedSourceIds || [], 12),
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

function promptTruthCandidateCount(promptTruth = null, channel = '') {
  return Math.max(0, Number(promptTruthChannel(promptTruth, channel).candidateCount || 0));
}

function promptTruthHeldBackReason(promptTruth = null, channel = '') {
  return String(promptTruthChannel(promptTruth, channel).heldBackReason || '').trim();
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
    || !!String(channel?.heldBackReason || '').trim()
  ));
}

function deriveResearchLedgerPromptInjected(promptTruth = null, fallback = false) {
  const normalized = normalizePromptTruth(promptTruth);
  if (!hasPromptTruthReceipt(normalized)) return fallback === true;
  return promptTruthRenderedCount(normalized, 'researchLedger') > 0;
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
  PROMPT_TRUTH_AUDIT_LIMITS,
  normalizePromptTruthChannel,
  normalizePromptTruth,
  promptTruthChannel,
  promptTruthRenderedSourceIds,
  promptTruthCandidateSourceIds,
  promptTruthRenderedCount,
  promptTruthCandidateCount,
  promptTruthHeldBackReason,
  advisoryPromptTruthChannels,
  hasPromptTruthReceipt,
  deriveResearchLedgerPromptInjected,
  projectAuditRetrievalFromPromptTruth,
};
