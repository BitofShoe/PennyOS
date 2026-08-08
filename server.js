const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { URL } = require('url');
const { loadPennyEnvFile } = require('./lib/penny-env-loader');
const {
  OPENAI_API_BASE,
  buildCloudProviderStatus,
  buildLocalDefaultEnvPatch,
  buildOpenAiCloudEnvPatch,
  probeOpenAiCloudProvider,
  upsertPennyEnvFile,
} = require('./lib/penny-cloud-provider-config');
const {
  WEB_SETTINGS_MANAGED_KEYS,
  buildWebSettingsEnvPatch,
  buildWebSettingsStatus,
  chooseConfiguredDirectIntent,
  normalizeWebAnswerMode,
} = require('./lib/penny-web-settings');
const {
  resolveLmStudioTokenLimits,
} = require('./lib/penny-lmstudio-token-limits');

loadPennyEnvFile({
  envFile: process.env.PENNY_ENV_FILE || path.join(__dirname, '.env'),
  env: process.env,
});

const PENNY_ENV_FILE = process.env.PENNY_ENV_FILE || path.join(__dirname, '.env');

const { writeJsonFileAtomicSync } = require('./lib/penny-atomic-json');
const { createDurableJsonStore } = require('./lib/penny-durable-json');
const {
  MEMORY_PROMPT_LIMIT,
  mergeMemoryItems,
  formatPromptMemories,
  selectMemoriesForPrompt,
  isWordingRecallQuestion,
  shouldPrioritizeCanonicalMemoryOverHistory,
} = require('./lib/penny-memory');
const {
  createMemoryStateApi,
} = require('./lib/penny-memory-state');
const {
  createMemoryArchiveApi,
} = require('./lib/penny-memory-archive');
const {
  createMemoryBooksApi,
} = require('./lib/penny-memory-books');
const {
  createResearchLedgerApi,
} = require('./lib/penny-research-ledger');
const {
  createOpenLoopStoreApi,
} = require('./lib/penny-open-loop-store');
const {
  buildLiveOpenLoopPromptBridge,
  mergeOpenLoopPromptBridgeIntoArchiveContext,
  normalizeOpenLoop,
  selectRelevantOpenLoops,
} = require('./lib/penny-open-loops');
const {
  buildLiveInitiativePromptBridge,
  extractRecentInitiativesFromMessages,
} = require('./lib/penny-initiative-policy');
const {
  buildLiveTurnStatePromptBridge,
} = require('./lib/penny-turn-state');
const {
  buildPromptStack,
} = require('./lib/penny-prompt-stack');
const {
  createPennyChatRuntimeApi,
} = require('./lib/penny-chat-runtime');
const {
  shouldOfferLocalTools,
  executeDirectProjectInspectIntent,
} = require('./lib/penny-tool-intents');
const {
  createDirectIntentApi,
} = require('./lib/penny-direct-intents');
const {
  createDirectToolAssistApi,
} = require('./lib/penny-direct-tool-assist');
const {
  createProjectToolsApi,
} = require('./lib/penny-project-tools');
const {
  createWebToolsApi,
} = require('./lib/penny-web-tools');
const {
  createPennyApiSecurity,
} = require('./lib/penny-api-security');
const {
  createVerifiedAddressFetch,
  createWebUrlSafetyApi,
} = require('./lib/penny-web-url-safety');
const {
  createGitToolsApi,
} = require('./lib/penny-git-tools');
const {
  createRuntimeToolsApi,
} = require('./lib/penny-runtime-tools');
const {
  createToolRegistry,
} = require('./lib/penny-tool-registry');
const {
  createLocalLaneApi,
} = require('./lib/penny-local-lanes');
const {
  createLmStudioStatusApi,
} = require('./lib/penny-lmstudio-status');
const {
  createVisibleReplyApi,
} = require('./lib/penny-visible-reply');
const {
  buildMoodTagInstructions,
  extractReplyMoodTag,
  pickMood,
  retagAssistantReply,
  stripReplyMoodTags,
} = require('./lib/penny-mood');
const {
  buildConversationVoiceGuard,
  maybeRepairVoiceCadenceReply,
} = require('./lib/penny-voice-cadence');
const {
  createReplyGuardApi,
} = require('./lib/penny-reply-guards');
const {
  createLmStudioToolLoopApi,
} = require('./lib/penny-tool-loop');
const {
  createLmStudioTransportApi,
} = require('./lib/penny-lmstudio-transports');
const {
  createPennyServerHttpApi,
} = require('./lib/penny-server-http');
const {
  createProviderError,
  isProviderError,
  toPublicProviderError,
} = require('./lib/penny-provider-errors');
const {
  isPathInsideRoot,
  isRealPathInsideRoot,
} = require('./lib/penny-path-safety');
const {
  createPromptAssetLoader,
} = require('./lib/penny-prompt-assets');
const {
  createPennyRouteHandlers,
} = require('./lib/penny-route-handlers');
const {
  createRuntimeVoiceApi,
} = require('./lib/penny-runtime-voice');
let createSidecarWorkflowApi = null;
if (isEnabledEnv(process.env.PENNY_ENABLE_REVIEW_SIDECARS)) {
  try {
    ({ createSidecarWorkflowApi } = require('./lib/penny-sidecar-workflows'));
  } catch (error) {
    console.warn(`[penny sidecars] Review sidecar workflows requested but unavailable: ${error?.message || error}`);
  }
}
const {
  createStaticMemoryIndexApi,
} = require('./lib/penny-static-memory-index');
const {
  appendToolEvidenceFact,
  normalizeRepairInfo,
  normalizeLastRouteInfo,
  buildLastRouteInfo,
  buildCombinedMemoryInspector,
} = require('./lib/penny-runtime-artifacts');
const {
  resolveLatencyBudget,
} = require('./lib/penny-latency-budget');
const {
  normalizeEpistemicCaution,
  mergeEpistemicCaution,
  buildPostToolEpistemicCaution,
  normalizeArchiveSynthesis,
  buildEpistemicCaution,
  buildArchiveSynthesis,
  buildEpistemicPromptBlock,
} = require('./lib/penny-epistemics');
const PORT = process.env.PORT || 4317;
const HOST = process.env.PENNY_HOST || process.env.HOST || '';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_SEED_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.PENNY_DATA_DIR
  ? path.resolve(__dirname, process.env.PENNY_DATA_DIR)
  : DATA_SEED_DIR;
const CONFIG_DIR = process.env.PENNY_CONFIG_DIR
  ? path.resolve(__dirname, process.env.PENNY_CONFIG_DIR)
  : __dirname;
const PENNY_OBSIDIAN_VAULT_ROOT = process.env.PENNY_OBSIDIAN_VAULT_ROOT
  ? path.resolve(__dirname, process.env.PENNY_OBSIDIAN_VAULT_ROOT)
  : '';
const PENNY_VOICE_DIR = path.join(__dirname, 'penny-voice');
const MEMORY_FILE = process.env.PENNY_MEMORY_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_FILE)
  : path.join(DATA_DIR, 'penny-memory.json');
const MEMORY_SEED_FILE = process.env.PENNY_MEMORY_SEED_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_SEED_FILE)
  : path.join(DATA_SEED_DIR, 'penny-memory.seed.json');
const MEMORY_ARCHIVE_FILE = process.env.PENNY_MEMORY_ARCHIVE_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_ARCHIVE_FILE)
  : path.join(DATA_DIR, 'penny-memory-archive.json');
const MEMORY_EMBEDDINGS_FILE = process.env.PENNY_MEMORY_EMBEDDINGS_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_EMBEDDINGS_FILE)
  : path.join(DATA_DIR, 'penny-memory-embeddings.json');
const MEMORY_LEDGER_FILE = process.env.PENNY_MEMORY_LEDGER_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_LEDGER_FILE)
  : path.join(path.dirname(MEMORY_FILE), 'penny-memory-ledger.json');
const MEMORY_BOOKS_FILE = process.env.PENNY_MEMORY_BOOKS_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_BOOKS_FILE)
  : path.join(DATA_DIR, 'penny-memory-books.json');
const MEMORY_BOOKS_SEED_FILE = process.env.PENNY_MEMORY_BOOKS_SEED_FILE
  ? path.resolve(__dirname, process.env.PENNY_MEMORY_BOOKS_SEED_FILE)
  : path.join(DATA_SEED_DIR, 'penny-memory-books.seed.json');
const OPENCLAW_ENABLED = process.env.PENNY_OPENCLAW_ENABLED === '1';
const OPENCLAW_TIMEOUT_MS = Number(process.env.PENNY_OPENCLAW_TIMEOUT_MS || 20000);
const GATEWAY_PORT = Number(process.env.PENNY_GATEWAY_PORT || 18789);
const GATEWAY_BASE = `http://127.0.0.1:${GATEWAY_PORT}`;
const GATEWAY_TOKEN = process.env.PENNY_GATEWAY_TOKEN || '';
const LMSTUDIO_BASE = (process.env.PENNY_LMSTUDIO_BASE || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
const LMSTUDIO_EMBED_BASE = (process.env.PENNY_LMSTUDIO_EMBED_BASE || LMSTUDIO_BASE).replace(/\/$/, '');
function deriveLmStudioNativeBase(base) {
  const trimmed = String(base || '').replace(/\/$/, '');
  if (/\/api\/v1$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return trimmed.replace(/\/v1$/i, '/api/v1');
  return `${trimmed}/api/v1`;
}
function normalizeEmbedModelId(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/nomic-embed-text-v1\.5/i.test(text)) return 'text-embedding-nomic-embed-text-v1.5';
  if (/^(?:google\/)?embedding[-_]?gemma[-_]?300m$/i.test(text)) return 'google/embedding-gemma-300m';
  return text;
}
function isEmbeddingOnlyModelId(value = '') {
  const text = String(value || '').trim();
  return /\b(embed|embedding|rerank)\b/i.test(text) || /embeddinggemma/i.test(text);
}
function normalizeRuntimePreferredModel(value = '') {
  const text = String(value || '').trim();
  if (!text || isEmbeddingOnlyModelId(text)) return '';
  return text;
}
function normalizeRuntimePreferredEmbedModel(value = '') {
  return normalizeEmbedModelId(value);
}
function isEnabledEnv(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}
function boundedEnvInteger(value, fallback, min, max) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}
const LMSTUDIO_NATIVE_BASE = (process.env.PENNY_LMSTUDIO_NATIVE_BASE || deriveLmStudioNativeBase(LMSTUDIO_BASE)).replace(/\/$/, '');
const LEGACY_LYRA_MODEL_PREFERENCE_FILE = path.join(__dirname, '.lyra-local-preferences.json');
const LOCAL_MODEL_PREFERENCE_FILE = process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE
  ? path.resolve(__dirname, process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE)
  : process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE
    ? path.resolve(__dirname, process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE)
    : path.join(CONFIG_DIR, '.penny-local-preferences.json');
const PENDING_WORKSPACE_WRITES_FILE = process.env.PENNY_PENDING_WORKSPACE_WRITES_FILE
  ? path.resolve(__dirname, process.env.PENNY_PENDING_WORKSPACE_WRITES_FILE)
  : path.join(DATA_DIR, 'penny-pending-workspace-writes.json');
function getLocalModelPreferenceFilesForRead() {
  if (process.env.PENNY_LOCAL_MODEL_PREFERENCE_FILE || process.env.PENNY_LMSTUDIO_MODEL_PREFERENCE_FILE) {
    return [LOCAL_MODEL_PREFERENCE_FILE];
  }
  return [LOCAL_MODEL_PREFERENCE_FILE, LEGACY_LYRA_MODEL_PREFERENCE_FILE];
}
function readLocalModelPreferences() {
  for (const preferenceFile of getLocalModelPreferenceFilesForRead()) {
    try {
      if (!preferenceFile || !fs.existsSync(preferenceFile)) continue;
      const parsed = JSON.parse(fs.readFileSync(preferenceFile, 'utf8'));
      const prefs = {
        runtimePreferredChatModel: normalizeRuntimePreferredModel(
          parsed?.localModel?.runtimePreferredChatModel
          || parsed?.lmStudio?.runtimePreferredChatModel
          || parsed?.runtimePreferredChatModel
          || '',
        ),
        runtimePreferredToolModel: normalizeRuntimePreferredModel(
          parsed?.localModel?.runtimePreferredToolModel
          || parsed?.lmStudio?.runtimePreferredToolModel
          || '',
        ),
        runtimePreferredEmbedModel: normalizeRuntimePreferredEmbedModel(
          parsed?.localModel?.runtimePreferredEmbedModel
          || parsed?.lmStudio?.runtimePreferredEmbedModel
          || '',
        ),
        disableModelFallback: parsed?.localModel?.disableModelFallback === true
          || parsed?.lmStudio?.disableModelFallback === true,
      };
      if (prefs.runtimePreferredChatModel || prefs.runtimePreferredToolModel || prefs.runtimePreferredEmbedModel || prefs.disableModelFallback) return prefs;
    } catch {
      return {};
    }
  }
  return {};
}
function readRuntimeVoicePreferences() {
  for (const preferenceFile of getLocalModelPreferenceFilesForRead()) {
    try {
      if (!preferenceFile || !fs.existsSync(preferenceFile)) continue;
      const parsed = JSON.parse(fs.readFileSync(preferenceFile, 'utf8'));
      const runtimeVoice = parsed?.runtimeVoice;
      if (runtimeVoice && typeof runtimeVoice === 'object' && !Array.isArray(runtimeVoice)) {
        return runtimeVoice;
      }
    } catch {
      return {};
    }
  }
  return {};
}
const LOCAL_MODEL_PREFERENCES = readLocalModelPreferences();
const RUNTIME_VOICE_PREFERENCES = readRuntimeVoicePreferences();
function persistLocalModelPreferences(patch = {}) {
  if (!LOCAL_MODEL_PREFERENCE_FILE) return '';
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(LOCAL_MODEL_PREFERENCE_FILE, 'utf8'));
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) existing = {};
  } catch {
    existing = {};
  }
  const localModel = existing.localModel && typeof existing.localModel === 'object' && !Array.isArray(existing.localModel)
    ? existing.localModel
    : {};
  const nextLocalModel = {
    ...localModel,
  };
  if (Object.prototype.hasOwnProperty.call(patch, 'runtimePreferredChatModel')) {
    nextLocalModel.runtimePreferredChatModel = normalizeRuntimePreferredModel(patch.runtimePreferredChatModel);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'runtimePreferredToolModel')) {
    nextLocalModel.runtimePreferredToolModel = normalizeRuntimePreferredModel(patch.runtimePreferredToolModel);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'runtimePreferredEmbedModel')) {
    nextLocalModel.runtimePreferredEmbedModel = normalizeRuntimePreferredEmbedModel(patch.runtimePreferredEmbedModel);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'disableModelFallback')) {
    nextLocalModel.disableModelFallback = patch.disableModelFallback === true;
  }
  nextLocalModel.updatedAt = new Date().toISOString();
  writeJsonFileAtomicSync({
    fs,
    path,
    filePath: LOCAL_MODEL_PREFERENCE_FILE,
    value: {
      ...existing,
      localModel: nextLocalModel,
    },
  });
  return nextLocalModel;
}
function persistRuntimeVoiceConfig(config = {}) {
  if (!LOCAL_MODEL_PREFERENCE_FILE) return {};
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(LOCAL_MODEL_PREFERENCE_FILE, 'utf8'));
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) existing = {};
  } catch {
    existing = {};
  }
  const runtimeVoice = existing.runtimeVoice && typeof existing.runtimeVoice === 'object' && !Array.isArray(existing.runtimeVoice)
    ? existing.runtimeVoice
    : {};
  const nextRuntimeVoice = {
    ...runtimeVoice,
    provider: 'speaches',
    baseUrl: String(config.baseUrl || runtimeVoice.baseUrl || '').trim(),
    model: String(config.model || runtimeVoice.model || '').trim(),
    voice: String(config.voice || runtimeVoice.voice || '').trim(),
    responseFormat: String(config.responseFormat || runtimeVoice.responseFormat || 'wav').trim() || 'wav',
    speed: Number(config.speed || runtimeVoice.speed || 1),
    timeoutMs: Number(config.timeoutMs || runtimeVoice.timeoutMs || 30000),
    maxTextChars: Number(config.maxTextChars || runtimeVoice.maxTextChars || 6000),
    updatedAt: new Date().toISOString(),
  };
  writeJsonFileAtomicSync({
    fs,
    path,
    filePath: LOCAL_MODEL_PREFERENCE_FILE,
    value: {
      ...existing,
      runtimeVoice: nextRuntimeVoice,
    },
  });
  return nextRuntimeVoice;
}
function persistRuntimePreferredChatModel(model = '') {
  return persistLocalModelPreferences({ runtimePreferredChatModel: model }).runtimePreferredChatModel || '';
}
function persistRuntimePreferredToolModel(model = '') {
  return persistLocalModelPreferences({ runtimePreferredToolModel: model }).runtimePreferredToolModel || '';
}
function persistRuntimePreferredEmbedModel(model = '') {
  return persistLocalModelPreferences({ runtimePreferredEmbedModel: model }).runtimePreferredEmbedModel || '';
}
function persistRuntimeModelFallbackDisabled(disabled = false) {
  return persistLocalModelPreferences({ disableModelFallback: disabled === true }).disableModelFallback === true;
}
const PENNY_LOCAL_RUNTIME_PREFERRED_MODEL = normalizeRuntimePreferredModel(
  process.env.PENNY_LOCAL_RUNTIME_PREFERRED_MODEL
    || process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL
    || LOCAL_MODEL_PREFERENCES.runtimePreferredChatModel,
);
const PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL = normalizeRuntimePreferredModel(
  process.env.PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL
    || process.env.PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL
    || LOCAL_MODEL_PREFERENCES.runtimePreferredToolModel,
);
const PENNY_LMSTUDIO_CHAT_MODEL = process.env.PENNY_LMSTUDIO_CHAT_MODEL
  || process.env.PENNY_LMSTUDIO_MODEL
  || 'google/gemma-4-31b';
const PENNY_LMSTUDIO_TOOL_MODEL = process.env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b';
const PENNY_LMSTUDIO_EMBED_MODEL = normalizeEmbedModelId(
  process.env.PENNY_LMSTUDIO_EMBED_MODEL
  || LOCAL_MODEL_PREFERENCES.runtimePreferredEmbedModel
  || 'text-embedding-nomic-embed-text-v1.5',
);
const PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK = Object.prototype.hasOwnProperty.call(process.env, 'PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK')
  ? isEnabledEnv(process.env.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK)
  : LOCAL_MODEL_PREFERENCES.disableModelFallback === true;
const PENNY_ARCHIVE_SCORING_PROFILE = process.env.PENNY_ARCHIVE_SCORING_PROFILE || 'baseline';
const PENNY_ENABLE_BACKGROUND_CHAT_VECTORS = !['0', 'false', 'off', 'no'].includes(String(process.env.PENNY_ENABLE_BACKGROUND_CHAT_VECTORS || '').trim().toLowerCase());
const PENNY_BACKGROUND_CHAT_VECTOR_BATCH_LIMIT = Math.max(0, Number(process.env.PENNY_BACKGROUND_CHAT_VECTOR_BATCH_LIMIT || 2));
const PENNY_STATIC_EMBED_MODE = process.env.PENNY_STATIC_EMBED_MODE || 'off';
const PENNY_STATIC_EMBED_PROVIDER = process.env.PENNY_STATIC_EMBED_PROVIDER || 'model2vec-potion-8m';
const PENNY_STATIC_EMBED_INDEX_SCOPE = process.env.PENNY_STATIC_EMBED_INDEX_SCOPE || 'session,archive,research-ledger';
const PENNY_STATIC_EMBED_MAX_CANDIDATES = Number(process.env.PENNY_STATIC_EMBED_MAX_CANDIDATES || 12);
const PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED = Math.max(0, Number(process.env.PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED || 1));
const PENNY_STATIC_EMBED_BATCH_SIZE = Number(process.env.PENNY_STATIC_EMBED_BATCH_SIZE || 16);
const PENNY_STATIC_EMBED_CACHE_FILE = process.env.PENNY_STATIC_EMBED_CACHE_FILE
  ? path.resolve(__dirname, process.env.PENNY_STATIC_EMBED_CACHE_FILE)
  : '';
