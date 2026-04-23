const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function createMockSemanticRenderServer({
  reply = 'README.md and docs/README.md were both checked; the first is the app overview and the second is the docs routing layer.\n[MOOD:thinking]',
} = {}) {
  const chatBodies = [];
  const stats = {
    modelsRequests: 0,
    chatRequests: 0,
  };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      stats.modelsRequests += 1;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        object: 'list',
        data: [
          { id: 'unsloth/gemma-4-31b-it', object: 'model', owned_by: 'local' },
          { id: 'google/gemma-4-e4b', object: 'model', owned_by: 'local' },
        ],
      }));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const requestIndex = stats.chatRequests;
      stats.chatRequests += 1;
      const body = JSON.parse((await readRequestBody(req)) || '{}');
      chatBodies.push(body);
      const responseReply = typeof reply === 'function'
        ? reply({ body, requestIndex })
        : (Array.isArray(reply) ? reply[Math.min(requestIndex, reply.length - 1)] : reply);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        id: 'chatcmpl-semantic-render-mock',
        object: 'chat.completion',
        created: 0,
        model: body.model || 'google/gemma-4-e4b',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: responseReply,
            },
          },
        ],
        usage: {
          prompt_tokens: 1,
          completion_tokens: 1,
          total_tokens: 2,
        },
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Unhandled mock semantic-render route: ${req.method} ${url.pathname}` }));
  });

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error) => (error ? reject(error) : resolve()));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    chatBodies,
    stats,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function loadServerModuleForSemanticRender(baseUrl) {
  const originalEnv = {
    PORT: process.env.PORT,
    PENNY_MEMORY_FILE: process.env.PENNY_MEMORY_FILE,
    PENNY_MEMORY_ARCHIVE_FILE: process.env.PENNY_MEMORY_ARCHIVE_FILE,
    PENNY_MEMORY_EMBEDDINGS_FILE: process.env.PENNY_MEMORY_EMBEDDINGS_FILE,
    PENNY_MEMORY_BOOKS_FILE: process.env.PENNY_MEMORY_BOOKS_FILE,
    PENNY_LMSTUDIO_BASE: process.env.PENNY_LMSTUDIO_BASE,
    PENNY_LMSTUDIO_NATIVE_BASE: process.env.PENNY_LMSTUDIO_NATIVE_BASE,
    PENNY_LOCAL_LLM_TRANSPORT: process.env.PENNY_LOCAL_LLM_TRANSPORT,
    PENNY_LMSTUDIO_MODELS_PROBE_MS: process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS,
    PENNY_LMSTUDIO_CHAT_MODEL: process.env.PENNY_LMSTUDIO_CHAT_MODEL,
    PENNY_LMSTUDIO_TOOL_MODEL: process.env.PENNY_LMSTUDIO_TOOL_MODEL,
    PENNY_LMSTUDIO_EMBED_MODEL: process.env.PENNY_LMSTUDIO_EMBED_MODEL,
  };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-semantic-render-'));
  process.env.PORT = '0';
  process.env.PENNY_MEMORY_FILE = path.join(tmpDir, 'penny-memory.test.json');
  process.env.PENNY_MEMORY_ARCHIVE_FILE = path.join(tmpDir, 'penny-memory-archive.test.json');
  process.env.PENNY_MEMORY_EMBEDDINGS_FILE = path.join(tmpDir, 'penny-memory-embeddings.test.json');
  process.env.PENNY_MEMORY_BOOKS_FILE = path.join(tmpDir, 'penny-memory-books.test.json');
  process.env.PENNY_LMSTUDIO_BASE = baseUrl;
  process.env.PENNY_LMSTUDIO_NATIVE_BASE = baseUrl.replace(/\/v1$/, '/api/v1');
  process.env.PENNY_LOCAL_LLM_TRANSPORT = 'chat';
  process.env.PENNY_LMSTUDIO_MODELS_PROBE_MS = '1500';
  process.env.PENNY_LMSTUDIO_CHAT_MODEL = 'unsloth/gemma-4-31b-it';
  process.env.PENNY_LMSTUDIO_TOOL_MODEL = 'google/gemma-4-e4b';
  process.env.PENNY_LMSTUDIO_EMBED_MODEL = 'text-embedding-nomic-embed-text-v1.5';

  const modulePath = require.resolve('../server.js');
  delete require.cache[modulePath];
  const serverModule = require('../server.js');
  return {
    serverModule,
    cleanup() {
      delete require.cache[modulePath];
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

function buildSemanticRenderArgs(overrides = {}) {
  return {
    userText: 'Compare README.md with docs/README.md and tell me the short takeaway.',
    messages: [
      { role: 'user', content: 'Compare README.md with docs/README.md and tell me the short takeaway.' },
    ],
    memories: {
      userName: 'Malac',
    },
    file: null,
    text: 'README.md and docs/README.md both matter here.\n[MOOD:thinking]',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
      { name: 'read_project_file', label: 'read docs/README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: {
            path: 'README.md',
            excerpt: '# Penny Companion Prototype',
          },
        },
      },
      {
        name: 'read_project_file',
        args: { path: 'docs/README.md' },
        result: {
          ok: true,
          label: 'read docs/README.md',
          data: {
            path: 'docs/README.md',
            excerpt: '# Docs',
          },
        },
      },
    ],
    toolOutcome: null,
    toolEvidenceFacts: [{
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0, 1],
    }],
    skipSemanticRender: false,
    laneRuntime: {
      localLane: 'tool',
      modelUsed: true,
      executionPath: 'llm-tool-loop',
      performance: {},
    },
    latencyBudget: {
      allowSemanticRender: true,
      latencyClass: 'tool-heavy',
    },
    ...overrides,
  };
}

test('maybeRenderHardTurnReply appends semantic_render evidence only after summarized semantic core enters the model prompt', async () => {
  const mockLmStudio = await createMockSemanticRenderServer();
  const { serverModule, cleanup } = loadServerModuleForSemanticRender(mockLmStudio.baseUrl);
  try {
    const result = await serverModule.maybeRenderHardTurnReply(buildSemanticRenderArgs());

    assert.equal(mockLmStudio.stats.chatRequests, 1);
    assert.equal(
      result.text,
      'README.md and docs/README.md were both checked; the first is the app overview and the second is the docs routing layer.',
    );
    assert.equal(Array.isArray(result.toolEvidenceFacts), true);
    assert.equal(result.toolEvidenceFacts.length, 2);
    assert.deepEqual(result.toolEvidenceFacts[0], {
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0, 1],
    });
    assert.deepEqual(result.toolEvidenceFacts[1], {
      path: 'semantic_render',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'summarized_semantic_core',
      modelHop: 'single',
      toolRecordIndexes: [0, 1],
    });

    const semanticPrompt = String(mockLmStudio.chatBodies[0]?.messages?.[1]?.content || '');
    assert.match(semanticPrompt, /Verified semantic core:/i);
    assert.match(semanticPrompt, /Tool: read_project_file/i);
    assert.match(semanticPrompt, /README\.md/i);
    assert.match(semanticPrompt, /docs\/README\.md/i);
  } finally {
    cleanup();
    await mockLmStudio.close();
  }
});

test('maybeRenderHardTurnReply does not duplicate an existing semantic_render evidence fact', async () => {
  const mockLmStudio = await createMockSemanticRenderServer();
  const { serverModule, cleanup } = loadServerModuleForSemanticRender(mockLmStudio.baseUrl);
  try {
    const result = await serverModule.maybeRenderHardTurnReply(buildSemanticRenderArgs({
      toolEvidenceFacts: [
        {
          path: 'native_tool_loop',
          promptVisibility: 'prompt_visible',
          nonPromptUse: 'none',
          renderForm: 'raw_json',
          modelHop: 'multi',
          toolRecordIndexes: [0, 1],
        },
        {
          path: 'semantic_render',
          promptVisibility: 'prompt_visible',
          nonPromptUse: 'none',
          renderForm: 'summarized_semantic_core',
          modelHop: 'single',
          toolRecordIndexes: [0, 1],
        },
      ],
    }));

    assert.equal(mockLmStudio.stats.chatRequests, 1);
    assert.equal(result.toolEvidenceFacts.length, 2);
    assert.equal(result.toolEvidenceFacts.filter((fact) => fact.path === 'semantic_render').length, 1);
    assert.deepEqual(result.toolEvidenceFacts[1], {
      path: 'semantic_render',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'summarized_semantic_core',
      modelHop: 'single',
      toolRecordIndexes: [0, 1],
    });
  } finally {
    cleanup();
    await mockLmStudio.close();
  }
});

test('maybeRenderHardTurnReply repairs Qwen-style preamble-only tool summaries', async () => {
  const mockLmStudio = await createMockSemanticRenderServer({
    reply: [
      "Here is the breakdown of how the two docs actually connect.\n[MOOD:thinking]",
      "- `README.md` is the app-facing overview.\n- `docs/README.md` is the docs routing layer.\n[MOOD:thinking]",
    ],
  });
  const { serverModule, cleanup } = loadServerModuleForSemanticRender(mockLmStudio.baseUrl);
  try {
    const result = await serverModule.maybeRenderHardTurnReply(buildSemanticRenderArgs({
      userText: 'Compare README.md with docs/README.md. Use bullets.',
    }));

    assert.equal(mockLmStudio.stats.chatRequests, 2);
    assert.equal(
      result.text,
      '- `README.md` is the app-facing overview.\n- `docs/README.md` is the docs routing layer.',
    );
    assert.equal(result.repair.repairAttempted, true);
    assert.equal(result.repair.repairAccepted, true);
    assert.equal(result.repair.finalCandidateSource, 'repair');
    assert.equal(result.repair.firstPassGuardCodes.includes('preamble_only_visible_reply'), true);
    assert.equal(result.repair.firstPassGuardCodes.includes('tool_summary_too_thin'), true);
    assert.equal(result.repair.firstPassGuardCodes.includes('requested_structure_missing'), true);
    const repairPrompt = String(mockLmStudio.chatBodies[1]?.messages?.[1]?.content || '');
    assert.match(repairPrompt, /Do not return a setup sentence by itself/i);
    assert.match(repairPrompt, /The user asked for a structured answer/i);
  } finally {
    cleanup();
    await mockLmStudio.close();
  }
});

test('maybeRenderHardTurnReply repairs clipped tool summaries with dangling inline markers', async () => {
  const mockLmStudio = await createMockSemanticRenderServer({
    reply: [
      'Found it. The logic lives in `lib/penny-visible-reply.js`. The function is `stripThinkSpans` and it handles targeting `\n[MOOD:thinking]',
      'Found it. `stripThinkSpans` lives in `lib/penny-visible-reply.js`, and the route repair guard is in `server.js`.\n[MOOD:thinking]',
    ],
  });
  const { serverModule, cleanup } = loadServerModuleForSemanticRender(mockLmStudio.baseUrl);
  try {
    const result = await serverModule.maybeRenderHardTurnReply(buildSemanticRenderArgs());

    assert.equal(mockLmStudio.stats.chatRequests, 2);
    assert.equal(
      result.text,
      'Found it. `stripThinkSpans` lives in `lib/penny-visible-reply.js`, and the route repair guard is in `server.js`.',
    );
    assert.equal(result.repair.repairAttempted, true);
    assert.equal(result.repair.repairAccepted, true);
    assert.equal(result.repair.firstPassGuardCodes.includes('clipped_visible_reply'), true);
    const repairPrompt = String(mockLmStudio.chatBodies[1]?.messages?.[1]?.content || '');
    assert.match(repairPrompt, /dangling quotes, dangling backticks/i);
  } finally {
    cleanup();
    await mockLmStudio.close();
  }
});

