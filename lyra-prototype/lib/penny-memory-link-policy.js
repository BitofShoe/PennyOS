const {
  PENNY_MEMORY_LINKS_SCHEMA,
  DEFAULT_MEMORY_LINK_LIMITS,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_CREATED_BY,
  MEMORY_LINK_DIRECTIONALITY,
  MEMORY_LINK_MEASUREMENT_MODES,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
  normalizeMemoryLinkSet,
} = require('./penny-memory-links');

const PENNY_CORRECTION_LINK_BUILDER_SCHEMA = 'penny-correction-link-builder.v1';

const STRONG_CORRECTION_SUPPORT_STATES = new Set([
  MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
]);

const CORRECTION_LINK_LIMITS = Object.freeze([
  ...DEFAULT_MEMORY_LINK_LIMITS,
  'Correction links in this slice are trace/shadow data only.',
  'Candidate-only, static, and semantic correction links cannot become verified support.',
  'Correction-link authority effects do not change ranking until an explicit scoring gate is enabled.',
]);

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

function slugify(value = '', fallback = 'correction-link') {
  const slug = cleanString(value, 240)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
  return slug || fallback;
}

function listValue(value = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
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

function normalizeSupportStateForPolicy(value = '') {
  const state = cleanToken(value);
  const aliases = {
    canonical: MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    explicit: MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'explicit-memory': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'explicit-user': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'explicit-user-correction': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'existing-explicit-correction': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    verified: MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'verified-correction': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    rendered: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    prompt: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    'prompt-rendered': MEMORY_LINK_SUPPORT_STATES.RENDERED,
    archive: MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    'archive-candidate': MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    semantic: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    static: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    candidate: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    'candidate-only': MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    'semantic-candidate': MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    'static-candidate': MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    research: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    ledger: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    unknown: MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
    unsupported: MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
  };
  const normalized = aliases[state] || state;
  return Object.values(MEMORY_LINK_SUPPORT_STATES).includes(normalized)
    ? normalized
    : MEMORY_LINK_SUPPORT_STATES.UNKNOWN;
}

function normalizeSourceReceiptForPolicy(receipt = {}) {
  if (typeof receipt === 'string') {
    const text = cleanString(receipt, 260);
    return text ? { type: 'note', text } : null;
  }
  if (!isPlainObject(receipt)) return null;
  const out = {};
  for (const [key, value] of Object.entries(receipt)) {
    if (value === undefined || value === null || typeof value === 'object') continue;
    const cleanKey = cleanToken(key);
    if (!cleanKey) continue;
    const cleanValue = cleanString(value, cleanKey === 'excerpt' ? 500 : 260);
    if (cleanValue) out[cleanKey] = cleanValue;
  }
  return Object.keys(out).length ? out : null;
}

function sourceReceiptList(...values) {
  const out = [];
  const seen = new Set();
  for (const receipt of values.flatMap(listValue)) {
    const normalized = normalizeSourceReceiptForPolicy(receipt);
    if (!normalized) continue;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= 20) break;
  }
  return out;
}

function firstClean(...values) {
  for (const value of values) {
    const text = cleanString(value, 220);
    if (text) return text;
  }
  return '';
}

function normalizeCorrectionItem(item = {}, role = 'item', hints = {}) {
  const source = isPlainObject(item) ? item : { text: item };
  const rawId = firstClean(
    source.id,
    source.memoryId,
    source.itemId,
    source.sourceId,
    source.candidateId,
    source.archiveId,
    source.refId,
    source.key,
  );
  const text = firstClean(
    source.text,
    source.memoryText,
    source.canonicalText,
    source.summary,
    source.content,
    source.body,
    source.value,
  );
  const object = firstClean(
    hints.object,
    source.object,
    source.value,
    source.currentObject,
    source.staleObject,
  );
  const subject = firstClean(hints.subject, source.subject, source.topic, source.conflictKey, source.topicKey);
  const fallbackKey = slugify([subject, object, text, role].filter(Boolean).join(' '), role);
  const id = firstClean(rawId, `memory:${role}:${fallbackKey}`);
  const supportState = normalizeSupportStateForPolicy(
    hints.supportState
      || source.supportState
      || source.sourceState
      || source.authority
      || source.support?.state
      || '',
  );

  return {
    id,
    text,
    object,
    subject,
    hasEndpointEvidence: !!(rawId || text || object),
    supportState,
    sourceReceipts: sourceReceiptList(
      source.sourceReceipts,
      source.sourceRefs,
      source.receipts,
      source.sources,
      source.support?.sourceReceipts,
    ),
  };
}

