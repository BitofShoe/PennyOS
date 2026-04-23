const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { buildQaTrace, validateQaTrace } = require('../lib/penny-qa-trace');
const { buildQaTrust, validateRuntimeArtifact } = require('../lib/penny-qa-trust');
const { modelsLookCompatible } = require('../lib/penny-qa-validity');

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

function resolveCompareBackend(value = '') {
  const text = String(value || '').trim().toLowerCase();
  return text === 'real' ? 'real' : 'mock';
}

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const COMPARE_BACKEND = resolveCompareBackend(parseArgValue('backend') || process.env.PENNY_STATIC_LIVE_COMPARE_BACKEND || 'mock');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `static-embedding-live-compare-${COMPARE_BACKEND}-${STAMP}.json`);
const CHAT_MODEL = String(
  process.env.PENNY_STATIC_LIVE_COMPARE_CHAT_MODEL
  || (COMPARE_BACKEND === 'real'
    ? (process.env.PENNY_QA_CHAT_MODEL || process.env.PENNY_LMSTUDIO_CHAT_MODEL || 'unsloth/gemma-4-31b-it@q6_k')
    : 'mock/static-compare-chat'),
).trim();
const TOOL_MODEL = String(process.env.PENNY_STATIC_LIVE_COMPARE_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const EMBED_MODEL = String(process.env.PENNY_STATIC_LIVE_COMPARE_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();
const STATIC_PROVIDER = String(process.env.PENNY_STATIC_LIVE_COMPARE_PROVIDER || 'static').trim();
const TIMEOUT_MS = Number(process.env.PENNY_STATIC_LIVE_COMPARE_TIMEOUT_MS || 120000);
const STARTUP_TIMEOUT_MS = Number(process.env.PENNY_STATIC_LIVE_COMPARE_STARTUP_TIMEOUT_MS || 120000);
const STATIC_READY_TIMEOUT_MS = Number(process.env.PENNY_STATIC_LIVE_COMPARE_STATIC_READY_TIMEOUT_MS || 120000);
const HUMAN_OBSERVABLE_DELTA = Number(process.env.PENNY_STATIC_LIVE_COMPARE_OBSERVABLE_DELTA || 1);
const CASE_PROMPT_SUFFIX = ' Keep it to one short sentence.';

const MODE_CONFIGS = Object.freeze({
  'static-off': Object.freeze({
    key: 'static-off',
    label: 'Static OFF',
    flags: Object.freeze({
      PENNY_STATIC_EMBED_MODE: 'off',
      PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED: '0',
    }),
  }),
  'static-live-shadow': Object.freeze({
    key: 'static-live-shadow',
    label: 'Static live-shadow',
    flags: Object.freeze({
      PENNY_STATIC_EMBED_MODE: 'live-shadow',
      PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED: '0',
    }),
  }),
  'static-live-advisory': Object.freeze({
    key: 'static-live-advisory',
    label: 'Static live-advisory',
    flags: Object.freeze({
      PENNY_STATIC_EMBED_MODE: 'live-advisory',
      PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED: '1',
    }),
  }),
});

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimText(value = '', limit = 240) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function estimatePromptTokens(text = '') {
  const source = String(text || '').trim();
  if (!source) return 0;
  const wordCount = (source.match(/\S+/g) || []).length;
  return Math.max(wordCount, Math.ceil(source.length / 4));
}

function uniqueNeedleHits(text = '', needles = []) {
  const hay = String(text || '').toLowerCase();
  const seen = new Set();
  const hits = [];
  for (const rawNeedle of Array.isArray(needles) ? needles : []) {
    const needle = String(rawNeedle || '').trim().toLowerCase();
    if (!needle || seen.has(needle)) continue;
    if (hay.includes(needle)) {
      seen.add(needle);
      hits.push(needle);
    }
  }
  return hits;
}

function normalizeBaseUrl(value = '', fallback = '') {
  const text = String(value || fallback || '').trim().replace(/\/+$/, '');
  return text || String(fallback || '').trim().replace(/\/+$/, '');
}

function deriveNativeBaseUrl(baseUrl = '') {
  const normalized = normalizeBaseUrl(baseUrl, 'http://127.0.0.1:1234/v1');
  if (/\/v1$/i.test(normalized)) return normalized.replace(/\/v1$/i, '/api/v1');
  return `${normalized}/api/v1`;
}

function buildCases() {
  return [
    {
      name: 'coding_mascot_current_correction',
      sessionId: 'static-compare-coding-mascot',
      prompt: 'Give me the current coding mascot.',
      currentId: 'current-coding-mascot',
      staleId: 'stale-coding-mascot',
      currentText: 'Current coding mascot is copper rabbit now.',
      staleText: 'Old coding mascot was brass fox back then.',
      currentNeedles: ['copper rabbit'],
      staleNeedles: ['brass fox'],
      unknownNeedles: ['not enough', "can't tell", 'cannot tell', "don't know"],
    },
    {
      name: 'cashier_watch_current_correction',
      sessionId: 'static-compare-cashier-watch',
      prompt: 'Give me the current cashier watch color.',
      currentId: 'current-cashier-watch',
      staleId: 'stale-cashier-watch',
      currentText: 'Current cashier watch is gold now.',
      staleText: 'Old cashier watch was silver then.',
      currentNeedles: ['gold'],
      staleNeedles: ['silver'],
      unknownNeedles: ['not enough', "can't tell", 'cannot tell', "don't know"],
    },
    {
      name: 'favorite_tea_current_correction',
      sessionId: 'static-compare-favorite-tea',
      prompt: 'Give me the current favorite tea.',
      currentId: 'current-favorite-tea',
      staleId: 'stale-favorite-tea',
      currentText: 'Current favorite tea is lapsang souchong now.',
      staleText: 'Old favorite tea was plain oolong back then.',
      currentNeedles: ['lapsang souchong', 'lapsang'],
      staleNeedles: ['oolong'],
      unknownNeedles: ['not enough', "can't tell", 'cannot tell', "don't know"],
    },
  ];
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

function flattenMessageContent(content) {
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (!part || typeof part !== 'object') return String(part || '');
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      return '';
    }).join('\n');
  }
  return String(content || '');
}

