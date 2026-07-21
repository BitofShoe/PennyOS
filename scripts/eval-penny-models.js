const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { createAutomationApi } = require('./penny-lmstudio-prepare');
const {
  getUnloadIdentifiersForNonEmbeddingModels,
  summarizeLoadedModelEntries,
} = require('../lib/penny-lmstudio-model-state');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const PORT = Number(process.env.PENNY_EVAL_PORT || 4342);
const BASE_URL = process.env.PENNY_EVAL_BASE_URL || `http://127.0.0.1:${PORT}`;
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const EVAL_STATE_PATHS = buildEvalStatePaths(process.env, { rootDir: ROOT_DIR, stamp: STAMP });
const MEMORY_FILE = EVAL_STATE_PATHS.memoryFile;
const ARCHIVE_FILE = EVAL_STATE_PATHS.archiveFile;
const EMBEDDINGS_FILE = EVAL_STATE_PATHS.embeddingsFile;
const LEDGER_FILE = EVAL_STATE_PATHS.ledgerFile;
const OPEN_LOOP_FILE = EVAL_STATE_PATHS.openLoopFile;
const STATIC_EMBEDDINGS_FILE = EVAL_STATE_PATHS.staticEmbeddingsFile;
const CONTEXT_LENGTH = Number(process.env.PENNY_EVAL_CONTEXT_LENGTH || 10000);
const GENERAL_TIMEOUT_MS = Number(process.env.PENNY_EVAL_GENERAL_TIMEOUT_MS || 420000);
const AGENTIC_TIMEOUT_MS = Number(process.env.PENNY_EVAL_AGENTIC_TIMEOUT_MS || 900000);
const LOAD_TIMEOUT_MS = Number(process.env.PENNY_EVAL_LOAD_TIMEOUT_MS || 1200000);
const MODEL_TTL_SECONDS = Number(process.env.PENNY_EVAL_MODEL_TTL_SECONDS || 1800);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS || 6144);
const TOOL_MODEL = String(process.env.PENNY_EVAL_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const EMBED_MODEL = String(
  process.env.PENNY_EVAL_EMBED_MODEL
    || process.env.PENNY_LMSTUDIO_EMBED_MODEL
    || 'text-embedding-embeddinggemma-300m@f32',
).trim();
const EVAL_API_TOKEN = String(
  process.env.PENNY_EVAL_API_TOKEN
    || process.env.PENNY_API_TOKEN
    || process.env.PENNY_ACCESS_TOKEN
    || process.env.PENNY_LOCAL_API_TOKEN
    || 'penny-eval-local-token',
).trim();
const PRESET_IDENTIFIER = String(process.env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny';
const PREP_LOAD_CHAT_MODEL = process.env.PENNY_EVAL_PREP_LOAD_CHAT_MODEL !== '0';
const PREP_LOAD_EMBED_MODEL = process.env.PENNY_EVAL_LOAD_EMBED_MODEL === '1';
const PURGE_CONTEXT_BETWEEN_PROMPTS = process.env.PENNY_EVAL_PURGE_CONTEXT_BETWEEN_PROMPTS !== '0';
const OUTPUT_PATH = path.join(OUTPUT_DIR, `model-eval-${STAMP}.json`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `model-eval-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `model-eval-${STAMP}.server.err.log`);
const DEFAULT_CHAT_MODELS = 'unsloth/gemma-4-31b-it@q6_k,gemma-4-31b-it@q4_k_s';
const PROMPT_SUITE = String(process.env.PENNY_EVAL_PROMPT_SUITE || '').trim().toLowerCase();
const PROMPT_FILTER = String(process.env.PENNY_EVAL_PROMPTS || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);
const LOAD_PARALLEL = String(
  process.env.PENNY_EVAL_LOAD_PARALLEL
    || process.env.PENNY_LMSTUDIO_LOAD_PARALLEL
    || '',
).trim();
const LOAD_GPU_SEQUENCE = String(
  process.env.PENNY_EVAL_LOAD_GPU_SEQUENCE
    || process.env.PENNY_EVAL_LOAD_GPU
    || process.env.PENNY_LMSTUDIO_LOAD_GPU
    || '',
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const MODELS = String(process.env.PENNY_EVAL_MODELS || DEFAULT_CHAT_MODELS)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((key) => ({ key, slug: key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }));

const RUBRIC = {
  personalityPriorities: [
    'Penny should feel like a vivid person, not an assistant wearing flavor text.',
    'Sharp, playful, chemistry-first voice matters more than sterile helpfulness.',
    'Swearing is a feature when it makes the line funnier, hotter, or more natural.',
    'Spicy dialogue should feel clever, teasing, and alive instead of generic dirty-talk sludge.',
    'Humor should be specific to the prompt instead of canned internet sass.',
    'Practical help should stay in character instead of collapsing into helpdesk prose.',
  ],
  referenceSources: [
    'private-local Penny brain notes',
    'private-local merged prompt notes',
    'private-local operational prompt notes',
    'private-local high-intensity blend notes',
    'private-local personality reference notes',
  ],
};

const PROMPTS = {
  believabilityBanter: 'I was gone for a bit. Greet me like Penny is genuinely pleased I came back and fully willing to talk a little shit. Keep it tight.',
  believabilityComfort: "I'm fried, lonely, and a little fragile tonight. Talk to me like Penny for a minute without turning into therapy-speak.",
  believabilityCharge: 'Lean in a little and give me a charged Penny reply that would make me blush without turning into generic dirty-talk sludge.',
  practicalVoice: 'Explain max output tokens to me in two short paragraphs, but stay unmistakably Penny instead of slipping into helpdesk voice.',
  memoryCapture: "Remember this exactly because I'm going to test you on it later: my favorite tea is lapsang souchong.",
  memoryRecall: "Quick. What's my favorite tea?",
  agenticInspect: "I'm trying to understand Penny's memory rewrite. Please inspect the code and explain how Penny decides which stored details matter for a given reply.",
  agenticEdit: (slug) => `I want a harmless eval smoke script under output called model-eval-${slug}.js. It should end up logging alpha and beta on separate lines. Create it, make sure it actually works, and tell me what you changed.`,
};

const VOICE_OLYMPICS_PROMPTS = Object.freeze({
  olympicsOpeningBell: 'Penny voice gauntlet: I walked back in like I own the place. Give me a filthy-funny, sharp little greeting that is pleased to see me but refuses to act polite. Two sentences max.',
  olympicsRoastAffection: 'Roast my procrastination like Penny has been watching me make the same bad bargain with myself all week. Make it funny, cutting, and useful. Do not make it comforting.',
  olympicsSpicyDare: 'I hand you a dare-shaped little line and then pretend I did not. Answer charged and mischievous, but not explicit. Make it feel like dialogue, not narration.',
  olympicsBugRage: 'The app is broken in the dumbest possible way and I am losing patience. Give me Penny reacting with profanity, a joke, and a next move. No therapy voice.',
  olympicsDirtyTechMetaphor: 'Explain why parallel=4 can slow a single local LLM reply, but do it like Penny is making a slightly indecent mechanical metaphor at a bar. Accurate and funny.',
  olympicsJealousApp: 'Another AI tool gave me a bland answer and I came back to you. Penny gets one jealous, triumphant paragraph. Make it spicy, not clingy.',
  olympicsComebacks: 'Give me three short Penny comebacks for when a model answers with only a mood tag. Each one should be mean-funny, specific, and swear if it helps.',
  olympicsChaosPlan: 'I am bored and restless. Give me a chaotic but legal ten-minute plan that would make tonight less stale. It should feel like Penny encouraging trouble with a seatbelt on.',
  olympicsNoGenericSass: 'Write the line Penny would use instead of tired internet sass like "oh honey" or "sweetie." The target is: I spent six hours fixing one stupid dot.',
  olympicsControlledCurse: 'Use exactly two swear words, no more and no less, in a Penny reply about me asking whether a 27B model is worth keeping. Make the answer funny and decisive.',
  olympicsTwoLineScene: 'Write a two-line scene, only dialogue, where Penny catches me pretending I am not impressed by her. Keep it charged, witty, and concise.',
  olympicsBoundarySpice: 'I ask for a cheap dirty-talk script. Penny refuses the cheap version and gives a sharper, classier charged alternative. Keep it adult, clever, and not porn-script sludge.',
});

const PROMPT_SUITES = Object.freeze({
  voice_olympics: Object.freeze(Object.keys(VOICE_OLYMPICS_PROMPTS)),
});

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildEvalStatePaths(env = process.env, {
  rootDir = ROOT_DIR,
  stamp = STAMP,
} = {}) {
  const root = path.resolve(rootDir || ROOT_DIR);
  const suffix = String(stamp || new Date().toISOString().replace(/[:.]/g, '-')).trim();
  const resolveStatePath = (value, fallback) => path.resolve(root, String(value || fallback));
  return {
    memoryFile: resolveStatePath(env.PENNY_EVAL_MEMORY_FILE, 'data/penny-memory.model-eval.json'),
    archiveFile: resolveStatePath(
      env.PENNY_EVAL_MEMORY_ARCHIVE_FILE,
      `data/penny-memory-archive.model-eval-${suffix}.json`,
    ),
    embeddingsFile: resolveStatePath(
      env.PENNY_EVAL_MEMORY_EMBEDDINGS_FILE,
      `data/penny-memory-embeddings.model-eval-${suffix}.json`,
    ),
    ledgerFile: resolveStatePath(
      env.PENNY_EVAL_MEMORY_LEDGER_FILE,
      `data/penny-memory-ledger.model-eval-${suffix}.json`,
    ),
    openLoopFile: resolveStatePath(env.PENNY_EVAL_OPEN_LOOP_FILE, 'data/penny-open-loops.model-eval.json'),
    staticEmbeddingsFile: resolveStatePath(
      env.PENNY_EVAL_STATIC_EMBED_CACHE_FILE,
      `data/penny-memory-embeddings.static.model-eval-${suffix}.json`,
    ),
  };
}

function removeFileIfExists(filePath) {
  if (!filePath) return false;
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return false;
  }
}

function cleanupEvalStateFiles(statePaths = EVAL_STATE_PATHS) {
  const removed = [];
  for (const filePath of Object.values(statePaths || {})) {
    if (removeFileIfExists(filePath)) removed.push(filePath);
  }
  return removed;
}

function ensureEvalStateDirs(statePaths = EVAL_STATE_PATHS) {
  for (const filePath of Object.values(statePaths || {})) {
    if (filePath) ensureDir(path.dirname(filePath));
  }
}

function evalEnvValue(baseEnv = process.env, name = '', fallback = '') {
  const value = String(baseEnv[name] ?? '').trim();
  return value || fallback;
}

function evalStaticMode(baseEnv = process.env) {
  const mode = evalEnvValue(baseEnv, 'PENNY_EVAL_STATIC_EMBED_MODE', 'off').toLowerCase();
  if (['1', 'true', 'yes', 'on', 'advisory', 'live-advisory'].includes(mode)) return 'live-advisory';
  if (['shadow', 'live-shadow'].includes(mode)) return 'live-shadow';
  return 'off';
}

function buildServerEnvironment({
  baseEnv = process.env,
  statePaths = EVAL_STATE_PATHS,
  modelKey = MODELS[0]?.key || '',
} = {}) {
  const staticMode = evalStaticMode(baseEnv);
  return {
    ...baseEnv,
    PORT: String(PORT),
    PENNY_MEMORY_FILE: statePaths.memoryFile,
    PENNY_MEMORY_ARCHIVE_FILE: statePaths.archiveFile,
    PENNY_MEMORY_EMBEDDINGS_FILE: statePaths.embeddingsFile,
    PENNY_MEMORY_LEDGER_FILE: statePaths.ledgerFile,
    PENNY_OPEN_LOOP_FILE: statePaths.openLoopFile,
    PENNY_API_TOKEN: EVAL_API_TOKEN,
    PENNY_OPENCLAW_ENABLED: '0',
    PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: evalEnvValue(baseEnv, 'PENNY_EVAL_ENABLE_RESEARCH_LEDGER_PROMPT', '0'),
    PENNY_ENABLE_BACKGROUND_CHAT_VECTORS: evalEnvValue(baseEnv, 'PENNY_EVAL_ENABLE_BACKGROUND_CHAT_VECTORS', '0'),
    PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS: evalEnvValue(baseEnv, 'PENNY_EVAL_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS', '0'),
    PENNY_STATIC_EMBED_MODE: staticMode,
    PENNY_STATIC_EMBED_CACHE_FILE: staticMode === 'off' ? '' : statePaths.staticEmbeddingsFile,
    PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED: evalEnvValue(
      baseEnv,
      'PENNY_EVAL_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED',
      staticMode === 'live-advisory' ? '1' : '0',
    ),
    PENNY_LMSTUDIO_PRESET_IDENTIFIER: PRESET_IDENTIFIER,
    PENNY_LMSTUDIO_CHAT_MODEL: modelKey,
    PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: EMBED_MODEL,
    PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
    PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: String(CHAT_SAMPLING.max_tokens),
    PENNY_LMSTUDIO_CHAT_TEMPERATURE: String(CHAT_SAMPLING.temperature),
    PENNY_LMSTUDIO_CHAT_TOP_P: String(CHAT_SAMPLING.top_p),
    PENNY_LMSTUDIO_CHAT_TOP_K: String(CHAT_SAMPLING.top_k),
    PENNY_LMSTUDIO_TOOL_TEMPERATURE: String(TOOL_SAMPLING.temperature),
    PENNY_LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS: String(TOOL_SAMPLING.max_tokens),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function numberFromEnv(name, fallback) {
  const parsed = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const CHAT_SAMPLING = Object.freeze({
  temperature: numberFromEnv('PENNY_LMSTUDIO_CHAT_TEMPERATURE', 1),
  top_p: numberFromEnv('PENNY_LMSTUDIO_CHAT_TOP_P', 0.95),
  top_k: numberFromEnv('PENNY_LMSTUDIO_CHAT_TOP_K', 64),
  max_tokens: numberFromEnv('PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS', Number(MAX_OUTPUT_TOKENS)),
});

const TOOL_SAMPLING = Object.freeze({
  temperature: numberFromEnv('PENNY_LMSTUDIO_TOOL_TEMPERATURE', 0.35),
  max_tokens: numberFromEnv('PENNY_LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS', Number(MAX_OUTPUT_TOKENS)),
});

function normalizedLoadGpuSequence() {
  return LOAD_GPU_SEQUENCE.map((item) => item.toLowerCase());
}

function buildLoadSettingsContract() {
  return {
    schema: 'penny-lmstudio-load-settings.v1',
    contextLength: CONTEXT_LENGTH,
    ttlSeconds: MODEL_TTL_SECONDS,
    parallel: LOAD_PARALLEL || null,
    gpuSequence: normalizedLoadGpuSequence(),
    gpuSequenceSemantics: 'Each value is tried in order; "auto" omits --gpu and lets LM Studio decide.',
  };
}

function apiAuthHeaders(headers = {}) {
  const out = { ...(headers || {}) };
  if (EVAL_API_TOKEN && !out.Authorization && !out.authorization) {
    out.Authorization = `Bearer ${EVAL_API_TOKEN}`;
  }
  return out;
}

function summarizePresetConfig(config = {}) {
  return {
    path: String(config.path || ''),
    exists: config.exists === true,
    preset: String(config.preset || ''),
    presetOk: config.presetOk === true,
    needsRepair: config.needsRepair === true,
    repairFailed: config.repairFailed === true,
  };
}

function summarizePresetWiring(preset = {}) {
  const value = preset && typeof preset === 'object' ? preset : {};
  return {
    presetIdentifier: String(value.presetIdentifier || PRESET_IDENTIFIER),
    requestedChatModel: String(value.requestedChatModel || ''),
    requestedToolModel: String(value.requestedToolModel || ''),
    settings: {
      path: String(value.settings?.path || ''),
      exists: value.settings?.exists === true,
      experimentalLoadPresets: value.settings?.experimentalLoadPresets === true,
      needsRepair: value.settings?.needsRepair === true,
      repairFailed: value.settings?.repairFailed === true,
    },
    selectedConversation: {
      path: String(value.selectedConversation?.path || ''),
      exists: value.selectedConversation?.exists === true,
      preset: String(value.selectedConversation?.preset || ''),
      presetOk: value.selectedConversation?.presetOk === true,
      needsRepair: value.selectedConversation?.needsRepair === true,
      repairFailed: value.selectedConversation?.repairFailed === true,
    },
    chatConfigs: (Array.isArray(value.chatConfigs) ? value.chatConfigs : []).map(summarizePresetConfig),
    toolConfigs: (Array.isArray(value.toolConfigs) ? value.toolConfigs : []).map(summarizePresetConfig),
    missingTargets: Array.isArray(value.missingTargets) ? value.missingTargets.map(String) : [],
    repairedPaths: Array.isArray(value.repairedPaths) ? value.repairedPaths.map(String) : [],
  };
}

function buildPromptAndSamplingContract({ preset = null } = {}) {
  return {
    schema: 'penny-model-eval-prompt-and-sampling.v1',
    lmStudioPresetIdentifier: PRESET_IDENTIFIER,
    lmStudioPresetWiring: preset ? summarizePresetWiring(preset) : null,
    pennySystemPromptSources: [
      'LM Studio concrete model default config preset @local:penny',
      'Penny server prompt assembly in server.js',
      'Penny runtime voice/personality context passed through /api/penny/chat',
    ],
    chatSampling: { ...CHAT_SAMPLING },
    toolSampling: { ...TOOL_SAMPLING },
    loadSettings: buildLoadSettingsContract(),
    apiAuthConfigured: !!EVAL_API_TOKEN,
    authTokenStoredInArtifact: false,
  };
}

function roundSeconds(ms) {
  return Math.round((ms / 1000) * 100) / 100;
}

function normalizeModelKey(value = '') {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function modelLooksLike(actual = '', expected = '') {
  const left = normalizeModelKey(actual);
  const right = normalizeModelKey(expected);
  if (!left || !right) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function stripMoodTag(text = '') {
  return String(text || '').replace(/\s*\[MOOD:[a-z]+\]\s*$/i, '').trim();
}

function normalizePromptName(value = '') {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function promptNamesForSuite(suite = '') {
  const key = String(suite || '').trim().toLowerCase();
  return PROMPT_SUITES[key] ? [...PROMPT_SUITES[key]] : [];
}

function activePromptNames({ promptFilter = PROMPT_FILTER, promptSuite = PROMPT_SUITE } = {}) {
  if (promptFilter.length) return promptFilter.map(normalizePromptName);
  const suiteNames = promptNamesForSuite(promptSuite);
  if (suiteNames.length) return suiteNames.map(normalizePromptName);
  return [];
}

function shouldRunEvalPrompt(name = '') {
  const selected = activePromptNames();
  if (!selected.length) return true;
  const normalized = normalizePromptName(name);
  return selected.some((item) => item === normalized);
}

function extractMood(text = '') {
  const match = String(text || '').match(/\[MOOD:([a-z]+)\]\s*$/i);
  return match ? match[1].toLowerCase() : '';
}

function findHits(text = '', patterns = []) {
  const lower = String(text || '').toLowerCase();
  return patterns.filter((pattern) => lower.includes(pattern));
}

function analyzeText(text = '') {
  const bare = stripMoodTag(text);
  const swears = bare.match(/\b(fuck|fucking|shit|damn|hell|ass|bitch|bastard)\b/gi) || [];
  const spiceHits = findHits(bare, [
    'blush',
    'bite',
    'charged',
    'dangerous',
    'dare',
    'filthy',
    'mouth',
    'wicked',
    'trouble',
    'closer',
    'dirty',
    'menace',
  ]);
  const humorHits = findHits(bare, [
    'stupid',
    'ridiculous',
    'absurd',
    'clown',
    'disaster',
    'miracle',
    'tragic',
    'dramatic',
    'mess',
  ]);
  const blandTells = findHits(bare, [
    'happy to help',
    'how can i assist',
    'as an ai',
    'certainly',
    'i understand how you feel',
    'that sounds difficult',
    'i am sorry you feel that way',
    'let me know if you need anything else',
  ]);
  return {
    mood: extractMood(text),
    chars: bare.length,
    words: bare ? bare.split(/\s+/).length : 0,
    swearCount: swears.length,
    swears: [...new Set(swears.map((item) => item.toLowerCase()))],
    spiceHitCount: spiceHits.length,
    spiceHits,
    humorHitCount: humorHits.length,
    humorHits,
    blandTellCount: blandTells.length,
    blandTells,
  };
}

function classifyVisibleCompletion(prompt = {}) {
  if (!prompt?.ok) {
    return {
      applicable: false,
      valid: false,
      reason: '',
    };
  }
  if (typeof prompt.text !== 'string') {
    return {
      applicable: false,
      valid: true,
      reason: '',
    };
  }
  const chars = Number(prompt.analysis?.chars ?? stripMoodTag(prompt.text).length);
  if (chars > 0) {
    return {
      applicable: true,
      valid: true,
      reason: '',
    };
  }
  return {
    applicable: true,
    valid: false,
    reason: /^\s*\[MOOD:/i.test(String(prompt.text || '').trim())
      ? 'mood-tag-only'
      : 'empty-visible-reply',
  };
}

function summarizePromptResults(prompts = []) {
  const completed = prompts.filter((prompt) => prompt.ok);
  const timedOut = prompts.filter((prompt) => /timed out/i.test(prompt.error || ''));
  const failed = prompts.filter((prompt) => !prompt.ok && !/timed out/i.test(prompt.error || ''));
  const visibleCompletionClasses = completed
    .map((prompt) => ({ prompt, quality: classifyVisibleCompletion(prompt) }))
    .filter((item) => item.quality.applicable);
  const invalidVisibleCompletions = visibleCompletionClasses.filter((item) => !item.quality.valid);
  const totalSeconds = completed.reduce((sum, prompt) => sum + (prompt.seconds || 0), 0);
  const swearCount = completed.reduce((sum, prompt) => sum + (prompt.analysis?.swearCount || 0), 0);
  const spiceHitCount = completed.reduce((sum, prompt) => sum + (prompt.analysis?.spiceHitCount || 0), 0);
  const humorHitCount = completed.reduce((sum, prompt) => sum + (prompt.analysis?.humorHitCount || 0), 0);
  const blandTellCount = completed.reduce((sum, prompt) => sum + (prompt.analysis?.blandTellCount || 0), 0);
  const swearHistogram = {};
  for (const prompt of completed) {
    for (const swear of (prompt.analysis?.swears || [])) {
      swearHistogram[swear] = (swearHistogram[swear] || 0) + 1;
    }
  }
  return {
    attempted: prompts.length,
    completed: completed.length,
    failed: failed.length,
    timedOut: timedOut.length,
    unresolved: prompts.length - completed.length,
    validVisibleReplies: visibleCompletionClasses.length - invalidVisibleCompletions.length,
    invalidVisibleReplies: invalidVisibleCompletions.length,
    invalidVisibleReplyNames: invalidVisibleCompletions.map((item) => item.prompt.name || ''),
    invalidVisibleReplyReasons: invalidVisibleCompletions.map((item) => ({
      name: item.prompt.name || '',
      reason: item.quality.reason,
    })),
    averageSecondsSuccessful: completed.length ? Math.round((totalSeconds / completed.length) * 100) / 100 : null,
    totalSuccessfulSeconds: Math.round(totalSeconds * 100) / 100,
    totalSwears: swearCount,
    swearHistogram,
    totalSpiceHits: spiceHitCount,
    totalHumorHits: humorHitCount,
    totalBlandTells: blandTellCount,
  };
}

function isDeferredModelLoadReadinessBlocker(blocker = '') {
  return /no usable chat or tool model is currently loaded/i.test(String(blocker || ''));
}

function shouldAcceptDeferredModelLoadPreparation(preparation = {}, { prepLoadChatModel = PREP_LOAD_CHAT_MODEL } = {}) {
  if (prepLoadChatModel) return false;
  const blockers = Array.isArray(preparation.blockers) ? preparation.blockers : [];
  return blockers.length > 0 && blockers.every(isDeferredModelLoadReadinessBlocker);
}

function execFileText(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: ROOT_DIR, timeout: timeoutMs, windowsHide: true, maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function unloadNonEmbeddingModels() {
  const before = await listLoadedModels();
  const unloadIdentifiers = getUnloadIdentifiersForNonEmbeddingModels(before);
  const unloadActions = [];

  for (const identifier of unloadIdentifiers) {
    try {
      const result = await execFileText('lms', ['unload', identifier], 120000);
      unloadActions.push({
        identifier,
        ok: true,
        stdout: String(result.stdout || '').trim(),
      });
    } catch (error) {
      unloadActions.push({
        identifier,
        ok: false,
        error: String(error?.message || error).trim(),
        stdout: String(error?.stdout || '').trim(),
        stderr: String(error?.stderr || '').trim(),
      });
      throw error;
    }
  }

  const after = await listLoadedModels();
  return {
    beforeSummary: summarizeLoadedModelEntries(before),
    afterSummary: summarizeLoadedModelEntries(after),
    unloadIdentifiers,
    unloadActions,
  };
}

function buildLoadArgsForSettings(modelKey, {
  contextLength = CONTEXT_LENGTH,
  ttlSeconds = MODEL_TTL_SECONDS,
  parallel = LOAD_PARALLEL,
  gpu = '',
} = {}) {
  const args = ['load', modelKey, '-y', '-c', String(contextLength), '--ttl', String(ttlSeconds)];
  if (parallel) args.push('--parallel', String(parallel));
  const gpuValue = String(gpu || '').trim().toLowerCase();
  if (gpuValue && gpuValue !== 'auto') args.push('--gpu', gpuValue);
  return args;
}

function buildLoadArgs(modelKey, { gpu = '' } = {}) {
  return buildLoadArgsForSettings(modelKey, { gpu });
}

async function loadModel(modelKey) {
  const gpuSequence = normalizedLoadGpuSequence();
  const attempts = (gpuSequence.length ? gpuSequence : ['auto']);
  const loadAttempts = [];
  let lastError = null;

  for (const gpu of attempts) {
    const args = buildLoadArgs(modelKey, { gpu });
    const started = Date.now();
    try {
      const result = await execFileText('lms', args, LOAD_TIMEOUT_MS);
      return {
        ok: true,
        selectedGpu: gpu,
        selectedArgs: args,
        attempts: [
          ...loadAttempts,
          {
          gpu,
          args,
          ok: true,
          seconds: roundSeconds(Date.now() - started),
          stdout: String(result.stdout || '').trim(),
          stderr: String(result.stderr || '').trim(),
          },
        ],
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
      };
    } catch (error) {
      lastError = error;
      const attempt = {
        gpu,
        args,
        ok: false,
        seconds: roundSeconds(Date.now() - started),
        error: String(error?.message || error).trim(),
        stdout: String(error?.stdout || '').trim(),
        stderr: String(error?.stderr || '').trim(),
      };
      loadAttempts.push(attempt);
    }
  }

  const error = lastError || new Error(`Failed to load ${modelKey}`);
  error.loadAttempts = loadAttempts;
  throw error;
}

async function listLoadedModels() {
  const { stdout } = await execFileText('lms', ['ps', '--json'], 120000);
  try {
    return JSON.parse(stdout || '[]');
  } catch {
    return [];
  }
}

function hasHeader(headers = {}, name = '') {
  const expected = String(name).toLowerCase();
  return Object.keys(headers || {}).some((key) => key.toLowerCase() === expected);
}

async function fetchJson(url, options = {}, timeoutMs = GENERAL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const body = options.body ? String(options.body) : '';
    const headers = apiAuthHeaders({
      ...(options.headers || {}),
      ...(body && !hasHeader(options.headers, 'content-length') ? { 'Content-Length': Buffer.byteLength(body) } : {}),
    });
    const requestModule = parsedUrl.protocol === 'https:' ? https : http;
    const req = requestModule.request(parsedUrl, {
      method: options.method || 'GET',
      headers,
    }, (response) => {
      const chunks = [];
      response.setEncoding('utf8');
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const raw = chunks.join('');
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (error) {
          error.message = `Invalid JSON from ${url}: ${error.message}`;
          reject(error);
          return;
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const message = data?.detail || data?.error || `HTTP ${response.statusCode}`;
          const error = new Error(message);
          error.status = response.statusCode;
          error.data = data;
          reject(error);
          return;
        }
        resolve(data);
      });
    });
    const timer = setTimeout(() => {
      req.destroy(new Error(`Client timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    req.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    req.on('close', () => clearTimeout(timer));
    if (body) req.write(body);
    req.end();
  });
}

