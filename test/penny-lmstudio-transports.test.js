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
  postJsonSse = async () => {
    throw new Error('postJsonSse should not be called in this test');
  },
  postJsonLongRunning = async () => {
    throw new Error('postJsonLongRunning should not be called in this test');
  },
  collectLmStudioStatefulChatStrings = () => ({ responseId: 'resp_stateful', outputText: '', reasoningText: '' }),
  collectLmStudioResponsesStrings = () => ({ outputText: '', reasoningText: '' }),
  clearLmStudioThread = () => {},
  reportLmStudioReasoning = () => {},
  extractPennyFromPlanningBlob = () => '',
  extractPennyFromReasoning = () => '',
  chatTemperature = 1.0,
  chatTopP = 0.95,
  chatTopK = 64,
  lmStudioBase = 'http://127.0.0.1:1234/v1',
  localLlmBackend = 'lm_studio',
  localTransport = 'stateful',
  allowRawReasoningFallback = false,
  normalizeLmStudioThread = () => null,
  isMissingLmStudioThreadError = () => false,
  bindAbortSignal = () => {},
} = {}) {
  const visibleReplyApi = createVisibleReplyApi({
    ALLOW_RAW_REASONING_FALLBACK: allowRawReasoningFallback,
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
    normalizeLmStudioThread,
    clearLmStudioThread,
    bindAbortSignal,
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
    isMissingLmStudioThreadError,
    lmStudioStageLabel: () => '',
    LOCAL_LLM_TRANSPORT: localTransport,
    ALLOW_RAW_REASONING_FALLBACK: allowRawReasoningFallback,
    RESPONSES_THEN_CHAT_FALLBACK: false,
    LOCAL_LLM_BACKEND: localLlmBackend,
    LMSTUDIO_BASE: lmStudioBase,
    LMSTUDIO_NATIVE_BASE: 'http://127.0.0.1:1234/api/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_TIMEOUT_MS: 30_000,
    LMSTUDIO_MAX_OUTPUT_TOKENS: 6144,
    LMSTUDIO_CHAT_TEMPERATURE: chatTemperature,
    LMSTUDIO_CHAT_TOP_P: chatTopP,
    LMSTUDIO_CHAT_TOP_K: chatTopK,
    LMSTUDIO_CHAT_MAX_OUTPUT_TOKENS: 900,
    reportLmStudioReasoning,
});
}

test('OpenAI cloud chat/completions payload omits LM Studio-only top_k sampling', async () => {
  let request = null;
  const api = makeTransportApi({
    localLlmBackend: 'openai_compatible',
    lmStudioBase: 'https://api.openai.com/v1',
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    postJsonLongRunning: async (url, options) => {
      request = {
        url,
        headers: options.headers,
        payload: JSON.parse(String(options.body || '{}')),
      };
      return {
        statusCode: 200,
        bodyText: JSON.stringify({
          choices: [
            { message: { content: 'Visible reply only.' } },
          ],
        }),
      };
    },
  });

  const result = await api.runLmStudioChatCompletionsApi({ userText: 'test', messages: [], memories: {} });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.headers.Authorization, 'Bearer lm-studio-local');
  assert.equal(request.payload.temperature, 1.0);
  assert.equal(request.payload.top_p, 0.95);
  assert.equal(Object.prototype.hasOwnProperty.call(request.payload, 'top_k'), false);
});

test('chat-completions repair calls can preserve the active stateful thread', async () => {
  let clears = 0;
  const api = makeTransportApi({
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    clearLmStudioThread: () => {
      clears += 1;
    },
    postJsonLongRunning: async () => ({
      statusCode: 200,
      bodyText: JSON.stringify({
        choices: [
          { message: { content: 'Revised visible reply.' } },
        ],
      }),
    }),
  });

  await api.runLmStudioChatCompletionsApi({
    userText: 'ordinary call',
    messages: [],
    memories: {},
  });
  await api.runLmStudioChatCompletionsApi({
    userText: 'surface edit',
    messages: [],
    memories: {},
    preserveThread: true,
  });

  assert.equal(clears, 1);
});

