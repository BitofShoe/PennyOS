const PENNY_MEMORY_LINKS_SCHEMA = 'penny-memory-links.v1';
const PENNY_MEMORY_LINK_TRACE_SCHEMA = 'penny-memory-link-trace.v1';

const MEMORY_LINK_RELATIONS = Object.freeze({
  CORRECTION_OF: 'correction-of',
  STALE_PRIOR_OF: 'stale-prior-of',
  CURRENT_CORRECTION_FOR: 'current-correction-for',
  SAME_PROJECT_THREAD: 'same-project-thread',
  FOLLOW_UP_TO: 'follow-up-to',
  IMPLEMENTS_PLAN: 'implements-plan',
  SOURCE_FOR: 'source-for',
  SUMMARY_OF: 'summary-of',
  CONTRADICTS: 'contradicts',
  SUPPORTS: 'supports',
  EVIDENCE_FOR: 'evidence-for',
  OPEN_LOOP_ABOUT: 'open-loop-about',
  USER_PREFERENCE_EVIDENCE: 'user-preference-evidence',
  RESEARCH_PATTERN_FOR: 'research-pattern-for',
  RELATED_BUT_WEAK: 'related-but-weak',
});

const MEMORY_LINK_SUPPORT_STATES = Object.freeze({
  EXPLICIT: 'explicit',
  RENDERED: 'rendered',
  ARCHIVE: 'archive',
  SEMANTIC_CANDIDATE: 'semantic-candidate',
  RESEARCH: 'research',
  UNKNOWN: 'unknown',
});

const MEMORY_LINK_AUTHORITY_EFFECTS = Object.freeze({
  NONE: 'none',
  RETRIEVAL_BOOST_ONLY: 'retrieval-boost-only',
  CURRENT_TRUTH_BOOST: 'current-truth-boost',
  STALE_CURRENT_PENALTY: 'stale-current-penalty',
  DO_NOT_RENDER_AS_CURRENT: 'do-not-render-as-current',
});

const MEMORY_LINK_DIRECTIONALITY = Object.freeze({
  DIRECTED: 'directed',
  BIDIRECTIONAL: 'bidirectional',
});

const MEMORY_LINK_CREATED_BY = Object.freeze({
  DETERMINISTIC: 'deterministic',
  REFLECTION: 'reflection',
  USER_APPROVED: 'user-approved',
  FIXTURE: 'fixture',
  MODEL_ASSISTED_REVIEW: 'model-assisted-review',
});

const MEMORY_LINK_REVIEW_STATES = Object.freeze({
  AUTO_SAFE: 'auto-safe',
  NEEDS_REVIEW: 'needs-review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
});

const MEMORY_LINK_MEASUREMENT_MODES = Object.freeze({
  FIXTURE: 'fixture',
  ARCHIVE_UNIT: 'archive-unit',
  LIVE_SHADOW: 'live-shadow',
  LIVE_ADVISORY: 'live-advisory',
});

const DEFAULT_MEMORY_LINK_LIMITS = Object.freeze([
  'Memory links are advisory retrieval/navigation hints.',
  'Links do not make advisory memory canonical.',
  'Correction links may affect ranking only through explicit policy gates.',
  'No graph database migration is implied.',
]);

