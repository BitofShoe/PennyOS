const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  checkNodeVersion,
  runPrepare,
} = require('./penny-lmstudio-prepare');

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
  presetIdentifier = String(process.env.PENNY_LMSTUDIO_PRESET_IDENTIFIER || '@local:penny').trim() || '@local:penny',
} = {}) {
  const checks = [];
  const nodeCheck = checkNodeVersion(packageJson?.engines?.node || '', nodeVersion);
  checks.push(summarizeCheck('node', nodeCheck.ok, nodeCheck.detail, nodeCheck.ok ? 'pass' : 'fail'));
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
    presetIdentifier,
  });
  checks.push(summarizeCheck('lmstudio-api', lmStudioApi.ok, lmStudioApi.detail, lmStudioApi.ok ? 'pass' : 'fail'));

  const prepareResult = lmStudioApi.result;
  const report = prepareResult.report;
  const status = report.statusAfter || report.statusBefore || {};

  const loadedModels = Array.isArray(report.loadedModels) ? report.loadedModels : [];
  const installedModels = Array.isArray(report.installedModels) ? report.installedModels : [];
  const readinessDetail = [
    `requested chat=${report.requestedChatModel}`,
    `requested tool=${report.requestedToolModel}`,
    `resolved chat=${status.resolvedChatModel || '(none)'}`,
    `resolved tool=${status.resolvedToolModel || '(none)'}`,
    `loaded=${loadedModels.join(', ') || '(none)'}`,
  ].join('; ');
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

  const assumptions = [
    'QA scripts assume local Windows + PowerShell launcher behavior.',
    'Voice QA and probes expect LM Studio to be running before they start.',
  ];
  return {
    ok: nodeCheck.ok && lmStudioApi.ok && report.blockers.length === 0,
    checks,
    assumptions,
    report,
    status,
    installedModels,
    loadedModels,
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
  checkLmsCli,
  checkLmStudioApi,
  runPreflight,
};
