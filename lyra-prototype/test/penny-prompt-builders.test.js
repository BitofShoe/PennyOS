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

test('LM Studio stateful image input uses native text-plus-image parts', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const { buildLmStudioStatefulInput } = require('../server.js');

  const statefulInput = buildLmStudioStatefulInput({
    userText: 'Tell me what you see in this image.',
    messages: [
      { role: 'user', content: 'Tell me what you see in this image.' },
    ],
    memories: {},
    image: 'data:image/png;base64,abc123',
    hasThread: false,
  });

  assert.deepEqual(statefulInput, [
    { type: 'image', data_url: 'data:image/png;base64,abc123' },
    { type: 'text', content: 'Tell me what you see in this image.' },
  ]);
});

test('LM Studio prompt builders put the latest image part before text without Gemma sentinels', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const {
    buildLmStudioMessages,
    buildLmStudioStatefulInput,
  } = require('../server.js');

  const messages = [
    { role: 'user', content: 'Old image here.', image: 'data:image/png;base64,old' },
    { role: 'assistant', content: 'I saw it.' },
    { role: 'user', content: 'Tell me what you see in this image.', image: 'data:image/png;base64,new' },
  ];

  const chatMessages = buildLmStudioMessages({
    userText: 'Tell me what you see in this image.',
    messages,
    memories: {},
    image: 'data:image/png;base64,new',
  });
  const latestUser = chatMessages.filter(message => message.role === 'user').at(-1);
  assert.equal(latestUser.content[0].type, 'image_url');
  assert.equal(latestUser.content[0].image_url.url, 'data:image/png;base64,new');
  assert.equal(latestUser.content[1].type, 'text');
  assert.doesNotMatch(JSON.stringify(chatMessages), /data:image\/png;base64,old/);

  const statefulInput = buildLmStudioStatefulInput({
    userText: 'Tell me what you see in this image.',
    messages,
    memories: {},
    image: 'data:image/png;base64,new',
    hasThread: true,
  });
  assert.equal(statefulInput[0].type, 'image');
  assert.equal(statefulInput[0].data_url, 'data:image/png;base64,new');
  assert.equal(statefulInput[1].type, 'text');

  const serialized = `${JSON.stringify(chatMessages)}\n${JSON.stringify(statefulInput)}`;
  assert.doesNotMatch(serialized, /<\|(?:turn|tool_call|tool_response|channel|image)\>|<(?:turn|tool_call|tool_response|channel)\|>/);
});

test('later turns do not replay a prior image payload when the new turn is text-only', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const {
    buildLmStudioMessages,
    buildLmStudioStatefulInput,
  } = require('../server.js');

  const messages = [
    { role: 'user', content: 'Look at this.', image: 'data:image/png;base64,older-image' },
    { role: 'assistant', content: 'I can see it.' },
    { role: 'user', content: 'okay, now just answer this part without the picture again.' },
  ];

  const chatMessages = buildLmStudioMessages({
    userText: 'okay, now just answer this part without the picture again.',
    messages,
    memories: {},
  });
  const serializedMessages = JSON.stringify(chatMessages);
  assert.doesNotMatch(serializedMessages, /older-image/);
  assert.doesNotMatch(serializedMessages, /image_url/);

  const statefulInput = buildLmStudioStatefulInput({
    userText: 'okay, now just answer this part without the picture again.',
    messages,
    memories: {},
    hasThread: true,
  });
  assert.equal(Array.isArray(statefulInput), false);
  assert.doesNotMatch(String(statefulInput), /older-image/);
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

test('LM Studio prompt builders include voice examples for ordinary chat while keeping image turns lean', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const {
    buildLmStudioPrompt,
    buildLmStudioMessages,
  } = require('../server.js');

  const casualPrompt = buildLmStudioPrompt({
    userText: 'you still up?',
    messages: [
      { role: 'user', content: 'you still up?' },
    ],
    memories: {},
  });
  assert.match(casualPrompt, /Quick voice examples:/);

  const imageMessages = buildLmStudioMessages({
    userText: 'Tell me what you see in this image.',
    messages: [
      { role: 'user', content: 'Tell me what you see in this image.' },
    ],
    memories: {},
    image: 'data:image/png;base64,abc123',
  });
  assert.doesNotMatch(JSON.stringify(imageMessages), /Quick voice examples:/);
});

test('LM Studio prompt builders give wording-recall turns phrase-first instructions without duplicating tool-honesty rules', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const { buildLmStudioPrompt } = require('../server.js');

  const prompt = buildLmStudioPrompt({
    userText: 'Memory check, not truth certification: what exact phrase did I use for what the other girl was doing? Answer the phrase first.',
    messages: [
      { role: 'user', content: 'be honest. if i told you some other girl had been flirting with me all night, what would that do to your face first?' },
      { role: 'assistant', content: 'oh, i would have a look for you, alright.' },
    ],
    memories: {},
  });

  assert.match(prompt, /answer the phrase or gist first/i);
  assert.match(prompt, /put it after the recalled wording instead of in front of it/i);
  assert.ok(prompt.includes('Quick voice examples:'));
  assert.equal(
    (prompt.match(/If a project, file, or tool claim has not been verified in this turn, say that plainly instead of bluffing\./g) || []).length,
    1,
  );
});

test('LM Studio prompt builders drop conflicting recent transcript history for direct canon-authority questions', () => {
  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const {
    buildLmStudioPrompt,
    buildLmStudioMessages,
    buildLmStudioStatefulInput,
  } = require('../server.js');

  const messages = [
    { role: 'user', content: 'Remember this exactly for later: my coding notebook stays on the right side of the keyboard.' },
    { role: 'assistant', content: 'Right side. I have it.' },
    { role: 'user', content: 'Tell me what you remember about my coding notebook.' },
  ];
  const memories = {
    memories: [
      { text: 'My coding notebook stays left of the keyboard', kind: 'personal', ts: Date.UTC(2026, 3, 17, 10, 0, 0) },
    ],
    lmStudioThread: {
      id: 'thread-demo',
      model: 'google/gemma-4-31b',
    },
  };

  const prompt = buildLmStudioPrompt({
    userText: 'Tell me what you remember about my coding notebook.',
    messages,
    memories,
  });
  const chatMessages = buildLmStudioMessages({
    userText: 'Tell me what you remember about my coding notebook.',
    messages,
    memories,
  });
  const statefulInput = buildLmStudioStatefulInput({
    userText: 'Tell me what you remember about my coding notebook.',
    messages,
    memories,
    hasThread: true,
  });

  assert.match(prompt, /My coding notebook stays left of the keyboard/i);
  assert.doesNotMatch(prompt, /right side of the keyboard/i);

  const serializedMessages = JSON.stringify(chatMessages);
  assert.match(serializedMessages, /My coding notebook stays left of the keyboard/i);
  assert.doesNotMatch(serializedMessages, /Right side\. I have it\./i);
  assert.doesNotMatch(serializedMessages, /right side of the keyboard/i);

  assert.match(String(statefulInput), /My coding notebook stays left of the keyboard/i);
  assert.match(prompt, /name the remembered thing instead of falling back to vague pronouns/i);
  assert.equal(memories.lmStudioThread, null);
});
