const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isGeneratedOrPrivateTrackedFile,
  listReleaseFiles,
} = require('../scripts/check-release-artifacts');

test('release artifact checker falls back to filesystem outside git', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-release-no-git-'));
  try {
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
    fs.writeFileSync(path.join(root, 'README.md'), '# Penny\n');
    fs.writeFileSync(path.join(root, 'public', 'index.html'), '<!doctype html>\n');
    fs.writeFileSync(path.join(root, 'tmp', 'junk.txt'), 'nope\n');
    const result = listReleaseFiles({ rootDir: root });
    assert.equal(result.mode, 'filesystem');
    assert.deepEqual(result.files.sort(), ['README.md', 'public/index.html']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release artifact checker treats nested worktree temp copies as filesystem releases', () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), 'tmp', 'penny-release-subdir-'));
  try {
    fs.writeFileSync(path.join(root, 'README.md'), '# Penny\n');
    const result = listReleaseFiles({ rootDir: root });
    assert.equal(result.mode, 'filesystem');
    assert.deepEqual(result.files, ['README.md']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('release artifact private-file classifier still rejects local residues', () => {
  assert.equal(isGeneratedOrPrivateTrackedFile('.lyra-server.pid'), true);
  assert.equal(isGeneratedOrPrivateTrackedFile('.penny-server.pid'), true);
  assert.equal(isGeneratedOrPrivateTrackedFile('debug-shadow.js'), true);
  assert.equal(isGeneratedOrPrivateTrackedFile("Today's Plan.md"), true);
  assert.equal(isGeneratedOrPrivateTrackedFile('data/penny-memory.json'), true);
  assert.equal(isGeneratedOrPrivateTrackedFile('data/penny-memory.seed.json'), false);
  assert.equal(isGeneratedOrPrivateTrackedFile('lyra-prototype/AGENTS.md'), true);
});
