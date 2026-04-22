const PENNY_SESSION_REFLECTION_SCHEMA = 'penny-session-reflection.v1';

const MEASUREMENT_MODES = new Set(['artifact-only', 'after-turn', 'end-session', 'eval']);
const CONFIDENCE_VALUES = new Set(['low', 'medium', 'high', 'unknown']);
const DECISION_STATUSES = new Set(['decided', 'tentative', 'rejected', 'deferred']);
const DECISION_SUPPORT_VALUES = new Set(['explicit-user', 'repo-source', 'artifact', 'assistant-inference', 'unknown']);
const MEMORY_AUTHORITY_VALUES = new Set(['none', 'advisory', 'explicit-candidate']);
const OPEN_LOOP_ACTIONS = new Set(['create', 'update', 'complete', 'dismiss', 'defer']);
const SENSITIVITY_VALUES = new Set(['low', 'medium', 'high']);
const MEMORY_SUGGESTION_KINDS = new Set([
  'user-preference',
  'project-preference',
  'stable-fact',
  'correction',
  'project-decision',
  'open-loop',
  'do-not-save',
  'unknown',
]);
const DO_NOT_SAVE_REASONS = new Set([
  'temporary',
  'sensitive',
  'inferred-emotion',
  'insufficient-support',
  'speculative',
]);

const SUPPORT_STATES = Object.freeze({
  UNKNOWN: 'unknown',
  UNSUPPORTED: 'unsupported',
  SINGLE_MENTION: 'single-mention',
  REPEATED_EXPLICIT: 'repeated-explicit',
  EXPLICIT_USER: 'explicit-user',
  SOURCE_BACKED: 'source-backed',
  REPO_SOURCE: 'repo-source',
  ARTIFACT: 'artifact',
  PROMOTION_REVIEW: 'promotion-review',
  EXISTING_EXPLICIT_CORRECTION: 'existing-explicit-correction',
  CANDIDATE_ONLY: 'candidate-only',
  INFERRED: 'inferred',
  TEMPORARY: 'temporary',
  SENSITIVE: 'sensitive',
  SPECULATIVE: 'speculative',
});
const SUPPORT_STATE_VALUES = new Set(Object.values(SUPPORT_STATES));

const DEFAULT_LIMITS = Object.freeze([
  'Session reflection is reviewable synthesis, not canonical memory.',
  'Memory suggestions require approval before explicit memory writes.',
  'Reflection does not expand PromptTruth or toolEvidenceReceipt.',
  'Reflection must preserve uncertainty and source state.',
]);

const HIDDEN_COT_FIELD_KEYS = new Set([
  'activations',
  'chainofthought',
  'cot',
  'hiddencot',
  'hiddenreasoning',
  'hiddenthoughts',
  'internalmonologue',
  'latentstate',
  'mindstate',
  'neuralstate',
  'privateinference',
  'reasoningtrace',
  'scratchpad',
  'thoughttrace',
]);

const SENSITIVE_MEMORY_PATTERN = /\b(?:medical|medication|diagnos(?:is|ed)|therapy|trauma|sexual|romantic|political|religion|financial|bank|password|secret|home address|phone number|social security|ssn)\b/i;
const INFERRED_EMOTION_PATTERN = /\b(?:seems?|appears?|probably|maybe|infer(?:red)?|guess(?:ed)?|assume(?:d)?).{0,80}\b(?:anxious|angry|sad|depressed|jealous|lonely|afraid|upset|stressed|ashamed)\b/i;
const TEMPORARY_STATE_PATTERN = /\b(?:right now|currently|today|this session|for now|temporarily|temporary state|mood)\b/i;
const SPECULATION_PATTERN = /\b(?:maybe|probably|possibly|speculative|might|could be|seems?|appears?|assume|guess|suspect|unclear)\b/i;

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

function listValue(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function uniqueStrings(values = [], limit = 40, itemLimit = 260) {
  const out = [];
  const seen = new Set();
  for (const value of listValue(values).flat(Infinity)) {
    const text = cleanString(value, itemLimit);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= limit) break;
  }
  return out;
}