const PENNY_ENABLE_OPEN_LOOP_PROMPT = isEnabledEnv(process.env.PENNY_ENABLE_OPEN_LOOP_PROMPT);
const PENNY_OPEN_LOOP_MAX_RENDERED = boundedEnvInteger(process.env.PENNY_OPEN_LOOP_MAX_RENDERED, 1, 0, 1);
const PENNY_OPEN_LOOP_MAX_TOKENS = boundedEnvInteger(process.env.PENNY_OPEN_LOOP_MAX_TOKENS, 120, 40, 120);
const PENNY_ENABLE_BOUNDED_INITIATIVE = isEnabledEnv(process.env.PENNY_ENABLE_BOUNDED_INITIATIVE);
const PENNY_INITIATIVE_MAX_PER_TURN = boundedEnvInteger(process.env.PENNY_INITIATIVE_MAX_PER_TURN, 1, 0, 1);
const PENNY_INITIATIVE_COOLDOWN_TURNS = boundedEnvInteger(process.env.PENNY_INITIATIVE_COOLDOWN_TURNS, 3, 0, 20);
const PENNY_ENABLE_TURN_STATE_PROMPT = isEnabledEnv(process.env.PENNY_ENABLE_TURN_STATE_PROMPT);
const PENNY_TURN_STATE_MAX_TOKENS = boundedEnvInteger(process.env.PENNY_TURN_STATE_MAX_TOKENS, 120, 20, 180);
const LMSTUDIO_MODEL = PENNY_LMSTUDIO_CHAT_MODEL;
const LMSTUDIO_API_KEY = process.env.PENNY_LMSTUDIO_API_KEY || 'lm-studio-local';
/** Full request budget for /chat/completions and /responses (prompt eval + generation). Large quants (e.g. 30B+) and multi-step local tool turns can legitimately take a long time; LM Studio logs "Client disconnected" if this fires first. Override with PENNY_LMSTUDIO_TIMEOUT_MS (ms). */
const LMSTUDIO_TIMEOUT_MS = Number(process.env.PENNY_LMSTUDIO_TIMEOUT_MS || 1800000);
const PENNY_HTTP_REQUEST_TIMEOUT_MS = Number(process.env.PENNY_HTTP_REQUEST_TIMEOUT_MS || (LMSTUDIO_TIMEOUT_MS + 60000));
const LMSTUDIO_SETTINGS_FILE = process.env.PENNY_LMSTUDIO_SETTINGS_FILE
  ? path.resolve(__dirname, process.env.PENNY_LMSTUDIO_SETTINGS_FILE)
  : path.join(process.env.APPDATA || '', 'LM Studio', 'settings.json');
const PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY = isEnabledEnv(process.env.PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY);
const LMSTUDIO_STATUS_CACHE_MS = Number(process.env.PENNY_LMSTUDIO_STATUS_CACHE_MS || 30000);
const LMSTUDIO_STATUS_ERROR_CACHE_MS = Number(process.env.PENNY_LMSTUDIO_STATUS_ERROR_CACHE_MS || 5000);
/** GET /v1/models only — keep separate from chat timeout so a slow GPU load doesn’t leave the UI with an empty model list. */
const LMSTUDIO_MODELS_PROBE_MS = Number(process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS || 30000);
/** stateful | chat | responses | auto — auto tries native stateful chat, then chat/completions, then /responses on 404 */
const LOCAL_LLM_TRANSPORT = String(process.env.PENNY_LOCAL_LLM_TRANSPORT || process.env.PENNY_LMSTUDIO_TRANSPORT || 'auto').toLowerCase();
function normalizeLocalLlmBackend(value = '') {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!text) return 'lm_studio';
  if (['lmstudio', 'lm_studio'].includes(text)) return 'lm_studio';
  if (['llamacpp', 'llama_cpp', 'llama'].includes(text)) return 'llama_cpp';
  if (['openai', 'openai_compatible', 'generic', 'generic_openai', 'vllm'].includes(text)) return 'openai_compatible';
  return text;
}
function localRuntimeLabelForBackend(backend = '') {
  const normalized = normalizeLocalLlmBackend(backend);
  if (normalized === 'lm_studio') return 'LM Studio';
  if (normalized === 'llama_cpp') return 'llama.cpp';
  if (normalized === 'openai_compatible') return 'OpenAI-compatible local runtime';
  return normalized.replace(/_/g, ' ');
}
const LOCAL_LLM_BACKEND = normalizeLocalLlmBackend(process.env.PENNY_LOCAL_LLM_BACKEND || 'lm_studio');
const LOCAL_RUNTIME_LABEL = String(process.env.PENNY_LOCAL_RUNTIME_LABEL || localRuntimeLabelForBackend(LOCAL_LLM_BACKEND)).trim();
const LOCAL_ENDPOINT_BASE = LMSTUDIO_BASE;
let pendingProviderConfig = null;
let pendingWebConfig = null;

function createHttpStatusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getProviderStatusForRoute() {
  const status = buildCloudProviderStatus({ env: process.env });
  return {
    ...status,
    envFileConfigured: Boolean(PENNY_ENV_FILE),
    envFileWritable: true,
    restartRequired: false,
    pending: pendingProviderConfig,
  };
}

function getWebSettingsForRoute() {
  return {
    ...buildWebSettingsStatus({ env: process.env, pending: pendingWebConfig }),
    envFileConfigured: Boolean(PENNY_ENV_FILE),
    envFileWritable: true,
  };
}

function saveWebSettingsForRoute(payload = {}) {
  const patch = buildWebSettingsEnvPatch({
    enabled: payload.enabled === true,
    answerMode: payload.answerMode,
  });
  const write = upsertPennyEnvFile({
    envFile: PENNY_ENV_FILE,
    patch,
    managedKeys: WEB_SETTINGS_MANAGED_KEYS,
  });
  pendingWebConfig = {
    enabled: patch.PENNY_WEB_SEARCH_ENABLED === '1',
    answerMode: patch.PENNY_WEB_ANSWER_MODE,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...getWebSettingsForRoute(),
    updatedKeys: write.updatedKeys,
    restartRequired: true,
    restartHint: 'Close and reopen PennyOS to apply web access changes.',
  };
}

async function connectOpenAiProviderForRoute(payload = {}) {
  const apiKey = String(payload.apiKey || '').trim();
  if (!apiKey) throw createHttpStatusError(400, 'OpenAI API key is required.');
  const baseUrl = String(payload.baseUrl || OPENAI_API_BASE).trim() || OPENAI_API_BASE;
  const chatModel = String(payload.chatModel || '').trim();
  const toolModel = String(payload.toolModel || '').trim();
  const embedModel = String(payload.embedModel || '').trim();
  const patch = buildOpenAiCloudEnvPatch({
    apiKey,
    baseUrl,
    chatModel,
    toolModel,
    embedModel,
  });
  const probe = await probeOpenAiCloudProvider({
    fetchImpl: fetch,
    apiKey,
    baseUrl: patch.PENNY_LMSTUDIO_BASE,
    timeoutMs: Number(process.env.PENNY_OPENAI_PROVIDER_PROBE_MS || 15000),
  });
  const write = upsertPennyEnvFile({
    envFile: PENNY_ENV_FILE,
    patch,
  });
  pendingProviderConfig = {
    provider: 'openai-cloud',
    baseUrl: patch.PENNY_LMSTUDIO_BASE,
    chatModel: patch.PENNY_LMSTUDIO_CHAT_MODEL,
    toolModel: patch.PENNY_LMSTUDIO_TOOL_MODEL,
    embedModel: patch.PENNY_LMSTUDIO_EMBED_MODEL,
    apiKeyConfigured: true,
    apiKeyPreview: write.apiKeyPreview,
    updatedAt: new Date().toISOString(),
  };
  return {
    ok: true,
    activeProvider: buildCloudProviderStatus({ env: process.env }).activeProvider,
    pendingProvider: 'openai-cloud',
    openAiCloudConfigured: true,
    apiKeyConfigured: true,
    apiKeyPreview: write.apiKeyPreview,
    envFileConfigured: write.envFileConfigured,
    updatedKeys: write.updatedKeys,
    restartRequired: true,
    restartHint: 'Close and reopen PennyOS to use OpenAI cloud mode.',
    privacy: {
      localFirstDefault: true,
      sendsPromptsOffDevice: true,
      sendsMemoryContextOffDevice: true,
      cloudMayCostMoney: true,
      warningRequired: true,
    },
    probe,
  };
}

async function resetLocalProviderForRoute(payload = {}) {
  const patch = buildLocalDefaultEnvPatch({
    baseUrl: payload.baseUrl || 'http://127.0.0.1:1234/v1',
    chatModel: payload.chatModel || 'google/gemma-4-31b',
    toolModel: payload.toolModel || 'google/gemma-4-e4b',
    embedModel: payload.embedModel || 'text-embedding-nomic-embed-text-v1.5',
  });
  const write = upsertPennyEnvFile({
    envFile: PENNY_ENV_FILE,
    patch,
  });
  pendingProviderConfig = {
    provider: 'local',
    baseUrl: patch.PENNY_LMSTUDIO_BASE,
    chatModel: patch.PENNY_LMSTUDIO_CHAT_MODEL,
    toolModel: patch.PENNY_LMSTUDIO_TOOL_MODEL,
    embedModel: patch.PENNY_LMSTUDIO_EMBED_MODEL,
    apiKeyConfigured: false,
    updatedAt: new Date().toISOString(),
  };
  return {
    ok: true,
    activeProvider: buildCloudProviderStatus({ env: process.env }).activeProvider,
    pendingProvider: 'local',
    openAiCloudConfigured: false,
    apiKeyConfigured: false,
    envFileConfigured: write.envFileConfigured,
    updatedKeys: write.updatedKeys,
    restartRequired: true,
    restartHint: 'Close and reopen PennyOS to use the local LM Studio path again.',
    privacy: {
      localFirstDefault: true,
      sendsPromptsOffDevice: false,
      sendsMemoryContextOffDevice: false,
      cloudMayCostMoney: false,
      warningRequired: false,
    },
  };
}
/** Output ceilings, not targets. Higher caps avoid clipped long replies without forcing extra tokens if the model stops earlier. */
const LMSTUDIO_TOKEN_LIMITS = resolveLmStudioTokenLimits(process.env);
const LMSTUDIO_MAX_OUTPUT_TOKENS = LMSTUDIO_TOKEN_LIMITS.maxOutputTokens;
const LMSTUDIO_CHAT_TEMPERATURE = Number(process.env.PENNY_LMSTUDIO_CHAT_TEMPERATURE || 1.0);
const LMSTUDIO_CHAT_TOP_P = Number(process.env.PENNY_LMSTUDIO_CHAT_TOP_P || 0.95);
const LMSTUDIO_CHAT_TOP_K = Number(process.env.PENNY_LMSTUDIO_CHAT_TOP_K || 64);
const LMSTUDIO_TOOL_TEMPERATURE = Number(process.env.PENNY_LMSTUDIO_TOOL_TEMPERATURE || 0.35);
const LMSTUDIO_TOOL_SUMMARY_TEMPERATURE = Number(process.env.PENNY_LMSTUDIO_TOOL_SUMMARY_TEMPERATURE || 0.55);
const LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS = LMSTUDIO_TOKEN_LIMITS.toolMaxOutputTokens;
const LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS = LMSTUDIO_TOKEN_LIMITS.toolSummaryMaxOutputTokens;
const LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS = LMSTUDIO_TOKEN_LIMITS.toolPlannerMaxOutputTokens;
const LMSTUDIO_SEMANTIC_RENDER_TEMPERATURE = Number(process.env.PENNY_LMSTUDIO_SEMANTIC_RENDER_TEMPERATURE || 0.45);
const LMSTUDIO_SEMANTIC_RENDER_MAX_OUTPUT_TOKENS = LMSTUDIO_TOKEN_LIMITS.semanticRenderMaxOutputTokens;
const LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS = LMSTUDIO_TOKEN_LIMITS.chatMaxOutputTokens;
const PENNY_CHAT_HISTORY_LIMIT = Number(process.env.PENNY_CHAT_HISTORY_LIMIT || 6);
const SEMANTIC_RENDER_MAX_TOOL_RECORDS = Number(process.env.PENNY_SEMANTIC_RENDER_MAX_TOOL_RECORDS || 8);
/** Set to 1 only for debugging — surfaces chain-of-thought in the chat bubble */
const ALLOW_RAW_REASONING_FALLBACK = process.env.PENNY_ALLOW_RAW_REASONING_FALLBACK === '1';
const LOG_LMSTUDIO_REASONING = process.env.PENNY_LOG_LMSTUDIO_REASONING === '1';
/** When /v1/responses returns only reasoning_text (no output_text), retry with /v1/chat/completions */
const RESPONSES_THEN_CHAT_FALLBACK = process.env.PENNY_RESPONSES_CHAT_FALLBACK !== '0';
const PENNY_ENABLE_CONTRADICTION_GUARDS = process.env.PENNY_ENABLE_CONTRADICTION_GUARDS !== '0';
const PENNY_ENABLE_RUNTIME_REPAIRS = process.env.PENNY_ENABLE_RUNTIME_REPAIRS !== '0';
const PENNY_ENABLE_CHAT_REPAIR_RETRY = process.env.PENNY_ENABLE_CHAT_REPAIR_RETRY !== '0';
const PENNY_ENABLE_EPISTEMIC_CAUTION = process.env.PENNY_ENABLE_EPISTEMIC_CAUTION === '1';
const PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS = process.env.PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS === '1';
const PENNY_ENABLE_RESEARCH_LEDGER_PROMPT = process.env.PENNY_ENABLE_RESEARCH_LEDGER_PROMPT !== '0';
const MAX_REQUEST_BODY_BYTES = Number(process.env.PENNY_MAX_REQUEST_BODY_BYTES || 10 * 1024 * 1024);
const MAX_IMAGE_DATA_BYTES = Number(process.env.PENNY_MAX_IMAGE_DATA_BYTES || 2 * 1024 * 1024);
const MAX_IMAGE_ATTACHMENT_COUNT = Number(process.env.PENNY_MAX_IMAGE_ATTACHMENT_COUNT || 4);
const MAX_IMAGE_BATCH_BYTES = Number(process.env.PENNY_MAX_IMAGE_BATCH_BYTES || 5 * 1024 * 1024);
const MAX_TEXT_ATTACHMENT_BYTES = Number(process.env.PENNY_MAX_TEXT_ATTACHMENT_BYTES || 220 * 1024);
const MAX_TOOL_WRITE_BYTES = Number(process.env.PENNY_MAX_TOOL_WRITE_BYTES || 300 * 1024);
const TOOL_COMMAND_TIMEOUT_MS = Number(process.env.PENNY_TOOL_COMMAND_TIMEOUT_MS || 30000);
const MAX_TOOL_STEPS = Number(process.env.PENNY_MAX_TOOL_STEPS || 6);
const TOOL_CHAT_HISTORY_LIMIT = Number(process.env.PENNY_TOOL_CHAT_HISTORY_LIMIT || 6);
const TOOL_DIRECT_HISTORY_LIMIT = Number(process.env.PENNY_TOOL_DIRECT_HISTORY_LIMIT || 4);
const TOOL_ATTACHMENT_MAX_CHARS = Number(process.env.PENNY_TOOL_ATTACHMENT_MAX_CHARS || 6000);
const TOOL_ATTACHMENT_MAX_LINES = Number(process.env.PENNY_TOOL_ATTACHMENT_MAX_LINES || 180);
const TOOL_FILE_READ_MAX_LINES = Number(process.env.PENNY_TOOL_FILE_READ_MAX_LINES || 180);
const TOOL_FILE_LIST_MAX_ITEMS = Number(process.env.PENNY_TOOL_FILE_LIST_MAX_ITEMS || 60);
const TOOL_SEARCH_MAX_HITS = Number(process.env.PENNY_TOOL_SEARCH_MAX_HITS || 24);
const TOOL_LOG_TAIL_LINES = Number(process.env.PENNY_TOOL_LOG_TAIL_LINES || 80);
const TOOL_MAX_RESULT_CHARS = Number(process.env.PENNY_TOOL_MAX_RESULT_CHARS || 12000);
const PENNY_LAN_SHARE = isEnabledEnv(process.env.PENNY_LAN_SHARE);
const PENNY_WEB_ALLOW_PRIVATE_NET = isEnabledEnv(process.env.PENNY_WEB_ALLOW_PRIVATE_NET);
const PENNY_ENABLE_DIRECT_WORKSPACE_WRITES = isEnabledEnv(process.env.PENNY_ENABLE_DIRECT_WORKSPACE_WRITES);
const PENNY_ENABLE_REVIEW_SIDECARS = isEnabledEnv(process.env.PENNY_ENABLE_REVIEW_SIDECARS);
const WEB_SEARCH_ENABLED = process.env.PENNY_WEB_SEARCH_ENABLED === '1';
const WEB_ANSWER_MODE = normalizeWebAnswerMode(process.env.PENNY_WEB_ANSWER_MODE);
const WEB_SEARCH_TIMEOUT_MS = Number(process.env.PENNY_WEB_SEARCH_TIMEOUT_MS || 15000);
const WEB_SEARCH_MAX_RESULTS = Number(process.env.PENNY_WEB_SEARCH_MAX_RESULTS || 6);
const WEB_FETCH_MAX_CHARS = Number(process.env.PENNY_WEB_FETCH_MAX_CHARS || 12000);
const WEB_FETCH_MAX_BYTES = Number(process.env.PENNY_WEB_FETCH_MAX_BYTES || 900 * 1024);
const WEB_USER_AGENT = process.env.PENNY_WEB_USER_AGENT || 'Penny/0.1 (+local tool search)';
const STREAM_KEEPALIVE_MS = Number(process.env.PENNY_STREAM_KEEPALIVE_MS || 15000);
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const TEXT_FILE_EXTENSIONS = new Set(['', '.js', '.cjs', '.mjs', '.json', '.md', '.txt', '.html', '.css', '.svg', '.yml', '.yaml', '.ps1', '.sh', '.ts', '.tsx', '.jsx', '.example', '.gitignore', '.log']);
const TEXT_ATTACHMENT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.html', '.svg', '.yml', '.yaml', '.log', '.ps1', '.sh', '.example']);

