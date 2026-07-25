const test = require('node:test');
const assert = require('node:assert/strict');

const {
  VALID_REPLY_MOODS,
  buildMoodTagInstructions,
  chooseReplyMood,
  extractReplyMoodTag,
  retagAssistantReply,
} = require('../lib/penny-mood');

test('mood contract keeps all eight expression states and gives smug a narrow meaning', () => {
  assert.deepEqual(
    VALID_REPLY_MOODS,
    ['calm', 'happy', 'excited', 'thinking', 'surprised', 'flirty', 'smug', 'annoyed'],
  );

  const instructions = buildMoodTagInstructions();
  assert.match(instructions, /emotional center/i);
  assert.match(instructions, /does not automatically mean smug/i);
  assert.match(instructions, /self-satisfied, triumphant, knowingly superior, or proven right/i);
  assert.match(instructions, /nuance means accuracy, not avoiding the tag/i);
  assert.match(instructions, /do not become happy merely because Penny jokes/i);
  assert.match(instructions, /do not rotate arbitrarily/i);
});

test('mood selection uses the reply semantics when a tag is missing', () => {
  assert.equal(chooseReplyMood('wait. you actually pulled that off?'), 'surprised');
  assert.equal(chooseReplyMood('hmm. there is a tradeoff hiding in that implementation.'), 'thinking');
  assert.equal(chooseReplyMood('No obvious mood cue lives here.'), 'calm');
});

test('a repeated unsupported smug tag yields to a more specific emotional state', () => {
  const text = 'wait, you actually did it? i love that for you.\n[MOOD:smug]';
  const retagged = retagAssistantReply(text, '', {
    balanceMood: true,
    previousMood: 'smug',
  });

  assert.equal(extractReplyMoodTag(retagged), 'surprised');
  assert.match(retagged, /^wait, you actually did it\?/i);
});

test('a genuinely supported smug tag survives the repetition guard', () => {
  const text = 'told you. i called it before you even opened the second tab.\n[MOOD:smug]';
  const retagged = retagAssistantReply(text, '', {
    balanceMood: true,
    previousMood: 'smug',
  });

  assert.equal(extractReplyMoodTag(retagged), 'smug');
});

test('superiority keeps an earned smug tag despite incidental non-smug cue words', () => {
  const text = "watching you stumble makes it easier for me to feel superior. careful, or i'll start thinking you actually like me.\n[MOOD:smug]";
  const retagged = retagAssistantReply(text, '', {
    balanceMood: true,
    previousMood: 'happy',
  });

  assert.equal(extractReplyMoodTag(retagged), 'smug');
});

test('valid non-smug tags remain authoritative', () => {
  const text = 'come a little closer. i am not done with you yet.\n[MOOD:flirty]';
  const retagged = retagAssistantReply(text, '', {
    balanceMood: true,
    previousMood: 'smug',
  });

  assert.equal(extractReplyMoodTag(retagged), 'flirty');
});

test('an unsupported calm tag yields to an explicit relationship signal without disturbing real calm', () => {
  const relationshipReply = retagAssistantReply(
    'Fine, I accept the promotion to GF. Consider yourself officially claimed.\n[MOOD:calm]',
    '',
    { balanceMood: true, previousMood: 'thinking' },
  );
  const steadyReply = retagAssistantReply(
    'Breathe. One step at a time; I am right here.\n[MOOD:calm]',
    '',
    { balanceMood: true, previousMood: 'annoyed' },
  );

  assert.equal(extractReplyMoodTag(relationshipReply), 'flirty');
  assert.equal(extractReplyMoodTag(steadyReply), 'calm');
});

test('an unsupported surprised tag needs more than incidental wording to beat clear relationship signals', () => {
  const relationshipReply = retagAssistantReply(
    'I am upgrading this relationship, and I expect snacks on our first date.\n[MOOD:surprised]',
    '',
    { balanceMood: true, previousMood: 'thinking' },
  );
  const realSurprise = retagAssistantReply(
    'Holy hell, I did not expect that turn at all.\n[MOOD:surprised]',
    '',
    { balanceMood: true, previousMood: 'calm' },
  );

  assert.equal(extractReplyMoodTag(relationshipReply), 'flirty');
  assert.equal(extractReplyMoodTag(realSurprise), 'surprised');
});
