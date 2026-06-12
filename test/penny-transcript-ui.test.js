const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-transcript-ui.mjs');

test('renderTranscriptContentHtml renders fenced code without allowing raw HTML', async () => {
  const { renderTranscriptContentHtml } = await helpersPromise;
  const html = renderTranscriptContentHtml([
    'Before',
    '```js',
    'const image = "<img src=x onerror=alert(1)>";',
    '```',
    'After <b>x</b>',
  ].join('\n'));

  assert.match(html, /Before<br>/);
  assert.match(html, /<pre class="bubble-code"><code class="language-js" data-language="js">/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /After &lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<img\b/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});

test('renderTranscriptContentHtml treats unclosed fences as escaped plain text', async () => {
  const { renderTranscriptContentHtml } = await helpersPromise;
  const html = renderTranscriptContentHtml('```html\n<script>alert(1)</script>');

  assert.doesNotMatch(html, /<pre\b/);
  assert.doesNotMatch(html, /<script\b/);
  assert.match(html, /```html<br>&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('renderTranscriptContentHtml keeps streaming unclosed fences as escaped code blocks', async () => {
  const { renderTranscriptContentHtml } = await helpersPromise;
  const html = renderTranscriptContentHtml('```js\nconst x = "<script>alert(1)</script>";', { streaming: true });

  assert.match(html, /<pre class="bubble-code"><code class="language-js" data-language="js">/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /```js/);
  assert.doesNotMatch(html, /<script\b/);
});

test('renderTranscriptContentHtml treats hostile fence info as escaped text', async () => {
  const { renderTranscriptContentHtml } = await helpersPromise;
  const html = renderTranscriptContentHtml('```js" onmouseover="alert(3)\nalert(1)\n```');

  assert.doesNotMatch(html, /<pre\b/);
  assert.doesNotMatch(html, /<[^>]+onmouseover=/);
  assert.match(html, /```js&quot; onmouseover=&quot;alert\(3\)/);
});

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

test('buildTranscriptMessageViewModels gives stable decor seeds from message identity instead of volatile text', async () => {
  const { buildTranscriptMessageViewModels } = await helpersPromise;
  const first = buildTranscriptMessageViewModels([
    { id: 'user-message-1', role: 'user', content: 'h' },
    { id: 'assistant-message-1', role: 'assistant', content: 'reply', mood: 'happy' },
  ]);
  const typed = buildTranscriptMessageViewModels([
    { id: 'user-message-1', role: 'user', content: 'hello there' },
    { id: 'assistant-message-1', role: 'assistant', content: 'reply with more detail', mood: 'happy' },
  ]);

  assert.equal(typeof first[0].decorSeed, 'number');
  assert.equal(typeof first[1].decorSeed, 'number');
  assert.equal(first[0].decorKey, 'user-message-1');
  assert.equal(first[1].decorKey, 'assistant-message-1');
  assert.equal(typed[0].decorSeed, first[0].decorSeed);
  assert.equal(typed[1].decorSeed, first[1].decorSeed);
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
