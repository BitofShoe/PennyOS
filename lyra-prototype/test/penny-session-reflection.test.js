const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_SESSION_REFLECTION_SCHEMA,
  SUPPORT_STATES,
  normalizeDoNotSaveItem,
  normalizeMemorySuggestion,
  normalizeReflectionDecision,
  normalizeSessionReflection,
  summarizeSessionReflection,
  validateSessionReflection,
} = require('../lib/penny-session-reflection');

const NOW = '2026-04-22T12:00:00.000Z';

test('normalizes a safe artifact-only reflection with explicit non-authority defaults', () => {
  const reflection = normalizeSessionReflection({
    now: NOW,
    sessionId: 'session-r1',
    sourceWindow: {
      turnIds: ['turn-1', 'turn-2', 'turn-1'],
      startedAt: '2026-04-22T11:00:00.000Z',
      endedAt: '2026-04-22T11:30:00.000Z',
      includedArtifacts: [
        { type: 'test', id: 'r1-focused', label: 'focused test output' },
      ],
    },
    summary: {
      short: 'R1 added pure reflection helpers.',
      confidence: 'medium',
    },
    decisions: [
      {
        text: 'Reflection can suggest but cannot canonize.',
        status: 'decided',
        support: 'repo-source',
      },
    ],
  });

  assert.equal(reflection.schema, PENNY_SESSION_REFLECTION_SCHEMA);
  assert.equal(reflection.generatedAt, NOW);
  assert.equal(reflection.measurementMode, 'artifact-only');
  assert.equal(reflection.liveModelCalls, false);
  assert.equal(reflection.behaviorChanged, false);
  assert.equal(reflection.memoryWrites, false);
  assert.equal(reflection.canonicalMemoryWrites, false);
  assert.equal(reflection.promptTruthExpanded, false);
  assert.equal(reflection.toolEvidenceReceiptChanged, false);
  assert.equal(reflection.hiddenChainOfThoughtStored, false);
  assert.equal(reflection.runtimeVoiceChanged, false);
  assert.deepEqual(reflection.sourceWindow.turnIds, ['turn-1', 'turn-2']);
  assert.equal(reflection.decisions[0].memoryAuthority, 'advisory');
  assert.match(reflection.limits.join('\n'), /not canonical memory/i);
  assert.match(reflection.limits.join('\n'), /does not expand PromptTruth or toolEvidenceReceipt/i);
});

test('memory suggestions always carry support state, sensitivity, approval, and non-promotion defaults', () => {
  const suggestion = normalizeMemorySuggestion({
    text: 'User prefers detailed, slice-by-slice implementation plans.',
    kind: 'user-preference',
    confidence: 'high',
    support: 'repeated explicit user preference',
    sourceReceipts: [
      { type: 'reflection', id: 'r1-fixture', excerpt: 'User asked for slice-by-slice work.' },
    ],
    requiresApproval: false,
    autoPromoted: true,
    suggestedExplicitMemory: { text: 'should be ignored in R1' },
  });

  assert.equal(suggestion.kind, 'user-preference');
  assert.equal(suggestion.supportState, SUPPORT_STATES.REPEATED_EXPLICIT);
  assert.equal(suggestion.supportLevel, 1);
  assert.equal(suggestion.sensitivity, 'low');
  assert.equal(suggestion.requiresApproval, true);
  assert.equal(suggestion.autoPromoted, false);
  assert.equal(suggestion.suggestedExplicitMemory, null);
  assert.equal(suggestion.sourceReceipts[0].type, 'reflection');
});

test('session normalization warns when a suggestion tries to bypass review defaults', () => {
  const reflection = normalizeSessionReflection({
    now: NOW,
    memorySuggestions: [
      {
        text: 'User prefers long technical plans.',
        kind: 'user-preference',
        support: 'explicit user statement',
        requiresApproval: false,
        autoPromoted: true,
      },
    ],
  });

  assert.equal(reflection.memorySuggestions.length, 1);
  assert.equal(reflection.memorySuggestions[0].requiresApproval, true);
  assert.equal(reflection.memorySuggestions[0].autoPromoted, false);
  assert.match(reflection.warnings.join('\n'), /requiresApproval=false/i);
  assert.match(reflection.warnings.join('\n'), /autoPromoted=true/i);
});

