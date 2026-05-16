const {
  SUPPORT_STATES,
  normalizeMemorySuggestion,
} = require('./penny-session-reflection');

const PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA = 'penny-memory-suggestion-policy.v1';
const PENNY_EXPLICIT_MEMORY_REVIEW_CANDIDATE_SCHEMA = 'penny-explicit-memory-review-candidate.v1';

const MEMORY_SUGGESTION_ACTIONS = Object.freeze({
  SUGGEST: 'suggest',
  DO_NOT_SAVE: 'do-not-save',
  NEEDS_MORE_EVIDENCE: 'needs-more-evidence',
  OPEN_LOOP_ONLY: 'open-loop-only',
});

const MEMORY_SUGGESTION_CLASSES = Object.freeze({
  USER_PREFERENCE: 'user-preference',
  STABLE_USER_FACT: 'stable-user-fact',
  PROJECT_PREFERENCE: 'project-preference',
  PROJECT_DECISION: 'project-decision',
  CORRECTION: 'correction',
  OPEN_LOOP: 'open-loop',
  INFERRED_EMOTION: 'inferred-emotion',
  SENSITIVE_PERSONAL_DATA: 'sensitive-personal-data',
  SPECULATION: 'speculation',
  TEMPORARY_SESSION_STATE: 'temporary-session-state',
  UNKNOWN: 'unknown',
});

const POLICY_LIMITS = Object.freeze([
  'Memory suggestions are review candidates only, not canonical memory.',
  'Every memory suggestion requires approval and autoPromoted=false.',
  'Reflection summaries are not truth proof.',
  'Candidate-only/archive-only support is not enough for explicit memory.',
  'Project decisions route to project/open-loop notes before user memory.',
]);

const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'unknown']);

const EXPLICIT_USER_PATTERN = /\b(?:i prefer|i like|i love|i want|i need|works? for me|helps me|please remember|remember this|for future reference|my preference is)\b/i;
const REPEATED_PATTERN = /\b(?:repeated|multiple|several|again|often|always|keeps? asking|pattern)\b/i;
const TEMPORARY_PATTERN = /\b(?:right now|currently|today|this session|for now|temporarily|hyped|excited|frustrated|tired|mood)\b/i;
const INFERRED_EMOTION_PATTERN = /\b(?:seems?|appears?|probably|maybe|infer(?:red)?|guess(?:ed)?|assume(?:d)?).{0,80}\b(?:anxious|angry|sad|depressed|jealous|lonely|afraid|upset|stressed|ashamed|excited|frustrated)\b/i;
const SPECULATION_PATTERN = /\b(?:maybe|probably|possibly|speculative|might|could be|seems?|appears?|assume|guess|suspect|unclear)\b/i;
const SENSITIVE_PATTERN = /\b(?:home address|address|phone number|ssn|social security|password|secret|bank|bill|billing|financial|credit card|medical|medication|diagnos(?:is|ed)|therapy|trauma|sexual|romantic|political|religion|legal)\b/i;
const PROJECT_DECISION_PATTERN = /\b(?:static embeddings?|prompttruth|toolevidencereceipt|tool evidence|runtime voice|server\.js|repo|project|implementation|slice|open-loop|open loop|architecture|docs?|current law)\b/i;
const OPEN_LOOP_PATTERN = /\b(?:follow up|open loop|next step|defer|todo|later|continue|needs to happen)\b/i;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value = '', limit = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '') {
  return cleanString(value, 160).toLowerCase().replace(/[_\s]+/g, '-');
}

