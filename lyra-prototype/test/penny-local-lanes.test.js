const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createLocalLaneApi,
} = require('../lib/penny-local-lanes');

function buildApi() {
  return createLocalLaneApi({
    shouldOfferLocalTools(text = '') {
      return /\b(search|inspect|read|open|find|check|git|diff|status|edit|replace|append|write|log|logs|web|repo|file|files|code)\b/i.test(String(text || ''));
    },
    shouldForceLocalToolLoop(text = '') {
      return /\b(in your own voice|pick the wording|whatever you want)\b/i.test(String(text || ''));
    },
    resolveDirectToolIntent(text = '') {
      const raw = String(text || '');
      if (/search for "shadow failed" in public\/app\.js/i.test(raw)) {
        return { name: 'read_project_file_around_match', args: { path: 'public/app.js', query: 'Shadow failed' } };
      }
      if (/open public\/app\.js/i.test(raw)) {
        return { name: 'read_project_file', args: { path: 'public/app.js' } };
      }
      if (/search the web/i.test(raw)) {
        return { name: 'search_web', args: { query: 'docs' } };
      }
      return null;
    },
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

test('selectLocalLane forces open-ended explicit file edits onto the tool lane', () => {
  const { selectLocalLane } = buildApi();
  const selection = selectLocalLane({
    userText: 'Open public/app.js and add one short note in your own voice. Pick the wording yourself.',
  });
  assert.equal(selection.localLane, 'tool');
  assert.equal(selection.forceToolLoop, true);
});
