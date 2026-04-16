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
        wakeHierarchy: [
          { layer: 'stable-facts', label: 'Explicit facts stay canonical', detail: 'Explicit memory remains authoritative.', status: 'authoritative', count: 1 },
          { layer: 'active-session', label: 'Active session context', detail: '1 session recall hit was available.', status: 'present', count: 1 },
        ],
        retrievalChannels: [
          { channel: 'archive-session', sourceId: 'session-1', sourceLabel: 'archive-session', score: 0.91, reason: 'direct-inspect', contradictionState: 'tracked', injected: true },
          { channel: 'archive-chapter', sourceId: 'chapter-1', sourceLabel: 'chapter', score: 0.48, reason: 'compression_low_retrieval_confidence', contradictionState: 'tracked', injected: false },
        ],
        contradictions: [
          { layer: 'contradiction', label: 'favorite tea', detail: 'Favorite tea is lapsang souchong', status: 'active', count: 1 },
        ],
        openQuestions: [
          { layer: 'open-question', label: 'open', detail: 'Check whether the red glove is still on dryer three', status: 'open', count: 1 },
        ],
        evidenceAccepted: [
          { type: 'route', channel: 'runtime', label: 'local/tool', detail: 'local-lmstudio-tools', status: 'selected' },
        ],
        evidenceRejected: [
          { type: 'retrieval', channel: 'archive-chapter', label: 'chapter', detail: 'compression_low_retrieval_confidence', status: 'held-back' },
        ],
        qaValidity: { active: false, verdict: 'n/a', reasons: [] },
      },
      sideEffects: [{ type: 'memory-persist', target: 'lastRoute', status: 'verified' }],
      reasonCodes: ['direct-inspect'],
      epistemics: { enabled: true, triggered: true, scope: 'tool', stance: 'refuse', signals: ['missing_tool_evidence'], note: 'Tool-backed claims need verified evidence before Penny presents them as done.' },
      synthesis: { enabled: true, generated: true, kind: 'archive-advisory-summary', scope: 'archive-advisory', summary: 'Correction in play: favorite tea is lapsang souchong, not oolong.', evidenceSources: ['correction'] },
      modelAdvisory: { mood: '', repair: null, shadowError: '', toolsUsed: [] },
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
  assert.equal(viewModel.matchedBooks.length, 1);
  assert.equal(viewModel.compression.used, true);
  assert.equal(viewModel.compression.explanation.selectedSignals[0], 'active-contradiction');
  assert.equal(viewModel.activeContradictions.length, 1);
  assert.equal(viewModel.routing.selectedLane, 'tool');
  assert.equal(viewModel.queue.length, 1);
  assert.equal(viewModel.session.recencyProtection.protectedEpisodeCount, 6);
  assert.equal(viewModel.queue[0].promotionPacket.sourceThreadId, 'thread-demo');
  assert.equal(viewModel.artifact.version, 'penny-runtime-artifact.v1');
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
      explicit: { count: 1 },
      archive: {
        session: {
          episodeCount: 1,
          chapterCount: 0,
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
        wakeHierarchy: [
          { layer: 'stable-facts', label: 'Explicit facts stay canonical', detail: 'Explicit memory remains authoritative.', status: 'authoritative', count: 1 },
          { layer: 'active-session', label: 'Active session context', detail: 'No session archive hits were selected for this turn.', status: 'empty', count: 0 },
        ],
        retrievalChannels: [
          { channel: 'archive-session', sourceId: 'session-1', sourceLabel: 'archive-session', score: 0.91, reason: 'direct-inspect', contradictionState: 'tracked', injected: true },
          { channel: 'archive-chapter', sourceId: 'chapter-1', sourceLabel: 'chapter', score: 0.48, reason: 'compression_low_retrieval_confidence', contradictionState: 'tracked', injected: false },
        ],
        contradictions: [
          { layer: 'contradiction', label: 'favorite tea', detail: 'Favorite tea is lapsang souchong', status: 'active', count: 1 },
        ],
        openQuestions: [
          { layer: 'open-question', label: 'open', detail: 'Check whether the red glove is still on dryer three', status: 'open', count: 1 },
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
      sideEffects: [{ type: 'memory-persist', target: 'lastRoute', status: 'verified' }],
        reasonCodes: ['direct-inspect'],
        epistemics: { enabled: true, triggered: true, scope: 'tool', stance: 'refuse', signals: ['missing_tool_evidence'], note: 'Tool-backed claims need verified evidence before Penny presents them as done.' },
        synthesis: { enabled: true, generated: true, kind: 'archive-advisory-summary', scope: 'archive-advisory', summary: 'Correction in play: favorite tea is lapsang souchong, not oolong.', evidenceSources: ['correction'] },
        modelAdvisory: { mood: '', repair: null, shadowError: '', toolsUsed: [{ name: 'read_project_file', label: 'read README.md', ok: true }] },
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
  assert.match(els.memoryInspectorPanel.innerHTML, /tool-heavy/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Trace artifact/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Wake hierarchy/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Retrieval channels: 2/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Evidence accepted: 2/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Check whether the red glove is still on dryer three/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Recency protection/);
  assert.match(els.memoryInspectorPanel.innerHTML, /Protected ids:/);
  assert.match(els.memoryInspectorPanel.innerHTML, /thread thread-demo/i);
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
