const {
  FRAME_BUDGET_SIDECAR_SPEND_CLASSES,
  FRAME_BUDGET_SIDECAR_STATUSES,
  buildFrameBudgetSidecarReceipt,
} = require('./penny-frame-budget');
const {
  buildSessionReflectionPrepJob,
} = require('./penny-session-reflection');

const PENNY_BACKGROUND_FRAME_QUEUE_SCHEMA = 'penny-background-frame-queue.v1';
const PENNY_BACKGROUND_FRAME_JOB_SCHEMA = 'penny-background-frame-job.v1';

const BACKGROUND_FRAME_JOB_KINDS = Object.freeze({
  STATIC_INDEX_UPDATE: 'static-index-update',
  OPEN_LOOP_REFRESH: 'open-loop-refresh',
  SESSION_REFLECTION_PREP: 'session-reflection-prep',
  MEMORY_LINK_REFRESH: 'memory-link-refresh',
  PULSE_CARD_PREP: 'pulse-card-prep',
  ARTIFACT_SUMMARY: 'artifact-summary',
});

const BACKGROUND_FRAME_JOB_STATUSES = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  DEDUPED: 'deduped',
  MISSED: 'missed',
  FAILED: 'failed',
});

const DEFAULT_JOB_PRIORITIES = Object.freeze({
  [BACKGROUND_FRAME_JOB_KINDS.OPEN_LOOP_REFRESH]: 70,
  [BACKGROUND_FRAME_JOB_KINDS.STATIC_INDEX_UPDATE]: 60,
  [BACKGROUND_FRAME_JOB_KINDS.SESSION_REFLECTION_PREP]: 50,
  [BACKGROUND_FRAME_JOB_KINDS.MEMORY_LINK_REFRESH]: 45,
  [BACKGROUND_FRAME_JOB_KINDS.PULSE_CARD_PREP]: 40,
  [BACKGROUND_FRAME_JOB_KINDS.ARTIFACT_SUMMARY]: 30,
});

const BACKGROUND_FRAME_LIMITS = Object.freeze([
  'Background frame receipts describe local queue/runtime shape; they do not prove answer quality.',
  'Background jobs are bounded and local-only; approval-required side effects are skipped.',
  'Background work must not expand PromptTruth, merge toolEvidenceReceipt, or raise prompt/rendered-memory limits.',
  'Skipped, deduped, missed, and failed jobs must not be described as completed work.',
]);

const KIND_VALUES = new Set(Object.values(BACKGROUND_FRAME_JOB_KINDS));
const STATUS_VALUES = new Set(Object.values(BACKGROUND_FRAME_JOB_STATUSES));
const TIMEOUT_SENTINEL = Symbol('penny-background-frame-timeout');

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

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function finiteNonNegativeNumberOrNull(value) {
  const num = finiteNumberOrNull(value);
  if (num === null || num < 0) return null;
  return num;
}

function normalizeCount(value) {
  const num = finiteNonNegativeNumberOrNull(value);
  if (num === null) return 0;
  return Math.floor(num);
}

function normalizeJobKind(value = '') {
  const kind = cleanToken(value, '');
  return KIND_VALUES.has(kind) ? kind : '';
}

function normalizeJobStatus(value = '') {
  const status = cleanToken(value, '');
  return STATUS_VALUES.has(status) ? status : BACKGROUND_FRAME_JOB_STATUSES.SKIPPED;
}

function normalizePriority(value, kind) {
  const num = finiteNumberOrNull(value);
  if (num !== null) return num;
  return DEFAULT_JOB_PRIORITIES[kind] ?? 0;
}

function clampDeadlineMs(value, {
  defaultDeadlineMs = 100,
  maxDeadlineMs = 2000,
} = {}) {
  const fallback = finiteNonNegativeNumberOrNull(defaultDeadlineMs) ?? 100;
  const max = Math.max(1, finiteNonNegativeNumberOrNull(maxDeadlineMs) ?? 2000);
  const raw = finiteNonNegativeNumberOrNull(value);
  const deadlineMs = raw === null ? fallback : raw;
  return {
    deadlineMs: Math.min(deadlineMs, max),
    deadlineClamped: deadlineMs > max,
  };
}

