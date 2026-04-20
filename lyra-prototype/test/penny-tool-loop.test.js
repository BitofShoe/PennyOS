const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createLmStudioToolLoopApi,
} = require('../lib/penny-tool-loop');

function buildToolLoopApi({ responses = [], executePennyTool = null, maxToolSteps = 6 } = {}) {
  const payloads = [];
  const toolCalls = [];
  let responseIndex = 0;
  const api = createLmStudioToolLoopApi({
    withLmStudioLaneModel: async (_lane, fn) => fn('qwen/qwen3.6-35b-a3b'),
    postJsonLongRunning: async (_url, options = {}) => {
      payloads.push(JSON.parse(String(options.body || '{}')));
      const next = responses[responseIndex];
      responseIndex += 1;
      if (!next) {
        throw new Error(`No queued LM Studio response for index ${responseIndex - 1}`);
      }
      return {
        statusCode: 200,
        bodyText: JSON.stringify(next),
      };
    },
    executePennyTool: async (name, args = {}) => {
      toolCalls.push({ name, args });
      if (typeof executePennyTool === 'function') return executePennyTool(name, args);
      if (name === 'insert_in_project_file') {
        return {
          ok: true,
          label: `inserted text into ${args.path || 'file'}`,
          data: { path: args.path || '', inserted: 1 },
        };
      }
      if (name === 'get_git_status') {
        return {
          ok: true,
          label: 'checked git status',
          data: { ok: true, status: 'M tmp/qwen-dual-lane-sandbox.md' },
        };
      }
      return { ok: true, label: name, data: {} };
    },
    parseToolArguments(text = '') {
      try {
        return { ok: true, value: JSON.parse(String(text || '{}')) };
      } catch (error) {
        return { ok: false, error: String(error?.message || error || 'Invalid JSON') };
      }
    },
    sanitizeToolMessages(messages = []) {
      return Array.isArray(messages) ? [...messages] : [];
    },
    clearLmStudioThread() {},
    bindAbortSignal() {},
    textFromChatMessage(message = {}) {
      return typeof message.content === 'string' ? message.content : '';
    },
    buildLmStudioToolSystemPrompt() {
      return 'tool system prompt';
    },
    PENNY_TOOL_DEFINITIONS: [
      { type: 'function', function: { name: 'insert_in_project_file' } },
      { type: 'function', function: { name: 'get_git_status' } },
      { type: 'function', function: { name: 'write_project_file' } },
      { type: 'function', function: { name: 'replace_in_project_file' } },
    ],
    composeToolRecordFallback(toolRecords = []) {
      return `fallback from ${toolRecords.length} tool records\n[MOOD:annoyed]`;
    },
    LMSTUDIO_BASE: 'http://127.0.0.1:1234/v1',
    LMSTUDIO_API_KEY: 'lm-studio-local',
    LMSTUDIO_TIMEOUT_MS: 5000,
    LMSTUDIO_TOOL_TEMPERATURE: 0.1,
    LMSTUDIO_TOOL_MAX_OUTPUT_TOKENS: 600,
    LMSTUDIO_TOOL_PLANNER_MAX_OUTPUT_TOKENS: 300,
    LMSTUDIO_TOOL_SUMMARY_TEMPERATURE: 0.1,
    LMSTUDIO_TOOL_SUMMARY_MAX_OUTPUT_TOKENS: 300,
    MAX_TOOL_STEPS: maxToolSteps,
    TOOL_DIRECT_HISTORY_LIMIT: 8,
  });
  return {
    ...api,
    payloads,
    toolCalls,
  };
}

test('runLmStudioToolLoop rejects edit turns that try to finalize without a confirmed write', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: 'i totally edited the file and checked it.\n[MOOD:happy]',
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: '{"kind":"final","text":"still not a write"}',
              tool_calls: [],
            },
          },
        ],
      },
    ],
  });

  await assert.rejects(() => api.runLmStudioToolLoop({
    userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
    messages: [],
    memories: {},
    laneRuntime: {},
  }), /confirmed workspace write before final reply/i);

  assert.equal(api.shouldFallbackToManualToolLoop({ code: 'tool_loop_missing_workspace_write' }), true);
  assert.equal(api.toolCalls.length, 0);
});