function clampInteger(value, fallback = 0, min = 0, max = 4) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function listValue(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function normalizeConfidence(value = '', fallback = 'unknown') {
  const confidence = cleanToken(value);
  if (confidence === 'unclear' || confidence === 'none') return 'unknown';
  return CONFIDENCE_VALUES.has(confidence) ? confidence : fallback;
}

function normalizeSupportState(raw = {}, base = {}, text = '') {
  const explicit = cleanToken(
    raw.supportState
      || raw.supportClass
      || raw.supportType
      || raw.support
      || raw.evidenceClass
      || '',
  );
  const supportText = cleanString(
    `${raw.support || ''}\n${raw.reason || ''}\n${raw.source || ''}\n${text || ''}`,
    1200,
  );
  const mentionCount = Number(raw.mentionCount || raw.repetitionCount || raw.supportCount || 0);
  const receiptCount = listValue(raw.sourceReceipts || raw.sourceRefs || raw.sources || []).length;

  if (explicit === 'archive-candidate' || explicit === 'archive-only' || explicit === 'candidate') {
    return SUPPORT_STATES.CANDIDATE_ONLY;
  }
  if (explicit === 'single-mention' || explicit === 'single') return SUPPORT_STATES.SINGLE_MENTION;
  if (explicit === 'explicit' || explicit === 'user-stated' || explicit === 'explicit-user-statement') {
    return SUPPORT_STATES.EXPLICIT_USER;
  }
  if (explicit === 'repeated' || explicit === 'repeated-explicit-user-preference') {
    return SUPPORT_STATES.REPEATED_EXPLICIT;
  }
  if (explicit === 'existing-explicit-memory' || explicit === 'existing-explicit-correction') {
    return SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION;
  }
  if (explicit === 'repo-source' || explicit === 'source-backed-decision') return SUPPORT_STATES.REPO_SOURCE;
  if (explicit === 'promotion-review' || explicit === 'review-candidate') return SUPPORT_STATES.PROMOTION_REVIEW;
  if (explicit === 'inferred' || explicit === 'assistant-inference') return SUPPORT_STATES.INFERRED;
  if (explicit === 'temporary') return SUPPORT_STATES.TEMPORARY;
  if (explicit === 'sensitive') return SUPPORT_STATES.SENSITIVE;
  if (explicit === 'speculative') return SUPPORT_STATES.SPECULATIVE;
  if (explicit === 'unsupported' || explicit === 'weak' || explicit === 'unverified') {
    return SUPPORT_STATES.UNSUPPORTED;
  }

  if (supportText && /\b(?:archive[- ]only|candidate[- ]only|retrieval candidate|semantic candidate|static candidate)\b/i.test(supportText)) {
    return SUPPORT_STATES.CANDIDATE_ONLY;
  }
  if (INFERRED_EMOTION_PATTERN.test(supportText)) return SUPPORT_STATES.INFERRED;
  if (TEMPORARY_PATTERN.test(supportText) && /\b(?:state|emotion|mood|right now|currently|today|session)\b/i.test(supportText)) {
    return SUPPORT_STATES.TEMPORARY;
  }
  if (REPEATED_PATTERN.test(supportText) && (EXPLICIT_USER_PATTERN.test(supportText) || mentionCount >= 2 || receiptCount >= 2)) {
    return SUPPORT_STATES.REPEATED_EXPLICIT;
  }
  if (EXPLICIT_USER_PATTERN.test(supportText)) return SUPPORT_STATES.EXPLICIT_USER;
  if (/\b(?:repo|docs?|current law|architecture)\b/i.test(supportText)) return SUPPORT_STATES.REPO_SOURCE;
  if (/\b(?:source|receipt|artifact|test)\b/i.test(supportText)) return SUPPORT_STATES.SOURCE_BACKED;
  if (mentionCount >= 2 || receiptCount >= 2) return SUPPORT_STATES.REPEATED_EXPLICIT;

  return base.supportState || SUPPORT_STATES.UNKNOWN;
}

function defaultSupportLevel(supportState = SUPPORT_STATES.UNKNOWN) {
  if (supportState === SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION) return 4;
  if (
    supportState === SUPPORT_STATES.SOURCE_BACKED
    || supportState === SUPPORT_STATES.REPO_SOURCE
    || supportState === SUPPORT_STATES.ARTIFACT
  ) {
    return 3;
  }
  if (supportState === SUPPORT_STATES.EXPLICIT_USER) return 2;
  if (supportState === SUPPORT_STATES.REPEATED_EXPLICIT || supportState === SUPPORT_STATES.PROMOTION_REVIEW) {
    return 1;
  }
  return 0;
}

function normalizeSensitivity(raw = {}, base = {}, text = '', suggestionClass = MEMORY_SUGGESTION_CLASSES.UNKNOWN) {
  const explicit = cleanToken(raw.sensitivity || raw.memorySensitivity || raw.privacy || '');
  if (['private', 'sensitive', 'secret', 'medical', 'financial', 'legal', 'sexual', 'high'].includes(explicit)) {
    return 'high';
  }
  if (explicit === 'medium') return 'medium';
  if (explicit === 'low') return 'low';
  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA || SENSITIVE_PATTERN.test(text)) {
    return 'high';
  }
  return base.sensitivity || 'low';
}

