const STATIC_SHADOW_EMBED_PROVIDER = 'static';
const STATIC_SHADOW_EMBED_MODEL = 'penny-static-shadow-lexical-v1';
const STATIC_SHADOW_EMBED_DIMENSIONS = 64;

const STATIC_STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'did', 'do', 'for',
  'from', 'how', 'i', 'in', 'is', 'it', 'me', 'my', 'near', 'of', 'on', 'or',
  'the', 'this', 'to', 'was', 'were', 'what', 'when', 'where', 'which', 'who',
  'with', 'you', 'your',
]);

function normalizeShadowEmbedProvider(value = '') {
  const text = String(value || '').trim().toLowerCase();
  return text === STATIC_SHADOW_EMBED_PROVIDER ? STATIC_SHADOW_EMBED_PROVIDER : '';
}

function normalizeStaticText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeStaticText(value = '') {
  return normalizeStaticText(value)
    .split(/\s+/)
    .filter((token) => token && !STATIC_STOPWORDS.has(token));
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

function addFeature(vector, feature = '', weight = 1) {
  if (!feature || !vector.length) return;
  const hash = hashFeature(feature);
  const index = hash % vector.length;
  const sign = (hash & 1) === 0 ? 1 : -1;
  vector[index] += sign * Number(weight || 0);
}

function normalizeVector(vector = []) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
  if (!norm) return vector.map(() => 0);
  return vector.map((value) => Math.round((value / norm) * 1000000) / 1000000);
}

function createStaticShadowEmbedding(text = '', {
  dimensions = STATIC_SHADOW_EMBED_DIMENSIONS,
} = {}) {
  const size = Math.max(8, Math.min(256, Math.round(Number(dimensions || STATIC_SHADOW_EMBED_DIMENSIONS))));
  const vector = Array.from({ length: size }, () => 0);
  const tokens = tokenizeStaticText(text);
  tokens.forEach((token) => {
    addFeature(vector, `tok:${token}`, 1);
  });
  for (let index = 0; index < tokens.length - 1; index += 1) {
    addFeature(vector, `bi:${tokens[index]} ${tokens[index + 1]}`, 1.35);
  }
  for (let index = 0; index < tokens.length - 2; index += 1) {
    addFeature(vector, `tri:${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`, 1.6);
  }
  return normalizeVector(vector);
}

function buildStaticShadowCacheKey(text = '', {
  provider = STATIC_SHADOW_EMBED_PROVIDER,
  model = STATIC_SHADOW_EMBED_MODEL,
} = {}) {
  return `${provider}:${model}:${hashFeature(`${provider}\n${model}\n${normalizeStaticText(text)}`).toString(16).padStart(8, '0')}`;
}

function createStaticShadowEmbeddingProvider({
  model = STATIC_SHADOW_EMBED_MODEL,
  dimensions = STATIC_SHADOW_EMBED_DIMENSIONS,
} = {}) {
  const providerModel = String(model || STATIC_SHADOW_EMBED_MODEL).trim() || STATIC_SHADOW_EMBED_MODEL;
  return {
    provider: STATIC_SHADOW_EMBED_PROVIDER,
    model: providerModel,
    dimensions: Math.max(8, Math.min(256, Math.round(Number(dimensions || STATIC_SHADOW_EMBED_DIMENSIONS)))),
    cacheKeyForText(text = '') {
      return buildStaticShadowCacheKey(text, {
        provider: STATIC_SHADOW_EMBED_PROVIDER,
        model: providerModel,
      });
    },
    createEmbedding(text = '') {
      return createStaticShadowEmbedding(text, { dimensions });
    },
    async fetch(_url, options = {}) {
      let input = '';
      try {
        const body = JSON.parse(options.body || '{}');
        input = Array.isArray(body.input) ? body.input.join('\n') : String(body.input || '');
      } catch {
        input = '';
      }
      const embedding = createStaticShadowEmbedding(input, { dimensions });
      return {
        ok: true,
        async text() {
          return JSON.stringify({
            data: [
              {
                object: 'embedding',
                model: providerModel,
                embedding,
              },
            ],
          });
        },
      };
    },
    async getLmStudioConnectionStatus() {
      return {
        reachable: true,
        installedModels: [providerModel],
        nativeAvailableModels: [providerModel],
        availableModels: [providerModel],
      };
    },
  };
}

module.exports = {
  STATIC_SHADOW_EMBED_PROVIDER,
  STATIC_SHADOW_EMBED_MODEL,
  STATIC_SHADOW_EMBED_DIMENSIONS,
  buildStaticShadowCacheKey,
  createStaticShadowEmbedding,
  createStaticShadowEmbeddingProvider,
  normalizeShadowEmbedProvider,
};