test('all LM Studio chat transports include Gemma 4 chat sampling fields', async () => {
  const payloads = [];
  const api = makeTransportApi({
    chatTemperature: 1.0,
    chatTopP: 0.95,
    chatTopK: 64,
    postJsonLongRunning: async (_url, options) => {
      payloads.push(JSON.parse(String(options.body || '{}')));
      return {
        statusCode: 200,
        bodyText: JSON.stringify({
          output_text: 'Visible reply only.',
          response_id: 'resp_payload',
          choices: [
            { message: { content: 'Visible reply only.' } },
          ],
        }),
      };
    },
    postJsonSse: async (url, options) => {
      payloads.push(JSON.parse(String(options.body || '{}')));
      if (/\/api\/v1\/chat$/i.test(url)) {
        options.onEvent({ event: 'message.delta', data: { content: 'Visible reply only.' } });
        options.onEvent({ event: 'chat.end', data: { result: { response_id: 'resp_stream', output_text: 'Visible reply only.' } } });
        return;
      }
      if (/\/responses$/i.test(url)) {
        options.onEvent({ event: 'message', data: { type: 'response.output_text.delta', delta: 'Visible reply only.' } });
        options.onEvent({ event: 'message', data: { type: 'response.completed', response: { output_text: 'Visible reply only.' } } });
        return;
      }
      options.onEvent({ event: 'message', data: { choices: [{ delta: { content: 'Visible reply only.' } }] } });
      options.onEvent({ event: 'message', data: '[DONE]' });
    },
    collectLmStudioStatefulChatStrings: () => ({
      responseId: 'resp_stateful',
      outputText: 'Visible reply only.',
      reasoningText: '',
    }),
    collectLmStudioResponsesStrings: () => ({
      outputText: 'Visible reply only.',
      reasoningText: '',
    }),
  });

  await api.runLmStudioResponsesApi({ userText: 'test', messages: [], memories: {} });
  await api.runLmStudioStatefulChatApi({ userText: 'test', messages: [], memories: {} });
  await api.streamLmStudioStatefulChatApi({ userText: 'test', messages: [], memories: {}, onEvent: () => {} });
  await api.streamLmStudioResponsesApi({ userText: 'test', messages: [], memories: {}, onEvent: () => {} });
  await api.streamLmStudioChatCompletionsApi({ userText: 'test', messages: [], memories: {}, onEvent: () => {} });
  await api.runLmStudioChatCompletionsApi({ userText: 'test', messages: [], memories: {} });

  assert.equal(payloads.length, 6);
  for (const payload of payloads) {
    assert.equal(payload.temperature, 1.0);
    assert.equal(payload.top_p, 0.95);
    assert.equal(payload.top_k, 64);
  }
});

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

test('chat completions record output-limit telemetry when LM Studio stops for length', async () => {
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
            finish_reason: 'length',
            message: {
              content: 'Partial answer, boss.\n[MOOD:annoyed]',
            },
          },
        ],
        usage: {
          completion_tokens: 900,
          completion_tokens_details: {
            reasoning_tokens: 700,
          },
        },
      }),
    }),
  });

  const result = await api.runLmStudioChatCompletionsApi({
    userText: 'test',
    messages: [],
    memories: {},
    laneRuntime,
  });

  assert.equal(result, 'Partial answer, boss.\n[MOOD:annoyed]');
  assert.deepEqual(laneRuntime.responseLimit, {
    hit: true,
    reasonCode: 'output_limit',
    finishReason: 'length',
    source: 'chat-completions',
    lane: 'chat',
    maxTokens: 900,
    completionTokens: 900,
    reasoningTokens: 700,
  });
});

