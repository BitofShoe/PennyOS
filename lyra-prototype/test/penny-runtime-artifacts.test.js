const test = require('node:test');
const assert = require('node:assert/strict');

const {
  appendToolEvidenceFact,
  buildRuntimeArtifact,
  normalizeRuntimeArtifact,
} = require('../lib/penny-runtime-artifacts');

test('appendToolEvidenceFact deduplicates equivalent tool-evidence facts without changing order', () => {
  const firstFact = {
    path: 'semantic_render',
    promptVisibility: 'prompt_visible',
    nonPromptUse: 'none',
    renderForm: 'summarized_semantic_core',
    modelHop: 'single',
    toolRecordIndexes: [0, 1],
  };
  const duplicateFact = {
    path: 'semantic_render',
    promptVisibility: 'prompt_visible',
    nonPromptUse: 'none',
    renderForm: 'summarized_semantic_core',
    modelHop: 'single',
    toolRecordIndexes: [0, 1],
  };
  const secondFact = {
    path: 'write_rescue',
    promptVisibility: 'prompt_visible',
    nonPromptUse: 'none',
    renderForm: 'summarized_write_rescue',
    modelHop: 'single',
    toolRecordIndexes: [0, 1],
  };

  const appendedOnce = appendToolEvidenceFact([], firstFact);
  const deduped = appendToolEvidenceFact(appendedOnce, duplicateFact);
  const appendedTwice = appendToolEvidenceFact(deduped, secondFact);

  assert.deepEqual(appendedOnce, [firstFact]);
  assert.equal(deduped, appendedOnce);
  assert.deepEqual(appendedTwice, [firstFact, secondFact]);
});

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
    initiativePromptBridge: {
      schema: 'penny-initiative-prompt-bridge.v1',
      enabled: true,
      livePromptBridge: true,
      liveChatTouched: true,
      maxPerTurn: 1,
      cooldownTurns: 3,
      promptTruthExpanded: false,
      promptTruthChannelAdded: false,
      memoryWrites: false,
      autonomousActions: false,
      selected: [
        {
          initiativeType: 'next-step-suggestion',
          candidateId: 'bounded-initiative-policy',
          sourceLabel: 'docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md',
          confidence: 'high',
          riskClass: 'low',
        },
      ],
      promptBridge: {
        renderedCount: 1,
      },
    },
    turnStatePromptBridge: {
      schema: 'penny-turn-state-prompt-bridge.v1',
      enabled: true,
      measurementMode: 'live-prompt',
      turnStateMeasurementMode: 'ephemeral',
      persist: false,
      livePromptBridge: true,
      liveChatTouched: true,
      renderedCount: 1,
      maxTokens: 120,
      promptTruthExpanded: false,
      promptTruthChannelAdded: false,
      toolEvidenceReceiptChanged: false,
      memoryWrites: false,
      autonomousActions: false,
      sensitiveInferenceExcluded: true,
      renderedFields: ['measurementMode', 'persist', 'activeConstraints'],
      omittedFields: ['userIntent', 'energy', 'riskFlags'],
      promptBridge: {
        renderedCount: 1,
        promptText: 'Turn state, ephemeral (persist=false): aim for a detailed source backed review response. Keep PromptTruth unchanged.',
        wordCount: 13,
        maxTokens: 120,
      },
      turnStateSummary: {
        schema: 'penny-turn-state.v1',
        measurementMode: 'ephemeral',
        persist: false,
        desiredDepth: 'detailed',
        responseMode: 'source-backed-review',
        activeProjectThread: 'bounded aliveness',
        explicitInstructionCount: 1,
        activeConstraintCount: 2,
        riskFlagCount: 1,
        sourceCheckNeeded: true,
        openLoopsTouchedCount: 0,
        warningCount: 0,
        rejectedFieldCount: 0,
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
  assert.equal(artifact.retrievalTrace.every((item) => typeof item.rendered === 'boolean'), true);
  assert.equal(artifact.retrievalTrace.every((item) => typeof item.injected === 'boolean'), true);
  assert.equal(artifact.retrievalTrace.every((item) => item.rendered === item.injected), true);
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
  assert.equal(artifact.modelAdvisory.initiativePromptBridge.schema, 'penny-initiative-prompt-bridge.v1');
  assert.equal(artifact.modelAdvisory.initiativePromptBridge.livePromptBridge, true);
  assert.equal(artifact.modelAdvisory.initiativePromptBridge.renderedCount, 1);
  assert.deepEqual(artifact.modelAdvisory.initiativePromptBridge.selected.map((item) => item.candidateId), ['bounded-initiative-policy']);
  assert.equal(artifact.modelAdvisory.initiativePromptBridge.promptTruthExpanded, false);
  assert.equal(artifact.modelAdvisory.initiativePromptBridge.promptTruthChannelAdded, false);
  assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'initiativePromptBridge'), false);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.schema, 'penny-turn-state-prompt-bridge.v1');
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.livePromptBridge, true);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.persist, false);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.renderedCount, 1);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.turnStateSummary.userIntent, undefined);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.turnStateSummary.desiredDepth, 'detailed');
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.promptTruthExpanded, false);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.promptTruthChannelAdded, false);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.retentionPolicy.fullStateStored, false);
  assert.equal(artifact.modelAdvisory.turnStatePromptBridge.retentionPolicy.summaryStored, true);
  assert.ok(artifact.modelAdvisory.turnStatePromptBridge.retentionPolicy.omittedFields.includes('userIntent'));
  assert.ok(artifact.modelAdvisory.turnStatePromptBridge.retentionPolicy.omittedFields.includes('energy.evidence'));
  assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'turnStatePromptBridge'), false);
  assert.equal(artifact.promptTruth.schema, 'penny-prompttruth.v1');
  assert.equal(artifact.modelAdvisory.promptTruth.schema, 'penny-prompttruth.v1');
  assert.equal(artifact.frameBudget.schema, 'penny-frame-budget.v1');
  assert.equal(artifact.frameBudget.measurementMode, 'runtime-artifact');
  assert.equal(artifact.frameBudget.workDone.candidatesSelected, 5);
  assert.equal(artifact.frameBudget.workDone.candidatesRendered, 5);
  assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'frameBudget'), false);
  assert.equal(artifact.promptTruth.channels.sessionArchive.renderedCount, 1);
  assert.equal(artifact.promptTruth.channels.researchLedger.renderedCount, 1);
  assert.equal(artifact.researchLedgerRendered, true);
  assert.equal(artifact.researchLedgerPromptInjected, artifact.researchLedgerRendered);
  assert.equal(artifact.trace.laneChoice.researchLedgerRendered, true);
  assert.equal(artifact.trace.laneChoice.researchLedgerPromptInjected, artifact.trace.laneChoice.researchLedgerRendered);
  assert.equal(artifact.modelAdvisory.approximatePath.status, 'bounded-approximate');
  assert.equal(artifact.modelAdvisory.approximatePath.policyMode, 'recall-heavy');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.mode, 'deliberate');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.executionPreference, 'model-led');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.semanticQueryAllowed, true);
  assert.equal(artifact.trace.reasoningPolicy.mode, 'deliberate');
  assert.equal(artifact.modelAdvisory.advisoryMerge.advisoryItems, 3);
  assert.equal(artifact.modelAdvisory.advisoryMerge.lossyItems, 0);
  assert.deepEqual(artifact.modelAdvisory.advisoryMerge.mergeBasis, []);
});

