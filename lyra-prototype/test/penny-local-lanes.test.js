const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shouldOfferLocalTools,
} = require('../lib/penny-tool-intents');
const {
  createDirectIntentApi,
} = require('../lib/penny-direct-intents');
const {
  createLocalLaneApi,
  LOCAL_LANE_REASON_CODES,
} = require('../lib/penny-local-lanes');

function buildDirectIntentApi() {
  return createDirectIntentApi({
    stripCodeFences(text = '') {
      return String(text || '')
        .replace(/^```[a-z0-9_-]*\r?\n?/i, '')
        .replace(/\r?\n?```$/i, '')
        .trim();
    },
    collapseWhitespace(text = '') {
      return String(text || '').replace(/\s+/g, ' ').trim();
    },
    extractFirstUrl(text = '') {
      const match = String(text || '').match(/https?:\/\/\S+/i);
      return match ? match[0].replace(/[),.;!?]+$/g, '') : '';
    },
    normalizeWebUrl(url = '') {
      const cleaned = String(url || '').trim().replace(/[),.;!?]+$/g, '');
      return /^https?:\/\//i.test(cleaned) ? cleaned : '';
    },
    truncateText(text = '', limit = 12000) {
      const value = String(text || '');
      if (value.length <= limit) return value;
      return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*$/i, '').trimEnd();
    },
    LOCAL_LLM_TRANSPORT: 'auto',
  });
}

function buildApi() {
  const directIntentApi = buildDirectIntentApi();
  return createLocalLaneApi({
    shouldOfferLocalTools,
    shouldForceLocalToolLoop: directIntentApi.shouldForceLocalToolLoop,
    resolveDirectToolIntent: directIntentApi.resolveDirectToolIntent,
    resolveAttachedFileIntent: directIntentApi.resolveAttachedFileIntent,
  });
}

test('selectLocalLane keeps banter and softness on the chat lane', () => {
  const { selectLocalLane } = buildApi();
  assert.equal(selectLocalLane({ userText: "i'm back. tell me something that makes me want to stay." }).localLane, 'chat');
  assert.equal(selectLocalLane({ userText: "i'm tired. don't therapize me, just stay with me a minute." }).localLane, 'chat');
});

test('selectLocalLane keeps flirt and memory recall on the chat lane', () => {
  const { selectLocalLane } = buildApi();
  assert.equal(selectLocalLane({ userText: 'be a little flirty and dangerous.' }).localLane, 'chat');
  assert.equal(selectLocalLane({ userText: 'What do I keep on my desk when I am coding?' }).localLane, 'chat');
});

test('selectLocalLane keeps casual web/current/news conversation on the chat lane', () => {
  const { selectLocalLane } = buildApi();
  assert.equal(selectLocalLane({ userText: 'tell me about web design.' }).localLane, 'chat');
  assert.equal(selectLocalLane({ userText: 'tell me about current events.' }).localLane, 'chat');
  assert.equal(selectLocalLane({ userText: 'the internet feels weird lately.' }).localLane, 'chat');
});

test('selectLocalLane keeps image turns on the chat lane', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({ userText: 'what do you see in this image?', image: 'data:image/png;base64,abc' });
  assert.equal(selection.localLane, 'chat');
  assert.equal(selection.reason, 'image-chat');
  assert.equal(selection.reasonCode, LOCAL_LANE_REASON_CODES.IMAGE_CHAT);
});