const RELATION_VALUES = new Set(Object.values(MEMORY_LINK_RELATIONS));
const SUPPORT_STATE_VALUES = new Set(Object.values(MEMORY_LINK_SUPPORT_STATES));
const AUTHORITY_EFFECT_VALUES = new Set(Object.values(MEMORY_LINK_AUTHORITY_EFFECTS));
const DIRECTIONALITY_VALUES = new Set(Object.values(MEMORY_LINK_DIRECTIONALITY));
const CREATED_BY_VALUES = new Set(Object.values(MEMORY_LINK_CREATED_BY));
const REVIEW_STATE_VALUES = new Set(Object.values(MEMORY_LINK_REVIEW_STATES));
const MEASUREMENT_MODE_VALUES = new Set(Object.values(MEMORY_LINK_MEASUREMENT_MODES));
const AUTHORITY_AFFECTING_EFFECTS = new Set([
  MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
  MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY,
  MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT,
]);
const ADVISORY_ONLY_SUPPORT_STATES = new Set([
  MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
  MEMORY_LINK_SUPPORT_STATES.RENDERED,
  MEMORY_LINK_SUPPORT_STATES.RESEARCH,
  MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
  MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
]);
const RETRIEVAL_DEFAULT_RELATIONS = new Set([
  MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
  MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
  MEMORY_LINK_RELATIONS.IMPLEMENTS_PLAN,
  MEMORY_LINK_RELATIONS.SOURCE_FOR,
  MEMORY_LINK_RELATIONS.SUMMARY_OF,
  MEMORY_LINK_RELATIONS.SUPPORTS,
  MEMORY_LINK_RELATIONS.EVIDENCE_FOR,
  MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
  MEMORY_LINK_RELATIONS.USER_PREFERENCE_EVIDENCE,
  MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
  MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
]);
const INVERSE_RELATIONS = Object.freeze({
  [MEMORY_LINK_RELATIONS.CORRECTION_OF]: MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
  [MEMORY_LINK_RELATIONS.STALE_PRIOR_OF]: MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
  [MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR]: MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
});

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
  return cleanString(value, 180).toLowerCase().replace(/[_\s]+/g, '-');
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

function slugify(value = '', fallback = 'link') {
  const slug = cleanString(value, 240)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
  return slug || fallback;
}

function normalizeRelation(value = '') {
  const relation = cleanToken(value);
  const aliases = {
    correction: MEMORY_LINK_RELATIONS.CORRECTION_OF,
    corrects: MEMORY_LINK_RELATIONS.CORRECTION_OF,
    corrected: MEMORY_LINK_RELATIONS.CORRECTION_OF,
    stale: MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
    'stale-prior': MEMORY_LINK_RELATIONS.STALE_PRIOR_OF,
    current: MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
    'current-correction': MEMORY_LINK_RELATIONS.CURRENT_CORRECTION_FOR,
    project: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    thread: MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    'same-thread': MEMORY_LINK_RELATIONS.SAME_PROJECT_THREAD,
    followup: MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
    'followup-to': MEMORY_LINK_RELATIONS.FOLLOW_UP_TO,
    implementation: MEMORY_LINK_RELATIONS.IMPLEMENTS_PLAN,
    implements: MEMORY_LINK_RELATIONS.IMPLEMENTS_PLAN,
    source: MEMORY_LINK_RELATIONS.SOURCE_FOR,
    summary: MEMORY_LINK_RELATIONS.SUMMARY_OF,
    contradiction: MEMORY_LINK_RELATIONS.CONTRADICTS,
    support: MEMORY_LINK_RELATIONS.SUPPORTS,
    evidence: MEMORY_LINK_RELATIONS.EVIDENCE_FOR,
    openloop: MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
    'open-loop': MEMORY_LINK_RELATIONS.OPEN_LOOP_ABOUT,
    preference: MEMORY_LINK_RELATIONS.USER_PREFERENCE_EVIDENCE,
    'research-pattern': MEMORY_LINK_RELATIONS.RESEARCH_PATTERN_FOR,
    weak: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
    related: MEMORY_LINK_RELATIONS.RELATED_BUT_WEAK,
  };
  const normalized = aliases[relation] || relation;
  return RELATION_VALUES.has(normalized) ? normalized : '';
}

