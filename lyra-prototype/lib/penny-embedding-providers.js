const {
  STATIC_SHADOW_EMBED_MODEL,
  STATIC_SHADOW_EMBED_DIMENSIONS,
  createStaticShadowEmbedding,
} = require('./penny-static-shadow-embeddings');

const EMBEDDING_PROVIDER_AUTHORITY = 'candidate-discovery-only';
const EMBEDDING_PROVIDER_DISTANCE = 'cosine';
const FIXTURE_PROVIDER_ID = 'fixture';
const STATIC_PROVIDER_ID = 'static';
const FIXTURE_MODEL_ID = 'penny-fixture-embedding-v1';
const FIXTURE_DIMENSIONS = 32;

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashFeature(value = '') {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeDimension(value, fallback = FIXTURE_DIMENSIONS) {
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(4096, numeric));
}

function normalizeStaticShadowDimension(value) {
  const numeric = Math.round(Number(value));
  const fallback = STATIC_SHADOW_EMBED_DIMENSIONS;
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(8, Math.min(256, numeric));
}

function normalizeTruncateDim(value, dimensions) {
  const fallback = normalizeDimension(dimensions, FIXTURE_DIMENSIONS);
  const numeric = Math.round(Number(value));
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(fallback, numeric));
}

function normalizeVector(vector = []) {
  const numbers = Array.isArray(vector)
    ? vector.map((value) => Number(value || 0)).filter(Number.isFinite)
    : [];
  const norm = Math.sqrt(numbers.reduce((sum, value) => sum + (value * value), 0));
  if (!norm) return numbers.map(() => 0);
  return numbers.map((value) => Math.round((value / norm) * 1000000) / 1000000);
}

function applyTruncateDim(vector = [], truncateDim = 0) {
  const size = normalizeTruncateDim(truncateDim, vector.length);
  return normalizeVector(vector.slice(0, size));
}

function normalizeProviderId(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text || ['fixture', 'test-fixture', 'deterministic-fixture'].includes(text)) {
    return FIXTURE_PROVIDER_ID;
  }
  if (['static', 'static-shadow', 'penny-static-shadow', 'penny-static-shadow-lexical'].includes(text)) {
    return STATIC_PROVIDER_ID;
  }
  return text;
}

function normalizeModelId(value = '', fallback = '') {
  const text = String(value || '').trim();
  return text || fallback;
}

function buildProviderInfo({
  providerId,
  modelId,
  modelFamily,
  dimensions,
  truncateDim,
  license,
  dependency,
} = {}) {
  const normalizedDimensions = normalizeDimension(dimensions, FIXTURE_DIMENSIONS);
  return {
    providerId: normalizeProviderId(providerId),
    modelId: normalizeModelId(modelId, FIXTURE_MODEL_ID),
    modelFamily: normalizeModelId(modelFamily, 'fixture'),
    dimensions: normalizedDimensions,
    truncateDim: normalizeTruncateDim(truncateDim, normalizedDimensions),
    distance: EMBEDDING_PROVIDER_DISTANCE,
    localOnly: true,
    license: normalizeModelId(license, 'repo-local'),
    dependency: normalizeModelId(dependency, 'none'),
    defaultForLive: false,
    authority: EMBEDDING_PROVIDER_AUTHORITY,
  };
}

function createFixtureEmbedding(text = '', { dimensions = FIXTURE_DIMENSIONS } = {}) {
  const size = normalizeDimension(dimensions, FIXTURE_DIMENSIONS);
  const vector = Array.from({ length: size }, () => 0);
  const normalized = normalizeText(text);
  const tokens = normalized ? normalized.split(/\s+/).filter(Boolean) : [];
  tokens.forEach((token, index) => {
    const hash = hashFeature(`tok:${token}`);
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[hash % size] += sign;
    if (index > 0) {
      const bigramHash = hashFeature(`bi:${tokens[index - 1]} ${token}`);
      const bigramSign = (bigramHash & 1) === 0 ? 1 : -1;
      vector[bigramHash % size] += bigramSign * 1.35;
    }
  });
  if (!tokens.length) {
    const hash = hashFeature('empty');
    vector[hash % size] = 1;
  }
  return normalizeVector(vector);
}