function normalizeIso(value = '', fallback = '') {
  if (value === null || value === undefined || value === '') return fallback;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? value.toISOString() : fallback;
  }
  const text = String(value).trim();
  if (!text) return fallback;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function normalizeNowIso(now = new Date()) {
  return normalizeIso(now, new Date().toISOString());
}

function clampInteger(value, fallback = 0, min = 0, max = 4) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function slugify(value = '', fallback = 'item') {
  const slug = cleanString(value, 180)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || fallback;
}

function normalizeConfidence(value = '') {
  const confidence = cleanToken(value);
  if (confidence === 'unclear' || confidence === 'none') return 'unknown';
  return CONFIDENCE_VALUES.has(confidence) ? confidence : 'unknown';
}

function normalizeMeasurementMode(value = '') {
  const mode = cleanToken(value);
  return MEASUREMENT_MODES.has(mode) ? mode : 'artifact-only';
}

function normalizeDecisionStatus(value = '') {
  const status = cleanToken(value);
  if (status === 'done' || status === 'accepted') return 'decided';
  if (status === 'maybe') return 'tentative';
  if (status === 'parked') return 'deferred';
  return DECISION_STATUSES.has(status) ? status : 'tentative';
}

function normalizeDecisionSupport(value = '') {
  const support = cleanToken(value);
  const aliases = {
    user: 'explicit-user',
    'user-stated': 'explicit-user',
    explicit: 'explicit-user',
    source: 'repo-source',
    docs: 'repo-source',
    receipt: 'artifact',
    inference: 'assistant-inference',
    inferred: 'assistant-inference',
  };
  const normalized = aliases[support] || support;
  return DECISION_SUPPORT_VALUES.has(normalized) ? normalized : 'unknown';
}

function normalizeMemoryAuthority(value = '', support = 'unknown') {
  const authority = cleanToken(value);
  if (MEMORY_AUTHORITY_VALUES.has(authority)) return authority;
  if (support === 'explicit-user') return 'explicit-candidate';
  if (support === 'repo-source' || support === 'artifact') return 'advisory';
  return 'none';
}

function normalizeOpenLoopAction(value = '') {
  const action = cleanToken(value);
  const aliases = {
    add: 'create',
    created: 'create',
    edit: 'update',
    updated: 'update',
    completed: 'complete',
    resolve: 'complete',
    resolved: 'complete',
    hidden: 'dismiss',
    dismissed: 'dismiss',
    parked: 'defer',
    deferred: 'defer',
  };
  const normalized = aliases[action] || action;
  return OPEN_LOOP_ACTIONS.has(normalized) ? normalized : 'update';
}

function normalizeMemoryKind(value = '') {
  const kind = cleanToken(value);
  const aliases = {
    preference: 'user-preference',
    'user-pref': 'user-preference',
    fact: 'stable-fact',
    'stable-user-fact': 'stable-fact',
    decision: 'project-decision',
    'project-law': 'project-decision',
    openloop: 'open-loop',
    'open-loop-update': 'open-loop',
    reject: 'do-not-save',
    rejected: 'do-not-save',
  };
  const normalized = aliases[kind] || kind;
  return MEMORY_SUGGESTION_KINDS.has(normalized) ? normalized : 'unknown';
}

function normalizeSensitivity(value = '', text = '') {
  const sensitivity = cleanToken(value);
  if (['private', 'sensitive', 'secret', 'medical', 'financial', 'legal', 'sexual'].includes(sensitivity)) {
    return 'high';
  }
  if (SENSITIVITY_VALUES.has(sensitivity)) return sensitivity;
  return SENSITIVE_MEMORY_PATTERN.test(text) ? 'high' : 'low';
}

