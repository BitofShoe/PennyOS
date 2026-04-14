const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDirectIntentApi,
} = require('../lib/penny-direct-intents');
const {
  createDirectToolAssistApi,
} = require('../lib/penny-direct-tool-assist');

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
      return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
    },
    stripReplyMoodTags(text = '') {
      return String(text || '').replace(/\s*\[MOOD:[^\]]+\]\s*$/i, '').trimEnd();
    },
    LOCAL_LLM_TRANSPORT: 'auto',
  });
}

function buildDirectToolAssistApi(overrides = {}) {
  const directIntentApi = buildDirectIntentApi();
  let lmAssistCalls = 0;
  const api = createDirectToolAssistApi({
    executePennyTool: overrides.executePennyTool || (async () => ({ ok: true, label: 'ok', data: {} })),
    executeDirectProjectInspectIntent: overrides.executeDirectProjectInspectIntent || (async () => ({
      toolsUsed: [],
      results: [],
      fallbackText: 'inspect fallback\n[MOOD:thinking]',
    })),
    runLmStudioToolContextAnswer: overrides.runLmStudioToolContextAnswer || (async () => {
      lmAssistCalls += 1;
      return 'lm assist fallback\n[MOOD:thinking]';
    }),
    composeDirectRuntimeReply: directIntentApi.composeDirectRuntimeReply,
    composeDirectSyntaxReply: directIntentApi.composeDirectSyntaxReply,
    composeDirectGitStatusReply: directIntentApi.composeDirectGitStatusReply,
    composeDirectSearchReply: directIntentApi.composeDirectSearchReply,
    composeDirectReadReply: directIntentApi.composeDirectReadReply,
    composeDirectFileListReply: directIntentApi.composeDirectFileListReply,
    composeDirectWebSearchReply: directIntentApi.composeDirectWebSearchReply,
    composeDirectWebPageReply: directIntentApi.composeDirectWebPageReply,
    composeToolRecordFallback: directIntentApi.composeToolRecordFallback,
    shouldUseDirectReadReply: directIntentApi.shouldUseDirectReadReply,
    clampNumber(value, min, max, fallback = min) {
      const num = Number(value);
      if (!Number.isFinite(num)) return fallback;
      return Math.min(max, Math.max(min, Math.round(num)));
    },
    normalizeWebUrl(url = '') {
      const cleaned = String(url || '').trim().replace(/[),.;!?]+$/g, '');
      return /^https?:\/\//i.test(cleaned) ? cleaned : '';
    },
    WEB_SEARCH_MAX_RESULTS: 6,
  });
  return {
    ...api,
    getLmAssistCalls: () => lmAssistCalls,
  };
}

