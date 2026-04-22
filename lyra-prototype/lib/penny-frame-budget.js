const PENNY_FRAME_BUDGET_SCHEMA = 'penny-frame-budget.v1';

const FRAME_BUDGET_SUMMARY_SCHEMA = 'penny-frame-budget-summary.v1';

const FRAME_BUDGET_SIDECAR_SCHEDULE_SCHEMA = 'penny-frame-budget-sidecar-schedule.v1';

const FRAME_BUDGET_SIDECAR_SCHEMA = 'penny-frame-budget-sidecar.v1';

const FRAME_BUDGET_CANDIDATE_MERGE_SCHEMA = 'penny-frame-budget-candidate-merge.v1';

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

const FRAME_BUDGET_SIDECAR_STATUSES = Object.freeze({
  SCHEDULED: 'scheduled',
  DEGRADED: 'degraded',
  SKIPPED: 'skipped',
  MISSED: 'missed',
});

const FRAME_BUDGET_SIDECAR_SPEND_CLASSES = Object.freeze({
  RELEVANCE: 'relevance',
  SOURCE_AUTHORITY: 'source-authority',
  CANDIDATE_SELECTION: 'candidate-selection',
  RENDERED_CONTEXT: 'rendered-context',
  BACKGROUND: 'background',
});

const FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS = Object.freeze({
  TURN_STATE: 10,
  STATIC_MEMORY_QUERY: 40,
  OPEN_LOOP_RELEVANCE: 20,
  EXACT_ANCHORS: 5,
  CANDIDATE_MERGE: 25,
});

const SIDECAR_SPEND_CLASS_RANK = Object.freeze({
  [FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RELEVANCE]: 0,
  [FRAME_BUDGET_SIDECAR_SPEND_CLASSES.SOURCE_AUTHORITY]: 1,
  [FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION]: 2,
  [FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RENDERED_CONTEXT]: 3,
  [FRAME_BUDGET_SIDECAR_SPEND_CLASSES.BACKGROUND]: 4,
});

const FRAME_BUDGET_LIMITS = Object.freeze([
  'Frame budget receipts measure runtime shape; they do not prove answer quality by themselves.',
  'Faster runtime should improve pre-prompt selection before increasing rendered context.',
  'This artifact is not PromptTruth and does not expand memory authority.',
]);

