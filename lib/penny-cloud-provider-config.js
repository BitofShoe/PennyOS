const fs = require('node:fs');
const path = require('node:path');

const OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_CHAT_MODEL = 'gpt-5.6';
const DEFAULT_OPENAI_EMBED_MODEL = 'text-embedding-3-small';
const DEFAULT_OPENAI_CLOUD_MODELS = Object.freeze({
  chat: DEFAULT_OPENAI_CHAT_MODEL,
  tool: DEFAULT_OPENAI_CHAT_MODEL,
  embed: DEFAULT_OPENAI_EMBED_MODEL,
});
const LOCAL_DEFAULT_BASE = 'http://127.0.0.1:1234/v1';

const CLOUD_PROVIDER_MANAGED_KEYS = [
  'PENNY_MODEL_PROVIDER',
  'PENNY_LOCAL_LLM_BACKEND',
  'PENNY_LOCAL_RUNTIME_LABEL',
  'PENNY_LMSTUDIO_BASE',
  'PENNY_LMSTUDIO_EMBED_BASE',
  'PENNY_LOCAL_LLM_TRANSPORT',
  'PENNY_SKIP_LMSTUDIO_PREP',
  'PENNY_LMSTUDIO_CHAT_MODEL',
  'PENNY_LMSTUDIO_TOOL_MODEL',
  'PENNY_LMSTUDIO_EMBED_MODEL',
  'PENNY_LMSTUDIO_API_KEY',
];

function cleanString(value = '') {
  return String(value || '').trim();
}

function normalizeBaseUrl(value = '', fallback = OPENAI_API_BASE) {
  const raw = cleanString(value) || fallback;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid provider base URL: ${raw}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Provider base URL must use http or https.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Provider base URL must not contain credentials.');
  }
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

function quoteEnvValue(value = '') {
  const escaped = String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `"${escaped}"`;
}

