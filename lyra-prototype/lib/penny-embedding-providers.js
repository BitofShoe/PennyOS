const {
  STATIC_SHADOW_EMBED_MODEL,
  STATIC_SHADOW_EMBED_DIMENSIONS,
  createStaticShadowEmbedding,
} = require('./penny-static-shadow-embeddings');

const EMBEDDING_PROVIDER_AUTHORITY = 'candidate-discovery-only';
const EMBEDDING_PROVIDER_DISTANCE = 'cosine';
const EMBEDDING_PROVIDER_NORMALIZATION = 'unit-l2';
const FIXTURE_PROVIDER_ID = 'fixture';
const STATIC_PROVIDER_ID = 'static';
const MODEL2VEC_POTION_8M_PROVIDER_ID = 'model2vec-potion-8m';
const FIXTURE_MODEL_ID = 'penny-fixture-embedding-v1';
const FIXTURE_DIMENSIONS = 32;
const MODEL2VEC_POTION_8M_PACKAGE = '@yarflam/potion-base-8m';
const MODEL2VEC_POTION_8M_PACKAGE_VERSION = '1.0.4';
const MODEL2VEC_POTION_8M_MODEL_ID = 'minishlab/potion-base-8M';
const MODEL2VEC_POTION_8M_DIMENSIONS = 256;

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
  const isVectorLike = Array.isArray(vector) || ArrayBuffer.isView(vector);
  const numbers = isVectorLike
    ? Array.from(vector, (value) => Number(value || 0)).filter(Number.isFinite)
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
  if ([
    MODEL2VEC_POTION_8M_PROVIDER_ID,
    'potion-base-8m',
    'potion-8m',
    '@yarflam/potion-base-8m',
    'yarflam-potion-base-8m',
  ].includes(text)) {
    return MODEL2VEC_POTION_8M_PROVIDER_ID;
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
  packageName,
  packageVersion,
  packageSource,
  modelRevision,
  transitiveDependencies,
  bundledModelFiles,
  runtimeNetwork,
  runtime,
  experimental,
  normalization = EMBEDDING_PROVIDER_NORMALIZATION,
} = {}) {
  const normalizedDimensions = normalizeDimension(dimensions, FIXTURE_DIMENSIONS);
  const info = {
    providerId: normalizeProviderId(providerId),
    modelId: normalizeModelId(modelId, FIXTURE_MODEL_ID),
    modelFamily: normalizeModelId(modelFamily, 'fixture'),
    dimensions: normalizedDimensions,
    truncateDim: normalizeTruncateDim(truncateDim, normalizedDimensions),
    distance: EMBEDDING_PROVIDER_DISTANCE,
    normalization: normalizeModelId(normalization, EMBEDDING_PROVIDER_NORMALIZATION),
    localOnly: true,
    license: normalizeModelId(license, 'repo-local'),
    dependency: normalizeModelId(dependency, 'none'),
    defaultForLive: false,
    authority: EMBEDDING_PROVIDER_AUTHORITY,
  };
  if (packageName) info.packageName = normalizeModelId(packageName, '');
  if (packageVersion) info.packageVersion = normalizeModelId(packageVersion, '');
  if (packageSource) info.packageSource = normalizeModelId(packageSource, '');
  if (modelRevision) info.modelRevision = normalizeModelId(modelRevision, '');
  if (transitiveDependencies) info.transitiveDependencies = normalizeModelId(transitiveDependencies, '');
  if (bundledModelFiles) info.bundledModelFiles = normalizeModelId(bundledModelFiles, '');
  if (runtimeNetwork) info.runtimeNetwork = normalizeModelId(runtimeNetwork, '');
  if (runtime) info.runtime = normalizeModelId(runtime, '');
  if (typeof experimental === 'boolean') info.experimental = experimental;
  return info;
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

function createEmbeddingProviderAdapter({ info, createEmbedding, createEmbeddings, healthCheck }) {
  const providerInfo = buildProviderInfo(info);
  const embedOne = typeof createEmbedding === 'function'
    ? createEmbedding
    : () => createFixtureEmbedding('');
  const embedBatch = typeof createEmbeddings === 'function'
    ? createEmbeddings
    : (texts, options) => Promise.all(texts.map((text) => embedOne(text, options)));

  function normalizeEmbedding(vector = [], truncateDim = providerInfo.truncateDim) {
    return applyTruncateDim(vector, truncateDim);
  }

  async function embedTexts(texts = [], options = {}) {
    if (!Array.isArray(texts)) {
      throw new TypeError('embedTexts expects an array of texts.');
    }
    const dimensions = providerInfo.dimensions;
    const truncateDim = normalizeTruncateDim(options.truncateDim || providerInfo.truncateDim, dimensions);
    const rawEmbeddings = await embedBatch(
      texts.map((text) => String(text || '')),
      { ...options, dimensions },
    );
    return (Array.isArray(rawEmbeddings) ? rawEmbeddings : []).map((vector) => (
      normalizeEmbedding(vector, truncateDim)
    ));
  }

  async function embedQuery(text = '', options = {}) {
    const [embedding = []] = await embedTexts([String(text || '')], options);
    return embedding;
  }

  return {
    embedTexts,
    embedQuery,
    getProviderInfo() {
      return { ...providerInfo };
    },
    async healthCheck() {
      if (typeof healthCheck !== 'function') {
        return { ok: true, ...providerInfo };
      }
      return healthCheck({ ...providerInfo });
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

function buildOptionalProviderUnavailableError(error) {
  const detail = error && error.message ? ` ${error.message}` : '';
  return new Error(
    `Optional embedding provider package unavailable: ${MODEL2VEC_POTION_8M_PACKAGE}@${MODEL2VEC_POTION_8M_PACKAGE_VERSION}. `
      + `Run npm install --include=optional or npm install --save-optional ${MODEL2VEC_POTION_8M_PACKAGE}@${MODEL2VEC_POTION_8M_PACKAGE_VERSION}.${detail}`,
  );
}

function createModel2VecPotion8mProvider({
  modelId = MODEL2VEC_POTION_8M_MODEL_ID,
  truncateDim,
  importModule,
} = {}) {
  const providerModelId = normalizeModelId(modelId, MODEL2VEC_POTION_8M_MODEL_ID);
  const importer = typeof importModule === 'function'
    ? importModule
    : (specifier) => import(specifier);
  let modulePromise = null;

  async function loadModule() {
    if (!modulePromise) {
      modulePromise = Promise.resolve()
        .then(() => importer(MODEL2VEC_POTION_8M_PACKAGE))
        .then((loadedModule) => {
          if (!loadedModule || typeof loadedModule.embed !== 'function') {
            throw new Error('Package did not expose an embed(texts) function.');
          }
          return loadedModule;
        })
        .catch((error) => {
          modulePromise = null;
          throw buildOptionalProviderUnavailableError(error);
        });
    }
    return modulePromise;
  }

  return createEmbeddingProviderAdapter({
    info: {
      providerId: MODEL2VEC_POTION_8M_PROVIDER_ID,
      modelId: providerModelId,
      modelFamily: 'model2vec-potion',
      dimensions: MODEL2VEC_POTION_8M_DIMENSIONS,
      truncateDim,
      license: 'MIT',
      dependency: `${MODEL2VEC_POTION_8M_PACKAGE}@${MODEL2VEC_POTION_8M_PACKAGE_VERSION}`,
      packageName: MODEL2VEC_POTION_8M_PACKAGE,
      packageVersion: MODEL2VEC_POTION_8M_PACKAGE_VERSION,
      packageSource: 'https://gitlab.com/Yarflam/potion-base-8m',
      modelRevision: 'npm:sha512-FnVnvuGhol1v5cH+ij0VkPmJFZotRwsJsvp4TB901S2eg8pKCttL3tIRklG9erbyDGBAfxpBh//TNEW7bxc7lw==',
      transitiveDependencies: 'none',
      bundledModelFiles: 'models/model.safetensors, models/tokenizer.json, models/config.json',
      runtimeNetwork: 'none-after-install',
      runtime: 'node-esm-dynamic-import',
      experimental: true,
    },
    createEmbeddings: async (texts = []) => {
      const loadedModule = await loadModule();
      return loadedModule.embed(texts);
    },
    healthCheck: async (providerInfo) => {
      try {
        await loadModule();
        return { ok: true, ...providerInfo };
      } catch (error) {
        return {
          ok: false,
          ...providerInfo,
          error: error && error.message ? error.message : String(error),
        };
      }
    },
  });
}

function createEmbeddingProvider({
  provider = FIXTURE_PROVIDER_ID,
  modelId = '',
  dimensions,
  truncateDim,
  cacheDir = '',
  importModule,
} = {}) {
  void cacheDir;
  const providerId = normalizeProviderId(provider);
  if (providerId === FIXTURE_PROVIDER_ID) {
    return createFixtureProvider({ modelId, dimensions, truncateDim });
  }
  if (providerId === STATIC_PROVIDER_ID) {
    return createStaticShadowProvider({ modelId, dimensions, truncateDim });
  }
  if (providerId === MODEL2VEC_POTION_8M_PROVIDER_ID) {
    return createModel2VecPotion8mProvider({ modelId, truncateDim, importModule });
  }
  throw new Error(`Unknown embedding provider: ${String(provider || '').trim() || '(empty)'}`);
}

module.exports = {
  EMBEDDING_PROVIDER_AUTHORITY,
  EMBEDDING_PROVIDER_DISTANCE,
  EMBEDDING_PROVIDER_NORMALIZATION,
  FIXTURE_PROVIDER_ID,
  FIXTURE_MODEL_ID,
  STATIC_PROVIDER_ID,
  MODEL2VEC_POTION_8M_PROVIDER_ID,
  MODEL2VEC_POTION_8M_MODEL_ID,
  MODEL2VEC_POTION_8M_PACKAGE,
  MODEL2VEC_POTION_8M_PACKAGE_VERSION,
  createEmbeddingProvider,
  normalizeProviderId,
};