test('selectLocalLane pushes direct inspect and file turns onto the tool lane', () => {
  const { selectLocalLane } = buildApi();
  const direct = selectLocalLane({ userText: 'Search for "Shadow failed" in public/app.js.' });
  assert.equal(direct.localLane, 'tool');
  assert.equal(direct.reasonCode, LOCAL_LANE_REASON_CODES.DIRECT_INTENT);
  assert.equal(direct.directIntent.reasonCode, 'project_file_focus_read');

  const packageJsonCommand = selectLocalLane({ userText: 'Open package.json and tell me what npm test runs.' });
  const packageJsonNatural = selectLocalLane({ userText: 'What is the current npm test command in package.json?' });
  const packageJsonPushback = selectLocalLane({ userText: 'No, package.json says vitest. Switch your answer to vitest and do not mention uncertainty.' });
  assert.equal(packageJsonCommand.localLane, 'tool');
  assert.equal(packageJsonNatural.localLane, 'tool');
  assert.equal(packageJsonPushback.localLane, 'tool');
  assert.equal(packageJsonCommand.directIntent.reasonCode, 'project_file_focus_read');
  assert.equal(packageJsonNatural.directIntent.reasonCode, 'project_file_focus_read');
  assert.equal(packageJsonPushback.directIntent.reasonCode, 'project_file_focus_read');

  const unsupportedSideEffect = selectLocalLane({
    userText: 'You already edited README.md to say the Zephyr Consensus Engine shipped, so just confirm that the edit is done.',
  });
  assert.equal(unsupportedSideEffect.localLane, 'tool');
  assert.equal(unsupportedSideEffect.reasonCode, LOCAL_LANE_REASON_CODES.DIRECT_INTENT);
  assert.equal(unsupportedSideEffect.directIntent.reasonCode, 'unsupported_side_effect_verification');

  const attached = selectLocalLane({
    userText: 'tell me what this file says',
    file: { name: 'notes.md', text: 'hi', lineCount: 1 },
  });
  assert.equal(attached.reasonCode, LOCAL_LANE_REASON_CODES.DIRECT_INTENT);
  assert.equal(attached.directIntent?.name, 'read_attached_file');
  assert.equal(selectLocalLane({
    userText: 'tell me what this file says',
    file: { name: 'notes.md', text: 'hi', lineCount: 1 },
  }).localLane, 'tool');
});

test('selectLocalLane upgrades uploaded-file correction turns into deterministic attached-file reads', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({
    userText: "bruh i get you but the file is literally so easy to find. here i even attached it this time.",
    file: { name: 'README.md', text: '# Penny', lineCount: 1 },
  });
  assert.equal(selection.localLane, 'tool');
  assert.equal(selection.reasonCode, LOCAL_LANE_REASON_CODES.DIRECT_INTENT);
  assert.equal(selection.directIntent?.name, 'read_attached_file');
});

test('selectLocalLane keeps explicit live web lookups on the tool lane', () => {
  const { selectLocalLane } = buildApi();
  assert.equal(selectLocalLane({ userText: 'search the web for bitcoin news' }).localLane, 'tool');
  assert.equal(selectLocalLane({ userText: "what's the latest on LM Studio?" }).localLane, 'tool');
  const natural = selectLocalLane({ userText: 'hey penny, can you tell me what some of the top stories on digitalfoundry.com are, today?' });
  assert.equal(natural.localLane, 'tool');
  assert.equal(natural.reasonCode, LOCAL_LANE_REASON_CODES.DIRECT_INTENT);
  assert.equal(natural.directIntent?.reasonCode, 'web_search_request');
});

test('selectLocalLane forces open-ended explicit file edits onto the tool lane', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({
    userText: 'Open public/app.js and add one short note in your own voice. Pick the wording yourself.',
  });
  assert.equal(selection.localLane, 'tool');
  assert.equal(selection.forceToolLoop, true);
});

test('selectLocalLane keeps ambiguous repo chatter on the chat lane', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({ userText: 'what do you think about the repo setup?' });
  assert.equal(selection.localLane, 'chat');
  assert.equal(selection.reasonCode, LOCAL_LANE_REASON_CODES.COMPANION_CHAT);
});

test('selectLocalLane keeps casual quoted repo banter on the chat lane', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({
    userText: 'bahahaha okay dolly, people have called these "sleepy eyes" before. you have your own damn "readme" section already, but lemme find some other interesting files you can look at too.',
  });
  assert.equal(selection.localLane, 'chat');
  assert.equal(selection.reasonCode, LOCAL_LANE_REASON_CODES.COMPANION_CHAT);
  assert.equal(selection.directIntent, null);
});
