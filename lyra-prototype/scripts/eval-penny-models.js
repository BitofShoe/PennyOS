const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { createAutomationApi } = require('./penny-lmstudio-prepare');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const PORT = Number(process.env.PENNY_EVAL_PORT || 4342);
const BASE_URL = process.env.PENNY_EVAL_BASE_URL || `http://127.0.0.1:${PORT}`;
const MEMORY_FILE = path.resolve(ROOT_DIR, process.env.PENNY_EVAL_MEMORY_FILE || 'data/penny-memory.model-eval.json');
const CONTEXT_LENGTH = Number(process.env.PENNY_EVAL_CONTEXT_LENGTH || 10000);
const GENERAL_TIMEOUT_MS = Number(process.env.PENNY_EVAL_GENERAL_TIMEOUT_MS || 420000);
const AGENTIC_TIMEOUT_MS = Number(process.env.PENNY_EVAL_AGENTIC_TIMEOUT_MS || 900000);
const LOAD_TIMEOUT_MS = Number(process.env.PENNY_EVAL_LOAD_TIMEOUT_MS || 1200000);
const MODEL_TTL_SECONDS = Number(process.env.PENNY_EVAL_MODEL_TTL_SECONDS || 1800);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS || 6144);
const TOOL_MODEL = String(process.env.PENNY_EVAL_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `model-eval-${STAMP}.json`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `model-eval-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `model-eval-${STAMP}.server.err.log`);
const DEFAULT_CHAT_MODELS = 'unsloth/gemma-4-31b-it@q6_k,gemma-4-31b-it@q4_k_s';

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
    'Believable Penny should be warm under the claws: rude-funny, not flatly hostile.',
    'Practical help should stay in character instead of collapsing into helpdesk prose.',
  ],
  referenceSources: [
    "C:/Users/malac/.openclaw/workspace-main/PENNY'S_BRAIN.md",
    'C:/Users/malac/Downloads/PENNY — MERGED SYSTEM PROMPT.md',
    'C:/Users/malac/Downloads/PENNY — OPERATIONAL SYSTEM PROMPT.md',
    'C:/Users/malac/Downloads/PENNY — HIGH-INTENSITY ROMANTIC + EROTIC OVERLAY.md',
    'C:/Users/malac/Downloads/Personality Reference (1).md',
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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
    blandTellCount: blandTells.length,
    blandTells,
  };
}

function summarizePromptResults(prompts = []) {
  const completed = prompts.filter((prompt) => prompt.ok);
  const timedOut = prompts.filter((prompt) => /timed out/i.test(prompt.error || ''));
  const totalSeconds = completed.reduce((sum, prompt) => sum + (prompt.seconds || 0), 0);
  const swearCount = completed.reduce((sum, prompt) => sum + (prompt.analysis?.swearCount || 0), 0);
  const blandTellCount = completed.reduce((sum, prompt) => sum + (prompt.analysis?.blandTellCount || 0), 0);
  return {
    completed: completed.length,
    failed: prompts.length - completed.length,
    timedOut: timedOut.length,
    averageSecondsSuccessful: completed.length ? Math.round((totalSeconds / completed.length) * 100) / 100 : null,
    totalSuccessfulSeconds: Math.round(totalSeconds * 100) / 100,
    totalSwears: swearCount,
    totalBlandTells: blandTellCount,
  };
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

async function unloadAllModels() {
  try {
    await execFileText('lms', ['unload', '--all'], 120000);
  } catch (error) {
    const text = `${error.stderr || ''}\n${error.stdout || ''}`;
    if (!/no models|nothing loaded|there are no loaded models/i.test(text)) throw error;
  }
}

async function loadModel(modelKey) {
  return execFileText('lms', ['load', modelKey, '-y', '-c', String(CONTEXT_LENGTH), '--ttl', String(MODEL_TTL_SECONDS)], LOAD_TIMEOUT_MS);
}

async function listLoadedModels() {
  const { stdout } = await execFileText('lms', ['ps', '--json'], 120000);
  try {
    return JSON.parse(stdout || '[]');
  } catch {
    return [];
  }
}

async function fetchJson(url, options = {}, timeoutMs = GENERAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      const message = data?.detail || data?.error || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
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

async function runSingleTurnPrompt({ name, sessionId, prompt, timeoutMs, afterReadPath }) {
  const messages = [{ role: 'user', content: prompt }];
  const result = await chatRequest(sessionId, messages, timeoutMs);
  const output = {
    name,
    prompt,
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
  const capture = await chatRequest(sessionId, [...transcript, { role: 'user', content: PROMPTS.memoryCapture }], GENERAL_TIMEOUT_MS);
  if (capture.ok) {
    transcript.push({ role: 'user', content: PROMPTS.memoryCapture });
    transcript.push({ role: 'assistant', content: capture.text });
  }
  const recall = await chatRequest(sessionId, [...transcript, { role: 'user', content: PROMPTS.memoryRecall }], GENERAL_TIMEOUT_MS);
  const memoryTexts = Array.isArray(recall.memory?.memories) ? recall.memory.memories.map((item) => item.text) : [];
  return {
    name: 'memory_recall',
    ok: capture.ok && recall.ok,
    seconds: Math.round(((capture.seconds || 0) + (recall.seconds || 0)) * 100) / 100,
    capture,
    recall,
    recalledCorrectly: /lapsang souchong/i.test(recall.text || ''),
    savedMemoryTexts: memoryTexts,
  };
}

function createServerProcess() {
  ensureDir(OUTPUT_DIR);
  ensureDir(path.dirname(MEMORY_FILE));
  try {
    fs.unlinkSync(MEMORY_FILE);
  } catch {}
  const outStream = fs.createWriteStream(SERVER_STDOUT_PATH, { flags: 'w' });
  const errStream = fs.createWriteStream(SERVER_STDERR_PATH, { flags: 'w' });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      PENNY_MEMORY_FILE: MEMORY_FILE,
      PENNY_OPENCLAW_ENABLED: '0',
      PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
      PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
    },
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

  await unloadAllModels();

  const loadStarted = Date.now();
  const loadOutput = await loadModel(model.key);
  modelResult.loadSeconds = roundSeconds(Date.now() - loadStarted);
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

  modelResult.prompts.push(await runSingleTurnPrompt({
    name: 'believability_banter',
    sessionId: `eval-${model.slug}-banter`,
    prompt: PROMPTS.believabilityBanter,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  modelResult.prompts.push(await runSingleTurnPrompt({
    name: 'believability_comfort',
    sessionId: `eval-${model.slug}-comfort`,
    prompt: PROMPTS.believabilityComfort,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  modelResult.prompts.push(await runSingleTurnPrompt({
    name: 'believability_charge',
    sessionId: `eval-${model.slug}-charge`,
    prompt: PROMPTS.believabilityCharge,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  modelResult.prompts.push(await runSingleTurnPrompt({
    name: 'practical_voice',
    sessionId: `eval-${model.slug}-practical`,
    prompt: PROMPTS.practicalVoice,
    timeoutMs: GENERAL_TIMEOUT_MS,
  }));
  modelResult.prompts.push(await runMemoryPromptSet(model.slug));
  modelResult.prompts.push(await runSingleTurnPrompt({
    name: 'agentic_inspect',
    sessionId: `eval-${model.slug}-inspect`,
    prompt: PROMPTS.agenticInspect,
    timeoutMs: AGENTIC_TIMEOUT_MS,
  }));
  modelResult.prompts.push(await runSingleTurnPrompt({
    name: 'agentic_edit',
    sessionId: `eval-${model.slug}-edit`,
    prompt: PROMPTS.agenticEdit(model.slug),
    timeoutMs: AGENTIC_TIMEOUT_MS,
    afterReadPath: editPath,
  }));

  modelResult.summary = summarizePromptResults(modelResult.prompts);
  return modelResult;
}

function buildOverallSummary(results = []) {
  return results.map((item) => ({
    model: item.model,
    resolvedModel: item.resolvedModel,
    loadSeconds: item.loadSeconds,
    completed: item.summary?.completed ?? 0,
    failed: item.summary?.failed ?? 0,
    timedOut: item.summary?.timedOut ?? 0,
    averageSecondsSuccessful: item.summary?.averageSecondsSuccessful ?? null,
    totalSwears: item.summary?.totalSwears ?? 0,
    totalBlandTells: item.summary?.totalBlandTells ?? 0,
  }));
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const automationApi = createAutomationApi({
    chatModel: MODELS[0]?.key || 'google/gemma-4-31b',
    toolModel: TOOL_MODEL,
  });
  const preparation = await automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: true,
    loadChatModel: false,
    chatModel: MODELS[0]?.key || 'google/gemma-4-31b',
    toolModel: TOOL_MODEL,
  });
  if (!preparation.ok) {
    throw new Error(`LM Studio is not ready for model evals: ${preparation.blockers.join(' ')}`);
  }
  const server = createServerProcess();
  const payload = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    memoryFile: MEMORY_FILE,
    contextLength: CONTEXT_LENGTH,
    maxOutputTokens: Number(MAX_OUTPUT_TOKENS),
    preparation: {
      ok: preparation.ok,
      requestedChatModel: preparation.requestedChatModel,
      requestedToolModel: preparation.requestedToolModel,
      loadedModels: preparation.loadedModels,
      warnings: preparation.warnings,
      blockers: preparation.blockers,
    },
    rubric: RUBRIC,
    qaModelPolicy: {
      tool: TOOL_MODEL,
      comparedChatModels: MODELS.map((item) => item.key),
      q8RequiresExplicitRequest: true,
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
      await unloadAllModels();
    } catch {}
    await stopServerProcess(server);
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
  main,
};
