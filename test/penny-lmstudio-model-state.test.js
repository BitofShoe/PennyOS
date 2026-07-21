const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getUnloadIdentifiersForNonEmbeddingModels,
  isEmbeddingModelEntry,
  summarizeLoadedModelEntries,
} = require('../lib/penny-lmstudio-model-state');

test('isEmbeddingModelEntry trusts explicit LM Studio model type first', () => {
  assert.equal(isEmbeddingModelEntry({ type: 'embedding', modelKey: 'text-embedding-embeddinggemma-300m@f32' }), true);
  assert.equal(isEmbeddingModelEntry({ type: 'rerank', modelKey: 'local-reranker' }), true);
  assert.equal(isEmbeddingModelEntry({ type: 'llm', modelKey: 'gemma-4-31b-it' }), false);
});

test('isEmbeddingModelEntry detects embedding models when older lms ps entries omit type', () => {
  assert.equal(isEmbeddingModelEntry({ identifier: 'text-embedding-nomic-embed-text-v1.5' }), true);
  assert.equal(isEmbeddingModelEntry({ architecture: 'gemma-embedding', modelKey: 'embeddinggemma-300m' }), true);
  assert.equal(isEmbeddingModelEntry({ identifier: 'qwen3.6-35b-a3b' }), false);
});

test('getUnloadIdentifiersForNonEmbeddingModels preserves embeddings and returns only LLM identifiers', () => {
  const identifiers = getUnloadIdentifiersForNonEmbeddingModels([
    { type: 'embedding', identifier: 'text-embedding-embeddinggemma-300m@f32' },
    { type: 'llm', identifier: 'gemma-4-31b-it' },
    { modelKey: 'qwen3.6-27b-mtp' },
    { type: 'embedding', modelKey: 'text-embedding-nomic-embed-text-v1.5' },
  ]);

  assert.deepEqual(identifiers, ['gemma-4-31b-it', 'qwen3.6-27b-mtp']);
});

test('summarizeLoadedModelEntries records LLM and embedding counts for eval receipts', () => {
  const summary = summarizeLoadedModelEntries([
    { type: 'embedding', identifier: 'text-embedding-embeddinggemma-300m@f32' },
    { type: 'llm', identifier: 'google/gemma-4-e4b' },
  ]);

  assert.equal(summary.embedding, 1);
  assert.equal(summary.llm, 1);
  assert.deepEqual(summary.identifiers.embedding, ['text-embedding-embeddinggemma-300m@f32']);
  assert.deepEqual(summary.identifiers.llm, ['google/gemma-4-e4b']);
});
