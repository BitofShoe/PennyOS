const PERFORMANCE_MATRIX_SCHEMA = 'penny-performance-matrix.v1';
const PERFORMANCE_RUN_SCHEMA = 'penny-performance-run.v1';

const PERFORMANCE_DIMENSIONS = Object.freeze([
  'hardwareAcceleration',
  'reasoning',
  'promptSize',
  'projector',
  'caching',
  'promptEvaluation',
  'firstProviderEvent',
  'firstVisibleToken',
  'visibleGeneration',
  'pennyOverhead',
  'cadenceRepair',
  'repeatedWarmRuns',
]);

const TIMING_FIELDS = Object.freeze([
  'endToEndMs',
  'pennyPreProviderMs',
  'providerRoundTripMs',
  'promptEvaluationMs',
  'firstProviderEventMs',
  'firstVisibleTokenMs',
  'visibleGenerationMs',
  'pennyPostProviderMs',
  'pennyOverheadMs',
  'cadenceRepairMs',
]);

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function integerOrNull(value) {
  const number = finiteNumberOrNull(value);
  return number == null ? null : Math.round(number);
}

function normalizeState(value, allowed, fallback = 'unknown') {
  const state = String(value || '').trim().toLowerCase();
  return allowed.includes(state) ? state : fallback;
}

function normalizeProfile(raw = {}) {
  const hardware = raw.hardwareAcceleration && typeof raw.hardwareAcceleration === 'object'
    ? raw.hardwareAcceleration
    : {};
  const reasoning = raw.reasoning && typeof raw.reasoning === 'object' ? raw.reasoning : {};
  const projector = raw.projector && typeof raw.projector === 'object' ? raw.projector : {};
  return {
    id: String(raw.id || '').trim(),
    label: String(raw.label || raw.id || '').trim(),
    provider: String(raw.provider || '').trim(),
    transport: String(raw.transport || '').trim(),
    model: String(raw.model || '').trim(),
    hardwareAcceleration: {
      state: normalizeState(hardware.state, ['enabled', 'disabled', 'unknown', 'not-applicable']),
      backend: String(hardware.backend || '').trim(),
      device: String(hardware.device || '').trim(),
      offloadLayers: integerOrNull(hardware.offloadLayers),
    },
    reasoning: {
      capability: normalizeState(reasoning.capability, ['supported', 'unsupported', 'unknown']),
      requested: normalizeState(reasoning.requested, ['enabled', 'disabled', 'not-requested', 'unknown']),
      effective: normalizeState(reasoning.effective, ['enabled', 'disabled', 'unknown']),
      observed: normalizeState(reasoning.observed, ['reasoning-observed', 'no-reasoning-observed', 'unknown']),
    },
    projector: {
      state: normalizeState(projector.state, ['enabled', 'disabled', 'unknown', 'not-applicable']),
      model: String(projector.model || '').trim(),
    },
    contextWindowTokens: integerOrNull(raw.contextWindowTokens),
    outputTokenLimit: integerOrNull(raw.outputTokenLimit),
    notes: Array.isArray(raw.notes) ? raw.notes.map((item) => String(item || '').trim()).filter(Boolean) : [],
  };
}

