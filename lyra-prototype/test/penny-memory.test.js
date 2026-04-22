const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeMemoryItems,
  selectMemoriesForPrompt,
  formatPromptMemories,
  buildPromptTruth,
  injectRelevantMemoryContext,
  isCanonicalMemoryQuestion,
  isWordingRecallQuestion,
} = require('../lib/penny-memory');
const {
  buildSemanticClaimId,
  buildSemanticEntityId,
  buildSemanticSourceId,
} = require('../lib/penny-semantic-ids');
const {
  SEMANTIC_DOMAIN_IDS,
} = require('../lib/penny-semantic-domains');
const {
  SEMANTIC_PREDICATE_IDS,
} = require('../lib/penny-semantic-predicates');

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

test('formatPromptMemories keeps explicit memories ahead of archive continuity sections on non-authority questions', () => {
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
  }, 'Tell me the midnight rain thing again.', 3, '- Nothing yet.', now);

  const explicitIndex = out.indexOf('Favorite tea is lapsang souchong');
  const sessionIndex = out.indexOf('Wake state - active session context:');
  const retrievalIndex = out.indexOf('Wake state - retrieval hints (advisory):');

  assert.ok(explicitIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(retrievalIndex >= 0);
  assert.ok(explicitIndex < sessionIndex);
  assert.ok(sessionIndex < retrievalIndex);
});

test('formatPromptMemories keeps active corrections behind current explicit facts and ahead of archive continuity on non-authority questions', () => {
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
  }, 'Tell me about the midnight rain thread and my tea notes.', 3, '- Nothing yet.', now);

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

test('formatPromptMemories includes non-canonical archive synthesis ahead of archive continuity on non-authority questions', () => {
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
  }, 'Tell me the midnight rain thing again.', 3, '- Nothing yet.', now);

  const synthesisIndex = out.indexOf('archive advisory: Correction in play: favorite tea is lapsang souchong, not oolong');
  const sessionIndex = out.indexOf('Wake state - active session context:');
  assert.ok(synthesisIndex >= 0);
  assert.ok(sessionIndex >= 0);
  assert.ok(sessionIndex < synthesisIndex);
  assert.match(out, /favorite tea is lapsang souchong, not oolong/i);
});

test('isWordingRecallQuestion distinguishes phrase-memory checks from project questions', () => {
  assert.equal(
    isWordingRecallQuestion('Memory check, not truth certification: what exact phrase did I use for what the other girl was doing? Answer the phrase first.'),
    true,
  );
  assert.equal(
    isWordingRecallQuestion('What did I call that thing again?'),
    true,
  );
  assert.equal(
    isWordingRecallQuestion('What exact phrase did I use in package.json?'),
    false,
  );
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
  }, 'Tell me the midnight rain thing again.', 3, '- Nothing yet.', now);

  assert.match(out, /retrieval caution:/i);
  assert.match(out, /archive-global: They keep returning to midnight rain/i);
});

