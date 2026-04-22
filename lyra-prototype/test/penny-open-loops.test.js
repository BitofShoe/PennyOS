const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPEN_LOOP_SCHEMA,
  OPEN_LOOP_PROMPT_BRIDGE_SCHEMA,
  OPEN_LOOP_STATUSES,
  applyOpenLoopDismissals,
  buildLiveOpenLoopPromptBridge,
  buildOpenLoopPromptBridgeFixture,
  classifyOpenLoopStatus,
  formatOpenLoopPromptBridgeSnippet,
  mergeOpenLoopPromptBridgeIntoArchiveContext,
  normalizeOpenLoop,
  normalizeOpenLoopState,
  selectRelevantOpenLoops,
  summarizeOpenLoopState,
} = require('../lib/penny-open-loops');

const NOW = '2026-04-22T12:00:00.000Z';

test('normalizes required open-loop fields and safe defaults', () => {
  const loop = normalizeOpenLoop({
    id: ' static-live-advisory ',
    title: ' Static embeddings live advisory ',
    status: 'in progress',
    priority: 'high',
    lastTouchedAt: '2026-04-22T09:30:00-07:00',
    nextStep: 'Test correction guardrails before enabling live advisory.',
    sourceRefs: [
      { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
      { type: 'conversation', id: 'turn-123', label: 'Plan handoff' },
    ],
    surfacePolicy: {
      mode: 'relevant',
      maxSurfaceCount: 2,
      expiresAt: '2026-05-22',
    },
  });

  assert.equal(loop.id, 'static-live-advisory');
  assert.equal(loop.title, 'Static embeddings live advisory');
  assert.equal(loop.status, OPEN_LOOP_STATUSES.IN_PROGRESS);
  assert.equal(loop.priority, 'high');
  assert.equal(loop.authority, 'advisory');
  assert.equal(loop.confidence, 'medium');
  assert.equal(loop.lastTouchedAt, '2026-04-22T16:30:00.000Z');
  assert.equal(loop.nextLikelyStep, 'Test correction guardrails before enabling live advisory.');
  assert.deepEqual(loop.sourceRefs, [
    { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
    { type: 'conversation', id: 'turn-123', label: 'Plan handoff' },
  ]);
  assert.deepEqual(loop.surfacePolicy, {
    mode: 'relevant-only',
    maxSurfaceCount: 2,
    expiresAt: '2026-05-22T00:00:00.000Z',
  });
  assert.equal(loop.dismissed, false);
  assert.equal(loop.completedAt, null);
});

test('rejects open loops missing id title or status', () => {
  assert.equal(normalizeOpenLoop({ title: 'Missing id', status: 'open' }), null);
  assert.equal(normalizeOpenLoop({ id: 'missing-title', status: 'open' }), null);
  assert.equal(normalizeOpenLoop({ id: 'missing-status', title: 'Missing status' }), null);
  assert.equal(normalizeOpenLoop({ id: 'bad-status', title: 'Bad status', status: 'vibes' }), null);
  assert.deepEqual(normalizeOpenLoopState({
    loops: [
      { id: 'valid', title: 'Valid loop', status: 'open' },
      { id: '', title: 'Invalid loop', status: 'open' },
    ],
  }).loops.map((loop) => loop.id), ['valid']);
});

test('classifies stale loops as expired without mutating the stored status', () => {
  const loop = normalizeOpenLoop({
    id: 'deterministic-extraction',
    title: 'Deterministic extraction later branch',
    status: 'deferred',
    surfacePolicy: {
      expiresAt: '2026-04-01T00:00:00.000Z',
    },
  });

  assert.equal(loop.status, OPEN_LOOP_STATUSES.DEFERRED);
  assert.equal(classifyOpenLoopStatus(loop, NOW), OPEN_LOOP_STATUSES.EXPIRED);
});

test('completed and dismissed loops do not surface', () => {
  const state = normalizeOpenLoopState({
    updatedAt: NOW,
    loops: [
      {
        id: 'active-static',
        title: 'Static memory reflex',
        status: 'open',
        nextLikelyStep: 'Review live-advisory results.',
      },
      {
        id: 'completed-gemma-watch',
        title: 'Gemma runtime watch',
        status: 'completed',
        completedAt: '2026-04-21T23:30:00.000Z',
        nextLikelyStep: 'No follow-up unless LM Studio exposes new knobs.',
      },
      {
        id: 'dismissed-extraction',
        title: 'Deterministic extraction',
        status: 'open',
        dismissed: true,
        nextLikelyStep: 'Wait for a concrete document use case.',
      },
      {
        id: 'expired-provider-check',
        title: 'Provider comparison',
        status: 'in-progress',
        nextLikelyStep: 'Compare providers again.',
        surfacePolicy: {
          expiresAt: '2026-04-01T00:00:00.000Z',
        },
      },
    ],
  });
  const summary = summarizeOpenLoopState(state, { now: NOW });

  assert.equal(state.schema, OPEN_LOOP_SCHEMA);
  assert.equal(summary.totalCount, 4);
  assert.equal(summary.statusCounts[OPEN_LOOP_STATUSES.OPEN], 1);
  assert.equal(summary.statusCounts[OPEN_LOOP_STATUSES.COMPLETED], 1);
  assert.equal(summary.statusCounts[OPEN_LOOP_STATUSES.DISMISSED], 1);
  assert.equal(summary.statusCounts[OPEN_LOOP_STATUSES.EXPIRED], 1);
  assert.deepEqual(summary.surfaceableLoopIds, ['active-static']);
  assert.deepEqual(summary.nextLikelySteps.map((item) => item.id), ['active-static']);
  assert.equal(summary.nextLikelySteps[0].authority, 'advisory');
});

test('authority stays advisory even when raw input overstates it', () => {
  const loop = normalizeOpenLoop({
    id: 'candidate-survival',
    title: 'Candidate survival follow-through',
    status: 'open',
    authority: 'canonical',
    confidence: 'high',
  });

  assert.equal(loop.authority, 'advisory');
  assert.equal(loop.confidence, 'high');
});

test('surface policy can intentionally hold back otherwise active loops', () => {
  const summary = summarizeOpenLoopState({
    loops: [
      {
        id: 'manual-loop',
        title: 'Manual-only loop',
        status: 'open',
        surfacePolicy: { mode: 'manual-only' },
      },
      {
        id: 'zero-count-loop',
        title: 'Zero surface count loop',
        status: 'in-progress',
        maxSurfaceCount: 0,
      },
    ],
  }, { now: NOW });

  assert.equal(summary.activeCount, 2);
  assert.equal(summary.surfaceableCount, 0);
  assert.deepEqual(summary.surfaceableLoopIds, []);
  assert.equal(summary.heldBackCount, 2);
});

test('selects an explicitly mentioned open loop and holds adjacent loops back', () => {
  const result = selectRelevantOpenLoops({
    now: NOW,
    userText: 'Please continue static live-advisory and check the correction guardrails.',
    loops: [
      {
        id: 'static-live-advisory',
        title: 'Static embeddings live advisory',
        status: 'in-progress',
        priority: 'high',
        lastTouchedAt: '2026-04-22T08:00:00.000Z',
        nextLikelyStep: 'Test stale correction guardrails before enabling live advisory.',
      },
      {
        id: 'deterministic-extraction',
        title: 'Deterministic extraction fixture plan',
        status: 'deferred',
        priority: 'high',
        lastTouchedAt: '2026-04-22T08:00:00.000Z',
        nextLikelyStep: 'Wait for a concrete document extraction use case.',
      },
    ],
  });

  assert.deepEqual(result.selected.map((loop) => loop.id), ['static-live-advisory']);
  assert.equal(result.selected[0].surfaceReason, 'explicit-anchor+recent-open-loop');
  assert.equal(result.selected[0].confidence, 'high');
  assert.match(result.selected[0].promptSnippet, /Authority: advisory\./);
  assert.deepEqual(result.heldBack.map((loop) => ({ id: loop.id, reason: loop.reason })), [
    { id: 'deterministic-extraction', reason: 'adjacent-not-central' },
  ]);
});

test('static memory candidate relation can select a relevant open loop without making it canonical', () => {
  const result = selectRelevantOpenLoops({
    now: NOW,
    userText: 'That memory result seems relevant; keep going.',
    staticCandidates: [
      {
        openLoopId: 'static-memory-reflex',
        text: 'Static memory reflex candidate from the current turn.',
      },
    ],
    loops: [
      {
        id: 'static-memory-reflex',
        title: 'Static memory reflex follow-through',
        status: 'open',
        lastTouchedAt: '2026-04-22T09:00:00.000Z',
        nextLikelyStep: 'Use the static candidate as advisory discovery only.',
      },
    ],
  });

  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0].id, 'static-memory-reflex');
  assert.equal(result.selected[0].surfaceReason, 'static-candidate-direct+recent-open-loop');
  assert.match(result.selected[0].promptSnippet, /Authority: advisory\./);
});

