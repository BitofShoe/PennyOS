const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

test('public frontend ships without external asset fetches', () => {
  const output = execFileSync(process.execPath, ['scripts/check-frontend-privacy.js'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.match(output, /Frontend privacy check passed/);
});
