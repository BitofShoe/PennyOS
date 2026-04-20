const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQaEnvironmentValidity,
} = require('../lib/penny-qa-validity');

test('buildQaEnvironmentValidity rejects long-lived servers for release-style verdicts by default', () => {
  const validity = buildQaEnvironmentValidity({
    serverMode: 'existing-main-server',
    preparation: { ok: true, blockers: [] },
    serverStatus: {
      resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
      resolvedToolModel: 'google/gemma-4-e4b',
      availableModels: ['unsloth/gemma-4-31b-it@q6_k', 'google/gemma-4-e4b'],
    },
    requireDisposable: true,
    requireChat: true,
    requireTool: true,
    expectedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    expectedToolModel: 'google/gemma-4-e4b',
  });

  assert.equal(validity.valid, false);
  assert.equal(validity.trustedServer, false);
  assert.match(validity.reasons.join(' '), /disposable|restart-gated/i);
});

test('buildQaEnvironmentValidity marks degraded runtime artifacts invalid instead of blaming Penny', () => {
  const validity = buildQaEnvironmentValidity({
    serverMode: 'spawned-disposable',
    preparation: { ok: true, blockers: [] },
    serverStatus: {
      resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
      resolvedToolModel: 'google/gemma-4-e4b',
      semanticMemory: { ready: true },
      availableModels: ['unsloth/gemma-4-31b-it@q6_k', 'google/gemma-4-e4b'],
    },
    results: [{
      artifact: {
        version: 'penny-runtime-artifact.v1',
        readiness: { warmState: 'degraded' },
        performance: {},
        context: { laneFallback: false, usedFallback: false, semanticMemoryReady: true },
      },
    }],
    requireDisposable: true,
    requireChat: true,
    requireTool: true,
    requireSemantic: true,
    expectedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    expectedToolModel: 'google/gemma-4-e4b',
  });

  assert.equal(validity.valid, false);
  assert.equal(validity.degradedArtifacts, 1);
  assert.match(validity.reasons.join(' '), /degraded readiness/i);
});

test('buildQaEnvironmentValidity rejects duplicate loaded models as an environment problem', () => {
  const validity = buildQaEnvironmentValidity({
    serverMode: 'spawned-disposable',
    preparation: { ok: true, blockers: [] },
    serverStatus: {
      resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
      resolvedToolModel: 'google/gemma-4-e4b',
      semanticMemory: { ready: true },
      availableModels: ['unsloth/gemma-4-31b-it@q6_k', 'google/gemma-4-e4b'],
    },
    loadedModelEntries: [
      { modelKey: 'google/gemma-4-e4b' },
      { modelKey: 'google/gemma-4-e4b' },
      { modelKey: 'text-embedding-nomic-embed-text-v1.5' },
    ],
    requireDisposable: true,
    requireChat: true,
    requireTool: true,
    requireSemantic: true,
    expectedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
    expectedToolModel: 'google/gemma-4-e4b',
  });

  assert.equal(validity.valid, false);
  assert.match(validity.reasons.join(' '), /duplicate loaded models/i);
  assert.match(validity.duplicateLoadedModels.join(' '), /gemma-4-e4b/i);
});

test('buildQaEnvironmentValidity prefers runtime artifact lane models over a stale server snapshot', () => {
  const validity = buildQaEnvironmentValidity({
    serverMode: 'spawned-disposable',
    preparation: { ok: true, blockers: [] },
    serverStatus: {
      resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
      resolvedToolModel: 'unsloth/gemma-4-31b-it@q6_k',
      semanticMemory: { ready: true },
      availableModels: ['unsloth/gemma-4-31b-it@q6_k'],
    },
    results: [({
      artifact: {
        version: 'penny-runtime-artifact.v1',
        readiness: { warmState: 'warm' },
        performance: {},
        scope: { selectedLane: 'tool' },
        context: {
          resolvedModel: 'google/gemma-4-e4b',
          laneFallback: false,
          usedFallback: false,
          semanticMemoryReady: true,
        },
      },
    })],
    requireDisposable: true,
    requireChat: false,
    requireTool: true,
    requireSemantic: true,
    expectedToolModel: 'google/gemma-4-e4b',
  });

  assert.equal(validity.valid, true);
  assert.equal(validity.toolReady, true);
  assert.equal(validity.observed.toolModel, 'google/gemma-4-e4b');
  assert.deepEqual(validity.observed.artifactResolvedModels.tool, ['google/gemma-4-e4b']);
});
