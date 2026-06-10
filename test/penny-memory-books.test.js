const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createMemoryBooksApi } = require('../lib/penny-memory-books');
const { buildPromptMemoryContext } = require('../lib/penny-memory');

function makeTempFiles(prefix = 'penny-memory-books-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    root,
    booksFile: path.join(root, 'penny-memory-books.json'),
    seedFile: path.join(root, 'penny-memory-books.seed.json'),
  };
}

test('memory books match bounded prompt inserts without mutating the store', () => {
  const files = makeTempFiles();
  fs.writeFileSync(files.seedFile, `${JSON.stringify({
    meta: { schemaVersion: 1, updatedAt: '' },
    books: [
      {
        id: 'appearance',
        scope: 'chat',
        placement: 'memory',
        triggers: { phrases: ['what do you look like', 'your hair'], lanes: ['chat'] },
        text: 'Penny has coral hair and does not volunteer appearance details unless asked.',
        priority: 90,
        enabled: true,
        sensitivity: 'normal',
        source: 'seed',
      },
      {
        id: 'coding',
        scope: 'tool',
        placement: 'memory',
        triggers: { phrases: ['refactor', 'test'], lanes: ['tool'] },
        text: 'Technical collaboration should feel like shared workshop work, not sterile ticket processing.',
        priority: 60,
        enabled: true,
        sensitivity: 'normal',
        source: 'seed',
      },
      {
        id: 'overflow',
        scope: 'chat',
        placement: 'memory',
        triggers: { phrases: ['what do you look like'], lanes: ['chat'] },
        text: 'This lower-priority item should be bounded out once the limit is hit.',
        priority: 10,
        enabled: true,
        sensitivity: 'normal',
        source: 'seed',
      },
    ],
  }, null, 2)}\n`);

  const api = createMemoryBooksApi({
    fs,
    path,
    BOOKS_FILE: files.booksFile,
    BOOKS_SEED_FILE: files.seedFile,
  });

  try {
    const before = api.readMemoryBooksStore();
    const result = api.matchMemoryBooks({
      sessionId: 'demo',
      userText: 'okay, what do you look like again? tell me about your hair.',
      lane: 'chat',
      attachmentType: 'none',
    });
    const after = api.readMemoryBooksStore();

    assert.equal(result.matches.length, 2);
    assert.equal(result.matches[0].id, 'appearance');
    assert.ok(result.matches[0].matchedPhrases.includes('what do you look like'));
    assert.equal(before.books.length, after.books.length);
    assert.equal(after.books.some((book) => book.id === 'coding'), true);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('memory books render bounded prompt inserts without mutating canonical explicit memory', () => {
  const files = makeTempFiles('penny-memory-books-prompt-');
  fs.writeFileSync(files.seedFile, `${JSON.stringify({
    meta: { schemaVersion: 1, updatedAt: '' },
    books: [
      {
        id: 'appearance',
        scope: 'chat',
        placement: 'memory',
        triggers: { phrases: ['what do you look like'], lanes: ['chat'] },
        text: 'Penny has coral hair when the user explicitly asks.',
        priority: 90,
        enabled: true,
      },
      {
        id: 'companion-style',
        scope: 'chat',
        placement: 'memory',
        triggers: { phrases: ['what do you look like'], lanes: ['chat'] },
        text: 'Appearance answers should stay brief and companion-first.',
        priority: 80,
        enabled: true,
      },
      {
        id: 'overflow',
        scope: 'chat',
        placement: 'memory',
        triggers: { phrases: ['what do you look like'], lanes: ['chat'] },
        text: 'This lower-priority memory book should not render.',
        priority: 10,
        enabled: true,
      },
    ],
  }, null, 2)}\n`);

  const api = createMemoryBooksApi({
    fs,
    path,
    BOOKS_FILE: files.booksFile,
    BOOKS_SEED_FILE: files.seedFile,
  });

  try {
    const explicitMemory = {
      memories: [
        { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: Date.UTC(2026, 3, 12) },
      ],
    };
    const before = JSON.stringify(explicitMemory.memories);
    const matches = api.matchMemoryBooks({
      sessionId: 'demo',
      userText: 'what do you look like?',
      lane: 'chat',
      attachmentType: 'none',
    });
    const prompt = buildPromptMemoryContext({
      ...explicitMemory,
      memoryBookContext: matches,
    }, 'what do you look like?', 6, '- Nothing yet.', Date.UTC(2026, 3, 12));

    assert.equal(matches.matches.length, 2);
    assert.match(prompt.text, /memory book: Penny has coral hair/);
    assert.match(prompt.text, /memory book: Appearance answers should stay brief/);
    assert.doesNotMatch(prompt.text, /lower-priority memory book/);
    assert.equal(prompt.promptTruth.channels.memoryBooks.candidateCount, 2);
    assert.equal(prompt.promptTruth.channels.memoryBooks.renderedCount, 2);
    assert.deepEqual(prompt.promptTruth.channels.memoryBooks.renderedSourceIds, ['appearance', 'companion-style']);
    assert.equal(JSON.stringify(explicitMemory.memories), before);
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});

test('memory books inspector surfaces enabled entries from the store', () => {
  const files = makeTempFiles();
  const api = createMemoryBooksApi({
    fs,
    path,
    BOOKS_FILE: files.booksFile,
    BOOKS_SEED_FILE: files.seedFile,
  });

  try {
    api.writeMemoryBooksStore({
      books: [
        {
          id: 'appearance',
          scope: 'chat',
          placement: 'memory',
          triggers: { phrases: ['what do you look like'] },
          text: 'Appearance note',
          priority: 80,
          enabled: true,
          sensitivity: 'normal',
          source: 'seed',
        },
        {
          id: 'disabled',
          scope: 'chat',
          placement: 'memory',
          triggers: { phrases: ['ignore me'] },
          text: 'Disabled note',
          priority: 20,
          enabled: false,
          sensitivity: 'normal',
          source: 'seed',
        },
      ],
    });

    const inspector = api.getMemoryBooksInspector();
    assert.equal(inspector.count, 2);
    assert.equal(inspector.enabledCount, 1);
    assert.equal(inspector.entries[0].id, 'appearance');
  } finally {
    fs.rmSync(files.root, { recursive: true, force: true });
  }
});
