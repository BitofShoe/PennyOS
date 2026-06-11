const crypto = require('crypto');
const { writeJsonFileAtomicSync } = require('./penny-atomic-json');

const {
  normalizeText,
  selectMemoriesForPrompt,
  tokenizeMemoryText,
} = require('./penny-memory');
const {
  normalizePromptTruth,
  normalizePromptTruthRenderedClaims,
  PROMPT_TRUTH_AUDIT_LIMITS,
  preferRenderedCompatibilityBoolean,
} = require('./penny-prompttruth');
const {
  ARCHIVE_SCORING_PROFILES,
  RERANK_SHADOW_MEASUREMENT_MODES,
  RERANK_SHADOW_PROVIDERS,
  MEMORY_LINK_SCORING_MODES,
  createMemoryArchivePolicyApi,
  normalizeArchiveScoringProfile,
  normalizeMemoryLinkScoringMode,
  normalizeRerankShadowProvider,
} = require('./penny-memory-archive-policy');
const {
  normalizeConsolidationPacket,
  normalizeProbationState,
  normalizePromotionPacket,
  validatePromotionPacket,
} = require('./penny-knowledge-contracts');
const {
  FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS,
  FRAME_BUDGET_SIDECAR_SPEND_CLASSES,
  FRAME_BUDGET_SIDECAR_STATUSES,
  buildCandidateMergeFrameBudgetPlan,
  buildFrameBudgetSidecarReceipt,
} = require('./penny-frame-budget');
const {
  MEMORY_LINK_MEASUREMENT_MODES,
  buildMemoryLinkTraceForItem,
  normalizeMemoryLinkSet,
} = require('./penny-memory-links');
const {
  buildCorrectionLinks,
} = require('./penny-memory-link-policy');

const ARCHIVE_SCHEMA_VERSION = 2;
const EMBEDDINGS_SCHEMA_VERSION = 1;
const EXPLICIT_PROMPT_LIMIT = 6;
const SESSION_PROMPT_LIMIT = 2;
const GLOBAL_PROMPT_LIMIT = 2;
const SESSION_CHAPTER_LIMIT = 6;
const SESSION_RECENCY_PROTECTED_EPISODES = 6;
const SESSION_RECENT_AUDIT_TRAIL_LIMIT = 8;
// Let chapter fallback come online sooner so keyword-only sessions
// can still preserve concrete anchors before the conversation gets huge.
const SESSION_CHAPTER_TRIGGER_COUNT = 7;
const SESSION_PROVENANCE_LIMIT = 16;
const SESSION_ACTIVE_CONTRADICTION_LIMIT = 12;
const EMBEDDING_STATUS_CACHE_MS = 15000;
const EMBEDDING_ERROR_CACHE_MS = 60000;
const SENSITIVE_RETRIEVAL_THRESHOLD = 5.5;
const DEFAULT_CANDIDATE_TRACE_LIMIT = 24;
const DEFAULT_CANDIDATE_LINK_TRACE_LIMIT = 6;
const COMPRESSION_RETRIEVAL_CONFIDENCE = 0.48;
const GLOBAL_THEME_MIN_EVIDENCE = 3;

/**
 * @typedef {'semantic_query' | 'keyword_fallback'} ArchiveRetrievalReasonCode
 *
 * @typedef {'compression_not_needed' | 'compression_semantic_unavailable' | 'compression_low_retrieval_confidence'} ArchiveCompressionReasonCode
 *
 * @typedef {Object} ArchiveRetrievalDecision
 * @property {string} usedAt
 * @property {'semantic' | 'keyword'} mode
 * @property {ArchiveRetrievalReasonCode} reasonCode
 * @property {string} embedModel
 * @property {boolean} semanticReady
 * @property {boolean} semanticAttempted
 * @property {boolean} semanticDowngrade
 * @property {string} semanticDowngradeReason
 * @property {Array<Object>} session
 * @property {Array<Object>} global
 * @property {Object} compression
 *
 * @typedef {Object} ArchiveCompressionDecision
 * @property {boolean} used
 * @property {ArchiveCompressionReasonCode} reasonCode
 * @property {string} reason
 * @property {Array<Object>} chapters
 */
const ARCHIVE_RETRIEVAL_REASON_CODES = Object.freeze({
  SEMANTIC_QUERY: 'semantic_query',
  KEYWORD_FALLBACK: 'keyword_fallback',
});

const ARCHIVE_COMPRESSION_REASON_CODES = Object.freeze({
  NOT_NEEDED: 'compression_not_needed',
  SEMANTIC_UNAVAILABLE: 'compression_semantic_unavailable',
  LOW_RETRIEVAL_CONFIDENCE: 'compression_low_retrieval_confidence',
});

function normalizeCompressionReasonCode(value = '') {
  const text = String(value || '').trim();
  if (!text) return ARCHIVE_COMPRESSION_REASON_CODES.NOT_NEEDED;
  if (text === ARCHIVE_COMPRESSION_REASON_CODES.NOT_NEEDED || text === 'not-needed') {
    return ARCHIVE_COMPRESSION_REASON_CODES.NOT_NEEDED;
  }
  if (text === ARCHIVE_COMPRESSION_REASON_CODES.SEMANTIC_UNAVAILABLE || text === 'semantic-unavailable') {
    return ARCHIVE_COMPRESSION_REASON_CODES.SEMANTIC_UNAVAILABLE;
  }
  if (text === ARCHIVE_COMPRESSION_REASON_CODES.LOW_RETRIEVAL_CONFIDENCE || text === 'low-retrieval-confidence') {
    return ARCHIVE_COMPRESSION_REASON_CODES.LOW_RETRIEVAL_CONFIDENCE;
  }
  return text;
}

function normalizeConflictKey(value = '') {
  return trimText(value || '', 100).toLowerCase();
}

const PHRASE_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'and', 'been', 'being', 'came', 'come', 'dont', 'from', 'have',
  'into', 'just', 'know', 'like', 'maybe', 'more', 'really', 'said', 'some', 'that', 'their', 'them',
  'then', 'there', 'they', 'this', 'very', 'want', 'with', 'would', 'your', 'youre', 'were', 'when',
  'what', 'while', 'where', 'which', 'because', 'than', 'over', 'under', 'still', 'keep', 'keeps',
  'thing', 'things', 'make', 'makes', 'made', 'feel', 'feels', 'feeling', 'im', "i'm", 'ive', "i've",
  'okay', 'ok', 'yeah', 'honestly', 'actually', 'literally', 'little', 'high', 'low', 'good', 'nice',
  'bro', 'girl', 'girly', 'brat', 'saying', 'sayin',
]);

const SENSITIVE_PATTERNS = [
  /\b(fuck|fucking|horny|orgasm|cum|cock|pussy|dick|throat|spank|dom|sub|breed|wet|naked)\b/i,
  /\b(suicidal|self harm|self-harm|kill myself|cutting|panic attack|trauma)\b/i,
  /\b(crying all night|i feel broken|i hate myself|i want to disappear)\b/i,
];

const CHAPTER_SCAFFOLDING_PATTERNS = [
  /\b(keep your reply|one sentence|quick check|long-memory|long memory|tiny format request|what do i keep|what sits|what was sitting|tell me about|remember this exactly)\b/i,
  /\b(reply to the latest|format request|memory check|fallback check|check:)\b/i,
  /\?$/,
];

const CHAPTER_DETAIL_BONUS_PATTERNS = [
  /\b(red|blue|green|orange|silver|gold|black|white|purple|pink|yellow|brown|gray|grey|neon|mint|coral|sunflower)\b/i,
  /\b\d+\b/,
  /\b(smell|smelled|smells|hummed|rattled|taped|balanced|dropped|tucked|flickering|blinking|curtain|hook|mug|glove|thermos|bandana|sticker|sock|basket|fan|dryer|laundromat|arcade|ticket|envelope|detergent|token|booth|counter|register)\b/i,
];

function createId(prefix = 'mem') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
}

function stableHash(value = '') {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function trimIso(value = '', fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function trimText(value = '', limit = 1600) {
  return normalizeText(String(value || '')).slice(0, limit);
}

function normalizeEmbedModelId(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/nomic-embed-text-v1\.5/i.test(text)) return 'text-embedding-nomic-embed-text-v1.5';
  if (/^(?:google\/)?embedding[-_]?gemma[-_]?300m$/i.test(text)) return 'google/embedding-gemma-300m';
  return text;
}

function classifySensitivity(text = '') {
  const raw = String(text || '');
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(raw)) ? 'high' : 'normal';
}

function extractPhrases(text = '', limit = 24) {
  const tokens = tokenizeMemoryText(text).filter((token) => !PHRASE_STOPWORDS.has(token));
  const phrases = new Set();
  for (let i = 0; i < tokens.length; i += 1) {
    const first = tokens[i];
    if (first) phrases.add(first);
    const second = tokens[i + 1];
    if (first && second) phrases.add(`${first} ${second}`);
    const third = tokens[i + 2];
    if (first && second && third) phrases.add(`${first} ${second} ${third}`);
    if (phrases.size >= limit) break;
  }
  return [...phrases];
}

function isArchivePhraseInformativeToken(token = '') {
  const value = String(token || '').trim().toLowerCase();
  if (!value || PHRASE_STOPWORDS.has(value)) return false;
  if (!/[a-z]/.test(value)) return false;
  if (value.length >= 4) return true;
  return CHAPTER_DETAIL_BONUS_PATTERNS.some((pattern) => pattern.test(value));
}

