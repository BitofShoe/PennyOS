const PROVIDER_MODEL_PROBE_SCHEMA = 'penny-provider-model-probe.v1';

function cleanText(value = '') {
  return String(value ?? '').trim();
}

function normalizeBaseUrl(value = '') {
  return cleanText(value || 'http://127.0.0.1:1234/v1').replace(/\/+$/g, '');
}

function normalizeModelIds(payload = {}) {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload?.models) ? payload.models : []);
  const ids = [];
  const seen = new Set();
  for (const row of rows) {
    const id = cleanText(typeof row === 'string' ? row : (row?.id ?? row?.model ?? row?.name));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

async function probeProviderModels({
  baseUrl = 'http://127.0.0.1:1234/v1',
  apiKey = 'lm-studio',
  fetchImpl = globalThis.fetch,
  timeoutMs = 15000,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('probeProviderModels requires fetch');
  const endpoint = `${normalizeBaseUrl(baseUrl)}/models`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Number(timeoutMs) || 15000));
  const startedAt = new Date().toISOString();
  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: cleanText(apiKey) ? { Authorization: `Bearer ${cleanText(apiKey)}` } : {},
      signal: controller.signal,
    });
    if (!response?.ok) {
      return {
        schema: PROVIDER_MODEL_PROBE_SCHEMA,
        ok: false,
        endpoint,
        statusCode: Number(response?.status) || 0,
        models: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        error: 'The configured provider models endpoint was unavailable.',
      };
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      return {
        schema: PROVIDER_MODEL_PROBE_SCHEMA,
        ok: false,
        endpoint,
        statusCode: Number(response?.status) || 0,
        models: [],
        startedAt,
        finishedAt: new Date().toISOString(),
        error: 'The configured provider returned an invalid models response.',
      };
    }
    return {
      schema: PROVIDER_MODEL_PROBE_SCHEMA,
      ok: true,
      endpoint,
      statusCode: Number(response?.status) || 200,
      models: normalizeModelIds(payload),
      startedAt,
      finishedAt: new Date().toISOString(),
      error: '',
    };
  } catch (error) {
    return {
      schema: PROVIDER_MODEL_PROBE_SCHEMA,
      ok: false,
      endpoint,
      statusCode: 0,
      models: [],
      startedAt,
      finishedAt: new Date().toISOString(),
      error: error?.name === 'AbortError'
        ? 'The configured provider models request timed out.'
        : 'The configured provider models endpoint was unreachable.',
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  PROVIDER_MODEL_PROBE_SCHEMA,
  normalizeModelIds,
  probeProviderModels,
};
