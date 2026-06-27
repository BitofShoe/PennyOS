const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('storage reset copy does not promise a full durable memory wipe', () => {
  const html = readText('public/index.html');
  const app = readText('public/js/penny-app.js');

  assert.doesNotMatch(html, /Wipe memory/i);
  assert.match(html, /Reset local shell/i);
  assert.match(html, /Durable memory, archives, logs, and config stay on disk/i);
  assert.match(app, /Resetting the local shell/i);
});
