const DEFAULT_SPEACHES_BASE_URL = 'http://127.0.0.1:8000';
const DEFAULT_SPEACHES_MODEL = 'speaches-ai/Kokoro-82M-v1.0-ONNX';
const DEFAULT_SPEACHES_VOICE = 'af_heart';
const DEFAULT_RESPONSE_FORMAT = 'wav';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_TEXT_CHARS = 6000;

class RuntimeVoiceError extends Error {
  constructor(statusCode = 500, code = 'runtime_voice_error', message = 'Runtime voice failed.', details = {}) {
    super(message);
    this.name = 'RuntimeVoiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function cleanText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeBaseUrl(value = '') {
  const rawInput = String(value || '').trim() || DEFAULT_SPEACHES_BASE_URL;
  const raw = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawInput) ? rawInput : `http://${rawInput}`;
  return raw.replace(/\/+$/, '').replace(/\/v1$/i, '') || DEFAULT_SPEACHES_BASE_URL;
}

function normalizeResponseFormat(value = '') {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '');
  return text || DEFAULT_RESPONSE_FORMAT;
}

function normalizeRuntimeVoiceConfig(input = {}, fallback = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const timeoutMs = Math.max(1000, Math.min(120000, Number(
    source.timeoutMs
    || base.timeoutMs
    || process.env.PENNY_SPEACHES_TIMEOUT_MS
    || process.env.SPEACHES_TIMEOUT_MS
    || DEFAULT_TIMEOUT_MS,
  ) || DEFAULT_TIMEOUT_MS));
  const maxTextChars = Math.max(100, Math.min(20000, Number(
    source.maxTextChars
    || base.maxTextChars
    || process.env.PENNY_SPEACHES_MAX_TEXT_CHARS
    || DEFAULT_MAX_TEXT_CHARS,
  ) || DEFAULT_MAX_TEXT_CHARS));
  return {
    provider: 'speaches',
    baseUrl: normalizeBaseUrl(
      source.baseUrl
      || base.baseUrl
      || process.env.PENNY_SPEACHES_BASE_URL
      || process.env.SPEACHES_BASE_URL
      || DEFAULT_SPEACHES_BASE_URL,
    ),
    model: cleanText(
      source.model
      || base.model
      || process.env.PENNY_SPEACHES_MODEL
      || process.env.SPEACHES_MODEL
      || DEFAULT_SPEACHES_MODEL,
    ),
    voice: cleanText(
      source.voice
      || base.voice
      || process.env.PENNY_SPEACHES_VOICE
      || process.env.SPEACHES_VOICE
      || DEFAULT_SPEACHES_VOICE,
    ),
    responseFormat: normalizeResponseFormat(
      source.responseFormat
      || source.response_format
      || base.responseFormat
      || process.env.PENNY_SPEACHES_RESPONSE_FORMAT
      || process.env.SPEACHES_RESPONSE_FORMAT
      || DEFAULT_RESPONSE_FORMAT,
    ),
    timeoutMs,
    maxTextChars,
  };
}

function getModelList(payload = {}) {
  const list = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload) ? payload : []);
  return list;
}

function extractModelIds(payload = {}) {
  return getModelList(payload)
    .map((entry) => (typeof entry === 'string' ? entry : entry?.id))
    .map((id) => cleanText(id))
    .filter(Boolean);
}

function extractVoiceIdsForModel(payload = {}, modelId = '') {
  const targetModel = cleanText(modelId);
  const list = getModelList(payload);
  const entry = list.find((item) => typeof item === 'object' && cleanText(item?.id) === targetModel)
    || list.find((item) => typeof item === 'object' && Array.isArray(item?.voices));
  const voices = Array.isArray(entry?.voices) ? entry.voices : [];
  return voices
    .map((voice) => (typeof voice === 'string' ? voice : (voice?.id || voice?.name)))
    .map((id) => cleanText(id))
    .filter(Boolean);
}

async function readResponseText(response) {
  try {
    return cleanText(await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new RuntimeVoiceError(504, 'timeout', 'Speaches did not respond before Penny timed out.');
    }
    throw new RuntimeVoiceError(503, 'unreachable', `Speaches is not reachable: ${error?.message || error}`);
  } finally {
    clearTimeout(timeout);
  }
}

