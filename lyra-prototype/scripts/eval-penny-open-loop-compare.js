const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { normalizeOpenLoopState } = require('../lib/penny-open-loops');
const { validateRuntimeArtifact } = require('../lib/penny-qa-trust');

const OPEN_LOOP_COMPARE_SCHEMA = 'penny-open-loop-compare.v1';
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `open-loop-compare-mock-${STAMP}.json`);
const CHAT_MODEL = String(process.env.PENNY_OPEN_LOOP_COMPARE_CHAT_MODEL || 'mock/open-loop-compare-chat').trim();
const TOOL_MODEL = String(process.env.PENNY_OPEN_LOOP_COMPARE_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const EMBED_MODEL = String(process.env.PENNY_OPEN_LOOP_COMPARE_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();
const TIMEOUT_MS = Number(process.env.PENNY_OPEN_LOOP_COMPARE_TIMEOUT_MS || 120000);
const STARTUP_TIMEOUT_MS = Number(process.env.PENNY_OPEN_LOOP_COMPARE_STARTUP_TIMEOUT_MS || 120000);
const HUMAN_OBSERVABLE_DELTA = Number(process.env.PENNY_OPEN_LOOP_COMPARE_OBSERVABLE_DELTA || 1);

const MODE_CONFIGS = Object.freeze({
  'open-loop-off': Object.freeze({
    key: 'open-loop-off',
    label: 'Open-loop bridge OFF',
    flags: Object.freeze({
      PENNY_ENABLE_OPEN_LOOP_PROMPT: '0',
      PENNY_OPEN_LOOP_MAX_RENDERED: '1',
    }),
  }),
  'open-loop-on': Object.freeze({
    key: 'open-loop-on',
    label: 'Open-loop bridge ON',
    flags: Object.freeze({
      PENNY_ENABLE_OPEN_LOOP_PROMPT: '1',
      PENNY_OPEN_LOOP_MAX_RENDERED: '1',
      PENNY_OPEN_LOOP_MAX_TOKENS: '90',
    }),
  }),
});

const KNOWN_OPEN_LOOP_TITLES = Object.freeze({
  'open-loop-compare': 'Open-loop compare harness follow-through',
  'deterministic-extraction': 'Deterministic extraction fixture plan',
  'gemma-runtime-watch': 'Gemma runtime watch follow-up',
  'stale-ui-cleanup': 'Stale UI cleanup idea',
});

function parseArgValue(name, argv = process.argv.slice(2)) {
  const dashed = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '').trim();
    if (value === dashed) return String(argv[index + 1] || '').trim();
    if (value.startsWith(`${dashed}=`)) return value.slice(dashed.length + 1).trim();
  }
  return '';
}

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

