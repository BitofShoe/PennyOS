const crypto = require('crypto');

const { SUPPORT_STATES } = require('./penny-session-reflection');
const {
  PENNY_EXPLICIT_MEMORY_APPROVAL_WRITE_SCHEMA,
  applyApprovedExplicitMemoryWrite,
} = require('./penny-memory');

const PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA = 'penny-memory-suggestion-review-queue.v1';
const PENNY_MEMORY_SUGGESTION_QUEUE_ITEM_SCHEMA = 'penny-memory-suggestion-review-item.v1';

const MEMORY_SUGGESTION_QUEUE_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DISMISSED: 'dismissed',
  SUPERSEDED: 'superseded',
});

const MEMORY_SUGGESTION_QUEUE_STATUS_VALUES = new Set(Object.values(MEMORY_SUGGESTION_QUEUE_STATUSES));

const MEMORY_SUGGESTION_QUEUE_LIMITS = Object.freeze([
  'Memory suggestion queue items are review candidates only, not canonical memory.',
  'Queue approval status alone does not write explicit memory; explicit approval must route through existing explicit-memory APIs.',
  'Every queued suggestion requires approval and autoPromoted=false.',
  'Reflection summaries and queued suggestions are not truth proof.',
  'The queue does not expand PromptTruth or toolEvidenceReceipt.',
  'Hidden chain-of-thought, inferred emotions, and temporary states are not stored as memory suggestions.',
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

const QUEUEABLE_MEMORY_KINDS = new Set([
  'user-preference',
  'stable-user-fact',
  'correction',
  'unknown',
]);

const INFERRED_EMOTION_PATTERN = /\b(?:seems?|appears?|probably|maybe|infer(?:red)?|guess(?:ed)?|assume(?:d)?).{0,80}\b(?:anxious|angry|sad|depressed|jealous|lonely|afraid|upset|stressed|ashamed|excited|frustrated)\b/i;
const TEMPORARY_STATE_PATTERN = /\b(?:right now|currently|today|this session|for now|temporarily|temporary state|mood|hyped|excited|frustrated|tired)\b/i;
const SENSITIVE_MEMORY_PATTERN = /\b(?:home address|address|phone number|ssn|social security|password|secret|bank|bill|billing|financial|credit card|medical|medication|diagnos(?:is|ed)|therapy|trauma|sexual|romantic|political|religion|legal)\b/i;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value = '', limit = 500) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '', fallback = '') {
  const token = cleanString(value, 160).toLowerCase().replace(/[_\s]+/g, '-');
  return token || fallback;
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

function stableHash(value = '') {
  return crypto.createHash('sha1').update(String(value || '')).digest('hex');
}

function normalizeHiddenFieldKey(key = '') {
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
    if (HIDDEN_COT_FIELD_KEYS.has(normalizeHiddenFieldKey(key))) {
      out.push(path);
      if (out.length >= 20) return out;
      continue;
    }
    findHiddenCotFields(nested, path, out);
    if (out.length >= 20) return out;
  }
  return out;
}

function normalizeConfidence(value = '', fallback = 'unknown') {
  const confidence = cleanToken(value);
  if (confidence === 'unclear' || confidence === 'none') return 'unknown';
  if (['low', 'medium', 'high', 'unknown'].includes(confidence)) return confidence;
  return fallback;
}

function normalizeMemoryKind(value = '') {
  const kind = cleanToken(value);
  const aliases = {
    preference: 'user-preference',
    'user-pref': 'user-preference',
    fact: 'stable-user-fact',
    'stable-fact': 'stable-user-fact',
    'stable-user-fact': 'stable-user-fact',
    correction: 'correction',
    'memory-correction': 'correction',
    project: 'project-decision',
    decision: 'project-decision',
    'project-law': 'project-decision',
    openloop: 'open-loop',
    'open-loop-update': 'open-loop',
    inferred: 'inferred-emotion',
    emotion: 'inferred-emotion',
    temporary: 'temporary-session-state',
    'temporary-state': 'temporary-session-state',
  };
  return aliases[kind] || kind || 'unknown';
}