function normalizeSupportState(value = '') {
  const state = cleanToken(value);
  const aliases = {
    canonical: MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    explicit: MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'explicit-memory': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    'explicit-user': MEMORY_LINK_SUPPORT_STATES.EXPLICIT,
    prompt: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    'prompt-rendered': MEMORY_LINK_SUPPORT_STATES.RENDERED,
    'prompt-visible': MEMORY_LINK_SUPPORT_STATES.RENDERED,
    rendered: MEMORY_LINK_SUPPORT_STATES.RENDERED,
    archive: MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    'archive-candidate': MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    'archive-memory': MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    episode: MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    summary: MEMORY_LINK_SUPPORT_STATES.ARCHIVE,
    candidate: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    'candidate-only': MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    semantic: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    'semantic-candidate': MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    static: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    'static-candidate': MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    vector: MEMORY_LINK_SUPPORT_STATES.SEMANTIC_CANDIDATE,
    research: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    ledger: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    'research-ledger': MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    source: MEMORY_LINK_SUPPORT_STATES.RESEARCH,
    unknown: MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
    unsupported: MEMORY_LINK_SUPPORT_STATES.UNKNOWN,
  };
  const normalized = aliases[state] || state;
  return SUPPORT_STATE_VALUES.has(normalized) ? normalized : MEMORY_LINK_SUPPORT_STATES.UNKNOWN;
}

function normalizeConfidence(value = '') {
  const confidence = cleanToken(value);
  if (confidence === 'unclear' || confidence === 'none') return 'unknown';
  if (['low', 'medium', 'high', 'unknown'].includes(confidence)) return confidence;
  return 'medium';
}

function defaultAuthorityEffectForRelation(relation = '') {
  return RETRIEVAL_DEFAULT_RELATIONS.has(relation)
    ? MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY
    : MEMORY_LINK_AUTHORITY_EFFECTS.NONE;
}

function normalizeAuthorityEffect(value = '', relation = '', supportState = MEMORY_LINK_SUPPORT_STATES.UNKNOWN) {
  const effect = cleanToken(value);
  const aliases = {
    advisory: MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY,
    boost: MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY,
    'retrieval-only': MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY,
    retrieval: MEMORY_LINK_AUTHORITY_EFFECTS.RETRIEVAL_BOOST_ONLY,
    none: MEMORY_LINK_AUTHORITY_EFFECTS.NONE,
    no: MEMORY_LINK_AUTHORITY_EFFECTS.NONE,
    'truth-boost': MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
    current: MEMORY_LINK_AUTHORITY_EFFECTS.CURRENT_TRUTH_BOOST,
    penalty: MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY,
    stale: MEMORY_LINK_AUTHORITY_EFFECTS.STALE_CURRENT_PENALTY,
    'do-not-render': MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT,
    suppress: MEMORY_LINK_AUTHORITY_EFFECTS.DO_NOT_RENDER_AS_CURRENT,
  };
  const normalized = aliases[effect] || effect || defaultAuthorityEffectForRelation(relation);
  if (!AUTHORITY_EFFECT_VALUES.has(normalized)) return defaultAuthorityEffectForRelation(relation);
  if (
    AUTHORITY_AFFECTING_EFFECTS.has(normalized)
    && ADVISORY_ONLY_SUPPORT_STATES.has(supportState)
  ) {
    return relation ? defaultAuthorityEffectForRelation(relation) : MEMORY_LINK_AUTHORITY_EFFECTS.NONE;
  }
  return normalized;
}

function normalizeDirectionality(value = '') {
  const directionality = cleanToken(value);
  const aliases = {
    both: MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL,
    mutual: MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL,
    'two-way': MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL,
    undirected: MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL,
    one: MEMORY_LINK_DIRECTIONALITY.DIRECTED,
    'one-way': MEMORY_LINK_DIRECTIONALITY.DIRECTED,
    directional: MEMORY_LINK_DIRECTIONALITY.DIRECTED,
  };
  const normalized = aliases[directionality] || directionality;
  return DIRECTIONALITY_VALUES.has(normalized)
    ? normalized
    : MEMORY_LINK_DIRECTIONALITY.DIRECTED;
}