function normalizeSupportState(value = '', supportText = '', suggestionText = '') {
  const support = cleanToken(value);
  const aliases = {
    explicit: SUPPORT_STATES.EXPLICIT_USER,
    'explicit-user-statement': SUPPORT_STATES.EXPLICIT_USER,
    'user-stated': SUPPORT_STATES.EXPLICIT_USER,
    'user-statement': SUPPORT_STATES.EXPLICIT_USER,
    'user-preference': SUPPORT_STATES.EXPLICIT_USER,
    repeated: SUPPORT_STATES.REPEATED_EXPLICIT,
    'repeated-behavior': SUPPORT_STATES.REPEATED_EXPLICIT,
    'repeated-preference': SUPPORT_STATES.REPEATED_EXPLICIT,
    'repeated-explicit-user-preference': SUPPORT_STATES.REPEATED_EXPLICIT,
    source: SUPPORT_STATES.SOURCE_BACKED,
    'source-receipt': SUPPORT_STATES.SOURCE_BACKED,
    'source-backed-decision': SUPPORT_STATES.SOURCE_BACKED,
    docs: SUPPORT_STATES.REPO_SOURCE,
    document: SUPPORT_STATES.REPO_SOURCE,
    'repo-doc': SUPPORT_STATES.REPO_SOURCE,
    receipt: SUPPORT_STATES.ARTIFACT,
    'test-receipt': SUPPORT_STATES.ARTIFACT,
    promotion: SUPPORT_STATES.PROMOTION_REVIEW,
    'promotion-review-candidate': SUPPORT_STATES.PROMOTION_REVIEW,
    correction: SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION,
    'existing-correction': SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION,
    candidate: SUPPORT_STATES.CANDIDATE_ONLY,
    'candidate-only': SUPPORT_STATES.CANDIDATE_ONLY,
    weak: SUPPORT_STATES.UNSUPPORTED,
    unverified: SUPPORT_STATES.UNSUPPORTED,
    inference: SUPPORT_STATES.INFERRED,
    'assistant-inference': SUPPORT_STATES.INFERRED,
  };
  const normalized = aliases[support] || support;
  if (SUPPORT_STATE_VALUES.has(normalized)) return normalized;

  const source = cleanString(`${supportText || ''}\n${suggestionText || ''}`, 800).toLowerCase();
  if (!source) return SUPPORT_STATES.UNKNOWN;
  if (/\b(?:infer|inferred|guess|guessed|assume|assumed|seems like|probably)\b/.test(source)) return SUPPORT_STATES.INFERRED;
  if (/\b(?:temporary|right now|for now|this session|currently)\b/.test(source)) return SUPPORT_STATES.TEMPORARY;
  if (/\b(?:candidate-only|weak evidence|unverified|unsupported)\b/.test(source)) return SUPPORT_STATES.CANDIDATE_ONLY;
  if (/\b(?:repeated|multiple|several)\b/.test(source)
    && /\b(?:explicit|user said|user stated|preference|prefers?)\b/.test(source)) {
    return SUPPORT_STATES.REPEATED_EXPLICIT;
  }
  if (/\b(?:explicit user|user said|user stated|user told|the user said)\b/.test(source)) {
    return SUPPORT_STATES.EXPLICIT_USER;
  }
  if (/\b(?:repo|docs?|source|receipt|artifact|test)\b/.test(source)) {
    return SUPPORT_STATES.SOURCE_BACKED;
  }
  return SUPPORT_STATES.UNKNOWN;
}

function defaultSupportLevel(supportState = SUPPORT_STATES.UNKNOWN) {
  const support = normalizeSupportState(supportState);
  if (support === SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION) return 4;
  if (support === SUPPORT_STATES.SOURCE_BACKED
    || support === SUPPORT_STATES.REPO_SOURCE
    || support === SUPPORT_STATES.ARTIFACT) return 3;
  if (support === SUPPORT_STATES.EXPLICIT_USER) return 2;
  if (support === SUPPORT_STATES.REPEATED_EXPLICIT || support === SUPPORT_STATES.PROMOTION_REVIEW) return 1;
  return 0;
}

