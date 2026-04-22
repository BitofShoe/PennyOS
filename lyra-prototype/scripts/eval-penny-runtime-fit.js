const fs = require('fs');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { createAutomationApi } = require('./penny-lmstudio-prepare');
const {
  buildGemmaRuntimeWatchForPreflight,
  runPreflight,
} = require('./penny-preflight');
const {
  buildContextPressureMarkdownSummary,
  buildContextPressureQaArtifact,
  extractRuntimeContextMetrics,
} = require('../lib/penny-context-pressure-qa');
const {
  buildGemmaRuntimeWatchArtifact,
} = require('../lib/penny-gemma-runtime-watch');
const {
  buildLmStudioChatSamplingWatch,
  normalizeLmStudioTransportForWatch,
} = require('../lib/penny-lmstudio-transports');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const PORT = Number(process.env.PENNY_RUNTIME_FIT_PORT || 4354);
const BASE_URL = process.env.PENNY_RUNTIME_FIT_BASE_URL || `http://127.0.0.1:${PORT}`;
const GENERAL_TIMEOUT_MS = Number(process.env.PENNY_RUNTIME_FIT_TIMEOUT_MS || 420000);
const LOAD_TIMEOUT_MS = Number(process.env.PENNY_RUNTIME_FIT_LOAD_TIMEOUT_MS || 1200000);
const MODEL_TTL_SECONDS = Number(process.env.PENNY_RUNTIME_FIT_MODEL_TTL_SECONDS || 1800);
const CHAT_MODEL = String(process.env.PENNY_RUNTIME_FIT_CHAT_MODEL || process.env.PENNY_QA_CHAT_MODEL || 'unsloth/gemma-4-31b-it@q6_k').trim();
const TOOL_MODEL = String(process.env.PENNY_RUNTIME_FIT_TOOL_MODEL || process.env.PENNY_QA_TOOL_MODEL || 'google/gemma-4-e4b').trim();
const EMBED_MODEL = String(process.env.PENNY_RUNTIME_FIT_EMBED_MODEL || process.env.PENNY_QA_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();
const PRESET_IDENTIFIER = String(process.env.PENNY_RUNTIME_FIT_PRESET_IDENTIFIER || process.env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny';
const DEFAULT_CONTEXT_LENGTH = Number(process.env.PENNY_RUNTIME_FIT_CONTEXT_DEFAULT || 10000);
const SHORT_CONTEXT_LENGTH = Number(process.env.PENNY_RUNTIME_FIT_CONTEXT_SHORT || 6144);
const TOOL_CONTEXT_LENGTH = Number(process.env.PENNY_RUNTIME_FIT_TOOL_CONTEXT || 8192);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_RUNTIME_FIT_MAX_OUTPUT_TOKENS || 320);
const CHAT_TEMPERATURE = Number(process.env.PENNY_RUNTIME_FIT_CHAT_TEMPERATURE || process.env.PENNY_LMSTUDIO_CHAT_TEMPERATURE || 1.0);
const CHAT_TOP_P = Number(process.env.PENNY_RUNTIME_FIT_CHAT_TOP_P || process.env.PENNY_LMSTUDIO_CHAT_TOP_P || 0.95);
const CHAT_TOP_K = Number(process.env.PENNY_RUNTIME_FIT_CHAT_TOP_K || process.env.PENNY_LMSTUDIO_CHAT_TOP_K || 64);
const OUTPUT_PATH = path.join(OUTPUT_DIR, `runtime-fit-${STAMP}.json`);
const SUMMARY_PATH = path.join(OUTPUT_DIR, `runtime-fit-${STAMP}.md`);
const CONTEXT_PRESSURE_OUTPUT_PATH = path.join(OUTPUT_DIR, `runtime-fit-context-pressure-${STAMP}.json`);
const CONTEXT_PRESSURE_SUMMARY_PATH = path.join(OUTPUT_DIR, `runtime-fit-context-pressure-${STAMP}.md`);
const GEMMA_RUNTIME_WATCH_OUTPUT_PATH = path.join(OUTPUT_DIR, `gemma-runtime-watch-${STAMP}.json`);

const SCENARIOS = [
  {
    slug: 'baseline-default-context',
    label: 'Baseline default context',
    description: 'Current Penny stack with semantic memory ready and the default chat context.',
    chatContextLength: DEFAULT_CONTEXT_LENGTH,
    toolContextLength: TOOL_CONTEXT_LENGTH,
    embedModel: EMBED_MODEL,
    expectSemanticReady: true,
  },
  {
    slug: 'short-context',
    label: 'Shorter chat context',
    description: 'Same stack, but with a shorter chat-model context to measure context-length cost.',
    chatContextLength: SHORT_CONTEXT_LENGTH,
    toolContextLength: TOOL_CONTEXT_LENGTH,
    embedModel: EMBED_MODEL,
    expectSemanticReady: true,
  },
  {
    slug: 'semantic-fallback',
    label: 'Semantic fallback',
    description: 'Same stack, but with an invalid embed model identifier so Penny falls back to keyword retrieval.',
    chatContextLength: DEFAULT_CONTEXT_LENGTH,
    toolContextLength: TOOL_CONTEXT_LENGTH,
    embedModel: 'missing-embed-model-for-runtime-fit',
    expectSemanticReady: false,
  },
];

function parseRuntimeFitArgs(argv = process.argv.slice(2)) {
  let contextPressureFixture = process.env.PENNY_RUNTIME_FIT_CONTEXT_PRESSURE_FIXTURE === '1';
  let gemmaRuntimeWatch = process.env.PENNY_RUNTIME_FIT_GEMMA_WATCH === '1';
  for (const rawArg of argv) {
    const arg = String(rawArg || '').trim();
    if (!arg) continue;
    if (arg === '--context-pressure-fixture' || arg === '--fixture-context-pressure') {
      contextPressureFixture = true;
    }
    if (arg === '--gemma-runtime-watch' || arg === '--runtime-watch-gemma') {
      gemmaRuntimeWatch = true;
    }
  }
  return { contextPressureFixture, gemmaRuntimeWatch };
}

const RUNTIME_FIT_ARGS = parseRuntimeFitArgs(process.argv.slice(2));

function buildGemmaRuntimeWatchForRuntimeFit({
  generatedAt = new Date().toISOString(),
  measurementMode = 'runtime-fit',
  status = {},
  contextLength = DEFAULT_CONTEXT_LENGTH,
} = {}) {
  const safeStatus = status && typeof status === 'object' ? status : {};
  const transport = normalizeLmStudioTransportForWatch(
    safeStatus.localTransport || process.env.PENNY_LOCAL_LLM_TRANSPORT || process.env.PENNY_LMSTUDIO_TRANSPORT || 'chat',
  );
  return buildGemmaRuntimeWatchArtifact({
    generatedAt,
    measurementMode,
    status: safeStatus,
    transport,
    requestedModel: safeStatus.chatPreferredModel || safeStatus.configuredChatModel || CHAT_MODEL,
    resolvedModel: safeStatus.resolvedChatModel || safeStatus.resolvedModel || '',
    visionBudget: {
      exposed: false,
      knobNames: [],
      notes: 'Runtime-fit watch does not expose or change a separate Gemma vision-budget knob.',
    },
    imagePolicy: {
      currentTurnImageOnly: true,
      imagePartBeforeText: true,
    },
    thinkingControls: {
      exposed: null,
      notes: 'Thinking controls are recorded as watch-only; companion chat stays off by default unless an explicit eval opts in.',
    },
    promptCacheRamRisk: {
      contextLength,
      notes: 'Watch only; large context and high vision budgets still need explicit eval before default changes.',
    },
    chatSampling: buildLmStudioChatSamplingWatch({
      temperature: CHAT_TEMPERATURE,
      topP: CHAT_TOP_P,
      topK: CHAT_TOP_K,
    }),
  });
}

function summarizeGemmaRuntimeWatchPreflight(preflightReport = null, preflightError = null) {
  if (!preflightReport) {
    return {
      attempted: true,
      ok: false,
      error: String(preflightError?.message || preflightError || 'Preflight did not return a report.').trim(),
      checks: [],
      loadedModels: [],
      installedModelCount: null,
      semanticMemory: 'unknown',
    };
  }
  const checks = Array.isArray(preflightReport.checks)
    ? preflightReport.checks.map((check) => ({
        name: String(check?.name || '').trim(),
        ok: check?.ok === true,
        level: String(check?.level || (check?.ok ? 'pass' : 'fail')).trim(),
        detail: String(check?.detail || '').trim(),
      }))
    : [];
  return {
    attempted: true,
    ok: preflightReport.ok === true,
    checks,
    loadedModels: Array.isArray(preflightReport.loadedModels) ? preflightReport.loadedModels.slice() : [],
    installedModelCount: Array.isArray(preflightReport.installedModels) ? preflightReport.installedModels.length : null,
    semanticMemory: preflightReport.report?.semanticMemoryReady === true ? 'ready' : 'fallback-or-unknown',
    readinessState: preflightReport.readinessSummary?.state || null,
  };
}

function buildGemmaRuntimeWatchRunnerArtifact({
  generatedAt = new Date().toISOString(),
  preflightReport = null,
  preflightError = null,
} = {}) {
  const watch = buildGemmaRuntimeWatchForPreflight({
    generatedAt,
    preflightReport,
    status: preflightReport?.status || null,
    env: process.env,
    chatModel: CHAT_MODEL,
  });
  return {
    ...watch,
    runner: {
      command: 'npm run eval:runtime-fit:gemma-watch',
      source: preflightReport ? 'preflight-status' : 'fallback-status',
      liveChatGenerationRequired: false,
      changesLoadedModel: false,
      changesThinkingDefault: false,
      changesContextLength: false,
      touchesMemoryFiles: false,
    },
    readOnlyChecks: {
      preflight: summarizeGemmaRuntimeWatchPreflight(preflightReport, preflightError),
    },
  };
}

async function runGemmaRuntimeWatchRunner({
  runPreflightImpl = runPreflight,
  outputPath = GEMMA_RUNTIME_WATCH_OUTPUT_PATH,
} = {}) {
  ensureDir(OUTPUT_DIR);
  const generatedAt = new Date().toISOString();
  let preflightReport = null;
  let preflightError = null;
  try {
    preflightReport = await runPreflightImpl();
  } catch (error) {
    preflightError = error;
  }
  const artifact = buildGemmaRuntimeWatchRunnerArtifact({
    generatedAt,
    preflightReport,
    preflightError,
  });
  writeJsonFile(outputPath, artifact);
  return { artifact, outputPath };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function roundSeconds(ms) {
  return round(Number(ms || 0) / 1000, 2);
}

function latencyMsFromSeconds(seconds) {
  const parsed = Number(seconds);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 1000) : null;
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

async function unloadAllModels() {
  try {
    await execFileText('lms', ['unload', '--all'], 120000);
  } catch (error) {
    const text = `${error.stderr || ''}\n${error.stdout || ''}`;
    if (!/no models|nothing loaded|there are no loaded models/i.test(text)) throw error;
  }
}

async function loadModel(automationApi, modelKey, contextLength) {
  return automationApi.loadModel(modelKey, 'runtime-fit model', {
    contextLength,
    ttlSeconds: MODEL_TTL_SECONDS,
  });
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

function buildMemoryPayload() {
  return { userName: '', voiceOn: false, brainMode: 'local' };
}

async function chatRequest(sessionId, messages, timeoutMs = GENERAL_TIMEOUT_MS) {
  const started = Date.now();
  const promptText = (Array.isArray(messages) ? messages : [])
    .map((message) => `${String(message?.role || '').trim() || 'message'}: ${String(message?.content || '')}`)
    .join('\n');
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
      promptText,
      text: String(data?.text || ''),
      meta: data?.meta || {},
      artifact: data?.meta?.artifact || null,
    };
  } catch (error) {
    return {
      ok: false,
      seconds: roundSeconds(Date.now() - started),
      promptText,
      error: error?.message || 'Unknown error',
      meta: error?.data?.meta || {},
      artifact: error?.data?.meta?.artifact || null,
    };
  }
}

function buildScenarioPaths(slug) {
  return {
    memoryFile: path.join(ROOT_DIR, 'data', `penny-memory.runtime-fit-${slug}.${STAMP}.json`),
    archiveFile: path.join(ROOT_DIR, 'data', `penny-memory-archive.runtime-fit-${slug}.${STAMP}.json`),
    embeddingsFile: path.join(ROOT_DIR, 'data', `penny-memory-embeddings.runtime-fit-${slug}.${STAMP}.json`),
    booksFile: path.join(ROOT_DIR, 'data', `penny-memory-books.runtime-fit-${slug}.${STAMP}.json`),
    ledgerFile: path.join(ROOT_DIR, 'data', `penny-memory-ledger.runtime-fit-${slug}.${STAMP}.json`),
    openLoopFile: path.join(ROOT_DIR, 'data', `penny-open-loops.runtime-fit-${slug}.${STAMP}.json`),
    stdoutPath: path.join(OUTPUT_DIR, `runtime-fit-${slug}-${STAMP}.server.out.log`),
    stderrPath: path.join(OUTPUT_DIR, `runtime-fit-${slug}-${STAMP}.server.err.log`),
  };
}

function scenarioDisposableFiles(paths = {}) {
  return [
    paths.memoryFile,
    paths.archiveFile,
    paths.embeddingsFile,
    paths.booksFile,
    paths.ledgerFile,
    paths.openLoopFile,
  ].filter(Boolean);
}

function buildScenarioEnv(scenario, paths, baseEnv = process.env) {
  return {
    ...baseEnv,
    PORT: String(PORT),
    PENNY_MEMORY_FILE: paths.memoryFile,
    PENNY_MEMORY_ARCHIVE_FILE: paths.archiveFile,
    PENNY_MEMORY_EMBEDDINGS_FILE: paths.embeddingsFile,
    PENNY_MEMORY_BOOKS_FILE: paths.booksFile,
    PENNY_MEMORY_LEDGER_FILE: paths.ledgerFile,
    PENNY_OPEN_LOOP_FILE: paths.openLoopFile,
    PENNY_LMSTUDIO_CHAT_MODEL: CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: scenario.embedModel,
    PENNY_LMSTUDIO_PRESET_IDENTIFIER: PRESET_IDENTIFIER,
    PENNY_LOCAL_LLM_TRANSPORT: baseEnv.PENNY_LOCAL_LLM_TRANSPORT || 'chat',
    PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
  };
}

function removeFileIfExists(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {}
}

function createServerProcess({ slug, env, stdoutPath, stderrPath }) {
  ensureDir(path.dirname(stdoutPath));
  ensureDir(path.dirname(stderrPath));
  const outStream = fs.createWriteStream(stdoutPath, { flags: 'w' });
  const errStream = fs.createWriteStream(stderrPath, { flags: 'w' });
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
  if (!child || child.killed) return;
  child.kill();
  await new Promise((resolve) => child.once('exit', () => resolve()));
}

function normalizeScenarioSummary(result = {}) {
  const casual = result.turns?.casualFirst || {};
  const steady = result.turns?.casualSteady || {};
  const memory = result.turns?.memoryHeavy || {};
  const tool = result.turns?.toolHeavy || {};
  return {
    firstTurnSeconds: casual.seconds || null,
    firstTokenMs: casual.meta?.performance?.firstToken?.durationMs ?? casual.artifact?.performance?.firstToken?.durationMs ?? null,
    steadyStateSeconds: steady.seconds || null,
    memoryTurnSeconds: memory.seconds || null,
    toolTurnSeconds: tool.seconds || null,
    requestMs: casual.meta?.performance?.request?.durationMs ?? casual.artifact?.performance?.request?.durationMs ?? null,
    readiness: result.status?.readiness || null,
    semanticReady: result.status?.readiness?.embeddingReady === true,
    fallbackActive: result.status?.readiness?.fallbackActive === true,
    turnMetrics: {
      casualFirst: extractRuntimeContextMetrics({
        label: 'casualFirst',
        prompt: casual.promptText || '',
        answerText: casual.text || '',
        artifact: casual.artifact || casual.meta?.artifact || null,
        totalLatencyMs: latencyMsFromSeconds(casual.seconds),
      }),
      casualSteady: extractRuntimeContextMetrics({
        label: 'casualSteady',
        prompt: steady.promptText || '',
        answerText: steady.text || '',
        artifact: steady.artifact || steady.meta?.artifact || null,
        totalLatencyMs: latencyMsFromSeconds(steady.seconds),
      }),
      memoryHeavy: extractRuntimeContextMetrics({
        label: 'memoryHeavy',
        prompt: memory.promptText || '',
        answerText: memory.text || '',
        artifact: memory.artifact || memory.meta?.artifact || null,
        totalLatencyMs: latencyMsFromSeconds(memory.seconds),
      }),
      toolHeavy: extractRuntimeContextMetrics({
        label: 'toolHeavy',
        prompt: tool.promptText || '',
        answerText: tool.text || '',
        artifact: tool.artifact || tool.meta?.artifact || null,
        totalLatencyMs: latencyMsFromSeconds(tool.seconds),
      }),
    },
  };
}

function pickBestScenario(results = [], key) {
  const valid = results.filter((item) => Number.isFinite(Number(item?.summary?.[key])));
  if (!valid.length) return null;
  return valid.reduce((best, current) => (Number(current.summary[key]) < Number(best.summary[key]) ? current : best));
}

function buildRecommendations(results = []) {
  const baseline = results.find((item) => item.slug === 'baseline-default-context') || null;
  const shortContext = results.find((item) => item.slug === 'short-context') || null;
  const fallback = results.find((item) => item.slug === 'semantic-fallback') || null;
  const bestFirst = pickBestScenario(results, 'firstTurnSeconds');
  const bestSteady = pickBestScenario(results, 'steadyStateSeconds');
  return {
    bestFirstTurn: bestFirst ? {
      slug: bestFirst.slug,
      label: bestFirst.label,
      seconds: bestFirst.summary.firstTurnSeconds,
    } : null,
    bestSteadyState: bestSteady ? {
      slug: bestSteady.slug,
      label: bestSteady.label,
      seconds: bestSteady.summary.steadyStateSeconds,
    } : null,
    contextLengthCost: baseline && shortContext ? {
      baselineFirstTurnSeconds: baseline.summary.firstTurnSeconds,
      shortContextFirstTurnSeconds: shortContext.summary.firstTurnSeconds,
      deltaSeconds: round((baseline.summary.firstTurnSeconds || 0) - (shortContext.summary.firstTurnSeconds || 0), 2),
    } : null,
    semanticMemoryImpact: baseline && fallback ? {
      semanticReadyMemoryTurnSeconds: baseline.summary.memoryTurnSeconds,
      fallbackMemoryTurnSeconds: fallback.summary.memoryTurnSeconds,
      deltaSeconds: round((fallback.summary.memoryTurnSeconds || 0) - (baseline.summary.memoryTurnSeconds || 0), 2),
    } : null,
  };
}

function buildMarkdownSummary(report) {
  const lines = [
    '# Penny Runtime Fit Summary',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Chat model: ${report.defaults.chatModel}`,
    `- Tool model: ${report.defaults.toolModel}`,
    `- Embed model: ${report.defaults.embedModel}`,
    `- Base URL: ${report.baseUrl}`,
    '',
    '## Scenarios',
    '',
  ];
  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.label}`);
    lines.push(`- Slug: ${scenario.slug}`);
    lines.push(`- Context: ${scenario.config.chatContextLength}`);
    lines.push(`- Embed model: ${scenario.config.embedModel}`);
    lines.push(`- Semantic ready: ${scenario.summary.semanticReady ? 'yes' : 'no'}`);
    lines.push(`- First turn: ${scenario.summary.firstTurnSeconds ?? 'n/a'}s`);
    lines.push(`- Steady state: ${scenario.summary.steadyStateSeconds ?? 'n/a'}s`);
    lines.push(`- Memory-heavy turn: ${scenario.summary.memoryTurnSeconds ?? 'n/a'}s`);
    lines.push(`- Tool-heavy turn: ${scenario.summary.toolTurnSeconds ?? 'n/a'}s`);
    lines.push(`- First token: ${scenario.summary.firstTokenMs ?? 'n/a'}ms`);
    lines.push(`- Memory-heavy rendered context: ${scenario.summary.turnMetrics?.memoryHeavy?.renderedMemoryCount ?? 'n/a'} rendered / ${scenario.summary.turnMetrics?.memoryHeavy?.selectedMemoryCount ?? 'n/a'} selected item(s)`);
    lines.push(`- Memory-heavy estimated request-message tokens: ${scenario.summary.turnMetrics?.memoryHeavy?.estimatedRequestMessageTokens ?? scenario.summary.turnMetrics?.memoryHeavy?.estimatedPromptTokens ?? 'n/a'}`);
    lines.push(`- Warm state: ${scenario.summary.readiness?.warmState || 'unknown'}`);
    lines.push('');
  }
  if (report.contextPressureFixture) {
    lines.push('## Context-Pressure Fixture');
    lines.push('');
    lines.push(`- Schema: ${report.contextPressureFixture.schema}`);
    lines.push(`- Mode: ${report.contextPressureFixture.measurementMode || 'fixture-only'}`);
    lines.push(`- Live model calls: ${report.contextPressureFixture.liveModelCalls === true ? 'yes' : 'no'}`);
    lines.push(`- Live answer drift measured: ${report.contextPressureFixture.liveAnswerDriftMeasured === true ? 'yes' : 'no'}`);
    lines.push(`- Variants: ${report.contextPressureFixture.contextVariants.map((item) => item.level).join(', ')}`);
    lines.push(`- Source-sensitive cases: ${report.contextPressureFixture.sourceSensitiveMemory.cases.length}`);
    if (report.contextPressureFixture.candidateSurvivalCorrelation) {
      const correlation = report.contextPressureFixture.candidateSurvivalCorrelation;
      lines.push(`- Candidate-survival correlation: ${correlation.measurementMode || 'fixture-only'}, selection=${correlation.candidateSurvival?.selectionVerdict || 'not-run'}, rendered delta=${correlation.contextPressure?.renderedMemoryCountDelta ?? 'n/a'}, estimated token delta=${correlation.contextPressure?.estimatedPromptTokenDelta ?? 'n/a'}, drift=${correlation.contextPressure?.answerDrift || 'not-run'}`);
    }
    lines.push('');
  }
  if (report.gemmaRuntimeWatch) {
    const watch = report.gemmaRuntimeWatch;
    const identity = watch.watchItems?.loadedModelIdentity || {};
    const sampling = watch.watchItems?.chatSampling || {};
    lines.push('## Gemma Runtime Watch');
    lines.push('');
    lines.push(`- Schema: ${watch.schema}`);
    lines.push(`- Mode: ${watch.measurementMode}`);
    lines.push(`- Transport: ${watch.servingPath?.transport || 'unknown'}`);
    lines.push(`- Model: requested ${identity.requested || 'n/a'} / resolved ${identity.resolved || 'n/a'} (exact=${identity.exactMatch === true ? 'yes' : 'no'}, compatible=${identity.compatibleMatch === true ? 'yes' : 'no'})`);
    lines.push(`- Chat sampling: temperature=${sampling.temperature ?? 'n/a'}, topP=${sampling.topP ?? 'n/a'}, topK=${sampling.topK ?? 'n/a'}`);
    lines.push(`- Prompt-cache RAM risk: ${watch.watchItems?.promptCacheRamRisk?.status || 'watch'}, context=${watch.watchItems?.promptCacheRamRisk?.contextLength ?? 'n/a'}`);
    lines.push('');
  }
  lines.push('## Recommendations');
  lines.push('');
  if (report.recommendations.bestFirstTurn) {
    lines.push(`- Best first turn: ${report.recommendations.bestFirstTurn.label} (${report.recommendations.bestFirstTurn.seconds}s)`);
  }
  if (report.recommendations.bestSteadyState) {
    lines.push(`- Best steady state: ${report.recommendations.bestSteadyState.label} (${report.recommendations.bestSteadyState.seconds}s)`);
  }
  if (report.recommendations.contextLengthCost) {
    const item = report.recommendations.contextLengthCost;
    lines.push(`- Context delta (baseline - short): ${item.deltaSeconds}s`);
  }
  if (report.recommendations.semanticMemoryImpact) {
    const item = report.recommendations.semanticMemoryImpact;
    lines.push(`- Semantic memory impact (fallback - ready): ${item.deltaSeconds}s on the memory-heavy turn`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function prepareScenarioRuntime(scenario, env) {
  const automationApi = createAutomationApi({
    env,
  });
  const prepare = await automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: true,
    loadChatModel: false,
    loadEmbedModel: false,
    chatModel: CHAT_MODEL,
    toolModel: TOOL_MODEL,
    embedModel: scenario.embedModel,
  });
  return { automationApi, prepare };
}

async function runScenario(scenario) {
  const paths = buildScenarioPaths(scenario.slug);
  ensureDir(OUTPUT_DIR);
  ensureDir(path.dirname(paths.memoryFile));
  for (const filePath of scenarioDisposableFiles(paths)) {
    removeFileIfExists(filePath);
  }

  const env = buildScenarioEnv(scenario, paths);

  const startedAt = new Date().toISOString();
  let server = null;
  try {
    const { automationApi, prepare } = await prepareScenarioRuntime(scenario, env);
    await unloadAllModels();
    const modelLoads = [];
    modelLoads.push(await loadModel(automationApi, CHAT_MODEL, scenario.chatContextLength));
    if (TOOL_MODEL && TOOL_MODEL !== CHAT_MODEL) {
      modelLoads.push(await loadModel(automationApi, TOOL_MODEL, scenario.toolContextLength));
    }
    if (scenario.expectSemanticReady) {
      modelLoads.push(await loadModel(automationApi, scenario.embedModel));
    }
    const loadedModels = await listLoadedModels();

    server = createServerProcess({
      slug: scenario.slug,
      env,
      stdoutPath: paths.stdoutPath,
      stderrPath: paths.stderrPath,
    });
    const startupStatus = await waitForServerReady();
    const lmStatus = await fetchJson(`${BASE_URL}/api/penny/lmstudio/status`, {}, 30000);

    const casualSessionId = `runtime-fit-${scenario.slug}-casual`;
    const casualFirst = await chatRequest(casualSessionId, [
      { role: 'user', content: 'Keep it tight: greet me like Penny in one sentence and keep the tone playful.' },
    ]);
    const casualSteady = casualFirst.ok
      ? await chatRequest(casualSessionId, [
          { role: 'user', content: 'Keep it tight: greet me like Penny in one sentence and keep the tone playful.' },
          { role: 'assistant', content: casualFirst.text },
          { role: 'user', content: 'One short follow-up line with the same energy.' },
        ])
      : { ok: false, seconds: null, error: 'First turn failed; steady-state turn skipped.' };
    const memoryHeavy = await chatRequest(`runtime-fit-${scenario.slug}-memory`, [
      { role: 'user', content: 'Remember what my favorite tea is now? If you cannot verify it, say so plainly.' },
    ]);
    const toolHeavy = await chatRequest(`runtime-fit-${scenario.slug}-tool`, [
      { role: 'user', content: 'Open README.md and tell me what it says in one short sentence.' },
    ]);

    const finishedAt = new Date().toISOString();
    const result = {
      slug: scenario.slug,
      label: scenario.label,
      description: scenario.description,
      config: {
        chatContextLength: scenario.chatContextLength,
        toolContextLength: scenario.toolContextLength,
        embedModel: scenario.embedModel,
        presetIdentifier: PRESET_IDENTIFIER,
      },
      startedAt,
      finishedAt,
      prepare,
      loadedModels,
      startup: {
        status: startupStatus,
        lmStudio: lmStatus,
      },
      turns: {
        casualFirst,
        casualSteady,
        memoryHeavy,
        toolHeavy,
      },
    };
    result.status = startupStatus;
    result.summary = normalizeScenarioSummary(result);
    return result;
  } finally {
    await stopServerProcess(server);
    for (const filePath of scenarioDisposableFiles(paths)) {
      removeFileIfExists(filePath);
    }
  }
}

async function main() {
  ensureDir(OUTPUT_DIR);
  if (RUNTIME_FIT_ARGS.gemmaRuntimeWatch) {
    const result = await runGemmaRuntimeWatchRunner();
    process.stdout.write(`\nSaved Gemma runtime watch JSON to ${result.outputPath}\n`);
    return;
  }
  if (RUNTIME_FIT_ARGS.contextPressureFixture) {
    const generatedAt = new Date().toISOString();
    const report = buildContextPressureQaArtifact({
      generatedAt,
      defaults: {
        chatModel: CHAT_MODEL,
        toolModel: TOOL_MODEL,
        embedModel: EMBED_MODEL,
      },
    });
    report.gemmaRuntimeWatch = buildGemmaRuntimeWatchForRuntimeFit({
      generatedAt,
      measurementMode: 'fixture-only',
      contextLength: DEFAULT_CONTEXT_LENGTH,
    });
    writeJsonFile(CONTEXT_PRESSURE_OUTPUT_PATH, report);
    fs.writeFileSync(CONTEXT_PRESSURE_SUMMARY_PATH, buildContextPressureMarkdownSummary(report), 'utf8');
    process.stdout.write(`\nSaved context-pressure fixture JSON to ${CONTEXT_PRESSURE_OUTPUT_PATH}\n`);
    process.stdout.write(`Saved context-pressure fixture summary to ${CONTEXT_PRESSURE_SUMMARY_PATH}\n`);
    return;
  }
  const results = [];
  for (const scenario of SCENARIOS) {
    process.stdout.write(`\n[Runtime Fit] ${scenario.label}\n`);
    const result = await runScenario(scenario);
    results.push(result);
  }
  const generatedAt = new Date().toISOString();
  const baselineStatus = results[0]?.startup?.lmStudio || results[0]?.status || {};
  const report = {
    generatedAt,
    baseUrl: BASE_URL,
    defaults: {
      chatModel: CHAT_MODEL,
      toolModel: TOOL_MODEL,
      embedModel: EMBED_MODEL,
      presetIdentifier: PRESET_IDENTIFIER,
      defaultContextLength: DEFAULT_CONTEXT_LENGTH,
      shortContextLength: SHORT_CONTEXT_LENGTH,
    },
    scenarios: results,
    contextPressureFixture: buildContextPressureQaArtifact({
      generatedAt,
      defaults: {
        chatModel: CHAT_MODEL,
        toolModel: TOOL_MODEL,
        embedModel: EMBED_MODEL,
      },
    }),
    gemmaRuntimeWatch: buildGemmaRuntimeWatchForRuntimeFit({
      generatedAt,
      measurementMode: 'runtime-fit',
      status: baselineStatus,
      contextLength: DEFAULT_CONTEXT_LENGTH,
    }),
    recommendations: buildRecommendations(results),
  };
  writeJsonFile(OUTPUT_PATH, report);
  fs.writeFileSync(SUMMARY_PATH, buildMarkdownSummary(report), 'utf8');
  process.stdout.write(`\nSaved runtime-fit JSON to ${OUTPUT_PATH}\n`);
  process.stdout.write(`Saved runtime-fit summary to ${SUMMARY_PATH}\n`);
}

function writeJsonFile(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.stack || error?.message || error).trim()}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  SCENARIOS,
  buildScenarioEnv,
  buildScenarioPaths,
  scenarioDisposableFiles,
  parseRuntimeFitArgs,
  buildRecommendations,
  buildMarkdownSummary,
  buildGemmaRuntimeWatchForRuntimeFit,
  buildGemmaRuntimeWatchRunnerArtifact,
  runGemmaRuntimeWatchRunner,
  summarizeGemmaRuntimeWatchPreflight,
  normalizeScenarioSummary,
};