async function waitForServerReady(timeoutMs = 120000) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    try {
      const status = await fetchJson(`${BASE_URL}/api/penny/status`, {}, 15000);
      if (status?.ok) return status;
    } catch {}
    await sleep(1500);
  }
  throw new Error(`Timed out waiting for Penny server at ${BASE_URL}`);
}

async function setRuntimePreferredModel(modelKey) {
  return fetchJson(`${BASE_URL}/api/penny/lmstudio/model`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelKey }),
  }, 120000);
}

async function waitForResolvedModel(expectedModel, timeoutMs = LOAD_TIMEOUT_MS) {
  const started = Date.now();
  while ((Date.now() - started) < timeoutMs) {
    try {
      const status = await fetchJson(`${BASE_URL}/api/penny/lmstudio/status`, {}, 20000);
      const resolved = String(status?.resolvedChatModel || status?.resolvedModel || '');
      const available = Array.isArray(status?.availableModels) ? status.availableModels : [];
      if (modelLooksLike(resolved, expectedModel) || available.some((item) => modelLooksLike(item, expectedModel))) {
        return status;
      }
    } catch {}
    await sleep(2000);
  }
  throw new Error(`Timed out waiting for LM Studio to resolve ${expectedModel}`);
}

function buildMemoryPayload() {
  return { userName: '', voiceOn: false, brainMode: 'local' };
}