function buildHeldBackCorrectionLinkSet({
  generatedAt,
  measurementMode,
  reason,
  subject,
  stale,
  current,
  staleObject,
  currentObject,
  supportState,
  sourceReceipts,
} = {}) {
  const linkSet = normalizeMemoryLinkSet({
    generatedAt,
    measurementMode,
    links: [],
  }, { now: generatedAt });
  return {
    ...linkSet,
    schema: PENNY_MEMORY_LINKS_SCHEMA,
    builderSchema: PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
    behaviorChanged: false,
    scoringActive: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrite: false,
    heldBack: [{ index: 0, reason: cleanString(reason, 260) || 'missing correction endpoints' }],
    limits: CORRECTION_LINK_LIMITS,
    correctionTrace: {
      schema: PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
      generatedAt,
      subject: subject || '',
      staleObject: staleObject || '',
      currentObject: currentObject || '',
      staleItemId: stale?.id || '',
      currentItemId: current?.id || '',
      supportState: supportState || MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
      sourceReceiptCount: listValue(sourceReceipts).length,
      strongSupport: false,
      candidateOnlyVerifiedSupport: false,
      authorityEffectsApplied: [],
      scoringActive: false,
      behaviorChanged: false,
      heldBackReason: cleanString(reason, 260) || 'missing correction endpoints',
    },
  };
}

function normalizeStaleAuthorityEffect(value = '', strongSupport = false) {
  if (!strongSupport) return MEMORY_LINK_AUTHORITY_EFFECTS.NONE;
  const effect = cleanToken(value);
  if (effect === 'do-not-render' || effect === 'suppress' || effect === 'do-not-render-as-current') {
    return MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT;
  }
  return MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY;
}

function buildCorrectionLinkRawItems({
  current,
  stale,
  subject,
  staleObject,
  currentObject,
  supportState,
  sourceReceipts,
  strongSupport,
  correctionKey,
  generatedAt,
  staleAuthorityEffect,
  explanation,
}) {
  const support = {
    state: supportState,
    sourceReceipts,
    explanation,
  };
  const currentEffect = strongSupport
    ? MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST
    : MEMORY_LINK_AUTHORITY_EFFECTS.NONE;
  const staleEffect = normalizeStaleAuthorityEffect(staleAuthorityEffect, strongSupport);

  return [
    {
      id: `correction-${correctionKey}-current-for-stale`,
      sourceId: current.id,
      targetId: stale.id,
      relation: MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
      confidence: strongSupport ? 'high' : 'medium',
      support,
      authorityEffect: currentEffect,
      directionality: MEMORY_LINK_DIRECTIONALITY.DIRECTED,
      createdBy: MEMORY_LINK_CREATED_BY.DETERMINISTIC,
      createdAt: generatedAt,
    },
    {
      id: `correction-${correctionKey}-stale-prior`,
      sourceId: stale.id,
      targetId: current.id,
      relation: MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
      confidence: strongSupport ? 'high' : 'medium',
      support,
      authorityEffect: staleEffect,
      directionality: MEMORY_LINK_DIRECTIONALITY.DIRECTED,
      createdBy: MEMORY_LINK_CREATED_BY.DETERMINISTIC,
      createdAt: generatedAt,
    },
    {
      id: `correction-${correctionKey}-correction-of`,
      sourceId: current.id,
      targetId: stale.id,
      relation: MEMORY_LINK_RELATIONS.CORRECTION_OF,
      confidence: strongSupport ? 'high' : 'medium',
      support,
      authorityEffect: MEMORY_LINK_AUTHORITY_EFFECTS.NONE,
      directionality: MEMORY_LINK_DIRECTIONALITY.DIRECTED,
      createdBy: MEMORY_LINK_CREATED_BY.DETERMINISTIC,
      createdAt: generatedAt,
      subject,
      staleObject,
      currentObject,
    },
  ];
}

