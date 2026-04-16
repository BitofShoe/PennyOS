const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  copyReviewBundle,
  normalizeRelativePath,
  shouldIncludeRelativePath,
} = require('../scripts/build-review-bundle');

test('normalizeRelativePath makes separators portable', () => {
  assert.equal(normalizeRelativePath('.\\output\\trace.log'), 'output/trace.log');
  assert.equal(normalizeRelativePath('/data/penny-memory.json'), 'data/penny-memory.json');
});

test('shouldIncludeRelativePath excludes local review clutter and keeps seed data', () => {
  assert.equal(shouldIncludeRelativePath('output/voice-redo.json'), false);
  assert.equal(shouldIncludeRelativePath('logs/server.log'), false);
  assert.equal(shouldIncludeRelativePath('.lyra-server.pid'), false);
  assert.equal(shouldIncludeRelativePath('data/penny-memory.json'), false);
  assert.equal(shouldIncludeRelativePath('data/penny-memory-archive.demo.json'), false);
  assert.equal(shouldIncludeRelativePath('data/penny-memory.seed.json'), true);
  assert.equal(shouldIncludeRelativePath('data/penny-memory-books.seed.json'), true);
  assert.equal(shouldIncludeRelativePath('lib/penny-memory-archive.js'), true);
});

test('copyReviewBundle omits generated debris from the bundle output', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-review-bundle-'));
  const outDir = path.join(root, 'tmp', 'bundle-out');
  fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
  fs.mkdirSync(path.join(root, 'output'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# hi\n');
  fs.writeFileSync(path.join(root, 'lib', 'thing.js'), 'module.exports = 1;\n');
  fs.writeFileSync(path.join(root, 'output', 'artifact.json'), '{}\n');
  fs.writeFileSync(path.join(root, '.lyra-server.pid'), '1234\n');
  fs.writeFileSync(path.join(root, 'data', 'penny-memory.seed.json'), '{}\n');
  fs.writeFileSync(path.join(root, 'data', 'penny-memory.json'), '{}\n');

  try {
    const report = copyReviewBundle({ rootDir: root, outDir });
    assert.ok(report.copied.includes('README.md'));
    assert.ok(report.copied.includes('lib/thing.js'));
    assert.ok(report.copied.includes('data/penny-memory.seed.json'));
    assert.equal(fs.existsSync(path.join(outDir, 'output', 'artifact.json')), false);
    assert.equal(fs.existsSync(path.join(outDir, '.lyra-server.pid')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'data', 'penny-memory.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
