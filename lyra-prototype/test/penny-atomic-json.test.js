const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildAtomicTempPath,
  writeJsonFileAtomicSync,
} = require('../lib/penny-atomic-json');

test('writeJsonFileAtomicSync writes pretty json through a same-directory temp file', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-atomic-json-'));
  const filePath = path.join(root, 'memory.json');

  writeJsonFileAtomicSync({
    fs,
    path,
    filePath,
    value: {
      sessions: {
        demo: { updatedAt: '2026-04-17T08:00:00.000Z' },
      },
    },
  });

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  assert.equal(parsed.sessions.demo.updatedAt, '2026-04-17T08:00:00.000Z');

  const siblings = fs.readdirSync(root);
  assert.deepEqual(siblings, ['memory.json']);

  fs.rmSync(root, { recursive: true, force: true });
});

test('writeJsonFileAtomicSync cleans up the temp file when rename fails', () => {
  const calls = [];
  const fakeFs = {
    mkdirSync(dirPath, options) {
      calls.push({ op: 'mkdir', dirPath, options });
    },
    writeFileSync(filePath, content, encoding) {
      calls.push({ op: 'write', filePath, content, encoding });
    },
    renameSync() {
      throw new Error('rename failed');
    },
    unlinkSync(filePath) {
      calls.push({ op: 'unlink', filePath });
    },
  };
  const filePath = path.join(os.tmpdir(), 'penny-atomic-json-failure.json');

  assert.throws(() => writeJsonFileAtomicSync({
    fs: fakeFs,
    path,
    filePath,
    value: { ok: true },
  }), /rename failed/);

  const writeCall = calls.find((entry) => entry.op === 'write');
  const unlinkCall = calls.find((entry) => entry.op === 'unlink');
  assert.ok(writeCall);
  assert.ok(unlinkCall);
  assert.equal(unlinkCall.filePath, writeCall.filePath);
  assert.equal(path.dirname(writeCall.filePath), path.dirname(filePath));
  assert.match(path.basename(writeCall.filePath), /^\.penny-atomic-json-failure\.json\./i);
});

test('buildAtomicTempPath keeps temp files beside the target file', () => {
  const filePath = path.join('C:\\temp', 'penny-memory.json');
  const tempPath = buildAtomicTempPath(path, filePath, {
    nowMs: () => 1234567890,
    pid: 42,
    random: () => 0.123456789,
  });

  assert.equal(path.dirname(tempPath), path.dirname(filePath));
  assert.match(path.basename(tempPath), /^\.penny-memory\.json\.42\./i);
  assert.match(path.basename(tempPath), /\.tmp$/i);
});