function createEmbeddingProviderAdapter({ info, createEmbedding }) {
  const providerInfo = buildProviderInfo(info);
  const embedOne = typeof createEmbedding === 'function'
    ? createEmbedding
    : () => createFixtureEmbedding('');

  async function embedQuery(text = '', options = {}) {
    const dimensions = providerInfo.dimensions;
    const truncateDim = normalizeTruncateDim(options.truncateDim || providerInfo.truncateDim, dimensions);
    return applyTruncateDim(embedOne(String(text || ''), { ...options, dimensions }), truncateDim);
  }

  return {
    async embedTexts(texts = [], options = {}) {
      if (!Array.isArray(texts)) {
        throw new TypeError('embedTexts expects an array of texts.');
      }
      return Promise.all(texts.map((text) => embedQuery(text, options)));
    },
    embedQuery,
    getProviderInfo() {
      return { ...providerInfo };
    },
    async healthCheck() {
      return {
        ok: true,
        providerId: providerInfo.providerId,
        modelId: providerInfo.modelId,
        modelFamily: providerInfo.modelFamily,
        dimensions: providerInfo.dimensions,
        truncateDim: providerInfo.truncateDim,
        distance: providerInfo.distance,
        localOnly: providerInfo.localOnly,
        dependency: providerInfo.dependency,
        defaultForLive: providerInfo.defaultForLive,
        authority: providerInfo.authority,
      };
    },
  };
}

function createFixtureProvider({
  modelId = FIXTURE_MODEL_ID,
  dimensions = FIXTURE_DIMENSIONS,
  truncateDim,
} = {}) {
  const normalizedDimensions = normalizeDimension(dimensions, FIXTURE_DIMENSIONS);
  return createEmbeddingProviderAdapter({
    info: {
      providerId: FIXTURE_PROVIDER_ID,
      modelId,
      modelFamily: 'deterministic-fixture',
      dimensions: normalizedDimensions,
      truncateDim,
      license: 'repo-test-fixture',
      dependency: 'none',
    },
    createEmbedding: (text = '', options = {}) => createFixtureEmbedding(text, {
      dimensions: options.dimensions || normalizedDimensions,
    }),
  });
}

function createStaticShadowProvider({
  modelId = STATIC_SHADOW_EMBED_MODEL,
  dimensions = STATIC_SHADOW_EMBED_DIMENSIONS,
  truncateDim,
} = {}) {
  const providerModelId = normalizeModelId(modelId, STATIC_SHADOW_EMBED_MODEL);
  const normalizedDimensions = normalizeStaticShadowDimension(dimensions);
  return createEmbeddingProviderAdapter({
    info: {
      providerId: STATIC_PROVIDER_ID,
      modelId: providerModelId,
      modelFamily: 'penny-static-shadow',
      dimensions: normalizedDimensions,
      truncateDim,
      license: 'repo-local',
      dependency: 'none',
    },
    createEmbedding: (text = '', options = {}) => createStaticShadowEmbedding(text, {
      dimensions: options.dimensions || normalizedDimensions,
    }),
  });
}

function createEmbeddingProvider({
  provider = FIXTURE_PROVIDER_ID,
  modelId = '',
  dimensions,
  truncateDim,
  cacheDir = '',
} = {}) {
  void cacheDir;
  const providerId = normalizeProviderId(provider);
  if (providerId === FIXTURE_PROVIDER_ID) {
    return createFixtureProvider({ modelId, dimensions, truncateDim });
  }
  if (providerId === STATIC_PROVIDER_ID) {
    return createStaticShadowProvider({ modelId, dimensions, truncateDim });
  }
  throw new Error(`Unknown embedding provider: ${String(provider || '').trim() || '(empty)'}`);
}

module.exports = {
  EMBEDDING_PROVIDER_AUTHORITY,
  EMBEDDING_PROVIDER_DISTANCE,
  FIXTURE_PROVIDER_ID,
  FIXTURE_MODEL_ID,
  STATIC_PROVIDER_ID,
  createEmbeddingProvider,
  normalizeProviderId,
};