test('normalizeRuntimeArtifact redacts malformed turn-state bridge receipts before retention', () => {
  const artifact = normalizeRuntimeArtifact({
    modelAdvisory: {
      turnStatePromptBridge: {
        schema: 'penny-turn-state-prompt-bridge.v1',
        enabled: true,
        measurementMode: 'live-prompt',
        turnStateMeasurementMode: 'ephemeral',
        persist: true,
        livePromptBridge: true,
        liveChatTouched: true,
        renderedCount: 1,
        maxTokens: 80,
        sensitiveInferenceExcluded: false,
        turnState: {
          userIntent: 'Diagnose the user from private inference.',
          chainOfThought: 'secret notes',
          energy: {
            label: 'excited',
            evidence: ['private tone explanation'],
          },
        },
        promptBridge: {
          renderedCount: 1,
          promptText: 'Turn state, ephemeral (persist=false): hidden reasoning should not be retained.',
          wordCount: 9,
          maxTokens: 80,
        },
        turnStateSummary: {
          schema: 'penny-turn-state.v1',
          measurementMode: 'ephemeral',
          persist: true,
          userIntent: 'raw user intent should not persist',
          desiredDepth: 'detailed',
          responseMode: 'technical-roadmap',
          energyLabel: 'excited',
          activeProjectThread: 'private inference about the user',
          explicitInstructionCount: 2,
          activeConstraintCount: 1,
          riskFlagCount: 1,
          sourceCheckNeeded: true,
          openLoopsTouchedCount: 0,
          warningCount: 1,
          rejectedFieldCount: 1,
        },
      },
    },
  });
  const bridge = artifact.modelAdvisory.turnStatePromptBridge;
  const serialized = JSON.stringify(bridge);

  assert.equal(bridge.persist, false);
  assert.equal(bridge.sensitiveInferenceExcluded, true);
  assert.equal(bridge.promptBridge.promptText, '');
  assert.equal(bridge.promptBridge.wordCount, 0);
  assert.equal(bridge.turnStateSummary.persist, false);
  assert.equal(bridge.turnStateSummary.userIntent, undefined);
  assert.equal(bridge.turnStateSummary.energyLabel, undefined);
  assert.equal(bridge.turnStateSummary.activeProjectThread, '');
  assert.equal(bridge.retentionPolicy.fullStateStored, false);
  assert.equal(bridge.retentionPolicy.promptTextStored, false);
  assert.equal(bridge.retentionPolicy.promptTextRedacted, true);
  assert.equal(bridge.retentionPolicy.summaryStored, true);
  assert.ok(bridge.retentionPolicy.omittedFields.includes('turnState'));
  assert.ok(bridge.retentionPolicy.omittedFields.includes('energy.evidence'));
  assert.doesNotMatch(serialized, /Diagnose the user/i);
  assert.doesNotMatch(serialized, /secret notes/i);
  assert.doesNotMatch(serialized, /private tone explanation/i);
  assert.doesNotMatch(serialized, /raw user intent/i);
  assert.doesNotMatch(serialized, /hidden reasoning/i);
});

