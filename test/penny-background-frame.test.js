const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  PENNY_BACKGROUND_FRAME_QUEUE_SCHEMA,
  PENNY_BACKGROUND_FRAME_JOB_SCHEMA,
  BACKGROUND_FRAME_JOB_KINDS,
  BACKGROUND_FRAME_JOB_STATUSES,
  createBackgroundFrameQueue,
} = require('../lib/penny-background-frame');

const {
  PENNY_SESSION_REFLECTION_PREP_SCHEMA,
} = require('../lib/penny-session-reflection');

function makeManualQueue(options = {}) {
  let now = Date.UTC(2026, 3, 22, 12, 0, 0);
  return {
    queue: createBackgroundFrameQueue({
      defaultDeadlineMs: 25,
      maxDeadlineMs: 50,
      maxJobsPerDrain: 5,
      nowMs: () => {
        now += 1;
        return now;
      },
      ...options,
    }),
  };
}

test('queues and drains local background jobs by priority without prompt authority changes', async () => {
  const ran = [];
  const { queue } = makeManualQueue();

  const low = queue.queueBackgroundFrameJob({
    id: 'artifact-summary',
    kind: BACKGROUND_FRAME_JOB_KINDS.ARTIFACT_SUMMARY,
    priority: 1,
    dedupeKey: 'artifact:turn-1',
    run: async () => {
      ran.push('low');
      return { status: 'ok', artifactPath: 'output/frame-summary.json' };
    },
  });
  const high = queue.queueBackgroundFrameJob({
    id: 'static-refresh',
    kind: BACKGROUND_FRAME_JOB_KINDS.STATIC_INDEX_UPDATE,
    priority: 9,
    dedupeKey: 'static:session-demo',
    candidateCount: 3,
    run: async () => {
      ran.push('high');
      return { status: 'ok', updatedCount: 2, candidateCount: 3 };
    },
  });

  assert.equal(low.schema, PENNY_BACKGROUND_FRAME_JOB_SCHEMA);
  assert.equal(low.status, BACKGROUND_FRAME_JOB_STATUSES.QUEUED);
  assert.equal(high.status, BACKGROUND_FRAME_JOB_STATUSES.QUEUED);

  const summary = await queue.drainBackgroundFrameQueue();

  assert.equal(summary.schema, PENNY_BACKGROUND_FRAME_QUEUE_SCHEMA);
  assert.deepEqual(ran, ['high', 'low']);
  assert.equal(summary.completedCount, 2);
  assert.equal(summary.pendingCount, 0);
  assert.deepEqual(summary.receipts.map((receipt) => receipt.id), ['static-refresh', 'artifact-summary']);
  assert.ok(summary.receipts.every((receipt) => receipt.runAttempted === true));
  assert.ok(summary.receipts.every((receipt) => receipt.completionClaimed === true));
  assert.equal(summary.receipts[0].resultSummary.updatedCount, 2);
  assert.equal(summary.receipts[0].frameBudgetSidecar.spendClass, 'background');
  assert.equal(summary.receipts[0].frameBudgetSidecar.status, 'scheduled');
  assert.equal(summary.receipts[0].guardrails.promptTruthExpanded, false);
  assert.equal(summary.receipts[0].guardrails.toolEvidenceReceiptChanged, false);
  assert.equal(summary.guardrails.defaultPromptLimitsRaised, false);
  assert.ok(summary.limits.some((line) => /do not prove answer quality/i.test(line)));
});

test('dedupes active work and never runs the duplicate job', async () => {
  let ran = 0;
  const { queue } = makeManualQueue();

  const first = queue.queueBackgroundFrameJob({
    id: 'open-loop-refresh-a',
    kind: BACKGROUND_FRAME_JOB_KINDS.OPEN_LOOP_REFRESH,
    dedupeKey: 'open-loop:demo',
    run: async () => {
      ran += 1;
      return { status: 'refreshed' };
    },
  });
  const duplicate = queue.queueBackgroundFrameJob({
    id: 'open-loop-refresh-b',
    kind: BACKGROUND_FRAME_JOB_KINDS.OPEN_LOOP_REFRESH,
    dedupeKey: 'open-loop:demo',
    run: async () => {
      ran += 100;
      return { status: 'should-not-run' };
    },
  });

  assert.equal(first.status, BACKGROUND_FRAME_JOB_STATUSES.QUEUED);
  assert.equal(duplicate.status, BACKGROUND_FRAME_JOB_STATUSES.DEDUPED);
  assert.equal(duplicate.runAttempted, false);
  assert.equal(duplicate.completionClaimed, false);
  assert.equal(duplicate.existingJobId, 'open-loop-refresh-a');
  assert.match(duplicate.fallback, /Existing background job/i);

  const drained = await queue.drainBackgroundFrameQueue();
  assert.equal(ran, 1);
  assert.equal(drained.completedCount, 1);
  assert.equal(drained.receipts[0].id, 'open-loop-refresh-a');
});

