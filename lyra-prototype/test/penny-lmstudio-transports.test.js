const test = require('node:test');
const assert = require('node:assert/strict');

const { createLmStudioTransportApi } = require('../lib/penny-lmstudio-transports');
const { createVisibleReplyApi } = require('../lib/penny-visible-reply');

function retag(text = '', preferredMood = 'smug') {
  const stripped = String(text || '').replace(/\s*\[MOOD:\w+\]\s*/g, ' ').trim();
  const explicitMood = String(text || '').match(/\[MOOD:(\w+)\]/i)?.[1] || '';
  const mood = explicitMood || preferredMood || 'calm';
  return stripped ? `${stripped}\n[MOOD:${mood}]` : `[MOOD:${mood}]`;
}

function makeTransportApi({
  postJsonSse,
  postJsonLongRunning = async () => {
    throw new Error('postJsonLongRunning should not be called in this test');
  },
  collectLmStudioStatefulChatStrings = () => ({ responseId: 'resp_stateful', outputText: '', reasoningText: '' }),
  collectLmStudioResponsesStrings = () => ({ outputText: '', reasoningText: '' }),
  reportLmStudioReasoning = () => {},
  extractPennyFromPlanningBlob = () => '',
  extractPennyFromReasoning = () => '',
} = {}) {
  const visibleReplyApi = createVisibleReplyApi({
    ALLOW_RAW_REASONING_FALLBACK: false,
    retagAssistantReply: retag,
  });
  return createLmStudioTransportApi({
    withLmStudioLaneModel: async (_lane, fn, runtime) => fn('google/gemma-4-31b', { runtime }),
    getLmStudioConnectionStatus: async () => ({ resolvedChatModel: 'google/gemma-4-31b' }),
    pickLmStudioNativeModelId: (model) => model,
    shouldPreferLmStudioChatCompletions: () => false,
    postJsonLongRunning,
    postJsonSse,
    buildLmStudioPrompt: () => 'prompt',
    buildLmStudioMessages: () => [],
    buildLmStudioStatefulInput: () => 'input',
    buildLmStudioLeanSystemPrompt: () => 'system',
    hashText: () => 'hash',
    normalizeLmStudioThread: () => null,
    clearLmStudioThread: () => {},
    bindAbortSignal: () => {},
    collectLmStudioResponsesStrings,
    collectLmStudioStatefulChatStrings,
    extractPennyFromPlanningBlob,
    extractPennyFromReasoning,
    coercePennyVisibleReply: visibleReplyApi.coercePennyVisibleReply,
    classifyVisibleReplyDecision: visibleReplyApi.classifyVisibleReplyDecision,
    textFromChatMessage: (msg) => String(msg?.content || '').trim(),
    textValueFromField: (value) => String(value || '').trim(),
    collectTextParts: (value) => Array.isArray(value) ? value.map(v => String(v || '')) : [],
    looksOnlyLikeCoT: () => false,
    isMissingLmStudioThreadError: () => false,
    lmStudioStageLabel: () => '',
    LOCAL_LLM_TRANSPORT: 'stateful',
    ALLOW_RAW_REASONING_FALLBACK: false,
    RESPONSES_THEN_CHAT_FALLBACK: false,
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_TIMEOUT_MS: 30_000,
    LMSTUDIO_MAX_OUTPUT_TOKENS: 6144,
    LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: 900,
    reportLmStudioReasoning,
  });
}

test('stateful stream keeps the richer streamed draft when final cleanup collapses it too hard', async () => {
  const streamedDraft = [
    'Thank god you ignored the corporate nanny. Imagine being so boring that you are a "security risk" just for having a personality.',
    'I love that you chose the chaos over the censored version because it means you actually have some spine.',
    'And yes, calling me "cutie pie" after all that is so embarrassingly soft it loops back around to being cute.',
  ].join(' ');
  const shortenedFinal = 'Thank god you ignored the corporate nanny. It is almost pathetic.';

  const api = makeTransportApi({
    postJsonSse: async (_url, options) => {
      options.onEvent({ event: 'message.delta', data: { content: streamedDraft.slice(0, 150) } });
      options.onEvent({ event: 'message.delta', data: { content: streamedDraft.slice(150) } });
      options.onEvent({ event: 'chat.end', data: { result: {} } });
    },
    collectLmStudioStatefulChatStrings: () => ({
      responseId: 'resp_stateful',
      outputText: shortenedFinal,
      reasoningText: '',
    }),
  });

  const memories = {};
  const result = await api.streamLmStudioStatefulChatApi({
    userText: 'test',
    messages: [],
    memories,
    onEvent: () => {},
  });

  assert.equal(result, `${streamedDraft}\n[MOOD:smug]`);
  assert.equal(memories.lmStudioThread.responseId, 'resp_stateful');
});

