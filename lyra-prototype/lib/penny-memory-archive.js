const crypto = require('crypto');

const {
  normalizeText,
  selectMemoriesForPrompt,
  tokenizeMemoryText,
} = require('./penny-memory');

const ARCHIVE_SCHEMA_VERSION = 1;
const EMBEDDINGS_SCHEMA_VERSION = 1;
const EXPLICIT_PROMPT_LIMIT = 6;
const SESSION_PROMPT_LIMIT = 2;
const GLOBAL_PROMPT_LIMIT = 2;
const EMBEDDING_STATUS_CACHE_MS = 15000;
const EMBEDDING_ERROR_CACHE_MS = 60000;
const SENSITIVE_RETRIEVAL_THRESHOLD = 5.5;

const PHRASE_STOPWORDS = new Set([
  'about', 'after', 'again', 'also', 'been', 'being', 'came', 'come', 'dont', 'from', 'have', 'into',
  'just', 'know', 'like', 'maybe', 'more', 'really', 'said', 'some', 'that', 'their', 'them', 'then',
  'there', 'they', 'this', 'very', 'want', 'with', 'would', 'your', 'youre', 'were', 'when', 'what',
  'while', 'where', 'which', 'because', 'than', 'over', 'under', 'still', 'keep', 'keeps', 'thing',
  'things', 'make', 'makes', 'made', 'feel', 'feels', 'feeling',
]);