function createRuntimeVoiceApi({
  fetchImpl = globalThis.fetch,
  config = {},
  onConfigChange = null,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new RuntimeVoiceError(500, 'fetch_unavailable', 'Runtime voice needs fetch support.');
  }
  let currentConfig = normalizeRuntimeVoiceConfig(config);

  function getConfig() {
    return { ...currentConfig };
  }

  async function setConfig(patch = {}) {
    currentConfig = normalizeRuntimeVoiceConfig(patch, currentConfig);
    if (typeof onConfigChange === 'function') {
      await onConfigChange(getConfig());
    }
    return { ok: true, provider: 'speaches', config: getConfig() };
  }

  async function getStatus() {
    const cfg = getConfig();
    try {
      const response = await fetchWithTimeout(
        fetchImpl,
        `${cfg.baseUrl}/v1/models`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        Math.min(cfg.timeoutMs, 10000),
      );
      if (!response.ok) {
        return {
          ok: true,
          provider: 'speaches',
          reachable: false,
          ready: false,
          config: cfg,
          availableModels: [],
          error: `Speaches models check failed: ${response.status}`,
        };
      }
      const payload = await response.json();
      const availableModels = extractModelIds(payload);
      const availableVoices = extractVoiceIdsForModel(payload, cfg.model);
      const ready = !!cfg.model && availableModels.some((id) => id === cfg.model);
      return {
        ok: true,
        provider: 'speaches',
        reachable: true,
        ready,
        config: cfg,
        availableModels,
        availableVoices,
        error: ready ? '' : `Configured Speaches model is not loaded: ${cfg.model}`,
      };
    } catch (error) {
      return {
        ok: true,
        provider: 'speaches',
        reachable: false,
        ready: false,
        config: cfg,
        availableModels: [],
        availableVoices: [],
        error: error?.message || String(error || 'Speaches is not reachable.'),
      };
    }
  }

  async function synthesizeSpeech({ text = '', voice = '' } = {}) {
    const cfg = getConfig();
    const input = cleanText(text);
    if (!input) {
      throw new RuntimeVoiceError(400, 'empty_text', 'Penny needs text before she can speak.');
    }
    if (input.length > cfg.maxTextChars) {
      throw new RuntimeVoiceError(400, 'text_too_long', `Voice text is too long for one request (${cfg.maxTextChars} characters max).`);
    }
    if (!cfg.model) {
      throw new RuntimeVoiceError(503, 'model_unconfigured', 'No Speaches model is configured.');
    }
    const payload = {
      model: cfg.model,
      voice: cleanText(voice) || cfg.voice,
      input,
      response_format: cfg.responseFormat,
    };
    const response = await fetchWithTimeout(fetchImpl, `${cfg.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        Accept: 'audio/*, application/octet-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }, cfg.timeoutMs);
    if (!response.ok) {
      const detail = await readResponseText(response);
      throw new RuntimeVoiceError(
        response.status === 408 ? 504 : 502,
        'upstream_error',
        `Speaches speech request failed: ${response.status}${detail ? ` ${detail}` : ''}`,
      );
    }
    const contentType = cleanText(response.headers?.get?.('content-type') || 'audio/wav') || 'audio/wav';
    if (!/^audio\//i.test(contentType) && !/application\/octet-stream/i.test(contentType)) {
      throw new RuntimeVoiceError(502, 'non_audio_response', `Speaches returned ${contentType || 'a non-audio response'}.`);
    }
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    if (!audioBuffer.length) {
      throw new RuntimeVoiceError(502, 'empty_audio', 'Speaches returned an empty audio response.');
    }
    return {
      ok: true,
      provider: 'speaches',
      contentType,
      audioBuffer,
    };
  }

  return {
    getConfig,
    setConfig,
    getStatus,
    synthesizeSpeech,
  };
}

module.exports = {
  RuntimeVoiceError,
  createRuntimeVoiceApi,
  normalizeRuntimeVoiceConfig,
};
