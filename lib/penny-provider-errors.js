const PROVIDER_ERROR_DEFINITIONS = Object.freeze({
  provider_upstream_error: Object.freeze({
    statusCode: 502,
    message: 'The local model provider could not complete this request.',
    retryable: true,
  }),
  provider_invalid_response: Object.freeze({
    statusCode: 502,
    message: 'The local model provider returned an invalid response.',
    retryable: true,
  }),
  provider_no_visible_text: Object.freeze({
    statusCode: 502,
    message: 'The local model provider returned no visible reply.',
    retryable: true,
  }),
  provider_stream_error: Object.freeze({
    statusCode: 502,
    message: 'The local model provider stream failed.',
    retryable: true,
  }),
  provider_timeout: Object.freeze({
    statusCode: 504,
    message: 'The local model provider timed out.',
    retryable: true,
  }),
  provider_unavailable: Object.freeze({
    statusCode: 503,
    message: 'The local model provider is unavailable.',
    retryable: true,
  }),
});

function normalizePublicIdentifier(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(text) ? text : fallback;
}

class PennyProviderError extends Error {
  constructor({
    code = 'provider_unavailable',
    provider = 'local',
    operation = 'request',
    upstreamStatus,
    reasonCode,
    retryable,
  } = {}) {
    const definition = PROVIDER_ERROR_DEFINITIONS[code] || PROVIDER_ERROR_DEFINITIONS.provider_unavailable;
    super(definition.message);
    this.name = 'PennyProviderError';
    this.code = PROVIDER_ERROR_DEFINITIONS[code] ? code : 'provider_unavailable';
    this.publicCode = this.code;
    this.publicMessage = definition.message;
    this.statusCode = definition.statusCode;
    this.provider = normalizePublicIdentifier(provider, 'local');
    this.operation = normalizePublicIdentifier(operation, 'request');
    if (Number.isInteger(Number(upstreamStatus)) && Number(upstreamStatus) > 0) {
      this.upstreamStatus = Number(upstreamStatus);
    }
    if (/^[a-z][a-z0-9_]{0,63}$/.test(String(reasonCode || ''))) {
      this.reasonCode = String(reasonCode);
    }
    this.retryable = typeof retryable === 'boolean' ? retryable : definition.retryable;
  }
}

function createProviderError(options = {}) {
  // Deliberately ignore privateDetail/cause/body fields. Provider payloads may
  // contain private reasoning and must not survive in throwable/public state.
  return new PennyProviderError(options);
}

function isProviderError(error) {
  return error instanceof PennyProviderError;
}

function toProviderError(error, {
  provider = 'local',
  operation = 'request',
  code = 'provider_unavailable',
    upstreamStatus,
    reasonCode,
    retryable,
} = {}) {
  if (isProviderError(error)) return error;
  return createProviderError({
    code: error?.name === 'AbortError' ? 'provider_timeout' : code,
    provider,
    operation,
    upstreamStatus: upstreamStatus ?? error?.upstreamStatus ?? error?.statusCode,
    reasonCode: reasonCode ?? error?.reasonCode,
    retryable,
  });
}

function toPublicProviderError(error, {
  provider = 'local',
  operation = 'request',
} = {}) {
  const safe = toProviderError(error, { provider, operation });
  const definition = PROVIDER_ERROR_DEFINITIONS[safe.code]
    || PROVIDER_ERROR_DEFINITIONS.provider_unavailable;
  const payload = {
    statusCode: definition.statusCode,
    code: PROVIDER_ERROR_DEFINITIONS[safe.code] ? safe.code : 'provider_unavailable',
    message: definition.message,
    provider: normalizePublicIdentifier(safe.provider, normalizePublicIdentifier(provider, 'local')),
    operation: normalizePublicIdentifier(safe.operation, normalizePublicIdentifier(operation, 'request')),
  };
  if (Number.isInteger(Number(safe.upstreamStatus)) && Number(safe.upstreamStatus) > 0) {
    payload.upstreamStatus = Number(safe.upstreamStatus);
  }
  payload.retryable = safe.retryable === true;
  return payload;
}

module.exports = {
  PennyProviderError,
  PROVIDER_ERROR_DEFINITIONS,
  createProviderError,
  isProviderError,
  toProviderError,
  toPublicProviderError,
};
