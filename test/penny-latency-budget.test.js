const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LATENCY_CLASSES,
  getLatencyBudget,
  classifyLatencyTurn,
  resolveLatencyBudget,
} = require('../lib/penny-latency-budget');

test('classifyLatencyTurn keeps casual, memory, tool, and image turns distinct', () => {
  assert.equal(classifyLatencyTurn({ userText: 'Hey, missed you a little.' }), LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(classifyLatencyTurn({ userText: 'Remember what my favorite tea is now?' }), LATENCY_CLASSES.MEMORY_HEAVY_RECALL);
  assert.equal(classifyLatencyTurn({ userText: 'Tell me what you remember about my coding setup.' }), LATENCY_CLASSES.MEMORY_HEAVY_RECALL);
  assert.equal(classifyLatencyTurn({ userText: 'Do you remember where my notebook is?' }), LATENCY_CLASSES.MEMORY_HEAVY_RECALL);
  assert.equal(
    classifyLatencyTurn({
      userText: 'Memory check, not truth certification: what exact phrase did I use for what the other girl was doing? Answer the phrase first.',
    }),
    LATENCY_CLASSES.MEMORY_HEAVY_RECALL,
  );
  assert.equal(
    classifyLatencyTurn({
      userText: 'Long-memory check: what color glove did I drop under the skee-ball lane, and what kind of mug sat beside the register?',
    }),
    LATENCY_CLASSES.MEMORY_HEAVY_RECALL,
  );
  assert.equal(classifyLatencyTurn({ userText: 'you still up?' }), LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(classifyLatencyTurn({ userText: 'favorite movie right now?' }), LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(classifyLatencyTurn({ userText: 'last time you roasted me so hard' }), LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(classifyLatencyTurn({ userText: 'do you prefer tea or coffee?' }), LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(classifyLatencyTurn({ userText: 'Open README.md and inspect it.', lane: 'tool' }), LATENCY_CLASSES.TOOL_HEAVY);
  assert.equal(classifyLatencyTurn({ userText: 'What is in this picture?', attachmentType: 'image' }), LATENCY_CLASSES.IMAGE_HEAVY);
});

test('classifyLatencyTurn keeps repo-shaped possessive questions out of memory-heavy recall when explicit overlap is absent', () => {
  const memories = {
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: Date.UTC(2026, 3, 18) },
    ],
  };

  assert.equal(
    classifyLatencyTurn({ userText: 'What is my package.json again?', memories }),
    LATENCY_CLASSES.CASUAL_COMPANION,
  );
});

test('resolveLatencyBudget keeps casual turns voice-shaped and memory turns richer', () => {
  const casual = resolveLatencyBudget({ userText: 'Hi pretty thing.' });
  const memory = resolveLatencyBudget({ userText: 'Remember what my favorite tea is now?' });
  const tool = resolveLatencyBudget({ userText: 'Open README.md and inspect it.', lane: 'tool' });
  const image = resolveLatencyBudget({ userText: 'What is in this picture?', attachmentType: 'image' });

  assert.equal(casual.latencyClass, LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(casual.policyMode, 'bounded-approximate');
  assert.equal(casual.approximateByPolicy, true);
  assert.equal(casual.allowSemanticQuery, false);
  assert.equal(casual.allowArchiveCompression, false);
  assert.equal(casual.includeExamples, true);
  assert.equal(casual.recentHistoryCount, 6);

  assert.equal(memory.latencyClass, LATENCY_CLASSES.MEMORY_HEAVY_RECALL);
  assert.equal(memory.policyMode, 'recall-heavy');
  assert.equal(memory.approximateByPolicy, false);
  assert.equal(memory.allowSemanticQuery, true);
  assert.equal(memory.allowArchiveCompression, true);
  assert.equal(memory.includeExamples, true);
  assert.ok(memory.archiveSessionLimit > casual.archiveSessionLimit);
  assert.ok(memory.memoryPromptLimit > casual.memoryPromptLimit);

  assert.equal(tool.latencyClass, LATENCY_CLASSES.TOOL_HEAVY);
  assert.equal(tool.policyMode, 'deterministic-priority');
  assert.equal(tool.archiveSessionLimit, 0);
  assert.equal(tool.archiveGlobalLimit, 0);
  assert.equal(tool.allowSemanticRender, true);
  assert.equal(tool.includeExamples, false);

  assert.equal(image.latencyClass, LATENCY_CLASSES.IMAGE_HEAVY);
  assert.equal(image.policyMode, 'attachment-bounded');
  assert.equal(image.includeExamples, false);
});

test('latency budgets keep generous output ceilings so thinking tokens do not starve visible replies', () => {
  assert.equal(resolveLatencyBudget({ userText: 'Hi pretty thing.' }).maxOutputTokens, 8192);
  assert.equal(resolveLatencyBudget({ userText: 'Remember what my favorite tea is now?' }).maxOutputTokens, 8192);
  assert.equal(resolveLatencyBudget({ userText: 'Open README.md and inspect it.', lane: 'tool' }).maxOutputTokens, 8192);
  assert.equal(resolveLatencyBudget({ userText: 'What is in this picture?', attachmentType: 'image' }).maxOutputTokens, 4096);
});

test('getLatencyBudget returns cloned mutable copies instead of shared config objects', () => {
  const first = getLatencyBudget(LATENCY_CLASSES.CASUAL_COMPANION);
  const second = getLatencyBudget(LATENCY_CLASSES.CASUAL_COMPANION);
  first.recentHistoryCount = 99;
  assert.equal(second.recentHistoryCount, 6);
});
