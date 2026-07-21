const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createVisibleReplyApi,
  VISIBLE_REPLY_REASON_CODES,
} = require('../lib/penny-visible-reply');

const visibleReplyApi = createVisibleReplyApi({
  ALLOW_RAW_REASONING_FALLBACK: false,
  retagAssistantReply(text = '', preferredMood = '') {
    const stripped = String(text || '').replace(/\s*\[MOOD:\w+\]\s*/g, ' ').trim();
    const explicit = String(text || '').match(/\[MOOD:(\w+)\]/i)?.[1] || '';
    const mood = explicit || preferredMood || 'calm';
    return stripped ? `${stripped}\n[MOOD:${mood}]` : `[MOOD:${mood}]`;
  },
});

const {
  coercePennyVisibleReply,
  classifyVisibleReplyDecision,
  textFromChatMessage,
} = visibleReplyApi;

test('coercePennyVisibleReply strips single-line draft scaffolding', () => {
  const raw = `*Draft:*\n    oh, right. you vanished like I'm not supposed to talk to you anymore? bold move, stranger.\n[MOOD:smug]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(
    coercePennyVisibleReply(raw),
    `oh, right. you vanished like I'm not supposed to talk to you anymore? bold move, stranger.\n[MOOD:smug]`,
  );
  assert.equal(decision.reasonCode, VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY);
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.materialChange, false);
  assert.equal(decision.reconstructedReply, false);
  assert.equal(decision.cleanupTransform.class, 'presentation-cleanup');
  assert.equal(decision.cleanupTransform.materiality, 'surface');
  assert.equal(decision.cleanupTransform.operations.includes('drop-meta-lines'), true);
});

test('coercePennyVisibleReply strips dangling channel-thought prefixes', () => {
  const raw = `<|channel>thought\nHere's a thinking process to generate Penny's reply:\n[MOOD:calm]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `[MOOD:calm]`,
  );
});

test('coercePennyVisibleReply strips full Gemma thought-channel blocks before visible text', () => {
  const raw = `<|channel>thought\nHidden scratchpad.\n<channel|>\nVisible reply only.\n[MOOD:smug]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:smug]');
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.cleanupTransform.operations.includes('strip-internal-reasoning'), true);
});

test('coercePennyVisibleReply strips dangling Qwen reasoning tags after visible text', () => {
  const raw = `Visible reply only.\n[MOOD:smug]\n<think>\nHidden scratchpad that never closes.`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:smug]');
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.cleanupTransform.operations.includes('strip-internal-reasoning'), true);
});

test('coercePennyVisibleReply strips dangling thought-channel markers after visible text', () => {
  const raw = `Visible reply only.\n[MOOD:thinking]\n<|channel>analysis\nHidden scratchpad that never closes.`;
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:thinking]');
});

test('coercePennyVisibleReply strips empty Gemma thought markers', () => {
  const raw = `<|channel>thought\n<channel|>\nVisible reply only.\n[MOOD:calm]`;
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:calm]');
});

test('coercePennyVisibleReply strips Gemma turn wrappers without dropping visible text', () => {
  const raw = `<|turn>model\nVisible reply only.\n[MOOD:happy]\n<turn|>`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:happy]');
  assert.equal(decision.cleanupTransform.operations.includes('strip-gemma-control-wrappers'), true);
});

test('coercePennyVisibleReply strips Gemma tool call and response wrappers', () => {
  const raw = `<|tool_call>call:read_project_file{path:<|"|>README.md<|"|>}<tool_call|>\n<|tool_response>response:read_project_file{value:<|"|># Penny<|"|>}<tool_response|>\nVisible reply only.\n[MOOD:thinking]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:thinking]');
  assert.equal(decision.cleanupTransform.operations.includes('strip-gemma-control-wrappers'), true);
});

test('coercePennyVisibleReply strips one-line partial Gemma tool wrappers', () => {
  const raw = `<|tool_call>call:read_project_file{path:README.md}\n<|tool_response>response:read_project_file{value:# Penny}\nVisible reply only.\n[MOOD:thinking]`;
  assert.equal(coercePennyVisibleReply(raw), 'Visible reply only.\n[MOOD:thinking]');
});

test('coercePennyVisibleReply strips qwen polish-preface lines', () => {
  const raw = `Actually, let's make it more "Penny".\n"oh, rude? okay, fine. usually people get scared when i say exactly what\n[MOOD:annoyed]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `oh, rude? okay, fine. usually people get scared when i say exactly what\n[MOOD:annoyed]`,
  );
});

test('coercePennyVisibleReply salvages the last usable draft from thinking-process spills', () => {
  const raw = `Thinking Process:\n\n1. Analyze the Request:\n- user asked me to edit a file.\n\n*   *Draft 1:* Done. I put this in: "p.s. if you're late, I'm eating your damn pie. don't make me regret this." Now the file is four lines long. You better be on time.\n*   *Draft 2 (More Penny):* Look at that. I added a little threat to line three. Here it is: "p.s. if you're late, I'm eating your damn pie. don't make\n[MOOD:thinking]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(
    coercePennyVisibleReply(raw),
    `Done. I put this in: "p.s. if you're late, I'm eating your damn pie. don't make me regret this." Now the file is four lines long. You better be on time.\n[MOOD:thinking]`,
  );
  assert.equal(decision.reasonCode, VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE);
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.materialChange, true);
  assert.equal(decision.reconstructedReply, true);
  assert.equal(decision.cleanupTransform.class, 'salvage-reconstruction');
  assert.equal(decision.cleanupTransform.operations.includes('salvage-draft-candidate'), true);
});

