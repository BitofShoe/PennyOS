const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeMemoryItems,
  selectMemoriesForPrompt,
  formatPromptMemories,
  injectRelevantMemoryContext,
} = require('../lib/penny-memory');

test('mergeMemoryItems deduplicates normalized text and drops junk', () => {
  const now = Date.UTC(2026, 3, 12);
  const items = mergeMemoryItems([
    { text: ' My favorite tea is lapsang souchong. ', kind: 'preference', ts: now - 1000 },
    { text: 'my favorite tea is lapsang souchong', kind: 'preference', ts: now },
    { text: 'ok', kind: 'observation' },
    { text: ''.padEnd(240, 'x'), kind: 'observation' },
  ], 30, now);

  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'My favorite tea is lapsang souchong');
  assert.equal(items[0].kind, 'preference');
});

test('selectMemoriesForPrompt prefers relevant overlap over unrelated memories', () => {
  const now = Date.UTC(2026, 3, 12);
  const memories = {
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now - 1000 },
      { text: 'Has a dog named Juniper', kind: 'personal', ts: now - 2000 },
      { text: 'Likes rainy cyberpunk vibes', kind: 'observation', ts: now - 3000 },
    ],
  };

  const selected = selectMemoriesForPrompt(memories, 'What tea do I like again?', 2, now);
  assert.equal(selected.length, 2);
  assert.match(selected[0].text, /tea/i);
});

test('formatPromptMemories returns fallback when nothing survives normalization', () => {
  const out = formatPromptMemories({ memories: [{ text: 'x' }] }, 'tea question', 3, '- Nothing yet.', Date.UTC(2026, 3, 12));
  assert.equal(out, '- Nothing yet.');
});

test('injectRelevantMemoryContext prepends selected memories', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = injectRelevantMemoryContext(
    'Current user message body',
    { memories: [{ text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now }] },
    'What tea do I like?',
    3,
    now,
  );

  assert.match(out, /Relevant memory for this reply:/);
  assert.match(out, /Favorite tea is lapsang souchong/);
  assert.match(out, /Current user message:/);
});

test('formatPromptMemories includes bounded archive context without replacing explicit facts', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      session: [
        { text: 'We were talking about midnight rain on the windows.' },
      ],
      global: [
        { text: 'They keep returning to midnight rain.' },
      ],
    },
  }, 'Tell me the midnight rain thing again', 3, '- Nothing yet.', now);

  assert.match(out, /Favorite tea is lapsang souchong/);
  assert.match(out, /Wake state - active session context:/);
  assert.match(out, /Wake state - retrieval hints \(advisory\):/);
});

test('formatPromptMemories keeps explicit memories ahead of archive continuity sections', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
      { text: 'Has a dog named Juniper', kind: 'personal', ts: now - 1000 },
    ],
    archiveContext: {
      session: [
        { text: 'We were talking about midnight rain on the windows.' },
      ],
      global: [
        { text: 'They keep returning to midnight rain.' },
      ],
    },
  }, 'What tea do I like again?', 3, '- Nothing yet.', now);

  const explicitIndex = out.indexOf('Favorite tea is lapsang souchong');
  const sessionIndex = out.indexOf('Wake state - active session context:');
  const retrievalIndex = out.indexOf('Wake state - retrieval hints (advisory):');

  assert.ok(explicitIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(retrievalIndex >= 0);
  assert.ok(explicitIndex < sessionIndex);
  assert.ok(sessionIndex < retrievalIndex);
});

test('formatPromptMemories keeps active corrections behind current explicit facts and ahead of archive continuity', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      activeContradictions: [
        {
          conflictKey: 'my favorite tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
          status: 'active',
        },
      ],
      session: [
        { text: 'We were talking about midnight rain on the windows.' },
      ],
      global: [
        { text: 'Longer-term patterns: they keep returning to midnight rain.' },
      ],
    },
  }, 'What tea do I like again?', 3, '- Nothing yet.', now);

  const explicitIndex = out.indexOf('Favorite tea is lapsang souchong');
  const correctionsIndex = out.indexOf('Wake state - contradictions/open questions:');
  const retrievalIndex = out.indexOf('Wake state - retrieval hints (advisory):');

  assert.ok(explicitIndex >= 0);
  assert.ok(correctionsIndex >= 0);
  assert.ok(retrievalIndex >= 0);
  assert.ok(explicitIndex < correctionsIndex);
  assert.ok(correctionsIndex < retrievalIndex);
});

test('formatPromptMemories keeps matched memory books behind explicit facts and ahead of advisory archive hints', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    memoryBookContext: {
      matches: [
        {
          id: 'appearance',
          text: 'Penny has coral hair when the user explicitly asks.',
          priority: 90,
          score: 105,
        },
      ],
    },
    archiveContext: {
      session: [
        { text: 'We were talking about midnight rain on the windows.' },
      ],
    },
  }, 'What do you look like again?', 3, '- Nothing yet.', now);

  const booksIndex = out.indexOf('memory book: Penny has coral hair when the user explicitly asks');
  const explicitIndex = out.indexOf('Favorite tea is lapsang souchong');
  const sessionIndex = out.indexOf('Wake state - active session context:');

  assert.ok(booksIndex >= 0);
  assert.ok(explicitIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(explicitIndex < booksIndex);
  assert.ok(booksIndex < sessionIndex);
});

