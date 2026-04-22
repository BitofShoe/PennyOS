const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PENNY_FRAME_BUDGET_SCHEMA,
  FRAME_BUDGET_EVENT_STATUSES,
  addFrameBudgetEvent,
  addFrameTiming,
  addFrameWorkCount,
  classifyFrameBudgetHealth,
  createFrameBudgetReceipt,
  normalizeFrameBudgetReceipt,
  summarizeFrameBudget,
} = require('../lib/penny-frame-budget');

test('creates a frame budget receipt schema with deterministic defaults', () => {
  const receipt = createFrameBudgetReceipt();

  assert.equal(receipt.schema, PENNY_FRAME_BUDGET_SCHEMA);
  assert.equal(receipt.generatedAt, null);
  assert.equal(receipt.lane, 'unknown');
  assert.equal(receipt.mode, 'baseline');
  assert.equal(receipt.measurementMode, 'baseline');
  assert.equal(receipt.targets.firstTokenMs, null);
  assert.equal(receipt.timings.totalPrePromptMs, null);
  assert.equal(receipt.workDone.rawCandidatesInspected, 0);
  assert.equal(receipt.workDone.estimatedPromptTokens, 0);
  assert.equal(receipt.quality.candidateSurvival, 'not-run');
  assert.equal(receipt.quality.promptTokenDelta, 0);
  assert.deepEqual(receipt.budgetEvents, []);
  assert.ok(receipt.limits.some((line) => /do not prove answer quality/i.test(line)));
  assert.ok(receipt.limits.some((line) => /not PromptTruth/i.test(line)));
});

test('normalizes null, unknown, and negative timing fields to null', () => {
  const receipt = normalizeFrameBudgetReceipt({
    generatedAt: ' 2026-04-22T12:00:00.000Z ',
    lane: 'Chat Lane',
    mode: 'Static Live Advisory',
    targets: {
      firstTokenMs: '1800',
      prePromptBudgetMs: -12,
    },
    timings: {
      turnStateMs: 'unknown',
      staticMemoryQueryMs: '12.5',
      openLoopQueryMs: null,
      promptBuildMs: -5,
      archiveRetrievalMs: '15',
      lmStudioFirstTokenMs: '901',
      modelRoundTripMs: '1200',
    },
  });

  assert.equal(receipt.generatedAt, '2026-04-22T12:00:00.000Z');
  assert.equal(receipt.lane, 'chat-lane');
  assert.equal(receipt.mode, 'static-live-advisory');
  assert.equal(receipt.targets.firstTokenMs, 1800);
  assert.equal(receipt.targets.prePromptBudgetMs, null);
  assert.equal(receipt.timings.turnStateMs, null);
  assert.equal(receipt.timings.staticMemoryQueryMs, 12.5);
  assert.equal(receipt.timings.openLoopQueryMs, null);
  assert.equal(receipt.timings.archiveRetrievalMs, 15);
  assert.equal(receipt.timings.promptBuildMs, null);
  assert.equal(receipt.timings.lmStudioFirstTokenMs, 901);
  assert.equal(receipt.timings.modelRoundTripMs, 1200);
});

test('add helpers return normalized copies without mutating the original receipt', () => {
  const original = createFrameBudgetReceipt({
    workDone: {
      rawCandidatesInspected: 2,
    },
  });
  const withTiming = addFrameTiming(original, 'candidateMergeMs', '7.25');
  const withWork = addFrameWorkCount(withTiming, 'rawCandidatesInspected', 3.9);

  assert.equal(original.timings.candidateMergeMs, null);
  assert.equal(original.workDone.rawCandidatesInspected, 2);
  assert.equal(withTiming.timings.candidateMergeMs, 7.25);
  assert.equal(withWork.workDone.rawCandidatesInspected, 5);
});

test('records budget event statuses with normalized aliases', () => {
  let receipt = createFrameBudgetReceipt();
  receipt = addFrameBudgetEvent(receipt, {
    id: 'static query deadline',
    status: 'ok',
    budgetMs: '40',
    actualMs: '12',
  });
  receipt = addFrameBudgetEvent(receipt, {
    id: 'open loop scorer',
    status: 'timeout',
    budgetMs: 20,
    actualMs: 35,
    fallback: 'held back optional open-loop bridge',
  });
  receipt = addFrameBudgetEvent(receipt, {
    id: 'turn state',
    status: 'disabled',
  });
  receipt = addFrameBudgetEvent(receipt, {
    id: 'authority gate',
    status: 'strange',
  });

  assert.deepEqual(receipt.budgetEvents.map((event) => event.status), [
    FRAME_BUDGET_EVENT_STATUSES.MET,
    FRAME_BUDGET_EVENT_STATUSES.MISSED,
    FRAME_BUDGET_EVENT_STATUSES.SKIPPED,
    FRAME_BUDGET_EVENT_STATUSES.DEGRADED,
  ]);
  assert.equal(receipt.budgetEvents[0].id, 'static-query-deadline');
  assert.equal(receipt.budgetEvents[1].fallback, 'held back optional open-loop bridge');
});

