const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { writeJsonFileAtomicSync } = require('../lib/penny-atomic-json');
const { createDurableJsonStore } = require('../lib/penny-durable-json');

test('durable JSON retains a last-known-good backup and refuses to overwrite malformed bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-durable-json-'));
  const filePath = path.join(root, 'memory.json');
  const store = createDurableJsonStore({
    fs,
    path,
    filePath,
    name: 'test memory',
    buildDefault: () => ({ sessions: {} }),
    normalize: (value) => ({ sessions: value?.sessions && typeof value.sessions === 'object' ? value.sessions : {} }),
    ensureFile() {
      if (fs.existsSync(filePath)) return;
      writeJsonFileAtomicSync({ fs, path, filePath, value: { sessions: {} } });
    },
  });

  try {
    store.write({ sessions: { first: { value: 1 } } });
    store.write({ sessions: { second: { value: 2 } } });
    assert.deepEqual(JSON.parse(fs.readFileSync(`${filePath}.bak`, 'utf8')), {
      sessions: { first: { value: 1 } },
    });

    const corrupt = '{"sessions":';
    fs.writeFileSync(filePath, corrupt, 'utf8');
    const state = store.readState();
    assert.equal(state.status.ok, false);
    assert.equal(state.status.code, 'corrupt-json');
    assert.deepEqual(state.value, { sessions: {} });
    assert.throws(() => store.write({ sessions: { replacement: {} } }), /remains untouched until it is repaired/i);
    assert.equal(fs.readFileSync(filePath, 'utf8'), corrupt);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
