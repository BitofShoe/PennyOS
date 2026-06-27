const fs = require('node:fs');
const path = require('node:path');

const {
  RUNTIME_CONTRACT_RECEIPT_SCHEMA,
} = require('../lib/penny-runtime-contract-receipt');

const REQUIRED_JSON_FIELDS = Object.freeze([
  'runtime.endpoint',
  'runtime.backend',
  'runtime.local_cloud_mode',
  'model.id_or_path',
  'prompt_contract.chat_template',
  'sampling_defaults',
  'capabilities.tool_function_support',
  'memory_lane.status',
  'privacy.warning_state',
  'smoke.status',
  'state_preservation.model_state_preserved',
]);

const STATE_MUTATION_FIELDS = Object.freeze([
  'started_models',
  'stopped_models',
  'loaded_models',
  'unloaded_models',
  'swapped_models',
  'downloaded_models',
  'memory_changed',
  'runtime_voice_changed',
  'prompt_defaults_changed',
  'default_model_changed',
]);

const REQUIRED_MARKDOWN_LABELS = Object.freeze([
  'Schema',
  'Measurement mode',
  'Endpoint',
  'Backend',
  'Local/cloud mode',
  'Model id/path',
  'Prompt/chat template',
  'Sampling defaults',
  'Tool/function support',
  'Memory lane',
  'Privacy warning state',
  'Smoke status',
  'Model state preserved',
]);

