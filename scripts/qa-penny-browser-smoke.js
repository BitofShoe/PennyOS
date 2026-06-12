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
const IMAGE_ONLY = process.env.PENNY_BROWSER_SMOKE_IMAGE_ONLY === '1';
const OUTPUT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.json`);
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.png`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.server.err.log`);
const STORAGE_KEY = 'penny:v3';
const SESSION_ID = `penny-browser-smoke-${Date.now().toString(36)}`;
const INSTALL_BROWSER_ONLY = process.argv.includes('--install-browser');
const PLAYWRIGHT_VERSION = '1.60.0';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundSeconds(ms) {
  return Math.round((Number(ms || 0) / 1000) * 100) / 100;
}

function persistReport(report = {}) {
  ensureDir(OUTPUT_DIR);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(report, null, 2)}\n`);
}

async function collectUiDebug(page) {
  if (!page) return null;
  return page.evaluate((storageKey) => {
    let snapshot = null;
    try {
      snapshot = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    } catch {
      snapshot = null;
    }
    const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
    const latestAssistant = [...messages].reverse().find((msg) => msg?.role === 'assistant') || null;
    const latestUser = [...messages].reverse().find((msg) => msg?.role === 'user') || null;
    const latestUserWithImage = [...messages].reverse().find((msg) => msg?.role === 'user' && typeof msg?.image === 'string') || null;
    const latestUserHadImage = latestUser?.hadImage === true || latestUserWithImage?.hadImage === true;
    const assistantRow = document.querySelector('#chat .msg-row.assistant:last-child');
    const assistantBubble = assistantRow?.querySelector('.bubble.assistant');
    const latestUserImageRow = document.querySelector('#chat .msg-row.user:last-child .msg-image img');
    const chatFetch = window.__pennyDebug?.lastChatFetch && typeof window.__pennyDebug.lastChatFetch === 'object'
      ? window.__pennyDebug.lastChatFetch
      : null;
    return {
      turns: Number(snapshot?.turns || 0),
      messageCount: messages.length,
      latestAssistantContent: typeof latestAssistant?.content === 'string' ? latestAssistant.content : '',
      latestAssistantBubbleText: String(assistantBubble?.textContent || '').trim(),
      latestAssistantStreaming: latestAssistant?.streaming === true,
      latestUserContent: typeof latestUser?.content === 'string' ? latestUser.content : '',
      latestUserHasImage: typeof latestUserWithImage?.image === 'string' && latestUserWithImage.image.startsWith('data:image/'),
      latestUserHadImage,
      latestUserImageVisible: typeof latestUserImageRow?.getAttribute('src') === 'string' && latestUserImageRow.getAttribute('src').startsWith('data:image/'),
      assistantRowStreaming: !!assistantRow?.classList.contains('streaming'),
      moodPill: String(document.querySelector('#moodPill')?.textContent || '').trim(),
      composerNotice: String(document.querySelector('#composerNotice')?.textContent || '').trim(),
      imagePreviewVisible: document.querySelector('#imagePreview')?.hidden === false,
      lastChatFetch: chatFetch,
      voiceDebug: window.__pennyDebug?.voice || null,
    };
  }, STORAGE_KEY);
}

async function waitForPagePredicate(page, predicate, arg, options = {}) {
  const timeout = Number(options.timeout || 30000);
  const interval = Number(options.interval || 100);
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started <= timeout) {
    try {
      if (await page.evaluate(predicate, arg)) return;
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(interval);
  }
  const message = lastError?.message ? ` Last error: ${lastError.message}` : '';
  throw new Error(`Timed out after ${timeout}ms waiting for browser smoke predicate.${message}`);
}