const FRAME_BUDGET_SIDECAR_LIMITS = Object.freeze([
  'Sidecar schedules are fixture/runtime-shape receipts; they do not prove answer quality.',
  'Deadline pressure spends first on relevance, source authority, and candidate selection.',
  'Optional rendered-context sidecars should be skipped before raising prompt or memory limits.',
  'This schedule does not expand PromptTruth or merge toolEvidenceReceipt into PromptTruth.',
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
  'archiveRetrievalMs',
  'candidateMergeMs',
  'authorityGateMs',
  'promptBuildMs',
  'lmStudioFirstTokenMs',
  'lmStudioTotalMs',
  'modelRoundTripMs',
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
  'estimatedPromptTokens',
  'estimatedRequestMessageTokens',
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

function normalizeSidecarSpendClass(value = '') {
  const token = cleanToken(value, '');
  if (Object.values(FRAME_BUDGET_SIDECAR_SPEND_CLASSES).includes(token)) return token;
  if (/^(source|authority|source-check|source-checking|verification|verify)$/.test(token)) {
    return FRAME_BUDGET_SIDECAR_SPEND_CLASSES.SOURCE_AUTHORITY;
  }
  if (/^(candidate|candidate-selection|selection|memory-selection|static-memory)$/.test(token)) {
    return FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION;
  }
  if (/^(render|rendered|rendered-context|prompt-context|more-context|memory-render)$/.test(token)) {
    return FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RENDERED_CONTEXT;
  }
  if (/^(background|post-turn|prewarm|async)$/.test(token)) {
    return FRAME_BUDGET_SIDECAR_SPEND_CLASSES.BACKGROUND;
  }
  return FRAME_BUDGET_SIDECAR_SPEND_CLASSES.RELEVANCE;
}

function defaultSidecarPriority(spendClass) {
  const rank = SIDECAR_SPEND_CLASS_RANK[spendClass];
  if (!Number.isFinite(rank)) return 0;
  return Math.max(0, 100 - (rank * 20));
}

function normalizeSidecarTask(task = {}, index = 0) {
  const raw = isPlainObject(task) ? task : {};
  const spendClass = normalizeSidecarSpendClass(raw.spendClass || raw.category || raw.kind || '');
  const estimatedMs = finiteNonNegativeNumberOrNull(raw.estimatedMs ?? raw.actualMs ?? raw.budgetMs) ?? 0;
  const budgetMs = finiteNonNegativeNumberOrNull(raw.budgetMs) ?? estimatedMs;
  const minBudgetMs = finiteNonNegativeNumberOrNull(raw.minBudgetMs) ?? 0;
  const explicitPriority = finiteNumberOrNull(raw.priority);
  const required = raw.required === true;
  const optional = raw.optional === true || (!required && raw.optional !== false);
  return {
    id: cleanToken(raw.id || raw.name || `sidecar-${index + 1}`, `sidecar-${index + 1}`),
    label: cleanString(raw.label || raw.name || raw.id || `Sidecar ${index + 1}`, 160),
    spendClass,
    priority: explicitPriority === null ? defaultSidecarPriority(spendClass) : explicitPriority,
    required,
    optional,
    enabled: raw.enabled !== false,
    canDegrade: raw.canDegrade === true || required,
    budgetMs,
    estimatedMs,
    minBudgetMs,
    promptImpact: cleanToken(raw.promptImpact || 'none', 'none'),
    sourceAuthority: cleanToken(raw.sourceAuthority || raw.authority || 'advisory', 'advisory'),
    fallback: cleanString(raw.fallback || '', 180),
    reason: cleanString(raw.reason || '', 180),
    originalOrder: index,
  };
}

function sidecarRank(task = {}) {
  const rank = SIDECAR_SPEND_CLASS_RANK[task.spendClass];
  return Number.isFinite(rank) ? rank : 99;
}

function compareSidecarTasks(left, right) {
  const leftRank = sidecarRank(left);
  const rightRank = sidecarRank(right);
  if (leftRank !== rightRank) return leftRank - rightRank;
  if (left.required !== right.required) return left.required ? -1 : 1;
  if (left.priority !== right.priority) return right.priority - left.priority;
  return left.originalOrder - right.originalOrder;
}

function statusToBudgetEventStatus(status) {
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED) return FRAME_BUDGET_EVENT_STATUSES.MET;
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED) return FRAME_BUDGET_EVENT_STATUSES.DEGRADED;
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.MISSED) return FRAME_BUDGET_EVENT_STATUSES.MISSED;
  return FRAME_BUDGET_EVENT_STATUSES.SKIPPED;
}

function normalizeSidecarStatus(value = '') {
  const status = cleanToken(value);
  return Object.values(FRAME_BUDGET_SIDECAR_STATUSES).includes(status) ? status : '';
}

function sidecarDecisionToBudgetEvent(decision = {}) {
  return normalizeBudgetEvent({
    id: `${decision.id || 'sidecar'}-deadline`,
    status: statusToBudgetEventStatus(decision.status),
    budgetMs: decision.budgetMs,
    actualMs: decision.reservedMs,
    fallback: decision.fallback,
    reason: decision.deadlineReason || decision.reason,
  });
}

function sidecarStatusFromRuntime({
  enabled = true,
  skipped = false,
  errored = false,
  budgetMs = 0,
  actualMs = 0,
  required = false,
  fallbackUsed = false,
} = {}) {
  if (enabled === false || skipped === true) return FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED;
  if (errored === true || fallbackUsed === true) return required
    ? FRAME_BUDGET_SIDECAR_STATUSES.MISSED
    : FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED;
  if (budgetMs > 0 && actualMs > budgetMs) return required
    ? FRAME_BUDGET_SIDECAR_STATUSES.MISSED
    : FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED;
  return FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED;
}