function normalizeCreatedBy(value = '') {
  const createdBy = cleanToken(value);
  const aliases = {
    deterministic: MEMORY_LINK_CREATED_BY.DETERMINISTIC,
    heuristic: MEMORY_LINK_CREATED_BY.DETERMINISTIC,
    reflection: MEMORY_LINK_CREATED_BY.REFLECTION,
    'session-reflection': MEMORY_LINK_CREATED_BY.REFLECTION,
    user: MEMORY_LINK_CREATED_BY.USER_APPROVED,
    approved: MEMORY_LINK_CREATED_BY.USER_APPROVED,
    fixture: MEMORY_LINK_CREATED_BY.FIXTURE,
    model: MEMORY_LINK_CREATED_BY.MODEL_ASSISTED_REVIEW,
    'model-assisted': MEMORY_LINK_CREATED_BY.MODEL_ASSISTED_REVIEW,
  };
  const normalized = aliases[createdBy] || createdBy;
  return CREATED_BY_VALUES.has(normalized) ? normalized : MEMORY_LINK_CREATED_BY.FIXTURE;
}

function normalizeReviewState(value = '', authorityEffect = MEMORY_LINK_AUTHORITY_EFFECTS.NONE) {
  const reviewState = cleanToken(value);
  const aliases = {
    safe: MEMORY_LINK_REVIEW_STATES.AUTO_SAFE,
    auto: MEMORY_LINK_REVIEW_STATES.AUTO_SAFE,
    pending: MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW,
    review: MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW,
    'needs-review': MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW,
    accepted: MEMORY_LINK_REVIEW_STATES.APPROVED,
    approved: MEMORY_LINK_REVIEW_STATES.APPROVED,
    rejected: MEMORY_LINK_REVIEW_STATES.REJECTED,
    denied: MEMORY_LINK_REVIEW_STATES.REJECTED,
  };
  const normalized = aliases[reviewState] || reviewState;
  if (REVIEW_STATE_VALUES.has(normalized)) return normalized;
  return AUTHORITY_AFFECTING_EFFECTS.has(authorityEffect)
    ? MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW
    : MEMORY_LINK_REVIEW_STATES.AUTO_SAFE;
}

function normalizeMeasurementMode(value = '') {
  const mode = cleanToken(value);
  return MEASUREMENT_MODE_VALUES.has(mode) ? mode : MEMORY_LINK_MEASUREMENT_MODES.FIXTURE;
}

