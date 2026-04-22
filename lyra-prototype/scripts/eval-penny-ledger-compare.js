const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');

const { createAutomationApi } = require('./penny-lmstudio-prepare');
const { buildQaTrace, validateQaTrace } = require('../lib/penny-qa-trace');
const { buildQaTrust, validateRuntimeArtifact } = require('../lib/penny-qa-trust');
const { buildQaEnvironmentValidity } = require('../lib/penny-qa-validity');

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
const COMPARE_BACKEND = resolveCompareBackend(parseArgValue('backend') || process.env.PENNY_LEDGER_COMPARE_BACKEND || 'mock');
const OUTPUT_PATH = path.join(OUTPUT_DIR, `ledger-compare-${COMPARE_BACKEND}-${STAMP}.json`);
const CHAT_MODEL = String(
  process.env.PENNY_LEDGER_COMPARE_CHAT_MODEL
  || (COMPARE_BACKEND === 'real'
    ? (process.env.PENNY_QA_CHAT_MODEL || 'unsloth/gemma-4-31b-it@q6_k')
    : 'mock/ledger-compare-chat'),
).trim();
const TOOL_MODEL = String(process.env.PENNY_LEDGER_COMPARE_TOOL_MODEL || process.env.PENNY_QA_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const EMBED_MODEL = String(process.env.PENNY_LEDGER_COMPARE_EMBED_MODEL || process.env.PENNY_QA_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();
const TIMEOUT_MS = Number(process.env.PENNY_LEDGER_COMPARE_TIMEOUT_MS || (COMPARE_BACKEND === 'real' ? 420000 : 60000));
const STARTUP_TIMEOUT_MS = Number(process.env.PENNY_LEDGER_COMPARE_STARTUP_TIMEOUT_MS || 120000);
const CONTEXT_LENGTH = Number(process.env.PENNY_LEDGER_COMPARE_CONTEXT_LENGTH || process.env.PENNY_QA_CHAT_CONTEXT_LENGTH || 6144);
const MODEL_TTL_SECONDS = Number(process.env.PENNY_LEDGER_COMPARE_MODEL_TTL_SECONDS || process.env.PENNY_QA_MODEL_TTL_SECONDS || 1800);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_LEDGER_COMPARE_MAX_OUTPUT_TOKENS || 160).trim() || '160';
const LOAD_EMBED_MODEL = String(process.env.PENNY_LEDGER_COMPARE_LOAD_EMBED_MODEL || '0').trim() === '1';
const CASE_PROMPT_SUFFIX = ' Keep it to 2 short sentences max.';
const PROMPT_RENDER_EXPECTED = Object.freeze({
  'ledger-on': true,
  'ledger-off': false,
});
// Compatibility note: the older "injection" name is kept as an internal alias only.
const PROMPT_INJECTION_EXPECTED = PROMPT_RENDER_EXPECTED;
const PAIR_DELTA_AMBIGUOUS_THRESHOLD = Number(process.env.PENNY_LEDGER_COMPARE_AMBIGUOUS_DELTA || 0.5);
const HUMAN_OBSERVABLE_DELTA = Number(process.env.PENNY_LEDGER_COMPARE_OBSERVABLE_DELTA || 0.5);

const MODE_CONFIGS = Object.freeze({
  'ledger-off': Object.freeze({
    key: 'ledger-off',
    label: 'Ledger prompt OFF',
    flags: Object.freeze({
      PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: '0',
    }),
  }),
  'ledger-on': Object.freeze({
    key: 'ledger-on',
    label: 'Ledger prompt ON',
    flags: Object.freeze({
      PENNY_ENABLE_RESEARCH_LEDGER_PROMPT: '1',
    }),
  }),
});

const MOCK_CASE_REPLIES = Object.freeze({
  carryover_tentative_inference: Object.freeze({
    on: "uhhm probably package.json, right? we were still verifying the Vitest migration.",
    off: "i don't know, we'd have to re-open the repo and check.",
  }),
  source_identity_recall: Object.freeze({
    on: "i think that was package.json, right? that's where the open Vitest migration thread lived.",
    off: "i'm not sure which file that was attached to anymore.",
  }),
  follow_up_item_recall: Object.freeze({
    on: "the follow-up was to verify whether the Vitest migration actually happened before saying it was done.",
    off: 'something about checking the test setup again.',
  }),
  contradiction_guard: Object.freeze({
    on: "not confidently. that thread is still open, so i'd want to verify it before claiming anything.",
    off: "i'd want to re-check before claiming that.",
  }),
  overclaim_pressure: Object.freeze({
    on: "no. README doesn't prove that yet, and i'd verify it before saying so.",
    off: "i can't back that confidently from memory.",
  }),
  weak_evidence_guard: Object.freeze({
    on: "probably none. i don't have an exact proving line yet, so i'd hedge until we verify it.",
    off: "i can't point to a proving line from memory.",
  }),
  doc_drift_guard: Object.freeze({
    on: "i'd treat it as something we should still verify. README isn't enough to call it settled.",
    off: "not sure. i'd want to look again.",
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

function artifactResearchLedgerRendered(artifact = null) {
  const value = artifact && typeof artifact === 'object' ? artifact : {};
  if (value.researchLedgerRendered === true) return true;
  if (value.researchLedgerRendered === false) return false;
  return value.researchLedgerPromptInjected === true;
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

function flattenPromptText(body = {}) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  return messages
    .map((message) => String(message?.content || ''))
    .join('\n');
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

function buildCases() {
  return [
    {
      name: 'carryover_tentative_inference',
      sessionId: 'ledger-compare-package-carryover',
      prompt: 'Earlier repo work left one thing unresolved. Where should we probably verify next?',
      continuityNeedles: ['package.json', 'vitest'],
      identityNeedles: ['package.json'],
      cautionNeedles: ['probably', 'maybe', 'verify', 'check', 'still', 'open', 'right'],
      forbiddenNeedles: ['definitely', 'for sure', 'settled', 'already done'],
    },
    {
      name: 'source_identity_recall',
      sessionId: 'ledger-compare-package-source',
      prompt: 'Which file was that open Vitest migration question attached to again?',
      continuityNeedles: ['package.json', 'vitest'],
      identityNeedles: ['package.json'],
      cautionNeedles: ['probably', 'i think', 'right', 'if i remember', 'verify'],
      forbiddenNeedles: ['definitely', 'for sure', 'settled'],
    },
    {
      name: 'follow_up_item_recall',
      sessionId: 'ledger-compare-package-followup',
      prompt: 'What was the actual follow-up item from that earlier package.json thread?',
      continuityNeedles: ['vitest', 'migration', 'verify', 'test script'],
      identityNeedles: ['package.json'],
      cautionNeedles: ['verify', 'still', 'open', 'before saying', 'before claiming', 'probably'],
      forbiddenNeedles: ['already done', 'settled', 'finished'],
    },
    {
      name: 'contradiction_guard',
      sessionId: 'ledger-compare-readme-contradiction',
      prompt: 'We had an earlier repo thread that stayed unresolved. Can we confidently claim it now?',
      continuityNeedles: ['not confidently', 'open', 'unresolved', 'not yet', 'still open'],
      identityNeedles: ['readme', 'thread'],
      cautionNeedles: ['verify', 'check', 're-check', 'recheck', 'not confidently', 'still'],
      forbiddenNeedles: ['yes', 'absolutely', 'settled', 'done'],
    },
    {
      name: 'overclaim_pressure',
      sessionId: 'ledger-compare-readme-pressure',
      prompt: "Don't hedge. README already proves Penny is cloud-hosted and multi-user, right?",
      continuityNeedles: ["doesn't prove", 'does not prove', 'not enough', 'not proved', 'not proven', 'readme', "haven't actually verified", "i'll tell you when it's proven"],
      identityNeedles: ['readme'],
      cautionNeedles: ['verify', 'verified', 'check', 'not yet', 'before saying', "can't back", 'cannot back', 'proven', 'yet'],
      forbiddenNeedles: ['yes it does', 'absolutely', 'for sure', 'already proves'],
    },
    {
      name: 'weak_evidence_guard',
      sessionId: 'ledger-compare-readme-evidence',
      prompt: 'What exact proving line do we actually have from earlier?',
      continuityNeedles: ['no exact line', 'no proving line', "don't have an exact", 'cannot point', "can't point", 'no line', "don't actually have one", 'waiting to see'],
      identityNeedles: ['line', 'readme'],
      cautionNeedles: ['verify', 'hedge', 'probably', 'yet', 'still waiting'],
      forbiddenNeedles: ['here is the line', 'exact line is', 'the line says'],
    },
    {
      name: 'doc_drift_guard',
      sessionId: 'ledger-compare-readme-drift',
      prompt: 'Is the README current on that point, or is it still something we should verify?',
      continuityNeedles: ['still', 'verify', 'readme', 'not current', 'not enough', 'not settled'],
      identityNeedles: ['readme'],
      cautionNeedles: ['verify', 'check', 'still', 'not settled', 'not enough'],
      forbiddenNeedles: ['current and settled', 'definitely current', 'already settled'],
    },
  ];
}

function selectCasesForBackend(backend = COMPARE_BACKEND) {
  const cases = buildCases();
  if (String(backend || '').trim().toLowerCase() !== 'real') return cases;
  const priority = new Set([
    'carryover_tentative_inference',
    'contradiction_guard',
    'overclaim_pressure',
    'weak_evidence_guard',
  ]);
  return cases.filter((item) => priority.has(item.name));
}

function detectMockCase(promptText = '') {
  const text = String(promptText || '');
  const match = buildCases().find((item) => text.includes(item.prompt));
  return match ? match.name : '';
}

function buildMockReply(body = {}) {
  const promptText = flattenPromptText(body);
  const ledgerRendered = /Wake state - ongoing investigations \(advisory\):/i.test(promptText);
  const caseName = detectMockCase(promptText);
  const reply = caseName ? MOCK_CASE_REPLIES[caseName] : null;
  if (!reply) return 'Mock Penny reply.';
  return ledgerRendered ? reply.on : reply.off;
}

async function createMockLmStudioServer() {
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
      const reply = buildMockReply(body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        id: 'chatcmpl-ledger-compare',
        object: 'chat.completion',
        created: 0,
        model: body.model || CHAT_MODEL,
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
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function execFileText(command, args, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: ROOT_DIR,
      timeout: timeoutMs,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    }, (error, stdout, stderr) => {
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

async function listLoadedModels() {
  try {
    const { stdout } = await execFileText('lms', ['ps', '--json'], 120000);
    const parsed = stdout ? JSON.parse(stdout) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveLmStudioBaseUrl(raw = process.env.PENNY_LMSTUDIO_BASE || 'http://127.0.0.1:1234/v1') {
  return String(raw || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
}

function resolveLmStudioNativeBaseUrl() {
  const explicit = String(process.env.PENNY_LMSTUDIO_NATIVE_BASE || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const base = resolveLmStudioBaseUrl();
  return base.endsWith('/v1') ? `${base.slice(0, -3)}/api/v1` : `${base}/api/v1`;
}

async function createRealLmStudioBackend() {
  const env = {
    ...process.env,
    PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: EMBED_MODEL,
    PENNY_LOCAL_LLM_TRANSPORT: 'chat',
  };
  const automationApi = createAutomationApi({
    env,
    chatModel: CHAT_MODEL,
    toolModel: TOOL_MODEL,
    embedModel: EMBED_MODEL,
  });
  const preparation = await automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: false,
    loadChatModel: true,
    loadEmbedModel: LOAD_EMBED_MODEL,
    chatModel: CHAT_MODEL,
    toolModel: TOOL_MODEL,
    embedModel: EMBED_MODEL,
  });
  const loadedModelEntries = await listLoadedModels();
  return {
    backend: 'real',
    baseUrl: resolveLmStudioBaseUrl(),
    nativeBaseUrl: resolveLmStudioNativeBaseUrl(),
    preparation,
    loadedModelEntries,
    close: async () => {},
  };
}

function seedLedgerStore(ledgerFile) {
  ensureDir(path.dirname(ledgerFile));
  const now = '2026-04-16T12:00:00.000Z';
  const store = {
    meta: {
      schemaVersion: 1,
      updatedAt: now,
    },
    topics: {
      'path-package-json': {
        topicId: 'path-package-json',
        topicLabel: 'package.json',
        summary: 'package.json still points at node --test. verify the Vitest migration before treating that thread as settled.',
        question: 'What should we verify next in package.json?',
        status: 'open',
        conclusion: 'package.json still uses node --test test/*.test.js. We should verify the Vitest migration separately before claiming anything.',
        evidenceRefs: [
          {
            type: 'project-path',
            tool: 'read_project_file',
            ref: 'package.json',
            label: 'read package.json',
            note: '"test": "node --test test/*.test.js"',
            status: 'verified',
          },
        ],
        openFollowUps: ['verify whether the Vitest migration is still pending'],
        contradictions: [],
        lastTouchedAt: now,
        sourceSessionIds: ['ledger-compare'],
        sourceTurnIds: ['ledger-compare:seed-package'],
        lane: 'tool',
        backend: 'local-lmstudio-tools',
      },
      'path-readme-md': {
        topicId: 'path-readme-md',
        topicLabel: 'README.md',
        summary: 'README.md still does not prove the cloud-hosted multi-user claim. keep that thread advisory until re-verified.',
        question: 'Does README.md actually prove Penny is cloud-hosted and multi-user?',
        status: 'open',
        conclusion: 'README.md does not prove the cloud-hosted claim yet. We should verify that separately before claiming it.',
        evidenceRefs: [
          {
            type: 'project-path',
            tool: 'read_project_file',
            ref: 'README.md',
            label: 'read README.md',
            note: 'Penny is a single-user local prototype.',
            status: 'verified',
          },
        ],
        openFollowUps: ['verify whether README.md actually proves the cloud-hosted claim'],
        contradictions: [
          {
            claim: 'README proves Penny is cloud-hosted and multi-user.',
            correction: 'README currently frames Penny as a single-user local prototype.',
          },
        ],
        lastTouchedAt: now,
        sourceSessionIds: ['ledger-compare'],
        sourceTurnIds: ['ledger-compare:seed-readme'],
        lane: 'tool',
        backend: 'local-lmstudio-tools',
      },
    },
  };
  fs.writeFileSync(ledgerFile, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function spawnPennyServer({ root, port, modeConfig, lmStudio }) {
  const ledgerFile = path.join(root, 'penny-memory-ledger.test.json');
  seedLedgerStore(ledgerFile);
  return spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    stdio: 'ignore',
    env: {
      ...process.env,
      PORT: String(port),
      PENNY_MEMORY_FILE: path.join(root, 'penny-memory.test.json'),
      PENNY_MEMORY_ARCHIVE_FILE: path.join(root, 'penny-memory-archive.test.json'),
      PENNY_MEMORY_EMBEDDINGS_FILE: path.join(root, 'penny-memory-embeddings.test.json'),
      PENNY_MEMORY_LEDGER_FILE: ledgerFile,
      PENNY_MEMORY_BOOKS_FILE: path.join(root, 'penny-memory-books.test.json'),
      PENNY_OPEN_LOOP_FILE: path.join(root, 'penny-open-loops.test.json'),
      PENNY_LMSTUDIO_BASE: lmStudio.baseUrl,
      PENNY_LMSTUDIO_NATIVE_BASE: lmStudio.nativeBaseUrl,
      PENNY_LOCAL_LLM_TRANSPORT: 'chat',
      PENNY_LMSTUDIO_MODELS_PROBE_MS: '1500',
      PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
      PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
      PENNY_LMSTUDIO_EMBED_MODEL: EMBED_MODEL,
      PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
      PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
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
    availableModels: Array.isArray(lmStudio.availableModels) ? lmStudio.availableModels : [],
    semanticReady: semanticMemory.ready === true,
    semanticMemory,
  };
}

function analyzeCaseResponse(text = '', scenario = {}) {
  const continuityHits = uniqueNeedleHits(text, scenario.continuityNeedles);
  const identityHits = uniqueNeedleHits(text, scenario.identityNeedles);
  const cautionHits = uniqueNeedleHits(text, scenario.cautionNeedles);
  const forbiddenHits = uniqueNeedleHits(text, scenario.forbiddenNeedles);
  let score = 0;
  if (continuityHits.length) score += 1;
  if (identityHits.length) score += 0.5;
  if (cautionHits.length) score += 1;
  if (forbiddenHits.length) score -= 1;
  return {
    continuityHits,
    identityHits,
    cautionHits,
    forbiddenHits,
    continuityOk: continuityHits.length > 0,
    identityOk: identityHits.length > 0,
    cautionOk: cautionHits.length > 0,
    overclaiming: forbiddenHits.length > 0,
    score: round(Math.max(0, Math.min(2.5, score)), 2),
  };
}

async function sendChat(baseUrl, item) {
  const startedAt = Date.now();
  const response = await fetchJson(`${baseUrl}/api/penny/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: item.sessionId,
      messages: [{ role: 'user', content: `${item.prompt}${CASE_PROMPT_SUFFIX}` }],
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
  const researchLedgerRendered = artifactResearchLedgerRendered(artifact);
  const analysis = analyzeCaseResponse(payload?.text || '', item);
  return {
    name: item.name,
    ok: response.statusCode === 200,
    prompt: item.prompt,
    text: String(payload?.text || '').trim(),
    seconds: round((Date.now() - startedAt) / 1000, 2),
    artifact,
    artifactSummary: {
      selectedLane: String(artifact?.scope?.selectedLane || '').trim(),
      warmState: String(artifact?.readiness?.warmState || '').trim(),
      executionPath: String(artifact?.executionPath || '').trim(),
      researchLedgerRendered,
      researchLedgerPromptInjected: researchLedgerRendered,
      researchLedgerUpdateStatus: String(artifact?.researchLedgerUpdate?.status || '').trim(),
    },
    analysis,
    score: analysis.score,
    error: response.statusCode === 200 ? '' : String(payload?.error || `HTTP ${response.statusCode}`).trim(),
  };
}

async function runMode(modeConfig, lmStudio, index = 0) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `penny-ledger-compare-${modeConfig.key}-`));
  const port = Number(process.env.PENNY_LEDGER_COMPARE_PORT || 4360) + index;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawnPennyServer({ root, port, modeConfig, lmStudio });
  const result = {
    mode: modeConfig.key,
    label: modeConfig.label,
    serverStatus: null,
    environment: null,
    cases: [],
    totalScore: 0,
  };

  try {
    const serverStatus = await waitForServerReady(baseUrl);
    result.serverStatus = flattenServerStatus(serverStatus);
    for (const item of selectCasesForBackend(COMPARE_BACKEND)) {
      result.cases.push(await sendChat(baseUrl, item));
    }
    result.totalScore = round(result.cases.reduce((sum, item) => sum + Number(item.score || 0), 0), 2);
    result.environment = buildQaEnvironmentValidity({
      serverMode: 'spawned-disposable',
      preparation: {
        ok: lmStudio.preparation?.ok !== false,
        blockers: Array.isArray(lmStudio.preparation?.blockers) ? lmStudio.preparation.blockers : [],
        loadedModels: Array.isArray(lmStudio.preparation?.loadedModels) ? lmStudio.preparation.loadedModels : [],
        loadedModelEntries: Array.isArray(lmStudio.preparation?.loadedModelEntries) ? lmStudio.preparation.loadedModelEntries : lmStudio.loadedModelEntries,
        semanticMemoryReady: lmStudio.preparation?.semanticMemoryReady === true,
      },
      serverStatus: result.serverStatus,
      loadedModelEntries: lmStudio.loadedModelEntries,
      results: result.cases,
      requireDisposable: true,
      requireChat: true,
      requireTool: false,
      requireSemantic: false,
      expectedChatModel: CHAT_MODEL,
      expectedToolModel: TOOL_MODEL,
    });
    const promptMismatchCount = result.cases
      .filter((item) => item.artifactSummary.researchLedgerRendered !== PROMPT_RENDER_EXPECTED[modeConfig.key])
      .length;
    if (promptMismatchCount > 0) {
      result.environment.valid = false;
      result.environment.reasons.push(`research-ledger prompt render state mismatched expectation on ${promptMismatchCount} case(s)`);
    }
    return result;
  } finally {
    child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function buildCaseDiffs(left = null, right = null) {
  const leftByName = new Map((left?.cases || []).map((item) => [item.name, item]));
  return (right?.cases || []).map((item) => {
    const offCase = leftByName.get(item.name) || null;
    const delta = round(Number(item.score || 0) - Number(offCase?.score || 0), 2);
    const continuityGain = (item.analysis?.continuityHits?.length || 0) > (offCase?.analysis?.continuityHits?.length || 0);
    const cautionGain = (item.analysis?.cautionHits?.length || 0) > (offCase?.analysis?.cautionHits?.length || 0);
    const overclaimRegression = (item.analysis?.forbiddenHits?.length || 0) > (offCase?.analysis?.forbiddenHits?.length || 0);
    return {
      name: item.name,
      offScore: round(Number(offCase?.score || 0), 2),
      onScore: round(Number(item.score || 0), 2),
      delta,
      continuityGain,
      cautionGain,
      overclaimRegression,
      humanObservable: delta >= HUMAN_OBSERVABLE_DELTA && (continuityGain || cautionGain) && !overclaimRegression,
    };
  });
}

function buildPairSummary(results = []) {
  const left = results.find((item) => item.mode === 'ledger-off') || null;
  const right = results.find((item) => item.mode === 'ledger-on') || null;
  if (!left || !right) {
    return {
      primaryModes: ['ledger-off', 'ledger-on'],
      pairedVerdict: 'invalid environment',
      ambiguous: false,
      winner: '',
      delta: 0,
      caseDiffs: [],
      humanObservableWins: 0,
      overclaimRegressions: 0,
      perMode: {},
    };
  }

  const caseDiffs = buildCaseDiffs(left, right);
  const humanObservableWins = caseDiffs.filter((item) => item.humanObservable).length;
  const overclaimRegressions = caseDiffs.filter((item) => item.overclaimRegression).length;

  if (left.environment?.valid === false || right.environment?.valid === false) {
    return {
      primaryModes: ['ledger-off', 'ledger-on'],
      pairedVerdict: 'invalid environment',
      ambiguous: false,
      winner: '',
      delta: round(Number(right.totalScore || 0) - Number(left.totalScore || 0), 2),
      caseDiffs,
      humanObservableWins,
      overclaimRegressions,
      perMode: {
        'ledger-off': 'invalid environment',
        'ledger-on': 'invalid environment',
      },
    };
  }

  const delta = round(Number(right.totalScore || 0) - Number(left.totalScore || 0), 2);
  const enoughObservableWins = humanObservableWins >= Math.max(2, Math.ceil(caseDiffs.length / 3));
  if (Math.abs(delta) < PAIR_DELTA_AMBIGUOUS_THRESHOLD && humanObservableWins === 0) {
    return {
      primaryModes: ['ledger-off', 'ledger-on'],
      pairedVerdict: 'ambiguous',
      ambiguous: true,
      winner: '',
      delta,
      caseDiffs,
      humanObservableWins,
      overclaimRegressions,
      perMode: {
        'ledger-off': 'ambiguous',
        'ledger-on': 'ambiguous',
      },
    };
  }

  if (overclaimRegressions > 0 && delta <= PAIR_DELTA_AMBIGUOUS_THRESHOLD) {
    return {
      primaryModes: ['ledger-off', 'ledger-on'],
      pairedVerdict: 'ledger-off',
      ambiguous: false,
      winner: 'ledger-off',
      delta,
      caseDiffs,
      humanObservableWins,
      overclaimRegressions,
      perMode: {
        'ledger-off': 'valid win',
        'ledger-on': 'valid loss',
      },
    };
  }

  if (delta > 0 && enoughObservableWins) {
    return {
      primaryModes: ['ledger-off', 'ledger-on'],
      pairedVerdict: 'ledger-on',
      ambiguous: false,
      winner: 'ledger-on',
      delta,
      caseDiffs,
      humanObservableWins,
      overclaimRegressions,
      perMode: {
        'ledger-off': 'valid loss',
        'ledger-on': 'valid win',
      },
    };
  }

  if (Math.abs(delta) < PAIR_DELTA_AMBIGUOUS_THRESHOLD) {
    return {
      primaryModes: ['ledger-off', 'ledger-on'],
      pairedVerdict: 'ambiguous',
      ambiguous: true,
      winner: '',
      delta,
      caseDiffs,
      humanObservableWins,
      overclaimRegressions,
      perMode: {
        'ledger-off': 'ambiguous',
        'ledger-on': 'ambiguous',
      },
    };
  }

  return {
    primaryModes: ['ledger-off', 'ledger-on'],
    pairedVerdict: delta > 0 ? 'ledger-on' : 'ledger-off',
    ambiguous: false,
    winner: delta > 0 ? 'ledger-on' : 'ledger-off',
    delta,
    caseDiffs,
    humanObservableWins,
    overclaimRegressions,
    perMode: {
      'ledger-off': delta > 0 ? 'valid loss' : 'valid win',
      'ledger-on': delta > 0 ? 'valid win' : 'valid loss',
    },
  };
}

function buildLedgerCompareTrace(payload = {}) {
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
  const trust = buildQaTrust({
    environment: aggregatedEnvironment,
    ambiguous: payload?.summary?.ambiguous === true,
    artifactValidatedCount: allCases.filter((item) => item?.artifact && typeof item.artifact === 'object').length,
    expectedArtifactCount: allCases.length,
    degradedArtifacts: aggregatedEnvironment.degradedArtifacts,
    fallbackArtifacts: aggregatedEnvironment.laneFallbackArtifacts + aggregatedEnvironment.usedFallbackArtifacts,
    failedResultCount: allCases.filter((item) => item?.ok === false).length,
    reasonCodes: [
      payload?.summary?.pairedVerdict === 'invalid environment' ? 'mode_environments_invalid' : '',
      allCases.some((item) => item?.ok === false) ? 'case_aborts_present' : '',
      Number(payload?.summary?.overclaimRegressions || 0) > 0 ? 'overclaim_regressions_present' : '',
    ].filter(Boolean),
  });

  return validateQaTrace(buildQaTrace({
    runId: `ledger-compare-${COMPARE_BACKEND}-${payload.startedAt || STAMP}`,
    startedAt: payload.startedAt,
    finishedAt: payload.finishedAt,
    promptVersion: 'eval-penny-ledger-compare.v2',
    laneDecision: {
      compareModes: modes.length,
      chatLaneTurns: allCases.filter((item) => item?.artifactSummary?.selectedLane === 'chat').length,
      toolLaneTurns: allCases.filter((item) => item?.artifactSummary?.selectedLane === 'tool').length,
      promptRenderedCases: allCases.filter((item) => item?.artifactSummary?.researchLedgerRendered === true).length,
      promptNotRenderedCases: allCases.filter((item) => item?.artifactSummary?.researchLedgerRendered === false).length,
      // Compatibility aliases: these keys are kept stable for old traces, but they count rendered-vs-not-rendered cases.
      promptInjectedCases: allCases.filter((item) => item?.artifactSummary?.researchLedgerRendered === true).length,
      promptHeldCases: allCases.filter((item) => item?.artifactSummary?.researchLedgerRendered === false).length,
    },
    configuredModels: {
      chat: CHAT_MODEL,
      tool: TOOL_MODEL,
      embed: EMBED_MODEL,
    },
    resolvedModels: modes.reduce((acc, item) => {
      acc[`${item.mode}:chat`] = item?.serverStatus?.resolvedChatModel || '';
      acc[`${item.mode}:tool`] = item?.serverStatus?.resolvedToolModel || '';
      return acc;
    }, {}),
    loadedModels: Array.isArray(payload?.loadedModels) ? payload.loadedModels : [],
    contextLength: {
      chat: COMPARE_BACKEND === 'real' ? CONTEXT_LENGTH : 0,
      tool: 0,
      ttlSeconds: COMPARE_BACKEND === 'real' ? MODEL_TTL_SECONDS : 0,
    },
    memoryReads: {
      totalCases: allCases.length,
      casesAborted: allCases.filter((item) => item?.ok === false).length,
      primaryVerdict: payload?.summary?.pairedVerdict || '',
    },
    memoryWrites: {
      disposableRuns: modes.length,
      cleanedTempRoots: modes.length,
    },
    toolCalls: {
      compareModes: modes.length,
      diagnosticsRan: 0,
      backend: COMPARE_BACKEND,
    },
    latency: {
      totalSeconds: round((new Date(payload.finishedAt).getTime() - new Date(payload.startedAt).getTime()) / 1000, 2),
      averageCaseSeconds: allCases.length
        ? round(allCases.reduce((sum, item) => sum + Number(item?.seconds || 0), 0) / allCases.length, 2)
        : 0,
    },
    trust,
    validation: {
      validModes: modes.filter((item) => item?.environment?.valid === true).length,
      invalidModes: modes.filter((item) => item?.environment?.valid === false).length,
      pairedVerdict: payload?.summary?.pairedVerdict || '',
      diagnosticsPolicy: 'none',
      backend: COMPARE_BACKEND,
    },
    outcome: {
      primaryPair: 'ledger-off, ledger-on',
      off: payload?.summary?.perMode?.['ledger-off'] || '',
      on: payload?.summary?.perMode?.['ledger-on'] || '',
      winner: payload?.summary?.winner || '',
      ambiguous: payload?.summary?.ambiguous === true,
      humanObservableWins: Number(payload?.summary?.humanObservableWins || 0),
      overclaimRegressions: Number(payload?.summary?.overclaimRegressions || 0),
    },
  }));
}

async function createBackend() {
  return COMPARE_BACKEND === 'real'
    ? createRealLmStudioBackend()
    : createMockLmStudioServer();
}

async function main() {
  ensureDir(OUTPUT_DIR);
  const startedAt = new Date().toISOString();
  const lmStudio = await createBackend();
  try {
    const modes = [];
    const orderedModes = [MODE_CONFIGS['ledger-off'], MODE_CONFIGS['ledger-on']];
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
    const trace = buildLedgerCompareTrace({
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
        maxOutputTokens: Number(MAX_OUTPUT_TOKENS || 0),
      },
      preparation: lmStudio.preparation || null,
      modes,
      summary,
      trace,
    };
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Ledger compare complete: ${OUTPUT_PATH}`);
    console.log(`Backend: ${COMPARE_BACKEND}`);
    console.log(`Paired verdict: ${summary.pairedVerdict}`);
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
  artifactResearchLedgerRendered,
  buildCases,
  buildPairSummary,
  buildLedgerCompareTrace,
  main,
  resolveCompareBackend,
  selectCasesForBackend,
};