function defaultReasonForSidecarStatus(status = '', {
  enabled = true,
  skipped = false,
  errored = false,
  actualMs = 0,
  budgetMs = 0,
} = {}) {
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED) {
    if (enabled === false) return 'sidecar-disabled';
    if (skipped === true) return 'sidecar-skipped';
    return 'not-run';
  }
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.MISSED) {
    if (errored === true) return 'required-sidecar-error';
    return 'required-sidecar-missed-deadline';
  }
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED) {
    if (errored === true) return 'sidecar-error';
    if (budgetMs > 0 && actualMs > budgetMs) return 'sidecar-over-budget';
    return 'sidecar-degraded';
  }
  return 'within-budget';
}

function defaultFallbackForSidecarStatus(status = '') {
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.MISSED) {
    return 'Do not infer sidecar result from missing runtime evidence.';
  }
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED) {
    return 'Use bounded sidecar output and keep prompt/rendered limits unchanged.';
  }
  if (status === FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED) {
    return 'Hold back optional sidecar output for this frame.';
  }
  return '';
}

function normalizeFrameBudgetSidecarReceipt(sidecarLike = {}) {
  const raw = isPlainObject(sidecarLike) ? sidecarLike : {};
  const budgetMs = finiteNonNegativeNumberOrNull(raw.budgetMs) ?? 0;
  const actualMs = finiteNonNegativeNumberOrNull(raw.actualMs ?? raw.durationMs ?? raw.queryMs) ?? 0;
  const enabled = raw.enabled !== false;
  const skipped = raw.skipped === true;
  const errored = raw.errored === true || !!String(raw.error || '').trim();
  const required = raw.required === true;
  const fallbackUsed = raw.fallbackUsed === true;
  const status = normalizeSidecarStatus(raw.status) || sidecarStatusFromRuntime({
    enabled,
    skipped,
    errored,
    budgetMs,
    actualMs,
    required,
    fallbackUsed,
  });
  const reason = cleanString(
    raw.reason
      || raw.deadlineReason
      || defaultReasonForSidecarStatus(status, { enabled, skipped, errored, actualMs, budgetMs }),
    180,
  );
  return {
    schema: FRAME_BUDGET_SIDECAR_SCHEMA,
    id: cleanToken(raw.id || raw.name || 'sidecar', 'sidecar'),
    label: cleanString(raw.label || raw.name || raw.id || 'Sidecar', 160),
    spendClass: normalizeSidecarSpendClass(raw.spendClass || raw.category || raw.kind || ''),
    status,
    enabled,
    skipped: skipped || status === FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED,
    budgetMs,
    actualMs,
    candidateCount: normalizeCount(raw.candidateCount ?? raw.candidatesInspected),
    selectedCount: normalizeCount(raw.selectedCount ?? raw.candidatesSelected),
    renderedCount: normalizeCount(raw.renderedCount ?? raw.candidatesRendered),
    openLoopCount: normalizeCount(raw.openLoopCount ?? raw.openLoopsScored),
    fallbackUsed,
    fallback: cleanString(raw.fallback || defaultFallbackForSidecarStatus(status), 180),
    reason,
    sourceAuthority: cleanToken(raw.sourceAuthority || raw.authority || 'advisory', 'advisory'),
    promptLimitChanged: false,
    renderedLimitChanged: false,
    promptTruthExpanded: false,
    toolEvidenceReceiptChanged: false,
  };
}

function buildFrameBudgetSidecarReceipt(options = {}) {
  return normalizeFrameBudgetSidecarReceipt(options);
}

function frameBudgetSidecarToBudgetEvent(sidecarLike = {}) {
  const sidecar = normalizeFrameBudgetSidecarReceipt(sidecarLike);
  return normalizeBudgetEvent({
    id: `${sidecar.id || 'sidecar'}-deadline`,
    status: statusToBudgetEventStatus(sidecar.status),
    budgetMs: sidecar.budgetMs,
    actualMs: sidecar.actualMs,
    fallback: sidecar.fallback,
    reason: sidecar.reason,
  });
}

function countList(value = []) {
  return Array.isArray(value) ? value.length : normalizeCount(value);
}