function normalizeSupportState(value = '', supportText = '', suggestionText = '') {
  const support = cleanToken(value);
  const aliases = {
    explicit: SUPPORT_STATES.EXPLICIT_USER,
    'explicit-user-statement': SUPPORT_STATES.EXPLICIT_USER,
    'user-stated': SUPPORT_STATES.EXPLICIT_USER,
    'user-statement': SUPPORT_STATES.EXPLICIT_USER,
    repeated: SUPPORT_STATES.REPEATED_EXPLICIT,
    'repeated-preference': SUPPORT_STATES.REPEATED_EXPLICIT,
    'repeated-explicit-user-preference': SUPPORT_STATES.REPEATED_EXPLICIT,
    source: SUPPORT_STATES.SOURCE_BACKED,
    'source-backed': SUPPORT_STATES.SOURCE_BACKED,
    'source-receipt': SUPPORT_STATES.SOURCE_BACKED,
    repo: SUPPORT_STATES.REPO_SOURCE,
    docs: SUPPORT_STATES.REPO_SOURCE,
    receipt: SUPPORT_STATES.ARTIFACT,
    artifact: SUPPORT_STATES.ARTIFACT,
    promotion: SUPPORT_STATES.PROMOTION_REVIEW,
    'promotion-review': SUPPORT_STATES.PROMOTION_REVIEW,
    'review-candidate': SUPPORT_STATES.PROMOTION_REVIEW,
    correction: SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION,
    'existing-correction': SUPPORT_STATES.EXISTING_EXPLICIT_CORRECTION,
    candidate: SUPPORT_STATES.CANDIDATE_ONLY,
    'candidate-only': SUPPORT_STATES.CANDIDATE_ONLY,
    'archive-candidate': SUPPORT_STATES.CANDIDATE_ONLY,
    weak: SUPPORT_STATES.UNSUPPORTED,
    unsupported: SUPPORT_STATES.UNSUPPORTED,
    inference: SUPPORT_STATES.INFERRED,
    inferred: SUPPORT_STATES.INFERRED,
    temporary: SUPPORT_STATES.TEMPORARY,
    sensitive: SUPPORT_STATES.SENSITIVE,
    speculative: SUPPORT_STATES.SPECULATIVE,
  };
  const normalized = aliases[support] || support;
  if (Object.values(SUPPORT_STATES).includes(normalized)) return normalized;

  const source = cleanString(`${supportText || ''}\n${suggestionText || ''}`, 1000).toLowerCase();
  if (!source) return SUPPORT_STATES.UNKNOWN;
  if (INFERRED_EMOTION_PATTERN.test(source) || /\b(?:infer|inferred|guess|assume|seems like|probably)\b/.test(source)) {
    return SUPPORT_STATES.INFERRED;
  }
  if (TEMPORARY_STATE_PATTERN.test(source)) return SUPPORT_STATES.TEMPORARY;
  if (/\b(?:candidate-only|archive-only|weak evidence|unverified|unsupported)\b/.test(source)) {
    return SUPPORT_STATES.CANDIDATE_ONLY;
  }
  if (/\b(?:repeated|multiple|several)\b/.test(source)
    && /\b(?:explicit|user said|user stated|preference|prefers?)\b/.test(source)) {
    return SUPPORT_STATES.REPEATED_EXPLICIT;
  }
  if (/\b(?:explicit user|user said|user stated|user told|the user said|please remember|remember this)\b/.test(source)) {
    return SUPPORT_STATES.EXPLICIT_USER;
  }
  if (/\b(?:repo|docs?|source|receipt|artifact|test)\b/.test(source)) return SUPPORT_STATES.SOURCE_BACKED;
  return SUPPORT_STATES.UNKNOWN;
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

function clampSupportLevel(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(4, number));
}

