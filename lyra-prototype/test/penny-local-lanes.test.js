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
});

test('selectLocalLane pushes direct inspect and file turns onto the tool lane', () => {
  const { selectLocalLane } = buildApi();
  assert.equal(selectLocalLane({ userText: 'Search for "Shadow failed" in public/app.js.' }).localLane, 'tool');
  assert.equal(selectLocalLane({
    userText: 'tell me what this file says',
    file: { name: 'notes.md', text: 'hi', lineCount: 1 },
  }).localLane, 'tool');
});

test('selectLocalLane keeps explicit live web lookups on the tool lane', () => {
  const { selectLocalLane } = buildApi();
  assert.equal(selectLocalLane({ userText: 'search the web for bitcoin news' }).localLane, 'tool');
  assert.equal(selectLocalLane({ userText: "what's the latest on LM Studio?" }).localLane, 'tool');
});

test('selectLocalLane forces open-ended explicit file edits onto the tool lane', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({
    userText: 'Open public/app.js and add one short note in your own voice. Pick the wording yourself.',
  });
  assert.equal(selection.localLane, 'tool');
  assert.equal(selection.forceToolLoop, true);
});
