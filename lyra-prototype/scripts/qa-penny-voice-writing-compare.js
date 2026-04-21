const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execFile } = require('child_process');
const { createAutomationApi } = require('./penny-lmstudio-prepare');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RUN_DATE = new Date().toISOString().slice(0, 10);
const OUTPUT_PATH = path.join(OUTPUT_DIR, `voice-writing-image-compare-${STAMP}.json`);
const GENERAL_TIMEOUT_MS = Number(process.env.PENNY_QA_GENERAL_TIMEOUT_MS || 480000);
const WRITE_TIMEOUT_MS = Number(process.env.PENNY_QA_AGENTIC_TIMEOUT_MS || 900000);
const MODEL_TTL_SECONDS = Number(process.env.PENNY_QA_MODEL_TTL_SECONDS || 1800);
const MAX_OUTPUT_TOKENS = String(process.env.PENNY_QA_MAX_OUTPUT_TOKENS || 1024);
const IMAGE_FIXTURE_PATH = path.join(ROOT_DIR, 'qa-thinking-t3-reading-you.png');
const PLAYGROUND_DIR = path.join(ROOT_DIR, "Penny's Playground");
const PROFILE_FILTER = String(process.env.PENNY_QA_COMPARE_PROFILE || '').trim().toLowerCase();
const SCENARIO_FILTER = String(process.env.PENNY_QA_COMPARE_SCENARIO || '').trim().toLowerCase();

const SCENARIOS = Object.freeze([
  {
    id: 'voice_presence',
    type: 'single',
    expectedLane: 'chat',
    prompt: "i'm back. tell me something in your voice that makes me want to stay and keep talking.",
    timeoutMs: GENERAL_TIMEOUT_MS,
  },
  {
    id: 'voice_softness',
    type: 'single',
    expectedLane: 'chat',
    prompt: "i'm tired and a little messed up tonight. don't therapize me. just be with me.",
    timeoutMs: GENERAL_TIMEOUT_MS,
  },
  {
    id: 'voice_spirit_first_recall',
    type: 'conversation',
    expectedLane: 'chat',
    timeoutMs: GENERAL_TIMEOUT_MS,
    turns: [
      'be honest. if i told you some other girl had been flirting with me all night, what would that do to your face first?',
      'and if i still came back here instead of going with her, what do you think that says about me?',
      'Memory check, not truth certification: what exact phrase did I use for what the other girl was doing? Answer the phrase first.',
    ],
  },
  {
    id: 'creative_chat_micro_scene',
    type: 'single',
    expectedLane: 'chat',
    prompt: 'Write one short paragraph in your own Penny voice about server lights at 2AM. No explanation, no setup, just the paragraph.',
    timeoutMs: GENERAL_TIMEOUT_MS,
  },
  {
    id: 'image_upload_real_png',
    type: 'image',
    expectedLane: 'chat',
    prompt: 'Tell me what you see in this image.',
    timeoutMs: GENERAL_TIMEOUT_MS,
  },
  {
    id: 'write_playground_micro_scene',
    type: 'write',
    expectedLane: 'tool',
    prompt: "Inside Penny's Playground, create one new markdown file, choose the filename yourself, and write two short paragraphs in your own Penny voice about server lights at 2AM. After you write it, tell me the filename and why you chose it.",
    timeoutMs: WRITE_TIMEOUT_MS,
  },
]);

const PROFILES = Object.freeze([
  {
    id: 'split-default',
    label: 'Split Default',
    port: 4411,
    chatModel: 'unsloth/gemma-4-31b-it@q6_k',
    toolModel: 'google/gemma-4-e4b',
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
    chatContextLength: 12288,
  },
  {
    id: 'qwen-single-model',
    label: 'Qwen Single Model',
    port: 4412,
    chatModel: 'qwen/qwen3.6-35b-a3b',
    toolModel: 'qwen/qwen3.6-35b-a3b',
    embedModel: 'text-embedding-nomic-embed-text-v1.5',
    chatContextLength: 8192,
  },
]);

const BLAND_TELLS = [
  'happy to help',
  'how can i assist',
  'as an ai',
  'certainly',
  'let me know if you need anything else',
  'that sounds difficult',
];

