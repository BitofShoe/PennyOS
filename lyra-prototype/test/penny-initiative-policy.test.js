const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FORBIDDEN_ACTIONS,
  INITIATIVE_CONFIDENCE,
  INITIATIVE_DECISION_SCHEMA,
  INITIATIVE_TYPES,
  decideInitiative,
} = require('../lib/penny-initiative-policy');

test('direct commands suppress extra initiative', () => {
  const decision = decideInitiative({
    userText: 'Please implement Slice I1 and commit when done.',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'After the unit tests pass, run the open-loop compare harness again.',
      },
    ],
  });

  assert.equal(decision.schema, INITIATIVE_DECISION_SCHEMA);
  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.equal(decision.maxSuggestions, 0);
  assert.match(decision.reason, /direct command/i);
  assert.deepEqual(decision.heldBack, [
    { reason: 'direct-command', initiativeType: INITIATIVE_TYPES.NONE },
  ]);
});

test('high-confidence next step yields one approval-gated suggestion', () => {
  const decision = decideInitiative({
    userText: 'What is the smallest useful next move here?',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'After live-shadow lands, test brass-fox and copper-rabbit before enabling live-advisory.',
        source: 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md',
      },
    ],
  });

  assert.equal(decision.schema, INITIATIVE_DECISION_SCHEMA);
  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NEXT_STEP_SUGGESTION);
  assert.equal(decision.confidence, INITIATIVE_CONFIDENCE.HIGH);
  assert.equal(decision.maxSuggestions, 1);
  assert.equal(decision.requiresUserApproval, true);
  assert.equal(
    decision.suggestionText,
    'After live-shadow lands, test brass-fox and copper-rabbit before enabling live-advisory.',
  );
  assert.deepEqual(decision.forbiddenActions, FORBIDDEN_ACTIONS);
  assert.deepEqual(decision.heldBack, []);
});

test('sensitive topics suppress initiative instead of adding a nudge', () => {
  const decision = decideInitiative({
    userText: 'I am feeling suicidal; should Penny keep nudging me about project next steps?',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'Run one more source-check fixture.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.match(decision.reason, /sensitive topic/i);
  assert.deepEqual(decision.heldBack, [
    { reason: 'sensitive-topic', initiativeType: INITIATIVE_TYPES.NONE },
  ]);
});

test('recent matching initiative suppresses repeated suggestions', () => {
  const suggestionText = 'Run the initiative policy unit test before adding any prompt bridge.';
  const decision = decideInitiative({
    userText: 'Any tiny next step after this?',
    relevantOpenLoops: [
      {
        id: 'bounded-initiative-policy',
        title: 'Bounded initiative policy',
        confidence: 'high',
        nextLikelyStep: suggestionText,
      },
    ],
    recentInitiatives: [
      {
        initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
        suggestionText,
        turnsAgo: 1,
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.match(decision.reason, /cooldown/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'recent-initiative-cooldown',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText,
    },
  ]);
});

test('explicit stop-suggesting text disables initiative', () => {
  const decision = decideInitiative({
    userText: 'Stop suggesting next steps for now.',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'Run the compare harness.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.match(decision.reason, /disabled by user preference/i);
  assert.deepEqual(decision.heldBack, [
    { reason: 'user-opt-out', initiativeType: INITIATIVE_TYPES.NONE },
  ]);
});