function ensurePlaywright() {
  ensureDir(PW_DIR);
  const manifest = {
    name: 'qa-pw',
    private: true,
    dependencies: {
      playwright: PLAYWRIGHT_VERSION,
    },
  };
  let needsInstall = !fs.existsSync(PW_READY);
  try {
    const current = JSON.parse(fs.readFileSync(PW_PKG, 'utf8'));
    if (current?.dependencies?.playwright !== PLAYWRIGHT_VERSION) {
      needsInstall = true;
    }
  } catch {
    needsInstall = true;
  }
  if (!fs.existsSync(PW_PKG) || needsInstall) {
    fs.writeFileSync(PW_PKG, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (fs.existsSync(PW_READY)) {
    try {
      const installed = JSON.parse(fs.readFileSync(PW_READY, 'utf8'));
      if (installed?.version !== PLAYWRIGHT_VERSION) {
        needsInstall = true;
      }
    } catch {
      needsInstall = true;
    }
  }
  if (!needsInstall) return;
  execSync('npm install --omit=dev', { cwd: PW_DIR, stdio: 'inherit' });
}

function installPlaywrightChromium() {
  ensurePlaywright();
  const cli = path.join(PW_DIR, 'node_modules', 'playwright', 'cli.js');
  execSync(`"${process.execPath}" "${cli}" install chromium`, { cwd: ROOT_DIR, stdio: 'inherit' });
}

function loadPlaywright() {
  ensurePlaywright();
  return require(path.join(PW_DIR, 'node_modules', 'playwright'));
}

async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = String(error?.message || error || '');
    if (/Executable doesn't exist|playwright install/i.test(message)) {
      throw new Error([
        'Playwright Chromium is not installed for Penny browser smoke.',
        'Run: npm run qa:browser:install',
        'Then retry: npm run qa:browser:smoke',
      ].join('\n'));
    }
    throw error;
  }
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
  if (/"image_url"|"data:image\/|"type":"image"/i.test(raw)) {
    return 'I can see the image you attached. Tiny little test square, clean edges, very deliberate. [MOOD:thinking]';
  }
  if (/what keeps showing up|what do you notice/i.test(raw)) {
    return 'The midnight rain detail keeps showing up. [MOOD:thinking]';
  }
  return 'Mock Penny reply. [MOOD:thinking]';
}

