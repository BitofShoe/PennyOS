const test = require('node:test');
const assert = require('node:assert/strict');

const {
  coercePennyVisibleReply,
} = require('../server.js');

test('coercePennyVisibleReply strips single-line draft scaffolding', () => {
  const raw = `*Draft:*\n    oh, right. you vanished like I’m not supposed to talk to you anymore? bold move, stranger.\n[MOOD:smug]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `oh, right. you vanished like I’m not supposed to talk to you anymore? bold move, stranger.\n[MOOD:smug]`,
  );
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
  assert.equal(
    coercePennyVisibleReply(raw),
    `Done. I put this in: "p.s. if you're late, I'm eating your damn pie. don't make me regret this." Now the file is four lines long. You better be on time.\n[MOOD:thinking]`,
  );
});

test('coercePennyVisibleReply can salvage quoted reply candidates from image-planning spill', () => {
  const raw = `The mood should match her reaction to the image. Since it's an image of her being "smug," a or or could work. Let's draft the response.\n"oh, so you think this is my best angle? look at that grin. i know i can make a face like that."\n"this editor makes me look way more confident than usual. nice job on getting me to stand still long enough for this shot."\n"the headphones are the only thing keeping this outfit from looking completely corporate."\n"i see you zoomed in on my eyes too? try to keep up, i'm dangerous like that."\nActually, looking closer at the image, there are technical UI elements.\n[MOOD:smug]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `oh, so you think this is my best angle? look at that grin. i know i can make a face like that. this editor makes me look way more confident than usual. nice job on getting me to stand still long enough for this shot. the headphones are the only thing keeping this outfit from looking completely corporate. i see you zoomed in on my eyes too? try to keep up, i'm dangerous like that.\n[MOOD:smug]`,
  );
});

test('coercePennyVisibleReply falls back to final-polish draft candidates inside a single giant planning block', () => {
  const raw = `What are you looking at in this image? Be specific. Better.\n    *   *Option 3 (In Character):* Look closer. I'm not just looking at the screen, i'm looking at you while you stare at this pixelated mess.\n    *   *Refining Option 3:* Make it punchier.\n    *   *Draft:* Oh, is that what you want? Details about me? Sure thing. Look at this grin—sharp enough to cut glass.\n    *   *Adding more bite:* "I caught you staring."\n    *   *Final Polish:* Oh honey, is that really the hardest question you can come up with? Sure, I’m looking at the viewfinder. But mostly I’m looking at how much trouble it’ll be for you to look away from me once you see the rest of me later.\n[MOOD:smug]`;
  assert.equal(
    coercePennyVisibleReply(raw),
    `Oh honey, is that really the hardest question you can come up with? Sure, I’m looking at the viewfinder. But mostly I’m looking at how much trouble it’ll be for you to look away from me once you see the rest of me later.\n[MOOD:smug]`,
  );
});