function normalizeSourceReceipt(receiptLike = {}) {
  if (typeof receiptLike === 'string') {
    const label = cleanString(receiptLike, 260);
    return label ? { type: 'source', label } : null;
  }
  const raw = isPlainObject(receiptLike) ? receiptLike : {};
  const type = cleanToken(raw.type || raw.sourceType || raw.kind || 'source') || 'source';
  const id = cleanString(raw.id || raw.ref || raw.sourceId || raw.artifactId || raw.turnId || '', 180);
  const path = cleanString(raw.path || raw.file || '', 500);
  const url = cleanString(raw.url || '', 500);
  const label = cleanString(raw.label || raw.title || raw.name || '', 180);
  const note = cleanString(raw.note || raw.reason || raw.summary || '', 260);
  const excerpt = cleanString(raw.excerpt || raw.text || raw.quote || '', 360);
  if (!id && !path && !url && !label && !note && !excerpt) return null;
  return {
    type,
    ...(id ? { id } : {}),
    ...(path ? { path } : {}),
    ...(url ? { url } : {}),
    ...(label ? { label } : {}),
    ...(note ? { note } : {}),
    ...(excerpt ? { excerpt } : {}),
  };
}

function normalizeSourceReceipts(value = []) {
  const out = [];
  const seen = new Set();
  for (const raw of listValue(value).flat(Infinity)) {
    const receipt = normalizeSourceReceipt(raw);
    if (!receipt) continue;
    const key = [
      receipt.type,
      receipt.id || '',
      receipt.path || '',
      receipt.url || '',
      receipt.label || '',
      receipt.excerpt || '',
    ].join('|').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(receipt);
    if (out.length >= 12) break;
  }
  return out;
}

