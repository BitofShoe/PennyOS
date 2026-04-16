const crypto = require('crypto');

const {
  normalizeText,
  selectMemoriesForPrompt,
  tokenizeMemoryText,
} = require('./penny-memory');
const { createMemoryArchivePolicyApi } = require('./penny-memory-archive-policy');
const {
  normalizePromotionPacket,
  validatePromotionPacket,
} = require('./penny-knowledge-contracts');

const ARCHIVE_SCHEMA_VERSION = 2;
const EMBEDDINGS_SCHEMA_VERSION = 1;
const EXPLICIT_PROMPT_LIMIT = 6;
const SESSION_PROMPT_LIMIT = 2;
const GLOBAL_PROMPT_LIMIT = 2;
const SESSION_CHAPTER_LIMIT = 6;
const SESSION_RECENCY_PROTECTED_EPISODES = 6;
// Let chapter fallback come online sooner so keyword-only sessions
// can still preserve concrete anchors before the conversation gets huge.
const SESSION_CHAPTER_TRIGGER_COUNT = 7;
const SESSION_PROVENANCE_LIMIT = 16;
const SESSION_ACTIVE_CONTRADICTION_LIMIT = 12;
const EMBEDDING_STATUS_CACHE_MS = 15000;
const EMBEDDING_ERROR_CACHE_MS = 60000;
const SENSITIVE_RETRIEVAL_THRESHOLD = 5.5;
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

