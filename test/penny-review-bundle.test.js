const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  copyReviewBundle,
  findLatestExperienceArtifacts,
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
  assert.equal(shouldIncludeRelativePath('.openclaw/workspace-state.json'), false);
  assert.equal(shouldIncludeRelativePath('lyra-prototype/node_modules/pkg/index.js'), false);
  assert.equal(shouldIncludeRelativePath('.env'), false);
  assert.equal(shouldIncludeRelativePath('.env.example'), true);
  assert.equal(shouldIncludeRelativePath('.lyra-server.pid'), false);
  assert.equal(shouldIncludeRelativePath('.penny-local-preferences.json'), false);
  assert.equal(shouldIncludeRelativePath('data/penny-memory.json'), false);
  assert.equal(shouldIncludeRelativePath('data/penny-memory-archive.demo.json'), false);
  assert.equal(shouldIncludeRelativePath('data/penny-memory-ledger.json'), false);
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

test('copyReviewBundle can add an explicit private experience packet', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-review-experience-'));
  const outDir = path.join(root, 'tmp', 'bundle-out');
  const artifactPath = path.join(root, 'output', 'voice-redo-qa-2026-05-17T00-00-00-000Z.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(path.join(root, 'README.md'), '# hi\n');
  fs.writeFileSync(artifactPath, JSON.stringify({ runId: 'voice-redo-qa-test', prompts: [] }, null, 2));

  try {
    const report = copyReviewBundle({
      rootDir: root,
      outDir,
      includeExperience: true,
      experienceArtifacts: [artifactPath],
    });
    const bundledArtifact = path.join(
      outDir,
      'review-experience',
      'artifacts',
      'output',
      'voice-redo-qa-2026-05-17T00-00-00-000Z.json',
    );
    assert.equal(report.experience.artifactCount, 1);
    assert.ok(fs.existsSync(path.join(outDir, 'REVIEW_EXPERIENCE.md')));
    assert.ok(fs.existsSync(path.join(outDir, 'review-experience', 'manifest.json')));
    assert.ok(fs.existsSync(bundledArtifact));
    assert.equal(fs.existsSync(path.join(outDir, 'output', 'voice-redo-qa-2026-05-17T00-00-00-000Z.json')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('findLatestExperienceArtifacts picks known experience artifact types', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-review-latest-'));
  const oldVoice = path.join(root, 'output', 'voice-redo-qa-old.json');
  const newVoice = path.join(root, 'output', 'voice-redo-qa-new.json');
  const browserSmoke = path.join(root, 'output', 'playwright', 'penny-browser-smoke-new.json');
  fs.mkdirSync(path.dirname(oldVoice), { recursive: true });
  fs.mkdirSync(path.dirname(browserSmoke), { recursive: true });
  fs.writeFileSync(oldVoice, '{}\n');
  fs.writeFileSync(newVoice, '{}\n');
  fs.writeFileSync(browserSmoke, '{}\n');
  const oldTime = new Date('2026-05-17T00:00:00Z');
  const newTime = new Date('2026-05-17T01:00:00Z');
  fs.utimesSync(oldVoice, oldTime, oldTime);
  fs.utimesSync(newVoice, newTime, newTime);

  try {
    const latest = findLatestExperienceArtifacts(root).map((item) => normalizeRelativePath(path.relative(root, item)));
    assert.ok(latest.includes('output/voice-redo-qa-new.json'));
    assert.equal(latest.includes('output/voice-redo-qa-old.json'), false);
    assert.ok(latest.includes('output/playwright/penny-browser-smoke-new.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