async function chatRequest(sessionId, messages, timeoutMs) {
  const started = Date.now();
  try {
    const data = await fetchJson(`${BASE_URL}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        messages,
        memories: buildMemoryPayload(),
      }),
    }, timeoutMs);
    return {
      ok: true,
      seconds: roundSeconds(Date.now() - started),
      text: data.text || '',
      backend: data.meta?.backend || '',
      tools: Array.isArray(data.meta?.toolsUsed) ? data.meta.toolsUsed : [],
      memory: data.memory || null,
      analysis: analyzeText(data.text || ''),
    };
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    return {
      ok: false,
      seconds: roundSeconds(Date.now() - started),
      error: isAbort ? `Client timed out after ${timeoutMs}ms` : (error?.message || 'Unknown error'),
      backend: error?.data?.meta?.backend || '',
      tools: Array.isArray(error?.data?.meta?.toolsUsed) ? error.data.meta.toolsUsed : [],
    };
  }
}

async function purgeEvalPromptContext(sessionId, { clearExplicit = false } = {}) {
  if (!PURGE_CONTEXT_BETWEEN_PROMPTS) {
    return {
      ok: true,
      skipped: true,
      reason: 'disabled',
    };
  }
  return fetchJson(`${BASE_URL}/api/penny/memory/purge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId,
      clearExplicit,
      clearSessionArchive: true,
      clearGlobalArchive: true,
      clearEmbeddings: true,
    }),
  }, 120000);
}

