const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const skillsRoot = path.join(repoRoot, '.codex', 'skills');
const expectedSkills = [
  'penny-lmstudio-ops',
  'penny-memory-inspector',
  'penny-qa-release',
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseFrontmatter(markdown) {
  const match = String(markdown || '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(match, 'expected YAML frontmatter');
  return match[1];
}

function markdownLinkTargets(markdown) {
  return [...String(markdown || '').matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
}

test('repo-local Penny skill pack exists with required SKILL.md frontmatter keys', () => {
  for (const skill of expectedSkills) {
    const skillDir = path.join(skillsRoot, skill);
    const skillFile = path.join(skillDir, 'SKILL.md');
    assert.ok(fs.existsSync(skillDir), `missing skill directory: ${skill}`);
    assert.ok(fs.existsSync(skillFile), `missing SKILL.md for ${skill}`);
    const frontmatter = parseFrontmatter(readText(skillFile));
    assert.match(frontmatter, new RegExp(`(^|\\r?\\n)name:\\s+${skill}(\\r?\\n|$)`));
    assert.match(frontmatter, /(^|\r?\n)description:\s+/);
    assert.match(frontmatter, /(^|\r?\n)compatibility:\s*/);
    assert.match(frontmatter, /(^|\r?\n)allowed-tools:\s*/);
  }
});

test('skill index references only real Penny skills', () => {
  const indexFile = path.join(skillsRoot, 'README.md');
  assert.ok(fs.existsSync(indexFile), 'missing skill index');
  const text = readText(indexFile);
  const links = [...text.matchAll(/\]\(\.\/([^/]+)\/SKILL\.md\)/g)].map(match => match[1]);
  assert.deepEqual(links.sort(), [...expectedSkills].sort());
  for (const skill of links) {
    assert.ok(fs.existsSync(path.join(skillsRoot, skill, 'SKILL.md')), `index points at missing skill: ${skill}`);
  }
});

test('each Penny skill reference file exists', () => {
  for (const skill of expectedSkills) {
    const referenceFile = path.join(skillsRoot, skill, 'references', 'REFERENCE.md');
    assert.ok(fs.existsSync(referenceFile), `missing reference doc for ${skill}`);
  }
});

test('repo-local skill docs point only at real local files', () => {
  const docs = [
    path.join(skillsRoot, 'README.md'),
    ...expectedSkills.flatMap((skill) => [
      path.join(skillsRoot, skill, 'SKILL.md'),
      path.join(skillsRoot, skill, 'references', 'REFERENCE.md'),
    ]),
  ];
  for (const doc of docs) {
    const baseDir = path.dirname(doc);
    for (const target of markdownLinkTargets(readText(doc))) {
      if (/^(https?:|app:\/\/|plugin:\/\/)/i.test(target)) continue;
      const resolved = path.resolve(baseDir, target);
      assert.ok(fs.existsSync(resolved), `broken local link in ${path.relative(repoRoot, doc)} -> ${target}`);
    }
  }
});