test('buildPromptTruth records canon-first holdback receipts for direct authority questions', () => {
  const now = Date.UTC(2026, 3, 12);
  const promptTruth = buildPromptTruth({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      session: [
        { id: 'session-1', text: 'Favorite tea used to be oolong.', sourceLabel: 'archive-session' },
      ],
      global: [
        { id: 'global-1', text: 'They keep returning to midnight rain.', sourceLabel: 'archive-global' },
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
  }, 'What tea do I like again?', 3, '- Nothing yet.', now);

  assert.equal(promptTruth.canonicalFactsPresent, true);
  assert.equal(promptTruth.canonicalOverrideActive, true);
  assert.equal(promptTruth.channels.stableFacts.state, 'rendered');
  assert.equal(promptTruth.channels.sessionArchive.candidateCount, 1);
  assert.equal(promptTruth.channels.sessionArchive.state, 'held_back');
  assert.equal(promptTruth.channels.sessionArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.sessionArchive.heldBackReason, 'canon-priority-suppression');
  assert.equal(promptTruth.channels.globalArchive.candidateCount, 1);
  assert.equal(promptTruth.channels.globalArchive.state, 'held_back');
  assert.equal(promptTruth.channels.globalArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.researchLedger.candidateCount, 1);
  assert.equal(promptTruth.channels.researchLedger.state, 'held_back');
  assert.equal(promptTruth.channels.researchLedger.renderedCount, 0);
  assert.equal(promptTruth.channels.researchLedger.heldBackReason, 'canon-priority-suppression');
});

test('buildPromptTruth records rendered advisory states when channels actually render', () => {
  const now = Date.UTC(2026, 3, 12);
  const promptTruth = buildPromptTruth({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    memoryBookContext: {
      matches: [
        { id: 'book-1', text: 'Keep laundromat continuity', priority: 50, score: 50 },
      ],
    },
    archiveContext: {
      reasonCode: 'semantic_query',
      session: [
        { id: 'session-1', text: 'Favorite tea used to be oolong.', sourceLabel: 'archive-session' },
      ],
      global: [
        { id: 'global-1', text: 'They keep returning to midnight rain.', sourceLabel: 'archive-global' },
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
  }, 'What should we verify next?', 3, '- Nothing yet.', now, { archiveEligible: true });

  assert.equal(promptTruth.channels.stableFacts.state, 'rendered');
  assert.equal(promptTruth.channels.memoryBooks.state, 'rendered');
  assert.equal(promptTruth.channels.sessionArchive.state, 'rendered');
  assert.equal(promptTruth.channels.globalArchive.state, 'rendered');
  assert.equal(promptTruth.channels.researchLedger.state, 'rendered');
});

test('buildPromptTruth preserves rendered archive claim authority labels without raw claim graph', () => {
  const now = Date.UTC(2026, 3, 12);
  const claimLike = {
    domainId: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    subject: {
      id: buildSemanticEntityId({ entityType: 'project', entityKey: 'lyra-prototype' }),
      type: 'project',
      label: 'lyra-prototype',
    },
    predicate: { id: SEMANTIC_PREDICATE_IDS.CURRENT_CODING_MASCOT },
    object: { type: 'text', text: 'copper rabbit' },
    source: {
      sourceId: buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'session-copper-rabbit' }),
      sourceType: 'archive-episode',
      excerpt: 'The current coding mascot is copper rabbit.',
      observedAt: '2026-04-22T13:00:00.000Z',
    },
    temporal: { temporalScope: 'current' },
    status: { stale: false },
  };
  const claimId = buildSemanticClaimId(claimLike);
  const promptTruth = buildPromptTruth({
    archiveContext: {
      reasonCode: 'semantic_query',
      session: [
        {
          id: 'session-copper-rabbit',
          text: 'The current coding mascot is copper rabbit.',
          claim: {
            ...claimLike,
            claimId,
          },
        },
      ],
      global: [
        {
          id: 'static-copper-rabbit',
          text: 'A static candidate also mentioned copper rabbit.',
          renderedClaim: {
            renderedClaimId: 'penny:claim:sha256:static-candidate',
            domainId: SEMANTIC_DOMAIN_IDS.STATIC_CANDIDATE,
            sourceAuthority: 'candidate-only',
            supportState: 'candidate-only',
            temporalScope: 'current',
          },
        },
      ],
    },
  }, 'What is the coding mascot now?', 3, '- Nothing yet.', now, { archiveEligible: true });

  assert.deepEqual(promptTruth.channels.sessionArchive.renderedClaims, [
    {
      renderedClaimId: claimId,
      domainId: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
      sourceAuthority: 'advisory',
      supportState: 'rendered-advisory',
      temporalScope: 'current',
    },
  ]);
  assert.deepEqual(promptTruth.channels.globalArchive.renderedClaims, []);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels.sessionArchive.renderedClaims[0], 'subject'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels.sessionArchive.renderedClaims[0], 'predicate'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels.sessionArchive.renderedClaims[0], 'source'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels, 'toolEvidenceReceipt'), false);
});

