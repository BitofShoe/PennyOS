const crypto = require('crypto');
const { writeJsonFileAtomicSync } = require('./penny-atomic-json');
const {
  EMBEDDING_PROVIDER_DISTANCE,
  EMBEDDING_PROVIDER_NORMALIZATION,
  MODEL2VEC_POTION_8M_PROVIDER_ID,
  normalizeProviderId,
} = require('./penny-embedding-providers');

const STATIC_EMBEDDING_CACHE_SCHEMA_VERSION = 1;
const STATIC_EMBEDDING_CACHE_SCHEMA = 'penny-static-embedding-cache.v1';
const STATIC_EMBEDDING_CACHE_PREFIX = 'penny-memory-embeddings.static';
const UNKNOWN_MODEL_REVISION = 'unknown-model-revision';
const UNKNOWN_SOURCE_HASH = 'unknown-source-hash';

function trimText(value = '', limit = 1600) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function normalizeToken(value = '', fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function normalizeDimension(value, fallback = 0) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return Math.max(1, Math.round(Number(fallback) || 1));
  return Math.max(1, Math.min(4096, numeric));
}

function slugForFile(value = '', fallback = 'unknown') {
  const text = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || fallback;
}

function stableHash(value = '') {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function normalizeStaticEmbeddingVectorSpace(providerInfo = {}) {
  const info = providerInfo && typeof providerInfo === 'object' ? providerInfo : {};
  const dimensions = normalizeDimension(info.dimensions, 256);
  return {
    providerId: normalizeProviderId(info.providerId || info.provider || MODEL2VEC_POTION_8M_PROVIDER_ID),
    modelId: normalizeToken(info.modelId || info.model || '', 'unknown-static-embedding-model'),
    modelRevision: normalizeToken(info.modelRevision || info.modelHash || info.revision || '', UNKNOWN_MODEL_REVISION),
    dimensions,
    truncateDim: normalizeDimension(info.truncateDim || dimensions, dimensions),
    normalization: normalizeToken(info.normalization || EMBEDDING_PROVIDER_NORMALIZATION, EMBEDDING_PROVIDER_NORMALIZATION),
    distance: normalizeToken(info.distance || EMBEDDING_PROVIDER_DISTANCE, EMBEDDING_PROVIDER_DISTANCE),
  };
}

function buildStaticEmbeddingCacheFileName(providerInfo = {}) {
  const vectorSpace = normalizeStaticEmbeddingVectorSpace(providerInfo);
  return `${STATIC_EMBEDDING_CACHE_PREFIX}.${slugForFile(vectorSpace.providerId)}.dim${vectorSpace.truncateDim}.json`;
}

function buildStaticEmbeddingCacheFilePath(pathModule, dataDir = '', providerInfo = {}) {
  if (!pathModule || typeof pathModule.join !== 'function') {
    throw new TypeError('buildStaticEmbeddingCacheFilePath requires path helpers');
  }
  return pathModule.join(String(dataDir || 'data'), buildStaticEmbeddingCacheFileName(providerInfo));
}

function buildStaticEmbeddingSourceIdentity(sourceItem = {}) {
  const source = sourceItem && typeof sourceItem === 'object' ? sourceItem : {};
  const sourceItemId = normalizeToken(
    source.sourceItemId || source.itemId || source.id || source.sourceId || '',
    '',
  );
  if (!sourceItemId) {
    throw new TypeError('Static embedding cache source item requires a source item id.');
  }
  const sourceUpdatedAt = normalizeToken(source.sourceUpdatedAt || source.updatedAt || source.createdAt || '', '');
  const sourceText = trimText(source.sourceText || source.text || source.content || source.userText || source.excerpt || '', 4000);
  const sourceHash = normalizeToken(
    source.sourceHash || source.contentHash || source.textHash || source.hash || (sourceText ? stableHash(sourceText) : ''),
    UNKNOWN_SOURCE_HASH,
  );
  return {
    sourceItemId,
    sourceUpdatedAt,
    sourceHash,
  };
}

function buildStaticEmbeddingCacheIdentity({ providerInfo = {}, sourceItem = {} } = {}) {
  return {
    vectorSpace: normalizeStaticEmbeddingVectorSpace(providerInfo),
    source: buildStaticEmbeddingSourceIdentity(sourceItem),
  };
}

function staticEmbeddingVectorSpacesMatch(left = {}, right = {}) {
  const a = normalizeStaticEmbeddingVectorSpace(left);
  const b = normalizeStaticEmbeddingVectorSpace(right);
  return a.providerId === b.providerId
    && a.modelId === b.modelId
    && a.modelRevision === b.modelRevision
    && a.dimensions === b.dimensions
    && a.truncateDim === b.truncateDim
    && a.normalization === b.normalization
    && a.distance === b.distance;
}

function buildStaticEmbeddingCacheKey({ providerInfo = {}, sourceItem = {} } = {}) {
  const identity = buildStaticEmbeddingCacheIdentity({ providerInfo, sourceItem });
  const digest = stableHash(JSON.stringify(identity));
  return `static:${slugForFile(identity.vectorSpace.providerId)}:${slugForFile(identity.source.sourceItemId)}:${digest.slice(0, 32)}`;
}

function buildStaticEmbeddingCacheStore({ providerInfo = {}, updatedAt = '' } = {}) {
  const vectorSpace = normalizeStaticEmbeddingVectorSpace(providerInfo);
  return {
    schemaVersion: STATIC_EMBEDDING_CACHE_SCHEMA_VERSION,
    schema: STATIC_EMBEDDING_CACHE_SCHEMA,
    meta: {
      ...vectorSpace,
      updatedAt: normalizeToken(updatedAt, ''),
    },
    items: {},
  };
}

function normalizeStaticVector(vector = []) {
  if (!Array.isArray(vector) && !ArrayBuffer.isView(vector)) return [];
  return Array.from(vector, (value) => Number(value || 0)).filter(Number.isFinite);
}

function normalizeStaticEmbeddingCacheStore(store = {}, { providerInfo = {} } = {}) {
  const base = buildStaticEmbeddingCacheStore({ providerInfo });
  const parsed = store && typeof store === 'object' ? store : {};
  const parsedMeta = parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {};
  if (Object.keys(parsedMeta).length && !staticEmbeddingVectorSpacesMatch(parsedMeta, base.meta)) {
    return base;
  }
  base.meta.updatedAt = normalizeToken(parsedMeta.updatedAt || parsed.updatedAt || '', '');
  const items = parsed.items && typeof parsed.items === 'object' ? parsed.items : {};
  for (const raw of Object.values(items)) {
    if (!raw || typeof raw !== 'object') continue;
    const source = raw.source && typeof raw.source === 'object' ? raw.source : raw;
    let sourceIdentity;
    try {
      sourceIdentity = buildStaticEmbeddingSourceIdentity(source);
    } catch {
      continue;
    }
    const vector = normalizeStaticVector(raw.vector);
    if (vector.length !== base.meta.truncateDim) continue;
    const rawVectorSpace = raw.vectorSpace && typeof raw.vectorSpace === 'object' ? raw.vectorSpace : parsedMeta;
    if (!staticEmbeddingVectorSpacesMatch(rawVectorSpace, base.meta)) continue;
    const key = buildStaticEmbeddingCacheKey({
      providerInfo: base.meta,
      sourceItem: sourceIdentity,
    });
    base.items[key] = {
      key,
      vectorSpace: normalizeStaticEmbeddingVectorSpace(base.meta),
      source: sourceIdentity,
      textPreview: trimText(raw.textPreview || raw.text || '', 240),
      vector,
      createdAt: normalizeToken(raw.createdAt || '', ''),
      updatedAt: normalizeToken(raw.updatedAt || '', base.meta.updatedAt),
    };
  }
  return base;
}

function createStaticEmbeddingCacheApi({
  fs,
  path,
  CACHE_FILE = '',
  DATA_DIR = '',
  providerInfo = {},
  nowMs = () => Date.now(),
} = {}) {
  if (!fs
    || typeof fs.existsSync !== 'function'
    || typeof fs.readFileSync !== 'function'
    || typeof fs.mkdirSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function') {
    throw new TypeError('createStaticEmbeddingCacheApi requires fs helpers');
  }
  if (!path || typeof path.dirname !== 'function' || typeof path.join !== 'function') {
    throw new TypeError('createStaticEmbeddingCacheApi requires path helpers');
  }
  const filePath = CACHE_FILE || buildStaticEmbeddingCacheFilePath(path, DATA_DIR || path.join(process.cwd(), 'data'), providerInfo);

  function emptyStore() {
    return buildStaticEmbeddingCacheStore({ providerInfo });
  }

  function readCacheStore() {
    if (!fs.existsSync(filePath)) return emptyStore();
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = raw ? JSON.parse(raw) : {};
      return normalizeStaticEmbeddingCacheStore(parsed, { providerInfo });
    } catch {
      return emptyStore();
    }
  }

  function writeCacheStore(store = {}) {
    const normalized = normalizeStaticEmbeddingCacheStore(store, { providerInfo });
    normalized.meta.updatedAt = new Date(nowMs()).toISOString();
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath,
      value: normalized,
    });
    return normalized;
  }

  function keyForSource(sourceItem = {}) {
    return buildStaticEmbeddingCacheKey({ providerInfo, sourceItem });
  }

  function getVectorForSource(sourceItem = {}) {
    const store = readCacheStore();
    const key = keyForSource(sourceItem);
    return store.items[key]?.vector || null;
  }

  function upsertVector({ sourceItem = {}, vector = [], textPreview = '' } = {}) {
    const store = readCacheStore();
    const normalizedVector = normalizeStaticVector(vector);
    if (normalizedVector.length !== store.meta.truncateDim) {
      throw new TypeError(`Static embedding vector length ${normalizedVector.length} did not match truncateDim ${store.meta.truncateDim}.`);
    }
    const sourceIdentity = buildStaticEmbeddingSourceIdentity(sourceItem);
    for (const [key, item] of Object.entries(store.items || {})) {
      if (item?.source?.sourceItemId === sourceIdentity.sourceItemId) {
        delete store.items[key];
      }
    }
    const key = buildStaticEmbeddingCacheKey({
      providerInfo: store.meta,
      sourceItem: sourceIdentity,
    });
    const now = new Date(nowMs()).toISOString();
    store.items[key] = {
      key,
      vectorSpace: normalizeStaticEmbeddingVectorSpace(store.meta),
      source: sourceIdentity,
      textPreview: trimText(textPreview || sourceItem.text || sourceItem.content || '', 240),
      vector: normalizedVector,
      createdAt: now,
      updatedAt: now,
    };
    return writeCacheStore(store);
  }

  return {
    cacheFile: filePath,
    providerInfo: normalizeStaticEmbeddingVectorSpace(providerInfo),
    buildEmptyStore: emptyStore,
    readCacheStore,
    writeCacheStore,
    keyForSource,
    getVectorForSource,
    upsertVector,
  };
}

module.exports = {
  STATIC_EMBEDDING_CACHE_SCHEMA_VERSION,
  STATIC_EMBEDDING_CACHE_SCHEMA,
  STATIC_EMBEDDING_CACHE_PREFIX,
  UNKNOWN_MODEL_REVISION,
  UNKNOWN_SOURCE_HASH,
  buildStaticEmbeddingCacheFileName,
  buildStaticEmbeddingCacheFilePath,
  buildStaticEmbeddingCacheIdentity,
  buildStaticEmbeddingCacheKey,
  buildStaticEmbeddingCacheStore,
  buildStaticEmbeddingSourceIdentity,
  createStaticEmbeddingCacheApi,
  normalizeStaticEmbeddingCacheStore,
  normalizeStaticEmbeddingVectorSpace,
  staticEmbeddingVectorSpacesMatch,
};
