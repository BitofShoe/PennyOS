const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.join(__dirname, '..');
const skillsRoot = path.join(repoRoot, '.codex', 'skills');

function gitLsFiles(args = []) {
  return execFileSync('git', ['ls-files', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
}

test('public release does not ship repo-local Codex skill pack', () => {
  assert.equal(fs.existsSync(skillsRoot), false, '.codex/skills should stay out of the public release tree');
  assert.deepEqual(gitLsFiles(['.codex/skills']), []);
});

test('historical skill references do not reintroduce tracked operator files', () => {
  const tracked = gitLsFiles();
  assert.equal(tracked.some((filePath) => filePath.startsWith('.codex/')), false);
  assert.equal(tracked.includes('AGENTS.md'), false);
  assert.equal(tracked.includes('MEMORY.md'), false);
  assert.equal(tracked.includes('SOUL.md'), false);
  assert.equal(tracked.includes('USER.md'), false);
});