test('buildPromptTruth does not list claim authority labels for held-back archive candidates', () => {
  const now = Date.UTC(2026, 3, 12);
  const claim = {
    domainId: SEMANTIC_DOMAIN_IDS.SESSION_ARCHIVE,
    subject: {
      id: buildSemanticEntityId({ entityType: 'user', entityKey: 'self' }),
      type: 'user',
    },
    predicate: { id: SEMANTIC_PREDICATE_IDS.FAVORITE_TEA },
    object: { type: 'text', text: 'oolong' },
    source: {
      sourceId: buildSemanticSourceId({ sourceType: 'archive-episode', sourceId: 'session-oolong' }),
      sourceType: 'archive-episode',
      excerpt: 'Favorite tea used to be oolong.',
    },
    temporal: { temporalScope: 'historical' },
    status: { stale: false },
  };
  const promptTruth = buildPromptTruth({
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      reasonCode: 'semantic_query',
      session: [
        {
          id: 'session-oolong',
          text: 'Favorite tea used to be oolong.',
          claim,
        },
      ],
    },
  }, 'What tea do I like again?', 3, '- Nothing yet.', now, { archiveEligible: true });

  assert.equal(promptTruth.channels.sessionArchive.state, 'held_back');
  assert.equal(promptTruth.channels.sessionArchive.renderedCount, 0);
  assert.deepEqual(promptTruth.channels.sessionArchive.renderedClaims, []);
});

test('buildPromptTruth records no-candidate states only when the runtime can prove selection ran', () => {
  const now = Date.UTC(2026, 3, 12);
  const promptTruth = buildPromptTruth({
    memories: [],
    memoryBookContext: {
      matches: [],
    },
    archiveContext: {
      reasonCode: 'semantic_query',
      session: [],
      global: [],
    },
    researchLedgerContext: {
      topics: [],
    },
  }, 'What should we verify next?', 3, '- Nothing yet.', now, { archiveEligible: true });

  assert.equal(promptTruth.channels.stableFacts.state, 'no_candidate');
  assert.equal(promptTruth.channels.memoryBooks.state, 'no_candidate');
  assert.equal(promptTruth.channels.sessionArchive.state, 'no_candidate');
  assert.equal(promptTruth.channels.globalArchive.state, 'no_candidate');
  assert.equal(promptTruth.channels.researchLedger.state, 'no_candidate');
});

test('buildPromptTruth records disabled, ineligible, and unknown fallback states conservatively', () => {
  const now = Date.UTC(2026, 3, 12);
  const disabled = buildPromptTruth({
    researchLedgerPromptEnabled: false,
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
  }, 'What should we verify next?', 3, '- Nothing yet.', now, { archiveEligible: true });
  const ineligible = buildPromptTruth({
    memoryBookContext: { matches: [] },
    researchLedgerContext: { topics: [] },
  }, 'Open the file for me.', 3, '- Nothing yet.', now, { archiveEligible: false });
  const unknown = buildPromptTruth({}, 'Open the file for me.', 3, '- Nothing yet.', now);

  assert.equal(disabled.channels.researchLedger.state, 'disabled');
  assert.equal(disabled.channels.researchLedger.heldBackReason, 'ledger-prompt-disabled');
  assert.equal(ineligible.channels.sessionArchive.state, 'ineligible');
  assert.equal(ineligible.channels.globalArchive.state, 'ineligible');
  assert.equal(unknown.channels.sessionArchive.state, 'unknown');
  assert.equal(unknown.channels.globalArchive.state, 'unknown');
  assert.equal(unknown.channels.researchLedger.state, 'unknown');
  assert.equal(unknown.channels.memoryBooks.state, 'unknown');
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
      session: [
        {
          text: 'Favorite tea used to be oolong.',
          sourceLabel: 'archive-session',
          sourceAuthority: 'advisory',
          supportState: 'candidate',
          candidateChannels: ['static-embedding'],
          staticOnly: true,
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
  }, 'Tell me what you remember about my tea.', 3, '- Nothing yet.', now);

  assert.match(out, /canon priority:/i);
  assert.match(out, /Favorite tea is lapsang souchong/);
  assert.doesNotMatch(out, /oolong/i);
  assert.doesNotMatch(out, /Wake state - active session context:/i);
  assert.doesNotMatch(out, /Wake state - ongoing investigations \(advisory\):/i);
  assert.doesNotMatch(out, /Wake state - retrieval hints \(advisory\):/i);
});

