const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractExplicitProjectPath,
  resolveDirectToolIntent,
} = require('../server.js');

test('extractExplicitProjectPath handles backticked paths with spaces and apostrophes', () => {
  const path = extractExplicitProjectPath("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.equal(path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
});

test('resolveDirectToolIntent leaves open-ended creative file edits for the full tool loop', () => {
  const intent = resolveDirectToolIntent("You can do whatever you want in the Penny's Playground folder. Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and add one short note in your own voice. Pick the wording yourself.");
  assert.equal(intent, null);
});

test('resolveDirectToolIntent still keeps explicit read requests on the direct path', () => {
  const intent = resolveDirectToolIntent("Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and tell me what it says.");
  assert.ok(intent);
  assert.match(intent.name, /^read_project_file/);
  assert.equal(intent.args.path, "Penny's Playground/Penny's Very Own Paper (bot languege version).md");
});
