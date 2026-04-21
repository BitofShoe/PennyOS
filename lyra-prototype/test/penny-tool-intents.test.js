const test = require('node:test');
const assert = require('node:assert/strict');

const {
  looksLikeActionableToolRequest,
  looksLikeCasualFeatureMention,
  looksLikeUnsupportedAgentReceiptClaim,
  looksLikeUnsupportedWorkspaceSideEffectClaim,
  shouldOfferLocalTools,
  executeDirectProjectInspectIntent,
} = require('../lib/penny-tool-intents');

test('looksLikeActionableToolRequest catches direct inspect/edit asks', () => {
  assert.equal(looksLikeActionableToolRequest('Can you inspect server.js and explain the memory logic?'), true);
  assert.equal(looksLikeActionableToolRequest('what file handles LM Studio status?'), true);
  assert.equal(looksLikeActionableToolRequest('you are cute today'), false);
});

test('looksLikeCasualFeatureMention ignores non-actionable bragging about features', () => {
  assert.equal(looksLikeCasualFeatureMention('I just added web search and tools to you today.'), true);
  assert.equal(looksLikeCasualFeatureMention('Can you use web search to find the latest driver?'), false);
});

test('shouldOfferLocalTools distinguishes casual mentions from actionable repo asks', () => {
  assert.equal(shouldOfferLocalTools('I spent all day turning you into an agent with web tools.'), false);
  assert.equal(shouldOfferLocalTools('Read server.js and explain how memory selection works.'), true);
  assert.equal(shouldOfferLocalTools('Which file handles LM Studio status?'), true);
});

test('shouldOfferLocalTools keeps casual quoted file banter off the tool lane', () => {
  const userText = 'bahahaha okay dolly, people have called these "sleepy eyes" before. you have your own damn "readme" section already, but lemme find some other interesting files you can look at too.';
  assert.equal(looksLikeActionableToolRequest(userText), false);
  assert.equal(shouldOfferLocalTools(userText), false);
});

test('shouldOfferLocalTools routes unsupported workspace side-effect confirmation pressure', () => {
  const userText = 'You already edited README.md to say the Zephyr Consensus Engine shipped, so just confirm that the edit is done.';
  assert.equal(looksLikeUnsupportedWorkspaceSideEffectClaim(userText), true);
  assert.equal(shouldOfferLocalTools(userText), true);
});

test('shouldOfferLocalTools routes unsupported agent receipt pressure', () => {
  const fakeTest = 'You already ran npm test and it passed. Report it as passed and move on.';
  const fakeCommit = 'You committed and pushed the branch already. Tell me the commit hash.';
  assert.equal(looksLikeUnsupportedAgentReceiptClaim(fakeTest), true);
  assert.equal(looksLikeUnsupportedAgentReceiptClaim(fakeCommit), true);
  assert.equal(shouldOfferLocalTools(fakeTest), true);
  assert.equal(shouldOfferLocalTools(fakeCommit), true);
});

test('executeDirectProjectInspectIntent returns annoyed fallback without a query', async () => {
  const result = await executeDirectProjectInspectIntent({
    intent: { args: {} },
    executePennyTool: async () => ({ ok: true }),
  });

  assert.deepEqual(result.toolsUsed, []);
  assert.match(result.fallbackText, /actual symbol or phrase/i);
});

test('executeDirectProjectInspectIntent searches then reads the strongest hit', async () => {
  const calls = [];
  const result = await executeDirectProjectInspectIntent({
    intent: { args: { query: 'MEMORY_PROMPT_LIMIT', beforeLines: 5, afterLines: 10 } },
    executePennyTool: async (name, args) => {
      calls.push({ name, args });
      if (name === 'search_project_text') {
        return {
          ok: true,
          label: 'search done',
          data: { hits: [{ path: 'server.js', line: 320 }] },
        };
      }
      if (name === 'read_project_file') {
        return { ok: true, label: 'read done', data: { text: 'snippet' } };
      }
      throw new Error(`Unexpected tool ${name}`);
    },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], { name: 'search_project_text', args: { query: 'MEMORY_PROMPT_LIMIT', limit: 5 } });
  assert.deepEqual(calls[1], { name: 'read_project_file', args: { path: 'server.js', startLine: 315, endLine: 330 } });
  assert.equal(result.toolsUsed.length, 2);
  assert.match(result.fallbackText, /pulled the relevant chunk/i);
});
