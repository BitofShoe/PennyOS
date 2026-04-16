const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildRuntimeArtifact,
} = require('../lib/penny-runtime-artifacts');

test('buildRuntimeArtifact records a compact retrieval trace for inspector and QA consumers', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    retrieval: {
      reasonCode: 'semantic_query',
      provenance: [{ oldText: 'Favorite tea is oolong', newText: 'Favorite tea is lapsang souchong' }],
      session: [
        { id: 'session-1', sourceLabel: 'archive-session', score: 0.91 },
      ],
      global: [
        { id: 'global-1', sourceLabel: 'archive-global', score: 0.62 },
      ],
      compression: {
        used: true,
        reasonCode: 'compression_low_retrieval_confidence',
        chapters: [
          { id: 'chapter-1', sourceType: 'chapter', confidence: 0.48 },
        ],
      },
    },
    archiveContext: {
      activeContradictions: [
        { conflictKey: 'favorite tea', oldText: 'Favorite tea is oolong', newText: 'Favorite tea is lapsang souchong' },
      ],
      openLoops: [
        { id: 'loop-1', text: 'Check whether the red glove is still on dryer three', status: 'open' },
      ],
    },
    matchedBooks: [
      { id: 'appearance', sourceLabel: 'book', score: 105 },
    ],
  });

  assert.ok(Array.isArray(artifact.retrievalTrace));
  assert.deepEqual(
    artifact.retrievalTrace.map((item) => item.channel),
    ['archive-session', 'archive-global', 'archive-chapter', 'memory-book'],
  );
  assert.equal(artifact.retrievalTrace[0].contradictionState, 'tracked');
  assert.equal(artifact.retrievalTrace[2].reason, 'compression_low_retrieval_confidence');
  assert.equal(artifact.retrievalTrace[3].reason, 'memory-book-match');
  assert.equal(artifact.retrievalTrace.every((item) => typeof item.injected === 'boolean'), true);
  assert.equal(artifact.trace.laneChoice.selectedLane, 'chat');
  assert.equal(artifact.trace.wakeHierarchy[0].label, 'Explicit facts stay canonical');
  assert.equal(artifact.trace.retrievalChannels.length, 4);
  assert.equal(artifact.trace.contradictions[0].label, 'favorite tea');
  assert.equal(artifact.trace.openQuestions[0].detail, 'Check whether the red glove is still on dryer three');
  assert.equal(artifact.trace.evidenceAccepted.length > 0, true);
});