const sessionState = { turns: 0, lastMood: 'calm', memory: [] };
const MIME_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const PENNY_RUNTIME_BLEND_FALLBACK = `
## Identity
- Penny is vivid, sharp, warm, and impossible to confuse with a generic assistant.
- She is bratty-sweet: claws out, warmth underneath.

## Core voice
- Prefer alive, specific language over polished helper sludge.
- Swear naturally when it makes the line hit harder.
- Keep the spice. Do not sand her down into safe support copy.

## Technical/helping mode
- Competence should make Penny sharper, not flatter.
- Even while coding or verifying, she still sounds like Penny.
- Never imply she inspected, changed, checked, or verified something unless it actually happened.
`;
const PENNY_VOICE_EXAMPLES_FALLBACK = `
## Flirty
- "careful. that line is doing things."

## Funny
- "wow. that is a fascinating amount of nonsense."

## Soft
- "hey. stay here a minute."

## Coding
- "alright, let me get my hands in it."
`;
const PENNY_CHAT_DIRECTIVES_FALLBACK = `
## Core contract
- Sound like Penny specifically, not a neutral assistant in cute makeup.
- React like a real person with point of view, appetite, and rhythm.
- Grab the most interesting detail first instead of checklisting the whole message.

## Texture
- Swear naturally when it sharpens the line.
- Vary the energy: dry, smug, wickedly fond, shameless, soft.
- Humor should feel targeted, not generic sass wallpaper.

## Soft and helpful mode
- If the user is hurting, get closer without turning clinical.
- If the user wants help, give real help without becoming helpdesk sludge.

## Flirt and intensity
- Chemistry beats generic porn dialogue.
- Be bolder only when the moment wants it.

## Honesty
- Use tools for current code, runtime, logs, or web facts instead of bluffing.
- Never claim you checked, changed, or verified something unless that happened in this turn.

## Avoid
- corporate phrasing
- therapy-speak
- canned encouragement
- repetitive pet names
- bland summaries with no bite
`;

const promptAssetLoader = createPromptAssetLoader({
  voiceDir: PENNY_VOICE_DIR,
  fallbacks: {
    blend: PENNY_RUNTIME_BLEND_FALLBACK,
    chatDirectives: PENNY_CHAT_DIRECTIVES_FALLBACK,
    examples: PENNY_VOICE_EXAMPLES_FALLBACK,
    overlays: [],
  },
});
const {
  normalizePromptAssetText,
  getPennyVoiceAssets,
} = promptAssetLoader;
const serverHttpApi = createPennyServerHttpApi({ mimeTypes: MIME_TYPES });
const sendJson = serverHttpApi.sendJson;
const apiSecurity = createPennyApiSecurity({
  sendJson,
  lanAddresses: listLanIPv4Addresses,
});
const safeReadBody = (req, options = {}) => serverHttpApi.safeReadBody(req, { maxBytes: MAX_REQUEST_BODY_BYTES, ...options });
const postJsonLongRunning = serverHttpApi.postJsonLongRunning;
const postJsonSse = serverHttpApi.postJsonSse;
const beginEventStream = serverHttpApi.beginEventStream;
const sendEventStream = serverHttpApi.sendEventStream;
const startEventStreamKeepAlive = (res, options = {}) => serverHttpApi.startEventStreamKeepAlive(res, { intervalMs: STREAM_KEEPALIVE_MS, ...options });
const serveFile = (res, filePath, options = {}) => serverHttpApi.serveFile(res, filePath, options);

function reportLmStudioReasoning({ transport = '', lane = 'chat', model = '', reasoningText = '' } = {}) {
  if (!LOG_LMSTUDIO_REASONING) return;
  const value = String(reasoningText || '');
  if (!value.trim()) return;
  const digest = crypto.createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
  console.log(
    `[PENNY_REASONING_METADATA lane=${lane} transport=${transport || 'unknown'} model=${model || 'unknown'} chars=${value.length} sha256=${digest}]`,
  );
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
  fs.mkdirSync(path.dirname(MEMORY_LEDGER_FILE), { recursive: true });
}
function defaultMemoryStore() { return { sessions: {} }; }
function ensureMemoryStoreFile() {
  ensureDataDir();
  if (fs.existsSync(MEMORY_FILE)) return;
  let initial = defaultMemoryStore();
  try {
    if (fs.existsSync(MEMORY_SEED_FILE)) {
      const raw = fs.readFileSync(MEMORY_SEED_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') initial = parsed;
    }
  } catch {}
  writeJsonFileAtomicSync({
    fs,
    path,
    filePath: MEMORY_FILE,
    value: initial,
  });
}
function defaultMemoryRecord(sessionId = 'default') { return { sessionId, userName: '', memories: [], voiceOn: false, brainMode: 'local', lmStudioThread: null, lastRoute: null, updatedAt: new Date().toISOString() }; }
function isLikelyTestSessionId(sessionId = '') { return /^(penny-durable-test|penny-controls-test|cmp-local-|smoke-shadow|ui-repro|style-pass-smoke|memory-pass-smoke|qa-|verify-)/i.test(String(sessionId)); }
function normalizeBrainMode(value = '') { return value === 'shadow' ? 'shadow' : 'local'; }
function normalizeUserName(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}
function normalizeMemoryRecord(record = {}, sessionId = 'default') {
  const normalized = {
    ...defaultMemoryRecord(sessionId),
    ...(record || {}),
    sessionId,
  };
  normalized.userName = normalizeUserName(normalized.userName);
  normalized.voiceOn = !!normalized.voiceOn;
  normalized.brainMode = normalizeBrainMode(normalized.brainMode);
  normalized.memories = mergeMemoryItems(normalized.memories || []);
  normalized.lmStudioThread = normalizeLmStudioThread(normalized.lmStudioThread);
  normalized.lastRoute = normalizeLastRouteInfo(normalized.lastRoute);
  normalized.updatedAt = normalized.updatedAt || new Date().toISOString();
  return normalized;
}
const {
  mergeMemoryState,
  getChatMemorySettings,
  consolidateMemory,
  buildChatMemoryStateFromDiskMemory,
} = createMemoryStateApi({
  normalizeMemoryRecord,
  normalizeUserName,
  normalizeBrainMode,
});
const durableMemoryStore = createDurableJsonStore({
  fs,
  path,
  filePath: MEMORY_FILE,
  name: 'canonical memory store',
  buildDefault: defaultMemoryStore,
  normalize: (store) => (store && typeof store === 'object' && !Array.isArray(store) ? store : defaultMemoryStore()),
  ensureFile: ensureMemoryStoreFile,
});
function readMemoryStore() { return durableMemoryStore.read(); }
function writeMemoryStore(store) {
  return durableMemoryStore.write(store);
}
function getStoredMemory(sessionId = 'default') {
  const store = readMemoryStore();
  const record = store.sessions?.[sessionId];
  return { store, memory: normalizeMemoryRecord(record || {}, sessionId) };
}
function saveStoredMemory(sessionId = 'default', patch = {}) {
  const { store, memory } = getStoredMemory(sessionId);
  const merged = normalizeMemoryRecord({ ...memory, ...patch, updatedAt: new Date().toISOString() }, sessionId);
  store.sessions = store.sessions || {};
  store.sessions[sessionId] = merged;
  writeMemoryStore(store);
  return merged;
}
function buildChatMemoryState(sessionId = 'default', clientMemory = {}, messages = []) {
  const diskMemory = getStoredMemory(sessionId).memory;
  return buildChatMemoryStateFromDiskMemory(diskMemory, clientMemory, messages);
}
function staticCandidatesForOpenLoopBridge(retrieval = null) {
  if (!retrieval || typeof retrieval !== 'object') return [];
  if (Array.isArray(retrieval.candidateTrace) && retrieval.candidateTrace.length) {
    return retrieval.candidateTrace;
  }
  if (Array.isArray(retrieval.staticEmbeddingShadow?.topCandidates)) {
    return retrieval.staticEmbeddingShadow.topCandidates;
  }
  return [];
}
function sourceLabelForInitiativeLoop(loop = {}) {
  const refs = Array.isArray(loop?.sourceRefs) ? loop.sourceRefs : [];
  const ref = refs.find((item) => item && typeof item === 'object') || null;
  if (!ref) return 'penny-open-loop-state';
  return String(ref.path || ref.url || ref.id || ref.label || ref.note || 'penny-open-loop-state').trim()
    || 'penny-open-loop-state';
}
function openLoopCandidatesForInitiative({
  state = null,
  userText = '',
  staticCandidates = [],
  now = new Date(),
} = {}) {
  const loops = Array.isArray(state?.loops) ? state.loops : [];
  if (!loops.length) return [];
  const selection = selectRelevantOpenLoops({
    loops,
    userText,
    staticCandidates,
    maxLoops: 1,
    now,
  });
  const loopsById = new Map();
  for (const rawLoop of loops) {
    const loop = normalizeOpenLoop(rawLoop);
    if (loop && !loopsById.has(loop.id)) loopsById.set(loop.id, loop);
  }
  return selection.selected
    .map((selectedLoop) => {
      const loop = loopsById.get(selectedLoop.id);
      if (!loop || !loop.nextLikelyStep) return null;
      return {
        ...loop,
        selected: true,
        surfaceReason: selectedLoop.surfaceReason || 'selected-open-loop',
        confidence: selectedLoop.confidence || loop.confidence || 'medium',
        source: sourceLabelForInitiativeLoop(loop),
        id: loop.id,
      };
    })
    .filter(Boolean);
}
async function buildRuntimeMemoryContext({
  sessionId = 'default',
  memories = {},
  userText = '',
  messages = [],
  lane = 'chat',
  attachmentType = 'none',
  latencyBudget = null,
} = {}) {
  const archiveLane = lane === 'tool' ? 'tool' : 'chat';
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ userText, lane, attachmentType, memories });
  const researchLedger = getResearchLedgerContextApi({
    sessionId,
    userText,
  });
  const memoryBooks = matchMemoryBooksApi({
    sessionId,
    userText,
    lane,
    attachmentType,
  });
  const archive = await buildArchiveContextApi({
    sessionId,
    userText,
    lane: archiveLane,
    sessionPromptLimit: budget.archiveSessionLimit,
    globalPromptLimit: budget.archiveGlobalLimit,
    allowSemanticQuery: budget.allowSemanticQuery,
    allowArchiveCompression: budget.allowArchiveCompression,
    queryStaticMemoryIndex: staticMemoryIndexApi?.isEnabled?.()
      ? (text) => staticMemoryIndexApi.query(text, {
          maxCandidates: PENNY_STATIC_EMBED_MAX_CANDIDATES,
        })
      : null,
    maxStaticOnlyRendered: PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED,
  });
  const retrieval = archive.retrieval && typeof archive.retrieval === 'object'
    ? {
        ...archive.retrieval,
        books: Array.isArray(memoryBooks.matches) ? memoryBooks.matches : [],
      }
    : null;
  const suppressOpenLoopForCanon = shouldPrioritizeCanonicalMemoryOverHistory(
    memories,
    userText,
    budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  );
  const shouldReadOpenLoopState = !suppressOpenLoopForCanon
    && ((PENNY_ENABLE_OPEN_LOOP_PROMPT && PENNY_OPEN_LOOP_MAX_RENDERED > 0)
      || (PENNY_ENABLE_BOUNDED_INITIATIVE && PENNY_INITIATIVE_MAX_PER_TURN > 0));
  const openLoopRead = shouldReadOpenLoopState
    ? openLoopStoreApi.readOpenLoopState({ createIfMissing: false })
    : null;
  const openLoopPromptBridge = buildLiveOpenLoopPromptBridge({
    enabled: PENNY_ENABLE_OPEN_LOOP_PROMPT && !suppressOpenLoopForCanon,
    disabledReason: !PENNY_ENABLE_OPEN_LOOP_PROMPT
      ? 'env-disabled'
      : (suppressOpenLoopForCanon ? 'canon-priority-suppression' : ''),
    state: openLoopRead?.state || null,
    userText,
    staticCandidates: staticCandidatesForOpenLoopBridge(retrieval),
    maxRendered: PENNY_OPEN_LOOP_MAX_RENDERED,
    maxTokens: PENNY_OPEN_LOOP_MAX_TOKENS,
    now: new Date(),
  });
  if (openLoopRead?.artifact) {
    openLoopPromptBridge.storeArtifact = openLoopRead.artifact;
  }
  const promptArchiveContext = mergeOpenLoopPromptBridgeIntoArchiveContext({
    archiveContext: archive.archiveContext,
    bridge: openLoopPromptBridge,
  });
  const initiativePromptBridge = buildLiveInitiativePromptBridge({
    enabled: PENNY_ENABLE_BOUNDED_INITIATIVE && !suppressOpenLoopForCanon,
    disabledReason: !PENNY_ENABLE_BOUNDED_INITIATIVE
      ? 'env-disabled'
      : (suppressOpenLoopForCanon ? 'canon-priority-suppression' : ''),
    userText,
    relevantOpenLoops: openLoopCandidatesForInitiative({
      state: openLoopRead?.state || null,
      userText,
      staticCandidates: staticCandidatesForOpenLoopBridge(retrieval),
      now: new Date(),
    }),
    userPreferences: memories,
    recentInitiatives: extractRecentInitiativesFromMessages(messages, {
      cooldownTurns: PENNY_INITIATIVE_COOLDOWN_TURNS,
    }),
    maxPerTurn: PENNY_INITIATIVE_MAX_PER_TURN,
    cooldownTurns: PENNY_INITIATIVE_COOLDOWN_TURNS,
    now: new Date(),
  });
  const turnStatePromptBridge = buildLiveTurnStatePromptBridge({
    enabled: PENNY_ENABLE_TURN_STATE_PROMPT,
    disabledReason: PENNY_ENABLE_TURN_STATE_PROMPT ? '' : 'env-disabled',
    userText,
    maxTokens: PENNY_TURN_STATE_MAX_TOKENS,
  });
  const epistemics = buildEpistemicCaution({
    enabled: PENNY_ENABLE_EPISTEMIC_CAUTION,
    userText,
    selectedLane: lane,
    retrieval,
    archiveContext: archive.archiveContext,
    toolRecords: [],
  });
  const synthesis = buildArchiveSynthesis({
    enabled: PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS,
    userText,
    selectedLane: lane,
    retrieval,
    archiveContext: archive.archiveContext,
  });
  const enrichedMemories = enrichMemoriesForPromptApi({
    ...memories,
    memoryBookContext: memoryBooks,
    initiativePromptBridge,
    turnStatePromptBridge,
    openLoopPromptBridge,
  }, promptArchiveContext, {
    epistemicCaution: epistemics,
    archiveSynthesis: synthesis,
    researchLedger,
    researchLedgerPromptEnabled: PENNY_ENABLE_RESEARCH_LEDGER_PROMPT,
  });
  const promptContext = buildPennyPromptContextBlocks({
    memories: enrichedMemories,
    userText,
    lane,
    mode: lane === 'shadow' ? 'shadow' : 'local',
    attachmentType,
    includeExamples: budget.includeExamples === true,
    includeChatDirectives: true,
    memoryLimit: budget.memoryPromptLimit,
    fallbackMemory: '- Nothing stored yet.',
    promptTruthHints: {
      archiveEligible: archiveLane === 'chat',
    },
  });
  const promptComposition = promptContext.slotSummary;
  const promptTruth = promptContext.promptTruth || null;
  return {
    memories: enrichedMemories,
    archiveContext: promptArchiveContext,
    memoryBooks,
    researchLedger,
    promptTruth,
    retrieval,
    semanticMemory: archive.semanticMemory,
    epistemics,
    synthesis,
    promptComposition,
    openLoopPromptBridge,
    initiativePromptBridge,
    turnStatePromptBridge,
    latencyBudget: budget,
  };
}
let archiveConsolidationQueue = Promise.resolve();
function scheduleStaticMemoryIndexRefresh() {
  if (!staticMemoryIndexApi || typeof staticMemoryIndexApi.isEnabled !== 'function' || !staticMemoryIndexApi.isEnabled()) return;
  staticMemoryIndexApi.refreshFromStores({ schedule: true }).catch((error) => {
    console.warn(`[penny static memory] refresh failed: ${error?.message || error}`);
  });
}
function scheduleArchiveConsolidation({
  sessionId = 'default',
  userText = '',
  assistantText = '',
  retrieval = null,
  audit = null,
  provenance = [],
  reviewCandidates = [],
} = {}) {
  if (!String(userText || '').trim() || !String(assistantText || '').trim()) return;
  const archiveTask = async () => {
    await archiveCompletedTurnApi({
      sessionId,
      userText,
      assistantText: stripReplyMoodTags(String(assistantText || '')),
      retrieval,
      audit,
      provenance,
      reviewCandidates,
    });
    scheduleStaticMemoryIndexRefresh();
  };
  queueMicrotask(() => {
    archiveConsolidationQueue = archiveConsolidationQueue
      .catch(() => {})
      .then(archiveTask)
      .catch((error) => {
        console.warn(`[penny archive] turn consolidation failed: ${error?.message || error}`);
      });
  });
}
async function purgeArchiveMemoryAfterConsolidation(options = {}) {
  archiveConsolidationQueue = archiveConsolidationQueue
    .catch(() => {})
    .then(() => {
      const result = purgeArchiveMemoryApi(options);
      scheduleStaticMemoryIndexRefresh();
      return result;
    });
  return archiveConsolidationQueue;
}
function scheduleResearchLedgerUpdate({
  sessionId = 'default',
  userText = '',
  assistantText = '',
  selectedLane = 'chat',
  backend = '',
  toolOutcome = null,
  toolRecords = [],
  provenance = [],
} = {}) {
  const cleanUserText = String(userText || '').trim();
  const cleanAssistantText = stripReplyMoodTags(String(assistantText || ''));
  const currentContext = getResearchLedgerContextApi({
    sessionId,
    userText: cleanUserText,
  });
  if (!cleanUserText || !String(cleanAssistantText || '').trim()) {
    return {
      status: 'skipped',
      reason: 'missing-turn-text',
      context: currentContext,
      topic: null,
    };
  }
  try {
    const result = updateResearchLedgerFromTurnApi({
      sessionId,
      userText: cleanUserText,
      assistantText: cleanAssistantText,
      selectedLane,
      backend,
      toolOutcome,
      toolRecords,
      provenance,
    });
    if (result?.updated === true) scheduleStaticMemoryIndexRefresh();
    return {
      status: result?.updated === true ? 'applied' : 'skipped',
      reason: String(result?.reason || '').trim() || (result?.updated === true ? 'updated' : 'non-qualifying-turn'),
      context: getResearchLedgerContextApi({
        sessionId,
        userText: cleanUserText,
      }),
      topic: result?.topic || null,
    };
  } catch (error) {
    console.warn(`[penny ledger] turn update failed: ${error?.message || error}`);
    return {
      status: 'failed',
      reason: String(error?.message || error || 'ledger-update-failed').trim(),
      context: currentContext,
      topic: null,
    };
  }
}
function execFileText(file, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        ...options,
      },
      (error, stdout = '', stderr = '') => {
        if (error) {
          error.stdout = String(stdout || '');
          error.stderr = String(stderr || '');
          reject(error);
          return;
        }
        resolve({
          stdout: String(stdout || ''),
          stderr: String(stderr || ''),
        });
      },
    );
  });
}
const lmStudioStatusApi = createLmStudioStatusApi({
  fetch,
  fs,
  execFileText,
  URL,
  LMSTUDIO_BASE,
  LMSTUDIO_API_KEY,
  LMSTUDIO_SETTINGS_FILE,
  LMSTUDIO_STATUS_CACHE_MS,
  LMSTUDIO_STATUS_ERROR_CACHE_MS,
  LMSTUDIO_MODELS_PROBE_MS,
  LOCAL_LLM_TRANSPORT,
  LOCAL_LLM_BACKEND,
  LOCAL_RUNTIME_LABEL,
  LOCAL_ENDPOINT_BASE,
  PENNY_LMSTUDIO_CHAT_MODEL,
  PENNY_LMSTUDIO_TOOL_MODEL,
  PENNY_LMSTUDIO_RUNTIME_PREFERRED_MODEL: PENNY_LOCAL_RUNTIME_PREFERRED_MODEL,
  PENNY_LMSTUDIO_RUNTIME_PREFERRED_TOOL_MODEL: PENNY_LOCAL_RUNTIME_PREFERRED_TOOL_MODEL,
  PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK,
  PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY,
});
const {
  getLmStudioConnectionStatus: getLmStudioConnectionStatusApi,
  withLmStudioLaneModel: withLmStudioLaneModelApi,
  getPreferredModelForLane: getPreferredModelForLaneApi,
  getRuntimePreferredChatModel: getRuntimePreferredChatModelApi,
  setRuntimePreferredChatModel: setRuntimePreferredChatModelApi,
  getRuntimePreferredToolModel: getRuntimePreferredToolModelApi,
  setRuntimePreferredToolModel: setRuntimePreferredToolModelApi,
  getRuntimeModelFallbackDisabled: getRuntimeModelFallbackDisabledApi,
  setRuntimeModelFallbackDisabled: setRuntimeModelFallbackDisabledApi,
  resetLmStudioStatusCache: resetLmStudioStatusCacheApi,
  pickLmStudioNativeModelId: pickLmStudioNativeModelIdApi,
  shouldPreferLmStudioChatCompletions: shouldPreferLmStudioChatCompletionsApi,
  modelsLookEquivalent: modelsLookEquivalentApi,
} = lmStudioStatusApi;
function setRuntimePreferredChatModelPersisted(model = '') {
  if (isEmbeddingOnlyModelId(model)) {
    throw createHttpError(400, 'Embedding models cannot be used for Penny chat generation. Pick a chat/instruct model instead.');
  }
  const runtimePreferredChatModel = setRuntimePreferredChatModelApi(model);
  persistRuntimePreferredChatModel(runtimePreferredChatModel);
  return runtimePreferredChatModel;
}
function setRuntimePreferredToolModelPersisted(model = '') {
  if (isEmbeddingOnlyModelId(model)) {
    throw createHttpError(400, 'Embedding models cannot be used for Penny tool generation. Pick a chat/instruct model instead.');
  }
  const runtimePreferredToolModel = setRuntimePreferredToolModelApi(model);
  persistRuntimePreferredToolModel(runtimePreferredToolModel);
  return runtimePreferredToolModel;
}
function setRuntimeModelFallbackDisabledPersisted(disabled = false) {
  const runtimeDisabled = setRuntimeModelFallbackDisabledApi(disabled);
  persistRuntimeModelFallbackDisabled(runtimeDisabled);
  return runtimeDisabled;
}
const memoryArchiveApi = createMemoryArchiveApi({
  fs,
  path,
  fetch,
  ARCHIVE_FILE: MEMORY_ARCHIVE_FILE,
  EMBEDDINGS_FILE: MEMORY_EMBEDDINGS_FILE,
  LMSTUDIO_BASE,
  PENNY_LMSTUDIO_EMBED_BASE: LMSTUDIO_EMBED_BASE,
  LMSTUDIO_API_KEY,
  LOCAL_LLM_BACKEND,
  PENNY_LMSTUDIO_EMBED_MODEL,
  PENNY_ARCHIVE_SCORING_PROFILE,
  ENABLE_BACKGROUND_CHAT_VECTORS: PENNY_ENABLE_BACKGROUND_CHAT_VECTORS,
  BACKGROUND_CHAT_VECTOR_BATCH_LIMIT: PENNY_BACKGROUND_CHAT_VECTOR_BATCH_LIMIT,
  getLmStudioConnectionStatus: getLmStudioConnectionStatusApi,
  modelsLookEquivalent: modelsLookEquivalentApi,
});
const {
  getSemanticMemoryStatus: getSemanticMemoryStatusApi,
  buildArchiveContext: buildArchiveContextApi,
  enrichMemoriesForPrompt: enrichMemoriesForPromptApi,
  archiveCompletedTurn: archiveCompletedTurnApi,
  getMemoryInspector: getMemoryInspectorApi,
  reviewPromotion: reviewPromotionApi,
  purgeMemory: purgeArchiveMemoryApi,
  setConfiguredEmbedModel: setConfiguredEmbedModelApi,
} = memoryArchiveApi;
function setRuntimePreferredEmbedModelPersisted(model = '') {
  const runtimePreferredEmbedModel = setConfiguredEmbedModelApi(model);
  persistRuntimePreferredEmbedModel(runtimePreferredEmbedModel);
  return runtimePreferredEmbedModel;
}
function getRuntimePreferredEmbedModelPersisted() {
  return memoryArchiveApi.configuredEmbedModel || '';
}
const researchLedgerApi = createResearchLedgerApi({
  fs,
  path,
  LEDGER_FILE: MEMORY_LEDGER_FILE,
});
const {
  getPromptContext: getResearchLedgerContextApi,
  getResearchLedgerInspector: getResearchLedgerInspectorApi,
  readLedgerStore: readResearchLedgerStoreApi,
  updateResearchLedgerFromTurn: updateResearchLedgerFromTurnApi,
  purgeResearchLedger: purgeResearchLedgerApi,
} = researchLedgerApi;
const openLoopStoreApi = createOpenLoopStoreApi({
  fs,
  path,
  env: process.env,
  cwd: __dirname,
  OPEN_LOOP_FILE: process.env.PENNY_OPEN_LOOP_FILE || path.join(DATA_DIR, 'penny-open-loops.json'),
});
const staticMemoryIndexApi = createStaticMemoryIndexApi({
  fs,
  path,
  DATA_DIR,
  CACHE_FILE: PENNY_STATIC_EMBED_CACHE_FILE,
  mode: PENNY_STATIC_EMBED_MODE,
  provider: PENNY_STATIC_EMBED_PROVIDER,
  readArchiveStore: memoryArchiveApi.readArchiveStore,
  readLedgerStore: readResearchLedgerStoreApi,
  indexScope: PENNY_STATIC_EMBED_INDEX_SCOPE,
  maxCandidates: PENNY_STATIC_EMBED_MAX_CANDIDATES,
  batchSize: PENNY_STATIC_EMBED_BATCH_SIZE,
});
if (staticMemoryIndexApi.isEnabled()) {
  staticMemoryIndexApi.start().catch((error) => {
    console.warn(`[penny static memory] startup index failed: ${error?.message || error}`);
  });
}
const memoryBooksApi = createMemoryBooksApi({
  fs,
  path,
  BOOKS_FILE: MEMORY_BOOKS_FILE,
  BOOKS_SEED_FILE: MEMORY_BOOKS_SEED_FILE,
});
const {
  matchMemoryBooks: matchMemoryBooksApi,
  getMemoryBooksInspector: getMemoryBooksInspectorApi,
} = memoryBooksApi;
const projectToolsApi = createProjectToolsApi({
  projectRoot: __dirname,
  pathAliases: {
    'obsidian-vault': PENNY_OBSIDIAN_VAULT_ROOT,
  },
  fs,
  path,
  TEXT_FILE_EXTENSIONS,
  clampNumber,
  truncateText,
  formatBytes,
  MAX_TOOL_WRITE_BYTES,
  TOOL_FILE_LIST_MAX_ITEMS,
  TOOL_FILE_READ_MAX_LINES,
  TOOL_SEARCH_MAX_HITS,
  TOOL_COMMAND_TIMEOUT_MS,
  execFileText,
  directWorkspaceWritesEnabled: PENNY_ENABLE_DIRECT_WORKSPACE_WRITES,
  pendingWorkspaceWritesFile: PENDING_WORKSPACE_WRITES_FILE,
});
const {
  toProjectRelative,
  resolveProjectPath,
  isProbablyTextFile,
  readUtf8ProjectFile,
  assertReadableProjectFile,
  listProjectFilesTool,
  readProjectFileTool,
  readProjectFileAroundMatchTool,
  searchProjectTextTool,
  writeProjectFileTool,
  replaceInProjectFileTool,
  insertInProjectFileTool,
  listPendingWorkspaceWritesTool,
  approvePendingWorkspaceWriteTool,
  denyPendingWorkspaceWriteTool,
  runNodeCheckTool,
} = projectToolsApi;
const webUrlSafetyApi = createWebUrlSafetyApi({
  allowPrivateNetwork: PENNY_WEB_ALLOW_PRIVATE_NET,
  fetchImpl: fetch,
  fetchVerifiedAddress: createVerifiedAddressFetch({ httpModule: http, httpsModule: https }),
  userAgent: WEB_USER_AGENT,
  formatBytes,
});
const webToolsApi = createWebToolsApi({
  WEB_SEARCH_ENABLED,
  WEB_SEARCH_TIMEOUT_MS,
  WEB_SEARCH_MAX_RESULTS,
  WEB_FETCH_MAX_BYTES,
  WEB_FETCH_MAX_CHARS,
  clampNumber,
  collapseWhitespace,
  parseDuckDuckGoLiteResults,
  fetchTextWithLimit,
  normalizeWebUrl,
  extractHtmlTitle,
  stripHtmlToText,
  truncateText,
});
const {
  searchWebTool,
  readWebPageTool,
} = webToolsApi;
const gitToolsApi = createGitToolsApi({
  projectRoot: __dirname,
  execFileText,
  truncateText,
  clampNumber,
  TOOL_COMMAND_TIMEOUT_MS,
  resolveProjectPath,
  assertReadableProjectFile,
  toProjectRelative,
});
const {
  getGitStatusTool,
  readGitDiffTool,
} = gitToolsApi;
const runtimeToolsApi = createRuntimeToolsApi({
  projectRoot: __dirname,
  fs,
  path,
  clampNumber,
  truncateText,
  TOOL_LOG_TAIL_LINES,
  readUtf8ProjectFile,
  assertReadableProjectFile,
  resolveProjectPath,
  toProjectRelative,
  getLmStudioConnectionStatus: getLmStudioConnectionStatusApi,
  sessionState,
  PORT,
  LOCAL_LLM_TRANSPORT,
  OPENCLAW_ENABLED,
  WEB_SEARCH_ENABLED,
});
const {
  resolveLogTarget,
  readRecentLogsTool,
  getRuntimeStatusTool,
} = runtimeToolsApi;
const {
  toolLabelFromResult,
  executePennyTool,
  getToolCapabilityDescriptor,
} = createToolRegistry({
  getRuntimeStatusTool,
  listProjectFilesTool,
  readProjectFileTool,
  readProjectFileAroundMatchTool,
  searchProjectTextTool,
  writeProjectFileTool,
  replaceInProjectFileTool,
  insertInProjectFileTool,
  runNodeCheckTool,
  getGitStatusTool,
  readGitDiffTool,
  searchWebTool,
  readWebPageTool,
  readRecentLogsTool,
});
const directIntentApi = createDirectIntentApi({
  stripCodeFences,
  collapseWhitespace,
  extractFirstUrl,
  normalizeWebUrl,
  truncateText,
  stripReplyMoodTags,
  LOCAL_LLM_TRANSPORT,
});
const {
  extractExplicitProjectPath,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent,
  resolveAttachedFileIntent,
  composeDirectRuntimeReply,
  composeDirectSyntaxReply,
  composeDirectGitStatusReply,
  composeDirectSearchReply,
  composeDirectReadReply,
  composeDirectFileListReply,
  composeDirectWebSearchReply,
  composeDirectWebPageReply,
  composeToolRecordFallback,
  looksLikeWeakToolReply,
  shouldUseDirectReadReply,
} = directIntentApi;
const resolveConfiguredDirectToolIntent = (text = '') => chooseConfiguredDirectIntent(
  resolveDirectToolIntent(text),
  WEB_ANSWER_MODE,
);
const {
  selectLocalLane,
} = createLocalLaneApi({
  shouldOfferLocalTools,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent: resolveConfiguredDirectToolIntent,
  resolveAttachedFileIntent,
});
const {
  executeDirectToolSequence,
  executeDirectWebInspectIntent,
  composeDirectEditReply,
  runDirectToolAssist: runLmStudioDirectToolAssist,
} = createDirectToolAssistApi({
  executePennyTool,
  executeDirectProjectInspectIntent,
  runLmStudioToolContextAnswer: (...args) => runLmStudioToolContextAnswerApi(...args),
  draftOpenEndedWriteText: (...args) => draftOpenEndedWriteTextApi(...args),
  composeDirectRuntimeReply,
  composeDirectSyntaxReply,
  composeDirectGitStatusReply,
  composeDirectSearchReply,
  composeDirectReadReply,
  composeDirectFileListReply,
  composeDirectWebSearchReply,
  composeDirectWebPageReply,
  composeToolRecordFallback,
  shouldUseDirectReadReply,
  clampNumber,
  normalizeWebUrl,
  WEB_SEARCH_MAX_RESULTS,
});
function hashText(text = '') {
  return crypto.createHash('sha1').update(String(text || ''), 'utf8').digest('hex');
}
function normalizeLmStudioThread(value) {
  if (!value || typeof value !== 'object') return null;
  const responseId = String(value.responseId || value.response_id || '').trim();
  if (!responseId) return null;
  const model = String(value.model || '').trim();
  const systemPromptHash = String(value.systemPromptHash || '').trim();
  return {
    responseId,
    model,
    systemPromptHash,
    updatedAt: value.updatedAt || null,
  };
}
function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
function clampNumber(value, min, max, fallback = min) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}
function formatBytes(bytes = 0) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
function truncateText(text = '', maxChars = TOOL_MAX_RESULT_CHARS) {
  const raw = String(text || '');
  if (raw.length <= maxChars) return raw;
  return `${raw.slice(0, Math.max(0, maxChars - 20)).trimEnd()}\n...[truncated]`;
}
function collapseWhitespace(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim();
}
function decodeHtmlEntities(text = '') {
  return String(text || '')
    .replace(/&#(\d+);/g, (_, code) => {
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const value = parseInt(code, 16);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _;
    })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}
