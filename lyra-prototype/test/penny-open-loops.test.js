const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OPEN_LOOP_SCHEMA,
  OPEN_LOOP_STATUSES,
  classifyOpenLoopStatus,
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
