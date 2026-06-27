const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_LMSTUDIO_TOKEN_LIMITS,
  resolveLmStudioTokenLimits,
} = require('../lib/penny-lmstudio-token-limits');

test('default LM Studio token limits leave room for long visible replies after thinking tokens', () => {
  assert.deepEqual(DEFAULT_LMSTUDIO_TOKEN_LIMITS, {
    maxOutputTokens: 16384,
    chatMaxOutputTokens: 8192,
    toolMaxOutputTokens: 8192,
    toolSummaryMaxOutputTokens: 4096,
    toolPlannerMaxOutputTokens: 2048,
    semanticRenderMaxOutputTokens: 4096,
  });
});

test('LM Studio token limit env overrides remain available and reject unusable values', () => {
  const limits = resolveLmStudioTokenLimits({
    PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS: '24576',
    PENNY_LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: '12288',
    PENNY_LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS: 'not-a-number',
    PENNY_LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS: '3072.8',
    PENNY_LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS: '0',
    PENNY_LMSTUDIO_SEMANTIC_RENDER_MAX_OUTPUT_TOKENS: '-5',
  });

  assert.equal(limits.maxOutputTokens, 24576);
  assert.equal(limits.chatMaxOutputTokens, 12288);
  assert.equal(limits.toolMaxOutputTokens, 8192);
  assert.equal(limits.toolSummaryMaxOutputTokens, 3072);
  assert.equal(limits.toolPlannerMaxOutputTokens, 2048);
  assert.equal(limits.semanticRenderMaxOutputTokens, 4096);
});