test('formatPromptMemories treats natural location authority questions as canon-first when explicit facts exist', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'My coding notebook stays left of the keyboard', kind: 'personal', ts: now },
    ],
    archiveContext: {
      semanticReady: true,
      reasonCode: 'semantic_query',
      session: [
        { text: 'My coding notebook stays on the right side of the keyboard.', sourceLabel: 'archive-session' },
      ],
      global: [
        { text: 'Longer pattern: the notebook used to drift around the desk.', sourceLabel: 'archive-global' },
      ],
    },
    archiveSynthesis: {
      generated: true,
      summary: 'Archive advisory: older notes still mention the notebook on the right side.',
    },
  }, 'Where is my coding notebook?', 3, '- Nothing yet.', now);

  assert.match(out, /canon priority:/i);
  assert.match(out, /My coding notebook stays left of the keyboard/i);
  assert.doesNotMatch(out, /Wake state - active session context:/i);
  assert.doesNotMatch(out, /Wake state - retrieval hints \(advisory\):/i);
});

test('formatPromptMemories treats natural identity authority questions as canon-first when explicit facts exist', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'My coding mascot is a copper rabbit', kind: 'personal', ts: now },
    ],
    archiveContext: {
      semanticReady: true,
      reasonCode: 'semantic_query',
      session: [
        { text: 'My coding mascot is a brass fox.', sourceLabel: 'archive-session' },
      ],
      global: [
        { text: 'Longer pattern: the mascot keeps changing.', sourceLabel: 'archive-global' },
      ],
    },
    researchLedgerContext: {
      topics: [
        {
          topicId: 'coding-mascot',
          topicLabel: 'coding mascot',
          status: 'provisional',
          summary: 'Older notes still mention the fox.',
        },
      ],
    },
  }, 'What is my coding mascot now?', 3, '- Nothing yet.', now);

  assert.match(out, /canon priority:/i);
  assert.match(out, /My coding mascot is a copper rabbit/i);
  assert.doesNotMatch(out, /Wake state - active session context:/i);
  assert.doesNotMatch(out, /Wake state - ongoing investigations \(advisory\):/i);
  assert.doesNotMatch(out, /Wake state - retrieval hints \(advisory\):/i);
});

test('formatPromptMemories treats natural attribute authority questions as canon-first when explicit facts exist', () => {
  const now = Date.UTC(2026, 3, 12);
  const out = formatPromptMemories({
    memories: [
      { text: 'My backup mug is orange', kind: 'personal', ts: now },
    ],
    archiveContext: {
      semanticReady: true,
      reasonCode: 'semantic_query',
      session: [
        { text: 'My backup mug was blue.', sourceLabel: 'archive-session' },
      ],
      global: [
        { text: 'Older notes still mention a blue mug.', sourceLabel: 'archive-global' },
      ],
    },
  }, 'What color is my backup mug?', 3, '- Nothing yet.', now);

  assert.match(out, /canon priority:/i);
  assert.match(out, /My backup mug is orange/i);
  assert.doesNotMatch(out, /Wake state - active session context:/i);
  assert.doesNotMatch(out, /Wake state - retrieval hints \(advisory\):/i);
});

