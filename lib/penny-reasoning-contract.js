const REASONING_CONTRACT_SCHEMA = 'penny-reasoning-contract.v1';

const CAPABILITY_STATES = new Set(['unknown', 'supported', 'unsupported']);
const REQUESTED_STATES = new Set(['unknown', 'not-requested', 'enabled', 'disabled', 'not-applicable']);
const EFFECTIVE_STATES = new Set(['unknown', 'enabled', 'disabled', 'not-applicable']);
const OBSERVED_STATES = new Set(['unknown', 'reasoning-observed', 'not-observed', 'not-applicable']);

function cleanText(value = '', fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function nonNegativeNumberOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function normalizeState(value, allowed, fallback) {
  const state = cleanText(value).toLowerCase();
  return allowed.has(state) ? state : fallback;
}

function normalizeReasoningContract(value = {}, defaults = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const fallback = defaults && typeof defaults === 'object' ? defaults : {};
  const capabilityInput = {
    ...(fallback.capability && typeof fallback.capability === 'object' ? fallback.capability : {}),
    ...(source.capability && typeof source.capability === 'object' ? source.capability : {}),
  };
  const requestedInput = {
    ...(fallback.requested && typeof fallback.requested === 'object' ? fallback.requested : {}),
    ...(source.requested && typeof source.requested === 'object' ? source.requested : {}),
  };
  const effectiveInput = {
    ...(fallback.effective && typeof fallback.effective === 'object' ? fallback.effective : {}),
    ...(source.effective && typeof source.effective === 'object' ? source.effective : {}),
  };
  const observedInput = {
    ...(fallback.observed && typeof fallback.observed === 'object' ? fallback.observed : {}),
    ...(source.observed && typeof source.observed === 'object' ? source.observed : {}),
  };
  const reasoningChars = nonNegativeNumberOrNull(observedInput.reasoningChars);
  const reasoningTokens = nonNegativeNumberOrNull(observedInput.reasoningTokens);
  const observedSignal = reasoningChars > 0 || reasoningTokens > 0;
  const explicitObservedState = normalizeState(observedInput.state, OBSERVED_STATES, 'unknown');
  const observedState = observedSignal ? 'reasoning-observed' : explicitObservedState;
  const explicitCapabilityState = normalizeState(capabilityInput.state, CAPABILITY_STATES, 'unknown');
  const explicitEffectiveState = normalizeState(effectiveInput.state, EFFECTIVE_STATES, 'unknown');

  return {
    schema: REASONING_CONTRACT_SCHEMA,
    measurementMode: cleanText(source.measurementMode, cleanText(fallback.measurementMode, 'status-only')),
    modelCall: source.modelCall === true || (source.modelCall == null && fallback.modelCall === true),
    capability: {
      state: observedSignal ? 'supported' : explicitCapabilityState,
      source: observedSignal
        ? cleanText(observedInput.source, 'response-signal')
        : cleanText(capabilityInput.source, 'unverified'),
    },
    requested: {
      state: normalizeState(requestedInput.state, REQUESTED_STATES, 'unknown'),
      source: cleanText(requestedInput.source, 'unverified'),
      control: cleanText(requestedInput.control, 'unknown'),
    },
    effective: {
      state: observedSignal ? 'enabled' : explicitEffectiveState,
      source: observedSignal
        ? cleanText(observedInput.source, 'response-signal')
        : cleanText(effectiveInput.source, 'unverified'),
    },
    observed: {
      state: observedState,
      source: cleanText(observedInput.source, 'unverified'),
      signal: cleanText(observedInput.signal, observedSignal ? 'reasoning-metadata' : 'none'),
      reasoningChars,
      reasoningTokens,
      truncated: observedInput.truncated === true,
    },
  };
}

function buildStatusReasoningContract({
  capabilityState = 'unknown',
  capabilitySource = 'status-does-not-advertise-reasoning',
  requestState = 'not-requested',
  requestControl = 'omitted',
} = {}) {
  return normalizeReasoningContract({
    measurementMode: 'status-only',
    modelCall: false,
    capability: {
      state: capabilityState,
      source: capabilitySource,
    },
    requested: {
      state: requestState,
      source: 'penny-companion-request-policy',
      control: requestControl,
    },
    effective: {
      state: 'unknown',
      source: 'no-provider-acknowledgement',
    },
    observed: {
      state: 'unknown',
      source: 'no-model-call',
      signal: 'none',
    },
  });
}

function recordReasoningRequest(laneRuntime, {
  state = 'not-requested',
  source = 'request-payload',
  control = 'omitted',
  measurementMode = 'runtime-turn',
} = {}) {
  if (!laneRuntime || typeof laneRuntime !== 'object') return null;
  laneRuntime.reasoningContract = normalizeReasoningContract({
    ...(laneRuntime.reasoningContract || {}),
    measurementMode,
    modelCall: true,
    requested: { state, source, control },
    effective: {
      state: 'unknown',
      source: 'no-provider-acknowledgement',
    },
    observed: {
      state: 'unknown',
      source: 'request-pending',
      signal: 'none',
      reasoningChars: null,
      reasoningTokens: null,
      truncated: false,
    },
  });
  return laneRuntime.reasoningContract;
}

function recordReasoningObservation(laneRuntime, {
  responseCompleted = true,
  source = 'provider-response',
  signal = '',
  reasoningChars = null,
  reasoningTokens = null,
  truncated = false,
} = {}) {
  if (!laneRuntime || typeof laneRuntime !== 'object') return null;
  const chars = nonNegativeNumberOrNull(reasoningChars);
  const tokens = nonNegativeNumberOrNull(reasoningTokens);
  const reasoningObserved = chars > 0 || tokens > 0;
  laneRuntime.reasoningContract = normalizeReasoningContract({
    ...(laneRuntime.reasoningContract || {}),
    measurementMode: 'runtime-turn',
    modelCall: true,
    observed: {
      state: reasoningObserved ? 'reasoning-observed' : (responseCompleted ? 'not-observed' : 'unknown'),
      source,
      signal: cleanText(signal, reasoningObserved ? 'reasoning-metadata' : 'none'),
      reasoningChars: chars,
      reasoningTokens: tokens,
      truncated,
    },
  });
  return laneRuntime.reasoningContract;
}

module.exports = {
  REASONING_CONTRACT_SCHEMA,
  buildStatusReasoningContract,
  normalizeReasoningContract,
  recordReasoningObservation,
  recordReasoningRequest,
};