test('chat completions do not reconstruct a visible reply from private reasoning by default', async () => {
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

  await assert.rejects(
    api.runLmStudioChatCompletionsApi({
      userText: 'test',
      messages: [],
      memories: {},
      laneRuntime,
    }),
    (error) => {
      assert.equal(error.code, 'provider_no_visible_text');
      assert.equal(error.statusCode, 502);
      assert.doesNotMatch(error.message, /Fine\. I remember/);
      return true;
    },
  );
  assert.equal(laneRuntime.cleanup, undefined);
});

test('chat completions never copy an upstream error body into the thrown public error', async () => {
  const canary = 'PENNY_PRIVATE_PROVIDER_BODY_CANARY_4d2a';
  const api = makeTransportApi({
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    postJsonLongRunning: async () => ({
      statusCode: 500,
      bodyText: JSON.stringify({ error: canary, reasoning: `secret ${canary}` }),
    }),
  });

  await assert.rejects(
    api.runLmStudioChatCompletionsApi({
      userText: 'test',
      messages: [],
      memories: {},
    }),
    (error) => {
      assert.equal(error.code, 'provider_upstream_error');
      assert.equal(error.upstreamStatus, 500);
      assert.doesNotMatch(error.message, new RegExp(canary));
      assert.doesNotMatch(JSON.stringify(error), new RegExp(canary));
      return true;
    },
  );
});

test('all six transport adapters reject reasoning-only output without exposing it', async () => {
  const canary = 'PENNY_PRIVATE_REASONING_MATRIX_CANARY_e613';
  const cases = [
    {
      name: 'responses',
      method: 'runLmStudioResponsesApi',
      options: {
        postJsonLongRunning: async () => ({
          statusCode: 200,
          bodyText: JSON.stringify({ reasoning: canary }),
        }),
        collectLmStudioResponsesStrings: () => ({ outputText: '', reasoningText: canary }),
      },
    },
    {
      name: 'stateful',
      method: 'runLmStudioStatefulChatApi',
      options: {
        postJsonLongRunning: async () => ({
          statusCode: 200,
          bodyText: JSON.stringify({ reasoning: canary }),
        }),
        collectLmStudioStatefulChatStrings: () => ({ responseId: '', outputText: '', reasoningText: canary }),
      },
    },
    {
      name: 'chat-completions',
      method: 'runLmStudioChatCompletionsApi',
      options: {
        postJsonLongRunning: async () => ({
          statusCode: 200,
          bodyText: JSON.stringify({
            choices: [{ message: { content: '', reasoning_content: canary } }],
          }),
        }),
      },
    },
    {
      name: 'stateful-stream',
      method: 'streamLmStudioStatefulChatApi',
      options: {
        postJsonSse: async (_url, options) => {
          options.onEvent({ event: 'reasoning.delta', data: { content: canary } });
          options.onEvent({ event: 'chat.end', data: { result: {} } });
        },
        collectLmStudioStatefulChatStrings: () => ({ responseId: '', outputText: '', reasoningText: canary }),
      },
    },
    {
      name: 'responses-stream',
      method: 'streamLmStudioResponsesApi',
      options: {
        postJsonSse: async (_url, options) => {
          options.onEvent({
            event: 'message',
            data: { type: 'response.reasoning.delta', delta: canary },
          });
        },
        collectLmStudioResponsesStrings: () => ({ outputText: '', reasoningText: canary }),
      },
    },
    {
      name: 'chat-completions-stream',
      method: 'streamLmStudioChatCompletionsApi',
      options: {
        postJsonSse: async (_url, options) => {
          options.onEvent({
            event: 'message',
            data: { choices: [{ delta: { reasoning_content: canary } }] },
          });
          options.onEvent({ event: 'message', data: '[DONE]' });
        },
      },
    },
  ];

  for (const testCase of cases) {
    const events = [];
    const api = makeTransportApi(testCase.options);
    await assert.rejects(
      api[testCase.method]({
        userText: 'test',
        messages: [],
        memories: {},
        onEvent: event => events.push(event),
      }),
      (error) => {
        assert.equal(error.code, 'provider_no_visible_text', testCase.name);
        assert.doesNotMatch(JSON.stringify(error), new RegExp(canary), testCase.name);
        return true;
      },
    );
    assert.doesNotMatch(JSON.stringify(events), new RegExp(canary), testCase.name);
  }
});

