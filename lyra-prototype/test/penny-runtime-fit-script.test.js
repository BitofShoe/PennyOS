const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildGemmaRuntimeWatchRunnerArtifact,
  buildContextPressureFrameBudget,
  buildScenarioEnv,
  buildScenarioPaths,
  buildMarkdownSummary,
  normalizeScenarioSummary,
  parseRuntimeFitArgs,
  scenarioDisposableFiles,
} = require('../scripts/eval-penny-runtime-fit');

test('parseRuntimeFitArgs enables the cheap context-pressure fixture mode', () => {
  assert.equal(parseRuntimeFitArgs([]).contextPressureFixture, false);
  assert.equal(parseRuntimeFitArgs(['--context-pressure-fixture']).contextPressureFixture, true);
  assert.equal(parseRuntimeFitArgs(['--fixture-context-pressure']).contextPressureFixture, true);
  assert.equal(parseRuntimeFitArgs(['--gemma-runtime-watch']).gemmaRuntimeWatch, true);
  assert.equal(parseRuntimeFitArgs(['--runtime-watch-gemma']).gemmaRuntimeWatch, true);
});

test('normalizeScenarioSummary includes prompt-context pressure metrics for runtime turns', () => {
  const artifact = {
    executionPath: 'llm-chat',
    scope: { selectedLane: 'chat' },
    context: {
      resolvedModel: 'q6',
      semanticMemoryReady: true,
      semanticMemoryMode: 'semantic',
    },
    readiness: {
      embeddingReady: true,
      fallbackActive: false,
    },
    performance: {
      request: { durationMs: 2500 },
      firstToken: { durationMs: 450 },
      archiveRetrieval: { semanticReady: true, sessionItems: 1, globalItems: 1 },
    },
    promptTruth: {
      channels: {
        stableFacts: { candidateCount: 1, renderedCount: 1, candidateSourceIds: ['memory:tea'], renderedSourceIds: ['memory:tea'] },
        sessionArchive: { candidateCount: 2, renderedCount: 1, candidateSourceIds: ['s1', 's2'], renderedSourceIds: ['s1'] },
        globalArchive: { candidateCount: 1, renderedCount: 0, candidateSourceIds: ['g1'], renderedSourceIds: [], heldBackReason: 'canon-priority-suppression' },
      },
    },
  };

  const summary = normalizeScenarioSummary({
    status: { readiness: { embeddingReady: true, fallbackActive: false, warmState: 'warm' } },
    turns: {
      casualFirst: {
        seconds: 2.5,
        promptText: 'user: hi',
        text: 'hello',
        meta: { performance: { request: { durationMs: 2500 }, firstToken: { durationMs: 450 } } },
        artifact,
      },
      casualSteady: {},
      memoryHeavy: {
        seconds: 3,
        promptText: 'user: what is my favorite tea?',
        text: 'lapsang souchong',
        artifact,
      },
      toolHeavy: {},
    },
  });

  assert.equal(summary.firstTurnSeconds, 2.5);
  assert.equal(summary.firstTokenMs, 450);
  assert.equal(summary.turnMetrics.memoryHeavy.selectedMemoryCount, 4);
  assert.equal(summary.turnMetrics.memoryHeavy.renderedMemoryCount, 2);
  assert.equal(summary.turnMetrics.memoryHeavy.estimatedRequestMessageTokens > 0, true);
  assert.equal(summary.turnMetrics.memoryHeavy.estimatedPromptTokensScope, 'request-message-text');
  assert.equal(summary.turnMetrics.memoryHeavy.lane, 'chat');
  assert.equal(summary.turnMetrics.memoryHeavy.modelIdentity, 'q6');
  assert.equal(summary.turnMetrics.memoryHeavy.semanticReadiness.ready, true);
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.schema, 'penny-frame-budget.v1');
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.measurementMode, 'runtime-fit');
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.timings.lmStudioFirstTokenMs, 450);
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.timings.totalTurnMs, 3000);
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.workDone.candidatesSelected, 4);
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.workDone.candidatesRendered, 2);
  assert.equal(summary.turnMetrics.memoryHeavy.frameBudget.workDone.estimatedRequestMessageTokens > 0, true);
  assert.equal(summary.frameBudget.schema, 'penny-frame-budget.v1');
  assert.equal(summary.frameBudget.measurementMode, 'runtime-fit');
  assert.equal(summary.frameBudgetSummary.schema, 'penny-frame-budget-summary.v1');
});