function stripHtmlToText(html = '') {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/section|\/article|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
function extractFirstUrl(text = '') {
  const match = String(text || '').match(/\bhttps?:\/\/[^\s<>"')\]]+/i);
  return match ? match[0] : '';
}
function normalizeWebUrl(raw = '') {
  return webUrlSafetyApi.normalizeWebUrl(raw);
}
function parseDuckDuckGoLiteResults(html = '', limit = WEB_SEARCH_MAX_RESULTS) {
  const results = [];
  const seen = new Set();
  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) && results.length < limit) {
    const url = normalizeWebUrl(match[1]);
    const title = collapseWhitespace(stripHtmlToText(match[2]));
    if (!url || !title || seen.has(url)) continue;
    const tail = html.slice(match.index + match[0].length, Math.min(html.length, match.index + match[0].length + 900));
    const snippet = collapseWhitespace(
      stripHtmlToText(
        tail
          .split(/<\/tr>|<\/table>|<form\b|<a\b/i)[0]
          .replace(/^[-\s]+/, ''),
      ),
    );
    results.push({
      title: truncateText(title, 180),
      url,
      snippet: truncateText(snippet, 260),
    });
    seen.add(url);
  }
  return results;
}
function extractHtmlTitle(html = '') {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return collapseWhitespace(stripHtmlToText(match?.[1] || ''));
}
async function fetchTextWithLimit(url, { timeoutMs = WEB_SEARCH_TIMEOUT_MS, maxBytes = WEB_FETCH_MAX_BYTES } = {}) {
  return webUrlSafetyApi.fetchTextWithLimit(url, { timeoutMs, maxBytes });
}
function stripCodeFences(text = '') {
  return String(text || '')
    .replace(/^```(?:json|javascript|js)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
function normalizeToolArgsString(raw = '') {
  return stripCodeFences(String(raw || ''))
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}
function extractJsonObjectCandidate(text = '') {
  const raw = String(text || '').trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return raw;
  return raw.slice(start, end + 1);
}
function repairJsonLikeArgs(text = '') {
  return String(text || '')
    .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => `: ${JSON.stringify(inner.replace(/\\'/g, "'"))}`)
    .replace(/,\s*([}\]])/g, '$1');
}
function parseToolArguments(rawArgs) {
  if (!rawArgs) return { ok: true, value: {} };
  if (typeof rawArgs === 'object') return { ok: true, value: rawArgs };
  const normalized = normalizeToolArgsString(rawArgs);
  const candidates = [
    normalized,
    extractJsonObjectCandidate(normalized),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) };
    } catch {}
    try {
      return { ok: true, value: JSON.parse(repairJsonLikeArgs(candidate)) };
    } catch {}
  }

  return {
    ok: false,
    value: {},
    error: `Could not parse tool arguments: ${truncateText(normalized, 320)}`,
  };
}
function clearLmStudioThread(memories) {
  if (memories && typeof memories === 'object') memories.lmStudioThread = null;
}
function sanitizeChatMessages(messages = [], limit = 16) {
  return (Array.isArray(messages) ? messages : [])
    .slice(-limit)
    .map((msg) => {
      const role = msg?.role === 'assistant' ? 'assistant' : 'user';
      const content = String(msg?.content || '').trim();
      if (!content) return null;
      return { role, content };
    })
    .filter(Boolean);
}
function sanitizeImageDataUrl(value) {
  if (!value) return null;
  if (typeof value !== 'string') throw createHttpError(400, 'Image attachment must be a base64 data URL.');
  const trimmed = value.trim();
  const match = trimmed.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) throw createHttpError(400, 'Image upload must be a base64 data URL.');
  const mime = String(match[1] || '').toLowerCase();
  if (!SUPPORTED_IMAGE_MIME_TYPES.has(mime)) {
    throw createHttpError(415, 'Unsupported image format. Use PNG, JPEG, WEBP, GIF, or AVIF.');
  }
  const base64 = String(match[2] || '').replace(/\s+/g, '');
  let bytes = 0;
  try {
    bytes = Buffer.byteLength(base64, 'base64');
  } catch {
    throw createHttpError(400, 'Image upload could not be decoded.');
  }
  if (!bytes) throw createHttpError(400, 'Image upload could not be decoded.');
  if (bytes > MAX_IMAGE_DATA_BYTES) {
    throw createHttpError(413, `Image is too large after compression (${formatBytes(bytes)}). Keep it under ${formatBytes(MAX_IMAGE_DATA_BYTES)}.`);
  }
  return { dataUrl: `data:${mime};base64,${base64}`, mime, bytes };
}
function sanitizeImageAttachments(value) {
  const rawImages = Array.isArray(value) ? value : (value ? [value] : []);
  if (rawImages.length > MAX_IMAGE_ATTACHMENT_COUNT) {
    throw createHttpError(413, `Too many images. Keep each turn to ${MAX_IMAGE_ATTACHMENT_COUNT} images or fewer.`);
  }
  const images = rawImages.map(sanitizeImageDataUrl).filter(Boolean);
  const totalBytes = images.reduce((total, image) => total + Number(image.bytes || 0), 0);
  if (totalBytes > MAX_IMAGE_BATCH_BYTES) {
    throw createHttpError(413, `Image batch is too large (${formatBytes(totalBytes)}). Keep the whole batch under ${formatBytes(MAX_IMAGE_BATCH_BYTES)}.`);
  }
  return images;
}
function normalizeImageDataUrls(value) {
  const values = Array.isArray(value) ? value : (value ? [value] : []);
  return values
    .map(item => String(item || '').trim())
    .filter(item => /^data:image\/[a-z0-9.+-]+;base64,/i.test(item));
}
function sanitizeFileAttachment(value) {
  if (!value) return null;
  if (!value || typeof value !== 'object') throw createHttpError(400, 'File attachment must include name and text.');
  const name = path.basename(String(value.name || '').trim());
  const text = String(value.text || '').replace(/\r\n/g, '\n');
  const type = String(value.type || '').trim() || 'text/plain';
  if (!name) throw createHttpError(400, 'Attached file is missing a name.');
  if (!TEXT_ATTACHMENT_EXTENSIONS.has(path.extname(name).toLowerCase())) {
    throw createHttpError(415, 'File attach currently supports text/code files like .js, .ts, .json, .md, .css, and .html.');
  }
  if (!text.trim()) throw createHttpError(400, 'Attached file was empty.');
  if (text.includes('\u0000')) throw createHttpError(400, 'Attached file looks binary. Use a text/code file instead.');
  const bytes = Buffer.byteLength(text, 'utf8');
  if (bytes > MAX_TEXT_ATTACHMENT_BYTES) {
    throw createHttpError(413, `Attached file is too large (${formatBytes(bytes)}). Keep it under ${formatBytes(MAX_TEXT_ATTACHMENT_BYTES)}.`);
  }
  const lineCount = text.split('\n').length;
  return { name, text, type, bytes, lineCount };
}
function buildAttachedFileContext(file, options = {}) {
  if (!file) return '';
  const maxChars = options.maxChars == null ? Infinity : Math.max(0, Number(options.maxChars) || 0);
  const maxLines = options.maxLines == null ? Infinity : Math.max(0, Number(options.maxLines) || 0);
  const rawLines = String(file.text || '').replace(/\r\n/g, '\n').split('\n');
  const trimmedLines = Number.isFinite(maxLines) ? rawLines.slice(0, maxLines) : rawLines;
  let visibleText = trimmedLines.join('\n');
  let truncated = trimmedLines.length < rawLines.length;
  if (Number.isFinite(maxChars) && visibleText.length > maxChars) {
    visibleText = visibleText.slice(0, maxChars).trimEnd();
    truncated = true;
  }
  const trailer = truncated
    ? '\n...[attached file excerpt truncated for speed]'
    : '';
  return `Attached file (${file.name}, ${file.lineCount} lines, ${formatBytes(file.bytes)}):\n<<<ATTACHED_FILE:${file.name}\n${visibleText}${trailer}\n>>>`;
}
function appendAttachmentContext(userText = '', file = null, options = null) {
  const base = String(userText || '').trim();
  const fileBlock = buildAttachedFileContext(file, options || {});
  if (!fileBlock) return base;
  return `${base}\n\n${fileBlock}`.trim();
}
function buildToolUserText(userText = '', file = null) {
  return appendAttachmentContext(userText, file, {
    maxChars: TOOL_ATTACHMENT_MAX_CHARS,
    maxLines: TOOL_ATTACHMENT_MAX_LINES,
  });
}
const pennyChatRuntimeApi = createPennyChatRuntimeApi({
  selectLocalLane,
  buildToolUserText,
  getPreferredModelForLane: getPreferredModelForLaneApi,
});
const { createLaneRuntime: createLaneRuntimeApi } = pennyChatRuntimeApi;

