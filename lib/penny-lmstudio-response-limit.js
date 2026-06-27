function finiteNumberOrNull(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function cleanString(value = '') {
  return String(value || '').trim();
}

function normalizeLmStudioResponseLimitTelemetry({
  finishReason = '',
  usage = null,
  payload = null,
  source = 'lmstudio',
  lane = '',
  step = null,
} = {}) {
  const normalizedFinishReason = cleanString(finishReason).toLowerCase();
  if (normalizedFinishReason !== 'length') return null;

  const usageObject = usage && typeof usage === 'object' ? usage : {};
  const detailObject = usageObject.completion_tokens_details && typeof usageObject.completion_tokens_details === 'object'
    ? usageObject.completion_tokens_details
    : {};
  const payloadObject = payload && typeof payload === 'object' ? payload : {};
  const maxTokens = finiteNumberOrNull(payloadObject.max_tokens ?? payloadObject.max_output_tokens);
  const completionTokens = finiteNumberOrNull(usageObject.completion_tokens);
  const reasoningTokens = finiteNumberOrNull(detailObject.reasoning_tokens);
  const stepNumber = finiteNumberOrNull(step);

  const telemetry = {
    hit: true,
    reasonCode: 'output_limit',
    finishReason: normalizedFinishReason,
    source: cleanString(source) || 'lmstudio',
  };
  if (cleanString(lane)) telemetry.lane = cleanString(lane);
  if (stepNumber != null) telemetry.step = stepNumber;
  if (maxTokens != null) telemetry.maxTokens = maxTokens;
  if (completionTokens != null) telemetry.completionTokens = completionTokens;
  if (reasoningTokens != null) telemetry.reasoningTokens = reasoningTokens;
  return telemetry;
}

function extractLmStudioResponseLimitTelemetry({
  parsed = null,
  payload = null,
  source = 'lmstudio',
  lane = '',
  step = null,
} = {}) {
  const choice = parsed?.choices?.[0] && typeof parsed.choices[0] === 'object'
    ? parsed.choices[0]
    : {};
  return normalizeLmStudioResponseLimitTelemetry({
    finishReason: choice.finish_reason,
    usage: parsed?.usage,
    payload,
    source,
    lane,
    step,
  });
}

function recordLmStudioResponseLimitTelemetry(laneRuntime, telemetry) {
  if (!telemetry || typeof telemetry !== 'object') return;
  if (!laneRuntime || typeof laneRuntime !== 'object') return;
  laneRuntime.responseLimit = telemetry;
}

module.exports = {
  extractLmStudioResponseLimitTelemetry,
  normalizeLmStudioResponseLimitTelemetry,
  recordLmStudioResponseLimitTelemetry,
};