function buildArchiveStore(embedModel = '') {
  return {
    meta: {
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      embedModel: String(embedModel || '').trim(),
      lastCompactedAt: '',
      lastSummarizedAt: '',
      reviewDecisions: {},
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

function buildEmbeddingsStore(embedModel = '') {
  return {
    meta: {
      schemaVersion: EMBEDDINGS_SCHEMA_VERSION,
      embedModel: String(embedModel || '').trim(),
      updatedAt: '',
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
  LMSTUDIO_API_KEY = 'lm-studio-local',
  PENNY_LMSTUDIO_EMBED_MODEL = '',
  getLmStudioConnectionStatus = null,
  modelsLookEquivalent = null,
  nowMs = () => Date.now(),
} = {}) {
  if (!fs || typeof fs.existsSync !== 'function' || typeof fs.readFileSync !== 'function' || typeof fs.writeFileSync !== 'function') {
    throw new TypeError('createMemoryArchiveApi requires fs');
  }
  if (!path || typeof path.dirname !== 'function') throw new TypeError('createMemoryArchiveApi requires path');
  if (typeof fetch !== 'function') throw new TypeError('createMemoryArchiveApi requires fetch');

  const configuredEmbedModel = normalizeEmbedModelId(PENNY_LMSTUDIO_EMBED_MODEL);
  const modelComparator = typeof modelsLookEquivalent === 'function'
    ? modelsLookEquivalent
    : ((left = '', right = '') => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase());

  let embedStatusCache = { expiresAt: 0, value: null };

  function ensureFile(filePath = '', builder = () => ({})) {
    if (!filePath) return;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) return;
    fs.writeFileSync(filePath, `${JSON.stringify(builder(), null, 2)}\n`);
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
      evidenceIds: normalizeEvidenceIds(raw.evidenceIds || []),
      confidence: Math.max(0, Math.min(1, Number(raw.confidence || 0))),
      promotedAt: trimIso(raw.promotedAt || '', ''),
      patternKey: String(raw.patternKey || '').trim(),
      sourceType: String(raw.sourceType || type).trim(),
      sourceLabel: String(raw.sourceLabel || '').trim(),
      originSource: String(raw.originSource || '').trim(),
      originKind: String(raw.originKind || '').trim(),
      evidenceSnippet: trimText(raw.evidenceSnippet || raw.excerpt || raw.userText || raw.text || '', 160),
      reviewStatus: trimText(raw.reviewStatus || '', 40),
      reviewedAt: trimIso(raw.reviewedAt || '', ''),
      temporalScope: raw.temporalScope && typeof raw.temporalScope === 'object'
        ? {
            label: trimText(raw.temporalScope.label || '', 120),
            observedAt: trimIso(raw.temporalScope.observedAt || '', ''),
            startAt: trimIso(raw.temporalScope.startAt || '', ''),
            endAt: trimIso(raw.temporalScope.endAt || '', ''),
          }
        : null,
      promotionPacket,
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

  function normalizeRetrievalItem(raw = {}) {
    const text = trimText(raw.text || raw.excerpt || '', 220);
    if (!text) return null;
    const scope = String(raw.scope || '').trim() || 'global';
    const sourceLabel = String(raw.sourceLabel || '').trim()
      || (scope === 'session' ? 'archive-session' : 'archive-global');
    return {
      id: String(raw.id || '').trim(),
      text,
      sourceType: String(raw.sourceType || '').trim() || 'archive',
      scope,
      sourceLabel,
      sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      createdAt: trimIso(raw.createdAt, ''),
      score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : 0,
      confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
      sourceEpisodeIds: normalizeEvidenceIds(raw.sourceEpisodeIds || raw.evidenceIds || []),
      matchedTokens: Array.isArray(raw.matchedTokens)
        ? raw.matchedTokens.map((value) => trimText(value, 40)).filter(Boolean).slice(0, 6)
        : [],
      evidenceSnippet: trimText(raw.evidenceSnippet || raw.excerpt || raw.text || '', 160),
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
      };
    }
    const reasonCode = normalizeCompressionReasonCode(raw.reasonCode || raw.reason);
    return {
      used: raw.used === true,
      reason: trimText(raw.reason || '', 80),
      reasonCode,
      chapters: Array.isArray(raw.chapters)
        ? raw.chapters.map(normalizeRetrievalItem).filter(Boolean).slice(0, 4)
        : [],
      explanation: {
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
      },
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
    bucket.lastRetrieval = raw.lastRetrieval && typeof raw.lastRetrieval === 'object'
      ? {
          usedAt: trimIso(raw.lastRetrieval.usedAt, ''),
          mode: String(raw.lastRetrieval.mode || '').trim() || 'keyword',
          embedModel: String(raw.lastRetrieval.embedModel || '').trim(),
          session: Array.isArray(raw.lastRetrieval.session) ? raw.lastRetrieval.session.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
          global: Array.isArray(raw.lastRetrieval.global) ? raw.lastRetrieval.global.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
          books: Array.isArray(raw.lastRetrieval.books) ? raw.lastRetrieval.books.map(normalizeBookMatch).filter(Boolean).slice(0, 4) : [],
          provenance: normalizeProvenanceList(raw.lastRetrieval.provenance, 6),
          compression: normalizeCompressionInfo(raw.lastRetrieval.compression),
        }
      : null;
    if (bucket.lastRetrieval && typeof bucket.lastRetrieval === 'object') {
      bucket.lastRetrieval.reasonCode = String(bucket.lastRetrieval.reasonCode || '').trim()
        || (bucket.lastRetrieval.mode === 'semantic'
          ? ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY
          : ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK);
    }
    bucket.lastArchivedAt = trimIso(raw.lastArchivedAt, '');
    bucket.updatedAt = trimIso(raw.updatedAt, '');
    return bucket;
  }

  function normalizeArchiveStore(store = {}) {
    const base = buildArchiveStore(configuredEmbedModel);
    const parsed = store && typeof store === 'object' ? store : {};
    base.meta = {
      ...base.meta,
      ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      schemaVersion: ARCHIVE_SCHEMA_VERSION,
      embedModel: normalizeEmbedModelId(configuredEmbedModel || (parsed.meta && parsed.meta.embedModel) || ''),
      reviewDecisions: parsed.meta?.reviewDecisions && typeof parsed.meta.reviewDecisions === 'object'
        ? { ...parsed.meta.reviewDecisions }
        : {},
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
    const base = buildEmbeddingsStore(configuredEmbedModel);
    const parsed = store && typeof store === 'object' ? store : {};
    base.meta = {
      ...base.meta,
      ...(parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}),
      schemaVersion: EMBEDDINGS_SCHEMA_VERSION,
      embedModel: normalizeEmbedModelId(configuredEmbedModel || (parsed.meta && parsed.meta.embedModel) || ''),
      updatedAt: trimIso(parsed.meta?.updatedAt, ''),
    };
    const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {};
    for (const [key, raw] of Object.entries(items)) {
      if (!raw || typeof raw !== 'object') continue;
      if (!Array.isArray(raw.vector) || !raw.vector.length) continue;
      base.items[key] = {
        hash: String(raw.hash || key).trim() || key,
        text: trimText(raw.text || '', 400),
        model: String(raw.model || base.meta.embedModel || '').trim(),
        updatedAt: trimIso(raw.updatedAt),
        vector: raw.vector.map(value => Number(value || 0)).filter(Number.isFinite),
        sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      };
    }
    return base;
  }

  function readArchiveStore() {
    ensureFile(ARCHIVE_FILE, () => buildArchiveStore(configuredEmbedModel));
    try {
      const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      return normalizeArchiveStore(parsed);
    } catch {
      return normalizeArchiveStore();
    }
  }

  function writeArchiveStore(store = {}) {
    ensureFile(ARCHIVE_FILE, () => buildArchiveStore(configuredEmbedModel));
    const normalized = normalizeArchiveStore(store);
    fs.writeFileSync(ARCHIVE_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
    return normalized;
  }

  function readEmbeddingsStore() {
    ensureFile(EMBEDDINGS_FILE, () => buildEmbeddingsStore(configuredEmbedModel));
    try {
      const raw = fs.readFileSync(EMBEDDINGS_FILE, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      return normalizeEmbeddingsStore(parsed);
    } catch {
      return normalizeEmbeddingsStore();
    }
  }

  function writeEmbeddingsStore(store = {}) {
    ensureFile(EMBEDDINGS_FILE, () => buildEmbeddingsStore(configuredEmbedModel));
    const normalized = normalizeEmbeddingsStore(store);
    fs.writeFileSync(EMBEDDINGS_FILE, `${JSON.stringify(normalized, null, 2)}\n`);
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
    try {
      const response = await fetch(`${LMSTUDIO_BASE}/embeddings`, {
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
        error: '',
      };
    } catch (error) {
      return { ok: false, error: String(error?.message || error).trim() };
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
    const reachable = status?.reachable === true;
    const liveProbe = reachable && installed ? await probeEmbeddingAvailability() : { ok: false, error: '' };
    const loaded = listedAsLoaded || liveProbe.ok;
    const ready = !!configuredEmbedModel && reachable && installed && liveProbe.ok;
    const value = {
      configuredModel: configuredEmbedModel,
      reachable,
      installed,
      loaded,
      ready,
      active: ready,
      mode: ready ? 'semantic' : 'keyword',
      fallback: !ready,
      reason: !configuredEmbedModel
        ? 'No embedding model is configured.'
        : !reachable
          ? String(status?.error || 'LM Studio is unreachable.')
          : !installed
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
    const response = await fetch(`${LMSTUDIO_BASE}/embeddings`, {
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
    const hash = stableHash(normalizedText);
    const existing = store.items[hash];
    if (existing?.vector?.length) {
      return { embeddings: store, vector: existing.vector, created: false, hash };
    }
    const vector = await createEmbedding(normalizedText, semanticStatus);
    if (!vector) return { embeddings: store, vector: null, created: false, hash };
    store.items[hash] = {
      hash,
      text: normalizedText,
      model: configuredEmbedModel,
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

    if (semanticMemory.ready && allowSemanticQuery) {
      try {
        const embedded = await ensureEmbeddingForText(userText, readEmbeddingsStore(), semanticMemory);
        embeddings = embedded.embeddings;
        queryVector = embedded.vector;
        if (embedded.created) writeEmbeddingsStore(embeddings);
      } catch {
        queryVector = null;
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

    async function rankGroup(items = [], limit = 2) {
      const ranked = [];
      let workingEmbeddings = embeddings || readEmbeddingsStore();
      for (const item of items) {
        let vector = null;
        if (queryVector && semanticMemory.ready) {
          try {
            const embedded = await ensureEmbeddingForText(item.text, workingEmbeddings, semanticMemory);
            workingEmbeddings = embedded.embeddings;
            vector = embedded.vector;
          } catch {
            vector = null;
          }
        }
        const scored = archivePolicyApi.scoreArchiveCandidate(item, queryTokens, now, queryVector, vector);
        const score = Number(scored?.score || 0);
        if (item.sensitivity === 'high' && score < SENSITIVE_RETRIEVAL_THRESHOLD) continue;
        ranked.push({
          ...item,
          score,
          confidence: Math.max(0, Math.min(1, score / 12)),
          matchedTokens: Array.isArray(scored?.overlapTokens) ? scored.overlapTokens : [],
          evidenceSnippet: trimText(scored?.evidenceSnippet || item.text || '', 160),
        });
      }
      if (workingEmbeddings !== embeddings) {
        embeddings = workingEmbeddings;
        writeEmbeddingsStore(embeddings);
      }
      return uniqueCandidateList(
        ranked
          .sort((left, right) => right.score - left.score || String(right.createdAt).localeCompare(String(left.createdAt))),
        limit,
      );
    }

    const sessionItems = await rankGroup(candidateGroups.session, sessionPromptLimit);
    const globalItems = await rankGroup(candidateGroups.global, globalPromptLimit);
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
      rankGroup,
    });
    const retrieval = {
      usedAt: new Date(now).toISOString(),
      mode: semanticMemory.ready && queryVector ? 'semantic' : 'keyword',
      reasonCode: semanticMemory.ready && queryVector
        ? ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY
        : ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK,
      embedModel: semanticMemory.ready ? configuredEmbedModel : '',
      session: combinedSessionItems.map(normalizeRetrievalItem).filter(Boolean),
      global: globalItems.map(normalizeRetrievalItem).filter(Boolean),
      compression,
    };

    return {
      archiveContext: {
        mode: retrieval.mode,
        reasonCode: retrieval.reasonCode,
        embedModel: retrieval.embedModel,
        session: retrieval.session,
        global: retrieval.global,
        provenance: session.provenance.slice(0, 2),
        activeContradictions: activeContradictions.slice(0, 3),
        semanticReady: semanticMemory.ready,
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
      }, 'summary')).slice(-24);
      archive.meta.lastSummarizedAt = createdAt;
    }

    session.chapters = buildSessionChapters(session);
    session.activeContradictions = attachChapterDependentsToContradictions(session.activeContradictions, session.chapters);
    session.openLoops = rebuildOpenLoops(session);
    session.lastRetrieval = retrieval && typeof retrieval === 'object'
      ? {
          usedAt: trimIso(retrieval.usedAt || createdAt, createdAt),
          mode: String(retrieval.mode || 'keyword'),
          reasonCode: String(retrieval.reasonCode || '').trim()
            || (String(retrieval.mode || 'keyword').trim() === 'semantic'
              ? ARCHIVE_RETRIEVAL_REASON_CODES.SEMANTIC_QUERY
              : ARCHIVE_RETRIEVAL_REASON_CODES.KEYWORD_FALLBACK),
          embedModel: String(retrieval.embedModel || ''),
          session: Array.isArray(retrieval.session) ? retrieval.session.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
          global: Array.isArray(retrieval.global) ? retrieval.global.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
          books: Array.isArray(retrieval.books) ? retrieval.books.map(normalizeBookMatch).filter(Boolean).slice(0, 4) : [],
          provenance: normalizeProvenanceList(retrieval.provenance || normalizedProvenance, 6),
          compression: normalizeCompressionInfo(retrieval.compression),
        }
      : session.lastRetrieval;
    session.lastArchivedAt = createdAt;
    session.updatedAt = createdAt;

    rebuildGlobalPatterns(archive);
    archive.meta.lastCompactedAt = createdAt;

    archive = trimArchiveStore(archive);
    writeArchiveStore(archive);

    const semanticMemory = await getSemanticMemoryStatus();
    if (!semanticMemory.ready) return { archived: true, semanticMemory };

    let embeddings = readEmbeddingsStore();
    for (const text of [
      episode.userText,
      sessionSummaryText,
      globalSummaryText,
      ...session.chapters.map(item => item.text),
      ...archive.global.patterns.map(item => item.text),
    ].filter(Boolean)) {
      try {
        const embedded = await ensureEmbeddingForText(text, embeddings, semanticMemory);
        embeddings = embedded.embeddings;
      } catch {}
    }
    writeEmbeddingsStore(embeddings);
    return { archived: true, semanticMemory };
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
      keep.add(stableHash(normalizedText));
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
          }, 'summary'))
        : [];
      rebuildGlobalPatterns(archive);
    }
    if (clearGlobalArchive) {
      archive = buildArchiveStore(configuredEmbedModel);
    }
    if (clearEmbeddings) {
      embeddings = buildEmbeddingsStore(configuredEmbedModel);
    } else {
      embeddings = pruneEmbeddingsToArchive(archive, embeddings);
    }
    writeArchiveStore(trimArchiveStore(archive));
    writeEmbeddingsStore(embeddings);
    embedStatusCache = { expiresAt: 0, value: null };
    return {
      archive: trimArchiveStore(archive),
      embeddings,
    };
  }

  return {
    configuredEmbedModel,
    buildArchiveStore,
    buildEmbeddingsStore,
    readArchiveStore,
    readEmbeddingsStore,
    writeArchiveStore,
    writeEmbeddingsStore,
    getSemanticMemoryStatus,
    buildArchiveContext,
    enrichMemoriesForPrompt,
    archiveCompletedTurn,
    getMemoryInspector,
    reviewPromotion,
    purgeMemory,
    SESSION_RECENCY_PROTECTED_EPISODES,
  };
}

module.exports = {
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
  ARCHIVE_RETRIEVAL_REASON_CODES,
  ARCHIVE_COMPRESSION_REASON_CODES,
};
