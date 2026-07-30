const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const helpersPromise = import(pathToFileURL(path.join(
  __dirname,
  '..',
  'public',
  'js',
  'penny-public-errors.mjs',
)).href);

test('browser provider errors use canonical messages and ignore hostile detail fields', async () => {
  const { readPublicProviderFailure } = await helpersPromise;
  const canary = 'PENNY_PRIVATE_BROWSER_ERROR_CANARY_2f77';

  const known = readPublicProviderFailure({
    code: 'provider_timeout',
    detail: canary,
    message: canary,
    retryable: true,
  });
  const unknown = readPublicProviderFailure({
    code: 'hostile_code',
    detail: canary,
    message: canary,
  });

  assert.deepEqual(known, {
    code: 'provider_timeout',
    message: 'The local model provider timed out.',
    retryable: true,
  });
  assert.equal(unknown.message, 'Penny could not complete that model request.');
  assert.doesNotMatch(JSON.stringify([known, unknown]), new RegExp(canary));
});
