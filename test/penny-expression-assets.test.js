const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_PACK_ROOT,
  MOODS,
  checkPack,
  isSafeRootRelativeSpriteUrl,
} = require('../scripts/check-penny-expression-assets');

test('localized Penny eight-mood v1.4 expression pack passes byte and contract checks', () => {
  const result = checkPack();
  assert.equal(result.ok, true);
  assert.deepEqual(result.moods, [...MOODS]);
  assert.equal(result.totalBytes, 7349980);
  assert.equal(Object.keys(result.receipts).length, 8);
});

test('expression asset URL policy rejects traversal and nonlocal schemes', () => {
  assert.equal(isSafeRootRelativeSpriteUrl('/sprites/packs/penny-2d25d-v1.4/composites/calm.png'), true);
  assert.equal(isSafeRootRelativeSpriteUrl('/sprites/../private.txt'), false);
  assert.equal(isSafeRootRelativeSpriteUrl('/sprites/%2e%2e/private.txt'), false);
  assert.equal(isSafeRootRelativeSpriteUrl('file:///tmp/calm.png'), false);
  assert.equal(isSafeRootRelativeSpriteUrl('https://example.com/calm.png'), false);
  assert.equal(isSafeRootRelativeSpriteUrl('C:\\temp\\calm.png'), false);
});

test('expression asset checker fails closed on a temporary byte mutation', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-expression-pack-'));
  const packRoot = path.join(tempRoot, 'pack');
  fs.cpSync(DEFAULT_PACK_ROOT, packRoot, { recursive: true });
  const calmPath = path.join(packRoot, 'composites', 'calm.png');
  const bytes = fs.readFileSync(calmPath);
  bytes[bytes.length - 1] ^= 0x01;
  fs.writeFileSync(calmPath, bytes);

  assert.throws(
    () => checkPack({ packRoot }),
    /calm sha256 differs/,
  );
});