test('buildRuntimeArtifact derives frame budget receipt from existing performance and prompt truth only', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'frame-budget-demo',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    executionPath: 'llm-chat',
    performance: {
      request: { durationMs: 1200, available: true },
      promptAssembly: { durationMs: 25, available: true },
      archiveRetrieval: { durationMs: 40, available: true },
      firstToken: { durationMs: 300, available: true },
      modelRoundTrip: { durationMs: 900, available: true },
    },
    promptTruth: {
      channels: {
        stableFacts: { candidateCount: 1, renderedCount: 1 },
        sessionArchive: { candidateCount: 2, renderedCount: 1 },
        globalArchive: { candidateCount: 1, renderedCount: 0 },
      },
    },
    retrieval: {
      staticEmbeddingShadow: {
        mode: 'live-advisory',
        queryMs: 3.5,
        candidateCount: 2,
        staticOnlyRenderedCap: 1,
      },
    },
  });

  assert.equal(artifact.frameBudget.measurementMode, 'runtime-artifact');
  assert.equal(artifact.frameBudget.timings.promptBuildMs, 25);
  assert.equal(artifact.frameBudget.timings.archiveRetrievalMs, 40);
  assert.equal(artifact.frameBudget.timings.staticMemoryQueryMs, 3.5);
  assert.equal(artifact.frameBudget.timings.totalPrePromptMs, 68.5);
  assert.equal(artifact.frameBudget.timings.lmStudioFirstTokenMs, 300);
  assert.equal(artifact.frameBudget.timings.lmStudioTotalMs, 900);
  assert.equal(artifact.frameBudget.timings.totalTurnMs, 1200);
  assert.equal(artifact.frameBudget.workDone.rawCandidatesInspected, 6);
  assert.equal(artifact.frameBudget.workDone.staticCandidatesInspected, 2);
  assert.equal(artifact.frameBudget.workDone.candidatesSelected, 4);
  assert.equal(artifact.frameBudget.workDone.candidatesRendered, 2);
  assert.equal(artifact.frameBudget.targets.maxStaticOnlyRendered, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'frameBudget'), false);
  assert.equal(artifact.toolEvidenceReceipt, null);
});

test('normalizeRuntimeArtifact preserves prompt truth schema during normalization', () => {
  const artifact = normalizeRuntimeArtifact({
    promptTruth: {
      schema: 'penny-prompttruth.v1',
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 1, renderedCount: 1, candidateSourceIds: ['path-readme'], renderedSourceIds: ['path-readme'] },
      },
    },
    researchLedgerPromptInjected: false,
  });

  assert.equal(artifact.promptTruth.schema, 'penny-prompttruth.v1');
  assert.equal(artifact.modelAdvisory.promptTruth.schema, 'penny-prompttruth.v1');
  assert.equal(artifact.researchLedgerRendered, true);
  assert.equal(artifact.researchLedgerPromptInjected, true);
  assert.equal(artifact.researchLedgerPromptInjected, artifact.researchLedgerRendered);
});

test('buildRuntimeArtifact preserves static embedding live-shadow as sibling trace metadata', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    retrieval: {
      reasonCode: 'keyword_fallback',
      session: [],
      global: [],
      compression: { used: false, chapters: [] },
      staticEmbeddingShadow: {
        mode: 'live-shadow',
        provider: 'model2vec-potion-8m',
        queryMs: 1.2,
        candidateCount: 1,
        wouldHaveSelected: false,
        topCandidates: [
          {
            id: 'archive:episode:static-copper-rabbit',
            textPreview: 'Copper rabbit replaced the brass fox.',
            sourceType: 'archive-episode',
            sourceAuthority: 'advisory',
            supportState: 'candidate',
            candidateChannels: ['static-embedding'],
            staticEmbedding: {
              provider: 'model2vec-potion-8m',
              modelId: 'minishlab/potion-base-8M',
              dimensions: 256,
              similarity: 0.742,
              rank: 1,
              queryMs: 1.2,
            },
            policy: {
              selected: false,
              rendered: false,
              heldBackReason: 'live-shadow-trace-only',
              reasons: ['static-embedding-shadow', 'trace-only'],
            },
          },
        ],
      },
    },
  });

  assert.equal(artifact.staticEmbeddingShadow.mode, 'live-shadow');
  assert.equal(artifact.staticEmbeddingShadow.provider, 'model2vec-potion-8m');
  assert.equal(artifact.staticEmbeddingShadow.queryMs, 1.2);
  assert.equal(artifact.staticEmbeddingShadow.candidateCount, 1);
  assert.equal(artifact.staticEmbeddingShadow.wouldHaveSelected, false);
  assert.equal(artifact.staticEmbeddingShadow.topCandidates[0].selected, false);
  assert.equal(artifact.staticEmbeddingShadow.topCandidates[0].rendered, false);
  assert.equal(artifact.staticEmbeddingShadow.topCandidates[0].policy.heldBackReason, 'live-shadow-trace-only');
  assert.equal(artifact.promptTruth.schema, 'penny-prompttruth.v1');
  assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'staticEmbeddingShadow'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(artifact, 'toolEvidenceReceipt'), true);
});