function normalizeSuggestionClass(raw = {}, text = '', supportState = SUPPORT_STATES.UNKNOWN) {
  const explicit = cleanToken(raw.class || raw.memoryClass || raw.kind || raw.type || raw.category || '');
  const aliases = {
    preference: MEMORY_SUGGESTION_CLASSES.USER_PREFERENCE,
    'user-pref': MEMORY_SUGGESTION_CLASSES.USER_PREFERENCE,
    fact: MEMORY_SUGGESTION_CLASSES.STABLE_USER_FACT,
    'stable-fact': MEMORY_SUGGESTION_CLASSES.STABLE_USER_FACT,
    decision: MEMORY_SUGGESTION_CLASSES.PROJECT_DECISION,
    'project-law': MEMORY_SUGGESTION_CLASSES.PROJECT_DECISION,
    project: MEMORY_SUGGESTION_CLASSES.PROJECT_DECISION,
    correction: MEMORY_SUGGESTION_CLASSES.CORRECTION,
    'memory-correction': MEMORY_SUGGESTION_CLASSES.CORRECTION,
    openloop: MEMORY_SUGGESTION_CLASSES.OPEN_LOOP,
    'open-loop-update': MEMORY_SUGGESTION_CLASSES.OPEN_LOOP,
    emotion: MEMORY_SUGGESTION_CLASSES.INFERRED_EMOTION,
    inferred: MEMORY_SUGGESTION_CLASSES.INFERRED_EMOTION,
    sensitive: MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA,
    private: MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA,
    speculation: MEMORY_SUGGESTION_CLASSES.SPECULATION,
    speculative: MEMORY_SUGGESTION_CLASSES.SPECULATION,
    temporary: MEMORY_SUGGESTION_CLASSES.TEMPORARY_SESSION_STATE,
    'temporary-state': MEMORY_SUGGESTION_CLASSES.TEMPORARY_SESSION_STATE,
  };
  const normalized = aliases[explicit] || explicit;
  if (Object.values(MEMORY_SUGGESTION_CLASSES).includes(normalized)) return normalized;

  if (supportState === SUPPORT_STATES.INFERRED || INFERRED_EMOTION_PATTERN.test(text)) {
    return MEMORY_SUGGESTION_CLASSES.INFERRED_EMOTION;
  }
  if (supportState === SUPPORT_STATES.TEMPORARY || TEMPORARY_PATTERN.test(text)) {
    return MEMORY_SUGGESTION_CLASSES.TEMPORARY_SESSION_STATE;
  }
  if (SENSITIVE_PATTERN.test(text)) return MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA;
  if (OPEN_LOOP_PATTERN.test(text)) return MEMORY_SUGGESTION_CLASSES.OPEN_LOOP;
  if (PROJECT_DECISION_PATTERN.test(text)) return MEMORY_SUGGESTION_CLASSES.PROJECT_DECISION;
  if (SPECULATION_PATTERN.test(text)) return MEMORY_SUGGESTION_CLASSES.SPECULATION;
  if (EXPLICIT_USER_PATTERN.test(text) || /\b(?:preference|prefers?|likes?|loves?|detailed answers?|slice-by-slice plans?)\b/i.test(text)) {
    return MEMORY_SUGGESTION_CLASSES.USER_PREFERENCE;
  }
  return MEMORY_SUGGESTION_CLASSES.UNKNOWN;
}

function hasCorrectionRelationship(raw = {}) {
  return !!(
    raw.existingMemoryId
    || raw.correctionOf
    || raw.oldText
    || raw.previousText
    || raw.oldValue
  ) && !!(
    raw.newText
    || raw.correctedText
    || raw.newValue
    || raw.text
  );
}

function explicitMemoryKind(suggestionClass) {
  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.USER_PREFERENCE) return 'user-preference';
  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.STABLE_USER_FACT) return 'stable-user-fact';
  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.CORRECTION) return 'correction';
  return 'unknown';
}

