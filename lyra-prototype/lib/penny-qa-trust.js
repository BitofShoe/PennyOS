const QA_TRUST_VERDICTS = Object.freeze({
  PASS: 'pass',
  INVALID: 'invalid',
  AMBIGUOUS: 'ambiguous',
  FALLBACK: 'fallback',
  DEGRADED: 'degraded',
});

const RUNTIME_ARTIFACT_PERFORMANCE_STAGES = Object.freeze([
  'request',
  'promptAssembly',
  'archiveRetrieval',
  'semanticRender',
  'modelResolution',
  'semanticProbe',
  'firstToken',
  'modelRoundTrip',
]);

function trimText(value = '', limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function uniqueStrings(values = [], limit = 16) {
  const seen = new Set();
  const output = [];
  for (const value of Array.isArray(values) ? values : []) {
    const text = trimText(value, 220);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= limit) break;
  }
  return output;
}

function normalizeReasonCode(value = '', fallback = '') {
  const text = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return text || fallback;
}

function normalizeQaTrust(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const verdict = Object.values(QA_TRUST_VERDICTS).includes(String(value.verdict || '').trim())
    ? String(value.verdict || '').trim()
    : QA_TRUST_VERDICTS.INVALID;
  const scope = String(value.scope || '').trim() || (
    verdict === QA_TRUST_VERDICTS.AMBIGUOUS
      ? 'compare'
      : verdict === QA_TRUST_VERDICTS.PASS
        ? 'ok'
        : 'environment'
  );
  return {
    verdict,
    scope,
    reasonCodes: uniqueStrings(
      (Array.isArray(value.reasonCodes) ? value.reasonCodes : [])
        .map((item) => normalizeReasonCode(item)),
      16,
    ),
    reasons: uniqueStrings(value.reasons || [], 12),
    environmentValid: value.environmentValid === true,
    ambiguous: value.ambiguous === true || verdict === QA_TRUST_VERDICTS.AMBIGUOUS,
    artifactValidatedCount: Math.max(0, Number(value.artifactValidatedCount || 0)),
    expectedArtifactCount: Math.max(0, Number(value.expectedArtifactCount || 0)),
    degradedArtifacts: Math.max(0, Number(value.degradedArtifacts || 0)),
    fallbackArtifacts: Math.max(0, Number(value.fallbackArtifacts || 0)),
    invalidResultCount: Math.max(0, Number(value.invalidResultCount || 0)),
    failedResultCount: Math.max(0, Number(value.failedResultCount || 0)),
    abortedResultCount: Math.max(0, Number(value.abortedResultCount || 0)),
  };
}

