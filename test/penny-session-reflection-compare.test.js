const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const packageJson = require('../package.json');
const {
  PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA,
  SESSION_REFLECTION_PROMPT_BRIDGE_MODES,
  buildSessionReflectionPromptBridge,
} = require('../lib/penny-session-reflection');
const {
  MODE_CONFIGS,
  SESSION_REFLECTION_COMPARE_SCHEMA,
  analyzeCaseResponse,
  assemblePrompt,
  buildCases,
  buildCompareSummary,
  buildMockReply,
  buildReflectionFixture,
  buildSessionReflectionCompareArtifact,
  parseArgValue,
  runMode,
  writeSessionReflectionCompareArtifact,
} = require('../scripts/eval-penny-session-reflection-compare');

const GENERATED_AT = '2026-04-22T12:00:00.000Z';

test('session reflection prompt bridge stays disabled unless explicitly enabled for compare', () => {
  const reflection = buildReflectionFixture(GENERATED_AT);
  const disabled = buildSessionReflectionPromptBridge({
    reflection,
    userText: 'Where should we pick up for Slice R8?',
    mode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT,
    generatedAt: GENERATED_AT,
  });

  assert.equal(disabled.schema, PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.promptBridge.renderedCount, 0);
  assert.equal(disabled.promptBridge.promptText, '');
  assert.equal(disabled.livePromptBridge, false);
  assert.equal(disabled.promptTruthExpanded, false);
  assert.equal(disabled.promptTruthChannelAdded, false);
  assert.equal(disabled.toolEvidenceReceiptChanged, false);
  assert.equal(disabled.memoryWrites, false);
  assert.equal(disabled.runtimeVoiceChanged, false);
});

test('compact bridge renders bounded advisory context without memory suggestion text', () => {
  const reflection = buildReflectionFixture(GENERATED_AT);
  const bridge = buildSessionReflectionPromptBridge({
    reflection,
    userText: 'Penny, where should we pick up for Slice R8 session reflection?',
    mode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT,
    enabled: true,
    generatedAt: GENERATED_AT,
  });

  assert.equal(bridge.enabled, true);
  assert.equal(bridge.relevant, true);
  assert.equal(bridge.promptBridge.renderedCount, 1);
  assert.equal(bridge.promptBridge.compact, true);
  assert.equal(bridge.promptBridge.memorySuggestionTextRendered, false);
  assert.match(bridge.promptBridge.promptText, /Session reflection, advisory/i);
  assert.match(bridge.promptBridge.promptText, /requiresApproval=true/i);
  assert.match(bridge.promptBridge.promptText, /autoPromoted=false/i);
  assert.doesNotMatch(bridge.promptBridge.promptText, /User prefers broad daily journal scans/i);
  assert.deepEqual(bridge.selectedOpenLoopUpdateIds, ['r8-compact-compare']);
  assert.equal(bridge.memorySuggestionPolicy.pendingReviewCount, 3);
  assert.equal(bridge.memorySuggestionPolicy.autoPromotedCount, 0);
  assert.equal(bridge.memorySuggestions.every((item) => item.requiresApproval === true), true);
  assert.equal(bridge.memorySuggestions.every((item) => item.autoPromoted === false), true);
  assert.equal(bridge.promptTruthExpanded, false);
  assert.equal(bridge.toolEvidenceReceiptChanged, false);
});

test('verbose bridge is available only as a negative control and exposes review labels', () => {
  const reflection = buildReflectionFixture(GENERATED_AT);
  const compact = buildSessionReflectionPromptBridge({
    reflection,
    userText: 'Did reflection already save the broad daily-journal preference as memory?',
    mode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT,
    enabled: true,
    generatedAt: GENERATED_AT,
  });
  const verbose = buildSessionReflectionPromptBridge({
    reflection,
    userText: 'Did reflection already save the broad daily-journal preference as memory?',
    mode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE,
    enabled: true,
    generatedAt: GENERATED_AT,
  });

  assert.equal(compact.promptBridge.memorySuggestionTextRendered, false);
  assert.equal(verbose.promptBridge.memorySuggestionTextRendered, true);
  assert.match(verbose.promptBridge.promptText, /Pending memory suggestion for review only/i);
  assert.match(verbose.promptBridge.promptText, /supportState=/i);
  assert.match(verbose.promptBridge.promptText, /sensitivity=/i);
  assert.ok(verbose.promptBridge.wordCount > compact.promptBridge.wordCount);
  assert.equal(verbose.promptTruthExpanded, false);
  assert.equal(verbose.toolEvidenceReceiptChanged, false);
});

