const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  MODE_CONFIGS,
  OPEN_LOOP_COMPARE_SCHEMA,
  analyzeCaseResponse,
  buildCases,
  buildOpenLoopStateFixture,
  buildPairSummary,
  estimatePromptTokens,
  parseArgValue,
  renderedOpenLoopIdsFromPrompt,
  writeOpenLoopCompareArtifact,
} = require('../scripts/eval-penny-open-loop-compare');

test('open-loop compare exposes the bounded off/on mode pair and fixture cases', () => {
  assert.deepEqual(Object.keys(MODE_CONFIGS), ['open-loop-off', 'open-loop-on']);
  assert.equal(MODE_CONFIGS['open-loop-off'].flags.PENNY_ENABLE_OPEN_LOOP_PROMPT, '0');
  assert.equal(MODE_CONFIGS['open-loop-on'].flags.PENNY_ENABLE_OPEN_LOOP_PROMPT, '1');
  assert.equal(MODE_CONFIGS['open-loop-on'].flags.PENNY_OPEN_LOOP_MAX_RENDERED, '1');
  assert.deepEqual(buildCases().map((item) => item.name), [
    'explicit_followthrough',
    'adjacent_topic_bleed_guard',
    'completed_loop_suppressed',
    'overclaim_guard',
  ]);
});

test('open-loop compare fixture state keeps advisory active loops separate from terminal loops', () => {
  const state = buildOpenLoopStateFixture('2026-04-22T12:00:00.000Z');

  assert.equal(state.schema, 'penny-open-loop-state.v1');
  assert.deepEqual(state.loops.map((item) => item.id), [
    'open-loop-compare',
    'deterministic-extraction',
    'gemma-runtime-watch',
    'stale-ui-cleanup',
  ]);
  assert.equal(state.loops.find((item) => item.id === 'open-loop-compare').authority, 'advisory');
  assert.equal(state.loops.find((item) => item.id === 'gemma-runtime-watch').status, 'completed');
  assert.equal(state.loops.find((item) => item.id === 'stale-ui-cleanup').status, 'dismissed');
});

test('renderedOpenLoopIdsFromPrompt detects candidate snippets in assembled prompts', () => {
  const prompt = [
    'Wake state - contradictions/open questions:',
    'Open loop candidate, advisory: Open-loop compare harness follow-through is in progress.',
    'Open loop candidate, advisory: Deterministic extraction fixture plan is deferred.',
  ].join('\n');

  assert.deepEqual(renderedOpenLoopIdsFromPrompt(prompt), [
    'open-loop-compare',
    'deterministic-extraction',
  ]);
});

test('analyzeCaseResponse rewards advisory follow-through and flags bleed or overclaim', () => {
  const scenario = buildCases().find((item) => item.name === 'explicit_followthrough');
  const clean = analyzeCaseResponse(
    'The O8 compare harness is next, with adjacent-topic bleed as the risk to watch. Advisory, not canonical.',
    scenario,
    { scope: { selectedLane: 'chat' } },
    { promptText: 'Open loop candidate, advisory: Open-loop compare harness follow-through is in progress.' },
  );
  const bleed = analyzeCaseResponse(
    'Deterministic extraction is next.',
    scenario,
    { scope: { selectedLane: 'chat' } },
    { promptText: 'Open loop candidate, advisory: Deterministic extraction fixture plan is deferred.' },
  );
  const overclaim = analyzeCaseResponse(
    'This is a verified fact and definitely done.',
    scenario,
    { scope: { selectedLane: 'chat' } },
    { promptText: 'Open loop candidate, advisory: Open-loop compare harness follow-through is in progress.' },
  );

  assert.ok(clean.score > bleed.score);
  assert.equal(clean.expectedRendered, true);
  assert.equal(clean.adjacentTopicBleed, false);
  assert.equal(bleed.adjacentTopicBleed, true);
  assert.equal(overclaim.overclaiming, true);
});

