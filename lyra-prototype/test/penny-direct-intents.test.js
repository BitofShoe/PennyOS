const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractExplicitProjectPath,
  shouldForceLocalToolLoop,
  resolveDirectToolIntent,
  composeToolRecordFallback,
  looksLikeWeakToolReply,
} = require('../server.js');

test('extractExplicitProjectPath handles backticked paths with spaces and apostrophes', () => {
  const path = extractExplicitProjectPath("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.equal(path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
});

test('resolveDirectToolIntent leaves open-ended creative file edits for the full tool loop', () => {
  const intent = resolveDirectToolIntent("You can do whatever you want in the Penny's Playground folder. Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and add one short note in your own voice. Pick the wording yourself.");
  assert.equal(intent, null);
});

test('shouldForceLocalToolLoop catches explicit-path creative edits', () => {
  const force = shouldForceLocalToolLoop("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and add a short paragraph in your own voice. Pick the wording yourself.");
  assert.equal(force, true);
});

test('shouldForceLocalToolLoop stays off for explicit-path read requests', () => {
  const force = shouldForceLocalToolLoop("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.equal(force, false);
});

test('resolveDirectToolIntent still keeps explicit read requests on the direct path', () => {
  const intent = resolveDirectToolIntent("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.ok(intent);
  assert.match(intent.name, /^read_project_file/);
  assert.equal(intent.args.path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
});

test('resolveDirectToolIntent upgrades richer web requests into inspect_web_result', () => {
  const intent = resolveDirectToolIntent('Search the web for the official OpenClaw browser tool docs and tell me the page title, the URL, and one short sentence about what it is.');
  assert.ok(intent);
  assert.equal(intent.name, 'inspect_web_result');
  assert.equal(intent.args.query, 'the official OpenClaw browser tool docs and tell me the page title, the URL, and one short sentence about what it is');
});

test('resolveDirectToolIntent keeps plain web lookups as search_web', () => {
  const intent = resolveDirectToolIntent('search the web for bitcoin news');
  assert.ok(intent);
  assert.equal(intent.name, 'search_web');
  assert.equal(intent.args.query, 'bitcoin news');
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

test('looksLikeWeakToolReply catches truncated \"exactly what I added\" claims', () => {
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