test('classifies first-token misses, prompt growth, and static-only rendered cap breaches', () => {
  const firstTokenMiss = classifyFrameBudgetHealth(createFrameBudgetReceipt({
    targets: { firstTokenMs: 1800 },
    timings: { lmStudioFirstTokenMs: 2200 },
  }));
  assert.equal(firstTokenMiss.status, 'missed');
  assert.equal(firstTokenMiss.pass, false);
  assert.equal(firstTokenMiss.firstTokenMissed, true);
  assert.ok(firstTokenMiss.reasons.includes('first-token-budget-missed'));

  const promptGrowth = classifyFrameBudgetHealth(createFrameBudgetReceipt({
    quality: { promptTokenDelta: 12 },
  }));
  assert.equal(promptGrowth.status, 'degraded');
  assert.equal(promptGrowth.promptTokenGrowth, true);
  assert.ok(promptGrowth.reasons.includes('prompt-token-growth'));

  const staticCap = classifyFrameBudgetHealth(createFrameBudgetReceipt({
    targets: { maxStaticOnlyRendered: 1 },
    workDone: { staticOnlyRendered: 2 },
  }));
  assert.equal(staticCap.status, 'missed');
  assert.equal(staticCap.staticOnlyRenderedCapBreached, true);
  assert.ok(staticCap.reasons.includes('static-only-rendered-cap-breached'));
});

test('does not treat answer-quality fields alone as frame budget proof', () => {
  const health = classifyFrameBudgetHealth(createFrameBudgetReceipt({
    quality: {
      overclaimRegression: true,
      sourceAuthorityPreserved: false,
    },
  }));

  assert.equal(health.status, 'healthy');
  assert.equal(health.pass, true);
  assert.deepEqual(health.reasons, []);
});

test('summarizes multiple frame budget receipts', () => {
  const healthy = addFrameBudgetEvent(createFrameBudgetReceipt({
    workDone: {
      rawCandidatesInspected: 7,
      candidatesSelected: 2,
      candidatesRendered: 1,
      estimatedPromptTokens: 90,
    },
    timings: {
      lmStudioFirstTokenMs: 900,
      totalPrePromptMs: 80,
    },
  }), {
    id: 'static-query-deadline',
    status: 'met',
  });
  const missed = addFrameBudgetEvent(createFrameBudgetReceipt({
    targets: {
      firstTokenMs: 1000,
    },
    timings: {
      lmStudioFirstTokenMs: 1250,
      totalPrePromptMs: 140,
    },
    workDone: {
      rawCandidatesInspected: 4,
      candidatesSelected: 1,
      estimatedPromptTokens: 120,
    },
    quality: {
      promptTokenDelta: 42,
    },
  }), {
    id: 'open-loop-deadline',
    status: 'missed',
  });

  const summary = summarizeFrameBudget([healthy, missed]);

  assert.equal(summary.schema, 'penny-frame-budget-summary.v1');
  assert.equal(summary.receiptCount, 2);
  assert.deepEqual(summary.healthCounts, {
    healthy: 1,
    degraded: 0,
    missed: 1,
  });
  assert.equal(summary.pass, false);
  assert.equal(summary.eventStatusCounts.met, 1);
  assert.equal(summary.eventStatusCounts.missed, 1);
  assert.equal(summary.workDoneTotals.rawCandidatesInspected, 11);
  assert.equal(summary.workDoneTotals.candidatesSelected, 3);
  assert.equal(summary.workDoneTotals.estimatedPromptTokens, 210);
  assert.equal(summary.maxPromptTokenDelta, 42);
  assert.equal(summary.maxFirstTokenMs, 1250);
  assert.equal(summary.maxTotalPrePromptMs, 140);
  assert.ok(summary.reasons.includes('first-token-budget-missed'));
  assert.ok(summary.reasons.includes('budget-event-missed:open-loop-deadline'));
  assert.ok(summary.limits.some((line) => /runtime shape/i.test(line)));
});
