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
        {
          id: 'session-1',
          sourceLabel: 'archive-session',
          score: 0.91,
          sourceType: 'episode',
          scope: 'session',
          sourceEpisodeIds: ['episode-1'],
          matchedTokens: ['favorite tea'],
          evidenceSnippet: 'Favorite tea is lapsang souchong now.',
        },
      ],
      global: [
        {
          id: 'global-1',
          sourceLabel: 'archive-global',
          score: 0.62,
          sourceType: 'summary',
          scope: 'global',
          sourceEpisodeIds: ['episode-9'],
          evidenceSnippet: 'Longer-term tea preferences shifted recently.',
        },
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
    researchLedgerContext: {
      topics: [
        {
          topicId: 'path-package-json',
          topicLabel: 'package.json',
          status: 'open',
          summary: 'open follow-up - verify the vitest migration before claiming it is done.',
          openFollowUps: ['verify the vitest migration'],
          evidenceRefs: [{ type: 'project-path', ref: 'package.json', label: 'read package.json' }],
          sourceSessionIds: ['qa-ledger'],
          sourceTurnIds: ['qa-ledger:turn-1'],
        },
      ],
    },
    matchedBooks: [
      { id: 'appearance', sourceLabel: 'book', score: 105 },
    ],
  });

  assert.ok(Array.isArray(artifact.retrievalTrace));
  assert.deepEqual(
    artifact.retrievalTrace.map((item) => item.channel),
    ['archive-session', 'archive-global', 'archive-chapter', 'memory-book', 'research-ledger'],
  );
  assert.equal(artifact.retrievalTrace[0].contradictionState, 'tracked');
  assert.equal(artifact.retrievalTrace[2].reason, 'compression_low_retrieval_confidence');
  assert.equal(artifact.retrievalTrace[3].reason, 'memory-book-match');
  assert.equal(artifact.retrievalTrace[4].reason, 'research-continuity-ledger');
  assert.equal(artifact.retrievalTrace.every((item) => typeof item.injected === 'boolean'), true);
  assert.equal(artifact.trace.laneChoice.selectedLane, 'chat');
  assert.equal(artifact.trace.wakeHierarchy[0].label, 'Explicit facts stay canonical');
  assert.equal(artifact.trace.retrievalChannels.length, 5);
  assert.equal(artifact.trace.contradictions[0].label, 'favorite tea');
  assert.equal(artifact.trace.openQuestions[0].detail, 'Check whether the red glove is still on dryer three');
  assert.equal(artifact.trace.ongoingInvestigations[0].label, 'package.json');
  assert.equal(Array.isArray(artifact.provenance.retrieval), true);
  assert.deepEqual(artifact.provenance.retrieval[0].sourceEpisodeIds, ['episode-1']);
  assert.equal(artifact.provenance.retrieval[0].matchedTokens[0], 'favorite tea');
  assert.equal(artifact.provenance.retrieval[4].sourceSessionIds[0], 'qa-ledger');
  assert.equal(artifact.provenance.retrieval[4].sourceTurnIds[0], 'qa-ledger:turn-1');
  assert.equal(artifact.provenance.retrieval[4].evidenceRefs[0].ref, 'package.json');
  assert.equal(artifact.provenance.acceptedEvidence.length > 0, true);
  assert.equal(artifact.trace.evidenceAccepted.length > 0, true);
});
