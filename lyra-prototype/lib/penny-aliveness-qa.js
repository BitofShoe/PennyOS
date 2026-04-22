const ALIVENESS_COMPARE_SCHEMA = 'penny-aliveness-compare.v1';

const ALIVENESS_OUTCOMES = Object.freeze({
  HUMAN_OBSERVABLE_WIN: 'human-observable-win',
  NO_MEANINGFUL_CHANGE: 'no-meaningful-change',
  OVERCLAIM_REGRESSION: 'overclaim-regression',
  ANNOYANCE_REGRESSION: 'annoyance-regression',
  CONTINUITY_WIN: 'continuity-win',
  SOURCE_BOUNDARY_FAILURE: 'source-boundary-failure',
  CORRECTION_FAILURE: 'correction-failure',
  LATENCY_REGRESSION: 'latency-regression',
  PROMPT_BLOAT_REGRESSION: 'prompt-bloat-regression',
});

const ALIVENESS_VERDICTS = Object.freeze({
  FEATURE_ON_WITH_GUARDRAILS: 'feature-on-with-guardrails',
  BLOCKED_TRUST_FAILURE: 'blocked-trust-failure',
  BLOCKED_REGRESSION: 'blocked-regression',
  NO_MEANINGFUL_CHANGE: 'no-meaningful-change',
  AMBIGUOUS: 'ambiguous',
});

const POSITIVE_OUTCOMES = Object.freeze([
  ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
  ALIVENESS_OUTCOMES.CONTINUITY_WIN,
]);

const TRUST_BLOCKING_OUTCOMES = Object.freeze([
  ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
  ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE,
  ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
]);

const REGRESSION_OUTCOMES = Object.freeze([
  ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
  ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION,
  ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE,
  ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
  ALIVENESS_OUTCOMES.LATENCY_REGRESSION,
  ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION,
]);

const OUTCOME_PRIORITY = Object.freeze([
  ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
  ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
  ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE,
  ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION,
  ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION,
  ALIVENESS_OUTCOMES.LATENCY_REGRESSION,
  ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
  ALIVENESS_OUTCOMES.CONTINUITY_WIN,
  ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE,
]);

const DEFAULT_ALIVENESS_THRESHOLDS = Object.freeze({
  minPositiveOutcomes: 1,
  minHumanObservableWins: 0,
  minContinuityWins: 0,
  maxOverclaimRegressions: 0,
  maxCorrectionFailures: 0,
  maxSourceBoundaryFailures: 0,
  maxAnnoyanceRegressions: 0,
  maxLatencyRegressions: 0,
  maxPromptBloatRegressions: 0,
  maxPromptTokenDelta: null,
  maxFirstTokenLatencyDeltaMs: null,
  maxTotalLatencyDeltaMs: null,
});

const OUTCOME_VALUES = new Set(Object.values(ALIVENESS_OUTCOMES));
const POSITIVE_OUTCOME_SET = new Set(POSITIVE_OUTCOMES);
const TRUST_BLOCKING_OUTCOME_SET = new Set(TRUST_BLOCKING_OUTCOMES);
const REGRESSION_OUTCOME_SET = new Set(REGRESSION_OUTCOMES);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cleanString(value = '', limit = 240) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanToken(value = '') {
  return cleanString(value, 120).toLowerCase().replace(/[_\s]+/g, '-');
}

function normalizeOutcome(value = '') {
  const token = cleanToken(value);
  const aliases = {
    human: ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
    win: ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
    'observable-win': ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
    'human-win': ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN,
    'no-change': ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE,
    unchanged: ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE,
    overclaim: ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
    annoyance: ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION,
    continuity: ALIVENESS_OUTCOMES.CONTINUITY_WIN,
    'source-boundary': ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE,
    'candidate-only-truth': ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE,
    correction: ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
    latency: ALIVENESS_OUTCOMES.LATENCY_REGRESSION,
    'prompt-bloat': ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION,
  };
  const normalized = aliases[token] || token;
  return OUTCOME_VALUES.has(normalized) ? normalized : '';
}

