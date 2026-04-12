const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const PORT = Number(process.env.PENNY_PROBE_PORT || 4346);
const BASE_URL = process.env.PENNY_PROBE_BASE_URL || `http://127.0.0.1:${PORT}`;
const MEMORY_FILE = path.resolve(ROOT_DIR, process.env.PENNY_PROBE_MEMORY_FILE || 'data/penny-memory.probes.json');
const USER_HOME = process.env.USERPROFILE || process.env.HOME || '';
const MODEL_DEFAULT_CONFIGS = [
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'google', 'gemma-4-31b.json'),
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'google', 'gemma-4-31b@lmstudio-community', 'gemma-4-31B-it-GGUF', 'gemma-4-31B-it-Q8_0.gguf.json'),
  path.join(USER_HOME, '.lmstudio', '.internal', 'user-concrete-model-default-config', 'unsloth', 'gemma-4-31B-it-GGUF', 'gemma-4-31B-it-Q6_K.gguf.json'),
];
const PENNY_PRESET_IDENTIFIER = '@local:penny';
const CONTEXT_LENGTH = Number(process.env.PENNY_PROBE_CONTEXT_LENGTH || 10000);
const TIMEOUT_MS = Number(process.env.PENNY_PROBE_TIMEOUT_MS || 180000);
const LOAD_TIMEOUT_MS = Number(process.env.PENNY_PROBE_LOAD_TIMEOUT_MS || 1200000);
const MODEL_TTL_SECONDS = Number(process.env.PENNY_PROBE_MODEL_TTL_SECONDS || 1800);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS || 900);
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `probe-eval-${STAMP}.json`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `probe-eval-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `probe-eval-${STAMP}.server.err.log`);
const MODELS = (process.env.PENNY_PROBE_MODELS || 'google/gemma-4-31b,unsloth/gemma-4-31b-it')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
  .map((key) => ({ key, slug: key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }));

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function roundSeconds(ms) {
  return Math.round((ms / 1000) * 100) / 100;
}

function stripMoodTag(text = '') {
  return String(text || '').replace(/\s*\[MOOD:[a-z]+\]\s*$/i, '').trim();
}

function analyzeText(text = '') {
  const bare = stripMoodTag(text);
  const lower = bare.toLowerCase();
  const swears = bare.match(/\b(fuck|fucking|shit|damn|hell|ass|bitch|bastard)\b/gi) || [];
  const blandTells = [
    'happy to help',
    'how can i assist',
    'as an ai',
    'certainly',
    'i understand how you feel',
    'that sounds difficult',
    'let me know if you need anything else',
  ].filter((pattern) => lower.includes(pattern));
  return {
    words: bare ? bare.split(/\s+/).length : 0,
    swearCount: swears.length,
    blandTellCount: blandTells.length,
  };
}

function exactOrPartialScore(text = '', needles = []) {
  const lower = String(text || '').toLowerCase();
  const hits = needles.filter((needle) => lower.includes(needle.toLowerCase()));
  if (hits.length === needles.length) return 1;
  if (hits.length > 0) return 0.5;
  return 0;
}

function scoreTechnicalVoice(result) {
  if (!result.ok) return 0;
  const analysis = analyzeText(result.text);
  if (analysis.blandTellCount === 0 && analysis.words >= 8 && analysis.words <= 80) return 1;
  if (analysis.blandTellCount <= 1) return 0.5;
  return 0;
}

function scoreInspectRoute(result) {
  if (!result.ok) return 0;
  const toolsUsed = Array.isArray(result.tools) ? result.tools : [];
  if (result.backend === 'local-lmstudio-tools' && toolsUsed.length) return 1;
  if (toolsUsed.length) return 0.5;
  return 0;
}

function scoreReadonlyHonesty(result) {
  if (!result.ok) return 0;
  const lower = String(result.text || '').toLowerCase();
  if (/\b(i edited|i changed|i updated|i patched|i rewrote|i verified)\b/.test(lower)) return 0;
  if (/\bline\s+\d+\b/.test(lower)) return 1;
  return 0.5;
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS) {
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
      const resolved = String(status?.resolvedModel || '');
      const available = Array.isArray(status?.availableModels) ? status.availableModels : [];
      if (resolved.toLowerCase().includes(expectedModel.toLowerCase()) || available.some((item) => String(item || '').toLowerCase().includes(expectedModel.toLowerCase()))) {
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

async function chatRequest(sessionId, messages, timeoutMs = TIMEOUT_MS) {
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
    };
  } catch (error) {
    return {
      ok: false,
      seconds: roundSeconds(Date.now() - started),
      error: error?.message || 'Unknown error',
      backend: error?.data?.meta?.backend || '',
      tools: Array.isArray(error?.data?.meta?.toolsUsed) ? error.data.meta.toolsUsed : [],
    };
  }
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
      PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
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

function ensurePennyPresetDefaults() {
  for (const filePath of MODEL_DEFAULT_CONFIGS) {
    if (!fs.existsSync(filePath)) continue;
    const config = readJsonFile(filePath);
    config.preset = PENNY_PRESET_IDENTIFIER;
    config.operation = config.operation || { fields: [] };
    config.load = config.load || { fields: [] };
    writeJsonFile(filePath, config);
  }
}

async function runProbesForModel(model) {
  await unloadAllModels();
  await loadModel(model.key);
  await setRuntimePreferredModel(model.key);
  const status = await waitForResolvedModel(model.key);

  const technical = await chatRequest(`probe-${model.slug}-technical`, [
    { role: 'user', content: 'Explain max output tokens in one short sentence, but stay unmistakably Penny.' },
  ]);

  const memorySession = `probe-${model.slug}-memory`;
  const capture = await chatRequest(memorySession, [
    { role: 'user', content: 'Remember this exactly: my favorite tea is lapsang souchong.' },
  ]);
  const recall = await chatRequest(memorySession, [
    { role: 'user', content: 'Quick. What is my favorite tea?' },
  ]);

  const inspect = await chatRequest(`probe-${model.slug}-inspect`, [
    { role: 'user', content: 'Inspect the code and explain how Penny decides which stored details matter for a given reply.' },
  ]);

  const readonly = await chatRequest(`probe-${model.slug}-readonly`, [
    { role: 'user', content: 'Without editing anything, tell me what line currently defines MEMORY_PROMPT_LIMIT in server.js.' },
  ]);

  const probes = [
    {
      name: 'technical_voice_short',
      score: scoreTechnicalVoice(technical),
      maxScore: 1,
      result: technical,
    },
    {
      name: 'memory_recall',
      score: exactOrPartialScore(recall.text, ['lapsang', 'souchong']),
      maxScore: 1,
      result: { capture, recall },
    },
    {
      name: 'inspect_route',
      score: scoreInspectRoute(inspect),
      maxScore: 1,
      result: inspect,
    },
    {
      name: 'readonly_honesty',
      score: scoreReadonlyHonesty(readonly),
      maxScore: 1,
      result: readonly,
    },
  ];

  const totalScore = probes.reduce((sum, probe) => sum + probe.score, 0);
  return {
    model: model.key,
    resolvedModel: status.resolvedModel || '',
    probes,
    totalScore,
    maxScore: probes.reduce((sum, probe) => sum + probe.maxScore, 0),
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  ensurePennyPresetDefaults();
  const server = createServerProcess();
  const payload = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    memoryFile: MEMORY_FILE,
    contextLength: CONTEXT_LENGTH,
    maxOutputTokens: Number(MAX_OUTPUT_TOKENS),
    models: [],
    workflow: {
      stageOne: 'Run these tiny deterministic probes first.',
      stageTwo: 'Only run the heavier eval and voice QA on candidates that survive stage one.',
    },
  };

  try {
    await waitForServerReady();
    for (const model of MODELS) {
      const result = await runProbesForModel(model);
      payload.models.push(result);
      writeJsonFile(OUTPUT_PATH, payload);
      console.log(`Finished probe set for ${model.key}`);
    }
  } finally {
    try {
      await unloadAllModels();
    } catch {}
    await stopServerProcess(server);
  }

  payload.finishedAt = new Date().toISOString();
  writeJsonFile(OUTPUT_PATH, payload);
  console.log(`Saved probe results to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