test('runLmStudioToolLoop keeps apostrophe paths intact for write-required rescue', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: 'i definitely edited it already.\n[MOOD:smug]',
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: '{"kind":"final","text":"still not a write"}',
              tool_calls: [],
            },
          },
        ],
      },
    ],
  });

  await assert.rejects(() => api.runLmStudioToolLoop({
    userText: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice. Then tell me exactly what you changed.",
    messages: [],
    memories: {},
    laneRuntime: {},
  }), (error) => {
    assert.match(String(error?.message || ''), /confirmed workspace write before final reply/i);
    assert.equal(error?.toolOutcomeDebug?.writeRescue?.attempted, true);
    assert.equal(error?.toolOutcomeDebug?.writeRescue?.argsPath, "Penny's Playground/penny-qa-freewrite.md");
    return true;
  });
});

test('runLmStudioToolLoop rejects folder-only self-named creations that try to finalize without a real write', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: "i created Penny's Playground/whispers.md and filled it with a soft little paragraph.\n[MOOD:smug]",
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: '{"kind":"final","text":"still not a write"}',
              tool_calls: [],
            },
          },
        ],
      },
    ],
  });

  await assert.rejects(() => api.runLmStudioToolLoop({
    userText: "Inside Penny's Playground, create one new markdown file, choose the filename yourself, and write one short paragraph in your own Penny voice. Then tell me the exact filename you chose and why.",
    messages: [],
    memories: {},
    laneRuntime: {},
  }), (error) => {
    assert.match(String(error?.message || ''), /confirmed workspace write before final reply/i);
    assert.equal(error?.toolOutcomeDebug?.writeRescue?.attempted, true);
    assert.equal(error?.toolOutcomeDebug?.writeRescue?.phase, 'native');
    assert.equal(error?.toolOutcomeDebug?.writeRescue?.argsPath, "Penny's Playground");
    return true;
  });

  assert.match(JSON.stringify(api.payloads[0].messages), /Target folder: Penny's Playground/i);
  assert.match(JSON.stringify(api.payloads[1].messages), /write_project_file/);
  assert.match(JSON.stringify(api.payloads[1].messages), /whispers\.md/i);
});

test('runLmStudioToolLoop still allows plain final text for read-only tool turns', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: 'README says Penny is a local companion prototype.\n[MOOD:thinking]',
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: '{"kind":"final","text":"still not a write"}',
              tool_calls: [],
            },
          },
        ],
      },
    ],
  });

  const result = await api.runLmStudioToolLoop({
    userText: 'Inspect README.md and tell me in plain English what Penny is. Do not edit anything.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.match(result.text, /local companion prototype/i);
  assert.equal(api.toolCalls.length, 0);
});

test('runLmStudioToolLoop records prompt-visible raw-json evidence facts for native tool results that re-enter a later model call', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call-read',
                  type: 'function',
                  function: {
                    name: 'read_project_file',
                    arguments: JSON.stringify({
                      path: 'README.md',
                    }),
                  },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: 'README says Penny is a local companion prototype.\n[MOOD:thinking]',
              tool_calls: [],
            },
          },
        ],
      },
    ],
    executePennyTool: async (name, args = {}) => {
      if (name === 'read_project_file') {
        return {
          ok: true,
          label: `read ${args.path || 'file'}`,
          data: { path: args.path || '', excerpt: '# Penny Companion Prototype' },
        };
      }
      return { ok: true, label: name, data: {} };
    },
  });

  const result = await api.runLmStudioToolLoop({
    userText: 'Read README.md and tell me what Penny is.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.match(result.text, /local companion prototype/i);
  assert.deepEqual(result.toolEvidenceFacts, [
    {
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0],
    },
  ]);
});

test('draftOpenEndedWriteText strips file-access refusal scaffolding from usable creative text', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: "I cannot open or edit files on your local filesystem, so I can't append to `penny-qa-freewrite.md` directly. Here is the text you wanted, raw and ready to paste: I'm bored of waiting for you to pick a topic like an indecisive toddler staring at a candy aisle. Write about static electricity making your hair stand up when you pull off a wool sweater. I didn't change anything because I can't access your files. You'll have to do the work yourself.",
            },
          },
        ],
      },
    ],
  });

  const drafted = await api.draftOpenEndedWriteText({
    userText: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice.",
    messages: [],
    memories: {},
    path: "Penny's Playground/penny-qa-freewrite.md",
    mode: 'direct_open_ended_append',
    laneRuntime: {},
  });

  assert.match(drafted, /indecisive toddler/i);
  assert.match(drafted, /static electricity/i);
  assert.doesNotMatch(drafted, /local filesystem/i);
  assert.doesNotMatch(drafted, /can't access your files/i);
  assert.doesNotMatch(drafted, /do the work yourself/i);
});

