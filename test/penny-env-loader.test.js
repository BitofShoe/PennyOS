const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadPennyEnvFile,
  parsePennyEnvText,
} = require('../lib/penny-env-loader');

test('parsePennyEnvText supports simple Penny .env syntax', () => {
  const parsed = parsePennyEnvText([
    '# Penny local config',
    'PORT=4317',
    'PENNY_LMSTUDIO_BASE="http://127.0.0.1:18080/v1"',
    "PENNY_API_TOKEN='quoted token'",
    'PENNY_WEB_SEARCH_ENABLED=1 # inline comment',
    'export PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1',
    '',
  ].join('\n'));

  assert.deepEqual(parsed, {
    PORT: '4317',
    PENNY_LMSTUDIO_BASE: 'http://127.0.0.1:18080/v1',
    PENNY_API_TOKEN: 'quoted token',
    PENNY_WEB_SEARCH_ENABLED: '1',
    PENNY_ENABLE_DIRECT_WORKSPACE_WRITES: '1',
  });
});

test('loadPennyEnvFile loads .env values without overriding existing environment', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-env-loader-'));
  const envFile = path.join(root, '.env');
  const env = {
    PENNY_WEB_SEARCH_ENABLED: '0',
  };
  fs.writeFileSync(envFile, [
    'PENNY_WEB_SEARCH_ENABLED=1',
    'PENNY_LAN_SHARE=true',
    'PENNY_API_TOKEN=local-token',
  ].join('\n'));

  try {
    const result = loadPennyEnvFile({ envFile, env });

    assert.equal(result.loaded, true);
    assert.equal(env.PENNY_WEB_SEARCH_ENABLED, '0');
    assert.equal(env.PENNY_LAN_SHARE, 'true');
    assert.equal(env.PENNY_API_TOKEN, 'local-token');
    assert.deepEqual(result.applied.sort(), ['PENNY_API_TOKEN', 'PENNY_LAN_SHARE']);
    assert.deepEqual(result.skippedExisting, ['PENNY_WEB_SEARCH_ENABLED']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('loadPennyEnvFile treats a missing .env as an intentional no-op', () => {
  const env = {};
  const result = loadPennyEnvFile({ envFile: path.join(os.tmpdir(), 'missing-penny-env-file'), env });

  assert.equal(result.loaded, false);
  assert.equal(result.reason, 'missing');
  assert.deepEqual(env, {});
});