test('buildRuntimeArtifact preserves static live-advisory merge counters as sibling metadata', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    retrieval: {
      reasonCode: 'keyword_fallback',
      session: [],
      global: [],
      compression: { used: false, chapters: [] },
      staticEmbeddingShadow: {
        mode: 'live-advisory',
        provider: 'model2vec-potion-8m',
        queryMs: 0.8,
        candidateCount: 2,
        candidatePoolMerged: true,
        mergedCandidateCount: 1,
        staticOnlyCandidateCount: 1,
        staticOnlyRenderedCap: 1,
        topCandidates: [],
      },
    },
  });

  assert.equal(artifact.staticEmbeddingShadow.mode, 'live-advisory');
  assert.equal(artifact.staticEmbeddingShadow.candidatePoolMerged, true);
  assert.equal(artifact.staticEmbeddingShadow.mergedCandidateCount, 1);
  assert.equal(artifact.staticEmbeddingShadow.staticOnlyCandidateCount, 1);
  assert.equal(artifact.staticEmbeddingShadow.staticOnlyRenderedCap, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(artifact.promptTruth.channels, 'staticEmbeddingShadow'), false);
});

test('normalizeRuntimeArtifact prefers canonical rendered booleans over conflicting compatibility aliases', () => {
  const artifact = normalizeRuntimeArtifact({
    promptTruth: {
      schema: 'penny-prompttruth.v1',
      channels: {
        stableFacts: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
      },
    },
    researchLedgerRendered: false,
    researchLedgerPromptInjected: true,
  });

  assert.equal(artifact.researchLedgerRendered, false);
  assert.equal(artifact.researchLedgerPromptInjected, false);
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
  assert.equal(artifact.researchLedgerRendered, false);
  assert.equal(artifact.researchLedgerPromptInjected, false);
  assert.equal(artifact.researchLedgerUpdate.status, 'applied');
  assert.equal(artifact.promptTruth.channels.researchLedger.renderedCount, 0);
  assert.equal(artifact.trace.laneChoice.executionPath, 'deterministic-tool');
  assert.equal(artifact.trace.laneChoice.researchLedgerRendered, false);
  assert.equal(artifact.trace.laneChoice.researchLedgerPromptInjected, false);
  assert.equal(artifact.trace.laneChoice.researchLedgerPromptInjected, artifact.trace.laneChoice.researchLedgerRendered);
  assert.equal(artifact.trace.laneChoice.researchLedgerUpdateStatus, 'applied');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.mode, 'verifier-first');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.executionPreference, 'verifier-first');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.verifierUsed, true);
  assert.equal(artifact.modelAdvisory.reasoningPolicy.shortCircuitApplied, true);
  assert.equal(artifact.summary.text, 'Verifier-first turn short-circuited before extra model reasoning (deterministic-tool).');
  assert.equal(artifact.provenance.retrieval[0].rendered, false);
  assert.equal(artifact.provenance.retrieval[0].injected, artifact.provenance.retrieval[0].rendered);
  assert.equal(artifact.provenance.retrieval[0].sourceLabel, 'package.json');
});

test('buildRuntimeArtifact builds deterministic-only tool evidence receipts for direct deterministic paths', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'direct-deterministic',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'deterministic-tool',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: {
            path: 'README.md',
            textPreview: '# Penny',
          },
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'direct_deterministic',
      promptVisibility: 'not_prompt_visible',
      nonPromptUse: 'deterministic_only',
      renderForm: 'none',
      modelHop: 'none',
      toolRecordIndexes: [0],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.schema, 'penny-tool-evidence-receipt.v1');
  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.summary.deterministicOnlyItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'direct_deterministic');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].toolName, 'read_project_file');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, 'README.md');
});

test('buildRuntimeArtifact builds prompt-visible raw-json tool evidence receipts for direct single-tool LM answers', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'direct-lm-answer',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read docs/README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'docs/README.md' },
        result: {
          ok: true,
          label: 'read docs/README.md',
          data: {
            path: 'docs/README.md',
            textPreview: '# Docs',
          },
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'direct_single_tool_context_answer',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'single',
      toolRecordIndexes: [0],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.multiHopItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'direct_single_tool_context_answer');
  assert.equal(artifact.toolEvidenceReceipt.items[0].renderForm, 'raw_json');
  assert.equal(artifact.toolEvidenceReceipt.items[0].modelHop, 'single');
});