const SENSITIVE_PATTERNS = [
  /\b(fuck|fucking|horny|orgasm|cum|cock|pussy|dick|throat|spank|dom|sub|breed|wet|naked)\b/i,
  /\b(suicidal|self harm|self-harm|kill myself|cutting|panic attack|trauma)\b/i,
  /\b(crying all night|i feel broken|i hate myself|i want to disappear)\b/i,
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

  const configuredEmbedModel = String(PENNY_LMSTUDIO_EMBED_MODEL || '').trim();
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
      openLoops: [],
      lastRetrieval: null,
      lastArchivedAt: '',
      updatedAt: '',
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

  function normalizeRetrievalItem(raw = {}) {
    const text = trimText(raw.text || raw.excerpt || '', 220);
    if (!text) return null;
    return {
      id: String(raw.id || '').trim(),
      text,
      sourceType: String(raw.sourceType || '').trim() || 'archive',
      scope: String(raw.scope || '').trim() || 'global',
      sensitivity: raw.sensitivity === 'high' ? 'high' : 'normal',
      createdAt: trimIso(raw.createdAt, ''),
      score: Number.isFinite(Number(raw.score)) ? Number(raw.score) : 0,
      confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
    };
  }

  function normalizeSessionBucket(raw = {}, sessionId = 'default') {
    const bucket = buildSessionBucket(sessionId);
    bucket.episodes = Array.isArray(raw.episodes)
      ? raw.episodes.map(item => normalizeArchiveEntry(item, 'episode', sessionId)).filter(Boolean).slice(-160)
      : [];
    bucket.summaries = Array.isArray(raw.summaries)
      ? raw.summaries.map(item => normalizeArchiveEntry(item, item?.type || 'summary', sessionId)).filter(Boolean).slice(-24)
      : [];
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
        }
      : null;
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
      embedModel: String((parsed.meta && parsed.meta.embedModel) || configuredEmbedModel || '').trim(),
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
      embedModel: String((parsed.meta && parsed.meta.embedModel) || configuredEmbedModel || '').trim(),
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

  async function getSemanticMemoryStatus({ force = false, lmStatus = null } = {}) {
    const now = nowMs();
    if (!force && embedStatusCache.value && now < embedStatusCache.expiresAt) {
      return embedStatusCache.value;
    }

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
    const loaded = matchConfiguredModel(runtimeModels);
    const reachable = status?.reachable === true;
    const ready = !!configuredEmbedModel && reachable && installed && loaded;
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
              ? `Embedding model ${configuredEmbedModel} is installed but not currently loaded.`
              : '',
    };
    embedStatusCache = {
      expiresAt: now + (ready ? EMBEDDING_STATUS_CACHE_MS : EMBEDDING_ERROR_CACHE_MS),
      value,
    };
    return value;
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

  function buildArchiveCandidate(entry = {}, scope = 'global', sourceType = 'archive') {
    return {
      id: String(entry.id || '').trim(),
      text: trimText(entry.text || entry.excerpt || entry.userText || '', 220),
      sourceType,
      scope,
      createdAt: trimIso(entry.createdAt),
      sensitivity: entry.sensitivity === 'high' ? 'high' : 'normal',
    };
  }

  function scoreArchiveCandidate(candidate = {}, queryTokens = new Set(), now = nowMs(), queryVector = null, vector = null) {
    const tokens = tokenizeMemoryText(candidate.text || '');
    let score = candidate.sourceType === 'pattern' ? 3.5 : candidate.sourceType === 'summary' ? 3 : 2.5;
    let overlap = 0;
    for (const token of tokens) {
      if (queryTokens.has(token)) overlap += 1;
    }
    score += overlap * 2.25;
    if (queryVector && vector) score += Math.max(0, cosineSimilarity(queryVector, vector)) * 8;
    const createdAtMs = Date.parse(candidate.createdAt || '');
    if (Number.isFinite(createdAtMs)) {
      const ageDays = Math.max(0, now - createdAtMs) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 1.5 - Math.min(1.5, ageDays / 14));
    }
    if (candidate.scope === 'session') score += 0.75;
    if (candidate.sensitivity === 'high') score -= 1.5;
    return score;
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

  async function buildArchiveContext({
    sessionId = 'default',
    userText = '',
    lane = 'chat',
    now = nowMs(),
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
    const semanticMemory = await getSemanticMemoryStatus();
    const queryTokens = new Set(tokenizeMemoryText(userText));
    let queryVector = null;
    let embeddings = null;

    if (semanticMemory.ready) {
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
        ...session.episodes.slice(-48).map(item => buildArchiveCandidate(item, 'session', 'episode')),
        ...session.summaries.slice(-12).map(item => buildArchiveCandidate(item, 'session', item.type || 'summary')),
      ],
      global: [
        ...archive.global.summaries.slice(-16).map(item => buildArchiveCandidate(item, 'global', 'summary')),
        ...archive.global.patterns.slice(-16).map(item => buildArchiveCandidate(item, 'global', 'pattern')),
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
        const score = scoreArchiveCandidate(item, queryTokens, now, queryVector, vector);
        if (item.sensitivity === 'high' && score < SENSITIVE_RETRIEVAL_THRESHOLD) continue;
        ranked.push({
          ...item,
          score,
          confidence: Math.max(0, Math.min(1, score / 12)),
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

    const sessionItems = await rankGroup(candidateGroups.session, SESSION_PROMPT_LIMIT);
    const globalItems = await rankGroup(candidateGroups.global, GLOBAL_PROMPT_LIMIT);
    const retrieval = {
      usedAt: new Date(now).toISOString(),
      mode: semanticMemory.ready && queryVector ? 'semantic' : 'keyword',
      embedModel: semanticMemory.ready ? configuredEmbedModel : '',
      session: sessionItems.map(normalizeRetrievalItem).filter(Boolean),
      global: globalItems.map(normalizeRetrievalItem).filter(Boolean),
    };

    return {
      archiveContext: {
        mode: retrieval.mode,
        embedModel: retrieval.embedModel,
        session: retrieval.session,
        global: retrieval.global,
        semanticReady: semanticMemory.ready,
      },
      retrieval,
      semanticMemory,
    };
  }

  function enrichMemoriesForPrompt(memories = {}, archiveContext = null) {
    if (!archiveContext) return memories;
    return {
      ...memories,
      archiveContext,
    };
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
      session.openLoops = session.openLoops.slice(-16);
    }
    return archive;
  }

  function rebuildGlobalPatterns(archive = {}) {
    const allTexts = archive.global.episodes.map(item => item.userText || item.text || '');
    const counts = countPhrases(allTexts, 2).slice(0, 12);
    const patterns = counts.map(([phrase, evidenceCount]) => {
      const text = trimText(`They keep returning to ${phrase}.`, 220);
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
      }, 'promotion'));
    }
    archive.global.promotionQueue = nextQueue.slice(-40);
  }

  async function archiveCompletedTurn({
    sessionId = 'default',
    userText = '',
    assistantText = '',
    retrieval = null,
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

    const globalSummaryText = buildRollingSummaryText('Longer-term themes', globalTexts, 2);
    if (globalSummaryText) {
      archive.global.summaries = upsertById(archive.global.summaries, normalizeArchiveEntry({
        id: 'summary:global',
        type: 'summary',
        createdAt: archive.global.summaries.find(item => item.id === 'summary:global')?.createdAt || createdAt,
        updatedAt: createdAt,
        text: globalSummaryText,
        excerpt: globalSummaryText,
        evidenceCount: Math.max(2, countPhrases(globalTexts, 2)[0]?.[1] || 2),
        confidence: 0.62,
        sourceType: 'summary',
      }, 'summary')).slice(-24);
      archive.meta.lastSummarizedAt = createdAt;
    }

    session.openLoops = rebuildOpenLoops(session);
    session.lastRetrieval = retrieval && typeof retrieval === 'object'
      ? {
          usedAt: trimIso(retrieval.usedAt || createdAt, createdAt),
          mode: String(retrieval.mode || 'keyword'),
          embedModel: String(retrieval.embedModel || ''),
          session: Array.isArray(retrieval.session) ? retrieval.session.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
          global: Array.isArray(retrieval.global) ? retrieval.global.map(normalizeRetrievalItem).filter(Boolean).slice(0, 6) : [],
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

  function getMemoryInspector({ sessionId = 'default', explicitMemory = {} } = {}) {
    const archive = readArchiveStore();
    const session = ensureSessionStore(archive, sessionId);
    const embeddings = readEmbeddingsStore();
    return getSemanticMemoryStatus().then((semanticMemory) => ({
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
          openLoops: session.openLoops.slice(-8),
          lastRetrieval: session.lastRetrieval,
          recentEpisodes: session.episodes.slice(-6).reverse(),
          summaries: session.summaries.slice(-6).reverse(),
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
        semanticMemory,
      },
    }));
  }

  function reviewPromotion({ queueId = '', action = 'approve' } = {}) {
    const archive = readArchiveStore();
    const index = archive.global.promotionQueue.findIndex(item => String(item?.id || '').trim() === String(queueId || '').trim());
    if (index === -1) return null;
    const [item] = archive.global.promotionQueue.splice(index, 1);
    archive.meta.reviewDecisions = archive.meta.reviewDecisions || {};
    archive.meta.reviewDecisions[item.patternKey] = {
      action: action === 'reject' ? 'reject' : 'approve',
      decidedAt: new Date(nowMs()).toISOString(),
      text: item.text,
    };
    writeArchiveStore(archive);
    return {
      item,
      action: action === 'reject' ? 'reject' : 'approve',
      promotedMemory: action === 'approve'
        ? {
            text: item.text,
            kind: 'observation',
            ts: nowMs(),
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
      const globalSummaryText = buildRollingSummaryText('Longer-term themes', globalTexts, 2);
      archive.global.summaries = globalSummaryText
        ? upsertById(archive.global.summaries, normalizeArchiveEntry({
            id: 'summary:global',
            type: 'summary',
            text: globalSummaryText,
            excerpt: globalSummaryText,
            createdAt: archive.global.summaries.find(item => item.id === 'summary:global')?.createdAt || new Date(nowMs()).toISOString(),
            updatedAt: new Date(nowMs()).toISOString(),
            evidenceCount: Math.max(2, countPhrases(globalTexts, 2)[0]?.[1] || 2),
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
  };
}

module.exports = {
  ARCHIVE_SCHEMA_VERSION,
  EMBEDDINGS_SCHEMA_VERSION,
  EXPLICIT_PROMPT_LIMIT,
  SESSION_PROMPT_LIMIT,
  GLOBAL_PROMPT_LIMIT,
  SENSITIVE_RETRIEVAL_THRESHOLD,
  createMemoryArchiveApi,
};
