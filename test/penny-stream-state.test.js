const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createBoundedTextAccumulator,
  createStreamEventForwarder,
} = require('../lib/penny-stream-state');

test('bounded text accumulation caps 1,000 hidden-reasoning chunks', () => {
  const accumulator = createBoundedTextAccumulator({ maxChars: 128 });
  for (let index = 0; index < 1000; index += 1) {
    accumulator.append(`reasoning-${index};`);
  }

  const snapshot = accumulator.snapshot();
  assert.ok(snapshot.text.length <= 128);
  assert.ok(snapshot.totalChars > snapshot.text.length);
  assert.equal(snapshot.truncated, true);
});

test('server stream forwarder deduplicates repeated statuses and cumulative message snapshots', () => {
  const events = [];
  const forward = createStreamEventForwarder(event => events.push(event));

  for (let index = 0; index < 1000; index += 1) {
    forward({ type: 'status', stage: 'thinking', label: 'thinking' });
  }
  forward({ type: 'message.delta', content: 'hello', text: 'hello' });
  forward({ type: 'message.delta', content: 'hello', text: 'hello' });
  forward({ type: 'message.delta', content: ' world', text: 'hello world' });
  forward({ type: 'message.delta', content: ' world', text: 'hello world' });

  assert.deepEqual(events, [
    { type: 'status', stage: 'thinking', label: 'thinking' },
    { type: 'message.delta', content: 'hello', text: 'hello' },
    { type: 'message.delta', content: ' world', text: 'hello world' },
  ]);
});

test('server stream reset creates a clean retry epoch', () => {
  const events = [];
  const forward = createStreamEventForwarder(event => events.push(event));

  forward({ type: 'message.delta', content: 'partial', text: 'partial' });
  forward({ type: 'stream.reset', reason: 'transport-retry' });
  forward({ type: 'message.delta', content: 'final', text: 'final' });

  assert.deepEqual(events, [
    { type: 'message.delta', content: 'partial', text: 'partial' },
    { type: 'stream.reset', reason: 'transport-retry' },
    { type: 'message.delta', content: 'final', text: 'final' },
  ]);
});