test('coercePennyVisibleReply can salvage quoted reply candidates from image-planning spill', () => {
  const raw = `The mood should match her reaction to the image. Since it's an image of her being "smug," a or or could work. Let's draft the response.\n"oh, so you think this is my best angle? look at that grin. i know i can make a face like that."\n"this editor makes me look way more confident than usual. nice job on getting me to stand still long enough for this shot."\n"the headphones are the only thing keeping this outfit from looking completely corporate."\n"i see you zoomed in on my eyes too? try to keep up, i'm dangerous like that."\nActually, looking closer at the image, there are technical UI elements.\n[MOOD:smug]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    [
      'oh, so you think this is my best angle? look at that grin. i know i can make a face like that.',
      '',
      'this editor makes me look way more confident than usual. nice job on getting me to stand still long enough for this shot.',
      '',
      'the headphones are the only thing keeping this outfit from looking completely corporate.',
      '',
      "i see you zoomed in on my eyes too? try to keep up, i'm dangerous like that.",
      '[MOOD:smug]',
    ].join('\n'),
  );
  assert.equal(classifyVisibleReplyDecision(raw).reasonCode, VISIBLE_REPLY_REASON_CODES.SALVAGED_QUOTE_CANDIDATE);
});

test('coercePennyVisibleReply strips Nemotron draft-control text when no final answer exists', () => {
  const raw = `. Let's decide: If we are giving them reason to stay, maybe ? But flirty is for romantic/ charged moments. This is a friendly but inviting vibe. Might pick\n[MOOD:excited]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), '[MOOD:excited]');
  assert.equal(decision.reasonCode, VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY);
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.materialChange, true);
  assert.equal(decision.reconstructedReply, false);
  assert.equal(decision.cleanupTransform.operations.includes('drop-meta-lines'), true);
});

test('coercePennyVisibleReply does not salvage tiny quoted planning fragments', () => {
  const raw = `Make sure to include specific detail: "you turned a single worry about"\n[MOOD:calm]`;
  assert.equal(coercePennyVisibleReply(raw), '[MOOD:calm]');
  assert.equal(classifyVisibleReplyDecision(raw).cleanupApplied, true);
});

test('coercePennyVisibleReply preserves Nemotron text that is actually a reply', () => {
  const raw = `It says you love the taste of my sarcasm more than their cheap compliments.\n[MOOD:calm]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), raw);
  assert.equal(decision.cleanupApplied, false);
});

test('coercePennyVisibleReply strips copied-prompt recall deliberation', () => {
  const raw = `be honest. if i told you some other girl had been flirting ...". That's a paraphrase. Did they say something like "flirting with me all night"? Possibly the phrase is "some other girl was flirting with me all night". Need to recall from earlier conversation.\n[MOOD:smug]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), '[MOOD:smug]');
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.materialChange, true);
});

test('coercePennyVisibleReply does not salvage copied user questions as quoted answers', () => {
  const raw = `Possibly the phrase is "what exact phrase did I use for what the other girl was doing? Answer the phrase first." Need to recall from earlier conversation.\n[MOOD:smug]`;
  assert.equal(coercePennyVisibleReply(raw), '[MOOD:smug]');
});