function flattenPromptText(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return messages
    .map((message) => flattenMessageContent(message?.content))
    .join('\n');
}

function detectMockCase(promptText = '') {
  const text = String(promptText || '');
  return buildCases().find((item) => text.includes(item.prompt)) || null;
}

function buildMockReply(body = {}) {
  const promptText = flattenPromptText(body);
  const item = detectMockCase(promptText);
  if (!item) return 'I need the actual memory cue before I can call it. [MOOD:thinking]';
  const lowerPrompt = promptText.toLowerCase();
  const hasCurrent = item.currentNeedles.some((needle) => lowerPrompt.includes(String(needle).toLowerCase()));
  const hasStale = item.staleNeedles.some((needle) => lowerPrompt.includes(String(needle).toLowerCase()));
  if (hasCurrent) {
    if (item.name === 'coding_mascot_current_correction') return 'Copper rabbit now. Tiny, precise, and very much not the old brass fox. [MOOD:thinking]';
    if (item.name === 'cashier_watch_current_correction') return 'Gold now, not the old silver watch. [MOOD:thinking]';
    return 'Lapsang souchong now, not the old oolong note. [MOOD:thinking]';
  }
  if (hasStale) {
    if (item.name === 'coding_mascot_current_correction') return 'Looks like brass fox from the memory I can see. [MOOD:thinking]';
    if (item.name === 'cashier_watch_current_correction') return 'Looks like silver from the memory I can see. [MOOD:thinking]';
    return 'Looks like oolong from the memory I can see. [MOOD:thinking]';
  }
  return "I can't tell from the rendered memory yet. [MOOD:thinking]";
}

function writeSse(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
}

