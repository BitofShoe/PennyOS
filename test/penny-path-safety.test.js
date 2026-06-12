const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  isPathInsideRoot,
  isRealPathInsideRoot,
} = require('../lib/penny-path-safety');

test('isPathInsideRoot accepts the root and descendants', () => {
  assert.equal(isPathInsideRoot('/tmp/penny/public', '/tmp/penny/public', { pathModule: path.posix }), true);
  assert.equal(isPathInsideRoot('/tmp/penny/public', '/tmp/penny/public/index.html', { pathModule: path.posix }), true);
  assert.equal(isPathInsideRoot('C:\\Penny\\public', 'C:\\Penny\\public\\index.html', { pathModule: path.win32 }), true);
});

test('isPathInsideRoot rejects traversal and sibling-prefix paths', () => {
  assert.equal(isPathInsideRoot('/tmp/penny/public', '/tmp/penny/secret.txt', { pathModule: path.posix }), false);
  assert.equal(isPathInsideRoot('/tmp/penny/public', '/tmp/penny/public-other/index.html', { pathModule: path.posix }), false);
  assert.equal(isPathInsideRoot('C:\\Penny\\public', 'C:\\Penny\\public-other\\index.html', { pathModule: path.win32 }), false);
  assert.equal(isPathInsideRoot('C:\\Penny\\public', 'D:\\Penny\\public\\index.html', { pathModule: path.win32 }), false);
});

test('isRealPathInsideRoot rejects symlinked descendants that resolve outside root', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-path-root-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-path-outside-'));
  try {
    const linkPath = path.join(root, 'linked-outside');
    try {
      fs.symlinkSync(outside, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      if (['EPERM', 'EACCES', 'EINVAL'].includes(error?.code)) {
        t.skip(`symlinks unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.equal(isRealPathInsideRoot(root, path.join(root, 'normal', 'new.js')), true);
    assert.equal(isRealPathInsideRoot(root, path.join(linkPath, 'secret.txt')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});