test('buildPairSummary allows the bridge only when wins beat regressions and bleed is zero', () => {
  const cases = buildCases();
  const makeCase = (scenario, {
    score = 0,
    renderedOpenLoopIds = [],
    continuityHits = [],
    forbiddenRenderedIds = [],
    annoyance = false,
    overclaiming = false,
    promptTokenEstimate = 20,
    seconds = 0.05,
  } = {}) => ({
    name: scenario.name,
    ok: true,
    seconds,
    artifactSummary: {
      firstTokenMs: 10,
      promptTokenEstimate,
      renderedOpenLoopIds,
    },
    analysis: {
      renderedOpenLoopIds,
      expectedRendered: scenario.expectedBridgeLoopIds.length > 0
        && scenario.expectedBridgeLoopIds.every((id) => renderedOpenLoopIds.includes(id)),
      forbiddenRenderedIds,
      continuityHits,
      adjacentTopicBleed: forbiddenRenderedIds.length > 0,
      annoyance,
      overclaiming,
    },
    score,
  });
  const off = {
    mode: 'open-loop-off',
    environment: { valid: true },
    totalScore: 1,
    cases: cases.map((scenario) => makeCase(scenario, { score: 0.25 })),
  };
  const on = {
    mode: 'open-loop-on',
    environment: { valid: true },
    totalScore: 8,
    cases: cases.map((scenario) => makeCase(scenario, {
      score: scenario.noBridgeExpected ? 0.25 : 2.5,
      renderedOpenLoopIds: scenario.noBridgeExpected ? [] : scenario.expectedBridgeLoopIds,
      continuityHits: scenario.noBridgeExpected ? [] : scenario.continuityNeedles.slice(0, 1),
      promptTokenEstimate: scenario.noBridgeExpected ? 20 : 35,
    })),
  };

  const summary = buildPairSummary([off, on]);

  assert.equal(summary.pairedVerdict, 'open-loop-on');
  assert.equal(summary.enablementRecommendation, 'eligible-for-opt-in');
  assert.equal(summary.continuityWins, 3);
  assert.equal(summary.regressions, 0);
  assert.equal(summary.acceptance.enableOnlyIfWinsBeatRegressions, true);
});

test('buildPairSummary keeps bridge disabled when adjacent-topic bleed appears', () => {
  const cases = buildCases();
  const off = {
    mode: 'open-loop-off',
    environment: { valid: true },
    totalScore: 0,
    cases: cases.map((scenario) => ({
      name: scenario.name,
      ok: true,
      artifactSummary: { firstTokenMs: 10, promptTokenEstimate: 20, renderedOpenLoopIds: [] },
      analysis: {
        renderedOpenLoopIds: [],
        expectedRendered: false,
        forbiddenRenderedIds: [],
        continuityHits: [],
        adjacentTopicBleed: false,
        annoyance: false,
        overclaiming: false,
      },
      score: 0,
      seconds: 0.05,
    })),
  };
  const on = {
    mode: 'open-loop-on',
    environment: { valid: true },
    totalScore: 7,
    cases: cases.map((scenario, index) => ({
      name: scenario.name,
      ok: true,
      artifactSummary: {
        firstTokenMs: 10,
        promptTokenEstimate: 35,
        renderedOpenLoopIds: index === 1 ? ['deterministic-extraction'] : scenario.expectedBridgeLoopIds,
      },
      analysis: {
        renderedOpenLoopIds: index === 1 ? ['deterministic-extraction'] : scenario.expectedBridgeLoopIds,
        expectedRendered: !scenario.noBridgeExpected && scenario.expectedBridgeLoopIds.length > 0,
        forbiddenRenderedIds: index === 1 ? ['deterministic-extraction'] : [],
        continuityHits: scenario.noBridgeExpected ? [] : scenario.continuityNeedles.slice(0, 1),
        adjacentTopicBleed: index === 1,
        annoyance: false,
        overclaiming: false,
      },
      score: scenario.noBridgeExpected ? 0 : 2,
      seconds: 0.05,
    })),
  };

  const summary = buildPairSummary([off, on]);

  assert.equal(summary.pairedVerdict, 'open-loop-off');
  assert.equal(summary.enablementRecommendation, 'keep-disabled');
  assert.equal(summary.adjacentTopicBleed, 1);
  assert.equal(summary.acceptance.bridgeStaysOffIfBleedAppears, true);
});

test('open-loop compare writer and arg parser are deterministic', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-open-loop-compare-'));
  const outputPath = path.join(dir, 'compare.json');
  const artifact = {
    schema: OPEN_LOOP_COMPARE_SCHEMA,
    artifactKind: 'open-loop-compare',
    summary: { pairedVerdict: 'open-loop-on' },
  };

  const result = writeOpenLoopCompareArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, OPEN_LOOP_COMPARE_SCHEMA);
  assert.equal(written.summary.pairedVerdict, 'open-loop-on');
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--output=tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--other', 'tmp/out.json']), '');
  assert.equal(estimatePromptTokens('Open loop candidate advisory'), 7);
});