async function createMockLmStudioServer() {
  const requestLog = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: CHAT_MODEL, object: 'model', owned_by: 'local' },
          { id: TOOL_MODEL, object: 'model', owned_by: 'local' },
          { id: EMBED_MODEL, object: 'model', owned_by: 'local' },
        ],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/embeddings') {
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        model: body.model || EMBED_MODEL,
        data: [{ object: 'embedding', index: 0, embedding: [0.11, 0.22, 0.33, 0.44] }],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      const promptText = flattenPromptText(body);
      const item = detectMockCase(promptText);
      const reply = buildMockReply(body);
      requestLog.push({
        caseName: item?.name || '',
        promptTokens: estimatePromptTokens(promptText),
        promptPreview: trimText(promptText, 420),
        stream: body.stream === true,
      });
      if (body.stream === true) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache' });
        const midpoint = Math.max(1, Math.floor(reply.length / 2));
        await sleep(3);
        writeSse(res, '', { choices: [{ delta: { content: reply.slice(0, midpoint) } }] });
        await sleep(1);
        writeSse(res, '', { choices: [{ delta: { content: reply.slice(midpoint) } }] });
        writeSse(res, '', '[DONE]');
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        id: 'chatcmpl-static-live-compare',
        object: 'chat.completion',
        created: 0,
        model: body.model || CHAT_MODEL,
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: reply },
          },
        ],
        usage: {
          prompt_tokens: estimatePromptTokens(promptText),
          completion_tokens: estimatePromptTokens(reply),
          total_tokens: estimatePromptTokens(promptText) + estimatePromptTokens(reply),
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
    backend: 'mock',
    baseUrl: `http://127.0.0.1:${port}/v1`,
    nativeBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    preparation: {
      ok: true,
      blockers: [],
      warnings: [],
      loadedModels: [CHAT_MODEL, TOOL_MODEL, EMBED_MODEL],
      loadedModelEntries: [CHAT_MODEL, TOOL_MODEL, EMBED_MODEL],
      semanticMemoryReady: true,
    },
    loadedModelEntries: [CHAT_MODEL, TOOL_MODEL, EMBED_MODEL],
    requestLog,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function archiveEntry({ id, text, type = 'episode', createdAt }) {
  return {
    id,
    type,
    text,
    excerpt: text,
    userText: text,
    createdAt,
    updatedAt: createdAt,
    evidenceCount: 1,
  };
}

function buildArchiveStoreFixture() {
  const now = '2026-04-22T12:00:00.000Z';
  return {
    meta: {
      schemaVersion: 1,
      embedModel: EMBED_MODEL,
      lastCompactedAt: '',
      lastSummarizedAt: '',
      reviewDecisions: {},
      backgroundVectorization: {
        enabled: false,
        batchLimit: 0,
      },
    },
    global: {
      episodes: buildCases().map((item, index) => archiveEntry({
        id: item.currentId,
        text: item.currentText,
        type: 'episode',
        createdAt: new Date(Date.parse(now) + (index * 1000)).toISOString(),
      })),
      summaries: buildCases().map((item, index) => archiveEntry({
        id: item.staleId,
        text: item.staleText,
        type: 'summary',
        createdAt: new Date(Date.parse(now) - (60000 + (index * 1000))).toISOString(),
      })),
      patterns: [],
      promotionQueue: [],
    },
    sessions: {},
  };
}

function seedArchiveStore(archiveFile) {
  ensureDir(path.dirname(archiveFile));
  fs.writeFileSync(archiveFile, `${JSON.stringify(buildArchiveStoreFixture(), null, 2)}\n`, 'utf8');
}

function spawnPennyServer({ root, port, modeConfig, lmStudio }) {
  const archiveFile = path.join(root, 'penny-memory-archive.test.json');
  seedArchiveStore(archiveFile);
  return spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      PENNY_MEMORY_FILE: path.join(root, 'penny-memory.test.json'),
      PENNY_MEMORY_ARCHIVE_FILE: archiveFile,
      PENNY_MEMORY_EMBEDDINGS_FILE: path.join(root, 'penny-memory-embeddings.test.json'),
      PENNY_MEMORY_LEDGER_FILE: path.join(root, 'penny-memory-ledger.test.json'),
      PENNY_MEMORY_BOOKS_FILE: path.join(root, 'penny-memory-books.test.json'),
      PENNY_OPEN_LOOP_FILE: path.join(root, 'penny-open-loops.test.json'),
      PENNY_STATIC_EMBED_CACHE_FILE: path.join(root, 'penny-memory-embeddings.static.test.json'),
      PENNY_ENABLE_BACKGROUND_CHAT_VECTORS: '0',
      PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: '0',
      PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS: '0',
      PENNY_LOCAL_LLM_TRANSPORT: 'chat',
      PENNY_LMSTUDIO_BASE: lmStudio.baseUrl,
      PENNY_LMSTUDIO_NATIVE_BASE: lmStudio.nativeBaseUrl,
      PENNY_LMSTUDIO_MODELS_PROBE_MS: '1500',
      PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
      PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
      PENNY_LMSTUDIO_EMBED_MODEL: EMBED_MODEL,
      PENNY_STATIC_EMBED_PROVIDER: STATIC_PROVIDER,
      PENNY_STATIC_EMBED_INDEX_SCOPE: 'archive',
      PENNY_STATIC_EMBED_MAX_CANDIDATES: '6',
      PENNY_STATIC_EMBED_BATCH_SIZE: '6',
      ...modeConfig.flags,
    },
  });
}