test('auto transport preserves stateful-to-chat fallback with typed provider errors', async () => {
  let calls = 0;
  const api = makeTransportApi({
    localTransport: 'auto',
    postJsonSse: async () => {
      throw new Error('postJsonSse should not be called in this test');
    },
    postJsonLongRunning: async (url) => {
      calls += 1;
      if (/\/api\/v1\/chat$/i.test(url)) {
        return { statusCode: 500, bodyText: '{"error":"private upstream detail"}' };
      }
      return {
        statusCode: 200,
        bodyText: JSON.stringify({ choices: [{ message: { content: 'Fallback reply.' } }] }),
      };
    },
  });

  const result = await api.runLmStudioLocal({
    userText: 'test',
    messages: [],
    memories: {},
  });

  assert.equal(result, 'Fallback reply.\n[MOOD:smug]');
  assert.equal(calls, 2);
});

test('stateful stale-thread retry uses safe reason codes after discarding the body', async () => {
  const memories = {
    lmStudioThread: {
      responseId: 'missing-response',
      model: 'google/gemma-4-31b',
      systemPromptHash: 'hash',
    },
  };
  let calls = 0;
  const api = makeTransportApi({
    normalizeLmStudioThread: value => value || null,
    clearLmStudioThread: target => {
      target.lmStudioThread = null;
    },
    isMissingLmStudioThreadError: error => (
      error?.reasonCode === 'missing_thread'
      || /previous response.*not found/i.test(String(error?.message || ''))
    ),
    postJsonLongRunning: async () => {
      calls += 1;
      if (calls === 1) {
        return {
          statusCode: 404,
          bodyText: '{"error":"previous response id not found; private detail"}',
        };
      }
      return {
        statusCode: 200,
        bodyText: JSON.stringify({ output_text: 'Fresh thread reply.' }),
      };
    },
    collectLmStudioStatefulChatStrings: parsed => ({
      responseId: '',
      outputText: parsed.output_text || '',
      reasoningText: '',
    }),
  });

  const result = await api.runLmStudioStatefulChatApi({
    userText: 'test',
    messages: [],
    memories,
  });

  assert.equal(result, 'Fresh thread reply.\n[MOOD:smug]');
  assert.equal(calls, 2);
});

test('stream fallback resets a partial attempt before emitting the retry output', async () => {
  const events = [];
  const api = makeTransportApi({
    localTransport: 'auto',
    postJsonSse: async (url, options) => {
      if (/\/api\/v1\/chat$/i.test(url)) {
        options.onEvent({ event: 'message.delta', data: { content: 'partial attempt' } });
        options.onEvent({ event: 'error', data: { error: 'retry me' } });
        return;
      }
      options.onEvent({
        event: 'message',
        data: { choices: [{ delta: { content: 'Clean retry output.' } }] },
      });
      options.onEvent({ event: 'message', data: '[DONE]' });
    },
  });

  const result = await api.streamLmStudioLocal({
    userText: 'test',
    messages: [],
    memories: {},
    onEvent: event => events.push(event),
  });

  assert.equal(result, 'Clean retry output.\n[MOOD:smug]');
  assert.equal(events.filter(event => event.type === 'stream.reset').length, 1);
  const resetIndex = events.findIndex(event => event.type === 'stream.reset');
  assert.ok(resetIndex > 0);
  assert.equal(events.slice(resetIndex + 1).filter(event => event.type === 'message.delta').map(event => event.content).join(''), 'Clean retry output.');
});