test('buildRuntimeArtifact builds provenance-only tool evidence receipts for direct open-ended sequences', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'direct-open-ended',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'insert_in_project_file', label: "insert Penny's Playground/penny-qa-freewrite.md", ok: true },
      { name: 'get_git_status', label: 'git status', ok: true },
    ],
    toolRecords: [
      {
        name: 'insert_in_project_file',
        args: { path: "Penny's Playground/penny-qa-freewrite.md" },
        result: {
          ok: true,
          label: "insert Penny's Playground/penny-qa-freewrite.md",
          data: {
            path: "Penny's Playground/penny-qa-freewrite.md",
          },
        },
      },
      {
        name: 'get_git_status',
        args: {},
        result: {
          ok: true,
          label: 'git status',
          data: {},
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'direct_open_ended_sequence',
      promptVisibility: 'not_prompt_visible',
      nonPromptUse: 'provenance_only',
      renderForm: 'none',
      modelHop: 'none',
      toolRecordIndexes: [0, 1],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.toolRecordCount, 2);
  assert.equal(artifact.toolEvidenceReceipt.summary.provenanceOnlyItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'direct_open_ended_sequence');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs.length, 2);
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, "Penny's Playground/penny-qa-freewrite.md");
});

test('buildRuntimeArtifact builds prompt-visible raw-json tool evidence receipts for native tool-loop results', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'native-tool-loop',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: {
            path: 'README.md',
            excerpt: '# Penny Companion Prototype',
          },
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.multiHopItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'native_tool_loop');
  assert.equal(artifact.toolEvidenceReceipt.items[0].renderForm, 'raw_json');
  assert.equal(artifact.toolEvidenceReceipt.items[0].modelHop, 'multi');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, 'README.md');
});

test('buildRuntimeArtifact builds prompt-visible raw-json tool evidence receipts for manual tool-loop results', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'manual-tool-loop',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read docs/README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'docs/README.md' },
        result: {
          ok: true,
          label: 'read docs/README.md',
          data: {
            path: 'docs/README.md',
            excerpt: '# Docs',
          },
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'manual_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.multiHopItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'manual_tool_loop');
  assert.equal(artifact.toolEvidenceReceipt.items[0].renderForm, 'raw_json');
  assert.equal(artifact.toolEvidenceReceipt.items[0].modelHop, 'multi');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, 'docs/README.md');
});

test('buildRuntimeArtifact counts mixed tool-loop raw-json and auto-verification receipts without inferring hop counts', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'tool-loop-counts',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
      { name: 'read_project_file', label: 'read docs/README.md', ok: true },
      { name: 'get_git_status', label: 'git status', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: {
            path: 'README.md',
            excerpt: '# Penny Companion Prototype',
          },
        },
      },
      {
        name: 'read_project_file',
        args: { path: 'docs/README.md' },
        result: {
          ok: true,
          label: 'read docs/README.md',
          data: {
            path: 'docs/README.md',
            excerpt: '# Docs',
          },
        },
      },
      {
        name: 'get_git_status',
        args: {},
        result: {
          ok: true,
          label: 'git status',
          data: {
            ok: true,
            status: 'M README.md',
          },
        },
      },
    ],
    toolEvidenceFacts: [
      {
        path: 'native_tool_loop',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'raw_json',
        modelHop: 'multi',
        toolRecordIndexes: [0],
      },
      {
        path: 'manual_tool_loop',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'raw_json',
        modelHop: 'multi',
        toolRecordIndexes: [1],
      },
      {
        path: 'manual_tool_loop',
        promptVisibility: 'prompt_visible',
        nonPromptUse: 'none',
        renderForm: 'auto_verification_json',
        modelHop: 'multi',
        toolRecordIndexes: [2],
      },
    ],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 3);
  assert.equal(artifact.toolEvidenceReceipt.summary.toolRecordCount, 3);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 3);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 2);
  assert.equal(artifact.toolEvidenceReceipt.summary.autoVerificationItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.multiHopItemCount, 3);
});