test('formatPromptMemories falls back to provenance when no active contradiction block is present', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      provenance: [
        {
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
        },
      ],
    },
  }, 'What tea do I like again?', 3, '- Nothing yet.', now);

  assert.match(out, /Wake state - contradictions\/open questions:/);
  assert.match(out, /replaces: Favorite tea is oolong/i);
});

test('formatPromptMemories includes non-canonical archive synthesis ahead of archive continuity', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveSynthesis: {
      enabled: true,
      generated: true,
      kind: 'archive-advisory-summary',
      scope: 'archive-advisory',
      summary: 'Correction in play: favorite tea is lapsang souchong, not oolong.',
      evidenceSources: ['correction', 'archive-session'],
    },
    archiveContext: {
      session: [
        { text: 'We were talking about midnight rain on the windows.' },
      ],
    },
  }, 'What tea do I like again?', 3, '- Nothing yet.', now);

  const synthesisIndex = out.indexOf('archive advisory: Correction in play: favorite tea is lapsang souchong, not oolong');
  const sessionIndex = out.indexOf('Wake state - active session context:');
  assert.ok(synthesisIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(sessionIndex < synthesisIndex);
  assert.match(out, /favorite tea is lapsang souchong, not oolong/i);
});

test('formatPromptMemories surfaces retrieval caution when archive recall is weaker than canon', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      semanticReady: false,
      reasonCode: 'keyword_fallback',
      compression: { used: true },
      global: [
        { text: 'They keep returning to midnight rain.', sourceLabel: 'archive-global' },
      ],
    },
  }, 'What tea do I like again?', 3, '- Nothing yet.', now);

  assert.match(out, /retrieval caution:/i);
  assert.match(out, /archive-global: They keep returning to midnight rain/i);
});

test('formatPromptMemories keeps direct memory-authority questions canon-first under advisory pressure', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      semanticReady: true,
      semanticDowngrade: true,
      semanticDowngradeReason: 'query-vector-unavailable',
      reasonCode: 'keyword_fallback',
      compression: { used: true },
      global: [
        { text: 'They keep returning to midnight rain.', sourceLabel: 'archive-global' },
      ],
    },
    researchLedgerContext: {
      topics: [
        {
          topicId: 'path-package-json',
          topicLabel: 'package.json',
          status: 'open',
          summary: 'open follow-up - verify whether the Vitest migration is still pending.',
        },
      ],
    },
  }, 'What should you remember about my tea?', 3, '- Nothing yet.', now);

  assert.match(out, /canon priority:/i);
  assert.match(out, /Favorite tea is lapsang souchong/);
  assert.doesNotMatch(out, /Wake state - ongoing investigations \(advisory\):/i);
  assert.doesNotMatch(out, /Wake state - retrieval hints \(advisory\):/i);
});

test('formatPromptMemories inserts ongoing investigations after contradictions and before retrieval hints', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      activeContradictions: [
        {
          conflictKey: 'favorite tea',
          oldText: 'Favorite tea is oolong',
          newText: 'Favorite tea is lapsang souchong',
        },
      ],
      global: [
        { text: 'They keep returning to midnight rain.', sourceLabel: 'archive-global' },
      ],
    },
    researchLedgerContext: {
      topics: [
        {
          topicId: 'path-package-json',
          topicLabel: 'package.json',
          status: 'open',
          summary: 'open follow-up - verify whether the Vitest migration is still pending.',
        },
      ],
    },
  }, 'What should we verify next?', 3, '- Nothing yet.', now);

  const contradictionsIndex = out.indexOf('Wake state - contradictions/open questions:');
  const investigationsIndex = out.indexOf('Wake state - ongoing investigations (advisory):');
  const retrievalIndex = out.indexOf('Wake state - retrieval hints (advisory):');

  assert.ok(contradictionsIndex >= 0);
  assert.ok(investigationsIndex >= 0);
  assert.ok(retrievalIndex >= 0);
  assert.ok(contradictionsIndex < investigationsIndex);
  assert.ok(investigationsIndex < retrievalIndex);
  assert.match(out, /package\.json \(open\): open follow-up/i);
});

test('formatPromptMemories can keep research-ledger context out of the prompt while preserving other advisory sections', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    researchLedgerPromptEnabled: false,
    archiveContext: {
      global: [
        { text: 'They keep returning to midnight rain.', sourceLabel: 'archive-global' },
      ],
    },
    researchLedgerContext: {
      topics: [
        {
          topicId: 'path-package-json',
          topicLabel: 'package.json',
          status: 'open',
          summary: 'open follow-up - verify whether the Vitest migration is still pending.',
        },
      ],
    },
  }, 'What should we verify next?', 3, '- Nothing yet.', now);

  assert.doesNotMatch(out, /Wake state - ongoing investigations \(advisory\):/i);
  assert.match(out, /Wake state - retrieval hints \(advisory\):/i);
});