function normalizedHiddenFieldKey(key = '') {
  return String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findHiddenCotFields(value, prefix = '', out = []) {
  if (out.length >= 20) return out;
  if (Array.isArray(value)) {
    value.forEach((item, index) => findHiddenCotFields(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (!isPlainObject(value)) return out;
  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (HIDDEN_COT_FIELD_KEYS.has(normalizedHiddenFieldKey(key))) {
      out.push(path);
      if (out.length >= 20) return out;
      continue;
    }
    findHiddenCotFields(nested, path, out);
    if (out.length >= 20) return out;
  }
  return out;
}

function classifyDoNotSaveReason({
  kind = 'unknown',
  supportState = SUPPORT_STATES.UNKNOWN,
  supportLevel = 0,
  sensitivity = 'low',
  text = '',
  raw = {},
} = {}) {
  const joined = cleanString(`${text || ''}\n${raw.support || ''}\n${raw.reason || ''}`, 1200);
  if (kind === 'do-not-save') return normalizeDoNotSaveReason(raw.reason || raw.doNotSaveReason || 'insufficient-support');
  if (sensitivity === 'high' || supportState === SUPPORT_STATES.SENSITIVE || SENSITIVE_MEMORY_PATTERN.test(joined)) {
    return 'sensitive';
  }
  if (raw.inferredEmotion === true || INFERRED_EMOTION_PATTERN.test(joined)) return 'inferred-emotion';
  if (raw.temporary === true || supportState === SUPPORT_STATES.TEMPORARY || TEMPORARY_STATE_PATTERN.test(joined)) {
    return 'temporary';
  }
  if (supportState === SUPPORT_STATES.INFERRED) return 'inferred-emotion';
  if (supportState === SUPPORT_STATES.SPECULATIVE || SPECULATION_PATTERN.test(joined)) return 'speculative';
  if (supportState === SUPPORT_STATES.UNSUPPORTED && supportLevel <= 0) return 'insufficient-support';
  return '';
}

function normalizeDoNotSaveReason(value = '') {
  const reason = cleanToken(value);
  const aliases = {
    private: 'sensitive',
    sensitivity: 'sensitive',
    inferred: 'inferred-emotion',
    inference: 'inferred-emotion',
    emotion: 'inferred-emotion',
    weak: 'insufficient-support',
    unsupported: 'insufficient-support',
    unverified: 'insufficient-support',
    temporary: 'temporary',
    speculative: 'speculative',
    speculation: 'speculative',
  };
  const normalized = aliases[reason] || reason;
  return DO_NOT_SAVE_REASONS.has(normalized) ? normalized : 'insufficient-support';
}

function normalizeSourceWindow(input = {}) {
  const raw = isPlainObject(input) ? input : {};
  return {
    turnIds: uniqueStrings(raw.turnIds || raw.turns || [], 80, 120),
    startedAt: normalizeIso(raw.startedAt || raw.start || ''),
    endedAt: normalizeIso(raw.endedAt || raw.end || ''),
    includedArtifacts: normalizeSourceReceipts(raw.includedArtifacts || raw.artifacts || raw.sources || []),
    excludedBecause: uniqueStrings(raw.excludedBecause || raw.exclusions || raw.excluded || [], 20, 260),
  };
}

function normalizeSummary(input = {}) {
  const raw = typeof input === 'string' ? { short: input } : (isPlainObject(input) ? input : {});
  const unsupportedClaims = uniqueStrings(raw.unsupportedClaims || raw.unsupported || [], 20, 360);
  return {
    short: cleanString(raw.short || raw.text || raw.summary || '', 600),
    detailed: cleanString(raw.detailed || raw.detail || raw.long || '', 2400),
    confidence: normalizeConfidence(raw.confidence),
    unsupportedClaims,
    canonicalMemory: false,
  };
}

function normalizeReflectionDecision(input = {}, options = {}) {
  const raw = typeof input === 'string' ? { text: input } : (isPlainObject(input) ? input : {});
  const text = cleanString(raw.text || raw.decision || raw.summary || '', 800);
  const status = normalizeDecisionStatus(raw.status || raw.decisionStatus);
  const support = normalizeDecisionSupport(raw.support || raw.supportState || raw.sourceType);
  return {
    id: cleanString(raw.id || raw.decisionId || slugify(text, `decision-${Number(options.index || 0) + 1}`), 180),
    text,
    status,
    support,
    sourceReceipts: normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || []),
    memoryAuthority: normalizeMemoryAuthority(raw.memoryAuthority, support),
  };
}

function normalizeOpenLoopUpdate(input = {}, options = {}) {
  const raw = isPlainObject(input) ? input : {};
  const title = cleanString(raw.title || raw.text || raw.summary || '', 220);
  const action = normalizeOpenLoopAction(raw.action || raw.operation || raw.type);
  return {
    loopId: cleanString(raw.loopId || raw.id || slugify(title, `open-loop-${Number(options.index || 0) + 1}`), 180),
    action,
    title,
    nextLikelyStep: cleanString(raw.nextLikelyStep || raw.nextStep || raw.followUp || '', 500),
    support: normalizeDecisionSupport(raw.support || raw.supportState || raw.sourceType),
    sourceReceipts: normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || []),
    requiresReview: true,
  };
}

function normalizeMemorySuggestion(input = {}, options = {}) {
  const raw = typeof input === 'string' ? { text: input } : (isPlainObject(input) ? input : {});
  const text = cleanString(
    raw.text
      || raw.memory
      || raw.suggestionText
      || raw.suggestedMemory
      || raw.proposedMemoryText
      || '',
    800,
  );
  const rawKind = normalizeMemoryKind(raw.kind || raw.type || raw.class || raw.memoryKind);
  const supportState = normalizeSupportState(
    raw.supportState
      || raw.supportClass
      || raw.supportType
      || raw.support
      || raw.evidenceClass
      || '',
    raw.support || raw.reason || '',
    text,
  );
  const supportLevel = clampInteger(
    raw.supportLevel,
    defaultSupportLevel(supportState),
    0,
    4,
  );
  const sensitivity = normalizeSensitivity(raw.sensitivity || raw.memorySensitivity || '', text);
  const doNotSaveReason = classifyDoNotSaveReason({
    kind: rawKind,
    supportState,
    supportLevel,
    sensitivity,
    text,
    raw,
  });
  const kind = doNotSaveReason ? 'do-not-save' : rawKind;

  return {
    id: cleanString(raw.id || raw.suggestionId || slugify(text, `memory-suggestion-${Number(options.index || 0) + 1}`), 180),
    text,
    kind,
    confidence: normalizeConfidence(raw.confidence),
    supportState,
    supportLevel,
    sourceReceipts: normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || []),
    sensitivity,
    requiresApproval: true,
    autoPromoted: false,
    suggestedExplicitMemory: null,
    ...(doNotSaveReason ? { doNotSaveReason } : {}),
  };
}

