const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { upsertPennyEnvFile } = require('../lib/penny-cloud-provider-config');

const {
  WEB_SETTINGS_MANAGED_KEYS,
  buildWebSettingsEnvPatch,
  buildWebSettingsStatus,
  chooseConfiguredDirectIntent,
  normalizeWebAnswerMode,
} = require('../lib/penny-web-settings');

test('web settings default to model-shaped answers and keep web access opt-in', () => {
  assert.equal(normalizeWebAnswerMode(''), 'model');
  assert.deepEqual(buildWebSettingsEnvPatch({}), {
    PENNY_WEB_SEARCH_ENABLED: '0',
    PENNY_WEB_ANSWER_MODE: 'model',
  });
  assert.deepEqual(WEB_SETTINGS_MANAGED_KEYS, [
    'PENNY_WEB_SEARCH_ENABLED',
    'PENNY_WEB_ANSWER_MODE',
  ]);
});

test('model mode sends web requests through the model tool loop while direct mode keeps the legacy template path', () => {
  const webIntent = { name: 'search_web', args: { query: 'PennyOS' } };
  const fileIntent = { name: 'read_project_file', args: { path: 'README.md' } };

  assert.deepEqual(chooseConfiguredDirectIntent(webIntent, 'model'), { ...webIntent, modelDriven: true });
  assert.equal(chooseConfiguredDirectIntent(webIntent, 'direct'), webIntent);
  assert.equal(chooseConfiguredDirectIntent(fileIntent, 'model'), fileIntent);
});

test('web settings status exposes active and pending restart-safe values', () => {
  const status = buildWebSettingsStatus({
    env: {
      PENNY_WEB_SEARCH_ENABLED: '1',
      PENNY_WEB_ANSWER_MODE: 'direct',
      PENNY_WEB_ALLOW_PRIVATE_NET: '0',
    },
    pending: { enabled: false, answerMode: 'model' },
  });

  assert.equal(status.enabled, true);
  assert.equal(status.answerMode, 'direct');
  assert.equal(status.privateNetworkAllowed, false);
  assert.equal(status.restartRequired, true);
  assert.deepEqual(status.pending, { enabled: false, answerMode: 'model' });
});

test('web settings writer updates only web-owned keys and preserves private-network protection', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-web-env-'));
  const envFile = path.join(dir, '.env');
  fs.writeFileSync(envFile, [
    'PENNY_WEB_SEARCH_ENABLED=0',
    'PENNY_WEB_ALLOW_PRIVATE_NET=0',
    'PENNY_LMSTUDIO_CHAT_MODEL=keep-me',
    '',
  ].join('\n'));

  upsertPennyEnvFile({
    envFile,
    patch: buildWebSettingsEnvPatch({ enabled: true, answerMode: 'model' }),
    managedKeys: WEB_SETTINGS_MANAGED_KEYS,
  });
  const text = fs.readFileSync(envFile, 'utf8');

  assert.match(text, /PENNY_WEB_SEARCH_ENABLED="1"/);
  assert.match(text, /PENNY_WEB_ANSWER_MODE="model"/);
  assert.match(text, /PENNY_WEB_ALLOW_PRIVATE_NET=0/);
  assert.match(text, /PENNY_LMSTUDIO_CHAT_MODEL=keep-me/);
});