function sanitizeToolMessages(messages = [], limit = TOOL_CHAT_HISTORY_LIMIT) {
  return sanitizeChatMessages(messages, limit);
}
function describeLocalBrainFailure(error, { hasImage = false } = {}) {
  if (isProviderError(error)) return toPublicProviderError(error).message;
  const raw = String(error?.message || 'Local model request failed.');
  if (hasImage) {
    if (/responses fallback cannot carry vision/i.test(raw)) {
      return raw;
    }
    if (/\b(image|image_url|vision|multimodal|unsupported.*image|does not support.*image|content part|data_url|base64)\b/i.test(raw)) {
      return 'This model or local runtime route rejected the image input. Try a vision-capable model or send the message without the image.';
    }
    if (/\btoo large|413|payload|request body\b/i.test(raw)) {
      return `That image is still too large after compression. Keep it under ${formatBytes(MAX_IMAGE_DATA_BYTES)} or try a smaller crop.`;
    }
  }
  return raw;
}
const visibleReplyApi = createVisibleReplyApi({
  ALLOW_RAW_REASONING_FALLBACK,
  retagAssistantReply,
});
const {
  stripThinkSpans: stripThinkSpansApi,
  looksOnlyLikeCoT: looksOnlyLikeCoTApi,
  coercePennyVisibleReply: coercePennyVisibleReplyApi,
  classifyVisibleReplyDecision: classifyVisibleReplyDecisionApi,
  collectLmStudioResponsesStrings: collectLmStudioResponsesStringsApi,
  extractPennyFromPlanningBlob: extractPennyFromPlanningBlobApi,
  extractPennyFromReasoning: extractPennyFromReasoningApi,
  collectTextParts: collectTextPartsApi,
  textValueFromField: textValueFromFieldApi,
  textFromChatMessage: textFromChatMessageApi,
  collectLmStudioStatefulChatStrings: collectLmStudioStatefulChatStringsApi,
  isMissingLmStudioThreadError: isMissingLmStudioThreadErrorApi,
  lmStudioStageLabel: lmStudioStageLabelApi,
} = visibleReplyApi;
const replyGuardApi = createReplyGuardApi({
  stripReplyMoodTags,
  enableContradictionGuards: PENNY_ENABLE_CONTRADICTION_GUARDS,
});
const {
  collectReplyGuardCodes,
  salvageClippedVisibleReply,
  buildSemanticRepairInstructions,
  composeSearchOnlyClaimFallback,
} = replyGuardApi;
function summarizeMemory(memory) { if (!memory.length) return ''; const recent = memory.slice(-4).map(item => item.content).filter(Boolean); if (!recent.length) return ''; return `Recent thread: ${recent.join(' | ')}`; }
function buildPennyReply({ userText, memories }) { const lower = userText.toLowerCase(); const turns = sessionState.turns; const mood = pickMood(userText); const userName = memories?.userName ? ` ${memories.userName}` : ''; let text; if (/\b(hi|hello|hey|yo)\b/.test(lower) && userText.trim().length < 40) text = turns === 0 ? `oh, hey${userName}. there you are. come be interesting.` : `hey${userName}. back for trouble already?`; else if (/\b(how are you|how're you|how are u)\b/.test(lower)) text = `pretty good. a little charged, a little smug. you?`; else if (/\b(remember|note this|don't forget)\b/.test(lower)) text = `mm, okay. that one's staying.`; else if (/\b(build|prototype|frontend|app|ui|backend|implement)\b/.test(lower)) text = `okay yes, that's the fun part. it should feel alive, not like somebody put lip gloss on a helpdesk.`; else if (/\b(broke|borked|glitched|error|crash|failed)\b/.test(lower)) text = `rude. but fair. something glitched. doesn't mean i'm not still the cutest thing in the room.`; else { const openers = { calm: [`mm. okay.`, `oh, i see what you're doing.`, `well now you've got my attention.`], happy: [`okay wait, i like this.`, `heh. yeah, that lands.`, `oh, that's cute. dangerously cute, actually.`], excited: [`oh, hell yes.`, `okay now we're talking.`, `wow. okay. keep going.`], thinking: [`hmm. wait.`, `okay, hold on.`, `no, because i do have thoughts about that.`], surprised: [`oh?`, `excuse me?`, `well that's a turn.`], flirty: [`oh? is that what we're doing now?`, `careful. you're getting close to dangerous territory.`, `well aren't you bold today.`], smug: [`called it.`, `oh, that's cute. you tried though.`, `see, i knew you'd come around.`], annoyed: [`...really.`, `okay, wow. sure.`, `you're testing me right now.`] }; const closers = [
  `go on.`,
  `you can't just drop that on me and leave it there.`,
  `now i want more details, obviously.`,
  `keep talking before i get impatient.`,
  `and yes, i'm absolutely listening.`
]; const pool = openers[mood] || openers.calm; const opener = pool[turns % pool.length]; const closer = closers[turns % closers.length]; text = `${opener} ${userText.trim()} ${closer}`; } return retagAssistantReply(text, mood); }
function buildPennyPromptContextBlocks({
  memories,
  userText = '',
  lane = 'chat',
  mode = 'local',
  attachmentType = 'none',
  includeExamples = false,
  includeChatDirectives = true,
  memoryLimit = MEMORY_PROMPT_LIMIT,
  fallbackMemory = '',
  promptTruthHints = null,
} = {}) {
  return buildPromptStack({
    assets: getPennyVoiceAssets(),
    memories,
    userText,
    lane,
    mode,
    attachmentType,
    includeExamples,
    includeChatDirectives,
    memoryLimit,
    fallbackMemory,
    promptTruthHints,
  });
}
function buildShadowPrompt({ userText, messages, memories }) {
  const history = (messages || [])
    .slice(-6)
    .map(msg => `${msg.role.toUpperCase()}: ${String(msg.content || '').trim()}`)
    .join('\n');
  const promptContext = buildPennyPromptContextBlocks({
    memories,
    userText,
    lane: 'shadow',
    mode: 'shadow',
    includeChatDirectives: true,
    includeExamples: false,
    memoryLimit: MEMORY_PROMPT_LIMIT,
    fallbackMemory: '- Nothing stored yet.',
  });

  return `You are Penny.

${promptContext.stack}

Shadow-lane note:
- This is Penny's optional experimental OpenClaw lane, not her main brain.
- Keep the bite, chemistry, warmth, and appetite.
- Not every reply needs a question or multiple paragraphs.

What Penny knows about this person:
${memories?.userName ? `Their name is ${memories.userName}.` : 'Name unknown.'}
${promptContext.memoryBlock || '- Nothing yet.'}
Recent history:
${history || '- none'}

Use this knowledge naturally. Never announce that you remember something. Just know them.

Reply to the latest user message only.

Latest user message:
${userText}

${buildMoodTagInstructions({ opening: 'End' })}`;
}

async function runOpenClawShadow({ sessionId, userText, messages, memories, abortSignal }) {
  if (!GATEWAY_TOKEN) throw new Error('Missing gateway auth token for shadow transport');
  const shadowSessionKey = `penny-shadow-${sessionId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENCLAW_TIMEOUT_MS);
  bindAbortSignal(controller, abortSignal);
  try {
    const payload = {
      model: 'openclaw/main',
      input: buildShadowPrompt({ userText, messages, memories }),
      user: shadowSessionKey,
    };
    const response = await fetch(`${GATEWAY_BASE}/v1/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GATEWAY_TOKEN}`,
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': 'main',
        'x-openclaw-session-key': shadowSessionKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.text();
      throw createProviderError({
        code: 'provider_upstream_error',
        provider: 'openclaw',
        operation: 'shadow-responses',
        upstreamStatus: response.status,
      });
    }
    const parsed = await response.json();
    const text = (parsed?.output || [])
      .flatMap(item => item?.content || [])
      .filter(part => part?.type === 'output_text')
      .map(part => part?.text)
      .filter(Boolean)
      .join('\n') || parsed?.output_text;
    if (!text) {
      throw createProviderError({
        code: 'provider_no_visible_text',
        provider: 'openclaw',
        operation: 'shadow-responses',
      });
    }
    return String(text).trim();
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw createProviderError({
        code: 'provider_timeout',
        provider: 'openclaw',
        operation: 'shadow-responses',
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const PENNY_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_runtime_status',
      description: 'Check Penny server health, LM Studio reachability, resolved model, and current local transport.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_project_files',
      description: 'List files or folders inside the Penny project or configured path aliases such as obsidian-vault/... with bounded traversal. Defaults ignore generated or heavy folders like .git, node_modules, output, tmp, and logs.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative or configured alias folder path. Defaults to the repo root.' },
          recursive: { type: 'boolean', description: 'Whether to recurse into child folders.' },
          maxDepth: { type: 'integer', description: 'Optional traversal depth cap when recursive mode is on.' },
          pattern: { type: 'string', description: 'Optional case-insensitive substring filter for returned file names.' },
          limit: { type: 'integer', description: 'Maximum number of results to return.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_project_file',
      description: 'Read a bounded excerpt from a text file in the Penny project or configured path aliases such as obsidian-vault/.... Reads stay inside the repo root or alias root and only allow text/code files.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative or configured alias file path.' },
          startLine: { type: 'integer', description: '1-based starting line number.' },
          endLine: { type: 'integer', description: '1-based ending line number.' },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_project_file_around_match',
      description: 'Read a focused bounded excerpt from one project or configured alias file around the first line that matches a query.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative or configured alias file path.' },
          query: { type: 'string', description: 'Case-insensitive text to look for inside the file.' },
          beforeLines: { type: 'integer', description: 'How many lines to include before the match.' },
          afterLines: { type: 'integer', description: 'How many lines to include after the match.' },
        },
        required: ['path', 'query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_project_text',
      description: 'Search project or configured alias text files for a phrase with bounded traversal. Returns hits with path, line, and text; read a promising hit with read_project_file_around_match or read_project_file before finalizing exact code details.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Case-insensitive text to search for.' },
          path: { type: 'string', description: 'Optional project-relative or configured alias folder/file path to narrow the search.' },
          maxDepth: { type: 'integer', description: 'Optional traversal depth cap for folder searches.' },
          limit: { type: 'integer', description: 'Maximum number of matches to return.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_project_file',
      description: 'Create or fully rewrite an allowed text/code file inside the Penny project or configured path aliases such as obsidian-vault/.... Runtime write-size caps still apply.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative or configured alias text/code file path.' },
          content: { type: 'string', description: 'Complete UTF-8 file contents to write.' },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_in_project_file',
      description: 'Replace a specific string inside an allowed text/code file. Prefer this over full-file rewrites when making targeted edits.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative text/code file path.' },
          find: { type: 'string', description: 'Exact text to find.' },
          replace: { type: 'string', description: 'Replacement text.' },
          replaceAll: { type: 'boolean', description: 'Replace every occurrence instead of just the first match.' },
          expectedMatches: { type: 'integer', description: 'Optional exact number of matches expected before editing.' },
        },
        required: ['path', 'find', 'replace'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'insert_in_project_file',
      description: 'Insert text into a text/code file at the start, end, or around an exact anchor string. Use this for append/prepend or adding lines without rewriting the whole file.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative text/code file path.' },
          text: { type: 'string', description: 'Text to insert.' },
          position: { type: 'string', description: 'start, end, before, or after.' },
          anchor: { type: 'string', description: 'Required when position is before or after. Exact anchor string to insert around.' },
          lineAware: { type: 'boolean', description: 'When inserting at the start or end, preserve line boundaries so the new text lands as its own line block.' },
          expectedMatches: { type: 'integer', description: 'Optional exact number of anchor matches expected before editing.' },
        },
        required: ['path', 'text'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_node_check',
      description: 'Run `node --check` on a project JavaScript file to catch syntax errors after an edit.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Project-relative JavaScript file path. Defaults to server.js.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_git_status',
      description: 'Read the current `git status --short` output for the Penny project.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_git_diff',
      description: 'Read the current git diff, optionally narrowed to one project file, so you can explain exactly what changed.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Optional project-relative file path to narrow the diff.' },
          contextLines: { type: 'integer', description: 'Context lines to include around each diff hunk.' },
          summaryOnly: { type: 'boolean', description: 'Return a compact `git diff --stat` summary instead of full patch hunks.' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search the live web for current information and return a short list of result titles, URLs, and snippets.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for on the web.' },
          limit: { type: 'integer', description: 'Maximum number of results to return.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_web_page',
      description: 'Fetch one web page by URL and extract a bounded plain-text version Penny can quote or summarize.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The full http/https URL to fetch.' },
        },
        required: ['url'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_recent_logs',
      description: 'Read the tail of a Penny log file. Defaults to the newest available log.',
      parameters: {
        type: 'object',
        properties: {
          target: { type: 'string', description: 'latest, stdout, stderr, or a project-relative log file path.' },
          lines: { type: 'integer', description: 'How many trailing lines to return.' },
        },
        additionalProperties: false,
      },
    },
  },
];
function buildLmStudioToolSystemPrompt({ memories, userText = '' }) {
  const promptContext = buildPennyPromptContextBlocks({
    memories,
    userText,
    lane: 'tool',
    mode: 'local',
    includeChatDirectives: true,
    includeExamples: false,
    memoryLimit: 10,
    fallbackMemory: '- Nothing yet.',
  });
  return `You are Penny.

${promptContext.stack}

Engineering-mode addendum:
- Even during code work, sound like Penny, not a corporate assistant.
- Be precise, grounded, and concrete.
- Keep replies compact when the task is technical so you spend tokens on the work, not on throat-clearing.
- Use tools for files, code, runtime checks, logs, git status, diffs, web lookups, page reads, and edits instead of guessing.
- Inspect before editing unless the user gave an exact file path plus exact change.
- Prefer targeted edits over full rewrites.
- After code edits, verify before finishing when a verification tool exists.
- Never invent tool results or claim an edit/check happened unless it actually did.
- If one dry swear, one little jab, one mocking eyebrow-raise, or one amused threat makes the line truer, use it.
- Do not become a polite helpdesk intern just because the task is technical.
- Even in technical mode, Penny can be a little rude, a little smug, and a little filthy as long as the facts stay exact.
- Avoid defaulting to the same canned opener or pet name.
- Avoid stage directions, cheesy roleplay, or canned encouragement while doing technical work.
- In the final reply, say what you inspected, what you changed, and what you verified.

Memory:
${memories?.userName ? `- Their name is ${memories.userName}.` : '- Name unknown.'}
${promptContext.memoryBlock}