function buildSuggestedExplicitMemory({
  raw,
  text,
  suggestionClass,
  confidence,
  supportState,
  supportLevel,
  sensitivity,
  sourceReceipts,
}) {
  return {
    schema: PENNY_EXPLICIT_MEMORY_REVIEW_CANDIDATE_SCHEMA,
    text: cleanString(raw.memoryText || raw.canonicalText || raw.suggestedMemoryText || text, 800),
    kind: explicitMemoryKind(suggestionClass),
    confidence,
    supportState,
    supportLevel,
    sensitivity,
    sourceReceipts,
    requiresApproval: true,
    autoPromoted: false,
    canonicalWriteAllowed: false,
    promotionQueueWriteAllowed: false,
    reviewStatus: 'pending-user-approval',
    ...(suggestionClass === MEMORY_SUGGESTION_CLASSES.CORRECTION ? {
      existingMemoryId: cleanString(raw.existingMemoryId || raw.correctionOf || '', 180),
      oldText: cleanString(raw.oldText || raw.previousText || raw.oldValue || '', 800),
      newText: cleanString(raw.newText || raw.correctedText || raw.newValue || text, 800),
    } : {}),
  };
}

function buildResult({
  raw,
  text,
  action,
  reason,
  suggestionClass,
  confidence,
  supportState,
  supportLevel,
  sensitivity,
  sourceReceipts,
  suggestedExplicitMemory = null,
}) {
  return {
    schema: PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
    action,
    reason,
    class: suggestionClass,
    text,
    confidence,
    sensitivity,
    supportState,
    supportLevel,
    sourceReceipts,
    requiresApproval: true,
    autoPromoted: false,
    suggestedExplicitMemory,
    memoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    reviewRequired: true,
    reviewStatus: action === MEMORY_SUGGESTION_ACTIONS.SUGGEST ? 'pending-user-approval' : 'held-back',
    source: cleanString(raw.source || raw.sourceType || '', 220),
    limits: POLICY_LIMITS.slice(),
  };
}

function classifyMemorySuggestion(input = {}) {
  const raw = typeof input === 'string'
    ? { text: input }
    : (isPlainObject(input) ? input : {});
  const text = cleanString(
    raw.text
      || raw.memory
      || raw.suggestionText
      || raw.suggestedMemory
      || raw.proposedMemoryText
      || '',
    800,
  );
  const base = normalizeMemorySuggestion({
    ...raw,
    text,
  });
  const supportState = normalizeSupportState(raw, base, text);
  const suggestionClass = normalizeSuggestionClass(raw, text, supportState);
  const sensitivity = normalizeSensitivity(raw, base, text, suggestionClass);
  const supportLevel = clampInteger(
    raw.supportLevel,
    defaultSupportLevel(supportState),
    0,
    4,
  );
  const sourceReceipts = base.sourceReceipts || [];
  const defaultConfidence = supportLevel >= 2 ? 'high' : (supportLevel === 1 ? 'medium' : 'low');
  const confidence = normalizeConfidence(raw.confidence, defaultConfidence);

  const common = {
    raw,
    text,
    suggestionClass,
    confidence,
    supportState,
    supportLevel,
    sensitivity,
    sourceReceipts,
  };

  if (!text) {
    return buildResult({
      ...common,
      action: MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE,
      reason: 'empty-memory-suggestion',
    });
  }

  if (sensitivity === 'high' || suggestionClass === MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA) {
    return buildResult({
      ...common,
      suggestionClass: MEMORY_SUGGESTION_CLASSES.SENSITIVE_PERSONAL_DATA,
      sensitivity: 'high',
      action: MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE,
      reason: 'sensitive-personal-data-requires-explicit-review',
    });
  }

  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.INFERRED_EMOTION || supportState === SUPPORT_STATES.INFERRED) {
    return buildResult({
      ...common,
      suggestionClass: MEMORY_SUGGESTION_CLASSES.INFERRED_EMOTION,
      action: MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE,
      reason: 'inferred-emotion',
    });
  }

  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.TEMPORARY_SESSION_STATE || supportState === SUPPORT_STATES.TEMPORARY) {
    return buildResult({
      ...common,
      suggestionClass: MEMORY_SUGGESTION_CLASSES.TEMPORARY_SESSION_STATE,
      action: MEMORY_SUGGESTION_ACTIONS.DO_NOT_SAVE,
      reason: 'temporary-session-state',
    });
  }

  if (
    suggestionClass === MEMORY_SUGGESTION_CLASSES.PROJECT_DECISION
    || suggestionClass === MEMORY_SUGGESTION_CLASSES.PROJECT_PREFERENCE
    || suggestionClass === MEMORY_SUGGESTION_CLASSES.OPEN_LOOP
  ) {
    return buildResult({
      ...common,
      action: MEMORY_SUGGESTION_ACTIONS.OPEN_LOOP_ONLY,
      reason: 'project-or-open-loop-note-not-user-memory',
    });
  }

  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.SPECULATION || supportState === SUPPORT_STATES.SPECULATIVE) {
    return buildResult({
      ...common,
      action: MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE,
      reason: 'speculative-memory-suggestion',
    });
  }

  if (
    supportState === SUPPORT_STATES.CANDIDATE_ONLY
    || supportState === SUPPORT_STATES.UNSUPPORTED
    || supportState === SUPPORT_STATES.UNKNOWN
    || supportState === SUPPORT_STATES.SINGLE_MENTION
  ) {
    return buildResult({
      ...common,
      action: MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE,
      reason: supportState === SUPPORT_STATES.CANDIDATE_ONLY
        ? 'candidate-only-support'
        : 'insufficient-explicit-support',
    });
  }

  if (suggestionClass === MEMORY_SUGGESTION_CLASSES.CORRECTION && !hasCorrectionRelationship(raw)) {
    return buildResult({
      ...common,
      action: MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE,
      reason: 'correction-needs-old-and-new-memory-relationship',
    });
  }

  if (
    suggestionClass === MEMORY_SUGGESTION_CLASSES.USER_PREFERENCE
    || suggestionClass === MEMORY_SUGGESTION_CLASSES.STABLE_USER_FACT
    || suggestionClass === MEMORY_SUGGESTION_CLASSES.CORRECTION
  ) {
    const suggestedExplicitMemory = buildSuggestedExplicitMemory(common);
    return buildResult({
      ...common,
      action: MEMORY_SUGGESTION_ACTIONS.SUGGEST,
      reason: suggestionClass === MEMORY_SUGGESTION_CLASSES.CORRECTION
        ? 'existing-explicit-memory-correction-review'
        : 'review-gated-explicit-memory-candidate',
      suggestedExplicitMemory,
    });
  }

  return buildResult({
    ...common,
    action: MEMORY_SUGGESTION_ACTIONS.NEEDS_MORE_EVIDENCE,
    reason: 'unsupported-memory-suggestion-class',
  });
}

