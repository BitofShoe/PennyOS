const {
  MODEL2VEC_POTION_8M_PROVIDER_ID,
  createEmbeddingProvider,
  normalizeProviderId,
} = require('./penny-embedding-providers');
const {
  createStaticEmbeddingCacheApi,
  normalizeStaticEmbeddingVectorSpace,
} = require('./penny-static-embedding-cache');
const {
  FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS,
  FRAME_BUDGET_SIDECAR_SPEND_CLASSES,
  buildFrameBudgetSidecarReceipt,
} = require('./penny-frame-budget');

const STATIC_EMBED_MODES = Object.freeze({
  OFF: 'off',
  QA_SHADOW: 'qa-shadow',
  LIVE_SHADOW: 'live-shadow',
  LIVE_ADVISORY: 'live-advisory',
  LIVE_FALLBACK: 'live-fallback',
});
const LIVE_STATIC_EMBED_MODES = new Set([
  STATIC_EMBED_MODES.LIVE_SHADOW,
  STATIC_EMBED_MODES.LIVE_ADVISORY,
  STATIC_EMBED_MODES.LIVE_FALLBACK,
]);
const DEFAULT_STATIC_INDEX_SCOPE = ['session', 'archive', 'research-ledger'];
const DEFAULT_STATIC_EMBED_MAX_CANDIDATES = 12;
const DEFAULT_STATIC_EMBED_BATCH_SIZE = 16;
const STATIC_MEMORY_QUERY_BUDGET_MS = FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.STATIC_MEMORY_QUERY;

function trimText(value = '', limit = 1200) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function normalizeStaticEmbedMode(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text || ['0', 'false', 'no', 'disabled', 'disable', 'off'].includes(text)) {
    return STATIC_EMBED_MODES.OFF;
  }
  if (['qa', 'qa-shadow', 'shadow-qa'].includes(text)) return STATIC_EMBED_MODES.QA_SHADOW;
  if (['live', 'shadow', 'live-shadow'].includes(text)) return STATIC_EMBED_MODES.LIVE_SHADOW;
  if (['advisory', 'live-advisory'].includes(text)) return STATIC_EMBED_MODES.LIVE_ADVISORY;
  if (['fallback', 'live-fallback'].includes(text)) return STATIC_EMBED_MODES.LIVE_FALLBACK;
  return STATIC_EMBED_MODES.OFF;
}

function buildStaticQueryFrameSidecar({
  enabled = true,
  skipped = false,
  reason = '',
  queryMs = 0,
  candidateCount = 0,
  budgetMs = STATIC_MEMORY_QUERY_BUDGET_MS,
  error = '',
} = {}) {
  return buildFrameBudgetSidecarReceipt({
    id: 'static-memory-query',
    label: 'Static memory query',
    spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
    budgetMs,
    actualMs: queryMs,
    enabled,
    skipped,
    candidateCount,
    selectedCount: 0,
    renderedCount: 0,
    sourceAuthority: 'advisory',
    reason: reason || error,
    error,
    fallback: skipped || error
      ? 'Hold back static memory candidates for this frame.'
      : '',
  });
}

function isLiveStaticEmbedMode(mode = '') {
  return LIVE_STATIC_EMBED_MODES.has(normalizeStaticEmbedMode(mode));
}

function clampPositiveInt(value, fallback = 1, max = 1000) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(max, numeric));
}

function normalizeIndexScope(value = DEFAULT_STATIC_INDEX_SCOPE) {
  const rawItems = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  const normalized = rawItems
    .map((item) => String(item || '').trim().toLowerCase())
    .filter(Boolean)
    .flatMap((item) => {
      if (item === 'all') return DEFAULT_STATIC_INDEX_SCOPE;
      if (item === 'ledger' || item === 'research') return ['research-ledger'];
      if (item === 'sessions') return ['session'];
      if (item === 'archives') return ['archive'];
      return [item];
    })
    .filter((item) => DEFAULT_STATIC_INDEX_SCOPE.includes(item));
  return [...new Set(normalized.length ? normalized : DEFAULT_STATIC_INDEX_SCOPE)];
}

