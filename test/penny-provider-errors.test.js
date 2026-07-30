const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createProviderError,
  isProviderError,
  toPublicProviderError,
} = require('../lib/penny-provider-errors');

const CANARY = 'PENNY_PRIVATE_REASONING_CANARY_7f91';

test('provider errors expose a stable public contract without retaining upstream bodies', () => {
  const error = createProviderError({
    code: 'provider_upstream_error',
    provider: 'lm_studio',
    operation: 'chat-completions',
    upstreamStatus: 500,
    retryable: true,
    privateDetail: `upstream said: ${CANARY}`,
  });

  assert.equal(isProviderError(error), true);
  assert.equal(error.message, 'The local model provider could not complete this request.');
  assert.equal(error.publicCode, 'provider_upstream_error');
  assert.equal(error.publicMessage, 'The local model provider could not complete this request.');
  assert.equal(error.statusCode, 502);
  assert.equal(error.upstreamStatus, 500);
  assert.doesNotMatch(error.message, new RegExp(CANARY));
  assert.doesNotMatch(JSON.stringify(error), new RegExp(CANARY));
  assert.doesNotMatch(JSON.stringify(toPublicProviderError(error)), new RegExp(CANARY));
  assert.deepEqual(toPublicProviderError(error), {
    statusCode: 502,
    code: 'provider_upstream_error',
    message: 'The local model provider could not complete this request.',
    provider: 'lm_studio',
    operation: 'chat-completions',
    upstreamStatus: 500,
    retryable: true,
  });
});

test('structural provider-error lookalikes cannot spoof the public message', () => {
  const spoof = Object.assign(new Error(CANARY), {
    name: 'PennyProviderError',
    code: 'provider_upstream_error',
    statusCode: 502,
    provider: `lm_studio-${CANARY}`,
    operation: `chat-${CANARY}`,
    retryable: true,
  });

  const payload = toPublicProviderError(spoof);
  assert.equal(payload.message, 'The local model provider is unavailable.');
  assert.equal(payload.provider, 'local');
  assert.equal(payload.operation, 'request');
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(CANARY));
});

test('unknown errors collapse to a generic public provider failure', () => {
  const payload = toPublicProviderError(new Error(`socket failure ${CANARY}`), {
    provider: 'lm_studio',
    operation: 'responses',
  });

  assert.deepEqual(payload, {
    statusCode: 503,
    code: 'provider_unavailable',
    message: 'The local model provider is unavailable.',
    provider: 'lm_studio',
    operation: 'responses',
    retryable: true,
  });
  assert.doesNotMatch(JSON.stringify(payload), new RegExp(CANARY));
});