function normalizeDoNotSaveItem(input = {}, options = {}) {
  const raw = typeof input === 'string' ? { text: input } : (isPlainObject(input) ? input : {});
  const text = cleanString(
    raw.text
      || raw.memory
      || raw.suggestionText
      || raw.reasonText
      || '',
    800,
  );
  const reason = normalizeDoNotSaveReason(raw.reason || raw.doNotSaveReason || raw.kind || raw.type);
  return {
    id: cleanString(raw.id || slugify(text, `do-not-save-${Number(options.index || 0) + 1}`), 180),
    text,
    reason,
    sourceReceipts: normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || []),
  };
}

function normalizeSessionReflection(input = {}, options = {}) {
  const raw = isPlainObject(input?.reflection) ? input.reflection : (isPlainObject(input) ? input : {});
  const now = raw.now || options.now || new Date();
  const generatedAt = normalizeIso(raw.generatedAt || raw.createdAt || '', normalizeNowIso(now));
  const hiddenFields = findHiddenCotFields(raw);
  const warnings = uniqueStrings(raw.warnings || [], 40, 300);
  if (hiddenFields.length) {
    warnings.push(`hidden-CoT fields rejected: ${hiddenFields.join(', ')}`);
  }

  const doNotSave = [];
  const memorySuggestions = [];
  listValue(raw.memorySuggestions || raw.memorySuggestion || raw.suggestions || []).forEach((item, index) => {
    if (isPlainObject(item) && item.requiresApproval === false) {
      warnings.push('memory suggestion requested requiresApproval=false; normalized to true');
    }
    if (isPlainObject(item) && item.autoPromoted === true) {
      warnings.push('memory suggestion requested autoPromoted=true; normalized to false');
    }
    const suggestion = normalizeMemorySuggestion(item, { index });
    if (!suggestion.text) return;
    if (suggestion.kind === 'do-not-save' || suggestion.doNotSaveReason) {
      doNotSave.push(normalizeDoNotSaveItem({
        id: suggestion.id,
        text: suggestion.text,
        reason: suggestion.doNotSaveReason || 'insufficient-support',
        sourceReceipts: suggestion.sourceReceipts,
      }, { index: doNotSave.length }));
      warnings.push(`memory suggestion held out of review queue: ${suggestion.doNotSaveReason || 'insufficient-support'}`);
      return;
    }
    memorySuggestions.push(suggestion);
  });

  listValue(raw.doNotSave || raw.doNotSaveItems || []).forEach((item, index) => {
    const normalized = normalizeDoNotSaveItem(item, { index: doNotSave.length + index });
    if (normalized.text) doNotSave.push(normalized);
  });

  return {
    schema: PENNY_SESSION_REFLECTION_SCHEMA,
    generatedAt,
    sessionId: cleanString(raw.sessionId || raw.threadId || '', 180),
    measurementMode: normalizeMeasurementMode(raw.measurementMode || raw.mode),
    liveModelCalls: raw.liveModelCalls === true,
    behaviorChanged: raw.behaviorChanged === true,
    memoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    sourceWindow: normalizeSourceWindow(raw.sourceWindow || raw.sources || {}),
    summary: normalizeSummary(raw.summary || {}),
    decisions: listValue(raw.decisions || raw.decision || [])
      .map((item, index) => normalizeReflectionDecision(item, { index }))
      .filter((item) => item.text),
    openLoopUpdates: listValue(raw.openLoopUpdates || raw.openLoops || [])
      .map((item, index) => normalizeOpenLoopUpdate(item, { index }))
      .filter((item) => item.title || item.nextLikelyStep || item.loopId),
    memorySuggestions,
    doNotSave,
    warnings: uniqueStrings(warnings, 50, 300),
    limits: uniqueStrings([...(listValue(raw.limits || [])), ...DEFAULT_LIMITS], 20, 260),
  };
}

