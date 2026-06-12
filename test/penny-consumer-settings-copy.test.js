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

test('consumer setup appears before voice and companion controls on first settings view', () => {
  const html = readPublicIndex();
  const setupIndex = html.indexOf('id="firstRunSetupPanel"');
  const companionIndex = html.indexOf('Companion controls');
  const voiceIndex = html.indexOf('id="voiceToggle"');

  assert.notEqual(setupIndex, -1, 'setup panel should exist');
  assert.notEqual(companionIndex, -1, 'companion controls should exist');
  assert.notEqual(voiceIndex, -1, 'voice controls should exist');
  assert.ok(setupIndex < companionIndex, 'setup should come before companion controls');
  assert.ok(setupIndex < voiceIndex, 'setup should come before voice controls');
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
  assert.doesNotMatch(html, />\s*Tools model\s*</i);
  assert.doesNotMatch(html, /local brain lanes/i);
  assert.match(localSetup, /Conversation model/i);
  assert.match(localSetup, /File and project model/i);
  assert.match(localSetup, /Memory search model/i);
});

test('memory tab has a visible pending-edit badge target and plain intro copy', () => {
  const html = readPublicIndex();
  const start = html.indexOf('<section class="view" data-view="memory">');
  const end = html.indexOf('<section class="view" data-view="settings">', start);
  assert.notEqual(start, -1, 'memory view should exist');
  assert.notEqual(end, -1, 'settings view should follow memory view');
  const memoryView = html.slice(start, end);

  assert.match(html, /id="workspaceWritesBadge"/);
  assert.doesNotMatch(memoryView, /memory connections/i);
  assert.doesNotMatch(memoryView, /PromptTruth/i);
  assert.match(memoryView, /trail behind recent replies/i);
});
