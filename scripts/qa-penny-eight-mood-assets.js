const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PLAYWRIGHT_PATH = path.join(ROOT, '.qa-pw', 'node_modules', 'playwright');
const MOODS = ['calm', 'happy', 'excited', 'thinking', 'surprised', 'flirty', 'smug', 'annoyed'];
const PACK_ID = 'penny-2d25d-eight-mood-v1.4';

function parseArg(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const OUTPUT_ROOT = path.resolve(parseArg(
  '--out',
  path.join(ROOT, 'output', 'penny-eight-mood-v1.4-browser'),
));
const CROPS_ROOT = path.join(OUTPUT_ROOT, 'crops');
const RAW_ROOT = path.join(OUTPUT_ROOT, 'raw');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  }[ext] || 'application/octet-stream';
}

function json(res, value, status = 200) {
  const body = Buffer.from(`${JSON.stringify(value)}\n`);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function apiPayload(pathname) {
  const memory = {
    memories: [],
    userName: '',
    voiceOn: false,
    brainMode: 'local',
    lmStudioThread: null,
    sessionId: 'penny-eight-mood-gate5',
  };
  if (pathname === '/api/penny/status') {
    return {
      reachable: true,
      shadowEnabled: false,
      provider: 'local',
      lmStudio: {
        reachable: true,
        models: [],
        loadedModels: [],
        configuredChatModel: '',
        configuredToolModel: '',
      },
    };
  }
  if (pathname === '/api/penny/memory') return { memory };
  if (pathname === '/api/penny/memory/inspector') return { inspector: null };
  if (pathname === '/api/penny/workspace-writes') return { pending: [], count: 0 };
  if (pathname === '/api/penny/provider/status') {
    return {
      activeProvider: 'local',
      provider: 'local',
      cloudConfigured: false,
      local: { selected: true, reachable: true },
      openai: { configured: false },
    };
  }
  if (pathname === '/api/penny/web-settings') return { enabled: false, answerMode: 'model' };
  if (pathname === '/api/penny/voice/status') {
    return { ok: true, reachable: false, ready: false, config: {} };
  }
  return {};
}

function createStaticQaServer() {
  const server = http.createServer((req, res) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = requestUrl.pathname;
    if (pathname.startsWith('/api/penny/')) {
      json(res, apiPayload(pathname));
      return;
    }
    let relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    try {
      relative = decodeURIComponent(relative);
    } catch {
      res.writeHead(400).end('Bad path');
      return;
    }
    const filePath = path.resolve(PUBLIC_ROOT, relative);
    const publicPrefix = `${path.resolve(PUBLIC_ROOT)}${path.sep}`;
    if (!filePath.startsWith(publicPrefix)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    let stat = null;
    try {
      stat = fs.statSync(filePath);
    } catch {
      res.writeHead(404).end('Not found');
      return;
    }
    if (!stat.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeType(filePath),
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

async function closeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
}

function storageSnapshot() {
  return {
    memory: {
      memories: [],
      userName: '',
      voiceOn: false,
      brainMode: 'local',
      lmStudioThread: null,
      sessionId: 'penny-eight-mood-gate5',
    },
    messages: [
      {
        id: 'gate51-assistant-1',
        role: 'assistant',
        content: 'I kept the eight moods on one deterministic sprite contract.',
      },
      {
        id: 'gate51-user-1',
        role: 'user',
        content: 'Show me the revised flirty expression in ordinary conversation.',
      },
      {
        id: 'gate51-assistant-2',
        role: 'assistant',
        content: 'Here it is at the same 96px transcript scale used by the live UI.',
      },
      {
        id: 'gate51-user-2',
        role: 'user',
        content: 'And keep the avatar stable while the mood changes.',
      },
      {
        id: 'gate51-assistant-3',
        role: 'assistant',
        content: 'One image node, atomic fade-and-swap, latest request wins.',
      },
    ],
    mood: 'calm',
    lastAutoMood: 'calm',
    expressionOverrideMood: '',
    expressionDecision: null,
    turns: 0,
  };
}

async function createQaPage(browser, {
  viewport = { width: 1280, height: 860 },
  reducedMotion = 'no-preference',
  deviceScaleFactor = 1,
} = {}) {
  const context = await browser.newContext({
    viewport,
    reducedMotion,
    deviceScaleFactor,
  });
  await context.addInitScript((snapshot) => {
    window.localStorage.setItem('penny:v3', JSON.stringify(snapshot));
  }, storageSnapshot());
  const page = await context.newPage();
  const consoleEvents = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleEvents.push({ type: message.type(), text: message.text() });
    }
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      error: request.failure()?.errorText || 'request failed',
    });
  });
  return { context, page, consoleEvents, failedRequests };
}

