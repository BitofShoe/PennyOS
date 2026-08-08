const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-attachments.js');

function makeTextFile(name, text, relativePath = name, type = 'text/plain') {
  return {
    name,
    type,
    size: Buffer.byteLength(text, 'utf8'),
    webkitRelativePath: relativePath,
    async text() {
      return text;
    },
  };
}

test('prepareFolderAttachment builds a bounded, sorted current-turn text bundle', async () => {
  const { prepareFolderAttachment } = await helpersPromise;
  const bundle = await prepareFolderAttachment([
    makeTextFile('zeta.md', '# Zeta\nLast file', 'reference/zeta.md'),
    makeTextFile('alpha.js', 'export const alpha = 1;', 'reference/src/alpha.js', 'application/javascript'),
    makeTextFile('asset.bin', 'not really binary', 'reference/asset.bin', 'application/octet-stream'),
  ]);

  assert.equal(bundle.folder, true);
  assert.equal(bundle.folderName, 'reference');
  assert.equal(bundle.fileCount, 2);
  assert.equal(bundle.selectedFileCount, 3);
  assert.equal(bundle.skippedFileCount, 1);
  assert.match(bundle.name, /^reference\.folder\.md$/);
  assert.match(bundle.text, /These are only the files explicitly selected for this turn/i);
  assert.match(bundle.text, /reference\/src\/alpha\.js/);
  assert.match(bundle.text, /reference\/zeta\.md/);
  assert.ok(bundle.text.indexOf('reference/src/alpha.js') < bundle.text.indexOf('reference/zeta.md'));
  assert.doesNotMatch(bundle.text, /not really binary/);
});

test('prepareFolderAttachment refuses a selection with no supported readable text files', async () => {
  const { prepareFolderAttachment } = await helpersPromise;
  await assert.rejects(
    prepareFolderAttachment([
      makeTextFile('asset.bin', 'binary-looking', 'folder/asset.bin', 'application/octet-stream'),
      makeTextFile('empty.md', '', 'folder/empty.md'),
    ]),
    /No supported text\/code files fit/i,
  );
});