function redactApiKey(value = '') {
  const key = cleanString(value);
  if (!key) return '';
  if (key.length <= 8) return 'configured';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function buildOpenAiCloudEnvPatch({
  apiKey = '',
  baseUrl = OPENAI_API_BASE,
  chatModel = DEFAULT_OPENAI_CHAT_MODEL,
  toolModel = '',
  embedModel = DEFAULT_OPENAI_EMBED_MODEL,
} = {}) {
  const normalizedBase = normalizeBaseUrl(baseUrl, OPENAI_API_BASE);
  const normalizedChatModel = cleanString(chatModel) || DEFAULT_OPENAI_CHAT_MODEL;
  const normalizedToolModel = cleanString(toolModel) || normalizedChatModel;
  const normalizedEmbedModel = cleanString(embedModel) || DEFAULT_OPENAI_EMBED_MODEL;
  const normalizedApiKey = cleanString(apiKey);
  return {
    PENNY_MODEL_PROVIDER: 'openai_cloud',
    PENNY_LOCAL_LLM_BACKEND: 'openai_compatible',
    PENNY_LOCAL_RUNTIME_LABEL: 'OpenAI API (cloud)',
    PENNY_LMSTUDIO_BASE: normalizedBase,
    PENNY_LMSTUDIO_EMBED_BASE: normalizedBase,
    PENNY_LOCAL_LLM_TRANSPORT: 'chat',
    PENNY_SKIP_LMSTUDIO_PREP: '1',
    PENNY_LMSTUDIO_CHAT_MODEL: normalizedChatModel,
    PENNY_LMSTUDIO_TOOL_MODEL: normalizedToolModel,
    PENNY_LMSTUDIO_EMBED_MODEL: normalizedEmbedModel,
    PENNY_LMSTUDIO_API_KEY: normalizedApiKey,
  };
}

function buildLocalDefaultEnvPatch({
  baseUrl = LOCAL_DEFAULT_BASE,
  chatModel = 'google/gemma-4-31b',
  toolModel = 'google/gemma-4-e4b',
  embedModel = 'text-embedding-nomic-embed-text-v1.5',
} = {}) {
  const normalizedBase = normalizeBaseUrl(baseUrl, LOCAL_DEFAULT_BASE);
  return {
    PENNY_MODEL_PROVIDER: 'local',
    PENNY_LOCAL_LLM_BACKEND: 'lm_studio',
    PENNY_LOCAL_RUNTIME_LABEL: 'LM Studio',
    PENNY_LMSTUDIO_BASE: normalizedBase,
    PENNY_LMSTUDIO_EMBED_BASE: normalizedBase,
    PENNY_LOCAL_LLM_TRANSPORT: 'auto',
    PENNY_SKIP_LMSTUDIO_PREP: '1',
    PENNY_LMSTUDIO_CHAT_MODEL: cleanString(chatModel) || 'google/gemma-4-31b',
    PENNY_LMSTUDIO_TOOL_MODEL: cleanString(toolModel) || 'google/gemma-4-e4b',
    PENNY_LMSTUDIO_EMBED_MODEL: cleanString(embedModel) || 'text-embedding-nomic-embed-text-v1.5',
    PENNY_LMSTUDIO_API_KEY: 'lm-studio-local',
  };
}

function lineKey(line = '') {
  const match = String(line || '').match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
  return match ? match[1] : '';
}

function upsertPennyEnvFile({
  envFile,
  patch = {},
  managedKeys = CLOUD_PROVIDER_MANAGED_KEYS,
  fsImpl = fs,
  pathImpl = path,
} = {}) {
  const target = cleanString(envFile);
  if (!target) throw new Error('Penny env file path is not configured for this build.');
  const managed = new Set(managedKeys);
  const existingText = fsImpl.existsSync(target) ? fsImpl.readFileSync(target, 'utf8') : '';
  const lines = existingText.replace(/\r\n/g, '\n').split('\n');
  const nextLines = [];
  const written = new Set();

  for (const line of lines) {
    const key = lineKey(line);
    if (!key || !managed.has(key)) {
      nextLines.push(line);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    nextLines.push(`${key}=${quoteEnvValue(patch[key])}`);
    written.add(key);
  }

  const missing = managedKeys.filter((key) => Object.prototype.hasOwnProperty.call(patch, key) && !written.has(key));
  if (missing.length) {
    const hasContent = nextLines.some((line) => String(line || '').trim());
    if (hasContent && cleanString(nextLines[nextLines.length - 1])) nextLines.push('');
    nextLines.push('# PennyOS settings managed by the Settings screen.');
    for (const key of missing) {
      nextLines.push(`${key}=${quoteEnvValue(patch[key])}`);
    }
  }

  const nextText = `${nextLines.join('\n').replace(/\n*$/, '')}\n`;
  fsImpl.mkdirSync(pathImpl.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fsImpl.writeFileSync(tmp, nextText, 'utf8');
  fsImpl.renameSync(tmp, target);

  return {
    ok: true,
    envFileConfigured: true,
    updatedKeys: managedKeys.filter((key) => Object.prototype.hasOwnProperty.call(patch, key)),
    apiKeyConfigured: !!cleanString(patch.PENNY_LMSTUDIO_API_KEY),
    apiKeyPreview: redactApiKey(patch.PENNY_LMSTUDIO_API_KEY),
  };
}

function buildCloudProviderStatus({
  env = process.env,
} = {}) {
  const baseUrl = cleanString(env.PENNY_LMSTUDIO_BASE);
  const label = cleanString(env.PENNY_LOCAL_RUNTIME_LABEL);
  const provider = cleanString(env.PENNY_MODEL_PROVIDER).toLowerCase();
  const backend = cleanString(env.PENNY_LOCAL_LLM_BACKEND).toLowerCase();
  const isOpenAiCloud = provider === 'openai_cloud'
    || label === 'OpenAI API (cloud)'
    || /^https:\/\/api\.openai\.com\/v1\/?$/i.test(baseUrl);
  const apiKey = cleanString(env.PENNY_LMSTUDIO_API_KEY);
  return {
    ok: true,
    activeProvider: isOpenAiCloud ? 'openai-cloud' : 'local',
    openAiCloudConfigured: isOpenAiCloud && !!apiKey,
    apiKeyConfigured: !!apiKey && apiKey !== 'lm-studio-local',
    apiKeyPreview: apiKey && apiKey !== 'lm-studio-local' ? redactApiKey(apiKey) : '',
    baseUrl: isOpenAiCloud ? (baseUrl || OPENAI_API_BASE) : '',
    cloudDefaults: DEFAULT_OPENAI_CLOUD_MODELS,
    chatModel: cleanString(env.PENNY_LMSTUDIO_CHAT_MODEL) || (isOpenAiCloud ? DEFAULT_OPENAI_CHAT_MODEL : ''),
    toolModel: cleanString(env.PENNY_LMSTUDIO_TOOL_MODEL) || (isOpenAiCloud ? DEFAULT_OPENAI_CHAT_MODEL : ''),
    embedModel: cleanString(env.PENNY_LMSTUDIO_EMBED_MODEL) || (isOpenAiCloud ? DEFAULT_OPENAI_EMBED_MODEL : ''),
    local: {
      backend: backend || 'lm_studio',
      label: label || 'LM Studio',
      baseUrl,
    },
    privacy: {
      localFirstDefault: true,
      sendsPromptsOffDevice: isOpenAiCloud,
      sendsMemoryContextOffDevice: isOpenAiCloud,
      cloudMayCostMoney: isOpenAiCloud,
      warningRequired: true,
    },
  };
}

async function probeOpenAiCloudProvider({
  fetchImpl = fetch,
  apiKey = '',
  baseUrl = OPENAI_API_BASE,
  timeoutMs = 15000,
} = {}) {
  const normalizedApiKey = cleanString(apiKey);
  if (!normalizedApiKey) throw new Error('OpenAI API key is required.');
  const normalizedBase = normalizeBaseUrl(baseUrl, OPENAI_API_BASE);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${normalizedBase}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${normalizedApiKey}`,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      const parsedError = (() => {
        try {
          return JSON.parse(text)?.error?.message || '';
        } catch {
          return '';
        }
      })();
      const detail = parsedError || response.statusText || `HTTP ${response.status}`;
      const error = new Error(`OpenAI API key check failed: ${detail}`);
      error.statusCode = response.status;
      throw error;
    }
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    const modelIds = Array.isArray(parsed?.data)
      ? parsed.data.map((item) => cleanString(item?.id)).filter(Boolean)
      : [];
    return {
      ok: true,
      baseUrl: normalizedBase,
      modelCount: modelIds.length,
      sampleModels: modelIds.slice(0, 12),
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`OpenAI API key check timed out after ${timeoutMs}ms.`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  CLOUD_PROVIDER_MANAGED_KEYS,
  DEFAULT_OPENAI_CLOUD_MODELS,
  DEFAULT_OPENAI_CHAT_MODEL,
  DEFAULT_OPENAI_EMBED_MODEL,
  OPENAI_API_BASE,
  buildCloudProviderStatus,
  buildLocalDefaultEnvPatch,
  buildOpenAiCloudEnvPatch,
  normalizeBaseUrl,
  probeOpenAiCloudProvider,
  redactApiKey,
  upsertPennyEnvFile,
};