test('maybeRenderHardTurnReply salvages complete prefix when Qwen repeats a clipped trailing block', async () => {
  const clipped = [
    '*   **`lib/penny-visible-reply.js`**',
    '    *   `stripThinkSpans`: strips hidden reasoning spans before the visible reply is classified.',
    '',
    '*   **`server.js`**',
    '    *   `collectReplyGuardCodes`: flags clipped or preamble-only final answers before accepting semantic render output.',
    '',
    '*   **`tmp/broken-helper.js`**',
    '    *   `stripThinkingTags(text)`: uses the regex `/',
    '[MOOD:thinking]',
  ].join('\n');
  const mockLmStudio = await createMockSemanticRenderServer({
    reply: [clipped, clipped],
  });
  const { serverModule, cleanup } = loadServerModuleForSemanticRender(mockLmStudio.baseUrl);
  try {
    const result = await serverModule.maybeRenderHardTurnReply(buildSemanticRenderArgs({
      userText: 'Use bullets and include concrete file paths.',
    }));

    assert.equal(mockLmStudio.stats.chatRequests, 2);
    assert.equal(result.repair.repairAttempted, true);
    assert.equal(result.repair.repairAccepted, true);
    assert.equal(result.repair.finalCandidateSource, 'deterministic-salvage');
    assert.match(result.text, /lib\/penny-visible-reply\.js/);
    assert.match(result.text, /server\.js/);
    assert.doesNotMatch(result.text, /tmp\/broken-helper\.js/);
    assert.doesNotMatch(result.text, /regex `\//);
  } finally {
    cleanup();
    await mockLmStudio.close();
  }
});

test('maybeRenderHardTurnReply leaves semantic_render evidence absent when semantic rendering is skipped before prompt assembly', async () => {
  const mockLmStudio = await createMockSemanticRenderServer();
  const { serverModule, cleanup } = loadServerModuleForSemanticRender(mockLmStudio.baseUrl);
  try {
    const result = await serverModule.maybeRenderHardTurnReply(buildSemanticRenderArgs({
      skipSemanticRender: true,
    }));

    assert.equal(mockLmStudio.stats.chatRequests, 0);
    assert.equal(result.text, 'README.md and docs/README.md both matter here.');
    assert.deepEqual(result.toolEvidenceFacts, [{
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0, 1],
    }]);
  } finally {
    cleanup();
    await mockLmStudio.close();
  }
});