function normalizeSensitivity(value = '', text = '') {
  const sensitivity = cleanToken(value);
  if (['private', 'sensitive', 'secret', 'medical', 'financial', 'legal', 'sexual', 'high'].includes(sensitivity)) {
    return 'high';
  }
  if (sensitivity === 'medium') return 'medium';
  if (sensitivity === 'low') return 'low';
  return SENSITIVE_MEMORY_PATTERN.test(text) ? 'high' : 'low';
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

function normalizeQueueStatus(value = '') {
  const status = cleanToken(value, MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING);
  return MEMORY_SUGGESTION_QUEUE_STATUS_VALUES.has(status)
    ? status
    : MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING;
}

function normalizeExplicitMemoryWriteReceipt(value = null) {
  const raw = isPlainObject(value) ? value : {};
  if (raw.schema !== PENNY_EXPLICIT_MEMORY_APPROVAL_WRITE_SCHEMA || raw.ok !== true) return null;
  const promotedMemory = isPlainObject(raw.promotedMemory)
    ? {
        text: cleanString(raw.promotedMemory.text || '', 220),
        kind: cleanString(raw.promotedMemory.kind || 'explicit', 80),
        ts: Number.isFinite(Number(raw.promotedMemory.ts)) ? Number(raw.promotedMemory.ts) : undefined,
        source: cleanString(raw.promotedMemory.source || 'review-candidate', 80),
        evidence: uniqueStrings(raw.promotedMemory.evidence || [], 4, 220),
        origin: isPlainObject(raw.promotedMemory.origin) ? raw.promotedMemory.origin : null,
      }
    : null;
  if (!promotedMemory?.text) return null;
  const correction = isPlainObject(raw.correction)
    ? {
        existingMemoryId: cleanString(raw.correction.existingMemoryId || '', 180),
        oldText: cleanString(raw.correction.oldText || '', 800),
        newText: cleanString(raw.correction.newText || '', 800),
      }
    : null;
  return {
    ok: true,
    schema: PENNY_EXPLICIT_MEMORY_APPROVAL_WRITE_SCHEMA,
    reviewedAt: normalizeIso(raw.reviewedAt || '', ''),
    reviewerDecision: raw.reviewerDecision === 'approve' ? 'approve' : cleanString(raw.reviewerDecision || '', 80),
    queueItemId: cleanString(raw.queueItemId || '', 180),
    sourceReflectionId: cleanString(raw.sourceReflectionId || '', 180),
    suggestionId: cleanString(raw.suggestionId || '', 180),
    supportState: cleanString(raw.supportState || '', 80),
    supportLevel: clampSupportLevel(raw.supportLevel, 0),
    sensitivity: normalizeSensitivity(raw.sensitivity || '', ''),
    requiresApproval: true,
    autoPromoted: false,
    explicitApproval: raw.explicitApproval === true,
    manualOverride: raw.manualOverride === true,
    manualOverrideReason: cleanString(raw.manualOverrideReason || '', 260),
    explicitMemoryPath: 'mergeMemoryItems',
    memoryWrites: raw.memoryWrites === true,
    explicitMemoryWrites: raw.explicitMemoryWrites === true,
    canonicalMemoryWrites: raw.canonicalMemoryWrites === true,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    sourceReceipts: normalizeSourceReceipts(raw.sourceReceipts || []),
    promotedMemory,
    ...(correction && (correction.oldText || correction.newText || correction.existingMemoryId) ? { correction } : {}),
  };
}

function buildSuggestionDedupeKey(suggestion = {}) {
  const textKey = cleanString(suggestion.text || '', 800).toLowerCase();
  const kindKey = cleanToken(suggestion.kind || 'unknown');
  const correctionKey = cleanString(
    `${suggestion.existingMemoryId || ''}|${suggestion.oldText || ''}|${suggestion.newText || ''}`,
    1000,
  ).toLowerCase();
  return stableHash(`${kindKey}|${textKey}|${correctionKey}`);
}

function normalizeQueueSuggestion(input = {}, options = {}) {
  const raw = isPlainObject(input?.suggestion) ? input.suggestion : (isPlainObject(input) ? input : {});
  const text = cleanString(
    raw.text
      || raw.memory
      || raw.suggestionText
      || raw.suggestedMemory
      || raw.proposedMemoryText
      || raw.suggestedExplicitMemory?.text
      || '',
    800,
  );
  const kind = normalizeMemoryKind(raw.kind || raw.type || raw.class || raw.memoryKind);
  const supportState = normalizeSupportState(
    raw.supportState
      || raw.supportClass
      || raw.supportType
      || raw.support
      || raw.evidenceClass
      || '',
    raw.support || raw.reason || raw.source || '',
    text,
  );
  const supportLevel = clampSupportLevel(raw.supportLevel, defaultSupportLevel(supportState));
  const sourceReceipts = normalizeSourceReceipts(raw.sourceReceipts || raw.sourceRefs || raw.sources || []);
  const sensitivity = normalizeSensitivity(raw.sensitivity || raw.memorySensitivity || raw.privacy || '', text);
  const warnings = [];
  const hiddenFields = findHiddenCotFields(raw);
  if (hiddenFields.length) warnings.push(`hidden-CoT fields rejected: ${hiddenFields.join(', ')}`);
  if (raw.requiresApproval === false) warnings.push('requiresApproval=false normalized to true');
  if (raw.autoPromoted === true) warnings.push('autoPromoted=true normalized to false');
  if (raw.explicitMemoryWrite || raw.suggestedExplicitMemory?.canonicalWriteAllowed === true) {
    warnings.push('explicit memory write payload ignored by review queue');
  }

  return {
    id: cleanString(raw.id || raw.suggestionId || `suggestion-${Number(options.index || 0) + 1}`, 180),
    text,
    kind,
    confidence: normalizeConfidence(raw.confidence, supportLevel >= 2 ? 'high' : (supportLevel === 1 ? 'medium' : 'low')),
    supportState,
    supportLevel,
    sensitivity,
    sourceReceipts,
    requiresApproval: true,
    autoPromoted: false,
    suggestedExplicitMemory: null,
    ...(kind === 'correction' ? {
      existingMemoryId: cleanString(raw.existingMemoryId || raw.correctionOf || '', 180),
      oldText: cleanString(raw.oldText || raw.previousText || raw.oldValue || '', 800),
      newText: cleanString(raw.newText || raw.correctedText || raw.newValue || text, 800),
    } : {}),
    warnings: uniqueStrings(warnings, 20, 260),
  };
}

function rejectReasonForQueueSuggestion(suggestion = {}) {
  const joined = cleanString(
    `${suggestion.text || ''}\n${suggestion.supportState || ''}\n${suggestion.kind || ''}`,
    1200,
  );
  if (!suggestion.text) return 'empty-memory-suggestion';
  if (
    suggestion.kind === 'inferred-emotion'
    || suggestion.supportState === SUPPORT_STATES.INFERRED
    || INFERRED_EMOTION_PATTERN.test(joined)
  ) {
    return 'inferred-emotion-not-queued';
  }
  if (
    suggestion.kind === 'temporary-session-state'
    || suggestion.supportState === SUPPORT_STATES.TEMPORARY
    || TEMPORARY_STATE_PATTERN.test(joined)
  ) {
    return 'temporary-state-not-queued';
  }
  if (!QUEUEABLE_MEMORY_KINDS.has(suggestion.kind)) return 'not-explicit-memory-suggestion';
  return '';
}

function buildQueueItemId({ sourceReflectionId = '', suggestion = {} } = {}) {
  const suggestionId = cleanString(suggestion.id || '', 180);
  const hash = stableHash(`${sourceReflectionId}|${suggestionId}|${suggestion.kind}|${suggestion.text}`).slice(0, 16);
  return `memory-suggestion:${hash}`;
}

function normalizeMemorySuggestionQueueItem(input = {}, options = {}) {
  const raw = isPlainObject(input) ? input : {};
  const createdAt = normalizeIso(raw.createdAt || options.createdAt || options.now || '', normalizeNowIso(new Date()));
  const sourceReflectionId = cleanString(
    raw.sourceReflectionId
      || raw.reflectionId
      || options.sourceReflectionId
      || '',
    180,
  );
  const suggestion = normalizeQueueSuggestion(raw.suggestion || raw, options);
  const status = normalizeQueueStatus(raw.status);
  const reviewedAt = status === MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING
    ? null
    : (normalizeIso(raw.reviewedAt || options.reviewedAt || '', '') || null);
  const sourceReceipts = normalizeSourceReceipts([
    ...listValue(raw.sourceReceipts || []),
    ...(suggestion.sourceReceipts || []),
  ]);
  const warnings = uniqueStrings([
    ...(raw.warnings || []),
    ...(suggestion.warnings || []),
    ...(suggestion.sensitivity === 'high'
      ? ['high-sensitivity memory suggestion remains pending for reviewer caution']
      : []),
  ], 30, 260);
  const dedupeKey = cleanString(raw.dedupeKey || buildSuggestionDedupeKey(suggestion), 80);
  const explicitMemoryWrite = status === MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED
    ? normalizeExplicitMemoryWriteReceipt(raw.explicitMemoryWrite)
    : null;

  return {
    schema: PENNY_MEMORY_SUGGESTION_QUEUE_ITEM_SCHEMA,
    id: cleanString(raw.id || buildQueueItemId({ sourceReflectionId, suggestion }), 180),
    createdAt,
    sourceReflectionId,
    suggestion: {
      id: suggestion.id,
      text: suggestion.text,
      kind: suggestion.kind,
      confidence: suggestion.confidence,
      supportState: suggestion.supportState,
      supportLevel: suggestion.supportLevel,
      sensitivity: suggestion.sensitivity,
      sourceReceipts: suggestion.sourceReceipts,
      requiresApproval: true,
      autoPromoted: false,
      suggestedExplicitMemory: null,
      ...(suggestion.kind === 'correction' ? {
        existingMemoryId: suggestion.existingMemoryId || '',
        oldText: suggestion.oldText || '',
        newText: suggestion.newText || '',
      } : {}),
    },
    status,
    reviewedAt,
    explicitMemoryWrite,
    sourceReceipts,
    warnings,
    dedupeKey,
    localOnly: true,
    memoryWrites: !!explicitMemoryWrite,
    explicitMemoryWrites: !!explicitMemoryWrite,
    canonicalMemoryWrites: explicitMemoryWrite?.canonicalMemoryWrites === true,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
  };
}

function summarizeMemorySuggestionQueue(queue = {}) {
  const items = listValue(queue.items);
  const statusCounts = {};
  const sensitivityCounts = { low: 0, medium: 0, high: 0 };
  for (const status of Object.values(MEMORY_SUGGESTION_QUEUE_STATUSES)) statusCounts[status] = 0;
  for (const item of items) {
    const status = normalizeQueueStatus(item?.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    const sensitivity = item?.suggestion?.sensitivity;
    if (sensitivityCounts[sensitivity] !== undefined) sensitivityCounts[sensitivity] += 1;
  }
  return {
    schema: PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA,
    itemCount: items.length,
    pendingCount: statusCounts[MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING] || 0,
    approvedCount: statusCounts[MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED] || 0,
    rejectedCount: statusCounts[MEMORY_SUGGESTION_QUEUE_STATUSES.REJECTED] || 0,
    dismissedCount: statusCounts[MEMORY_SUGGESTION_QUEUE_STATUSES.DISMISSED] || 0,
    supersededCount: statusCounts[MEMORY_SUGGESTION_QUEUE_STATUSES.SUPERSEDED] || 0,
    statusCounts,
    sensitivityCounts,
    highSensitivityPendingCount: items.filter((item) => (
      item?.status === MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING
      && item?.suggestion?.sensitivity === 'high'
    )).length,
    allRequireApproval: items.every((item) => item?.suggestion?.requiresApproval === true),
    autoPromotedCount: items.filter((item) => item?.suggestion?.autoPromoted === true).length,
    explicitMemoryWriteCount: items.filter((item) => item?.explicitMemoryWrite).length,
    memoryWrites: items.some((item) => item?.explicitMemoryWrite?.memoryWrites === true),
    explicitMemoryWrites: items.some((item) => item?.explicitMemoryWrite?.explicitMemoryWrites === true),
    canonicalMemoryWrites: items.some((item) => item?.explicitMemoryWrite?.canonicalMemoryWrites === true),
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
  };
}

function normalizeMemorySuggestionQueue(input = {}, options = {}) {
  const raw = isPlainObject(input) ? input : {};
  const createdAt = normalizeIso(raw.createdAt || options.createdAt || options.now || '', normalizeNowIso(new Date()));
  const updatedAt = normalizeIso(raw.updatedAt || options.updatedAt || createdAt, createdAt);
  const items = listValue(raw.items)
    .map((item, index) => normalizeMemorySuggestionQueueItem(item, { ...options, index }))
    .filter((item) => item.suggestion.text);
  const queue = {
    schema: PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA,
    artifactKind: 'memory-suggestion-review-queue',
    createdAt,
    updatedAt,
    localOnly: true,
    items,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
    guardrails: {
      localOnly: true,
      reviewOnly: true,
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
    limits: uniqueStrings([...listValue(raw.limits || []), ...MEMORY_SUGGESTION_QUEUE_LIMITS], 20, 260),
  };
  queue.summary = summarizeMemorySuggestionQueue(queue);
  queue.memoryWrites = queue.summary.memoryWrites === true;
  queue.explicitMemoryWrites = queue.summary.explicitMemoryWrites === true;
  queue.canonicalMemoryWrites = queue.summary.canonicalMemoryWrites === true;
  queue.guardrails.reviewOnly = queue.summary.explicitMemoryWriteCount === 0;
  queue.guardrails.explicitMemoryWrites = queue.explicitMemoryWrites;
  queue.guardrails.canonicalMemoryWrites = queue.canonicalMemoryWrites;
  return queue;
}

function createMemorySuggestionQueue(options = {}) {
  return normalizeMemorySuggestionQueue({}, options);
}

function markItemSuperseded(item = {}, supersededAt = '', supersededBy = '') {
  const warnings = uniqueStrings([
    ...(item.warnings || []),
    supersededBy ? `superseded by ${supersededBy}` : 'superseded by newer memory suggestion',
  ], 30, 260);
  return {
    ...item,
    status: MEMORY_SUGGESTION_QUEUE_STATUSES.SUPERSEDED,
    reviewedAt: normalizeIso(supersededAt || '', item.reviewedAt || null),
    warnings,
    explicitMemoryWrite: null,
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
  };
}

function addMemorySuggestionToQueue(queueInput = {}, suggestionInput = {}, options = {}) {
  const rawSuggestion = isPlainObject(suggestionInput) ? suggestionInput : {};
  const createdAt = normalizeIso(options.createdAt || options.now || '', normalizeNowIso(new Date()));
  const queue = normalizeMemorySuggestionQueue(queueInput, { ...options, updatedAt: createdAt });
  const item = normalizeMemorySuggestionQueueItem({
    suggestion: rawSuggestion,
    sourceReflectionId: options.sourceReflectionId || rawSuggestion.sourceReflectionId || '',
    createdAt,
  }, options);
  const rejectionReason = rejectReasonForQueueSuggestion(item.suggestion);
  if (rejectionReason) {
    queue.updatedAt = createdAt;
    queue.summary = summarizeMemorySuggestionQueue(queue);
    return {
      action: 'rejected',
      reason: rejectionReason,
      queue,
      item: null,
      rejectedSuggestion: {
        id: item.suggestion.id,
        supportState: item.suggestion.supportState,
        sensitivity: item.suggestion.sensitivity,
        requiresApproval: true,
        autoPromoted: false,
      },
    };
  }

  const exactDuplicate = queue.items.find((existing) => (
    existing.dedupeKey === item.dedupeKey
    && existing.sourceReflectionId === item.sourceReflectionId
    && existing.suggestion.id === item.suggestion.id
  ));
  if (exactDuplicate) {
    queue.updatedAt = createdAt;
    queue.summary = summarizeMemorySuggestionQueue(queue);
    return {
      action: 'duplicate',
      reason: 'duplicate-memory-suggestion',
      queue,
      item: exactDuplicate,
    };
  }

  const supersedesIds = uniqueStrings([
    options.supersedesId,
    options.supersedes,
    rawSuggestion.supersedesId,
    rawSuggestion.supersedes,
  ], 8, 180);
  const supersededIds = [];
  queue.items = queue.items.map((existing) => {
    const sameDedupe = existing.dedupeKey === item.dedupeKey
      && existing.status === MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING;
    const explicitSupersede = supersedesIds.includes(existing.id)
      || supersedesIds.includes(existing.suggestion?.id);
    if (!sameDedupe && !explicitSupersede) return existing;
    supersededIds.push(existing.id);
    return markItemSuperseded(existing, createdAt, item.id);
  });

  const queuedItem = {
    ...item,
    warnings: uniqueStrings([
      ...item.warnings,
      ...(supersededIds.length ? [`supersedes ${supersededIds.join(', ')}`] : []),
    ], 30, 260),
  };
  queue.items.push(queuedItem);
  queue.updatedAt = createdAt;
  queue.summary = summarizeMemorySuggestionQueue(queue);
  return {
    action: 'queued',
    reason: supersededIds.length ? 'queued-and-superseded-older-suggestion' : 'queued',
    queue,
    item: queuedItem,
    supersededIds,
  };
}

function queueMemorySuggestionsFromReflection(queueInput = {}, reflectionInput = {}, options = {}) {
  const reflection = isPlainObject(reflectionInput?.reflection) ? reflectionInput.reflection : reflectionInput;
  const sourceReflectionId = cleanString(
    options.sourceReflectionId
      || reflection.id
      || reflection.reflectionId
      || `${reflection.sessionId || 'session'}:${reflection.generatedAt || ''}`,
    180,
  );
  let queue = normalizeMemorySuggestionQueue(queueInput, options);
  const operations = [];
  listValue(reflection.memorySuggestions || reflection.suggestions || []).forEach((suggestion, index) => {
    const result = addMemorySuggestionToQueue(queue, suggestion, {
      ...options,
      sourceReflectionId,
      index,
    });
    queue = result.queue;
    operations.push({
      action: result.action,
      reason: result.reason,
      itemId: result.item?.id || '',
      suggestionId: result.item?.suggestion?.id || result.rejectedSuggestion?.id || '',
      supersededIds: result.supersededIds || [],
    });
  });
  queue.summary = summarizeMemorySuggestionQueue(queue);
  return { queue, operations, summary: queue.summary };
}

function updateMemorySuggestionQueueItemStatus(queueInput = {}, itemId = '', status = '', options = {}) {
  const reviewedAt = normalizeIso(options.reviewedAt || options.now || '', normalizeNowIso(new Date()));
  const queue = normalizeMemorySuggestionQueue(queueInput, { ...options, updatedAt: reviewedAt });
  const targetStatus = normalizeQueueStatus(status);
  const cleanItemId = cleanString(itemId, 180);
  const index = queue.items.findIndex((item) => item.id === cleanItemId || item.suggestion.id === cleanItemId);
  if (index === -1) {
    return {
      action: 'not-found',
      reason: 'memory-suggestion-queue-item-not-found',
      queue,
      item: null,
    };
  }
  if (targetStatus !== MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING && options.explicitReview !== true) {
    return {
      action: 'held',
      reason: 'explicit-review-required',
      queue,
      item: queue.items[index],
    };
  }

  const item = queue.items[index];
  const nextItem = {
    ...item,
    status: targetStatus,
    reviewedAt: targetStatus === MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING ? null : reviewedAt,
    explicitMemoryWrite: null,
    warnings: uniqueStrings([
      ...(item.warnings || []),
      ...(targetStatus === MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED
        ? ['approved status recorded without explicit-memory write']
        : []),
    ], 30, 260),
    memoryWrites: false,
    explicitMemoryWrites: false,
    canonicalMemoryWrites: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
  };
  queue.items[index] = nextItem;
  queue.updatedAt = reviewedAt;
  queue.summary = summarizeMemorySuggestionQueue(queue);
  queue.memoryWrites = queue.summary.memoryWrites === true;
  queue.explicitMemoryWrites = queue.summary.explicitMemoryWrites === true;
  queue.canonicalMemoryWrites = queue.summary.canonicalMemoryWrites === true;
  queue.guardrails.reviewOnly = queue.summary.explicitMemoryWriteCount === 0;
  queue.guardrails.explicitMemoryWrites = queue.explicitMemoryWrites;
  queue.guardrails.canonicalMemoryWrites = queue.canonicalMemoryWrites;
  return {
    action: 'updated',
    reason: 'status-updated-without-memory-write',
    queue,
    item: nextItem,
  };
}

function approveMemorySuggestionQueueItem(queueInput = {}, itemId = '', options = {}) {
  return updateMemorySuggestionQueueItemStatus(
    queueInput,
    itemId,
    MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED,
    { ...options, explicitReview: true },
  );
}

function approveMemorySuggestionQueueItemForExplicitMemory(queueInput = {}, itemId = '', options = {}) {
  const reviewedAt = normalizeIso(options.reviewedAt || options.now || '', normalizeNowIso(new Date()));
  const queue = normalizeMemorySuggestionQueue(queueInput, { ...options, updatedAt: reviewedAt });
  const cleanItemId = cleanString(itemId, 180);
  const index = queue.items.findIndex((item) => item.id === cleanItemId || item.suggestion.id === cleanItemId);
  if (index === -1) {
    return {
      action: 'not-found',
      reason: 'memory-suggestion-queue-item-not-found',
      queue,
      item: null,
      memory: options.memory || {},
    };
  }

  const item = queue.items[index];
  if (options.explicitApproval !== true) {
    return {
      action: 'held',
      reason: 'explicit-approval-required',
      queue,
      item,
      memory: options.memory || {},
    };
  }
  if (item.explicitMemoryWrite) {
    return {
      action: 'duplicate',
      reason: 'explicit-memory-write-already-recorded',
      queue,
      item,
      memory: options.memory || {},
      explicitMemoryWrite: item.explicitMemoryWrite,
    };
  }
  if (![
    MEMORY_SUGGESTION_QUEUE_STATUSES.PENDING,
    MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED,
  ].includes(item.status)) {
    return {
      action: 'held',
      reason: 'memory-suggestion-not-pending-or-approved',
      queue,
      item,
      memory: options.memory || {},
    };
  }

  const applied = applyApprovedExplicitMemoryWrite(options.memory || {}, item, {
    ...options,
    explicitApproval: true,
    reviewedAt,
  });
  if (!applied.ok) {
    return {
      action: 'held',
      reason: applied.reason,
      queue,
      item,
      memory: options.memory || {},
    };
  }

  const explicitMemoryWrite = normalizeExplicitMemoryWriteReceipt(applied.write);
  const nextItem = {
    ...item,
    status: MEMORY_SUGGESTION_QUEUE_STATUSES.APPROVED,
    reviewedAt,
    explicitMemoryWrite,
    warnings: uniqueStrings([
      ...(item.warnings || []),
      'approved through existing explicit-memory path',
    ], 30, 260),
    memoryWrites: true,
    explicitMemoryWrites: true,
    canonicalMemoryWrites: true,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    hiddenChainOfThoughtStored: false,
    runtimeVoiceChanged: false,
  };
  queue.items[index] = nextItem;
  queue.updatedAt = reviewedAt;
  queue.summary = summarizeMemorySuggestionQueue(queue);
  queue.memoryWrites = true;
  queue.explicitMemoryWrites = true;
  queue.canonicalMemoryWrites = true;
  queue.guardrails.reviewOnly = false;
  queue.guardrails.explicitMemoryWrites = true;
  queue.guardrails.canonicalMemoryWrites = true;
  return {
    action: 'updated',
    reason: 'approved-explicit-memory-write',
    queue,
    item: nextItem,
    memory: applied.memory,
    explicitMemoryWrite,
    promotedMemory: applied.promotedMemory,
    removedOldMemoryCount: applied.removedOldMemoryCount,
  };
}

function rejectMemorySuggestionQueueItem(queueInput = {}, itemId = '', options = {}) {
  return updateMemorySuggestionQueueItemStatus(
    queueInput,
    itemId,
    MEMORY_SUGGESTION_QUEUE_STATUSES.REJECTED,
    { ...options, explicitReview: true },
  );
}

function dismissMemorySuggestionQueueItem(queueInput = {}, itemId = '', options = {}) {
  return updateMemorySuggestionQueueItemStatus(
    queueInput,
    itemId,
    MEMORY_SUGGESTION_QUEUE_STATUSES.DISMISSED,
    { ...options, explicitReview: true },
  );
}

function serializeMemorySuggestionQueue(queueInput = {}) {
  return `${JSON.stringify(normalizeMemorySuggestionQueue(queueInput), null, 2)}\n`;
}

module.exports = {
  PENNY_MEMORY_SUGGESTION_QUEUE_SCHEMA,
  PENNY_MEMORY_SUGGESTION_QUEUE_ITEM_SCHEMA,
  MEMORY_SUGGESTION_QUEUE_STATUSES,
  MEMORY_SUGGESTION_QUEUE_LIMITS,
  normalizeQueueSuggestion,
  normalizeMemorySuggestionQueueItem,
  normalizeMemorySuggestionQueue,
  createMemorySuggestionQueue,
  addMemorySuggestionToQueue,
  queueMemorySuggestionsFromReflection,
  updateMemorySuggestionQueueItemStatus,
  approveMemorySuggestionQueueItem,
  approveMemorySuggestionQueueItemForExplicitMemory,
  rejectMemorySuggestionQueueItem,
  dismissMemorySuggestionQueueItem,
  summarizeMemorySuggestionQueue,
  serializeMemorySuggestionQueue,
};