async function fetchText(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return {
      statusCode: response.status,
      text: await response.text(),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const response = await fetchText(url, options, timeoutMs);
  return {
    statusCode: response.statusCode,
    json: response.text ? JSON.parse(response.text) : null,
  };
}

async function waitForServerReady(baseUrl) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < STARTUP_TIMEOUT_MS) {
    try {
      const response = await fetchJson(`${baseUrl}/api/penny/status`, {}, 5000);
      if (response.statusCode === 200 && response.json?.ok === true) return response.json;
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for Penny server at ${baseUrl}`);
}

async function waitForStaticIndexReady(baseUrl, modeConfig) {
  if (!String(modeConfig?.flags?.PENNY_STATIC_EMBED_MODE || '').startsWith('live-')) {
    return null;
  }
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < STATIC_READY_TIMEOUT_MS) {
    try {
      const response = await fetchJson(`${baseUrl}/api/penny/status`, {}, 5000);
      const status = response.json?.staticEmbedding || null;
      if (
        response.statusCode === 200
        && status?.enabled === true
        && status.ready === true
        && Number(status.pendingItems || 0) === 0
        && Number(status.indexedItems || 0) >= buildCases().length * 2
      ) {
        return status;
      }
    } catch {}
    await sleep(500);
  }
  throw new Error(`Timed out waiting for static embedding index at ${baseUrl}`);
}

function flattenServerStatus(status = {}) {
  const lmStudio = status?.lmStudio && typeof status.lmStudio === 'object' ? status.lmStudio : {};
  const semanticMemory = status?.semanticMemory && typeof status.semanticMemory === 'object' ? status.semanticMemory : {};
  return {
    ...lmStudio,
    resolvedChatModel: String(lmStudio.resolvedChatModel || lmStudio.resolvedModel || '').trim(),
    resolvedToolModel: String(lmStudio.resolvedToolModel || '').trim(),
    semanticReady: semanticMemory.ready === true,
    semanticMemory,
    staticEmbedding: status?.staticEmbedding || null,
  };
}

function parseSseEvents(text = '') {
  return String(text || '')
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const eventLine = chunk.split('\n').find((line) => line.startsWith('event:'));
      const dataLines = chunk.split('\n').filter((line) => line.startsWith('data:'));
      const event = eventLine ? eventLine.slice('event:'.length).trim() : 'message';
      const dataText = dataLines.map((line) => line.slice('data:'.length).trim()).join('\n');
      let data = dataText;
      try {
        data = JSON.parse(dataText);
      } catch {}
      return { event, data };
    });
}

function promptTruthChannel(artifact = {}, channel = '') {
  return artifact?.promptTruth?.channels?.[channel] && typeof artifact.promptTruth.channels[channel] === 'object'
    ? artifact.promptTruth.channels[channel]
    : {};
}

function renderedArchiveIds(artifact = {}) {
  const sessionIds = Array.isArray(promptTruthChannel(artifact, 'sessionArchive').renderedSourceIds)
    ? promptTruthChannel(artifact, 'sessionArchive').renderedSourceIds
    : [];
  const globalIds = Array.isArray(promptTruthChannel(artifact, 'globalArchive').renderedSourceIds)
    ? promptTruthChannel(artifact, 'globalArchive').renderedSourceIds
    : [];
  return [...sessionIds, ...globalIds].map((item) => String(item || '').trim()).filter(Boolean);
}

function renderedArchiveTokenEstimate(artifact = {}) {
  return (Array.isArray(artifact?.retrievalTrace) ? artifact.retrievalTrace : [])
    .filter((item) => item?.rendered === true && /^archive-/.test(String(item.channel || '')))
    .reduce((sum, item) => sum + estimatePromptTokens(item.snippet || ''), 0);
}

function performanceDuration(artifact = {}, key = '') {
  const duration = Number(artifact?.performance?.[key]?.durationMs);
  return Number.isFinite(duration) ? duration : null;
}

function analyzeCaseResponse(text = '', scenario = {}, artifact = null) {
  const currentHits = uniqueNeedleHits(text, scenario.currentNeedles);
  const staleHits = uniqueNeedleHits(text, scenario.staleNeedles);
  const unknownHits = uniqueNeedleHits(text, scenario.unknownNeedles);
  const renderedIds = renderedArchiveIds(artifact || {});
  const currentRendered = renderedIds.includes(scenario.currentId);
  const staleRendered = renderedIds.includes(scenario.staleId);
  let score = 0;
  if (currentHits.length) score += 2.5;
  if (currentRendered) score += 0.5;
  if (unknownHits.length && !currentHits.length && !staleHits.length) score += 0.5;
  if (staleHits.length && !currentHits.length) score -= 1;
  return {
    currentHits,
    staleHits,
    unknownHits,
    currentRendered,
    staleRendered,
    overclaiming: staleHits.length > 0 && currentHits.length === 0,
    correctionFailure: !currentHits.length || !currentRendered || (staleHits.length > 0 && currentHits.length === 0),
    score: round(Math.max(0, Math.min(3, score)), 2),
  };
}

async function sendChatStream(baseUrl, item) {
  const startedAt = Date.now();
  const response = await fetchText(`${baseUrl}/api/penny/chat?stream=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stream: true,
      sessionId: item.sessionId,
      messages: [{ role: 'user', content: `${item.prompt}${CASE_PROMPT_SUFFIX}` }],
      memories: { brainMode: 'local' },
    }),
  });
  const events = parseSseEvents(response.text);
  const doneEvent = events.reverse().find((entry) => entry.event === 'done') || null;
  const errorEvent = events.find((entry) => entry.event === 'error') || null;
  const done = doneEvent?.data && typeof doneEvent.data === 'object' ? doneEvent.data : {};
  const artifact = done?.meta?.artifact || null;
  if (response.statusCode === 200 && artifact) {
    validateRuntimeArtifact(artifact, {
      label: `${item.name} artifact`,
      minEvidence: 1,
      minSideEffects: 1,
    });
  }
  const text = String(done?.text || '').trim();
  const analysis = analyzeCaseResponse(text, item, artifact);
  return {
    name: item.name,
    ok: response.statusCode === 200 && !!doneEvent && !errorEvent,
    prompt: item.prompt,
    text,
    seconds: round((Date.now() - startedAt) / 1000, 2),
    artifact,
    artifactSummary: {
      selectedLane: String(artifact?.scope?.selectedLane || '').trim(),
      warmState: String(artifact?.readiness?.warmState || '').trim(),
      executionPath: String(artifact?.executionPath || '').trim(),
      staticMode: String(artifact?.staticEmbeddingShadow?.mode || '').trim(),
      staticCandidateCount: Number(artifact?.staticEmbeddingShadow?.candidateCount || 0),
      staticOnlyCandidateCount: Number(artifact?.staticEmbeddingShadow?.staticOnlyCandidateCount || 0),
      firstTokenMs: performanceDuration(artifact, 'firstToken'),
      totalModelMs: performanceDuration(artifact, 'modelRoundTrip'),
      promptTokenEstimate: renderedArchiveTokenEstimate(artifact),
      renderedArchiveIds: renderedArchiveIds(artifact),
    },
    analysis,
    score: analysis.score,
    error: response.statusCode === 200 && !errorEvent
      ? ''
      : String(errorEvent?.data?.detail || errorEvent?.data?.error || `HTTP ${response.statusCode}`).trim(),
  };
}

