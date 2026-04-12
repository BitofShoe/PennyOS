const test = require('node:test');
const assert = require('node:assert/strict');

const { mergeMemoryItems } = require('../lib/penny-memory');
const { createMemoryStateApi } = require('../lib/penny-memory-state');

function buildApi(now = Date.UTC(2026, 3, 12)) {
  const normalizeUserName = (value = '') => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const normalizeBrainMode = (value = '') => (value === 'shadow' ? 'shadow' : 'local');
  const normalizeMemoryRecord = (record = {}, sessionId = 'default') => ({
    sessionId,
    userName: normalizeUserName(record.userName),
    voiceOn: !!record.voiceOn,
    brainMode: normalizeBrainMode(record.brainMode),
    lmStudioThread: record.lmStudioThread || null,
    updatedAt: record.updatedAt || new Date(now).toISOString(),
    memories: mergeMemoryItems(record.memories || [], 30, now),
  });

  return createMemoryStateApi({
    normalizeMemoryRecord,
    normalizeUserName,
    normalizeBrainMode,
    nowMs: () => now,
  });
}

test('mergeMemoryState clears memories when patch explicitly provides an empty array', () => {
  const { mergeMemoryState } = buildApi();
  const base = {
    sessionId: 'demo',
    userName: 'Malac',
    memories: [{ text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: 1 }],
  };

  const merged = mergeMemoryState(base, { memories: [] });
  assert.equal(merged.sessionId, 'demo');
  assert.deepEqual(merged.memories, []);
});

test('mergeMemoryState preserves existing memories when merging runtime settings', () => {
  const { mergeMemoryState } = buildApi();
  const base = {
    sessionId: 'demo',
    userName: 'Malac',
    memories: [{ text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: 1 }],
  };

  const merged = mergeMemoryState(base, { voiceOn: true }, { replaceMemories: false });
  assert.equal(merged.voiceOn, true);
  assert.equal(merged.memories.length, 1);
  assert.match(merged.memories[0].text, /tea/i);
});

test('consolidateMemory extracts user name and explicit remembered facts from user turns', () => {
  const { consolidateMemory } = buildApi();
  const patch = consolidateMemory([
    { role: 'assistant', content: 'Hello there' },
    { role: 'user', content: 'Call me Rowan.' },
    { role: 'user', content: "Remember this: my favorite snack is chili mango." },
  ], { memories: [] });

  assert.equal(patch.userName, 'Rowan');
  assert.ok(patch.memories.some((item) => /chili mango/i.test(item.text)));
});

test('buildChatMemoryStateFromDiskMemory layers client settings and consolidation without wiping old memories', () => {
  const { buildChatMemoryStateFromDiskMemory } = buildApi();
  const prepared = buildChatMemoryStateFromDiskMemory(
    {
      sessionId: 'demo',
      userName: '',
      voiceOn: false,
      brainMode: 'local',
      memories: [{ text: 'Has a dog named Juniper', kind: 'personal', ts: 1 }],
    },
    { voiceOn: true, brainMode: 'shadow' },
    [{ role: 'user', content: "I'm into rainy cyberpunk vibes." }],
  );

  assert.equal(prepared.memory.voiceOn, true);
  assert.equal(prepared.memory.brainMode, 'shadow');
  assert.ok(prepared.memory.memories.some((item) => /juniper/i.test(item.text)));
  assert.ok(prepared.memory.memories.some((item) => /rainy cyberpunk vibes/i.test(item.text)));
  assert.ok(prepared.patch.memories.some((item) => /rainy cyberpunk vibes/i.test(item.text)));
});
