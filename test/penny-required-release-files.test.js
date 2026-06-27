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

test('required release files include runtime contract and P0 fixture receipt gates', () => {
  const expected = [
    'lib/penny-runtime-contract-receipt.js',
    'scripts/check-penny-runtime-contract-receipts.js',
    'test/penny-runtime-contract-receipt.test.js',
    'test/penny-runtime-contract-receipts-check.test.js',
    'lib/penny-p0-eval-pack.js',
    'scripts/eval-penny-p0-fixture-pack.js',
    'test/penny-p0-eval-pack.test.js',
  ];

  for (const rel of expected) {
    assert(
      REQUIRED.includes(rel),
      `missing required release file entry for ${rel}`,
    );
  }
});