test('external stream cancellation remains an AbortError and never retries', async () => {
  const externalController = new AbortController();
  let calls = 0;
  const api = makeTransportApi({
    localTransport: 'chat',
    bindAbortSignal(controller, signal) {
      signal?.addEventListener('abort', () => controller.abort(), { once: true });
    },
    postJsonSse: async (_url, options) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
        externalController.abort();
      });
    },
  });

  await assert.rejects(
    api.streamLmStudioLocal({
      userText: 'test',
      messages: [],
      memories: {},
      abortSignal: externalController.signal,
      onEvent: () => {},
    }),
    error => error?.name === 'AbortError',
  );
  assert.equal(calls, 1);
});

test('stateful stream can report reasoning to server logs without leaking it into the visible reply', async () => {
  const reported = [];
  const laneRuntime = {};
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
    laneRuntime,
    onEvent: () => {},
  });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
  assert.equal(reported.length, 1);
  assert.equal(reported[0].transport, 'native-stateful-stream');
  assert.equal(reported[0].lane, 'chat');
  assert.match(reported[0].reasoningText, /Internal chain goes here/);
  assert.equal(laneRuntime.reasoningContract.requested.state, 'not-requested');
  assert.equal(laneRuntime.reasoningContract.effective.state, 'enabled');
  assert.equal(laneRuntime.reasoningContract.observed.state, 'reasoning-observed');
  assert.equal(laneRuntime.reasoningContract.observed.reasoningChars, 25);
});

test('stateful stream bounds 1,000 hidden reasoning chunks and emits one thinking transition', async () => {
  const events = [];
  const reported = [];
  const laneRuntime = {};
  const reasoningChunk = 'hidden-reasoning-fragment-'.padEnd(64, 'x');
  const api = makeTransportApi({
    postJsonSse: async (_url, options) => {
      for (let index = 0; index < 1_000; index += 1) {
        options.onEvent({ event: 'reasoning.delta', data: { content: reasoningChunk } });
      }
      options.onEvent({ event: 'message.delta', data: { content: 'Bounded visible reply.' } });
      options.onEvent({ event: 'chat.end', data: { result: {} } });
    },
    collectLmStudioStatefulChatStrings: () => ({
      responseId: 'resp_bounded_reasoning',
      outputText: 'Bounded visible reply.',
      reasoningText: '',
    }),
    reportLmStudioReasoning: payload => reported.push(payload),
  });

  const result = await api.streamLmStudioStatefulChatApi({
    userText: 'test',
    messages: [],
    memories: {},
    laneRuntime,
    onEvent: event => events.push(event),
  });

  assert.equal(result, 'Bounded visible reply.\n[MOOD:smug]');
  assert.equal(events.filter(event => event.type === 'status' && event.stage === 'thinking').length, 1);
  assert.equal(events.some(event => JSON.stringify(event).includes(reasoningChunk)), false);
  assert.deepEqual(laneRuntime.reasoningStream, {
    capturedChars: 8192,
    totalChars: reasoningChunk.length * 1_000,
    truncated: true,
  });
  assert.equal(reported.length, 1);
  assert.equal(reported[0].reasoningText.length, 8192);
  assert.equal(laneRuntime.reasoningContract.capability.state, 'supported');
  assert.equal(laneRuntime.reasoningContract.effective.state, 'enabled');
  assert.equal(laneRuntime.reasoningContract.observed.reasoningChars, reasoningChunk.length * 1_000);
  assert.equal(laneRuntime.reasoningContract.observed.truncated, true);
});

test('chat completions can report separate reasoning without leaking it into the visible reply', async () => {
  const reported = [];
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
    laneRuntime,
  });

  assert.equal(result, 'Visible reply only.\n[MOOD:smug]');
  assert.equal(reported.length, 1);
  assert.equal(reported[0].transport, 'chat-completions');
  assert.match(reported[0].reasoningText, /Hidden scratchpad/);
  assert.equal(laneRuntime.reasoningContract.requested.state, 'not-requested');
  assert.equal(laneRuntime.reasoningContract.effective.state, 'enabled');
  assert.equal(laneRuntime.reasoningContract.observed.state, 'reasoning-observed');
});