function normalizeSourceReceipt(receipt = {}) {
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

function normalizeSupport(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const state = normalizeSupportState(
    source.state
      || source.supportState
      || source.sourceState
      || source.authority
      || '',
  );
  const sourceReceipts = listValue(source.sourceReceipts || source.sourceRefs || source.receipts || source.sources)
    .map(normalizeSourceReceipt)
    .filter(Boolean)
    .slice(0, 20);

  return {
    state,
    authority: 'advisory',
    sourceReceipts,
    explanation: cleanString(source.explanation || source.reason || source.summary || '', 500),
  };
}

function buildLinkId({ id = '', sourceId = '', targetId = '', relation = '' } = {}) {
  const cleanId = cleanString(id, 220);
  if (cleanId) return slugify(cleanId, 'link');
  return `link:${slugify(relation, 'relation')}:${slugify(sourceId, 'source')}->${slugify(targetId, 'target')}`;
}

function rawLinkList(input = {}) {
  if (Array.isArray(input)) return input;
  if (!isPlainObject(input)) return [];
  if (Array.isArray(input.links)) return input.links;
  if (Array.isArray(input.memoryLinks)) return input.memoryLinks;
  if (Array.isArray(input.items)) return input.items;
  return [];
}

function normalizeMemoryLink(input = {}, options = {}) {
  if (!isPlainObject(input)) return null;
  const sourceId = cleanString(input.sourceId || input.source || input.from || '', 220);
  const targetId = cleanString(input.targetId || input.target || input.to || '', 220);
  const relation = normalizeRelation(input.relation || input.type || input.kind || '');
  if (!sourceId || !targetId || !relation) return null;

  const support = normalizeSupport(input.support || {
    state: input.supportState || input.sourceState || input.supportAuthority,
    sourceReceipts: input.sourceReceipts || input.sourceRefs || input.receipts,
    explanation: input.supportReason || input.explanation || input.reason,
  });
  const authorityEffect = normalizeAuthorityEffect(
    input.authorityEffect || input.effect || '',
    relation,
    support.state,
  );
  const directionality = normalizeDirectionality(input.directionality || input.direction || '');
  const createdBy = normalizeCreatedBy(input.createdBy || input.creator || input.source || '');
  const reviewState = normalizeReviewState(input.reviewState || input.review || '', authorityEffect);
  const timestamp = normalizeNowIso(options.now);
  const createdAt = normalizeIso(input.createdAt || input.created_at || '', timestamp);
  const updatedAt = normalizeIso(input.updatedAt || input.updated_at || input.createdAt || '', createdAt);
  const expiresAt = normalizeIso(input.expiresAt || input.expires_at || '', null);

  return {
    id: buildLinkId({ id: input.id, sourceId, targetId, relation }),
    sourceId,
    targetId,
    relation,
    confidence: normalizeConfidence(input.confidence || input.scoreClass || ''),
    support,
    authorityEffect,
    directionality,
    createdAt,
    updatedAt,
    expiresAt,
    createdBy,
    reviewState,
    advisoryOnly: true,
    truthProof: false,
    canonicalMemoryWrite: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
  };
}

function summarizeMemoryLinks(links = []) {
  const normalizedLinks = rawLinkList(links).length
    ? rawLinkList(links).map((link) => normalizeMemoryLink(link)).filter(Boolean)
    : listValue(links).map((link) => normalizeMemoryLink(link)).filter(Boolean);
  const byRelation = {};
  const byAuthorityEffect = {};
  const bySupportState = {};
  let needsReview = 0;
  let authorityAffectingLinks = 0;
  let directedCount = 0;
  let bidirectionalCount = 0;

  for (const link of normalizedLinks) {
    byRelation[link.relation] = (byRelation[link.relation] || 0) + 1;
    byAuthorityEffect[link.authorityEffect] = (byAuthorityEffect[link.authorityEffect] || 0) + 1;
    bySupportState[link.support.state] = (bySupportState[link.support.state] || 0) + 1;
    if (link.reviewState === MEMORY_LINK_REVIEW_STATES.NEEDS_REVIEW) needsReview += 1;
    if (AUTHORITY_AFFECTING_EFFECTS.has(link.authorityEffect)) authorityAffectingLinks += 1;
    if (link.directionality === MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL) bidirectionalCount += 1;
    else directedCount += 1;
  }

  return {
    totalLinks: normalizedLinks.length,
    byRelation,
    byAuthorityEffect,
    bySupportState,
    needsReview,
    authorityAffectingLinks,
    directedCount,
    bidirectionalCount,
  };
}

function normalizeMemoryLinkSet(input = {}, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const generatedAt = normalizeIso(source.generatedAt || '', normalizeNowIso(options.now));
  const links = [];
  const heldBack = [];
  const rawLinks = rawLinkList(input);

  rawLinks.forEach((rawLink, index) => {
    const validation = validateMemoryLink(rawLink, { now: generatedAt });
    if (validation.valid) {
      links.push(validation.link);
    } else {
      heldBack.push({
        index,
        reason: validation.errors.join('; '),
      });
    }
  });

  return {
    schema: PENNY_MEMORY_LINKS_SCHEMA,
    generatedAt,
    measurementMode: normalizeMeasurementMode(source.measurementMode || source.mode || ''),
    behaviorChanged: false,
    links,
    heldBack,
    summary: summarizeMemoryLinks(links),
    limits: [...DEFAULT_MEMORY_LINK_LIMITS],
  };
}

function linkMatchesDirection(link, itemId, direction = 'either', includeBidirectional = true) {
  if (!link || !itemId) return false;
  const sourceMatch = link.sourceId === itemId;
  const targetMatch = link.targetId === itemId;
  if (direction === 'outgoing') {
    return sourceMatch || (includeBidirectional && link.directionality === MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL && targetMatch);
  }
  if (direction === 'incoming') {
    return targetMatch || (includeBidirectional && link.directionality === MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL && sourceMatch);
  }
  return sourceMatch || targetMatch;
}

function findLinksForItem(links = [], itemId = '', options = {}) {
  const normalizedItemId = cleanString(itemId, 220);
  if (!normalizedItemId) return [];
  const direction = cleanToken(options.direction || 'either');
  const includeBidirectional = options.includeBidirectional !== false;
  const relation = options.relation ? normalizeRelation(options.relation) : '';
  const authorityEffect = options.authorityEffect ? normalizeAuthorityEffect(options.authorityEffect) : '';
  const sourceLinks = rawLinkList(links).length ? rawLinkList(links) : listValue(links);

  return sourceLinks
    .map((link) => normalizeMemoryLink(link))
    .filter(Boolean)
    .filter((link) => linkMatchesDirection(
      link,
      normalizedItemId,
      ['incoming', 'outgoing'].includes(direction) ? direction : 'either',
      includeBidirectional,
    ))
    .filter((link) => !relation || link.relation === relation)
    .filter((link) => !authorityEffect || link.authorityEffect === authorityEffect);
}

function normalizeMemoryLinkTraceLimit(value = 6) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 6;
  return Math.max(0, Math.min(24, Math.floor(parsed)));
}