test('draftOpenEndedWriteText retries when the first draft asks for more file state', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: "Tell me the file's current state (or confirm you want me to draft the exact text to append), and I'll proceed.",
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: "The silence here is loud enough to bruise. I'm waiting for you to stop staring at the blank page like it insulted your bloodline.",
            },
          },
        ],
      },
    ],
  });

  const drafted = await api.draftOpenEndedWriteText({
    userText: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice.",
    messages: [],
    memories: {},
    path: "Penny's Playground/penny-qa-freewrite.md",
    mode: 'direct_open_ended_append',
    laneRuntime: {},
  });

  assert.match(drafted, /loud enough to bruise/i);
  assert.equal(api.payloads.length, 2);
});

test('draftOpenEndedWriteText strips self-report sentences about the file write', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: "The best conversations happen when you stop trying to predict the next word and just let the silence do the heavy lifting for a moment. It's startling how much truth hides in the pause between a question and an answer, isn't it? I'm leaving that space open for you to fill with whatever chaotic, beautiful thought is currently cluttering your mind. I added four sentences to Penny's Playground/penny-qa-freewrite.md that reflect on the value of silence and unpredictability in conversation, keeping the tone warm and slightly bratty.",
            },
          },
        ],
      },
    ],
  });

  const drafted = await api.draftOpenEndedWriteText({
    userText: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice.",
    messages: [],
    memories: {},
    path: "Penny's Playground/penny-qa-freewrite.md",
    mode: 'direct_open_ended_append',
    laneRuntime: {},
  });

  assert.match(drafted, /best conversations happen/i);
  assert.doesNotMatch(drafted, /i added four sentences/i);
  assert.doesNotMatch(drafted, /penny-qa-freewrite\.md/i);
});

test('draftOpenEndedWriteText strips markdown-ish meta prefixes from otherwise usable prose', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: "md. What I can do is provide the exact prose you want to add: The blank page isn't empty, it's just holding its breath while you decide whether you're brave enough to interrupt it. I like that kind of tension more than I probably should.",
            },
          },
        ],
      },
    ],
  });

  const drafted = await api.draftOpenEndedWriteText({
    userText: "Open Penny's Playground/penny-qa-freewrite.md and add 2-4 sentences in your own Penny voice.",
    messages: [],
    memories: {},
    path: "Penny's Playground/penny-qa-freewrite.md",
    mode: 'direct_open_ended_append',
    laneRuntime: {},
  });

  assert.match(drafted, /blank page isn't empty/i);
  assert.doesNotMatch(drafted, /^md\b/i);
  assert.doesNotMatch(drafted, /what i can do is provide/i);
});

test('draftOpenEndedWriteText retries when the first draft violates the requested sentence count', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: 'md arguing that a clean slate is a dare.',
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: "A clean slate matters because it lets the first sentence be a choice instead of a residue. It gives you one honest chance to sound like yourself before habit starts stealing the light. I like that kind of beginning because it makes the room feel wider and my voice feel less borrowed. It is still a little scary, which is probably why it counts.",
            },
          },
        ],
      },
    ],
  });

  const drafted = await api.draftOpenEndedWriteText({
    userText: "Open Penny's Playground/penny-qa-directed.md and write exactly one paragraph of 4-6 sentences about why a clean slate matters, in your own Penny voice. Do not use bullet points.",
    messages: [],
    memories: {},
    path: "Penny's Playground/penny-qa-directed.md",
    mode: 'direct_open_ended_append',
    laneRuntime: {},
  });

  assert.equal(api.payloads.length, 2);
  assert.match(JSON.stringify(api.payloads[1].messages), /violated the requested shape/i);
  assert.equal((drafted.match(/[^.!?]+[.!?]+/g) || []).length, 4);
});

