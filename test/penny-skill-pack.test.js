const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { listReleaseFiles } = require('../scripts/check-release-artifacts');

const repoRoot = path.join(__dirname, '..');
const skillsRoot = path.join(repoRoot, '.codex', 'skills');

test('public release does not ship repo-local Codex skill pack', () => {
  const release = listReleaseFiles({ rootDir: repoRoot });
  assert.equal(fs.existsSync(skillsRoot), false, '.codex/skills should stay out of the public release tree');
  assert.equal(release.files.some((filePath) => filePath.startsWith('.codex/skills/')), false);
});

test('historical skill references do not reintroduce release operator files', (t) => {
  const release = listReleaseFiles({ rootDir: repoRoot });
  if (release.mode === 'filesystem') {
    t.diagnostic('git metadata absent; checking filesystem release files only');
  }
  assert.equal(release.files.some((filePath) => filePath.startsWith('.codex/')), false);
  assert.equal(release.files.includes('AGENTS.md'), false);
  assert.equal(release.files.includes('MEMORY.md'), false);
  assert.equal(release.files.includes('SOUL.md'), false);
  assert.equal(release.files.includes('USER.md'), false);
});
