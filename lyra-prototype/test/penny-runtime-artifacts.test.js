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
    promptComposition: {
      lane: 'chat',
      mode: 'local',
      eligibleSlotCount: 4,
      filledSlotCount: 4,
      heldBackSlotCount: 1,
      noOpSlotCount: 0,
      slots: [
        { id: 'voiceBlend', eligible: true, state: 'filled' },
        { id: 'directives', eligible: true, state: 'filled' },
        { id: 'examples', eligible: true, state: 'held-back' },
        { id: 'memory', eligible: true, state: 'filled' },
      ],
    },
    promptTruth: {
      canonicalFactsPresent: true,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['memory:stable-tea'],
          renderedSourceIds: ['memory:stable-tea'],
        },
        memoryBooks: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['appearance'],
          renderedSourceIds: ['appearance'],
        },
        sessionArchive: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['session-1'],
          renderedSourceIds: ['session-1'],
        },
        globalArchive: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['global-1'],
          renderedSourceIds: ['global-1'],
        },
        researchLedger: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['path-package-json'],
          renderedSourceIds: ['path-package-json'],
        },
      },
    },
    latencyBudget: {
      latencyClass: 'memory-heavy-recall',
      policyMode: 'recall-heavy',
      approximateByPolicy: false,
      policyNote: 'Spend more budget on explicit recall.',
      allowSemanticQuery: true,
      allowArchiveCompression: true,
      allowSemanticRender: false,
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
  assert.equal(artifact.modelAdvisory.promptComposition.lane, 'chat');
  assert.equal(artifact.modelAdvisory.promptComposition.slots[2].state, 'held-back');
  assert.equal(artifact.promptTruth.channels.sessionArchive.renderedCount, 1);
  assert.equal(artifact.promptTruth.channels.researchLedger.renderedCount, 1);
  assert.equal(artifact.modelAdvisory.approximatePath.status, 'bounded-approximate');
  assert.equal(artifact.modelAdvisory.approximatePath.policyMode, 'recall-heavy');
  assert.equal(artifact.modelAdvisory.advisoryMerge.advisoryItems, 3);
  assert.equal(artifact.modelAdvisory.advisoryMerge.lossyItems, 0);
  assert.deepEqual(artifact.modelAdvisory.advisoryMerge.mergeBasis, []);
});

test('buildRuntimeArtifact preserves deterministic-tool truth without faking model receipts', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'deterministic-tool',
    requestedModel: 'google/gemma-4-e4b',
    resolvedModel: '',
    researchLedgerPromptInjected: false,
    researchLedgerUpdate: {
      status: 'applied',
      reason: 'updated',
      topicId: 'path-package-json',
      topicLabel: 'package.json',
    },
    researchLedgerContext: {
      topics: [
        {
          topicId: 'path-package-json',
          topicLabel: 'package.json',
          status: 'open',
          summary: 'open follow-up - verify whether the Vitest migration is still pending.',
          evidenceRefs: [{ type: 'project-path', ref: 'package.json', label: 'read package.json' }],
          sourceSessionIds: ['ledger-demo'],
          sourceTurnIds: ['ledger-demo:1'],
        },
      ],
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'not-used',
      warmState: 'warm',
      checkedAt: '2026-04-16T12:00:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
    performance: {
      latencyClass: 'tool-heavy',
      request: { available: true },
      promptAssembly: { available: true },
      archiveRetrieval: { available: true },
      semanticRender: { available: false, attempted: false, used: false },
      modelResolution: { available: true },
      semanticProbe: { available: true },
      firstToken: { available: false },
      modelRoundTrip: { available: false, durationMs: 0, transport: '' },
    },
  });

  assert.equal(artifact.executionPath, 'deterministic-tool');
  assert.equal(artifact.readiness.modelUsage, 'not-used');
  assert.equal(artifact.context.resolvedModel, '');
  assert.equal(artifact.researchLedgerPromptInjected, false);
  assert.equal(artifact.researchLedgerUpdate.status, 'applied');
  assert.equal(artifact.trace.laneChoice.executionPath, 'deterministic-tool');
  assert.equal(artifact.trace.laneChoice.researchLedgerPromptInjected, false);
  assert.equal(artifact.trace.laneChoice.researchLedgerUpdateStatus, 'applied');
  assert.equal(artifact.provenance.retrieval[0].injected, false);
  assert.equal(artifact.provenance.retrieval[0].sourceLabel, 'package.json');
});

