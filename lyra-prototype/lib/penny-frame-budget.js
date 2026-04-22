const PENNY_FRAME_BUDGET_SCHEMA = 'penny-frame-budget.v1';

const FRAME_BUDGET_SUMMARY_SCHEMA = 'penny-frame-budget-summary.v1';

const FRAME_BUDGET_EVENT_STATUSES = Object.freeze({
  MET: 'met',
  MISSED: 'missed',
  SKIPPED: 'skipped',
  DEGRADED: 'degraded',
});

const FRAME_BUDGET_HEALTH = Object.freeze({
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  MISSED: 'missed',
});

const FRAME_BUDGET_LIMITS = Object.freeze([
  'Frame budget receipts measure runtime shape; they do not prove answer quality by themselves.',
  'Faster runtime should improve pre-prompt selection before increasing rendered context.',
  'This artifact is not PromptTruth and does not expand memory authority.',
]);

const FRAME_BUDGET_TARGET_KEYS = Object.freeze([
  'firstTokenMs',
  'totalResponseMs',
  'prePromptBudgetMs',
  'staticMemoryBudgetMs',
  'openLoopBudgetMs',
  'turnStateBudgetMs',
  'maxRenderedMemoryItems',
  'maxMemoryPromptTokens',
  'maxStaticOnlyRendered',
]);

const FRAME_BUDGET_TIMING_KEYS = Object.freeze([
  'turnStateMs',
  'staticMemoryQueryMs',
  'openLoopQueryMs',
  'exactAnchorMs',
  'candidateMergeMs',
  'authorityGateMs',
  'promptBuildMs',
  'lmStudioFirstTokenMs',
  'lmStudioTotalMs',
  'artifactWriteMs',
  'totalPrePromptMs',
  'totalTurnMs',
]);

const FRAME_BUDGET_WORK_KEYS = Object.freeze([
  'rawCandidatesInspected',
  'staticCandidatesInspected',
  'keywordCandidatesInspected',
  'openLoopsScored',
  'candidatesSelected',
  'candidatesRendered',
  'staticOnlyRendered',
  'staleCandidatesBlocked',
  'sourceChecksRun',
  'backgroundJobsQueued',
]);

const CANDIDATE_SURVIVAL_STATUSES = new Set([
  'not-run',
  'pass',
  'fail',
  'degraded',
]);

const EVENT_STATUS_VALUES = new Set(Object.values(FRAME_BUDGET_EVENT_STATUSES));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value = '', limit = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '', fallback = '') {
  const token = cleanString(value, 120).toLowerCase().replace(/[_\s]+/g, '-');
  return token || fallback;
}

function finiteNonNegativeNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCount(value) {
  const num = finiteNonNegativeNumberOrNull(value);
  if (num === null) return 0;
  return Math.floor(num);
}

