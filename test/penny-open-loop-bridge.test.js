const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCaseResult,
  buildFixtureCases,
  buildOpenLoopBridgeFixtureArtifact,
  parseArgValue,
  writeOpenLoopBridgeFixtureArtifact,
} = require('../scripts/eval-penny-open-loop-bridge');
const {
  OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
} = require('../lib/penny-open-loops');

const GENERATED_AT = '2026-04-22T12:00:00.000Z';

test('open-loop bridge fixture exposes selected vs held-back cases without live model calls', () => {
  const artifact = buildOpenLoopBridgeFixtureArtifact({ generatedAt: GENERATED_AT });

  assert.equal(artifact.schema, OPEN_LOOP_PROMPT_BRIDGE_SCHEMA);
  assert.equal(artifact.artifactKind, 'open-loop-prompt-bridge-fixture');
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.liveChatTouched, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.promptTruthChannelAdded, false);
  assert.equal(artifact.summary.caseCount, 3);
  assert.equal(artifact.summary.passingCaseCount, 3);
  assert.equal(artifact.summary.selectedVsHeldBackShown, true);
  assert.equal(artifact.summary.overclaimGuardrailPresent, true);

  const relevant = artifact.cases.find((item) => item.id === 'relevant-open-loop-bridge');
  assert.deepEqual(relevant.bridge.selected.map((item) => item.id), ['open-loop-prompt-bridge']);
  assert.deepEqual(relevant.bridge.heldBack.map((item) => ({ id: item.id, reason: item.reason })), [
    { id: 'deterministic-extraction', reason: 'adjacent-not-central' },
  ]);
  assert.match(relevant.bridge.promptBridge.promptText, /Source: doc docs\/penny-tier1-aliveness-plans\/02-open-loop-tracker-plan\.md\./);
  assert.match(relevant.bridge.promptBridge.promptText, /Do not treat this as canonical memory or overclaim its status\./);
});

test('completed and capped bridge fixture cases stay bounded', () => {
  const cases = buildFixtureCases();
  assert.deepEqual(cases.map((item) => item.id), [
    'relevant-open-loop-bridge',
    'completed-loop-suppressed',
    'one-loop-cap',
  ]);

  const completed = buildCaseResult(
    cases.find((item) => item.id === 'completed-loop-suppressed'),
    GENERATED_AT,
  );
  assert.equal(completed.pass, true);
  assert.deepEqual(completed.bridge.selected, []);
  assert.deepEqual(completed.bridge.heldBack, [
    { id: 'gemma-runtime-watch', reason: 'completed-suppressed' },
  ]);

  const capped = buildCaseResult(
    cases.find((item) => item.id === 'one-loop-cap'),
    GENERATED_AT,
  );
  assert.equal(capped.pass, true);
  assert.deepEqual(capped.bridge.selected.map((item) => item.id), ['static-live-advisory']);
  assert.deepEqual(capped.bridge.heldBack.map((item) => ({ id: item.id, reason: item.reason })), [
    { id: 'candidate-survival', reason: 'max-loop-cap' },
  ]);
  assert.equal(capped.bridge.promptBridge.renderedCount, 1);
});

test('open-loop bridge fixture writer writes the artifact to the requested path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-open-loop-bridge-'));
  const outputPath = path.join(dir, 'fixture.json');
  const artifact = buildOpenLoopBridgeFixtureArtifact({ generatedAt: GENERATED_AT });

  const result = writeOpenLoopBridgeFixtureArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, OPEN_LOOP_PROMPT_BRIDGE_SCHEMA);
  assert.equal(written.summary.passingCaseCount, 3);
});

test('open-loop bridge script arg parser supports --output forms', () => {
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--output=tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--other', 'tmp/out.json']), '');
});
