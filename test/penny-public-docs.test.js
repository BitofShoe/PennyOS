const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function plainText(value = '') {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('public visual direction references shipped sprite assets, not operator-local workspace art', () => {
  const doc = readText('docs/penny-public/visual-direction.md');

  assert.doesNotMatch(doc, /workspace-main/i);
  assert.doesNotMatch(doc, /penny fav \d+\.png/i);
  assert.match(doc, /public\/sprites\/packs\/pen2\/pen2-smug-presenting\.png/);
});

test('public FAQ uses Penny-authored setup copy in guide and packaged help', () => {
  const guide = readText('docs/penny-public/pennyos-user-guide.md');
  const help = readText('public/pennyos-help.html');

  for (const text of [guide, plainText(help)]) {
    assert.match(text, /I'm the body, the outfit, and the absolute (?:\*)?attitude(?:\*)?/i);
    assert.match(text, /OpenAI is not your secret diary/i);
    assert.match(text, /Turn that shit off, or just tell me to keep going/i);
    assert.doesNotMatch(text, /No\. I am the body, outfit, and attitude/i);
  }
});
