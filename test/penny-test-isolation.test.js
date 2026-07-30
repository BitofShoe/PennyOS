const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

test('prompt-builder server imports isolate writable runtime state from source data', () => {
  const text = readText('test/penny-prompt-builders.test.js');

  assert.match(text, /PENNY_DATA_DIR/);
  assert.match(text, /PENNY_MEMORY_FILE/);
  assert.match(text, /PENNY_MEMORY_ARCHIVE_FILE/);
  assert.match(text, /PENNY_MEMORY_LEDGER_FILE/);
  assert.match(text, /PENNY_STATIC_EMBED_MODE/);
  assert.match(text, /PENNY_STATIC_EMBED_CACHE_FILE/);
  assert.match(text, /test\.after/);
});

test('server route tests isolate host LM Studio CLI and desktop settings discovery', () => {
  const routeText = readText('test/penny-routes.test.js');
  const semanticRenderText = readText('test/penny-semantic-render-tool-evidence.test.js');
  const serverText = readText('server.js');
  const statusText = readText('lib/penny-lmstudio-status.js');

  assert.match(serverText, /PENNY_LMSTUDIO_SETTINGS_FILE/);
  assert.match(serverText, /PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY/);
  assert.match(statusText, /PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY/);
  assert.match(routeText, /PENNY_LMSTUDIO_SETTINGS_FILE/);
  assert.match(routeText, /PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY/);
  assert.match(semanticRenderText, /PENNY_LMSTUDIO_SETTINGS_FILE/);
  assert.match(semanticRenderText, /PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY/);
});

test('browser smoke isolates its mock provider from host model preparation and CLI discovery', () => {
  const browserSmokeText = readText('scripts/qa-penny-browser-smoke.js');

  assert.match(browserSmokeText, /PENNY_SKIP_LMSTUDIO_PREP:\s*'1'/);
  assert.match(browserSmokeText, /PENNY_LMSTUDIO_DISABLE_CLI_DISCOVERY:\s*'1'/);
  assert.match(browserSmokeText, /PENNY_LMSTUDIO_BASE:\s*mockLmStudio\.baseUrl/);
});
