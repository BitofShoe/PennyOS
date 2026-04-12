const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeMemoryItems,
  selectMemoriesForPrompt,
  formatPromptMemories,
  injectRelevantMemoryContext,
} = require('../lib/penny-memory');

test('mergeMemoryItems deduplicates normalized text and drops junk', () => {
  const now = Date.UTC(2026, 3, 12);
  const items = mergeMemoryItems([
    { text: ' My favorite tea is lapsang souchong. ', kind: 'preference', ts: now - 1000 },
    { text: 'my favorite tea is lapsang souchong', kind: 'preference', ts: now },
    { text: 'ok', kind: 'observation' },
    { text: ''.padEnd(240, 'x'), kind: 'observation' },
  ], 30, now);

  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'My favorite tea is lapsang souchong');
  assert.equal(items[0].kind, 'preference');
});

test('selectMemoriesForPrompt prefers relevant overlap over unrelated memories', () => {
  const now = Date.UTC(2026, 3, 12);
  const memories = {
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now - 1000 },
      { text: 'Has a dog named Juniper', kind: 'personal', ts: now - 2000 },
      { text: 'Likes rainy cyberpunk vibes', kind: 'observation', ts: now - 3000 },
    ],
  };

  const selected = selectMemoriesForPrompt(memories, 'What tea do I like again?', 2, now);
  assert.equal(selected.length, 2);
  assert.match(selected[0].text, /tea/i);
});

test('formatPromptMemories returns fallback when nothing survives normalization', () => {
  const out = formatPromptMemories({ memories: [{ text: 'x' }] }, 'tea question', 3, '- Nothing yet.', Date.UTC(2026, 3, 12));
  assert.equal(out, '- Nothing yet.');
});

test('injectRelevantMemoryContext prepends selected memories', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = injectRelevantMemoryContext(
    'Current user message body',
    { memories: [{ text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now }] },
    'What tea do I like?',
    3,
    now,
  );

  assert.match(out, /Relevant memory for this reply:/);
  assert.match(out, /Favorite tea is lapsang souchong/);
  assert.match(out, /Current user message:/);
});