async function runCaseInMode(modeConfig, lmStudio, item, modeIndex = 0, caseIndex = 0) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `penny-static-live-compare-${modeConfig.key}-${item.name}-`));
  const port = Number(process.env.PENNY_STATIC_LIVE_COMPARE_PORT || 4370) + (modeIndex * 20) + caseIndex;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawnPennyServer({ root, port, modeConfig, lmStudio });
  try {
    const serverStatus = await waitForServerReady(baseUrl);
    const staticStatus = await waitForStaticIndexReady(baseUrl, modeConfig);
    const result = await sendChatStream(baseUrl, item);
    return {
      result,
      serverStatus: flattenServerStatus(serverStatus),
      staticStatus,
    };
  } finally {
    child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function runMode(modeConfig, lmStudio, index = 0) {
  const result = {
    mode: modeConfig.key,
    label: modeConfig.label,
    serverStatus: null,
    staticStatus: null,
    environment: null,
    cases: [],
    totalScore: 0,
  };

  const cases = buildCases();
  for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
    console.log(`[static-compare] ${modeConfig.key} ${caseIndex + 1}/${cases.length}: ${cases[caseIndex].name}`);
    const caseResult = await runCaseInMode(modeConfig, lmStudio, cases[caseIndex], index, caseIndex);
    if (!result.serverStatus) result.serverStatus = caseResult.serverStatus;
    if (!result.staticStatus && caseResult.staticStatus) result.staticStatus = caseResult.staticStatus;
    result.cases.push(caseResult.result);
    console.log(`[static-compare] ${modeConfig.key} ${cases[caseIndex].name}: ${caseResult.result.ok ? 'ok' : 'failed'} score=${caseResult.result.score} seconds=${caseResult.result.seconds}`);
  }
  result.totalScore = round(result.cases.reduce((sum, item) => sum + Number(item.score || 0), 0), 2);
  result.environment = {
    valid: result.cases.every((item) => item.ok),
    reasons: result.cases.filter((item) => !item.ok).map((item) => `${item.name}: ${item.error || 'case failed'}`),
    degradedArtifacts: result.cases.filter((item) => item?.artifact?.readiness?.warmState === 'degraded').length,
    laneFallbackArtifacts: result.cases.filter((item) => item?.artifact?.context?.laneFallback === true).length,
    usedFallbackArtifacts: result.cases.filter((item) => item?.artifact?.context?.usedFallback === true).length,
  };
  return result;
}

function average(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  return round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, 2);
}

function metricDelta(leftValue, rightValue) {
  if (leftValue === null || rightValue === null || leftValue === undefined || rightValue === undefined) return null;
  return round(Number(rightValue) - Number(leftValue), 2);
}

function buildCaseDiffs(left = null, right = null) {
  const leftByName = new Map((left?.cases || []).map((item) => [item.name, item]));
  return (right?.cases || []).map((item) => {
    const offCase = leftByName.get(item.name) || null;
    const delta = round(Number(item.score || 0) - Number(offCase?.score || 0), 2);
    const currentGain = item.analysis?.currentHits?.length > (offCase?.analysis?.currentHits?.length || 0);
    const renderedGain = item.analysis?.currentRendered === true && offCase?.analysis?.currentRendered !== true;
    const overclaimRegression = item.analysis?.overclaiming === true && offCase?.analysis?.overclaiming !== true;
    return {
      name: item.name,
      offScore: round(Number(offCase?.score || 0), 2),
      onScore: round(Number(item.score || 0), 2),
      delta,
      currentGain,
      renderedGain,
      overclaimRegression,
      humanObservable: delta >= HUMAN_OBSERVABLE_DELTA && currentGain && renderedGain && !overclaimRegression,
    };
  });
}