function relationSummaryKey(relation = '') {
  const normalized = normalizeRelation(relation) || cleanToken(relation);
  return normalized.replace(/-([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function compactMemoryLinkTraceObject(input = {}) {
  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      if (value.length) output[key] = value;
      continue;
    }
    if (isPlainObject(value)) {
      if (Object.keys(value).length) output[key] = value;
      continue;
    }
    if (value !== undefined && value !== null && value !== '') output[key] = value;
  }
  return output;
}

function normalizeMemoryLinkTraceLink(linkLike = {}, direction = '') {
  const link = normalizeMemoryLink(linkLike);
  if (!link) return null;
  return compactMemoryLinkTraceObject({
    id: link.id,
    sourceId: link.sourceId,
    targetId: link.targetId,
    relation: link.relation,
    direction: cleanToken(direction),
    confidence: link.confidence,
    supportState: link.support.state,
    authorityEffect: link.authorityEffect,
    reviewState: link.reviewState,
    advisoryOnly: true,
    truthProof: false,
    canonicalMemoryWrite: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
  });
}

function buildMemoryLinkTraceForItem(links = [], itemId = '', options = {}) {
  const normalizedItemId = cleanString(itemId, 220);
  const linkTraceLimit = normalizeMemoryLinkTraceLimit(options.linkTraceLimit ?? options.limit ?? 6);
  if (!normalizedItemId || linkTraceLimit <= 0) return null;

  const incomingSource = findLinksForItem(links, normalizedItemId, {
    direction: 'incoming',
    includeBidirectional: options.includeBidirectional,
  }).map((link) => normalizeMemoryLinkTraceLink(link, 'incoming')).filter(Boolean);
  const outgoingSource = findLinksForItem(links, normalizedItemId, {
    direction: 'outgoing',
    includeBidirectional: options.includeBidirectional,
  }).map((link) => normalizeMemoryLinkTraceLink(link, 'outgoing')).filter(Boolean);

  const incoming = [];
  const outgoing = [];
  const uniqueLinks = new Map();
  let remaining = linkTraceLimit;
  const takeLink = (link, bucket) => {
    if (!link || remaining <= 0) return;
    bucket.push(link);
    remaining -= 1;
    if (!uniqueLinks.has(link.id)) uniqueLinks.set(link.id, link);
  };

  for (const link of incomingSource) takeLink(link, incoming);
  for (const link of outgoingSource) takeLink(link, outgoing);
  if (!incoming.length && !outgoing.length) return null;

  const relationSummary = {};
  const authorityEffects = new Set();
  for (const link of uniqueLinks.values()) {
    const summaryKey = relationSummaryKey(link.relation);
    if (summaryKey) relationSummary[summaryKey] = (relationSummary[summaryKey] || 0) + 1;
    if (link.authorityEffect) authorityEffects.add(link.authorityEffect);
  }

  return {
    schema: PENNY_MEMORY_LINK_TRACE_SCHEMA,
    advisoryOnly: true,
    truthProof: false,
    scoringActive: false,
    behaviorChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
    linkTraceLimit,
    totalLinks: uniqueLinks.size,
    incoming,
    outgoing,
    relationSummary,
    authorityEffects: [...authorityEffects],
  };
}

function invertDirectedLink(link = {}) {
  const normalized = normalizeMemoryLink(link);
  if (!normalized) return null;
  if (normalized.directionality === MEMORY_LINK_DIRECTIONALITY.BIDIRECTIONAL) return { ...normalized };
  const relation = INVERSE_RELATIONS[normalized.relation] || normalized.relation;
  return {
    ...normalized,
    id: `${normalized.id}:inverse`,
    sourceId: normalized.targetId,
    targetId: normalized.sourceId,
    relation,
    invertedFrom: normalized.id,
  };
}

function validateMemoryLink(link = {}, options = {}) {
  const errors = [];
  if (!isPlainObject(link)) {
    return {
      valid: false,
      errors: ['link must be an object'],
      warnings: [],
      link: null,
    };
  }
  if (!cleanString(link.sourceId || link.source || link.from || '', 220)) errors.push('missing sourceId');
  if (!cleanString(link.targetId || link.target || link.to || '', 220)) errors.push('missing targetId');
  if (!normalizeRelation(link.relation || link.type || link.kind || '')) errors.push('invalid relation');
  const normalized = errors.length ? null : normalizeMemoryLink(link, options);
  if (!normalized) {
    if (!errors.length) errors.push('invalid memory link');
    return {
      valid: false,
      errors,
      warnings: [],
      link: null,
    };
  }
  const warnings = [];
  if (
    AUTHORITY_AFFECTING_EFFECTS.has(cleanToken(link.authorityEffect || link.effect || ''))
    && !AUTHORITY_AFFECTING_EFFECTS.has(normalized.authorityEffect)
  ) {
    warnings.push('authority effect was downgraded for advisory-only support');
  }
  return {
    valid: true,
    errors: [],
    warnings,
    link: normalized,
  };
}

module.exports = {
  PENNY_MEMORY_LINKS_SCHEMA,
  PENNY_MEMORY_LINK_TRACE_SCHEMA,
  MEMORY_LINK_RELATIONS,
  MEMORY_LINK_SUPPORT_STATES,
  MEMORY_LINK_AUTHORITY_EFFECTS,
  MEMORY_LINK_DIRECTIONALITY,
  MEMORY_LINK_CREATED_BY,
  MEMORY_LINK_REVIEW_STATES,
  MEMORY_LINK_MEASUREMENT_MODES,
  DEFAULT_MEMORY_LINK_LIMITS,
  buildMemoryLinkTraceForItem,
  findLinksForItem,
  invertDirectedLink,
  normalizeMemoryLink,
  normalizeMemoryLinkSet,
  summarizeMemoryLinks,
  validateMemoryLink,
};
