const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const helpersPromise = import(pathToFileURL(path.join(
  __dirname,
  '..',
  'public',
  'js',
  'penny-stream-state.mjs',
)).href);

test('client stream reducer ignores duplicate and stale cumulative text', async () => {
  const { createClientStreamReducer } = await helpersPromise;
  const reducer = createClientStreamReducer();

  assert.deepEqual(reducer.apply('message.delta', { content: 'hello', text: 'hello' }), {
    changed: true,
    text: 'hello',
  });
  assert.equal(reducer.apply('message.delta', { content: 'hello', text: 'hello' }).changed, false);
  assert.deepEqual(reducer.apply('message.delta', { content: ' world', text: 'hello world' }), {
    changed: true,
    text: 'hello world',
  });
  assert.equal(reducer.apply('message.delta', { text: 'hello' }).changed, false);
});

test('client stream reducer deduplicates transitions and clears partial output on retry reset', async () => {
  const { createClientStreamReducer } = await helpersPromise;
  const reducer = createClientStreamReducer();

  assert.equal(reducer.apply('status', { stage: 'thinking', label: 'thinking' }).changed, true);
  assert.equal(reducer.apply('status', { stage: 'thinking', label: 'thinking' }).changed, false);
  reducer.apply('message.delta', { content: 'partial', text: 'partial' });
  assert.deepEqual(reducer.apply('stream.reset', { reason: 'transport-retry' }), {
    changed: true,
    reset: true,
    text: '',
  });
  assert.deepEqual(reducer.apply('message.delta', { content: 'final', text: 'final' }), {
    changed: true,
    text: 'final',
  });
});