function validateRuntimeArtifact(
  artifact,
  {
    label = 'runtime artifact',
    minEvidence = 0,
    minSideEffects = 0,
    requirePerformanceStages = true,
  } = {},
) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error(`Missing ${label}.`);
  }
  const requiredObjectKeys = ['scope', 'authority', 'summary', 'context', 'modelAdvisory', 'timestamps', 'performance', 'readiness'];
  for (const key of requiredObjectKeys) {
    if (!artifact[key] || typeof artifact[key] !== 'object') {
      throw new Error(`Artifact ${label} is missing ${key}.`);
    }
  }
  if (!artifact.epistemics || typeof artifact.epistemics !== 'object' || !Array.isArray(artifact.epistemics.signals)) {
    throw new Error(`Artifact ${label} is missing epistemic reporting.`);
  }
  if (!artifact.synthesis || typeof artifact.synthesis !== 'object' || !Array.isArray(artifact.synthesis.evidenceSources)) {
    throw new Error(`Artifact ${label} is missing synthesis reporting.`);
  }
  if (artifact.version !== 'penny-runtime-artifact.v1') {
    throw new Error(`Artifact ${label} has unexpected version: ${artifact.version || '<empty>'}`);
  }
  if (!Array.isArray(artifact.evidence)) {
    throw new Error(`Artifact ${label} is missing verified evidence.`);
  }
  if (artifact.evidence.length < Math.max(0, Number(minEvidence || 0))) {
    throw new Error(`Artifact ${label} is missing verified evidence.`);
  }
  if (!Array.isArray(artifact.sideEffects)) {
    throw new Error(`Artifact ${label} is missing side effects.`);
  }
  if (artifact.sideEffects.length < Math.max(0, Number(minSideEffects || 0))) {
    throw new Error(`Artifact ${label} is missing side effects.`);
  }
  if (!String(artifact.performance?.latencyClass || '').trim()) {
    throw new Error(`Artifact ${label} is missing latencyClass.`);
  }
  if (!['warm', 'cold', 'degraded'].includes(String(artifact.readiness?.warmState || '').trim())) {
    throw new Error(`Artifact ${label} has invalid readiness warmState.`);
  }
  if (!['used', 'not-used'].includes(String(artifact.readiness?.modelUsage || '').trim())) {
    throw new Error(`Artifact ${label} has invalid readiness modelUsage.`);
  }
  if (requirePerformanceStages) {
    for (const stage of RUNTIME_ARTIFACT_PERFORMANCE_STAGES) {
      if (!artifact.performance[stage] || typeof artifact.performance[stage] !== 'object') {
        throw new Error(`Artifact ${label} is missing performance stage ${stage}.`);
      }
    }
  }
  const executionPath = String(artifact.executionPath || artifact.trace?.laneChoice?.executionPath || '').trim();
  const resolvedModel = String(artifact.context?.resolvedModel || artifact.trace?.laneChoice?.resolvedModel || '').trim();
  const modelRoundTrip = artifact.performance?.modelRoundTrip && typeof artifact.performance.modelRoundTrip === 'object'
    ? artifact.performance.modelRoundTrip
    : {};
  const claimsModelRoundTrip = modelRoundTrip.available === true
    || !!String(modelRoundTrip.startedAt || '').trim()
    || !!String(modelRoundTrip.finishedAt || '').trim()
    || Number(modelRoundTrip.durationMs || 0) > 0
    || !!String(modelRoundTrip.transport || '').trim();
  if (executionPath === 'deterministic-tool') {
    if (artifact.readiness?.modelUsage !== 'not-used') {
      throw new Error(`Artifact ${label} claims model usage on a deterministic turn.`);
    }
    if (resolvedModel) {
      throw new Error(`Artifact ${label} reports a resolvedModel on a deterministic turn.`);
    }
    if (claimsModelRoundTrip) {
      throw new Error(`Artifact ${label} reports a modelRoundTrip on a deterministic turn.`);
    }
  }
  if (['llm-chat', 'llm-tool-loop', 'shadow'].includes(executionPath) && artifact.readiness?.modelUsage !== 'used') {
    throw new Error(`Artifact ${label} reports missing model usage on an LLM-backed turn.`);
  }
  return artifact;
}

function buildEnvironmentReasonCodes(environment = null) {
  if (!environment || typeof environment !== 'object') return [];
  const codes = [];
  if (environment.valid === false) codes.push('environment_invalid');
  if (environment.trustedServer === false) codes.push('server_untrusted');
  if (environment.preparationOk === false) codes.push('preparation_blocked');
  if (environment.chatReady === false) codes.push('chat_model_mismatch');
  if (environment.toolReady === false) codes.push('tool_model_mismatch');
  if (environment.expected?.requireSemantic === true && environment.semanticReady !== true) codes.push('semantic_unavailable');
  if (Number(environment.degradedArtifacts || 0) > 0) codes.push('runtime_degraded');
  if (Number(environment.laneFallbackArtifacts || 0) > 0) codes.push('lane_fallback');
  if (Number(environment.usedFallbackArtifacts || 0) > 0) codes.push('runtime_fallback');
  if (Number(environment.semanticMismatchArtifacts || 0) > 0) codes.push('semantic_mismatch');
  if (Array.isArray(environment.duplicateLoadedModels) && environment.duplicateLoadedModels.length) codes.push('duplicate_loaded_models');
  return uniqueStrings(codes, 16);
}