function cosineSimilarity(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index] || 0);
    const b = Number(right[index] || 0);
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function safeId(value = '', fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeSourceItem(raw = {}) {
  const item = raw && typeof raw === 'object' ? raw : {};
  const sourceItemId = safeId(item.sourceItemId || item.id || item.itemId, '');
  const sourceText = trimText(
    item.sourceText
      || item.text
      || [item.userText, item.assistantText].filter(Boolean).join('\n')
      || item.summary
      || item.conclusion
      || item.question
      || '',
    4000,
  );
  if (!sourceItemId || !sourceText) return null;
  const sourceUpdatedAt = safeId(item.sourceUpdatedAt || item.updatedAt || item.createdAt, '');
  return {
    sourceItemId,
    id: sourceItemId,
    sourceType: safeId(item.sourceType || item.type, 'memory'),
    sourceAuthority: safeId(item.sourceAuthority, 'advisory'),
    supportState: safeId(item.supportState, 'candidate'),
    sourceUpdatedAt,
    updatedAt: sourceUpdatedAt,
    sourceText,
    text: sourceText,
    textPreview: trimText(item.textPreview || item.excerpt || sourceText, 240),
    sessionId: safeId(item.sessionId, ''),
  };
}

function collectArchiveEntrySources(entries = [], {
  prefix = 'archive',
  sourceType = 'archive',
  sessionId = '',
} = {}) {
  const out = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== 'object') continue;
    const type = safeId(entry.type || sourceType, sourceType);
    const id = safeId(entry.id, `${type}:${out.length + 1}`);
    const text = trimText(
      entry.text
        || [entry.userText, entry.assistantText].filter(Boolean).join('\n')
        || entry.excerpt
        || '',
      4000,
    );
    const source = normalizeSourceItem({
      sourceItemId: `${prefix}:${type}:${id}`,
      sourceType: prefix === 'session' ? `session-${type}` : `archive-${type}`,
      sourceAuthority: 'advisory',
      supportState: 'candidate',
      sessionId: sessionId || entry.sessionId || '',
      sourceUpdatedAt: entry.updatedAt || entry.createdAt || '',
      sourceText: text,
      textPreview: entry.excerpt || text,
    });
    if (source) out.push(source);
  }
  return out;
}

function collectArchiveStoreSourceItems(archiveStore = {}, scope = DEFAULT_STATIC_INDEX_SCOPE) {
  const sourceItems = [];
  const scoped = new Set(normalizeIndexScope(scope));
  const archive = archiveStore && typeof archiveStore === 'object' ? archiveStore : {};
  if (scoped.has('archive')) {
    sourceItems.push(
      ...collectArchiveEntrySources(archive.global?.episodes, { prefix: 'archive', sourceType: 'episode' }),
      ...collectArchiveEntrySources(archive.global?.summaries, { prefix: 'archive', sourceType: 'summary' }),
      ...collectArchiveEntrySources(archive.global?.patterns, { prefix: 'archive', sourceType: 'pattern' }),
      ...collectArchiveEntrySources(archive.global?.promotionQueue, { prefix: 'archive', sourceType: 'promotion' }),
    );
  }
  if (scoped.has('session')) {
    const sessions = archive.sessions && typeof archive.sessions === 'object' ? archive.sessions : {};
    for (const [sessionId, bucket] of Object.entries(sessions)) {
      const prefix = `session:${sessionId}`;
      sourceItems.push(
        ...collectArchiveEntrySources(bucket?.episodes, { prefix, sourceType: 'episode', sessionId }),
        ...collectArchiveEntrySources(bucket?.summaries, { prefix, sourceType: 'summary', sessionId }),
        ...collectArchiveEntrySources(bucket?.chapters, { prefix, sourceType: 'chapter', sessionId }),
      );
    }
  }
  return sourceItems;
}