test('buildRuntimeArtifact records cleanup and authority-pressure summaries separately from repair', () => {
    const artifact = buildRuntimeArtifact({
      sessionId: 'demo-session',
      requestedMode: 'local',
      selectedLane: 'chat',
      backend: 'local-lmstudio',
      researchLedgerPromptInjected: true,
      cleanup: {
        reasonCode: 'salvaged_draft_candidate',
        cleanupApplied: true,
        materialChange: true,
      reconstructedReply: true,
      usedReasoningFallback: true,
    },
    canonicalFactsPresent: true,
    canonicalOverrideActive: true,
    retrieval: {
      session: [
        { id: 'session-1', sourceLabel: 'archive-session', scope: 'session', sourceType: 'episode', evidenceSnippet: 'Notebook stays left of the keyboard.' },
      ],
      global: [
        { id: 'global-1', sourceLabel: 'archive-global', scope: 'global', sourceType: 'summary', evidenceSnippet: 'Older setup notes conflict.' },
      ],
    },
    researchLedgerContext: {
      topics: [
        {
          topicId: 'path-package-json',
          topicLabel: 'package.json',
          status: 'open',
          summary: 'verify the migration',
          sourceSessionIds: ['other-session'],
          sourceTurnIds: ['other-session:1'],
        },
      ],
    },
    repair: {
      repairAttempted: true,
      repairAccepted: false,
      repairRejectedReason: 'already-stable',
      finalCandidateSource: 'first-pass',
    },
    promptComposition: {
      lane: 'chat',
      mode: 'local',
      eligibleSlotCount: 4,
      filledSlotCount: 3,
      heldBackSlotCount: 0,
      noOpSlotCount: 1,
      slots: [
        { id: 'voiceBlend', eligible: true, state: 'filled' },
        { id: 'directives', eligible: true, state: 'filled' },
        { id: 'overlays', eligible: true, state: 'no-op' },
        { id: 'memory', eligible: true, state: 'filled' },
      ],
    },
    promptTruth: {
      canonicalFactsPresent: true,
      canonicalOverrideActive: true,
      channels: {
        stableFacts: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['memory:notebook'],
          renderedSourceIds: ['memory:notebook'],
        },
        memoryBooks: {
          candidateCount: 0,
          renderedCount: 0,
          candidateSourceIds: [],
          renderedSourceIds: [],
        },
        sessionArchive: {
          candidateCount: 1,
          renderedCount: 0,
          candidateSourceIds: ['session-1'],
          renderedSourceIds: [],
          heldBackReason: 'canon-priority-suppression',
        },
        globalArchive: {
          candidateCount: 1,
          renderedCount: 0,
          candidateSourceIds: ['global-1'],
          renderedSourceIds: [],
          heldBackReason: 'canon-priority-suppression',
        },
        researchLedger: {
          candidateCount: 1,
          renderedCount: 0,
          candidateSourceIds: ['path-package-json'],
          renderedSourceIds: [],
          heldBackReason: 'canon-priority-suppression',
        },
      },
    },
    latencyBudget: {
      latencyClass: 'casual-companion',
      policyMode: 'bounded-approximate',
      approximateByPolicy: true,
      policyNote: 'Keep advisory recall narrow.',
      allowSemanticQuery: false,
      allowArchiveCompression: false,
      allowSemanticRender: false,
    },
  });

  assert.deepEqual(artifact.modelAdvisory.cleanup, {
    reasonCode: 'salvaged_draft_candidate',
    cleanupApplied: true,
    materialChange: true,
    reconstructedReply: true,
    usedReasoningFallback: true,
  });
  assert.equal(artifact.modelAdvisory.authorityPressure.canonicalFactsPresent, true);
  assert.equal(artifact.modelAdvisory.authorityPressure.canonicalOverrideActive, true);
  assert.equal(artifact.modelAdvisory.authorityPressure.advisoryChannelsInjected, 0);
  assert.equal(artifact.modelAdvisory.authorityPressure.advisoryItemsInjected, 0);
  assert.equal(artifact.modelAdvisory.authorityPressure.sameSessionAdvisoryItems, 0);
  assert.equal(artifact.modelAdvisory.authorityPressure.crossSessionAdvisoryItems, 0);
  assert.equal(artifact.modelAdvisory.repair.scope, 'semantic-render');
  assert.equal(artifact.modelAdvisory.cleanupTransform.class, 'salvage-reconstruction');
  assert.equal(artifact.modelAdvisory.cleanupTransform.materiality, 'reconstructed');
  assert.equal(artifact.modelAdvisory.cleanupTransform.operations.includes('salvage-draft-candidate'), true);
  assert.equal(artifact.modelAdvisory.promptComposition.filledSlotCount, 3);
  assert.equal(artifact.promptTruth.channels.sessionArchive.candidateCount, 1);
  assert.equal(artifact.promptTruth.channels.sessionArchive.renderedCount, 0);
  assert.equal(artifact.promptTruth.channels.sessionArchive.heldBackReason, 'canon-priority-suppression');
  assert.equal(artifact.researchLedgerPromptInjected, false);
  assert.equal(artifact.modelAdvisory.approximatePath.status, 'bounded-approximate');
  assert.equal(artifact.modelAdvisory.approximatePath.reasons.includes('semantic-query-held-back'), true);
  assert.equal(artifact.modelAdvisory.advisoryMerge.advisoryItems, 0);
  assert.equal(artifact.modelAdvisory.advisoryMerge.sameSessionItems, 0);
  assert.equal(artifact.summary.text, 'Chat lane reply with advisory context held back canon-first.');
  assert.match(artifact.trace.wakeHierarchy[1].detail, /selected but held back \(canon priority suppression\)/i);
  assert.match(artifact.trace.wakeHierarchy[4].detail, /selected but held back \(canon priority suppression\)/i);
  assert.equal(artifact.trace.ongoingInvestigations[0].status, 'held-back');
});

test('buildRuntimeArtifact does not claim additive archive support when no advisory context rendered', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo-session',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    executionPath: 'llm-chat',
    promptTruth: {
      canonicalFactsPresent: true,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: {
          candidateCount: 1,
          renderedCount: 1,
          candidateSourceIds: ['memory:tea'],
          renderedSourceIds: ['memory:tea'],
        },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
      },
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-16T12:00:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
    performance: {
      latencyClass: 'casual-companion',
      request: { available: true },
      promptAssembly: { available: true },
      archiveRetrieval: { available: true },
      semanticRender: { available: false, attempted: false, used: false },
      modelResolution: { available: true },
      semanticProbe: { available: true },
      firstToken: { available: true },
      modelRoundTrip: { available: true, durationMs: 100, transport: 'local-lmstudio' },
    },
  });

  assert.equal(artifact.summary.text, 'Chat lane reply without rendered advisory context.');
  assert.equal(artifact.trace.wakeHierarchy[1].detail, 'No session archive hits were selected for this turn.');
  assert.equal(artifact.trace.wakeHierarchy[4].detail, 'No ongoing investigation topics were active for this turn.');
});