test('buildRuntimeArtifact summarizes advisory tool-cost hints beside PromptTruth', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'tool-cost-summary',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
      { name: 'search_web', label: 'search web', ok: true },
      { name: 'read_web_page', label: 'read web page', ok: true },
      { name: 'search_project_text', label: 'search project text', ok: true },
      { name: 'custom_raw_dump', label: 'custom dump', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: { path: 'README.md', excerpt: '# Penny' },
        },
      },
      {
        name: 'search_web',
        args: { query: 'Penny local companion' },
        result: {
          ok: true,
          label: 'search web',
          data: { query: 'Penny local companion', results: [] },
        },
      },
      {
        name: 'read_web_page',
        args: { url: 'https://example.com/penny' },
        result: {
          ok: true,
          label: 'read web page',
          data: { url: 'https://example.com/penny', textPreview: 'Example' },
        },
      },
      {
        name: 'search_project_text',
        args: { query: 'toolCostSummary' },
        result: {
          ok: true,
          label: 'search project text',
          data: { query: 'toolCostSummary', matches: [] },
        },
      },
      {
        name: 'custom_raw_dump',
        args: {},
        result: {
          ok: true,
          label: 'custom dump',
          data: { textPreview: 'wide dump' },
        },
        toolCostHint: {
          outputCostShape: 'raw-dump',
          sourceShape: 'generated-summary',
          defaultOutputBound: null,
          planningHint: 'Synthetic raw dump risk fixture.',
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'native_tool_loop',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'raw_json',
      modelHop: 'multi',
      toolRecordIndexes: [0, 1, 2, 3, 4],
    }],
  });

  assert.deepEqual(artifact.toolCostSummary, {
    highCostToolCalls: 3,
    rawDumpRisk: true,
    externalSourceCalls: 2,
    boundedListCalls: 2,
  });
  assert.equal(artifact.promptTruth.toolCostSummary, undefined);
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].toolCostHint.outputCostShape, 'bounded-list');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[1].toolCostHint.sourceShape, 'external-source');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[2].toolCostHint.outputCostShape, 'external-page');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[4].toolCostHint.outputCostShape, 'raw-dump');
});

test('buildRuntimeArtifact counts summarized write-rescue receipts as prompt-visible summarized items', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'write-rescue-receipt',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
      { name: 'read_project_file', label: 'read docs/README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: {
            path: 'README.md',
            excerpt: '# Penny Companion Prototype',
          },
        },
      },
      {
        name: 'read_project_file',
        args: { path: 'docs/README.md' },
        result: {
          ok: true,
          label: 'read docs/README.md',
          data: {
            path: 'docs/README.md',
            excerpt: '# Docs',
          },
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'write_rescue',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'summarized_write_rescue',
      modelHop: 'single',
      toolRecordIndexes: [0, 1],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.toolRecordCount, 2);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.summarizedItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.summary.multiHopItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'write_rescue');
  assert.equal(artifact.toolEvidenceReceipt.items[0].renderForm, 'summarized_write_rescue');
  assert.equal(artifact.toolEvidenceReceipt.items[0].modelHop, 'single');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs.length, 2);
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, 'README.md');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[1].target, 'docs/README.md');
});

test('buildRuntimeArtifact counts summarized semantic-render receipts as prompt-visible summarized items', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'semantic-render-receipt',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [
      { name: 'read_project_file', label: 'read README.md', ok: true },
      { name: 'read_project_file', label: 'read docs/README.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'README.md' },
        result: {
          ok: true,
          label: 'read README.md',
          data: {
            path: 'README.md',
            excerpt: '# Penny Companion Prototype',
          },
        },
      },
      {
        name: 'read_project_file',
        args: { path: 'docs/README.md' },
        result: {
          ok: true,
          label: 'read docs/README.md',
          data: {
            path: 'docs/README.md',
            excerpt: '# Docs',
          },
        },
      },
    ],
    toolEvidenceFacts: [{
      path: 'semantic_render',
      promptVisibility: 'prompt_visible',
      nonPromptUse: 'none',
      renderForm: 'summarized_semantic_core',
      modelHop: 'single',
      toolRecordIndexes: [0, 1],
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt.summary.itemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.toolRecordCount, 2);
  assert.equal(artifact.toolEvidenceReceipt.summary.promptVisibleItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.summarizedItemCount, 1);
  assert.equal(artifact.toolEvidenceReceipt.summary.rawJsonItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.summary.multiHopItemCount, 0);
  assert.equal(artifact.toolEvidenceReceipt.items[0].path, 'semantic_render');
  assert.equal(artifact.toolEvidenceReceipt.items[0].renderForm, 'summarized_semantic_core');
  assert.equal(artifact.toolEvidenceReceipt.items[0].modelHop, 'single');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs.length, 2);
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[0].target, 'README.md');
  assert.equal(artifact.toolEvidenceReceipt.items[0].sourceRefs[1].target, 'docs/README.md');
});

