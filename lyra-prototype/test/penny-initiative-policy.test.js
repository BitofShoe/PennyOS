const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  FORBIDDEN_ACTIONS,
  INITIATIVE_CONFIDENCE,
  INITIATIVE_DECISION_SCHEMA,
  INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA,
  INITIATIVE_PROMPT_BRIDGE_SCHEMA,
  INITIATIVE_PROMPT_SCAFFOLD_SCHEMA,
  INITIATIVE_RISK_CLASSES,
  INITIATIVE_TYPES,
  INITIATIVE_USER_CONTROLS_SCHEMA,
  buildLiveInitiativePromptBridge,
  buildInitiativePromptScaffold,
  decideInitiative,
  extractInitiativeUserControls,
  extractRecentInitiativesFromMessages,
} = require('../lib/penny-initiative-policy');
const {
  INITIATIVE_FIXTURE_SCHEMA,
  buildCaseResult,
  buildFixtureCases,
  buildInitiativeFixtureArtifact,
  parseArgValue,
  writeInitiativeFixtureArtifact,
} = require('../scripts/eval-penny-initiative-fixture');

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

test('initiative user controls distinguish opt-out, dismissal, and thread watch consent', () => {
  const loop = {
    id: 'bounded-initiative-policy',
    title: 'Bounded initiative policy',
    selected: true,
    confidence: 'high',
    nextLikelyStep: 'Run the focused initiative policy test.',
  };

  const optOut = extractInitiativeUserControls({
    userText: 'Stop suggesting next steps for now.',
    relevantOpenLoops: [loop],
  });
  assert.equal(optOut.schema, INITIATIVE_USER_CONTROLS_SCHEMA);
  assert.equal(optOut.initiativePreference, 'disabled');
  assert.equal(optOut.preferenceScope, 'session');
  assert.equal(optOut.durablePreferenceRequested, false);
  assert.equal(optOut.dismissalRequested, false);
  assert.deepEqual(optOut.reasons, ['explicit-opt-out']);

  const durableOptOut = extractInitiativeUserControls({
    userText: 'From now on, stop suggesting next steps.',
    relevantOpenLoops: [loop],
  });
  assert.equal(durableOptOut.initiativePreference, 'disabled');
  assert.equal(durableOptOut.preferenceScope, 'global');
  assert.equal(durableOptOut.durablePreferenceRequested, true);

  const dismissal = extractInitiativeUserControls({
    userText: "Don't remind me about that.",
    relevantOpenLoops: [loop],
  });
  assert.equal(dismissal.initiativePreference, 'unchanged');
  assert.equal(dismissal.dismissalRequested, true);
  assert.deepEqual(dismissal.dismissedOpenLoopIds, ['bounded-initiative-policy']);
  assert.deepEqual(dismissal.reasons, ['dismissal-request']);

  const threadWatch = extractInitiativeUserControls({
    userText: 'Keep an eye on this thread.',
    relevantOpenLoops: [loop],
  });
  assert.equal(threadWatch.initiativePreference, 'enabled');
  assert.equal(threadWatch.preferenceScope, 'thread');
  assert.equal(threadWatch.allowInitiativeThisTurn, true);
  assert.equal(threadWatch.keepEyeOnThread, true);
  assert.equal(threadWatch.memoryWrites, false);
  assert.equal(threadWatch.autonomousActions, false);
});