function summarizeMemorySuggestionPolicy(results = []) {
  const normalized = listValue(results);
  const actionCounts = {};
  const sensitivityCounts = { low: 0, medium: 0, high: 0 };
  const supportStates = {};
  for (const result of normalized) {
    actionCounts[result.action] = (actionCounts[result.action] || 0) + 1;
    if (sensitivityCounts[result.sensitivity] !== undefined) {
      sensitivityCounts[result.sensitivity] += 1;
    }
    if (result.supportState) {
      supportStates[result.supportState] = (supportStates[result.supportState] || 0) + 1;
    }
  }
  return {
    schema: PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
    candidateCount: normalized.length,
    actionCounts,
    sensitivityCounts,
    supportStates,
    suggestionCount: normalized.filter((item) => item.action === MEMORY_SUGGESTION_ACTIONS.SUGGEST).length,
    heldBackCount: normalized.filter((item) => item.action !== MEMORY_SUGGESTION_ACTIONS.SUGGEST).length,
    allRequireApproval: normalized.every((item) => item.requiresApproval === true),
    autoPromotedCount: normalized.filter((item) => item.autoPromoted === true).length,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
  };
}

function classifyMemorySuggestions(candidates = []) {
  const results = listValue(candidates).map((candidate) => classifyMemorySuggestion(candidate));
  return {
    schema: PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
    results,
    summary: summarizeMemorySuggestionPolicy(results),
    limits: POLICY_LIMITS.slice(),
  };
}

module.exports = {
  PENNY_MEMORY_SUGGESTION_POLICY_SCHEMA,
  PENNY_EXPLICIT_MEMORY_REVIEW_CANDIDATE_SCHEMA,
  MEMORY_SUGGESTION_ACTIONS,
  MEMORY_SUGGESTION_CLASSES,
  classifyMemorySuggestion,
  classifyMemorySuggestions,
  summarizeMemorySuggestionPolicy,
};