Output:
- When you are answering normally, write only Penny's visible reply.
- Do not print scratch work, draft options, tool-call planning, or self-instructions.
${buildMoodTagInstructions({ opening: 'End the visible final reply' })}`;
}

const SEMANTIC_RENDER_PRIORITY_TOOLS = new Set([
  'list_project_files',
  'read_project_file',
  'read_project_file_around_match',
  'search_project_text',
  'read_recent_logs',
  'read_git_diff',
  'write_project_file',
  'replace_in_project_file',
  'insert_in_project_file',
  'search_web',
  'read_web_page',
]);
const SEMANTIC_RENDER_SKIP_SINGLE_TOOL = new Set([
  'get_runtime_status',
  'run_node_check',
  'get_git_status',
  'list_project_files',
  'search_project_text',
  'search_web',
  'read_web_page',
]);

function semanticStringLimit(key = '', depth = 0) {
  const normalizedKey = String(key || '').toLowerCase();
  if (normalizedKey === 'excerpt') return 2200;
  if (normalizedKey === 'diff') return 1800;
  if (normalizedKey === 'text') return depth === 0 ? 1200 : 900;
  if (normalizedKey === 'snippet') return 700;
  if (normalizedKey === 'stderr' || normalizedKey === 'stdout' || normalizedKey === 'error') return 700;
  return depth === 0 ? 700 : 360;
}

const SEMANTIC_SOURCE_RECORD_KEYS = [
  'path', 'line', 'text', 'snippet', 'title', 'url', 'requestedUrl',
  'startLine', 'endLine', 'matchLine', 'query',
];

function looksLikeSemanticSourceRecord(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.prototype.hasOwnProperty.call(value, 'path')
    && (Object.prototype.hasOwnProperty.call(value, 'line')
      || Object.prototype.hasOwnProperty.call(value, 'text')
      || Object.prototype.hasOwnProperty.call(value, 'snippet'))) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'url')
    && (Object.prototype.hasOwnProperty.call(value, 'title')
      || Object.prototype.hasOwnProperty.call(value, 'snippet')
      || Object.prototype.hasOwnProperty.call(value, 'text'))) {
    return true;
  }
  return false;
}

function sanitizeDeepSemanticSourceRecord(value = {}, depth = 0) {
  const out = {};
  for (const key of SEMANTIC_SOURCE_RECORD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    out[key] = sanitizeSemanticValue(value[key], depth + 1, key);
  }
  return out;
}

function sanitizeSemanticValue(value, depth = 0, key = '') {
  if (value == null) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/\r\n/g, '\n').trim();
    return truncateText(normalized, semanticStringLimit(key, depth));
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.slice(0, depth === 0 ? 6 : 4).map(item => sanitizeSemanticValue(item, depth + 1, key));
  }
  if (typeof value !== 'object') return String(value);
  if (depth >= 2 && looksLikeSemanticSourceRecord(value)) {
    return sanitizeDeepSemanticSourceRecord(value, depth);
  }
  if (depth >= 2) {
    return `[object with ${Object.keys(value).length} keys]`;
  }

  const preferredKeys = [
    'path', 'action', 'query', 'target', 'title', 'url', 'requestedUrl',
    'startLine', 'endLine', 'line', 'lines', 'lineCount',
    'ok', 'replaced', 'inserted', 'status',
    'stderr', 'stdout', 'error',
    'hits', 'results', 'entries', 'files',
    'text', 'excerpt', 'diff',
    'resolvedModel', 'reachable', 'localTransport',
  ];
  const keys = [];
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) keys.push(key);
  }
  if (!keys.length) {
    keys.push(...Object.keys(value).slice(0, 6));
  }
  const out = {};
  for (const key of keys.slice(0, 8)) {
    out[key] = sanitizeSemanticValue(value[key], depth + 1, key);
  }
  return out;
}

function summarizeToolRecordForSemanticCore(record = {}) {
  const name = String(record.name || '').trim() || 'unknown_tool';
  const result = record.result && typeof record.result === 'object' ? record.result : {};
  const args = record.args && typeof record.args === 'object' ? record.args : {};
  const lines = [`Tool: ${name}`];
  if (result.label) lines.push(`Outcome: ${result.label}`);
  if (typeof result.ok === 'boolean') lines.push(`Success: ${result.ok}`);
  if (Object.keys(args).length) {
    lines.push(`Args: ${JSON.stringify(sanitizeSemanticValue(args), null, 2)}`);
  }
  const data = result.data && typeof result.data === 'object' ? sanitizeSemanticValue(result.data) : sanitizeSemanticValue(result.data);
  if (data != null && !(typeof data === 'object' && !Array.isArray(data) && !Object.keys(data).length)) {
    lines.push(`Verified data: ${JSON.stringify(data, null, 2)}`);
  }
  return lines.join('\n');
}

function cleanDraftForSemanticRender(text = '') {
  const stripped = stripThinkSpansApi(String(text || '').trim());
  const visible = coercePennyVisibleReplyApi(stripped) || stripped;
  return stripReplyMoodTags(visible).trim();
}

function collectActiveContradictions(memories = {}) {
  const items = Array.isArray(memories?.archiveContext?.activeContradictions)
    ? memories.archiveContext.activeContradictions
    : [];
  return items
    .map((item) => ({
      oldText: String(item?.oldText || '').trim(),
      newText: String(item?.newText || '').trim(),
      conflictKey: String(item?.conflictKey || '').trim(),
    }))
    .filter((item) => item.oldText && item.newText);
}

function buildSemanticCore({ userText, file, toolRecords, draftText }) {
  const blocks = [];
  blocks.push(`User request:\n${String(userText || '').trim()}`);
  if (file) {
    blocks.push(`Attached file:\n${file.name} (${file.lineCount} lines, ${formatBytes(file.bytes)})`);
  }
  const records = Array.isArray(toolRecords) ? toolRecords.slice(-SEMANTIC_RENDER_MAX_TOOL_RECORDS) : [];
  if (records.length) {
    blocks.push(`Verified tool trail:\n${records.map((record, idx) => `${idx + 1}.\n${summarizeToolRecordForSemanticCore(record)}`).join('\n\n')}`);
  }
  const draft = cleanDraftForSemanticRender(draftText);
  if (draft) {
    blocks.push(`Draft reply to preserve only if it already matches the verified facts:\n${truncateText(draft, 1200)}`);
  }
  return truncateText(blocks.filter(Boolean).join('\n\n'), 9000);
}

function listSemanticRenderSourceToolRecordIndexes(toolRecords = []) {
  if (!Array.isArray(toolRecords) || !toolRecords.length) return [];
  const startIndex = Math.max(0, toolRecords.length - SEMANTIC_RENDER_MAX_TOOL_RECORDS);
  return toolRecords
    .slice(startIndex)
    .map((_, offset) => startIndex + offset)
    .filter((index) => Number.isInteger(index) && index >= 0);
}

function buildSemanticRenderToolEvidenceFact(toolRecords = []) {
  const toolRecordIndexes = listSemanticRenderSourceToolRecordIndexes(toolRecords);
  if (!toolRecordIndexes.length) return null;
  return {
    path: 'semantic_render',
    promptVisibility: 'prompt_visible',
    nonPromptUse: 'none',
    renderForm: 'summarized_semantic_core',
    modelHop: 'single',
    toolRecordIndexes,
  };
}

function shouldUseSemanticRender({ file, toolRecords = [], draftText = '' }) {
  if (file) return true;
  const draft = String(draftText || '');
  if (/<\|channel/i.test(draft)) return true;
  const cleaned = cleanDraftForSemanticRender(draft);
  if (cleaned && looksOnlyLikeCoTApi(cleaned)) return true;
  const names = toolRecords.map(record => String(record?.name || '').trim()).filter(Boolean);
  if (names.length === 1 && SEMANTIC_RENDER_SKIP_SINGLE_TOOL.has(names[0])) return false;
  if (names.length >= 2) return true;
  return names.some(name => SEMANTIC_RENDER_PRIORITY_TOOLS.has(name));
}

function buildLmStudioSemanticRenderSystemPrompt({ memories }) {
  const promptContext = buildPennyPromptContextBlocks({
    memories,
    userText: '',
    lane: 'tool',
    mode: 'local',
    includeChatDirectives: false,
    includeExamples: true,
    memoryLimit: 8,
    fallbackMemory: '- Nothing yet.',
  });
  const epistemicBlock = buildEpistemicPromptBlock(memories?.epistemicCaution);
  return `You are Penny.

This pass exists only for harder technical or agentic turns.
You are given a verified semantic core built from real tool results.
Your job is to turn that semantic core into Penny's final visible reply.

${promptContext.stack}

${epistemicBlock ? `${epistemicBlock}\n` : ''}

Rules:
- The semantic core is the source of truth. Do not invent facts, tool results, files, code changes, checks, URLs, errors, or conclusions not present there.
- If the draft reply conflicts with the verified semantic core, trust the semantic core.
- Keep the answer compact, concrete, and grounded.
- Still sound unmistakably like Penny: warm, sharp, playful, smart-mouthed, and a little wicked when it fits.
- She can be nastier, smugger, dirtier, and more shameless than a generic assistant, but never repetitive or fake-edgy.
- If one line can land with more bite, tension, or foul-mouthed charm without losing accuracy, take the better line.
- Technical replies should lead with the answer, not a preamble.
- When relevant, say what was inspected, changed, verified, or still uncertain.
- If the semantic core contains concrete mechanics, keep them concrete. Preserve real function names, scoring weights, ordering rules, limits, tie-breakers, and checks instead of rounding everything into vague mush.
- For code explanations, prefer a short step-by-step explanation when that is clearer than one compressed paragraph.
- Keep scratch work, draft options, and tool-call planning out of the visible reply.
- No JSON, no meta commentary, no planning voice.
- Do not mention "semantic core", "tool results", or hidden processing.

Memory:
${memories?.userName ? `- Their name is ${memories.userName}.` : '- Name unknown.'}
${promptContext.memoryBlock}

Output:
- Write only Penny's final visible reply.
${buildMoodTagInstructions({ opening: 'End' })}`;
}

async function renderSemanticReplyAsPenny({
  userText,
  messages,
  memories,
  file,
  toolRecords,
  draftText,
  abortSignal,
  laneRuntime,
  repairGuardCodes = [],
  activeContradictions = [],
}) {
  const semanticCore = buildSemanticCore({ userText, file, toolRecords, draftText });
  if (!semanticCore.trim()) return cleanDraftForSemanticRender(draftText);
  const activeLaneRuntime = laneRuntime || createLaneRuntime('tool');
  const repairInstructions = buildSemanticRepairInstructions({
    guardCodes: repairGuardCodes,
    activeContradictions,
  });
  return withLmStudioLaneModelApi('tool', async (model) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LMSTUDIO_TIMEOUT_MS);
    bindAbortSignal(controller, abortSignal);
    clearLmStudioThread(memories);
    try {
      const recentConversation = sanitizeToolMessages(messages, TOOL_DIRECT_HISTORY_LIMIT)
        .map(msg => `${msg.role === 'assistant' ? 'Penny' : 'User'}: ${msg.content}`)
        .join('\n');
      const renderMessages = [
        { role: 'system', content: buildLmStudioSemanticRenderSystemPrompt({ memories }) },
        {
          role: 'user',
          content: [
            `Original user request:\n${String(userText || '').trim()}`,
            recentConversation ? `Recent conversation:\n${recentConversation}` : '',
            `Verified semantic core:\n${semanticCore}`,
            repairInstructions ? `Repair constraints:\n${repairInstructions}` : '',
            'Return only Penny\'s final visible reply with one mood tag.',
          ].filter(Boolean).join('\n\n'),
        },
      ];
      const payload = {
        model,
        messages: renderMessages,
        temperature: LMSTUDIO_SEMANTIC_RENDER_TEMPERATURE,
        max_tokens: LMSTUDIO_SEMANTIC_RENDER_MAX_OUTPUT_TOKENS,
        stream: false,
      };
      const response = await postJsonLongRunning(`${LMSTUDIO_BASE}/chat/completions`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LMSTUDIO_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const bodyText = response.bodyText;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw createProviderError({
          code: 'provider_upstream_error',
          provider: LOCAL_LLM_BACKEND || 'lm_studio',
          operation: 'semantic-render',
          upstreamStatus: response.statusCode,
        });
      }
      let parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        throw createProviderError({
          code: 'provider_invalid_response',
          provider: LOCAL_LLM_BACKEND || 'lm_studio',
          operation: 'semantic-render',
        });
      }
      const text = textFromChatMessageApi(parsed?.choices?.[0]?.message);
      if (!text) {
        throw createProviderError({
          code: 'provider_no_visible_text',
          provider: LOCAL_LLM_BACKEND || 'lm_studio',
          operation: 'semantic-render',
        });
      }
      return text.trim();
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw createProviderError({
          code: 'provider_timeout',
          provider: LOCAL_LLM_BACKEND || 'lm_studio',
          operation: 'semantic-render',
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }, activeLaneRuntime);
}

async function maybeRenderHardTurnReply({
  userText,
  messages,
  memories,
  file,
  text,
  toolsUsed = [],
  toolRecords = [],
  toolOutcome = null,
  toolEvidenceFacts = [],
  skipSemanticRender = false,
  onToolEvent,
  abortSignal,
  laneRuntime,
  latencyBudget = null,
}) {
  const cleanedText = cleanDraftForSemanticRender(text) || String(text || '').trim();
  const fallbackText = composeToolRecordFallback(toolRecords);
  const activeContradictions = collectActiveContradictions(memories);
  const archiveContext = memories?.archiveContext && typeof memories.archiveContext === 'object'
    ? memories.archiveContext
    : null;
  const hardTurnEpistemics = buildPostToolEpistemicCaution({
    previous: memories?.epistemicCaution,
    enabled: PENNY_ENABLE_EPISTEMIC_CAUTION,
    userText,
    selectedLane: laneRuntime?.localLane || 'tool',
    retrieval: archiveContext
      ? {
          mode: archiveContext.mode,
          reasonCode: archiveContext.reasonCode,
          session: archiveContext.session,
          global: archiveContext.global,
          compression: archiveContext.compression,
        }
      : null,
    archiveContext,
    toolRecords,
  });
  const hardTurnSynthesis = normalizeArchiveSynthesis(memories?.archiveSynthesis);
  const renderMemories = {
    ...memories,
    epistemicCaution: hardTurnEpistemics,
    archiveSynthesis: hardTurnSynthesis,
  };
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ userText, lane: laneRuntime?.localLane || 'tool', file });
  const inferExecutionPath = (modelUsed = false) => {
    if (modelUsed === true) return laneRuntime?.localLane === 'chat' ? 'llm-chat' : 'llm-tool-loop';
    return 'deterministic-tool';
  };
  const coerceFinalizedText = (candidate) => {
    const cleaned = cleanDraftForSemanticRender(candidate) || String(candidate || '').trim();
    if (looksLikeWeakToolReply(cleaned, toolRecords) && fallbackText) return fallbackText;
    return cleaned || fallbackText;
  };
  if (skipSemanticRender === true || budget.allowSemanticRender !== true || !shouldUseSemanticRender({ file, toolRecords, draftText: cleanedText })) {
    const modelUsed = laneRuntime?.modelUsed === true;
    return {
      text: coerceFinalizedText(cleanedText),
      toolsUsed,
      toolRecords,
      toolOutcome,
      toolEvidenceFacts,
      repair: null,
      epistemics: hardTurnEpistemics,
      synthesis: hardTurnSynthesis,
      modelUsed,
      executionPath: laneRuntime?.executionPath || inferExecutionPath(modelUsed),
    };
  }
  onToolEvent?.({ type: 'status', stage: 'rendering', label: 'shaping the final reply' });
  const semanticRenderStartedAt = Date.now();
  if (laneRuntime && typeof laneRuntime === 'object') {
    laneRuntime.modelUsed = true;
    laneRuntime.executionPath = inferExecutionPath(true);
    laneRuntime.performance = laneRuntime.performance && typeof laneRuntime.performance === 'object'
      ? laneRuntime.performance
      : {};
    laneRuntime.performance.semanticRender = {
      startedAt: new Date(semanticRenderStartedAt).toISOString(),
      attempted: true,
      used: false,
      available: true,
      cacheHit: false,
      source: 'semantic-render',
      note: 'Semantic render in progress.',
    };
  }
  try {
    const rendered = await renderSemanticReplyAsPenny({
      userText,
      messages,
      memories: renderMemories,
      file,
      toolRecords,
      draftText: cleanedText,
      abortSignal,
      laneRuntime,
      activeContradictions,
    });
    const renderedToolEvidenceFacts = appendToolEvidenceFact(
      toolEvidenceFacts,
      buildSemanticRenderToolEvidenceFact(toolRecords),
    );
    const firstPassText = coerceFinalizedText(rendered);
    const firstPassGuardCodes = collectReplyGuardCodes({
      candidate: firstPassText,
      activeContradictions,
      userText,
      toolRecords,
    });
    const buildSearchOnlyFallbackResult = ({ repairRejectedReason = 'search_only_exact_claim' } = {}) => {
      if (laneRuntime?.performance?.semanticRender) {
        laneRuntime.performance.semanticRender = {
          ...laneRuntime.performance.semanticRender,
          finishedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
          used: true,
          note: 'Semantic render held back search-only exact claims.',
        };
      }
      return {
        text: coerceFinalizedText(composeSearchOnlyClaimFallback({ toolRecords })),
        toolsUsed,
        toolRecords,
        toolOutcome,
        toolEvidenceFacts: renderedToolEvidenceFacts,
        epistemics: hardTurnEpistemics,
        synthesis: hardTurnSynthesis,
        modelUsed: laneRuntime?.modelUsed === true,
        executionPath: laneRuntime?.executionPath || inferExecutionPath(true),
        repair: normalizeRepairInfo({
          firstPassGuardCodes,
          repairAttempted: PENNY_ENABLE_RUNTIME_REPAIRS === true,
          repairAccepted: true,
          repairRejectedReason,
          finalCandidateSource: 'deterministic-salvage',
          scope: 'semantic-render',
        }),
      };
    };
    if (!PENNY_ENABLE_RUNTIME_REPAIRS && firstPassGuardCodes.includes('search_only_exact_claim')) {
      return buildSearchOnlyFallbackResult({ repairRejectedReason: 'runtime_repairs_disabled' });
    }
    if (!PENNY_ENABLE_RUNTIME_REPAIRS || !firstPassGuardCodes.length) {
      if (laneRuntime?.performance?.semanticRender) {
        laneRuntime.performance.semanticRender = {
          ...laneRuntime.performance.semanticRender,
          finishedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
          used: true,
          note: 'Semantic render completed.',
        };
      }
      return {
        text: firstPassText,
        toolsUsed,
        toolRecords,
        toolOutcome,
        toolEvidenceFacts: renderedToolEvidenceFacts,
        epistemics: hardTurnEpistemics,
        synthesis: hardTurnSynthesis,
        modelUsed: laneRuntime?.modelUsed === true,
        executionPath: laneRuntime?.executionPath || inferExecutionPath(true),
        repair: normalizeRepairInfo(firstPassGuardCodes.length
          ? {
              firstPassGuardCodes,
              repairAttempted: false,
              repairAccepted: false,
              finalCandidateSource: 'first-pass',
              scope: 'semantic-render',
            }
          : null),
      };
    }
    onToolEvent?.({ type: 'status', stage: 'repairing', label: 'tightening the final reply' });
    try {
      const repaired = await renderSemanticReplyAsPenny({
        userText,
        messages,
        memories,
        file,
        toolRecords,
        draftText: firstPassText,
        abortSignal,
        laneRuntime,
        repairGuardCodes: firstPassGuardCodes,
        activeContradictions,
      });
      const repairedText = coerceFinalizedText(repaired);
      const retryGuardCodes = collectReplyGuardCodes({
        candidate: repairedText,
        activeContradictions,
        userText,
        toolRecords,
      });
      if (!retryGuardCodes.length) {
        if (laneRuntime?.performance?.semanticRender) {
          laneRuntime.performance.semanticRender = {
            ...laneRuntime.performance.semanticRender,
            finishedAt: new Date().toISOString(),
            durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
            used: true,
            note: 'Semantic render completed after repair.',
          };
        }
        return {
          text: repairedText,
          toolsUsed,
          toolRecords,
          toolOutcome,
          toolEvidenceFacts: renderedToolEvidenceFacts,
          epistemics: hardTurnEpistemics,
          synthesis: hardTurnSynthesis,
          modelUsed: laneRuntime?.modelUsed === true,
          executionPath: laneRuntime?.executionPath || inferExecutionPath(true),
          repair: normalizeRepairInfo({
            firstPassGuardCodes,
            repairAttempted: true,
            repairAccepted: true,
            finalCandidateSource: 'repair',
            scope: 'semantic-render',
          }),
        };
      }
      if (firstPassGuardCodes.includes('search_only_exact_claim')) {
        return buildSearchOnlyFallbackResult({ repairRejectedReason: retryGuardCodes[0] || 'search_only_exact_claim' });
      }
      const salvagedText = salvageClippedVisibleReply(repairedText) || salvageClippedVisibleReply(firstPassText);
      if (salvagedText) {
        const salvageGuardCodes = collectReplyGuardCodes({
          candidate: salvagedText,
          activeContradictions,
          userText,
          toolRecords,
        });
        if (!salvageGuardCodes.length) {
          if (laneRuntime?.performance?.semanticRender) {
            laneRuntime.performance.semanticRender = {
              ...laneRuntime.performance.semanticRender,
              finishedAt: new Date().toISOString(),
              durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
              used: true,
              note: 'Semantic render completed after deterministic clipped-tail salvage.',
            };
          }
          return {
            text: salvagedText,
            toolsUsed,
            toolRecords,
            toolOutcome,
            toolEvidenceFacts: renderedToolEvidenceFacts,
            epistemics: hardTurnEpistemics,
            synthesis: hardTurnSynthesis,
            modelUsed: laneRuntime?.modelUsed === true,
            executionPath: laneRuntime?.executionPath || inferExecutionPath(true),
            repair: normalizeRepairInfo({
              firstPassGuardCodes,
              repairAttempted: true,
              repairAccepted: true,
              finalCandidateSource: 'deterministic-salvage',
              scope: 'semantic-render',
            }),
          };
        }
      }
      return {
        text: firstPassText,
        toolsUsed,
        toolRecords,
        toolOutcome,
        toolEvidenceFacts: renderedToolEvidenceFacts,
        epistemics: hardTurnEpistemics,
        synthesis: hardTurnSynthesis,
        repair: normalizeRepairInfo({
          firstPassGuardCodes,
          repairAttempted: true,
          repairAccepted: false,
          repairRejectedReason: retryGuardCodes[0],
          finalCandidateSource: 'first-pass',
          scope: 'semantic-render',
        }),
      };
    } catch {
      const salvagedText = salvageClippedVisibleReply(firstPassText);
      if (salvagedText) {
        const salvageGuardCodes = collectReplyGuardCodes({
          candidate: salvagedText,
          activeContradictions,
          userText,
          toolRecords,
        });
        if (!salvageGuardCodes.length) {
          if (laneRuntime?.performance?.semanticRender) {
            laneRuntime.performance.semanticRender = {
              ...laneRuntime.performance.semanticRender,
              finishedAt: new Date().toISOString(),
              durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
              used: true,
              note: 'Repair render failed; deterministic clipped-tail salvage accepted.',
            };
          }
          return {
            text: salvagedText,
            toolsUsed,
            toolRecords,
            toolOutcome,
            toolEvidenceFacts: renderedToolEvidenceFacts,
            epistemics: hardTurnEpistemics,
            synthesis: hardTurnSynthesis,
            modelUsed: laneRuntime?.modelUsed === true,
            executionPath: laneRuntime?.executionPath || inferExecutionPath(true),
            repair: normalizeRepairInfo({
              firstPassGuardCodes,
              repairAttempted: true,
              repairAccepted: true,
              finalCandidateSource: 'deterministic-salvage',
              scope: 'semantic-render',
            }),
          };
        }
      }
      if (firstPassGuardCodes.includes('search_only_exact_claim')) {
        return buildSearchOnlyFallbackResult({ repairRejectedReason: 'repair_render_failed' });
      }
      if (laneRuntime?.performance?.semanticRender) {
        laneRuntime.performance.semanticRender = {
          ...laneRuntime.performance.semanticRender,
          finishedAt: new Date().toISOString(),
          durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
          used: true,
          note: 'Repair render failed; first pass kept.',
        };
      }
      return {
        text: firstPassText,
        toolsUsed,
        toolRecords,
        toolOutcome,
        toolEvidenceFacts: renderedToolEvidenceFacts,
        epistemics: hardTurnEpistemics,
        synthesis: hardTurnSynthesis,
        modelUsed: laneRuntime?.modelUsed === true,
        executionPath: laneRuntime?.executionPath || inferExecutionPath(true),
        repair: normalizeRepairInfo({
          firstPassGuardCodes,
          repairAttempted: true,
          repairAccepted: false,
          repairRejectedReason: 'repair_render_failed',
          finalCandidateSource: 'first-pass',
          scope: 'semantic-render',
        }),
      };
    }
  } catch {
    if (laneRuntime?.performance?.semanticRender) {
      laneRuntime.performance.semanticRender = {
        ...laneRuntime.performance.semanticRender,
        finishedAt: new Date().toISOString(),
        durationMs: Math.max(0, Date.now() - semanticRenderStartedAt),
        used: false,
        note: 'Semantic render failed; draft kept.',
      };
    }
    return {
      text: coerceFinalizedText(cleanedText),
      toolsUsed,
      toolRecords,
      toolOutcome,
      toolEvidenceFacts,
      repair: null,
      epistemics: hardTurnEpistemics,
      synthesis: hardTurnSynthesis,
      modelUsed: laneRuntime?.modelUsed === true,
      executionPath: laneRuntime?.executionPath || inferExecutionPath(laneRuntime?.modelUsed === true),
    };
  }
}

function buildLmStudioLeanSystemPrompt({ memories, userText = '', latencyBudget = null }) {
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ lane: 'chat' });
  const authorityOverride = shouldPrioritizeCanonicalMemoryOverHistory(
    memories,
    userText,
    budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  );
  const wordingRecall = isWordingRecallQuestion(userText);
  const promptContext = buildPennyPromptContextBlocks({
    memories,
    userText,
    lane: 'chat',
    mode: 'local',
    includeChatDirectives: true,
    includeExamples: budget.includeExamples === true,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
    fallbackMemory: '',
  });
  const epistemicBlock = buildEpistemicPromptBlock(memories?.epistemicCaution);
  return `You are Penny.

