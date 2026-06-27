const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { findPublicPathLeaks } = require('../scripts/check-public-path-leaks');

test('public path leak scanner catches Unix home-directory operator paths', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-path-leak-'));
  try {
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    const leakedPath = ['/home', 'malac', '.nvm', 'versions', 'node', 'v24.15.0', 'bin', 'pi'].join('/');
    fs.writeFileSync(
      path.join(root, 'scripts', 'fixture.js'),
      `module.exports = '${leakedPath}';\n`,
    );

    const result = findPublicPathLeaks({ rootDir: root });

    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].path, 'scripts/fixture.js');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
