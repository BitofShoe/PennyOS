const PUBLIC_PROVIDER_MESSAGES = Object.freeze({
  provider_upstream_error: 'The local model provider could not complete this request.',
  provider_invalid_response: 'The local model provider returned an invalid response.',
  provider_no_visible_text: 'The local model provider returned no visible reply.',
  provider_stream_error: 'The local model provider stream failed.',
  provider_timeout: 'The local model provider timed out.',
  provider_unavailable: 'The local model provider is unavailable.',
});

export function readPublicProviderFailure(value = null, {
  fallbackMessage = 'Penny could not complete that model request.',
} = {}) {
  const payload = value && typeof value === 'object' ? value : {};
  const code = String(payload.code || '').trim();
  if (Object.prototype.hasOwnProperty.call(PUBLIC_PROVIDER_MESSAGES, code)) {
    return {
      code,
      message: PUBLIC_PROVIDER_MESSAGES[code],
      retryable: payload.retryable === true,
    };
  }
  return {
    code: 'provider_unavailable',
    message: String(fallbackMessage || 'Penny could not complete that model request.'),
    retryable: true,
  };
}

export { PUBLIC_PROVIDER_MESSAGES };