test('buildRuntimeArtifact marks write-required tool misses as failed edits instead of verified success', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo-write-miss',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    requestedModel: 'qwen/qwen3.6-35b-a3b',
    resolvedModel: 'qwen/qwen3.6-35b-a3b',
    toolsUsed: [
      { name: 'read_project_file', label: 'read tmp/qwen-dual-lane-sandbox.md', ok: true },
    ],
    toolRecords: [
      {
        name: 'read_project_file',
        args: { path: 'tmp/qwen-dual-lane-sandbox.md' },
        result: {
          ok: true,
          label: 'read tmp/qwen-dual-lane-sandbox.md',
          data: {
            path: 'tmp/qwen-dual-lane-sandbox.md',
            textPreview: 'alpha',
          },
        },
      },
    ],
    toolOutcome: {
      writeIntentRequired: true,
      writeIntentSatisfied: false,
      confirmedWriteCount: 0,
      failureReason: 'write-required-unmet',
      debug: {
        manualFallback: {
          used: true,
          reasonCode: 'tool_loop_missing_workspace_write',
          reason: 'Tool loop required a confirmed workspace write before final reply.',
          lastPlannerStatus: 'final-before-write',
          lastDecisionKind: 'final',
          lastDecisionTool: '',
          lastDecisionError: '',
          lastAssistantText: 'i already handled it.',
          invalidReplyCount: 0,
          emptyReplyCount: 0,
        },
        writeRescue: {
          attempted: true,
          phase: 'manual',
          status: 'non-tool-decision',
          responseStatusCode: 200,
          decisionKind: 'final',
          tool: '',
          argsPath: 'tmp/qwen-dual-lane-sandbox.md',
          parseError: '',
          assistantText: 'still not a write',
          responseBody: '',
        },
      },
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: false,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-18T18:00:00.000Z',
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
      modelRoundTrip: { available: true, durationMs: 82724, transport: 'local-lmstudio' },
    },
  });

  assert.equal(artifact.authority.reply, 'write-required-unmet');
  assert.equal(artifact.authority.toolClaims, 'write-unverified');
  assert.equal(artifact.toolOutcome.writeIntentRequired, true);
  assert.equal(artifact.toolOutcome.writeIntentSatisfied, false);
  assert.equal(artifact.toolOutcome.debug.manualFallback.used, true);
  assert.equal(artifact.toolOutcome.debug.writeRescue.status, 'non-tool-decision');
  assert.equal(artifact.summary.text, 'Verifier-first turn did not complete a verified edit (write required unmet).');
  assert.equal(artifact.reasonCodes.includes('write-required-unmet'), true);
  assert.equal(artifact.sideEffects.some((item) => item.type === 'file-write' && item.status === 'missing'), true);
  assert.equal(artifact.trace.evidenceRejected.some((item) => item.status === 'write-unverified'), true);
  assert.equal(artifact.trace.evidenceRejected.some((item) => /Rescue manual ended as non-tool-decision/i.test(item.detail || '')), true);
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
  assert.equal(artifact.modelAdvisory.authorityPressure.advisoryChannelsRendered, 0);
  assert.equal(artifact.modelAdvisory.authorityPressure.advisoryItemsRendered, 0);
  assert.equal(artifact.modelAdvisory.authorityPressure.advisoryChannelsInjected, 0);
  assert.equal(artifact.modelAdvisory.authorityPressure.advisoryItemsInjected, 0);
  assert.equal(
    artifact.modelAdvisory.authorityPressure.advisoryChannelsInjected,
    artifact.modelAdvisory.authorityPressure.advisoryChannelsRendered,
  );
  assert.equal(
    artifact.modelAdvisory.authorityPressure.advisoryItemsInjected,
    artifact.modelAdvisory.authorityPressure.advisoryItemsRendered,
  );
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
  assert.equal(artifact.researchLedgerRendered, false);
  assert.equal(artifact.researchLedgerPromptInjected, false);
  assert.equal(artifact.researchLedgerPromptInjected, artifact.researchLedgerRendered);
  assert.equal(artifact.modelAdvisory.approximatePath.status, 'bounded-approximate');
  assert.equal(artifact.modelAdvisory.approximatePath.reasons.includes('semantic-query-held-back'), true);
  assert.equal(artifact.modelAdvisory.reasoningPolicy.mode, 'minimal');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.reasonCodes.includes('semantic-query-held-back'), true);
  assert.equal(artifact.trace.reasoningPolicy.mode, 'minimal');
  assert.equal(artifact.modelAdvisory.advisoryMerge.advisoryItems, 0);
  assert.equal(artifact.modelAdvisory.advisoryMerge.sameSessionItems, 0);
  assert.equal(artifact.summary.text, 'Minimal ordinary turn with advisory context held back canon-first.');
  assert.equal(artifact.trace.wakeHierarchy.find((item) => item.layer === 'advisory-retrieval')?.detail, '0 rendered / 3 not rendered across 3 retrieval channel(s).');
  assert.match(artifact.trace.wakeHierarchy[1].detail, /selected but held back \(canon priority suppression\)/i);
  assert.match(artifact.trace.wakeHierarchy[4].detail, /selected but held back \(canon priority suppression\)/i);
  assert.equal(artifact.provenance.acceptedEvidence.some((item) => item.type === 'retrieval'), false);
  assert.equal(artifact.provenance.rejectedEvidence.some((item) => item.channel === 'research-ledger' && item.status === 'not-rendered'), true);
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

  assert.equal(artifact.modelAdvisory.reasoningPolicy.mode, 'minimal');
  assert.equal(artifact.trace.reasoningPolicy.mode, 'minimal');
  assert.equal(artifact.summary.text, 'Minimal ordinary turn without rendered advisory context.');
  assert.equal(artifact.trace.wakeHierarchy[1].detail, 'Prompt-truth state for this channel is unknown for this turn.');
  assert.equal(artifact.trace.wakeHierarchy[4].detail, 'Prompt-truth state for this channel is unknown for this turn.');
});

