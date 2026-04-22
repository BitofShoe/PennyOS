const fs = require('fs');
const path = require('path');

const {
  PENNY_MEMORY_LINKS_SCHEMA,
  DEFAULT_MEMORY_LINK_LIMITS,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_CREATED_BY,
  MEMORY_LINK_DIRECTIONALITY,
  MEMORY_LINK_MEASUREMENT_MODES,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_REVIEW_STATES,
  MEMORY_LINK_SUPPORT_STATES,
  normalizeMemoryLinkSet,
} = require('./penny-memory-links');

const PENNY_SESSION_REFLECTION_SCHEMA = 'penny-session-reflection.v1';
const PENNY_SESSION_REFLECTION_PREP_SCHEMA = 'penny-session-reflection-prep.v1';
const PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA = 'penny-session-reflection-prompt-bridge.v1';
const PENNY_SESSION_REFLECTION_LINK_SUGGESTIONS_SCHEMA = 'penny-session-reflection-link-suggestions.v1';
const SESSION_REFLECTION_PREP_JOB_KIND = 'session-reflection-prep';

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
const SESSION_REFLECTION_PROMPT_BRIDGE_MODES = Object.freeze({
  BASELINE: 'baseline',
  OFF: 'reflection-summary-off',
  COMPACT: 'reflection-summary-on-compact',
  VERBOSE: 'reflection-summary-on-verbose',
});
const SESSION_REFLECTION_PROMPT_BRIDGE_MODE_VALUES = new Set(Object.values(SESSION_REFLECTION_PROMPT_BRIDGE_MODES));
const REFLECTION_LINK_SUGGESTION_RELATIONS = new Set([
  MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
  MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
  MEMORY_LINK_RELATIONS.IMPLEMENTS_PLAN,
  MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
  MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
]);
const DEFAULT_SESSION_REFLECTION_PROMPT_BRIDGE_WORDS = 90;
const SESSION_REFLECTION_RELEVANCE_STOPWORDS = new Set([
  'about',
  'again',
  'already',
  'before',
  'could',
  'for',
  'from',
  'have',
  'here',
  'just',
  'keep',
  'like',
  'make',
  'next',
  'only',
  'please',
  'should',
  'that',
  'this',
  'what',
  'where',
  'with',
  'would',
  'your',
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

const SESSION_REFLECTION_PREP_STATUSES = Object.freeze({
  PREPARED: 'prepared',
  DEGRADED: 'degraded',
  SKIPPED: 'skipped',
});

const DEFAULT_REFLECTION_PREP_LIMITS = Object.freeze([
  'Background reflection prep is local, bounded, and optional.',
  'Prepared reflection artifacts are draft review material, not truth proof.',
  'Background reflection prep must not write explicit memory or promotion queues.',
  'Background reflection prep must not expand PromptTruth or toolEvidenceReceipt.',
  'Hidden chain-of-thought and runtime voice are not stored or changed.',
]);

const DEFAULT_REFLECTION_PROMPT_BRIDGE_LIMITS = Object.freeze([
  'Session reflection prompt bridge output is compare-only in this slice.',
  'Reflection summaries are advisory and reviewable, not truth proof.',
  'Memory suggestions remain review-gated and are not saved or auto-promoted.',
  'This bridge does not add a PromptTruth channel or merge toolEvidenceReceipt.',
  'Hidden chain-of-thought and runtime voice are not stored or changed.',
]);

const DEFAULT_REFLECTION_LINK_SUGGESTION_LIMITS = Object.freeze([
  ...DEFAULT_MEMORY_LINK_LIMITS,
  'Reflection-generated link suggestions are review-gated and shadow-only.',
  'Reflection link suggestions do not activate ranking or prompt rendering.',
  'Reflection link suggestions do not make either linked item true or canonical.',
  'Unsupported sensitive or user-fact link attempts are held back.',
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

function normalizeSessionReflectionPromptBridgeMode(value = '') {
  const mode = cleanToken(value || SESSION_REFLECTION_PROMPT_BRIDGE_MODES.OFF);
  return SESSION_REFLECTION_PROMPT_BRIDGE_MODE_VALUES.has(mode)
    ? mode
    : SESSION_REFLECTION_PROMPT_BRIDGE_MODES.OFF;
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
    'explicit-user-statement': 'explicit-user',
    explicit: 'explicit-user',
    source: 'repo-source',
    'source-backed': 'repo-source',
    'source-receipt': 'repo-source',
    docs: 'repo-source',
    doc: 'repo-source',
    receipt: 'artifact',
    test: 'artifact',
    tests: 'artifact',
    'test-receipt': 'artifact',
    'deterministic-artifact': 'artifact',
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
  const sourceReceipts = normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || []);
  return {
    id: cleanString(raw.id || raw.updateId || slugify(`${action}-${raw.loopId || title}`, `open-loop-update-${Number(options.index || 0) + 1}`), 180),
    loopId: cleanString(raw.loopId || raw.id || slugify(title, `open-loop-${Number(options.index || 0) + 1}`), 180),
    action,
    title,
    nextLikelyStep: cleanString(raw.nextLikelyStep || raw.nextStep || raw.followUp || '', 500),
    support: normalizeDecisionSupport(raw.support || raw.supportState || raw.sourceType),
    confidence: normalizeConfidence(raw.confidence),
    priority: cleanToken(raw.priority || ''),
    sourceReceipts,
    memoryLinkTargets: uniqueStrings(
      raw.memoryLinkTargets
        || raw.linkTargets
        || raw.relatedMemoryIds
        || raw.relatedTargetIds
        || raw.relatedIds
        || [],
      8,
      220,
    ),
    requiresReview: true,
    autoApplied: false,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
  };
}

function normalizeReflectionLinkRelation(value = '') {
  const relation = cleanToken(value);
  const aliases = {
    project: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    thread: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    'same-thread': MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    'same-project': MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    followup: MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
    'followup-to': MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
    follow: MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
    implementation: MEMORY_LINK_RELATIONS.IMPLEMENTS_PLAN,
    implements: MEMORY_LINK_RELATIONS.IMPLEMENTS_PLAN,
    'open-loop': MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
    openloop: MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
    'research-pattern': MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
    pattern: MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
  };
  const normalized = aliases[relation] || relation;
  return REFLECTION_LINK_SUGGESTION_RELATIONS.has(normalized) ? normalized : '';
}

function normalizeReflectionLinkSupportState(value = '', support = '') {
  const explicit = cleanToken(value || support);
  const aliases = {
    artifact: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    docs: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    document: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    explicit: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    'explicit-user': MEMORY_LINK_SUPPORT_STATES.RENDERED,
    'explicit-user-statement': MEMORY_LINK_SUPPORT_STATES.RENDERED,
    rendered: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    prompt: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    research: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    'research-ledger': MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    repo: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    'repo-source': MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    source: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    'source-backed': MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    unknown: MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
  };
  if (aliases[explicit]) return aliases[explicit];
  const decisionSupport = normalizeDecisionSupport(support || value);
  if (decisionSupport === 'repo-source' || decisionSupport === 'artifact') return MEMORY_LINK_SUPPORT_STATES.RESEARCH;
  if (decisionSupport === 'explicit-user') return MEMORY_LINK_SUPPORT_STATES.RENDERED;
  return MEMORY_LINK_SUPPORT_STATES.UNKNOWN;
}

function normalizeReflectionLinkAuthorityEffect(value = '', relation = '') {
  const effect = cleanToken(value);
  if (effect === 'none' || effect === 'no') return MEMORY_LINK_AUTHORITY_EFFECTS.NONE;
  if (!relation) return MEMORY_LINK_AUTHORITY_EFFECTS.NONE;
  return MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY;
}

function rawReflectionLinkSuggestions(input = {}) {
  if (Array.isArray(input)) return input;
  if (!isPlainObject(input)) return [];
  if (Array.isArray(input.memoryLinkSuggestions)) return input.memoryLinkSuggestions;
  if (Array.isArray(input.linkSuggestions)) return input.linkSuggestions;
  if (Array.isArray(input.links)) return input.links;
  if (Array.isArray(input.memoryLinks)) return input.memoryLinks;
  return [];
}

function reflectionLinkSourceReceipts(raw = {}, extraReceipts = []) {
  return normalizeSourceReceipts([
    ...listValue(raw.sourceReceipts || raw.sourceRefs || raw.sources || []),
    ...listValue(raw.support?.sourceReceipts || raw.support?.sourceRefs || raw.support?.receipts || []),
    ...listValue(extraReceipts || []),
  ]);
}

function linkSuggestionHasSupport({ supportState = MEMORY_LINK_SUPPORT_STATES.UNKNOWN, sourceReceipts = [] } = {}) {
  return supportState !== MEMORY_LINK_SUPPORT_STATES.UNKNOWN || sourceReceipts.length > 0;
}

function linkSuggestionLooksLikeSensitiveOrUserFact(raw = {}) {
  const joined = cleanString([
    raw.sourceId,
    raw.targetId,
    raw.source,
    raw.target,
    raw.from,
    raw.to,
    raw.text,
    raw.label,
    raw.reason,
    raw.explanation,
    raw.support?.explanation,
  ].filter(Boolean).join('\n'), 1600);
  return SENSITIVE_MEMORY_PATTERN.test(joined)
    || /\b(?:user[- ]preference|stable[- ]user[- ]fact|personal[- ]fact|explicit[- ]memory|legal name|home address)\b/i.test(joined);
}

function reflectionLinkHeldBack(index = 0, reason = '', raw = {}) {
  return {
    index,
    reason: cleanString(reason, 260) || 'held-back-reflection-link-suggestion',
    sourceId: cleanString(raw.sourceId || raw.source || raw.from || '', 220),
    targetId: cleanString(raw.targetId || raw.target || raw.to || '', 220),
    relation: cleanString(raw.relation || raw.type || raw.kind || '', 120),
    advisoryOnly: true,
    truthProof: false,
    scoringActive: false,
    behaviorChanged: false,
  };
}

function normalizeReflectionMemoryLinkSuggestion(input = {}, options = {}) {
  const raw = isPlainObject(input) ? input : {};
  const index = Number(options.index || 0);
  const relation = normalizeReflectionLinkRelation(raw.relation || raw.type || raw.kind || '');
  if (!relation) return { link: null, heldBack: reflectionLinkHeldBack(index, 'unsupported-reflection-link-relation', raw) };

  const sourceId = cleanString(raw.sourceId || raw.source || raw.from || '', 220);
  const targetId = cleanString(raw.targetId || raw.target || raw.to || '', 220);
  if (!sourceId || !targetId) return { link: null, heldBack: reflectionLinkHeldBack(index, 'missing-link-endpoint', raw) };

  const sourceReceipts = reflectionLinkSourceReceipts(raw, options.sourceReceipts);
  const supportState = normalizeReflectionLinkSupportState(
    raw.support?.state
      || raw.supportState
      || raw.sourceState
      || raw.supportAuthority
      || '',
    raw.support
      || raw.support?.explanation
      || raw.reason
      || '',
  );
  if (
    !linkSuggestionHasSupport({ supportState, sourceReceipts })
    && linkSuggestionLooksLikeSensitiveOrUserFact(raw)
  ) {
    return { link: null, heldBack: reflectionLinkHeldBack(index, 'unsupported-sensitive-or-user-fact-link', raw) };
  }

  const rawLink = {
    id: raw.id,
    sourceId,
    targetId,
    relation,
    confidence: raw.confidence || 'medium',
    support: {
      state: supportState,
      sourceReceipts,
      explanation: cleanString(raw.explanation || raw.reason || raw.support?.explanation || '', 500),
    },
    authorityEffect: normalizeReflectionLinkAuthorityEffect(raw.authorityEffect || raw.effect || '', relation),
    directionality: raw.directionality || raw.direction || MEMORY_LINK_DIRECTIONALITY.DIRECTED,
    createdBy: MEMORY_LINK_CREATED_BY.REFLECTION,
    reviewState: MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW,
    createdAt: raw.createdAt || options.generatedAt,
    updatedAt: raw.updatedAt || raw.createdAt || options.generatedAt,
    expiresAt: raw.expiresAt || null,
  };
  return { link: rawLink, heldBack: null };
}

function buildOpenLoopMemoryLinkSuggestions(openLoopUpdates = [], options = {}) {
  const links = [];
  openLoopUpdates.forEach((update) => {
    const targets = uniqueStrings(update.memoryLinkTargets || [], 8, 220);
    if (!targets.length) return;
    const sourceReceipts = normalizeSourceReceipts([
      ...(update.sourceReceipts || []),
      ...(options.sourceReflectionId ? [{ type: 'session-reflection', id: options.sourceReflectionId }] : []),
    ]);
    const supportState = normalizeReflectionLinkSupportState('', update.support);
    if (!linkSuggestionHasSupport({ supportState, sourceReceipts })) return;
    targets.forEach((targetId) => {
      links.push({
        id: `reflection-open-loop-about-${slugify(`${update.loopId}-${targetId}`, 'target')}`,
        sourceId: `open-loop:${update.loopId}`,
        targetId,
        relation: MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
        confidence: update.confidence || 'medium',
        support: {
          state: supportState,
          sourceReceipts,
          explanation: cleanString(
            update.nextLikelyStep
              ? `${update.title || update.loopId}: ${update.nextLikelyStep}`
              : (update.title || update.loopId),
            500,
          ),
        },
        authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY,
        directionality: MEMORY_LINK_DIRECTIONALITY.DIRECTED,
        createdBy: MEMORY_LINK_CREATED_BY.REFLECTION,
        reviewState: MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW,
        createdAt: options.generatedAt,
        updatedAt: options.generatedAt,
      });
    });
  });
  return links;
}

function normalizeSessionReflectionLinkSuggestions(input = {}, options = {}) {
  const source = isPlainObject(input) && !Array.isArray(input) ? input : {};
  const generatedAt = normalizeIso(
    source.generatedAt
      || options.generatedAt
      || '',
    normalizeNowIso(options.now || new Date()),
  );
  const measurementMode = source.measurementMode
    || source.mode
    || options.measurementMode
    || MEMORY_LINK_MEASUREMENT_MODES.FIXTURE;
  const sourceReflectionId = cleanString(options.sourceReflectionId || source.sourceReflectionId || '', 180);
  const rawLinks = [
    ...rawReflectionLinkSuggestions(input),
    ...buildOpenLoopMemoryLinkSuggestions(options.openLoopUpdates || [], {
      generatedAt,
      sourceReflectionId,
    }),
  ];
  const linkInputs = [];
  const heldBack = [];
  rawLinks.forEach((rawLink, index) => {
    const normalized = normalizeReflectionMemoryLinkSuggestion(rawLink, {
      index,
      generatedAt,
      sourceReflectionId,
    });
    if (normalized.link) {
      linkInputs.push(normalized.link);
    } else if (normalized.heldBack) {
      heldBack.push(normalized.heldBack);
    }
  });
  const linkSet = normalizeMemoryLinkSet({
    generatedAt,
    measurementMode,
    links: linkInputs,
  }, { now: generatedAt });
  const allHeldBack = [...heldBack, ...(linkSet.heldBack || [])];
  return {
    schema: PENNY_SESSION_REFLECTION_LINK_SUGGESTIONS_SCHEMA,
    linkSetSchema: PENNY_MEMORY_LINKS_SCHEMA,
    generatedAt,
    sourceReflectionId,
    measurementMode: linkSet.measurementMode,
    advisoryOnly: true,
    truthProof: false,
    behaviorChanged: false,
    scoringActive: false,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    links: linkSet.links,
    heldBack: allHeldBack,
    summary: {
      ...linkSet.summary,
      heldBackCount: allHeldBack.length,
      allNeedReview: linkSet.links.every((link) => link.reviewState === MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW),
      scoringActive: false,
      candidateOnlyVerifiedSupport: false,
      truthProof: false,
    },
    limits: uniqueStrings([...DEFAULT_REFLECTION_LINK_SUGGESTION_LIMITS, ...(listValue(source.limits || []))], 20, 260),
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
    ...(rawKind === 'correction' ? {
      existingMemoryId: cleanString(raw.existingMemoryId || raw.correctionOf || '', 180),
      oldText: cleanString(raw.oldText || raw.previousText || raw.oldValue || '', 800),
      newText: cleanString(raw.newText || raw.correctedText || raw.newValue || text, 800),
    } : {}),
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

function countWords(value = '') {
  return (String(value || '').match(/\S+/g) || []).length;
}

function clipWords(value = '', maxWords = DEFAULT_SESSION_REFLECTION_PROMPT_BRIDGE_WORDS) {
  const words = String(value || '').replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean);
  const cap = clampInteger(maxWords, DEFAULT_SESSION_REFLECTION_PROMPT_BRIDGE_WORDS, 20, 260);
  if (words.length <= cap) return words.join(' ');
  return `${words.slice(0, cap).join(' ')}...`;
}

function keywordSet(value = '') {
  const text = String(value || '').toLowerCase();
  const tokens = text.match(/[a-z0-9][a-z0-9-]*/g) || [];
  return new Set(tokens.filter((token) => (
    (token.length >= 3 || /\d/.test(token))
    && !SESSION_REFLECTION_RELEVANCE_STOPWORDS.has(token)
  )));
}

function keywordOverlapScore(left = '', right = '') {
  const leftSet = keywordSet(left);
  if (!leftSet.size) return 0;
  const rightSet = keywordSet(right);
  let score = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) score += 1;
  }
  return score;
}

function reflectionRelevanceCorpus(reflection = {}) {
  return [
    reflection.sessionId,
    reflection.summary?.short,
    reflection.summary?.detailed,
    ...(reflection.decisions || []).flatMap((item) => [item.id, item.text]),
    ...(reflection.openLoopUpdates || []).flatMap((item) => [
      item.id,
      item.loopId,
      item.title,
      item.nextLikelyStep,
    ]),
    ...(reflection.memorySuggestions || []).flatMap((item) => [item.id, item.text, item.kind]),
    ...(reflection.memoryLinkSuggestions?.links || []).flatMap((item) => [item.id, item.sourceId, item.targetId, item.relation]),
  ].filter(Boolean).join('\n');
}

function isSessionReflectionRelevant(reflection = {}, userText = '') {
  const text = cleanString(userText, 1200);
  if (!text) return false;
  return keywordOverlapScore(text, reflectionRelevanceCorpus(reflection)) > 0;
}

function sourceBackedOpenLoopUpdates(reflection = {}) {
  const allowedSupports = new Set(['explicit-user', 'repo-source', 'artifact']);
  return (reflection.openLoopUpdates || [])
    .filter((item) => {
      if (!item || item.autoApplied === true) return false;
      if (allowedSupports.has(item.support)) return true;
      return Array.isArray(item.sourceReceipts) && item.sourceReceipts.length > 0;
    });
}

function selectSessionReflectionOpenLoopUpdate(reflection = {}, userText = '') {
  const updates = sourceBackedOpenLoopUpdates(reflection);
  if (!updates.length) return null;
  const scored = updates.map((item, index) => ({
    item,
    index,
    score: keywordOverlapScore(
      userText,
      [item.id, item.loopId, item.title, item.nextLikelyStep].filter(Boolean).join('\n'),
    ),
  }));
  scored.sort((left, right) => (right.score - left.score) || (left.index - right.index));
  return scored[0].item;
}

function summarizePromptBridgeMemorySuggestionPolicy(reflectionSummary = {}) {
  return {
    pendingReviewCount: reflectionSummary.memorySuggestionCount,
    doNotSaveCount: reflectionSummary.doNotSaveCount,
    allRequireApproval: reflectionSummary.allMemorySuggestionsRequireApproval,
    autoPromotedCount: reflectionSummary.autoPromotedSuggestionCount,
    supportStates: { ...(reflectionSummary.supportStates || {}) },
    sensitivityCounts: { ...(reflectionSummary.sensitivityCounts || {}) },
    requiresApproval: true,
    autoPromoted: false,
  };
}

function buildCompactSessionReflectionPromptLines({
  reflection,
  reflectionSummary,
  openLoopUpdate,
} = {}) {
  const lines = [];
  if (reflection.summary.short) {
    lines.push(`Session reflection, advisory: ${reflection.summary.short}`);
  }
  if (openLoopUpdate) {
    const nextStep = openLoopUpdate.nextLikelyStep
      ? ` Next likely step: ${openLoopUpdate.nextLikelyStep}`
      : '';
    lines.push(`Reflection open-loop cue, advisory: ${openLoopUpdate.title || openLoopUpdate.loopId}.${nextStep}`);
  }
  if (reflectionSummary.memorySuggestionCount > 0 || reflectionSummary.doNotSaveCount > 0) {
    lines.push(
      `Memory suggestion boundary: ${reflectionSummary.memorySuggestionCount} pending review, ${reflectionSummary.doNotSaveCount} do-not-save; none are saved memory, requiresApproval=true, autoPromoted=false.`,
    );
  } else {
    lines.push('Memory suggestion boundary: no pending reflection memory suggestions; nothing was saved.');
  }
  lines.push('Guardrail: treat this as reviewable synthesis only, not PromptTruth, tool evidence, or canonical memory.');
  return lines;
}

function buildVerboseSessionReflectionPromptLines({
  reflection,
  reflectionSummary,
  openLoopUpdate,
} = {}) {
  const lines = buildCompactSessionReflectionPromptLines({
    reflection,
    reflectionSummary,
    openLoopUpdate,
  });
  if (reflection.summary.detailed) {
    lines.push(`Detailed reflection note, still advisory: ${reflection.summary.detailed}`);
  }
  const decisions = (reflection.decisions || []).slice(0, 2);
  decisions.forEach((item) => {
    lines.push(`Decision candidate (${item.support || 'unknown'} support): ${item.text}`);
  });
  const updates = sourceBackedOpenLoopUpdates(reflection).slice(0, 2);
  updates.forEach((item) => {
    if (openLoopUpdate && item.id === openLoopUpdate.id) return;
    const nextStep = item.nextLikelyStep ? ` Next likely step: ${item.nextLikelyStep}` : '';
    lines.push(`Additional open-loop cue, advisory: ${item.title || item.loopId}.${nextStep}`);
  });
  (reflection.memorySuggestions || []).slice(0, 2).forEach((item) => {
    lines.push(
      `Pending memory suggestion for review only: ${item.text} [supportState=${item.supportState}; sensitivity=${item.sensitivity}; requiresApproval=${item.requiresApproval}; autoPromoted=${item.autoPromoted}]`,
    );
  });
  return lines;
}

function buildSessionReflectionPromptBridge(options = {}) {
  const raw = isPlainObject(options) ? options : {};
  const mode = normalizeSessionReflectionPromptBridgeMode(raw.mode || raw.bridgeMode);
  const enabled = raw.enabled === true
    && (mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT
      || mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE);
  const reflection = normalizeSessionReflection(raw.reflection || {});
  const reflectionSummary = summarizeSessionReflection(reflection);
  const userText = cleanString(raw.userText || raw.prompt || '', 1200);
  const relevant = enabled ? isSessionReflectionRelevant(reflection, userText) : false;
  const openLoopUpdate = relevant ? selectSessionReflectionOpenLoopUpdate(reflection, userText) : null;
  const maxWords = clampInteger(
    raw.maxWords ?? raw.maxTokens,
    mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE ? 180 : DEFAULT_SESSION_REFLECTION_PROMPT_BRIDGE_WORDS,
    20,
    260,
  );
  const lines = enabled && relevant
    ? (mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE
      ? buildVerboseSessionReflectionPromptLines({ reflection, reflectionSummary, openLoopUpdate })
      : buildCompactSessionReflectionPromptLines({ reflection, reflectionSummary, openLoopUpdate }))
    : [];
  const promptText = clipWords(lines.join(' '), maxWords);
  const renderedCount = promptText ? 1 : 0;
  const snippet = renderedCount > 0
    ? {
      id: `${mode}:${reflection.sessionId || 'session-reflection'}`,
      mode,
      wordCount: countWords(promptText),
      text: promptText,
    }
    : null;
  const memorySuggestionPolicy = summarizePromptBridgeMemorySuggestionPolicy(reflectionSummary);
  const memorySuggestions = (reflection.memorySuggestions || []).map((item) => ({
    id: item.id,
    kind: item.kind,
    supportState: item.supportState,
    supportLevel: item.supportLevel,
    sensitivity: item.sensitivity,
    requiresApproval: item.requiresApproval,
    autoPromoted: item.autoPromoted,
  }));

  return {
    schema: PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA,
    generatedAt: normalizeIso(raw.generatedAt || raw.now || '', reflection.generatedAt || normalizeNowIso(new Date())),
    measurementMode: cleanString(raw.measurementMode || 'fixture-compare', 80),
    mode,
    enabled,
    disabledReason: enabled
      ? (relevant ? '' : 'not-relevant')
      : (mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.BASELINE ? 'baseline-no-reflection-bridge' : 'disabled'),
    relevant,
    livePromptBridge: false,
    liveChatTouched: false,
    promptTruthExpanded: false,
    promptTruthChannelAdded: false,
    toolEvidenceReceiptChanged: false,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    autonomousActions: false,
    reflectionSummary,
    selectedOpenLoopUpdateIds: openLoopUpdate ? [openLoopUpdate.id] : [],
    memorySuggestionPolicy,
    memorySuggestions,
    promptBridge: {
      renderedCount,
      promptText,
      snippets: snippet ? [snippet] : [],
      memorySuggestionTextRendered: mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE && renderedCount > 0,
      compact: mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT,
      verbose: mode === SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE,
      maxWords,
      wordCount: countWords(promptText),
    },
    limits: uniqueStrings([
      ...DEFAULT_REFLECTION_PROMPT_BRIDGE_LIMITS,
      ...(listValue(raw.limits || [])),
    ], 20, 260),
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
  const sessionId = cleanString(raw.sessionId || raw.threadId || '', 180);
  const sourceReflectionId = cleanString(
    raw.id
      || raw.reflectionId
      || `${sessionId || 'session'}:${generatedAt}`,
    180,
  );
  const openLoopUpdates = listValue(raw.openLoopUpdates || raw.openLoops || [])
    .map((item, index) => normalizeOpenLoopUpdate(item, { index }))
    .filter((item) => item.title || item.nextLikelyStep || item.loopId);
  const memoryLinkSuggestions = normalizeSessionReflectionLinkSuggestions({
    generatedAt,
    measurementMode: MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
    memoryLinkSuggestions: raw.memoryLinkSuggestions || raw.linkSuggestions || raw.links || [],
  }, {
    generatedAt,
    sourceReflectionId,
    openLoopUpdates,
  });

  return {
    schema: PENNY_SESSION_REFLECTION_SCHEMA,
    generatedAt,
    sessionId,
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
    openLoopUpdates,
    memorySuggestions,
    memoryLinkSuggestions,
    doNotSave,
    warnings: uniqueStrings(warnings, 50, 300),
    limits: uniqueStrings([...(listValue(raw.limits || [])), ...DEFAULT_LIMITS], 20, 260),
  };
}

function normalizeTurnRole(value = '') {
  const role = cleanToken(value || 'unknown');
  if (['user', 'assistant', 'system', 'tool', 'runtime', 'unknown'].includes(role)) return role;
  return 'unknown';
}

function normalizeReflectionTurnSummary(input = {}, options = {}) {
  const raw = isPlainObject(input) ? input : {};
  const index = Number(options.index || 0);
  const maxExcerptChars = clampInteger(options.maxExcerptChars, 360, 40, 1200);
  const rawId = cleanString(
    raw.id
      || raw.turnId
      || raw.messageId
      || raw.uuid
      || '',
    180,
  );
  const excerpt = cleanString(
    raw.visibleText
      || raw.text
      || raw.content
      || raw.message
      || raw.userText
      || raw.assistantText
      || raw.reply
      || '',
    maxExcerptChars,
  );
  if (!rawId && !excerpt) return null;
  return {
    id: rawId || `turn-${index + 1}`,
    role: normalizeTurnRole(raw.role || raw.sender || raw.author),
    at: normalizeIso(raw.at || raw.timestamp || raw.createdAt || raw.time || ''),
    excerpt,
    sourceReceipts: normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || raw.artifacts || []),
  };
}

function normalizeReflectionTurnSummaries(turns = [], options = {}) {
  const normalized = [];
  const seen = new Set();
  listValue(turns).forEach((turn, index) => {
    const item = normalizeReflectionTurnSummary(turn, { ...options, index });
    if (!item) return;
    const key = item.id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(item);
  });
  return normalized;
}

function selectRecentReflectionTurns(turns = [], options = {}) {
  const maxTurns = clampInteger(options.maxTurns, 8, 1, 30);
  const normalized = normalizeReflectionTurnSummaries(turns, options);
  return normalized.slice(Math.max(0, normalized.length - maxTurns));
}

function defaultReflectionPrepOutputPath({
  generatedAt = new Date().toISOString(),
  outputDir = path.resolve(__dirname, '..', 'output'),
  sessionId = '',
} = {}) {
  const stamp = normalizeIso(generatedAt, new Date().toISOString()).replace(/[:.]/g, '-');
  const sessionSlug = slugify(sessionId, 'session');
  return path.join(outputDir, `session-reflection-prep-${sessionSlug}-${stamp}.json`);
}

function writeSessionReflectionPrepArtifact({
  outputPath = '',
  artifact = {},
} = {}) {
  const target = cleanString(outputPath || '', 1000);
  if (!target) return { outputPath: '', artifact };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath: target, artifact };
}

function buildSessionReflectionPrepArtifact(input = {}) {
  const raw = isPlainObject(input) ? input : {};
  const now = raw.now || raw.generatedAt || new Date();
  const generatedAt = normalizeIso(raw.generatedAt || raw.createdAt || '', normalizeNowIso(now));
  const sessionId = cleanString(raw.sessionId || raw.threadId || '', 180);
  const allTurns = listValue(raw.turns || raw.recentTurns || raw.messages || []);
  const maxTurns = clampInteger(raw.maxTurns, 8, 1, 30);
  const normalizedTurns = normalizeReflectionTurnSummaries(allTurns, {
    maxExcerptChars: raw.maxExcerptChars,
  });
  const recentTurns = normalizedTurns.slice(Math.max(0, normalizedTurns.length - maxTurns));
  const truncatedTurnCount = Math.max(0, normalizedTurns.length - recentTurns.length);
  const includedArtifacts = normalizeSourceReceipts([
    ...(listValue(raw.includedArtifacts || raw.artifacts || raw.sourceArtifacts || [])),
    ...recentTurns.flatMap((turn) => turn.sourceReceipts || []),
  ]);
  const excludedBecause = uniqueStrings([
    ...(truncatedTurnCount > 0 ? [`recent turn window truncated by ${truncatedTurnCount}`] : []),
    ...(recentTurns.length === 0 ? ['no bounded recent turns available'] : []),
    ...(listValue(raw.excludedBecause || raw.exclusions || [])),
  ], 20, 260);
  const status = recentTurns.length === 0
    ? SESSION_REFLECTION_PREP_STATUSES.SKIPPED
    : (truncatedTurnCount > 0 ? SESSION_REFLECTION_PREP_STATUSES.DEGRADED : SESSION_REFLECTION_PREP_STATUSES.PREPARED);
  const summary = isPlainObject(raw.summary) || typeof raw.summary === 'string'
    ? raw.summary
    : {
      short: recentTurns.length
        ? `Prepared a bounded after-turn reflection draft from ${recentTurns.length} recent turn${recentTurns.length === 1 ? '' : 's'}.`
        : 'No bounded recent turns were available for session reflection prep.',
      detailed: recentTurns.length
        ? 'Recent visible turn excerpts were captured for review without writing canonical memory.'
        : 'Reflection prep skipped without inferring memory, emotion, or session truth.',
      confidence: recentTurns.length ? 'medium' : 'unknown',
    };
  const reflection = normalizeSessionReflection({
    generatedAt,
    sessionId,
    measurementMode: raw.measurementMode || 'after-turn',
    liveModelCalls: false,
    behaviorChanged: false,
    sourceWindow: {
      turnIds: recentTurns.map((turn) => turn.id),
      startedAt: recentTurns[0]?.at || '',
      endedAt: recentTurns[recentTurns.length - 1]?.at || '',
      includedArtifacts,
      excludedBecause,
    },
    summary,
    decisions: raw.decisions || [],
    openLoopUpdates: raw.openLoopUpdates || raw.openLoops || [],
    memorySuggestions: raw.memorySuggestions || raw.memorySuggestionCandidates || raw.suggestions || [],
    doNotSave: raw.doNotSave || raw.doNotSaveItems || [],
    warnings: raw.warnings || [],
  }, { now: generatedAt });
  const validation = validateSessionReflection(reflection);
  const reflectionSummary = summarizeSessionReflection(reflection);
  const validationStatus = validation.valid ? status : SESSION_REFLECTION_PREP_STATUSES.DEGRADED;

  return {
    schema: PENNY_SESSION_REFLECTION_PREP_SCHEMA,
    artifactKind: 'session-reflection-prep',
    generatedAt,
    sessionId,
    measurementMode: 'after-turn-background',
    status: validationStatus,
    reason: validationStatus === SESSION_REFLECTION_PREP_STATUSES.SKIPPED
      ? 'no-bounded-recent-turns'
      : (validation.valid ? 'draft-reflection-prepared' : 'draft-reflection-degraded'),
    reflectionPrepared: validationStatus !== SESSION_REFLECTION_PREP_STATUSES.SKIPPED && validation.valid,
    localOnly: true,
    bounded: true,
    sourceTurnCount: recentTurns.length,
    truncatedTurnCount,
    includedArtifactCount: includedArtifacts.length,
    boundedRecentTurns: recentTurns,
    reflection,
    reflectionSummary,
    validation: {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    },
    liveModelCalls: false,
    serverSpawned: false,
    livePromptBridge: false,
    behaviorChanged: false,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    guardrails: {
      localOnly: true,
      bounded: true,
      requiresApprovalForMemorySuggestions: true,
      autoPromoted: false,
      explicitMemoryWrites: false,
      canonicalMemoryWrites: false,
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      hiddenChainOfThoughtStored: false,
      runtimeVoiceChanged: false,
      answerQualityProof: false,
    },
    limits: uniqueStrings([...DEFAULT_REFLECTION_PREP_LIMITS, ...(listValue(raw.limits || []))], 20, 260),
  };
}

function buildSessionReflectionPrepJob(options = {}) {
  const raw = isPlainObject(options) ? options : {};
  const sessionId = cleanString(raw.sessionId || raw.threadId || '', 180);
  const turns = listValue(raw.turns || raw.recentTurns || raw.messages || []);
  const recentTurns = selectRecentReflectionTurns(turns, {
    maxTurns: raw.maxTurns,
    maxExcerptChars: raw.maxExcerptChars,
  });
  const turnKey = recentTurns.map((turn) => turn.id).slice(-4).join(',');
  const generatedAt = normalizeIso(raw.generatedAt || raw.now || '', '');
  const outputPath = raw.outputPath === false
    ? ''
    : cleanString(raw.outputPath || defaultReflectionPrepOutputPath({
      generatedAt: generatedAt || new Date().toISOString(),
      outputDir: raw.outputDir,
      sessionId,
    }), 1000);
  const writer = typeof raw.writer === 'function' ? raw.writer : null;
  const jobId = cleanToken(raw.id || `reflection-prep-${sessionId || turnKey || 'session'}`, 'reflection-prep');

  return {
    id: jobId,
    kind: SESSION_REFLECTION_PREP_JOB_KIND,
    label: raw.label || 'Session reflection prep',
    priority: raw.priority,
    dedupeKey: cleanString(
      raw.dedupeKey || `session-reflection-prep:${sessionId || 'unknown'}:${turnKey || 'no-turns'}`,
      180,
    ),
    deadlineMs: raw.deadlineMs,
    localOnly: true,
    requiresApproval: false,
    candidateCount: recentTurns.length,
    fallback: raw.fallback || 'Reflection prep is optional; do not infer reflection completion from a skipped or missed job.',
    run: async (context = {}) => {
      const runGeneratedAt = generatedAt || normalizeIso(context.startedAt || '', normalizeNowIso(new Date()));
      const artifact = buildSessionReflectionPrepArtifact({
        ...raw,
        generatedAt: runGeneratedAt,
        sessionId,
        turns,
      });
      let artifactPath = '';
      if (raw.writeArtifact !== false && outputPath) {
        if (writer) {
          const result = await writer({ outputPath, artifact });
          artifactPath = cleanString(result?.outputPath || outputPath, 1000);
        } else {
          artifactPath = writeSessionReflectionPrepArtifact({ outputPath, artifact }).outputPath;
        }
      }
      return {
        schema: PENNY_SESSION_REFLECTION_PREP_SCHEMA,
        artifactKind: 'session-reflection-prep',
        status: artifact.status,
        reason: artifact.reason,
        artifactPath,
        sessionId: artifact.sessionId,
        sourceTurnCount: artifact.sourceTurnCount,
        candidateCount: artifact.sourceTurnCount,
        memorySuggestionCount: artifact.reflectionSummary.memorySuggestionCount,
        doNotSaveCount: artifact.reflectionSummary.doNotSaveCount,
        validationValid: artifact.validation.valid,
        reflectionPrepared: artifact.reflectionPrepared,
        memoryWrites: false,
        explicitMemoryWrites: false,
        canonicalMemoryWrites: false,
        promptTruthExpanded: false,
        toolEvidenceReceiptChanged: false,
        hiddenChainOfThoughtStored: false,
        runtimeVoiceChanged: false,
      };
    },
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
    memoryLinkSuggestionCount: normalized.memoryLinkSuggestions.links.length,
    memoryLinkSuggestionHeldBackCount: normalized.memoryLinkSuggestions.heldBack.length,
    memoryLinkSuggestionNeedsReviewCount: normalized.memoryLinkSuggestions.summary.needsReview,
    memoryLinkSuggestionRelations: { ...(normalized.memoryLinkSuggestions.summary.byRelation || {}) },
    doNotSaveCount: normalized.doNotSave.length,
    warningCount: normalized.warnings.length,
    unsupportedClaimCount: normalized.summary.unsupportedClaims.length,
    allMemorySuggestionsRequireApproval: normalized.memorySuggestions.every((item) => item.requiresApproval === true),
    autoPromotedSuggestionCount: normalized.memorySuggestions.filter((item) => item.autoPromoted === true).length,
    supportStates,
    sensitivityCounts,
    memoryAuthority: 'reviewable-synthesis-only',
    memoryLinkAuthority: 'review-gated-shadow-only',
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
  if (normalized.memoryLinkSuggestions.scoringActive !== false || normalized.memoryLinkSuggestions.behaviorChanged !== false) {
    errors.push('reflection link suggestions must be shadow-only');
  }
  normalized.memoryLinkSuggestions.links.forEach((link) => {
    if (!REFLECTION_LINK_SUGGESTION_RELATIONS.has(link.relation)) {
      errors.push(`memory link suggestion ${link.id} uses unsupported relation`);
    }
    if (link.reviewState !== MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW) {
      errors.push(`memory link suggestion ${link.id} must require review`);
    }
    if (
      link.authorityEffect !== MEMORY_LINK_AUTHORITY_EFFECTS.NONE
      && link.authorityEffect !== MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY
    ) {
      errors.push(`memory link suggestion ${link.id} has active authority effect`);
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
  PENNY_SESSION_REFLECTION_PREP_SCHEMA,
  PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA,
  PENNY_SESSION_REFLECTION_LINK_SUGGESTIONS_SCHEMA,
  SESSION_REFLECTION_PREP_JOB_KIND,
  SESSION_REFLECTION_PREP_STATUSES,
  SESSION_REFLECTION_PROMPT_BRIDGE_MODES,
  SUPPORT_STATES,
  buildSessionReflectionPromptBridge,
  normalizeSessionReflection,
  normalizeSessionReflectionPromptBridgeMode,
  normalizeReflectionDecision,
  normalizeOpenLoopUpdate,
  normalizeSessionReflectionLinkSuggestions,
  normalizeReflectionMemoryLinkSuggestion,
  normalizeMemorySuggestion,
  normalizeDoNotSaveItem,
  normalizeReflectionTurnSummary,
  normalizeReflectionTurnSummaries,
  selectRecentReflectionTurns,
  buildSessionReflectionPrepArtifact,
  buildSessionReflectionPrepJob,
  writeSessionReflectionPrepArtifact,
  summarizeSessionReflection,
  validateSessionReflection,
};
