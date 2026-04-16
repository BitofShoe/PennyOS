const test = require('node:test');
const assert = require('node:assert/strict');

test('LM Studio prompt builders keep prompt memories single-sourced per turn', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const {
    buildLmStudioPrompt,
    buildLmStudioMessages,
    buildLmStudioStatefulInput,
  } = require('../server.js');

  const now = Date.UTC(2026, 3, 15);
  const memories = {
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
  };

  const prompt = buildLmStudioPrompt({
    userText: 'What tea do I like again?',
    messages: [
      { role: 'user', content: 'Hi Penny' },
      { role: 'assistant', content: 'Hey you.' },
    ],
    memories,
  });
  assert.equal((prompt.match(/Favorite tea is lapsang souchong/g) || []).length, 1);

  const chatMessages = buildLmStudioMessages({
    userText: 'What tea do I like again?',
    messages: [
      { role: 'user', content: 'What tea do I like again?' },
    ],
    memories,
  });
  assert.equal((JSON.stringify(chatMessages).match(/Favorite tea is lapsang souchong/g) || []).length, 1);

  const statefulSeed = buildLmStudioStatefulInput({
    userText: 'What tea do I like again?',
    messages: [
      { role: 'user', content: 'What tea do I like again?' },
    ],
    memories,
    hasThread: false,
  });
  assert.equal((String(statefulSeed).match(/Favorite tea is lapsang souchong/g) || []).length, 0);

  const statefulContinuation = buildLmStudioStatefulInput({
    userText: 'What tea do I like again?',
    messages: [
      { role: 'user', content: 'What tea do I like again?' },
    ],
    memories,
    hasThread: true,
  });
  assert.equal((String(statefulContinuation).match(/Favorite tea is lapsang souchong/g) || []).length, 1);
});

test('LM Studio prompt builders respect latency-budget history and memory limits without flattening recall turns', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const {
    buildLmStudioPrompt,
    buildLmStudioMessages,
  } = require('../server.js');

  const messages = [
    { role: 'user', content: 'm1-user' },
    { role: 'assistant', content: 'm1-assistant' },
    { role: 'user', content: 'm2-user' },
    { role: 'assistant', content: 'm2-assistant' },
    { role: 'user', content: 'm3-user' },
    { role: 'assistant', content: 'm3-assistant' },
    { role: 'user', content: 'm4-user' },
    { role: 'assistant', content: 'm4-assistant' },
  ];
  const memories = {
    memories: Array.from({ length: 10 }, (_, index) => ({
      text: `Memory line ${index + 1}`,
      kind: 'fact',
      ts: Date.UTC(2026, 3, 15, 12, index, 0),
    })),
  };

  const casualPrompt = buildLmStudioPrompt({
    userText: 'Hey, missed you a little.',
    messages,
    memories,
    latencyBudget: {
      latencyClass: 'casual-companion',
      recentHistoryCount: 2,
      memoryPromptLimit: 3,
      includeExamples: false,
    },
  });

  const memoryPrompt = buildLmStudioPrompt({
    userText: 'Remember what my favorite tea is now?',
    messages,
    memories,
    latencyBudget: {
      latencyClass: 'memory-heavy-recall',
      recentHistoryCount: 6,
      memoryPromptLimit: 6,
      includeExamples: true,
    },
  });

  const toolMessages = buildLmStudioMessages({
    userText: 'Open README.md and inspect it.',
    messages,
    memories,
    latencyBudget: {
      latencyClass: 'tool-heavy',
      recentHistoryCount: 2,
      memoryPromptLimit: 4,
      includeExamples: false,
    },
  });

  assert.ok(casualPrompt.includes('m4-user'));
  assert.ok(casualPrompt.includes('m4-assistant'));
  assert.ok(!casualPrompt.includes('m1-user'));
  assert.ok(!casualPrompt.includes('Memory line 4'));
  assert.ok(casualPrompt.includes('Memory line 1'));

  assert.ok(memoryPrompt.includes('m2-user'));
  assert.ok(memoryPrompt.includes('m4-assistant'));
  assert.ok(memoryPrompt.includes('Memory line 6'));
  assert.ok(memoryPrompt.includes('Quick voice examples:'));

  const toolSerialized = JSON.stringify(toolMessages);
  assert.ok(toolSerialized.includes('m4-user'));
  assert.ok(!toolSerialized.includes('m1-user'));
  assert.ok(!toolSerialized.includes('Quick voice examples:'));
});
