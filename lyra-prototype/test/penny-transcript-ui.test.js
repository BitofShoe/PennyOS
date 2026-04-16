const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-transcript-ui.mjs');

test('buildTranscriptMessageViewModels preserves ordering and loading rows', async () => {
  const { buildTranscriptMessageViewModels } = await helpersPromise;
  const rows = buildTranscriptMessageViewModels([
    { role: 'user', content: 'first' },
    { role: 'assistant', content: 'working [MOOD:thinking]', streaming: true, mood: 'thinking' },
  ], {
    loading: true,
    stateMood: 'calm',
    formatBytesFn: () => '5 KB',
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].role, 'user');
  assert.equal(rows[1].role, 'assistant');
  assert.equal(rows[1].content, 'working');
  assert.equal(rows[1].streaming, true);
});

test('buildTranscriptMessageViewModels appends a synthetic loading row when no draft exists', async () => {
  const { buildTranscriptMessageViewModels } = await helpersPromise;
  const rows = buildTranscriptMessageViewModels([{ role: 'user', content: 'hi' }], { loading: true });

  assert.equal(rows.length, 2);
  assert.equal(rows[1].loading, true);
  assert.equal(rows[1].mood, 'thinking');
});

test('readPennyEventStream parses SSE frames and JSON payloads', async () => {
  const { readPennyEventStream } = await helpersPromise;
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode('event: status\ndata: {"stage":"accepted"}\n\n'),
    encoder.encode('event: message.delta\ndata: {"text":"hello"}\n\n'),
  ];
  const events = [];
  let index = 0;
  const response = {
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) return { done: true, value: undefined };
            const value = chunks[index];
            index += 1;
            return { done: false, value };
          },
        };
      },
    },
  };

  await readPennyEventStream(response, {
    onEvent(event, data) {
      events.push({ event, data });
    },
  });

  assert.deepEqual(events, [
    { event: 'status', data: { stage: 'accepted' } },
    { event: 'message.delta', data: { text: 'hello' } },
  ]);
});