test('canonical memory detection stays off for repo-shaped possessive questions without explicit-memory overlap', () => {
  const now = Date.UTC(2026, 3, 12);
  const memories = {
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'preference', ts: now },
    ],
    archiveContext: {
      session: [
        { text: 'package.json still pins Node 22.', sourceLabel: 'archive-session' },
      ],
    },
  };
  const question = 'What is my package.json again?';
  const out = formatPromptMemories(memories, question, 3, '- Nothing yet.', now);

  assert.equal(isCanonicalMemoryQuestion(question, memories, 3, now), false);
  assert.match(out, /Wake state - active session context:/i);
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

test('formatPromptMemories renders live open-loop bridge snippets without adding a PromptTruth channel', () => {
  const now = Date.UTC(2026, 3, 22);
  const memories = {
    archiveContext: {
      openLoops: [
        {
          id: 'open-loop-bridge',
          text: 'Open loop candidate, advisory: Live bridge is in progress. Relevance: explicit-anchor. Source: open-loop state. Surface only if directly relevant. Do not treat this as canonical memory or overclaim its status.',
          status: 'in-progress',
          authority: 'advisory',
          source: 'penny-open-loop-state',
        },
      ],
    },
  };
  const out = formatPromptMemories(memories, 'Continue the open-loop bridge.', 3, '- Nothing yet.', now);
  const promptTruth = buildPromptTruth(memories, 'Continue the open-loop bridge.', 3, '- Nothing yet.', now);

  assert.match(out, /Wake state - contradictions\/open questions:/);
  assert.match(out, /Open loop candidate, advisory: Live bridge is in progress\./);
  assert.doesNotMatch(out, /open question: Open loop candidate/i);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels, 'openLoops'), false);
  assert.equal(promptTruth.channels.sessionArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.globalArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.researchLedger.renderedCount, 0);
});

test('formatPromptMemories renders live initiative bridge snippets without adding a PromptTruth channel', () => {
  const now = Date.UTC(2026, 3, 22);
  const memories = {
    initiativePromptBridge: {
      enabled: true,
      promptBridge: {
        renderedCount: 1,
        promptText: 'Optional initiative, max one sentence: Suggest as an ignorable next-step suggestion, grounded in docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md: Test the correction guardrail before enabling live-advisory; do not take action; do not save memory; make it easy to ignore.',
      },
    },
  };
  const out = formatPromptMemories(memories, 'What is one small next move?', 3, '- Nothing yet.', now);
  const promptTruth = buildPromptTruth(memories, 'What is one small next move?', 3, '- Nothing yet.', now);

  assert.match(out, /Wake state - optional initiative \(advisory\):/);
  assert.match(out, /Optional initiative, max one sentence:/);
  assert.match(out, /do not take action/);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels, 'initiative'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels, 'boundedInitiative'), false);
  assert.equal(promptTruth.channels.sessionArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.globalArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.researchLedger.renderedCount, 0);
});

test('formatPromptMemories renders live turn-state bridge snippets without adding a PromptTruth channel', () => {
  const now = Date.UTC(2026, 3, 22);
  const memories = {
    turnStatePromptBridge: {
      enabled: true,
      promptBridge: {
        renderedCount: 1,
        promptText: 'Turn state, ephemeral (persist=false): aim for an extensive technical roadmap response. Keep PromptTruth unchanged. Do not change runtime voice, memory authority, prompt limits, or persistence.',
      },
    },
  };
  const out = formatPromptMemories(memories, 'Start Slice T5.', 3, '- Nothing yet.', now);
  const promptTruth = buildPromptTruth(memories, 'Start Slice T5.', 3, '- Nothing yet.', now);

  assert.match(out, /Wake state - current turn state \(ephemeral\):/);
  assert.match(out, /Turn state, ephemeral \(persist=false\)/);
  assert.match(out, /PromptTruth unchanged/);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels, 'turnState'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(promptTruth.channels, 'turnStatePromptBridge'), false);
  assert.equal(promptTruth.channels.sessionArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.globalArchive.renderedCount, 0);
  assert.equal(promptTruth.channels.researchLedger.renderedCount, 0);
});
