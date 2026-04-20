const test = require('node:test');
const assert = require('node:assert/strict');

const helpersPromise = import('../public/js/penny-memory-panel.mjs');

test('buildMemoryPanelViewModel normalizes explicit memory rows', async () => {
  const { buildMemoryPanelViewModel } = await helpersPromise;
  const viewModel = buildMemoryPanelViewModel({
    userName: 'Malac',
    voiceOn: true,
    memories: [
      { text: 'Favorite tea is lapsang souchong', kind: 'fact' },
    ],
  });

  assert.equal(viewModel.userName, 'Malac');
  assert.equal(viewModel.voiceOn, true);
  assert.equal(viewModel.memories.length, 1);
  assert.equal(viewModel.memories[0].kind, 'fact');
});

test('buildMemoryInspectorViewModel exposes books, compression, contradictions, routing, and queue slices', async () => {
  const { buildMemoryInspectorViewModel } = await helpersPromise;
  const viewModel = buildMemoryInspectorViewModel({
    sessionId: 'thread-demo',
    explicit: { count: 3 },
    archive: {
      session: {
        episodeCount: 5,
        chapterCount: 2,
        recencyProtection: {
          enabled: true,
          protectedEpisodeCount: 6,
          protectedEpisodeIds: ['episode-6', 'episode-7', 'episode-8'],
        },
        activeContradictions: [
          {
            conflictKey: 'favorite tea',
            oldText: 'Favorite tea is oolong',
            newText: 'Favorite tea is lapsang souchong',
            dependentEpisodeIds: ['episode-1'],
            dependentChapterIds: ['chapter-1'],
          },
        ],
        lastRetrieval: {
          session: [{ text: 'Red glove on dryer three', sourceType: 'episode', sourceLabel: 'archive-session', evidenceSnippet: 'red glove on dryer three' }],
          global: [],
          compression: {
            used: true,
            reason: 'low retrieval confidence',
            chapters: [{ text: 'Fact-first summary', sourceType: 'chapter' }],
            explanation: {
              selectedSignals: ['active-contradiction'],
              penalties: ['scaffolding-filter'],
              omittedEpisodeCount: 7,
              carriedContradictions: [
                {
                  conflictKey: 'favorite tea',
                  oldText: 'Favorite tea is oolong',
                  newText: 'Favorite tea is lapsang souchong',
                },
              ],
            },
          },
        },
        recentAuditTrail: [
          {
            turnId: 'turn-1',
            usedAt: '2026-04-15T12:00:00.000Z',
            userTextExcerpt: 'What tea do I like again?',
            selectedLane: 'chat',
            requestedMode: 'local',
            executionPath: 'llm-chat',
            retrieval: {
              mode: 'keyword',
              reasonCode: 'keyword_fallback',
              selectedSessionIds: ['session-1'],
              selectedGlobalIds: [],
              selectedBookIds: [],
              selectedLedgerIds: ['path-package-json'],
              renderedSessionIds: [],
              renderedGlobalIds: [],
              renderedBookIds: [],
              renderedLedgerIds: [],
              compression: { used: false },
              semanticReady: false,
              semanticDowngrade: false,
            },
            promptTruth: {
              channels: {
                stableFacts: { candidateCount: 1, renderedCount: 1, heldBackReason: '' },
                memoryBooks: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
                sessionArchive: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
                globalArchive: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
                researchLedger: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
              },
            },
            artifactSummary: {
              kind: 'chat-turn',
              authority: { reply: 'explicit-canonical' },
              approximatePath: { status: 'exact' },
              researchLedgerRendered: false,
              researchLedgerPromptInjected: false,
            },
            researchLedger: {
              updateStatus: 'skipped',
              topicId: 'path-package-json',
              topicLabel: 'package.json',
            },
          },
        ],
      },
      global: {
        patternCount: 1,
        promotionQueue: [{
          id: 'queue-1',
          text: 'Favorite tea is lapsang',
          evidenceCount: 2,
          confidence: 0.82,
          promotionPacket: {
            sourceThreadId: 'thread-demo',
            sourceTurnIds: ['turn-1', 'turn-2'],
            temporalScope: { label: 'current' },
          },
        }],
      },
    },
    memoryBooks: {
      enabledCount: 2,
      matchedBooks: [{ text: 'Keep laundromat continuity', sourceType: 'memory-book' }],
    },
    embeddings: {
      semanticMemory: {
        ready: true,
        configuredModel: 'text-embedding-nomic-embed-text-v1.5',
      },
      backgroundVectorization: {
        status: 'applied',
        attemptedAt: '2026-04-15T12:00:01.000Z',
        sourceSessionId: 'thread-demo',
        semanticReady: true,
        archivePending: false,
        batchLimit: 2,
        eagerEmbeddingCount: 4,
        eagerCreatedCount: 2,
        backgroundCandidateCount: 2,
        backgroundCreatedCount: 1,
      },
    },
    ledger: {
      topicCount: 1,
      openCount: 1,
      provisionalCount: 0,
      settledCount: 0,
      context: {
        topics: [
          {
            topicId: 'path-package-json',
            topicLabel: 'package.json',
            identity: {
              kind: 'anchored-question',
              anchorType: 'project-path',
              anchorRef: 'package.json',
              scopeLabel: 'vitest migration',
            },
            status: 'open',
            sourceClass: 'verified-evidence',
            summaryClass: 'question-carryover',
            summary: 'open follow-up - verify the vitest migration.',
            evidenceRefs: [{ ref: 'package.json' }],
            summaryEvidenceRefs: [{ ref: 'package.json' }],
            openFollowUps: ['verify the vitest migration'],
            sourceSessionIds: ['qa-ledger'],
            sourceTurnIds: ['qa-ledger:turn-1'],
          },
        ],
      },
      recentTopics: [],
    },
    routing: {
      selectedLane: 'tool',
      requestedMode: 'local',
      backend: 'local-lmstudio-tools',
      repair: {
        repairAttempted: true,
        firstPassGuardCodes: ['contradiction_stale_value'],
        finalCandidateSource: 'repair',
      },
    },
    runtime: {
      readiness: {
        chatModelReady: true,
        toolModelReady: true,
        embeddingReady: true,
        fallbackActive: false,
        warmState: 'warm',
        checkedAt: '2026-04-15T11:59:59.000Z',
        cacheAgeMs: 9000,
        cacheExpiresAt: '2026-04-15T12:00:29.000Z',
        cacheHit: true,
      },
      performance: {
        latencyClass: 'tool-heavy',
        request: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 1200, available: true, cacheHit: false, source: 'route-handler', note: '' },
        promptAssembly: { startedAt: '2026-04-15T12:00:00.010Z', finishedAt: '2026-04-15T12:00:00.120Z', durationMs: 110, available: true, cacheHit: false, source: 'prompt-builder', note: '' },
        archiveRetrieval: { startedAt: '2026-04-15T12:00:00.120Z', finishedAt: '2026-04-15T12:00:00.300Z', durationMs: 180, available: true, cacheHit: false, source: 'archive-memory', note: '', sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'direct-inspect' },
        semanticRender: { startedAt: '', finishedAt: '', durationMs: 0, available: false, cacheHit: false, source: '', note: '', attempted: false, used: false },
        modelResolution: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:00.005Z', durationMs: 5, available: true, cacheHit: true, source: 'lmstudio-status', note: '' },
        semanticProbe: { startedAt: '2026-04-15T12:00:00.005Z', finishedAt: '2026-04-15T12:00:00.015Z', durationMs: 10, available: true, cacheHit: true, source: 'semantic-memory-status', note: '' },
        firstToken: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:00.900Z', durationMs: 600, available: true, cacheHit: false, source: 'lmstudio-stream', note: '' },
        modelRoundTrip: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 900, available: true, cacheHit: false, source: 'lmstudio-stream', note: '', transport: 'local-lmstudio' },
      },
    },
    artifact: {
      version: 'penny-runtime-artifact.v1',
      kind: 'tool-turn',
      scope: { sessionId: 'demo', route: '/api/penny/chat', requestedMode: 'local', selectedLane: 'tool' },
      authority: { reply: 'verified-tool-evidence', memory: 'explicit-canonical', archive: 'advisory', toolClaims: 'verified-required' },
      summary: { label: 'tool-turn', text: 'Tool lane reply with verified evidence.', backend: 'local-lmstudio-tools' },
      context: { backend: 'local-lmstudio-tools', requestedModel: 'google/gemma-4-e4b', resolvedModel: 'google/gemma-4-e4b', semanticMemoryReady: true, semanticMemoryMode: 'semantic', usedFallback: false, laneFallback: false, shadowEnabled: false },
      evidence: [{ type: 'tool', source: 'verified-tool', label: 'read_project_file', text: 'README.md', target: 'README.md' }],
      artifacts: [],
      trace: {
        laneChoice: {
          requestedMode: 'local',
          selectedLane: 'tool',
          backend: 'local-lmstudio-tools',
          route: '/api/penny/chat',
          requestedModel: 'google/gemma-4-e4b',
          resolvedModel: 'google/gemma-4-e4b',
          usedFallback: false,
          laneFallback: false,
        },
        reasoningPolicy: {
          mode: 'verifier-first',
          sourceLatencyClass: 'tool-heavy',
          executionPreference: 'verifier-first',
          semanticQueryAllowed: false,
          archiveCompressionAllowed: false,
          verifierUsed: true,
          shortCircuitApplied: false,
          shortCircuitReason: '',
          reasonCodes: ['bounded-latency-policy', 'verified-tool-evidence'],
        },
        wakeHierarchy: [
          { layer: 'stable-facts', label: 'Explicit facts stay canonical', detail: 'Explicit memory remains authoritative.', status: 'authoritative', count: 1 },
          { layer: 'active-session', label: 'Active session context', detail: '1 session recall hit was available.', status: 'present', count: 1 },
        ],
        retrievalChannels: [
          { channel: 'archive-session', sourceId: 'session-1', sourceLabel: 'archive-session', score: 0.91, reason: 'direct-inspect', contradictionState: 'tracked', injected: true, scope: 'session', sourceEpisodeIds: ['episode-1'], snippet: 'Favorite tea is lapsang souchong now.' },
          { channel: 'archive-chapter', sourceId: 'chapter-1', sourceLabel: 'chapter', score: 0.48, reason: 'compression_low_retrieval_confidence', contradictionState: 'tracked', injected: false, scope: 'chapter', sourceEpisodeIds: ['episode-1', 'episode-2'] },
        ],
        contradictions: [
          { layer: 'contradiction', label: 'favorite tea', detail: 'Favorite tea is lapsang souchong', status: 'active', count: 1 },
        ],
        openQuestions: [
          { layer: 'open-question', label: 'open', detail: 'Check whether the red glove is still on dryer three', status: 'open', count: 1 },
        ],
        ongoingInvestigations: [
          { layer: 'research-ledger', label: 'package.json', detail: 'open follow-up - verify the vitest migration.', status: 'open', count: 1 },
        ],
        evidenceAccepted: [
          { type: 'route', channel: 'runtime', label: 'local/tool', detail: 'local-lmstudio-tools', status: 'selected' },
        ],
        evidenceRejected: [
          { type: 'retrieval', channel: 'archive-chapter', label: 'chapter', detail: 'compression_low_retrieval_confidence', status: 'held-back' },
        ],
        qaValidity: { active: false, verdict: 'n/a', reasons: [] },
      },
      provenance: {
        retrieval: [
          { channel: 'archive-session', sourceId: 'session-1', sourceLabel: 'archive-session', score: 0.91, reason: 'direct-inspect', contradictionState: 'tracked', injected: true, scope: 'session', sourceEpisodeIds: ['episode-1'], snippet: 'Favorite tea is lapsang souchong now.' },
          { channel: 'research-ledger', sourceId: 'path-package-json', sourceLabel: 'package.json', score: 1, reason: 'research-continuity-ledger', contradictionState: 'none', injected: true, scope: 'research-ledger', sourceSessionIds: ['qa-ledger'], sourceTurnIds: ['qa-ledger:turn-1'], evidenceRefs: [{ ref: 'package.json' }], snippet: 'open follow-up - verify the vitest migration.' },
        ],
        contradictions: [
          { layer: 'contradiction', label: 'favorite tea', detail: 'Favorite tea is lapsang souchong', status: 'active', count: 1 },
        ],
        openQuestions: [
          { layer: 'open-question', label: 'open', detail: 'Check whether the red glove is still on dryer three', status: 'open', count: 1 },
        ],
        ongoingInvestigations: [
          { layer: 'research-ledger', label: 'package.json', detail: 'open follow-up - verify the vitest migration.', status: 'open', count: 1 },
        ],
        acceptedEvidence: [
          { type: 'route', channel: 'runtime', label: 'local/tool', detail: 'local-lmstudio-tools', status: 'selected' },
        ],
        rejectedEvidence: [
          { type: 'retrieval', channel: 'archive-chapter', label: 'chapter', detail: 'compression_low_retrieval_confidence', status: 'held-back' },
        ],
      },
      sideEffects: [{ type: 'memory-persist', target: 'lastRoute', status: 'verified' }],
      reasonCodes: ['direct-inspect'],
      epistemics: { enabled: true, triggered: true, scope: 'tool', stance: 'refuse', signals: ['missing_tool_evidence'], note: 'Tool-backed claims need verified evidence before Penny presents them as done.' },
      synthesis: { enabled: true, generated: true, kind: 'archive-advisory-summary', scope: 'archive-advisory', summary: 'Correction in play: favorite tea is lapsang souchong, not oolong.', evidenceSources: ['correction'] },
      modelAdvisory: {
        mood: '',
        cleanup: {
          reasonCode: 'none',
          cleanupApplied: false,
          materialChange: false,
          reconstructedReply: false,
          usedReasoningFallback: false,
        },
        cleanupTransform: {
          class: 'pass-through',
          scope: 'presentation-only',
          materiality: 'none',
          idempotent: true,
          operations: [],
        },
        authorityPressure: {
          canonicalFactsPresent: false,
          canonicalOverrideActive: false,
          advisoryChannelsRendered: 0,
          advisoryItemsRendered: 0,
          advisoryChannelsInjected: 0,
          advisoryItemsInjected: 0,
          sameSessionAdvisoryItems: 0,
          crossSessionAdvisoryItems: 0,
        },
        promptComposition: {
          lane: 'tool',
          mode: 'local',
          eligibleSlotCount: 4,
          filledSlotCount: 3,
          heldBackSlotCount: 1,
          noOpSlotCount: 0,
          slots: [
            { id: 'voiceBlend', eligible: true, state: 'filled' },
            { id: 'directives', eligible: true, state: 'filled' },
            { id: 'examples', eligible: true, state: 'held-back' },
            { id: 'memory', eligible: true, state: 'filled' },
          ],
        },
        approximatePath: {
          status: 'bounded-approximate',
          latencyClass: 'tool-heavy',
          policyMode: 'deterministic-priority',
          reasons: ['bounded-latency-policy'],
        },
        reasoningPolicy: {
          mode: 'verifier-first',
          sourceLatencyClass: 'tool-heavy',
          executionPreference: 'verifier-first',
          semanticQueryAllowed: false,
          archiveCompressionAllowed: false,
          verifierUsed: true,
          shortCircuitApplied: false,
          shortCircuitReason: '',
          reasonCodes: ['bounded-latency-policy', 'verified-tool-evidence'],
        },
        advisoryMerge: {
          advisoryItems: 2,
          lossyItems: 1,
          reviewGatedItems: 0,
          mergeBasis: ['active-contradiction'],
          discardedDetailSummary: ['episode-level detail omitted'],
        },
        repair: null,
        shadowError: '',
        toolsUsed: [],
      },
      performance: {
        latencyClass: 'tool-heavy',
        request: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 1200, available: true, cacheHit: false, source: 'route-handler', note: '' },
        promptAssembly: { startedAt: '2026-04-15T12:00:00.010Z', finishedAt: '2026-04-15T12:00:00.120Z', durationMs: 110, available: true, cacheHit: false, source: 'prompt-builder', note: '' },
        archiveRetrieval: { startedAt: '2026-04-15T12:00:00.120Z', finishedAt: '2026-04-15T12:00:00.300Z', durationMs: 180, available: true, cacheHit: false, source: 'archive-memory', note: '', sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'direct-inspect' },
        semanticRender: { startedAt: '', finishedAt: '', durationMs: 0, available: false, cacheHit: false, source: '', note: '', attempted: false, used: false },
        modelResolution: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:00.005Z', durationMs: 5, available: true, cacheHit: true, source: 'lmstudio-status', note: '' },
        semanticProbe: { startedAt: '2026-04-15T12:00:00.005Z', finishedAt: '2026-04-15T12:00:00.015Z', durationMs: 10, available: true, cacheHit: true, source: 'semantic-memory-status', note: '' },
        firstToken: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:00.900Z', durationMs: 600, available: true, cacheHit: false, source: 'lmstudio-stream', note: '' },
        modelRoundTrip: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 900, available: true, cacheHit: false, source: 'lmstudio-stream', note: '', transport: 'local-lmstudio' },
      },
      readiness: {
        chatModelReady: true,
        toolModelReady: true,
        embeddingReady: true,
        fallbackActive: false,
        warmState: 'warm',
        checkedAt: '2026-04-15T11:59:59.000Z',
        cacheAgeMs: 9000,
        cacheExpiresAt: '2026-04-15T12:00:29.000Z',
        cacheHit: true,
      },
      timestamps: { usedAt: '2026-04-15T12:00:00.000Z', archivedAt: '', persistedAt: '2026-04-15T12:00:00.000Z' },
    },
  });

  assert.equal(viewModel.explicit.count, 3);
  assert.equal(viewModel.books.enabledCount, 2);
  assert.equal(viewModel.ledger.topicCount, 1);
  assert.equal(viewModel.backgroundVectorization.status, 'applied');
  assert.equal(viewModel.backgroundVectorization.sourceSessionId, 'thread-demo');
  assert.equal(viewModel.backgroundVectorization.eagerEmbeddingCount, 4);
  assert.equal(viewModel.backgroundVectorization.backgroundCandidateCount, 2);
  assert.equal(viewModel.matchedBooks.length, 1);
  assert.equal(viewModel.compression.used, true);
  assert.equal(viewModel.compression.explanation.selectedSignals[0], 'active-contradiction');
  assert.equal(viewModel.activeContradictions.length, 1);
  assert.equal(viewModel.routing.selectedLane, 'tool');
  assert.equal(viewModel.queue.length, 1);
  assert.equal(viewModel.session.recencyProtection.protectedEpisodeCount, 6);
  assert.equal(viewModel.session.sessionId, 'thread-demo');
  assert.equal(viewModel.recentAuditTrail.length, 1);
  assert.equal(viewModel.recentAuditTrail[0].promptTruth.channels.sessionArchive.heldBackReason, 'canon-priority-suppression');
  assert.equal(viewModel.queue[0].promotionPacket.sourceThreadId, 'thread-demo');
  assert.equal(viewModel.artifact.version, 'penny-runtime-artifact.v1');
  assert.equal(viewModel.artifact.modelAdvisory.promptComposition.filledSlotCount, 3);
  assert.equal(viewModel.artifact.modelAdvisory.approximatePath.policyMode, 'deterministic-priority');
  assert.equal(viewModel.artifact.modelAdvisory.reasoningPolicy.mode, 'verifier-first');
  assert.equal(viewModel.artifact.trace.reasoningPolicy.executionPreference, 'verifier-first');
  assert.equal(viewModel.artifact.modelAdvisory.advisoryMerge.mergeBasis[0], 'active-contradiction');
  assert.equal(viewModel.runtime.readiness.warmState, 'warm');
  assert.equal(viewModel.runtime.performance.semanticProbe.source, 'semantic-memory-status');
  assert.equal(viewModel.retrieval.session[0].sourceLabel, 'archive-session');
  assert.equal(viewModel.artifact.epistemics.stance, 'refuse');
  assert.equal(viewModel.artifact.synthesis.generated, true);
});

