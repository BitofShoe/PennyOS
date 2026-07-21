const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildOpenAiChatCompatibilityFields,
  isGpt56Model,
  isOpenAiApiBase,
} = require('../lib/penny-openai-compat');

test('GPT-5.6 OpenAI Chat Completions function tools use explicit no-reasoning compatibility', () => {
  assert.equal(isOpenAiApiBase('https://api.openai.com/v1'), true);
  assert.equal(isGpt56Model('gpt-5.6'), true);
  assert.equal(isGpt56Model('gpt-5.6-sol'), true);
  assert.deepEqual(buildOpenAiChatCompatibilityFields({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6',
    hasFunctionTools: true,
  }), {
    reasoning_effort: 'none',
  });
});

test('OpenAI compatibility fields do not leak into local or non-tool requests', () => {
  assert.deepEqual(buildOpenAiChatCompatibilityFields({
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'gpt-5.6',
    hasFunctionTools: true,
  }), {});
  assert.deepEqual(buildOpenAiChatCompatibilityFields({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.6',
    hasFunctionTools: false,
  }), {});
  assert.deepEqual(buildOpenAiChatCompatibilityFields({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5.5',
    hasFunctionTools: true,
  }), {});
});