test('executeDirectToolSequence stops after the first failed verification step', async () => {
  const calls = [];
  const { executeDirectToolSequence } = buildDirectToolAssistApi({
    executePennyTool: async (name, args) => {
      calls.push({ name, args });
      if (name === 'replace_in_project_file') {
        return { ok: true, label: 'edited server.js', data: { path: 'server.js', replaced: 1 } };
      }
      if (name === 'run_node_check') {
        return { ok: false, label: 'syntax check failed', data: { path: 'server.js', ok: false, stderr: 'Unexpected token' } };
      }
      return { ok: true, label: 'git ok', data: { ok: true, status: 'M server.js' } };
    },
  });

  const result = await executeDirectToolSequence({
    steps: [
      { name: 'replace_in_project_file', args: { path: 'server.js', find: 'old', replace: 'new' } },
      { name: 'run_node_check', args: { path: 'server.js' } },
      { name: 'get_git_status', args: {} },
    ],
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((entry) => entry.name), ['replace_in_project_file', 'run_node_check']);
  assert.equal(result.toolsUsed.length, 2);
  assert.equal(result.results[1].result.ok, false);
});

test('runDirectToolAssist keeps inspect_web_result useful when page fetch fails', async () => {
  const { runDirectToolAssist, getLmAssistCalls } = buildDirectToolAssistApi({
    executePennyTool: async (name) => {
      if (name === 'search_web') {
        return {
          ok: true,
          label: 'searched the web',
          data: {
            query: 'openclaw browser docs',
            results: [
              {
                title: 'Browser Tool',
                url: 'https://docs.openclaw.ai/tools/browser',
                snippet: 'Browser automation for websites and page interactions.',
              },
            ],
          },
        };
      }
      if (name === 'read_web_page') {
        return {
          ok: false,
          label: 'failed to read browser docs',
          data: { error: 'too large', url: 'https://docs.openclaw.ai/tools/browser' },
        };
      }
      throw new Error(`Unexpected tool ${name}`);
    },
  });

  const result = await runDirectToolAssist({
    userText: 'Search the web for the OpenClaw browser docs and tell me what it is.',
    messages: [],
    memories: {},
    intent: { name: 'inspect_web_result', args: { query: 'openclaw browser docs', limit: 5 } },
  });

  assert.match(result.text, /Browser Tool/);
  assert.match(result.text, /Browser automation for websites and page interactions\./);
  assert.equal(result.skipSemanticRender, true);
  assert.equal(getLmAssistCalls(), 0);
});

test('runDirectToolAssist keeps read, search, and list intents on deterministic replies', async () => {
  const cases = [
    {
      label: 'read',
      userText: 'Open public/app.js and do not edit anything. Just tell me what it says.',
      intent: { name: 'read_project_file', args: { path: 'public/app.js', startLine: 1, endLine: 3 } },
      response: {
        ok: true,
        label: 'read public/app.js',
        data: { path: 'public/app.js', startLine: 1, endLine: 3, excerpt: '1:const hi = true;' },
      },
      expected: /did not edit anything/i,
    },
    {
      label: 'search',
      userText: 'Search the repo for MEMORY_PROMPT_LIMIT.',
      intent: { name: 'search_project_text', args: { query: 'MEMORY_PROMPT_LIMIT', limit: 8 } },
      response: {
        ok: true,
        label: 'searched "MEMORY_PROMPT_LIMIT"',
        data: {
          query: 'MEMORY_PROMPT_LIMIT',
          hits: [{ path: 'server.js', line: 10, text: 'const MEMORY_PROMPT_LIMIT = 12;' }],
        },
      },
      expected: /strongest hits/i,
    },
    {
      label: 'list',
      userText: 'Find Penny\'s Playground in the repo.',
      intent: { name: 'list_project_files', args: { path: '.', recursive: true, pattern: "Penny's Playground", limit: 24 } },
      response: {
        ok: true,
        label: 'listed .',
        data: { pattern: "Penny's Playground", items: ["Penny's Playground/"] },
      },
      expected: /Penny's Playground/i,
    },
  ];

  for (const scenario of cases) {
    const { runDirectToolAssist, getLmAssistCalls } = buildDirectToolAssistApi({
      executePennyTool: async () => scenario.response,
    });
    const result = await runDirectToolAssist({
      userText: scenario.userText,
      messages: [],
      memories: {},
      intent: scenario.intent,
    });
    assert.equal(result.skipSemanticRender, true, `${scenario.label} should skip semantic render`);
    assert.match(result.text, scenario.expected, `${scenario.label} reply should stay deterministic`);
    assert.equal(getLmAssistCalls(), 0, `${scenario.label} should not call LM tool assist`);
  }
});

test('runDirectToolAssist keeps focused read-around-match requests deterministic', async () => {
  const { runDirectToolAssist, getLmAssistCalls } = buildDirectToolAssistApi({
    executePennyTool: async () => ({
      ok: true,
      label: 'read public/js/penny-app.js around attachments',
      data: {
        path: 'public/js/penny-app.js',
        query: 'attachments',
        matchLine: 42,
        startLine: 40,
        endLine: 44,
        excerpt: '42:const attachmentUi = createAttachmentUi({ els, setComposerNotice });',
      },
    }),
  });

  const result = await runDirectToolAssist({
    userText: 'Open public/js/penny-app.js and tell me what it says about attachments.',
    messages: [],
    memories: {},
    intent: { name: 'read_project_file_around_match', args: { path: 'public/js/penny-app.js', query: 'attachments' } },
  });

  assert.equal(result.skipSemanticRender, true);
  assert.match(result.text, /short version: it does mention attachments around line 42/i);
  assert.equal(getLmAssistCalls(), 0);
});