function normalizeCandidateMergeBudgetConfig(options = {}) {
  const raw = isPlainObject(options) ? options : {};
  const candidateMergeBudgetMs = finiteNonNegativeNumberOrNull(
    raw.candidateMergeBudgetMs
      ?? raw.candidateBudgetMs
      ?? raw.budgetMs,
  ) ?? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.CANDIDATE_MERGE;
  const deadlineMs = finiteNonNegativeNumberOrNull(
    raw.prePromptBudgetMs
      ?? raw.deadlineMs
      ?? raw.totalBudgetMs,
  );
  const elapsedMs = finiteNonNegativeNumberOrNull(
    raw.prePromptElapsedMs
      ?? raw.elapsedMs,
  ) ?? 0;
  const remainingMs = deadlineMs === null
    ? candidateMergeBudgetMs
    : Math.max(0, deadlineMs - elapsedMs);
  const sourceSensitive = raw.sourceSensitive === true
    || raw.highRisk === true
    || raw.sourceSensitiveQuery === true
    || raw.querySourceSensitive === true;
  const authorityReserveMs = sourceSensitive
    ? Math.min(
      candidateMergeBudgetMs,
      finiteNonNegativeNumberOrNull(raw.authorityReserveMs)
        ?? FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS.EXACT_ANCHORS,
    )
    : 0;
  return {
    candidateMergeBudgetMs,
    deadlineMs,
    elapsedMs,
    remainingMs,
    sourceSensitive,
    authorityReserveMs,
  };
}

function normalizeStaticExpansionDecision({
  enabled = true,
  tight = false,
  exhausted = false,
  cachedStaticCandidateCount = 0,
  maxStaticCandidates = null,
} = {}) {
  const normalizedMax = finiteNonNegativeNumberOrNull(maxStaticCandidates);
  if (!enabled) {
    return {
      status: FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED,
      mode: 'disabled',
      reason: 'static-expansion-disabled',
      fallback: '',
      maxCandidates: 0,
      cachedCandidateCount: normalizeCount(cachedStaticCandidateCount),
    };
  }
  const cachedCount = normalizeCount(cachedStaticCandidateCount);
  if (tight || exhausted) {
    if (cachedCount > 0) {
      return {
        status: FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED,
        mode: 'cached-only',
        reason: 'pre-prompt-budget-tight',
        fallback: 'cached-static-candidates',
        maxCandidates: Math.max(1, Math.min(cachedCount, normalizeCount(normalizedMax ?? cachedCount) || cachedCount, 2)),
        cachedCandidateCount: cachedCount,
      };
    }
    return {
      status: FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED,
      mode: 'skipped',
      reason: 'pre-prompt-budget-exhausted',
      fallback: 'keyword+cached-candidates',
      maxCandidates: 0,
      cachedCandidateCount: 0,
    };
  }
  return {
    status: FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED,
    mode: 'full',
    reason: 'within-budget',
    fallback: '',
    maxCandidates: normalizedMax === null ? null : normalizeCount(normalizedMax),
    cachedCandidateCount: cachedCount,
  };
}