function isoFromMs(ms) {
  const num = finiteNonNegativeNumberOrNull(ms);
  if (num === null) return '';
  const date = new Date(num);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function summarizeJobResult(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return {
      type: 'string',
      preview: cleanString(value, 240),
    };
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return {
      type: typeof value,
      value,
    };
  }
  if (Array.isArray(value)) {
    return {
      type: 'array',
      count: value.length,
    };
  }
  if (!isPlainObject(value)) {
    return {
      type: typeof value,
      preview: cleanString(value, 160),
    };
  }

  const scalar = {};
  for (const key of [
    'schema',
    'artifactKind',
    'id',
    'status',
    'reason',
    'artifactPath',
    'sessionId',
    'sourceTurnCount',
    'candidateCount',
    'memorySuggestionCount',
    'doNotSaveCount',
    'updatedCount',
    'createdCount',
    'skippedCount',
    'queuedCount',
    'validationValid',
    'reflectionPrepared',
    'memoryWrites',
    'explicitMemoryWrites',
    'canonicalMemoryWrites',
    'promptTruthExpanded',
    'toolEvidenceReceiptChanged',
    'hiddenChainOfThoughtStored',
    'runtimeVoiceChanged',
  ]) {
    const raw = value[key];
    if (typeof raw === 'string') scalar[key] = cleanString(raw, 180);
    if (typeof raw === 'number' && Number.isFinite(raw)) scalar[key] = raw;
    if (typeof raw === 'boolean') scalar[key] = raw;
  }

  return {
    type: 'object',
    keys: Object.keys(value).slice(0, 8),
    ...scalar,
  };
}

function jobStatusToSidecarStatus(status) {
  const normalized = normalizeJobStatus(status);
  if (normalized === BACKGROUND_FRAME_JOB_STATUSES.MISSED) return FRAME_BUDGET_SIDECAR_STATUSES.MISSED;
  if (normalized === BACKGROUND_FRAME_JOB_STATUSES.FAILED) return FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED;
  if (
    normalized === BACKGROUND_FRAME_JOB_STATUSES.SKIPPED
    || normalized === BACKGROUND_FRAME_JOB_STATUSES.DEDUPED
  ) {
    return FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED;
  }
  return FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED;
}

function buildJobFrameBudgetSidecar(job = {}, receipt = {}) {
  return buildFrameBudgetSidecarReceipt({
    id: `background-${job.id || 'job'}`,
    label: `Background frame: ${job.label || job.kind || job.id || 'job'}`,
    spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.BACKGROUND,
    status: jobStatusToSidecarStatus(receipt.status),
    budgetMs: job.deadlineMs,
    actualMs: receipt.actualMs,
    candidateCount: receipt.candidateCount,
    selectedCount: 0,
    renderedCount: 0,
    sourceAuthority: 'advisory',
    reason: receipt.reason,
    fallback: receipt.fallback,
    skipped: receipt.status === BACKGROUND_FRAME_JOB_STATUSES.SKIPPED
      || receipt.status === BACKGROUND_FRAME_JOB_STATUSES.DEDUPED,
    errored: receipt.status === BACKGROUND_FRAME_JOB_STATUSES.FAILED,
    fallbackUsed: receipt.status === BACKGROUND_FRAME_JOB_STATUSES.MISSED
      || receipt.status === BACKGROUND_FRAME_JOB_STATUSES.FAILED,
  });
}

function buildJobReceipt(job = {}, status = BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, fields = {}) {
  const normalizedStatus = normalizeJobStatus(status);
  const runAttempted = fields.runAttempted === true;
  const completionClaimed = normalizedStatus === BACKGROUND_FRAME_JOB_STATUSES.COMPLETED && runAttempted;
  const reason = cleanString(fields.reason || '', 180);
  const fallback = cleanString(fields.fallback || '', 180);
  const receipt = {
    schema: PENNY_BACKGROUND_FRAME_JOB_SCHEMA,
    id: cleanToken(job.id || fields.id || 'background-job', 'background-job'),
    kind: normalizeJobKind(job.kind) || cleanToken(job.kind || 'unsupported', 'unsupported'),
    label: cleanString(job.label || job.id || fields.id || 'Background job', 160),
    priority: normalizePriority(job.priority, normalizeJobKind(job.kind)),
    dedupeKey: cleanString(job.dedupeKey || '', 180),
    status: normalizedStatus,
    localOnly: true,
    bounded: true,
    queuedAt: cleanString(fields.queuedAt || job.queuedAt || '') || null,
    startedAt: cleanString(fields.startedAt || '') || null,
    finishedAt: cleanString(fields.finishedAt || '') || null,
    deadlineMs: finiteNonNegativeNumberOrNull(job.deadlineMs) ?? 0,
    deadlineClamped: job.deadlineClamped === true,
    actualMs: finiteNonNegativeNumberOrNull(fields.actualMs) ?? 0,
    runAttempted,
    completionClaimed,
    reason,
    fallback,
    error: cleanString(fields.error || '', 220),
    existingJobId: cleanString(fields.existingJobId || '', 120),
    resultSummary: fields.resultSummary || null,
    candidateCount: normalizeCount(fields.candidateCount),
    guardrails: {
      localOnly: true,
      approvalRequiredJobsSkipped: true,
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      runtimeVoiceChanged: false,
      defaultPromptLimitsRaised: false,
      defaultRenderedMemoryLimitsRaised: false,
      completionRequiresRun: true,
      answerQualityProof: false,
    },
  };
  receipt.frameBudgetSidecar = buildJobFrameBudgetSidecar(job, receipt);
  return receipt;
}

