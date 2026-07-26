'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildVoiceCadenceRepairPrompt,
  buildConversationVoiceGuard,
  evaluateVoiceCadenceRepairCandidate,
  inspectVoiceCadenceDraft,
  maybeRepairVoiceCadenceReply,
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

test('conversation voice guard protects real constraints without steering reply length', () => {
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
  assert.doesNotMatch(guard, /short|long|medium|word quota|sentence|paragraph|cadence|length/i);
  assert.doesNotMatch(guard, /end declaratively/i);
});

test('conversation voice guard does not force a length change after one long reply', () => {
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

test('conversation voice guard ignores repeated length patterns instead of prescribing an underused shape', () => {
  const mediumReply = (label) => Array.from({ length: 55 }, (_, index) => `${label}${index}`).join(' ');
  const guard = buildConversationVoiceGuard({
    messages: [
      { role: 'assistant', content: `${mediumReply('alpha')}\n[MOOD:calm]` },
      { role: 'assistant', content: `${mediumReply('bravo')}\n[MOOD:happy]` },
    ],
    userText: 'Anyway, I bought a tiny frog mug.',
  });

  assert.equal(guard, '');
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

test('voice cadence inspection allows one isolated crutch but flags a repeated one', () => {
  const messages = [
    { role: 'assistant', content: 'That is honestly pathetic.\n[MOOD:annoyed]' },
  ];

  assert.equal(inspectVoiceCadenceDraft({
    text: 'That plan is pathetic in an entirely different way.\n[MOOD:smug]',
    messages: [],
  }).needsRepair, false);

  const repeated = inspectVoiceCadenceDraft({
    text: 'That plan is pathetic in an entirely different way.\n[MOOD:smug]',
    messages,
  });
  assert.equal(repeated.needsRepair, true);
  assert.deepEqual(repeated.guardCodes, ['repeated_voice_crutch']);
  assert.deepEqual(repeated.repeatedCrutches, ['pathetic']);
});

test('voice cadence inspection flags clustered stock constructions in one paragraph', () => {
  const inspection = inspectVoiceCadenceDraft({
    text: 'Look at this absolute circus. It is honestly pathetic.\n\nThe giveaway bot is doing the rest.\n[MOOD:annoyed]',
  });

  assert.equal(inspection.needsRepair, true);
  assert.deepEqual(inspection.guardCodes, ['clustered_voice_crutches']);
  assert.ok(inspection.clusteredCrutches.includes('absolute/absolutely'));
  assert.ok(inspection.clusteredCrutches.includes('pathetic'));
  assert.ok(inspection.clusteredCrutches.includes('honestly + stock judgment'));
});

test('voice cadence inspection does not combine isolated wording across separate paragraphs', () => {
  const inspection = inspectVoiceCadenceDraft({
    text: 'The absolute limit is ten.\n\nCalling the error message pathetic would be generous.\n[MOOD:thinking]',
  });

  assert.equal(inspection.needsRepair, false);
});

test('voice cadence repair prompt preserves substance and natural reply size', () => {
  const prompt = buildVoiceCadenceRepairPrompt({
    userText: 'What am I watching?',
    text: 'Look at this absolute circus. It is honestly pathetic.\n[MOOD:annoyed]',
  });

  assert.match(prompt, /not a new conversational turn/i);
  assert.match(prompt, /approximately the same size/i);
  assert.match(prompt, /Do not summarize it, pad it, or force it/i);
  assert.match(prompt, /Change only the minimum wording/i);
  assert.match(prompt, /What am I watching\?/);
});

test('voice cadence repair candidate rejects lingering crutches and shape drift', () => {
  const originalText = 'Look at this absolute circus. It is honestly pathetic, and the giveaway bot makes the whole room feel even cheaper.';

  assert.equal(evaluateVoiceCadenceRepairCandidate({
    originalText,
    candidateText: 'Still an absolute circus, and honestly pathetic.',
  }).reason, 'voice-guard-still-triggered');

  assert.equal(evaluateVoiceCadenceRepairCandidate({
    originalText,
    candidateText: 'Cheap.',
  }).reason, 'reply-shape-drift');

  assert.equal(evaluateVoiceCadenceRepairCandidate({
    originalText,
    candidateText: 'This whole chat reads like a locker room audition, and the giveaway bot somehow makes every desperate bid for attention feel even cheaper.',
  }).accepted, true);
});

test('voice cadence repair retries once and accepts only a clean surface edit', async () => {
  const calls = [];
  const result = await maybeRepairVoiceCadenceReply({
    userText: 'What am I watching?',
    text: 'Look at this absolute circus. It is honestly pathetic, and the giveaway bot makes the whole room feel even cheaper.',
    rewrite: async (prompt) => {
      calls.push(prompt);
      return 'This chat is a locker room audition. The giveaway bot turns every desperate bid for attention into something even cheaper.';
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(result.repair.repairAttempted, true);
  assert.equal(result.repair.repairAccepted, true);
  assert.equal(result.repair.finalCandidateSource, 'repair');
  assert.match(result.text, /locker room audition/i);
});

test('voice cadence repair keeps the original if the one retry still fails', async () => {
  const originalText = 'Look at this absolute circus. It is honestly pathetic, and the giveaway bot makes the whole room feel even cheaper.';
  let calls = 0;
  const result = await maybeRepairVoiceCadenceReply({
    userText: 'What am I watching?',
    text: originalText,
    rewrite: async () => {
      calls += 1;
      return 'Still an absolute circus. Still honestly pathetic.';
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.text, originalText);
  assert.equal(result.repair.repairAccepted, false);
  assert.equal(result.repair.repairRejectedReason, 'voice-guard-still-triggered');
  assert.equal(result.repair.finalCandidateSource, 'first-pass');
});