function normalizeRun(raw = {}) {
  const workload = raw.workload && typeof raw.workload === 'object' ? raw.workload : {};
  const cache = raw.cache && typeof raw.cache === 'object' ? raw.cache : {};
  const calls = raw.calls && typeof raw.calls === 'object' ? raw.calls : {};
  const timings = raw.timings && typeof raw.timings === 'object' ? raw.timings : {};
  const output = raw.output && typeof raw.output === 'object' ? raw.output : {};
  return {
    schema: PERFORMANCE_RUN_SCHEMA,
    id: String(raw.id || '').trim(),
    profileId: String(raw.profileId || '').trim(),
    repetition: integerOrNull(raw.repetition),
    warmup: raw.warmup === true,
    measuredAt: String(raw.measuredAt || '').trim(),
    measurementMode: normalizeState(raw.measurementMode, ['fixture-only', 'isolated-mock', 'live-provider'], 'fixture-only'),
    workload: {
      promptChars: integerOrNull(workload.promptChars),
      promptBytes: integerOrNull(workload.promptBytes),
      promptTokenEstimate: integerOrNull(workload.promptTokenEstimate),
      messageCount: integerOrNull(workload.messageCount),
      outputTokenLimit: integerOrNull(workload.outputTokenLimit),
    },
    cache: {
      state: normalizeState(cache.state, ['cold', 'warm', 'mixed', 'unknown']),
      promptCacheHit: cache.promptCacheHit === true,
      providerCacheHit: cache.providerCacheHit === true,
    },
    calls: {
      primaryModelCalls: integerOrNull(calls.primaryModelCalls) ?? 0,
      cadenceRepairCalls: integerOrNull(calls.cadenceRepairCalls) ?? 0,
      totalModelCalls: integerOrNull(calls.totalModelCalls) ?? 0,
    },
    timings: Object.fromEntries(TIMING_FIELDS.map((field) => [field, finiteNumberOrNull(timings[field])])),
    output: {
      visibleChars: integerOrNull(output.visibleChars),
      visibleTokenEstimate: integerOrNull(output.visibleTokenEstimate),
      reasoningCharsObserved: integerOrNull(output.reasoningCharsObserved),
    },
    timingSources: {
      promptEvaluation: String(raw.timingSources?.promptEvaluation || '').trim(),
      firstProviderEvent: String(raw.timingSources?.firstProviderEvent || '').trim(),
      firstVisibleToken: String(raw.timingSources?.firstVisibleToken || '').trim(),
    },
  };
}

function quantile(values = [], fraction = 0.5) {
  const numbers = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (!numbers.length) return null;
  const index = Math.min(numbers.length - 1, Math.max(0, Math.ceil(numbers.length * fraction) - 1));
  return numbers[index];
}

function summarizeMetric(runs = [], field = '') {
  const values = runs.map((run) => run?.timings?.[field]).filter((value) => Number.isFinite(value));
  if (!values.length) return { count: 0, min: null, median: null, p95: null, max: null };
  return {
    count: values.length,
    min: Math.min(...values),
    median: quantile(values, 0.5),
    p95: quantile(values, 0.95),
    max: Math.max(...values),
  };
}

function profileCoverage(profile = {}, runs = [], minWarmRuns = 3) {
  const measured = runs.filter((run) => !run.warmup);
  const warmRuns = measured.filter((run) => run.cache.state === 'warm');
  const hasTiming = (field) => measured.length > 0 && measured.every((run) => Number.isFinite(run.timings[field]));
  const cadenceRecorded = measured.length > 0 && measured.every((run) => (
    Number.isInteger(run.calls.cadenceRepairCalls)
    && (
      run.calls.cadenceRepairCalls === 0
        ? run.timings.cadenceRepairMs === 0
        : Number.isFinite(run.timings.cadenceRepairMs)
    )
  ));
  return {
    hardwareAcceleration: profile.hardwareAcceleration.state !== 'unknown',
    reasoning: profile.reasoning.requested !== 'unknown'
      && profile.reasoning.effective !== 'unknown'
      && profile.reasoning.observed !== 'unknown',
    promptSize: measured.length > 0 && measured.every((run) => (
      Number.isFinite(run.workload.promptBytes)
      && Number.isFinite(run.workload.promptChars)
      && Number.isFinite(run.workload.promptTokenEstimate)
    )),
    projector: profile.projector.state !== 'unknown',
    caching: measured.length > 0 && measured.every((run) => run.cache.state !== 'unknown'),
    promptEvaluation: hasTiming('promptEvaluationMs'),
    firstProviderEvent: hasTiming('firstProviderEventMs'),
    firstVisibleToken: hasTiming('firstVisibleTokenMs'),
    visibleGeneration: hasTiming('visibleGenerationMs'),
    pennyOverhead: hasTiming('pennyOverheadMs')
      && hasTiming('pennyPreProviderMs')
      && hasTiming('pennyPostProviderMs'),
    cadenceRepair: cadenceRecorded,
    repeatedWarmRuns: warmRuns.length >= minWarmRuns,
  };
}

