const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { URL } = require('url');
const { createLmStudioStatusApi } = require('../lib/penny-lmstudio-status');
const { createLmStudioAutomationApi } = require('../lib/penny-lmstudio-automation');

const ROOT_DIR = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');

function execFileText(command, args, options = {}) {
  const timeout = typeof options === 'number' ? options : (options.timeout || 120000);
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: ROOT_DIR,
      timeout,
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

function loadPackageJson() {
  return JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function parseExpectedMajor(range = '') {
  const match = String(range || '').match(/(\d{2,})/);
  return match ? Number(match[1]) : null;
}

function checkNodeVersion(expectedRange = '', currentVersion = process.versions.node) {
  const currentMajor = Number(String(currentVersion || '').split('.')[0] || 0);
  const expectedMajor = parseExpectedMajor(expectedRange);
  if (!expectedMajor) return { ok: true, detail: `Node ${currentVersion} detected.` };
  if (currentMajor !== expectedMajor) {
    return { ok: false, detail: `Node ${currentVersion} detected, but this repo expects major ${expectedMajor} (${expectedRange}).` };
  }
  return { ok: true, detail: `Node ${currentVersion} matches ${expectedRange}.` };
}

function createAutomationApi({
  fetchImpl = fetch,
  fsImpl = fs,
  pathImpl = path,
  execFileTextImpl = execFileText,
  env = process.env,
  lmStudioBase = (env.PENNY_LMSTUDIO_BASE || 'http://127.0.0.1:1234/v1').replace(/\/$/, ''),
  lmStudioApiKey = env.PENNY_LMSTUDIO_API_KEY || 'lm-studio-local',
  chatModel = String(env.PENNY_LMSTUDIO_CHAT_MODEL || 'google/gemma-4-31b').trim(),
  toolModel = String(env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b').trim(),
  presetIdentifier = String(env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny',
} = {}) {
  const lmStudioStatusApi = createLmStudioStatusApi({
    fetch: fetchImpl,
    fs: fsImpl,
    execFileText: execFileTextImpl,
    URL,
    LMSTUDIO_BASE: lmStudioBase,
    LMSTUDIO_API_KEY: lmStudioApiKey,
    LMSTUDIO_SETTINGS_FILE: pathImpl.join(env.APPDATA || '', 'LM Studio', 'settings.json'),
    LMSTUDIO_STATUS_CACHE_MS: 0,
    LMSTUDIO_STATUS_ERROR_CACHE_MS: 0,
    LMSTUDIO_MODELS_PROBE_MS: 30000,
    LOCAL_LLM_TRANSPORT: String(env.PENNY_LOCAL_LLM_TRANSPORT || env.PENNY_LMSTUDIO_TRANSPORT || 'auto').toLowerCase(),
    PENNY_LMSTUDIO_CHAT_MODEL: chatModel,
    PENNY_LMSTUDIO_TOOL_MODEL: toolModel,
  });
  return createLmStudioAutomationApi({
    fs: fsImpl,
    path: pathImpl,
    execFileText: execFileTextImpl,
    lmStudioStatusApi,
    APPDATA: env.APPDATA || '',
    USER_HOME: env.USERPROFILE || env.HOME || '',
    LMSTUDIO_SETTINGS_FILE: pathImpl.join(env.APPDATA || '', 'LM Studio', 'settings.json'),
    PENNY_LMSTUDIO_CHAT_MODEL: chatModel,
    PENNY_LMSTUDIO_TOOL_MODEL: toolModel,
    PENNY_LMSTUDIO_PRESET_IDENTIFIER: presetIdentifier,
  });
}

function parseArgs(argv = process.argv.slice(2)) {
  return {
    reportOnly: argv.includes('--report-only'),
    bestEffort: argv.includes('--best-effort'),
    json: argv.includes('--json'),
  };
}

function formatPrepareReport(report, nodeCheck) {
  const lines = [];
  const push = (text) => lines.push(String(text || '').trim());
  if (nodeCheck) push(`[${nodeCheck.ok ? 'PASS' : 'FAIL'}] node: ${nodeCheck.detail}`);
  push(`[${report.cliCheck?.ok ? 'PASS' : 'FAIL'}] lms-cli: ${report.cliCheck?.detail || 'Unknown LM Studio CLI status.'}`);
  const status = report.statusAfter || report.statusBefore || {};
  push(`[${status.reachable ? 'PASS' : 'FAIL'}] lmstudio-api: ${status.reachable ? `LM Studio is reachable at ${status.base}.` : (status.error || 'LM Studio is unreachable.')}`);
  push(`[INFO] chat requested: ${report.requestedChatModel}`);
  push(`[INFO] tool requested: ${report.requestedToolModel}`);
  push(`[INFO] installed models: ${(report.installedModels || []).join(', ') || '(none)'}`);
  push(`[INFO] loaded models: ${(report.loadedModels || []).join(', ') || '(none)'}`);
  push(`[INFO] resolved chat: ${status.resolvedChatModel || '(none)'}`);
  push(`[INFO] resolved tool: ${status.resolvedToolModel || '(none)'}`);
  push(`[INFO] resolved runtime: ${status.resolvedModel || '(none)'}`);
  push(`[INFO] routing mode: ${status.routingMode || 'auto'}`);
  if (report.preset) {
    push(`[INFO] preset identifier: ${report.preset.presetIdentifier}`);
    push(`[INFO] preset conversation: ${report.preset.selectedConversation?.presetOk ? 'ok' : 'not fully wired'}`);
    push(`[INFO] preset chat configs: ${(report.preset.chatConfigs || []).filter(item => item.presetOk).length}/${(report.preset.chatConfigs || []).length || 0}`);
    push(`[INFO] preset tool configs: ${(report.preset.toolConfigs || []).filter(item => item.presetOk).length}/${(report.preset.toolConfigs || []).length || 0}`);
  }
  for (const warning of report.warnings || []) push(`[WARN] ${warning}`);
  for (const blocker of report.blockers || []) push(`[FAIL] ${blocker}`);
  if (report.actions?.length) {
    for (const action of report.actions) push(`[ACTION] ${action}`);
  }
  return lines.filter(Boolean).join('\n');
}

async function runPrepare({
  fetchImpl = fetch,
  fsImpl = fs,
  pathImpl = path,
  execFileTextImpl = execFileText,
  env = process.env,
  reportOnly = false,
  packageJson = loadPackageJson(),
  nodeVersion = process.versions.node,
  lmStudioBase = (env.PENNY_LMSTUDIO_BASE || 'http://127.0.0.1:1234/v1').replace(/\/$/, ''),
  lmStudioApiKey = env.PENNY_LMSTUDIO_API_KEY || 'lm-studio-local',
  chatModel = String(env.PENNY_LMSTUDIO_CHAT_MODEL || 'google/gemma-4-31b').trim(),
  toolModel = String(env.PENNY_LMSTUDIO_TOOL_MODEL || 'google/gemma-4-e4b').trim(),
  presetIdentifier = String(env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny',
} = {}) {
  const automationApi = createAutomationApi({
    fetchImpl,
    fsImpl,
    pathImpl,
    execFileTextImpl,
    env,
    lmStudioBase,
    lmStudioApiKey,
    chatModel,
    toolModel,
    presetIdentifier,
  });
  const nodeCheck = checkNodeVersion(packageJson?.engines?.node || '', nodeVersion);
  const report = await automationApi.prepareLmStudio({
    reportOnly,
    repairPreset: !reportOnly,
    loadChatModel: !reportOnly,
    chatModel,
    toolModel,
  });
  return {
    ok: nodeCheck.ok && report.ok,
    nodeCheck,
    report,
  };
}

async function main() {
  const args = parseArgs();
  const result = await runPrepare({ reportOnly: args.reportOnly });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`${formatPrepareReport(result.report, result.nodeCheck)}\n`);
  }
  if (!result.ok && !args.bestEffort) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${String(error?.message || error).trim()}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  createAutomationApi,
  parseArgs,
  checkNodeVersion,
  runPrepare,
  formatPrepareReport,
};