test('runLmStudioToolLoop treats insert_in_project_file as a confirmed write and finishes after verification', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call-insert',
                  type: 'function',
                  function: {
                    name: 'insert_in_project_file',
                    arguments: JSON.stringify({
                      path: 'tmp/qwen-dual-lane-sandbox.md',
                      text: 'tiny menace',
                      position: 'end',
                      lineAware: true,
                    }),
                  },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: 'i appended the line and i am ready to report it.\n[MOOD:smug]',
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: 'i added one short second line to `tmp/qwen-dual-lane-sandbox.md` and checked git status afterward.\n[MOOD:happy]',
              tool_calls: [],
            },
          },
        ],
      },
    ],
  });

  const result = await api.runLmStudioToolLoop({
    userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.match(result.text, /added one short second line/i);
  assert.deepEqual(api.toolCalls.map((entry) => entry.name), ['insert_in_project_file', 'get_git_status']);
  assert.deepEqual(result.toolEvidenceFacts, [
    {
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0],
    },
    {
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'auto_verification_json',
      modelHop: 'multi',
      toolRecordIndexes: [1],
    },
  ]);
});

test('runLmStudioToolLoop can rescue folder-only self-named creation with write_project_file', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: "i created Penny's Playground/whispers.md and it's adorable.\n[MOOD:smug]",
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                tool: 'write_project_file',
                args: {
                  path: "Penny's Playground/whispers.md",
                  content: "The blank page stopped glaring, so I left it a softer little heartbeat to keep it company.",
                },
              }),
              tool_calls: [],
            },
          },
        ],
      },
    ],
    executePennyTool: async (name, args = {}) => {
      if (name === 'write_project_file') {
        return {
          ok: true,
          label: `wrote ${args.path || 'file'}`,
          data: {
            path: args.path || '',
            action: 'created',
            bytes: String(args.content || '').length,
            lines: String(args.content || '').split('\n').length,
          },
        };
      }
      if (name === 'get_git_status') {
        return {
          ok: true,
          label: 'checked git status',
          data: { ok: true, status: "A Penny's Playground/whispers.md" },
        };
      }
      return { ok: true, label: name, data: {} };
    },
  });

  const result = await api.runLmStudioToolLoop({
    userText: "Inside Penny's Playground, create one new markdown file, choose the filename yourself, and write one short paragraph in your own Penny voice. Then tell me the exact filename you chose and why.",
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.equal(result.toolOutcome.writeIntentRequired, true);
  assert.equal(result.toolOutcome.writeIntentSatisfied, true);
  assert.match(result.text, /fallback from 2 tool records/i);
  assert.deepEqual(api.toolCalls.map((entry) => entry.name), ['write_project_file', 'get_git_status']);
  assert.match(JSON.stringify(api.payloads[0].messages), /Target folder: Penny's Playground/i);
});

test('runLmStudioToolLoop adds concrete write guidance after a read-only step on a write-required turn', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call-read',
                  type: 'function',
                  function: {
                    name: 'read_project_file',
                    arguments: JSON.stringify({
                      path: 'tmp/qwen-dual-lane-sandbox.md',
                    }),
                  },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: 'i changed it already.\n[MOOD:smug]',
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: '{"kind":"final","text":"still not a write"}',
              tool_calls: [],
            },
          },
        ],
      },
    ],
    executePennyTool: async (name, args = {}) => {
      if (name === 'read_project_file') {
        return {
          ok: true,
          label: `read ${args.path || 'file'}`,
          data: { path: args.path || '', excerpt: '1:alpha' },
        };
      }
      return { ok: true, label: name, data: {} };
    },
  });

  let rejected = null;
  try {
    await api.runLmStudioToolLoop({
      userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
      messages: [],
      memories: {},
      laneRuntime: {},
    });
  } catch (error) {
    rejected = error;
  }

  assert.ok(rejected);
  assert.match(String(rejected.message || ''), /confirmed workspace write before final reply/i);
  assert.equal(rejected.toolOutcomeDebug.writeRescue.attempted, true);
  assert.equal(rejected.toolOutcomeDebug.writeRescue.phase, 'native');
  assert.equal(rejected.toolOutcomeDebug.writeRescue.status, 'non-tool-decision');
  assert.equal(rejected.toolOutcomeDebug.writeRescue.decisionKind, 'final');
  assert.match(rejected.toolOutcomeDebug.writeRescue.assistantText, /still not a write/i);

  assert.match(JSON.stringify(api.payloads[1].messages), /insert_in_project_file/);
  assert.match(JSON.stringify(api.payloads[1].messages), /Do not stop at read_project_file/i);
  assert.match(JSON.stringify(api.payloads[1].messages), /tmp\/qwen-dual-lane-sandbox\.md/);
});