function shouldKeepArchivePhrase(phrase = '', evidenceCount = 0) {
  const words = String(phrase || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const informativeWords = words.filter(isArchivePhraseInformativeToken);
  if (!informativeWords.length) return false;
  if (words.length === 1) {
    if (evidenceCount < GLOBAL_THEME_MIN_EVIDENCE) return false;
    return isArchivePhraseInformativeToken(words[0]);
  }
  if (words.length === 2 && informativeWords.length < 2 && evidenceCount < GLOBAL_THEME_MIN_EVIDENCE) {
    return false;
  }
  return true;
}

function countPhrases(texts = [], minEvidence = 3) {
  const counts = new Map();
  for (const text of texts) {
    for (const phrase of extractPhrases(text)) {
      const current = counts.get(phrase) || 0;
      counts.set(phrase, current + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minEvidence)
    .filter(([phrase, count]) => shouldKeepArchivePhrase(phrase, count))
    .sort((left, right) => right[1] - left[1]
      || (right[0].split(' ').length - left[0].split(' ').length)
      || left[0].localeCompare(right[0]));
}

function buildDefaultBackgroundVectorizationStatus(batchLimit = 0, enabled = false) {
  return {
    enabled,
    status: enabled ? 'skipped' : 'disabled',
    sourceSessionId: '',
    semanticReady: false,
    archivePending: false,
    attemptedAt: '',
    skippedReason: '',
    eagerEmbeddingCount: 0,
    eagerCreatedCount: 0,
    batchLimit: Math.max(0, Number(batchLimit || 0)),
    backgroundCandidateCount: 0,
    backgroundCreatedCount: 0,
    selectedCount: 0,
    createdCount: 0,
    candidates: [],
  };
}

function buildArchiveStore(embedModel = '', {
  backgroundVectorsEnabled = false,
  backgroundVectorBatchLimit = 0,
} = {}) {
  return {
    meta: {
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      embedModel: String(embedModel || '').trim(),
      lastCompactedAt: '',
      lastSummarizedAt: '',
      reviewDecisions: {},
      backgroundVectorization: buildDefaultBackgroundVectorizationStatus(backgroundVectorBatchLimit, backgroundVectorsEnabled),
    },
    global: {
      episodes: [],
      summaries: [],
      patterns: [],
      promotionQueue: [],
    },
    sessions: {},
  };
}

function buildEmbeddingsStore(embedModel = '', {
  backgroundVectorsEnabled = false,
  backgroundVectorBatchLimit = 0,
} = {}) {
  return {
    meta: {
      schemaVersion: EMBEDDINGS_SCHEMA_VERSION,
      embedModel: String(embedModel || '').trim(),
      updatedAt: '',
      backgroundVectorization: buildDefaultBackgroundVectorizationStatus(backgroundVectorBatchLimit, backgroundVectorsEnabled),
    },
    items: {},
  };
}

function cosineSimilarity(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let i = 0; i < left.length; i += 1) {
    const a = Number(left[i] || 0);
    const b = Number(right[i] || 0);
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function createMemoryArchiveApi({
  fs,
  path,
  fetch,
  ARCHIVE_FILE = '',
  EMBEDDINGS_FILE = '',
  LMSTUDIO_BASE = '',
  PENNY_LMSTUDIO_EMBED_BASE = '',
  LMSTUDIO_API_KEY = 'lm-studio-local',
  PENNY_LMSTUDIO_EMBED_MODEL = '',
  PENNY_ARCHIVE_SCORING_PROFILE = ARCHIVE_SCORING_PROFILES.BASELINE,
  PENNY_MEMORY_LINK_SCORING = process.env.PENNY_MEMORY_LINK_SCORING || MEMORY_LINK_SCORING_MODES.SHADOW,
  PENNY_RERANK_SHADOW_PROVIDER = '',
  ENABLE_BACKGROUND_CHAT_VECTORS = true,
  BACKGROUND_CHAT_VECTOR_BATCH_LIMIT = 2,
  getLmStudioConnectionStatus = null,
  modelsLookEquivalent = null,
  nowMs = () => Date.now(),
} = {}) {
  if (!fs
    || typeof fs.existsSync !== 'function'
    || typeof fs.readFileSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function'
    || typeof fs.mkdirSync !== 'function') {
    throw new TypeError('createMemoryArchiveApi requires fs');
  }
  if (!path || typeof path.dirname !== 'function') throw new TypeError('createMemoryArchiveApi requires path');
  if (typeof fetch !== 'function') throw new TypeError('createMemoryArchiveApi requires fetch');

  let configuredEmbedModel = normalizeEmbedModelId(PENNY_LMSTUDIO_EMBED_MODEL);
  const embeddingBase = String(PENNY_LMSTUDIO_EMBED_BASE || LMSTUDIO_BASE || '').replace(/\/$/, '');
  const hasDedicatedEmbeddingBase = Boolean(String(PENNY_LMSTUDIO_EMBED_BASE || '').trim());
  const archiveScoringProfile = normalizeArchiveScoringProfile(PENNY_ARCHIVE_SCORING_PROFILE);
  const configuredMemoryLinkScoring = normalizeMemoryLinkScoringMode(PENNY_MEMORY_LINK_SCORING);
  const configuredRerankShadowProvider = normalizeRerankShadowProvider(PENNY_RERANK_SHADOW_PROVIDER);
  const backgroundChatVectorsEnabled = ENABLE_BACKGROUND_CHAT_VECTORS === true;
  const backgroundChatVectorBatchLimit = Math.max(0, Number(BACKGROUND_CHAT_VECTOR_BATCH_LIMIT || 2));
  const modelComparator = typeof modelsLookEquivalent === 'function'
    ? modelsLookEquivalent
    : ((left = '', right = '') => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase());

  let embedStatusCache = { expiresAt: 0, value: null };

  function embeddingModelsLookEquivalent(left = '', right = '') {
    const normalizedLeft = normalizeEmbedModelId(left);
    const normalizedRight = normalizeEmbedModelId(right);
    if (!normalizedLeft || !normalizedRight) return false;
    return modelComparator(normalizedLeft, normalizedRight)
      || normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
  }

  function setConfiguredEmbedModel(model = '') {
    configuredEmbedModel = normalizeEmbedModelId(model);
    embedStatusCache = { expiresAt: 0, value: null };
    if (EMBEDDINGS_FILE) {
      try {
        writeEmbeddingsStore(readEmbeddingsStore(), { replace: true });
      } catch {}
    }
    return configuredEmbedModel;
  }

  function embeddingItemMatchesConfiguredModel(raw = {}, fallbackModel = configuredEmbedModel) {
    const targetModel = normalizeEmbedModelId(fallbackModel || '');
    if (!targetModel) return true;
    const itemModel = normalizeEmbedModelId(raw?.model || '');
    if (!itemModel) return true;
    return embeddingModelsLookEquivalent(itemModel, targetModel);
  }

  function embeddingCacheKeyForText(text = '', model = configuredEmbedModel) {
    const normalizedText = trimText(text, 1000);
    const normalizedModel = normalizeEmbedModelId(model || configuredEmbedModel || '');
    return stableHash(`${normalizedModel || 'unknown-embedding-model'}\n${normalizedText}`);
  }

  function legacyEmbeddingCacheKeyForText(text = '') {
    return stableHash(trimText(text, 1000));
  }

  function findEmbeddingCacheEntry(store = {}, text = '', model = configuredEmbedModel) {
    const hash = embeddingCacheKeyForText(text, model);
    const legacyHash = legacyEmbeddingCacheKeyForText(text);
    const direct = store?.items?.[hash];
    if (direct?.vector?.length && embeddingItemMatchesConfiguredModel(direct, model)) {
      return { item: direct, hash, legacyHash, migrated: false };
    }
    const legacy = legacyHash !== hash ? store?.items?.[legacyHash] : null;
    if (legacy?.vector?.length && embeddingItemMatchesConfiguredModel(legacy, model)) {
      return { item: legacy, hash, legacyHash, migrated: true };
    }
    return { item: null, hash, legacyHash, migrated: false };
  }

  function ensureFile(filePath = '', builder = () => ({})) {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) return;
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath,
      value: builder(),
    });
  }

  function buildSessionBucket(sessionId = 'default') {
    return {
      sessionId,
      episodes: [],
      summaries: [],
      chapters: [],
      provenance: [],
      activeContradictions: [],
      openLoops: [],
      recentAuditTrail: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
    };
  }

  function buildRecencyProtection(session = {}) {
    const recentEpisodes = Array.isArray(session?.episodes)
      ? session.episodes.slice(-SESSION_RECENCY_PROTECTED_EPISODES)
      : [];
    return {
      enabled: true,
      protectedEpisodeCount: recentEpisodes.length,
      protectedEpisodeIds: recentEpisodes.map((item) => String(item?.id || '').trim()).filter(Boolean),
    };
  }

  function normalizeEvidenceIds(values = []) {
    if (!Array.isArray(values)) return [];
    const out = [];
    const seen = new Set();
    for (const value of values) {
      const id = String(value || '').trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function inferArchiveFreshnessLabel(type = 'episode', reviewStatus = '') {
    if (type === 'episode') return 'recent';
    if (type === 'promotion') return reviewStatus === 'approved' ? 'archived' : 'current';
    if (type === 'summary' || type === 'pattern' || type === 'chapter') return 'rolling';
    return 'archived';
  }

  function inferArchiveSourceScope(type = 'episode', sessionId = '') {
    if (type === 'promotion') return 'promotion-review';
    if (type === 'chapter') return 'chapter';
    if (type === 'pattern' || type === 'summary') return sessionId ? 'session' : 'global';
    return sessionId ? 'session' : 'global';
  }

  function buildDiscardedDetailSummary(raw = {}, explanation = {}) {
    const discarded = [
      ...(Array.isArray(raw.discardedDetailSummary) ? raw.discardedDetailSummary : []),
      ...(Array.isArray(raw.penalties) ? raw.penalties : []),
      ...(Array.isArray(explanation.penalties) ? explanation.penalties : []),
    ].map((value) => trimText(value, 120)).filter(Boolean);
    const omittedEpisodeCount = Math.max(0, Number(
      raw.omittedEpisodeCount
      ?? explanation.omittedEpisodeCount
      ?? 0,
    ));
    if (omittedEpisodeCount > 0) {
      discarded.push(`${omittedEpisodeCount} episode detail(s) omitted`);
    }
    return discarded;
  }

  function normalizeArchiveProbation(raw = {}, {
    type = 'episode',
    reviewStatus = '',
    reviewedAt = '',
  } = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    if (
      type !== 'promotion'
      && !source.probation
      && !source.reviewStatus
      && !reviewStatus
      && !source.reviewedAt
      && !reviewedAt
    ) {
      return null;
    }
    return normalizeProbationState(source.probation || source, {
      reviewStatus: reviewStatus || source.reviewStatus || (type === 'promotion' ? 'pending' : ''),
      reviewedAt: reviewedAt || source.reviewedAt || '',
      reviewerDecision: source.reviewerDecision || '',
      canonical: source.reviewStatus === 'approved',
      scope: type === 'promotion' ? 'promotion-review' : 'archive-advisory',
    });
  }

  function normalizeArchiveConsolidation(raw = {}, {
    type = 'episode',
    sessionId = '',
    createdAt = '',
    updatedAt = '',
    sourceEpisodeIds = [],
    sourceTurnIds = [],
    lossy = false,
  } = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const explanation = source.explanation && typeof source.explanation === 'object'
      ? source.explanation
      : (source.compression?.explanation && typeof source.compression.explanation === 'object'
        ? source.compression.explanation
        : {});
    return normalizeConsolidationPacket(source.consolidation || source.mergeProvenance || source, {
      lossy,
      mergeKind: source.mergeKind
        || (lossy ? `${type}-consolidation` : `${type}-carryover`),
      mergeReason: source.mergeReason || source.reason || source.reasonCode || '',
      mergeBasis: source.mergeBasis || source.selectedSignals || explanation.selectedSignals || [],
      discardedDetailSummary: buildDiscardedDetailSummary(source, explanation),
      sourceScope: inferArchiveSourceScope(type, sessionId),
      sourceSessionIds: source.sourceSessionIds || (sessionId ? [sessionId] : []),
      sourceTurnIds: source.sourceTurnIds || source.turnIds || source.evidenceTurnIds || sourceTurnIds || [],
      sourceEpisodeIds: source.sourceEpisodeIds || source.evidenceIds || sourceEpisodeIds || [],
      observedAt: source.observedAt || createdAt || '',
      lastTouchedAt: source.lastTouchedAt || updatedAt || createdAt || '',
      freshnessLabel: source.freshnessLabel || inferArchiveFreshnessLabel(type, source.reviewStatus || ''),
      reviewStatus: source.reviewStatus || '',
      probationary: source.reviewStatus === 'pending',
    });
  }

  function normalizeArchiveEntry(raw = {}, type = 'episode', sessionId = '') {
    const createdAt = trimIso(raw.createdAt || raw.updatedAt, new Date().toISOString());
    const text = trimText(raw.text || raw.userText || raw.excerpt || '');
    if (!text) return null;
    const promotionPacket = raw?.promotionPacket
      ? normalizePromotionPacket(raw.promotionPacket)
      : (type === 'promotion'
        ? normalizePromotionPacket({
            id: raw.id,
            kind: raw.originKind || raw.kind || 'observation',
            proposedMemoryText: raw.text || raw.excerpt || '',
            sourceType: raw.sourceType || type,
            originSource: raw.originSource || '',
            sourceThreadId: raw.sessionId || '',
            sourceTurnIds: raw.evidenceIds || [],
            archiveExcerpt: raw.excerpt || raw.evidenceSnippet || raw.text || '',
            evidenceSnippet: raw.evidenceSnippet || raw.excerpt || raw.text || '',
            temporalScope: raw.temporalScope || {},
            reviewStatus: raw.reviewStatus || 'pending',
            reviewerDecision: raw.reviewerDecision || '',
            createdAt,
            reviewedAt: raw.reviewedAt || '',
          })
        : null);
    const sourceTurnIds = normalizeEvidenceIds(
      raw.sourceTurnIds
      || raw.turnIds
      || raw.evidenceTurnIds
      || raw.promotionPacket?.sourceTurnIds
      || [],
    );
    const sourceEpisodeIds = normalizeEvidenceIds(
      raw.sourceEpisodeIds
      || raw.evidenceIds
      || raw.promotionPacket?.consolidation?.sourceEpisodeIds
      || [],
    );
    const reviewStatus = trimText(raw.reviewStatus || promotionPacket?.reviewStatus || '', 40);
    const reviewedAt = trimIso(raw.reviewedAt || promotionPacket?.reviewedAt || '', '');
    const claim = buildArchiveCandidateTraceClaim(raw);
    return {
      id: String(raw.id || createId(type)).trim(),
      type,
      sessionId: String(raw.sessionId || sessionId || '').trim() || undefined,
      createdAt,
      updatedAt: trimIso(raw.updatedAt || createdAt, createdAt),
      text,
      excerpt: trimText(raw.excerpt || raw.userText || raw.text || '', 220),
      userText: trimText(raw.userText || '', 900),
      assistantText: trimText(raw.assistantText || '', 900),
      sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      phrases: extractPhrases(raw.text || raw.userText || raw.excerpt || '', 18),
      evidenceCount: Math.max(1, Number(raw.evidenceCount || 1)),
      evidenceIds: sourceEpisodeIds,
      confidence: Math.max(0, Math.min(1, Number(raw.confidence || 0))),
      promotedAt: trimIso(raw.promotedAt || '', ''),
      patternKey: String(raw.patternKey || '').trim(),
      sourceType: String(raw.sourceType || type).trim(),
      sourceLabel: String(raw.sourceLabel || '').trim(),
      originSource: String(raw.originSource || '').trim(),
      originKind: String(raw.originKind || '').trim(),
      evidenceSnippet: trimText(raw.evidenceSnippet || raw.excerpt || raw.userText || raw.text || '', 160),
      reviewStatus,
      reviewerDecision: trimText(raw.reviewerDecision || promotionPacket?.reviewerDecision || '', 40),
      reviewedAt,
      temporalScope: raw.temporalScope && typeof raw.temporalScope === 'object'
        ? {
            label: trimText(raw.temporalScope.label || '', 120),
            observedAt: trimIso(raw.temporalScope.observedAt || '', ''),
            startAt: trimIso(raw.temporalScope.startAt || '', ''),
            endAt: trimIso(raw.temporalScope.endAt || '', ''),
          }
        : null,
      sourceSessionIds: Array.isArray(raw.sourceSessionIds)
        ? normalizeEvidenceIds(raw.sourceSessionIds)
        : normalizeEvidenceIds([
            raw.promotionPacket?.sourceThreadId,
            raw.sessionId || sessionId || '',
          ]),
      sourceTurnIds,
      probation: normalizeArchiveProbation(raw.promotionPacket || raw, {
        type,
        reviewStatus,
        reviewedAt,
      }),
      consolidation: normalizeArchiveConsolidation(raw.promotionPacket || raw, {
        type,
        sessionId: String(raw.sessionId || sessionId || '').trim(),
        createdAt,
        updatedAt: trimIso(raw.updatedAt || createdAt, createdAt),
        sourceEpisodeIds,
        sourceTurnIds,
        lossy: ['summary', 'pattern', 'promotion'].includes(type),
      }),
      promotionPacket,
      ...(claim ? { claim } : {}),
    };
  }

  function normalizeSessionChapter(raw = {}, sessionId = 'default') {
    const text = trimText(raw.text || raw.excerpt || '', 220);
    if (!text) return null;
    const createdAt = trimIso(raw.createdAt || raw.updatedAt, new Date().toISOString());
    return {
      id: String(raw.id || createId('chapter')).trim(),
      sessionId: String(raw.sessionId || sessionId || '').trim() || undefined,
      createdAt,
      updatedAt: trimIso(raw.updatedAt || createdAt, createdAt),
      text,
      excerpt: trimText(raw.excerpt || text, 220),
      sourceEpisodeIds: normalizeEvidenceIds(raw.sourceEpisodeIds || raw.evidenceIds || []),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence || 0))),
      sourceType: 'chapter',
      sourceSessionIds: String(raw.sessionId || sessionId || '').trim()
        ? [String(raw.sessionId || sessionId || '').trim()]
        : [],
      sourceTurnIds: normalizeEvidenceIds(raw.sourceTurnIds || raw.turnIds || []),
      probation: null,
      consolidation: normalizeArchiveConsolidation(raw, {
        type: 'chapter',
        sessionId: String(raw.sessionId || sessionId || '').trim(),
        createdAt,
        updatedAt: trimIso(raw.updatedAt || createdAt, createdAt),
        sourceEpisodeIds: normalizeEvidenceIds(raw.sourceEpisodeIds || raw.evidenceIds || []),
        sourceTurnIds: normalizeEvidenceIds(raw.sourceTurnIds || raw.turnIds || []),
        lossy: true,
      }),
    };
  }

  function normalizeOpenLoop(raw = {}) {
    const text = trimText(raw.text || raw.excerpt || '', 200);
    if (!text) return null;
    return {
      id: String(raw.id || createId('loop')).trim(),
      text,
      createdAt: trimIso(raw.createdAt, ''),
      status: String(raw.status || 'open').trim() || 'open',
    };
  }

  function normalizeProvenanceItem(raw = {}) {
    const oldText = trimText(raw.oldText || '', 220);
    const newText = trimText(raw.newText || '', 220);
    if (!oldText || !newText || oldText.toLowerCase() === newText.toLowerCase()) return null;
    const createdAt = trimIso(raw.createdAt || raw.updatedAt, new Date(nowMs()).toISOString());
    const conflictKey = normalizeConflictKey(raw.conflictKey || raw.topicKey || '');
    return {
      id: String(raw.id || createId('prov')).trim(),
      createdAt,
      oldText,
      newText,
      conflictKey,
      trigger: trimText(raw.trigger || '', 80),
      sourceEpisodeId: String(raw.sourceEpisodeId || '').trim(),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence || 0))),
    };
  }

  function normalizeContradictionItem(raw = {}, sessionId = 'default') {
    const oldText = trimText(raw.oldText || '', 220);
    const newText = trimText(raw.newText || '', 220);
    const conflictKey = normalizeConflictKey(raw.conflictKey || raw.topicKey || '');
    if (!oldText || !newText || !conflictKey || oldText.toLowerCase() === newText.toLowerCase()) return null;
    const createdAt = trimIso(raw.createdAt || raw.updatedAt, new Date(nowMs()).toISOString());
    const updatedAt = trimIso(raw.updatedAt || createdAt, createdAt);
    const rawStatus = String(raw.status || 'active').trim().toLowerCase();
    const status = rawStatus === 'superseded' || rawStatus === 'resolved' ? rawStatus : 'active';
    return {
      id: String(raw.id || createId('contr')).trim(),
      sessionId: String(raw.sessionId || sessionId || '').trim() || undefined,
      createdAt,
      updatedAt,
      sourceEpisodeId: String(raw.sourceEpisodeId || '').trim(),
      trigger: trimText(raw.trigger || '', 80),
      oldText,
      newText,
      conflictKey,
      status,
      supersededAt: trimIso(raw.supersededAt, ''),
      dependentEpisodeIds: normalizeEvidenceIds(raw.dependentEpisodeIds || []),
      dependentChapterIds: normalizeEvidenceIds(raw.dependentChapterIds || []),
    };
  }

  function normalizeArchiveScoreComponents(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const keys = [
      'sourceTypeBase',
      'lexicalOverlap',
      'semanticSimilarity',
      'semanticSimilarityScore',
      'staticSimilarityScore',
      'recency',
      'sessionScope',
      'sensitivityPenalty',
      'baselineScore',
      'exactAnchorScore',
      'contradictionRepairScore',
      'sourceAuthorityScore',
      'evidenceCountScore',
      'openLoopRelevanceScore',
      'memoryLinkCorrectionScore',
    ];
    const out = {};
    let found = false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      if (raw[key] == null && key === 'semanticSimilarity') {
        out[key] = null;
        found = true;
        continue;
      }
      const value = Number(raw[key]);
      if (!Number.isFinite(value)) continue;
      out[key] = value;
      found = true;
    }
    return found ? out : null;
  }

  function normalizeArchiveScoreReasons(items = []) {
    if (!Array.isArray(items)) return [];
    const out = [];
    const seen = new Set();
    for (const raw of items) {
      const reason = trimText(raw, 120);
      if (!reason || seen.has(reason)) continue;
      seen.add(reason);
      out.push(reason);
      if (out.length >= 12) break;
    }
    return out;
  }

  function normalizeArchiveHybridShadowComponents(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const keys = [
      'baselineScore',
      'exactAnchorScore',
      'contradictionRepairScore',
      'sourceAuthorityScore',
      'evidenceCountScore',
      'openLoopRelevanceScore',
    ];
    const out = {};
    let found = false;
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(raw, key)) continue;
      const value = Number(raw[key]);
      if (!Number.isFinite(value)) continue;
      out[key] = value;
      found = true;
    }
    return found ? out : null;
  }

  function normalizeArchiveShadowScores(raw = null) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const hybrid = source.hybridV1 && typeof source.hybridV1 === 'object' ? source.hybridV1 : null;
    if (!hybrid) return null;
    const components = normalizeArchiveHybridShadowComponents(hybrid.components);
    const reasons = normalizeArchiveScoreReasons(hybrid.reasons);
    const score = Number(hybrid.score);
    if (!Number.isFinite(score) && !components && !reasons.length) return null;
    return {
      hybridV1: compactCandidateTraceObject({
        score: Number.isFinite(score) ? score : 0,
        ...(components ? { components } : {}),
        ...(reasons.length ? { reasons } : {}),
        rank: Number.isFinite(Number(hybrid.rank)) ? Number(hybrid.rank) : null,
        wouldSelect: hybrid.wouldSelect === true,
        rankDelta: Number.isFinite(Number(hybrid.rankDelta)) ? Number(hybrid.rankDelta) : null,
      }),
    };
  }

  function normalizeArchiveRerankShadow(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const provider = normalizeRerankShadowProvider(raw.provider || '');
    const reasons = normalizeArchiveScoreReasons(raw.reasons);
    const inputRank = raw.inputRank === null || raw.inputRank === undefined ? null : Number(raw.inputRank);
    const outputRank = raw.outputRank === null || raw.outputRank === undefined ? null : Number(raw.outputRank);
    const rawScore = raw.score ?? raw.rerankScore;
    const score = rawScore === null || rawScore === undefined ? null : Number(rawScore);
    const latencyMs = raw.latencyMs === null || raw.latencyMs === undefined ? null : Number(raw.latencyMs);
    if (!provider && !reasons.length) return null;
    return {
      provider,
      inputRank: Number.isFinite(inputRank) ? inputRank : null,
      outputRank: Number.isFinite(outputRank) ? outputRank : null,
      score: Number.isFinite(score) ? score : null,
      wouldSelect: raw.wouldSelect === true,
      latencyMs: Number.isFinite(latencyMs) ? Math.max(0, Math.round(latencyMs)) : null,
      reasons,
    };
  }

  function normalizeCandidateTraceLimit(value = DEFAULT_CANDIDATE_TRACE_LIMIT) {
    const number = Number(value);
    if (!Number.isFinite(number)) return DEFAULT_CANDIDATE_TRACE_LIMIT;
    return Math.max(0, Math.floor(number));
  }

  function normalizeStaticOnlyRenderedCap(value = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 1;
    return Math.max(0, Math.min(4, Math.floor(number)));
  }

  function isStaticAdvisoryMode(value = '') {
    return String(value || '').trim().toLowerCase() === 'live-advisory';
  }

  function isStaticEmbeddingCandidate(item = {}) {
    return !!(item?.staticEmbedding && typeof item.staticEmbedding === 'object')
      || (Array.isArray(item?.candidateChannels) && item.candidateChannels.includes('static-embedding'));
  }

  function isStaticOnlyArchiveCandidate(item = {}) {
    return isStaticEmbeddingCandidate(item) && item.staticOnly === true;
  }

  function compactCandidateTraceObject(value = {}) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined || item === null || item === '') continue;
      if (Array.isArray(item) && !item.length) continue;
      out[key] = item;
    }
    return out;
  }

  function summarizeArchiveRerankShadowRuns(runs = []) {
    const items = Array.isArray(runs) ? runs.filter((item) => item && typeof item === 'object') : [];
    if (!items.length) return null;
    const provider = normalizeRerankShadowProvider(items.find((item) => item.provider)?.provider || '');
    const measurementMode = String(items.find((item) => item.measurementMode)?.measurementMode || '').trim();
    const unavailableReason = items.find((item) => item.unavailableReason)?.unavailableReason || '';
    const latencyValues = items
      .filter((item) => item.latencyMs !== null && item.latencyMs !== undefined)
      .map((item) => Number(item.latencyMs))
      .filter((value) => Number.isFinite(value));
    return {
      provider,
      measurementMode,
      inputTopK: items.reduce((sum, item) => sum + Math.max(0, Number(item.inputTopK || item.inputCount || 0)), 0),
      outputTopK: items.reduce((sum, item) => sum + Math.max(0, Number(item.outputTopK || 0)), 0),
      inputCount: items.reduce((sum, item) => sum + Math.max(0, Number(item.inputCount || 0)), 0),
      outputCount: items.reduce((sum, item) => sum + Math.max(0, Number(item.outputCount || 0)), 0),
      latencyMs: latencyValues.length
        ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0))
        : null,
      unavailableReason,
    };
  }

  function archiveCandidateTraceKey(item = {}) {
    return String(item?.id || item?.text || item?.excerpt || '').trim().toLowerCase();
  }

  function normalizeCandidateLinkTraceLimit(value = DEFAULT_CANDIDATE_LINK_TRACE_LIMIT) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return DEFAULT_CANDIDATE_LINK_TRACE_LIMIT;
    return Math.max(0, Math.min(24, Math.floor(parsed)));
  }

  function archiveCandidateLinkId(item = {}) {
    return String(item?.id || item?.sourceItemId || item?.candidateId || '').trim();
  }

  function archiveCandidateLinkText(item = {}) {
    return [
      item?.id,
      item?.text,
      item?.excerpt,
      item?.evidenceSnippet,
      item?.textPreview,
      item?.userText,
    ].filter(Boolean).join(' ');
  }

  function findCandidateForCorrectionSide(traceCandidates = [], contradiction = {}, side = 'current') {
    const candidates = (Array.isArray(traceCandidates) ? traceCandidates : [])
      .map((entry) => (entry?.item && typeof entry.item === 'object' ? entry.item : entry))
      .filter((item) => archiveCandidateLinkId(item));
    return candidates.find((item) => {
      const text = archiveCandidateLinkText(item);
      const mentionsCurrent = textMentionsNeedle(text, contradiction.newText);
      const mentionsStale = textMentionsNeedle(text, contradiction.oldText);
      if (side === 'current') return mentionsCurrent;
      return mentionsStale && !mentionsCurrent;
    }) || null;
  }

  function normalizeTraceCandidateMemoryLinks(input = null, generatedAt = '') {
    const linkSet = normalizeMemoryLinkSet(input || { links: [] }, { now: generatedAt });
    return linkSet.links;
  }

  function buildCorrectionMemoryLinksForCandidateTrace({
    traceCandidates = [],
    activeContradictions = [],
    generatedAt = '',
  } = {}) {
    const links = [];
    for (const contradiction of normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT).filter(isActiveContradiction)) {
      const staleCandidate = findCandidateForCorrectionSide(traceCandidates, contradiction, 'stale');
      const currentCandidate = findCandidateForCorrectionSide(traceCandidates, contradiction, 'current');
      if (!staleCandidate || !currentCandidate) continue;
      const artifact = buildCorrectionLinks({
        generatedAt,
        measurementMode: MEMORY_LINK_MEASUREMENT_MODES.LIVE_SHADOW,
        subject: contradiction.conflictKey,
        staleObject: contradiction.oldText,
        currentObject: contradiction.newText,
        staleItem: {
          id: archiveCandidateLinkId(staleCandidate),
          text: archiveCandidateLinkText(staleCandidate),
          supportState: 'archive',
        },
        currentItem: {
          id: archiveCandidateLinkId(currentCandidate),
          text: archiveCandidateLinkText(currentCandidate),
          supportState: 'archive',
        },
        supportState: 'archive',
        sourceReceipts: [
          {
            type: 'archive-contradiction',
            id: contradiction.id,
            sourceEpisodeId: contradiction.sourceEpisodeId,
            conflictKey: contradiction.conflictKey,
          },
        ],
      }, { now: generatedAt });
      links.push(...(Array.isArray(artifact.links) ? artifact.links : []));
    }
    return links;
  }

  function buildCandidateTraceMemoryLinkSet({
    traceCandidates = [],
    activeContradictions = [],
    suppliedLinks = null,
    generatedAt = '',
  } = {}) {
    const supplied = normalizeTraceCandidateMemoryLinks(suppliedLinks, generatedAt);
    const correctionLinks = buildCorrectionMemoryLinksForCandidateTrace({
      traceCandidates,
      activeContradictions,
      generatedAt,
    });
    const seen = new Set();
    const links = [];
    for (const link of [...supplied, ...correctionLinks]) {
      const key = [link.id, link.sourceId, link.targetId, link.relation].filter(Boolean).join('|');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      links.push(link);
    }
    return normalizeMemoryLinkSet({
      generatedAt,
      measurementMode: MEMORY_LINK_MEASUREMENT_MODES.LIVE_SHADOW,
      links,
    }, { now: generatedAt });
  }

  function inferArchiveCandidateTraceAuthority(item = {}) {
    const explicit = String(item.sourceAuthority || item.authority || '').trim();
    if (explicit) return explicit;
    const scope = String(item.scope || '').trim().toLowerCase();
    if (scope === 'session' || scope === 'global') return 'advisory';
    return 'unknown';
  }

  function inferArchiveCandidateTraceSupportState({
    eligibility = {},
    ranked = false,
    selected = false,
    rendered = false,
  } = {}) {
    if (rendered) return 'rendered';
    if (selected) return 'selected';
    if (ranked) return 'ranked';
    if (eligibility.filtered === true || eligibility.eligible === false) return 'filtered';
    return 'raw';
  }

  function buildArchiveCandidateTraceClaim(item = {}) {
    const source = item && typeof item === 'object' ? item : {};
    const rawClaim = source.claim || source.semanticClaim || source.structuredClaim;
    if (rawClaim && typeof rawClaim === 'object' && !Array.isArray(rawClaim)) return rawClaim;

    const hasFlatClaimEvidence = Boolean(
      source.claimId
        || source.semanticClaimId
        || source.claimDomainId
        || source.domainId
        || source.claimSubjectId
        || source.subjectId
        || source.claimPredicateId
        || source.predicateId
        || source.claimObjectId
        || source.objectId
        || source.claimObjectText
        || source.objectText
        || source.semanticSourceId
        || source.claimSourceId,
    );
    if (!hasFlatClaimEvidence) return null;

    const flatClaim = compactCandidateTraceObject({
      claimId: source.claimId || source.semanticClaimId,
      domainId: source.claimDomainId || source.domainId,
      subjectId: source.claimSubjectId || source.subjectId,
      subjectType: source.claimSubjectType || source.subjectType,
      predicateId: source.claimPredicateId || source.predicateId,
      objectId: source.claimObjectId || source.objectId,
      objectType: source.claimObjectType || source.objectType,
      objectText: source.claimObjectText || source.objectText,
      sourceId: source.semanticSourceId || source.claimSourceId,
      sourceType: source.claimSourceType || source.sourceType,
      sourceAuthority: source.claimSourceAuthority || source.sourceAuthority,
      supportState: source.claimSupportState || source.supportState,
      canonicality: source.claimCanonicality || source.canonicality,
      temporalScope: source.claimTemporalScope || source.temporalScope,
      stale: typeof source.claimStale === 'boolean' ? source.claimStale : source.stale,
    });
    return Object.keys(flatClaim).length ? flatClaim : null;
  }

  function buildRenderedArchiveClaim(item = {}) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    return normalizePromptTruthRenderedClaims([
      item.renderedClaim,
      item.renderedClaimSummary,
      item.claim,
      item.semanticClaim,
      item.structuredClaim,
    ].filter(Boolean), 1)[0] || null;
  }

  function buildArchiveCandidateTraceItem(raw = {}, {
    group = '',
    rank = null,
    selected = false,
    selectedRank = null,
    rendered = false,
    ranked = false,
    heldBackReason = '',
    eligibility = { eligible: true, filtered: false, filterReason: '' },
    memoryLinks = null,
    linkTraceLimit = DEFAULT_CANDIDATE_LINK_TRACE_LIMIT,
  } = {}) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const scoreComponents = normalizeArchiveScoreComponents(item.scoreComponents);
    const scoreReasons = normalizeArchiveScoreReasons(item.scoreReasons);
    const activeScoreComponents = normalizeArchiveScoreComponents(item.activeScoreComponents || item.scoreComponents);
    const activeScoreReasons = normalizeArchiveScoreReasons(item.activeScoreReasons || item.scoreReasons);
    const shadowScores = normalizeArchiveShadowScores(item.shadowScores);
    const rerankShadow = normalizeArchiveRerankShadow(item.rerankShadow);
    const semanticSimilarity = scoreComponents ? scoreComponents.semanticSimilarity : null;
    const semanticScore = semanticSimilarity == null
      ? null
      : (Number.isFinite(Number(semanticSimilarity)) ? Number(semanticSimilarity) : null);
    const normalizedEligibility = {
      eligible: eligibility.eligible !== false,
      filtered: eligibility.filtered === true,
      filterReason: trimText(eligibility.filterReason || '', 120),
    };
    const candidateChannels = normalizeEvidenceIds(
      Array.isArray(item.candidateChannels) ? item.candidateChannels : [],
    );
    const staticEmbedding = normalizeStaticEmbeddingInfo(item);
    const normalizedHeldBackReason = trimText(heldBackReason || item.heldBackReason || '', 120);
    const normalizedEligibilityReason = normalizedEligibility.filtered
      ? trimText(normalizedEligibility.filterReason || '', 120)
      : '';
    const claim = buildArchiveCandidateTraceClaim(item);
    const staticCandidate = isStaticEmbeddingCandidate(item);
    const memoryLinkTrace = memoryLinks
      ? buildMemoryLinkTraceForItem(memoryLinks, archiveCandidateLinkId(item), { linkTraceLimit })
      : null;
    const policyReasons = staticCandidate
      ? normalizeArchiveScoreReasons([
          ...(activeScoreReasons.length ? activeScoreReasons : scoreReasons),
          ...(shadowScores?.hybridV1?.reasons || []),
          normalizedEligibilityReason,
          normalizedHeldBackReason,
          normalizedHeldBackReason || normalizedEligibilityReason || (selected ? 'live-advisory-selected' : 'live-advisory-ranked'),
        ])
      : [];
    const policyHeldBackReason = normalizedHeldBackReason || normalizedEligibilityReason;
    return compactCandidateTraceObject({
      id: String(item.id || '').trim(),
      group: String(group || '').trim(),
      scope: String(item.scope || '').trim() || 'global',
      sourceType: String(item.sourceType || '').trim() || 'archive',
      sourceAuthority: inferArchiveCandidateTraceAuthority(item),
      supportState: isStaticOnlyArchiveCandidate(item)
        ? 'candidate'
        : inferArchiveCandidateTraceSupportState({
            eligibility: normalizedEligibility,
            ranked,
            selected,
            rendered,
          }),
      textPreview: trimText(item.text || item.excerpt || item.evidenceSnippet || '', 220),
      sensitivity: item.sensitivity === 'high' ? 'high' : 'normal',
      createdAt: trimIso(item.createdAt, ''),
      score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0,
      confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0,
      scoringProfile: normalizeArchiveScoringProfile(item.scoringProfile),
      memoryLinkScoring: normalizeMemoryLinkScoringMode(item.memoryLinkScoring),
      activeScore: Number.isFinite(Number(item.activeScore))
        ? Number(item.activeScore)
        : (Number.isFinite(Number(item.score)) ? Number(item.score) : 0),
      rank: rank == null ? null : (Number.isFinite(Number(rank)) ? Number(rank) : null),
      selected,
      selectedRank: selectedRank == null ? null : (Number.isFinite(Number(selectedRank)) ? Number(selectedRank) : null),
      rendered,
      raw: true,
      ranked,
      matchedTokens: Array.isArray(item.matchedTokens)
        ? item.matchedTokens.map((value) => trimText(value, 40)).filter(Boolean).slice(0, 6)
        : [],
      semanticScore,
      ...(activeScoreComponents ? { activeScoreComponents } : {}),
      ...(activeScoreReasons.length ? { activeScoreReasons } : {}),
      ...(normalizeArchiveScoringProfile(item.scoringProfile) === ARCHIVE_SCORING_PROFILES.HYBRID_V1
        && Number.isFinite(Number(item.baselineScore)) ? { baselineScore: Number(item.baselineScore) } : {}),
      ...(normalizeArchiveScoringProfile(item.scoringProfile) === ARCHIVE_SCORING_PROFILES.BASELINE
        && Number.isFinite(Number(item.hybridShadowScore)) ? { hybridShadowScore: Number(item.hybridShadowScore) } : {}),
      ...(scoreComponents ? { scoreComponents } : {}),
      ...(scoreReasons.length ? { scoreReasons } : {}),
      ...(shadowScores ? { shadowScores } : {}),
      ...(rerankShadow ? { rerankShadow } : {}),
      ...(candidateChannels.length ? { candidateChannels } : {}),
      ...(staticEmbedding ? { staticEmbedding } : {}),
      ...(memoryLinkTrace ? { memoryLinks: memoryLinkTrace } : {}),
      ...(claim ? { claim } : {}),
      ...(isStaticOnlyArchiveCandidate(item) ? { staticOnly: true } : {}),
      ...(normalizedHeldBackReason ? { heldBackReason: normalizedHeldBackReason } : {}),
      ...(staticCandidate ? {
        policy: {
          selected,
          rendered,
          heldBackReason: policyHeldBackReason,
          reasons: policyReasons,
        },
      } : {}),
      eligibility: normalizedEligibility,
      sourceEpisodeIds: normalizeEvidenceIds(item.sourceEpisodeIds || item.evidenceIds || []),
      sourceSessionIds: normalizeEvidenceIds(
        item.sourceSessionIds
        || (item.sourceSessionId ? [item.sourceSessionId] : [])
        || (item.sessionId ? [item.sessionId] : []),
      ),
      sourceTurnIds: normalizeEvidenceIds(item.sourceTurnIds || item.turnIds || []),
    });
  }

  function normalizeStaticEmbeddingInfo(raw = {}, {
    fallbackQueryMs = 0,
  } = {}) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const staticEmbedding = item.staticEmbedding && typeof item.staticEmbedding === 'object'
      ? item.staticEmbedding
      : {};
    const rawSimilarity = Number(staticEmbedding.similarity ?? item.similarity);
    const rawRank = Number(staticEmbedding.rank ?? item.rank);
    const rawQueryMs = Number(staticEmbedding.queryMs ?? item.queryMs ?? fallbackQueryMs);
    const rawDimensions = Number(staticEmbedding.dimensions ?? staticEmbedding.truncateDim ?? item.dimensions);
    const out = compactCandidateTraceObject({
      provider: trimText(staticEmbedding.provider || item.provider || '', 80),
      modelId: trimText(staticEmbedding.modelId || item.modelId || '', 140),
      dimensions: Number.isFinite(rawDimensions) ? rawDimensions : null,
      similarity: Number.isFinite(rawSimilarity) ? rawSimilarity : null,
      rank: Number.isFinite(rawRank) ? rawRank : null,
      queryMs: Number.isFinite(rawQueryMs) ? Math.max(0, rawQueryMs) : 0,
    });
    const hasSignal = !!(item.staticEmbedding && typeof item.staticEmbedding === 'object')
      || Object.prototype.hasOwnProperty.call(item, 'staticSimilarity')
      || out.similarity != null
      || out.rank != null
      || out.dimensions != null
      || !!out.provider
      || !!out.modelId;
    return hasSignal ? out : null;
  }

  function normalizeStaticEmbeddingCandidateTraceItem(raw = {}, {
    fallbackQueryMs = 0,
    mode = 'live-shadow',
  } = {}) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const channels = normalizeEvidenceIds([
      ...(Array.isArray(item.candidateChannels) ? item.candidateChannels : []),
      'static-embedding',
    ]);
    const normalizedStatic = normalizeStaticEmbeddingInfo(item, { fallbackQueryMs });
    const rawRank = Number(normalizedStatic?.rank ?? item.rank);
    const advisoryMode = isStaticAdvisoryMode(mode);
    const sourceId = String(item.id || item.sourceItemId || '').trim();
    if (!sourceId && !item.textPreview) return null;
    return compactCandidateTraceObject({
      id: sourceId,
      group: 'static-embedding',
      scope: String(item.scope || '').trim() || 'static-shadow',
      sourceType: String(item.sourceType || '').trim() || 'archive',
      sourceAuthority: String(item.sourceAuthority || '').trim() || 'advisory',
      supportState: String(item.supportState || '').trim() || 'candidate',
      textPreview: trimText(item.textPreview || item.text || item.excerpt || '', 220),
      candidateChannels: channels,
      staticEmbedding: normalizedStatic,
      policy: {
        selected: false,
        rendered: false,
        heldBackReason: advisoryMode ? 'live-advisory-candidate-pool' : 'live-shadow-trace-only',
        reasons: advisoryMode
          ? ['static-embedding-advisory', 'candidate-pool']
          : ['static-embedding-shadow', 'trace-only'],
      },
      selected: false,
      selectedRank: null,
      rendered: false,
      raw: true,
      ranked: true,
      rank: Number.isFinite(rawRank) ? rawRank : null,
      eligibility: {
        eligible: advisoryMode,
        filtered: !advisoryMode,
        filterReason: advisoryMode ? 'live-advisory-candidate-pool' : 'live-shadow-trace-only',
      },
      wouldHaveSelected: false,
    });
  }

  function normalizeStaticEmbeddingShadowResult(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const status = raw.status && typeof raw.status === 'object' ? raw.status : {};
    const reason = trimText(raw.reason || raw.skippedReason || status.reason || status.error || '', 140);
    if (raw.skipped === true && (reason === 'disabled' || status.enabled === false)) return null;
    const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    const queryMs = Number(raw.queryMs ?? status.lastQueryMs);
    const mode = String(status.mode || raw.mode || '').trim() || 'live-shadow';
    const topCandidates = candidates
      .map((item) => normalizeStaticEmbeddingCandidateTraceItem(item, { fallbackQueryMs: queryMs, mode }))
      .filter(Boolean)
      .slice(0, 12);
    const provider = String(status.provider || status.providerId || raw.provider || '').trim()
      || topCandidates.find((item) => item.staticEmbedding?.provider)?.staticEmbedding.provider
      || '';
    return compactCandidateTraceObject({
      mode,
      provider,
      queryMs: Number.isFinite(queryMs) ? Math.max(0, queryMs) : 0,
      candidateCount: candidates.length,
      topCandidates,
      wouldHaveSelected: false,
      ...(raw.frameBudgetSidecar && typeof raw.frameBudgetSidecar === 'object'
        ? { frameBudgetSidecar: raw.frameBudgetSidecar }
        : {}),
      ...(raw.skipped === true ? { skipped: true, skippedReason: reason || 'not-ready' } : {}),
      ...(status.ready === true || status.ready === false ? { ready: status.ready === true } : {}),
    });
  }

  function countStaticMemoryCandidates(raw = null) {
    return Array.isArray(raw?.candidates) ? raw.candidates.length : 0;
  }

  function normalizeCachedStaticMemoryIndexResult(raw = null) {
    if (!raw || typeof raw !== 'object') return null;
    const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    if (!candidates.length) return null;
    return raw;
  }

  function limitStaticMemoryIndexCandidates(raw = null, maxCandidates = null) {
    if (!raw || typeof raw !== 'object') return raw;
    if (maxCandidates === null || maxCandidates === undefined || maxCandidates === '') return raw;
    const limit = Number(maxCandidates);
    if (!Number.isFinite(limit) || limit < 0) return raw;
    const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    return {
      ...raw,
      candidates: candidates.slice(0, Math.floor(limit)),
      fullCandidateCount: candidates.length,
      candidateLimitApplied: candidates.length > Math.floor(limit),
    };
  }

  function buildSkippedStaticExpansionResult({
    reason = 'pre-prompt-budget-exhausted',
    mode = 'live-advisory',
    budgetMs = FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY,
  } = {}) {
    return {
      skipped: true,
      reason,
      candidates: [],
      queryMs: 0,
      status: {
        enabled: true,
        mode,
        ready: true,
      },
      frameBudgetSidecar: buildFrameBudgetSidecarReceipt({
        id: 'static-expansion',
        label: 'Static memory expansion',
        spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
        status: FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED,
        budgetMs,
        actualMs: 0,
        candidateCount: 0,
        sourceAuthority: 'advisory',
        reason,
        fallback: 'keyword+cached-candidates',
      }),
    };
  }

  function buildCachedStaticExpansionResult(raw = {}, {
    budgetMs = FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY,
  } = {}) {
    const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
    return {
      ...raw,
      skipped: false,
      reason: raw.reason || 'cached-static-candidates',
      queryMs: 0,
      frameBudgetSidecar: buildFrameBudgetSidecarReceipt({
        id: 'static-expansion',
        label: 'Static memory expansion',
        spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
        status: FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED,
        budgetMs,
        actualMs: 0,
        candidateCount: candidates.length,
        sourceAuthority: 'advisory',
        reason: 'pre-prompt-budget-tight',
        fallback: 'cached-static-candidates',
      }),
    };
  }

  function staticSourceParts(sourceItemId = '') {
    const parts = String(sourceItemId || '').split(':').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 3) return { scope: '', sourceType: '', archiveId: String(sourceItemId || '').trim() };
    if (parts[0] === 'session' && parts.length >= 4) {
      return {
        scope: 'session',
        sourceType: parts[parts.length - 2] || 'episode',
        archiveId: parts[parts.length - 1] || sourceItemId,
        sessionId: parts[1] || '',
      };
    }
    if (parts[0] === 'archive' && parts.length >= 3) {
      return {
        scope: 'global',
        sourceType: parts[parts.length - 2] || 'archive',
        archiveId: parts[parts.length - 1] || sourceItemId,
        sessionId: '',
      };
    }
    if (parts[0] === 'research-ledger') {
      return {
        scope: 'global',
        sourceType: 'research-ledger-topic',
        archiveId: parts[parts.length - 1] || sourceItemId,
        sessionId: '',
      };
    }
    return { scope: '', sourceType: '', archiveId: String(sourceItemId || '').trim(), sessionId: '' };
  }

  function normalizeStaticAdvisoryCandidate(raw = {}, {
    sessionId = 'default',
    fallbackQueryMs = 0,
  } = {}) {
    const item = raw && typeof raw === 'object' ? raw : {};
    const sourceItemId = String(item.sourceItemId || item.id || '').trim();
    const parts = staticSourceParts(sourceItemId);
    const text = trimText(item.text || item.sourceText || item.textPreview || item.excerpt || '', 220);
    if (!sourceItemId || !text) return null;
    const scope = String(item.scope || '').trim()
      || (parts.scope === 'session' && (!parts.sessionId || parts.sessionId === sessionId) ? 'session' : 'global');
    const sourceType = String(item.sourceType || parts.sourceType || 'archive').trim();
    const archiveId = String(item.archiveId || parts.archiveId || sourceItemId).trim();
    const sourceEpisodeIds = sourceType.includes('episode') && archiveId
      ? [archiveId]
      : [];
    return compactCandidateTraceObject({
      id: archiveId || sourceItemId,
      sourceItemId,
      text,
      excerpt: trimText(item.textPreview || text, 220),
      evidenceSnippet: trimText(item.textPreview || text, 160),
      sourceType,
      scope,
      sourceAuthority: 'advisory',
      supportState: 'candidate',
      sourceLabel: scope === 'session' ? 'archive-session' : 'archive-global',
      sensitivity: item.sensitivity === 'high' ? 'high' : 'normal',
      createdAt: trimIso(item.createdAt || item.sourceUpdatedAt || item.updatedAt || '', ''),
      updatedAt: trimIso(item.updatedAt || item.sourceUpdatedAt || '', ''),
      evidenceCount: Math.max(1, Number(item.evidenceCount || 1)),
      candidateChannels: normalizeEvidenceIds([
        ...(Array.isArray(item.candidateChannels) ? item.candidateChannels : []),
        'static-embedding',
      ]),
      staticEmbedding: normalizeStaticEmbeddingInfo(item, { fallbackQueryMs }),
      staticOnly: true,
      sourceEpisodeIds,
      sourceSessionIds: scope === 'session' ? [sessionId].filter(Boolean) : [],
      sourceTurnIds: normalizeEvidenceIds(item.sourceTurnIds || item.turnIds || []),
    });
  }

  function mergeCandidateChannelMetadata(existing = {}, incoming = {}) {
    return {
      ...existing,
      candidateChannels: normalizeEvidenceIds([
        ...(Array.isArray(existing.candidateChannels) ? existing.candidateChannels : []),
        ...(Array.isArray(incoming.candidateChannels) ? incoming.candidateChannels : []),
      ]),
      ...(incoming.staticEmbedding ? { staticEmbedding: incoming.staticEmbedding } : {}),
      ...(incoming.sourceItemId ? { sourceItemId: incoming.sourceItemId } : {}),
      staticOnly: false,
      sourceAuthority: existing.sourceAuthority || incoming.sourceAuthority || 'advisory',
      supportState: existing.supportState || incoming.supportState || 'candidate',
    };
  }

  function mergeStaticAdvisoryCandidates(candidateGroups = {}, candidates = [], {
    sessionId = 'default',
    queryMs = 0,
  } = {}) {
    const normalized = (Array.isArray(candidates) ? candidates : [])
      .map((item) => normalizeStaticAdvisoryCandidate(item, { sessionId, fallbackQueryMs: queryMs }))
      .filter(Boolean);
    const summary = {
      enabled: normalized.length > 0,
      candidateCount: normalized.length,
      mergedCandidateCount: 0,
      staticOnlyCandidateCount: 0,
    };
    candidateGroups.static = normalized;
    for (const candidate of normalized) {
      const groupKey = candidate.scope === 'session' ? 'session' : 'global';
      const group = Array.isArray(candidateGroups[groupKey]) ? candidateGroups[groupKey] : [];
      const candidateId = String(candidate.id || '').trim().toLowerCase();
      const candidateText = trimText(candidate.text || '', 220).toLowerCase();
      const existingIndex = group.findIndex((item) => {
        const itemId = String(item?.id || '').trim().toLowerCase();
        const itemText = trimText(item?.text || '', 220).toLowerCase();
        return (candidateId && itemId && candidateId === itemId)
          || (candidateText && itemText && candidateText === itemText);
      });
      if (existingIndex >= 0) {
        group[existingIndex] = mergeCandidateChannelMetadata(group[existingIndex], candidate);
        summary.mergedCandidateCount += 1;
        continue;
      }
      group.push(candidate);
      summary.staticOnlyCandidateCount += 1;
      candidateGroups[groupKey] = group;
    }
    return summary;
  }

  function candidateTouchesContradictionSource(candidate = {}, activeContradictions = []) {
    const ids = new Set(normalizeEvidenceIds([
      candidate.id,
      candidate.sourceItemId,
      ...(Array.isArray(candidate.sourceEpisodeIds) ? candidate.sourceEpisodeIds : []),
      ...(Array.isArray(candidate.evidenceIds) ? candidate.evidenceIds : []),
    ]));
    if (!ids.size) return false;
    return normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .filter(isActiveContradiction)
      .some((item) => ids.has(String(item.sourceEpisodeId || '').trim()));
  }

  function queryTouchesActiveContradiction(userText = '', activeContradictions = []) {
    return normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .filter(isActiveContradiction)
      .some((item) => textReferencesContradiction(userText, item));
  }

  function staticAdvisoryEligibility(candidate = {}, scored = {}, {
    userText = '',
    activeContradictions = [],
  } = {}) {
    if (!isStaticOnlyArchiveCandidate(candidate)) {
      return { eligible: true, filtered: false, filterReason: '' };
    }
    const contradictionRepairScore = Number(
      scored.hybridV1Components?.contradictionRepairScore
      ?? scored.activeScoreComponents?.contradictionRepairScore
      ?? 0,
    );
    if (
      queryTouchesActiveContradiction(userText, activeContradictions)
      && contradictionRepairScore <= 0
    ) {
      return {
        eligible: false,
        filtered: true,
        filterReason: contradictionRepairScore < 0
          ? 'static-stale-correction-gate'
          : 'static-correction-source-gate',
      };
    }
    return { eligible: true, filtered: false, filterReason: '' };
  }

  function selectUniqueCandidatesForPrompt(ranked = [], limit = 2, {
    staticOnlyCapState = null,
  } = {}) {
    const maxSelected = Math.max(0, Math.floor(Number(limit || 0)));
    if (maxSelected <= 0) return { selected: [], holdbacks: new Map() };
    const seen = new Set();
    const selected = [];
    const holdbacks = new Map();
    for (const item of Array.isArray(ranked) ? ranked : []) {
      const key = archiveCandidateTraceKey(item);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (isStaticOnlyArchiveCandidate(item) && staticOnlyCapState) {
        const max = Math.max(0, Number(staticOnlyCapState.max || 0));
        const used = Math.max(0, Number(staticOnlyCapState.used || 0));
        if (used >= max) {
          holdbacks.set(key, 'static-only-render-cap');
          continue;
        }
        staticOnlyCapState.used = used + 1;
      }
      selected.push(item);
      if (selected.length >= maxSelected) break;
    }
    return { selected, holdbacks };
  }

  function normalizeRetrievalItem(raw = {}) {
    const text = trimText(raw.text || raw.excerpt || '', 220);
    if (!text) return null;
    const scope = String(raw.scope || '').trim() || 'global';
    const sourceLabel = String(raw.sourceLabel || '').trim()
      || (scope === 'session' ? 'archive-session' : 'archive-global');
    const sourceEpisodeIds = normalizeEvidenceIds(raw.sourceEpisodeIds || raw.evidenceIds || []);
    const sourceTurnIds = normalizeEvidenceIds(raw.sourceTurnIds || raw.turnIds || []);
    const sourceSessionIds = normalizeEvidenceIds(
      raw.sourceSessionIds
      || (raw.sourceSessionId ? [raw.sourceSessionId] : [])
      || (raw.sessionId ? [raw.sessionId] : []),
    );
    const scoreComponents = normalizeArchiveScoreComponents(raw.scoreComponents);
    const scoreReasons = normalizeArchiveScoreReasons(raw.scoreReasons);
    const activeScoreComponents = normalizeArchiveScoreComponents(raw.activeScoreComponents || raw.scoreComponents);
    const activeScoreReasons = normalizeArchiveScoreReasons(raw.activeScoreReasons || raw.scoreReasons);
    const scoringProfile = normalizeArchiveScoringProfile(raw.scoringProfile);
    const candidateChannels = normalizeEvidenceIds(
      Array.isArray(raw.candidateChannels) ? raw.candidateChannels : [],
    );
    const staticEmbedding = normalizeStaticEmbeddingInfo(raw);
    const renderedClaim = buildRenderedArchiveClaim(raw);
    return {
      id: String(raw.id || '').trim(),
      text,
      sourceType: String(raw.sourceType || '').trim() || 'archive',
      scope,
      sourceLabel,
      sourceAuthority: String(raw.sourceAuthority || '').trim() || (isStaticOnlyArchiveCandidate(raw) ? 'advisory' : ''),
      supportState: isStaticOnlyArchiveCandidate(raw)
        ? 'candidate'
        : (String(raw.supportState || '').trim() || ''),
      sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      createdAt: trimIso(raw.createdAt, ''),
      score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : 0,
      confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
      scoringProfile,
      activeScore: Number.isFinite(Number(raw.activeScore))
        ? Number(raw.activeScore)
        : (Number.isFinite(Number(raw.score)) ? Number(raw.score) : 0),
      ...(activeScoreComponents ? { activeScoreComponents } : {}),
      ...(activeScoreReasons.length ? { activeScoreReasons } : {}),
      ...(scoringProfile === ARCHIVE_SCORING_PROFILES.HYBRID_V1
        && Number.isFinite(Number(raw.baselineScore)) ? { baselineScore: Number(raw.baselineScore) } : {}),
      ...(scoringProfile === ARCHIVE_SCORING_PROFILES.BASELINE
        && Number.isFinite(Number(raw.hybridShadowScore)) ? { hybridShadowScore: Number(raw.hybridShadowScore) } : {}),
      ...(scoreComponents ? { scoreComponents } : {}),
      ...(scoreReasons.length ? { scoreReasons } : {}),
      ...(candidateChannels.length ? { candidateChannels } : {}),
      ...(staticEmbedding ? { staticEmbedding } : {}),
      ...(renderedClaim ? { renderedClaim } : {}),
      ...(isStaticOnlyArchiveCandidate(raw) ? { staticOnly: true } : {}),
      ...(raw.sourceItemId ? { sourceItemId: String(raw.sourceItemId || '').trim() } : {}),
      sourceEpisodeIds,
      sourceSessionIds,
      sourceTurnIds,
      matchedTokens: Array.isArray(raw.matchedTokens)
        ? raw.matchedTokens.map((value) => trimText(value, 40)).filter(Boolean).slice(0, 6)
        : [],
      evidenceSnippet: trimText(raw.evidenceSnippet || raw.excerpt || raw.text || '', 160),
      probation: normalizeArchiveProbation(raw, {
        type: raw.sourceType === 'promotion' ? 'promotion' : 'episode',
        reviewStatus: raw.reviewStatus || '',
        reviewedAt: raw.reviewedAt || '',
      }),
      consolidation: normalizeArchiveConsolidation(raw, {
        type: raw.sourceType === 'chapter' ? 'chapter' : (raw.sourceType || 'episode'),
        sessionId: sourceSessionIds[0] || raw.sessionId || (scope === 'session' ? 'session-scope' : ''),
        createdAt: trimIso(raw.createdAt, ''),
        updatedAt: trimIso(raw.updatedAt || raw.createdAt, trimIso(raw.createdAt, '')),
        sourceEpisodeIds,
        sourceTurnIds,
        lossy: raw.sourceType === 'chapter' || raw.sourceType === 'summary' || raw.sourceType === 'pattern',
      }),
    };
  }

  function normalizeBookMatch(raw = {}) {
    const text = trimText(raw.text || raw.excerpt || '', 220);
    if (!text) return null;
    return {
      id: String(raw.id || '').trim(),
      text,
      placement: String(raw.placement || 'memory').trim() || 'memory',
      score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : 0,
      priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 0,
      sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      source: String(raw.source || '').trim() || 'local',
      sourceLabel: String(raw.sourceLabel || '').trim() || 'book',
      matchedPhrases: Array.isArray(raw.matchedPhrases)
        ? raw.matchedPhrases.map((value) => trimText(value, 100)).filter(Boolean).slice(0, 4)
        : [],
      evidenceSnippet: trimText(raw.evidenceSnippet || raw.excerpt || raw.text || (Array.isArray(raw.matchedPhrases) ? raw.matchedPhrases[0] : ''), 160),
      matchedOn: raw.matchedOn && typeof raw.matchedOn === 'object'
        ? {
            lane: String(raw.matchedOn.lane || '').trim() || 'chat',
            attachmentType: String(raw.matchedOn.attachmentType || '').trim() || 'none',
          }
        : { lane: 'chat', attachmentType: 'none' },
    };
  }

  function normalizeCompressionInfo(raw = {}) {
    if (!raw || typeof raw !== 'object') {
      return {
        used: false,
        reason: '',
        reasonCode: ARCHIVE_COMPRESSION_REASON_CODES.NOT_NEEDED,
        chapters: [],
        explanation: {
          selectedSignals: [],
          penalties: [],
          omittedEpisodeCount: 0,
          carriedContradictions: [],
        },
        consolidation: normalizeConsolidationPacket({
          lossy: false,
          mergeKind: 'compression-idle',
          mergeReason: ARCHIVE_COMPRESSION_REASON_CODES.NOT_NEEDED,
          freshnessLabel: 'unknown',
        }),
      };
    }
    const reasonCode = normalizeCompressionReasonCode(raw.reasonCode || raw.reason);
    const explanation = {
      selectedSignals: Array.isArray(raw.explanation?.selectedSignals)
        ? raw.explanation.selectedSignals.map((value) => trimText(value, 80)).filter(Boolean).slice(0, 8)
        : [],
      penalties: Array.isArray(raw.explanation?.penalties)
        ? raw.explanation.penalties.map((value) => trimText(value, 80)).filter(Boolean).slice(0, 8)
        : [],
      omittedEpisodeCount: Math.max(0, Number(raw.explanation?.omittedEpisodeCount || 0)),
      carriedContradictions: Array.isArray(raw.explanation?.carriedContradictions)
        ? raw.explanation.carriedContradictions
          .map((item) => normalizeContradictionItem(item))
          .filter(Boolean)
          .slice(0, 4)
        : [],
    };
    return {
      used: raw.used === true,
      reason: trimText(raw.reason || '', 80),
      reasonCode,
      chapters: Array.isArray(raw.chapters)
        ? raw.chapters.map(normalizeRetrievalItem).filter(Boolean).slice(0, 4)
        : [],
      explanation,
      consolidation: normalizeConsolidationPacket(raw.consolidation || raw, {
        lossy: raw.used === true,
        mergeKind: raw.used === true ? 'compression-fallback' : 'compression-idle',
        mergeReason: raw.reason || reasonCode || '',
        mergeBasis: explanation.selectedSignals,
        discardedDetailSummary: buildDiscardedDetailSummary(raw, explanation),
        sourceScope: 'chapter',
        freshnessLabel: raw.used === true ? 'rolling' : 'unknown',
      }),
    };
  }

  function normalizeBackgroundVectorizationCandidate(raw = {}) {
    const id = String(raw.id || '').trim();
    const text = trimText(raw.text || raw.evidenceSnippet || raw.excerpt || '', 160);
    if (!id && !text) return null;
    return {
      id,
      sourceType: String(raw.sourceType || 'archive').trim() || 'archive',
      evidenceSnippet: text,
      utilityScore: Number.isFinite(Number(raw.utilityScore)) ? Number(raw.utilityScore) : 0,
      contradictionLinked: raw.contradictionLinked === true,
      openLoopLinked: raw.openLoopLinked === true,
      recentlyRetrieved: raw.recentlyRetrieved === true,
      created: raw.created === true,
    };
  }

  function normalizeBackgroundVectorizationStatus(raw = {}, {
    enabled = backgroundChatVectorsEnabled,
    batchLimit = backgroundChatVectorBatchLimit,
  } = {}) {
    const requestedStatus = String(raw.status || '').trim().toLowerCase();
    const status = ['disabled', 'skipped', 'applied', 'failed'].includes(requestedStatus)
      ? requestedStatus
      : (enabled ? 'skipped' : 'disabled');
    const backgroundCandidateCount = Math.max(0, Number(raw.backgroundCandidateCount ?? raw.selectedCount ?? 0));
    const backgroundCreatedCount = Math.max(0, Number(raw.backgroundCreatedCount ?? raw.createdCount ?? 0));
    return {
      enabled,
      status,
      sourceSessionId: String(raw.sourceSessionId || raw.sessionId || '').trim(),
      semanticReady: raw.semanticReady === true,
      archivePending: raw.archivePending === true,
      attemptedAt: trimIso(raw.attemptedAt || raw.updatedAt, ''),
      skippedReason: trimText(raw.skippedReason || raw.reason || '', 120),
      eagerEmbeddingCount: Math.max(0, Number(raw.eagerEmbeddingCount || 0)),
      eagerCreatedCount: Math.max(0, Number(raw.eagerCreatedCount || 0)),
      batchLimit: Math.max(0, Number(raw.batchLimit || batchLimit || 0)),
      backgroundCandidateCount,
      backgroundCreatedCount,
      selectedCount: backgroundCandidateCount,
      createdCount: backgroundCreatedCount,
      candidates: Array.isArray(raw.candidates)
        ? raw.candidates.map(normalizeBackgroundVectorizationCandidate).filter(Boolean).slice(0, 4)
        : [],
    };
  }

  function normalizeProvenanceList(items = [], limit = SESSION_PROVENANCE_LIMIT) {
    const out = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const item = normalizeProvenanceItem(raw);
      if (!item) continue;
      out.push(item);
      if (out.length >= limit) break;
    }
    return out;
  }

  function normalizeContradictionList(items = [], limit = SESSION_ACTIVE_CONTRADICTION_LIMIT) {
    const out = [];
    for (const raw of Array.isArray(items) ? items : []) {
      const item = normalizeContradictionItem(raw);
      if (!item) continue;
      out.push(item);
      if (out.length >= limit) break;
    }
    return out;
  }

  function normalizeAuditPromptTruth(raw = null) {
    const normalized = normalizePromptTruth(raw);
    const channels = {};
    for (const key of ['stableFacts', 'memoryBooks', 'sessionArchive', 'globalArchive', 'researchLedger']) {
      const channel = normalized.channels?.[key] && typeof normalized.channels[key] === 'object'
        ? normalized.channels[key]
        : {};
      channels[key] = {
        state: String(channel.state || '').trim() || 'unknown',
        candidateCount: Math.max(0, Number(channel.candidateCount || 0)),
        renderedCount: Math.max(0, Number(channel.renderedCount || 0)),
        heldBackReason: trimText(channel.heldBackReason || '', 120),
      };
    }
    return {
      schema: normalized.schema,
      channels,
    };
  }

  function normalizeAuditRetrievalSummary(raw = {}) {
    const value = raw && typeof raw === 'object' ? raw : {};
    const mode = String(value.mode || '').trim() || 'keyword';
    const compression = value.compression && typeof value.compression === 'object' ? value.compression : {};
    return {
      mode,
      reasonCode: String(value.reasonCode || '').trim()
        || (mode === 'semantic'
          ? ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY
          : ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK),
      selectedSessionIds: normalizeEvidenceIds(
        value.selectedSessionIds
        || (Array.isArray(value.session) ? value.session.map((item) => item?.id || item) : []),
      ).slice(0, PROMPT_TRUTH_AUDIT_LIMITS.sessionArchive),
      selectedGlobalIds: normalizeEvidenceIds(
        value.selectedGlobalIds
        || (Array.isArray(value.global) ? value.global.map((item) => item?.id || item) : []),
      ).slice(0, PROMPT_TRUTH_AUDIT_LIMITS.globalArchive),
      selectedBookIds: normalizeEvidenceIds(
        value.selectedBookIds
        || (Array.isArray(value.books) ? value.books.map((item) => item?.id || item) : []),
      ).slice(0, PROMPT_TRUTH_AUDIT_LIMITS.memoryBooks),
      selectedLedgerIds: normalizeEvidenceIds(
        value.selectedLedgerIds
        || (Array.isArray(value.ledger) ? value.ledger.map((item) => item?.topicId || item?.id || item) : []),
      ).slice(0, PROMPT_TRUTH_AUDIT_LIMITS.researchLedger),
      renderedSessionIds: normalizeEvidenceIds(value.renderedSessionIds || [])
        .slice(0, PROMPT_TRUTH_AUDIT_LIMITS.sessionArchive),
      renderedGlobalIds: normalizeEvidenceIds(value.renderedGlobalIds || [])
        .slice(0, PROMPT_TRUTH_AUDIT_LIMITS.globalArchive),
      renderedBookIds: normalizeEvidenceIds(value.renderedBookIds || [])
        .slice(0, PROMPT_TRUTH_AUDIT_LIMITS.memoryBooks),
      renderedLedgerIds: normalizeEvidenceIds(value.renderedLedgerIds || [])
        .slice(0, PROMPT_TRUTH_AUDIT_LIMITS.researchLedger),
      compression: {
        used: compression.used === true,
      },
      semanticReady: value.semanticReady === true,
      semanticDowngrade: value.semanticDowngrade === true,
    };
  }

  function normalizeAuditArtifactSummary(raw = {}) {
    const value = raw && typeof raw === 'object' ? raw : {};
    const authority = value.authority && typeof value.authority === 'object' ? value.authority : {};
    const approximatePath = value.approximatePath && typeof value.approximatePath === 'object'
      ? value.approximatePath
      : (value.modelAdvisory?.approximatePath && typeof value.modelAdvisory.approximatePath === 'object'
        ? value.modelAdvisory.approximatePath
        : {});
    const researchLedgerRendered = preferRenderedCompatibilityBoolean(
      value.researchLedgerRendered,
      value.researchLedgerPromptInjected,
      false,
    );
    return {
      kind: trimText(value.kind || '', 80) || 'unknown',
      authority: {
        reply: trimText(authority.reply || value.reply || '', 80) || 'unknown',
      },
      approximatePath: {
        status: trimText(approximatePath.status || '', 80) || 'exact',
      },
      researchLedgerRendered,
      researchLedgerPromptInjected: researchLedgerRendered,
    };
  }

  function normalizeAuditResearchLedger(raw = {}) {
    const value = raw && typeof raw === 'object' ? raw : {};
    const requestedStatus = String(value.updateStatus || value.status || '').trim();
    return {
      updateStatus: ['skipped', 'applied', 'failed'].includes(requestedStatus) ? requestedStatus : 'skipped',
      topicId: trimText(value.topicId || '', 140),
      topicLabel: trimText(value.topicLabel || '', 180),
    };
  }

  function normalizeRecentAuditSlice(raw = {}) {
    const value = raw && typeof raw === 'object' ? raw : {};
    const usedAt = trimIso(value.usedAt, '');
    const userTextExcerpt = trimText(value.userTextExcerpt || value.userText || '', 220);
    const turnId = trimText(
      value.turnId
      || (usedAt || userTextExcerpt
        ? `audit-${stableHash(`${usedAt}|${userTextExcerpt}`).slice(0, 12)}`
        : ''),
      160,
    );
    if (!turnId) return null;
    return {
      turnId,
      usedAt,
      userTextExcerpt,
      selectedLane: trimText(value.selectedLane || '', 40) || 'chat',
      requestedMode: trimText(value.requestedMode || '', 40) || 'local',
      executionPath: trimText(value.executionPath || '', 80) || 'llm-chat',
      retrieval: normalizeAuditRetrievalSummary(value.retrieval),
      promptTruth: normalizeAuditPromptTruth(value.promptTruth),
      artifactSummary: normalizeAuditArtifactSummary(value.artifactSummary),
      researchLedger: normalizeAuditResearchLedger(value.researchLedger),
    };
  }

  function buildLastRetrievalRecord(raw = {}, {
    usedAt = '',
    provenance = [],
    summary = null,
  } = {}) {
    const value = raw && typeof raw === 'object' ? raw : null;
    const normalizedSummary = normalizeAuditRetrievalSummary(summary || value || {});
    if (!value) {
      if (!normalizedSummary) return null;
      return {
        usedAt: trimIso(usedAt, ''),
        mode: normalizedSummary.mode,
        reasonCode: normalizedSummary.reasonCode,
        embedModel: '',
        semanticReady: normalizedSummary.semanticReady,
        semanticAttempted: false,
        semanticDowngrade: normalizedSummary.semanticDowngrade,
        semanticDowngradeReason: '',
        session: [],
        global: [],
        books: [],
        provenance: normalizeProvenanceList(provenance, 6),
        compression: normalizeCompressionInfo({
          used: normalizedSummary.compression.used,
          chapters: [],
        }),
        summary: normalizedSummary,
      };
    }
    return {
      usedAt: trimIso(value.usedAt || usedAt, usedAt),
      mode: normalizedSummary.mode,
      reasonCode: normalizedSummary.reasonCode,
      embedModel: String(value.embedModel || '').trim(),
      semanticReady: normalizedSummary.semanticReady,
      semanticAttempted: value.semanticAttempted === true,
      semanticDowngrade: normalizedSummary.semanticDowngrade,
      semanticDowngradeReason: trimText(value.semanticDowngradeReason || '', 80),
      session: Array.isArray(value.session) ? value.session.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
      global: Array.isArray(value.global) ? value.global.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
      books: Array.isArray(value.books) ? value.books.map(normalizeBookMatch).filter(Boolean).slice(0, 4) : [],
      provenance: normalizeProvenanceList(value.provenance || provenance, 6),
      compression: normalizeCompressionInfo(value.compression),
      summary: normalizedSummary,
    };
  }

  function appendRecentAuditSlice(currentTrail = [], rawSlice = null) {
    const slice = normalizeRecentAuditSlice(rawSlice);
    if (!slice) {
      return Array.isArray(currentTrail) ? currentTrail.slice(0, SESSION_RECENT_AUDIT_TRAIL_LIMIT) : [];
    }
    return [
      slice,
      ...(Array.isArray(currentTrail) ? currentTrail : []).filter((item) => String(item?.turnId || '').trim() !== slice.turnId),
    ].slice(0, SESSION_RECENT_AUDIT_TRAIL_LIMIT);
  }

  function normalizeSessionBucket(raw = {}, sessionId = 'default') {
    const bucket = buildSessionBucket(sessionId);
    bucket.episodes = Array.isArray(raw.episodes)
      ? raw.episodes.map(item => normalizeArchiveEntry(item, 'episode', sessionId)).filter(Boolean).slice(-160)
      : [];
    bucket.summaries = Array.isArray(raw.summaries)
      ? raw.summaries.map(item => normalizeArchiveEntry(item, item?.type || 'summary', sessionId)).filter(Boolean).slice(-24)
      : [];
    bucket.chapters = Array.isArray(raw.chapters)
      ? raw.chapters.map(item => normalizeSessionChapter(item, sessionId)).filter(Boolean).slice(-SESSION_CHAPTER_LIMIT)
      : [];
    bucket.provenance = normalizeProvenanceList(raw.provenance, SESSION_PROVENANCE_LIMIT);
    bucket.activeContradictions = normalizeContradictionList(raw.activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT);
    bucket.openLoops = Array.isArray(raw.openLoops)
      ? raw.openLoops.map(normalizeOpenLoop).filter(Boolean).slice(-16)
      : [];
    bucket.recentAuditTrail = Array.isArray(raw.recentAuditTrail)
      ? raw.recentAuditTrail.map(normalizeRecentAuditSlice).filter(Boolean).slice(0, SESSION_RECENT_AUDIT_TRAIL_LIMIT)
      : [];
    bucket.lastRetrieval = raw.lastRetrieval && typeof raw.lastRetrieval === 'object'
      ? buildLastRetrievalRecord(raw.lastRetrieval, {
          usedAt: raw.lastRetrieval.usedAt,
          provenance: raw.lastRetrieval.provenance,
          summary: raw.lastRetrieval.summary,
        })
      : null;
    if (!bucket.lastRetrieval && bucket.recentAuditTrail[0]?.retrieval) {
      bucket.lastRetrieval = buildLastRetrievalRecord(null, {
        usedAt: bucket.recentAuditTrail[0].usedAt,
        provenance: bucket.provenance,
        summary: bucket.recentAuditTrail[0].retrieval,
      });
    }
    if (bucket.lastRetrieval && bucket.recentAuditTrail[0]?.retrieval) {
      bucket.lastRetrieval.summary = normalizeAuditRetrievalSummary(bucket.recentAuditTrail[0].retrieval);
      bucket.lastRetrieval.mode = bucket.lastRetrieval.summary.mode;
      bucket.lastRetrieval.reasonCode = bucket.lastRetrieval.summary.reasonCode;
      bucket.lastRetrieval.semanticReady = bucket.lastRetrieval.summary.semanticReady;
      bucket.lastRetrieval.semanticDowngrade = bucket.lastRetrieval.summary.semanticDowngrade;
    }
    bucket.lastArchivedAt = trimIso(raw.lastArchivedAt, '');
    bucket.updatedAt = trimIso(raw.updatedAt, '');
    return bucket;
  }

  function normalizeArchiveStore(store = {}) {
    const base = buildArchiveStore(configuredEmbedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    });
    const parsed = store && typeof store === 'object' ? store : {};
    base.meta = {
      ...base.meta,
      ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      embedModel: normalizeEmbedModelId(configuredEmbedModel || (parsed.meta && parsed.meta.embedModel) || ''),
      reviewDecisions: parsed.meta?.reviewDecisions && typeof parsed.meta.reviewDecisions === 'object'
        ? { ...parsed.meta.reviewDecisions }
        : {},
      backgroundVectorization: normalizeBackgroundVectorizationStatus(parsed.meta?.backgroundVectorization, {
        enabled: backgroundChatVectorsEnabled,
        batchLimit: backgroundChatVectorBatchLimit,
      }),
    };
    base.global.episodes = Array.isArray(parsed.global?.episodes)
      ? parsed.global.episodes.map(item => normalizeArchiveEntry(item, 'episode', item?.sessionId || '')).filter(Boolean).slice(-500)
      : [];
    base.global.summaries = Array.isArray(parsed.global?.summaries)
      ? parsed.global.summaries.map(item => normalizeArchiveEntry(item, item?.type || 'summary', '')).filter(Boolean).slice(-24)
      : [];
    base.global.patterns = Array.isArray(parsed.global?.patterns)
      ? parsed.global.patterns.map(item => normalizeArchiveEntry(item, 'pattern', '')).filter(Boolean).slice(-80)
      : [];
    base.global.promotionQueue = Array.isArray(parsed.global?.promotionQueue)
      ? parsed.global.promotionQueue.map(item => normalizeArchiveEntry(item, 'promotion', item?.sessionId || '')).filter(Boolean).slice(-40)
      : [];
    const sessions = parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {};
    for (const [sessionId, rawBucket] of Object.entries(sessions)) {
      base.sessions[sessionId] = normalizeSessionBucket(rawBucket, sessionId);
    }
    return base;
  }

  function normalizeEmbeddingsStore(store = {}) {
    const base = buildEmbeddingsStore(configuredEmbedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    });
    const parsed = store && typeof store === 'object' ? store : {};
    base.meta = {
      ...base.meta,
      ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      schemaVersion: EMBEDDINGS_SCHEMA_VERSION,
      embedModel: normalizeEmbedModelId(configuredEmbedModel || (parsed.meta && parsed.meta.embedModel) || ''),
      updatedAt: trimIso(parsed.meta?.updatedAt, ''),
      backgroundVectorization: normalizeBackgroundVectorizationStatus(parsed.meta?.backgroundVectorization, {
        enabled: backgroundChatVectorsEnabled,
        batchLimit: backgroundChatVectorBatchLimit,
      }),
    };
    const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {};
    for (const [key, raw] of Object.entries(items)) {
      if (!raw || typeof raw !== 'object') continue;
      if (!Array.isArray(raw.vector) || !raw.vector.length) continue;
      if (!embeddingItemMatchesConfiguredModel(raw, base.meta.embedModel)) continue;
      base.items[key] = {
        hash: String(raw.hash || key).trim() || key,
        text: trimText(raw.text || '', 400),
        model: normalizeEmbedModelId(raw.model || base.meta.embedModel || ''),
        updatedAt: trimIso(raw.updatedAt),
        vector: raw.vector.map(value => Number(value || 0)).filter(Number.isFinite),
        sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      };
    }
    return base;
  }

  function readArchiveStore() {
    ensureFile(ARCHIVE_FILE, () => buildArchiveStore(configuredEmbedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    }));
    try {
      const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      return normalizeArchiveStore(parsed);
    } catch {
      return normalizeArchiveStore();
    }
  }

  function writeArchiveStore(store = {}) {
    ensureFile(ARCHIVE_FILE, () => buildArchiveStore(configuredEmbedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    }));
    const normalized = normalizeArchiveStore(store);
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: ARCHIVE_FILE,
      value: normalized,
    });
    return normalized;
  }

  function readEmbeddingsStore() {
    ensureFile(EMBEDDINGS_FILE, () => buildEmbeddingsStore(configuredEmbedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    }));
    try {
      const raw = fs.readFileSync(EMBEDDINGS_FILE, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      return normalizeEmbeddingsStore(parsed);
    } catch {
      return normalizeEmbeddingsStore();
    }
  }

  function compareIsoStrings(left = '', right = '') {
    const leftMs = Date.parse(String(left || '').trim());
    const rightMs = Date.parse(String(right || '').trim());
    const leftValid = Number.isFinite(leftMs);
    const rightValid = Number.isFinite(rightMs);
    if (!leftValid && !rightValid) return 0;
    if (!leftValid) return -1;
    if (!rightValid) return 1;
    if (leftMs === rightMs) return 0;
    return leftMs > rightMs ? 1 : -1;
  }

  function pickPreferredEmbeddingItem(left = null, right = null) {
    if (!left) return right;
    if (!right) return left;
    const byUpdatedAt = compareIsoStrings(left.updatedAt, right.updatedAt);
    if (byUpdatedAt > 0) return left;
    if (byUpdatedAt < 0) return right;
    const leftVectorLength = Array.isArray(left.vector) ? left.vector.length : 0;
    const rightVectorLength = Array.isArray(right.vector) ? right.vector.length : 0;
    if (leftVectorLength > rightVectorLength) return left;
    if (leftVectorLength < rightVectorLength) return right;
    return right;
  }

  function pickPreferredBackgroundVectorizationStatus(left = {}, right = {}) {
    const normalizedLeft = normalizeBackgroundVectorizationStatus(left);
    const normalizedRight = normalizeBackgroundVectorizationStatus(right);
    const byAttemptedAt = compareIsoStrings(normalizedLeft.attemptedAt, normalizedRight.attemptedAt);
    if (byAttemptedAt > 0) return normalizedLeft;
    if (byAttemptedAt < 0) return normalizedRight;
    if (normalizedLeft.archivePending !== normalizedRight.archivePending) {
      return normalizedLeft.archivePending ? normalizedRight : normalizedLeft;
    }
    if (normalizedLeft.status !== normalizedRight.status) {
      if (normalizedLeft.status === 'failed' || normalizedRight.status === 'failed') {
        return normalizedLeft.status === 'failed' ? normalizedLeft : normalizedRight;
      }
      if (normalizedLeft.status === 'applied' || normalizedRight.status === 'applied') {
        return normalizedLeft.status === 'applied' ? normalizedLeft : normalizedRight;
      }
    }
    return normalizedRight;
  }

  function mergeEmbeddingsStore(baseStore = {}, incomingStore = {}) {
    const base = normalizeEmbeddingsStore(baseStore);
    const incoming = normalizeEmbeddingsStore(incomingStore);
    const mergedItems = { ...base.items };
    for (const [key, item] of Object.entries(incoming.items || {})) {
      mergedItems[key] = pickPreferredEmbeddingItem(mergedItems[key], item);
    }
    return normalizeEmbeddingsStore({
      meta: {
        ...base.meta,
        ...incoming.meta,
        updatedAt: compareIsoStrings(base.meta?.updatedAt, incoming.meta?.updatedAt) > 0
          ? base.meta?.updatedAt
          : incoming.meta?.updatedAt,
        backgroundVectorization: pickPreferredBackgroundVectorizationStatus(
          base.meta?.backgroundVectorization,
          incoming.meta?.backgroundVectorization,
        ),
      },
      items: mergedItems,
    });
  }

  function writeEmbeddingsStore(store = {}, { replace = false } = {}) {
    ensureFile(EMBEDDINGS_FILE, () => buildEmbeddingsStore(configuredEmbedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    }));
    const normalized = replace
      ? normalizeEmbeddingsStore(store)
      : mergeEmbeddingsStore(readEmbeddingsStore(), store);
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: EMBEDDINGS_FILE,
      value: normalized,
    });
    return normalized;
  }

  function ensureSessionStore(store = {}, sessionId = 'default') {
    const archive = store && typeof store === 'object' ? store : {};
    archive.sessions = archive.sessions && typeof archive.sessions === 'object' ? archive.sessions : {};
    archive.sessions[sessionId] = archive.sessions[sessionId]
      ? normalizeSessionBucket(archive.sessions[sessionId], sessionId)
      : buildSessionBucket(sessionId);
    return archive.sessions[sessionId];
  }

  function matchConfiguredModel(values = [], model = configuredEmbedModel) {
    if (!model) return false;
    return (values || []).some(value => modelComparator(value, model));
  }

  async function probeEmbeddingAvailability(model = configuredEmbedModel) {
    if (!model) return { ok: false, error: 'No embedding model is configured.' };
    if (!embeddingBase) return { ok: false, reachable: false, error: 'No embedding endpoint is configured.' };
    try {
      const response = await fetch(`${embeddingBase}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          input: 'penny semantic memory probe',
        }),
      });
      const bodyText = await response.text();
      if (!response.ok) {
        return {
          ok: false,
          reachable: true,
          error: `LM Studio embeddings error ${response.status}: ${bodyText}`.trim(),
        };
      }
      let parsed = {};
      try {
        parsed = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        parsed = {};
      }
      const vector = parseEmbeddingResponse(parsed);
      return {
        ok: Array.isArray(vector) && vector.length > 0,
        reachable: true,
        error: '',
      };
    } catch (error) {
      return { ok: false, reachable: false, error: String(error?.message || error).trim() };
    }
  }

  function buildProbeState({
    startedAt = '',
    finishedAt = '',
    durationMs = 0,
    cacheHit = false,
    expiresAt = 0,
    note = '',
  } = {}) {
    const safeStartedAt = trimIso(startedAt, '');
    const safeFinishedAt = trimIso(finishedAt, safeStartedAt);
    const checkedAt = safeFinishedAt || safeStartedAt;
    const checkedAtMs = checkedAt ? Date.parse(checkedAt) : 0;
    return {
      startedAt: safeStartedAt,
      finishedAt: safeFinishedAt,
      checkedAt,
      durationMs: Math.max(0, Math.round(Number(durationMs) || 0)),
      cacheHit: cacheHit === true,
      cacheAgeMs: checkedAtMs ? Math.max(0, Date.now() - checkedAtMs) : 0,
      cacheExpiresAt: Number.isFinite(expiresAt) && expiresAt > 0 ? new Date(expiresAt).toISOString() : '',
      note: String(note || '').trim(),
    };
  }

  function decorateSemanticStatus(value = {}, {
    startedAt = '',
    finishedAt = '',
    durationMs = 0,
    cacheHit = false,
    expiresAt = 0,
    note = '',
  } = {}) {
    return {
      ...(value && typeof value === 'object' ? value : {}),
      probe: buildProbeState({
        startedAt,
        finishedAt,
        durationMs,
        cacheHit,
        expiresAt,
        note: note || value?.reason || '',
      }),
    };
  }

  async function getSemanticMemoryStatus({ force = false, lmStatus = null } = {}) {
    const now = nowMs();
    if (!force && embedStatusCache.value && now < embedStatusCache.expiresAt) {
      return decorateSemanticStatus(embedStatusCache.value, {
        ...(embedStatusCache.value?.probe || {}),
        cacheHit: true,
        expiresAt: embedStatusCache.expiresAt,
      });
    }

    const probeStartedAt = new Date(now).toISOString();
    let status = lmStatus;
    if (!status && typeof getLmStudioConnectionStatus === 'function') {
      try {
        status = await getLmStudioConnectionStatus({ force });
      } catch {
        status = null;
      }
    }

    const installedModels = Array.isArray(status?.installedModels) ? status.installedModels : [];
    const runtimeModels = [
      ...(Array.isArray(status?.nativeAvailableModels) ? status.nativeAvailableModels : []),
      ...(Array.isArray(status?.availableModels) ? status.availableModels : []),
    ];
    const installed = matchConfiguredModel(installedModels);
    const listedAsLoaded = matchConfiguredModel(runtimeModels);
    const chatEndpointReachable = status?.reachable === true;
    const shouldProbe = hasDedicatedEmbeddingBase
      ? Boolean(configuredEmbedModel)
      : chatEndpointReachable && (installed || listedAsLoaded);
    const liveProbe = shouldProbe
      ? await probeEmbeddingAvailability()
      : { ok: false, reachable: false, error: '' };
    const reachable = hasDedicatedEmbeddingBase
      ? liveProbe.reachable !== false
      : chatEndpointReachable;
    const installReady = hasDedicatedEmbeddingBase
      ? reachable
      : installed || listedAsLoaded || liveProbe.ok;
    const loaded = hasDedicatedEmbeddingBase
      ? liveProbe.ok
      : listedAsLoaded || liveProbe.ok;
    const ready = !!configuredEmbedModel && reachable && installReady && liveProbe.ok;
    const value = {
      configuredModel: configuredEmbedModel,
      base: embeddingBase,
      reachable,
      installed: installReady,
      loaded,
      ready,
      active: ready,
      mode: ready ? 'semantic' : 'keyword',
      fallback: !ready,
      reason: !configuredEmbedModel
        ? 'No embedding model is configured.'
        : !reachable
          ? String(liveProbe.error || status?.error || 'LM Studio embeddings endpoint is unreachable.')
          : liveProbe.error
            ? liveProbe.error
          : !installReady
            ? `Embedding model ${configuredEmbedModel} is not installed in LM Studio.`
            : !loaded
              ? `Embedding model ${configuredEmbedModel} is installed but not currently ready.`
              : !ready && liveProbe.error
                ? liveProbe.error
               : '',
    };
    const expiresAt = now + (ready ? EMBEDDING_STATUS_CACHE_MS : EMBEDDING_ERROR_CACHE_MS);
    const probeFinishedAt = new Date(nowMs()).toISOString();
    const cachedValue = decorateSemanticStatus(value, {
      startedAt: probeStartedAt,
      finishedAt: probeFinishedAt,
      durationMs: Date.parse(probeFinishedAt) - now,
      cacheHit: false,
      expiresAt,
    });
    embedStatusCache = {
      expiresAt,
      value: cachedValue,
    };
    return cachedValue;
  }

  function parseEmbeddingResponse(payload = {}) {
    if (Array.isArray(payload?.data) && Array.isArray(payload.data[0]?.embedding)) {
      return payload.data[0].embedding.map(value => Number(value || 0)).filter(Number.isFinite);
    }
    if (Array.isArray(payload?.embedding)) {
      return payload.embedding.map(value => Number(value || 0)).filter(Number.isFinite);
    }
    if (Array.isArray(payload?.embeddings) && Array.isArray(payload.embeddings[0])) {
      return payload.embeddings[0].map(value => Number(value || 0)).filter(Number.isFinite);
    }
    return [];
  }

  async function createEmbedding(text = '', semanticStatus = null) {
    const status = semanticStatus || await getSemanticMemoryStatus();
    if (!status.ready) return null;
    const response = await fetch(`${embeddingBase}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${LMSTUDIO_API_KEY}`,
      },
      body: JSON.stringify({
        model: configuredEmbedModel,
        input: String(text || ''),
      }),
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`LM Studio embeddings error ${response.status}: ${bodyText}`.trim());
    }
    let parsed = {};
    try {
      parsed = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      parsed = {};
    }
    const vector = parseEmbeddingResponse(parsed);
    return vector.length ? vector : null;
  }

  async function ensureEmbeddingForText(text = '', embeddingsStore = null, semanticStatus = null) {
    const normalizedText = trimText(text, 1000);
    if (!normalizedText) return { embeddings: embeddingsStore || readEmbeddingsStore(), vector: null, created: false };
    const store = embeddingsStore || readEmbeddingsStore();
    const model = store.meta?.embedModel || configuredEmbedModel;
    const { item: existing, hash, legacyHash, migrated } = findEmbeddingCacheEntry(store, normalizedText, model);
    if (existing?.vector?.length) {
      if (migrated && legacyHash && legacyHash !== hash) {
        delete store.items[legacyHash];
        store.items[hash] = {
          ...existing,
          hash,
          model: normalizeEmbedModelId(existing.model || model || ''),
        };
        store.meta.updatedAt = new Date(nowMs()).toISOString();
      }
      return { embeddings: store, vector: existing.vector, created: false, hash, migrated };
    }
    const staleByHash = store.items[hash];
    const staleByLegacyHash = legacyHash && legacyHash !== hash ? store.items[legacyHash] : null;
    if (staleByHash && !embeddingItemMatchesConfiguredModel(staleByHash, model)) {
      delete store.items[hash];
    }
    if (staleByLegacyHash && !embeddingItemMatchesConfiguredModel(staleByLegacyHash, model)) {
      delete store.items[legacyHash];
    }
    const vector = await createEmbedding(normalizedText, semanticStatus);
    if (!vector) return { embeddings: store, vector: null, created: false, hash };
    store.items[hash] = {
      hash,
      text: normalizedText,
      model: normalizeEmbedModelId(model || configuredEmbedModel || ''),
      updatedAt: new Date(nowMs()).toISOString(),
      vector,
      sensitivity: classifySensitivity(normalizedText),
    };
    store.meta.updatedAt = new Date(nowMs()).toISOString();
    return { embeddings: store, vector, created: true, hash };
  }

  function uniqueCandidateList(items = [], limit = 2) {
    const out = [];
    const seen = new Set();
    for (const item of items) {
      const text = trimText(item?.text || '', 220);
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      out.push({ ...item, text });
      if (out.length >= limit) break;
    }
    return out;
  }

  function buildRollingSummaryText(prefix = 'Recent threads', texts = [], minEvidence = 2) {
    const phrases = countPhrases(texts, minEvidence).slice(0, 4);
    if (!phrases.length) return '';
    return trimText(`${prefix}: ${phrases.map(([phrase]) => phrase).join('; ')}.`, 220);
  }

  function normalizeSearchText(value = '') {
    return normalizeText(value || '').toLowerCase();
  }

  function textMentionsNeedle(text = '', needle = '') {
    const normalizedNeedle = normalizeSearchText(needle);
    if (!normalizedNeedle) return false;
    return normalizeSearchText(text).includes(normalizedNeedle);
  }

  function isActiveContradiction(item = {}) {
    return String(item?.status || 'active').trim().toLowerCase() === 'active';
  }

  function textReferencesContradiction(text = '', contradiction = {}) {
    if (!text || !contradiction || typeof contradiction !== 'object') return false;
    return [
      contradiction.conflictKey,
      contradiction.oldText,
      contradiction.newText,
    ].some((needle) => textMentionsNeedle(text, needle));
  }

  function contradictionTouchesEpisodeIds(contradiction = {}, sourceEpisodeIds = []) {
    const ids = new Set(normalizeEvidenceIds(sourceEpisodeIds));
    if (!ids.size) return false;
    if (ids.has(String(contradiction.sourceEpisodeId || '').trim())) return true;
    return normalizeEvidenceIds(contradiction.dependentEpisodeIds || []).some((id) => ids.has(id));
  }

  function appendUniqueId(values = [], id = '', limit = 12) {
    const nextId = String(id || '').trim();
    if (!nextId) return normalizeEvidenceIds(values).slice(-limit);
    return normalizeEvidenceIds([...(Array.isArray(values) ? values : []), nextId]).slice(-limit);
  }

  function findRelevantContradictionsForChunk(activeContradictions = [], sourceEpisodeIds = [], texts = []) {
    const chunkTexts = Array.isArray(texts) ? texts : [];
    return normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .filter(isActiveContradiction)
      .filter((item) => (
        contradictionTouchesEpisodeIds(item, sourceEpisodeIds)
        || chunkTexts.some((text) => textReferencesContradiction(text, item))
      ));
  }

  function formatContradictionForChapter(contradiction = {}) {
    const newText = trimText(contradiction.newText || '', 160);
    const oldText = trimText(contradiction.oldText || '', 160);
    if (!newText) return '';
    if (!oldText || oldText.toLowerCase() === newText.toLowerCase()) return newText;
    return `${newText} (replaces ${oldText})`;
  }

  const archivePolicyApi = createMemoryArchivePolicyApi({
    sessionActiveContradictionLimit: SESSION_ACTIVE_CONTRADICTION_LIMIT,
    sessionChapterLimit: SESSION_CHAPTER_LIMIT,
    sessionChapterTriggerCount: SESSION_CHAPTER_TRIGGER_COUNT,
    sessionRecencyProtectedEpisodeCount: SESSION_RECENCY_PROTECTED_EPISODES,
    compressionRetrievalConfidence: COMPRESSION_RETRIEVAL_CONFIDENCE,
    sessionPromptLimit: SESSION_PROMPT_LIMIT,
    archiveCompressionReasonCodes: ARCHIVE_COMPRESSION_REASON_CODES,
    chapterScaffoldingPatterns: CHAPTER_SCAFFOLDING_PATTERNS,
    chapterDetailBonusPatterns: CHAPTER_DETAIL_BONUS_PATTERNS,
    normalizeContradictionList,
    isActiveContradiction,
    textMentionsNeedle,
    trimText,
    findRelevantContradictionsForChunk,
    formatContradictionForChapter,
    buildRollingSummaryText,
    normalizeRetrievalItem,
    tokenizeMemoryText,
    cosineSimilarity,
    trimIso,
    normalizeEvidenceIds,
  });

  function collectRecentRetrievedEpisodeIds(session = {}) {
    const ids = new Set();
    const retrieval = session?.lastRetrieval && typeof session.lastRetrieval === 'object'
      ? session.lastRetrieval
      : {};
    for (const item of [
      ...(Array.isArray(retrieval.session) ? retrieval.session : []),
      ...(Array.isArray(retrieval.global) ? retrieval.global : []),
    ]) {
      for (const id of normalizeEvidenceIds(item?.sourceEpisodeIds || [])) ids.add(id);
      if (String(item?.sourceType || '').trim() === 'episode' && String(item?.id || '').trim()) {
        ids.add(String(item.id).trim());
      }
    }
    return ids;
  }

  function selectBackgroundVectorizationCandidates({
    session = {},
    embeddings = null,
    now = nowMs(),
  } = {}) {
    const embeddingsStore = embeddings && typeof embeddings === 'object'
      ? embeddings
      : readEmbeddingsStore();
    const activeContradictions = normalizeContradictionList(session.activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .filter(isActiveContradiction);
    const recentRetrievedEpisodeIds = collectRecentRetrievedEpisodeIds(session);
    return (Array.isArray(session.episodes) ? session.episodes.slice(-12) : [])
      .map((episode) => {
        const text = trimText(episode?.text || '', 1000);
        if (!text) return null;
        const { item: existing, hash } = findEmbeddingCacheEntry(
          embeddingsStore,
          text,
          embeddingsStore?.meta?.embedModel || configuredEmbedModel,
        );
        if (existing?.vector?.length) return null;
        const contradictionLinked = activeContradictions.some((item) => (
          contradictionTouchesEpisodeIds(item, [episode?.id])
          || textReferencesContradiction(text, item)
        ));
        const openLoopLinked = (Array.isArray(session.openLoops) ? session.openLoops : [])
          .some((item) => textMentionsNeedle(text, item?.text || ''));
        const recentlyRetrieved = recentRetrievedEpisodeIds.has(String(episode?.id || '').trim());
        const candidate = archivePolicyApi.buildArchiveCandidate({
          ...episode,
          text,
          evidenceCount: episode?.evidenceCount || 1,
          contradictionLinked,
          openLoopLinked,
          recentlyRetrieved,
        }, 'session', 'episode');
        const utility = archivePolicyApi.scoreArchiveUtilityCandidate(candidate, now);
        return {
          ...candidate,
          hash,
          utilityScore: utility.score,
          ageDays: utility.ageDays,
          contradictionLinked,
          openLoopLinked,
          recentlyRetrieved,
          evidenceSnippet: trimText(text, 160),
        };
      })
      .filter(Boolean)
      .sort((left, right) => right.utilityScore - left.utilityScore
        || String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
  }

  function applyBackgroundVectorizationStatus(archive = {}, embeddings = {}, status = {}) {
    const normalizedStatus = normalizeBackgroundVectorizationStatus(status, {
      enabled: backgroundChatVectorsEnabled,
      batchLimit: backgroundChatVectorBatchLimit,
    });
    archive.meta = archive.meta && typeof archive.meta === 'object' ? archive.meta : {};
    embeddings.meta = embeddings.meta && typeof embeddings.meta === 'object' ? embeddings.meta : {};
    archive.meta.backgroundVectorization = normalizedStatus;
    embeddings.meta.backgroundVectorization = normalizedStatus;
    return normalizedStatus;
  }

  async function runBackgroundVectorizationPrewarm({
    archive = {},
    session = {},
    semanticMemory = null,
    embeddings = null,
    now = nowMs(),
  } = {}) {
    const attemptedAt = new Date(now).toISOString();
    const workingEmbeddings = embeddings && typeof embeddings === 'object'
      ? embeddings
      : readEmbeddingsStore();
    const baseStatus = {
      enabled: backgroundChatVectorsEnabled,
      sourceSessionId: String(session?.sessionId || '').trim(),
      semanticReady: semanticMemory?.ready === true,
      archivePending: false,
      attemptedAt,
      batchLimit: backgroundChatVectorBatchLimit,
    };
    if (!backgroundChatVectorsEnabled) {
      return {
        embeddings: workingEmbeddings,
        status: normalizeBackgroundVectorizationStatus({
          ...baseStatus,
          status: 'disabled',
        }),
      };
    }
    if (backgroundChatVectorBatchLimit < 1) {
      return {
        embeddings: workingEmbeddings,
        status: normalizeBackgroundVectorizationStatus({
          ...baseStatus,
          status: 'skipped',
          skippedReason: 'batch-limit-zero',
        }),
      };
    }
    if (!semanticMemory?.ready) {
      return {
        embeddings: workingEmbeddings,
        status: normalizeBackgroundVectorizationStatus({
          ...baseStatus,
          status: 'skipped',
          skippedReason: 'semantic-memory-not-ready',
        }),
      };
    }

    const selectedCandidates = selectBackgroundVectorizationCandidates({
      session,
      embeddings: workingEmbeddings,
      now,
    }).slice(0, backgroundChatVectorBatchLimit);

    if (!selectedCandidates.length) {
      return {
        embeddings: workingEmbeddings,
        status: normalizeBackgroundVectorizationStatus({
          ...baseStatus,
          status: 'skipped',
          skippedReason: 'no-unvectorized-candidates',
        }),
      };
    }

    let createdCount = 0;
    let failureMessage = '';
    let nextEmbeddings = workingEmbeddings;
    for (const candidate of selectedCandidates) {
      try {
        const embedded = await ensureEmbeddingForText(candidate.text, nextEmbeddings, semanticMemory);
        nextEmbeddings = embedded.embeddings;
        candidate.created = embedded.created === true;
        if (candidate.created) createdCount += 1;
      } catch (error) {
        candidate.created = false;
        if (!failureMessage) failureMessage = String(error?.message || error || '').trim();
      }
    }

    return {
      embeddings: nextEmbeddings,
      status: normalizeBackgroundVectorizationStatus({
        ...baseStatus,
        status: failureMessage && createdCount === 0 ? 'failed' : 'applied',
        skippedReason: trimText(failureMessage, 120),
        backgroundCandidateCount: selectedCandidates.length,
        backgroundCreatedCount: createdCount,
        candidates: selectedCandidates,
      }),
    };
  }

  function attachEpisodeDependentsToContradictions(activeContradictions = [], episode = {}) {
    const episodeId = String(episode?.id || '').trim();
    if (!episodeId) return normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT);
    const episodeText = `${episode?.userText || ''}\n${episode?.assistantText || ''}\n${episode?.text || ''}`;
    return normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .map((item) => {
        if (episodeId === String(item.sourceEpisodeId || '').trim()) return item;
        if (!textReferencesContradiction(episodeText, item)) return item;
        return normalizeContradictionItem({
          ...item,
          updatedAt: trimIso(episode.updatedAt || episode.createdAt || item.updatedAt, item.updatedAt),
          dependentEpisodeIds: appendUniqueId(item.dependentEpisodeIds, episodeId, 12),
        });
      })
      .filter(Boolean);
  }

  function attachChapterDependentsToContradictions(activeContradictions = [], chapters = []) {
    return normalizeContradictionList(activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .map((item) => {
        let next = item;
        for (const chapter of Array.isArray(chapters) ? chapters : []) {
          const chapterId = String(chapter?.id || '').trim();
          if (!chapterId) continue;
          if (!contradictionTouchesEpisodeIds(item, chapter.sourceEpisodeIds) && !textReferencesContradiction(chapter.text, item)) continue;
          next = normalizeContradictionItem({
            ...next,
            updatedAt: trimIso(chapter.updatedAt || chapter.createdAt || next.updatedAt, next.updatedAt),
            dependentChapterIds: appendUniqueId(next.dependentChapterIds, chapterId, 8),
          });
        }
        return next;
      })
      .filter(Boolean);
  }

  function buildCompressionExplanation({
    chapterItems = [],
    session = {},
    carriedContradictions = [],
  } = {}) {
    return archivePolicyApi.buildCompressionExplanation({
      chapterItems,
      session,
      carriedContradictions,
    });
  }

  async function buildArchiveContext({
    sessionId = 'default',
    userText = '',
    lane = 'chat',
    now = nowMs(),
    sessionPromptLimit = SESSION_PROMPT_LIMIT,
    globalPromptLimit = GLOBAL_PROMPT_LIMIT,
    allowSemanticQuery = true,
    allowArchiveCompression = true,
    includeCandidateTrace = false,
    candidateTraceLimit = DEFAULT_CANDIDATE_TRACE_LIMIT,
    includeCandidateTraceLinks = false,
    candidateTraceLinkLimit = DEFAULT_CANDIDATE_LINK_TRACE_LIMIT,
    candidateTraceMemoryLinks = null,
    scoringProfile = archiveScoringProfile,
    memoryLinkScoring = configuredMemoryLinkScoring,
    includeRerankShadow = false,
    rerankShadowProvider = configuredRerankShadowProvider,
    rerankShadowInputTopK = null,
    queryStaticMemoryIndex = null,
    maxStaticOnlyRendered = 1,
    frameBudget = null,
  } = {}) {
    if (lane !== 'chat') {
      const semanticMemory = await getSemanticMemoryStatus();
      return {
        archiveContext: null,
        retrieval: null,
        semanticMemory,
      };
    }

    const archive = readArchiveStore();
    const session = ensureSessionStore(archive, sessionId);
    const activeContradictions = normalizeContradictionList(session.activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .filter(isActiveContradiction);
    const semanticMemory = await getSemanticMemoryStatus();
    const queryTokens = new Set(tokenizeMemoryText(userText));
    let queryVector = null;
    let embeddings = null;
    const semanticAttempted = semanticMemory.ready && allowSemanticQuery;
    let semanticDowngrade = false;
    let semanticDowngradeReason = '';
    let shouldIncludeCandidateTrace = includeCandidateTrace === true || includeCandidateTraceLinks === true;
    const shouldIncludeRerankShadow = shouldIncludeCandidateTrace && includeRerankShadow === true;
    const activeScoringProfile = normalizeArchiveScoringProfile(scoringProfile);
    const activeMemoryLinkScoring = normalizeMemoryLinkScoringMode(memoryLinkScoring);
    const activeRerankShadowProvider = normalizeRerankShadowProvider(rerankShadowProvider);
    const traceLimit = normalizeCandidateTraceLimit(candidateTraceLimit);
    const shouldAttachCandidateTraceLinks = shouldIncludeCandidateTrace && includeCandidateTraceLinks === true;
    const linkTraceLimit = normalizeCandidateLinkTraceLimit(candidateTraceLinkLimit);
    const suppliedCandidateMemoryLinks = normalizeTraceCandidateMemoryLinks(
      candidateTraceMemoryLinks,
      new Date(now).toISOString(),
    );
    const staticOnlyRenderedCap = normalizeStaticOnlyRenderedCap(maxStaticOnlyRendered);
    const traceCandidates = [];
    const rerankShadowRuns = [];
    let staticEmbeddingShadow = null;
    let staticMemoryIndexResult = null;
    const frameBudgetConfig = frameBudget && typeof frameBudget === 'object' ? frameBudget : null;
    const cachedStaticMemoryIndexResult = normalizeCachedStaticMemoryIndexResult(
      frameBudgetConfig?.cachedStaticMemoryIndexResult
        || frameBudgetConfig?.cachedStaticResult
        || frameBudgetConfig?.staticMemoryIndexResult,
    );
    const sourceSensitiveBudget = frameBudgetConfig
      ? (
        frameBudgetConfig.sourceSensitive === true
        || frameBudgetConfig.highRisk === true
        || queryTouchesActiveContradiction(userText, activeContradictions)
      )
      : false;
    let candidateMergeBudget = frameBudgetConfig
      ? buildCandidateMergeFrameBudgetPlan({
        ...frameBudgetConfig,
        sourceSensitive: sourceSensitiveBudget,
        staticExpansionEnabled: typeof queryStaticMemoryIndex === 'function' || !!cachedStaticMemoryIndexResult,
        cachedStaticCandidateCount: countStaticMemoryCandidates(cachedStaticMemoryIndexResult),
        maxStaticCandidates: frameBudgetConfig.maxStaticCandidates
          ?? frameBudgetConfig.staticMaxCandidates
          ?? frameBudgetConfig.staticCandidateLimit
          ?? null,
      })
      : null;
    if (candidateMergeBudget) shouldIncludeCandidateTrace = true;
    const openLoopBudgetSelection = archivePolicyApi.selectOpenLoopsForCandidateMergeBudget(session.openLoops, {
      skipLowPriority: candidateMergeBudget?.openLoops?.skipLowPriority === true,
    });
    const candidateMergeOpenLoops = openLoopBudgetSelection.openLoops;

    if (typeof queryStaticMemoryIndex === 'function') {
      const staticExpansionMode = candidateMergeBudget?.staticExpansion?.mode || 'full';
      const staticExpansionBudgetMs = frameBudgetConfig?.staticMemoryBudgetMs
        ?? frameBudgetConfig?.staticExpansionBudgetMs
        ?? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY;
      if (staticExpansionMode === 'cached-only' && cachedStaticMemoryIndexResult) {
        staticMemoryIndexResult = buildCachedStaticExpansionResult(
          limitStaticMemoryIndexCandidates(
            cachedStaticMemoryIndexResult,
            candidateMergeBudget?.staticExpansion?.maxCandidates,
          ),
          { budgetMs: staticExpansionBudgetMs },
        );
        staticEmbeddingShadow = normalizeStaticEmbeddingShadowResult(staticMemoryIndexResult);
      } else if (staticExpansionMode === 'skipped') {
        staticMemoryIndexResult = buildSkippedStaticExpansionResult({
          reason: candidateMergeBudget?.staticExpansion?.reason || 'pre-prompt-budget-exhausted',
          mode: frameBudgetConfig?.staticMode || 'live-advisory',
          budgetMs: staticExpansionBudgetMs,
        });
        staticEmbeddingShadow = normalizeStaticEmbeddingShadowResult(staticMemoryIndexResult);
      } else {
        try {
          staticMemoryIndexResult = await queryStaticMemoryIndex(userText, {
            maxCandidates: candidateMergeBudget?.staticExpansion?.maxCandidates ?? undefined,
            budgetMs: staticExpansionBudgetMs,
            frameBudget: candidateMergeBudget?.staticExpansion || null,
          });
          staticMemoryIndexResult = limitStaticMemoryIndexCandidates(
            staticMemoryIndexResult,
            candidateMergeBudget?.staticExpansion?.maxCandidates,
          );
          staticEmbeddingShadow = normalizeStaticEmbeddingShadowResult(staticMemoryIndexResult);
        } catch (error) {
          staticMemoryIndexResult = {
            skipped: true,
            reason: String(error?.message || error || 'static-memory-index-query-failed').trim(),
            candidates: [],
            queryMs: 0,
            status: {
              mode: 'live-shadow',
            },
          };
          staticEmbeddingShadow = normalizeStaticEmbeddingShadowResult({
            skipped: true,
            reason: String(error?.message || error || 'static-memory-index-query-failed').trim(),
            candidates: [],
            queryMs: 0,
            status: {
              mode: 'live-shadow',
            },
          });
        }
      }
    } else if (candidateMergeBudget?.staticExpansion?.mode === 'cached-only' && cachedStaticMemoryIndexResult) {
      staticMemoryIndexResult = buildCachedStaticExpansionResult(
        limitStaticMemoryIndexCandidates(
          cachedStaticMemoryIndexResult,
          candidateMergeBudget?.staticExpansion?.maxCandidates,
        ),
        {
          budgetMs: frameBudgetConfig?.staticMemoryBudgetMs
            ?? frameBudgetConfig?.staticExpansionBudgetMs
            ?? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY,
        },
      );
      staticEmbeddingShadow = normalizeStaticEmbeddingShadowResult(staticMemoryIndexResult);
    }

    if (semanticAttempted) {
      try {
        const embedded = await ensureEmbeddingForText(userText, readEmbeddingsStore(), semanticMemory);
        embeddings = embedded.embeddings;
        queryVector = Array.isArray(embedded.vector) && embedded.vector.length ? embedded.vector : null;
        if (!queryVector) {
          semanticDowngrade = true;
          semanticDowngradeReason = 'query-vector-unavailable';
        }
        if (embedded.created || embedded.migrated) writeEmbeddingsStore(embeddings);
      } catch {
        queryVector = null;
        semanticDowngrade = true;
        semanticDowngradeReason = 'query-embedding-failed';
      }
    }

    const candidateGroups = {
      session: [
        ...session.episodes.slice(-48).map(item => archivePolicyApi.buildArchiveCandidate(item, 'session', 'episode')),
        ...session.summaries.slice(-12).map(item => archivePolicyApi.buildArchiveCandidate(item, 'session', item.type || 'summary')),
      ],
      chapters: [
        ...session.chapters.slice(-SESSION_CHAPTER_LIMIT).map(item => archivePolicyApi.buildArchiveCandidate(item, 'session', item.sourceType || 'chapter')),
      ],
      global: [
        ...archive.global.summaries.slice(-16).map(item => archivePolicyApi.buildArchiveCandidate(item, 'global', 'summary')),
        ...archive.global.patterns.slice(-16).map(item => archivePolicyApi.buildArchiveCandidate(item, 'global', 'pattern')),
      ],
    };
    let staticAdvisorySummary = {
      enabled: false,
      candidateCount: 0,
      mergedCandidateCount: 0,
      staticOnlyCandidateCount: 0,
    };
    if (
      isStaticAdvisoryMode(staticEmbeddingShadow?.mode)
      && staticMemoryIndexResult?.skipped !== true
      && Array.isArray(staticMemoryIndexResult?.candidates)
    ) {
      staticAdvisorySummary = mergeStaticAdvisoryCandidates(candidateGroups, staticMemoryIndexResult.candidates, {
        sessionId,
        queryMs: staticEmbeddingShadow?.queryMs || staticMemoryIndexResult?.queryMs || 0,
      });
      if (staticAdvisorySummary.candidateCount > 0) shouldIncludeCandidateTrace = true;
      staticEmbeddingShadow = compactCandidateTraceObject({
        ...staticEmbeddingShadow,
        candidatePoolMerged: true,
        mergedCandidateCount: staticAdvisorySummary.mergedCandidateCount,
        staticOnlyCandidateCount: staticAdvisorySummary.staticOnlyCandidateCount,
        staticOnlyRenderedCap,
      });
    }

    async function rankGroupDetailed(items = [], limit = 2, group = 'archive', {
      staticOnlyCapState = null,
    } = {}) {
      const ranked = [];
      const filtered = [];
      let workingEmbeddings = embeddings || readEmbeddingsStore();
      for (const item of items) {
        const scoringItem = isStaticOnlyArchiveCandidate(item) && candidateTouchesContradictionSource(item, activeContradictions)
          ? { ...item, contradictionLinked: true }
          : item;
        let vector = null;
        if (queryVector && semanticMemory.ready) {
          try {
            const embedded = await ensureEmbeddingForText(scoringItem.text, workingEmbeddings, semanticMemory);
            workingEmbeddings = embedded.embeddings;
            vector = embedded.vector;
          } catch {
            vector = null;
          }
        }
        const scored = archivePolicyApi.scoreArchiveCandidateWithProfile(scoringItem, {
          scoringProfile: activeScoringProfile,
          memoryLinkScoring: activeMemoryLinkScoring,
          queryText: userText,
          queryTokens,
          now,
          queryVector,
          vector,
          activeContradictions,
          openLoops: candidateMergeOpenLoops,
          memoryLinks: suppliedCandidateMemoryLinks,
        });
        const staticEligibility = staticAdvisoryEligibility(scoringItem, scored, {
          userText,
          activeContradictions,
        });
        const score = Number.isFinite(Number(scored.activeScore)) ? Number(scored.activeScore) : 0;
        const scoreComponents = scored.activeScoreComponents && typeof scored.activeScoreComponents === 'object'
          ? scored.activeScoreComponents
          : null;
        const scoreReasons = Array.isArray(scored.activeScoreReasons) ? scored.activeScoreReasons : [];
        const matchedTokens = Array.isArray(scored.baselineOverlapTokens) ? scored.baselineOverlapTokens : [];
        const candidate = {
          ...scoringItem,
          score,
          confidence: Number.isFinite(Number(scored.activeConfidence))
            ? Number(scored.activeConfidence)
            : Math.max(0, Math.min(1, score / 12)),
          scoringProfile: scored.scoringProfile,
          memoryLinkScoring: scored.memoryLinkScoring,
          activeScore: score,
          activeScoreComponents: scoreComponents,
          activeScoreReasons: scoreReasons,
          linkActiveScore: scored.linkActiveScore,
          ...(scored.scoringProfile === ARCHIVE_SCORING_PROFILES.HYBRID_V1 ? { baselineScore: scored.baselineScore } : {}),
          ...(scored.scoringProfile === ARCHIVE_SCORING_PROFILES.BASELINE ? { hybridShadowScore: scored.hybridV1Score } : {}),
          scoreComponents,
          scoreReasons,
          matchedTokens,
          evidenceSnippet: trimText(scored.baselineEvidenceSnippet || item.text || '', 160),
        };
        candidate.shadowScores = {
          hybridV1: {
            ...scored.hybridV1,
            score: scored.hybridV1Score,
            components: scored.hybridV1Components,
            reasons: scored.hybridV1Reasons,
          },
        };
        if (item.sensitivity === 'high' && scored.baselineScore < SENSITIVE_RETRIEVAL_THRESHOLD) {
          if (shouldIncludeCandidateTrace) {
            filtered.push({
              item: candidate,
              eligibility: {
                eligible: false,
                filtered: true,
                filterReason: 'sensitive-low-confidence',
              },
            });
          }
          continue;
        }
        if (staticEligibility.eligible === false) {
          if (shouldIncludeCandidateTrace) {
            filtered.push({
              item: candidate,
              eligibility: staticEligibility,
            });
          }
          continue;
        }
        ranked.push(candidate);
      }
      if (workingEmbeddings !== embeddings) {
        embeddings = workingEmbeddings;
        writeEmbeddingsStore(embeddings);
      }
      ranked.sort((left, right) => right.score - left.score || String(right.createdAt).localeCompare(String(left.createdAt)));
      const selection = selectUniqueCandidatesForPrompt(ranked, limit, { staticOnlyCapState });
      const selected = selection.selected;
      if (shouldIncludeRerankShadow) {
        const requestedInputTopK = Number(rerankShadowInputTopK);
        const inputTopK = Number.isFinite(requestedInputTopK) && requestedInputTopK > 0
          ? Math.min(ranked.length, Math.floor(requestedInputTopK))
          : ranked.length;
        const rerankInput = ranked.slice(0, inputTopK);
        const rerankResult = archivePolicyApi.rerankShadowCandidates(rerankInput, userText, {
          provider: activeRerankShadowProvider,
          inputTopK,
          selectedLimit: limit,
          activeContradictions,
          openLoops: candidateMergeOpenLoops,
          now,
        });
        rerankShadowRuns.push({
          group,
          provider: rerankResult.provider,
          measurementMode: rerankResult.measurementMode,
          inputTopK,
          outputTopK: Math.max(0, Number(limit || 0)),
          inputCount: rerankResult.inputCount,
          outputCount: Array.isArray(rerankResult.output) ? rerankResult.output.length : 0,
          latencyMs: rerankResult.latencyMs,
          unavailableReason: rerankResult.unavailableReason,
        });
        const rerankOutputById = new Map();
        for (const outputItem of Array.isArray(rerankResult.output) ? rerankResult.output : []) {
          const key = String(outputItem?.candidateId || '').trim();
          if (key && !rerankOutputById.has(key)) rerankOutputById.set(key, outputItem);
        }
        ranked.forEach((item, index) => {
          const inputRank = index + 1;
          const outputItem = rerankOutputById.get(String(item.id || '').trim());
          const reasons = outputItem
            ? normalizeArchiveScoreReasons(outputItem.reasons)
            : (rerankResult.unavailableReason
              ? [`unavailable:${rerankResult.unavailableReason}`]
              : (inputRank > inputTopK ? ['outside-rerank-input-top-k'] : []));
          item.rerankShadow = {
            provider: rerankResult.provider,
            measurementMode: rerankResult.measurementMode,
            inputRank,
            outputRank: Number.isFinite(Number(outputItem?.rerankRank)) ? Number(outputItem.rerankRank) : null,
            score: Number.isFinite(Number(outputItem?.rerankScore)) ? Number(outputItem.rerankScore) : null,
            wouldSelect: outputItem?.wouldSelect === true,
            latencyMs: rerankResult.latencyMs,
            reasons,
          };
        });
      }
      if (shouldIncludeCandidateTrace) {
        const shadowRanked = ranked
          .slice()
          .sort((left, right) => {
            const rightScore = Number(right.shadowScores?.hybridV1?.score || 0);
            const leftScore = Number(left.shadowScores?.hybridV1?.score || 0);
            return rightScore - leftScore
              || right.score - left.score
              || String(right.createdAt).localeCompare(String(left.createdAt));
          });
        const shadowRanks = new Map();
        shadowRanked.forEach((item, index) => {
          const key = archiveCandidateTraceKey(item);
          if (key && !shadowRanks.has(key)) shadowRanks.set(key, index + 1);
        });
        const shadowSelectedKeys = new Set(
          uniqueCandidateList(shadowRanked, limit)
            .map(archiveCandidateTraceKey)
            .filter(Boolean),
        );
        ranked.forEach((item, index) => {
          const shadow = item.shadowScores?.hybridV1;
          if (!shadow) return;
          const key = archiveCandidateTraceKey(item);
          const shadowRank = shadowRanks.get(key) || null;
          item.shadowScores = {
            ...item.shadowScores,
            hybridV1: {
              ...shadow,
              rank: shadowRank,
              wouldSelect: key ? shadowSelectedKeys.has(key) : false,
              rankDelta: shadowRank == null ? null : (index + 1) - shadowRank,
            },
          };
        });
        const selectedRanks = new Map();
        selected.forEach((item, index) => {
          const key = archiveCandidateTraceKey(item);
          if (key && !selectedRanks.has(key)) selectedRanks.set(key, index + 1);
        });
        ranked.forEach((item, index) => {
          const key = archiveCandidateTraceKey(item);
          const selectedRank = selectedRanks.get(key) || null;
          traceCandidates.push({
            item,
            group,
            rank: index + 1,
            ranked: true,
            selected: selectedRank !== null,
            selectedRank,
            heldBackReason: selection.holdbacks.get(key) || '',
            eligibility: {
              eligible: true,
              filtered: false,
              filterReason: '',
            },
          });
        });
        filtered.forEach((entry) => {
          traceCandidates.push({
            item: entry.item,
            group,
            rank: null,
            ranked: false,
            selected: false,
            selectedRank: null,
            eligibility: entry.eligibility,
          });
        });
      }
      return {
        ranked,
        selected,
        filteredCount: filtered.length,
        trace: shouldIncludeCandidateTrace ? traceCandidates : [],
      };
    }

    async function rankGroup(items = [], limit = 2, group = 'archive') {
      const result = await rankGroupDetailed(items, limit, group);
      return result.selected;
    }

    const staticOnlyCapState = staticAdvisorySummary.enabled
      ? { max: staticOnlyRenderedCap, used: 0 }
      : null;
    const candidateMergeStartedAt = frameBudgetConfig ? Date.now() : 0;
    const sessionRanking = await rankGroupDetailed(candidateGroups.session, sessionPromptLimit, 'session', {
      staticOnlyCapState,
    });
    const globalRanking = await rankGroupDetailed(candidateGroups.global, globalPromptLimit, 'global', {
      staticOnlyCapState,
    });
    const sessionItems = sessionRanking.selected;
    const globalItems = globalRanking.selected;
    const strongestConfidence = Math.max(
      Number(sessionItems[0]?.confidence || 0),
      Number(globalItems[0]?.confidence || 0),
    );
    const {
      combinedSessionItems,
      compression,
    } = await archivePolicyApi.buildCompressionState({
      candidateGroups: allowArchiveCompression ? candidateGroups : { ...candidateGroups, chapters: [] },
      session,
      semanticMemory,
      strongestConfidence,
      activeContradictions,
      sessionItems,
      rankGroup: (items, limit) => rankGroup(items, limit, 'chapters'),
    });
    if (frameBudgetConfig) {
      const staleCandidatesBlocked = traceCandidates.filter((entry) => (
        /stale-correction|correction-source|stale-contradiction/i.test(String(entry?.eligibility?.filterReason || entry?.heldBackReason || ''))
      )).length;
      const candidateCount = Number(sessionRanking.ranked?.length || 0)
        + Number(globalRanking.ranked?.length || 0)
        + Number(sessionRanking.filteredCount || 0)
        + Number(globalRanking.filteredCount || 0);
      const selectedCount = Number(sessionRanking.selected?.length || 0)
        + Number(globalRanking.selected?.length || 0);
      candidateMergeBudget = buildCandidateMergeFrameBudgetPlan({
        ...frameBudgetConfig,
        sourceSensitive: sourceSensitiveBudget,
        staticExpansionEnabled: typeof queryStaticMemoryIndex === 'function' || !!cachedStaticMemoryIndexResult,
        cachedStaticCandidateCount: countStaticMemoryCandidates(cachedStaticMemoryIndexResult),
        maxStaticCandidates: candidateMergeBudget?.staticExpansion?.maxCandidates
          ?? frameBudgetConfig.maxStaticCandidates
          ?? frameBudgetConfig.staticMaxCandidates
          ?? frameBudgetConfig.staticCandidateLimit
          ?? null,
        actualMs: Math.max(0, Date.now() - candidateMergeStartedAt),
        candidateCount,
        staticCandidateCount: staticAdvisorySummary.candidateCount,
        openLoopOriginalCount: openLoopBudgetSelection.totalCount,
        openLoopCount: openLoopBudgetSelection.scoredCount,
        skippedLowPriorityOpenLoopCount: openLoopBudgetSelection.skippedLowPriorityCount,
        selectedCount,
        renderedCount: combinedSessionItems.length + globalItems.length,
        staleCandidatesBlocked,
        sourceChecksRun: activeContradictions.length ? candidateCount : 0,
      });
    }
    const renderedCandidateKeys = new Set(
      [...combinedSessionItems, ...globalItems].map(archiveCandidateTraceKey).filter(Boolean),
    );
    const staticTraceCandidates = !staticAdvisorySummary.enabled && Array.isArray(staticEmbeddingShadow?.topCandidates)
      ? staticEmbeddingShadow.topCandidates
      : [];
    const candidateMemoryLinkSet = shouldAttachCandidateTraceLinks
      ? buildCandidateTraceMemoryLinkSet({
          traceCandidates,
          activeContradictions,
          suppliedLinks: candidateTraceMemoryLinks,
          generatedAt: new Date(now).toISOString(),
        })
      : null;
    const archiveTraceCandidates = shouldIncludeCandidateTrace
      ? traceCandidates
        .slice(0, traceLimit)
        .map((entry) => buildArchiveCandidateTraceItem(entry.item, {
          group: entry.group,
          rank: entry.rank,
          selected: entry.selected,
          selectedRank: entry.selectedRank,
          rendered: renderedCandidateKeys.has(archiveCandidateTraceKey(entry.item)),
          ranked: entry.ranked,
          heldBackReason: entry.heldBackReason,
          eligibility: entry.eligibility,
          memoryLinks: candidateMemoryLinkSet?.links || null,
          linkTraceLimit,
        }))
      : [];
    const candidateTrace = shouldIncludeCandidateTrace || staticTraceCandidates.length
      ? [...archiveTraceCandidates, ...staticTraceCandidates]
        .slice(0, Math.max(traceLimit, staticTraceCandidates.length))
      : null;
    const retrieval = {
      usedAt: new Date(now).toISOString(),
      mode: semanticMemory.ready && queryVector ? 'semantic' : 'keyword',
      reasonCode: semanticMemory.ready && queryVector
        ? ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY
        : ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK,
      scoringProfile: activeScoringProfile,
      memoryLinkScoring: activeMemoryLinkScoring,
      embedModel: semanticMemory.ready ? configuredEmbedModel : '',
      semanticReady: semanticMemory.ready,
      semanticAttempted,
      semanticDowngrade,
      semanticDowngradeReason,
      session: combinedSessionItems.map(normalizeRetrievalItem).filter(Boolean),
      global: globalItems.map(normalizeRetrievalItem).filter(Boolean),
      compression,
      ...(shouldIncludeRerankShadow ? { rerankShadow: summarizeArchiveRerankShadowRuns(rerankShadowRuns) } : {}),
      ...(staticEmbeddingShadow ? { staticEmbeddingShadow } : {}),
      ...(staticAdvisorySummary.enabled ? {
        staticEmbeddingAdvisory: {
          candidateCount: staticAdvisorySummary.candidateCount,
          mergedCandidateCount: staticAdvisorySummary.mergedCandidateCount,
          staticOnlyCandidateCount: staticAdvisorySummary.staticOnlyCandidateCount,
          staticOnlyRenderedCap,
          staticOnlyRenderedCount: staticOnlyCapState?.used || 0,
        },
      } : {}),
      ...(candidateMergeBudget ? { candidateMergeBudget } : {}),
      ...(shouldIncludeCandidateTrace ? { candidateTrace } : {}),
    };
    if (!shouldIncludeCandidateTrace && staticTraceCandidates.length) {
      retrieval.candidateTrace = candidateTrace;
    }

    return {
      archiveContext: {
        mode: retrieval.mode,
        reasonCode: retrieval.reasonCode,
        scoringProfile: retrieval.scoringProfile,
        embedModel: retrieval.embedModel,
        session: retrieval.session,
        global: retrieval.global,
        provenance: session.provenance.slice(0, 2),
        activeContradictions: activeContradictions.slice(0, 3),
        semanticReady: semanticMemory.ready,
        semanticAttempted,
        semanticDowngrade,
        semanticDowngradeReason,
        compression,
        recencyProtection: buildRecencyProtection(session),
      },
      retrieval,
      semanticMemory,
    };
  }

  function enrichMemoriesForPrompt(memories = {}, archiveContext = null, runtimeAdvisories = null) {
    const advisories = runtimeAdvisories && typeof runtimeAdvisories === 'object'
      ? runtimeAdvisories
      : {};
    const next = {
      ...memories,
    };
    if (archiveContext) next.archiveContext = archiveContext;
    if (advisories.epistemicCaution && typeof advisories.epistemicCaution === 'object') {
      next.epistemicCaution = advisories.epistemicCaution;
    }
    if (advisories.archiveSynthesis && typeof advisories.archiveSynthesis === 'object') {
      next.archiveSynthesis = advisories.archiveSynthesis;
    }
    if (advisories.researchLedger && typeof advisories.researchLedger === 'object') {
      next.researchLedgerContext = advisories.researchLedger;
    }
    if (Object.prototype.hasOwnProperty.call(advisories, 'researchLedgerPromptEnabled')) {
      next.researchLedgerPromptEnabled = advisories.researchLedgerPromptEnabled !== false;
    }
    return next;
  }

  function rebuildOpenLoops(session = {}) {
    const loops = [];
    const seen = new Set();
    for (const episode of [...(session.episodes || [])].reverse()) {
      const text = trimText(episode.userText || episode.text || '', 180);
      if (!text || !text.includes('?')) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      loops.push({
        id: createId('loop'),
        text,
        createdAt: trimIso(episode.createdAt),
        status: 'open',
      });
      if (loops.length >= 8) break;
    }
    return loops.reverse();
  }

  function upsertById(items = [], next = {}) {
    const id = String(next.id || '').trim();
    if (!id) return items.slice();
    const index = items.findIndex(item => String(item?.id || '').trim() === id);
    if (index === -1) return [...items, next];
    const copy = items.slice();
    copy[index] = next;
    return copy;
  }

  function trimArchiveStore(store = {}) {
    const archive = normalizeArchiveStore(store);
    archive.global.episodes = archive.global.episodes.slice(-500);
    archive.global.summaries = archive.global.summaries.slice(-24);
    archive.global.patterns = archive.global.patterns.slice(-80);
    archive.global.promotionQueue = archive.global.promotionQueue.slice(-40);
    for (const sessionId of Object.keys(archive.sessions || {})) {
      const session = archive.sessions[sessionId];
      session.episodes = session.episodes.slice(-160);
      session.summaries = session.summaries.slice(-24);
      session.chapters = session.chapters.slice(-SESSION_CHAPTER_LIMIT);
      session.provenance = session.provenance.slice(-SESSION_PROVENANCE_LIMIT);
      session.activeContradictions = session.activeContradictions.slice(-SESSION_ACTIVE_CONTRADICTION_LIMIT);
      session.openLoops = session.openLoops.slice(-16);
    }
    return archive;
  }

  function looksLikeScaffoldingText(text = '') {
    return archivePolicyApi.looksLikeScaffoldingText(text);
  }

  function scoreChapterDetailText(text = '', activeContradictions = []) {
    return archivePolicyApi.scoreChapterDetailText(text, activeContradictions);
  }

  function buildSessionChapterText(texts = [], activeContradictions = [], sourceEpisodeIds = []) {
    return archivePolicyApi.buildSessionChapterText(texts, activeContradictions, sourceEpisodeIds);
  }

  function buildSessionChapters(session = {}) {
    return archivePolicyApi.buildSessionChapters(session)
      .map((item) => {
        const sourceEpisodeIds = Array.isArray(item.sourceEpisodeIds) ? item.sourceEpisodeIds : [];
        const createdAt = trimIso(item.createdAt, new Date(nowMs()).toISOString());
        return normalizeSessionChapter({
          id: `chapter:${stableHash(sourceEpisodeIds.join('|')).slice(0, 12)}`,
          sessionId: session.sessionId,
          createdAt,
          updatedAt: createdAt,
          text: item.summary,
          excerpt: item.summary,
          sourceEpisodeIds,
          confidence: item.confidence,
          mergeReason: item.mergeReason || 'chapter-detail-merge',
          mergeBasis: item.mergeBasis || [],
          discardedDetailSummary: item.discardedDetailSummary || [],
          omittedEpisodeCount: item.omittedEpisodeCount || 0,
          explanation: {
            selectedSignals: item.mergeBasis || [],
            penalties: item.discardedDetailSummary || [],
            omittedEpisodeCount: item.omittedEpisodeCount || 0,
            carriedContradictions: item.carriedContradictions || [],
          },
        }, session.sessionId);
      })
      .filter(Boolean)
      .slice(-SESSION_CHAPTER_LIMIT);
  }

  function applyProvenanceToContradictions(session = {}, provenanceItems = [], episode = {}, createdAt = '') {
    let contradictions = normalizeContradictionList(session.activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT);
    for (const provenanceItem of normalizeProvenanceList(provenanceItems, 4)) {
      const conflictKey = normalizeConflictKey(provenanceItem.conflictKey || provenanceItem.topicKey || '');
      if (!conflictKey) continue;
      const matchingActive = contradictions.find((item) => (
        isActiveContradiction(item)
        && item.conflictKey === conflictKey
        && item.oldText.toLowerCase() === provenanceItem.oldText.toLowerCase()
        && item.newText.toLowerCase() === provenanceItem.newText.toLowerCase()
      ));
      if (matchingActive) {
        contradictions = contradictions.map((item) => {
          if (item.id !== matchingActive.id) return item;
          return normalizeContradictionItem({
            ...item,
            updatedAt: createdAt || item.updatedAt,
            trigger: provenanceItem.trigger || item.trigger,
            sourceEpisodeId: provenanceItem.sourceEpisodeId || item.sourceEpisodeId,
          }, session.sessionId);
        }).filter(Boolean);
        continue;
      }
      contradictions = contradictions.map((item) => {
        if (!isActiveContradiction(item) || item.conflictKey !== conflictKey) return item;
        return normalizeContradictionItem({
          ...item,
          status: 'superseded',
          updatedAt: createdAt || item.updatedAt,
          supersededAt: createdAt || item.supersededAt || item.updatedAt,
        }, session.sessionId);
      }).filter(Boolean);
      const next = normalizeContradictionItem({
        ...provenanceItem,
        conflictKey,
        sessionId: session.sessionId,
        sourceEpisodeId: provenanceItem.sourceEpisodeId || episode.id,
        status: 'active',
        createdAt: provenanceItem.createdAt || createdAt,
        updatedAt: createdAt || provenanceItem.updatedAt || provenanceItem.createdAt,
      }, session.sessionId);
      if (next) contradictions = [next, ...contradictions];
    }
    contradictions = attachEpisodeDependentsToContradictions(contradictions, episode);
    return normalizeContradictionList(contradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT);
  }

  function rebuildGlobalPatterns(archive = {}) {
    const allTexts = archive.global.episodes.map(item => item.userText || item.text || '');
    const counts = countPhrases(allTexts, GLOBAL_THEME_MIN_EVIDENCE).slice(0, 12);
    const patterns = counts.map(([phrase, evidenceCount]) => {
      const text = trimText(`They keep returning to ${phrase}.`, 220);
      const supportingEpisodes = archive.global.episodes
        .filter((item) => textMentionsNeedle(item.userText || item.text || '', phrase))
        .slice(-6);
      return normalizeArchiveEntry({
        id: `pattern:${stableHash(phrase).slice(0, 12)}`,
        type: 'pattern',
        text,
        excerpt: text,
        sensitivity: classifySensitivity(phrase),
        evidenceCount,
        confidence: Math.max(0.35, Math.min(0.92, 0.28 + (evidenceCount * 0.14))),
        createdAt: new Date(nowMs()).toISOString(),
        updatedAt: new Date(nowMs()).toISOString(),
        patternKey: phrase,
        evidenceIds: supportingEpisodes.map((item) => item.id).filter(Boolean),
        evidenceSnippet: supportingEpisodes[0]?.userText || supportingEpisodes[0]?.text || text,
        mergeReason: 'global-pattern-rebuild',
        mergeBasis: ['recurring-phrase', 'episode-evidence-count'],
        discardedDetailSummary: ['episode-level detail omitted'],
      }, 'pattern');
    }).filter(Boolean);
    archive.global.patterns = patterns;

    const reviewDecisions = archive.meta.reviewDecisions || {};
    const existingQueue = archive.global.promotionQueue || [];
    const nextQueue = existingQueue.filter((item) => {
      const decision = reviewDecisions[item.patternKey];
      return !decision;
    });
    for (const pattern of patterns) {
      if (pattern.sensitivity === 'high') continue;
      if ((pattern.evidenceCount || 0) < 3) continue;
      if (reviewDecisions[pattern.patternKey]) continue;
      if (nextQueue.some(item => item.patternKey === pattern.patternKey)) continue;
      const packet = normalizePromotionPacket({
        id: `${pattern.id}:packet`,
        kind: 'observation',
        proposedMemoryText: pattern.text,
        sourceType: 'pattern',
        originSource: 'archive-global-pattern',
        sourceThreadId: 'archive-global',
        sourceTurnIds: pattern.evidenceIds && pattern.evidenceIds.length ? pattern.evidenceIds : [pattern.id],
        archiveExcerpt: pattern.evidenceSnippet || pattern.text,
        evidenceSnippet: pattern.evidenceSnippet || pattern.text,
        temporalScope: {
          label: 'rolling-pattern',
          observedAt: pattern.updatedAt || pattern.createdAt || '',
        },
        reviewStatus: 'pending',
        consolidation: pattern.consolidation || null,
        createdAt: pattern.updatedAt || pattern.createdAt || '',
      });
      nextQueue.push(normalizeArchiveEntry({
        id: createId('promotion'),
        type: 'promotion',
        text: pattern.text,
        excerpt: pattern.text,
        sensitivity: pattern.sensitivity,
        evidenceCount: pattern.evidenceCount,
        confidence: pattern.confidence,
        createdAt: new Date(nowMs()).toISOString(),
        updatedAt: new Date(nowMs()).toISOString(),
        patternKey: pattern.patternKey,
        sourceType: 'pattern',
        sourceLabel: 'pattern',
        evidenceIds: pattern.evidenceIds || [],
        evidenceSnippet: pattern.evidenceSnippet || pattern.text,
        temporalScope: packet?.temporalScope || null,
        reviewStatus: 'pending',
        consolidation: packet?.consolidation || pattern.consolidation || null,
        promotionPacket: packet,
      }, 'promotion'));
    }
    archive.global.promotionQueue = nextQueue.slice(-40);
  }

  function buildReviewCandidatePromotionEntry(candidate = {}, episode = {}, createdAt = '') {
    const text = trimText(candidate?.text || '', 220);
    if (!text) return null;
    const evidenceSnippet = trimText(
      candidate?.origin?.evidenceSnippet
        || (Array.isArray(candidate?.evidence) ? candidate.evidence[0] : '')
        || episode?.userText
        || text,
      160,
    );
    const patternKey = `candidate:${stableHash(normalizeSearchText(text)).slice(0, 16)}`;
    const packet = normalizePromotionPacket({
      id: `${patternKey}:packet`,
      kind: String(candidate?.kind || 'observation').trim() || 'observation',
      proposedMemoryText: text,
      sourceType: 'review-candidate',
      originSource: String(candidate?.origin?.sourceType || 'heuristic-chat').trim() || 'heuristic-chat',
      sourceThreadId: episode?.sessionId || '',
      sourceTurnIds: [String(episode?.id || '').trim()].filter(Boolean),
      archiveExcerpt: evidenceSnippet,
      evidenceSnippet,
      temporalScope: {
        label: 'chat-turn',
        observedAt: createdAt || episode?.createdAt || '',
      },
      reviewStatus: 'pending',
      consolidation: {
        mergeKind: 'review-candidate',
        mergeReason: 'candidate-queued-for-review',
        mergeBasis: ['chat-review-candidate'],
        discardedDetailSummary: ['full episode detail omitted'],
        sourceScope: 'promotion-review',
        sourceSessionIds: [episode?.sessionId || ''].filter(Boolean),
        sourceTurnIds: [String(episode?.id || '').trim()].filter(Boolean),
        sourceEpisodeIds: [String(episode?.id || '').trim()].filter(Boolean),
        freshnessLabel: 'current',
      },
      createdAt: createdAt || episode?.createdAt || '',
    });
    return normalizeArchiveEntry({
      id: createId('promotion'),
      type: 'promotion',
      sessionId: episode?.sessionId || undefined,
      createdAt,
      updatedAt: createdAt,
      text,
      excerpt: text,
      sensitivity: classifySensitivity(`${text}\n${evidenceSnippet}`),
      evidenceCount: Math.max(1, Number(candidate?.evidenceCount || 1)),
      evidenceIds: [String(episode?.id || '').trim()].filter(Boolean),
      confidence: Math.max(0.2, Math.min(0.86, Number(candidate?.confidence || 0.42))),
      patternKey,
      sourceType: 'review-candidate',
      sourceLabel: 'review-candidate',
      originSource: String(candidate?.origin?.sourceType || 'heuristic-chat').trim() || 'heuristic-chat',
      originKind: String(candidate?.kind || 'observation').trim() || 'observation',
      evidenceSnippet,
      reviewStatus: 'pending',
      temporalScope: packet?.temporalScope || null,
      consolidation: packet?.consolidation || null,
      promotionPacket: packet,
    }, 'promotion', episode?.sessionId || '');
  }

  function queueReviewCandidates(archive = {}, episode = {}, reviewCandidates = [], createdAt = '') {
    if (!Array.isArray(reviewCandidates) || !reviewCandidates.length) return;
    archive.meta.reviewDecisions = archive.meta.reviewDecisions || {};
    const existingQueue = Array.isArray(archive.global.promotionQueue) ? archive.global.promotionQueue : [];
    const seenKeys = new Set(existingQueue.map((item) => String(item?.patternKey || '').trim()).filter(Boolean));
    for (const candidate of reviewCandidates.slice(0, 4)) {
      const queueItem = buildReviewCandidatePromotionEntry(candidate, episode, createdAt);
      if (!queueItem) continue;
      if (queueItem.sensitivity === 'high') continue;
      if (archive.meta.reviewDecisions[queueItem.patternKey]) continue;
      if (seenKeys.has(queueItem.patternKey)) continue;
      existingQueue.push(queueItem);
      seenKeys.add(queueItem.patternKey);
    }
    archive.global.promotionQueue = existingQueue.slice(-40);
  }

  async function archiveCompletedTurn({
    sessionId = 'default',
    userText = '',
    assistantText = '',
    retrieval = null,
    provenance = [],
    reviewCandidates = [],
    audit = null,
  } = {}) {
    const cleanUserText = trimText(userText, 900);
    const cleanAssistantText = trimText(assistantText, 900);
    if (!cleanUserText || !cleanAssistantText) return null;

    let archive = readArchiveStore();
    const session = ensureSessionStore(archive, sessionId);
    const createdAt = new Date(nowMs()).toISOString();
    const episode = normalizeArchiveEntry({
      id: createId('episode'),
      type: 'episode',
      sessionId,
      createdAt,
      updatedAt: createdAt,
      text: `${cleanUserText}\n${cleanAssistantText}`,
      excerpt: cleanUserText,
      userText: cleanUserText,
      assistantText: cleanAssistantText,
      sensitivity: classifySensitivity(`${cleanUserText}\n${cleanAssistantText}`),
      evidenceCount: 1,
      confidence: 0.48,
      sourceType: 'episode',
    }, 'episode', sessionId);

    const episodeKey = stableHash(`${episode.userText}\n${episode.assistantText}`);
    const hasSessionEpisode = session.episodes.some(item => stableHash(`${item.userText}\n${item.assistantText}`) === episodeKey);
    if (!hasSessionEpisode) {
      session.episodes.push(episode);
      archive.global.episodes.push(episode);
    }
    queueReviewCandidates(archive, episode, reviewCandidates, createdAt);

    const normalizedProvenance = normalizeProvenanceList(
      (Array.isArray(provenance) ? provenance : []).map((item) => ({
        ...item,
        conflictKey: normalizeConflictKey(item?.conflictKey || item?.topicKey || ''),
        createdAt: trimIso(item?.createdAt || createdAt, createdAt),
        sourceEpisodeId: String(item?.sourceEpisodeId || episode.id).trim() || episode.id,
      })),
      4,
    );
    if (normalizedProvenance.length) {
      session.provenance = normalizeProvenanceList([
        ...normalizedProvenance,
        ...session.provenance,
      ], SESSION_PROVENANCE_LIMIT);
    }
    session.activeContradictions = applyProvenanceToContradictions(session, normalizedProvenance, episode, createdAt);
    const auditSlice = normalizeRecentAuditSlice({
      turnId: audit?.turnId || `${sessionId}:${createdAt}`,
      usedAt: audit?.usedAt || retrieval?.usedAt || createdAt,
      userTextExcerpt: audit?.userTextExcerpt || cleanUserText,
      selectedLane: audit?.selectedLane || 'chat',
      requestedMode: audit?.requestedMode || 'local',
      executionPath: audit?.executionPath || 'llm-chat',
      retrieval: audit?.retrieval || retrieval || {},
      promptTruth: audit?.promptTruth || null,
      artifactSummary: audit?.artifactSummary || {},
      researchLedger: audit?.researchLedger || {},
    });
    session.recentAuditTrail = appendRecentAuditSlice(session.recentAuditTrail, auditSlice);

    const sessionTexts = session.episodes.slice(-8).map(item => item.userText || item.text || '');
    const globalTexts = archive.global.episodes.slice(-20).map(item => item.userText || item.text || '');
    const sessionSummaryText = buildRollingSummaryText('Recent session threads', sessionTexts, 2);
    if (sessionSummaryText) {
      session.summaries = upsertById(session.summaries, normalizeArchiveEntry({
        id: `summary:session:${sessionId}`,
        type: 'summary',
        sessionId,
        createdAt: session.summaries.find(item => item.id === `summary:session:${sessionId}`)?.createdAt || createdAt,
        updatedAt: createdAt,
        text: sessionSummaryText,
        excerpt: sessionSummaryText,
        evidenceCount: Math.max(2, countPhrases(sessionTexts, 2)[0]?.[1] || 2),
        confidence: 0.56,
        sourceType: 'summary',
        mergeReason: 'session-rolling-summary',
        mergeBasis: ['recent-session-threads'],
        discardedDetailSummary: ['older episode detail omitted'],
        evidenceIds: session.episodes.slice(-8).map((item) => item?.id).filter(Boolean),
      }, 'summary', sessionId)).slice(-24);
      archive.meta.lastSummarizedAt = createdAt;
    }

    const globalSummaryText = buildRollingSummaryText('Longer-term themes', globalTexts, GLOBAL_THEME_MIN_EVIDENCE);
    if (globalSummaryText) {
      archive.global.summaries = upsertById(archive.global.summaries, normalizeArchiveEntry({
        id: 'summary:global',
        type: 'summary',
        createdAt: archive.global.summaries.find(item => item.id === 'summary:global')?.createdAt || createdAt,
        updatedAt: createdAt,
        text: globalSummaryText,
        excerpt: globalSummaryText,
        evidenceCount: Math.max(GLOBAL_THEME_MIN_EVIDENCE, countPhrases(globalTexts, GLOBAL_THEME_MIN_EVIDENCE)[0]?.[1] || GLOBAL_THEME_MIN_EVIDENCE),
        confidence: 0.62,
        sourceType: 'summary',
        mergeReason: 'global-rolling-summary',
        mergeBasis: ['global-theme-count'],
        discardedDetailSummary: ['episode-level detail omitted'],
        evidenceIds: archive.global.episodes.slice(-20).map((item) => item?.id).filter(Boolean),
      }, 'summary')).slice(-24);
      archive.meta.lastSummarizedAt = createdAt;
    }

    session.chapters = buildSessionChapters(session);
    session.activeContradictions = attachChapterDependentsToContradictions(session.activeContradictions, session.chapters);
    session.openLoops = rebuildOpenLoops(session);
    if ((retrieval && typeof retrieval === 'object') || auditSlice?.retrieval) {
      session.lastRetrieval = buildLastRetrievalRecord(
        retrieval && typeof retrieval === 'object' ? retrieval : null,
        {
          usedAt: auditSlice?.usedAt || retrieval?.usedAt || createdAt,
          provenance: retrieval?.provenance || normalizedProvenance,
          summary: auditSlice?.retrieval || null,
        },
      );
    }
    session.lastArchivedAt = createdAt;
    session.updatedAt = createdAt;

    rebuildGlobalPatterns(archive);
    archive.meta.lastCompactedAt = createdAt;

    archive = trimArchiveStore(archive);
    let embeddings = readEmbeddingsStore();
    applyBackgroundVectorizationStatus(archive, embeddings, {
      enabled: backgroundChatVectorsEnabled,
      sourceSessionId: sessionId,
      semanticReady: false,
      archivePending: true,
      attemptedAt: createdAt,
      status: backgroundChatVectorsEnabled ? 'skipped' : 'disabled',
      skippedReason: backgroundChatVectorsEnabled ? 'awaiting-semantic-status' : '',
      batchLimit: backgroundChatVectorBatchLimit,
    });
    writeArchiveStore(archive);
    embeddings = writeEmbeddingsStore(embeddings);

    const semanticMemory = await getSemanticMemoryStatus();
    if (!semanticMemory.ready) {
      applyBackgroundVectorizationStatus(archive, embeddings, {
        enabled: backgroundChatVectorsEnabled,
        sourceSessionId: sessionId,
        semanticReady: false,
        archivePending: false,
        attemptedAt: createdAt,
        status: backgroundChatVectorsEnabled ? 'skipped' : 'disabled',
        skippedReason: backgroundChatVectorsEnabled ? 'semantic-memory-not-ready' : '',
        eagerEmbeddingCount: 0,
        eagerCreatedCount: 0,
        batchLimit: backgroundChatVectorBatchLimit,
      });
      writeArchiveStore(archive);
      writeEmbeddingsStore(embeddings);
      return {
        archived: true,
        semanticMemory,
        backgroundVectorization: archive.meta.backgroundVectorization,
      };
    }

    const eagerTexts = [
      episode.userText,
      sessionSummaryText,
      globalSummaryText,
      ...session.chapters.map(item => item.text),
      ...archive.global.patterns.map(item => item.text),
    ].filter(Boolean);
    let eagerEmbeddingCount = 0;
    let eagerCreatedCount = 0;
    for (const text of eagerTexts) {
      eagerEmbeddingCount += 1;
      try {
        const embedded = await ensureEmbeddingForText(text, embeddings, semanticMemory);
        embeddings = embedded.embeddings;
        if (embedded.created) eagerCreatedCount += 1;
      } catch {}
    }
    const backgroundVectorization = await runBackgroundVectorizationPrewarm({
      archive,
      session,
      semanticMemory,
      embeddings,
      now: nowMs(),
    });
    embeddings = backgroundVectorization.embeddings;
    applyBackgroundVectorizationStatus(archive, embeddings, {
      ...backgroundVectorization.status,
      archivePending: false,
      eagerEmbeddingCount,
      eagerCreatedCount,
    });
    writeArchiveStore(archive);
    writeEmbeddingsStore(embeddings);
    return {
      archived: true,
      semanticMemory,
      backgroundVectorization: archive.meta.backgroundVectorization,
    };
  }

  function pruneEmbeddingsToArchive(archive = {}, embeddings = {}) {
    const keep = new Set();
    const texts = [
      ...archive.global.episodes.map(item => item.userText || item.text || ''),
      ...archive.global.summaries.map(item => item.text || ''),
      ...archive.global.patterns.map(item => item.text || ''),
    ];
    for (const bucket of Object.values(archive.sessions || {})) {
      texts.push(...(bucket.episodes || []).map(item => item.userText || item.text || ''));
      texts.push(...(bucket.summaries || []).map(item => item.text || ''));
      texts.push(...(bucket.chapters || []).map(item => item.text || ''));
    }
    for (const text of texts) {
      const normalizedText = trimText(text, 1000);
      if (!normalizedText) continue;
      keep.add(embeddingCacheKeyForText(normalizedText, embeddings?.meta?.embedModel || configuredEmbedModel));
      keep.add(legacyEmbeddingCacheKeyForText(normalizedText));
    }
    const next = normalizeEmbeddingsStore(embeddings);
    for (const key of Object.keys(next.items)) {
      if (!keep.has(key)) delete next.items[key];
    }
    next.meta.updatedAt = new Date(nowMs()).toISOString();
    return next;
  }

  function getMemoryInspector({ sessionId = 'default', explicitMemory = {}, semanticMemory = null } = {}) {
    const archive = readArchiveStore();
    const session = ensureSessionStore(archive, sessionId);
    const activeContradictions = normalizeContradictionList(session.activeContradictions, SESSION_ACTIVE_CONTRADICTION_LIMIT)
      .filter(isActiveContradiction);
    const embeddings = readEmbeddingsStore();
    const semanticMemoryPromise = semanticMemory
      ? Promise.resolve(semanticMemory)
      : getSemanticMemoryStatus();
    return semanticMemoryPromise.then((resolvedSemanticMemory) => ({
      sessionId,
      explicit: {
        count: Array.isArray(explicitMemory?.memories) ? explicitMemory.memories.length : 0,
        memories: selectMemoriesForPrompt(explicitMemory, '', EXPLICIT_PROMPT_LIMIT, nowMs()),
      },
      archive: {
        meta: archive.meta,
        session: {
          episodeCount: session.episodes.length,
          summaryCount: session.summaries.length,
          chapterCount: session.chapters.length,
          provenanceCount: session.provenance.length,
          lastArchivedAt: session.lastArchivedAt,
          updatedAt: session.updatedAt,
          recencyProtection: buildRecencyProtection(session),
          activeContradictions: activeContradictions.slice(0, SESSION_ACTIVE_CONTRADICTION_LIMIT),
          staleDependents: activeContradictions.map((item) => ({
            id: item.id,
            conflictKey: item.conflictKey,
            dependentEpisodeIds: normalizeEvidenceIds(item.dependentEpisodeIds || []).slice(-8),
            dependentChapterIds: normalizeEvidenceIds(item.dependentChapterIds || []).slice(-6),
          })).filter((item) => item.dependentEpisodeIds.length || item.dependentChapterIds.length),
          openLoops: session.openLoops.slice(-8),
          lastRetrieval: session.lastRetrieval,
          recentAuditTrail: session.recentAuditTrail.slice(0, SESSION_RECENT_AUDIT_TRAIL_LIMIT),
          recentEpisodes: session.episodes.slice(-6).reverse(),
          summaries: session.summaries.slice(-6).reverse(),
          chapters: session.chapters.slice(-SESSION_CHAPTER_LIMIT).reverse(),
          provenance: session.provenance.slice(-SESSION_PROVENANCE_LIMIT).reverse(),
        },
        global: {
          episodeCount: archive.global.episodes.length,
          summaryCount: archive.global.summaries.length,
          patternCount: archive.global.patterns.length,
          summaries: archive.global.summaries.slice(-6).reverse(),
          patterns: archive.global.patterns.slice(-8).reverse(),
          promotionQueue: archive.global.promotionQueue.slice(-12).reverse(),
        },
      },
      embeddings: {
        count: Object.keys(embeddings.items || {}).length,
        semanticMemory: resolvedSemanticMemory,
        backgroundVectorization: normalizeBackgroundVectorizationStatus(
          embeddings.meta?.backgroundVectorization || archive.meta?.backgroundVectorization,
          {
            enabled: backgroundChatVectorsEnabled,
            batchLimit: backgroundChatVectorBatchLimit,
          },
        ),
      },
    }));
  }

  function reviewPromotion({ queueId = '', action = 'approve' } = {}) {
    const archive = readArchiveStore();
    const index = archive.global.promotionQueue.findIndex(item => String(item?.id || '').trim() === String(queueId || '').trim());
    if (index === -1) return null;
    const [item] = archive.global.promotionQueue.splice(index, 1);
    let packet;
    try {
      packet = validatePromotionPacket(item?.promotionPacket || {
        id: item?.id,
        kind: item?.originKind || 'observation',
        proposedMemoryText: item?.text || '',
        sourceType: item?.sourceType || 'promotion',
        originSource: item?.originSource || '',
        sourceThreadId: item?.sessionId || '',
        sourceTurnIds: item?.evidenceIds || [],
        archiveExcerpt: item?.evidenceSnippet || item?.excerpt || item?.text || '',
        evidenceSnippet: item?.evidenceSnippet || item?.excerpt || item?.text || '',
        temporalScope: item?.temporalScope || {},
        reviewStatus: item?.reviewStatus || 'pending',
        createdAt: item?.createdAt || '',
        reviewedAt: item?.reviewedAt || '',
      });
    } catch (error) {
      error.statusCode = 422;
      throw error;
    }
    archive.meta.reviewDecisions = archive.meta.reviewDecisions || {};
    archive.meta.reviewDecisions[item.patternKey] = {
      action: action === 'reject' ? 'reject' : 'approve',
      decidedAt: new Date(nowMs()).toISOString(),
      text: item.text,
    };
    writeArchiveStore(archive);
    return {
      item,
      packet: {
        ...packet,
        reviewStatus: action === 'reject' ? 'rejected' : 'approved',
        reviewerDecision: action === 'reject' ? 'reject' : 'approve',
        reviewedAt: new Date(nowMs()).toISOString(),
      },
      action: action === 'reject' ? 'reject' : 'approve',
      promotedMemory: action === 'approve'
        ? {
            text: packet.proposedMemoryText,
            kind: packet.kind || item.originKind || 'observation',
            ts: nowMs(),
            source: 'review-candidate',
            evidence: [packet.evidenceSnippet || item.evidenceSnippet || item.text].filter(Boolean),
            origin: {
              queueId: item.id,
              sourceType: packet.sourceType || item.sourceType || 'promotion',
              scope: packet.sourceThreadId && packet.sourceThreadId !== 'archive-global' ? 'archive-session' : 'archive-global',
              sourceId: item.patternKey || '',
              evidenceSnippet: packet.evidenceSnippet || item.evidenceSnippet || '',
              sourceThreadId: packet.sourceThreadId,
              sourceChunkId: packet.sourceChunkId,
              sourceTurnIds: packet.sourceTurnIds,
              sourceObservations: packet.sourceObservations || [],
              temporalScope: packet.temporalScope,
            },
          }
        : null,
    };
  }

  function purgeMemory({
    sessionId = 'default',
    clearSessionArchive = false,
    clearGlobalArchive = false,
    clearEmbeddings = false,
  } = {}) {
    let archive = readArchiveStore();
    let embeddings = readEmbeddingsStore();
    if (clearSessionArchive) {
      delete archive.sessions[sessionId];
      archive.global.episodes = archive.global.episodes.filter(item => String(item.sessionId || '') !== String(sessionId || ''));
      const globalTexts = archive.global.episodes.slice(-20).map(item => item.userText || item.text || '');
      const globalSummaryText = buildRollingSummaryText('Longer-term themes', globalTexts, GLOBAL_THEME_MIN_EVIDENCE);
      archive.global.summaries = globalSummaryText
        ? upsertById(archive.global.summaries, normalizeArchiveEntry({
            id: 'summary:global',
            type: 'summary',
            text: globalSummaryText,
            excerpt: globalSummaryText,
            createdAt: archive.global.summaries.find(item => item.id === 'summary:global')?.createdAt || new Date(nowMs()).toISOString(),
            updatedAt: new Date(nowMs()).toISOString(),
            evidenceCount: Math.max(GLOBAL_THEME_MIN_EVIDENCE, countPhrases(globalTexts, GLOBAL_THEME_MIN_EVIDENCE)[0]?.[1] || GLOBAL_THEME_MIN_EVIDENCE),
            confidence: 0.62,
            sourceType: 'summary',
            mergeReason: 'global-rolling-summary',
            mergeBasis: ['global-theme-count'],
            discardedDetailSummary: ['episode-level detail omitted'],
            evidenceIds: archive.global.episodes.slice(-20).map((item) => item?.id).filter(Boolean),
          }, 'summary'))
        : [];
      rebuildGlobalPatterns(archive);
    }
    if (clearGlobalArchive) {
      archive = buildArchiveStore(configuredEmbedModel, {
        backgroundVectorsEnabled: backgroundChatVectorsEnabled,
        backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
      });
    }
    if (clearEmbeddings) {
      embeddings = buildEmbeddingsStore(configuredEmbedModel, {
        backgroundVectorsEnabled: backgroundChatVectorsEnabled,
        backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
      });
    } else {
      embeddings = pruneEmbeddingsToArchive(archive, embeddings);
    }
    writeArchiveStore(trimArchiveStore(archive));
    writeEmbeddingsStore(embeddings, { replace: true });
    embedStatusCache = { expiresAt: 0, value: null };
    return {
      archive: trimArchiveStore(archive),
      embeddings,
    };
  }

  return {
    get configuredEmbedModel() {
      return configuredEmbedModel;
    },
    setConfiguredEmbedModel,
    archiveScoringProfile,
    memoryLinkScoring: configuredMemoryLinkScoring,
    rerankShadowProvider: configuredRerankShadowProvider,
    buildArchiveStore: (embedModel = configuredEmbedModel) => buildArchiveStore(embedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    }),
    buildEmbeddingsStore: (embedModel = configuredEmbedModel) => buildEmbeddingsStore(embedModel, {
      backgroundVectorsEnabled: backgroundChatVectorsEnabled,
      backgroundVectorBatchLimit: backgroundChatVectorBatchLimit,
    }),
    readArchiveStore,
    readEmbeddingsStore,
    writeArchiveStore,
    writeEmbeddingsStore,
    selectBackgroundVectorizationCandidates,
    getSemanticMemoryStatus,
    buildArchiveContext,
    enrichMemoriesForPrompt,
    archiveCompletedTurn,
    getMemoryInspector,
    reviewPromotion,
    purgeMemory,
    scoreArchiveUtilityCandidate: archivePolicyApi.scoreArchiveUtilityCandidate,
    rerankShadowCandidates: archivePolicyApi.rerankShadowCandidates,
    SESSION_RECENCY_PROTECTED_EPISODES,
  };
}

module.exports = {
  ARCHIVE_SCORING_PROFILES,
  RERANK_SHADOW_MEASUREMENT_MODES,
  RERANK_SHADOW_PROVIDERS,
  ARCHIVE_SCHEMA_VERSION,
  EMBEDDINGS_SCHEMA_VERSION,
  EXPLICIT_PROMPT_LIMIT,
  SESSION_PROMPT_LIMIT,
  GLOBAL_PROMPT_LIMIT,
  SESSION_CHAPTER_LIMIT,
  SESSION_CHAPTER_TRIGGER_COUNT,
  SESSION_RECENCY_PROTECTED_EPISODES,
  SENSITIVE_RETRIEVAL_THRESHOLD,
  createMemoryArchiveApi,
  normalizeArchiveScoringProfile,
  normalizeRerankShadowProvider,
  ARCHIVE_RETRIEVAL_REASON_CODES,
  ARCHIVE_COMPRESSION_REASON_CODES,
};
