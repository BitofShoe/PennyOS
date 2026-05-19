const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  checkNodeVersion,
  runPrepare,
} = require('./penny-lmstudio-prepare');
const {
  buildLocalReadinessSummary,
  buildPreparationReadinessSummary,
  formatLocalReadinessSummary,
  modelsLookCompatible,
} = require('../lib/penny-local-readiness-summary');
const {
  probeLocalEndpointCompatibility,
} = require('../lib/penny-local-endpoint-compatibility');
const {
  buildGemmaRuntimeWatchArtifact,
} = require('../lib/penny-gemma-runtime-watch');
const {
  buildLmStudioChatSamplingWatch,
  normalizeLmStudioTransportForWatch,
} = require('../lib/penny-lmstudio-transports');
const {
  loadPennyEnvFile,
} = require('../lib/penny-env-loader');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
loadPennyEnvFile({
  envFile: process.env.PENNY_ENV_FILE || path.join(ROOT_DIR, '.env'),
  env: process.env,
});
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

function uniqueStrings(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = String(value || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

function normalizeBackendKind(value = '') {
  const text = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (!text) return '';
  if (['llama', 'llamacpp', 'llama_cpp'].includes(text)) return 'llama_cpp';
  if (['lmstudio', 'lm_studio'].includes(text)) return 'lm_studio';
  if (['openai', 'openai_compatible', 'openai_compatible_unknown', 'generic'].includes(text)) return 'openai_compatible';
  if (['vllm', 'sglang', 'ollama'].includes(text)) return text;
  return text;
}

function shouldUseGenericEndpointPreflight({ env = process.env, endpointProbe = null } = {}) {
  const requestedBackend = normalizeBackendKind(
    env.PENNY_LOCAL_LLM_BACKEND
      || env.PENNY_DOCTOR_BACKEND
      || env.PENNY_LOCAL_ENDPOINT_BACKEND
      || '',
  );
  if (requestedBackend === 'lm_studio') return false;
  if (requestedBackend) return true;
  const detectedBackend = normalizeBackendKind(endpointProbe?.backend_family || '');
  return ['llama_cpp', 'vllm', 'sglang', 'ollama'].includes(detectedBackend);
}

function isEmbeddingLikeModelId(modelId = '') {
  return /\b(embed|embedding|rerank)\b/i.test(String(modelId || ''));
}

function resolveLaneModel(visibleModels = [], preferredModel = '', { fallbackAllowed = true } = {}) {
  const models = uniqueStrings(visibleModels).filter((model) => !isEmbeddingLikeModelId(model));
  const preferred = String(preferredModel || '').trim();
  if (preferred) {
    const exact = models.find((model) => modelsLookCompatible(model, preferred));
    if (exact) return exact;
  }
  return fallbackAllowed ? (models[0] || '') : '';
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

function checkNpmVersion({
  spawnSyncImpl = spawnSync,
  packageJson = loadPackageJson(),
  platform = process.platform,
  comSpec = process.env.ComSpec || 'cmd.exe',
} = {}) {
  try {
    const command = platform === 'win32' ? 'npm.cmd' : 'npm';
    let result = spawnSyncImpl(command, ['-v'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    });
    if ((result?.error || result?.status !== 0) && platform === 'win32') {
      result = spawnSyncImpl(comSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd -v'], {
        encoding: 'utf8',
        timeout: 5000,
        windowsHide: true,
      });
    }
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

function buildPreflightFixes({
  checks = [],
  report = {},
  baseUrl = DEFAULT_LMSTUDIO_BASE,
  port = process.env.PORT || 4317,
  runtimeLabel = 'LM Studio',
} = {}) {
  const byName = new Map((Array.isArray(checks) ? checks : []).map((check) => [check.name, check]));
  const blockers = Array.isArray(report.blockers) ? report.blockers.join(' ') : '';
  const warningList = Array.isArray(report.warnings) ? report.warnings : [];
  const warnings = warningList.join(' ');
  const requestedChat = String(report.requestedChatModel || process.env.PENNY_LMSTUDIO_CHAT_MODEL || 'google/gemma-4-31b').trim();
  const requestedTool = String(report.requestedToolModel || process.env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b').trim();
  const requestedEmbed = String(report.requestedEmbedModel || process.env.PENNY_LMSTUDIO_EMBED_MODEL || '').trim();
  const hasFailures = (Array.isArray(checks) ? checks : []).some((check) => check?.ok === false) || Boolean(blockers.trim());
  const fixes = [];
  const add = (text) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean && !fixes.includes(clean)) fixes.push(clean);
  };

  if (byName.get('node')?.ok === false) {
    add('Install Node.js 24.x from https://nodejs.org/, reopen your terminal, then rerun npm run doctor.');
  }
  if (byName.get('npm')?.ok === false) {
    add('Use npm 11.x with Node.js 24.x; reinstall Node 24 or run npm install -g npm@11, then rerun npm run doctor.');
  }
  if (byName.get('lms-cli')?.ok === false) {
    add('LM Studio CLI is missing or not on PATH. Penny can still use the HTTP server, but npm run lmstudio:prepare needs the lms command.');
  }
  if (byName.get('lmstudio-api')?.ok === false) {
    add(`Start LM Studio, enable the local server, verify it serves ${baseUrl}, then rerun npm run doctor.`);
  }
  if (byName.get('local-endpoint')?.ok === false) {
    add(`Start ${runtimeLabel}, verify it serves an OpenAI-compatible ${baseUrl}/models endpoint, then rerun npm run doctor.`);
  }
  if (/no usable models|load penny|not loaded|wrong model|model id|missing/i.test(blockers)) {
    add(`Load the configured Penny models in ${runtimeLabel}, or edit .env so PENNY_LMSTUDIO_CHAT_MODEL=${requestedChat} and PENNY_LMSTUDIO_TOOL_MODEL=${requestedTool} match model IDs shown by the local endpoint.`);
  }
  if (warningList.some((warning) => /(?:chat|tool) lane|resolved .* instead|not listed/i.test(String(warning || '')))) {
    add(`Open Settings -> First-run local brain setup, or edit .env so PENNY_LMSTUDIO_CHAT_MODEL and PENNY_LMSTUDIO_TOOL_MODEL match the model IDs exposed by ${runtimeLabel}.`);
  }
  if (/embedding model|semantic memory|embed/i.test(warnings) && requestedEmbed) {
    add(`The embedding model ${requestedEmbed} is optional; install/load it for semantic memory, or leave it missing and Penny will use keyword/archive fallback.`);
  }
  if (byName.get('lan-token')?.ok === false) {
    add('Set PENNY_API_TOKEN in .env before enabling PENNY_LAN_SHARE=1, then restart Penny.');
  }
  if (hasFailures) {
    add(`If Penny startup says the port is busy, run npm run stop or set PORT to another value in .env; current expected port ${port}.`);
  }

  return fixes;
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

async function probeLocalEndpoint({
  baseUrl = DEFAULT_LMSTUDIO_BASE,
  fetchImpl = fetch,
  timeoutMs = 5000,
} = {}) {
  try {
    return await probeLocalEndpointCompatibility({
      endpoint: baseUrl,
      fetch: fetchImpl,
      probeModelCall: false,
      timeoutMs,
    });
  } catch (error) {
    return {
      schema_version: 1,
      endpoint: baseUrl,
      backend_family: 'unknown',
      loaded_models: [],
      loaded_model_id: '',
      resolved_model_id: '',
      health_status: 'unavailable',
      capabilities: { models_endpoint: 'unsupported' },
      warnings: [`models endpoint probe failed: ${String(error?.message || error).trim()}`],
      recommendations: [],
      runtime_changed: false,
      memory_changed: false,
    };
  }
}

function runtimeLabelForBackend(backendFamily = '') {
  const family = normalizeBackendKind(backendFamily);
  if (family === 'llama_cpp') return 'llama.cpp';
  if (family === 'lm_studio') return 'LM Studio';
  if (family === 'vllm') return 'vLLM';
  if (family === 'sglang') return 'SGLang';
  if (family === 'ollama') return 'Ollama';
  return 'the local OpenAI-compatible runtime';
}

function buildGenericEndpointPreflightReport({
  endpointProbe = null,
  checks = [],
  nodeCheck = null,
  npmCheck = null,
  baseUrl = DEFAULT_LMSTUDIO_BASE,
  env = process.env,
  chatModel = '',
  toolModel = '',
  embedModel = '',
} = {}) {
  const probe = endpointProbe || {};
  const backendFamily = normalizeBackendKind(probe.backend_family || '') || 'openai_compatible';
  const runtimeLabel = runtimeLabelForBackend(backendFamily);
  const visibleModels = uniqueStrings(probe.loaded_models || []);
  const fallbackAllowed = !enabledEnv(env.PENNY_LMSTUDIO_DISABLE_MODEL_FALLBACK);
  const requestedChatModel = String(chatModel || env.PENNY_LMSTUDIO_CHAT_MODEL || 'google/gemma-4-31b').trim();
  const requestedToolModel = String(toolModel || env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b').trim();
  const requestedEmbedModel = String(embedModel || env.PENNY_LMSTUDIO_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5').trim();
  const endpointOk = probe.health_status === 'available' && probe.capabilities?.models_endpoint === 'supported';
  const resolvedChatModel = resolveLaneModel(visibleModels, requestedChatModel, { fallbackAllowed });
  const resolvedToolModel = resolveLaneModel(visibleModels, requestedToolModel, { fallbackAllowed });
  const embedVisible = !!requestedEmbedModel && visibleModels.some((model) => modelsLookCompatible(model, requestedEmbedModel));
  const laneFallback = {
    chat: !!resolvedChatModel && !!requestedChatModel && !modelsLookCompatible(resolvedChatModel, requestedChatModel),
    tool: !!resolvedToolModel && !!requestedToolModel && !modelsLookCompatible(resolvedToolModel, requestedToolModel),
  };
  const blockers = [];
  const warnings = uniqueStrings(probe.warnings || []);

  if (!endpointOk) blockers.push(`Could not reach OpenAI-compatible models endpoint at ${baseUrl}/models.`);
  if (endpointOk && !visibleModels.length) blockers.push(`OpenAI-compatible endpoint is reachable, but no usable model IDs were visible from /models.`);
  if (requestedChatModel && !resolvedChatModel) blockers.push(`Requested chat model ${requestedChatModel} is not exposed by ${runtimeLabel}.`);
  if (requestedToolModel && !resolvedToolModel) blockers.push(`Requested tool model ${requestedToolModel} is not exposed by ${runtimeLabel}.`);
  if (laneFallback.chat) warnings.push(`Chat lane will use ${resolvedChatModel} as a fallback instead of ${requestedChatModel}.`);
  if (laneFallback.tool) warnings.push(`Tool lane will use ${resolvedToolModel} as a fallback instead of ${requestedToolModel}.`);
  if (requestedEmbedModel && !embedVisible) {
    warnings.push(`Embedding model ${requestedEmbedModel} is not exposed by ${runtimeLabel}, so semantic memory will fall back to keyword retrieval.`);
  }

  const status = {
    ok: endpointOk && blockers.length === 0,
    reachable: endpointOk,
    base: baseUrl,
    backendFamily,
    configuredModel: requestedChatModel,
    configuredChatModel: requestedChatModel,
    configuredToolModel: requestedToolModel,
    chatPreferredModel: requestedChatModel,
    toolPreferredModel: requestedToolModel,
    resolvedModel: resolvedChatModel,
    resolvedChatModel,
    resolvedToolModel,
    candidateModels: resolvedChatModel ? [resolvedChatModel] : [],
    toolCandidateModels: resolvedToolModel ? [resolvedToolModel] : [],
    availableModels: visibleModels,
    loadedModels: visibleModels,
    nativeAvailableModels: visibleModels,
    installedModels: visibleModels,
    hint: blockers.join(' ') || '',
    error: endpointOk ? '' : blockers.join(' '),
    localTransport: normalizeLmStudioTransportForWatch(env.PENNY_LOCAL_LLM_TRANSPORT || env.PENNY_LMSTUDIO_TRANSPORT || 'chat'),
    routingMode: fallbackAllowed ? 'openai-compatible-fallback' : 'strict',
    modelFallbackDisabled: !fallbackAllowed,
  };
  const report = {
    ok: blockers.length === 0,
    reportOnly: true,
    runtimeKind: backendFamily,
    requestedChatModel,
    requestedToolModel,
    requestedEmbedModel,
    cliCheck: { ok: null, detail: `${runtimeLabel} mode does not require the LM Studio CLI.` },
    blockers: uniqueStrings(blockers),
    warnings: uniqueStrings(warnings),
    actions: [],
    installedModels: visibleModels,
    loadedModels: visibleModels,
    preset: null,
    statusBefore: status,
    statusAfter: status,
    laneFallback,
    semanticMemoryReady: embedVisible,
    dualLaneReady: !!resolvedChatModel && !!resolvedToolModel && !laneFallback.chat && !laneFallback.tool,
    strictNoModelOps: true,
    loadStrategy: 'operator-managed OpenAI-compatible endpoint',
  };
  const readinessSummary = buildLocalReadinessSummary({
    requestedChatModel,
    requestedToolModel,
    requestedEmbedModel,
    resolvedChatModel,
    resolvedToolModel,
    loadedModels: visibleModels,
    semanticReady: embedVisible,
    semanticKnown: !!requestedEmbedModel,
    semanticReason: requestedEmbedModel && !embedVisible ? `${runtimeLabel} did not expose the embedding model.` : '',
    laneFallback,
    blockers,
    warnings,
    serverMode: backendFamily,
    strictNoModelOps: true,
    manageModels: false,
    loadStrategy: report.loadStrategy,
  });
  report.readinessSummary = readinessSummary;

  const endpointDetail = endpointOk
    ? `${runtimeLabel} endpoint is reachable at ${baseUrl}; backend=${backendFamily}; models=${visibleModels.join(', ') || '(none)'}.`
    : (blockers[0] || `Could not reach ${baseUrl}/models.`);
  checks.push(summarizeCheck('local-endpoint', endpointOk, endpointDetail, endpointOk ? 'pass' : 'fail'));
  const readinessDetail = `${formatLocalReadinessSummary(readinessSummary, { includeLoaded: false })} requested chat=${requestedChatModel}; requested tool=${requestedToolModel}; semantic memory=${embedVisible ? 'ready' : 'fallback'}; loaded=${visibleModels.join(', ') || '(none)'}`.trim();
  checks.push(summarizeCheck(
    'local-readiness',
    blockers.length === 0,
    readinessDetail,
    blockers.length === 0 ? (warnings.length || laneFallback.chat || laneFallback.tool ? 'warn' : 'pass') : 'fail',
  ));
  checks.push(...summarizeRuntimePosture(env));

  const fixes = buildPreflightFixes({
    checks,
    report,
    baseUrl,
    port: env.PORT || process.env.PORT || 4317,
    runtimeLabel,
  });
  const gemmaRuntimeWatch = buildGemmaRuntimeWatchForPreflight({
    preflightReport: {
      report,
      status,
    },
    env,
    chatModel,
  });
  const assumptions = [
    `${runtimeLabel} mode uses an already-running OpenAI-compatible endpoint and does not use the LM Studio CLI or preset repair path.`,
    `If the endpoint is unreachable, start ${runtimeLabel} and verify ${baseUrl}/models before rerunning: npm run doctor.`,
  ];

  return {
    ok: Boolean(nodeCheck?.ok) && Boolean(npmCheck?.ok) && endpointOk && blockers.length === 0,
    checks,
    assumptions,
    report,
    status,
    installedModels: visibleModels,
    loadedModels: visibleModels,
    readinessSummary,
    gemmaRuntimeWatch,
    fixes,
    endpointProbe: probe,
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
  const npmCheck = checkNpmVersion({ spawnSyncImpl, packageJson });
  checks.push(npmCheck);
  const endpointProbe = await probeLocalEndpoint({ baseUrl, fetchImpl });
  if (shouldUseGenericEndpointPreflight({ env, endpointProbe })) {
    return buildGenericEndpointPreflightReport({
      endpointProbe,
      checks,
      nodeCheck,
      npmCheck,
      baseUrl,
      env,
      chatModel,
      toolModel,
      embedModel,
    });
  }
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
  const fixes = buildPreflightFixes({
    checks,
    report,
    baseUrl,
    port: env.PORT || process.env.PORT || 4317,
  });

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
    ok: nodeCheck.ok && npmCheck.ok && lmStudioApi.ok && report.blockers.length === 0,
    checks,
    assumptions,
    report,
    status,
    installedModels,
    loadedModels,
    readinessSummary,
    gemmaRuntimeWatch,
    fixes,
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
  for (const fix of report.fixes || []) {
    process.stdout.write(`[FIX] ${fix}\n`);
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
  buildPreflightFixes,
  checkLmStudioApi,
  buildGemmaRuntimeWatchForPreflight,
  runPreflight,
};
