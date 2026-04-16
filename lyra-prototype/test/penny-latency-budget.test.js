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
  assert.equal(classifyLatencyTurn({ userText: 'Open README.md and inspect it.', lane: 'tool' }), LATENCY_CLASSES.TOOL_HEAVY);
  assert.equal(classifyLatencyTurn({ userText: 'What is in this picture?', attachmentType: 'image' }), LATENCY_CLASSES.IMAGE_HEAVY);
});

test('resolveLatencyBudget keeps casual turns lean and memory turns richer', () => {
  const casual = resolveLatencyBudget({ userText: 'Hi pretty thing.' });
  const memory = resolveLatencyBudget({ userText: 'Remember what my favorite tea is now?' });
  const tool = resolveLatencyBudget({ userText: 'Open README.md and inspect it.', lane: 'tool' });

  assert.equal(casual.latencyClass, LATENCY_CLASSES.CASUAL_COMPANION);
  assert.equal(casual.allowSemanticQuery, false);
  assert.equal(casual.allowArchiveCompression, false);
  assert.equal(casual.includeExamples, false);
  assert.equal(casual.recentHistoryCount, 6);

  assert.equal(memory.latencyClass, LATENCY_CLASSES.MEMORY_HEAVY_RECALL);
  assert.equal(memory.allowSemanticQuery, true);
  assert.equal(memory.allowArchiveCompression, true);
  assert.equal(memory.includeExamples, true);
  assert.ok(memory.archiveSessionLimit > casual.archiveSessionLimit);
  assert.ok(memory.memoryPromptLimit > casual.memoryPromptLimit);

  assert.equal(tool.latencyClass, LATENCY_CLASSES.TOOL_HEAVY);
  assert.equal(tool.archiveSessionLimit, 0);
  assert.equal(tool.archiveGlobalLimit, 0);
  assert.equal(tool.allowSemanticRender, true);
});

test('getLatencyBudget returns cloned mutable copies instead of shared config objects', () => {
  const first = getLatencyBudget(LATENCY_CLASSES.CASUAL_COMPANION);
  const second = getLatencyBudget(LATENCY_CLASSES.CASUAL_COMPANION);
  first.recentHistoryCount = 99;
  assert.equal(second.recentHistoryCount, 6);
});