function boolOrNull(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function normalizeKeyedNumbers(input, keys, { count = false } = {}) {
  const raw = isPlainObject(input) ? input : {};
  const out = {};
  for (const key of keys) {
    out[key] = count
      ? normalizeCount(raw[key])
      : finiteNonNegativeNumberOrNull(raw[key]);
  }
  return out;
}

function normalizeCandidateSurvival(value = 'not-run') {
  const status = cleanToken(value || 'not-run');
  return CANDIDATE_SURVIVAL_STATUSES.has(status) ? status : 'not-run';
}

function normalizeBudgetEventStatus(value = '') {
  const status = cleanToken(value);
  if (EVENT_STATUS_VALUES.has(status)) return status;
  if (/^(ok|pass|passed|within-budget)$/.test(status)) return FRAME_BUDGET_EVENT_STATUSES.MET;
  if (/^(miss|missed|timeout|timed-out|over-budget)$/.test(status)) return FRAME_BUDGET_EVENT_STATUSES.MISSED;
  if (/^(skip|skipped|not-run|disabled)$/.test(status)) return FRAME_BUDGET_EVENT_STATUSES.SKIPPED;
  return FRAME_BUDGET_EVENT_STATUSES.DEGRADED;
}

function normalizeBudgetEvent(event = {}) {
  const raw = isPlainObject(event) ? event : {};
  return {
    id: cleanToken(raw.id || raw.name || 'frame-budget-event'),
    status: normalizeBudgetEventStatus(raw.status),
    budgetMs: finiteNonNegativeNumberOrNull(raw.budgetMs),
    actualMs: finiteNonNegativeNumberOrNull(raw.actualMs),
    fallback: cleanString(raw.fallback || ''),
    reason: cleanString(raw.reason || ''),
  };
}

function normalizeQuality(quality = {}) {
  const raw = isPlainObject(quality) ? quality : {};
  return {
    candidateSurvival: normalizeCandidateSurvival(raw.candidateSurvival),
    sourceAuthorityPreserved: boolOrNull(raw.sourceAuthorityPreserved),
    staleCorrectionBlocked: boolOrNull(raw.staleCorrectionBlocked),
    overclaimRegression: boolOrNull(raw.overclaimRegression),
    promptTokenDelta: finiteNumberOrNull(raw.promptTokenDelta) ?? 0,
    firstTokenLatencyDeltaMs: finiteNumberOrNull(raw.firstTokenLatencyDeltaMs),
  };
}

function normalizeFrameBudgetReceipt(receiptLike = {}) {
  const raw = isPlainObject(receiptLike) ? receiptLike : {};
  const budgetEvents = Array.isArray(raw.budgetEvents)
    ? raw.budgetEvents.map(normalizeBudgetEvent)
    : [];
  return {
    schema: PENNY_FRAME_BUDGET_SCHEMA,
    generatedAt: cleanString(raw.generatedAt || '') || null,
    turnId: cleanString(raw.turnId || ''),
    lane: cleanToken(raw.lane || 'unknown', 'unknown'),
    mode: cleanToken(raw.mode || 'baseline', 'baseline'),
    targets: normalizeKeyedNumbers(raw.targets, FRAME_BUDGET_TARGET_KEYS),
    timings: normalizeKeyedNumbers(raw.timings, FRAME_BUDGET_TIMING_KEYS),
    workDone: normalizeKeyedNumbers(raw.workDone, FRAME_BUDGET_WORK_KEYS, { count: true }),
    budgetEvents,
    quality: normalizeQuality(raw.quality),
    limits: [...FRAME_BUDGET_LIMITS],
  };
}

function createFrameBudgetReceipt(options = {}) {
  return normalizeFrameBudgetReceipt(options);
}

function addFrameTiming(receipt, key, ms) {
  const normalized = normalizeFrameBudgetReceipt(receipt);
  const timingKey = cleanString(key, 80);
  if (!FRAME_BUDGET_TIMING_KEYS.includes(timingKey)) return normalized;
  return normalizeFrameBudgetReceipt({
    ...normalized,
    timings: {
      ...normalized.timings,
      [timingKey]: ms,
    },
  });
}

function addFrameWorkCount(receipt, key, count) {
  const normalized = normalizeFrameBudgetReceipt(receipt);
  const workKey = cleanString(key, 80);
  if (!FRAME_BUDGET_WORK_KEYS.includes(workKey)) return normalized;
  const current = normalized.workDone[workKey] || 0;
  return normalizeFrameBudgetReceipt({
    ...normalized,
    workDone: {
      ...normalized.workDone,
      [workKey]: current + normalizeCount(count),
    },
  });
}

function addFrameBudgetEvent(receipt, event) {
  const normalized = normalizeFrameBudgetReceipt(receipt);
  return normalizeFrameBudgetReceipt({
    ...normalized,
    budgetEvents: [
      ...normalized.budgetEvents,
      normalizeBudgetEvent(event),
    ],
  });
}

function classifyFrameBudgetHealth(receiptLike = {}) {
  const receipt = normalizeFrameBudgetReceipt(receiptLike);
  const reasons = [];
  const firstTokenTarget = receipt.targets.firstTokenMs;
  const firstTokenActual = receipt.timings.lmStudioFirstTokenMs;
  const staticOnlyCap = receipt.targets.maxStaticOnlyRendered;
  const staticOnlyRendered = receipt.workDone.staticOnlyRendered;
  const firstTokenMissed = firstTokenTarget !== null
    && firstTokenActual !== null
    && firstTokenActual > firstTokenTarget;
  const promptTokenGrowth = receipt.quality.promptTokenDelta > 0;
  const staticOnlyRenderedCapBreached = staticOnlyCap !== null
    && staticOnlyRendered > staticOnlyCap;
  const missedEvents = receipt.budgetEvents
    .filter((event) => event.status === FRAME_BUDGET_EVENT_STATUSES.MISSED)
    .map((event) => event.id);
  const degradedEvents = receipt.budgetEvents
    .filter((event) => event.status === FRAME_BUDGET_EVENT_STATUSES.DEGRADED)
    .map((event) => event.id);

  if (firstTokenMissed) reasons.push('first-token-budget-missed');
  if (promptTokenGrowth) reasons.push('prompt-token-growth');
  if (staticOnlyRenderedCapBreached) reasons.push('static-only-rendered-cap-breached');
  for (const id of missedEvents) reasons.push(`budget-event-missed:${id}`);
  for (const id of degradedEvents) reasons.push(`budget-event-degraded:${id}`);

  const status = firstTokenMissed
    || staticOnlyRenderedCapBreached
    || missedEvents.length > 0
    ? FRAME_BUDGET_HEALTH.MISSED
    : reasons.length > 0
      ? FRAME_BUDGET_HEALTH.DEGRADED
      : FRAME_BUDGET_HEALTH.HEALTHY;

  return {
    status,
    pass: status === FRAME_BUDGET_HEALTH.HEALTHY,
    reasons,
    firstTokenMissed,
    promptTokenGrowth,
    staticOnlyRenderedCapBreached,
    missedEvents,
    degradedEvents,
  };
}

function sumKeyedNumbers(receipts, section, keys) {
  const totals = {};
  for (const key of keys) totals[key] = 0;
  for (const receipt of receipts) {
    for (const key of keys) {
      const value = finiteNumberOrNull(receipt?.[section]?.[key]);
      if (value !== null) totals[key] += value;
    }
  }
  return totals;
}

function maxNullable(values) {
  const finite = values
    .map(finiteNumberOrNull)
    .filter((value) => value !== null);
  if (finite.length === 0) return null;
  return Math.max(...finite);
}

function summarizeFrameBudget(receipts = []) {
  const normalizedReceipts = Array.isArray(receipts)
    ? receipts.map(normalizeFrameBudgetReceipt)
    : [];
  const healthResults = normalizedReceipts.map(classifyFrameBudgetHealth);
  const eventStatusCounts = Object.fromEntries(
    Object.values(FRAME_BUDGET_EVENT_STATUSES).map((status) => [status, 0]),
  );
  for (const receipt of normalizedReceipts) {
    for (const event of receipt.budgetEvents) {
      eventStatusCounts[event.status] = (eventStatusCounts[event.status] || 0) + 1;
    }
  }
  return {
    schema: FRAME_BUDGET_SUMMARY_SCHEMA,
    receiptCount: normalizedReceipts.length,
    healthCounts: {
      healthy: healthResults.filter((item) => item.status === FRAME_BUDGET_HEALTH.HEALTHY).length,
      degraded: healthResults.filter((item) => item.status === FRAME_BUDGET_HEALTH.DEGRADED).length,
      missed: healthResults.filter((item) => item.status === FRAME_BUDGET_HEALTH.MISSED).length,
    },
    pass: normalizedReceipts.length > 0 && healthResults.every((item) => item.pass),
    eventStatusCounts,
    workDoneTotals: sumKeyedNumbers(normalizedReceipts, 'workDone', FRAME_BUDGET_WORK_KEYS),
    maxPromptTokenDelta: maxNullable(normalizedReceipts.map((receipt) => receipt.quality.promptTokenDelta)),
    maxFirstTokenMs: maxNullable(normalizedReceipts.map((receipt) => receipt.timings.lmStudioFirstTokenMs)),
    maxTotalPrePromptMs: maxNullable(normalizedReceipts.map((receipt) => receipt.timings.totalPrePromptMs)),
    reasons: [...new Set(healthResults.flatMap((item) => item.reasons))],
    limits: [...FRAME_BUDGET_LIMITS],
  };
}

module.exports = {
  PENNY_FRAME_BUDGET_SCHEMA,
  FRAME_BUDGET_EVENT_STATUSES,
  createFrameBudgetReceipt,
  normalizeFrameBudgetReceipt,
  addFrameTiming,
  addFrameWorkCount,
  addFrameBudgetEvent,
  summarizeFrameBudget,
  classifyFrameBudgetHealth,
};
