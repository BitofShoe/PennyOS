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

test('consolidateMemory does not keep a malformed duplicate when the user says remember this exactly', () => {
  const { consolidateMemory } = buildApi();
  const patch = consolidateMemory([
    { role: 'user', content: 'Remember this exactly: my coding mascot is a brass fox.' },
  ], { memories: [] });

  const texts = patch.memories.map((item) => item.text);
  assert.equal(texts.length, 1);
  assert.equal(texts[0], 'coding mascot is a brass fox');
});

test('consolidateMemory extracts a correction-style memory from a corrective turn', () => {
  const { consolidateMemory, buildCorrectionProvenance } = buildApi();
  const messages = [
    { role: 'user', content: 'Actually, my favorite tea is lapsang souchong now.' },
    { role: 'assistant', content: 'Got it.' },
  ];
  const existingMemory = {
    memories: [
      { text: 'Favorite tea is oolong', kind: 'preference', ts: 1 },
    ],
  };
  const patch = consolidateMemory(messages, existingMemory);
  const provenance = buildCorrectionProvenance(existingMemory.memories, messages[0].content);

  assert.ok(patch.memories.some((item) => /lapsang souchong/i.test(item.text)));
  assert.equal(patch.memories.some((item) => /oolong/i.test(item.text)), false);
  assert.equal(patch.memories.some((item) => /actually/i.test(item.text)), false);
  assert.equal(provenance.length, 1);
  assert.equal(provenance[0].conflictKey, 'favorite tea');
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
  assert.equal(prepared.memory.memories.some((item) => /rainy cyberpunk vibes/i.test(item.text)), false);
  assert.equal(prepared.patch.memories.some((item) => /rainy cyberpunk vibes/i.test(item.text)), false);
  assert.ok(prepared.patch.reviewCandidates.some((item) => /rainy cyberpunk vibes/i.test(item.text)));
  assert.equal(prepared.patch.reviewCandidates[0].source, 'review-candidate');
  assert.deepEqual(prepared.patch.provenance, []);
});

test('consolidateMemory routes non-explicit conversational facts into review candidates', () => {
  const { consolidateMemory } = buildApi();
  const patch = consolidateMemory([
    { role: 'user', content: "I'm into rainy cyberpunk vibes." },
  ], { memories: [] });

  assert.equal(patch.memories.length, 0);
  assert.ok(patch.reviewCandidates.some((item) => /rainy cyberpunk vibes/i.test(item.text)));
  assert.equal(patch.reviewCandidates[0].source, 'review-candidate');
});

test('consolidateMemory does not turn direct memory-authority questions into review candidates', () => {
  const { consolidateMemory } = buildApi();
  const patch = consolidateMemory([
    { role: 'user', content: 'What should you remember about my coding setup?' },
  ], { memories: [] });

  assert.equal(patch.memories.length, 0);
  assert.deepEqual(patch.reviewCandidates, []);
});

test('buildChatMemoryStateFromDiskMemory includes correction provenance with a stable conflict key', () => {
  const { buildChatMemoryStateFromDiskMemory } = buildApi();
  const prepared = buildChatMemoryStateFromDiskMemory(
    {
      sessionId: 'demo',
      userName: '',
      voiceOn: false,
      brainMode: 'local',
      memories: [{ text: 'Favorite tea is oolong', kind: 'preference', ts: 1 }],
    },
    {},
    [{ role: 'user', content: 'Actually, my favorite tea is lapsang souchong now.' }],
  );

  assert.equal(prepared.patch.provenance.length, 1);
  assert.equal(prepared.patch.provenance[0].conflictKey, 'favorite tea');
  assert.match(prepared.patch.provenance[0].newText, /lapsang souchong/i);
});

test('buildChatMemoryStateFromDiskMemory replaces superseded explicit truth after a correction', () => {
  const { buildChatMemoryStateFromDiskMemory } = buildApi();
  const prepared = buildChatMemoryStateFromDiskMemory(
    {
      sessionId: 'demo',
      userName: '',
      voiceOn: false,
      brainMode: 'local',
      memories: [
        { text: 'coding mascot is a brass fox', kind: 'explicit', ts: 1 },
        { text: 'backup mug is orange', kind: 'explicit', ts: 2 },
      ],
    },
    {},
    [{ role: 'user', content: 'Correction: my coding mascot is a copper rabbit now, not a brass fox.' }],
  );

  const texts = prepared.memory.memories.map((item) => item.text);
  assert.ok(texts.includes('coding mascot is a copper rabbit now, not a brass fox'));
  assert.ok(texts.includes('backup mug is orange'));
  assert.equal(texts.includes('coding mascot is a brass fox'), false);
});