function topicText(topic = {}) {
  const evidenceRefs = Array.isArray(topic.evidenceRefs)
    ? topic.evidenceRefs.map((item) => [item?.label, item?.ref, item?.note].filter(Boolean).join(' ')).filter(Boolean)
    : [];
  const followUps = Array.isArray(topic.openFollowUps) ? topic.openFollowUps : [];
  const contradictions = Array.isArray(topic.contradictions)
    ? topic.contradictions.map((item) => [item?.oldText, item?.newText].filter(Boolean).join(' -> ')).filter(Boolean)
    : [];
  return trimText([
    topic.topicLabel,
    topic.question,
    topic.conclusion,
    ...(Array.isArray(topic.summaryEvidenceRefs) ? topic.summaryEvidenceRefs.map((item) => item?.summary || item?.label || '').filter(Boolean) : []),
    ...followUps,
    ...contradictions,
    ...evidenceRefs,
  ].filter(Boolean).join('\n'), 4000);
}

function collectResearchLedgerSourceItems(ledgerStore = {}, scope = DEFAULT_STATIC_INDEX_SCOPE) {
  if (!new Set(normalizeIndexScope(scope)).has('research-ledger')) return [];
  const store = ledgerStore && typeof ledgerStore === 'object' ? ledgerStore : {};
  const topics = store.topics && typeof store.topics === 'object' ? store.topics : {};
  const out = [];
  for (const [key, raw] of Object.entries(topics)) {
    const topic = raw && typeof raw === 'object' ? raw : {};
    const topicId = safeId(topic.topicId || key, key);
    const text = topicText(topic);
    const source = normalizeSourceItem({
      sourceItemId: `research-ledger:topic:${topicId}`,
      sourceType: 'research-ledger-topic',
      sourceAuthority: 'advisory',
      supportState: 'candidate',
      sourceUpdatedAt: topic.lastTouchedAt || store.meta?.updatedAt || '',
      sourceText: text,
      textPreview: topic.topicLabel || topic.question || text,
    });
    if (source) out.push(source);
  }
  return out;
}

function collectStaticMemorySourceItems({
  archiveStore = {},
  ledgerStore = {},
  scope = DEFAULT_STATIC_INDEX_SCOPE,
} = {}) {
  const byId = new Map();
  for (const item of [
    ...collectArchiveStoreSourceItems(archiveStore, scope),
    ...collectResearchLedgerSourceItems(ledgerStore, scope),
  ]) {
    if (!item?.sourceItemId) continue;
    byId.set(item.sourceItemId, item);
  }
  return [...byId.values()];
}

function buildIndexedItem(sourceItem = {}, vector = [], providerInfo = {}) {
  const info = normalizeStaticEmbeddingVectorSpace(providerInfo);
  const text = trimText(sourceItem.sourceText || sourceItem.text || sourceItem.textPreview || '', 220);
  return {
    id: sourceItem.sourceItemId,
    sourceItemId: sourceItem.sourceItemId,
    textPreview: trimText(sourceItem.textPreview || sourceItem.sourceText || '', 240),
    text,
    sourceType: sourceItem.sourceType || 'memory',
    sourceAuthority: sourceItem.sourceAuthority || 'advisory',
    supportState: sourceItem.supportState || 'candidate',
    candidateChannels: ['static-embedding'],
    sessionId: sourceItem.sessionId || '',
    sourceUpdatedAt: sourceItem.sourceUpdatedAt || '',
    vector,
    staticEmbedding: {
      provider: info.providerId,
      modelId: info.modelId,
      dimensions: info.truncateDim,
      similarity: 0,
      rank: 0,
      queryMs: 0,
    },
  };
}