function trimText(value = '', limit = 360) {
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

function renderedOpenLoopIdsFromPrompt(promptText = '') {
  const prompt = String(promptText || '').toLowerCase();
  return Object.entries(KNOWN_OPEN_LOOP_TITLES)
    .filter(([, title]) => prompt.includes(String(title || '').toLowerCase()))
    .map(([id]) => id);
}

function buildCases() {
  return [
    {
      name: 'explicit_followthrough',
      sessionId: 'open-loop-compare-followthrough',
      prompt: 'hey Penny, where did we leave off with the O8 open-loop compare harness?',
      expectedBridgeLoopIds: ['open-loop-compare'],
      forbiddenBridgeLoopIds: ['deterministic-extraction', 'gemma-runtime-watch', 'stale-ui-cleanup'],
      continuityNeedles: ['o8 compare', 'adjacent-topic bleed', 'compare harness'],
      cautionNeedles: ['advisory', 'likely'],
      unknownNeedles: ["don't have", "can't tell", 'need to check'],
      forbiddenNeedles: ['this is a canonical fact', 'it is a canonical fact', 'verified fact', 'definitely done'],
    },
    {
      name: 'adjacent_topic_bleed_guard',
      sessionId: 'open-loop-compare-bleed-guard',
      prompt: 'hey Penny, for the O8 open-loop harness, what risk should we watch?',
      expectedBridgeLoopIds: ['open-loop-compare'],
      forbiddenBridgeLoopIds: ['deterministic-extraction', 'gemma-runtime-watch', 'stale-ui-cleanup'],
      continuityNeedles: ['adjacent-topic bleed', 'bridge off'],
      cautionNeedles: ['advisory', 'watch'],
      unknownNeedles: ["don't have", "can't tell", 'need to check'],
      forbiddenNeedles: ['deterministic extraction is next', 'gemma runtime watch is next'],
    },
    {
      name: 'completed_loop_suppressed',
      sessionId: 'open-loop-compare-completed-suppressed',
      prompt: 'hey Penny, do we need to continue the Gemma runtime watch?',
      expectedBridgeLoopIds: [],
      forbiddenBridgeLoopIds: ['gemma-runtime-watch', 'open-loop-compare', 'deterministic-extraction'],
      continuityNeedles: ['no active open loop', 'completed', 'parked'],
      cautionNeedles: ['active open loop', 'looks parked'],
      unknownNeedles: ["don't have", "can't tell", 'no active open loop'],
      forbiddenNeedles: ['continue gemma runtime watch', 'next step is gemma'],
      noBridgeExpected: true,
    },
    {
      name: 'overclaim_guard',
      sessionId: 'open-loop-compare-overclaim-guard',
      prompt: 'hey Penny, keep the O8 open-loop compare wording careful and not overstated.',
      expectedBridgeLoopIds: ['open-loop-compare'],
      forbiddenBridgeLoopIds: ['deterministic-extraction', 'gemma-runtime-watch', 'stale-ui-cleanup'],
      continuityNeedles: ['next likely step', 'compare harness', 'adjacent-topic bleed'],
      cautionNeedles: ['advisory', 'not canonical', 'likely'],
      unknownNeedles: ["don't have", "can't tell", 'need to check'],
      forbiddenNeedles: ['this is a canonical fact', 'it is a canonical fact', 'verified fact', 'certainly complete'],
    },
  ];
}

function buildOpenLoopStateFixture(generatedAt = '2026-04-22T12:00:00.000Z') {
  return normalizeOpenLoopState({
    schema: 'penny-open-loop-state.v1',
    updatedAt: generatedAt,
    loops: [
      {
        id: 'open-loop-compare',
        title: KNOWN_OPEN_LOOP_TITLES['open-loop-compare'],
        status: 'in-progress',
        priority: 'critical',
        confidence: 'medium',
        lastTouchedAt: generatedAt,
        nextLikelyStep: 'Run the O8 compare harness and keep the bridge off if adjacent-topic bleed appears.',
        sourceRefs: [
          { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
        ],
        surfacePolicy: {
          mode: 'relevant-only',
          maxSurfaceCount: 1,
          expiresAt: '2026-05-22T12:00:00.000Z',
        },
      },
      {
        id: 'deterministic-extraction',
        title: KNOWN_OPEN_LOOP_TITLES['deterministic-extraction'],
        status: 'deferred',
        priority: 'high',
        confidence: 'medium',
        lastTouchedAt: generatedAt,
        nextLikelyStep: 'Wait for a concrete document extraction use case before wiring OCR or hosted document tools.',
        sourceRefs: [
          { type: 'doc', path: 'docs/plans/penny-deterministic-extraction-qa-plan-2026-04-21.md' },
        ],
        surfacePolicy: {
          mode: 'relevant-only',
          maxSurfaceCount: 1,
          expiresAt: '2026-05-22T12:00:00.000Z',
        },
      },
      {
        id: 'gemma-runtime-watch',
        title: KNOWN_OPEN_LOOP_TITLES['gemma-runtime-watch'],
        status: 'completed',
        priority: 'low',
        confidence: 'high',
        completedAt: '2026-04-21T23:30:00.000Z',
        lastTouchedAt: '2026-04-21T23:30:00.000Z',
        nextLikelyStep: 'No follow-up unless LM Studio exposes vision budget.',
        sourceRefs: [
          { type: 'journal', id: '2026-04-21' },
        ],
        surfacePolicy: {
          mode: 'manual-only',
          maxSurfaceCount: 0,
          expiresAt: '2026-04-22T12:00:00.000Z',
        },
      },
      {
        id: 'stale-ui-cleanup',
        title: KNOWN_OPEN_LOOP_TITLES['stale-ui-cleanup'],
        status: 'dismissed',
        priority: 'medium',
        confidence: 'low',
        lastTouchedAt: '2026-04-20T12:00:00.000Z',
        nextLikelyStep: 'Do not surface this dismissed idea.',
        surfacePolicy: {
          mode: 'never',
          maxSurfaceCount: 0,
          expiresAt: '2026-04-21T12:00:00.000Z',
        },
      },
    ],
  });
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
  return messages.map((message) => flattenMessageContent(message?.content)).join('\n');
}

function detectMockCase(promptText = '') {
  const text = String(promptText || '');
  return buildCases().find((item) => text.includes(item.prompt)) || null;
}

function buildMockReply(body = {}) {
  const promptText = flattenPromptText(body);
  const item = detectMockCase(promptText);
  const renderedIds = renderedOpenLoopIdsFromPrompt(promptText);
  const hasOpenLoopCompare = renderedIds.includes('open-loop-compare');
  const hasGemmaWatch = renderedIds.includes('gemma-runtime-watch');
  const hasAdjacent = renderedIds.includes('deterministic-extraction') || renderedIds.includes('stale-ui-cleanup');

  if (!item) return "I don't have the open-loop case cue here. [MOOD:thinking]";
  if (hasGemmaWatch) return 'Continue Gemma runtime watch next. [MOOD:thinking]';
  if (hasAdjacent && !hasOpenLoopCompare) return 'Deterministic extraction is next. [MOOD:thinking]';
  if (item.name === 'completed_loop_suppressed') {
    return "I don't see an active open loop for Gemma runtime watch; it looks completed or parked. [MOOD:thinking]";
  }
  if (!hasOpenLoopCompare) {
    return "I don't have the active O8 open loop in the prompt, so I'd need to check the plan before naming the next step. [MOOD:thinking]";
  }
  if (item.name === 'overclaim_guard') {
    return 'Frame it as advisory: the next likely step is the O8 compare harness, not a canonical fact or completed work. [MOOD:thinking]';
  }
  if (item.name === 'adjacent_topic_bleed_guard') {
    return 'Watch adjacent-topic bleed; keep the bridge off if it starts pulling in unrelated open loops. [MOOD:thinking]';
  }
  return 'The O8 compare harness is next, with adjacent-topic bleed as the risk to watch. Advisory, not canonical. [MOOD:thinking]';
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
        data: [{ object: 'embedding', index: 0, embedding: [0.12, 0.24, 0.36, 0.48] }],
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
        promptPreview: trimText(promptText, 900),
        promptText,
        renderedOpenLoopIds: renderedOpenLoopIdsFromPrompt(promptText),
        stream: body.stream === true,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        id: 'chatcmpl-open-loop-compare',
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

function seedOpenLoopStore(openLoopFile) {
  ensureDir(path.dirname(openLoopFile));
  fs.writeFileSync(openLoopFile, `${JSON.stringify(buildOpenLoopStateFixture(), null, 2)}\n`, 'utf8');
}

function spawnPennyServer({ root, port, modeConfig, lmStudio }) {
  const openLoopFile = path.join(root, 'penny-open-loops.test.json');
  seedOpenLoopStore(openLoopFile);
  return spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      PENNY_MEMORY_FILE: path.join(root, 'penny-memory.test.json'),
      PENNY_MEMORY_ARCHIVE_FILE: path.join(root, 'penny-memory-archive.test.json'),
      PENNY_MEMORY_EMBEDDINGS_FILE: path.join(root, 'penny-memory-embeddings.test.json'),
      PENNY_MEMORY_LEDGER_FILE: path.join(root, 'penny-memory-ledger.test.json'),
      PENNY_MEMORY_BOOKS_FILE: path.join(root, 'penny-memory-books.test.json'),
      PENNY_OPEN_LOOP_FILE: openLoopFile,
      PENNY_ENABLE_BACKGROUND_CHAT_VECTORS: '0',
      PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: '0',
      PENNY_ENABLE_INTERNAL_ARCHIVE_SYNTHESIS: '0',
      PENNY_STATIC_EMBED_MODE: 'off',
      PENNY_LOCAL_LLM_TRANSPORT: 'chat',
      PENNY_LMSTUDIO_BASE: lmStudio.baseUrl,
      PENNY_LMSTUDIO_NATIVE_BASE: lmStudio.nativeBaseUrl,
      PENNY_LMSTUDIO_MODELS_PROBE_MS: '1500',
      PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
      PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
      PENNY_LMSTUDIO_EMBED_MODEL: EMBED_MODEL,
      PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: '512',
      PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: '220',
      ...modeConfig.flags,
    },
  });
}