function createTinyPngFixture(tmpDir) {
  const imagePath = path.join(tmpDir, 'tiny-upload.png');
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAV0lEQVR4nO3PQQ3AIADAQEASmhCLrIngcVnSU9DOs+/4s6UDXjWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgfT1iAj0mLdegAAAAAElFTkSuQmCC';
  fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
  return imagePath;
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
    lastChatRequestPath: '',
    lastChatRequestPreview: '',
    lastChatReply: '',
    lastChatStream: false,
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
      const rawBody = (await readRequestBody(req)) || '{}';
      const body = JSON.parse(rawBody);
      const reply = buildMockLmStudioReply(body);
      stats.lastChatRequestPath = url.pathname;
      stats.lastChatRequestPreview = rawBody.slice(0, 1200);
      stats.lastChatReply = reply;
      stats.lastChatStream = body?.stream === true;
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

async function createMockSpeachesServer() {
  const stats = {
    modelsRequests: 0,
    speechRequests: 0,
    lastSpeechPayload: null,
  };
  const audioBytes = Buffer.from('RIFF$\x00\x00\x00WAVEfmt ', 'binary');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      stats.modelsRequests += 1;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: 'speaches-ai/Kokoro-82M-v1.0-ONNX', object: 'model', owned_by: 'local' },
        ],
      }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/v1/audio/speech') {
      stats.speechRequests += 1;
      stats.lastSpeechPayload = JSON.parse((await readRequestBody(req)) || '{}');
      res.writeHead(200, {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBytes.length,
      });
      res.end(audioBytes);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Unhandled mock Speaches route: ${req.method} ${url.pathname}` }));
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
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
  if (INSTALL_BROWSER_ONLY) {
    installPlaywrightChromium();
    console.log('Playwright Chromium is installed for Penny browser smoke.');
    return;
  }

  ensureDir(OUTPUT_DIR);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-browser-smoke-'));
  const imageFixturePath = createTinyPngFixture(tmpDir);
  const memoryFile = path.join(tmpDir, 'penny-memory.browser-smoke.json');
  const archiveFile = path.join(tmpDir, 'penny-memory-archive.browser-smoke.json');
  const embeddingsFile = path.join(tmpDir, 'penny-memory-embeddings.browser-smoke.json');
  const openLoopFile = path.join(tmpDir, 'penny-open-loops.browser-smoke.json');
  const mockLmStudio = await createMockLmStudioServer();
  const mockSpeaches = await createMockSpeachesServer();
  const server = createServerProcess({
    ...process.env,
    PORT: String(PORT),
    PENNY_MEMORY_FILE: memoryFile,
    PENNY_MEMORY_ARCHIVE_FILE: archiveFile,
    PENNY_MEMORY_EMBEDDINGS_FILE: embeddingsFile,
    PENNY_OPEN_LOOP_FILE: openLoopFile,
    PENNY_OPENCLAW_ENABLED: '0',
    PENNY_LOCAL_LLM_TRANSPORT: 'chat',
    PENNY_LMSTUDIO_BASE: mockLmStudio.baseUrl,
    PENNY_LMSTUDIO_NATIVE_BASE: mockLmStudio.nativeBaseUrl,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: '1500',
    PENNY_LMSTUDIO_CHAT_MODEL: 'unsloth/gemma-4-31b-it',
    PENNY_LMSTUDIO_TOOL_MODEL: 'google/gemma-4-e4b',
    PENNY_LMSTUDIO_EMBED_MODEL: 'text-embedding-nomic-embed-text-v1.5',
    PENNY_SPEACHES_BASE_URL: mockSpeaches.baseUrl,
    PENNY_SPEACHES_MODEL: 'speaches-ai/Kokoro-82M-v1.0-ONNX',
    PENNY_SPEACHES_VOICE: 'af_heart',
  });

  const report = {
    startedAt: new Date().toISOString(),
    baseUrl: `${BASE_URL}/?debug=1`,
    sessionId: SESSION_ID,
    imageOnly: IMAGE_ONLY,
    currentStep: 'starting',
    checks: [],
    screenshot: SCREENSHOT_PATH,
    mockLmStudioStats: null,
    mockSpeachesStats: null,
  };
  persistReport(report);
  let browser = null;
  let page = null;

  try {
    report.currentStep = 'wait_for_server_ready';
    persistReport(report);
    console.log('Waiting for Penny browser-smoke server...');
    await waitForServerReady();
    report.currentStep = 'load_playwright';
    persistReport(report);
    console.log('Loading Playwright...');
    const { chromium } = loadPlaywright();
    report.currentStep = 'launch_browser';
    persistReport(report);
    console.log('Launching browser...');
    browser = await launchChromium(chromium);
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(({ storageKey, snapshot }) => {
      if (!window.localStorage.getItem(storageKey)) {
        window.localStorage.setItem(storageKey, JSON.stringify(snapshot));
      }
      function ensureDebug() {
        if (!window.__pennyDebug || (typeof window.__pennyDebug !== 'object' && typeof window.__pennyDebug !== 'function')) {
          window.__pennyDebug = {};
        }
        if (!Array.isArray(window.__pennyDebug.errors)) window.__pennyDebug.errors = [];
        if (!window.__pennyDebug.voice || typeof window.__pennyDebug.voice !== 'object') {
          window.__pennyDebug.voice = {
            speechFetches: 0,
            lastSpeechStatus: 0,
            audioPlayCalls: 0,
            audioPauseCalls: 0,
            lastAudioUrl: '',
          };
        }
        if (!Object.prototype.hasOwnProperty.call(window.__pennyDebug, 'lastChatFetch')) {
          window.__pennyDebug.lastChatFetch = null;
        }
        return window.__pennyDebug;
      }
      ensureDebug();
      const initialDebug = ensureDebug();
      initialDebug.voice = {
          speechFetches: 0,
          lastSpeechStatus: 0,
          audioPlayCalls: 0,
          audioPauseCalls: 0,
          lastAudioUrl: '',
      };
      window.Audio = class PennySmokeAudio {
        constructor(url) {
          this.url = url;
          this.currentTime = 0;
          this.paused = true;
          this.listeners = {};
          ensureDebug().voice.lastAudioUrl = String(url || '');
        }

        addEventListener(event, listener) {
          this.listeners[event] = listener;
        }

        async play() {
          this.paused = false;
          ensureDebug().voice.audioPlayCalls += 1;
        }

        pause() {
          this.paused = true;
          ensureDebug().voice.audioPauseCalls += 1;
        }
      };
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (...args) => {
        const [input, init] = args;
        const url = typeof input === 'string' ? input : String(input?.url || '');
        const requestBody = typeof init?.body === 'string' ? init.body : '';
        const isChatStream = /\/api\/penny\/chat(\?|$)/.test(url) && (/stream=1/.test(url) || /"stream"\s*:\s*true/.test(requestBody));
        const isVoiceSpeech = /\/api\/penny\/voice\/speech$/.test(url);
        const response = await originalFetch(...args);
        if (isVoiceSpeech) {
          const debug = ensureDebug();
          debug.voice.speechFetches += 1;
          debug.voice.lastSpeechStatus = Number(response.status || 0);
        }
        if (isChatStream) {
          const entry = {
            url,
            status: Number(response.status || 0),
            requestBodyPreview: requestBody.slice(0, 1200),
            responseTextPreview: '',
            responseCloneError: '',
          };
          try {
            entry.responseTextPreview = (await response.clone().text()).slice(0, 5000);
          } catch (error) {
            entry.responseCloneError = error?.message || String(error);
          }
          ensureDebug().lastChatFetch = entry;
        }
        return response;
      };
      window.addEventListener('error', (event) => {
        ensureDebug().errors.push({
          type: 'error',
          message: event?.message || '',
        });
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event?.reason;
        ensureDebug().errors.push({
          type: 'unhandledrejection',
          message: reason?.message || String(reason || ''),
        });
      });
    }, { storageKey: STORAGE_KEY, snapshot: buildSnapshot() });

    report.currentStep = 'open_ui';
    persistReport(report);
    console.log('Opening Penny UI...');
    await page.goto(`${BASE_URL}/?debug=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    if (!IMAGE_ONLY) {
      report.currentStep = 'expression_lock_applies';
      persistReport(report);
      console.log('Checking expression lock apply...');
      await page.click('.tab[data-panel="settings"]');
      await page.selectOption('#expressionOverrideSelect', 'flirty');
      await waitForPagePredicate(page, () => {
        const note = document.querySelector('#expressionDecisionNote')?.textContent || '';
        const select = document.querySelector('#expressionOverrideSelect');
        return select?.value === 'flirty' && /manual override/i.test(note);
      }, undefined, { timeout: 5000 });
      report.checks.push({ name: 'expression_lock_applies', ok: true });
      persistReport(report);

      report.currentStep = 'expression_lock_persists_reload';
      persistReport(report);
      console.log('Checking expression lock reload persistence...');
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      await page.click('.tab[data-panel="settings"]');
      await waitForPagePredicate(page, () => {
        const note = document.querySelector('#expressionDecisionNote')?.textContent || '';
        const select = document.querySelector('#expressionOverrideSelect');
        return select?.value === 'flirty' && /flirty/i.test(note);
      }, undefined, { timeout: 5000 });
      report.checks.push({ name: 'expression_lock_persists_reload', ok: true });
      persistReport(report);

      report.currentStep = 'expression_lock_clears_to_auto';
      persistReport(report);
      console.log('Checking expression auto-clear...');
      await page.selectOption('#expressionOverrideSelect', '');
      await waitForPagePredicate(page, () => {
        const note = document.querySelector('#expressionDecisionNote')?.textContent || '';
        const select = document.querySelector('#expressionOverrideSelect');
        return select?.value === '' && /manual override cleared|returned to the last auto mood/i.test(note);
      }, undefined, { timeout: 5000 });
      report.checks.push({ name: 'expression_lock_clears_to_auto', ok: true });
      persistReport(report);

      report.currentStep = 'runtime_voice_ready_and_enabled';
      persistReport(report);
      console.log('Checking runtime voice readiness...');
      await waitForPagePredicate(page, () => {
        const toggle = document.querySelector('#voiceToggle');
        const status = document.querySelector('#voiceStatus')?.textContent || '';
        return toggle && toggle.disabled === false && /ready/i.test(status);
      }, undefined, { timeout: 10000 });
      await page.check('#voiceToggle');
      report.checks.push({
        name: 'runtime_voice_ready_and_enabled',
        ok: true,
        status: String(await page.textContent('#voiceStatus') || '').trim(),
      });
      persistReport(report);

      report.currentStep = 'seed_archive_turns';
      persistReport(report);
      console.log('Seeding archive turns...');
      await seedArchiveTurns(8);
      report.currentStep = 'memory_inspector_recency_and_packet_visible';
      persistReport(report);
      console.log('Checking memory inspector recency and queue details...');
      await page.click('.tab[data-panel="memory"]');
      await waitForPagePredicate(page, () => {
        const panel = document.querySelector('#memoryInspectorPanel');
        const text = panel?.textContent || '';
        return /Recency protection/i.test(text) && /thread /i.test(text);
      }, undefined, { timeout: 15000 });
      report.checks.push({ name: 'memory_inspector_recency_and_packet_visible', ok: true });
      persistReport(report);

      report.currentStep = 'chat_turn_updates_ui';
      persistReport(report);
      console.log('Checking end-to-end chat turn...');
      await page.click('.tab[data-panel="chat"]');
      await page.fill('#composer', 'Tell me something quick about what you notice.');
      const turnsBefore = Number(await page.textContent('#turnsValue')) || 0;
      const started = Date.now();
      await page.click('#send');
      await waitForPagePredicate(page, ({ storageKey, minTurns }) => {
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
      persistReport(report);

      report.currentStep = 'runtime_voice_speaks_chat_reply';
      persistReport(report);
      console.log('Checking runtime voice playback path...');
      await waitForPagePredicate(page, () => {
        const voice = window.__pennyDebug?.voice || {};
        return voice.speechFetches >= 1
          && voice.lastSpeechStatus === 200
          && voice.audioPlayCalls >= 1
          && /^blob:/i.test(String(voice.lastAudioUrl || ''));
      }, undefined, { timeout: 10000 });
      const voiceDebug = await page.evaluate(() => ({ ...(window.__pennyDebug?.voice || {}) }));
      report.checks.push({
        name: 'runtime_voice_speaks_chat_reply',
        ok: true,
        speechFetches: voiceDebug.speechFetches,
        lastSpeechStatus: voiceDebug.lastSpeechStatus,
        audioPlayCalls: voiceDebug.audioPlayCalls,
      });
      persistReport(report);
    } else {
      report.checks.push({ name: 'image_only_mode', ok: true });
      persistReport(report);
      await page.click('.tab[data-panel="chat"]');
    }

    report.currentStep = 'image_attachment_prepares_preview';
    persistReport(report);
    console.log('Checking image upload prep and reply path...');
    await page.setInputFiles('#imageInput', imageFixturePath);
    await waitForPagePredicate(page, () => {
      const preview = document.querySelector('#imagePreview');
      const previewImg = document.querySelector('#imagePreviewImg');
      const notice = document.querySelector('#composerNotice')?.textContent || '';
      return preview && preview.hidden === false
        && !!previewImg?.getAttribute('src')
        && /image ready/i.test(notice);
    }, undefined, { timeout: 10000 });
    report.checks.push({ name: 'image_attachment_prepares_preview', ok: true });
    persistReport(report);

    report.currentStep = 'image_upload_turn_send';
    persistReport(report);
    await page.fill('#composer', 'Tell me what you see in this image.');
    const imageTurnsBefore = Number(await page.textContent('#turnsValue')) || 0;
    const voiceFetchesBeforeImage = IMAGE_ONLY
      ? 0
      : Number(await page.evaluate(() => window.__pennyDebug?.voice?.speechFetches || 0)) || 0;
    const imageStarted = Date.now();
    await page.click('#send');
    report.currentStep = 'image_upload_turn_user_message_persists';
    persistReport(report);
    await waitForPagePredicate(page, ({ storageKey, minTurns }) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      let snapshot;
      try {
        snapshot = JSON.parse(raw);
      } catch {
        return false;
      }
      const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
      const latestAssistant = [...messages].reverse().find((msg) => msg?.role === 'assistant' && !msg?.streaming);
      const latestUser = [...messages].reverse().find((msg) => msg?.role === 'user');
      const latestUserWithImage = [...messages].reverse().find((msg) => msg?.role === 'user' && typeof msg?.image === 'string');
      const latestUserImageRow = document.querySelector('#chat .msg-row.user:last-child .msg-image img');
      const turns = Number(snapshot?.turns || 0);
      return (
        turns >= minTurns
        && (
          (typeof latestUserWithImage?.image === 'string' && latestUserWithImage.image.startsWith('data:image/'))
          || latestUser?.hadImage === true
          || (typeof latestUserImageRow?.getAttribute('src') === 'string' && latestUserImageRow.getAttribute('src').startsWith('data:image/'))
        )
      );
    }, { storageKey: STORAGE_KEY, minTurns: Math.max(1, imageTurnsBefore + 1) }, { timeout: 20000 });
    const imageUserDebug = await collectUiDebug(page);
    report.checks.push({
      name: 'image_upload_turn_persists_user_image',
      ok: imageUserDebug?.latestUserHasImage === true
        || imageUserDebug?.latestUserHadImage === true
        || imageUserDebug?.latestUserImageVisible === true,
      turns: Number(imageUserDebug?.turns || 0),
      composerNotice: imageUserDebug?.composerNotice || '',
    });
    persistReport(report);

    report.currentStep = 'image_upload_turn_assistant_reply';
    persistReport(report);
    await waitForPagePredicate(page, ({ storageKey, minTurns }) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      let snapshot;
      try {
        snapshot = JSON.parse(raw);
      } catch {
        return false;
      }
      const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
      const latestAssistant = [...messages].reverse().find((msg) => msg?.role === 'assistant' && !msg?.streaming);
      const assistantRow = document.querySelector('#chat .msg-row.assistant:last-child');
      const assistantBubble = assistantRow?.querySelector('.bubble.assistant');
      const turns = Number(snapshot?.turns || 0);
      return (
        turns >= minTurns
        && assistantRow
        && !assistantRow.classList.contains('streaming')
        && (
          (typeof latestAssistant?.content === 'string' && latestAssistant.content.trim().length > 0)
          || String(assistantBubble?.textContent || '').trim().length > 0
        )
      );
    }, { storageKey: STORAGE_KEY, minTurns: Math.max(1, imageTurnsBefore + 1) }, { timeout: 20000 });
    const imageReplySeconds = roundSeconds(Date.now() - imageStarted);
    const imageReplyDebug = await collectUiDebug(page);
    report.checks.push({
      name: 'image_upload_turn_sets_assistant_reply',
      ok: (typeof imageReplyDebug?.latestAssistantContent === 'string'
        && imageReplyDebug.latestAssistantContent.trim().length > 0)
        || (typeof imageReplyDebug?.latestAssistantBubbleText === 'string'
          && imageReplyDebug.latestAssistantBubbleText.trim().length > 0),
      seconds: imageReplySeconds,
      replyMentionsImage: /image|square|attached/i.test(String(imageReplyDebug?.latestAssistantContent || imageReplyDebug?.latestAssistantBubbleText || '')),
      assistantPreview: String(imageReplyDebug?.latestAssistantContent || imageReplyDebug?.latestAssistantBubbleText || '').slice(0, 160),
    });
    persistReport(report);

    if (!IMAGE_ONLY) {
      report.currentStep = 'runtime_voice_speaks_image_reply';
      persistReport(report);
      console.log('Checking runtime voice playback for image reply...');
      await waitForPagePredicate(page, ({ minSpeechFetches }) => {
        const voice = window.__pennyDebug?.voice || {};
        return Number(voice.speechFetches || 0) >= minSpeechFetches
          && voice.lastSpeechStatus === 200
          && voice.audioPlayCalls >= minSpeechFetches
          && /^blob:/i.test(String(voice.lastAudioUrl || ''));
      }, { minSpeechFetches: voiceFetchesBeforeImage + 1 }, { timeout: 10000 });
      const imageVoiceDebug = await page.evaluate(() => ({ ...(window.__pennyDebug?.voice || {}) }));
      report.checks.push({
        name: 'runtime_voice_speaks_image_reply',
        ok: true,
        speechFetchesBeforeImage: voiceFetchesBeforeImage,
        speechFetches: imageVoiceDebug.speechFetches,
        lastSpeechStatus: imageVoiceDebug.lastSpeechStatus,
        audioPlayCalls: imageVoiceDebug.audioPlayCalls,
      });
      persistReport(report);
    }

    report.currentStep = 'image_upload_turn_inspector_artifact';
    persistReport(report);
    const inspector = await fetchJson(`${BASE_URL}/api/penny/memory/inspector?sessionId=${SESSION_ID}`, {}, 30000);
    const artifact = inspector?.inspector?.artifact || null;
    report.checks.push({
      name: 'image_upload_turn_uses_attachment_bounded_chat_lane',
      ok: artifact?.scope?.selectedLane === 'chat'
        && artifact?.modelAdvisory?.reasoningPolicy?.mode === 'attachment-bounded'
        && artifact?.trace?.reasoningPolicy?.mode === 'attachment-bounded',
      seconds: imageReplySeconds,
      selectedLane: artifact?.scope?.selectedLane || '',
      reasoningMode: artifact?.modelAdvisory?.reasoningPolicy?.mode || '',
    });
    persistReport(report);

    report.currentStep = 'memory_inspector_shows_runtime_artifact';
    persistReport(report);
    console.log('Checking runtime artifact visibility...');
    await page.click('.tab[data-panel="memory"]');
    await waitForPagePredicate(page, () => {
      const panel = document.querySelector('#memoryInspectorPanel');
      return /penny-runtime-artifact\.v1/i.test(panel?.textContent || '');
    }, undefined, { timeout: 10000 });
    report.checks.push({ name: 'memory_inspector_shows_runtime_artifact', ok: true });
    persistReport(report);

    report.currentStep = 'new_chat_resets_transcript_and_turns';
    persistReport(report);
    console.log('Checking new-chat reset...');
    await page.click('.tab[data-panel="settings"]');
    await page.click('#newChat');
    await waitForPagePredicate(page, () => {
      const chat = document.querySelector('#chat');
      const turns = document.querySelector('#turnsValue')?.textContent || '';
      return !chat?.textContent?.trim() && turns === '0';
    }, undefined, { timeout: 10000 });
    report.checks.push({ name: 'new_chat_resets_transcript_and_turns', ok: true });
    persistReport(report);

    report.currentStep = 'clear_memory_resets_override_and_turns';
    persistReport(report);
    console.log('Checking clear-memory reset...');
    await page.selectOption('#expressionOverrideSelect', 'smug');
    await page.waitForTimeout(300);
    await page.click('#clearMemory');
    await waitForPagePredicate(page, () => {
      const select = document.querySelector('#expressionOverrideSelect');
      const turns = document.querySelector('#turnsValue')?.textContent || '';
      return select?.value === '' && turns === '0';
    }, undefined, { timeout: 15000 });
    report.checks.push({ name: 'clear_memory_resets_override_and_turns', ok: true });
    persistReport(report);

    report.currentStep = 'capture_screenshot';
    persistReport(report);
    console.log('Capturing final screenshot...');
    await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
    report.mockLmStudioStats = mockLmStudio.stats;
    report.mockSpeachesStats = mockSpeaches.stats;
    report.finishedAt = new Date().toISOString();
    report.currentStep = 'finished';
    persistReport(report);
    await browser.close();
    console.log(`Saved Penny browser smoke to ${OUTPUT_PATH}`);
  } catch (error) {
    try {
      if (page) {
        await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
      }
      report.error = error?.stack || error?.message || String(error);
      report.mockLmStudioStats = mockLmStudio.stats;
      report.mockSpeachesStats = mockSpeaches.stats;
      report.uiDebug = await collectUiDebug(page);
      persistReport(report);
    } catch {}
    throw error;
  } finally {
    await stopServerProcess(server);
    await mockLmStudio.close();
    await mockSpeaches.close();
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