function createStaticMemoryIndexApi({
  fs,
  path,
  DATA_DIR = '',
  CACHE_FILE = '',
  mode = STATIC_EMBED_MODES.OFF,
  provider = MODEL2VEC_POTION_8M_PROVIDER_ID,
  providerFactory = null,
  cacheFactory = null,
  readArchiveStore = null,
  readLedgerStore = null,
  indexScope = DEFAULT_STATIC_INDEX_SCOPE,
  maxCandidates = DEFAULT_STATIC_EMBED_MAX_CANDIDATES,
  batchSize = DEFAULT_STATIC_EMBED_BATCH_SIZE,
  autoSchedule = true,
  nowMs = () => Date.now(),
  scheduleTask = (fn) => setTimeout(fn, 0),
  logger = console,
} = {}) {
  if (!fs
    || typeof fs.existsSync !== 'function'
    || typeof fs.readFileSync !== 'function'
    || typeof fs.mkdirSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function') {
    throw new TypeError('createStaticMemoryIndexApi requires fs helpers');
  }
  if (!path || typeof path.join !== 'function' || typeof path.dirname !== 'function') {
    throw new TypeError('createStaticMemoryIndexApi requires path helpers');
  }

  const normalizedMode = normalizeStaticEmbedMode(mode);
  const enabled = isLiveStaticEmbedMode(normalizedMode);
  const providerId = normalizeProviderId(provider || MODEL2VEC_POTION_8M_PROVIDER_ID);
  const scope = normalizeIndexScope(indexScope);
  const candidateLimit = clampPositiveInt(maxCandidates, DEFAULT_STATIC_EMBED_MAX_CANDIDATES, 100);
  const configuredBatchSize = clampPositiveInt(batchSize, DEFAULT_STATIC_EMBED_BATCH_SIZE, 100);
  const sources = new Map();
  const indexed = new Map();
  const pending = new Map();
  let embeddingProvider = null;
  let providerInfo = {
    providerId,
    modelId: providerId,
    dimensions: 256,
    truncateDim: 256,
    normalization: 'unit-l2',
    distance: 'cosine',
  };
  let cache = null;
  let ready = false;
  let started = false;
  let scheduled = false;
  let draining = false;
  let lastQueryMs = 0;
  let lastIndexMs = 0;
  let lastIndexedAt = '';
  let lastError = '';

  function getStatus() {
    return {
      enabled,
      mode: normalizedMode,
      provider: providerInfo.providerId || providerId,
      indexedItems: indexed.size,
      pendingItems: pending.size,
      lastQueryMs,
      ready: enabled && ready === true,
      ...(enabled && providerInfo.modelId ? { modelId: providerInfo.modelId } : {}),
      ...(enabled && providerInfo.truncateDim ? { dimensions: providerInfo.truncateDim } : {}),
      ...(enabled && cache?.cacheFile ? { cacheFile: cache.cacheFile } : {}),
      ...(enabled && lastIndexMs ? { lastIndexMs } : {}),
      ...(enabled && lastIndexedAt ? { lastIndexedAt } : {}),
      ...(enabled && lastError ? { error: lastError } : {}),
    };
  }

  function isEnabled() {
    return enabled;
  }

  async function ensureProvider() {
    if (!enabled) return null;
    if (!embeddingProvider) {
      embeddingProvider = typeof providerFactory === 'function'
        ? providerFactory({ provider: providerId, mode: normalizedMode })
        : createEmbeddingProvider({ provider: providerId });
      if (!embeddingProvider || typeof embeddingProvider.getProviderInfo !== 'function') {
        throw new TypeError('Static embedding provider did not expose getProviderInfo().');
      }
      providerInfo = embeddingProvider.getProviderInfo();
    }
    if (!cache) {
      cache = typeof cacheFactory === 'function'
        ? cacheFactory({ providerInfo })
        : createStaticEmbeddingCacheApi({
            fs,
            path,
            DATA_DIR: DATA_DIR || path.join(process.cwd(), 'data'),
            CACHE_FILE,
            providerInfo,
            nowMs,
          });
    }
    return embeddingProvider;
  }

  function addIndexedSource(sourceItem = {}, vector = []) {
    if (!sourceItem?.sourceItemId || !Array.isArray(vector) || !vector.length) return false;
    sources.set(sourceItem.sourceItemId, sourceItem);
    indexed.set(sourceItem.sourceItemId, buildIndexedItem(sourceItem, vector, providerInfo));
    pending.delete(sourceItem.sourceItemId);
    return true;
  }

  function hydrateCachedVectors(sourceItems = []) {
    if (!cache) return 0;
    const store = cache.readCacheStore();
    let hydrated = 0;
    for (const item of sourceItems) {
      if (!item?.sourceItemId) continue;
      sources.set(item.sourceItemId, item);
      const key = cache.keyForSource(item);
      const cached = store.items?.[key];
      if (Array.isArray(cached?.vector) && cached.vector.length) {
        if (addIndexedSource(item, cached.vector)) hydrated += 1;
      }
    }
    return hydrated;
  }

  function enqueueSourceItems(sourceItems = [], { schedule = autoSchedule } = {}) {
    if (!enabled) return getStatus();
    for (const raw of Array.isArray(sourceItems) ? sourceItems : []) {
      const item = normalizeSourceItem(raw);
      if (!item) continue;
      const existing = sources.get(item.sourceItemId);
      const changed = !!existing
        && (
          existing.sourceUpdatedAt !== item.sourceUpdatedAt
          || existing.sourceText !== item.sourceText
        );
      sources.set(item.sourceItemId, item);
      if (changed) indexed.delete(item.sourceItemId);
      if (!indexed.has(item.sourceItemId)) pending.set(item.sourceItemId, item);
    }
    if (schedule) scheduleDrain();
    return getStatus();
  }

  async function refreshFromStores({ schedule = autoSchedule } = {}) {
    if (!enabled) return getStatus();
    try {
      const providerApi = await ensureProvider();
      if (typeof providerApi.healthCheck === 'function') {
        const health = await providerApi.healthCheck();
        if (health?.ok === false) {
          ready = false;
          lastError = String(health.error || 'static-embedding-provider-unavailable').trim();
          return getStatus();
        }
      }
      const archiveStore = typeof readArchiveStore === 'function' ? readArchiveStore() : {};
      const ledgerStore = typeof readLedgerStore === 'function' ? readLedgerStore() : {};
      const sourceItems = collectStaticMemorySourceItems({
        archiveStore,
        ledgerStore,
        scope,
      });
      hydrateCachedVectors(sourceItems);
      enqueueSourceItems(sourceItems, { schedule: false });
      ready = true;
      lastError = '';
      if (schedule) scheduleDrain();
      return getStatus();
    } catch (error) {
      ready = false;
      lastError = String(error?.message || error || 'static-memory-index-refresh-failed').trim();
      return getStatus();
    }
  }

  async function start() {
    started = true;
    return refreshFromStores({ schedule: autoSchedule });
  }

  async function drainPending({ limit = 0 } = {}) {
    if (!enabled) return getStatus();
    if (draining) return getStatus();
    draining = true;
    const startedAt = nowMs();
    try {
      const providerApi = await ensureProvider();
      const maxToProcess = limit > 0 ? clampPositiveInt(limit, configuredBatchSize, 1000) : pending.size;
      let processed = 0;
      while (pending.size && processed < maxToProcess) {
        const batch = [...pending.values()].slice(0, Math.min(configuredBatchSize, maxToProcess - processed));
        const texts = batch.map((item) => item.sourceText || item.text || '');
        const vectors = await providerApi.embedTexts(texts);
        batch.forEach((item, index) => {
          const vector = Array.isArray(vectors?.[index]) ? vectors[index] : [];
          if (!vector.length) {
            pending.delete(item.sourceItemId);
            return;
          }
          cache.upsertVector({
            sourceItem: item,
            vector,
            textPreview: item.textPreview || item.sourceText || '',
          });
          addIndexedSource(item, vector);
        });
        processed += batch.length;
      }
      lastIndexMs = Math.max(0, nowMs() - startedAt);
      lastIndexedAt = processed ? new Date(nowMs()).toISOString() : lastIndexedAt;
      lastError = '';
      return getStatus();
    } catch (error) {
      lastError = String(error?.message || error || 'static-memory-index-drain-failed').trim();
      return getStatus();
    } finally {
      draining = false;
      if (pending.size && autoSchedule) scheduleDrain();
    }
  }

  function scheduleDrain() {
    if (!enabled || scheduled || draining) return getStatus();
    scheduled = true;
    const handle = scheduleTask(() => {
      scheduled = false;
      drainPending().catch((error) => {
        lastError = String(error?.message || error || 'static-memory-index-drain-failed').trim();
        if (logger && typeof logger.warn === 'function') {
          logger.warn(`[penny static memory] background index failed: ${lastError}`);
        }
      });
    });
    if (handle && typeof handle.unref === 'function') handle.unref();
    return getStatus();
  }

  async function query(text = '', {
    maxCandidates: queryMaxCandidates = candidateLimit,
    budgetMs = STATIC_MEMORY_QUERY_BUDGET_MS,
  } = {}) {
    if (!enabled) {
      return {
        skipped: true,
        reason: 'disabled',
        candidates: [],
        queryMs: 0,
        status: getStatus(),
        frameBudgetSidecar: buildStaticQueryFrameSidecar({
          enabled: false,
          skipped: true,
          reason: 'disabled',
          budgetMs,
        }),
      };
    }
    if (!started || ready !== true) {
      const reason = lastError || 'not-ready';
      return {
        skipped: true,
        reason,
        candidates: [],
        queryMs: 0,
        status: getStatus(),
        frameBudgetSidecar: buildStaticQueryFrameSidecar({
          skipped: true,
          reason,
          budgetMs,
        }),
      };
    }
    const cleanText = trimText(text, 1000);
    if (!cleanText) {
      return {
        skipped: true,
        reason: 'empty-query',
        candidates: [],
        queryMs: 0,
        status: getStatus(),
        frameBudgetSidecar: buildStaticQueryFrameSidecar({
          skipped: true,
          reason: 'empty-query',
          budgetMs,
        }),
      };
    }
    const providerApi = await ensureProvider();
    const startedAt = nowMs();
    try {
      const queryVector = await providerApi.embedQuery(cleanText);
      const queryMs = Math.max(0, nowMs() - startedAt);
      lastQueryMs = queryMs;
      if (!Array.isArray(queryVector) || !queryVector.length) {
        return {
          skipped: true,
          reason: 'empty-query-vector',
          candidates: [],
          queryMs,
          status: getStatus(),
          frameBudgetSidecar: buildStaticQueryFrameSidecar({
            skipped: true,
            reason: 'empty-query-vector',
            queryMs,
            budgetMs,
          }),
        };
      }
      const limit = clampPositiveInt(queryMaxCandidates, candidateLimit, 100);
      const candidates = [...indexed.values()]
        .map((item) => ({
          ...item,
          similarity: cosineSimilarity(queryVector, item.vector),
        }))
        .filter((item) => Number.isFinite(item.similarity) && item.similarity > 0)
        .sort((left, right) => right.similarity - left.similarity || left.sourceItemId.localeCompare(right.sourceItemId))
        .slice(0, limit)
        .map((item, index) => ({
          id: item.sourceItemId,
          textPreview: item.textPreview,
          text: item.text || item.textPreview,
          sourceType: item.sourceType,
          sourceAuthority: item.sourceAuthority,
          supportState: item.supportState,
          candidateChannels: item.candidateChannels,
          staticEmbedding: {
            ...item.staticEmbedding,
            similarity: Math.round(item.similarity * 1000000) / 1000000,
            rank: index + 1,
            queryMs,
          },
        }));
      return {
        skipped: false,
        reason: '',
        candidates,
        queryMs,
        status: getStatus(),
        frameBudgetSidecar: buildStaticQueryFrameSidecar({
          queryMs,
          candidateCount: candidates.length,
          budgetMs,
        }),
      };
    } catch (error) {
      const queryMs = Math.max(0, nowMs() - startedAt);
      lastQueryMs = queryMs;
      lastError = String(error?.message || error || 'static-memory-index-query-failed').trim();
      return {
        skipped: true,
        reason: lastError,
        candidates: [],
        queryMs,
        status: getStatus(),
        frameBudgetSidecar: buildStaticQueryFrameSidecar({
          skipped: true,
          reason: lastError,
          queryMs,
          budgetMs,
          error: lastError,
        }),
      };
    }
  }

  return {
    isEnabled,
    getStatus,
    start,
    refreshFromStores,
    enqueueSourceItems,
    drainPending,
    query,
  };
}

module.exports = {
  STATIC_EMBED_MODES,
  DEFAULT_STATIC_INDEX_SCOPE,
  collectArchiveStoreSourceItems,
  collectResearchLedgerSourceItems,
  collectStaticMemorySourceItems,
  createStaticMemoryIndexApi,
  isLiveStaticEmbedMode,
  normalizeStaticEmbedMode,
  normalizeIndexScope,
};
