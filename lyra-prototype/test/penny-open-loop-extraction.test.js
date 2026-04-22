const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPEN_LOOP_EXTRACTION_SCHEMA,
  extractOpenLoopSuggestionFromText,
  extractOpenLoopSuggestions,
} = require('../lib/penny-open-loop-extraction');
const {
  OPEN_LOOP_STATUSES,
} = require('../lib/penny-open-loops');

const NOW = '2026-04-22T12:00:00.000Z';

test('extracts advisory suggestions from controlled session and reflection fixtures', () => {
  const result = extractOpenLoopSuggestions({
    now: NOW,
    artifacts: [
      {
        type: 'reflection',
        id: 'reflection-static-1',
        path: 'output/reflections/static.json',
        text: 'Static live-advisory is halfway done; next risk is correction guardrails.',
      },
      {
        type: 'session',
        id: 'session-gemma-1',
        text: 'Gemma watch landed; no follow-up unless LM Studio exposes vision budget.',
      },
      {
        type: 'reflection',
        id: 'reflection-extraction-1',
        text: 'Deterministic extraction deferred until concrete document use case.',
      },
    ],
  });

  assert.equal(result.schema, OPEN_LOOP_EXTRACTION_SCHEMA);
  assert.equal(result.generatedAt, NOW);
  assert.equal(result.summary.suggestionCount, 3);
  assert.equal(result.openLoopSuggestions.length, 3);

  const [staticLoop, gemmaLoop, extractionLoop] = result.openLoopSuggestions;
  assert.equal(staticLoop.id, 'static-live-advisory');
  assert.equal(staticLoop.status, OPEN_LOOP_STATUSES.IN_PROGRESS);
  assert.equal(staticLoop.authority, 'advisory');
  assert.equal(staticLoop.confidence, 'medium');
  assert.equal(staticLoop.nextLikelyStep, 'Correction guardrails');
  assert.deepEqual(staticLoop.sourceRefs[0], {
    type: 'reflection',
    id: 'reflection-static-1',
    path: 'output/reflections/static.json',
    label: 'reflection',
    note: 'open-loop fixture extraction',
  });
  assert.equal(staticLoop.source.excerpt, 'Static live-advisory is halfway done; next risk is correction guardrails.');
  assert.equal(staticLoop.extraction.statusSignal, 'in-progress-signal');

  assert.equal(gemmaLoop.id, 'gemma-watch');
  assert.equal(gemmaLoop.status, OPEN_LOOP_STATUSES.COMPLETED);
  assert.equal(gemmaLoop.confidence, 'high');
  assert.equal(gemmaLoop.surfacePolicy.mode, 'manual-only');
  assert.equal(gemmaLoop.surfacePolicy.maxSurfaceCount, 0);
  assert.equal(gemmaLoop.nextLikelyStep, 'No follow-up unless LM Studio exposes vision budget');

  assert.equal(extractionLoop.id, 'deterministic-extraction');
  assert.equal(extractionLoop.status, OPEN_LOOP_STATUSES.DEFERRED);
  assert.match(extractionLoop.nextLikelyStep, /Concrete document use case/);
});

test('extracts nested reflection artifact text without requiring a live state write', () => {
  const result = extractOpenLoopSuggestions({
    now: NOW,
    artifacts: [
      {
        sourceType: 'reflection',
        artifactId: 'artifact-nested-1',
        reflection: {
          summary: 'Open-loop prompt bridge is pending; next step is build the fixture bridge before live wiring.',
        },
      },
    ],
  });

  assert.equal(result.openLoopSuggestions.length, 1);
  assert.equal(result.openLoopSuggestions[0].id, 'open-loop-prompt-bridge');
  assert.equal(result.openLoopSuggestions[0].status, OPEN_LOOP_STATUSES.IN_PROGRESS);
  assert.equal(result.openLoopSuggestions[0].source.id, 'artifact-nested-1');
  assert.equal(result.openLoopSuggestions[0].sourceRefs[0].type, 'reflection');
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'state'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'writeArtifact'), false);
});

test('suppresses sensitive private inference suggestions', () => {
  const result = extractOpenLoopSuggestions({
    now: NOW,
    artifacts: [
      {
        type: 'reflection',
        id: 'reflection-sensitive-1',
        text: 'Maybe the user is depressed; next step is ask about medication.',
      },
    ],
  });

  assert.deepEqual(result.openLoopSuggestions, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, 'sensitive-private-inference');
  assert.match(result.rejected[0].excerpt, /depressed/i);
});

test('labels speculative suggestions instead of presenting them as certain', () => {
  const result = extractOpenLoopSuggestionFromText({
    now: NOW,
    source: { type: 'reflection', id: 'reflection-speculative-1', label: 'speculation fixture' },
    text: 'Maybe the prompt bridge is pending; next step is inspect fixture results.',
  });

  assert.equal(result.rejection, null);
  assert.equal(result.suggestion.status, OPEN_LOOP_STATUSES.IN_PROGRESS);
  assert.equal(result.suggestion.confidence, 'low');
  assert.equal(result.suggestion.speculation, true);
  assert.deepEqual(result.suggestion.labels, ['speculation']);
  assert.equal(result.suggestion.extraction.reason, 'speculative-open-loop-pattern');
  assert.equal(result.suggestion.sourceRefs[0].note, 'speculative open-loop fixture extraction');
});

test('rejects non-actionable fixture text with an explicit reason', () => {
  const result = extractOpenLoopSuggestions('Penny felt warm and present in the conversation.', { now: NOW });

  assert.deepEqual(result.openLoopSuggestions, []);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.rejected[0].reason, 'not-actionable');
});
