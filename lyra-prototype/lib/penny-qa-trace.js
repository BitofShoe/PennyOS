const { normalizeQaTrust } = require('./penny-qa-trust');

const QA_TRACE_VERSION = 'penny-qa-trace.v1';

function trimText(value = '', limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function trimIso(value = '', fallback = '') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}

function normalizeStringArray(values = [], limit = 16) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const output = [];
  for (const value of values) {
    const text = trimText(value, 160);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeModelMap(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [key, entry] of Object.entries(raw)) {
    const trimmedKey = String(key || '').trim();
    const trimmedValue = trimText(entry, 200);
    if (!trimmedKey || !trimmedValue) continue;
    out[trimmedKey] = trimmedValue;
  }
  return out;
}

function normalizeMetricObject(value = {}) {
  const raw = value && typeof value === 'object' ? value : {};
  const out = {};
  for (const [key, entry] of Object.entries(raw)) {
    const trimmedKey = String(key || '').trim();
    if (!trimmedKey) continue;
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      out[trimmedKey] = entry;
      continue;
    }
    if (typeof entry === 'boolean') {
      out[trimmedKey] = entry;
      continue;
    }
    const trimmedValue = trimText(entry, 220);
    if (trimmedValue) out[trimmedKey] = trimmedValue;
  }
  return out;
}

function buildQaTrace({
  runId = '',
  startedAt = '',
  finishedAt = '',
  promptVersion = '',
  runIdentity = {},
  driftCanaries = {},
  laneDecision = {},
  configuredModels = {},
  resolvedModels = {},
  loadedModels = [],
  contextLength = {},
  memoryReads = {},
  memoryWrites = {},
  toolCalls = {},
  latency = {},
  trust = {},
  validation = {},
  outcome = {},
} = {}) {
  return {
    version: QA_TRACE_VERSION,
    runId: trimText(runId, 120),
    startedAt: trimIso(startedAt, ''),
    finishedAt: trimIso(finishedAt, ''),
    promptVersion: trimText(promptVersion, 120),
    runIdentity: normalizeMetricObject(runIdentity),
    driftCanaries: normalizeMetricObject(driftCanaries),
    laneDecision: normalizeMetricObject(laneDecision),
    configuredModels: normalizeModelMap(configuredModels),
    resolvedModels: normalizeModelMap(resolvedModels),
    loadedModels: normalizeStringArray(loadedModels, 24),
    contextLength: normalizeMetricObject(contextLength),
    memoryReads: normalizeMetricObject(memoryReads),
    memoryWrites: normalizeMetricObject(memoryWrites),
    toolCalls: normalizeMetricObject(toolCalls),
    latency: normalizeMetricObject(latency),
    trust: normalizeQaTrust(trust),
    validation: normalizeMetricObject(validation),
    outcome: normalizeMetricObject(outcome),
  };
}

function validateQaTrace(trace = {}) {
  const normalized = buildQaTrace(trace);
  const requiredObjectKeys = [
    'runIdentity',
    'driftCanaries',
    'laneDecision',
    'configuredModels',
    'resolvedModels',
    'contextLength',
    'memoryReads',
    'memoryWrites',
    'toolCalls',
    'latency',
    'trust',
    'validation',
    'outcome',
  ];
  if (!normalized.runId) throw new Error('QA trace is missing runId.');
  if (!normalized.startedAt) throw new Error(`QA trace ${normalized.runId} is missing startedAt.`);
  if (!normalized.finishedAt) throw new Error(`QA trace ${normalized.runId} is missing finishedAt.`);
  if (!normalized.promptVersion) throw new Error(`QA trace ${normalized.runId} is missing promptVersion.`);
  for (const key of requiredObjectKeys) {
    if (!normalized[key] || typeof normalized[key] !== 'object') {
      throw new Error(`QA trace ${normalized.runId} is missing ${key}.`);
    }
  }
  if (!Object.keys(normalized.outcome).length) {
    throw new Error(`QA trace ${normalized.runId} is missing outcome details.`);
  }
  if (!Object.keys(normalized.validation).length) {
    throw new Error(`QA trace ${normalized.runId} is missing validation details.`);
  }
  return normalized;
}

module.exports = {
  QA_TRACE_VERSION,
  buildQaTrace,
  validateQaTrace,
};
