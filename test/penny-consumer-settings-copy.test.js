const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readPublicIndex() {
  return fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
}

test('consumer settings expose setup choices before advanced model routing', () => {
  const html = readPublicIndex();

  assert.match(html, /id="firstRunSetupPanel"/);
  assert.match(html, /Choose how Penny thinks/i);
  assert.match(html, /Use a local model/i);
  assert.match(html, /Use OpenAI API/i);
  assert.match(html, /Advanced model routing/i);
});

test('first-run setup copy avoids internal lane and shadow-brain jargon', () => {
  const html = readPublicIndex();
  const start = html.indexOf('<section class="settings-block" id="localModelSetupSection">');
  const end = html.indexOf('<div class="section-label">Local diagnostics</div>', start);
  assert.notEqual(start, -1, 'local setup section should be easy to find');
  assert.notEqual(end, -1, 'local diagnostics section should follow local setup');
  const localSetup = html.slice(start, end);

  assert.doesNotMatch(localSetup, /Pick the brain lanes/i);
  assert.doesNotMatch(localSetup, /Tool model/i);
  assert.doesNotMatch(localSetup, /Chat lane|Tool lane|brain lane/i);
  assert.doesNotMatch(localSetup, /Shadow brain/i);
  assert.match(localSetup, /Conversation model/i);
  assert.match(localSetup, /Tools model/i);
  assert.match(localSetup, /Memory search model/i);
});
