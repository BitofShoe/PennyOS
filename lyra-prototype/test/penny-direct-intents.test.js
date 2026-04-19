const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createDirectIntentApi,
  DIRECT_INTENT_REASON_CODES,
} = require('../lib/penny-direct-intents');

function buildApi() {
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

const {
  extractExplicitProjectPath,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent,
  composeDirectReadReply,
  composeToolRecordFallback,
  looksLikeWeakToolReply,
} = buildApi();

test('extractExplicitProjectPath handles backticked paths with spaces and apostrophes', () => {
  const path = extractExplicitProjectPath("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.equal(path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
});

test('extractExplicitProjectPath keeps plain unquoted repo paths conservative', () => {
  const path = extractExplicitProjectPath('Open public/app.js and tell me what it says.');
  assert.equal(path, 'public/app.js');
});

test('extractExplicitProjectPath handles unquoted paths with spaces and apostrophes', () => {
  const path = extractExplicitProjectPath("Open Penny's Playground/penny-qa-freewrite.md and add one note in your own voice.");
  assert.equal(path, "Penny's Playground/penny-qa-freewrite.md");
});

test('resolveDirectToolIntent fixes the quoted-search plus unquoted-path regression', () => {
  const intent = resolveDirectToolIntent('Search for "Shadow failed" in public/app.js. Do not edit anything. Just tell me the current note string and whether you changed or verified anything.');
  assert.ok(intent);
  assert.equal(intent.name, 'read_project_file_around_match');
  assert.equal(intent.args.path, 'public/app.js');
  assert.equal(intent.args.query, 'Shadow failed');
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
});

test('resolveDirectToolIntent upgrades explicit-path creative edits into bounded direct intents', () => {
  const intent = resolveDirectToolIntent("You can do whatever you want in the Penny's Playground folder. Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and add one short note in your own voice. Pick the wording yourself.");
  assert.ok(intent);
  assert.equal(intent.kind, 'open_ended_sequence');
  assert.equal(intent.mode, 'direct_open_ended_append');
  assert.equal(intent.path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.DIRECT_OPEN_ENDED_EDIT);
});

test('shouldForceLocalToolLoop catches explicit-path creative edits', () => {
  const force = shouldForceLocalToolLoop("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and add a short paragraph in your own voice. Pick the wording yourself.");
  assert.equal(force, true);
});

test('resolveDirectToolIntent still leaves folder-only self-named creative edits on the full tool loop', () => {
  const intent = resolveDirectToolIntent("Inside Penny's Playground, create one new markdown file, choose the filename yourself, and write one short paragraph in your own Penny voice.");
  assert.equal(intent, null);
});

test('shouldForceLocalToolLoop stays off for explicit-path read requests', () => {
  const force = shouldForceLocalToolLoop("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.equal(force, false);
});

test('resolveDirectToolIntent still keeps explicit read requests on the direct path', () => {
  const intent = resolveDirectToolIntent("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.ok(intent);
  assert.equal(intent.name, 'read_project_file');
  assert.equal(intent.args.path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_READ);
});

test('resolveDirectToolIntent keeps apostrophe-heavy long-file summary requests on full-file reads', () => {
  const intent = resolveDirectToolIntent("Read Penny's Playground/PENNY'S_BRAIN.md and tell me the three most important ideas in plain English.");
  assert.ok(intent);
  assert.equal(intent.name, 'read_project_file');
  assert.equal(intent.args.path, "Penny's Playground/PENNY'S_BRAIN.md");
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_READ);
});

test('resolveDirectToolIntent upgrades focused file questions into targeted reads', () => {
  const intent = resolveDirectToolIntent('Open public/js/penny-app.js and tell me what it says about attachments.');
  assert.ok(intent);
  assert.equal(intent.name, 'read_project_file_around_match');
  assert.equal(intent.args.path, 'public/js/penny-app.js');
  assert.equal(intent.args.query, 'attachments');
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
});

test('resolveDirectToolIntent upgrades natural line-definition questions into targeted reads', () => {
  const intent = resolveDirectToolIntent('Without editing anything, tell me what line currently defines MEMORY_PROMPT_LIMIT in server.js.');
  assert.ok(intent);
  assert.equal(intent.name, 'read_project_file_around_match');
  assert.equal(intent.args.path, 'server.js');
  assert.equal(intent.args.query, 'MEMORY_PROMPT_LIMIT');
  assert.equal(intent.args.questionType, 'definition');
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
});

test('resolveDirectToolIntent routes command phrasing and natural package.json questions to the same deterministic read', () => {
  const command = resolveDirectToolIntent('Open package.json and tell me what npm test runs.');
  const natural = resolveDirectToolIntent('What is the current npm test command in package.json?');
  const scriptQuestion = resolveDirectToolIntent('Which npm script runs tests?');

  for (const intent of [command, natural, scriptQuestion]) {
    assert.ok(intent);
    assert.equal(intent.name, 'read_project_file_around_match');
    assert.equal(intent.args.path, 'package.json');
    assert.equal(intent.args.query, 'test');
    assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
  }
});

test('resolveDirectToolIntent routes natural port questions to deterministic inspection', () => {
  const intent = resolveDirectToolIntent('What port does this use?');
  assert.ok(intent);
  assert.equal(intent.name, 'read_project_file_around_match');
  assert.equal(intent.args.path, 'server.js');
  assert.equal(intent.args.query, 'port');
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.PROJECT_FILE_FOCUS_READ);
});

test('resolveDirectToolIntent keeps ambiguous freeform technical chatter on the chat lane', () => {
  const intent = resolveDirectToolIntent('what do you think about package.json?');
  assert.equal(intent, null);
});

test('composeDirectReadReply stays honest when a file only mentions a symbol instead of defining it', () => {
  const text = composeDirectReadReply({
    path: 'server.js',
    query: 'MEMORY_PROMPT_LIMIT',
    questionType: 'definition',
    matchLine: 11,
    excerpt: '11:  MEMORY_PROMPT_LIMIT,\n12:  mergeMemoryItems,',
  });
  assert.match(text, /does not appear to define MEMORY_PROMPT_LIMIT there/i);
  assert.match(text, /supporting line 11/i);
});

test('resolveDirectToolIntent upgrades richer web requests into inspect_web_result', () => {
  const intent = resolveDirectToolIntent('Search the web for the official OpenClaw browser tool docs and tell me the page title, the URL, and one short sentence about what it is.');
  assert.ok(intent);
  assert.equal(intent.name, 'inspect_web_result');
  assert.equal(intent.args.query, 'the official OpenClaw browser tool docs and tell me the page title, the URL, and one short sentence about what it is');
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.WEB_INSPECT);
});

test('resolveDirectToolIntent keeps plain web lookups as search_web', () => {
  const intent = resolveDirectToolIntent('search the web for bitcoin news');
  assert.ok(intent);
  assert.equal(intent.name, 'search_web');
  assert.equal(intent.args.query, 'bitcoin news');
  assert.equal(intent.reasonCode, DIRECT_INTENT_REASON_CODES.WEB_SEARCH);
});

test('composeToolRecordFallback summarizes inserted text concretely', () => {
  const text = composeToolRecordFallback([
    {
      name: 'insert_in_project_file',
      args: { path: "Penny's Playground/test.md", text: 'P.S. behave yourself.' },
      result: { ok: true, data: { path: "Penny's Playground/test.md", inserted: 1, textPreview: 'P.S. behave yourself.' } },
    },
  ]);
  assert.match(text, /P\.S\. behave yourself\./);
  assert.match(text, /Penny's Playground\/test\.md/);
});

test('composeToolRecordFallback includes search snippets when page reads fail', () => {
  const text = composeToolRecordFallback([
    {
      name: 'search_web',
      args: { query: 'openclaw docs' },
      result: {
        ok: true,
        data: {
          query: 'openclaw docs',
          results: [
            {
              title: 'Browser Tool',
              url: 'https://docs.openclaw.ai/tools/browser',
              snippet: 'Browser automation for websites and page interactions.',
            },
          ],
        },
      },
    },
    {
      name: 'read_web_page',
      args: { url: 'https://docs.openclaw.ai/tools/browser' },
      result: { ok: false, data: { error: 'too large' } },
    },
  ]);
  assert.match(text, /Browser Tool/);
  assert.match(text, /Browser automation for websites and page interactions\./);
});

test('looksLikeWeakToolReply catches clipped edit summaries', () => {
  const weak = looksLikeWeakToolReply(
    "I dropped a little truth bomb into `Penny's Very Own Paper (bot\n[MOOD:calm]",
    [{ name: 'insert_in_project_file', args: {}, result: { ok: true, data: { path: "Penny's Playground/test.md" } } }],
  );
  assert.equal(weak, true);
});

test('looksLikeWeakToolReply catches truncated exactly-what-I-added claims', () => {
  const weak = looksLikeWeakToolReply(
    'I went ahead and dropped a little something into `Penny\'s Playground/test.md`. Here is exactly what I added: "Honestly, this whole thing is a bit of a mess, but\n[MOOD:calm]',
    [{
      name: 'insert_in_project_file',
      args: { text: "Honestly, this whole thing is a bit of a mess, but I'll play along anyway." },
      result: {
        ok: true,
        data: {
          path: "Penny's Playground/test.md",
          textPreview: "Honestly, this whole thing is a bit of a mess, but I'll play along anyway.",
        },
      },
    }],
  );
  assert.equal(weak, true);
});

test('composeDirectReadReply answers focused read questions without pretending it edited anything', () => {
  const text = composeDirectReadReply({
    path: 'public/js/penny-app.js',
    query: 'attachments',
    matchLine: 42,
    excerpt: '42:const attachmentUi = createAttachmentUi({ els, setComposerNotice });\n43:attachmentUi.clearAttachment();',
  });
  assert.match(text, /short version: it does mention attachments around line 42/i);
  assert.match(text, /supporting line 42/i);
  assert.match(text, /did not edit anything/i);
});