function normalizeBackgroundFrameJob(raw = {}, index = 0, options = {}) {
  const job = isPlainObject(raw) ? raw : {};
  const kind = normalizeJobKind(job.kind);
  const { deadlineMs, deadlineClamped } = clampDeadlineMs(job.deadlineMs, options);
  const id = cleanToken(job.id || job.name || (kind ? `${kind}-${index + 1}` : `background-job-${index + 1}`));
  return {
    id: id || `background-job-${index + 1}`,
    kind,
    label: cleanString(job.label || job.name || job.id || id || 'Background job', 160),
    priority: normalizePriority(job.priority, kind),
    dedupeKey: cleanString(job.dedupeKey || job.key || (kind && id ? `${kind}:${id}` : ''), 180),
    deadlineMs,
    deadlineClamped,
    queuedAt: cleanString(job.queuedAt || '') || null,
    run: typeof job.run === 'function' ? job.run : null,
    localOnly: job.localOnly !== false,
    requiresApproval: job.requiresApproval === true
      || job.approvalRequired === true
      || job.requiresExternalApproval === true
      || job.sideEffectRequiresApproval === true,
    candidateCount: normalizeCount(job.candidateCount),
    fallback: cleanString(job.fallback || '', 180),
    originalOrder: index,
  };
}

function compareQueuedJobs(left, right) {
  if (left.priority !== right.priority) return right.priority - left.priority;
  return left.originalOrder - right.originalOrder;
}