test('sensitive and inferred memory-like items are held as do-not-save instead of suggestions', () => {
  const reflection = normalizeSessionReflection({
    now: NOW,
    memorySuggestions: [
      {
        text: 'User seems anxious about static embeddings.',
        kind: 'user-preference',
        support: 'inferred from tone over one turn',
      },
      {
        text: 'User mentioned a medication dosage preference.',
        kind: 'stable-fact',
        support: 'explicit user statement',
        sensitivity: 'medical',
      },
    ],
  });

  assert.deepEqual(reflection.memorySuggestions, []);
  assert.equal(reflection.doNotSave.length, 2);
  assert.equal(reflection.doNotSave[0].reason, 'inferred-emotion');
  assert.equal(reflection.doNotSave[1].reason, 'sensitive');
  assert.match(reflection.warnings.join('\n'), /held out of review queue: inferred-emotion/i);
  assert.match(reflection.warnings.join('\n'), /held out of review queue: sensitive/i);
});

test('temporary session states are do-not-save items', () => {
  const suggestion = normalizeMemorySuggestion({
    text: 'User is currently frustrated during this session.',
    kind: 'user-preference',
    supportState: 'temporary',
  });
  const item = normalizeDoNotSaveItem(suggestion);

  assert.equal(suggestion.kind, 'do-not-save');
  assert.equal(suggestion.doNotSaveReason, 'temporary');
  assert.equal(item.reason, 'temporary');
  assert.equal(item.text, 'User is currently frustrated during this session.');
});

test('summary receipts do not imply canonical memory or PromptTruth authority', () => {
  const summary = summarizeSessionReflection({
    now: NOW,
    summary: {
      short: 'The session had one useful preference candidate.',
      unsupportedClaims: ['Reflection summary alone proves the preference.'],
    },
    memorySuggestions: [
      {
        text: 'User prefers detailed implementation plans.',
        kind: 'user-preference',
        support: 'explicit user statement',
      },
    ],
  });

  assert.equal(summary.memorySuggestionCount, 1);
  assert.equal(summary.doNotSaveCount, 0);
  assert.equal(summary.unsupportedClaimCount, 1);
  assert.equal(summary.memoryAuthority, 'reviewable-synthesis-only');
  assert.equal(summary.explicitMemoryWrites, false);
  assert.equal(summary.canonicalMemoryWrites, false);
  assert.equal(summary.promptTruthExpanded, false);
  assert.equal(summary.toolEvidenceReceiptChanged, false);
  assert.equal(summary.hiddenChainOfThoughtStored, false);
  assert.equal(summary.autoPromotedSuggestionCount, 0);
  assert.equal(summary.allMemorySuggestionsRequireApproval, true);
});

test('validation returns normalized safe reflection without model calls or memory writes', () => {
  const validation = validateSessionReflection({
    now: NOW,
    measurementMode: 'eval',
    liveModelCalls: false,
    memorySuggestions: [
      {
        text: 'User prefers one coherent slice at a time.',
        kind: 'user-preference',
        support: 'repeated explicit user preference',
      },
    ],
    scratchpad: 'private chain of thought that must not be retained',
  });

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assert.equal(validation.reflection.memorySuggestions[0].supportState, SUPPORT_STATES.REPEATED_EXPLICIT);
  assert.equal(validation.reflection.memorySuggestions[0].requiresApproval, true);
  assert.equal(validation.reflection.memorySuggestions[0].autoPromoted, false);
  assert.equal(validation.reflection.memoryWrites, false);
  assert.equal(validation.reflection.liveModelCalls, false);
  assert.match(validation.warnings.join('\n'), /hidden-CoT fields rejected: scratchpad/i);
});

test('decision normalization remains advisory unless explicit memory support is present', () => {
  const sourceDecision = normalizeReflectionDecision({
    text: 'Static embeddings are discovery, not truth.',
    support: 'repo-source',
  });
  const explicitDecision = normalizeReflectionDecision({
    text: 'User said they prefer detailed implementation plans.',
    support: 'explicit-user',
  });

  assert.equal(sourceDecision.memoryAuthority, 'advisory');
  assert.equal(explicitDecision.memoryAuthority, 'explicit-candidate');
  assert.equal(explicitDecision.status, 'tentative');
});