test('skips unsupported, non-local, approval-required, missing-runner, and over-cap jobs', async () => {
  const { queue } = makeManualQueue({ maxQueuedJobs: 1 });
  let ran = 0;

  const unsupported = queue.queueBackgroundFrameJob({
    id: 'external-sync',
    kind: 'external-sync',
    run: async () => {
      ran += 1;
    },
  });
  const nonLocal = queue.queueBackgroundFrameJob({
    id: 'cloud-pulse',
    kind: BACKGROUND_FRAME_JOB_KINDS.PULSE_CARD_PREP,
    localOnly: false,
    run: async () => {
      ran += 1;
    },
  });
  const approvalRequired = queue.queueBackgroundFrameJob({
    id: 'send-message',
    kind: BACKGROUND_FRAME_JOB_KINDS.PULSE_CARD_PREP,
    requiresApproval: true,
    run: async () => {
      ran += 1;
    },
  });
  const missingRunner = queue.queueBackgroundFrameJob({
    id: 'memory-link',
    kind: BACKGROUND_FRAME_JOB_KINDS.MEMORY_LINK_REFRESH,
  });
  const accepted = queue.queueBackgroundFrameJob({
    id: 'reflection-prep',
    kind: BACKGROUND_FRAME_JOB_KINDS.SESSION_REFLECTION_PREP,
    run: async () => {
      ran += 1;
    },
  });
  const overCap = queue.queueBackgroundFrameJob({
    id: 'artifact-summary',
    kind: BACKGROUND_FRAME_JOB_KINDS.ARTIFACT_SUMMARY,
    run: async () => {
      ran += 1;
    },
  });

  assert.equal(unsupported.status, BACKGROUND_FRAME_JOB_STATUSES.SKIPPED);
  assert.equal(unsupported.reason, 'unsupported-background-job-kind');
  assert.equal(nonLocal.reason, 'non-local-background-job');
  assert.equal(approvalRequired.reason, 'approval-required-side-effect');
  assert.equal(missingRunner.reason, 'missing-background-runner');
  assert.equal(accepted.status, BACKGROUND_FRAME_JOB_STATUSES.QUEUED);
  assert.equal(overCap.reason, 'background-queue-full');
  assert.equal(overCap.completionClaimed, false);

  const drained = await queue.drainBackgroundFrameQueue();
  assert.equal(ran, 1);
  assert.equal(drained.completedCount, 1);
});

test('missed and failed jobs do not claim completion', async () => {
  let timeoutCallback = null;
  let timeoutCleared = false;
  let releaseSlowJob = null;
  const { queue } = makeManualQueue({
    defaultDeadlineMs: 5,
    maxDeadlineMs: 10,
    scheduleTask: (fn) => {
      timeoutCallback = fn;
      return {
        unref() {},
      };
    },
  });

  queue.queueBackgroundFrameJob({
    id: 'slow-static-index',
    kind: BACKGROUND_FRAME_JOB_KINDS.STATIC_INDEX_UPDATE,
    deadlineMs: 5,
    fallback: 'Try again next background frame.',
    run: async ({ signal }) => new Promise((resolve) => {
      releaseSlowJob = () => resolve({ status: 'late' });
      if (signal) {
        signal.addEventListener('abort', () => {
          timeoutCleared = true;
        }, { once: true });
      }
    }),
  });
  queue.queueBackgroundFrameJob({
    id: 'bad-artifact-summary',
    kind: BACKGROUND_FRAME_JOB_KINDS.ARTIFACT_SUMMARY,
    deadlineMs: 10,
    run: async () => {
      throw new Error('fixture failure');
    },
  });

  const drainPromise = queue.drainBackgroundFrameQueue();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof timeoutCallback, 'function');
  timeoutCallback();
  releaseSlowJob();

  const drained = await drainPromise;
  const slow = drained.receipts.find((receipt) => receipt.id === 'slow-static-index');
  const failed = drained.receipts.find((receipt) => receipt.id === 'bad-artifact-summary');

  assert.equal(slow.status, BACKGROUND_FRAME_JOB_STATUSES.MISSED);
  assert.equal(slow.runAttempted, true);
  assert.equal(slow.completionClaimed, false);
  assert.equal(slow.frameBudgetSidecar.status, 'missed');
  assert.equal(timeoutCleared, true);
  assert.match(slow.fallback, /Try again/);
  assert.equal(failed.status, BACKGROUND_FRAME_JOB_STATUSES.FAILED);
  assert.equal(failed.runAttempted, true);
  assert.equal(failed.completionClaimed, false);
  assert.match(failed.error, /fixture failure/);
  assert.equal(failed.frameBudgetSidecar.status, 'degraded');
  assert.equal(drained.missedCount, 1);
  assert.equal(drained.failedCount, 1);
});