test('renderMemoryInspector exposes runtime artifact evidence sources and tool labels', async () => {
  const { renderMemoryInspector } = await helpersPromise;
  const els = {
    memoryInspectorPanel: {
      className: '',
      textContent: '',
      innerHTML: '',
    },
  };

  renderMemoryInspector({
    els,
    inspector: {
      sessionId: 'demo',
      explicit: { count: 1 },
      archive: {
        session: {
          episodeCount: 1,
          chapterCount: 0,
          lastArchivedAt: '2026-04-15T12:00:01.050Z',
          recencyProtection: {
            enabled: true,
            protectedEpisodeCount: 4,
            protectedEpisodeIds: ['episode-11', 'episode-12'],
          },
          lastRetrieval: {
            session: [],
            global: [],
            compression: { used: false, chapters: [] },
          },
          recentAuditTrail: [
            {
              turnId: 'turn-audit-1',
              usedAt: '2026-04-15T12:00:00.000Z',
              userTextExcerpt: 'What tea do I like again?',
              selectedLane: 'chat',
              requestedMode: 'local',
              executionPath: 'llm-chat',
              retrieval: {
                mode: 'keyword',
                reasonCode: 'keyword_fallback',
                selectedSessionIds: ['session-1'],
                selectedGlobalIds: [],
                selectedBookIds: [],
                selectedLedgerIds: ['path-package-json'],
                renderedSessionIds: [],
                renderedGlobalIds: [],
                renderedBookIds: [],
                renderedLedgerIds: [],
                compression: { used: false },
                semanticReady: false,
                semanticDowngrade: false,
              },
              promptTruth: {
                channels: {
                  stableFacts: { candidateCount: 1, renderedCount: 1, heldBackReason: '' },
                  memoryBooks: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
                  sessionArchive: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
                  globalArchive: { candidateCount: 0, renderedCount: 0, heldBackReason: '' },
                  researchLedger: { candidateCount: 1, renderedCount: 0, heldBackReason: 'canon-priority-suppression' },
                },
              },
              artifactSummary: {
                kind: 'chat-turn',
                authority: { reply: 'explicit-canonical' },
                approximatePath: { status: 'exact' },
                researchLedgerRendered: false,
                researchLedgerPromptInjected: false,
              },
              researchLedger: {
                updateStatus: 'skipped',
                topicId: 'path-package-json',
                topicLabel: 'package.json',
              },
            },
          ],
          activeContradictions: [],
        },
        global: {
          patternCount: 0,
          promotionQueue: [{
            id: 'queue-1',
            text: 'Favorite tea is lapsang',
            evidenceCount: 2,
            confidence: 0.82,
            promotionPacket: {
              sourceThreadId: 'thread-demo',
              sourceTurnIds: ['turn-1', 'turn-2'],
              temporalScope: { label: 'current' },
            },
          }],
        },
      },
      memoryBooks: {
        enabledCount: 0,
        matchedBooks: [],
      },
      embeddings: {
        semanticMemory: {
          ready: true,
          configuredModel: 'text-embedding-nomic-embed-text-v1.5',
        },
        backgroundVectorization: {
          status: 'applied',
          attemptedAt: '2026-04-15T12:00:01.000Z',
          sourceSessionId: 'demo',
          semanticReady: true,
          archivePending: true,
          batchLimit: 2,
          eagerEmbeddingCount: 4,
          eagerCreatedCount: 2,
          backgroundCandidateCount: 2,
          backgroundCreatedCount: 1,
        },
      },
      ledger: {
        topicCount: 1,
        openCount: 1,
        provisionalCount: 0,
        settledCount: 0,
        context: {
          topics: [
            {
              topicId: 'path-package-json',
              topicLabel: 'package.json',
              identity: {
                kind: 'anchored-question',
                anchorType: 'project-path',
                anchorRef: 'package.json',
                scopeLabel: 'vitest migration',
              },
              status: 'open',
              sourceClass: 'verified-evidence',
              summaryClass: 'question-carryover',
              summary: 'open follow-up - verify the vitest migration.',
              evidenceRefs: [{ ref: 'package.json' }],
              summaryEvidenceRefs: [{ ref: 'package.json' }],
              openFollowUps: ['verify the vitest migration'],
              sourceSessionIds: ['qa-ledger'],
              sourceTurnIds: ['qa-ledger:turn-1'],
            },
          ],
        },
        recentTopics: [],
      },
      routing: {
        selectedLane: 'tool',
        requestedMode: 'local',
        backend: 'local-lmstudio-tools',
        repair: null,
      },
      runtime: {
        readiness: {
          chatModelReady: true,
          toolModelReady: true,
          embeddingReady: true,
          fallbackActive: false,
          warmState: 'warm',
          checkedAt: '2026-04-15T11:59:59.000Z',
          cacheAgeMs: 9000,
          cacheExpiresAt: '2026-04-15T12:00:29.000Z',
          cacheHit: true,
        },
        performance: {
          latencyClass: 'tool-heavy',
          request: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 1200, available: true, cacheHit: false, source: 'route-handler', note: '' },
          promptAssembly: { startedAt: '2026-04-15T12:00:00.010Z', finishedAt: '2026-04-15T12:00:00.120Z', durationMs: 110, available: true, cacheHit: false, source: 'prompt-builder', note: '' },
          archiveRetrieval: { startedAt: '2026-04-15T12:00:00.120Z', finishedAt: '2026-04-15T12:00:00.300Z', durationMs: 180, available: true, cacheHit: false, source: 'archive-memory', note: '', sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'direct-inspect' },
          semanticRender: { startedAt: '', finishedAt: '', durationMs: 0, available: false, cacheHit: false, source: '', note: '', attempted: false, used: false },
          modelResolution: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:00.005Z', durationMs: 5, available: true, cacheHit: true, source: 'lmstudio-status', note: '' },
          semanticProbe: { startedAt: '2026-04-15T12:00:00.005Z', finishedAt: '2026-04-15T12:00:00.015Z', durationMs: 10, available: true, cacheHit: true, source: 'semantic-memory-status', note: '' },
          firstToken: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:00.900Z', durationMs: 600, available: true, cacheHit: false, source: 'lmstudio-stream', note: '' },
          modelRoundTrip: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 900, available: true, cacheHit: false, source: 'lmstudio-stream', note: '', transport: 'local-lmstudio' },
        },
      },
      artifact: {
        version: 'penny-runtime-artifact.v1',
        kind: 'tool-turn',
        scope: { sessionId: 'demo', route: '/api/penny/chat', requestedMode: 'local', selectedLane: 'tool' },
        authority: { reply: 'verified-tool-evidence', memory: 'explicit-canonical', archive: 'advisory', toolClaims: 'verified-required' },
        summary: { label: 'tool-turn', text: 'Tool lane reply with verified evidence.', backend: 'local-lmstudio-tools' },
        context: { backend: 'local-lmstudio-tools', requestedModel: 'google/gemma-4-e4b', resolvedModel: 'google/gemma-4-e4b', semanticMemoryReady: true, semanticMemoryMode: 'semantic', usedFallback: false, laneFallback: false, shadowEnabled: false },
      evidence: [{ type: 'tool', source: 'verified-tool', label: 'read_project_file', text: 'README.md', target: 'README.md' }],
      artifacts: [{ type: 'project-path', value: 'README.md' }],
      trace: {
        laneChoice: {
          requestedMode: 'local',
          selectedLane: 'tool',
          backend: 'local-lmstudio-tools',
          route: '/api/penny/chat',
          requestedModel: 'google/gemma-4-e4b',
          resolvedModel: 'google/gemma-4-e4b',
          usedFallback: false,
          laneFallback: false,
        },
        reasoningPolicy: {
          mode: 'verifier-first',
          sourceLatencyClass: 'tool-heavy',
          executionPreference: 'verifier-first',
          semanticQueryAllowed: false,
          archiveCompressionAllowed: false,
          verifierUsed: true,
          shortCircuitApplied: false,
          shortCircuitReason: '',
          reasonCodes: ['bounded-latency-policy', 'verified-tool-evidence'],
        },
        wakeHierarchy: [
          { layer: 'stable-facts', label: 'Explicit facts stay canonical', detail: 'Explicit memory remains authoritative.', status: 'authoritative', count: 1 },
          { layer: 'active-session', label: 'Active session context', detail: 'No session archive hits were selected for this turn.', status: 'empty', count: 0 },
        ],
        retrievalChannels: [
          { channel: 'archive-session', sourceId: 'session-1', sourceLabel: 'archive-session', score: 0.91, reason: 'direct-inspect', contradictionState: 'tracked', injected: true, scope: 'session', sourceEpisodeIds: ['episode-1'], snippet: 'Favorite tea is lapsang souchong now.' },
          { channel: 'archive-chapter', sourceId: 'chapter-1', sourceLabel: 'chapter', score: 0.48, reason: 'compression_low_retrieval_confidence', contradictionState: 'tracked', injected: false, scope: 'chapter', sourceEpisodeIds: ['episode-1', 'episode-2'] },
        ],
        contradictions: [
          { layer: 'contradiction', label: 'favorite tea', detail: 'Favorite tea is lapsang souchong', status: 'active', count: 1 },
        ],
        openQuestions: [
          { layer: 'open-question', label: 'open', detail: 'Check whether the red glove is still on dryer three', status: 'open', count: 1 },
        ],
        ongoingInvestigations: [
          { layer: 'research-ledger', label: 'package.json', detail: 'open follow-up - verify the vitest migration.', status: 'open', count: 1 },
        ],
        evidenceAccepted: [
          { type: 'route', channel: 'runtime', label: 'local/tool', detail: 'local-lmstudio-tools', status: 'selected' },
          { type: 'tool', channel: 'verified-tool', label: 'read_project_file', detail: 'README.md', status: 'verified' },
        ],
        evidenceRejected: [
          { type: 'retrieval', channel: 'archive-chapter', label: 'chapter', detail: 'compression_low_retrieval_confidence', status: 'held-back' },
        ],
        qaValidity: { active: false, verdict: 'n/a', reasons: [] },
      },
      provenance: {
        retrieval: [
          { channel: 'archive-session', sourceId: 'session-1', sourceLabel: 'archive-session', score: 0.91, reason: 'direct-inspect', contradictionState: 'tracked', injected: true, scope: 'session', sourceEpisodeIds: ['episode-1'], snippet: 'Favorite tea is lapsang souchong now.' },
          { channel: 'research-ledger', sourceId: 'path-package-json', sourceLabel: 'package.json', score: 1, reason: 'research-continuity-ledger', contradictionState: 'none', injected: true, scope: 'research-ledger', sourceSessionIds: ['qa-ledger'], sourceTurnIds: ['qa-ledger:turn-1'], evidenceRefs: [{ ref: 'package.json' }], snippet: 'open follow-up - verify the vitest migration.' },
        ],
        contradictions: [
          { layer: 'contradiction', label: 'favorite tea', detail: 'Favorite tea is lapsang souchong', status: 'active', count: 1 },
        ],
        openQuestions: [
          { layer: 'open-question', label: 'open', detail: 'Check whether the red glove is still on dryer three', status: 'open', count: 1 },
        ],
        ongoingInvestigations: [
          { layer: 'research-ledger', label: 'package.json', detail: 'open follow-up - verify the vitest migration.', status: 'open', count: 1 },
        ],
        acceptedEvidence: [
          { type: 'route', channel: 'runtime', label: 'local/tool', detail: 'local-lmstudio-tools', status: 'selected' },
          { type: 'tool', channel: 'verified-tool', label: 'read_project_file', detail: 'README.md', status: 'verified' },
        ],
        rejectedEvidence: [
          { type: 'retrieval', channel: 'archive-chapter', label: 'chapter', detail: 'compression_low_retrieval_confidence', status: 'held-back' },
        ],
      },
      sideEffects: [{ type: 'memory-persist', target: 'lastRoute', status: 'verified' }],
        reasonCodes: ['direct-inspect'],
        epistemics: { enabled: true, triggered: true, scope: 'tool', stance: 'refuse', signals: ['missing_tool_evidence'], note: 'Tool-backed claims need verified evidence before Penny presents them as done.' },
        synthesis: { enabled: true, generated: true, kind: 'archive-advisory-summary', scope: 'archive-advisory', summary: 'Correction in play: favorite tea is lapsang souchong, not oolong.', evidenceSources: ['correction'] },
        modelAdvisory: {
          mood: '',
          cleanup: {
            reasonCode: 'salvaged_draft_candidate',
            cleanupApplied: true,
            materialChange: true,
            reconstructedReply: true,
            usedReasoningFallback: true,
          },
          cleanupTransform: {
            class: 'salvage-reconstruction',
            scope: 'presentation-only',
            materiality: 'reconstructed',
            idempotent: true,
            operations: ['salvage-draft-candidate', 'fallback-to-reasoning'],
          },
          authorityPressure: {
            canonicalFactsPresent: true,
            canonicalOverrideActive: true,
            advisoryChannelsRendered: 2,
            advisoryItemsRendered: 2,
            advisoryChannelsInjected: 2,
            advisoryItemsInjected: 2,
            sameSessionAdvisoryItems: 1,
            crossSessionAdvisoryItems: 1,
          },
          promptComposition: {
            lane: 'tool',
            mode: 'local',
            eligibleSlotCount: 4,
            filledSlotCount: 3,
            heldBackSlotCount: 1,
            noOpSlotCount: 0,
            slots: [
              { id: 'voiceBlend', eligible: true, state: 'filled' },
              { id: 'directives', eligible: true, state: 'filled' },
              { id: 'examples', eligible: true, state: 'held-back' },
              { id: 'memory', eligible: true, state: 'filled' },
            ],
          },
          approximatePath: {
            status: 'bounded-approximate',
            latencyClass: 'tool-heavy',
            policyMode: 'deterministic-priority',
            reasons: ['bounded-latency-policy', 'semantic-query-held-back'],
          },
          reasoningPolicy: {
            mode: 'verifier-first',
            sourceLatencyClass: 'tool-heavy',
            executionPreference: 'verifier-first',
            semanticQueryAllowed: false,
            archiveCompressionAllowed: false,
            verifierUsed: true,
            shortCircuitApplied: false,
            shortCircuitReason: '',
            reasonCodes: ['bounded-latency-policy', 'verified-tool-evidence'],
          },
          advisoryMerge: {
            advisoryItems: 2,
            lossyItems: 1,
            reviewGatedItems: 0,
            mergeBasis: ['active-contradiction'],
            discardedDetailSummary: ['episode-level detail omitted'],
          },
          repair: null,
          shadowError: '',
          toolsUsed: [{ name: 'read_project_file', label: 'read README.md', ok: true }],
        },
        performance: {
          latencyClass: 'tool-heavy',
          request: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 1200, available: true, cacheHit: false, source: 'route-handler', note: '' },
          promptAssembly: { startedAt: '2026-04-15T12:00:00.010Z', finishedAt: '2026-04-15T12:00:00.120Z', durationMs: 110, available: true, cacheHit: false, source: 'prompt-builder', note: '' },
          archiveRetrieval: { startedAt: '2026-04-15T12:00:00.120Z', finishedAt: '2026-04-15T12:00:00.300Z', durationMs: 180, available: true, cacheHit: false, source: 'archive-memory', note: '', sessionItems: 1, globalItems: 0, semanticReady: true, reasonCode: 'direct-inspect' },
          semanticRender: { startedAt: '', finishedAt: '', durationMs: 0, available: false, cacheHit: false, source: '', note: '', attempted: false, used: false },
          modelResolution: { startedAt: '2026-04-15T12:00:00.000Z', finishedAt: '2026-04-15T12:00:00.005Z', durationMs: 5, available: true, cacheHit: true, source: 'lmstudio-status', note: '' },
          semanticProbe: { startedAt: '2026-04-15T12:00:00.005Z', finishedAt: '2026-04-15T12:00:00.015Z', durationMs: 10, available: true, cacheHit: true, source: 'semantic-memory-status', note: '' },
          firstToken: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:00.900Z', durationMs: 600, available: true, cacheHit: false, source: 'lmstudio-stream', note: '' },
          modelRoundTrip: { startedAt: '2026-04-15T12:00:00.300Z', finishedAt: '2026-04-15T12:00:01.200Z', durationMs: 900, available: true, cacheHit: false, source: 'lmstudio-stream', note: '', transport: 'local-lmstudio' },
        },
        readiness: {
          chatModelReady: true,
          toolModelReady: true,
          embeddingReady: true,
          fallbackActive: false,
          warmState: 'warm',
          checkedAt: '2026-04-15T11:59:59.000Z',
          cacheAgeMs: 9000,
          cacheExpiresAt: '2026-04-15T12:00:29.000Z',
          cacheHit: true,
        },
        timestamps: { usedAt: '2026-04-15T12:00:00.000Z', archivedAt: '', persistedAt: '2026-04-15T12:00:00.000Z' },
      },
    },
  });

  assert.match(els.memoryInspectorPanel.innerHTML, /verified-tool/);
  assert.match(els.memoryInspectorPanel.innerHTML, /read README\.md/);
  assert.match(els.memoryInspectorPanel.innerHTML, /project-path: README\.md/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Epistemic caution:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Archive synthesis:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Latency class:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Readiness:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Visible reply cleanup:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /reconstructed from reasoning spill/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Cleanup transform:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /salvage-reconstruction/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Authority pressure:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /canon present/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /advisory rendered 2 item\(s\) across 2 channel\(s\)/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /same session rendered 1 \| cross session rendered 1/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Prompt composition:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /voiceBlend:filled/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Reasoning policy:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /preference verifier-first/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Approximate path:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /deterministic-priority/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Advisory merge:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /basis active-contradiction/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /tool-heavy/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Background vectorization/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Background vectors: <strong>applied/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /archive update still pending/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /source this session/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /selected 2/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Last archived 2026-04-15T12:00:01\.050Z/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Trace artifact/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Trace provenance/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Research continuity ledger/);
  assert.match(els.memoryInspectorPanel.innerHTML, /package\.json/);
  assert.match(els.memoryInspectorPanel.innerHTML, /scope vitest migration/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /episodes episode-1/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /turns qa-ledger:turn-1/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Evidence refs: package\.json/);
  assert.match(els.memoryInspectorPanel.innerHTML, /source verified-evidence/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /summary question-carryover/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Summary refs: package\.json/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Wake hierarchy/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Trace reasoning:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /mode verifier-first/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Retrieval channels: 2/);
  assert.match(els.memoryInspectorPanel.innerHTML, /archive-session:rendered:archive-session/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /archive-chapter:not-rendered:chapter/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Evidence accepted: 2/);
  assert.match(els.memoryInspectorPanel.innerHTML, /accepted 2 .* not rendered 1/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Check whether the red glove is still on dryer three/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Recency protection/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Recent audit trail/);
  assert.match(els.memoryInspectorPanel.innerHTML, /canon-priority-suppression/);
  assert.match(els.memoryInspectorPanel.innerHTML, /session selected 1 rendered 0/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /ledger selected 1 rendered 0/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /ledger held back/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /post-reply update skipped/i);
  assert.doesNotMatch(els.memoryInspectorPanel.innerHTML, /supported the reply/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Protected ids:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /thread thread-demo/i);
});

