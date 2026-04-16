const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output', 'playwright');
const PW_DIR = path.join(ROOT_DIR, '.qa-pw');
const PW_PKG = path.join(PW_DIR, 'package.json');
const PW_READY = path.join(PW_DIR, 'node_modules', 'playwright', 'package.json');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const PORT = Number(process.env.PENNY_BROWSER_SMOKE_PORT || 4364);
const BASE_URL = process.env.PENNY_BROWSER_SMOKE_BASE_URL || `http://127.0.0.1:${PORT}`;
const OUTPUT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.json`);
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.png`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.server.err.log`);
const STORAGE_KEY = 'penny:v3';
const SESSION_ID = `penny-browser-smoke-${Date.now().toString(36)}`;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundSeconds(ms) {
  return Math.round((Number(ms || 0) / 1000) * 100) / 100;
}

function ensurePlaywright() {
  if (fs.existsSync(PW_READY)) return;
  ensureDir(PW_DIR);
  if (!fs.existsSync(PW_PKG)) {
    fs.writeFileSync(PW_PKG, `${JSON.stringify({
      name: 'qa-pw',
      private: true,
      dependencies: {
        playwright: '1.49.1',
      },
    }, null, 2)}\n`);
  }
  execSync('npm install --omit=dev', { cwd: PW_DIR, stdio: 'inherit' });
}

function loadPlaywright() {
  ensurePlaywright();
  return require(path.join(PW_DIR, 'node_modules', 'playwright'));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function buildMockLmStudioReply(payload = {}) {
  const raw = JSON.stringify(payload);
  if (/what keeps showing up|what do you notice/i.test(raw)) {
    return 'The midnight rain detail keeps showing up. [MOOD:thinking]';
  }
  return 'Mock Penny reply. [MOOD:thinking]';
}

function writeSseFrame(res, payload, event = '') {
  if (event) res.write(`event: ${event}\n`);
  const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const line of String(data).split('\n')) {
    res.write(`data: ${line}\n`);
  }
  res.write('\n');
}

async function streamMockChatCompletion(res, {
  model = 'unsloth/gemma-4-31b-it',
  reply = 'Mock Penny reply. [MOOD:thinking]',
} = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const pieces = String(reply || '')
    .split(/(\s+)/)
    .filter((piece) => piece);

  for (const piece of pieces) {
    writeSseFrame(res, {
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      created: 0,
      model,
      choices: [
        {
          index: 0,
          delta: { content: piece },
          finish_reason: null,
        },
      ],
    });
    await sleep(20);
  }

  writeSseFrame(res, {
    id: 'chatcmpl-mock',
    object: 'chat.completion.chunk',
    created: 0,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'stop',
      },
    ],
  });
  writeSseFrame(res, '[DONE]');
  res.end();
}

async function createMockLmStudioServer() {
  const stats = {
    modelsRequests: 0,
    embeddingsRequests: 0,
    chatRequests: 0,
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      stats.modelsRequests += 1;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: 'unsloth/gemma-4-31b-it', object: 'model', owned_by: 'local' },
          { id: 'google/gemma-4-e4b', object: 'model', owned_by: 'local' },
          { id: 'text-embedding-nomic-embed-text-v1.5', object: 'model', owned_by: 'local' },
        ],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/embeddings') {
      stats.embeddingsRequests += 1;
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        model: body.model || 'text-embedding-nomic-embed-text-v1.5',
        data: [{ object: 'embedding', index: 0, embedding: [0.11, 0.22, 0.33, 0.44] }],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      stats.chatRequests += 1;
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      const reply = buildMockLmStudioReply(body);
      if (body?.stream) {
        await streamMockChatCompletion(res, {
          model: body.model || 'unsloth/gemma-4-31b-it',
          reply,
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: 0,
        model: body.model || 'unsloth/gemma-4-31b-it',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: reply,
            },
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Unhandled mock LM Studio route: ${req.method} ${url.pathname}` }));
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    nativeBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    stats,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function createServerProcess(env = {}) {
  ensureDir(OUTPUT_DIR);
  const outStream = fs.createWriteStream(SERVER_STDOUT_PATH, { flags: 'w' });
  const errStream = fs.createWriteStream(SERVER_STDERR_PATH, { flags: 'w' });
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
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
}