function summarizeSessionReflection(reflection = {}) {
  const normalized = normalizeSessionReflection(reflection);
  const supportStates = {};
  const sensitivityCounts = { low: 0, medium: 0, high: 0 };
  for (const suggestion of normalized.memorySuggestions) {
    supportStates[suggestion.supportState] = (supportStates[suggestion.supportState] || 0) + 1;
    if (sensitivityCounts[suggestion.sensitivity] !== undefined) {
      sensitivityCounts[suggestion.sensitivity] += 1;
    }
  }
  return {
    schema: PENNY_SESSION_REFLECTION_SCHEMA,
    generatedAt: normalized.generatedAt,
    sessionId: normalized.sessionId,
    measurementMode: normalized.measurementMode,
    liveModelCalls: normalized.liveModelCalls,
    behaviorChanged: normalized.behaviorChanged,
    sourceTurnCount: normalized.sourceWindow.turnIds.length,
    includedArtifactCount: normalized.sourceWindow.includedArtifacts.length,
    decisionCount: normalized.decisions.length,
    openLoopUpdateCount: normalized.openLoopUpdates.length,
    memorySuggestionCount: normalized.memorySuggestions.length,
    doNotSaveCount: normalized.doNotSave.length,
    warningCount: normalized.warnings.length,
    unsupportedClaimCount: normalized.summary.unsupportedClaims.length,
    allMemorySuggestionsRequireApproval: normalized.memorySuggestions.every((item) => item.requiresApproval === true),
    autoPromotedSuggestionCount: normalized.memorySuggestions.filter((item) => item.autoPromoted === true).length,
    supportStates,
    sensitivityCounts,
    memoryAuthority: 'reviewable-synthesis-only',
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
  };
}

function validateSessionReflection(reflection = {}) {
  const normalized = normalizeSessionReflection(reflection);
  const errors = [];
  if (normalized.schema !== PENNY_SESSION_REFLECTION_SCHEMA) {
    errors.push('unexpected schema');
  }
  if (normalized.memoryWrites !== false || normalized.canonicalMemoryWrites !== false) {
    errors.push('reflection artifacts must not write canonical memory');
  }
  if (normalized.promptTruthExpanded !== false) {
    errors.push('reflection artifacts must not expand PromptTruth');
  }
  if (normalized.toolEvidenceReceiptChanged !== false) {
    errors.push('reflection artifacts must not change toolEvidenceReceipt');
  }
  if (normalized.hiddenChainOfThoughtStored !== false) {
    errors.push('reflection artifacts must not store hidden chain-of-thought');
  }
  normalized.memorySuggestions.forEach((suggestion) => {
    if (!suggestion.supportState) errors.push(`memory suggestion ${suggestion.id} is missing supportState`);
    if (!suggestion.sensitivity) errors.push(`memory suggestion ${suggestion.id} is missing sensitivity`);
    if (suggestion.requiresApproval !== true) errors.push(`memory suggestion ${suggestion.id} must require approval`);
    if (suggestion.autoPromoted !== false) errors.push(`memory suggestion ${suggestion.id} must not auto-promote`);
    if (suggestion.suggestedExplicitMemory !== null) {
      errors.push(`memory suggestion ${suggestion.id} must not carry an explicit-memory write payload in R1`);
    }
  });
  return {
    valid: errors.length === 0,
    errors,
    warnings: normalized.warnings,
    reflection: normalized,
  };
}

module.exports = {
  PENNY_SESSION_REFLECTION_SCHEMA,
  SUPPORT_STATES,
  normalizeSessionReflection,
  normalizeReflectionDecision,
  normalizeMemorySuggestion,
  normalizeDoNotSaveItem,
  summarizeSessionReflection,
  validateSessionReflection,
};