function countStatuses(receipts = []) {
  const counts = Object.fromEntries(
    Object.values(BACKGROUND_FRAME_JOB_STATUSES).map((status) => [status, 0]),
  );
  for (const receipt of receipts) {
    const status = normalizeJobStatus(receipt?.status);
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

function buildQueueSummary({
  generatedAt = '',
  status = 'idle',
  pending = [],
  running = new Map(),
  recentReceipts = [],
  drainReceipts = [],
  queuedBeforeCount = 0,
  maxQueuedJobs = 50,
  maxJobsPerDrain = 10,
} = {}) {
  const statusCounts = countStatuses(drainReceipts);
  return {
    schema: PENNY_BACKGROUND_FRAME_QUEUE_SCHEMA,
    generatedAt: cleanString(generatedAt || '') || null,
    status: cleanToken(status, 'idle'),
    localOnly: true,
    pendingCount: pending.length,
    runningCount: running.size,
    queuedBeforeCount: normalizeCount(queuedBeforeCount),
    drainedCount: drainReceipts.length,
    runAttemptedCount: drainReceipts.filter((receipt) => receipt.runAttempted === true).length,
    completedCount: statusCounts.completed || 0,
    skippedCount: statusCounts.skipped || 0,
    dedupedCount: statusCounts.deduped || 0,
    missedCount: statusCounts.missed || 0,
    failedCount: statusCounts.failed || 0,
    maxQueuedJobs,
    maxJobsPerDrain,
    receipts: drainReceipts,
    recentReceipts: recentReceipts.slice(-20),
    guardrails: {
      localOnly: true,
      bounded: true,
      approvalRequiredJobsSkipped: true,
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      runtimeVoiceChanged: false,
      defaultPromptLimitsRaised: false,
      defaultRenderedMemoryLimitsRaised: false,
      answerQualityProof: false,
    },
    limits: [...BACKGROUND_FRAME_LIMITS],
  };
}

function createBackgroundFrameQueue({
  defaultDeadlineMs = 100,
  maxDeadlineMs = 2000,
  maxQueuedJobs = 50,
  maxJobsPerDrain = 10,
  nowMs = () => Date.now(),
  scheduleTask = (fn, delayMs = 0) => setTimeout(fn, delayMs),
  logger = console,
} = {}) {
  const pending = [];
  const running = new Map();
  const dedupeIndex = new Map();
  const recentReceipts = [];
  let enqueueCounter = 0;
  let draining = false;

  const queueOptions = {
    defaultDeadlineMs,
    maxDeadlineMs,
  };
  const normalizedMaxQueuedJobs = Math.max(1, normalizeCount(maxQueuedJobs) || 50);
  const normalizedMaxJobsPerDrain = Math.max(1, normalizeCount(maxJobsPerDrain) || 10);

  function pushReceipt(receipt) {
    recentReceipts.push(receipt);
    if (recentReceipts.length > 50) recentReceipts.splice(0, recentReceipts.length - 50);
    return receipt;
  }

  function getGeneratedAt() {
    return isoFromMs(nowMs());
  }

  function queueBackgroundFrameJob(rawJob = {}) {
    const job = normalizeBackgroundFrameJob(rawJob, enqueueCounter, queueOptions);
    job.queuedAt = job.queuedAt || getGeneratedAt();
    job.originalOrder = enqueueCounter;
    enqueueCounter += 1;

    if (!job.kind) {
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, {
        queuedAt: job.queuedAt,
        reason: 'unsupported-background-job-kind',
        fallback: 'Unsupported background job was not queued.',
      }));
    }
    if (!job.localOnly) {
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, {
        queuedAt: job.queuedAt,
        reason: 'non-local-background-job',
        fallback: 'Only local background jobs are allowed in the background frame.',
      }));
    }
    if (job.requiresApproval) {
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, {
        queuedAt: job.queuedAt,
        reason: 'approval-required-side-effect',
        fallback: 'Approval-required side effects are not run by the background frame.',
      }));
    }
    if (!job.run) {
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, {
        queuedAt: job.queuedAt,
        reason: 'missing-background-runner',
        fallback: 'Background job had no run function.',
      }));
    }
    if (job.deadlineMs <= 0) {
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, {
        queuedAt: job.queuedAt,
        reason: 'deadline-zero',
        fallback: 'Background job had no runtime budget.',
      }));
    }
    if (job.dedupeKey && dedupeIndex.has(job.dedupeKey)) {
      const existing = dedupeIndex.get(job.dedupeKey);
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.DEDUPED, {
        queuedAt: job.queuedAt,
        reason: 'dedupe-key-active',
        fallback: 'Existing background job already covers this work.',
        existingJobId: existing?.id || '',
      }));
    }
    if (pending.length >= normalizedMaxQueuedJobs) {
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED, {
        queuedAt: job.queuedAt,
        reason: 'background-queue-full',
        fallback: 'Queue cap held back optional background work.',
      }));
    }

    pending.push(job);
    if (job.dedupeKey) dedupeIndex.set(job.dedupeKey, job);
    return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.QUEUED, {
      queuedAt: job.queuedAt,
      reason: 'queued',
      candidateCount: job.candidateCount,
    }));
  }

  function queueSessionReflectionPrepJob(options = {}) {
    return queueBackgroundFrameJob(buildSessionReflectionPrepJob(options));
  }

  function takeNextJob() {
    if (!pending.length) return null;
    let bestIndex = 0;
    for (let index = 1; index < pending.length; index += 1) {
      if (compareQueuedJobs(pending[index], pending[bestIndex]) < 0) bestIndex = index;
    }
    return pending.splice(bestIndex, 1)[0] || null;
  }

  async function runQueuedJob(job) {
    const startedMs = nowMs();
    const startedAt = isoFromMs(startedMs);
    running.set(job.id, job);

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    let timeoutHandle = null;
    let timedOut = false;

    const runPromise = Promise.resolve()
      .then(() => job.run({
        id: job.id,
        kind: job.kind,
        dedupeKey: job.dedupeKey,
        deadlineMs: job.deadlineMs,
        signal: controller?.signal || null,
        queuedAt: job.queuedAt,
        startedAt,
        nowMs,
      }));
    const timeoutPromise = new Promise((resolve) => {
      timeoutHandle = scheduleTask(() => {
        timedOut = true;
        resolve(TIMEOUT_SENTINEL);
        try {
          if (controller && !controller.signal.aborted) controller.abort();
        } catch {}
      }, job.deadlineMs);
      if (timeoutHandle && typeof timeoutHandle.unref === 'function') timeoutHandle.unref();
    });

    try {
      const result = await Promise.race([runPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const finishedMs = nowMs();
      if (result === TIMEOUT_SENTINEL || timedOut) {
        return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.MISSED, {
          queuedAt: job.queuedAt,
          startedAt,
          finishedAt: isoFromMs(finishedMs),
          actualMs: Math.max(0, finishedMs - startedMs),
          runAttempted: true,
          reason: 'background-job-deadline-missed',
          fallback: job.fallback || 'Do not infer completion from a missed background job.',
          candidateCount: job.candidateCount,
        }));
      }
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.COMPLETED, {
        queuedAt: job.queuedAt,
        startedAt,
        finishedAt: isoFromMs(finishedMs),
        actualMs: Math.max(0, finishedMs - startedMs),
        runAttempted: true,
        reason: 'completed',
        resultSummary: summarizeJobResult(result),
        candidateCount: job.candidateCount,
      }));
    } catch (error) {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      const finishedMs = nowMs();
      return pushReceipt(buildJobReceipt(job, BACKGROUND_FRAME_JOB_STATUSES.FAILED, {
        queuedAt: job.queuedAt,
        startedAt,
        finishedAt: isoFromMs(finishedMs),
        actualMs: Math.max(0, finishedMs - startedMs),
        runAttempted: true,
        reason: 'background-job-failed',
        fallback: job.fallback || 'Do not infer completion from a failed background job.',
        error: String(error?.message || error || 'background-job-failed'),
        candidateCount: job.candidateCount,
      }));
    } finally {
      running.delete(job.id);
      if (job.dedupeKey && dedupeIndex.get(job.dedupeKey)?.id === job.id) {
        dedupeIndex.delete(job.dedupeKey);
      }
    }
  }

  async function drainBackgroundFrameQueue({ limit = 0 } = {}) {
    if (draining) {
      return buildQueueSummary({
        generatedAt: getGeneratedAt(),
        status: 'already-draining',
        pending,
        running,
        recentReceipts,
        maxQueuedJobs: normalizedMaxQueuedJobs,
        maxJobsPerDrain: normalizedMaxJobsPerDrain,
      });
    }

    draining = true;
    const queuedBeforeCount = pending.length;
    const requestedLimit = normalizeCount(limit);
    const drainLimit = requestedLimit > 0
      ? Math.min(requestedLimit, normalizedMaxJobsPerDrain)
      : normalizedMaxJobsPerDrain;
    const drainReceipts = [];

    try {
      while (pending.length && drainReceipts.length < drainLimit) {
        const job = takeNextJob();
        if (!job) break;
        drainReceipts.push(await runQueuedJob(job));
      }
    } finally {
      draining = false;
    }

    return buildQueueSummary({
      generatedAt: getGeneratedAt(),
      status: 'drained',
      pending,
      running,
      recentReceipts,
      drainReceipts,
      queuedBeforeCount,
      maxQueuedJobs: normalizedMaxQueuedJobs,
      maxJobsPerDrain: normalizedMaxJobsPerDrain,
    });
  }

  function getBackgroundFrameQueueSnapshot() {
    return buildQueueSummary({
      generatedAt: getGeneratedAt(),
      status: draining ? 'draining' : 'idle',
      pending,
      running,
      recentReceipts,
      maxQueuedJobs: normalizedMaxQueuedJobs,
      maxJobsPerDrain: normalizedMaxJobsPerDrain,
    });
  }

  function clearBackgroundFrameQueue() {
    pending.splice(0, pending.length);
    running.clear();
    dedupeIndex.clear();
    recentReceipts.splice(0, recentReceipts.length);
    return getBackgroundFrameQueueSnapshot();
  }

  return {
    queueBackgroundFrameJob,
    queueSessionReflectionPrepJob,
    drainBackgroundFrameQueue,
    getBackgroundFrameQueueSnapshot,
    clearBackgroundFrameQueue,
  };
}

