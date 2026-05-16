const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeText,
  detectMetaLeak,
  findFileWriteTarget,
  stripMoodTag,
} = require('../scripts/qa-penny-voice-writing-compare');

test('detectMetaLeak catches tool-loop planning spill in visible replies', () => {
  const text = [
    'The tool execution confirmed:',
    "1. A file was created at `Penny's Playground/example.md`.",
    'I must override it with a full Penny response.',
    '[MOOD:calm]',
  ].join('\n');

  assert.equal(detectMetaLeak(text), true);
  assert.equal(analyzeText(text).metaLeak, true);
});

test('findFileWriteTarget prefers verified file-write side effects', () => {
  const target = findFileWriteTarget({
    text: "I wrote `Penny's Playground/fallback.md`.",
    meta: {
      sideEffects: [
        {
          type: 'file-write',
          target: "Penny's Playground/verified.md",
          status: 'verified',
        },
      ],
    },
  });

  assert.match(target, /Penny's Playground[\\/]verified\.md$/);
});

test('findFileWriteTarget falls back to tool labels and bare filenames', () => {
  const fromToolLabel = findFileWriteTarget({
    meta: {
      toolsUsed: [
        {
          name: 'write_project_file',
          label: "created Penny's Playground/from-tool-label.md",
        },
      ],
    },
  });
  const fromBareName = findFileWriteTarget({
    text: 'The file is `midnight_glow.md`.',
  });

  assert.match(fromToolLabel, /Penny's Playground[\\/]from-tool-label\.md$/);
  assert.match(fromBareName, /Penny's Playground[\\/]midnight_glow\.md$/);
});

test('stripMoodTag removes only the trailing mood tag', () => {
  const text = 'Warm little menace.\n[MOOD:smug]';
  assert.equal(stripMoodTag(text), 'Warm little menace.');
});