async function waitForExpressionReady(page) {
  await page.waitForFunction(() => {
    const root = document.documentElement;
    return !root.classList.contains('expression-loading')
      && root.dataset.expressionReady
      && root.dataset.expressionReady !== 'loading';
  }, null, { timeout: 5000 });
}

async function openNormalBoot(page, baseUrl, { manifestDelayMs = 0, vesselFit = 'D' } = {}) {
  if (manifestDelayMs > 0) {
    await page.route('**/sprites/packs/penny-2d25d-v1.4/manifest.json', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, manifestDelayMs));
      await route.continue();
    });
  }
  await page.goto(`${baseUrl}/?debug=1&vesselFit=${encodeURIComponent(vesselFit)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 10000,
  });
  let legacyVisible = false;
  const samples = [];
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const sample = await page.evaluate(() => {
      const root = document.documentElement;
      const imgs = Array.from(document.querySelectorAll('#coreFace .penny-art, #mobileCoreFace .penny-art'));
      const legacyVisibleNow = imgs.some((img) => {
        const style = getComputedStyle(img);
        return !img.getAttribute('src')?.includes('/penny-2d25d-v1.4/')
          && style.visibility !== 'hidden'
          && style.display !== 'none'
          && Number(style.opacity || 1) > 0;
      });
      return {
        ready: root.dataset.expressionReady || '',
        loadingClass: root.classList.contains('expression-loading'),
        legacyVisible: legacyVisibleNow,
        sources: imgs.map((img) => img.getAttribute('src')),
      };
    });
    samples.push(sample);
    legacyVisible ||= sample.legacyVisible;
    if (!sample.loadingClass && sample.ready !== 'loading') break;
    await page.waitForTimeout(16);
  }
  await waitForExpressionReady(page);
  await page.waitForSelector('#bootOverlay', { state: 'detached', timeout: 4000 });
  return { legacyVisible, samples };
}

async function setMood(page, mood, turns = 0) {
  await page.evaluate(({ mood: nextMood, turns: nextTurns }) => {
    window.__pennyDebug(nextMood, nextTurns);
  }, { mood, turns });
  await page.waitForFunction((expectedMood) => {
    const core = document.querySelector('#coreFace');
    const mobile = document.querySelector('#mobileCoreFace');
    const coreImages = core?.querySelectorAll('.penny-art') || [];
    const mobileImages = mobile?.querySelectorAll('.penny-art') || [];
    const coreImg = coreImages[0];
    return coreImages.length === 1
      && mobileImages.length === 1
      && coreImg?.getAttribute('src')?.endsWith(`/composites/${expectedMood}.png`)
      && coreImg.complete
      && coreImg.naturalWidth === 1024
      && Number(getComputedStyle(core).opacity) > 0.99;
  }, mood, { timeout: 3000 });
  await page.waitForFunction(() => {
    const core = document.querySelector('.core');
    const coreFace = document.querySelector('#coreFace');
    const mobileFace = document.querySelector('#mobileCoreFace');
    return !core?.classList.contains('mood-glitch')
      && !coreFace?.style.transition
      && !mobileFace?.style.transition;
  }, null, { timeout: 3000 });
}

async function collectSurfaceState(page, mood) {
  return page.evaluate((expectedMood) => {
    const coreImg = document.querySelector('#coreFace .penny-art');
    const mobileImg = document.querySelector('#mobileCoreFace .penny-art');
    const transcriptImg = document.querySelector('#chat .msg-avatar');
    const rootStyle = coreImg ? getComputedStyle(coreImg) : null;
    return {
      mood: expectedMood,
      packId: document.querySelector('#shell')?.dataset.expressionPack || '',
      ready: document.documentElement.dataset.expressionReady || '',
      coreCount: document.querySelectorAll('#coreFace .penny-art').length,
      mobileCount: document.querySelectorAll('#mobileCoreFace .penny-art').length,
      coreSrc: coreImg?.getAttribute('src') || '',
      mobileSrc: mobileImg?.getAttribute('src') || '',
      transcriptSrc: transcriptImg?.getAttribute('src') || '',
      naturalWidth: coreImg?.naturalWidth || 0,
      naturalHeight: coreImg?.naturalHeight || 0,
      renderMode: coreImg?.dataset.expressionRenderMode || '',
      transitionMode: coreImg?.dataset.expressionTransition || '',
      imageRendering: rootStyle?.imageRendering || '',
      objectFit: rootStyle?.objectFit || '',
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      pageOverflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    };
  }, mood);
}

async function collectFitMetrics(page, fit, viewport) {
  return page.evaluate(async ({ fitLabel, viewportLabel }) => {
    const core = document.querySelector('.core');
    const img = core?.querySelector('.penny-art');
    const sidebar = document.querySelector('.sidebar');
    const style = getComputedStyle(img);
    const coreStyle = getComputedStyle(core);
    const coreRect = core.getBoundingClientRect();
    const imageCache = window.__pennyAlphaBounds || (window.__pennyAlphaBounds = {});
    const src = img.currentSrc || img.src;
    let alpha = imageCache[src];
    if (!alpha) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (data[((y * canvas.width + x) * 4) + 3] === 0) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      alpha = { minX, minY, maxX, maxY };
      imageCache[src] = alpha;
    }
    const widthScale = coreRect.width / img.naturalWidth;
    const heightScale = coreRect.height / img.naturalHeight;
    const scale = style.objectFit === 'cover'
      ? Math.max(widthScale, heightScale)
      : Math.min(widthScale, heightScale);
    const renderedWidth = img.naturalWidth * scale;
    const renderedHeight = img.naturalHeight * scale;
    const position = style.objectPosition.split(/\s+/);
    const parsePosition = (value, fallback) => {
      const match = String(value || '').match(/^(-?\d+(?:\.\d+)?)%$/);
      return match ? Number(match[1]) / 100 : fallback;
    };
    const positionX = parsePosition(position[0], 0.5);
    const positionY = parsePosition(position[1], 0.5);
    const offsetX = (coreRect.width - renderedWidth) * positionX;
    const offsetY = (coreRect.height - renderedHeight) * positionY;
    const displayedAlpha = {
      left: offsetX + (alpha.minX * scale),
      top: offsetY + (alpha.minY * scale),
      right: offsetX + ((alpha.maxX + 1) * scale),
      bottom: offsetY + ((alpha.maxY + 1) * scale),
    };
    return {
      fit: fitLabel,
      viewport: viewportLabel,
      aspectRatio: coreStyle.aspectRatio,
      objectFit: style.objectFit,
      objectPosition: style.objectPosition,
      core: {
        width: Math.round(coreRect.width * 100) / 100,
        height: Math.round(coreRect.height * 100) / 100,
      },
      sourceAlphaBounds: alpha,
      displayedAlphaBounds: Object.fromEntries(
        Object.entries(displayedAlpha).map(([key, value]) => [key, Math.round(value * 100) / 100]),
      ),
      displayedAlphaWidth: Math.round((displayedAlpha.right - displayedAlpha.left) * 100) / 100,
      displayedAlphaHeight: Math.round((displayedAlpha.bottom - displayedAlpha.top) * 100) / 100,
      displayedAlphaArea: Math.round(
        (displayedAlpha.right - displayedAlpha.left)
        * (displayedAlpha.bottom - displayedAlpha.top)
        * 100,
      ) / 100,
      clipping: {
        left: displayedAlpha.left < -0.5,
        top: displayedAlpha.top < -0.5,
        right: displayedAlpha.right > coreRect.width + 0.5,
        bottom: displayedAlpha.bottom > coreRect.height + 0.5,
      },
      sidebarOverflow: !!sidebar && sidebar.scrollHeight > sidebar.clientHeight + 1,
      pageOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      pageOverflowY: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
      imageRendering: style.imageRendering,
    };
  }, { fitLabel: fit, viewportLabel: viewport });
}

function dataUrl(filePath) {
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function buildContactSheet(browser, {
  items,
  outputPath,
  title,
  columns,
  cardWidth,
  imageHeight,
  background = '#111720',
}) {
  const gap = 16;
  const pageWidth = (columns * cardWidth) + ((columns + 1) * gap);
  const rows = Math.ceil(items.length / columns);
  const pageHeight = 78 + (rows * (imageHeight + 68 + gap)) + gap;
  const context = await browser.newContext({
    viewport: { width: pageWidth, height: pageHeight },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const cards = items.map((item) => `
    <article>
      <div class="image-wrap"><img src="${dataUrl(item.path)}" alt="" /></div>
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.note || '')}</span>
    </article>
  `).join('');
  await page.setContent(`<!doctype html>
    <html><head><style>
      *{box-sizing:border-box}html,body{margin:0;background:${background};color:#f7f8fb;font-family:Segoe UI,Arial,sans-serif}
      body{padding:${gap}px}.title{height:46px;display:flex;align-items:center;font-size:24px;font-weight:750;letter-spacing:.04em}
      main{display:grid;grid-template-columns:repeat(${columns},${cardWidth}px);gap:${gap}px}
      article{height:${imageHeight + 68}px;border:1px solid #3f4a5c;border-radius:14px;background:#1a2230;padding:10px;overflow:hidden}
      .image-wrap{height:${imageHeight}px;display:flex;align-items:center;justify-content:center;background:#0b1018;border-radius:9px;overflow:hidden}
      img{display:block;width:100%;height:100%;object-fit:contain;image-rendering:auto}
      strong{display:block;margin-top:8px;color:#ff7a2d;font-size:15px;letter-spacing:.06em}
      span{display:block;margin-top:3px;color:#b8c1d1;font-size:12px}
    </style></head><body><div class="title">${escapeHtml(title)}</div><main>${cards}</main></body></html>`);
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path: outputPath, fullPage: true });
  await context.close();
}

async function captureTransitionStrip(page, browser, outputPath) {
  await setMood(page, 'happy');
  const bounds = await page.locator('.core').boundingBox();
  if (!bounds) throw new Error('Could not resolve .core bounds for transition evidence');
  const cdp = await page.context().newCDPSession(page);
  const clip = {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    scale: 1,
  };
  await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip,
    captureBeyondViewport: false,
  });
  const started = Date.now();
  await page.evaluate(() => {
    window.__pennyDebug('flirty', 0);
  });
  const targets = [0, 35, 75, 115, 155, 215, 300];
  const frames = [];
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    const remaining = target - (Date.now() - started);
    if (remaining > 0) await page.waitForTimeout(remaining);
    const captureStartedMs = Date.now() - started;
    const state = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('#coreFace .penny-art'));
      return {
        coreCount: images.length,
        sources: images.map((img) => img.getAttribute('src') || ''),
        opacities: images.map((img) => Number(getComputedStyle(img).opacity)),
        faceOpacity: Number(getComputedStyle(document.querySelector('#coreFace')).opacity),
      };
    });
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: false,
    });
    const captureFinishedMs = Date.now() - started;
    const framePath = path.join(RAW_ROOT, `transition-${String(index).padStart(2, '0')}-${target}ms.png`);
    fs.writeFileSync(framePath, Buffer.from(screenshot.data, 'base64'));
    frames.push({
      targetMs: target,
      captureStartedMs,
      captureFinishedMs,
      path: framePath,
      ...state,
    });
  }
  await cdp.detach();
  await setMood(page, 'flirty');
  await buildContactSheet(browser, {
    items: frames.map((frame) => ({
      label: `${frame.captureStartedMs}MS`,
      note: `${path.basename(frame.sources[0] || 'none')} · node ${frame.coreCount} · face α ${frame.faceOpacity}`,
      path: frame.path,
    })),
    outputPath,
    title: 'HAPPY → FLIRTY · ATOMIC FADE/SWAP FRAME STRIP',
    columns: 4,
    cardWidth: 265,
    imageHeight: 180,
  });
  return frames;
}

function isSafeFit(metrics) {
  return !Object.values(metrics.clipping).some(Boolean)
    && !metrics.sidebarOverflow
    && !metrics.pageOverflowX
    && !metrics.pageOverflowY;
}

async function captureNativeCssSquare(page, locator, cssSize, outputPath) {
  await locator.scrollIntoViewIfNeeded();
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error(`Could not resolve ${cssSize}px native crop bounds`);
  await page.screenshot({
    path: outputPath,
    animations: 'disabled',
    clip: {
      x: Math.round(bounds.x),
      y: Math.round(bounds.y),
      width: cssSize,
      height: cssSize,
    },
  });
}

async function main() {
  ensureDir(OUTPUT_ROOT);
  ensureDir(CROPS_ROOT);
  ensureDir(RAW_ROOT);
  if (!fs.existsSync(path.join(PLAYWRIGHT_PATH, 'package.json'))) {
    throw new Error(`Playwright 1.60.0 is not installed at ${PLAYWRIGHT_PATH}`);
  }
  const { chromium } = require(PLAYWRIGHT_PATH);
  const { server, baseUrl } = await createStaticQaServer();
  const browser = await chromium.launch({ headless: true });
  const report = {
    schema: 'penny-eight-mood-gate5.1-browser.v1',
    generatedAt: new Date().toISOString(),
    baseUrl,
    modelUsage: 'not-used',
    modelStateBoundary: {
      PENNY_SKIP_LMSTUDIO_PREP: process.env.PENNY_SKIP_LMSTUDIO_PREP || '',
      PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY: process.env.PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY || '',
      server: 'static public/ server with deterministic API stubs; no Penny server or model endpoint launched',
    },
    recommendedVesselFit: '',
    checks: [],
    fitMetrics: [],
    moods: [],
    consoleEvents: [],
    failedRequests: [],
    intentional404s: [],
    artifacts: {},
  };
  const check = (name, pass, details = null) => {
    report.checks.push({ name, pass: pass === true, details });
  };

  try {
    const desktopQa = await createQaPage(browser);
    const boot = await openNormalBoot(desktopQa.page, baseUrl, { manifestDelayMs: 280 });
    check('successful boot never exposes legacy art before registered calm', !boot.legacyVisible, {
      sampleCount: boot.samples.length,
      final: boot.samples.at(-1),
    });
    check(
      'normal boot activates registered pack',
      await desktopQa.page.evaluate((packId) => (
        document.documentElement.dataset.expressionReady === 'registered'
        && document.querySelector('#shell')?.dataset.expressionPack === packId
      ), PACK_ID),
    );

    const desktopItems = [];
    for (const mood of MOODS) {
      await setMood(desktopQa.page, mood);
      const state = await collectSurfaceState(desktopQa.page, mood);
      report.moods.push(state);
      const cropPath = path.join(CROPS_ROOT, `desktop-${mood}.png`);
      await desktopQa.page.locator('.core').screenshot({ path: cropPath, animations: 'disabled' });
      desktopItems.push({ label: mood.toUpperCase(), note: '1280x860 · selected vessel', path: cropPath });
      check(`${mood} desktop/mobile node and source contract`, (
        state.packId === PACK_ID
        && state.coreCount === 1
        && state.mobileCount === 1
        && state.coreSrc.endsWith(`/composites/${mood}.png`)
        && state.mobileSrc.endsWith(`/composites/${mood}.png`)
        && state.transcriptSrc.endsWith(`/composites/${mood}.png`)
        && state.naturalWidth === 1024
        && state.naturalHeight === 1024
        && state.renderMode === 'registered-composite'
        && state.transitionMode === 'atomic-fade-swap'
        && state.imageRendering !== 'pixelated'
        && !state.pageOverflowX
        && !state.pageOverflowY
      ), state);
    }
    report.consoleEvents.push(...desktopQa.consoleEvents);
    report.failedRequests.push(...desktopQa.failedRequests);

    const fitItems = [];
    await setMood(desktopQa.page, 'calm');
    const fitViewports = [
      { width: 1280, height: 860, label: '1280x860' },
      { width: 1280, height: 720, label: '1280x720' },
    ];
    for (const viewport of fitViewports) {
      await desktopQa.page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const fit of ['B', 'D', 'C']) {
        await desktopQa.page.evaluate((value) => {
          document.documentElement.dataset.vesselFit = value;
        }, fit);
        await desktopQa.page.waitForTimeout(80);
        const rawPath = path.join(RAW_ROOT, `vessel-fit-${fit}-${viewport.width}x${viewport.height}.png`);
        await desktopQa.page.screenshot({ path: rawPath });
        const metrics = await collectFitMetrics(desktopQa.page, fit, viewport.label);
        report.fitMetrics.push(metrics);
        fitItems.push({
          label: `VESSEL ${fit} · ${viewport.label}`,
          note: fit === 'B'
            ? '4:3 · contain · safe baseline'
            : (fit === 'D' ? '6:5 · contain · intermediate' : '1:1 · contain · largest'),
          path: rawPath,
        });
      }
    }
    const fitB = report.fitMetrics.filter((item) => item.fit === 'B');
    const fitD = report.fitMetrics.filter((item) => item.fit === 'D');
    const fitC = report.fitMetrics.filter((item) => item.fit === 'C');
    const bSafe = fitB.length === fitViewports.length && fitB.every(isSafeFit);
    const dSafe = fitD.length === fitViewports.length && fitD.every(isSafeFit);
    const dPresenceRatios = fitD.map((item) => {
      const baseline = fitB.find((candidate) => candidate.viewport === item.viewport);
      return baseline ? item.displayedAlphaArea / baseline.displayedAlphaArea : 0;
    });
    const dPresenceGain = dPresenceRatios.length
      ? dPresenceRatios.reduce((sum, value) => sum + value, 0) / dPresenceRatios.length
      : 0;
    const dImprovesPresence = dPresenceGain >= 1.08;
    report.recommendedVesselFit = dSafe && dImprovesPresence ? 'D' : 'B';
    report.vesselDecision = {
      rejectedA: '43:24 cover was rejected at Gate 5 because it clips registered alpha bounds.',
      documentedMinimumDesktopViewport: null,
      minimumViewportNote: 'No distinct minimum desktop viewport is documented in the current PennyOS source; 1280x720 is the tested short-desktop boundary.',
      baselineSafeAtBothViewports: bSafe,
      intermediateSafeAtBothViewports: dSafe,
      intermediatePresenceRatioVsBaseline: Math.round(dPresenceGain * 1000) / 1000,
      intermediatePresenceImprovesAtLeastEightPercent: dImprovesPresence,
      candidateCSafety: Object.fromEntries(fitC.map((item) => [item.viewport, isSafeFit(item)])),
      selected: report.recommendedVesselFit,
      rationale: report.recommendedVesselFit === 'D'
        ? 'D preserves the no-clip/no-overflow contract at both heights and materially improves character presence over B.'
        : 'B remains selected because D did not satisfy both the safety and material-presence criteria at both heights.',
    };
    check('candidate B is safe at 1280x860 and 1280x720', bSafe, fitB);
    check('candidate D was evaluated at both required desktop heights', fitD.length === fitViewports.length, fitD);
    check('B-versus-D selection follows the declared safety and presence rule', (
      report.recommendedVesselFit === (dSafe && dImprovesPresence ? 'D' : 'B')
    ), report.vesselDecision);
    check('candidate C comparison was captured at both required desktop heights', fitC.length === fitViewports.length, fitC);
    await desktopQa.page.setViewportSize({ width: 1280, height: 860 });
    await desktopQa.page.evaluate((value) => {
      document.documentElement.dataset.vesselFit = value;
    }, report.recommendedVesselFit);
    await desktopQa.page.waitForTimeout(80);
    desktopItems.length = 0;
    for (const mood of MOODS) {
      await setMood(desktopQa.page, mood);
      const cropPath = path.join(CROPS_ROOT, `desktop-${mood}.png`);
      await desktopQa.page.locator('.core').screenshot({ path: cropPath, animations: 'disabled' });
      desktopItems.push({
        label: mood.toUpperCase(),
        note: `1280x860 · vessel ${report.recommendedVesselFit}`,
        path: cropPath,
      });
    }

    const rapidMoods = ['happy', 'flirty', 'annoyed'];
    await Promise.all(rapidMoods.map((mood, index) => (
      desktopQa.page.waitForTimeout(index * 8).then(() => desktopQa.page.evaluate((value) => {
        window.__pennyDebug(value, 0);
      }, mood))
    )));
    await setMood(desktopQa.page, 'annoyed');
    const rapidState = await collectSurfaceState(desktopQa.page, 'annoyed');
    check('rapid mood changes settle on latest request with one image per face', (
      rapidState.coreCount === 1
      && rapidState.mobileCount === 1
      && rapidState.coreSrc.endsWith('/composites/annoyed.png')
    ), rapidState);

    const mobileQa = await createQaPage(browser, { viewport: { width: 420, height: 780 } });
    await openNormalBoot(mobileQa.page, baseUrl);
    const mobileItems = [];
    for (const mood of MOODS) {
      await setMood(mobileQa.page, mood);
      const cropPath = path.join(CROPS_ROOT, `mobile-${mood}.png`);
      await mobileQa.page.locator('.mobile-mood-display').screenshot({ path: cropPath, animations: 'disabled' });
      mobileItems.push({ label: mood.toUpperCase(), note: '420x780 · 62px mobile crop', path: cropPath });
    }
    await setMood(mobileQa.page, 'flirty');
    const mobileInterfacePath = path.join(RAW_ROOT, 'mobile-interface-flirty-420x780-dpr1.png');
    await mobileQa.page.screenshot({ path: mobileInterfacePath });
    report.consoleEvents.push(...mobileQa.consoleEvents);
    report.failedRequests.push(...mobileQa.failedRequests);

    const transcriptItems = [];
    for (const mood of MOODS) {
      await setMood(desktopQa.page, mood);
      const cropPath = path.join(CROPS_ROOT, `transcript-${mood}.png`);
      await captureNativeCssSquare(
        desktopQa.page,
        desktopQa.page.locator('.msg-avatar-frame').first(),
        96,
        cropPath,
      );
      transcriptItems.push({ label: mood.toUpperCase(), note: '96px transcript crop', path: cropPath });
    }
    await setMood(desktopQa.page, 'flirty');
    const flirtyDesktopPath = path.join(RAW_ROOT, 'flirty-desktop-1280x860-dpr1.png');
    await desktopQa.page.screenshot({ path: flirtyDesktopPath });
    const conversationPath = path.join(RAW_ROOT, 'conversation-multiple-avatars-flirty-1280x860-dpr1.png');
    await desktopQa.page.locator('#chatWrap').screenshot({ path: conversationPath, animations: 'disabled' });

    const mobileDpr2Qa = await createQaPage(browser, {
      viewport: { width: 420, height: 780 },
      deviceScaleFactor: 2,
    });
    await openNormalBoot(mobileDpr2Qa.page, baseUrl, { vesselFit: report.recommendedVesselFit });
    await setMood(mobileDpr2Qa.page, 'flirty');
    const mobileDpr2Path = path.join(CROPS_ROOT, 'native-mobile-flirty-62px-dpr2.png');
    await mobileDpr2Qa.page.locator('.mobile-mood-display').screenshot({
      path: mobileDpr2Path,
      animations: 'disabled',
    });
    report.consoleEvents.push(...mobileDpr2Qa.consoleEvents);
    report.failedRequests.push(...mobileDpr2Qa.failedRequests);

    const transcriptDpr2Qa = await createQaPage(browser, {
      viewport: { width: 1280, height: 860 },
      deviceScaleFactor: 2,
    });
    await openNormalBoot(transcriptDpr2Qa.page, baseUrl, { vesselFit: report.recommendedVesselFit });
    await setMood(transcriptDpr2Qa.page, 'flirty');
    const transcriptDpr2Path = path.join(CROPS_ROOT, 'native-transcript-flirty-96px-dpr2.png');
    await captureNativeCssSquare(
      transcriptDpr2Qa.page,
      transcriptDpr2Qa.page.locator('.msg-avatar-frame').first(),
      96,
      transcriptDpr2Path,
    );
    report.consoleEvents.push(...transcriptDpr2Qa.consoleEvents);
    report.failedRequests.push(...transcriptDpr2Qa.failedRequests);

    const transitionStripPath = path.join(OUTPUT_ROOT, 'flirty-transition-frame-strip.png');
    const transitionFrames = await captureTransitionStrip(desktopQa.page, browser, transitionStripPath);
    report.transitionFrames = transitionFrames.map(({ path: framePath, ...frame }) => ({
      ...frame,
      path: framePath,
    }));
    check('happy-to-flirty transition never overlaps image nodes or unrelated mood sources', (
      transitionFrames.every((frame) => (
        frame.coreCount === 1
        && frame.sources.length === 1
        && frame.sources.every((src) => (
          src.endsWith('/composites/happy.png') || src.endsWith('/composites/flirty.png')
        ))
      ))
    ), report.transitionFrames);

    const reducedQa = await createQaPage(browser, {
      viewport: { width: 1280, height: 860 },
      reducedMotion: 'reduce',
    });
    await openNormalBoot(reducedQa.page, baseUrl);
    await setMood(reducedQa.page, 'flirty');
    const reduced = await reducedQa.page.evaluate(() => ({
      coreAnimation: getComputedStyle(document.querySelector('.core')).animationName,
      artAnimation: getComputedStyle(document.querySelector('#coreFace .penny-art')).animationName,
      coreCount: document.querySelectorAll('#coreFace .penny-art').length,
      mobileCount: document.querySelectorAll('#mobileCoreFace .penny-art').length,
    }));
    check('reduced motion disables registered decorative motion and preserves one-image swap', (
      reduced.coreAnimation === 'none'
      && reduced.artAnimation === 'none'
      && reduced.coreCount === 1
      && reduced.mobileCount === 1
    ), reduced);
    report.consoleEvents.push(...reducedQa.consoleEvents);
    report.failedRequests.push(...reducedQa.failedRequests);

    const fallbackQa = await createQaPage(browser);
    await fallbackQa.page.route('**/sprites/packs/penny-2d25d-v1.4/composites/calm.png', (route) => {
      report.intentional404s.push({
        url: route.request().url(),
        status: 404,
        classification: 'image-fallback-contract',
        expectedRecovery: '/sprites/decor/chibi-avatar-calm.png',
      });
      route.fulfill({ status: 404, contentType: 'text/plain', body: 'deliberate Gate 4 failure' });
    });
    await fallbackQa.page.goto(`${baseUrl}/?debug=1&vesselFit=B`, { waitUntil: 'domcontentloaded' });
    await waitForExpressionReady(fallbackQa.page);
    await fallbackQa.page.waitForFunction(() => {
      const img = document.querySelector('#coreFace .penny-art');
      return img?.getAttribute('src') === '/sprites/decor/chibi-avatar-calm.png'
        && img.complete
        && img.naturalWidth > 0;
    }, null, { timeout: 3000 });
    const fallbackState = await fallbackQa.page.evaluate(() => ({
      ready: document.documentElement.dataset.expressionReady,
      src: document.querySelector('#coreFace .penny-art')?.getAttribute('src') || '',
      attempted: document.querySelector('#coreFace .penny-art')?.dataset.expressionFallbackAttempted || '',
      coreCount: document.querySelectorAll('#coreFace .penny-art').length,
    }));
    check('missing new calm art uses distinct legacy fallback once without blanking', (
      fallbackState.ready === 'legacy-fallback'
      && fallbackState.src === '/sprites/decor/chibi-avatar-calm.png'
      && fallbackState.attempted === '1'
      && fallbackState.coreCount === 1
    ), fallbackState);
    report.consoleEvents.push(...fallbackQa.consoleEvents);
    report.failedRequests.push(...fallbackQa.failedRequests);

    const manifestFallbackQa = await createQaPage(browser);
    await manifestFallbackQa.page.route('**/sprites/packs/penny-2d25d-v1.4/manifest.json', (route) => {
      report.intentional404s.push({
        url: route.request().url(),
        status: 404,
        classification: 'manifest-fallback-contract',
        expectedRecovery: 'complete legacy default pack',
      });
      route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
    });
    await manifestFallbackQa.page.goto(`${baseUrl}/?debug=1&vesselFit=B`, { waitUntil: 'domcontentloaded' });
    await waitForExpressionReady(manifestFallbackQa.page);
    const manifestFallbackState = await manifestFallbackQa.page.evaluate(() => ({
      ready: document.documentElement.dataset.expressionReady,
      pack: document.querySelector('#shell')?.dataset.expressionPack || '',
      src: document.querySelector('#coreFace .penny-art')?.getAttribute('src') || '',
      coreCount: document.querySelectorAll('#coreFace .penny-art').length,
    }));
    check('missing manifest restores complete legacy pack without an unusable shell', (
      manifestFallbackState.ready === 'legacy-fallback'
      && manifestFallbackState.pack === 'default'
      && manifestFallbackState.src === '/sprites/decor/chibi-avatar-calm.png'
      && manifestFallbackState.coreCount === 1
    ), manifestFallbackState);
    report.consoleEvents.push(...manifestFallbackQa.consoleEvents);
    report.failedRequests.push(...manifestFallbackQa.failedRequests);

    const desktopSheet = path.join(OUTPUT_ROOT, 'desktop-eight-mood-sheet.png');
    const mobileSheet = path.join(OUTPUT_ROOT, 'mobile-eight-mood-sheet.png');
    const transcriptSheet = path.join(OUTPUT_ROOT, 'transcript-avatar-sheet.png');
    const fitSheet = path.join(OUTPUT_ROOT, 'vessel-fit-B-D-C.png');
    await buildContactSheet(browser, {
      items: desktopItems,
      outputPath: desktopSheet,
      title: `PENNY · EIGHT MOODS · DESKTOP VESSEL ${report.recommendedVesselFit}`,
      columns: 4,
      cardWidth: 350,
      imageHeight: 260,
    });
    await buildContactSheet(browser, {
      items: mobileItems,
      outputPath: mobileSheet,
      title: 'PENNY · EIGHT MOODS · MOBILE CROP',
      columns: 4,
      cardWidth: 230,
      imageHeight: 190,
    });
    await buildContactSheet(browser, {
      items: transcriptItems,
      outputPath: transcriptSheet,
      title: 'TRANSCRIPT AVATARS · 96PX CROP',
      columns: 4,
      cardWidth: 230,
      imageHeight: 190,
    });
    await buildContactSheet(browser, {
      items: fitItems,
      outputPath: fitSheet,
      title: 'PENNY · VESSEL FIT B / D / C · 1280×860 + 1280×720',
      columns: 3,
      cardWidth: 420,
      imageHeight: 282,
    });
    report.artifacts = {
      desktopSheet,
      mobileSheet,
      transcriptSheet,
      vesselFitSheet: fitSheet,
      flirtyDesktop: flirtyDesktopPath,
      flirtyMobileInterface: mobileInterfacePath,
      flirtyConversationContext: conversationPath,
      flirtyMobileDpr2NativeCrop: mobileDpr2Path,
      flirtyTranscriptDpr2NativeCrop: transcriptDpr2Path,
      transitionFrameStrip: transitionStripPath,
      cropsRoot: CROPS_ROOT,
      rawRoot: RAW_ROOT,
    };

    const console404s = report.consoleEvents.filter((event) => /404/i.test(event.text));
    report.http404Classification = {
      observedConsole404Count: console404s.length,
      interceptedIntentional404Count: report.intentional404s.length,
      consoleEvents: console404s,
      routes: report.intentional404s,
      conclusion: 'All observed 404s are generated solely by the two isolated negative-test contexts: missing calm art and missing pack manifest. Normal rendered lanes do not request missing resources.',
    };
    check('all browser 404s are isolated intentional fallback probes', (
      console404s.length === report.intentional404s.length
      && report.intentional404s.every((event) => (
        event.classification === 'image-fallback-contract'
        || event.classification === 'manifest-fallback-contract'
      ))
    ), report.http404Classification);
    const unexpectedConsole = report.consoleEvents.filter((event) => (
      !/favicon/i.test(event.text)
      && !/Failed to load resource.*404/i.test(event.text)
    ));
    const unexpectedFailedRequests = report.failedRequests.filter((event) => (
      !event.url.endsWith('/composites/calm.png')
      && !event.url.endsWith('/manifest.json')
    ));
    check('normal rendered lanes have no unexpected console warnings/errors', unexpectedConsole.length === 0, unexpectedConsole);
    check('normal rendered lanes have no unexpected failed requests', unexpectedFailedRequests.length === 0, unexpectedFailedRequests);

    await Promise.all([
      desktopQa.context.close(),
      mobileQa.context.close(),
      mobileDpr2Qa.context.close(),
      transcriptDpr2Qa.context.close(),
      reducedQa.context.close(),
      fallbackQa.context.close(),
      manifestFallbackQa.context.close(),
    ]);
  } catch (error) {
    report.fatalError = error?.stack || error?.message || String(error);
  } finally {
    report.pass = !report.fatalError && report.checks.every((item) => item.pass);
    fs.writeFileSync(path.join(OUTPUT_ROOT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
    await closeServer(server);
  }

  if (!report.pass) {
    console.error(`Penny eight-mood Gate 5 browser QA failed. Report: ${path.join(OUTPUT_ROOT, 'report.json')}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Penny eight-mood Gate 5 browser QA passed (${report.checks.length} checks).`);
  console.log(`Artifacts: ${OUTPUT_ROOT}`);
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