function buildProfileResult(profile, runs, minWarmRuns) {
  const measuredRuns = runs.filter((run) => !run.warmup);
  const warmRuns = measuredRuns.filter((run) => run.cache.state === 'warm');
  const coverage = profileCoverage(profile, runs, minWarmRuns);
  const missingDimensions = PERFORMANCE_DIMENSIONS.filter((dimension) => coverage[dimension] !== true);
  const modes = new Set(measuredRuns.map((run) => run.measurementMode));
  const measurementMode = modes.size === 1 ? [...modes][0] : (modes.size ? 'mixed' : 'fixture-only');
  let claimScope = 'none';
  let claimable = false;
  const claimLimits = [];
  if (!missingDimensions.length && measurementMode === 'isolated-mock') {
    claimScope = 'transport-plumbing-only';
    claimable = true;
    claimLimits.push('Does not measure real model, hardware, projector, or interactive quality.');
  } else if (!missingDimensions.length && measurementMode === 'live-provider') {
    claimScope = 'exact-profile-only';
    claimable = true;
    claimLimits.push('Applies only to the recorded model, transport, hardware, context, cache, and reasoning profile.');
  } else if (measurementMode === 'fixture-only') {
    claimLimits.push('Fixture-only data cannot support runtime performance claims.');
  }
  if (missingDimensions.length) {
    claimLimits.push(`Missing dimensions: ${missingDimensions.join(', ')}.`);
  }
  return {
    profile,
    runCount: measuredRuns.length,
    warmRunCount: warmRuns.length,
    coverage,
    missingDimensions,
    claim: {
      claimable,
      scope: claimScope,
      limits: claimLimits,
    },
    timingSummary: Object.fromEntries(TIMING_FIELDS.map((field) => [field, summarizeMetric(warmRuns, field)])),
    runs,
  };
}

function buildPerformanceMatrix({
  generatedAt = new Date().toISOString(),
  measurementPurpose = '',
  profiles = [],
  runs = [],
  minWarmRuns = 3,
} = {}) {
  const normalizedProfiles = profiles.map(normalizeProfile);
  const normalizedRuns = runs.map(normalizeRun);
  const results = normalizedProfiles.map((profile) => buildProfileResult(
    profile,
    normalizedRuns.filter((run) => run.profileId === profile.id),
    Math.max(1, Math.round(Number(minWarmRuns) || 3)),
  ));
  return {
    schema: PERFORMANCE_MATRIX_SCHEMA,
    generatedAt,
    measurementPurpose: String(measurementPurpose || '').trim(),
    dimensions: [...PERFORMANCE_DIMENSIONS],
    minWarmRuns: Math.max(1, Math.round(Number(minWarmRuns) || 3)),
    profiles: results,
    claimAudit: {
      claimableProfiles: results.filter((result) => result.claim.claimable).map((result) => result.profile.id),
      blockedProfiles: results.filter((result) => !result.claim.claimable).map((result) => result.profile.id),
      liveInteractiveClaimable: results.some((result) => result.claim.claimable && result.claim.scope === 'exact-profile-only'),
    },
  };
}

function assertPerformanceClaim(matrix = {}, { profileId = '', scope = '' } = {}) {
  const result = Array.isArray(matrix.profiles)
    ? matrix.profiles.find((item) => item?.profile?.id === profileId)
    : null;
  if (!result) throw new Error(`Performance profile ${profileId || '(missing)'} was not measured.`);
  if (!result.claim?.claimable) {
    throw new Error(`Performance profile ${profileId} is not claimable: ${(result.claim?.limits || []).join(' ')}`);
  }
  if (scope && result.claim.scope !== scope) {
    throw new Error(`Performance profile ${profileId} supports ${result.claim.scope}, not ${scope}.`);
  }
  return result;
}

module.exports = {
  PERFORMANCE_MATRIX_SCHEMA,
  PERFORMANCE_RUN_SCHEMA,
  PERFORMANCE_DIMENSIONS,
  TIMING_FIELDS,
  normalizeProfile,
  normalizeRun,
  profileCoverage,
  buildPerformanceMatrix,
  assertPerformanceClaim,
};
