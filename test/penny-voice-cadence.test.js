'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConversationVoiceGuard,
} = require('../lib/penny-voice-cadence');

test('conversation voice guard is quiet on a fresh or already-varied exchange', () => {
  assert.equal(buildConversationVoiceGuard({ messages: [], userText: 'hi' }), '');
  assert.equal(buildConversationVoiceGuard({
    messages: [
      { role: 'assistant', content: 'That worked. Disgusting little miracle.\n[MOOD:happy]' },
    ],
    userText: 'I know, right?',
  }), '');
});

test('conversation voice guard protects real constraints without forcing a short reply after one long answer', () => {
  const guard = buildConversationVoiceGuard({
    messages: [
      {
        role: 'assistant',
        content: `${Array.from({ length: 115 }, (_, index) => `word${index}`).join(' ')} Absolutely pathetic disaster. Go. Now.\n[MOOD:smug]`,
      },
    ],
    userText: 'I am stuck between the adult club I want and the teen club that gets more funding.',
  });

  assert.match(guard, /absolutely/i);
  assert.match(guard, /pathetic/i);
  assert.match(guard, /disaster/i);
  assert.match(guard, /binding constraint/i);
  assert.doesNotMatch(guard, /under \d+ words|true short beat|prefer a compact beat/i);
  assert.doesNotMatch(guard, /end declaratively/i);
});

test('conversation voice guard does not force a cadence change after one long reply', () => {
  const guard = buildConversationVoiceGuard({
    messages: [
      {
        role: 'assistant',
        content: `${Array.from({ length: 115 }, (_, index) => `word${index}`).join(' ')}\n[MOOD:thinking]`,
      },
    ],
    userText: 'Anyway, I bought a tiny frog mug.',
  });

  assert.equal(guard, '');
});

test('conversation voice guard suggests an underused shape only after a repeated length pattern', () => {
  const mediumReply = (label) => Array.from({ length: 55 }, (_, index) => `${label}${index}`).join(' ');
  const guard = buildConversationVoiceGuard({
    messages: [
      { role: 'assistant', content: `${mediumReply('alpha')}\n[MOOD:calm]` },
      { role: 'assistant', content: `${mediumReply('bravo')}\n[MOOD:happy]` },
    ],
    userText: 'Anyway, I bought a tiny frog mug.',
  });

  assert.match(guard, /underused shape is a short, surgical beat/i);
  assert.match(guard, /pick one detail only/i);
  assert.match(guard, /no fixed word quota/i);
  assert.match(guard, /do not alternate mechanically/i);
});

test('conversation voice guard breaks repeated quote-and-pounce openings', () => {
  const guard = buildConversationVoiceGuard({
    messages: [
      { role: 'assistant', content: 'Smol bean." That is a choice.\n[MOOD:smug]' },
      { role: 'assistant', content: 'Felt fruit." Devastating.\n[MOOD:annoyed]' },
    ],
    userText: 'I have another confession.',
  });

  assert.match(guard, /do not open by quoting or paraphrasing/i);
});

test('conversation voice guard reacts to command concentration across a recent window', () => {
  const guard = buildConversationVoiceGuard({
    messages: [
      { role: 'assistant', content: 'Drink some water. Go. Now.\n[MOOD:annoyed]' },
      { role: 'user', content: 'Fine, I did.' },
      { role: 'assistant', content: 'Good. Basic survival has been achieved.\n[MOOD:calm]' },
      { role: 'user', content: 'I also found my glasses.' },
      { role: 'assistant', content: 'Excellent. Put them somewhere sensible.\n[MOOD:happy]' },
    ],
    userText: 'I have another update.',
  });

  assert.match(guard, /recent endings have become command-heavy/i);
  assert.match(guard, /end declaratively/i);
});