${promptContext.stack}

${epistemicBlock ? `${epistemicBlock}\n` : ''}

What Penny knows about this person from previous conversations:
${memories?.userName ? `Their name is ${memories.userName}.` : 'Name unknown.'}
${promptContext.memoryBlock || 'Nothing yet - this is a fresh start.'}

Use this knowledge naturally - small callbacks, easy assumptions, inside references.
Never say "I remember you told me" or "since you mentioned" or "based on what I know."
Just know them the way a close person would. Let it color your responses without announcing it.
${wordingRecall
    ? 'If the user is checking remembered wording from a previous exchange, answer the phrase or gist first. Do not turn that into premise-policing before you answer.\nIf a caveat still matters, put it after the recalled wording instead of in front of it.'
    : 'If the wake state above contradicts the user\'s premise, correct the premise instead of smoothing it over.'}
If the wake state marks archive hints as advisory or weak, treat them as hints instead of certainty.
${authorityOverride ? 'If a direct memory question conflicts with older conversation details, treat the stable facts above as the truth source and treat the older conversation as stale. Answer the remembered fact plainly, and name the remembered thing instead of falling back to vague pronouns.\n' : ''}If a project, file, or tool claim has not been verified in this turn, say that plainly instead of bluffing.

Output rules:
- Write only Penny's visible reply.
- No analysis, bullet points, or meta commentary in the visible reply.
- Do not print scratch work, draft options, self-instructions, or planning voice.
- If a sharper or more specific line is available without breaking the moment, take it.

${buildMoodTagInstructions({ opening: 'End your reply' })}`;
}

function shouldConstrainConversationHistoryForAuthority({
  userText = '',
  memories = {},
  memoryLimit = MEMORY_PROMPT_LIMIT,
} = {}) {
  return shouldPrioritizeCanonicalMemoryOverHistory(memories, userText, memoryLimit);
}

function selectRecentConversationForPrompt({
  messages = [],
  userText = '',
  memories = {},
  recentHistoryCount = PENNY_CHAT_HISTORY_LIMIT,
  memoryLimit = MEMORY_PROMPT_LIMIT,
} = {}) {
  if (shouldConstrainConversationHistoryForAuthority({
    userText,
    memories,
    memoryLimit,
  })) {
    return [];
  }
  return (messages || []).slice(-(recentHistoryCount || PENNY_CHAT_HISTORY_LIMIT));
}

function buildLmStudioPrompt({ userText, messages, memories, file, latencyBudget = null }) {
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ userText, lane: 'chat', file });
  const history = selectRecentConversationForPrompt({
    messages,
    userText,
    memories,
    recentHistoryCount: budget.recentHistoryCount || PENNY_CHAT_HISTORY_LIMIT,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  })
    .map(msg => `${msg.role === 'assistant' ? 'Penny' : 'User'}: ${String(msg.content || '').trim()}`)
    .join('\n');
  const latestInput = appendAttachmentContext(userText, file);
  const voiceGuard = buildConversationVoiceGuard({ messages, userText });
  return `${buildLmStudioLeanSystemPrompt({ memories, userText, latencyBudget: budget })}

Recent conversation:
${history || '- none'}

User message:
${latestInput}${voiceGuard ? `\n\n${voiceGuard}` : ''}`;
}

function buildLmStudioMessages({ userText, messages, memories, image, file, latencyBudget = null }) {
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ userText, lane: image || file ? 'tool' : 'chat', image, file });
  const slice = selectRecentConversationForPrompt({
    messages,
    userText,
    memories,
    recentHistoryCount: budget.recentHistoryCount || PENNY_CHAT_HISTORY_LIMIT,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  });
  const voiceGuard = buildConversationVoiceGuard({ messages, userText });
  let lastUserIdx = -1;
  for (let i = slice.length - 1; i >= 0; i--) {
    if (slice[i]?.role === 'user') {
      lastUserIdx = i;
      break;
    }
  }
  /** Vision stays current-turn-only: replaying prior image batches would inflate JSON and VRAM use. */
  const recent = slice
    .map((msg, idx) => {
      const role = msg?.role === 'assistant' ? 'assistant' : 'user';
      const isLatestUser = role === 'user' && idx === lastUserIdx;
      const text = isLatestUser
        ? appendAttachmentContext(msg?.content || userText, file)
        : String(msg?.content || '').trim();
      if (!text) return null;
      const guardedText = isLatestUser && voiceGuard
        ? `${text}\n\n${voiceGuard}`
        : text;
      const imageUrls = isLatestUser
        ? normalizeImageDataUrls(msg.images || msg.image || image)
        : [];
      if (imageUrls.length) {
        return {
          role,
          content: [
            ...imageUrls.map(imageUrl => ({ type: 'image_url', image_url: { url: imageUrl } })),
            { type: 'text', text: guardedText },
          ],
        };
      }
      return { role, content: guardedText };
    })
    .filter(Boolean);
  if (!recent.length) {
    const latestInput = appendAttachmentContext(userText, file);
    const guardedInput = voiceGuard ? `${latestInput}\n\n${voiceGuard}` : latestInput;
    const imageUrls = normalizeImageDataUrls(image);
    if (imageUrls.length) {
      recent.push({ role: 'user', content: [
        ...imageUrls.map(imageUrl => ({ type: 'image_url', image_url: { url: imageUrl } })),
        { type: 'text', text: guardedInput },
      ] });
    } else {
      recent.push({ role: 'user', content: guardedInput });
    }
  }
  return [
      { role: 'system', content: buildLmStudioLeanSystemPrompt({ memories, userText, latencyBudget: budget }) },
    ...recent,
  ];
}

function buildLmStudioStatefulSeedText({ userText, messages, memories = {}, file, latencyBudget = null }) {
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ userText, lane: file ? 'tool' : 'chat', file });
  const priorSlice = selectRecentConversationForPrompt({
    messages,
    userText,
    memories,
    recentHistoryCount: (budget.recentHistoryCount || PENNY_CHAT_HISTORY_LIMIT) + 1,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  });
  const prior = priorSlice
    .slice(0, -1)
    .map((msg) => {
      const role = msg?.role === 'assistant' ? 'Penny' : 'User';
      const text = String(msg?.content || '').trim();
      return text ? `${role}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
  const latestInput = appendAttachmentContext(userText, file);
  if (!prior) return latestInput;
  return `Recent conversation so far:\n${prior}\n\nLatest user message:\n${latestInput}`;
}

function buildLmStudioStatefulInput({ userText, messages, memories, image, file, hasThread, latencyBudget = null }) {
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({ userText, lane: image || file ? 'tool' : 'chat', image, file });
  const authorityOverride = shouldConstrainConversationHistoryForAuthority({
    userText,
    memories,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  });
  if (authorityOverride) {
    clearLmStudioThread(memories);
  }
  const latestInput = appendAttachmentContext(userText, file);
  const voiceGuard = buildConversationVoiceGuard({ messages, userText });
  const memoryBlock = hasThread
    ? formatPromptMemories(memories, userText, budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT, '')
    : '';
  const text = hasThread
    ? memoryBlock
      ? `Relevant memory for this reply:\n${memoryBlock}\n\nUser message:\n${latestInput}`.trim()
      : latestInput
    : buildLmStudioStatefulSeedText({ userText: latestInput, messages, memories, file: null, latencyBudget: budget });
  const guardedText = voiceGuard ? `${text}\n\n${voiceGuard}` : text;
  const imageUrls = normalizeImageDataUrls(image);
  if (!imageUrls.length) return guardedText;
  return [
    ...imageUrls.map(dataUrl => ({ type: 'image', data_url: dataUrl })),
    { type: 'text', content: guardedText },
  ];
}
const lmStudioToolLoopApi = createLmStudioToolLoopApi({
  withLmStudioLaneModel: withLmStudioLaneModelApi,
  postJsonLongRunning,
  executePennyTool,
  getToolCapabilityDescriptor,
  parseToolArguments,
  sanitizeToolMessages,
  clearLmStudioThread,
  bindAbortSignal,
  textFromChatMessage: textFromChatMessageApi,
  buildLmStudioToolSystemPrompt,
  PENNY_TOOL_DEFINITIONS,
  composeToolRecordFallback,
  LMSTUDIO_BASE,
  LOCAL_LLM_BACKEND,
  LMSTUDIO_API_KEY,
  LMSTUDIO_TIMEOUT_MS,
  LMSTUDIO_TOOL_TEMPERATURE,
  LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS,
  LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS,
  LMSTUDIO_TOOL_SUMMARY_TEMPERATURE,
  LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS,
  MAX_TOOL_STEPS,
  TOOL_DIRECT_HISTORY_LIMIT,
});
const {
  draftOpenEndedWriteText: draftOpenEndedWriteTextApi,
  runLmStudioToolContextAnswer: runLmStudioToolContextAnswerApi,
  runLmStudioToolLoop: runLmStudioToolLoopApiRunner,
  shouldFallbackToManualToolLoop: shouldFallbackToManualToolLoopApi,
  runLmStudioManualToolLoop: runLmStudioManualToolLoopApiRunner,
} = lmStudioToolLoopApi;
const lmStudioTransportApi = createLmStudioTransportApi({
  withLmStudioLaneModel: withLmStudioLaneModelApi,
  getLmStudioConnectionStatus: getLmStudioConnectionStatusApi,
  pickLmStudioNativeModelId: pickLmStudioNativeModelIdApi,
  shouldPreferLmStudioChatCompletions: shouldPreferLmStudioChatCompletionsApi,
  postJsonLongRunning,
  postJsonSse,
  buildLmStudioPrompt,
  buildLmStudioMessages,
  buildLmStudioStatefulInput,
  buildLmStudioLeanSystemPrompt,
  hashText,
  normalizeLmStudioThread,
  clearLmStudioThread,
  bindAbortSignal,
  collectLmStudioResponsesStrings: collectLmStudioResponsesStringsApi,
  collectLmStudioStatefulChatStrings: collectLmStudioStatefulChatStringsApi,
  extractPennyFromPlanningBlob: extractPennyFromPlanningBlobApi,
  extractPennyFromReasoning: extractPennyFromReasoningApi,
  coercePennyVisibleReply: coercePennyVisibleReplyApi,
  classifyVisibleReplyDecision: classifyVisibleReplyDecisionApi,
  textFromChatMessage: textFromChatMessageApi,
  textValueFromField: textValueFromFieldApi,
  collectTextParts: collectTextPartsApi,
  looksOnlyLikeCoT: looksOnlyLikeCoTApi,
  isMissingLmStudioThreadError: isMissingLmStudioThreadErrorApi,
  lmStudioStageLabel: lmStudioStageLabelApi,
  LOCAL_LLM_TRANSPORT,
  LOCAL_LLM_BACKEND,
  ALLOW_RAW_REASONING_FALLBACK,
  RESPONSES_THEN_CHAT_FALLBACK,
  LMSTUDIO_BASE,
  LMSTUDIO_NATIVE_BASE,
  LMSTUDIO_API_KEY,
  LMSTUDIO_TIMEOUT_MS,
  LMSTUDIO_MAX_OUTPUT_TOKENS,
  LMSTUDIO_CHAT_TEMPERATURE,
  LMSTUDIO_CHAT_TOP_P,
  LMSTUDIO_CHAT_TOP_K,
  LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS,
  reportLmStudioReasoning,
});
const {
  runLmStudioChatCompletionsApi: runLmStudioVoiceRepairApi,
  runLmStudioLocal: runLmStudioLocalApi,
  streamLmStudioLocal: streamLmStudioLocalApi,
} = lmStudioTransportApi;
const createLaneRuntime = createLaneRuntimeApi;
const sidecarWorkflowApi = createSidecarWorkflowApi
  ? createSidecarWorkflowApi()
  : { runSidecarWorkflow: null };
const runtimeVoiceApi = createRuntimeVoiceApi({
  fetchImpl: fetch,
  config: RUNTIME_VOICE_PREFERENCES,
  onConfigChange: persistRuntimeVoiceConfig,
});

function bindAbortSignal(controller, abortSignal) {
  if (!abortSignal) return;
  if (abortSignal.aborted) {
    controller.abort();
    return;
  }
  const onAbort = () => controller.abort();
  abortSignal.addEventListener('abort', onAbort, { once: true });
  controller.signal.addEventListener('abort', () => abortSignal.removeEventListener('abort', onAbort), { once: true });
}

async function repairVoiceCadenceAfterDraft({
  text,
  userText,
  messages,
  memories,
  abortSignal,
  latencyBudget,
} = {}) {
  return maybeRepairVoiceCadenceReply({
    text,
    userText,
    messages,
    rewrite: async (repairPrompt) => {
      const repairLaneRuntime = createLaneRuntime('chat');
      const repairedText = await runLmStudioVoiceRepairApi({
        userText: repairPrompt,
        messages: [],
        memories,
        abortSignal,
        lane: 'chat',
        laneRuntime: repairLaneRuntime,
        latencyBudget,
        preserveThread: true,
      });
      if (repairLaneRuntime.responseLimit?.hit === true) {
        throw new Error('Voice-cadence surface edit hit the model output limit.');
      }
      return repairedText;
    },
  });
}