const defaultBackgroundFrameQueue = createBackgroundFrameQueue();

function queueBackgroundFrameJob(job = {}) {
  return defaultBackgroundFrameQueue.queueBackgroundFrameJob(job);
}

function queueSessionReflectionPrepJob(options = {}) {
  return defaultBackgroundFrameQueue.queueSessionReflectionPrepJob(options);
}

function drainBackgroundFrameQueue(options = {}) {
  return defaultBackgroundFrameQueue.drainBackgroundFrameQueue(options);
}

function getBackgroundFrameQueueSnapshot() {
  return defaultBackgroundFrameQueue.getBackgroundFrameQueueSnapshot();
}

function clearBackgroundFrameQueue() {
  return defaultBackgroundFrameQueue.clearBackgroundFrameQueue();
}

module.exports = {
  PENNY_BACKGROUND_FRAME_QUEUE_SCHEMA,
  PENNY_BACKGROUND_FRAME_JOB_SCHEMA,
  BACKGROUND_FRAME_JOB_KINDS,
  BACKGROUND_FRAME_JOB_STATUSES,
  createBackgroundFrameQueue,
  queueBackgroundFrameJob,
  queueSessionReflectionPrepJob,
  drainBackgroundFrameQueue,
  getBackgroundFrameQueueSnapshot,
  clearBackgroundFrameQueue,
};
