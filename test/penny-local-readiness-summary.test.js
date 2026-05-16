const test = require('node:test');
const assert = require('node:assert/strict');

const {
  READINESS_STATES,
  buildLocalReadinessSummary,
  formatLocalReadinessSummary,
} = require('../lib/penny-local-readiness-summary');

test('local readiness summary treats Q6 and E4B co-loading as healthy when lanes resolve correctly', () => {
  const summary = buildLocalReadinessSummary({
    requestedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    requestedToolModel: 'google/gemma-4-e4b',
    requestedEmbedModel: 'text-embedding-nomic-embed-text-v1.5',
    resolvedChatModel: 'unsloth/gemma-4-31b-it',
    resolvedToolModel: 'google/gemma-4-e4b',
    loadedModels: [
      'unsloth/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q6_K.gguf',
      'google/gemma-4-e4b',
      'text-embedding-nomic-embed-text-v1.5',
    ],
    semanticReady: true,
    semanticKnown: true,
    requireTool: true,
  });

  assert.equal(summary.state, READINESS_STATES.HEALTHY);
  assert.equal(summary.coLoadedChatTool, true);
  assert.match(summary.policy.coLoading, /Q6 \+ E4B co-loading is okay/i);
  assert.match(formatLocalReadinessSummary(summary), /chat -> Q6/i);
  assert.match(formatLocalReadinessSummary(summary), /tool -> E4B/i);
});

test('local readiness summary separates optional embed fallback from lane-routing problems', () => {
  const optionalEmbed = buildLocalReadinessSummary({
    requestedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    requestedToolModel: 'google/gemma-4-e4b',
    requestedEmbedModel: 'text-embedding-nomic-embed-text-v1.5',
    resolvedChatModel: 'unsloth/gemma-4-31b-it',
    resolvedToolModel: 'google/gemma-4-e4b',
    loadedModels: ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b'],
    semanticReady: false,
    semanticKnown: true,
    requireTool: true,
    requireSemantic: false,
  });

  assert.equal(optionalEmbed.state, READINESS_STATES.READY_WITH_OPTIONAL_FALLBACK);
  assert.match(optionalEmbed.semanticMemory.message, /optional fallback/i);

  const swappedLanes = buildLocalReadinessSummary({
    requestedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    requestedToolModel: 'google/gemma-4-e4b',
    resolvedChatModel: 'google/gemma-4-e4b',
    resolvedToolModel: 'unsloth/gemma-4-31b-it',
    loadedModels: ['unsloth/gemma-4-31b-it', 'google/gemma-4-e4b'],
    semanticReady: true,
    semanticKnown: true,
    requireTool: true,
    strictLanePolicy: true,
    laneMismatches: {
      chat: ['google/gemma-4-e4b'],
      tool: ['unsloth/gemma-4-31b-it'],
    },
  });

  assert.equal(swappedLanes.state, READINESS_STATES.INVALID);
  assert.match(swappedLanes.headline, /needs attention/i);
  assert.equal(swappedLanes.coLoadedChatTool, false);
});