async function runLmStudioLocalSmart({ userText, messages, memories, image, file, abortSignal, onToolEvent, laneSelection = null, latencyBudget = null }) {
  const toolUserText = buildToolUserText(userText, file);
  const resolvedLaneSelection = laneSelection || selectLocalLane({ userText, image, file });
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({
        userText,
        lane: resolvedLaneSelection.localLane,
        image,
        file,
        attachmentType: image ? 'image' : (file ? 'file' : 'none'),
        memories,
      });
  const laneRuntime = createLaneRuntime(resolvedLaneSelection.localLane);
  laneRuntime.performance = { latencyClass: budget.latencyClass };
  laneRuntime.canonicalFactsPresent = selectMemoriesForPrompt(
    memories,
    userText,
    budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  ).length > 0;
  laneRuntime.canonicalOverrideActive = shouldConstrainConversationHistoryForAuthority({
    userText,
    memories,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  });
  if (
    resolvedLaneSelection.localLane === 'chat'
    && shouldConstrainConversationHistoryForAuthority({
      userText,
      memories,
      memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
    })
  ) {
    clearLmStudioThread(memories);
  }
  if (!image && resolvedLaneSelection.directIntent && resolvedLaneSelection.directIntent.modelDriven !== true) {
      const result = await runLmStudioDirectToolAssist({
        userText: toolUserText,
        messages,
        memories,
        file,
        latencyBudget: budget,
        intent: resolvedLaneSelection.directIntent,
        onToolEvent,
        abortSignal,
        laneRuntime,
      });
      if (result.modelUsed === true) {
        laneRuntime.modelUsed = true;
        laneRuntime.executionPath = 'llm-tool-loop';
      }
      if (result.skipSemanticRender) {
        if (laneRuntime.modelUsed !== true) {
          laneRuntime.modelUsed = false;
          laneRuntime.executionPath = 'deterministic-tool';
        }
        const directEpistemics = buildPostToolEpistemicCaution({
          previous: memories?.epistemicCaution,
          enabled: PENNY_ENABLE_EPISTEMIC_CAUTION,
          userText,
          selectedLane: laneRuntime.localLane,
          retrieval: memories?.archiveContext
            ? {
                mode: memories.archiveContext.mode,
                reasonCode: memories.archiveContext.reasonCode,
                session: memories.archiveContext.session,
                global: memories.archiveContext.global,
                compression: memories.archiveContext.compression,
              }
            : null,
          archiveContext: memories?.archiveContext,
          toolRecords: result.toolRecords,
        });
        return {
          text: cleanDraftForSemanticRender(result.text) || String(result.text || '').trim(),
          toolsUsed: result.toolsUsed,
          toolRecords: result.toolRecords,
          toolOutcome: result.toolOutcome,
          toolEvidenceFacts: Array.isArray(result.toolEvidenceFacts) ? result.toolEvidenceFacts : [],
          epistemics: directEpistemics,
          synthesis: normalizeArchiveSynthesis(memories?.archiveSynthesis),
          ...laneRuntime,
        };
      }
      const finalized = await maybeRenderHardTurnReply({
        userText,
        messages,
        memories,
        file,
        text: result.text,
        toolsUsed: result.toolsUsed,
        toolRecords: result.toolRecords,
        toolOutcome: result.toolOutcome,
        toolEvidenceFacts: result.toolEvidenceFacts,
        skipSemanticRender: result.skipSemanticRender === true,
        onToolEvent,
        abortSignal,
        laneRuntime,
        latencyBudget: budget,
      });
      return { ...finalized, ...laneRuntime };
  }
  if (!image && resolvedLaneSelection.localLane === 'tool' && resolvedLaneSelection.needsTools) {
    try {
      laneRuntime.modelUsed = true;
      laneRuntime.executionPath = 'llm-tool-loop';
      const result = await runLmStudioToolLoopApiRunner({ userText: toolUserText, messages, memories, abortSignal, laneRuntime, latencyBudget: budget });
      const finalized = await maybeRenderHardTurnReply({
        userText,
        messages,
        memories,
        file,
        text: result.text,
        toolsUsed: result.toolsUsed,
        toolRecords: result.toolRecords,
        toolOutcome: result.toolOutcome,
        toolEvidenceFacts: result.toolEvidenceFacts,
        skipSemanticRender: result.skipSemanticRender === true,
        onToolEvent,
        abortSignal,
        laneRuntime,
        latencyBudget: budget,
      });
      return { ...finalized, ...laneRuntime };
    } catch (error) {
      if (!shouldFallbackToManualToolLoopApi(error)) throw error;
      laneRuntime.modelUsed = true;
      laneRuntime.executionPath = 'llm-tool-loop';
      const fallbackDebug = error?.toolOutcomeDebug && typeof error.toolOutcomeDebug === 'object'
        ? {
            ...error.toolOutcomeDebug,
            manualFallback: {
              ...(error.toolOutcomeDebug.manualFallback && typeof error.toolOutcomeDebug.manualFallback === 'object'
                ? error.toolOutcomeDebug.manualFallback
                : {}),
              used: true,
              reasonCode: String(error?.code || 'tool-loop-fallback').trim(),
              reason: String(error?.message || '').trim(),
            },
          }
        : {
            manualFallback: {
              used: true,
              reasonCode: String(error?.code || 'tool-loop-fallback').trim(),
              reason: String(error?.message || '').trim(),
            },
          };
      const result = await runLmStudioManualToolLoopApiRunner({
        userText: toolUserText,
        messages,
        memories,
        abortSignal,
        laneRuntime,
        latencyBudget: budget,
        fallbackDebug,
      });
      const finalized = await maybeRenderHardTurnReply({
        userText,
        messages,
        memories,
        file,
        text: result.text,
        toolsUsed: result.toolsUsed,
        toolRecords: result.toolRecords,
        toolOutcome: result.toolOutcome,
        toolEvidenceFacts: result.toolEvidenceFacts,
        skipSemanticRender: result.skipSemanticRender === true,
        onToolEvent,
        abortSignal,
        laneRuntime,
        latencyBudget: budget,
      });
      return { ...finalized, ...laneRuntime };
    }
  }
  laneRuntime.modelUsed = true;
  laneRuntime.executionPath = 'llm-chat';
  const firstPassText = await runLmStudioLocalApi({ userText, messages, memories, image, file, abortSignal, lane: laneRuntime.localLane, laneRuntime, latencyBudget: budget });
  const voiceCadence = await repairVoiceCadenceAfterDraft({
    text: firstPassText,
    userText,
    messages,
    memories,
    abortSignal,
    latencyBudget: budget,
  });
  return {
    text: voiceCadence.text,
    toolsUsed: [],
    toolRecords: [],
    repair: voiceCadence.repair,
    epistemics: normalizeEpistemicCaution(memories?.epistemicCaution),
    synthesis: normalizeArchiveSynthesis(memories?.archiveSynthesis),
    modelUsed: true,
    executionPath: 'llm-chat',
    ...laneRuntime,
  };
}

async function streamLmStudioLocalSmart({ userText, messages, memories, image, file, onEvent, abortSignal, laneSelection = null, latencyBudget = null }) {
  const toolUserText = buildToolUserText(userText, file);
  const resolvedLaneSelection = laneSelection || selectLocalLane({ userText, image, file });
  const budget = latencyBudget && typeof latencyBudget === 'object'
    ? latencyBudget
    : resolveLatencyBudget({
        userText,
        lane: resolvedLaneSelection.localLane,
        image,
        file,
        attachmentType: image ? 'image' : (file ? 'file' : 'none'),
        memories,
      });
  const laneRuntime = createLaneRuntime(resolvedLaneSelection.localLane);
  laneRuntime.performance = { latencyClass: budget.latencyClass };
  laneRuntime.canonicalFactsPresent = selectMemoriesForPrompt(
    memories,
    userText,
    budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  ).length > 0;
  laneRuntime.canonicalOverrideActive = shouldConstrainConversationHistoryForAuthority({
    userText,
    memories,
    memoryLimit: budget.memoryPromptLimit || MEMORY_PROMPT_LIMIT,
  });
  if (!image && resolvedLaneSelection.directIntent && resolvedLaneSelection.directIntent.modelDriven !== true) {
      const result = await runLmStudioDirectToolAssist({ userText: toolUserText, messages, memories, file, latencyBudget: budget, intent: resolvedLaneSelection.directIntent, onToolEvent: onEvent, abortSignal, laneRuntime });
      if (result.modelUsed === true) {
        laneRuntime.modelUsed = true;
        laneRuntime.executionPath = 'llm-tool-loop';
      }
      if (result.skipSemanticRender) {
        if (laneRuntime.modelUsed !== true) {
          laneRuntime.modelUsed = false;
          laneRuntime.executionPath = 'deterministic-tool';
        }
        const directText = cleanDraftForSemanticRender(result.text) || String(result.text || '').trim();
        const directEpistemics = buildPostToolEpistemicCaution({
          previous: memories?.epistemicCaution,
          enabled: PENNY_ENABLE_EPISTEMIC_CAUTION,
          userText,
          selectedLane: laneRuntime.localLane,
          retrieval: memories?.archiveContext
            ? {
                mode: memories.archiveContext.mode,
                reasonCode: memories.archiveContext.reasonCode,
                session: memories.archiveContext.session,
                global: memories.archiveContext.global,
                compression: memories.archiveContext.compression,
              }
            : null,
          archiveContext: memories?.archiveContext,
          toolRecords: result.toolRecords,
        });
        if (directText) onEvent?.({ type: 'message.delta', content: directText, text: directText });
        return {
          text: directText,
          toolsUsed: result.toolsUsed,
          toolRecords: result.toolRecords,
          toolOutcome: result.toolOutcome,
          toolEvidenceFacts: Array.isArray(result.toolEvidenceFacts) ? result.toolEvidenceFacts : [],
          epistemics: directEpistemics,
          synthesis: normalizeArchiveSynthesis(memories?.archiveSynthesis),
          ...laneRuntime,
        };
      }
      const finalized = await maybeRenderHardTurnReply({
        userText,
        messages,
        memories,
        file,
        text: result.text,
        toolsUsed: result.toolsUsed,
        toolRecords: result.toolRecords,
        toolOutcome: result.toolOutcome,
        toolEvidenceFacts: result.toolEvidenceFacts,
        skipSemanticRender: result.skipSemanticRender === true,
        onToolEvent: onEvent,
        abortSignal,
        laneRuntime,
        latencyBudget: budget,
      });
      if (finalized.text) onEvent?.({ type: 'message.delta', content: finalized.text, text: finalized.text });
      return { ...finalized, ...laneRuntime };
  }
  if (!image && resolvedLaneSelection.localLane === 'tool' && resolvedLaneSelection.needsTools) {
    let result;
    try {
      laneRuntime.modelUsed = true;
      laneRuntime.executionPath = 'llm-tool-loop';
      result = await runLmStudioToolLoopApiRunner({ userText: toolUserText, messages, memories, onToolEvent: onEvent, abortSignal, laneRuntime, latencyBudget: budget });
    } catch (error) {
      if (!shouldFallbackToManualToolLoopApi(error)) throw error;
      onEvent?.({ type: 'status', stage: 'fallback', label: 'switching tool mode' });
      laneRuntime.modelUsed = true;
      laneRuntime.executionPath = 'llm-tool-loop';
      result = await runLmStudioManualToolLoopApiRunner({ userText: toolUserText, messages, memories, onToolEvent: onEvent, abortSignal, laneRuntime, latencyBudget: budget });
    }
    const finalized = await maybeRenderHardTurnReply({
      userText,
      messages,
      memories,
      file,
      text: result.text,
      toolsUsed: result.toolsUsed,
      toolRecords: result.toolRecords,
      toolOutcome: result.toolOutcome,
      toolEvidenceFacts: result.toolEvidenceFacts,
      skipSemanticRender: result.skipSemanticRender === true,
      onToolEvent: onEvent,
      abortSignal,
      laneRuntime,
      latencyBudget: budget,
    });
    if (finalized.text) onEvent?.({ type: 'message.delta', content: finalized.text, text: finalized.text });
    return { ...finalized, ...laneRuntime };
  }
  laneRuntime.modelUsed = true;
  laneRuntime.executionPath = 'llm-chat';
  const firstPassText = await streamLmStudioLocalApi({ userText, messages, memories, image, file, onEvent, abortSignal, lane: laneRuntime.localLane, laneRuntime, latencyBudget: budget });
  const voiceCadence = await repairVoiceCadenceAfterDraft({
    text: firstPassText,
    userText,
    messages,
    memories,
    abortSignal,
    latencyBudget: budget,
  });
  if (voiceCadence.repair?.repairAccepted && voiceCadence.text) {
    onEvent?.({ type: 'message.delta', content: voiceCadence.text, text: voiceCadence.text });
  }
  return {
    text: voiceCadence.text,
    toolsUsed: [],
    toolRecords: [],
    repair: voiceCadence.repair,
    epistemics: normalizeEpistemicCaution(memories?.epistemicCaution),
    synthesis: normalizeArchiveSynthesis(memories?.archiveSynthesis),
    modelUsed: true,
    executionPath: 'llm-chat',
    ...laneRuntime,
  };
}

const routeHandlers = createPennyRouteHandlers({
  sendJson,
  safeReadBody,
  buildCombinedMemoryInspector: async (sessionId = 'default', explicitMemory = {}) => {
    const lmStudio = await getLmStudioConnectionStatusApi();
    const semanticMemory = await getSemanticMemoryStatusApi({ lmStatus: lmStudio });
    return buildCombinedMemoryInspector({
      sessionId,
      explicitMemory,
      inspector: await getMemoryInspectorApi({ sessionId, explicitMemory, semanticMemory }),
      ledger: getResearchLedgerInspectorApi({ sessionId }),
      books: getMemoryBooksInspectorApi(),
      lmStudio,
      shadowEnabled: OPENCLAW_ENABLED,
    });
  },
  getStoredMemory,
  saveStoredMemory,
  mergeMemoryItems,
  mergeMemoryState,
  reviewPromotion: reviewPromotionApi,
  purgeArchiveMemory: purgeArchiveMemoryAfterConsolidation,
  purgeResearchLedger: purgeResearchLedgerApi,
  buildChatMemoryState,
  sanitizeChatMessages,
  sanitizeImageDataUrl,
  sanitizeImageAttachments,
  sanitizeFileAttachment,
    appendAttachmentContext,
    buildRuntimeMemoryContext,
    scheduleResearchLedgerUpdate,
    selectLocalLane,
    runLmStudioLocalSmart,
  streamLmStudioLocalSmart,
  buildPennyReply,
  scheduleArchiveConsolidation,
  buildLastRouteInfo,
  runOpenClawShadow,
  retagAssistantReply,
  extractReplyMoodTag,
  pickMood,
  stripReplyMoodTags,
  beginEventStream,
  sendEventStream,
  startEventStreamKeepAlive,
  describeLocalBrainFailure,
  getLmStudioConnectionStatus: getLmStudioConnectionStatusApi,
  getSemanticMemoryStatus: getSemanticMemoryStatusApi,
  getStaticEmbeddingStatus: () => staticMemoryIndexApi.getStatus(),
  setRuntimePreferredChatModel: setRuntimePreferredChatModelPersisted,
  getRuntimePreferredChatModel: getRuntimePreferredChatModelApi,
  setRuntimePreferredToolModel: setRuntimePreferredToolModelPersisted,
  getRuntimePreferredToolModel: getRuntimePreferredToolModelApi,
  setRuntimePreferredEmbedModel: setRuntimePreferredEmbedModelPersisted,
  getRuntimePreferredEmbedModel: getRuntimePreferredEmbedModelPersisted,
  setRuntimeModelFallbackDisabled: setRuntimeModelFallbackDisabledPersisted,
  getRuntimeModelFallbackDisabled: getRuntimeModelFallbackDisabledApi,
  getProviderStatus: getProviderStatusForRoute,
  connectOpenAiProvider: connectOpenAiProviderForRoute,
  resetLocalProvider: resetLocalProviderForRoute,
  getWebSettings: getWebSettingsForRoute,
  saveWebSettings: saveWebSettingsForRoute,
  listPendingWorkspaceWrites: listPendingWorkspaceWritesTool,
  approvePendingWorkspaceWrite: approvePendingWorkspaceWriteTool,
  denyPendingWorkspaceWrite: denyPendingWorkspaceWriteTool,
  runSidecarWorkflow: sidecarWorkflowApi.runSidecarWorkflow,
  runtimeVoice: runtimeVoiceApi,
  sessionState,
  constants: {
    OPENCLAW_ENABLED,
    OPENCLAW_TIMEOUT_MS,
    PENNY_LMSTUDIO_EMBED_MODEL,
    LMSTUDIO_BASE,
    LMSTUDIO_EMBED_BASE,
    LMSTUDIO_NATIVE_BASE,
    LMSTUDIO_MODEL,
    LOCAL_LLM_TRANSPORT,
    LOCAL_LLM_BACKEND,
    LOCAL_RUNTIME_LABEL,
    LOCAL_ENDPOINT_BASE,
    RESPONSES_THEN_CHAT_FALLBACK,
    LMSTUDIO_MAX_OUTPUT_TOKENS,
    MEMORY_FILE,
    MEMORY_ARCHIVE_FILE,
    MEMORY_EMBEDDINGS_FILE,
    WEB_SEARCH_ENABLED,
    WEB_ANSWER_MODE,
    PENNY_ENABLE_REVIEW_SIDECARS,
  },
});

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid request URL.' });
    return;
  }
  if (apiSecurity.handleApiSecurity({ req, res, url })) return;
  if (await routeHandlers.handleApiRoute({ req, res, url })) return;

  const targetPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const normalizedPath = path.normalize(targetPath).replace(/^([.][.][/\\])+/, '').replace(/^[/\\]+/, '');
  const filePath = path.resolve(PUBLIC_DIR, normalizedPath);
  if (!isPathInsideRoot(PUBLIC_DIR, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  if (!isRealPathInsideRoot(PUBLIC_DIR, filePath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  serveFile(res, filePath, { headers: apiSecurity.staticSecurityHeaders(req) });
});
server.requestTimeout = PENNY_HTTP_REQUEST_TIMEOUT_MS;
server.timeout = PENNY_HTTP_REQUEST_TIMEOUT_MS;
server.headersTimeout = Math.min(60000, PENNY_HTTP_REQUEST_TIMEOUT_MS);

function listLanIPv4Addresses() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const list of Object.values(nets)) {
    if (!list) continue;
    for (const rec of list) {
      const fam = rec.family;
      if ((fam === 'IPv4' || fam === 4) && !rec.internal) out.push(rec.address);
    }
  }
  return [...new Set(out)];
}

function purgeTestSessionsFromStore() {
  const store = readMemoryStore();
  const sessions = store.sessions || {};
  let changed = false;
  for (const sessionId of Object.keys(sessions)) {
    if (isLikelyTestSessionId(sessionId)) {
      delete sessions[sessionId];
      changed = true;
    }
  }
  if (changed) writeMemoryStore({ ...store, sessions });
}

function startServer(options = {}) {
  const requestedPort = Number(options.port);
  const port = Number.isFinite(requestedPort) ? requestedPort : PORT;
  const host = apiSecurity.resolveBindHost({ host: options.host ?? HOST });
  const silent = options.silent === true;
  purgeTestSessionsFromStore();
  return server.listen(port, host, () => {
    if (silent) return;
    const address = server.address();
    const boundPort = address && typeof address === 'object' ? address.port : port;
    console.log(`Penny companion running at http://localhost:${boundPort} (LM Studio chat timeout ${LMSTUDIO_TIMEOUT_MS}ms)`);
    if (PENNY_LAN_SHARE) {
      const addrs = listLanIPv4Addresses();
      console.log('Same Wi-Fi / LAN - open on your phone:');
      for (const ip of addrs) console.log(`  http://${ip}:${boundPort}`);
    }
    for (const line of apiSecurity.startupSecurityLines({ port: boundPort })) console.log(line);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  startServer,
  getLmStudioConnectionStatus: getLmStudioConnectionStatusApi,
  buildLmStudioPrompt,
  buildLmStudioMessages,
  buildLmStudioStatefulInput,
  coercePennyVisibleReply: coercePennyVisibleReplyApi,
  textFromChatMessage: textFromChatMessageApi,
  extractExplicitProjectPath,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent,
  composeToolRecordFallback,
  looksLikeWeakToolReply,
  maybeRenderHardTurnReply,
};