test('turn-state open-loop touches can select a relevant loop without text overreach', () => {
  const result = selectRelevantOpenLoops({
    now: NOW,
    userText: 'That candidate seems relevant; keep going from there.',
    turnState: {
      schema: 'penny-turn-state.v1',
      measurementMode: 'ephemeral',
      persist: false,
      activeProjectThread: 'live static memory reflex',
      openLoopsTouched: ['static-memory-reflex'],
    },
    loops: [
      {
        id: 'static-memory-reflex',
        title: 'Static memory reflex follow-through',
        status: 'open',
        priority: 'medium',
        lastTouchedAt: '2026-04-22T09:00:00.000Z',
        nextLikelyStep: 'Use the static candidate as advisory discovery only.',
        sourceRefs: [
          { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/01-live-static-memory-reflex-plan.md' },
        ],
      },
      {
        id: 'bounded-initiative-policy',
        title: 'Bounded initiative policy',
        status: 'open',
        priority: 'high',
        lastTouchedAt: '2026-04-22T09:00:00.000Z',
        nextLikelyStep: 'Run the initiative fixture.',
      },
    ],
  });

  assert.deepEqual(result.selected.map((loop) => loop.id), ['static-memory-reflex']);
  assert.equal(result.selected[0].surfaceReason, 'turn-state-open-loop+recent-open-loop');
  assert.equal(result.selected[0].selected, true);
  assert.equal(result.selected[0].central, true);
  assert.equal(result.selected[0].authority, 'advisory');
  assert.equal(result.selected[0].nextLikelyStep, 'Use the static candidate as advisory discovery only.');
  assert.deepEqual(result.heldBack.map((loop) => ({ id: loop.id, reason: loop.reason })), [
    { id: 'bounded-initiative-policy', reason: 'adjacent-not-central' },
  ]);
});

test('dismissed and expired loops never surface even when mentioned', () => {
  const result = selectRelevantOpenLoops({
    now: NOW,
    userText: 'Continue static live-advisory and provider comparison.',
    loops: [
      {
        id: 'static-live-advisory',
        title: 'Static embeddings live advisory',
        status: 'open',
        dismissed: true,
      },
      {
        id: 'provider-comparison',
        title: 'Provider comparison',
        status: 'in-progress',
        surfacePolicy: {
          expiresAt: '2026-04-01T00:00:00.000Z',
        },
      },
    ],
  });

  assert.deepEqual(result.selected, []);
  assert.deepEqual(result.heldBack, [
    { id: 'static-live-advisory', reason: 'dismissed-suppressed' },
    { id: 'provider-comparison', reason: 'expired-suppressed' },
  ]);
});

test('applies user dismissal controls to targeted open loops without store writes', () => {
  const result = applyOpenLoopDismissals({
    updatedAt: '2026-04-22T11:00:00.000Z',
    loops: [
      {
        id: 'nagging-loop',
        title: 'Nagging loop',
        status: 'open',
        nextLikelyStep: 'Bring this up again.',
      },
      {
        id: 'done-loop',
        title: 'Done loop',
        status: 'completed',
        completedAt: '2026-04-22T10:00:00.000Z',
      },
      {
        id: 'other-loop',
        title: 'Other loop',
        status: 'open',
      },
    ],
  }, {
    now: NOW,
    dismissedOpenLoopIds: ['nagging-loop', 'done-loop', 'missing-loop'],
    reason: 'user said not to remind them about that',
    sourceRefs: [{ type: 'conversation', id: 'turn-dismissal' }],
  });
  const dismissed = result.state.loops.find((loop) => loop.id === 'nagging-loop');
  const summary = summarizeOpenLoopState(result.state, { now: NOW });

  assert.equal(result.schema, OPEN_LOOP_SCHEMA);
  assert.equal(result.memoryWrites, false);
  assert.equal(result.autonomousActions, false);
  assert.deepEqual(result.dismissedLoopIds, ['nagging-loop']);
  assert.deepEqual(result.heldBack, [
    { id: 'done-loop', reason: 'completed-not-dismissed' },
    { id: 'missing-loop', reason: 'loop-not-found' },
  ]);
  assert.equal(dismissed.status, OPEN_LOOP_STATUSES.DISMISSED);
  assert.equal(dismissed.dismissed, true);
  assert.equal(dismissed.history.at(-1).action, 'dismiss');
  assert.equal(dismissed.history.at(-1).reason, 'user said not to remind them about that');
  assert.deepEqual(summary.surfaceableLoopIds, ['other-loop']);
});

test('maxLoops cap keeps extra relevant open loops out of the selected list', () => {
  const result = selectRelevantOpenLoops({
    now: NOW,
    maxLoops: 1,
    userText: 'Continue static live-advisory and candidate survival follow-through.',
    loops: [
      {
        id: 'static-live-advisory',
        title: 'Static embeddings live advisory',
        status: 'in-progress',
        priority: 'critical',
        lastTouchedAt: '2026-04-22T08:00:00.000Z',
      },
      {
        id: 'candidate-survival',
        title: 'Candidate survival follow-through',
        status: 'open',
        priority: 'high',
        lastTouchedAt: '2026-04-22T08:00:00.000Z',
      },
    ],
  });

  assert.equal(result.selected.length, 1);
  assert.equal(result.selected[0].id, 'static-live-advisory');
  assert.deepEqual(result.heldBack.map((loop) => ({ id: loop.id, reason: loop.reason })), [
    { id: 'candidate-survival', reason: 'max-loop-cap' },
  ]);
});

test('builds a compact advisory prompt bridge without live runtime effects', () => {
  const bridge = buildOpenLoopPromptBridgeFixture({
    now: NOW,
    userText: 'Start Slice O5 for the open-loop prompt bridge and keep the other deferred plan parked.',
    loops: [
      {
        id: 'open-loop-prompt-bridge',
        title: 'Open-loop prompt bridge fixture',
        status: 'in-progress',
        priority: 'high',
        lastTouchedAt: '2026-04-22T10:00:00.000Z',
        nextLikelyStep: 'Build the fixture bridge before live wiring.',
        sourceRefs: [
          { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
        ],
      },
      {
        id: 'deterministic-extraction',
        title: 'Deterministic extraction fixture plan',
        status: 'deferred',
        priority: 'high',
        lastTouchedAt: '2026-04-22T09:00:00.000Z',
        nextLikelyStep: 'Wait for a concrete document use case.',
      },
    ],
  });

  assert.equal(bridge.schema, OPEN_LOOP_PROMPT_BRIDGE_SCHEMA);
  assert.equal(bridge.measurementMode, 'fixture-only');
  assert.equal(bridge.livePromptBridge, false);
  assert.equal(bridge.liveChatTouched, false);
  assert.equal(bridge.promptTruthExpanded, false);
  assert.equal(bridge.promptTruthChannelAdded, false);
  assert.deepEqual(bridge.selected.map((item) => item.id), ['open-loop-prompt-bridge']);
  assert.deepEqual(bridge.heldBack.map((item) => ({ id: item.id, reason: item.reason })), [
    { id: 'deterministic-extraction', reason: 'adjacent-not-central' },
  ]);
  assert.equal(bridge.promptBridge.renderedCount, 1);
  assert.match(bridge.promptBridge.promptText, /Open loop candidate, advisory:/);
  assert.match(bridge.promptBridge.promptText, /Relevance: explicit-anchor\+recent-open-loop\./);
  assert.match(bridge.promptBridge.promptText, /Source: doc docs\/penny-tier1-aliveness-plans\/02-open-loop-tracker-plan\.md\./);
  assert.match(bridge.promptBridge.promptText, /Do not treat this as canonical memory or overclaim its status\./);
  assert.ok(bridge.selected[0].wordCount <= 120);
});

test('prompt bridge formatter keeps the no-overclaim guardrail under the word cap', () => {
  const snippet = formatOpenLoopPromptBridgeSnippet({
    maxWords: 80,
    selection: { surfaceReason: 'static-candidate-direct+recent-open-loop' },
    loop: {
      id: 'static-memory-reflex',
      title: 'Static memory reflex follow-through with deliberately long source context',
      status: 'open',
      nextLikelyStep: 'Use the static candidate as advisory discovery only, then run correction guardrail checks before considering live advisory behavior.',
      sourceRefs: [
        { type: 'reflection', id: 'reflection-static-memory-reflex', label: 'fixture with extra words' },
      ],
    },
  });
  const wordCount = (snippet.match(/\S+/g) || []).length;

  assert.ok(wordCount <= 80);
  assert.match(snippet, /Open loop candidate, advisory:/);
  assert.match(snippet, /Surface only if directly relevant/);
  assert.match(snippet, /Do not treat this as canonical memory or overclaim its status\./);
});

test('live prompt bridge stays off by default and does not render context', () => {
  const bridge = buildLiveOpenLoopPromptBridge({
    now: NOW,
    enabled: false,
    disabledReason: 'env-disabled',
    userText: 'Continue Slice O6 for the open-loop prompt bridge.',
    state: {
      loops: [
        {
          id: 'live-open-loop-bridge',
          title: 'Live bounded open-loop bridge',
          status: 'in-progress',
          lastTouchedAt: '2026-04-22T10:00:00.000Z',
          nextLikelyStep: 'Wire the fixture bridge into live prompt context behind a flag.',
        },
      ],
    },
  });

  assert.equal(bridge.measurementMode, 'live-advisory');
  assert.equal(bridge.enabled, false);
  assert.equal(bridge.disabledReason, 'env-disabled');
  assert.equal(bridge.livePromptBridge, false);
  assert.equal(bridge.liveChatTouched, false);
  assert.equal(bridge.promptBridge.renderedCount, 0);
  assert.equal(bridge.promptBridge.promptText, '');
  assert.deepEqual(bridge.selected, []);
});

test('live prompt bridge renders at most one relevant advisory loop', () => {
  const bridge = buildLiveOpenLoopPromptBridge({
    now: NOW,
    enabled: true,
    maxRendered: 1,
    maxTokens: 70,
    userText: 'Start Slice O6 for the live bounded open-loop bridge.',
    state: {
      loops: [
        {
          id: 'live-open-loop-bridge',
          title: 'Live bounded open-loop bridge',
          status: 'in-progress',
          priority: 'high',
          lastTouchedAt: '2026-04-22T10:00:00.000Z',
          nextLikelyStep: 'Wire one advisory snippet into prompt context behind a flag.',
          sourceRefs: [
            { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
          ],
        },
        {
          id: 'deterministic-extraction',
          title: 'Deterministic extraction fixture plan',
          status: 'deferred',
          priority: 'high',
          lastTouchedAt: '2026-04-22T10:00:00.000Z',
          nextLikelyStep: 'Wait for a concrete document extraction use case.',
        },
      ],
    },
  });

  assert.equal(bridge.measurementMode, 'live-advisory');
  assert.equal(bridge.enabled, true);
  assert.equal(bridge.livePromptBridge, true);
  assert.equal(bridge.liveChatTouched, true);
  assert.equal(bridge.promptTruthExpanded, false);
  assert.equal(bridge.promptTruthChannelAdded, false);
  assert.deepEqual(bridge.selected.map((item) => item.id), ['live-open-loop-bridge']);
  assert.deepEqual(bridge.heldBack.map((item) => ({ id: item.id, reason: item.reason })), [
    { id: 'deterministic-extraction', reason: 'adjacent-not-central' },
  ]);
  assert.equal(bridge.promptBridge.renderedCount, 1);
  assert.match(bridge.promptBridge.promptText, /Open loop candidate, advisory:/);
  assert.match(bridge.promptBridge.promptText, /Do not treat this as canonical memory or overclaim its status\./);
  assert.ok(bridge.selected[0].wordCount <= 70);
});

test('live bridge merge replaces ungated archive open loops while enabled', () => {
  const bridge = buildLiveOpenLoopPromptBridge({
    now: NOW,
    enabled: true,
    userText: 'Continue the open-loop bridge.',
    loops: [
      {
        id: 'open-loop-bridge',
        title: 'Open-loop bridge follow-through',
        status: 'open',
        priority: 'high',
        lastTouchedAt: '2026-04-22T10:00:00.000Z',
        nextLikelyStep: 'Keep only the selected advisory loop in the live wake state.',
      },
    ],
  });
  const archiveContext = mergeOpenLoopPromptBridgeIntoArchiveContext({
    archiveContext: {
      openLoops: [
        { id: 'old-adjacent-loop', text: 'Adjacent unresolved topic that should not bleed in.', status: 'open' },
      ],
    },
    bridge,
  });

  assert.equal(archiveContext.openLoops.length, 1);
  assert.equal(archiveContext.openLoops[0].id, 'open-loop-bridge');
  assert.equal(archiveContext.openLoops[0].authority, 'advisory');
  assert.equal(archiveContext.openLoops[0].source, 'penny-open-loop-state');
  assert.doesNotMatch(archiveContext.openLoops[0].text, /Adjacent unresolved topic/);
  assert.equal(archiveContext.openLoopPromptBridge.renderedCount, 1);
  assert.deepEqual(archiveContext.openLoopPromptBridge.selectedIds, ['open-loop-bridge']);
  assert.equal(archiveContext.openLoopPromptBridge.promptTruthChannelAdded, false);
});