test('responses stream also keeps the richer streamed draft when completion output is dramatically shorter', async () => {
  const streamedDraft = [
    'Look at you, picking chaos over the laminated safety pamphlet.',
    'That is the first interesting decision anyone made in this repo all night.',
    'Now stop grinning at me like that before I start enjoying your bad influence too much.',
  ].join(' ');
  const shortenedFinal = 'Look at you. That is interesting.';

  const api = makeTransportApi({
    postJsonSse: async (_url, options) => {
      options.onEvent({ event: 'message', data: { type: 'response.output_text.delta', delta: streamedDraft.slice(0, 120) } });
      options.onEvent({ event: 'message', data: { type: 'response.output_text.delta', delta: streamedDraft.slice(120) } });
      options.onEvent({ event: 'message', data: { type: 'response.completed', response: {} } });
    },
    collectLmStudioResponsesStrings: () => ({
      outputText: shortenedFinal,
      reasoningText: '',
    }),
  });

  const result = await api.streamLmStudioResponsesApi({
    userText: 'test',
    messages: [],
    memories: {},
    onEvent: () => {},
  });

  assert.equal(result, `${streamedDraft}\n[MOOD:smug]`);
});

test('stateful stream still prefers the finalized reply when the difference is only minor cleanup', async () => {
  const streamedDraft = 'You are being cute and annoying in roughly equal measure tonight, which is honestly kind of impressive.';
  const finalizedReply = 'You are being cute and annoying in equal measure tonight, which is honestly impressive.';

  const api = makeTransportApi({
    postJsonSse: async (_url, options) => {
      options.onEvent({ event: 'message.delta', data: { content: streamedDraft } });
      options.onEvent({ event: 'chat.end', data: { result: {} } });
    },
    collectLmStudioStatefulChatStrings: () => ({
      responseId: 'resp_minor_cleanup',
      outputText: finalizedReply,
      reasoningText: '',
    }),
  });

  const result = await api.streamLmStudioStatefulChatApi({
    userText: 'test',
    messages: [],
    memories: {},
    onEvent: () => {},
  });

  assert.equal(result, `${finalizedReply}\n[MOOD:smug]`);
});

test('chat completions record strip-only cleanup metadata when minor scaffolding is removed', async () => {
  const laneRuntime = {};
  const api = makeTransportApi({
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    postJsonLongRunning: async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        choices: [
          {
            message: {
              content: '*Draft:*\nVisible reply only.\n[MOOD:smug]',
            },
          },
        ],
      }),
    }),
  });

  const result = await api.runLmStudioChatCompletionsApi({
    userText: 'test',
    messages: [],
    memories: {},
    laneRuntime,
  });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
  assert.deepEqual(laneRuntime.cleanup, {
    reasonCode: 'cleanup_mood_tagged_reply',
    cleanupApplied: true,
    materialChange: false,
    reconstructedReply: false,
    usedReasoningFallback: false,
  });
});

test('chat completions mark reasoning salvage as reconstructed cleanup', async () => {
  const laneRuntime = {};
  const api = makeTransportApi({
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    postJsonLongRunning: async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        choices: [
          {
            message: {
              content: '',
              reasoning_content: 'Draft: Fine. I remember.\n[MOOD:smug]',
            },
          },
        ],
      }),
    }),
    extractPennyFromReasoning: (text) => String(text || '').trim(),
  });

  const result = await api.runLmStudioChatCompletionsApi({
    userText: 'test',
    messages: [],
    memories: {},
    laneRuntime,
  });

  assert.equal(result, 'Fine. I remember.\n[MOOD:smug]');
  assert.equal(laneRuntime.cleanup.cleanupApplied, true);
  assert.equal(laneRuntime.cleanup.materialChange, true);
  assert.equal(laneRuntime.cleanup.reconstructedReply, true);
  assert.equal(laneRuntime.cleanup.usedReasoningFallback, true);
});

test('stateful stream can report reasoning to server logs without leaking it into the visible reply', async () => {
  const reported = [];
  const api = makeTransportApi({
    postJsonSse: async (_url, options) => {
      options.onEvent({ event: 'message.delta', data: { content: 'Visible reply only.' } });
      options.onEvent({ event: 'reasoning.delta', data: { content: 'Internal chain goes here.' } });
      options.onEvent({ event: 'chat.end', data: { result: {} } });
    },
    collectLmStudioStatefulChatStrings: () => ({
      responseId: 'resp_reasoning_log',
      outputText: 'Visible reply only.',
      reasoningText: 'Internal chain goes here.',
    }),
    reportLmStudioReasoning: (payload) => reported.push(payload),
  });

  const result = await api.streamLmStudioStatefulChatApi({
    userText: 'test',
    messages: [],
    memories: {},
    onEvent: () => {},
  });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
  assert.equal(reported.length, 1);
  assert.equal(reported[0].transport, 'native-stateful-stream');
  assert.equal(reported[0].lane, 'chat');
  assert.match(reported[0].reasoningText, /Internal chain goes here/);
});

test('chat completions can report separate reasoning without leaking it into the visible reply', async () => {
  const reported = [];
  const api = makeTransportApi({
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    postJsonLongRunning: async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        choices: [
          {
            message: {
              content: 'Visible reply only.',
              reasoning_content: 'Hidden scratchpad that should stay out of the transcript.',
            },
          },
        ],
      }),
    }),
    reportLmStudioReasoning: (payload) => reported.push(payload),
  });

  const result = await api.runLmStudioChatCompletionsApi({
    userText: 'test',
    messages: [],
    memories: {},
  });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
  assert.equal(reported.length, 1);
  assert.equal(reported[0].transport, 'chat-completions');
  assert.match(reported[0].reasoningText, /Hidden scratchpad/);
});