function buildCandidateMergeFrameBudgetPlan(options = {}) {
  const raw = isPlainObject(options) ? options : {};
  const {
    candidateMergeBudgetMs,
    deadlineMs,
    elapsedMs,
    remainingMs,
    sourceSensitive,
    authorityReserveMs,
  } = normalizeCandidateMergeBudgetConfig(raw);
  const tight = remainingMs < candidateMergeBudgetMs;
  const exhausted = deadlineMs !== null && remainingMs <= authorityReserveMs && tight;
  const staticExpansion = normalizeStaticExpansionDecision({
    enabled: raw.staticExpansionEnabled !== false,
    tight,
    exhausted,
    cachedStaticCandidateCount: raw.cachedStaticCandidateCount,
    maxStaticCandidates: raw.maxStaticCandidates,
  });
  const skipLowPriorityOpenLoops = tight;
  const candidateCount = normalizeCount(raw.candidateCount ?? raw.rawCandidatesInspected);
  const staticCandidateCount = normalizeCount(raw.staticCandidateCount ?? raw.staticCandidatesInspected);
  const openLoopCount = normalizeCount(raw.openLoopCount ?? raw.openLoopsScored);
  const selectedCount = normalizeCount(raw.selectedCount ?? raw.candidatesSelected);
  const renderedCount = normalizeCount(raw.renderedCount ?? raw.candidatesRendered);
  const staleCandidatesBlocked = normalizeCount(raw.staleCandidatesBlocked);
  const sourceChecksRun = normalizeCount(raw.sourceChecksRun);
  const actualMs = finiteNonNegativeNumberOrNull(raw.actualMs ?? raw.candidateMergeMs) ?? 0;
  const status = exhausted || tight
    ? FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED
    : FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED;
  const reason = exhausted
    ? 'pre-prompt-budget-exhausted'
    : (tight
      ? 'pre-prompt-budget-tight'
      : (sourceSensitive ? 'source-sensitive-authority-reserve' : 'within-budget'));
  const fallback = tight
    ? (staticExpansion.fallback || 'keyword+cached-candidates')
    : '';
  return {
    schema: FRAME_BUDGET_CANDIDATE_MERGE_SCHEMA,
    status,
    reason,
    fallback,
    deadlineMs,
    elapsedMs,
    remainingBeforeMs: remainingMs,
    budgetMs: candidateMergeBudgetMs,
    actualMs,
    tight,
    exhausted,
    sourceSensitive,
    authorityReserveMs,
    staticExpansion,
    openLoops: {
      skipLowPriority: skipLowPriorityOpenLoops,
      originalCount: countList(raw.openLoopOriginalCount ?? raw.openLoopCount ?? raw.openLoopsScored),
      scoredCount: openLoopCount,
      skippedLowPriorityCount: normalizeCount(raw.skippedLowPriorityOpenLoopCount),
    },
    workDone: {
      rawCandidatesInspected: candidateCount,
      staticCandidatesInspected: staticCandidateCount,
      openLoopsScored: openLoopCount,
      candidatesSelected: selectedCount,
      candidatesRendered: renderedCount,
      staleCandidatesBlocked,
      sourceChecksRun,
    },
    guardrails: {
      explicitMemoryCanonicalityPreserved: true,
      sourceAuthorityChecksPreserved: true,
      correctionGatesPreserved: true,
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      promptLimitChanged: false,
      renderedLimitChanged: false,
      answerQualityProof: false,
    },
    frameBudgetSidecar: buildFrameBudgetSidecarReceipt({
      id: 'candidate-merge',
      label: 'Candidate merge',
      spendClass: FRAME_BUDGET_SIDECAR_SPEND_CLASSES.CANDIDATE_SELECTION,
      status,
      budgetMs: candidateMergeBudgetMs,
      actualMs,
      candidateCount,
      selectedCount,
      renderedCount,
      openLoopCount,
      sourceAuthority: sourceSensitive ? 'source-sensitive' : 'advisory',
      reason,
      fallback,
    }),
  };
}