function buildCorrectionLinks(input = {}, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const generatedAt = normalizeIso(source.generatedAt || source.now || '', normalizeNowIso(options.now));
  const subjectHint = firstClean(source.subject, source.topic, source.conflictKey, source.topicKey);
  const stale = normalizeCorrectionItem(source.staleItem || source.stale || {}, 'stale', {
    subject: subjectHint,
    object: source.staleObject || source.oldObject || source.oldValue,
    supportState: source.supportState,
  });
  const current = normalizeCorrectionItem(source.currentItem || source.current || {}, 'current', {
    subject: subjectHint || stale.subject,
    object: source.currentObject || source.newObject || source.newValue,
    supportState: source.supportState,
  });
  const subject = firstClean(subjectHint, current.subject, stale.subject);
  const staleObject = firstClean(source.staleObject, source.oldObject, source.oldValue, stale.object, stale.text);
  const currentObject = firstClean(source.currentObject, source.newObject, source.newValue, current.object, current.text);
  const supportState = normalizeSupportStateForPolicy(
    source.supportState
      || source.support?.state
      || current.supportState
      || stale.supportState,
  );
  const sourceReceipts = sourceReceiptList(
    source.sourceReceipts,
    source.sourceRefs,
    source.receipts,
    source.support?.sourceReceipts,
    current.sourceReceipts,
    stale.sourceReceipts,
  );
  const strongSupport = STRONG_CORRECTION_SUPPORT_STATES.has(supportState);
  const correctionKey = slugify([subject, staleObject, currentObject].filter(Boolean).join(' '), 'correction');
  const explanation = cleanString(
    source.explanation
      || source.reason
      || `Deterministic correction link: ${subject || 'memory item'} changed from ${staleObject || 'stale value'} to ${currentObject || 'current value'}.`,
    500,
  );

  if (!stale.hasEndpointEvidence || !current.hasEndpointEvidence || !staleObject || !currentObject) {
    return buildHeldBackCorrectionLinkSet({
      generatedAt,
      measurementMode: source.measurementMode || source.mode || MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
      reason: 'missing stale/current correction endpoints',
      subject,
      stale,
      current,
      staleObject,
      currentObject,
      supportState,
      sourceReceipts,
    });
  }

  const rawLinks = buildCorrectionLinkRawItems({
    current,
    stale,
    subject,
    staleObject,
    currentObject,
    supportState,
    sourceReceipts,
    strongSupport,
    correctionKey,
    generatedAt,
    staleAuthorityEffect: source.staleAuthorityEffect || source.staleEffect || '',
    explanation,
  });

  const linkSet = normalizeMemoryLinkSet({
    generatedAt,
    measurementMode: source.measurementMode || source.mode || MEMORY_LINK_MEASUREMENT_MODES.FIXTURE,
    links: rawLinks,
  }, { now: generatedAt });
  const authorityEffectsApplied = [...new Set(linkSet.links.map((link) => link.authorityEffect))];

  return {
    ...linkSet,
    schema: PENNY_MEMORY_LINKS_SCHEMA,
    builderSchema: PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
    behaviorChanged: false,
    scoringActive: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    canonicalMemoryWrite: false,
    limits: CORRECTION_LINK_LIMITS,
    correctionTrace: {
      schema: PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
      generatedAt,
      subject,
      staleObject,
      currentObject,
      staleItemId: stale.id,
      currentItemId: current.id,
      supportState,
      sourceReceiptCount: sourceReceipts.length,
      strongSupport,
      candidateOnlyVerifiedSupport: false,
      authorityEffectsApplied,
      scoringActive: false,
      behaviorChanged: false,
    },
  };
}

module.exports = {
  PENNY_CORRECTION_LINK_BUILDER_SCHEMA,
  CORRECTION_LINK_LIMITS,
  STRONG_CORRECTION_SUPPORT_STATES,
  buildCorrectionLinks,
};