test('buildMarkdownSummary exposes the Slice 4 context-pressure fixture summary', () => {
  const markdown = buildMarkdownSummary({
    generatedAt: '2026-04-21T12:00:00.000Z',
    defaults: {
      chatModel: 'q6',
      toolModel: 'e4b',
      embedModel: 'nomic',
    },
    baseUrl: 'http://127.0.0.1:4354',
    scenarios: [
      {
        slug: 'baseline',
        label: 'Baseline',
        config: { chatContextLength: 10000, embedModel: 'nomic' },
        summary: {
          semanticReady: true,
          firstTurnSeconds: 1,
          steadyStateSeconds: 1,
          memoryTurnSeconds: 1,
          toolTurnSeconds: 1,
          firstTokenMs: 10,
          readiness: { warmState: 'warm' },
          turnMetrics: {
            memoryHeavy: {
              renderedMemoryCount: 2,
              selectedMemoryCount: 3,
              estimatedRequestMessageTokens: 42,
              estimatedPromptTokens: 42,
            },
          },
        },
      },
    ],
    contextPressureFixture: {
      schema: 'penny-context-pressure-memory-qa.v1',
      measurementMode: 'fixture-only',
      liveModelCalls: false,
      liveAnswerDriftMeasured: false,
      contextVariants: [{ level: 'short' }, { level: 'medium' }, { level: 'long' }],
      sourceSensitiveMemory: { cases: [{ id: 'case-1' }, { id: 'case-2' }] },
      candidateSurvivalCorrelation: {
        measurementMode: 'fixture-only',
        liveModelCalls: false,
        liveAnswerDriftMeasured: false,
        candidateSurvival: { selectionVerdict: 'not-run' },
        contextPressure: {
          renderedMemoryCountDelta: 0,
          estimatedPromptTokenDelta: 0,
          answerDrift: 'not-run',
        },
        latency: {
          firstTokenLatencyDeltaMs: null,
          totalLatencyDeltaMs: null,
        },
      },
    },
    recommendations: {},
  });

  assert.match(markdown, /Context-Pressure Fixture/);
  assert.match(markdown, /Mode: fixture-only/);
  assert.match(markdown, /Live answer drift measured: no/);
  assert.match(markdown, /Variants: short, medium, long/);
  assert.match(markdown, /Candidate-survival correlation: fixture-only, selection=not-run, rendered delta=0, estimated token delta=0, drift=not-run/);
  assert.match(markdown, /Memory-heavy rendered context: 2 rendered \/ 3 selected/);
  assert.match(markdown, /Memory-heavy estimated request-message tokens: 42/);
});

test('buildContextPressureFrameBudget keeps fixture-only latency fields null while counting rendered context', () => {
  const frameBudget = buildContextPressureFrameBudget({
    generatedAt: '2026-04-22T12:00:00.000Z',
    contextVariants: [
      { level: 'short', selectedMemoryCount: 1, renderedMemoryCount: 1, estimatedPromptTokens: 20 },
      { level: 'medium', selectedMemoryCount: 3, renderedMemoryCount: 3, estimatedPromptTokens: 70 },
      { level: 'long', selectedMemoryCount: 7, renderedMemoryCount: 7, estimatedPromptTokens: 150 },
    ],
    comparisons: [
      { estimatedPromptTokenDelta: 50 },
      { estimatedPromptTokenDelta: 80 },
    ],
    candidateSurvivalCorrelation: {
      candidateSurvival: { selectionVerdict: 'not-run' },
    },
  });

  assert.equal(frameBudget.schema, 'penny-frame-budget.v1');
  assert.equal(frameBudget.measurementMode, 'fixture-only');
  assert.equal(frameBudget.timings.lmStudioFirstTokenMs, null);
  assert.equal(frameBudget.timings.totalTurnMs, null);
  assert.equal(frameBudget.workDone.rawCandidatesInspected, 11);
  assert.equal(frameBudget.workDone.candidatesRendered, 11);
  assert.equal(frameBudget.workDone.estimatedPromptTokens, 150);
  assert.equal(frameBudget.quality.candidateSurvival, 'not-run');
  assert.equal(frameBudget.quality.promptTokenDelta, 80);
});