function buildDeadlineAwareSidecarSchedule({
  generatedAt = new Date().toISOString(),
  measurementMode = 'fixture-only',
  deadlineMs = null,
  elapsedMs = 0,
  sidecars = [],
} = {}) {
  const normalizedDeadline = finiteNonNegativeNumberOrNull(deadlineMs) ?? 0;
  const normalizedElapsed = finiteNonNegativeNumberOrNull(elapsedMs) ?? 0;
  let remainingMs = Math.max(0, normalizedDeadline - normalizedElapsed);
  const normalizedSidecars = (Array.isArray(sidecars) ? sidecars : [])
    .map(normalizeSidecarTask)
    .sort(compareSidecarTasks);
  const decisions = [];

  for (const task of normalizedSidecars) {
    const remainingBeforeMs = remainingMs;
    let status = FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED;
    let reservedMs = 0;
    let deadlineReason = '';
    let fallback = task.fallback;

    if (!task.enabled) {
      deadlineReason = 'sidecar-disabled';
    } else if (task.estimatedMs <= remainingMs) {
      status = FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED;
      reservedMs = task.estimatedMs;
      remainingMs = Math.max(0, remainingMs - reservedMs);
      deadlineReason = 'within-deadline';
    } else if (task.canDegrade && remainingMs >= task.minBudgetMs && remainingMs > 0) {
      status = FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED;
      reservedMs = remainingMs;
      remainingMs = 0;
      deadlineReason = 'deadline-degraded';
      fallback = fallback || 'Use bounded fallback instead of full sidecar output.';
    } else if (task.required) {
      status = FRAME_BUDGET_SIDECAR_STATUSES.MISSED;
      deadlineReason = 'required-sidecar-missed-deadline';
      fallback = fallback || 'Do not infer sidecar result from missing runtime evidence.';
    } else {
      deadlineReason = 'deadline-skipped';
      fallback = fallback || 'Hold back optional sidecar output for this frame.';
    }

    decisions.push({
      ...task,
      status,
      reservedMs,
      remainingBeforeMs,
      remainingAfterMs: remainingMs,
      deadlineReason,
      fallback,
      promptLimitChanged: false,
      renderedLimitChanged: false,
    });
  }

  const reservedMs = decisions.reduce((sum, decision) => sum + (finiteNonNegativeNumberOrNull(decision.reservedMs) ?? 0), 0);
  return {
    schema: FRAME_BUDGET_SIDECAR_SCHEDULE_SCHEMA,
    generatedAt: cleanString(generatedAt || '') || null,
    measurementMode: cleanToken(measurementMode || 'fixture-only', 'fixture-only'),
    deadlineMs: normalizedDeadline,
    elapsedMs: normalizedElapsed,
    remainingBeforeMs: Math.max(0, normalizedDeadline - normalizedElapsed),
    reservedMs,
    remainingAfterMs: remainingMs,
    scheduledCount: decisions.filter((item) => item.status === FRAME_BUDGET_SIDECAR_STATUSES.SCHEDULED).length,
    degradedCount: decisions.filter((item) => item.status === FRAME_BUDGET_SIDECAR_STATUSES.DEGRADED).length,
    skippedCount: decisions.filter((item) => item.status === FRAME_BUDGET_SIDECAR_STATUSES.SKIPPED).length,
    missedCount: decisions.filter((item) => item.status === FRAME_BUDGET_SIDECAR_STATUSES.MISSED).length,
    priorityOrder: Object.values(FRAME_BUDGET_SIDECAR_SPEND_CLASSES),
    decisions,
    budgetEvents: decisions.map(sidecarDecisionToBudgetEvent),
    guardrails: {
      liveRuntimeWiring: false,
      promptTruthExpanded: false,
      toolEvidenceReceiptChanged: false,
      defaultPromptLimitsRaised: false,
      defaultRenderedMemoryLimitsRaised: false,
      runtimeVoiceChanged: false,
      answerQualityProof: false,
    },
    limits: [...FRAME_BUDGET_SIDECAR_LIMITS],
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
    measurementMode: cleanToken(raw.measurementMode || raw.mode || 'baseline', 'baseline'),
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
  FRAME_BUDGET_SIDECAR_SCHEMA,
  FRAME_BUDGET_SIDECAR_SCHEDULE_SCHEMA,
  FRAME_BUDGET_CANDIDATE_MERGE_SCHEMA,
  FRAME_BUDGET_EVENT_STATUSES,
  FRAME_BUDGET_SIDECAR_STATUSES,
  FRAME_BUDGET_SIDECAR_SPEND_CLASSES,
  FRAME_BUDGET_SIDECAR_DEFAULT_BUDGETS_MS,
  createFrameBudgetReceipt,
  normalizeFrameBudgetReceipt,
  buildFrameBudgetSidecarReceipt,
  normalizeFrameBudgetSidecarReceipt,
  frameBudgetSidecarToBudgetEvent,
  buildCandidateMergeFrameBudgetPlan,
  buildDeadlineAwareSidecarSchedule,
  addFrameTiming,
  addFrameWorkCount,
  addFrameBudgetEvent,
  summarizeFrameBudget,
  classifyFrameBudgetHealth,
};
