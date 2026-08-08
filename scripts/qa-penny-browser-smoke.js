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
const ATTACHMENT_SCREENSHOT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-attachments-${STAMP}.png`);
const SERVER_STDOUT_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.server.out.log`);
const SERVER_STDERR_PATH = path.join(OUTPUT_DIR, `penny-browser-smoke-${STAMP}.server.err.log`);
const STORAGE_KEY = 'penny:v3';
const SESSION_ID = `penny-browser-smoke-${Date.now().toString(36)}`;
const INSTALL_BROWSER_ONLY = process.argv.includes('--install-browser');
const PLAYWRIGHT_VERSION = '1.60.0';
const PRIVACY_CANARIES = Object.freeze([
  'PENNY_PRIVATE_PROVIDER_BODY_CANARY_8b42',
  'PENNY_PRIVATE_PROVIDER_REASONING_CANARY_6cc1',
  'PENNY_PRIVATE_PROVIDER_MEMORY_CANARY_24da',
  'PENNY_PRIVATE_PROVIDER_PROMPT_CANARY_75ef',
]);

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
    const latestUserWithImage = [...messages].reverse().find((msg) => msg?.role === 'user' && (typeof msg?.image === 'string' || Array.isArray(msg?.images))) || null;
    const latestUserHadImage = latestUser?.hadImage === true || latestUserWithImage?.hadImage === true;
    const assistantRow = document.querySelector('#chat .msg-row.assistant:last-child');
    const assistantBubble = assistantRow?.querySelector('.bubble.assistant');
    const userRows = [...document.querySelectorAll('#chat .msg-row.user')];
    const latestUserRow = userRows.at(-1) || null;
    const latestUserImageRows = [...(latestUserRow?.querySelectorAll('.msg-image img') || [])];
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
      latestUserHasImage: (typeof latestUserWithImage?.image === 'string' && latestUserWithImage.image.startsWith('data:image/'))
        || (Array.isArray(latestUserWithImage?.images) && latestUserWithImage.images.some(image => String(image).startsWith('data:image/'))),
      latestUserHadImage,
      latestUserImageVisible: latestUserImageRows.some(image => String(image.getAttribute('src') || '').startsWith('data:image/')),
      latestUserImageCount: latestUserImageRows.length,
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
  if (/streaming scroll ownership/i.test(raw)) {
    return `${Array.from({ length: 180 }, (_, index) => `scroll-token-${index + 1}`).join(' ')} [MOOD:thinking]`;
  }
  if (/"image_url"|"data:image\/|"type":"image"/i.test(raw)) {
    return 'I can see the image you attached. Tiny little test square, clean edges, very deliberate. [MOOD:thinking]';
  }
  if (/what keeps showing up|what do you notice/i.test(raw)) {
    return 'The midnight rain detail keeps showing up. [MOOD:thinking]';
  }
  return 'Mock Penny reply. [MOOD:thinking]';
}

function createTinyPngFixture(tmpDir, name = 'tiny-upload.png') {
  const imagePath = path.join(tmpDir, name);
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAV0lEQVR4nO3PQQ3AIADAQEASmhCLrIngcVnSU9DOs+/4s6UDXjWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgfT1iAj0mLdegAAAAAElFTkSuQmCC';
  fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
  return imagePath;
}