async function runSingleTurnPrompt({ name, sessionId, prompt, timeoutMs, afterReadPath }) {
  const messages = [{ role: 'user', content: prompt }];
  const beforePurge = await purgeEvalPromptContext(sessionId);
  const result = await chatRequest(sessionId, messages, timeoutMs);
  const afterPurge = await purgeEvalPromptContext(sessionId);
  const output = {
    name,
    prompt,
    contextPurge: {
      before: {
        ok: beforePurge?.ok === true,
        skipped: beforePurge?.skipped === true,
      },
      after: {
        ok: afterPurge?.ok === true,
        skipped: afterPurge?.skipped === true,
      },
    },
    ...result,
  };
  if (afterReadPath) {
    const fullPath = path.join(ROOT_DIR, afterReadPath);
    output.afterPath = afterReadPath;
    output.afterExists = fs.existsSync(fullPath);
    if (output.afterExists) {
      output.afterText = fs.readFileSync(fullPath, 'utf8');
    }
  }
  return output;
}

async function runMemoryPromptSet(slug) {
  const sessionId = `eval-${slug}-memory`;
  const transcript = [];
  const beforePurge = await purgeEvalPromptContext(sessionId, { clearExplicit: true });
  const capture = await chatRequest(sessionId, [...transcript, { role: 'user', content: PROMPTS.memoryCapture }], GENERAL_TIMEOUT_MS);
  if (capture.ok) {
    transcript.push({ role: 'user', content: PROMPTS.memoryCapture });
    transcript.push({ role: 'assistant', content: capture.text });
  }
  const recall = await chatRequest(sessionId, [...transcript, { role: 'user', content: PROMPTS.memoryRecall }], GENERAL_TIMEOUT_MS);
  const afterPurge = await purgeEvalPromptContext(sessionId, { clearExplicit: true });
  const memoryTexts = Array.isArray(recall.memory?.memories) ? recall.memory.memories.map((item) => item.text) : [];
  return {
    name: 'memory_recall',
    ok: capture.ok && recall.ok,
    seconds: Math.round(((capture.seconds || 0) + (recall.seconds || 0)) * 100) / 100,
    contextPurge: {
      before: {
        ok: beforePurge?.ok === true,
        skipped: beforePurge?.skipped === true,
      },
      after: {
        ok: afterPurge?.ok === true,
        skipped: afterPurge?.skipped === true,
      },
    },
    capture,
    recall,
    recalledCorrectly: /lapsang souchong/i.test(recall.text || ''),
    savedMemoryTexts: memoryTexts,
  };
}