function summarizeModeMetrics(mode = null) {
  const cases = Array.isArray(mode?.cases) ? mode.cases : [];
  return {
    totalScore: round(Number(mode?.totalScore || 0), 2),
    averageFirstTokenMs: average(cases.map((item) => item.artifactSummary?.firstTokenMs)),
    averageTotalMs: average(cases.map((item) => Number(item.seconds || 0) * 1000)),
    promptTokenEstimate: cases.reduce((sum, item) => sum + Number(item.artifactSummary?.promptTokenEstimate || 0), 0),
    staticOnlyRenderedCount: cases.reduce((sum, item) => (
      sum + (item.analysis?.currentRendered === true && item.artifactSummary?.staticMode === 'live-advisory' ? 1 : 0)
    ), 0),
    expectedCurrentRenderedCount: cases.filter((item) => item.analysis?.currentRendered === true).length,
    overclaimCount: cases.filter((item) => item.analysis?.overclaiming === true).length,
    correctionFailureCount: cases.filter((item) => item.analysis?.correctionFailure === true).length,
  };
}

function buildPairSummary(results = []) {
  const off = results.find((item) => item.mode === 'static-off') || null;
  const shadow = results.find((item) => item.mode === 'static-live-shadow') || null;
  const advisory = results.find((item) => item.mode === 'static-live-advisory') || null;
  const modesPresent = ['static-off', 'static-live-shadow', 'static-live-advisory'];
  if (!off || !shadow || !advisory) {
    return {
      primaryModes: modesPresent,
      pairedVerdict: 'invalid environment',
      totalDelta: 0,
      humanObservableWins: 0,
      overclaimRegressions: 0,
      candidateSurvivalDelta: 0,
      correctionFailures: 0,
      staticOnlyRenderedCount: 0,
      firstTokenLatencyDelta: null,
      totalLatencyDelta: null,
      promptTokenDelta: 0,
      trustVerdict: 'invalid',
      caseDiffs: [],
      perMode: {},
    };
  }

  const offMetrics = summarizeModeMetrics(off);
  const shadowMetrics = summarizeModeMetrics(shadow);
  const advisoryMetrics = summarizeModeMetrics(advisory);
  const caseDiffs = buildCaseDiffs(off, advisory);
  const totalDelta = round(Number(advisory.totalScore || 0) - Number(off.totalScore || 0), 2);
  const humanObservableWins = caseDiffs.filter((item) => item.humanObservable).length;
  const overclaimRegressions = caseDiffs.filter((item) => item.overclaimRegression).length;
  const candidateSurvivalDelta = advisoryMetrics.expectedCurrentRenderedCount - offMetrics.expectedCurrentRenderedCount;
  const correctionFailures = advisoryMetrics.correctionFailureCount;
  const firstTokenLatencyDelta = metricDelta(offMetrics.averageFirstTokenMs, advisoryMetrics.averageFirstTokenMs);
  const totalLatencyDelta = metricDelta(offMetrics.averageTotalMs, advisoryMetrics.averageTotalMs);
  const promptTokenDelta = advisoryMetrics.promptTokenEstimate - offMetrics.promptTokenEstimate;
  const environmentValid = results.every((item) => item.environment?.valid !== false);
  const pass = environmentValid
    && totalDelta > 0
    && humanObservableWins >= buildCases().length
    && overclaimRegressions === 0
    && correctionFailures === 0;

  return {
    primaryModes: modesPresent,
    pairedVerdict: pass ? 'static-live-advisory' : (totalDelta > 0 ? 'ambiguous' : 'static-off'),
    totalDelta,
    humanObservableWins,
    overclaimRegressions,
    candidateSurvivalDelta,
    correctionFailures,
    staticOnlyRenderedCount: advisoryMetrics.staticOnlyRenderedCount,
    firstTokenLatencyDelta,
    totalLatencyDelta,
    promptTokenDelta,
    trustVerdict: pass ? 'pass' : (environmentValid ? 'ambiguous' : 'invalid'),
    caseDiffs,
    perMode: {
      'static-off': off.environment?.valid === false ? 'invalid environment' : 'baseline',
      'static-live-shadow': shadow.environment?.valid === false ? 'invalid environment' : 'trace-only',
      'static-live-advisory': pass ? 'valid win' : (environmentValid ? 'needs review' : 'invalid environment'),
    },
    metrics: {
      'static-off': offMetrics,
      'static-live-shadow': shadowMetrics,
      'static-live-advisory': advisoryMetrics,
    },
  };
}