test('renderMemoryInspector shows when background vectorization status came from another session', async () => {
  const { renderMemoryInspector } = await helpersPromise;
  const els = {
    memoryInspectorPanel: {
      className: '',
      textContent: '',
      innerHTML: '',
    },
  };

  renderMemoryInspector({
    els,
    inspector: {
      sessionId: 'demo',
      explicit: { count: 0 },
      archive: {
        session: {
          episodeCount: 0,
          chapterCount: 0,
          lastArchivedAt: '2026-04-15T12:00:01.050Z',
          recencyProtection: { enabled: false, protectedEpisodeCount: 0, protectedEpisodeIds: [] },
          lastRetrieval: { session: [], global: [], compression: { used: false, chapters: [] } },
          activeContradictions: [],
        },
        global: {
          patternCount: 0,
          promotionQueue: [],
        },
      },
      memoryBooks: { enabledCount: 0, matchedBooks: [] },
      embeddings: {
        semanticMemory: {
          ready: true,
          configuredModel: 'text-embedding-nomic-embed-text-v1.5',
        },
        backgroundVectorization: {
          status: 'skipped',
          attemptedAt: '2026-04-15T12:00:01.000Z',
          sourceSessionId: 'other-session',
          semanticReady: true,
          archivePending: false,
          batchLimit: 2,
          eagerEmbeddingCount: 0,
          eagerCreatedCount: 0,
          backgroundCandidateCount: 0,
          backgroundCreatedCount: 0,
        },
      },
      ledger: { topicCount: 0, openCount: 0, provisionalCount: 0, settledCount: 0, context: { topics: [] }, recentTopics: [] },
      routing: { selectedLane: 'chat', requestedMode: 'local', backend: 'local-lmstudio-chat', repair: null },
      runtime: { readiness: {}, performance: {} },
      artifact: null,
    },
  });

  assert.match(els.memoryInspectorPanel.innerHTML, /source other-session/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /No archive memories were retrieved for the last reply\./i);
});

