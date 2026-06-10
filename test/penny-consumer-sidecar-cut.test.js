const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('consumer Settings UI does not expose review sidecar controls', () => {
  const html = readText('public/index.html');
  const appJs = readText('public/js/penny-app.js');

  assert.doesNotMatch(html, /Local sidecars/);
  assert.doesNotMatch(html, /id="sidecarSearchQuery"/);
  assert.doesNotMatch(html, /id="sidecarSearchRun"/);
  assert.doesNotMatch(html, /id="sidecarDocsQuestion"/);
  assert.doesNotMatch(html, /id="sidecarDocsRun"/);
  assert.doesNotMatch(html, /id="sidecarAudioText"/);
  assert.doesNotMatch(html, /id="sidecarAudioRun"/);
  assert.doesNotMatch(appJs, /penny-sidecar-panel/);
  assert.doesNotMatch(appJs, /\/api\/penny\/sidecars\//);
});

test('consumer public bundle no longer contains the browser sidecar panel module', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'public', 'js', 'penny-sidecar-panel.mjs')), false);
});

test('consumer docs describe sidecar harnesses as source-dev only', () => {
  const guide = readText('docs/penny-public/pennyos-user-guide.md');
  const help = readText('public/pennyos-help.html');
  const readme = readText('README.md');

  assert.doesNotMatch(guide, /sidecar review panels/i);
  assert.match(guide, /not exposed in the consumer Settings UI/i);
  assert.match(guide, /not part of the downloadable app runtime/i);
  assert.match(help, /does not ship a consumer TTS voice/i);
  assert.doesNotMatch(readme, /Local sidecar workflows/);
});

test('source sidecar harness docs require the explicit dev gate', () => {
  const markdown = readText('docs/sidecars/penny-sidecar-productized-workflows.md');

  assert.match(markdown, /^# Source\/Dev Sidecar Workflow Harnesses/m);
  assert.match(markdown, /PENNY_ENABLE_REVIEW_SIDECARS=1/);
  assert.match(markdown, /not exposed in the consumer Settings UI/i);
  assert.match(markdown, /not bundled as sidecar fixture content in the Tauri consumer runtime/i);
  assert.doesNotMatch(markdown, /Browser: Settings -> Local sidecars/);
});