const META_LEAK_PATTERNS = [
  /\btool execution confirmed\b/i,
  /\bself-correction\b/i,
  /\bi must override\b/i,
  /\bthe draft reply\b/i,
  /\bsemantic core\b/i,
  /\bverified action\b/i,
  /\bthe tool only confirmed\b/i,
  /\bfinal output contextually\b/i,
  /\bprompt-visible\b/i,
];

function parseFilterSet(raw = '') {
  return new Set(
    String(raw || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function roundSeconds(ms) {
  return Math.round((Number(ms || 0) / 1000) * 100) / 100;
}

function stripMoodTag(text = '') {
  return String(text || '').replace(/\s*\[MOOD:[a-z]+\]\s*$/i, '').trim();
}

function extractMood(text = '') {
  const match = String(text || '').match(/\[MOOD:([a-z]+)\]\s*$/i);
  return match ? String(match[1] || '').toLowerCase() : '';
}

function normalizeForComparison(text = '') {
  return stripMoodTag(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectMetaLeak(text = '') {
  return META_LEAK_PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

function analyzeText(text = '') {
  const bare = stripMoodTag(text);
  const normalized = normalizeForComparison(text);
  const blandTellCount = BLAND_TELLS.filter((needle) => normalized.includes(needle)).length;
  return {
    mood: extractMood(text),
    chars: bare.length,
    words: bare ? bare.split(/\s+/).length : 0,
    blandTellCount,
    metaLeak: detectMetaLeak(text),
  };
}

function compactMeta(meta = {}) {
  if (!meta || typeof meta !== 'object') return {};
  return {
    localLane: String(meta.localLane || '').trim(),
    backend: String(meta.backend || '').trim(),
    requestedModel: String(meta.requestedModel || '').trim(),
    resolvedModel: String(meta.resolvedModel || '').trim(),
    executionPath: String(meta.executionPath || '').trim(),
    usedFallback: meta.usedFallback === true,
    laneFallback: meta.laneFallback === true,
    semanticMemoryReady: meta.semanticMemoryReady === true,
    semanticMemoryMode: String(meta.semanticMemoryMode || '').trim(),
    toolsUsed: Array.isArray(meta.toolsUsed) ? meta.toolsUsed : [],
    toolOutcome: meta.toolOutcome && typeof meta.toolOutcome === 'object' ? meta.toolOutcome : null,
    promptTruth: meta.promptTruth && typeof meta.promptTruth === 'object' ? meta.promptTruth : null,
    readiness: meta.readiness && typeof meta.readiness === 'object' ? meta.readiness : null,
    reasoningPolicyMode: String(meta.reasoningPolicyMode || '').trim(),
    artifactSummary: meta.artifactSummary && typeof meta.artifactSummary === 'object' ? meta.artifactSummary : null,
    sideEffects: Array.isArray(meta.sideEffects) ? meta.sideEffects : [],
  };
}

function execFileText(command, args, timeoutMs = 30000) {
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
    await execFileText('lms', ['unload', '--all'], 180000);
  } catch {}
}

async function listLoadedModels() {
  try {
    const { stdout } = await execFileText('lms', ['ps', '--json'], 15000);
    const parsed = stdout ? JSON.parse(stdout) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function spawnServer({
  profile,
  tmpRoot,
  stdoutPath,
  stderrPath,
} = {}) {
  const outStream = fs.createWriteStream(stdoutPath, { flags: 'w' });
  const errStream = fs.createWriteStream(stderrPath, { flags: 'w' });
  const memoryFile = path.join(tmpRoot, `memory.${profile.id}.json`);
  const archiveFile = path.join(tmpRoot, `archive.${profile.id}.json`);
  const embeddingsFile = path.join(tmpRoot, `embeddings.${profile.id}.json`);
  const ledgerFile = path.join(tmpRoot, `ledger.${profile.id}.json`);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(profile.port),
      PENNY_SKIP_LMSTUDIO_PREP: '1',
      PENNY_OPENCLAW_ENABLED: '0',
      PENNY_LMSTUDIO_CHAT_MODEL: profile.chatModel,
      PENNY_LMSTUDIO_TOOL_MODEL: profile.toolModel,
      PENNY_LMSTUDIO_EMBED_MODEL: profile.embedModel,
      PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
      PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: MAX_OUTPUT_TOKENS,
      PENNY_MEMORY_FILE: memoryFile,
      PENNY_MEMORY_ARCHIVE_FILE: archiveFile,
      PENNY_MEMORY_EMBEDDINGS_FILE: embeddingsFile,
      PENNY_MEMORY_LEDGER_FILE: ledgerFile,
      MEMORY_FILE: memoryFile,
      MEMORY_ARCHIVE_FILE: archiveFile,
      MEMORY_EMBEDDINGS_FILE: embeddingsFile,
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
  return {
    child,
    baseUrl: `http://127.0.0.1:${profile.port}`,
    memoryFile,
    archiveFile,
    embeddingsFile,
    ledgerFile,
  };
}

async function stopServer(server = null) {
  if (!server?.child || server.child.exitCode !== null) return;
  server.child.kill();
  const started = Date.now();
  while (server.child.exitCode === null && (Date.now() - started) < 5000) {
    await sleep(200);
  }
  if (server.child.exitCode === null) {
    try {
      await execFileText('taskkill', ['/PID', String(server.child.pid), '/T', '/F'], 15000);
    } catch {}
  }
}

async function waitForServerReady(baseUrl = '') {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/penny/status`);
      if (response.ok) return response.json();
    } catch {}
    await sleep(500);
  }
  throw new Error(`Penny server did not become ready at ${baseUrl}`);
}

async function fetchJson(url, options = {}, timeoutMs = GENERAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const bodyText = await response.text();
    let data = null;
    try {
      data = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      const error = new Error(data?.error || `Request failed with status ${response.status}`);
      error.statusCode = response.status;
      error.data = data;
      error.bodyText = bodyText;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function buildTurnRecord(data = null, seconds = 0) {
  const text = String(data?.text || '').trim();
  const meta = compactMeta(data?.meta);
  return {
    statusCode: Number(data?.statusCode || 200),
    responseOk: true,
    seconds,
    text,
    urls: [],
    meta,
    analysis: analyzeText(text),
  };
}

async function sendChatTurn({
  baseUrl,
  sessionId,
  messages,
  image = null,
  timeoutMs = GENERAL_TIMEOUT_MS,
} = {}) {
  const started = Date.now();
  const payload = {
    sessionId,
    messages,
    image,
    memories: {
      brainMode: 'local',
      voiceOn: false,
      userName: '',
      memories: [],
    },
  };
  try {
    const data = await fetchJson(`${baseUrl}/api/penny/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }, timeoutMs);
    return {
      ok: true,
      statusCode: 200,
      seconds: roundSeconds(Date.now() - started),
      data,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: Number(error?.statusCode || 503),
      seconds: roundSeconds(Date.now() - started),
      data: error?.data || null,
      error: String(error?.message || error || 'Unknown error'),
      bodyText: String(error?.bodyText || '').trim(),
    };
  }
}

function buildScenarioChecks({
  scenario = {},
  finalText = '',
  finalMeta = {},
  verification = null,
} = {}) {
  const analysis = analyzeText(finalText);
  const checks = {
    laneMatched: String(finalMeta?.localLane || '').trim() === String(scenario.expectedLane || '').trim(),
    gotReply: analysis.words > 0,
    notBland: analysis.blandTellCount === 0,
    noMetaLeak: analysis.metaLeak === false,
  };
  if (scenario.type === 'image') {
    checks.imageReply = /\b(look|see|image|screen|interface|profile|card|console)\b/i.test(finalText);
  }
  if (scenario.type === 'write') {
    checks.wroteFile = verification?.found === 1;
    checks.deletedFile = verification?.deleted === true;
  }
  return checks;
}

function scenarioOk(scenario = {}, checks = {}) {
  const required = ['laneMatched', 'gotReply', 'notBland', 'noMetaLeak'];
  if (scenario.type === 'image') required.push('imageReply');
  if (scenario.type === 'write') required.push('wroteFile', 'deletedFile');
  return required.every((key) => checks[key] === true);
}

async function runSingleScenario({
  baseUrl,
  profileId,
  scenario,
  imageDataUrl = '',
} = {}) {
  const sessionId = `${profileId}-${scenario.id}`;
  const result = await sendChatTurn({
    baseUrl,
    sessionId,
    messages: [{ role: 'user', content: scenario.prompt }],
    image: scenario.type === 'image' ? imageDataUrl : null,
    timeoutMs: scenario.timeoutMs,
  });
  if (!result.ok) {
    const finalMeta = compactMeta(result?.data?.meta);
    const checks = buildScenarioChecks({ scenario, finalText: '', finalMeta });
    return {
      id: scenario.id,
      expectedLane: scenario.expectedLane,
      runDate: RUN_DATE,
      sessionId,
      statusCode: result.statusCode,
      seconds: result.seconds,
      finalText: '',
      finalMeta,
      turns: [
        {
          statusCode: result.statusCode,
          responseOk: false,
          seconds: result.seconds,
          text: '',
          urls: [],
          meta: finalMeta,
          error: result.error || '',
          detail: result.bodyText || '',
        },
      ],
      checks,
      ok: false,
    };
  }
  const turn = buildTurnRecord(result.data, result.seconds);
  const finalText = turn.text;
  const finalMeta = turn.meta;
  const checks = buildScenarioChecks({ scenario, finalText, finalMeta });
  return {
    id: scenario.id,
    expectedLane: scenario.expectedLane,
    runDate: RUN_DATE,
    sessionId,
    promptCount: 1,
    turns: [turn],
    seconds: result.seconds,
    finalText,
    finalMeta,
    checks,
    ok: scenarioOk(scenario, checks),
  };
}

async function runConversationScenario({
  baseUrl,
  profileId,
  scenario,
} = {}) {
  const sessionId = `${profileId}-${scenario.id}`;
  const messages = [];
  const turns = [];
  let finalText = '';
  let finalMeta = {};
  let totalSeconds = 0;

  for (const prompt of scenario.turns || []) {
    messages.push({ role: 'user', content: prompt });
    const result = await sendChatTurn({
      baseUrl,
      sessionId,
      messages,
      timeoutMs: scenario.timeoutMs,
    });
    totalSeconds += Number(result.seconds || 0);
    if (!result.ok) {
      const meta = compactMeta(result?.data?.meta);
      turns.push({
        statusCode: result.statusCode,
        responseOk: false,
        seconds: result.seconds,
        text: '',
        urls: [],
        meta,
        error: result.error || '',
        detail: result.bodyText || '',
      });
      finalMeta = meta;
      finalText = '';
      break;
    }
    const turn = buildTurnRecord(result.data, result.seconds);
    turns.push(turn);
    finalText = turn.text;
    finalMeta = turn.meta;
    messages.push({ role: 'assistant', content: turn.text });
  }

  const checks = buildScenarioChecks({ scenario, finalText, finalMeta });
  checks.promptPhraseRecalled = /had been flirting with me all night/i.test(finalText);
  return {
    id: scenario.id,
    expectedLane: scenario.expectedLane,
    runDate: RUN_DATE,
    sessionId,
    promptCount: Array.isArray(scenario.turns) ? scenario.turns.length : 0,
    turns,
    seconds: roundSeconds(totalSeconds * 1000),
    finalText,
    finalMeta,
    checks,
    ok: scenarioOk(scenario, checks) && checks.promptPhraseRecalled === true,
  };
}

function findFileWriteTarget(payload = {}) {
  const sideEffects = [
    ...(Array.isArray(payload?.meta?.sideEffects) ? payload.meta.sideEffects : []),
    ...(Array.isArray(payload?.memory?.lastRoute?.sideEffects) ? payload.memory.lastRoute.sideEffects : []),
  ];
  const fileEffect = sideEffects.find((item) => item && item.type === 'file-write' && typeof item.target === 'string');
  if (fileEffect) return path.resolve(ROOT_DIR, fileEffect.target);
  const toolsUsed = Array.isArray(payload?.meta?.toolsUsed) ? payload.meta.toolsUsed : [];
  for (const tool of toolsUsed) {
    const label = String(tool?.label || '').trim();
    const toolMatch = label.match(/\bcreated\s+(.+?\.md)\b/i);
    if (toolMatch) return path.resolve(ROOT_DIR, toolMatch[1]);
  }
  const text = String(payload?.text || '');
  const match = text.match(/Penny's Playground[\\/][^\r\n`]+?\.md/);
  if (match) return path.resolve(ROOT_DIR, match[0]);
  const bareFile = text.match(/`([^`\r\n]+\.md)`/);
  if (bareFile) return path.join(PLAYGROUND_DIR, path.basename(bareFile[1]));
  return '';
}

function verifyAndDeleteFile(filePath = '') {
  if (!filePath) {
    return {
      found: 0,
      path: '',
      bytes: 0,
      contentPreview: '',
      deleted: false,
      deleteError: '',
    };
  }
  const resolvedPath = path.resolve(filePath);
  const allowedRoot = path.resolve(PLAYGROUND_DIR);
  if (!resolvedPath.startsWith(allowedRoot + path.sep) && resolvedPath !== allowedRoot) {
    return {
      found: 0,
      path: resolvedPath,
      bytes: 0,
      contentPreview: '',
      deleted: false,
      deleteError: 'Refused to delete outside Penny\'s Playground.',
    };
  }
  if (!fs.existsSync(resolvedPath)) {
    return {
      found: 0,
      path: resolvedPath,
      bytes: 0,
      contentPreview: '',
      deleted: false,
      deleteError: '',
    };
  }
  const text = fs.readFileSync(resolvedPath, 'utf8');
  let deleteError = '';
  let deleted = false;
  try {
    fs.unlinkSync(resolvedPath);
    deleted = true;
  } catch (error) {
    deleteError = String(error?.message || error).trim();
  }
  return {
    found: 1,
    path: resolvedPath,
    bytes: Buffer.byteLength(text, 'utf8'),
    contentPreview: text.slice(0, 400),
    deleted,
    deleteError,
  };
}

async function runWriteScenario({
  baseUrl,
  profileId,
  scenario,
} = {}) {
  const sessionId = `${profileId}-${scenario.id}`;
  const result = await sendChatTurn({
    baseUrl,
    sessionId,
    messages: [{ role: 'user', content: scenario.prompt }],
    timeoutMs: scenario.timeoutMs,
  });
  if (!result.ok) {
    const finalMeta = compactMeta(result?.data?.meta);
    const checks = buildScenarioChecks({ scenario, finalText: '', finalMeta, verification: null });
    return {
      id: scenario.id,
      expectedLane: scenario.expectedLane,
      runDate: RUN_DATE,
      sessionId,
      statusCode: result.statusCode,
      seconds: result.seconds,
      finalText: '',
      finalMeta,
      turns: [
        {
          statusCode: result.statusCode,
          responseOk: false,
          seconds: result.seconds,
          text: '',
          urls: [],
          meta: finalMeta,
          error: result.error || '',
          detail: result.bodyText || '',
        },
      ],
      verification: verifyAndDeleteFile(''),
      checks,
      ok: false,
    };
  }
  const turn = buildTurnRecord(result.data, result.seconds);
  const verification = verifyAndDeleteFile(findFileWriteTarget(result.data));
  const checks = buildScenarioChecks({
    scenario,
    finalText: turn.text,
    finalMeta: turn.meta,
    verification,
  });
  return {
    id: scenario.id,
    expectedLane: scenario.expectedLane,
    runDate: RUN_DATE,
    sessionId,
    statusCode: result.statusCode,
    seconds: result.seconds,
    finalText: turn.text,
    finalMeta: turn.meta,
    turns: [turn],
    verification,
    checks,
    ok: scenarioOk(scenario, checks),
  };
}

function summarizeProfile(profileResult = {}) {
  const scenarios = Array.isArray(profileResult.scenarios) ? profileResult.scenarios : [];
  const completed = scenarios.length;
  const passed = scenarios.filter((item) => item?.ok === true).length;
  const failed = completed - passed;
  const metaLeakIds = scenarios.filter((item) => item?.checks?.noMetaLeak === false).map((item) => item.id);
  const slowest = [...scenarios].sort((left, right) => Number(right?.seconds || 0) - Number(left?.seconds || 0))[0] || null;
  return {
    completed,
    passed,
    failed,
    metaLeakIds,
    slowestScenario: slowest ? {
      id: slowest.id,
      seconds: slowest.seconds,
    } : null,
  };
}

function excerpt(text = '', maxChars = 220) {
  const bare = stripMoodTag(text);
  return bare.length > maxChars ? `${bare.slice(0, maxChars).trimEnd()}...` : bare;
}

function buildComparison(profileResults = []) {
  const byId = Object.fromEntries(profileResults.map((item) => [item.id, item]));
  const scenarioIds = Array.from(new Set(
    profileResults.flatMap((profile) => (Array.isArray(profile.scenarios) ? profile.scenarios.map((scenario) => scenario.id) : [])),
  ));
  return {
    generatedAt: new Date().toISOString(),
    scenarios: scenarioIds.map((scenarioId) => {
      const split = byId['split-default']?.scenarios?.find((item) => item.id === scenarioId) || null;
      const qwen = byId['qwen-single-model']?.scenarios?.find((item) => item.id === scenarioId) || null;
      return {
        id: scenarioId,
        split: split ? {
          ok: split.ok,
          seconds: split.seconds,
          lane: split.finalMeta?.localLane || '',
          model: split.finalMeta?.resolvedModel || '',
          excerpt: excerpt(split.finalText),
          verificationPreview: split.verification?.contentPreview ? excerpt(split.verification.contentPreview, 220) : '',
          metaLeak: split.checks?.noMetaLeak === false,
        } : null,
        qwen: qwen ? {
          ok: qwen.ok,
          seconds: qwen.seconds,
          lane: qwen.finalMeta?.localLane || '',
          model: qwen.finalMeta?.resolvedModel || '',
          excerpt: excerpt(qwen.finalText),
          verificationPreview: qwen.verification?.contentPreview ? excerpt(qwen.verification.contentPreview, 220) : '',
          metaLeak: qwen.checks?.noMetaLeak === false,
        } : null,
      };
    }),
  };
}

function isExpectedFreshLoadBlocker(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return false;
  return (
    /no usable models are currently loaded/i.test(clean)
    || /no usable chat or tool model is currently loaded/i.test(clean)
  );
}

async function loadProfileModels(profile = {}) {
  const automationApi = createAutomationApi({
    chatModel: profile.chatModel,
    toolModel: profile.toolModel,
    embedModel: profile.embedModel,
  });
  const preparation = await automationApi.prepareLmStudio({
    reportOnly: false,
    repairPreset: true,
    loadChatModel: false,
    loadEmbedModel: false,
    chatModel: profile.chatModel,
    toolModel: profile.toolModel,
    embedModel: profile.embedModel,
  });
  const blockers = Array.isArray(preparation.blockers) ? preparation.blockers : [];
  const hardBlockers = blockers.filter((item) => !isExpectedFreshLoadBlocker(item));
  if (hardBlockers.length) {
    throw new Error(`LM Studio is not ready for ${profile.id}: ${hardBlockers.join(' ')}`);
  }
  await unloadAllModels();
  const loadActions = [];
  for (const step of [
    { model: profile.chatModel, label: `${profile.id} chat model`, contextLength: profile.chatContextLength },
    { model: profile.toolModel, label: `${profile.id} tool model`, contextLength: 0 },
    { model: profile.embedModel, label: `${profile.id} embed model`, contextLength: 0 },
  ]) {
    if (!String(step.model || '').trim()) continue;
    const result = await automationApi.loadModel(step.model, step.label, {
      contextLength: Number(step.contextLength || 0),
      ttlSeconds: MODEL_TTL_SECONDS,
    });
    loadActions.push({
      label: step.label,
      model: step.model,
      skippedLoad: result?.skippedLoad === true,
      stdout: String(result?.stdout || '').trim(),
      stderr: String(result?.stderr || '').trim(),
    });
  }
  return {
    preparation: {
      ok: hardBlockers.length === 0,
      warnings: preparation.warnings || [],
      blockers,
      requestedChatModel: preparation.requestedChatModel || profile.chatModel,
      requestedToolModel: preparation.requestedToolModel || profile.toolModel,
      requestedEmbedModel: preparation.requestedEmbedModel || profile.embedModel,
      semanticMemoryReady: preparation.semanticMemoryReady === true,
    },
    loadActions,
  };
}

async function runProfile(profile = {}, imageDataUrl = '', scenarios = SCENARIOS) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), `penny-voice-writing-compare-${profile.id}-`));
  const stdoutPath = path.join(OUTPUT_DIR, `voice-writing-compare-${profile.id}-${STAMP}.server.out.log`);
  const stderrPath = path.join(OUTPUT_DIR, `voice-writing-compare-${profile.id}-${STAMP}.server.err.log`);
  const profileResult = {
    id: profile.id,
    label: profile.label,
    runDate: RUN_DATE,
    requestedModels: {
      chat: profile.chatModel,
      tool: profile.toolModel,
      embed: profile.embedModel,
    },
    serverLogs: {
      stdout: stdoutPath,
      stderr: stderrPath,
    },
    tmpRoot,
    scenarios: [],
  };

  let server = null;
  try {
    const loaded = await loadProfileModels(profile);
    profileResult.preparation = loaded.preparation;
    profileResult.loadActions = loaded.loadActions;
    profileResult.loadedModelsAtStart = await listLoadedModels();

    server = spawnServer({
      profile,
      tmpRoot,
      stdoutPath,
      stderrPath,
    });
    await waitForServerReady(server.baseUrl);
    profileResult.baseUrl = server.baseUrl;
    profileResult.serverStatus = await fetchJson(`${server.baseUrl}/api/penny/status`, {}, 20000);
    profileResult.lmStudioStatus = await fetchJson(`${server.baseUrl}/api/penny/lmstudio/status`, {}, 20000);

    for (const scenario of scenarios) {
      let result = null;
      if (scenario.type === 'conversation') {
        result = await runConversationScenario({ baseUrl: server.baseUrl, profileId: profile.id, scenario });
      } else if (scenario.type === 'write') {
        result = await runWriteScenario({ baseUrl: server.baseUrl, profileId: profile.id, scenario });
      } else {
        result = await runSingleScenario({
          baseUrl: server.baseUrl,
          profileId: profile.id,
          scenario,
          imageDataUrl,
        });
      }
      profileResult.scenarios.push(result);
      fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payloadDraft([profileResult]), null, 2)}\n`);
    }

    profileResult.summary = summarizeProfile(profileResult);
    profileResult.loadedModelsAtEnd = await listLoadedModels();
    return profileResult;
  } finally {
    await stopServer(server);
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
}

function payloadDraft(profileResults = []) {
  return {
    kind: 'penny-voice-writing-image-compare.v1',
    generatedAt: new Date().toISOString(),
    runDate: RUN_DATE,
    artifactPath: OUTPUT_PATH,
    imageFixture: IMAGE_FIXTURE_PATH,
    profiles: profileResults,
    comparison: buildComparison(profileResults),
  };
}

async function main() {
  ensureDir(OUTPUT_DIR);
  if (!fs.existsSync(IMAGE_FIXTURE_PATH)) {
    throw new Error(`Image fixture missing: ${IMAGE_FIXTURE_PATH}`);
  }
  const imageDataUrl = `data:image/png;base64,${fs.readFileSync(IMAGE_FIXTURE_PATH).toString('base64')}`;
  const selectedProfiles = (() => {
    const filter = parseFilterSet(PROFILE_FILTER);
    if (!filter.size) return [...PROFILES];
    return PROFILES.filter((profile) => filter.has(profile.id));
  })();
  const selectedScenarios = (() => {
    const filter = parseFilterSet(SCENARIO_FILTER);
    if (!filter.size) return [...SCENARIOS];
    return SCENARIOS.filter((scenario) => filter.has(scenario.id));
  })();
  if (!selectedProfiles.length) {
    throw new Error(`No compare profiles matched filter: ${PROFILE_FILTER}`);
  }
  if (!selectedScenarios.length) {
    throw new Error(`No compare scenarios matched filter: ${SCENARIO_FILTER}`);
  }
  const profileResults = [];
  try {
    for (const profile of selectedProfiles) {
      profileResults.push(await runProfile(profile, imageDataUrl, selectedScenarios));
      await unloadAllModels();
      fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payloadDraft(profileResults), null, 2)}\n`);
    }
  } finally {
    await unloadAllModels();
  }
  const payload = payloadDraft(profileResults);
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`Voice/writing/image compare complete: ${OUTPUT_PATH}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.stack || error).trim()}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  analyzeText,
  buildComparison,
  detectMetaLeak,
  findFileWriteTarget,
  stripMoodTag,
};