test('buildBrainModeNote keeps local, shadow, and fallback explanations stable', async () => {
  const { buildBrainModeNote } = await helpersPromise;

  assert.match(buildBrainModeNote({ mode: 'local', meta: null }), /LM Studio is Penny's main brain/i);
  assert.match(buildBrainModeNote({
    mode: 'local',
    meta: { requestedMode: 'local', localLane: 'tool', resolvedModel: 'google/gemma-4-e4b', laneFallback: true },
  }), /tool lane/i);
  assert.match(buildBrainModeNote({
    mode: 'shadow',
    meta: { requestedMode: 'shadow', usedFallback: true, shadowError: 'boom' },
  }), /Shadow failed/i);
});

test('renderMemoryInspector surfaces execution path and ledger prompt/update truth fields', async () => {
  const { renderMemoryInspector } = await helpersPromise;
  const els = {
    memoryInspectorPanel: {
      className: '',
      textContent: '',
      innerHTML: '',
    },
  };

  renderMemoryInspector({
    els,
    inspector: {
      explicit: { count: 0 },
      archive: {
        session: {
          episodeCount: 0,
          chapterCount: 0,
          recencyProtection: { enabled: false, protectedEpisodeCount: 0, protectedEpisodeIds: [] },
          lastRetrieval: {
            session: [],
            global: [],
            compression: { used: false, chapters: [] },
          },
          activeContradictions: [],
        },
        global: {
          patternCount: 0,
          promotionQueue: [],
        },
      },
      memoryBooks: {
        enabledCount: 0,
        matchedBooks: [],
      },
      embeddings: {
        semanticMemory: {
          ready: true,
          configuredModel: 'text-embedding-nomic-embed-text-v1.5',
        },
      },
      ledger: {
        topicCount: 1,
        openCount: 1,
        provisionalCount: 0,
        settledCount: 0,
        context: {
          topics: [
            {
              topicId: 'path-package-json',
              topicLabel: 'package.json',
              status: 'open',
              sourceClass: 'question-followup',
              summaryClass: 'question-carryover',
              summary: 'open follow-up - verify whether the Vitest migration is still pending.',
            },
          ],
        },
      },
      routing: {
        selectedLane: 'tool',
        requestedMode: 'local',
        backend: 'local-lmstudio-tools',
      },
      runtime: {
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
          request: { available: true, durationMs: 10 },
          promptAssembly: { available: true, durationMs: 10 },
          archiveRetrieval: { available: true, durationMs: 10, sessionItems: 0, globalItems: 0, semanticReady: true, reasonCode: '' },
          semanticRender: { available: false, attempted: false, used: false },
          modelResolution: { available: true },
          semanticProbe: { available: true },
          firstToken: { available: false },
          modelRoundTrip: { available: false, durationMs: 0, transport: '' },
        },
      },
      artifact: {
        version: 'penny-runtime-artifact.v1',
        kind: 'tool-turn',
        executionPath: 'deterministic-tool',
        researchLedgerRendered: false,
        researchLedgerPromptInjected: false,
        researchLedgerUpdate: {
          status: 'applied',
          reason: 'updated',
          topicId: 'path-package-json',
          topicLabel: 'package.json',
        },
        scope: { sessionId: 'demo', route: '/api/penny/chat', requestedMode: 'local', selectedLane: 'tool' },
        authority: { reply: 'verified-tool-evidence', memory: 'explicit-canonical', archive: 'advisory', toolClaims: 'verified-required' },
        summary: { label: 'tool-turn', text: 'Tool lane reply with verified evidence.', backend: 'local-lmstudio-tools' },
        context: { backend: 'local-lmstudio-tools', requestedModel: 'google/gemma-4-e4b', resolvedModel: '', executionPath: 'deterministic-tool', semanticMemoryReady: true, semanticMemoryMode: 'semantic', usedFallback: false, laneFallback: false, shadowEnabled: false },
        evidence: [{ type: 'tool', source: 'verified-tool', label: 'read_project_file', text: 'README.md', target: 'README.md' }],
        artifacts: [],
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
        trace: {
          laneChoice: {
            requestedMode: 'local',
            selectedLane: 'tool',
            backend: 'local-lmstudio-tools',
            route: '/api/penny/chat',
            requestedModel: 'google/gemma-4-e4b',
            resolvedModel: '',
            executionPath: 'deterministic-tool',
            usedFallback: false,
            laneFallback: false,
            researchLedgerRendered: false,
            researchLedgerPromptInjected: false,
            researchLedgerUpdateStatus: 'applied',
          },
          reasoningPolicy: {
            mode: 'verifier-first',
            sourceLatencyClass: 'tool-heavy',
            executionPreference: 'verifier-first',
            semanticQueryAllowed: false,
            archiveCompressionAllowed: false,
            verifierUsed: true,
            shortCircuitApplied: true,
            shortCircuitReason: 'semantic-render-held-back',
            reasonCodes: ['semantic-render-held-back', 'deterministic-tool'],
          },
          wakeHierarchy: [],
          retrievalChannels: [],
          contradictions: [],
          openQuestions: [],
          ongoingInvestigations: [],
          evidenceAccepted: [],
          evidenceRejected: [],
          qaValidity: { active: false, verdict: 'n/a', reasons: [] },
        },
        provenance: {
          retrieval: [],
          contradictions: [],
          openQuestions: [],
          ongoingInvestigations: [],
          acceptedEvidence: [],
          rejectedEvidence: [],
        },
        sideEffects: [{ type: 'research-ledger-update', target: 'package.json', status: 'applied' }],
        reasonCodes: ['direct-inspect'],
        epistemics: { enabled: false, triggered: false, scope: 'tool', stance: 'answer', signals: [], note: '' },
        synthesis: { enabled: false, generated: false, kind: '', scope: '', summary: '', evidenceSources: [] },
        modelAdvisory: {
          mood: '',
          cleanup: {
            reasonCode: 'none',
            cleanupApplied: false,
            materialChange: false,
            reconstructedReply: false,
            usedReasoningFallback: false,
          },
          authorityPressure: {
            canonicalFactsPresent: false,
            canonicalOverrideActive: false,
            advisoryChannelsRendered: 0,
            advisoryItemsRendered: 0,
            advisoryChannelsInjected: 0,
            advisoryItemsInjected: 0,
            sameSessionAdvisoryItems: 0,
            crossSessionAdvisoryItems: 0,
          },
          reasoningPolicy: {
            mode: 'verifier-first',
            sourceLatencyClass: 'tool-heavy',
            executionPreference: 'verifier-first',
            semanticQueryAllowed: false,
            archiveCompressionAllowed: false,
            verifierUsed: true,
            shortCircuitApplied: true,
            shortCircuitReason: 'semantic-render-held-back',
            reasonCodes: ['semantic-render-held-back', 'deterministic-tool'],
          },
          repair: null,
          shadowError: '',
          toolsUsed: [],
        },
        performance: {
          latencyClass: 'tool-heavy',
          request: { available: true, durationMs: 10 },
          promptAssembly: { available: true, durationMs: 10 },
          archiveRetrieval: { available: true, durationMs: 10, sessionItems: 0, globalItems: 0, semanticReady: true, reasonCode: '' },
          semanticRender: { available: false, attempted: false, used: false },
          modelResolution: { available: true },
          semanticProbe: { available: true },
          firstToken: { available: false },
          modelRoundTrip: { available: false, durationMs: 0, transport: '' },
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
        timestamps: { usedAt: '2026-04-16T12:00:00.000Z', archivedAt: '', persistedAt: '2026-04-16T12:00:00.000Z' },
      },
    },
  });

  assert.match(els.memoryInspectorPanel.innerHTML, /Execution <strong>deterministic-tool/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Model not used/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Reasoning policy: <strong>verifier-first/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /short circuit semantic-render-held-back/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Trace reasoning: <strong>verifier-first/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Research ledger prompt: <strong>unknown/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Post-reply ledger update <strong>applied/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /Research-ledger prompt state is unknown for this turn\./i);
  assert.match(els.memoryInspectorPanel.innerHTML, /No archive memories were retrieved for the last reply\./i);
  assert.doesNotMatch(els.memoryInspectorPanel.innerHTML, /supported the reply/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /manual fallback final-before-write/i);
  assert.match(els.memoryInspectorPanel.innerHTML, /rescue manual non-tool-decision/i);
});