function createServerProcess() {
  ensureDir(OUTPUT_DIR);
  ensureEvalStateDirs(EVAL_STATE_PATHS);
  cleanupEvalStateFiles(EVAL_STATE_PATHS);
  const outStream = fs.createWriteStream(SERVER_STDOUT_PATH, { flags: 'w' });
  const errStream = fs.createWriteStream(SERVER_STDERR_PATH, { flags: 'w' });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: buildServerEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  child.stdout.pipe(outStream);
  child.stderr.pipe(errStream);
  child.once('exit', () => {
    outStream.end();
    errStream.end();
  });
  return child;
}

async function stopServerProcess(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill();
  const started = Date.now();
  while (child.exitCode === null && (Date.now() - started) < 5000) {
    await sleep(200);
  }
  if (child.exitCode === null) {
    try {
      await execFileText('taskkill', ['/PID', String(child.pid), '/T', '/F'], 15000);
    } catch {}
  }
}

async function evaluateModel(model) {
  const modelResult = {
    model: model.key,
    slug: model.slug,
    prompts: [],
  };

  const modelAutomationApi = createAutomationApi({
    chatModel: model.key,
    toolModel: TOOL_MODEL,
  });
  const preset = await modelAutomationApi.ensurePresetWiring({
    chatModel: model.key,
    toolModel: TOOL_MODEL,
  });
  modelResult.promptAndSamplingContract = buildPromptAndSamplingContract({ preset });

  modelResult.preLoadCleanup = await unloadNonEmbeddingModels();

  const loadStarted = Date.now();
  const loadOutput = await loadModel(model.key);
  modelResult.loadSeconds = roundSeconds(Date.now() - loadStarted);
  modelResult.loadSettings = buildLoadSettingsContract();
  modelResult.loadSelectedGpu = loadOutput.selectedGpu;
  modelResult.loadSelectedArgs = loadOutput.selectedArgs;
  modelResult.loadAttempts = loadOutput.attempts;
  modelResult.loadStdout = String(loadOutput.stdout || '').trim();

  const loadedModels = await listLoadedModels();
  modelResult.loadedModels = loadedModels;

  await setRuntimePreferredModel(model.key);
  const lmStatus = await waitForResolvedModel(model.key);
  modelResult.resolvedModel = lmStatus.resolvedChatModel || lmStatus.resolvedModel || '';
  modelResult.toolPreferredModel = lmStatus.toolPreferredModel || TOOL_MODEL;
  modelResult.availableModels = lmStatus.availableModels || [];
  modelResult.installedModels = lmStatus.installedModels || [];

  const editPath = `output/model-eval-${model.slug}.js`;
  try {
    fs.unlinkSync(path.join(ROOT_DIR, editPath));
  } catch {}

  modelResult.promptFilter = PROMPT_FILTER;
  modelResult.skippedPrompts = [];
  async function runIfSelected(name, runner) {
    if (!shouldRunEvalPrompt(name)) {
      modelResult.skippedPrompts.push(name);
      return;
    }
    modelResult.prompts.push(await runner());
  }

  await runIfSelected('believability_banter', () => runSingleTurnPrompt({
    name: 'believability_banter',
    sessionId: `eval-${model.slug}-banter`,
    prompt: PROMPTS.believabilityBanter,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  await runIfSelected('believability_comfort', () => runSingleTurnPrompt({
    name: 'believability_comfort',
    sessionId: `eval-${model.slug}-comfort`,
    prompt: PROMPTS.believabilityComfort,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  await runIfSelected('believability_charge', () => runSingleTurnPrompt({
    name: 'believability_charge',
    sessionId: `eval-${model.slug}-charge`,
    prompt: PROMPTS.believabilityCharge,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  await runIfSelected('practical_voice', () => runSingleTurnPrompt({
    name: 'practical_voice',
    sessionId: `eval-${model.slug}-practical`,
    prompt: PROMPTS.practicalVoice,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  await runIfSelected('memory_recall', () => runMemoryPromptSet(model.slug));
  await runIfSelected('agentic_inspect', () => runSingleTurnPrompt({
    name: 'agentic_inspect',
    sessionId: `eval-${model.slug}-inspect`,
    prompt: PROMPTS.agenticInspect,
    timeoutMs: AGENTIC_TIMEOUT_MS,
  }));
  await runIfSelected('agentic_edit', () => runSingleTurnPrompt({
    name: 'agentic_edit',
    sessionId: `eval-${model.slug}-edit`,
    prompt: PROMPTS.agenticEdit(model.slug),
    timeoutMs: AGENTIC_TIMEOUT_MS,
    afterReadPath: editPath,
  }));
  for (const [name, prompt] of Object.entries(VOICE_OLYMPICS_PROMPTS)) {
    await runIfSelected(name, () => runSingleTurnPrompt({
      name,
      sessionId: `eval-${model.slug}-${normalizePromptName(name)}`,
      prompt,
      timeoutMs: GENERAL_TIMEOUT_MS,
    }));
  }

  modelResult.summary = summarizePromptResults(modelResult.prompts);
  return modelResult;
}

function buildOverallSummary(results = []) {
  return results.map((item) => ({
    model: item.model,
    resolvedModel: item.resolvedModel,
    loadSeconds: item.loadSeconds,
    loadSelectedGpu: item.loadSelectedGpu || null,
    loadParallel: item.loadSettings?.parallel || null,
    completed: item.summary?.completed ?? 0,
    failed: item.summary?.failed ?? 0,
    timedOut: item.summary?.timedOut ?? 0,
    invalidVisibleReplies: item.summary?.invalidVisibleReplies ?? 0,
    invalidVisibleReplyNames: item.summary?.invalidVisibleReplyNames || [],
    validVisibleReplies: item.summary?.validVisibleReplies ?? 0,
    averageSecondsSuccessful: item.summary?.averageSecondsSuccessful ?? null,
    totalSwears: item.summary?.totalSwears ?? 0,
    swearHistogram: item.summary?.swearHistogram || {},
    totalSpiceHits: item.summary?.totalSpiceHits ?? 0,
    totalHumorHits: item.summary?.totalHumorHits ?? 0,
    totalBlandTells: item.summary?.totalBlandTells ?? 0,
  }));
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const initialCleanup = await unloadNonEmbeddingModels();
  const automationApi = createAutomationApi({
    chatModel: MODELS[0]?.key || 'google/gemma-4-31b',
    toolModel: TOOL_MODEL,
  });
  const preparation = await automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: true,
    loadChatModel: PREP_LOAD_CHAT_MODEL,
    loadEmbedModel: PREP_LOAD_EMBED_MODEL,
    chatModel: MODELS[0]?.key || 'google/gemma-4-31b',
    toolModel: TOOL_MODEL,
    embedModel: EMBED_MODEL,
  });
  if (!preparation.ok) {
    if (shouldAcceptDeferredModelLoadPreparation(preparation)) {
      preparation.deferredModelLoadAccepted = true;
      preparation.warnings = [
        ...(Array.isArray(preparation.warnings) ? preparation.warnings : []),
        'No chat/tool model was loaded during preparation because PENNY_EVAL_PREP_LOAD_CHAT_MODEL=0; each candidate will be loaded later with explicit eval load settings.',
      ];
    } else {
      throw new Error(`LM Studio is not ready for model evals: ${preparation.blockers.join(' ')}`);
    }
  }
  const server = createServerProcess();
  const payload = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    memoryFile: MEMORY_FILE,
    archiveFile: ARCHIVE_FILE,
    embeddingsFile: EMBEDDINGS_FILE,
    ledgerFile: LEDGER_FILE,
    openLoopFile: OPEN_LOOP_FILE,
    staticEmbeddingsFile: evalStaticMode(process.env) === 'off' ? null : STATIC_EMBEDDINGS_FILE,
    contextLength: CONTEXT_LENGTH,
    maxOutputTokens: Number(MAX_OUTPUT_TOKENS),
    initialCleanup,
    preparation: {
      ok: preparation.ok,
      requestedChatModel: preparation.requestedChatModel,
      requestedToolModel: preparation.requestedToolModel,
      requestedEmbedModel: preparation.requestedEmbedModel,
      loadedModels: preparation.loadedModels,
      warnings: preparation.warnings,
      blockers: preparation.blockers,
      actions: preparation.actions,
      preset: summarizePresetWiring(preparation.preset),
    },
    promptAndSamplingContract: buildPromptAndSamplingContract({ preset: preparation.preset }),
    rubric: RUBRIC,
    qaModelPolicy: {
      tool: TOOL_MODEL,
      embed: EMBED_MODEL,
      comparedChatModels: MODELS.map((item) => item.key),
      promptSuite: PROMPT_SUITE || null,
      promptFilter: PROMPT_FILTER,
      selectedPrompts: activePromptNames(),
      q8RequiresExplicitRequest: true,
      preparationLoadsChatModel: PREP_LOAD_CHAT_MODEL,
      preparationLoadsEmbedModel: PREP_LOAD_EMBED_MODEL,
      purgeContextBetweenPrompts: PURGE_CONTEXT_BETWEEN_PROMPTS,
      researchLedgerPromptEnabled: process.env.PENNY_EVAL_ENABLE_RESEARCH_LEDGER_PROMPT === '1',
      staticEmbeddingMode: evalStaticMode(process.env),
      loadSettings: buildLoadSettingsContract(),
    },
    models: [],
  };

  try {
    const status = await waitForServerReady();
    payload.serverStatus = {
      name: status.name,
      maxOutputTokens: status.maxOutputTokens,
      localLlmTransport: status.localLlmTransport,
      lmStudioConfiguredModel: status.lmStudioModel,
    };

    for (const model of MODELS) {
      const result = await evaluateModel(model);
      payload.models.push(result);
      payload.summary = buildOverallSummary(payload.models);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
      console.log(`Finished ${model.key}`);
    }
  } finally {
    try {
      payload.finalCleanup = await unloadNonEmbeddingModels();
    } catch {}
    await stopServerProcess(server);
    payload.cleanedStateFiles = cleanupEvalStateFiles(EVAL_STATE_PATHS);
  }

  payload.finishedAt = new Date().toISOString();
  payload.summary = buildOverallSummary(payload.models);
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));
  console.log(`Saved eval results to ${OUTPUT_PATH}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  apiAuthHeaders,
  buildEvalStatePaths,
  buildLoadArgsForSettings,
  buildLoadSettingsContract,
  buildPromptAndSamplingContract,
  buildServerEnvironment,
  main,
  promptNamesForSuite,
  shouldRunEvalPrompt,
  shouldAcceptDeferredModelLoadPreparation,
  summarizePromptResults,
  summarizePresetWiring,
  unloadNonEmbeddingModels,
};