test('deadlines are capped and drains stay bounded', async () => {
  let ran = 0;
  const { queue } = makeManualQueue({
    maxDeadlineMs: 20,
    maxJobsPerDrain: 2,
  });

  for (let index = 0; index < 3; index += 1) {
    queue.queueBackgroundFrameJob({
      id: `artifact-${index + 1}`,
      kind: BACKGROUND_FRAME_JOB_KINDS.ARTIFACT_SUMMARY,
      deadlineMs: 9999,
      priority: index,
      run: async () => {
        ran += 1;
        return `artifact ${index + 1}`;
      },
    });
  }

  const firstDrain = await queue.drainBackgroundFrameQueue();
  assert.equal(firstDrain.drainedCount, 2);
  assert.equal(firstDrain.pendingCount, 1);
  assert.equal(firstDrain.receipts[0].deadlineMs, 20);
  assert.equal(firstDrain.receipts[0].deadlineClamped, true);
  assert.equal(ran, 2);

  const secondDrain = await queue.drainBackgroundFrameQueue();
  assert.equal(secondDrain.drainedCount, 1);
  assert.equal(secondDrain.pendingCount, 0);
  assert.equal(ran, 3);
});

test('queues session reflection prep for after-turn background work without memory writes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-session-reflection-prep-'));
  const outputPath = path.join(dir, 'reflection-prep.json');
  const { queue } = makeManualQueue({
    defaultDeadlineMs: 40,
    maxDeadlineMs: 80,
  });

  const queued = queue.queueSessionReflectionPrepJob({
    sessionId: 'session-r4',
    generatedAt: '2026-04-22T12:10:00.000Z',
    outputPath,
    turns: [
      {
        id: 'turn-1',
        role: 'user',
        text: 'I prefer detailed slice-by-slice plans.',
        scratchpad: 'hidden chain-of-thought must not be retained',
      },
      {
        id: 'turn-2',
        role: 'assistant',
        text: 'I will keep the slice bounded and verify it.',
      },
    ],
    memorySuggestions: [
      {
        text: 'User prefers detailed slice-by-slice implementation plans.',
        kind: 'user-preference',
        support: 'explicit user statement',
        requiresApproval: false,
        autoPromoted: true,
      },
    ],
  });
  const duplicate = queue.queueSessionReflectionPrepJob({
    sessionId: 'session-r4',
    generatedAt: '2026-04-22T12:10:00.000Z',
    outputPath,
    turns: [
      { id: 'turn-1', role: 'user', text: 'I prefer detailed slice-by-slice plans.' },
      { id: 'turn-2', role: 'assistant', text: 'I will keep the slice bounded and verify it.' },
    ],
  });

  assert.equal(queued.status, BACKGROUND_FRAME_JOB_STATUSES.QUEUED);
  assert.equal(queued.runAttempted, false);
  assert.equal(queued.completionClaimed, false);
  assert.equal(queued.candidateCount, 2);
  assert.equal(duplicate.status, BACKGROUND_FRAME_JOB_STATUSES.DEDUPED);
  assert.equal(duplicate.runAttempted, false);
  assert.equal(fs.existsSync(outputPath), false);

  const drained = await queue.drainBackgroundFrameQueue();
  const receipt = drained.receipts[0];
  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.equal(drained.completedCount, 1);
  assert.equal(receipt.kind, BACKGROUND_FRAME_JOB_KINDS.SESSION_REFLECTION_PREP);
  assert.equal(receipt.resultSummary.schema, PENNY_SESSION_REFLECTION_PREP_SCHEMA);
  assert.equal(receipt.resultSummary.artifactKind, 'session-reflection-prep');
  assert.equal(receipt.resultSummary.artifactPath, outputPath);
  assert.equal(receipt.resultSummary.memorySuggestionCount, 1);
  assert.equal(receipt.resultSummary.reflectionPrepared, true);
  assert.equal(receipt.resultSummary.memoryWrites, false);
  assert.equal(receipt.resultSummary.canonicalMemoryWrites, false);
  assert.equal(receipt.resultSummary.promptTruthExpanded, false);
  assert.equal(receipt.resultSummary.toolEvidenceReceiptChanged, false);
  assert.equal(artifact.schema, PENNY_SESSION_REFLECTION_PREP_SCHEMA);
  assert.equal(artifact.reflectionPrepared, true);
  assert.equal(artifact.sourceTurnCount, 2);
  assert.equal(artifact.reflection.memorySuggestions[0].requiresApproval, true);
  assert.equal(artifact.reflection.memorySuggestions[0].autoPromoted, false);
  assert.equal(artifact.reflection.memoryWrites, false);
  assert.equal(artifact.reflection.promptTruthExpanded, false);
  assert.equal(JSON.stringify(artifact).includes('hidden chain-of-thought'), false);
});