function cleanText(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function lowerText(value = '') {
  return cleanText(value).toLowerCase();
}

function getPath(source = {}, fieldPath = '') {
  let current = source;
  for (const segment of String(fieldPath || '').split('.')) {
    if (!segment) continue;
    if (!current || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}

function hasReceiptValue(source = {}, fieldPath = '') {
  const value = getPath(source, fieldPath);
  if (value == null) return false;
  if (typeof value === 'string') return cleanText(value).length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return true;
  return typeof value === 'object';
}

function makeFailure(filePath, code, message) {
  return {
    code,
    message: `${filePath}: ${message}`,
  };
}

function extractRuntimeContractReceipt(payload = {}) {
  if (payload?.schema === RUNTIME_CONTRACT_RECEIPT_SCHEMA) return payload;
  if (payload?.runtime_contract?.schema === RUNTIME_CONTRACT_RECEIPT_SCHEMA) {
    return payload.runtime_contract;
  }
  return payload;
}

function analyzeRuntimeContractReceipt(payload = {}, { filePath = '<runtime-contract-json>' } = {}) {
  const receipt = extractRuntimeContractReceipt(payload);
  const failures = [];

  if (receipt?.schema !== RUNTIME_CONTRACT_RECEIPT_SCHEMA) {
    failures.push(makeFailure(
      filePath,
      'schema:runtime-contract',
      `expected schema "${RUNTIME_CONTRACT_RECEIPT_SCHEMA}" or nested runtime_contract receipt`,
    ));
  }

  for (const field of REQUIRED_JSON_FIELDS) {
    if (!hasReceiptValue(receipt, field)) {
      failures.push(makeFailure(
        filePath,
        `missing-field:${field}`,
        `missing required runtime contract field "${field}"`,
      ));
    }
  }

  const promptTemplate = getPath(receipt, 'prompt_contract.prompt_template');
  const chatTemplate = getPath(receipt, 'prompt_contract.chat_template');
  if (!cleanText(promptTemplate) && !cleanText(chatTemplate)) {
    failures.push(makeFailure(
      filePath,
      'missing-field:prompt_contract.prompt_template',
      'missing both prompt_contract.prompt_template and prompt_contract.chat_template',
    ));
  }

  const sampling = getPath(receipt, 'sampling_defaults');
  if (sampling && typeof sampling === 'object') {
    for (const key of ['temperature', 'top_p', 'top_k']) {
      if (!Object.prototype.hasOwnProperty.call(sampling, key)) {
        failures.push(makeFailure(
          filePath,
          `missing-field:sampling_defaults.${key}`,
          `missing sampling default key "${key}"`,
        ));
      }
    }
  }

  const state = receipt?.state_preservation || {};
  if (state.model_state_preserved !== true) {
    failures.push(makeFailure(
      filePath,
      'state-mutation:model_state_preserved',
      'model_state_preserved must be true for safe runtime contract receipts',
    ));
  }
  for (const field of STATE_MUTATION_FIELDS) {
    if (state[field] === true) {
      failures.push(makeFailure(
        filePath,
        `state-mutation:${field}`,
        `state_preservation.${field} is true; this receipt is not model-state-safe`,
      ));
    }
  }

  const measurementMode = lowerText(receipt?.measurement_mode);
  const smoke = receipt?.smoke || {};
  if (measurementMode === 'status-only' && smoke.model_call === true) {
    failures.push(makeFailure(
      filePath,
      'overclaim:status-only-smoke-model-call',
      'status-only receipts cannot claim a smoke model call',
    ));
  }
  const smokeStatus = lowerText(smoke.status);
  if (['passed', 'recorded'].includes(smokeStatus)) {
    if (!cleanText(smoke.prompt)) {
      failures.push(makeFailure(
        filePath,
        'missing-field:smoke.prompt',
        'smoke status claims output but has no prompt',
      ));
    }
    if (!cleanText(smoke.output)) {
      failures.push(makeFailure(
        filePath,
        'missing-field:smoke.output',
        'smoke status claims output but has no recorded output',
      ));
    }
  }

  const localCloudMode = lowerText(receipt?.runtime?.local_cloud_mode);
  const warningState = lowerText(receipt?.privacy?.warning_state);
  if (localCloudMode === 'cloud' && (!warningState || warningState === 'local-first' || warningState === 'unknown')) {
    failures.push(makeFailure(
      filePath,
      'privacy:cloud-warning-state',
      'cloud runtime receipts need an explicit cloud privacy warning state',
    ));
  }

  return {
    ok: failures.length === 0,
    filePath,
    receipt,
    failures,
  };
}

function parseMarkdownLabels(markdown = '') {
  const labels = {};
  for (const rawLine of String(markdown || '').split(/\r?\n/)) {
    const match = rawLine.match(/^([^:#][^:]+):\s*(.*?)\s*$/);
    if (!match) continue;
    labels[cleanText(match[1]).toLowerCase()] = cleanText(match[2]);
  }
  return labels;
}

function labelValue(labels = {}, label = '') {
  return labels[cleanText(label).toLowerCase()] || '';
}

function analyzeRuntimeContractMarkdown(markdown = '', { filePath = '<runtime-contract-markdown>' } = {}) {
  const labels = parseMarkdownLabels(markdown);
  const failures = [];

  for (const label of REQUIRED_MARKDOWN_LABELS) {
    if (!labelValue(labels, label)) {
      failures.push(makeFailure(
        filePath,
        `missing-label:${label}`,
        `missing runtime contract markdown label "${label}"`,
      ));
    }
  }

  const schema = labelValue(labels, 'Schema');
  if (schema && schema !== RUNTIME_CONTRACT_RECEIPT_SCHEMA) {
    failures.push(makeFailure(
      filePath,
      'schema:runtime-contract',
      `expected schema "${RUNTIME_CONTRACT_RECEIPT_SCHEMA}"`,
    ));
  }

  if (lowerText(labelValue(labels, 'Model state preserved')) !== 'true') {
    failures.push(makeFailure(
      filePath,
      'state-mutation:model_state_preserved',
      'Model state preserved must be true for safe runtime contract receipts',
    ));
  }

  if (lowerText(labelValue(labels, 'Measurement mode')) === 'status-only'
    && ['passed', 'recorded'].includes(lowerText(labelValue(labels, 'Smoke status')))) {
    failures.push(makeFailure(
      filePath,
      'overclaim:status-only-smoke-output',
      'status-only markdown receipts cannot claim passed/recorded smoke output',
    ));
  }

  if (lowerText(labelValue(labels, 'Local/cloud mode')) === 'cloud') {
    const warning = lowerText(labelValue(labels, 'Privacy warning state'));
    if (!warning || warning === 'local-first' || warning === 'unknown') {
      failures.push(makeFailure(
        filePath,
        'privacy:cloud-warning-state',
        'cloud runtime receipts need an explicit cloud privacy warning state',
      ));
    }
  }

  return {
    ok: failures.length === 0,
    filePath,
    labels,
    failures,
  };
}

function checkRuntimeContractReceiptFile(filePath) {
  const resolved = path.resolve(filePath);
  const text = fs.readFileSync(resolved, 'utf8');
  if (/\.md(?:own)?$/i.test(filePath)) {
    return analyzeRuntimeContractMarkdown(text, { filePath });
  }
  const payload = JSON.parse(text);
  return analyzeRuntimeContractReceipt(payload, { filePath });
}

function checkRuntimeContractReceiptFiles(filePaths = []) {
  return filePaths.map(checkRuntimeContractReceiptFile);
}

function main(argv = process.argv.slice(2)) {
  const filePaths = argv.filter((arg) => !arg.startsWith('-'));
  if (!filePaths.length) {
    console.error('Usage: node scripts/check-penny-runtime-contract-receipts.js <receipt.json|receipt.md> [more-receipts ...]');
    process.exit(2);
  }

  const results = checkRuntimeContractReceiptFiles(filePaths);
  const failures = results.flatMap((result) => result.failures);
  if (failures.length) {
    console.error(`Penny runtime contract receipt check failed (${failures.length} finding${failures.length === 1 ? '' : 's'}):`);
    for (const failure of failures) {
      console.error(`- ${failure.code}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log(`Penny runtime contract receipt check passed (${results.length} file${results.length === 1 ? '' : 's'}).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Penny runtime contract receipt check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  REQUIRED_JSON_FIELDS,
  REQUIRED_MARKDOWN_LABELS,
  STATE_MUTATION_FIELDS,
  analyzeRuntimeContractMarkdown,
  analyzeRuntimeContractReceipt,
  checkRuntimeContractReceiptFile,
  checkRuntimeContractReceiptFiles,
  extractRuntimeContractReceipt,
  parseMarkdownLabels,
};