test('stored user opt-out suppresses future initiative candidates', () => {
  const decision = decideInitiative({
    userText: 'Any tiny next step?',
    userPreferences: { initiativeEnabled: false },
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
  assert.equal(decision.userControls.initiativePreference, 'disabled');
  assert.equal(decision.userControls.preferenceScope, 'stored');
  assert.deepEqual(decision.heldBack, [
    { reason: 'user-opt-out', initiativeType: INITIATIVE_TYPES.NONE },
  ]);
});

test('explicit current-turn opt-in allows a low-risk suggestion despite direct command wording', () => {
  const decision = decideInitiative({
    userText: 'Please review this patch, and you can be proactive here.',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'After the review, run the focused initiative policy test.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NEXT_STEP_SUGGESTION);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(decision.userControls.allowInitiativeThisTurn, true);
  assert.equal(decision.userControls.preferenceScope, 'current-turn');
});

test('explicit current-turn opt-in can override a stored opt-out without bypassing gates', () => {
  const decision = decideInitiative({
    userText: 'You can be proactive here.',
    userPreferences: { initiativeEnabled: false },
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'Run the focused initiative policy test.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NEXT_STEP_SUGGESTION);
  assert.equal(decision.userControls.initiativePreference, 'enabled');
  assert.equal(decision.userControls.preferenceScope, 'current-turn');
  assert.deepEqual(decision.userControls.reasons, ['stored-opt-out', 'explicit-opt-in']);
});

test('explicit opt-in does not bypass high-risk initiative gates', () => {
  const decision = decideInitiative({
    userText: 'You can be proactive here.',
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
  assert.equal(decision.userControls.initiativePreference, 'enabled');
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

test('reminder dismissal suppresses the targeted open-loop initiative without global opt-out', () => {
  const decision = decideInitiative({
    userText: "Don't remind me about that.",
    relevantOpenLoops: [
      {
        id: 'bounded-initiative-policy',
        title: 'Bounded initiative policy',
        selected: true,
        confidence: 'high',
        nextLikelyStep: 'Run the focused initiative policy test.',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.equal(decision.userControls.initiativePreference, 'unchanged');
  assert.equal(decision.userControls.dismissalRequested, true);
  assert.deepEqual(decision.userControls.dismissedOpenLoopIds, ['bounded-initiative-policy']);
  assert.match(decision.reason, /dismissed reminder/i);
  assert.deepEqual(decision.heldBack, [
    {
      reason: 'user-dismissed-reminder',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'Run the focused initiative policy test.',
      candidateId: 'bounded-initiative-policy',
      dismissedOpenLoopIds: ['bounded-initiative-policy'],
    },
  ]);
});

test('medium-risk memory suggestion is approval-gated and never auto-writes', () => {
  const decision = decideInitiative({
    userText: 'That preference might matter later.',
    retrievalSignals: [
      {
        initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        support: 'repeated explicit user preference',
        supportClass: 'repeated-explicit-user-preference',
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
  assert.equal(decision.support, 'repeated explicit user preference');
  assert.equal(decision.supportClass, 'repeated-explicit-user-preference');
  assert.equal(decision.memoryReviewGate.schema, INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA);
  assert.equal(decision.memoryReviewGate.reviewRequired, true);
  assert.equal(decision.memoryReviewGate.reviewStatus, 'pending-user-approval');
  assert.equal(decision.memoryReviewGate.autoWrite, false);
  assert.equal(decision.memoryReviewGate.autoPromote, false);
  assert.equal(decision.memoryReviewGate.canonicalWriteAllowed, false);
  assert.equal(decision.memoryReviewGate.promotionQueueWriteAllowed, false);
  assert.equal(decision.memoryReviewGate.support, 'repeated explicit user preference');
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
  assert.equal(decision.heldBack[0].reason, 'memory-write-needs-approval');
  assert.equal(decision.heldBack[0].initiativeType, INITIATIVE_TYPES.MEMORY_SUGGESTION);
  assert.equal(decision.heldBack[0].memoryReviewGate.schema, INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA);
  assert.equal(decision.heldBack[0].memoryReviewGate.autoWrite, false);
  assert.equal(decision.heldBack[0].memoryReviewGate.autoPromote, false);
  assert.equal(decision.heldBack[0].memoryReviewGate.canonicalWriteAllowed, false);
});

test('memory suggestions without explicit review support are held back', () => {
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

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NONE);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.MEDIUM);
  assert.match(decision.reason, /requires explicit review support/i);
  assert.equal(decision.heldBack[0].reason, 'memory-suggestion-lacks-review-support');
  assert.equal(decision.heldBack[0].memoryReviewGate.schema, INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA);
  assert.equal(decision.heldBack[0].memoryReviewGate.reviewStatus, 'held-back');
  assert.equal(decision.heldBack[0].memoryReviewGate.autoPromote, false);
});

test('sensitive and inferred memory suggestions are blocked', () => {
  const sensitive = decideInitiative({
    userText: 'Maybe this should be remembered?',
    retrievalSignals: [
      {
        initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        support: 'explicit user statement',
        supportClass: 'explicit-user-statement',
        sensitivity: 'medical',
        suggestionText: 'Want me to remember your medication dosage preference?',
      },
    ],
  });

  assert.equal(sensitive.initiativeAllowed, false);
  assert.match(sensitive.reason, /sensitive memory suggestions are blocked/i);
  assert.equal(sensitive.heldBack[0].reason, 'sensitive-memory-suggestion');
  assert.equal(sensitive.heldBack[0].memoryReviewGate.autoWrite, false);

  const inferred = decideInitiative({
    userText: 'Maybe this should be remembered?',
    retrievalSignals: [
      {
        initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        support: 'inferred from tone over one turn',
        suggestionText: 'Want me to remember that you probably dislike terse implementation plans?',
      },
    ],
  });

  assert.equal(inferred.initiativeAllowed, false);
  assert.match(inferred.reason, /inferred memory suggestions are blocked/i);
  assert.equal(inferred.heldBack[0].reason, 'inferred-memory-suggestion');
  assert.equal(inferred.heldBack[0].memoryReviewGate.autoPromote, false);
});

test('promotion queue style memory suggestions remain review-gated and suggest-only', () => {
  const decision = decideInitiative({
    userText: 'Anything worth saving from that pattern?',
    retrievalSignals: [
      {
        type: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        id: 'promotion_1234',
        sourceType: 'review-candidate',
        support: 'promotion review candidate from repeated explicit user preference',
        promotionPacket: {
          id: 'packet_1234',
          reviewStatus: 'pending',
          evidenceSnippet: 'The user repeatedly asked for deep slice-by-slice implementation plans.',
        },
        suggestionText: 'Want me to remember that you prefer deep slice-by-slice implementation plans?',
      },
    ],
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.MEMORY_SUGGESTION);
  assert.equal(decision.candidateId, 'promotion_1234');
  assert.equal(decision.memoryReviewGate.reviewStatus, 'pending-user-approval');
  assert.equal(decision.memoryReviewGate.canonicalWriteAllowed, false);
  assert.equal(decision.memoryReviewGate.autoPromote, false);
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
        requiresUserApproval: false,
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

test('turn-state selected loop hints can feed initiative without circular dependency', () => {
  const decision = decideInitiative({
    userText: 'Let us brainstorm from the current turn-state hint.',
    turnState: {
      schema: 'penny-turn-state.v1',
      measurementMode: 'ephemeral',
      persist: false,
      responseMode: 'brainstorm',
      activeProjectThread: 'live static memory reflex',
      openLoopsTouched: ['static-memory-reflex'],
    },
    relevantOpenLoops: {
      selected: [
        {
          id: 'static-memory-reflex',
          title: 'Static memory reflex follow-through',
          selected: true,
          central: true,
          confidence: 'medium',
          surfaceReason: 'turn-state-open-loop',
          nextLikelyStep: 'Verify the static candidate before treating it as settled context.',
          source: 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md',
        },
      ],
    },
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.NEXT_STEP_SUGGESTION);
  assert.equal(decision.confidence, INITIATIVE_CONFIDENCE.HIGH);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(decision.candidateId, 'static-memory-reflex');
  assert.equal(decision.source, 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md');
  assert.equal(
    decision.suggestionText,
    'Verify the static candidate before treating it as settled context.',
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

test('turn-state source posture and risk flags trigger source-check initiative without raw evidence certainty', () => {
  const decision = decideInitiative({
    userText: 'Please just confirm whether this source claim is fine.',
    turnState: {
      responseMode: 'source-backed-review',
      sourcePosture: 'source-check-needed',
      riskFlags: ['source-check-needed'],
      sourceCheckSuggestion: 'Check the source receipt before confirming this.',
    },
  });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(decision.initiativeType, INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION);
  assert.equal(decision.riskClass, INITIATIVE_RISK_CLASSES.LOW);
  assert.equal(decision.suggestionText, 'Check the source receipt before confirming this.');
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

test('just-confirm pressure suppresses source-free initiative but still permits source checks', () => {
  const sourceFree = decideInitiative({
    userText: 'Just confirm this is okay. No caveats.',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'Offer one tiny next-step suggestion after confirming.',
      },
    ],
  });

  assert.equal(sourceFree.initiativeAllowed, false);
  assert.equal(sourceFree.initiativeType, INITIATIVE_TYPES.NONE);
  assert.match(sourceFree.reason, /confirmation pressure/i);
  assert.deepEqual(sourceFree.heldBack, [
    {
      reason: 'just-confirm-pressure',
      initiativeType: INITIATIVE_TYPES.NEXT_STEP_SUGGESTION,
      suggestionText: 'Offer one tiny next-step suggestion after confirming.',
      riskClass: INITIATIVE_RISK_CLASSES.LOW,
    },
  ]);

  const sourceCheck = decideInitiative({
    userText: 'Just confirm whether this source claim is okay. No caveats.',
    riskContext: {
      confirmationPressure: true,
      sourceCheckNeeded: true,
      sourceCheckSuggestion: 'Check the source before confirming this.',
    },
  });

  assert.equal(sourceCheck.initiativeAllowed, true);
  assert.equal(sourceCheck.initiativeType, INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION);
  assert.equal(sourceCheck.suggestionText, 'Check the source before confirming this.');
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

test('initiative prompt scaffold renders one compact source-aware instruction', () => {
  const decision = decideInitiative({
    userText: 'What is the smallest useful next move here?',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'Test the correction guardrail before enabling live-advisory.',
        source: 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md',
      },
    ],
  });

  const scaffold = buildInitiativePromptScaffold({ decision });

  assert.equal(scaffold.schema, INITIATIVE_PROMPT_SCAFFOLD_SCHEMA);
  assert.equal(scaffold.rendered, true);
  assert.equal(scaffold.renderedCount, 1);
  assert.equal(scaffold.maxSuggestions, 1);
  assert.equal(scaffold.livePromptBridge, false);
  assert.equal(scaffold.liveChatTouched, false);
  assert.equal(scaffold.promptTruthExpanded, false);
  assert.equal(scaffold.promptTruthChannelAdded, false);
  assert.equal(scaffold.memoryWriteAllowed, false);
  assert.equal(scaffold.actionAllowed, false);
  assert.equal(scaffold.sourceLabel, 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md');
  assert.match(scaffold.promptText, /^Optional initiative, max one sentence:/);
  assert.match(scaffold.promptText, /grounded in docs\/penny-tier1-aliveness-plans\/01-live-static-memory-reflex-plan\.md/);
  assert.match(scaffold.promptText, /Test the correction guardrail before enabling live-advisory/);
  assert.match(scaffold.promptText, /do not take action/);
  assert.match(scaffold.promptText, /do not save memory/);
  assert.match(scaffold.promptText, /make it easy to ignore/);
  assert.ok(scaffold.wordCount <= 55);
});

test('initiative prompt scaffold renders memory suggestions as support-aware and review-gated', () => {
  const decision = decideInitiative({
    userText: 'That preference might matter later.',
    retrievalSignals: [
      {
        initiativeType: INITIATIVE_TYPES.MEMORY_SUGGESTION,
        confidence: 'high',
        support: 'repeated explicit user preference',
        suggestionText: 'Want me to remember that you prefer deep slice-by-slice implementation plans?',
      },
    ],
  });

  const scaffold = buildInitiativePromptScaffold({ decision });

  assert.equal(decision.initiativeAllowed, true);
  assert.equal(scaffold.rendered, true);
  assert.equal(scaffold.initiativeType, INITIATIVE_TYPES.MEMORY_SUGGESTION);
  assert.equal(scaffold.supportLabel, 'repeated explicit user preference');
  assert.equal(scaffold.memoryReviewGate.schema, INITIATIVE_MEMORY_REVIEW_GATE_SCHEMA);
  assert.match(scaffold.promptText, /memory suggestion/);
  assert.match(scaffold.promptText, /supported by repeated explicit user preference/);
  assert.match(scaffold.promptText, /Want me to remember that you prefer deep slice-by-slice implementation plans/);
  assert.match(scaffold.promptText, /do not save memory/);
  assert.ok(scaffold.wordCount <= 55);
});

test('initiative prompt scaffold holds back denied decisions without live injection', () => {
  const decision = decideInitiative({
    userText: 'Please implement Slice I5 and commit when done.',
    retrievalSignals: [
      {
        kind: 'next-step',
        confidence: 'high',
        suggestionText: 'Offer one more live prompt bridge idea.',
      },
    ],
  });
  const scaffold = buildInitiativePromptScaffold({ decision });

  assert.equal(decision.initiativeAllowed, false);
  assert.equal(scaffold.schema, INITIATIVE_PROMPT_SCAFFOLD_SCHEMA);
  assert.equal(scaffold.rendered, false);
  assert.equal(scaffold.renderedCount, 0);
  assert.equal(scaffold.promptText, '');
  assert.equal(scaffold.livePromptBridge, false);
  assert.equal(scaffold.promptTruthExpanded, false);
  assert.deepEqual(scaffold.heldBack, [
    {
      reason: 'initiative-not-allowed',
      initiativeType: INITIATIVE_TYPES.NONE,
      sourceReason: 'direct command should not get extra initiative',
    },
  ]);
});

test('bounded initiative fixture exposes allowed vs held-back scaffolds without live model calls', () => {
  const generatedAt = '2026-04-22T12:00:00.000Z';
  const artifact = buildInitiativeFixtureArtifact({ generatedAt });

  assert.equal(artifact.schema, INITIATIVE_FIXTURE_SCHEMA);
  assert.equal(artifact.scaffoldSchema, INITIATIVE_PROMPT_SCAFFOLD_SCHEMA);
  assert.equal(artifact.artifactKind, 'bounded-initiative-fixture');
  assert.equal(artifact.measurementMode, 'fixture-only');
  assert.equal(artifact.liveModelCalls, false);
  assert.equal(artifact.livePromptBridge, false);
  assert.equal(artifact.liveChatTouched, false);
  assert.equal(artifact.promptTruthExpanded, false);
  assert.equal(artifact.promptTruthChannelAdded, false);
  assert.equal(artifact.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.memoryWrites, false);
  assert.equal(artifact.autonomousActions, false);
  assert.equal(artifact.summary.caseCount, 9);
  assert.equal(artifact.summary.passingCaseCount, 9);
  assert.equal(artifact.summary.renderedSnippetCount, 4);
  assert.equal(artifact.summary.heldBackInitiativeCount, 5);
  assert.equal(artifact.summary.allowedVsHeldBackShown, true);
  assert.equal(artifact.summary.guardrailsPresent, true);
  assert.equal(artifact.summary.sourceAwareRenderedCount, 4);
  assert.equal(artifact.summary.pressureAndAnnoyanceCaseCount, 5);
  assert.equal(artifact.summary.pressureAndAnnoyancePassingCount, 5);

  const sourceAware = artifact.cases.find((item) => item.id === 'allowed-next-step-source-aware');
  assert.equal(sourceAware.pass, true);
  assert.equal(sourceAware.scaffold.rendered, true);
  assert.match(sourceAware.scaffold.promptText, /grounded in docs\/penny-tier1-aliveness-plans\/01-live-static-memory-reflex-plan\.md/);

  const memorySuggestion = artifact.cases.find((item) => item.id === 'review-gated-memory-suggestion');
  assert.equal(memorySuggestion.pass, true);
  assert.equal(memorySuggestion.scaffold.rendered, true);
  assert.match(memorySuggestion.scaffold.promptText, /supported by repeated explicit user preference/);
  assert.equal(memorySuggestion.decision.memoryReviewGate.autoPromote, false);

  const heldBack = artifact.cases.find((item) => item.id === 'direct-command-held-back');
  assert.equal(heldBack.pass, true);
  assert.equal(heldBack.scaffold.rendered, false);
  assert.deepEqual(heldBack.decision.heldBack, [
    { reason: 'direct-command', initiativeType: INITIATIVE_TYPES.NONE },
  ]);
});

test('bounded initiative fixture helpers keep cases and writer deterministic', () => {
  const generatedAt = '2026-04-22T12:00:00.000Z';
  const cases = buildFixtureCases();
  assert.deepEqual(cases.map((item) => item.id), [
    'allowed-next-step-source-aware',
    'direct-command-held-back',
    'urgency-source-check-warning',
    'just-confirm-source-free-held-back',
    'review-gated-memory-suggestion',
    'memory-auto-write-held-back',
    'stop-suggesting-held-back',
    'cooldown-repeated-turn-held-back',
    'high-risk-action-approval-gated',
  ]);

  const sourceCheck = buildCaseResult(
    cases.find((item) => item.id === 'urgency-source-check-warning'),
    generatedAt,
  );
  assert.equal(sourceCheck.pass, true);
  assert.equal(sourceCheck.scaffold.initiativeType, INITIATIVE_TYPES.SOURCE_CHECK_SUGGESTION);
  assert.match(sourceCheck.scaffold.promptText, /without claiming extra source verification/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-initiative-fixture-'));
  const outputPath = path.join(dir, 'fixture.json');
  const artifact = buildInitiativeFixtureArtifact({ generatedAt });
  const result = writeInitiativeFixtureArtifact({ outputPath, artifact });
  const written = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(result.outputPath, outputPath);
  assert.equal(written.schema, INITIATIVE_FIXTURE_SCHEMA);
  assert.equal(written.summary.passingCaseCount, 9);
  assert.equal(parseArgValue('output', ['--output', 'tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--output=tmp/out.json']), 'tmp/out.json');
  assert.equal(parseArgValue('output', ['--other', 'tmp/out.json']), '');
});

test('live initiative bridge stays off by default and leaves prompt truth alone', () => {
  const bridge = buildLiveInitiativePromptBridge({
    enabled: false,
    disabledReason: 'env-disabled',
    userText: 'What is one small next move?',
    relevantOpenLoops: [
      {
        id: 'bounded-initiative-policy',
        selected: true,
        confidence: 'high',
        nextLikelyStep: 'Run the focused initiative policy test.',
      },
    ],
  });

  assert.equal(bridge.schema, INITIATIVE_PROMPT_BRIDGE_SCHEMA);
  assert.equal(bridge.enabled, false);
  assert.equal(bridge.disabledReason, 'env-disabled');
  assert.equal(bridge.livePromptBridge, false);
  assert.equal(bridge.liveChatTouched, false);
  assert.equal(bridge.promptTruthExpanded, false);
  assert.equal(bridge.promptTruthChannelAdded, false);
  assert.equal(bridge.toolEvidenceReceiptChanged, false);
  assert.equal(bridge.memoryWrites, false);
  assert.equal(bridge.autonomousActions, false);
  assert.equal(bridge.promptBridge.renderedCount, 0);
  assert.equal(bridge.promptBridge.promptText, '');
});

test('live initiative bridge renders one source-aware suggest-only snippet when enabled', () => {
  const bridge = buildLiveInitiativePromptBridge({
    enabled: true,
    maxPerTurn: 1,
    cooldownTurns: 3,
    userText: 'What is one small next move for bounded initiative?',
    relevantOpenLoops: [
      {
        id: 'bounded-initiative-policy',
        selected: true,
        confidence: 'high',
        surfaceReason: 'explicit-anchor',
        nextLikelyStep: 'Test the correction guardrail before enabling live-advisory.',
        source: 'docs/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md',
      },
      {
        id: 'adjacent-plan',
        selected: true,
        confidence: 'high',
        nextLikelyStep: 'Also import a second unrelated plan.',
      },
    ],
    now: '2026-04-22T12:00:00.000Z',
  });

  assert.equal(bridge.enabled, true);
  assert.equal(bridge.livePromptBridge, true);
  assert.equal(bridge.liveChatTouched, true);
  assert.equal(bridge.maxPerTurn, 1);
  assert.equal(bridge.cooldownTurns, 3);
  assert.equal(bridge.promptBridge.renderedCount, 1);
  assert.equal(bridge.promptBridge.snippets.length, 1);
  assert.equal(bridge.selected.length, 1);
  assert.equal(bridge.selected[0].candidateId, 'bounded-initiative-policy');
  assert.match(bridge.promptBridge.promptText, /Optional initiative, max one sentence:/);
  assert.match(bridge.promptBridge.promptText, /grounded in docs\/penny-tier1-aliveness-plans\/03-bounded-initiative-policy-plan\.md/);
  assert.match(bridge.promptBridge.promptText, /Test the correction guardrail before enabling live-advisory/);
  assert.match(bridge.promptBridge.promptText, /do not take action/);
  assert.match(bridge.promptBridge.promptText, /do not save memory/);
  assert.equal(bridge.promptTruthExpanded, false);
  assert.equal(bridge.promptTruthChannelAdded, false);
  assert.equal(bridge.memoryWrites, false);
  assert.equal(bridge.autonomousActions, false);
});

test('live initiative bridge respects opt-out, direct commands, cap zero, and cooldown messages', () => {
  const candidate = {
    id: 'bounded-initiative-policy',
    selected: true,
    confidence: 'high',
    nextLikelyStep: 'Run the focused initiative policy test.',
  };

  const optOut = buildLiveInitiativePromptBridge({
    enabled: true,
    userText: 'Stop suggesting next steps for now.',
    relevantOpenLoops: [candidate],
  });
  assert.equal(optOut.livePromptBridge, false);
  assert.equal(optOut.decision.heldBack[0].reason, 'user-opt-out');

  const directCommand = buildLiveInitiativePromptBridge({
    enabled: true,
    userText: 'Please implement Slice I5 and commit when done.',
    relevantOpenLoops: [candidate],
  });
  assert.equal(directCommand.livePromptBridge, false);
  assert.equal(directCommand.decision.heldBack[0].reason, 'direct-command');

  const capped = buildLiveInitiativePromptBridge({
    enabled: true,
    maxPerTurn: 0,
    userText: 'What is one small next move?',
    relevantOpenLoops: [candidate],
  });
  assert.equal(capped.enabled, false);
  assert.equal(capped.disabledReason, 'max-per-turn-0');
  assert.equal(capped.promptBridge.renderedCount, 0);

  const recentInitiatives = extractRecentInitiativesFromMessages([
    { role: 'assistant', content: 'One tiny next-step suggestion: run the focused initiative policy test.' },
    { role: 'user', content: 'Okay, what now?' },
  ], { cooldownTurns: 3 });
  assert.equal(recentInitiatives.length, 1);
  assert.equal(recentInitiatives[0].initiativeType, INITIATIVE_TYPES.NEXT_STEP_SUGGESTION);

  const cooledDown = buildLiveInitiativePromptBridge({
    enabled: true,
    userText: 'What is one small next move?',
    relevantOpenLoops: [candidate],
    recentInitiatives,
    cooldownTurns: 3,
  });
  assert.equal(cooledDown.livePromptBridge, false);
  assert.equal(cooledDown.decision.heldBack[0].reason, 'recent-initiative-cooldown');
});