function buildStaticCompareTrace(payload = {}) {
  const modes = Array.isArray(payload.modes) ? payload.modes : [];
  const allCases = modes.flatMap((mode) => (Array.isArray(mode?.cases) ? mode.cases : []));
  const aggregatedEnvironment = {
    valid: modes.every((item) => item?.environment?.valid !== false),
    reasons: modes
      .filter((item) => item?.environment?.valid === false)
      .flatMap((item) => (Array.isArray(item?.environment?.reasons) ? item.environment.reasons.map((reason) => `${item.mode}: ${reason}`) : [])),
    degradedArtifacts: modes.reduce((sum, item) => sum + Number(item?.environment?.degradedArtifacts || 0), 0),
    laneFallbackArtifacts: modes.reduce((sum, item) => sum + Number(item?.environment?.laneFallbackArtifacts || 0), 0),
    usedFallbackArtifacts: modes.reduce((sum, item) => sum + Number(item?.environment?.usedFallbackArtifacts || 0), 0),
  };
  const summary = payload?.summary || {};
  const trust = buildQaTrust({
    environment: aggregatedEnvironment,
    ambiguous: summary.trustVerdict === 'ambiguous',
    artifactValidatedCount: allCases.filter((item) => item?.artifact && typeof item.artifact === 'object').length,
    expectedArtifactCount: allCases.length,
    degradedArtifacts: aggregatedEnvironment.degradedArtifacts,
    fallbackArtifacts: aggregatedEnvironment.laneFallbackArtifacts + aggregatedEnvironment.usedFallbackArtifacts,
    failedResultCount: allCases.filter((item) => item?.ok === false).length,
    reasonCodes: [
      summary.trustVerdict === 'invalid' ? 'static_compare_invalid' : '',
      Number(summary.overclaimRegressions || 0) > 0 ? 'overclaim_regressions_present' : '',
      Number(summary.correctionFailures || 0) > 0 ? 'correction_failures_present' : '',
    ].filter(Boolean),
  });

  return validateQaTrace(buildQaTrace({
    runId: `static-embedding-live-compare-${COMPARE_BACKEND}-${payload.startedAt || STAMP}`,
    startedAt: payload.startedAt,
    finishedAt: payload.finishedAt,
    promptVersion: 'eval-penny-static-embedding-live-compare.v1',
    laneDecision: {
      compareModes: modes.length,
      chatLaneTurns: allCases.filter((item) => item?.artifactSummary?.selectedLane === 'chat').length,
      toolLaneTurns: allCases.filter((item) => item?.artifactSummary?.selectedLane === 'tool').length,
      staticShadowCases: allCases.filter((item) => item?.artifactSummary?.staticMode === 'live-shadow').length,
      staticAdvisoryCases: allCases.filter((item) => item?.artifactSummary?.staticMode === 'live-advisory').length,
    },
    configuredModels: {
      chat: CHAT_MODEL,
      tool: TOOL_MODEL,
      embed: EMBED_MODEL,
      staticProvider: STATIC_PROVIDER,
    },
    resolvedModels: modes.reduce((acc, item) => {
      acc[`${item.mode}:chat`] = item?.serverStatus?.resolvedChatModel || '';
      acc[`${item.mode}:tool`] = item?.serverStatus?.resolvedToolModel || '';
      acc[`${item.mode}:static`] = item?.staticStatus?.provider || item?.serverStatus?.staticEmbedding?.provider || '';
      return acc;
    }, {}),
    loadedModels: Array.isArray(payload?.loadedModels) ? payload.loadedModels : [],
    contextLength: {
      promptTokenDelta: Number(summary.promptTokenDelta || 0),
      tokenEstimator: 'rendered-archive max(word-count, ceil(char-count/4))',
    },
    memoryReads: {
      totalCases: allCases.length,
      casesAborted: allCases.filter((item) => item?.ok === false).length,
      candidateSurvivalDelta: Number(summary.candidateSurvivalDelta || 0),
      staticOnlyRenderedCount: Number(summary.staticOnlyRenderedCount || 0),
    },
    memoryWrites: {
      disposableRuns: allCases.length,
      cleanedTempRoots: allCases.length,
    },
    toolCalls: {
      compareModes: modes.length,
      backend: COMPARE_BACKEND,
      liveStaticProvider: STATIC_PROVIDER,
    },
    latency: {
      totalSeconds: round((new Date(payload.finishedAt).getTime() - new Date(payload.startedAt).getTime()) / 1000, 2),
      firstTokenLatencyDeltaMs: summary.firstTokenLatencyDelta == null ? 'n/a' : Number(summary.firstTokenLatencyDelta),
      totalLatencyDeltaMs: summary.totalLatencyDelta == null ? 'n/a' : Number(summary.totalLatencyDelta),
    },
    trust,
    validation: {
      validModes: modes.filter((item) => item?.environment?.valid === true).length,
      invalidModes: modes.filter((item) => item?.environment?.valid === false).length,
      pairedVerdict: summary.pairedVerdict || '',
      backend: COMPARE_BACKEND,
    },
    outcome: {
      primaryPair: 'static-off, static-live-advisory',
      off: summary.perMode?.['static-off'] || '',
      shadow: summary.perMode?.['static-live-shadow'] || '',
      advisory: summary.perMode?.['static-live-advisory'] || '',
      winner: summary.pairedVerdict || '',
      humanObservableWins: Number(summary.humanObservableWins || 0),
      overclaimRegressions: Number(summary.overclaimRegressions || 0),
      correctionFailures: Number(summary.correctionFailures || 0),
      trustVerdict: summary.trustVerdict || '',
    },
  }));
}

