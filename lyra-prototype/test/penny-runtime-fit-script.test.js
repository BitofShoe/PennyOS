const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildMarkdownSummary,
  normalizeScenarioSummary,
  parseRuntimeFitArgs,
} = require('../scripts/eval-penny-runtime-fit');

test('parseRuntimeFitArgs enables the cheap context-pressure fixture mode', () => {
  assert.equal(parseRuntimeFitArgs([]).contextPressureFixture, false);
  assert.equal(parseRuntimeFitArgs(['--context-pressure-fixture']).contextPressureFixture, true);
  assert.equal(parseRuntimeFitArgs(['--fixture-context-pressure']).contextPressureFixture, true);
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
  assert.equal(summary.turnMetrics.memoryHeavy.lane, 'chat');
  assert.equal(summary.turnMetrics.memoryHeavy.modelIdentity, 'q6');
  assert.equal(summary.turnMetrics.memoryHeavy.semanticReadiness.ready, true);
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
              estimatedPromptTokens: 42,
            },
          },
        },
      },
    ],
    contextPressureFixture: {
      schema: 'penny-context-pressure-memory-qa.v1',
      contextVariants: [{ level: 'short' }, { level: 'medium' }, { level: 'long' }],
      sourceSensitiveMemory: { cases: [{ id: 'case-1' }, { id: 'case-2' }] },
    },
    recommendations: {},
  });

  assert.match(markdown, /Context-Pressure Fixture/);
  assert.match(markdown, /Variants: short, medium, long/);
  assert.match(markdown, /Memory-heavy rendered context: 2 rendered \/ 3 selected/);
});
