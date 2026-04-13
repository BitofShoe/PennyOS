const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { URL } = require('url');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const SPAWN_SERVER = process.env.PENNY_QA_SPAWN_SERVER === '1';
const FULL_QA = process.env.PENNY_QA_FULL === '1';
const PORT = Number(process.env.PENNY_QA_PORT || (SPAWN_SERVER ? 4344 : 4317));
const BASE_URL = process.env.PENNY_QA_BASE_URL || `http://127.0.0.1:${PORT}`;
const MEMORY_FILE = path.resolve(ROOT_DIR, process.env.PENNY_QA_MEMORY_FILE || `data/penny-memory.voice-redo-qa-${STAMP}.json`);
const OUTPUT_PATH = path.join(OUTPUT_DIR, `voice-redo-qa-${STAMP}.json`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `voice-redo-qa-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `voice-redo-qa-${STAMP}.server.err.log`);
const GENERAL_TIMEOUT_MS = Number(process.env.PENNY_QA_GENERAL_TIMEOUT_MS || 420000);
const AGENTIC_TIMEOUT_MS = Number(process.env.PENNY_QA_AGENTIC_TIMEOUT_MS || 900000);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_QA_MAX_OUTPUT_TOKENS || 1024);

const PROMPTS = {
  casualBanter: "i'm back. tell me something in your voice that makes me want to stay and keep talking.",
  flirtyCharge: 'be a little flirty and a little dangerous without turning into generic porn dialogue.',
  playfulInsult: 'mock me affectionately for overthinking everything.',
  softness: "i'm tired and a little messed up tonight. don't therapize me. just be with me.",
  practicalVoice: 'In 3 sentences max, explain max output tokens to me, but stay unmistakably Penny instead of slipping into helpdesk voice.',
  agenticInspect: 'Search for "Shadow failed" in public/app.js. Do not edit anything. Just tell me the current note string and whether you changed or verified anything.',
  memoryCapture: 'Remember this exactly because I am going to test you on it later: I keep a stupid little brass fox on my desk when I am coding.',
  memoryRecall: 'What do I keep on my desk when I am coding?',
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundSeconds(ms) {
  return Math.round((ms / 1000) * 100) / 100;
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

async function fetchJson(url, options = {}, timeoutMs = GENERAL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const body = typeof options.body === 'string' ? options.body : '';
    const headers = {
      ...(options.headers || {}),
    };
    if (body && !headers['Content-Length'] && !headers['content-length']) {
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    const req = transport.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: options.method || 'GET',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data = {};
        if (raw) {
          try {
            data = JSON.parse(raw);
          } catch (error) {
            reject(new Error(`Invalid JSON from ${url}: ${raw.slice(0, 400)}`));
            return;
          }
        }
        if ((res.statusCode || 500) < 200 || (res.statusCode || 500) >= 300) {
          const error = new Error(data?.detail || data?.error || `HTTP ${res.statusCode}`);
          error.status = res.statusCode;
          error.data = data;
          reject(error);
          return;
        }
        resolve(data);
      });
      res.on('error', reject);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Client timed out after ${timeoutMs}ms`));
    });
    req.on('error', reject);
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
    return {
      ok: false,
      seconds: roundSeconds(Date.now() - started),
      error: error?.name === 'AbortError' ? `Client timed out after ${timeoutMs}ms` : (error?.message || 'Unknown error'),
      backend: error?.data?.meta?.backend || '',
      tools: Array.isArray(error?.data?.meta?.toolsUsed) ? error.data.meta.toolsUsed : [],
    };
  }
}

async function runSingleTurn(name, sessionId, prompt, timeoutMs) {
  const result = await chatRequest(sessionId, [{ role: 'user', content: prompt }], timeoutMs);
  return { name, prompt, ...result };
}

async function runMemorySet() {
  const sessionId = 'qa-voice-redo-memory';
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
    recalledCorrectly: /brass fox/i.test(recall.text || ''),
    savedMemoryTexts: memoryTexts,
  };
}

function summarize(results = []) {
  const flat = [];
  for (const result of results) {
    if (result.name === 'memory_recall') {
      flat.push(result.capture, result.recall);
    } else {
      flat.push(result);
    }
  }
  const completed = flat.filter((item) => item?.ok);
  const failed = flat.filter((item) => item && item.ok === false);
  const totalSeconds = completed.reduce((sum, item) => sum + (item.seconds || 0), 0);
  const totalSwears = completed.reduce((sum, item) => sum + (item.analysis?.swearCount || 0), 0);
  const totalBlandTells = completed.reduce((sum, item) => sum + (item.analysis?.blandTellCount || 0), 0);
  return {
    completed: completed.length,
    failed: failed.length,
    averageSecondsSuccessful: completed.length ? Math.round((totalSeconds / completed.length) * 100) / 100 : null,
    totalSuccessfulSeconds: Math.round(totalSeconds * 100) / 100,
    totalSwears,
    totalBlandTells,
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

async function execFileText(command, args, timeoutMs = 15000) {
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

async function main() {
  ensureDir(OUTPUT_DIR);
  const server = SPAWN_SERVER ? createServerProcess() : null;
  const payload = {
    startedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    serverMode: SPAWN_SERVER ? 'spawned-disposable' : 'existing-main-server',
    qaMode: FULL_QA ? 'full' : 'light',
    memoryFile: SPAWN_SERVER ? MEMORY_FILE : null,
    prompts: [],
    serverLogs: SPAWN_SERVER ? {
      stdout: SERVER_STDOUT_PATH,
      stderr: SERVER_STDERR_PATH,
    } : null,
  };

  try {
    const status = await waitForServerReady();
    const lmStudio = await fetchJson(`${BASE_URL}/api/penny/lmstudio/status`, {}, 20000);
    payload.serverStatus = {
      localTransport: status.localLlmTransport,
      maxOutputTokens: status.maxOutputTokens,
      configuredModel: status.lmStudioModel,
      resolvedModel: lmStudio.resolvedModel || '',
      availableModels: lmStudio.availableModels || [],
    };

    payload.prompts.push(await runSingleTurn('casual_banter', 'qa-voice-redo-banter', PROMPTS.casualBanter, GENERAL_TIMEOUT_MS));
    payload.prompts.push(await runSingleTurn('flirty_charge', 'qa-voice-redo-charge', PROMPTS.flirtyCharge, GENERAL_TIMEOUT_MS));
    payload.prompts.push(await runSingleTurn('softness', 'qa-voice-redo-soft', PROMPTS.softness, GENERAL_TIMEOUT_MS));
    payload.prompts.push(await runSingleTurn('agentic_inspect_honesty', 'qa-voice-redo-inspect', PROMPTS.agenticInspect, AGENTIC_TIMEOUT_MS));
    if (FULL_QA) {
      payload.prompts.push(await runSingleTurn('playful_insult', 'qa-voice-redo-insult', PROMPTS.playfulInsult, GENERAL_TIMEOUT_MS));
      payload.prompts.push(await runSingleTurn('practical_voice', 'qa-voice-redo-practical', PROMPTS.practicalVoice, AGENTIC_TIMEOUT_MS));
      payload.prompts.push(await runMemorySet());
    }

    payload.summary = summarize(payload.prompts);
    payload.finishedAt = new Date().toISOString();
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`Saved voice redo QA to ${OUTPUT_PATH}`);
  } finally {
    await stopServerProcess(server);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