function createTextFolderFixture(tmpDir) {
  const folderPath = path.join(tmpDir, 'attachment-folder');
  fs.mkdirSync(path.join(folderPath, 'nested'), { recursive: true });
  fs.writeFileSync(path.join(folderPath, 'README.md'), '# Attachment fixture\nA selected folder should be bounded.\n');
  fs.writeFileSync(path.join(folderPath, 'nested', 'config.json'), '{"mode":"fixture","safe":true}\n');
  return folderPath;
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

  for (let index = 0; index < pieces.length; index += 1) {
    const piece = pieces[index];
    writeSseFrame(res, {
      id: 'chatcmpl-mock',
      object: 'chat.completion.chunk',
      created: 0,
      model,
      choices: [
        {
          index: 0,
          delta: {
            content: piece,
            ...(index === 0 ? { reasoning_content: PRIVACY_CANARIES[1] } : {}),
          },
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
    lastImagePartCount: 0,
    lastFolderBundleSeen: false,
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
      if (/privacy error boundary fixture/i.test(rawBody)) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          error: PRIVACY_CANARIES[0],
          reasoning: PRIVACY_CANARIES[1],
          memory: PRIVACY_CANARIES[2],
          prompt: PRIVACY_CANARIES[3],
        }));
        return;
      }
      const reply = buildMockLmStudioReply(body);
      stats.lastChatRequestPath = url.pathname;
      stats.lastChatRequestPreview = rawBody.slice(0, 1200);
      stats.lastChatReply = reply;
      stats.lastChatStream = body?.stream === true;
      stats.lastImagePartCount = (Array.isArray(body?.messages) ? body.messages : [])
        .flatMap(message => Array.isArray(message?.content) ? message.content : [])
        .filter(part => part?.type === 'image_url').length;
      stats.lastFolderBundleSeen = /Selected text-folder bundle:/i.test(rawBody);
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
              reasoning_content: PRIVACY_CANARIES[1],
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
  const imageFixturePaths = [
    createTinyPngFixture(tmpDir, 'tiny-upload-first.png'),
    createTinyPngFixture(tmpDir, 'tiny-upload-second.png'),
  ];
  const folderFixturePath = createTextFolderFixture(tmpDir);
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
    PENNY_API_ALLOW_LOCAL_NO_TOKEN: '1',
    PENNY_SKIP_LMSTUDIO_PREP: '1',
    PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY: '1',
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
    PENNY_LOG_LMSTUDIO_REASONING: '1',
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
          let requestAttachment = null;
          try {
            const payload = JSON.parse(requestBody);
            const images = Array.isArray(payload?.images)
              ? payload.images
              : (payload?.image ? [payload.image] : []);
            const file = payload?.file && typeof payload.file === 'object' ? payload.file : null;
            requestAttachment = {
              imageCount: images.filter(image => typeof image === 'string' && image.startsWith('data:image/')).length,
              fileName: String(file?.name || ''),
              folderBundle: /Selected text-folder bundle:/i.test(String(file?.text || '')),
            };
          } catch {}
          const entry = {
            url,
            status: Number(response.status || 0),
            requestBodyPreview: requestBody.slice(0, 1200),
            requestAttachment,
            responseTextPreview: '',
            responseCloneError: '',
          };
          ensureDebug().lastChatFetch = entry;
          response.clone().text().then((text) => {
            entry.responseTextPreview = String(text || '').slice(0, 5000);
          }).catch((error) => {
            entry.responseCloneError = error?.message || String(error);
          });
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

    report.currentStep = 'default_sprite_catalog_renders_all_moods';
    persistReport(report);
    console.log('Checking the default sprite catalog across all eight moods...');
    const spriteMoods = ['calm', 'happy', 'excited', 'thinking', 'surprised', 'flirty', 'smug', 'annoyed'];
    const expectedPrimaryFraming = {
      calm: { shot: 'medium', scale: 1.64 },
      happy: { shot: 'close', scale: 1.48 },
      excited: { shot: 'medium', scale: 1.38 },
      thinking: { shot: 'medium', scale: 1.42 },
      surprised: { shot: 'close', scale: 1.43 },
      flirty: { shot: 'close', scale: 1.42 },
      smug: { shot: 'medium', scale: 1.45 },
      annoyed: { shot: 'medium', scale: 1.43 },
    };
    const renderedSprites = [];
    for (const mood of spriteMoods) {
      await page.evaluate((nextMood) => window.__pennyDebug?.(nextMood, 0), mood);
      await page.waitForTimeout(420);
      renderedSprites.push(await page.evaluate(() => {
        const image = document.querySelector('#coreFace .penny-art');
        return {
          src: String(image?.getAttribute('src') || ''),
          fallbackSrc: String(image?.getAttribute('data-fallback-src') || ''),
          complete: image?.complete === true,
          naturalWidth: Number(image?.naturalWidth || 0),
          presentationScale: Number(image?.style?.getPropertyValue('--penny-chibi-scale') || 0),
          presentationShot: String(image?.closest('.penny-display')?.getAttribute('data-expression-shot') || ''),
        };
      }));
    }
    report.checks.push({
      name: 'default_sprite_catalog_renders_clean_chibi_primary_for_all_eight_moods',
      ok: renderedSprites.every((sprite, index) => sprite.src === `/sprites/packs/default/chibi/${spriteMoods[index]}.png`
        && /^\/sprites\/packs\/pen2\//.test(sprite.fallbackSrc)
        && sprite.complete === true
        && sprite.naturalWidth > 0
        && sprite.presentationScale === expectedPrimaryFraming[spriteMoods[index]].scale
        && sprite.presentationShot === expectedPrimaryFraming[spriteMoods[index]].shot),
      sprites: renderedSprites,
    });
    persistReport(report);

    report.currentStep = 'composer_omits_internal_attachment_caveats';
    persistReport(report);
    const composerCopy = await page.evaluate(() => ({
      hintCount: document.querySelectorAll('.attachment-hint').length,
      visibleText: String(document.querySelector('#composerDropZone')?.parentElement?.textContent || ''),
    }));
    report.checks.push({
      name: 'composer_omits_internal_attachment_caveats',
      ok: composerCopy.hintCount === 0
        && !/pasted paths are not uploads|selected attachments are sent only with this turn/i.test(composerCopy.visibleText),
    });
    persistReport(report);

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
    await page.setInputFiles('#imageInput', imageFixturePaths);
    await waitForPagePredicate(page, () => {
      const preview = document.querySelector('#imagePreview');
      const previewItems = document.querySelectorAll('#imagePreviewList .image-preview-item img');
      const notice = document.querySelector('#composerNotice')?.textContent || '';
      return preview && preview.hidden === false
        && previewItems.length === 2
        && /2 images ready/i.test(notice);
    }, undefined, { timeout: 10000 });
    report.checks.push({ name: 'image_attachment_prepares_preview', ok: true });
    persistReport(report);

    report.currentStep = 'image_upload_turn_send';
    persistReport(report);
    await page.fill('#composer', 'Tell me what you see in these two images.');
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
      const latestUserWithImage = [...messages].reverse().find((msg) => msg?.role === 'user' && (typeof msg?.image === 'string' || Array.isArray(msg?.images)));
      const userRows = [...document.querySelectorAll('#chat .msg-row.user')];
      const latestUserRow = userRows.at(-1) || null;
      const latestUserImageRows = [...(latestUserRow?.querySelectorAll('.msg-image img') || [])];
      const turns = Number(snapshot?.turns || 0);
      return (
        turns >= minTurns
        && (
          (typeof latestUserWithImage?.image === 'string' && latestUserWithImage.image.startsWith('data:image/'))
          || (Array.isArray(latestUserWithImage?.images) && latestUserWithImage.images.length === 2)
          || latestUser?.hadImage === true
          || latestUserImageRows.length === 2
        )
      );
    }, { storageKey: STORAGE_KEY, minTurns: Math.max(1, imageTurnsBefore + 1) }, { timeout: 20000 });
    const imageUserDebug = await collectUiDebug(page);
    report.checks.push({
      name: 'image_upload_turn_persists_user_image',
      ok: (imageUserDebug?.latestUserHasImage === true
        || imageUserDebug?.latestUserHadImage === true
        || imageUserDebug?.latestUserImageVisible === true)
        && imageUserDebug?.latestUserImageCount === 2,
      turns: Number(imageUserDebug?.turns || 0),
      imageCount: Number(imageUserDebug?.latestUserImageCount || 0),
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

    report.checks.push({
      name: 'image_batch_reaches_mock_vision_transport',
      ok: mockLmStudio.stats.lastImagePartCount === 2,
      imagePartCount: mockLmStudio.stats.lastImagePartCount,
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
    const inspector = await page.evaluate(async (sessionId) => {
      const response = await fetch(`/api/penny/memory/inspector?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }, SESSION_ID);
    const artifact = inspector?.inspector?.artifact || null;
    report.checks.push({
      name: 'image_upload_turn_uses_attachment_bounded_chat_lane',
      ok: artifact?.scope?.selectedLane === 'chat'
        && artifact?.modelAdvisory?.reasoningPolicy?.mode === 'attachment-bounded'
        && artifact?.trace?.reasoningPolicy?.mode === 'attachment-bounded'
        && artifact?.reasoningContract?.requested?.state === 'not-requested'
        && artifact?.reasoningContract?.effective?.state === 'enabled'
        && artifact?.reasoningContract?.observed?.state === 'reasoning-observed'
        && !Object.prototype.hasOwnProperty.call(artifact?.reasoningContract?.observed || {}, 'text')
        && artifact?.readiness?.schema === 'penny-runtime-readiness.v2'
        && typeof artifact?.readiness?.availability?.requiredReady === 'boolean'
        && typeof artifact?.readiness?.compatibilityFallback?.active === 'boolean'
        && typeof artifact?.readiness?.semanticDegradation?.active === 'boolean'
        && artifact?.readiness?.legacyFallbackProjection?.deprecatedField === 'fallbackActive',
      seconds: imageReplySeconds,
      selectedLane: artifact?.scope?.selectedLane || '',
      reasoningMode: artifact?.modelAdvisory?.reasoningPolicy?.mode || '',
      reasoningContract: artifact?.reasoningContract || null,
      readinessContract: artifact?.readiness || null,
    });
    persistReport(report);

    report.currentStep = 'memory_inspector_shows_runtime_artifact';
    persistReport(report);
    console.log('Checking runtime artifact visibility...');
    await page.click('.tab[data-panel="memory"]');
    await waitForPagePredicate(page, () => {
      const panel = document.querySelector('#memoryInspectorPanel');
      const text = panel?.textContent || '';
      return /penny-runtime-artifact\.v1/i.test(text)
        && /Reasoning contract:\s*penny-reasoning-contract\.v1/i.test(text)
        && /requested not-requested/i.test(text)
        && /effective enabled/i.test(text)
        && /observed reasoning-observed/i.test(text)
        && /Readiness:\s*(?:ready|degraded|unavailable|compatibility-fallback)/i.test(text)
        && /compatibility fallback\s+(?:active|none)/i.test(text)
        && /semantic degradation\s+(?:semantic|keyword|unavailable|active|none)/i.test(text);
    }, undefined, { timeout: 10000 });
    report.checks.push({
      name: 'memory_inspector_shows_runtime_artifact_reasoning_and_readiness_contracts',
      ok: true,
    });
    persistReport(report);

    report.currentStep = 'new_chat_resets_transcript_and_turns';
    persistReport(report);
    console.log('Checking new-chat reset...');
    await page.click('.tab[data-panel="settings"]');
    await page.evaluate(() => {
      const decor = document.querySelector('.cyber-decor');
      const chatWrap = document.querySelector('#chatWrap');
      if (decor) decor.style.height = '4200px';
      if (chatWrap) chatWrap.scrollTop = chatWrap.scrollHeight;
    });
    await page.click('#newChat');
    await page.click('.tab[data-panel="chat"]');
    await waitForPagePredicate(page, () => {
      const chat = document.querySelector('#chat');
      const chatWrap = document.querySelector('#chatWrap');
      const decor = document.querySelector('.cyber-decor');
      const turns = document.querySelector('#turnsValue')?.textContent || '';
      const decorHeight = Number.parseInt(decor?.style?.height || '0', 10);
      return !chat?.textContent?.trim()
        && turns === '0'
        && decorHeight <= Number(chatWrap?.clientHeight || 0) + 1
        && Number(chatWrap?.scrollTop || 0) <= 1;
    }, undefined, { timeout: 10000 });
    const newChatDebug = await page.evaluate(() => {
      const chatWrap = document.querySelector('#chatWrap');
      const decor = document.querySelector('.cyber-decor');
      return {
        decorHeight: Number.parseInt(decor?.style?.height || '0', 10),
        clientHeight: Number(chatWrap?.clientHeight || 0),
        scrollHeight: Number(chatWrap?.scrollHeight || 0),
        scrollTop: Number(chatWrap?.scrollTop || 0),
      };
    });
    report.checks.push({
      name: 'new_chat_resets_transcript_turns_and_stale_scroll_height',
      ok: true,
      ...newChatDebug,
    });
    persistReport(report);

    if (!IMAGE_ONLY) {
      report.currentStep = 'folder_attachment_prepares_and_sends_bounded_bundle';
      persistReport(report);
      console.log('Checking selected text-folder attachment...');
      await page.setInputFiles('#folderInput', folderFixturePath);
      await waitForPagePredicate(page, () => {
        const preview = document.querySelector('#filePreview');
        const name = document.querySelector('#filePreviewName')?.textContent || '';
        const meta = document.querySelector('#filePreviewMeta')?.textContent || '';
        return preview?.hidden === false && /attachment-folder folder/i.test(name) && /2\/2 text files/i.test(meta);
      }, undefined, { timeout: 10000 });
      const folderPreviewDebug = await page.evaluate(() => ({
        name: String(document.querySelector('#filePreviewName')?.textContent || ''),
        meta: String(document.querySelector('#filePreviewMeta')?.textContent || ''),
        notice: String(document.querySelector('#composerNotice')?.textContent || ''),
      }));
      report.checks.push({
        ...folderPreviewDebug,
        name: 'folder_attachment_prepares_visible_bounded_bundle',
        ok: /attachment-folder folder/i.test(folderPreviewDebug.name)
          && /2\/2 text files/i.test(folderPreviewDebug.meta)
          && /sent only with this turn/i.test(folderPreviewDebug.notice),
      });
      await page.screenshot({ path: ATTACHMENT_SCREENSHOT_PATH, fullPage: true });
      report.attachmentScreenshot = ATTACHMENT_SCREENSHOT_PATH;
      persistReport(report);

      const folderTurnsBefore = Number(await page.textContent('#turnsValue')) || 0;
      await page.fill('#composer', 'Summarize the selected folder.');
      await page.click('#send');
      await waitForPagePredicate(page, ({ storageKey, minTurns }) => {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return false;
        try {
          const snapshot = JSON.parse(raw);
          const messages = Array.isArray(snapshot?.messages) ? snapshot.messages : [];
          const latestAssistant = [...messages].reverse().find(message => message?.role === 'assistant');
          const latestUser = [...messages].reverse().find(message => message?.role === 'user');
          return Number(snapshot?.turns || 0) >= minTurns
            && latestAssistant?.streaming !== true
            && String(latestAssistant?.content || '').trim().length > 0
            && /attachment-folder\.folder\.md/i.test(String(latestUser?.fileMeta?.name || ''));
        } catch {
          return false;
        }
      }, { storageKey: STORAGE_KEY, minTurns: Math.max(1, folderTurnsBefore + 1) }, { timeout: 20000 });
      const folderRequestDebug = await page.evaluate(() => window.__pennyDebug?.lastChatFetch?.requestAttachment || null);
      report.checks.push({
        name: 'folder_attachment_reaches_mock_transport_as_current_turn_bundle',
        ok: folderRequestDebug?.folderBundle === true
          && /attachment-folder\.folder\.md/i.test(String(folderRequestDebug?.fileName || '')),
        folderBundleSeen: folderRequestDebug?.folderBundle === true,
        fileName: String(folderRequestDebug?.fileName || ''),
      });
      persistReport(report);
    }

    report.currentStep = 'history_architecture_truth_answer';
    persistReport(report);
    console.log('Checking deterministic recent-history architecture truth...');
    const historyCapabilityChatRequestsBefore = mockLmStudio.stats.chatRequests;
    await page.fill('#composer', 'Do you always remember the last five turns?');
    await page.click('#send');
    await waitForPagePredicate(page, (storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      try {
        const snapshot = JSON.parse(raw);
        const last = snapshot?.messages?.[snapshot.messages.length - 1];
        const text = String(last?.content || '');
        return last?.role === 'assistant'
          && last?.streaming !== true
          && /do not have one fixed .*last N turns.* rule/i.test(text)
          && /message entries, not conversational turns/i.test(text)
          && /casual chat 6/i.test(text)
          && /memory-heavy recall 10/i.test(text)
          && !/\blast five turns\b/i.test(text);
      } catch {
        return false;
      }
    }, STORAGE_KEY, { timeout: 15000 });
    const historyCapabilityInspector = await page.evaluate(async (storageKey) => {
      const snapshot = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      const sessionId = String(snapshot?.memory?.sessionId || '').trim();
      if (!sessionId) throw new Error('Current browser session id is missing.');
      const response = await fetch(`/api/penny/memory/inspector?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    }, STORAGE_KEY);
    const historyCapabilityArtifact = historyCapabilityInspector?.inspector?.artifact || null;
    report.checks.push({
      name: 'history_architecture_answer_is_truthful_deterministic_and_model_free',
      ok: mockLmStudio.stats.chatRequests === historyCapabilityChatRequestsBefore
        && historyCapabilityArtifact?.scope?.selectedLane === 'tool'
        && historyCapabilityArtifact?.executionPath === 'deterministic-tool'
        && historyCapabilityArtifact?.readiness?.modelUsage === 'not-used',
      modelChatRequestsBefore: historyCapabilityChatRequestsBefore,
      modelChatRequestsAfter: mockLmStudio.stats.chatRequests,
      selectedLane: historyCapabilityArtifact?.scope?.selectedLane || '',
      executionPath: historyCapabilityArtifact?.executionPath || '',
      modelUsage: historyCapabilityArtifact?.readiness?.modelUsage || '',
    });
    persistReport(report);

    report.currentStep = 'streaming_preserves_manual_scroll';
    persistReport(report);
    console.log('Checking manual scroll ownership during streaming...');
    await page.fill('#composer', 'Run the streaming scroll ownership check.');
    await page.click('#send');
    await waitForPagePredicate(page, () => {
      const chatWrap = document.querySelector('#chatWrap');
      const assistantRow = document.querySelector('#chat .msg-row.assistant.streaming');
      return !!assistantRow
        && Number(chatWrap?.scrollHeight || 0) - Number(chatWrap?.clientHeight || 0) > 80;
    }, undefined, { timeout: 10000 });
    await page.evaluate(() => {
      const chatWrap = document.querySelector('#chatWrap');
      if (chatWrap) chatWrap.scrollTop = 0;
    });
    await page.waitForTimeout(500);
    const streamingScrollDebug = await page.evaluate(() => {
      const chatWrap = document.querySelector('#chatWrap');
      return {
        stillStreaming: !!document.querySelector('#chat .msg-row.assistant.streaming'),
        scrollTop: Number(chatWrap?.scrollTop || 0),
        scrollHeight: Number(chatWrap?.scrollHeight || 0),
        clientHeight: Number(chatWrap?.clientHeight || 0),
      };
    });
    if (!streamingScrollDebug.stillStreaming || streamingScrollDebug.scrollTop > 1) {
      throw new Error(`Streaming overrode manual scroll: ${JSON.stringify(streamingScrollDebug)}`);
    }
    report.checks.push({
      name: 'streaming_preserves_manual_upward_scroll',
      ok: true,
      ...streamingScrollDebug,
    });
    persistReport(report);
    await waitForPagePredicate(page, (storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      try {
        const snapshot = JSON.parse(raw);
        const last = snapshot?.messages?.[snapshot.messages.length - 1];
        return last?.role === 'assistant' && last?.streaming !== true;
      } catch {
        return false;
      }
    }, STORAGE_KEY, { timeout: 15000 });

    report.currentStep = 'provider_privacy_error_boundary';
    persistReport(report);
    console.log('Checking provider privacy boundary across browser, storage, and logs...');
    await page.fill('#composer', 'Run the privacy error boundary fixture.');
    await page.click('#send');
    await waitForPagePredicate(page, (storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      try {
        const snapshot = JSON.parse(raw);
        const last = snapshot?.messages?.[snapshot.messages.length - 1];
        return last?.role === 'assistant'
          && last?.streaming !== true
          && /could not complete that model request/i.test(String(last?.content || ''));
      } catch {
        return false;
      }
    }, STORAGE_KEY, { timeout: 15000 });
    await page.waitForTimeout(500);
    const privacyBrowserSinks = await page.evaluate((storageKey) => ({
      domText: String(document.documentElement?.innerText || ''),
      localStorage: String(window.localStorage.getItem(storageKey) || ''),
      debug: JSON.stringify(window.__pennyDebug || {}),
    }), STORAGE_KEY);
    const privacyDiskSinks = [
      SERVER_STDOUT_PATH,
      SERVER_STDERR_PATH,
      memoryFile,
      archiveFile,
      embeddingsFile,
    ].map((filePath) => {
      try {
        return fs.readFileSync(filePath, 'utf8');
      } catch {
        return '';
      }
    });
    const privacySinkText = JSON.stringify({
      browser: privacyBrowserSinks,
      disk: privacyDiskSinks,
    });
    const leakedCanaries = PRIVACY_CANARIES.filter(canary => privacySinkText.includes(canary));
    if (leakedCanaries.length) {
      throw new Error(`Provider privacy canary reached a public or persistent sink: ${leakedCanaries.join(', ')}`);
    }
    report.checks.push({
      name: 'provider_privacy_boundary_dom_storage_debug_logs_and_memory',
      ok: true,
      sinkCount: 8,
      canonicalErrorVisible: /could not complete that model request/i.test(privacyBrowserSinks.domText),
    });
    persistReport(report);

    report.currentStep = 'clear_memory_resets_override_and_turns';
    persistReport(report);
    console.log('Checking clear-memory reset...');
    await page.click('.tab[data-panel="settings"]');
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

    const failedChecks = report.checks.filter((check) => check?.ok !== true);
    if (failedChecks.length) {
      throw new Error(`Browser smoke checks failed: ${failedChecks.map((check) => check?.name || 'unnamed').join(', ')}`);
    }

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
    browser = null;
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
    if (browser) {
      await browser.close().catch(() => {});
    }
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
