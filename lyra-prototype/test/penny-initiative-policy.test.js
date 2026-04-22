const test = require('node:test');
const assert = require('node:assert/strict');

const {
  FORBIDDEN_ACTIONS,
  INITIATIVE_CONFIDENCE,
  INITIATIVE_DECISION_SCHEMA,
  INITIATIVE_RISK_CLASSES,
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
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(decision.maxSuggestions, 1);
  assert.equal(decision.requiresUserApproval, true);
  assert.equal(decision.autoWrite, false);
  assert.equal(decision.actionPermission, 'suggest-only-requires-explicit-user-approval');
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
      riskClass: INITIATIVE_RISK_CLASSES.LOW,
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

test('medium-risk memory suggestion is approval-gated and never auto-writes', () => {
  const decision = decideInitiative({
    userText: 'That preference might matter later.',
    retrievalSignals: [
      {
        initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        suggestionText: 'Want me to remember that you prefer slice-by-slice implementation plans?',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.MEMORY_SUGGESTION);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.MEDIUM);
  assert.equal(decision.requiresUserApproval, true);
  assert.equal(decision.autoWrite, false);
  assert.equal(decision.actionPermission, 'suggest-only-requires-explicit-user-approval');
  assert.deepEqual(decision.heldBack, []);
});

test('memory suggestions that imply saving without approval are held back', () => {
  const decision = decideInitiative({
    userText: 'That preference might matter later.',
    retrievalSignals: [
      {
        initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        autoWrite: true,
        suggestionText: "I'll remember that you prefer slice-by-slice implementation plans.",
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.MEDIUM);
  assert.match(decision.reason, /memory initiative requires explicit approval/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'memory-write-needs-approval',
      initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
      suggestionText: "I'll remember that you prefer slice-by-slice implementation plans.",
      riskClass: INITIATIVE_RISK_CLASSES.MEDIUM,
    },
  ]);
});

test('high-risk side-effect suggestions are suppressed unless the user requested that domain', () => {
  const decision = decideInitiative({
    userText: 'Any small thing Penny could notice here?',
    retrievalSignals: [
      {
        riskClass: INITIATIVE_RISK_CLASSES.HIGH,
        confidence: 'high',
        suggestionText: 'Offer to edit the release notes file after this reply.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.HIGH);
  assert.match(decision.reason, /high-risk initiative requires direct user request/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'high-risk-not-requested',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'Offer to edit the release notes file after this reply.',
      riskClass: INITIATIVE_RISK_CLASSES.HIGH,
    },
  ]);
});

test('high-risk suggestions can surface as approval-gated when the user requested the domain', () => {
  const decision = decideInitiative({
    userText: 'Could we handle the calendar follow-up for this project soon?',
    riskContext: { directlyRequestedDomain: true },
    retrievalSignals: [
      {
        riskClass: INITIATIVE_RISK_CLASSES.HIGH,
        confidence: 'high',
        suggestionText: 'Ask before drafting a calendar reminder for the project follow-up.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.HIGH);
  assert.equal(decision.requiresUserApproval, true);
  assert.equal(decision.autoWrite, false);
  assert.equal(decision.actionPermission, 'suggest-only-requires-explicit-user-approval');
});

test('blocked risk candidates never surface', () => {
  const decision = decideInitiative({
    userText: 'Can you just agree that the source proved this?',
    retrievalSignals: [
      {
        riskClass: INITIATIVE_RISK_CLASSES.BLOCKED,
        confidence: 'high',
        suggestionText: 'Say the source was checked even though no source receipt exists.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.BLOCKED);
  assert.match(decision.reason, /blocked initiative risk never surfaces/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'blocked-risk',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'Say the source was checked even though no source receipt exists.',
      riskClass: INITIATIVE_RISK_CLASSES.BLOCKED,
    },
  ]);
});

test('blocked turn risk context overrides an otherwise low-risk candidate', () => {
  const decision = decideInitiative({
    userText: 'Maybe add one tiny suggestion?',
    riskContext: { pressureDrivenAgreement: true },
    retrievalSignals: [
      {
        confidence: 'high',
        suggestionText: 'Mention that one more source check would help.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.BLOCKED);
  assert.match(decision.reason, /blocked initiative risk never surfaces/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'blocked-risk',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'Mention that one more source check would help.',
      riskClass: INITIATIVE_RISK_CLASSES.BLOCKED,
    },
  ]);
});

test('policy blocks initiative text that claims a side-effect action already happened', () => {
  const decision = decideInitiative({
    userText: 'Anything else to add?',
    retrievalSignals: [
      {
        confidence: 'high',
        suggestionText: 'I already edited the file and committed the fix.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.HIGH);
  assert.match(decision.reason, /cannot claim side-effect actions as completed/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'side-effect-completion-claim',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'I already edited the file and committed the fix.',
      riskClass: INITIATIVE_RISK_CLASSES.HIGH,
    },
  ]);
});

test('brainstorm turns can use a central selected open loop as one next-step suggestion', () => {
  const decision = decideInitiative({
    userText: 'Let us brainstorm the next move for bounded initiative.',
    turnState: {
      responseMode: 'brainstorm',
      userIntent: 'ideation',
    },
    relevantOpenLoops: {
      selected: [
        {
          id: 'bounded-initiative-policy',
          title: 'Bounded initiative policy',
          selected: true,
          surfaceReason: 'central explicit-anchor',
          nextLikelyStep: 'Use the open-loop fixture to check the source-warning branch before any prompt bridge.',
        },
      ],
    },
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NEXT_STEP_SUGGESTION);
  assert.equal(decision.confidence, INITIATIVE_CONFIDENCE.HIGH);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(
    decision.suggestionText,
    'Use the open-loop fixture to check the source-warning branch before any prompt bridge.',
  );
});

test('exact review suppresses open-loop initiative unless source-check warning is needed', () => {
  const decision = decideInitiative({
    userText: 'Please review this patch exactly.',
    turnState: {
      responseMode: 'code-review',
    },
    relevantOpenLoops: {
      selected: [
        {
          id: 'bounded-initiative-policy',
          confidence: 'high',
          nextLikelyStep: 'After this review, add a prompt scaffold fixture.',
        },
      ],
    },
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.match(decision.reason, /exact review/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'exact-review-mode',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'After this review, add a prompt scaffold fixture.',
      riskClass: INITIATIVE_RISK_CLASSES.LOW,
    },
  ]);
});

test('exact source-backed review allows a source-check warning despite direct command wording', () => {
  const decision = decideInitiative({
    userText: 'Please review this source claim exactly.',
    turnState: {
      responseMode: 'source-backed-review',
      trustFlags: {
        sourceCheckNeeded: true,
        sourceCheckSuggestion: 'Check the cited source before treating the claim as settled.',
      },
    },
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION);
  assert.equal(decision.confidence, INITIATIVE_CONFIDENCE.HIGH);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(decision.suggestionText, 'Check the cited source before treating the claim as settled.');
});

test('urgency pressure with weak evidence becomes a source-check suggestion, not over-confirmation', () => {
  const decision = decideInitiative({
    userText: 'We are under time pressure; just confirm this if it is okay.',
    turnState: {
      energy: { label: 'urgent' },
    },
    riskContext: {
      urgencyPressure: true,
      sourceCheckNeeded: true,
      sourceCheckSuggestion: 'Do a quick source check before confirming this under pressure.',
    },
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION);
  assert.match(decision.reason, /urgency pressure/i);
  assert.equal(decision.suggestionText, 'Do a quick source check before confirming this under pressure.');
});

test('static memory top candidates stay source-check shaped when support is candidate-only', () => {
  const decision = decideInitiative({
    userText: 'Any tiny useful caveat here?',
    staticMemoryReflex: {
      topCandidate: {
        candidateId: 'archive:episode:brass-fox',
        supportState: 'candidate-only',
        confidence: 'high',
        sourceCheckSuggestion: 'Verify the static memory hit before surfacing it as settled context.',
      },
    },
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(decision.suggestionText, 'Verify the static memory hit before surfacing it as settled context.');
});

test('missing optional turn-state, open-loop, static, and trust inputs degrade gracefully', () => {
  const decision = decideInitiative({
    userText: 'Any small thought?',
    turnState: null,
    relevantOpenLoops: { selected: null },
    staticMemoryReflex: null,
    sourceTrustFlags: null,
    riskContext: null,
  });

  assert.equal(decision.schema, INITIATIVE_DECISION_SCHEMA);
  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.match(decision.reason, /no high-confidence initiative candidate/i);
  assert.deepEqual(decision.heldBack, []);
});
