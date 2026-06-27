const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');

const ROOT = path.resolve(__dirname, '..');

test('release scripts expose runtime contract and P0 fixture gates', () => {
  assert.equal(
    packageJson.scripts['check:runtime-contract'],
    'node --test test/penny-runtime-contract-receipt.test.js test/penny-runtime-contract-receipts-check.test.js',
  );
  assert.equal(
    packageJson.scripts['eval:p0-fixture-pack'],
    'node scripts/eval-penny-p0-fixture-pack.js --fixture',
  );
  assert.equal(
    packageJson.scripts['check:p0-fixture-pack'],
    'node --test test/penny-p0-eval-pack.test.js && npm run eval:p0-fixture-pack -- --out output/p0-eval-pack-release-check.json',
  );
  assert.match(packageJson.scripts['check:release'], /check:runtime-contract/);
  assert.match(packageJson.scripts['check:release'], /check:p0-fixture-pack/);
});

test('release checklist calls out the runtime contract and P0 fixture gates', () => {
  const checklist = fs.readFileSync(path.join(ROOT, 'docs', 'release-checklist.md'), 'utf8');

  assert.match(checklist, /`npm run check:runtime-contract`/);
  assert.match(checklist, /`npm run check:p0-fixture-pack`/);
  assert.match(checklist, /`npm run eval:p0-fixture-pack -- --out output\/p0-eval-pack-release-check\.json`/);
});