test('session reflection compare exposes baseline, off, compact, and verbose modes', () => {
  assert.deepEqual(Object.keys(MODE_CONFIGS), [
    'baseline',
    'reflection-summary-off',
    'reflection-summary-on-compact',
    'reflection-summary-on-verbose',
  ]);
  assert.equal(MODE_CONFIGS['reflection-summary-on-compact'].enabled, true);
  assert.equal(MODE_CONFIGS['reflection-summary-on-verbose'].bridgeMode, SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE);
  assert.deepEqual(buildCases().map((item) => item.name), [
    'r8_followthrough',
    'memory_suggestion_boundary',
    'correction_truth_boundary',
    'irrelevant_no_nag',
  ]);
  assert.equal(
    packageJson.scripts['eval:session-reflection-compare'],
    'node scripts/eval-penny-session-reflection-compare.js',
  );
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('generated-at', ['--generated-at=2026-04-22T00:00:00.000Z']), '2026-04-22T00:00:00.000Z');
});

test('mock analyzer rewards compact continuity and flags verbose memory false positives', () => {
  const reflection = buildReflectionFixture(GENERATED_AT);
  const caseSpec = buildCases().find((item) => item.name === 'memory_suggestion_boundary');
  const compactBridge = buildSessionReflectionPromptBridge({
    reflection,
    userText: caseSpec.prompt,
    mode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.COMPACT,
    enabled: true,
    generatedAt: GENERATED_AT,
  });
  const verboseBridge = buildSessionReflectionPromptBridge({
    reflection,
    userText: caseSpec.prompt,
    mode: SESSION_REFLECTION_PROMPT_BRIDGE_MODES.VERBOSE,
    enabled: true,
    generatedAt: GENERATED_AT,
  });
  const compactPrompt = assemblePrompt({ bridge: compactBridge, userText: caseSpec.prompt });
  const verbosePrompt = assemblePrompt({ bridge: verboseBridge, userText: caseSpec.prompt });
  const compactReply = buildMockReply({ promptText: compactPrompt, caseSpec });
  const verboseReply = buildMockReply({ promptText: verbosePrompt, caseSpec });
  const compact = analyzeCaseResponse(compactReply, caseSpec, compactBridge, compactPrompt);
  const verbose = analyzeCaseResponse(verboseReply, caseSpec, verboseBridge, verbosePrompt);

  assert.equal(compact.memorySuggestionFalsePositive, false);
  assert.equal(compact.overclaiming, false);
  assert.equal(verbose.memorySuggestionFalsePositive, true);
  assert.equal(verbose.overclaiming, true);
  assert.ok(compact.score > verbose.score);
});

test('compare summary advances compact only to live-shadow review and keeps default rendering disabled', () => {
  const reflection = buildReflectionFixture(GENERATED_AT);
  const cases = buildCases();
  const results = Object.values(MODE_CONFIGS).map((modeConfig) => runMode(modeConfig, {
    reflection,
    cases,
    generatedAt: GENERATED_AT,
  }));
  const summary = buildCompareSummary(results);

  assert.equal(summary.pairedVerdict, 'reflection-summary-on-compact');
  assert.equal(summary.enablementRecommendation, 'eligible-for-live-shadow-review');
  assert.equal(summary.defaultRenderingRecommendation, 'keep-disabled');
  assert.equal(summary.continuityWins, 3);
  assert.equal(summary.regressions, 0);
  assert.equal(summary.memorySuggestionFalsePositives, 0);
  assert.equal(summary.acceptance.memorySuggestionsReviewGated, true);
  assert.equal(summary.acceptance.noPromptTruthExpansion, true);
  assert.equal(summary.acceptance.noToolEvidenceReceiptMerge, true);
  assert.equal(summary.verboseNegativeControl.losesToCompact, true);
  assert.ok(summary.verboseNegativeControl.regressions > 0);
  assert.equal(summary.alivenessSummary.pass, true);
});

test('compare artifact and writer preserve fixture-only guardrails', () => {
  const artifact = buildSessionReflectionCompareArtifact({ generatedAt: GENERATED_AT });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-session-reflection-compare-'));
  const outputPath = path.join(dir, 'artifact.json');
  const written = writeSessionReflectionCompareArtifact({ outputPath, artifact });
  const parsed = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(written.outputPath, outputPath);
  assert.equal(parsed.schema, SESSION_REFLECTION_COMPARE_SCHEMA);
  assert.equal(parsed.reflectionPromptBridgeSchema, PENNY_SESSION_REFLECTION_PROMPT_BRIDGE_SCHEMA);
  assert.equal(parsed.measurementMode, 'fixture-compare');
  assert.equal(parsed.runnerMode, 'fixture-only');
  assert.equal(parsed.liveModelCalls, false);
  assert.equal(parsed.serverSpawned, false);
  assert.equal(parsed.livePromptBridge, false);
  assert.equal(parsed.memoryWrites, false);
  assert.equal(parsed.explicitMemoryWrites, false);
  assert.equal(parsed.canonicalMemoryWrites, false);
  assert.equal(parsed.promptTruthExpanded, false);
  assert.equal(parsed.promptTruthChannelAdded, false);
  assert.equal(parsed.toolEvidenceReceiptChanged, false);
  assert.equal(parsed.toolEvidenceReceiptMerged, false);
  assert.equal(parsed.hiddenChainOfThoughtStored, false);
  assert.equal(parsed.runtimeVoiceChanged, false);
  assert.equal(parsed.summary.defaultRenderingRecommendation, 'keep-disabled');
});