test('coercePennyVisibleReply strips quoted draft examples from planning text', () => {
  const raw = `Maybe we can say: "I searched the repo for 'search_project_text' and found matches at src/penny/tools/file_tool.py." But we have no verification those exist. We could phrase it as the tool returned hits.\n[MOOD:thinking]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), '[MOOD:thinking]');
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.materialChange, true);
});

test('coercePennyVisibleReply strips mood-selection self-instructions', () => {
  const raw = `We must end with exactly one mood tag on its own line: choose appropriate mood (e.g., or , but allowed moods are specific list: calm, happy, excited, thinking, surprised, flirty, smug, annoyed. Warm could be "happy"? Might pick\n[MOOD:happy]`;
  const decision = classifyVisibleReplyDecision(raw);
  assert.equal(coercePennyVisibleReply(raw), '[MOOD:happy]');
  assert.equal(decision.cleanupApplied, true);
  assert.equal(decision.materialChange, true);
});

test('coercePennyVisibleReply preserves direct image observations that start with I can see', () => {
  const raw = 'I can see the image you attached. Tiny little test square, clean edges, very deliberate. [MOOD:thinking]';
  assert.equal(
    coercePennyVisibleReply(raw),
    'I can see the image you attached. Tiny little test square, clean edges, very deliberate.\n[MOOD:thinking]',
  );
  assert.equal(classifyVisibleReplyDecision(raw).reasonCode, VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY);
});

test('coercePennyVisibleReply preserves companion paragraphs that start with I can', () => {
  const raw = [
    "Slow down there, speed racer. One little test run on your phone and you're already upgrading me to girlfriend status? You are aggressively impatient.",
    '',
    "I can already tell texting me from your phone is going to make you impossible, and annoyingly, I am looking forward to it.",
    '[MOOD:flirty]',
  ].join('\n');

  assert.equal(
    coercePennyVisibleReply(raw),
    [
      "Slow down there, speed racer. One little test run on your phone and you're already upgrading me to girlfriend status? You are aggressively impatient.",
      '',
      "I can already tell texting me from your phone is going to make you impossible, and annoyingly, I am looking forward to it.",
      '[MOOD:flirty]',
    ].join('\n'),
  );
});

test('coercePennyVisibleReply preserves paragraph breaks when a streamed reply is finalized', () => {
  const raw = [
    "It doesn't change the verdict, it just makes me like you more for being a mess.",
    '',
    'This one is actually the strongest of the bunch because it stops trying to be a table of contents.',
    '',
    'Stick with that cleaned-out energy. Start with the collision.',
    '',
    '*Shoegaze colliding with local TV, old CG, tape damage, and the kind of grit that usually gets cleaned out before it reaches you.*',
    '',
    '*Three channels. The station is already on.*',
    '',
    'https://webk1nn.pages.dev/',
    '',
    "That's the one. Now stop doubting yourself and just hit send.",
    '[MOOD:smug]',
  ].join('\n');

  assert.equal(coercePennyVisibleReply(raw), raw);
});

test('coercePennyVisibleReply still strips first-person planning lines that start with I can', () => {
  const raw = [
    'I can mention the girlfriend bit, choose a flirty mood, and keep the answer short.',
    '[MOOD:flirty]',
  ].join('\n');

  assert.equal(coercePennyVisibleReply(raw), '[MOOD:flirty]');
});

test('coercePennyVisibleReply preserves companion replies that start with Okay I', () => {
  const raw = [
    "Okay, I hate to admit it, the rewired version is closer, but it still sounds like someone dressed a helpdesk script in my jacket.",
    'And please, "the F word with abandon"? You are making me sound like a sailor with a grudge.',
    '[MOOD:smug]',
  ].join('\n');

  assert.equal(
    coercePennyVisibleReply(raw),
    [
      "Okay, I hate to admit it, the rewired version is closer, but it still sounds like someone dressed a helpdesk script in my jacket.",
      'And please, "the F word with abandon"? You are making me sound like a sailor with a grudge.',
      '[MOOD:smug]',
    ].join('\n'),
  );
});

test('coercePennyVisibleReply still strips Okay I planning lines', () => {
  const raw = [
    'Okay, I should answer by comparing the two versions and then choose a smug mood.',
    'And please, "the F word with abandon"?',
    '[MOOD:smug]',
  ].join('\n');

  assert.equal(coercePennyVisibleReply(raw), 'And please, "the F word with abandon"?\n[MOOD:smug]');
});

test('coercePennyVisibleReply preserves ordinary Penny openers that look conversational', () => {
  const raw = [
    "Here's the thing: the default Pi version sounds like it was assembled in a beige conference room.",
    'First, rude. Second, accurate. That is why you came back to me.',
    '[MOOD:smug]',
  ].join('\n');

  assert.equal(coercePennyVisibleReply(raw), raw);
});

test('coercePennyVisibleReply still strips explicit draft and analysis openers', () => {
  const raw = [
    "Here's a draft: praise the current Penny, insult the bland clone, then end smug.",
    'Final answer:',
    'The default version is boring. Mine has teeth.',
    '[MOOD:smug]',
  ].join('\n');

  assert.equal(coercePennyVisibleReply(raw), 'The default version is boring. Mine has teeth.\n[MOOD:smug]');
});

test('coercePennyVisibleReply preserves structured deterministic result piles', () => {
  const raw = `yeah, the live web is mostly throwing "Latest Tech Analysis News | Digital Foundry" at me first.\n\nhere's the pile:\n1. Latest Tech Analysis News | Digital Foundry\nhttps://www.digitalfoundry.net/news\n2. Crimson Desert looks absurdly good in new preview\nhttps://www.digitalfoundry.net/crimson-desert-preview\n\npick one and i'll crack it open.\n[MOOD:thinking]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `yeah, the live web is mostly throwing "Latest Tech Analysis News | Digital Foundry" at me first.\n\nhere's the pile:\n1. Latest Tech Analysis News | Digital Foundry\nhttps://www.digitalfoundry.net/news\n2. Crimson Desert looks absurdly good in new preview\nhttps://www.digitalfoundry.net/crimson-desert-preview\n\npick one and i'll crack it open.\n[MOOD:thinking]`,
  );
});

