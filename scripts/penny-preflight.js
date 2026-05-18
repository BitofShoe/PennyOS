const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  checkNodeVersion,
  runPrepare,
} = require('./penny-lmstudio-prepare');
const {
  buildPreparationReadinessSummary,
  formatLocalReadinessSummary,
} = require('../lib/penny-local-readiness-summary');
const {
  buildGemmaRuntimeWatchArtifact,
} = require('../lib/penny-gemma-runtime-watch');
const {
  buildLmStudioChatSamplingWatch,
  normalizeLmStudioTransportForWatch,
} = require('../lib/penny-lmstudio-transports');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const DEFAULT_LMSTUDIO_BASE = (process.env.PENNY_LMSTUDIO_BASE || 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
const DEFAULT_LMSTUDIO_API_KEY = process.env.PENNY_LMSTUDIO_API_KEY || 'lm-studio-local';

function loadPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function parseExpectedMajor(range = '') {
  const match = String(range || '').match(/(\d{2,})/);
  return match ? Number(match[1]) : null;
}

function summarizeCheck(name, ok, detail, level = ok ? 'pass' : 'fail') {
  return {
    name,
    ok: ok === true,
    detail: String(detail || '').trim(),
    level,
  };
}

function numberFromEnv(value, fallback = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildGemmaRuntimeWatchForPreflight({
  generatedAt = new Date().toISOString(),
  preflightReport = null,
  status = null,
  env = process.env,
  chatModel = '',
} = {}) {
  const report = preflightReport?.report || preflightReport || {};
  const safeStatus = status || preflightReport?.status || report.statusAfter || report.statusBefore || {};
  const watchStatus = {
    ...safeStatus,
    localTransport: safeStatus.localTransport
      || normalizeLmStudioTransportForWatch(env.PENNY_LOCAL_LLM_TRANSPORT || env.PENNY_LMSTUDIO_TRANSPORT || 'chat'),
    chatPreferredModel: safeStatus.chatPreferredModel || report.requestedChatModel || chatModel,
    configuredChatModel: safeStatus.configuredChatModel || report.requestedChatModel || chatModel,
    resolvedChatModel: safeStatus.resolvedChatModel || safeStatus.resolvedModel || '',
  };
  const contextLength = numberFromEnv(
    env.PENNY_LMSTUDIO_CONTEXT_LENGTH
      || env.PENNY_RUNTIME_FIT_CONTEXT_DEFAULT
      || env.PENNY_LMSTUDIO_CHAT_CONTEXT_LENGTH,
    null,
  );

  return buildGemmaRuntimeWatchArtifact({
    generatedAt,
    measurementMode: 'status-only',
    status: watchStatus,
    transport: watchStatus.localTransport,
    requestedModel: watchStatus.chatPreferredModel || chatModel,
    resolvedModel: watchStatus.resolvedChatModel || watchStatus.resolvedModel || '',
    visionBudget: {
      exposed: false,
      adoptionStatus: 'not-adopted',
      knobNames: [],
      notes: 'Preflight/status data does not expose max_soft_tokens or a separate Gemma vision-budget knob.',
    },
    imagePolicy: {
      currentTurnImageOnly: true,
      imagePartBeforeText: true,
    },
    thinkingControls: {
      exposed: null,
      notes: 'Preflight records the watch item only; companion chat thinking stays off by default.',
    },
    promptCacheRamRisk: {
      contextLength,
      notes: 'Preflight does not change context length or measure prompt-cache RAM pressure.',
    },
    chatSampling: buildLmStudioChatSamplingWatch({
      temperature: env.PENNY_LMSTUDIO_CHAT_TEMPERATURE || 1.0,
      topP: env.PENNY_LMSTUDIO_CHAT_TOP_P || 0.95,
      topK: env.PENNY_LMSTUDIO_CHAT_TOP_K || 64,
    }),
  });
}

function checkLmsCli(spawnSyncImpl = spawnSync) {
  try {
    const result = spawnSyncImpl('lms', ['--help'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    if (result?.error) {
      return summarizeCheck('lms-cli', false, `LM Studio CLI is not available: ${result.error.message}`);
    }
    return summarizeCheck('lms-cli', true, 'LM Studio CLI is available.');
  } catch (error) {
    return summarizeCheck('lms-cli', false, `LM Studio CLI is not available: ${String(error?.message || error).trim()}`);
  }
}

function checkNpmVersion({ spawnSyncImpl = spawnSync, packageJson = loadPackageJson() } = {}) {
  try {
    const result = spawnSyncImpl('npm', ['-v'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    if (result?.error || result?.status !== 0) {
      const detail = result?.error?.message || result?.stderr || result?.stdout || 'npm -v failed';
      return summarizeCheck('npm', false, `npm version check failed: ${String(detail).trim()}`);
    }
    const actual = String(result.stdout || '').trim();
    const expectedMajor = parseExpectedMajor(packageJson?.engines?.npm || '');
    const actualMajor = Number((actual.match(/^(\d+)/) || [])[1]);
    const ok = !expectedMajor || actualMajor === expectedMajor;
    return summarizeCheck('npm', ok, ok
      ? `npm ${actual} matches release range ${packageJson?.engines?.npm || '(unspecified)'}.`
      : `npm ${actual} does not match release range ${packageJson?.engines?.npm || '(unspecified)'}.`);
  } catch (error) {
    return summarizeCheck('npm', false, `npm version check failed: ${String(error?.message || error).trim()}`);
  }
}

function enabledEnv(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function summarizeRuntimePosture(env = process.env) {
  const webEnabled = env.PENNY_WEB_SEARCH_ENABLED === '1';
  const lanEnabled = enabledEnv(env.PENNY_LAN_SHARE);
  const tokenConfigured = Boolean(String(env.PENNY_API_TOKEN || env.PENNY_ACCESS_TOKEN || env.PENNY_LOCAL_API_TOKEN || '').trim());
  return [
    summarizeCheck(
      'web-reading',
      true,
      webEnabled
        ? 'Web reading is ON; Penny may fetch public pages, while private-network targets stay blocked unless explicitly allowed.'
        : 'Web reading is OFF. Set PENNY_WEB_SEARCH_ENABLED=1 to allow public web reads.',
      webEnabled ? 'warn' : 'pass',
    ),
    summarizeCheck(
      'lan-token',
      !lanEnabled || tokenConfigured,
      lanEnabled
        ? (tokenConfigured ? 'LAN sharing is on and an API token is configured.' : 'LAN sharing is on but no API token is configured. Set PENNY_API_TOKEN before sharing.')
        : 'LAN sharing is off; Penny should stay on loopback.',
      lanEnabled && !tokenConfigured ? 'fail' : (lanEnabled ? 'warn' : 'pass'),
    ),
  ];
}

async function checkLmStudioApi({
  baseUrl = DEFAULT_LMSTUDIO_BASE,
  apiKey = DEFAULT_LMSTUDIO_API_KEY,
  fetchImpl = fetch,
  spawnSyncImpl = spawnSync,
  packageJson = loadPackageJson(),
  nodeVersion = process.versions.node,
  env = process.env,
  chatModel = String(process.env.PENNY_LMSTUDIO_CHAT_MODEL || 'google/gemma-4-31b').trim(),
  toolModel = String(process.env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b').trim(),
  embedModel = String(process.env.PENNY_LMSTUDIO_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim(),
  presetIdentifier = String(process.env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny',
} = {}) {
  const result = await runPrepare({
    fetchImpl,
    execFileTextImpl(command, args, options = {}) {
      const timeout = typeof options === 'number' ? options : (options.timeout || 120000);
      return new Promise((resolve, reject) => {
        const child = spawnSyncImpl(command, args, {
          encoding: 'utf8',
          timeout,
          windowsHide: true,
          cwd: ROOT_DIR,
        });
        if (child?.error || child?.status !== 0) {
          const error = child?.error || new Error((child?.stderr || child?.stdout || '').trim() || `${command} exited with status ${child?.status}`);
          error.stdout = child?.stdout || '';
          error.stderr = child?.stderr || '';
          reject(error);
          return;
        }
        resolve({ stdout: child.stdout || '', stderr: child.stderr || '' });
      });
    },
    packageJson,
    nodeVersion,
    env,
    reportOnly: true,
    lmStudioBase: baseUrl,
    lmStudioApiKey: apiKey,
    chatModel,
    toolModel,
    embedModel,
    presetIdentifier,
  });

  const status = result.report.statusAfter || result.report.statusBefore || {};
  const detail = status.reachable
    ? `LM Studio is reachable at ${status.base || baseUrl}.`
    : (status.error || `Could not reach LM Studio at ${baseUrl}.`);
  return {
    ok: status.reachable === true,
    detail,
    result,
  };
}

async function runPreflight({
  fetchImpl = fetch,
  spawnSyncImpl = spawnSync,
  packageJson = loadPackageJson(),
  nodeVersion = process.versions.node,
  baseUrl = DEFAULT_LMSTUDIO_BASE,
  apiKey = DEFAULT_LMSTUDIO_API_KEY,
  env = process.env,
  chatModel = String(process.env.PENNY_LMSTUDIO_CHAT_MODEL || 'google/gemma-4-31b').trim(),
  toolModel = String(process.env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b').trim(),
  embedModel = String(process.env.PENNY_LMSTUDIO_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim(),
  presetIdentifier = String(process.env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny',
} = {}) {
  const checks = [];
  const nodeCheck = checkNodeVersion(packageJson?.engines?.node || '', nodeVersion);
  checks.push(summarizeCheck('node', nodeCheck.ok, nodeCheck.detail, nodeCheck.ok ? 'pass' : 'fail'));
  checks.push(checkNpmVersion({ spawnSyncImpl, packageJson }));
  checks.push(checkLmsCli(spawnSyncImpl));

  const lmStudioApi = await checkLmStudioApi({
    baseUrl,
    apiKey,
    fetchImpl,
    spawnSyncImpl,
    packageJson,
    nodeVersion,
    env,
    chatModel,
    toolModel,
    embedModel,
    presetIdentifier,
  });
  checks.push(summarizeCheck('lmstudio-api', lmStudioApi.ok, lmStudioApi.detail, lmStudioApi.ok ? 'pass' : 'fail'));

  const prepareResult = lmStudioApi.result;
  const report = prepareResult.report;
  const status = report.statusAfter || report.statusBefore || {};

  const loadedModels = Array.isArray(report.loadedModels) ? report.loadedModels : [];
  const installedModels = Array.isArray(report.installedModels) ? report.installedModels : [];
  const readinessSummary = report.readinessSummary || buildPreparationReadinessSummary(report);
  report.readinessSummary = readinessSummary;
  const routingDetail = [
    `requested chat=${report.requestedChatModel}`,
    `requested tool=${report.requestedToolModel}`,
    `requested embed=${report.requestedEmbedModel || '(none)'}`,
    `resolved chat=${status.resolvedChatModel || '(none)'}`,
    `resolved tool=${status.resolvedToolModel || '(none)'}`,
    `semantic memory=${report.semanticMemoryReady ? 'ready' : 'fallback'}`,
    `loaded=${loadedModels.join(', ') || '(none)'}`,
  ].join('; ');
  const readinessDetail = `${formatLocalReadinessSummary(readinessSummary, { includeLoaded: false })} ${routingDetail}`.trim();
  checks.push(summarizeCheck(
    'lmstudio-readiness',
    report.blockers.length === 0,
    readinessDetail,
    report.blockers.length === 0 ? (report.warnings.length ? 'warn' : 'pass') : 'fail',
  ));

  const presetIssues = [
    ...(report.preset?.missingTargets || []),
    ...(report.preset?.settings?.needsRepair ? ['LM Studio settings are not fully preset-ready.'] : []),
    ...(report.preset?.selectedConversation?.needsRepair ? ['Selected LM Studio conversation is not using the Penny preset.'] : []),
    ...[...(report.preset?.chatConfigs || []), ...(report.preset?.toolConfigs || [])]
      .filter(item => item.exists && item.needsRepair)
      .map(item => `Preset wiring missing for ${item.path}`),
  ];
  checks.push(summarizeCheck(
    'lmstudio-preset',
    true,
    presetIssues.length ? presetIssues.join(' ') : `Preset ${presetIdentifier} is wired for the active LM Studio targets.`,
    presetIssues.length ? 'warn' : 'pass',
  ));
  checks.push(...summarizeRuntimePosture(env));

  const gemmaRuntimeWatch = buildGemmaRuntimeWatchForPreflight({
    preflightReport: {
      report,
      status,
    },
    env,
    chatModel,
  });

  const assumptions = [
    'QA scripts assume local Windows + PowerShell launcher behavior.',
    'Voice QA and probes expect LM Studio to be running before they start.',
    `If LM Studio is unreachable, start its local server at ${baseUrl}, then rerun: npm run doctor.`,
  ];
  return {
    ok: nodeCheck.ok && lmStudioApi.ok && report.blockers.length === 0,
    checks,
    assumptions,
    report,
    status,
    installedModels,
    loadedModels,
    readinessSummary,
    gemmaRuntimeWatch,
  };
}

async function main() {
  const report = await runPreflight();
  for (const check of report.checks) {
    const status = String(check.level || (check.ok ? 'pass' : 'fail')).toUpperCase();
    process.stdout.write(`[${status}] ${check.name}: ${check.detail}\n`);
  }
  for (const note of report.assumptions) {
    process.stdout.write(`[NOTE] ${note}\n`);
  }
  if (!report.ok) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error).trim()}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseExpectedMajor,
  summarizeCheck,
  checkNodeVersion,
  checkNpmVersion,
  checkLmsCli,
  summarizeRuntimePosture,
  checkLmStudioApi,
  buildGemmaRuntimeWatchForPreflight,
  runPreflight,
};
