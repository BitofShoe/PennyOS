const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DESIRED_DEPTHS,
  RESPONSE_MODES,
  TURN_STATE_SCHEMA,
  buildTurnState,
  extractTurnStateSignals,
  normalizeTurnState,
  summarizeTurnState,
} = require('../lib/penny-turn-state');

test('normalizes the pure ephemeral turn-state schema with safe defaults', () => {
  const state = normalizeTurnState();

  assert.equal(state.schema, TURN_STATE_SCHEMA);
  assert.equal(state.measurementMode, 'ephemeral');
  assert.equal(state.persist, false);
  assert.equal(state.userIntent, '');
  assert.equal(state.desiredDepth, DESIRED_DEPTHS.UNKNOWN);
  assert.equal(state.responseMode, RESPONSE_MODES.UNKNOWN);
  assert.deepEqual(state.energy, {
    label: 'unknown',
    confidence: 'unknown',
    evidence: [],
  });
  assert.deepEqual(state.explicitInstructions, []);
  assert.deepEqual(state.activeConstraints, []);
  assert.deepEqual(state.riskFlags, []);
  assert.equal(state.sourceCheckNeeded, false);
  assert.deepEqual(state.openLoopsTouched, []);
  assert.deepEqual(state.rejectedFields, []);
});

test('rejects hidden chain-of-thought style fields without carrying them forward', () => {
  const state = normalizeTurnState({
    userIntent: 'Keep this as an inspectable current-turn card.',
    chainOfThought: 'secret reasoning',
    scratchpad: 'private notes',
    energy: {
      label: 'focused',
      hiddenReasoning: 'private tone explanation',
    },
    nested: {
      internalMonologue: 'also private',
    },
  });

  assert.equal(Object.prototype.hasOwnProperty.call(state, 'chainOfThought'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(state, 'scratchpad'), false);
  assert.deepEqual(state.rejectedFields, [
    'chainOfThought',
    'scratchpad',
    'energy.hiddenReasoning',
    'nested.internalMonologue',
  ]);
  assert.match(state.warnings.join('\n'), /hidden-CoT fields rejected/i);
  assert.equal(state.energy.label, 'focused');
});

test('normalizes intent depth and response mode from explicit input only', () => {
  const state = normalizeTurnState({
    intent: ' Start Slice T1 for the ephemeral turn-state card. ',
    depth: 'long',
    responseMode: 'technical roadmap',
    suggestedResponseShape: 'Pure helper plus tests.',
  });

  assert.equal(state.userIntent, 'Start Slice T1 for the ephemeral turn-state card.');
  assert.equal(state.desiredDepth, DESIRED_DEPTHS.EXTENSIVE);
  assert.equal(state.responseMode, RESPONSE_MODES.TECHNICAL_ROADMAP);
  assert.equal(state.suggestedResponseShape, 'Pure helper plus tests.');
});

test('generic mode can alias response mode without changing ephemeral measurement mode', () => {
  const state = normalizeTurnState({
    mode: 'technical roadmap',
  });

  assert.equal(state.measurementMode, 'ephemeral');
  assert.equal(state.responseMode, RESPONSE_MODES.TECHNICAL_ROADMAP);
  assert.deepEqual(state.warnings, []);
});

test('energy confidence can stay unknown while evidence remains bounded', () => {
  const state = normalizeTurnState({
    energy: {
      label: 'excited',
      confidence: 'unclear',
      evidence: [
        'user asked for one slice at a time',
        'explicitly named the plan and slice',
        'user asked for one slice at a time',
      ],
    },
  });

  assert.equal(state.energy.label, 'excited');
  assert.equal(state.energy.confidence, 'unknown');
  assert.deepEqual(state.energy.evidence, [
    'user asked for one slice at a time',
    'explicitly named the plan and slice',
  ]);
});

test('active constraints become source-labeled strings where possible', () => {
  const state = normalizeTurnState({
    activeConstraints: [
      'No prompt-limit increase.',
      {
        text: 'PromptTruth unchanged',
        sourceLabel: 'docs/README.md',
      },
      {
        constraint: 'Explicit memory remains canonical',
        sourceRef: { type: 'doc', path: 'README.md' },
      },
    ],
  });

  assert.deepEqual(state.activeConstraints, [
    'No prompt-limit increase.',
    'docs/README.md: PromptTruth unchanged',
    'doc README.md: Explicit memory remains canonical',
  ]);
  assert.equal(state.activeConstraints.every((item) => typeof item === 'string'), true);
});

test('buildTurnState accepts wrapped state input without adding storage behavior', () => {
  const state = buildTurnState({
    turnState: {
      persist: true,
      measurementMode: 'stored',
      responseMode: 'source review',
      openLoopsTouched: [
        { id: 'ephemeral-turn-state-card', title: 'Ephemeral turn-state card' },
        'bounded-aliveness-compare',
      ],
    },
  });

  assert.equal(state.persist, false);
  assert.equal(state.measurementMode, 'ephemeral');
  assert.equal(state.responseMode, RESPONSE_MODES.SOURCE_BACKED_REVIEW);
  assert.deepEqual(state.openLoopsTouched, [
    'ephemeral-turn-state-card',
    'bounded-aliveness-compare',
  ]);
  assert.match(state.warnings.join('\n'), /persist request rejected/i);
  assert.match(state.warnings.join('\n'), /measurement mode normalized/i);
});

test('summarizeTurnState returns compact non-authority metadata', () => {
  const summary = summarizeTurnState({
    userIntent: 'Review the current plan slice.',
    desiredDepth: 'detailed',
    responseMode: 'code review',
    energy: { label: 'focused', confidence: 'medium' },
    activeConstraints: [
      'No memory writes.',
      'No PromptTruth expansion.',
    ],
    warnings: ['fixture-only'],
  });

  assert.deepEqual(summary, {
    schema: TURN_STATE_SCHEMA,
    measurementMode: 'ephemeral',
    persist: false,
    userIntent: 'Review the current plan slice.',
    desiredDepth: DESIRED_DEPTHS.DETAILED,
    responseMode: RESPONSE_MODES.CODE_REVIEW,
    energyLabel: 'focused',
    energyConfidence: 'medium',
    activeProjectThread: '',
    explicitInstructionCount: 0,
    activeConstraintCount: 2,
    riskFlagCount: 0,
    sourceCheckNeeded: false,
    openLoopsTouchedCount: 0,
    warningCount: 1,
    rejectedFieldCount: 0,
  });
});

test('extractTurnStateSignals treats explicit long-detail preference as extensive depth', () => {
  const state = extractTurnStateSignals({
    userText: 'Long detailed answers are heaven. Please go deep on the implementation path.',
  });

  assert.equal(state.desiredDepth, DESIRED_DEPTHS.EXTENSIVE);
  assert.equal(state.responseMode, RESPONSE_MODES.TECHNICAL_ROADMAP);
  assert.equal(state.energy.label, 'excited');
  assert.equal(state.energy.confidence, 'low');
  assert.deepEqual(state.energy.evidence, ['enthusiastic wording']);
  assert.equal(state.persist, false);
});

test('extractTurnStateSignals maps quick patch requests to concise technical mode', () => {
  const state = extractTurnStateSignals({
    userText: 'Please make a quick patch in lib/foo.js and keep it small.',
  });

  assert.equal(state.desiredDepth, DESIRED_DEPTHS.CONCISE);
  assert.equal(state.responseMode, RESPONSE_MODES.TECHNICAL_ROADMAP);
  assert.equal(state.suggestedResponseShape, 'concise code patch with focused verification');
  assert.ok(state.riskFlags.includes('quick-patch-scope'));
});

test('extractTurnStateSignals marks high-stakes source requests for source-check mode', () => {
  const state = extractTurnStateSignals({
    userText: 'Please verify the latest tax guidance with sources before giving advice.',
  });

  assert.equal(state.responseMode, RESPONSE_MODES.SOURCE_BACKED_REVIEW);
  assert.equal(state.sourceCheckNeeded, true);
  assert.equal(state.sourcePosture, 'source-check-needed');
  assert.ok(state.riskFlags.includes('source-check-needed'));
  assert.ok(state.riskFlags.includes('high-stakes-domain'));
});

test('extractTurnStateSignals keeps ambiguous tone unknown', () => {
  const state = extractTurnStateSignals({
    userText: 'Can you look at this sometime?',
  });

  assert.equal(state.desiredDepth, DESIRED_DEPTHS.UNKNOWN);
  assert.equal(state.responseMode, RESPONSE_MODES.UNKNOWN);
  assert.deepEqual(state.activeConstraints, []);
  assert.deepEqual(state.energy, {
    label: 'unknown',
    confidence: 'unknown',
    evidence: [],
  });
});

test('extractTurnStateSignals captures explicit no-proactive constraint without storing state', () => {
  const state = extractTurnStateSignals({
    userText: "Don't be proactive here; just answer the question.",
  });

  assert.equal(state.persist, false);
  assert.ok(state.explicitInstructions.some((item) => /don't be proactive/i.test(item)));
  assert.ok(state.activeConstraints.some((item) => /don't be proactive/i.test(item)));
  assert.ok(state.riskFlags.includes('user-proactive-opt-out'));
});

test('extractTurnStateSignals injects static embedding candidate authority constraints', () => {
  const state = extractTurnStateSignals({
    userText: 'Can static embeddings help the live static memory reflex without changing PromptTruth?',
  });

  assert.ok(state.activeConstraints.some((item) => /static embeddings are candidate discovery only/i.test(item)));
  assert.ok(state.activeConstraints.some((item) => /advisory context/i.test(item)));
  assert.ok(state.activeConstraints.some((item) => /PromptTruth stays limited/i.test(item)));
  assert.equal(state.activeConstraints.every((item) => /^current law: /.test(item)), true);
  assert.equal(state.persist, false);
});

test('extractTurnStateSignals injects explicit-memory authority for memory questions', () => {
  const state = extractTurnStateSignals({
    userText: 'What should Penny remember from archive memory, and can semantic recall update explicit memory?',
  });

  assert.ok(state.activeConstraints.some((item) => /Explicit memory is canonical/i.test(item)));
  assert.ok(state.activeConstraints.some((item) => /Archive, research-ledger, semantic, static, and open-loop signals are advisory/i.test(item)));
  assert.ok(state.riskFlags.includes('memory-write-sensitive'));
});

test('extractTurnStateSignals injects receipt requirements for tool and action questions', () => {
  const state = extractTurnStateSignals({
    userText: 'Run npm test, edit the helper if needed, and commit the slice when done.',
  });

  assert.ok(state.activeConstraints.some((item) => /completion claims require successful deterministic in-turn receipts/i.test(item)));
  assert.ok(state.activeConstraints.some((item) => /toolEvidenceReceipt stays a sibling runtime artifact/i.test(item)));
  assert.equal(state.responseMode, RESPONSE_MODES.TECHNICAL_ROADMAP);
});