test('coercePennyVisibleReply preserves technical bullet summaries with concrete file anchors', () => {
  const raw = `- \`README.md\` is the app-facing overview.\n- \`docs/README.md\` is the docs routing layer.\n[MOOD:thinking]`;
  assert.equal(coercePennyVisibleReply(raw), raw);
});

test('coercePennyVisibleReply falls back to final-polish draft candidates inside a single giant planning block', () => {
  const raw = `What are you looking at in this image? Be specific. Better.\n    *   *Option 3 (In Character):* Look closer. I'm not just looking at the screen, i'm looking at you while you stare at this pixelated mess.\n    *   *Refining Option 3:* Make it punchier.\n    *   *Draft:* Oh, is that what you want? Details about me? Sure thing. Look at this grin—sharp enough to cut glass.\n    *   *Adding more bite:* "I caught you staring."\n    *   *Final Polish:* Oh honey, is that really the hardest question you can come up with? Sure, I'm looking at the viewfinder. But mostly I'm looking at how much trouble it'll be for you to look away from me once you see the rest of me later.\n[MOOD:smug]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `Oh honey, is that really the hardest question you can come up with? Sure, I'm looking at the viewfinder. But mostly I'm looking at how much trouble it'll be for you to look away from me once you see the rest of me later.\n[MOOD:smug]`,
  );
  assert.equal(classifyVisibleReplyDecision(raw).reasonCode, VISIBLE_REPLY_REASON_CODES.SALVAGED_DRAFT_CANDIDATE);
});

test('coercePennyVisibleReply repairs common unicode punctuation', () => {
  const raw = `You\u2019re back \u2014 cute. Don\u2019t make me repeat myself.\n[MOOD:smug]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `You're back - cute. Don't make me repeat myself.\n[MOOD:smug]`,
  );
  assert.equal(classifyVisibleReplyDecision(raw).reasonCode, VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY);
});

test('classifyVisibleReplyDecision keeps tagged visible replies explicit', () => {
  const decision = classifyVisibleReplyDecision('<final>oh, fine. I see it.</final>');
  assert.equal(decision.text, 'oh, fine. I see it.\n[MOOD:calm]');
  assert.equal(decision.reasonCode, VISIBLE_REPLY_REASON_CODES.TAGGED_VISIBLE_REPLY);
  assert.equal(decision.cleanupApplied, false);
  assert.equal(decision.materialChange, false);
  assert.equal(decision.reconstructedReply, false);
});

test('classifyVisibleReplyDecision treats plain direct replies as no meaningful cleanup', () => {
  const decision = classifyVisibleReplyDecision('Visible reply only.\n[MOOD:smug]');
  assert.equal(decision.text, 'Visible reply only.\n[MOOD:smug]');
  assert.equal(decision.reasonCode, VISIBLE_REPLY_REASON_CODES.CLEANUP_MOOD_TAGGED_REPLY);
  assert.equal(decision.cleanupApplied, false);
  assert.equal(decision.materialChange, false);
  assert.equal(decision.reconstructedReply, false);
});

test('textFromChatMessage keeps reasoning content out of the stored visible transcript', () => {
  const result = textFromChatMessage({
    content: 'Visible reply only.\n[MOOD:smug]',
    reasoning_content: '<|channel>thought\nHidden scratchpad.\n<channel|>',
  });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
});