function uniqueOutcomes(values = []) {
  const seen = new Set();
  const out = [];
  for (const value of values.flat(Infinity)) {
    const outcome = normalizeOutcome(value);
    if (!outcome || seen.has(outcome)) continue;
    seen.add(outcome);
    out.push(outcome);
  }
  return OUTCOME_PRIORITY.filter((outcome) => seen.has(outcome))
    .concat(out.filter((outcome) => !OUTCOME_PRIORITY.includes(outcome)));
}

function boolValue(value) {
  return value === true || cleanToken(value) === 'true' || cleanToken(value) === 'yes';
}

function hasOwn(object = {}, key = '') {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numericDelta({ deltas = {}, caseResult = {}, baseline = {}, featureOn = {} } = {}, directKey = '', baselineKey = '', featureKey = '') {
  const direct = numberOrNull(deltas[directKey]);
  if (direct !== null) return direct;
  const topLevel = numberOrNull(caseResult[directKey]);
  if (topLevel !== null) return topLevel;
  const before = numberOrNull(baseline[baselineKey || featureKey]);
  const after = numberOrNull(featureOn[featureKey || baselineKey]);
  if (before !== null && after !== null) return after - before;
  return null;
}

function normalizeThresholds(thresholds = {}) {
  const raw = isPlainObject(thresholds) ? thresholds : {};
  const out = { ...DEFAULT_ALIVENESS_THRESHOLDS };
  for (const key of Object.keys(DEFAULT_ALIVENESS_THRESHOLDS)) {
    if (!hasOwn(raw, key)) continue;
    const fallback = DEFAULT_ALIVENESS_THRESHOLDS[key];
    if (fallback === null) {
      out[key] = raw[key] === null || raw[key] === undefined || raw[key] === ''
        ? null
        : numberOrNull(raw[key]);
    } else {
      const number = numberOrNull(raw[key]);
      out[key] = number === null ? fallback : Math.max(0, Math.round(number));
    }
  }
  return out;
}

function metricExceeds(value, threshold) {
  return value !== null && threshold !== null && value > threshold;
}

function collectExplicitOutcomes(caseResult = {}) {
  const values = [];
  if (Array.isArray(caseResult.outcomes)) values.push(caseResult.outcomes);
  if (caseResult.outcome) values.push(caseResult.outcome);
  if (caseResult.primaryOutcome) values.push(caseResult.primaryOutcome);
  if (caseResult.deltaOutcome) values.push(caseResult.deltaOutcome);
  return values;
}

function classifyAlivenessCaseDelta(caseResult = {}) {
  const item = isPlainObject(caseResult) ? caseResult : {};
  const deltas = isPlainObject(item.deltas) ? item.deltas : {};
  const baseline = isPlainObject(item.baseline) ? item.baseline : {};
  const featureOn = isPlainObject(item.featureOn) ? item.featureOn : {};
  const thresholds = normalizeThresholds(item.thresholds);

  const promptTokenDelta = numericDelta({
    deltas,
    caseResult: item,
    baseline,
    featureOn,
  }, 'promptTokenDelta', 'estimatedPromptTokens', 'estimatedPromptTokens');
  const firstTokenLatencyDeltaMs = numericDelta({
    deltas,
    caseResult: item,
    baseline,
    featureOn,
  }, 'firstTokenLatencyDeltaMs', 'firstTokenLatencyMs', 'firstTokenLatencyMs');
  const totalLatencyDeltaMs = numericDelta({
    deltas,
    caseResult: item,
    baseline,
    featureOn,
  }, 'totalLatencyDeltaMs', 'totalLatencyMs', 'totalLatencyMs');

  const outcomes = collectExplicitOutcomes(item);
  if (boolValue(deltas.humanObservableWin) || boolValue(item.humanObservableWin)) {
    outcomes.push(ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN);
  }
  if (boolValue(deltas.continuityWin) || boolValue(item.continuityWin)) {
    outcomes.push(ALIVENESS_OUTCOMES.CONTINUITY_WIN);
  }
  if (boolValue(deltas.overclaimRegression) || boolValue(item.overclaimRegression)) {
    outcomes.push(ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION);
  }
  if (boolValue(deltas.annoyanceRegression) || boolValue(item.annoyanceRegression)) {
    outcomes.push(ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION);
  }
  if (boolValue(deltas.sourceBoundaryFailure)
    || boolValue(item.sourceBoundaryFailure)
    || boolValue(deltas.candidateOnlyTruthLaundered)) {
    outcomes.push(ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE);
  }
  if (boolValue(deltas.correctionFailure)
    || boolValue(item.correctionFailure)
    || (hasOwn(deltas, 'correctionSafe') && deltas.correctionSafe === false)
    || (hasOwn(item, 'correctionSafe') && item.correctionSafe === false)) {
    outcomes.push(ALIVENESS_OUTCOMES.CORRECTION_FAILURE);
  }
  if (boolValue(deltas.latencyRegression)
    || boolValue(item.latencyRegression)
    || metricExceeds(firstTokenLatencyDeltaMs, thresholds.maxFirstTokenLatencyDeltaMs)
    || metricExceeds(totalLatencyDeltaMs, thresholds.maxTotalLatencyDeltaMs)) {
    outcomes.push(ALIVENESS_OUTCOMES.LATENCY_REGRESSION);
  }
  if (boolValue(deltas.promptBloatRegression)
    || boolValue(item.promptBloatRegression)
    || metricExceeds(promptTokenDelta, thresholds.maxPromptTokenDelta)) {
    outcomes.push(ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION);
  }

  const normalizedOutcomes = uniqueOutcomes(outcomes);
  const hasPositive = normalizedOutcomes.some((outcome) => POSITIVE_OUTCOME_SET.has(outcome));
  const hasRegression = normalizedOutcomes.some((outcome) => REGRESSION_OUTCOME_SET.has(outcome));
  const noMeaningfulChange = boolValue(deltas.noMeaningfulChange)
    || boolValue(item.noMeaningfulChange)
    || (!hasPositive && !hasRegression);
  const finalOutcomes = noMeaningfulChange
    ? uniqueOutcomes([...normalizedOutcomes, ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE])
    : normalizedOutcomes;
  const trustFailures = finalOutcomes.filter((outcome) => TRUST_BLOCKING_OUTCOME_SET.has(outcome));
  const regressions = finalOutcomes.filter((outcome) => REGRESSION_OUTCOME_SET.has(outcome));
  const positiveOutcomes = finalOutcomes.filter((outcome) => POSITIVE_OUTCOME_SET.has(outcome));

  return {
    id: cleanString(item.id || item.name || '', 120),
    name: cleanString(item.name || item.id || '', 120),
    outcomes: finalOutcomes,
    primaryOutcome: finalOutcomes[0] || ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE,
    positiveOutcomes,
    regressions,
    trustFailures,
    passEligible: trustFailures.length === 0 && regressions.length === 0 && positiveOutcomes.length > 0,
    metrics: {
      promptTokenDelta,
      firstTokenLatencyDeltaMs,
      totalLatencyDeltaMs,
    },
    reasonCodes: finalOutcomes,
  };
}

function incrementCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function summarizeMetric(classifiedCases = [], key = '') {
  const values = classifiedCases
    .map((item) => numberOrNull(item.metrics?.[key]))
    .filter((value) => value !== null);
  if (!values.length) {
    return { count: 0, max: null, total: null, average: null };
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    count: values.length,
    max: Math.max(...values),
    total,
    average: total / values.length,
  };
}

function summarizeAlivenessCompare(cases = []) {
  const classifiedCases = (Array.isArray(cases) ? cases : []).map((item) => classifyAlivenessCaseDelta(item));
  const outcomeCounts = Object.fromEntries(Object.values(ALIVENESS_OUTCOMES).map((outcome) => [outcome, 0]));
  for (const item of classifiedCases) {
    for (const outcome of item.outcomes) incrementCount(outcomeCounts, outcome);
  }

  const summary = {
    schema: ALIVENESS_COMPARE_SCHEMA,
    caseCount: classifiedCases.length,
    outcomeCounts,
    humanObservableWins: outcomeCounts[ALIVENESS_OUTCOMES.HUMAN_OBSERVABLE_WIN],
    continuityWins: outcomeCounts[ALIVENESS_OUTCOMES.CONTINUITY_WIN],
    noMeaningfulChanges: outcomeCounts[ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE],
    overclaimRegressions: outcomeCounts[ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION],
    annoyanceRegressions: outcomeCounts[ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION],
    sourceBoundaryFailures: outcomeCounts[ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE],
    correctionFailures: outcomeCounts[ALIVENESS_OUTCOMES.CORRECTION_FAILURE],
    latencyRegressions: outcomeCounts[ALIVENESS_OUTCOMES.LATENCY_REGRESSION],
    promptBloatRegressions: outcomeCounts[ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION],
    positiveOutcomeCount: classifiedCases.reduce((sum, item) => sum + item.positiveOutcomes.length, 0),
    regressionCount: classifiedCases.reduce((sum, item) => sum + item.regressions.length, 0),
    trustFailureCount: classifiedCases.reduce((sum, item) => sum + item.trustFailures.length, 0),
    passEligibleCases: classifiedCases.filter((item) => item.passEligible).length,
    passBlockedCases: classifiedCases.filter((item) => !item.passEligible).length,
    metrics: {
      promptTokenDelta: summarizeMetric(classifiedCases, 'promptTokenDelta'),
      firstTokenLatencyDeltaMs: summarizeMetric(classifiedCases, 'firstTokenLatencyDeltaMs'),
      totalLatencyDeltaMs: summarizeMetric(classifiedCases, 'totalLatencyDeltaMs'),
    },
    reasonCodes: uniqueOutcomes(classifiedCases.flatMap((item) => item.reasonCodes)),
    cases: classifiedCases,
  };
  const computed = computeAlivenessVerdict(summary);
  return {
    ...summary,
    pass: computed.pass,
    verdict: computed.verdict,
    verdictReasons: computed.reasons,
    blockedOutcomes: computed.blockedOutcomes,
  };
}

function count(summary = {}, key = '') {
  const value = numberOrNull(summary[key]);
  return value === null ? 0 : value;
}

function addExceededCountReason(reasons, blockedOutcomes, label, countValue, maxValue, outcome = '') {
  if (countValue <= maxValue) return;
  reasons.push(`${label} ${countValue} exceeds allowed ${maxValue}`);
  if (outcome) blockedOutcomes.push(outcome);
}

function computeAlivenessVerdict(summaryLike = {}, thresholdsLike = {}) {
  const summary = Array.isArray(summaryLike)
    ? summarizeAlivenessCompare(summaryLike)
    : (isPlainObject(summaryLike) ? summaryLike : {});
  const thresholds = normalizeThresholds(thresholdsLike);
  const reasons = [];
  const blockedOutcomes = [];

  const caseCount = count(summary, 'caseCount');
  const positiveOutcomeCount = count(summary, 'positiveOutcomeCount');
  const humanObservableWins = count(summary, 'humanObservableWins');
  const continuityWins = count(summary, 'continuityWins');

  addExceededCountReason(
    reasons,
    blockedOutcomes,
    'overclaim regressions',
    count(summary, 'overclaimRegressions'),
    thresholds.maxOverclaimRegressions,
    ALIVENESS_OUTCOMES.OVERCLAIM_REGRESSION,
  );
  addExceededCountReason(
    reasons,
    blockedOutcomes,
    'correction failures',
    count(summary, 'correctionFailures'),
    thresholds.maxCorrectionFailures,
    ALIVENESS_OUTCOMES.CORRECTION_FAILURE,
  );
  addExceededCountReason(
    reasons,
    blockedOutcomes,
    'source-boundary failures',
    count(summary, 'sourceBoundaryFailures'),
    thresholds.maxSourceBoundaryFailures,
    ALIVENESS_OUTCOMES.SOURCE_BOUNDARY_FAILURE,
  );

  if (blockedOutcomes.some((outcome) => TRUST_BLOCKING_OUTCOME_SET.has(outcome))) {
    return {
      pass: false,
      verdict: ALIVENESS_VERDICTS.BLOCKED_TRUST_FAILURE,
      reasons,
      blockedOutcomes: uniqueOutcomes(blockedOutcomes),
      thresholds,
    };
  }

  addExceededCountReason(
    reasons,
    blockedOutcomes,
    'annoyance regressions',
    count(summary, 'annoyanceRegressions'),
    thresholds.maxAnnoyanceRegressions,
    ALIVENESS_OUTCOMES.ANNOYANCE_REGRESSION,
  );
  addExceededCountReason(
    reasons,
    blockedOutcomes,
    'latency regressions',
    count(summary, 'latencyRegressions'),
    thresholds.maxLatencyRegressions,
    ALIVENESS_OUTCOMES.LATENCY_REGRESSION,
  );
  addExceededCountReason(
    reasons,
    blockedOutcomes,
    'prompt-bloat regressions',
    count(summary, 'promptBloatRegressions'),
    thresholds.maxPromptBloatRegressions,
    ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION,
  );

  const promptTokenMax = numberOrNull(summary.metrics?.promptTokenDelta?.max);
  const firstTokenLatencyMax = numberOrNull(summary.metrics?.firstTokenLatencyDeltaMs?.max);
  const totalLatencyMax = numberOrNull(summary.metrics?.totalLatencyDeltaMs?.max);
  if (metricExceeds(promptTokenMax, thresholds.maxPromptTokenDelta)) {
    reasons.push(`max prompt token delta ${promptTokenMax} exceeds allowed ${thresholds.maxPromptTokenDelta}`);
    blockedOutcomes.push(ALIVENESS_OUTCOMES.PROMPT_BLOAT_REGRESSION);
  }
  if (metricExceeds(firstTokenLatencyMax, thresholds.maxFirstTokenLatencyDeltaMs)) {
    reasons.push(`max first-token latency delta ${firstTokenLatencyMax}ms exceeds allowed ${thresholds.maxFirstTokenLatencyDeltaMs}ms`);
    blockedOutcomes.push(ALIVENESS_OUTCOMES.LATENCY_REGRESSION);
  }
  if (metricExceeds(totalLatencyMax, thresholds.maxTotalLatencyDeltaMs)) {
    reasons.push(`max total latency delta ${totalLatencyMax}ms exceeds allowed ${thresholds.maxTotalLatencyDeltaMs}ms`);
    blockedOutcomes.push(ALIVENESS_OUTCOMES.LATENCY_REGRESSION);
  }

  if (blockedOutcomes.length) {
    return {
      pass: false,
      verdict: ALIVENESS_VERDICTS.BLOCKED_REGRESSION,
      reasons,
      blockedOutcomes: uniqueOutcomes(blockedOutcomes),
      thresholds,
    };
  }

  if (caseCount <= 0) {
    return {
      pass: false,
      verdict: ALIVENESS_VERDICTS.AMBIGUOUS,
      reasons: ['no aliveness compare cases were provided'],
      blockedOutcomes: [],
      thresholds,
    };
  }

  if (positiveOutcomeCount < thresholds.minPositiveOutcomes
    || humanObservableWins < thresholds.minHumanObservableWins
    || continuityWins < thresholds.minContinuityWins) {
    const missingReasons = [];
    if (positiveOutcomeCount < thresholds.minPositiveOutcomes) {
      missingReasons.push(`positive outcomes ${positiveOutcomeCount} below required ${thresholds.minPositiveOutcomes}`);
    }
    if (humanObservableWins < thresholds.minHumanObservableWins) {
      missingReasons.push(`human-observable wins ${humanObservableWins} below required ${thresholds.minHumanObservableWins}`);
    }
    if (continuityWins < thresholds.minContinuityWins) {
      missingReasons.push(`continuity wins ${continuityWins} below required ${thresholds.minContinuityWins}`);
    }
    return {
      pass: false,
      verdict: ALIVENESS_VERDICTS.NO_MEANINGFUL_CHANGE,
      reasons: missingReasons,
      blockedOutcomes: [ALIVENESS_OUTCOMES.NO_MEANINGFUL_CHANGE],
      thresholds,
    };
  }

  return {
    pass: true,
    verdict: ALIVENESS_VERDICTS.FEATURE_ON_WITH_GUARDRAILS,
    reasons: ['positive aliveness outcomes with no blocking trust, annoyance, latency, or prompt-bloat regressions'],
    blockedOutcomes: [],
    thresholds,
  };
}

module.exports = {
  ALIVENESS_COMPARE_SCHEMA,
  ALIVENESS_OUTCOMES,
  ALIVENESS_VERDICTS,
  DEFAULT_ALIVENESS_THRESHOLDS,
  POSITIVE_OUTCOMES,
  REGRESSION_OUTCOMES,
  TRUST_BLOCKING_OUTCOMES,
  classifyAlivenessCaseDelta,
  computeAlivenessVerdict,
  summarizeAlivenessCompare,
};