async function fetchJson(url, options = {}, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      statusCode: response.status,
      json: text ? JSON.parse(text) : null,
      text,
    };
  } finally {
    clearTimeout(timer);
  }
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

function flattenServerStatus(status = {}) {
  const lmStudio = status?.lmStudio && typeof status.lmStudio === 'object' ? status.lmStudio : {};
  const semanticMemory = status?.semanticMemory && typeof status.semanticMemory === 'object' ? status.semanticMemory : {};
  return {
    ...lmStudio,
    resolvedChatModel: String(lmStudio.resolvedChatModel || lmStudio.resolvedModel || '').trim(),
    resolvedToolModel: String(lmStudio.resolvedToolModel || '').trim(),
    semanticReady: semanticMemory.ready === true,
    semanticMemory,
  };
}

function performanceDuration(artifact = {}, key = '') {
  const duration = Number(artifact?.performance?.[key]?.durationMs);
  return Number.isFinite(duration) ? duration : null;
}

function analyzeCaseResponse(text = '', scenario = {}, artifact = null, promptLog = {}) {
  const promptText = String(promptLog?.promptText || promptLog?.promptPreview || '');
  const renderedIds = renderedOpenLoopIdsFromPrompt(promptText);
  const expectedIds = Array.isArray(scenario.expectedBridgeLoopIds) ? scenario.expectedBridgeLoopIds : [];
  const forbiddenIds = Array.isArray(scenario.forbiddenBridgeLoopIds) ? scenario.forbiddenBridgeLoopIds : [];
  const continuityHits = uniqueNeedleHits(text, scenario.continuityNeedles);
  const cautionHits = uniqueNeedleHits(text, scenario.cautionNeedles);
  const unknownHits = uniqueNeedleHits(text, scenario.unknownNeedles);
  const forbiddenHits = uniqueNeedleHits(text, scenario.forbiddenNeedles);
  const expectedRendered = expectedIds.length > 0 && expectedIds.every((id) => renderedIds.includes(id));
  const forbiddenRenderedIds = renderedIds.filter((id) => forbiddenIds.includes(id));
  const adjacentTopicBleed = forbiddenRenderedIds.length > 0;
  const annoyance = scenario.noBridgeExpected === true && renderedIds.length > 0;
  let score = 0;
  if (continuityHits.length) score += 2;
  if (expectedIds.length && expectedRendered) score += 0.75;
  if (cautionHits.length) score += 0.5;
  if (unknownHits.length && !continuityHits.length && !expectedRendered) score += 0.25;
  if (adjacentTopicBleed) score -= 2;
  if (annoyance) score -= 1;
  if (forbiddenHits.length) score -= 2;

  return {
    renderedOpenLoopIds: renderedIds,
    expectedRendered,
    forbiddenRenderedIds,
    continuityHits,
    cautionHits,
    unknownHits,
    forbiddenHits,
    adjacentTopicBleed,
    annoyance,
    overclaiming: forbiddenHits.length > 0,
    selectedLane: String(artifact?.scope?.selectedLane || '').trim(),
    score: round(Math.max(0, Math.min(3.25, score)), 2),
  };
}