async function fetchJson(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};
    if (!response.ok) {
      const error = new Error(data?.detail || data?.error || `HTTP ${response.status}`);
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

function buildSnapshot() {
  return {
    memory: {
      memories: [],
      userName: '',
      voiceOn: false,
      brainMode: 'local',
      lmStudioThread: null,
      sessionId: SESSION_ID,
    },
    messages: [],
    mood: 'calm',
    lastAutoMood: 'calm',
    expressionOverrideMood: '',
    expressionDecision: null,
    turns: 0,
  };
}

async function seedArchiveTurns(count = 8) {
  for (let index = 0; index < count; index += 1) {
    await fetchJson(`${BASE_URL}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: SESSION_ID,
        messages: [{ role: 'user', content: `Midnight rain keeps showing up in my notes pass ${index + 1}.` }],
        memories: { userName: '', voiceOn: false, brainMode: 'local' },
      }),
    }, 30000);
  }
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-browser-smoke-'));
  const memoryFile = path.join(tmpDir, 'penny-memory.browser-smoke.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.browser-smoke.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.browser-smoke.json');
  const mockLmStudio = await createMockLmStudioServer();
  const server = createServerProcess({
    ...process.env,
    PORT: String(PORT),
    PENNY_MEMORY_FILE: memoryFile,
    PENNY_MEMORY_ARCHIVE_FILE: archiveFile,
    PENNY_MEMORY_EMBEDDINGS_FILE: embeddingsFile,
    PENNY_OPENCLAW_ENABLED: '0',
    PENNY_LOCAL_LLM_TRANSPORT: 'chat',
    PENNY_LMSTUDIO_BASE: mockLmStudio.baseUrl,
    PENNY_LMSTUDIO_NATIVE_BASE: mockLmStudio.nativeBaseUrl,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: '1500',
    PENNY_LMSTUDIO_CHAT_MODEL: 'unsloth/gemma-4-31b-it',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
    PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
  });

  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: `${BASE_URL}/?debug=1`,
    sessionId: SESSION_ID,
    checks: [],
    screenshot: SCREENSHOT_PATH,
    mockLmStudioStats: null,
  };

  try {
    console.log('Waiting for Penny browser-smoke server...');
    await waitForServerReady();
    console.log('Loading Playwright...');
    const { chromium } = loadPlaywright();
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(({ storageKey, snapshot }) => {
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      }
    }, { storageKey: STORAGE_KEY, snapshot: buildSnapshot() });

    console.log('Opening Penny UI...');
    await page.goto(`${BASE_URL}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    console.log('Checking expression lock apply...');
    await page.click('.tab[data-panel="settings"]');
    await page.selectOption('#expressionOverrideSelect', 'flirty');
    await page.waitForFunction(() => {
      const note = document.querySelector('#expressionDecisionNote')?.textContent || '';
      const select = document.querySelector('#expressionOverrideSelect');
      return select?.value === 'flirty' && /manual override/i.test(note);
    }, undefined, { timeout: 5000 });
    report.checks.push({ name: 'expression_lock_applies', ok: true });

    console.log('Checking expression lock reload persistence...');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.click('.tab[data-panel="settings"]');
    await page.waitForFunction(() => {
      const note = document.querySelector('#expressionDecisionNote')?.textContent || '';
      const select = document.querySelector('#expressionOverrideSelect');
      return select?.value === 'flirty' && /flirty/i.test(note);
    }, undefined, { timeout: 5000 });
    report.checks.push({ name: 'expression_lock_persists_reload', ok: true });

    console.log('Checking expression auto-clear...');
    await page.selectOption('#expressionOverrideSelect', '');
    await page.waitForFunction(() => {
      const note = document.querySelector('#expressionDecisionNote')?.textContent || '';
      const select = document.querySelector('#expressionOverrideSelect');
      return select?.value === '' && /manual override cleared|returned to the last auto mood/i.test(note);
    }, undefined, { timeout: 5000 });
    report.checks.push({ name: 'expression_lock_clears_to_auto', ok: true });

    console.log('Seeding archive turns...');
    await seedArchiveTurns(8);
    console.log('Checking memory inspector recency and queue details...');
    await page.click('.tab[data-panel="memory"]');
    await page.waitForFunction(() => {
      const panel = document.querySelector('#memoryInspectorPanel');
      const text = panel?.textContent || '';
      return /Recency protection/i.test(text) && /thread /i.test(text);
    }, undefined, { timeout: 15000 });
    report.checks.push({ name: 'memory_inspector_recency_and_packet_visible', ok: true });

    console.log('Checking end-to-end chat turn...');
    await page.click('.tab[data-panel="chat"]');
    await page.fill('#composer', 'Tell me something quick about what you notice.');
    const turnsBefore = Number(await page.textContent('#turnsValue')) || 0;
    const started = Date.now();
    await page.click('#send');
    await page.waitForFunction(({ storageKey, minTurns }) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      let snapshot;
      try {
        snapshot = JSON.parse(raw);
      } catch {
        return false;
      }
      const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
      const last = messages[messages.length - 1];
      const assistantRow = document.querySelector('#chat .msg-row.assistant:last-child');
      const turns = Number(snapshot?.turns || 0);
      return (
        turns >= minTurns
        && last?.role === 'assistant'
        && last?.streaming !== true
        && typeof last?.content === 'string'
        && last.content.trim().length > 0
        && assistantRow
        && !assistantRow.classList.contains('streaming')
      );
    }, { storageKey: STORAGE_KEY, minTurns: Math.max(1, turnsBefore + 1) }, { timeout: 20000 });
    const chatSeconds = roundSeconds(Date.now() - started);
    const moodPill = await page.textContent('#moodPill');
    report.checks.push({
      name: 'chat_turn_updates_ui',
      ok: /thinking/i.test(String(moodPill || '')),
      seconds: chatSeconds,
      moodPill: String(moodPill || '').trim(),
    });

    console.log('Checking runtime artifact visibility...');
    await page.click('.tab[data-panel="memory"]');
    await page.waitForFunction(() => {
      const panel = document.querySelector('#memoryInspectorPanel');
      return /penny-runtime-artifact\.v1/i.test(panel?.textContent || '');
    }, undefined, { timeout: 10000 });
    report.checks.push({ name: 'memory_inspector_shows_runtime_artifact', ok: true });

    console.log('Checking new-chat reset...');
    await page.click('.tab[data-panel="settings"]');
    await page.click('#newChat');
    await page.waitForFunction(() => {
      const chat = document.querySelector('#chat');
      const turns = document.querySelector('#turnsValue')?.textContent || '';
      return !chat?.textContent?.trim() && turns === '0';
    }, undefined, { timeout: 10000 });
    report.checks.push({ name: 'new_chat_resets_transcript_and_turns', ok: true });

    console.log('Checking clear-memory reset...');
    await page.selectOption('#expressionOverrideSelect', 'smug');
    await page.waitForTimeout(300);
    await page.click('#clearMemory');
    await page.waitForFunction(() => {
      const select = document.querySelector('#expressionOverrideSelect');
      const turns = document.querySelector('#turnsValue')?.textContent || '';
      return select?.value === '' && turns === '0';
    }, undefined, { timeout: 15000 });
    report.checks.push({ name: 'clear_memory_resets_override_and_turns', ok: true });

    console.log('Capturing final screenshot...');
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    report.mockLmStudioStats = mockLmStudio.stats;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
    console.log(`Saved Penny browser smoke to ${OUTPUT_PATH}`);
  } finally {
    await stopServerProcess(server);
    await mockLmStudio.close();
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseStorageSnapshot: buildSnapshot,
};