function buildQaTrust({
  environment = null,
  ambiguous = false,
  artifactValidatedCount = 0,
  expectedArtifactCount = 0,
  degradedArtifacts = 0,
  fallbackArtifacts = 0,
  invalidResultCount = 0,
  failedResultCount = 0,
  abortedResultCount = 0,
  reasonCodes = [],
  reasons = [],
} = {}) {
  const environmentCodes = buildEnvironmentReasonCodes(environment);
  const callerReasonCodes = (Array.isArray(reasonCodes) ? reasonCodes : [])
    .map((item) => normalizeReasonCode(item))
    .filter(Boolean);
  const callerFailureReasonCodes = callerReasonCodes.filter((code) => ![
    'checks_clean',
    'paired_compare_ambiguous',
  ].includes(code));
  const degradedCount = Math.max(0, Number(degradedArtifacts || 0), Number(environment?.degradedArtifacts || 0));
  const fallbackCount = Math.max(
    0,
    Number(fallbackArtifacts || 0),
    Number(environment?.laneFallbackArtifacts || 0) + Number(environment?.usedFallbackArtifacts || 0),
  );
  const invalidCount = Math.max(0, Number(invalidResultCount || 0));
  const failedCount = Math.max(0, Number(failedResultCount || 0));
  const abortedCount = Math.max(0, Number(abortedResultCount || 0));
  const mergedReasonCodes = uniqueStrings([
    ...environmentCodes,
    ...callerReasonCodes,
  ], 16);
  const mergedReasons = uniqueStrings([
    ...(Array.isArray(environment?.reasons) ? environment.reasons : []),
    ...(Array.isArray(reasons) ? reasons : []),
  ], 12);

  let verdict = QA_TRUST_VERDICTS.PASS;
  let scope = 'ok';

  if (ambiguous === true) {
    verdict = QA_TRUST_VERDICTS.AMBIGUOUS;
    scope = 'compare';
    mergedReasonCodes.unshift('paired_compare_ambiguous');
  } else if (degradedCount > 0) {
    verdict = QA_TRUST_VERDICTS.DEGRADED;
    scope = environment?.valid === false ? 'environment' : 'mixed';
  } else if (fallbackCount > 0) {
    verdict = QA_TRUST_VERDICTS.FALLBACK;
    scope = environment?.valid === false ? 'environment' : 'mixed';
  } else if (environment && environment.valid === false) {
    verdict = QA_TRUST_VERDICTS.INVALID;
    scope = failedCount || invalidCount || abortedCount ? 'mixed' : 'environment';
  } else if (failedCount > 0 || invalidCount > 0 || abortedCount > 0) {
    verdict = QA_TRUST_VERDICTS.INVALID;
    scope = 'behavior';
    if (failedCount > 0) mergedReasonCodes.unshift('scenario_failures_present');
    if (invalidCount > 0) mergedReasonCodes.unshift('scenario_results_invalid');
    if (abortedCount > 0) mergedReasonCodes.unshift('run_aborts_present');
  } else if (callerFailureReasonCodes.length > 0) {
    verdict = QA_TRUST_VERDICTS.INVALID;
    scope = 'behavior';
  } else {
    mergedReasonCodes.unshift('checks_clean');
  }

  return normalizeQaTrust({
    verdict,
    scope,
    reasonCodes: mergedReasonCodes,
    reasons: mergedReasons,
    environmentValid: environment?.valid === true,
    ambiguous,
    artifactValidatedCount,
    expectedArtifactCount,
    degradedArtifacts: degradedCount,
    fallbackArtifacts: fallbackCount,
    invalidResultCount: invalidCount,
    failedResultCount: failedCount,
    abortedResultCount: abortedCount,
  });
}

module.exports = {
  QA_TRUST_VERDICTS,
  RUNTIME_ARTIFACT_PERFORMANCE_STAGES,
  normalizeQaTrust,
  validateRuntimeArtifact,
  buildEnvironmentReasonCodes,
  buildQaTrust,
};
