const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPromptStack,
  resolvePromptOverlays,
  resolvePromptSlotRegistry,
} = require('../lib/penny-prompt-stack');

test('resolvePromptOverlays keeps lane overlays scoped and blocks tool scene overlays plus semantic-render overlays', () => {
  const overlays = [
    { id: 'tool-tech', appliesTo: { lane: ['tool'] }, text: 'Tool overlay', enabled: true },
    { id: 'tool-scene', appliesTo: { lane: ['tool'], sceneFamily: ['romance'] }, text: 'Romantic overlay', enabled: true },
    { id: 'image', appliesTo: { lane: ['chat'], attachmentType: ['image'] }, text: 'Image overlay', enabled: true },
    { id: 'shadow', appliesTo: { lane: ['shadow'], mode: ['shadow'] }, text: 'Shadow overlay', enabled: true },
  ];

  const tool = resolvePromptOverlays(overlays, { lane: 'tool', mode: 'local', attachmentType: 'none' });
  const image = resolvePromptOverlays(overlays, { lane: 'chat', mode: 'local', attachmentType: 'image' });
  const shadow = resolvePromptOverlays(overlays, { lane: 'shadow', mode: 'shadow', attachmentType: 'none' });
  const semantic = resolvePromptOverlays(overlays, { lane: 'semantic-render', mode: 'local', attachmentType: 'none' });

  assert.deepEqual(tool.map((item) => item.id), ['tool-tech']);
  assert.deepEqual(image.map((item) => item.id), ['image']);
  assert.deepEqual(shadow.map((item) => item.id), ['shadow']);
  assert.deepEqual(semantic.map((item) => item.id), []);
});

test('resolvePromptSlotRegistry keeps the slot order finite and lane-aware', () => {
  const toolSlots = resolvePromptSlotRegistry('tool');
  const semanticSlots = resolvePromptSlotRegistry('semantic-render');

  assert.deepEqual(toolSlots.map((slot) => slot.id), ['voiceBlend', 'directives', 'overlays', 'examples', 'memory']);
  assert.deepEqual(toolSlots.map((slot) => slot.enabled), [true, true, true, false, true]);
  assert.deepEqual(semanticSlots.map((slot) => slot.enabled), [true, true, false, false, true]);
});

test('buildPromptStack keeps the slot order stable and excludes examples on tool and overlays/examples on semantic-render', () => {
  const toolResult = buildPromptStack({
    assets: {
      blend: 'Blend section',
      chatDirectives: 'Directive section',
      examples: 'Example section',
      overlays: [
        { id: 'tool-tech', appliesTo: { lane: ['tool'] }, text: 'Tool overlay', enabled: true },
        { id: 'tool-scene', appliesTo: { lane: ['tool'], sceneFamily: ['romance'] }, text: 'Romantic overlay', enabled: true },
      ],
    },
    memories: {
      memories: [
        { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: Date.UTC(2026, 3, 12) },
      ],
      memoryBookContext: {
        matches: [
          { id: 'appearance', text: 'Penny has coral hair when the user explicitly asks.', priority: 90, score: 102 },
        ],
      },
      archiveContext: {
        session: [{ text: 'We were just talking about midnight rain.' }],
        global: [{ text: 'They keep returning to midnight rain.' }],
      },
    },
    lane: 'tool',
    mode: 'local',
    includeExamples: true,
    memoryLimit: 8,
    fallbackMemory: '- Nothing yet.',
  });

  const semanticResult = buildPromptStack({
    assets: {
      blend: 'Blend section',
      chatDirectives: 'Directive section',
      examples: 'Example section',
      overlays: [
        { id: 'shadow', appliesTo: { lane: ['shadow'], mode: ['shadow'] }, text: 'Shadow overlay', enabled: true },
      ],
    },
    memories: {
      memories: [
        { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: Date.UTC(2026, 3, 12) },
      ],
      memoryBookContext: {
        matches: [
          { id: 'appearance', text: 'Penny has coral hair when the user explicitly asks.', priority: 90, score: 102 },
        ],
      },
      archiveContext: {
        session: [{ text: 'We were just talking about midnight rain.' }],
        global: [{ text: 'They keep returning to midnight rain.' }],
      },
    },
    lane: 'semantic-render',
    mode: 'local',
    includeExamples: true,
    memoryLimit: 8,
    fallbackMemory: '- Nothing yet.',
  });

  const toolSlotIds = toolResult.slots.map((slot) => slot.id);
  const toolSlotFlags = toolResult.slots.map((slot) => slot.enabled);
  const semanticSlotFlags = semanticResult.slots.map((slot) => slot.enabled);

  const toolOverlayIndex = toolResult.stack.indexOf('Lane overlays:');
  const toolExamplesIndex = toolResult.stack.indexOf('Quick voice examples:');
  const semanticOverlayIndex = semanticResult.stack.indexOf('Lane overlays:');
  const semanticExamplesIndex = semanticResult.stack.indexOf('Quick voice examples:');
  const booksIndex = toolResult.memoryBlock.indexOf('memory book: Penny has coral hair when the user explicitly asks');
  const explicitIndex = toolResult.memoryBlock.indexOf('Favorite tea is lapsang souchong');
  const sessionIndex = toolResult.memoryBlock.indexOf('Wake state - active session context:');

  assert.deepEqual(toolSlotIds, ['voiceBlend', 'directives', 'overlays', 'examples', 'memory']);
  assert.deepEqual(toolSlotFlags, [true, true, true, false, true]);
  assert.deepEqual(semanticSlotFlags, [true, true, false, false, true]);
  assert.ok(toolResult.stack.indexOf('Runtime voice blend:') < toolResult.stack.indexOf('Conversation directives:'));
  assert.ok(toolResult.stack.indexOf('Conversation directives:') < toolOverlayIndex);
  assert.ok(toolOverlayIndex >= 0);
  assert.ok(toolExamplesIndex < 0);
  assert.ok(toolResult.stack.includes('Tool overlay'));
  assert.ok(!toolResult.stack.includes('Romantic overlay'));
  assert.ok(semanticOverlayIndex < 0);
  assert.ok(semanticExamplesIndex < 0);
  assert.ok(semanticResult.stack.includes('Blend section'));
  assert.ok(semanticResult.stack.includes('Directive section'));
  assert.ok(!semanticResult.stack.includes('Shadow overlay'));
  assert.ok(booksIndex >= 0);
  assert.ok(explicitIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(explicitIndex < booksIndex);
  assert.ok(booksIndex < sessionIndex);
});