test('runtime-fit disposable environment isolates the memory ledger file', () => {
  const paths = buildScenarioPaths('unit-ledger');
  const env = buildScenarioEnv(
    { embedModel: 'nomic' },
    paths,
    { PENNY_LOCAL_LLM_TRANSPORT: 'responses' },
  );
  const disposableFiles = scenarioDisposableFiles(paths);

  assert.match(paths.ledgerFile, /penny-memory-ledger\.runtime-fit-unit-ledger\./);
  assert.equal(env.PENNY_MEMORY_FILE, paths.memoryFile);
  assert.equal(env.PENNY_MEMORY_ARCHIVE_FILE, paths.archiveFile);
  assert.equal(env.PENNY_MEMORY_EMBEDDINGS_FILE, paths.embeddingsFile);
  assert.equal(env.PENNY_MEMORY_BOOKS_FILE, paths.booksFile);
  assert.equal(env.PENNY_MEMORY_LEDGER_FILE, paths.ledgerFile);
  assert.equal(env.PENNY_OPEN_LOOP_FILE, paths.openLoopFile);
  assert.equal(env.PENNY_LOCAL_LLM_TRANSPORT, 'responses');
  assert.equal(disposableFiles.includes(paths.ledgerFile), true);
  assert.equal(disposableFiles.includes(paths.openLoopFile), true);
});

test('Gemma runtime watch runner artifact is status/preflight only', () => {
  const artifact = buildGemmaRuntimeWatchRunnerArtifact({
    generatedAt: '2026-04-21T12:00:00.000Z',
    preflightReport: {
      ok: true,
      checks: [{ name: 'lmstudio-api', ok: true, level: 'pass', detail: 'reachable' }],
      loadedModels: ['unsloth/gemma-4-31b-it@q6_k'],
      installedModels: ['unsloth/gemma-4-31b-it@q6_k', 'google/gemma-4-e4b'],
      readinessSummary: { state: 'ready' },
      report: {
        requestedChatModel: 'google/gemma-4-31b',
        semanticMemoryReady: false,
      },
      status: {
        localTransport: 'stateful',
        resolvedChatModel: 'unsloth/gemma-4-31b-it@q6_k',
      },
    },
  });

  assert.equal(artifact.schema, 'penny-gemma-runtime-watch.v1');
  assert.equal(artifact.measurementMode, 'status-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.runner.liveChatGenerationRequired, false);
  assert.equal(artifact.runner.changesLoadedModel, false);
  assert.equal(artifact.runner.changesThinkingDefault, false);
  assert.equal(artifact.runner.changesContextLength, false);
  assert.equal(artifact.runner.touchesMemoryFiles, false);
  assert.equal(artifact.readOnlyChecks.preflight.ok, true);
  assert.equal(artifact.readOnlyChecks.preflight.installedModelCount, 2);
  assert.equal(artifact.watchItems.visionBudget.exposed, false);
  assert.equal(artifact.watchItems.visionBudget.adoptionStatus, 'not-adopted');
  assert.equal(artifact.watchItems.thinkingControls.defaultForCompanionChat, 'off');
  assert.equal(artifact.defaultsUnchanged.chatSamplingChanged, false);
  assert.equal(artifact.watchItems.loadedModelIdentity.compatibleMatch, true);
});