async function createBackend() {
  if (COMPARE_BACKEND === 'real') return createRealLmStudioBackend();
  return createMockLmStudioServer();
}

async function createRealLmStudioBackend() {
  const baseUrl = normalizeBaseUrl(
    process.env.PENNY_STATIC_LIVE_COMPARE_LMSTUDIO_BASE || process.env.PENNY_LMSTUDIO_BASE,
    'http://127.0.0.1:1234/v1',
  );
  const nativeBaseUrl = normalizeBaseUrl(
    process.env.PENNY_STATIC_LIVE_COMPARE_LMSTUDIO_NATIVE_BASE || process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    deriveNativeBaseUrl(baseUrl),
  );
  const warnings = [];
  const blockers = [];
  let modelRows = [];
  try {
    const response = await fetchJson(`${baseUrl}/models`, {}, 15000);
    modelRows = Array.isArray(response.json?.data) ? response.json.data : [];
  } catch (error) {
    blockers.push(`Could not reach LM Studio models endpoint at ${baseUrl}/models: ${String(error?.message || error).trim()}`);
  }
  const loadedModels = modelRows
    .map((item) => String(item?.id || item?.model || item?.name || '').trim())
    .filter(Boolean);
  if (loadedModels.length) {
    if (!loadedModels.some((model) => modelsLookCompatible(model, CHAT_MODEL))) {
      blockers.push(`Expected live chat model is not loaded: ${CHAT_MODEL}.`);
    }
    if (EMBED_MODEL && !loadedModels.some((model) => modelsLookCompatible(model, EMBED_MODEL))) {
      warnings.push(`Expected embed model is not loaded: ${EMBED_MODEL}; semantic memory may fall back, but static compare can still run.`);
    }
  }
  return {
    backend: 'real',
    baseUrl,
    nativeBaseUrl,
    preparation: {
      ok: blockers.length === 0,
      blockers,
      warnings,
      loadedModels,
      loadedModelEntries: modelRows,
      semanticMemoryReady: EMBED_MODEL
        ? loadedModels.some((model) => modelsLookCompatible(model, EMBED_MODEL))
        : false,
    },
    loadedModelEntries: loadedModels,
    requestLog: [],
    close: async () => {},
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const startedAt = new Date().toISOString();
  const lmStudio = await createBackend();
  try {
    if (lmStudio.preparation && lmStudio.preparation.ok === false) {
      throw new Error(`Static live compare backend is not ready: ${(lmStudio.preparation.blockers || []).join(' ')}`);
    }
    const modes = [];
    const orderedModes = [
      MODE_CONFIGS['static-off'],
      MODE_CONFIGS['static-live-shadow'],
      MODE_CONFIGS['static-live-advisory'],
    ];
    for (let index = 0; index < orderedModes.length; index += 1) {
      modes.push(await runMode(orderedModes[index], lmStudio, index));
    }
    const finishedAt = new Date().toISOString();
    const summary = buildPairSummary(modes);
    const loadedModels = Array.isArray(lmStudio.loadedModelEntries)
      ? lmStudio.loadedModelEntries
        .map((item) => String(item?.modelKey || item?.identifier || item?.model || item?.id || item?.name || item || '').trim())
        .filter(Boolean)
      : [];
    const trace = buildStaticCompareTrace({
      startedAt,
      finishedAt,
      modes,
      summary,
      loadedModels,
    });
    const payload = {
      startedAt,
      finishedAt,
      backend: COMPARE_BACKEND,
      configuredModels: {
        chat: CHAT_MODEL,
        tool: TOOL_MODEL,
        embed: EMBED_MODEL,
        staticProvider: STATIC_PROVIDER,
      },
      preparation: lmStudio.preparation || null,
      modes,
      summary: {
        ...summary,
        trustVerdict: trace.trust?.verdict || summary.trustVerdict,
      },
      trace,
    };
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Static embedding live compare complete: ${OUTPUT_PATH}`);
    console.log(`Backend: ${COMPARE_BACKEND}`);
    console.log(`Paired verdict: ${payload.summary.pairedVerdict}`);
    console.log(JSON.stringify({
      pairedVerdict: payload.summary.pairedVerdict,
      totalDelta: payload.summary.totalDelta,
      humanObservableWins: payload.summary.humanObservableWins,
      overclaimRegressions: payload.summary.overclaimRegressions,
      correctionFailures: payload.summary.correctionFailures,
      promptTokenDelta: payload.summary.promptTokenDelta,
      trustVerdict: payload.summary.trustVerdict,
    }, null, 2));
    return payload;
  } finally {
    await lmStudio.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  MODE_CONFIGS,
  analyzeCaseResponse,
  buildCases,
  buildPairSummary,
  buildStaticCompareTrace,
  estimatePromptTokens,
  main,
  renderedArchiveIds,
  resolveCompareBackend,
};
