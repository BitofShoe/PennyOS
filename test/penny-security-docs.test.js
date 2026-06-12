const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('security docs mention local no-token opt-out alongside API token controls', () => {
  const security = readText('SECURITY.md');
  assert.match(security, /PENNY_API_ALLOW_LOCAL_NO_TOKEN/);
  assert.match(security, /loopback|localhost/i);
});