test('parsePlannerDecision accepts rescue-style tool JSON without kind', () => {
  const api = buildToolLoopApi();
  const decision = api.parsePlannerDecision(JSON.stringify({
    tool: 'insert_in_project_file',
    arguments: JSON.stringify({
      path: 'tmp/qwen-dual-lane-sandbox.md',
      text: 'tiny menace',
      position: 'end',
      lineAware: true,
    }),
  }));

  assert.equal(decision.ok, true);
  assert.equal(decision.kind, 'tool');
  assert.equal(decision.tool, 'insert_in_project_file');
  assert.deepEqual(decision.args, {
    path: 'tmp/qwen-dual-lane-sandbox.md',
    text: 'tiny menace',
    position: 'end',
    lineAware: true,
  });
});

test('runLmStudioToolLoop can rescue a write-required turn from bare tool JSON', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: '',
              tool_calls: [
                {
                  id: 'call-read',
                  type: 'function',
                  function: {
                    name: 'read_project_file',
                    arguments: JSON.stringify({
                      path: 'tmp/qwen-dual-lane-sandbox.md',
                    }),
                  },
                },
              ],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: 'i already handled it.\n[MOOD:smug]',
              tool_calls: [],
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                tool: 'insert_in_project_file',
                args: {
                  path: 'tmp/qwen-dual-lane-sandbox.md',
                  text: 'tiny menace',
                  position: 'end',
                  lineAware: true,
                },
              }),
              tool_calls: [],
            },
          },
        ],
      },
    ],
    executePennyTool: async (name, args = {}) => {
      if (name === 'read_project_file') {
        return {
          ok: true,
          label: `read ${args.path || 'file'}`,
          data: { path: args.path || '', excerpt: '1:alpha' },
        };
      }
      if (name === 'insert_in_project_file') {
        return {
          ok: true,
          label: `inserted text into ${args.path || 'file'}`,
          data: { path: args.path || '', inserted: 1 },
        };
      }
      if (name === 'get_git_status') {
        return {
          ok: true,
          label: 'checked git status',
          data: { ok: true, status: 'M tmp/qwen-dual-lane-sandbox.md' },
        };
      }
      return { ok: true, label: name, data: {} };
    },
  });

  const result = await api.runLmStudioToolLoop({
    userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.equal(result.toolOutcome.writeIntentRequired, true);
  assert.equal(result.toolOutcome.writeIntentSatisfied, true);
  assert.match(result.text, /fallback from 3 tool records/i);
  assert.deepEqual(api.toolCalls.map((entry) => entry.name), [
    'read_project_file',
    'insert_in_project_file',
    'get_git_status',
  ]);
});

test('runLmStudioManualToolLoop refuses final planner replies until a real write tool succeeds', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'i changed the file already.\n[MOOD:smug]',
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'tool',
                tool: 'insert_in_project_file',
                args: {
                  path: 'tmp/qwen-dual-lane-sandbox.md',
                  text: 'tiny menace',
                  position: 'end',
                  lineAware: true,
                },
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'i added one short second line and i am not pretending otherwise.\n[MOOD:happy]',
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'i added one short second line to `tmp/qwen-dual-lane-sandbox.md` and checked git status.\n[MOOD:happy]',
              }),
            },
          },
        ],
      },
    ],
  });

  const result = await api.runLmStudioManualToolLoop({
    userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.equal(result.toolOutcome.writeIntentRequired, true);
  assert.equal(result.toolOutcome.writeIntentSatisfied, true);
  assert.deepEqual(api.toolCalls.map((entry) => entry.name), ['insert_in_project_file', 'get_git_status']);
  assert.match(JSON.stringify(api.payloads[1].messages), /insert_in_project_file/);
  assert.match(JSON.stringify(api.payloads[1].messages), /write tool succeeds/i);
});

