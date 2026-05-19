const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  isPathInsideRoot,
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