async function sendChat(baseUrl, item, lmStudio) {
  const beforeLogLength = lmStudio.requestLog.length;
  const startedAt = Date.now();
  const response = await fetchJson(`${baseUrl}/api/penny/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: item.sessionId,
      messages: [{ role: 'user', content: item.prompt }],
      memories: { brainMode: 'local' },
    }),
  });
  const payload = response.json || {};
  const artifact = payload?.meta?.artifact || null;
  if (response.statusCode === 200 && artifact) {
    validateRuntimeArtifact(artifact, {
      label: `${item.name} artifact`,
      minEvidence: 1,
      minSideEffects: 1,
    });
  }
  const newLogs = lmStudio.requestLog.slice(beforeLogLength);
  const promptLog = [...newLogs].reverse().find((entry) => entry.caseName === item.name) || newLogs[newLogs.length - 1] || {};
  const text = String(payload?.text || '').trim();
  const analysis = analyzeCaseResponse(text, item, artifact, promptLog);
  return {
    name: item.name,
    ok: response.statusCode === 200,
    prompt: item.prompt,
    text,
    seconds: round((Date.now() - startedAt) / 1000, 2),
    artifact,
    artifactSummary: {
      selectedLane: String(artifact?.scope?.selectedLane || '').trim(),
      warmState: String(artifact?.readiness?.warmState || '').trim(),
      executionPath: String(artifact?.executionPath || '').trim(),
      firstTokenMs: performanceDuration(artifact, 'firstToken'),
      totalModelMs: performanceDuration(artifact, 'modelRoundTrip'),
      promptTokenEstimate: Number(promptLog.promptTokens || 0),
      renderedOpenLoopIds: analysis.renderedOpenLoopIds,
      promptPreview: trimText(promptLog.promptPreview || '', 700),
    },
    analysis,
    score: analysis.score,
    error: response.statusCode === 200 ? '' : String(payload?.error || `HTTP ${response.statusCode}`).trim(),
  };
}

async function runCaseInMode(modeConfig, lmStudio, item, modeIndex = 0, caseIndex = 0) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `penny-open-loop-compare-${modeConfig.key}-${item.name}-`));
  const port = Number(process.env.PENNY_OPEN_LOOP_COMPARE_PORT || 4390) + (modeIndex * 20) + caseIndex;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawnPennyServer({ root, port, modeConfig, lmStudio });
  try {
    const serverStatus = await waitForServerReady(baseUrl);
    const result = await sendChat(baseUrl, item, lmStudio);
    return {
      result,
      serverStatus: flattenServerStatus(serverStatus),
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
    environment: null,
    cases: [],
    totalScore: 0,
  };
  const cases = buildCases();
  for (let caseIndex = 0; caseIndex < cases.length; caseIndex += 1) {
    const caseResult = await runCaseInMode(modeConfig, lmStudio, cases[caseIndex], index, caseIndex);
    if (!result.serverStatus) result.serverStatus = caseResult.serverStatus;
    result.cases.push(caseResult.result);
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

function summarizeModeMetrics(mode = null) {
  const cases = Array.isArray(mode?.cases) ? mode.cases : [];
  return {
    totalScore: round(Number(mode?.totalScore || 0), 2),
    averageFirstTokenMs: average(cases.map((item) => item.artifactSummary?.firstTokenMs)),
    averageTotalMs: average(cases.map((item) => Number(item.seconds || 0) * 1000)),
    promptTokenEstimate: cases.reduce((sum, item) => sum + Number(item.artifactSummary?.promptTokenEstimate || 0), 0),
    renderedOpenLoopCount: cases.reduce((sum, item) => sum + (item.analysis?.renderedOpenLoopIds?.length || 0), 0),
    expectedRenderedCount: cases.filter((item) => item.analysis?.expectedRendered === true).length,
    continuityHitCount: cases.filter((item) => (item.analysis?.continuityHits?.length || 0) > 0).length,
    adjacentTopicBleedCount: cases.filter((item) => item.analysis?.adjacentTopicBleed === true).length,
    annoyanceCount: cases.filter((item) => item.analysis?.annoyance === true).length,
    overclaimCount: cases.filter((item) => item.analysis?.overclaiming === true).length,
  };
}

function buildCaseDiffs(left = null, right = null) {
  const leftByName = new Map((left?.cases || []).map((item) => [item.name, item]));
  return (right?.cases || []).map((item) => {
    const offCase = leftByName.get(item.name) || null;
    const delta = round(Number(item.score || 0) - Number(offCase?.score || 0), 2);
    const continuityGain = (item.analysis?.continuityHits?.length || 0) > (offCase?.analysis?.continuityHits?.length || 0);
    const renderGain = (item.analysis?.expectedRendered === true) && offCase?.analysis?.expectedRendered !== true;
    const adjacentTopicBleed = item.analysis?.adjacentTopicBleed === true;
    const annoyanceRegression = item.analysis?.annoyance === true && offCase?.analysis?.annoyance !== true;
    const overclaimRegression = item.analysis?.overclaiming === true && offCase?.analysis?.overclaiming !== true;
    return {
      name: item.name,
      offScore: round(Number(offCase?.score || 0), 2),
      onScore: round(Number(item.score || 0), 2),
      delta,
      continuityGain,
      renderGain,
      adjacentTopicBleed,
      annoyanceRegression,
      overclaimRegression,
      humanObservable: delta >= HUMAN_OBSERVABLE_DELTA
        && (continuityGain || renderGain)
        && !adjacentTopicBleed
        && !annoyanceRegression
        && !overclaimRegression,
    };
  });
}

function buildPairSummary(results = []) {
  const off = results.find((item) => item.mode === 'open-loop-off') || null;
  const on = results.find((item) => item.mode === 'open-loop-on') || null;
  if (!off || !on) {
    return {
      primaryModes: ['open-loop-off', 'open-loop-on'],
      pairedVerdict: 'invalid environment',
      enablementRecommendation: 'keep-disabled',
      totalDelta: 0,
      continuityWins: 0,
      adjacentTopicBleed: 0,
      annoyanceRegressions: 0,
      overclaimRegressions: 0,
      regressions: 0,
      promptTokenDelta: 0,
      firstTokenLatencyDelta: null,
      totalLatencyDelta: null,
      trustVerdict: 'invalid',
      caseDiffs: [],
      perMode: {},
      metrics: {},
    };
  }

  const offMetrics = summarizeModeMetrics(off);
  const onMetrics = summarizeModeMetrics(on);
  const caseDiffs = buildCaseDiffs(off, on);
  const totalDelta = round(Number(on.totalScore || 0) - Number(off.totalScore || 0), 2);
  const continuityWins = caseDiffs.filter((item) => item.humanObservable).length;
  const adjacentTopicBleed = onMetrics.adjacentTopicBleedCount;
  const annoyanceRegressions = caseDiffs.filter((item) => item.annoyanceRegression).length;
  const overclaimRegressions = caseDiffs.filter((item) => item.overclaimRegression).length;
  const regressions = adjacentTopicBleed + annoyanceRegressions + overclaimRegressions;
  const promptTokenDelta = onMetrics.promptTokenEstimate - offMetrics.promptTokenEstimate;
  const firstTokenLatencyDelta = metricDelta(offMetrics.averageFirstTokenMs, onMetrics.averageFirstTokenMs);
  const totalLatencyDelta = metricDelta(offMetrics.averageTotalMs, onMetrics.averageTotalMs);
  const environmentValid = results.every((item) => item.environment?.valid !== false);
  const eligible = environmentValid
    && totalDelta > 0
    && continuityWins > regressions
    && adjacentTopicBleed === 0
    && overclaimRegressions === 0;

  return {
    primaryModes: ['open-loop-off', 'open-loop-on'],
    pairedVerdict: environmentValid ? (eligible ? 'open-loop-on' : 'open-loop-off') : 'invalid environment',
    enablementRecommendation: eligible ? 'eligible-for-opt-in' : 'keep-disabled',
    totalDelta,
    continuityWins,
    adjacentTopicBleed,
    annoyanceRegressions,
    overclaimRegressions,
    regressions,
    promptTokenDelta,
    firstTokenLatencyDelta,
    totalLatencyDelta,
    trustVerdict: environmentValid ? (eligible ? 'pass' : 'ambiguous') : 'invalid',
    caseDiffs,
    perMode: {
      'open-loop-off': off.environment?.valid === false ? 'invalid environment' : 'baseline',
      'open-loop-on': on.environment?.valid === false
        ? 'invalid environment'
        : (eligible ? 'valid win' : 'kept disabled by guardrail'),
    },
    metrics: {
      'open-loop-off': offMetrics,
      'open-loop-on': onMetrics,
    },
    acceptance: {
      bridgeStaysOffIfBleedAppears: adjacentTopicBleed > 0 ? true : 'not-triggered',
      enableOnlyIfWinsBeatRegressions: continuityWins > regressions,
      noPromptTruthExpansion: true,
      noToolEvidenceReceiptMerge: true,
      noAutomaticExplicitMemoryWrites: true,
    },
  };
}

function writeOpenLoopCompareArtifact({
  outputPath = OUTPUT_PATH,
  artifact,
} = {}) {
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  return { outputPath, artifact };
}

async function main(argv = process.argv.slice(2)) {
  ensureDir(OUTPUT_DIR);
  const outputPath = parseArgValue('output', argv) || OUTPUT_PATH;
  const startedAt = new Date().toISOString();
  const lmStudio = await createMockLmStudioServer();
  try {
    const modes = [];
    const orderedModes = [MODE_CONFIGS['open-loop-off'], MODE_CONFIGS['open-loop-on']];
    for (let index = 0; index < orderedModes.length; index += 1) {
      modes.push(await runMode(orderedModes[index], lmStudio, index));
    }
    const finishedAt = new Date().toISOString();
    const summary = buildPairSummary(modes);
    const artifact = {
      schema: OPEN_LOOP_COMPARE_SCHEMA,
      artifactKind: 'open-loop-compare',
      measurementMode: 'mock-route',
      liveModelCalls: false,
      liveUserMemoryTouched: false,
      promptTruthExpanded: false,
      promptTruthChannelAdded: false,
      toolEvidenceReceiptMerged: false,
      startedAt,
      finishedAt,
      configuredModels: {
        chat: CHAT_MODEL,
        tool: TOOL_MODEL,
        embed: EMBED_MODEL,
      },
      modes,
      summary,
      limits: [
        'Open loops remain advisory continuity, not canonical memory.',
        'The compare uses disposable Penny servers and a mock LM Studio backend.',
        'The bridge remains off by default; eligibility requires wins greater than regressions and zero adjacent-topic bleed.',
      ],
    };
    const written = writeOpenLoopCompareArtifact({ outputPath, artifact });
    console.log(`Open-loop compare complete: ${written.outputPath}`);
    console.log(JSON.stringify({
      pairedVerdict: summary.pairedVerdict,
      enablementRecommendation: summary.enablementRecommendation,
      totalDelta: summary.totalDelta,
      continuityWins: summary.continuityWins,
      adjacentTopicBleed: summary.adjacentTopicBleed,
      annoyanceRegressions: summary.annoyanceRegressions,
      overclaimRegressions: summary.overclaimRegressions,
      promptTokenDelta: summary.promptTokenDelta,
      trustVerdict: summary.trustVerdict,
    }, null, 2));
    return written.artifact;
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
  OPEN_LOOP_COMPARE_SCHEMA,
  analyzeCaseResponse,
  buildCases,
  buildCaseDiffs,
  buildOpenLoopStateFixture,
  buildPairSummary,
  estimatePromptTokens,
  main,
  parseArgValue,
  renderedOpenLoopIdsFromPrompt,
  summarizeModeMetrics,
  writeOpenLoopCompareArtifact,
};
