const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { REQUIRED } = require('../scripts/check-required-release-files');

const ROOT = path.resolve(__dirname, '..');

test('required release files exist in the repo tree', () => {
  const missing = REQUIRED.filter((rel) => !fs.existsSync(path.join(ROOT, rel)));
  assert.deepEqual(missing, []);
});