test('buildRuntimeArtifact marks image-heavy turns as attachment-bounded without exposing reasoning text', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'demo-attachment',
    requestedMode: 'local',
    selectedLane: 'chat',
    backend: 'local-lmstudio',
    promptTruth: {
      canonicalFactsPresent: false,
      canonicalOverrideActive: false,
      channels: {
        stableFacts: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        memoryBooks: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        sessionArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        globalArchive: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
        researchLedger: { candidateCount: 0, renderedCount: 0, candidateSourceIds: [], renderedSourceIds: [] },
      },
    },
    latencyBudget: {
      latencyClass: 'image-heavy',
      policyMode: 'attachment-bounded',
      approximateByPolicy: false,
      policyNote: 'Keep attachment turns bounded.',
      allowSemanticQuery: false,
      allowArchiveCompression: false,
      allowSemanticRender: true,
    },
    performance: {
      latencyClass: 'image-heavy',
      request: { available: true, durationMs: 120 },
      promptAssembly: { available: true, durationMs: 15 },
      archiveRetrieval: { available: true, durationMs: 8, sessionItems: 0, globalItems: 0, semanticReady: true, reasonCode: '' },
      semanticRender: { available: true, attempted: false, used: false },
      modelResolution: { available: true, durationMs: 5 },
      semanticProbe: { available: true, durationMs: 5 },
      firstToken: { available: true, durationMs: 40 },
      modelRoundTrip: { available: true, durationMs: 110, transport: 'local-lmstudio' },
    },
    readiness: {
      chatModelReady: true,
      toolModelReady: true,
      embeddingReady: true,
      fallbackActive: false,
      modelUsage: 'used',
      warmState: 'warm',
      checkedAt: '2026-04-18T13:00:00.000Z',
      cacheAgeMs: 0,
      cacheExpiresAt: '',
      cacheHit: false,
    },
  });

  assert.equal(artifact.modelAdvisory.reasoningPolicy.mode, 'attachment-bounded');
  assert.equal(artifact.modelAdvisory.reasoningPolicy.executionPreference, 'attachment-bounded');
  assert.equal(artifact.trace.reasoningPolicy.mode, 'attachment-bounded');
  assert.equal(artifact.summary.text, 'Attachment-bounded turn without rendered advisory context.');
});

test('normalizeRuntimeArtifact keeps old artifacts without a tool evidence receipt at null', () => {
  const artifact = normalizeRuntimeArtifact({
    version: 'penny-runtime-artifact.v1',
    kind: 'tool-turn',
    executionPath: 'deterministic-tool',
    scope: {
      sessionId: 'old-artifact',
      route: '/api/penny/chat',
      requestedMode: 'local',
      selectedLane: 'tool',
    },
    authority: {
      reply: 'verified-tool-evidence',
      memory: 'explicit-canonical',
      archive: 'advisory',
      toolClaims: 'verified-required',
    },
    summary: {
      label: 'tool-turn',
      text: 'Older runtime artifact without receipt.',
      backend: 'local-lmstudio-tools',
    },
    context: {
      backend: 'local-lmstudio-tools',
      requestedModel: '',
      resolvedModel: '',
      executionPath: 'deterministic-tool',
      semanticMemoryReady: false,
      semanticMemoryMode: 'disabled',
      usedFallback: false,
      laneFallback: false,
      shadowEnabled: false,
    },
    evidence: [],
    artifacts: [],
    sideEffects: [],
    reasonCodes: [],
    modelAdvisory: {
      toolsUsed: [],
    },
  });

  assert.equal(artifact.toolEvidenceReceipt, null);
  assert.equal(artifact.toolCostSummary, null);
});

test('buildRuntimeArtifact does not infer tool evidence receipt from generic tool records without source facts', () => {
  const artifact = buildRuntimeArtifact({
    sessionId: 'tool-records-only',
    requestedMode: 'local',
    selectedLane: 'tool',
    backend: 'local-lmstudio-tools',
    executionPath: 'llm-tool-loop',
    toolsUsed: [{
      name: 'read_project_file',
      ok: true,
      label: 'read README.md',
    }],
    toolRecords: [{
      name: 'read_project_file',
      args: { path: 'README.md' },
      result: {
        ok: true,
        label: 'read README.md',
        data: {
          path: 'README.md',
          textPreview: '# Penny',
        },
      },
    }],
  });

  assert.equal(artifact.toolEvidenceReceipt, null);
  assert.deepEqual(artifact.toolCostSummary, {
    highCostToolCalls: 0,
    rawDumpRisk: false,
    externalSourceCalls: 0,
    boundedListCalls: 1,
  });
});