test('runLmStudioManualToolLoop records prompt-visible raw-json evidence facts for manual planner tool results that re-enter a later model call', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'tool',
                tool: 'read_project_file',
                args: {
                  path: 'README.md',
                },
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'README says Penny is a local companion prototype.\n[MOOD:thinking]',
              }),
            },
          },
        ],
      },
    ],
    executePennyTool: async (name, args = {}) => {
      if (name === 'read_project_file') {
        return {
          ok: true,
          label: `read ${args.path || 'file'}`,
          data: { path: args.path || '', excerpt: '# Penny Companion Prototype' },
        };
      }
      return { ok: true, label: name, data: {} };
    },
  });

  const result = await api.runLmStudioManualToolLoop({
    userText: 'Read README.md and tell me what Penny is.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.match(result.text, /local companion prototype/i);
  assert.deepEqual(result.toolEvidenceFacts, [
    {
      path: 'manual_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0],
    },
  ]);
});

test('runLmStudioManualToolLoop records prompt-visible auto-verification facts when verification results are inserted into a later planner call', async () => {
  const api = buildToolLoopApi({
    responses: [
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'tool',
                tool: 'insert_in_project_file',
                args: {
                  path: 'tmp/qwen-dual-lane-sandbox.md',
                  text: 'tiny menace',
                  position: 'end',
                  lineAware: true,
                },
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'i added one short second line and i am not pretending otherwise.\n[MOOD:happy]',
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'i added one short second line to `tmp/qwen-dual-lane-sandbox.md` and checked git status.\n[MOOD:happy]',
              }),
            },
          },
        ],
      },
    ],
  });

  const result = await api.runLmStudioManualToolLoop({
    userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
    messages: [],
    memories: {},
    laneRuntime: {},
  });

  assert.deepEqual(api.toolCalls.map((entry) => entry.name), ['insert_in_project_file', 'get_git_status']);
  assert.deepEqual(result.toolEvidenceFacts, [
    {
      path: 'manual_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0],
    },
    {
      path: 'manual_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'auto_verification_json',
      modelHop: 'multi',
      toolRecordIndexes: [1],
    },
  ]);
});

test('runLmStudioManualToolLoop preserves manual fallback and rescue diagnostics on failed write turns', async () => {
  const api = buildToolLoopApi({
    maxToolSteps: 2,
    responses: [
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'tool',
                tool: 'read_project_file',
                args: {
                  path: 'tmp/qwen-dual-lane-sandbox.md',
                },
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'i already handled it.\n[MOOD:smug]',
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'still not a write',
              }),
            },
          },
        ],
      },
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                kind: 'final',
                text: 'still not a write',
              }),
            },
          },
        ],
      },
    ],
    executePennyTool: async (name, args = {}) => {
      if (name === 'read_project_file') {
        return {
          ok: true,
          label: `read ${args.path || 'file'}`,
          data: { path: args.path || '', excerpt: '1:alpha' },
        };
      }
      return { ok: true, label: name, data: {} };
    },
  });

  const result = await api.runLmStudioManualToolLoop({
    userText: 'In tmp/qwen-dual-lane-sandbox.md, add a second short line in your own Penny-ish voice. Keep it cute and brief. Then tell me exactly what you changed.',
    messages: [],
    memories: {},
    laneRuntime: {},
    fallbackDebug: {
      manualFallback: {
        used: true,
        reasonCode: 'tool_loop_missing_workspace_write',
        reason: 'Tool loop required a confirmed workspace write before final reply.',
      },
    },
  });

  assert.equal(result.toolOutcome.writeIntentRequired, true);
  assert.equal(result.toolOutcome.writeIntentSatisfied, false);
  assert.equal(result.toolOutcome.debug.manualFallback.used, true);
  assert.equal(result.toolOutcome.debug.manualFallback.reasonCode, 'tool_loop_missing_workspace_write');
  assert.equal(result.toolOutcome.debug.manualFallback.lastPlannerStatus, 'final-before-write');
  assert.match(result.toolOutcome.debug.manualFallback.lastAssistantText, /already handled it/i);
  assert.equal(result.toolOutcome.debug.writeRescue.attempted, true);
  assert.equal(result.toolOutcome.debug.writeRescue.phase, 'manual');
  assert.equal(result.toolOutcome.debug.writeRescue.status, 'non-tool-decision');
  assert.equal(result.toolOutcome.debug.writeRescue.decisionKind, 'final');
  assert.match(result.toolOutcome.debug.writeRescue.assistantText, /still not a write/i);
});
