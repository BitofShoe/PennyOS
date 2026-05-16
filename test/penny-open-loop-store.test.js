const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DEFAULT_OPEN_LOOP_FILE,
  OPEN_LOOP_STORE_ARTIFACT_SCHEMA,
  buildDisposableOpenLoopStateConfig,
  createOpenLoopStoreApi,
  resolveOpenLoopFile,
} = require('../lib/penny-open-loop-store');
const {
  OPEN_LOOP_SCHEMA,
  OPEN_LOOP_COMPLETION_BASES,
  OPEN_LOOP_LIFECYCLE_ACTIONS,
  OPEN_LOOP_STATUSES,
} = require('../lib/penny-open-loops');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'penny-open-loop-store-'));
}

test('resolves the default and env-configured open-loop state file', () => {
  const root = path.join(os.tmpdir(), 'penny-open-loop-resolve');

  assert.equal(
    resolveOpenLoopFile({ cwd: root, env: {} }),
    path.join(root, DEFAULT_OPEN_LOOP_FILE),
  );
  assert.equal(
    resolveOpenLoopFile({
      cwd: root,
      env: { PENNY_OPEN_LOOP_FILE: 'tmp/open-loops.json' },
    }),
    path.join(root, 'tmp/open-loops.json'),
  );

  const absolute = path.join(root, 'absolute-open-loops.json');
  assert.equal(
    resolveOpenLoopFile({
      cwd: path.join(root, 'ignored'),
      env: { PENNY_OPEN_LOOP_FILE: absolute },
    }),
    absolute,
  );
});

test('readOpenLoopState can safely fall back when a disposable file is missing', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'missing-open-loops.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 12, 0, 0),
  });

  try {
    const { state, artifact } = api.readOpenLoopState({ createIfMissing: false });

    assert.equal(fs.existsSync(filePath), false);
    assert.equal(state.schema, OPEN_LOOP_SCHEMA);
    assert.deepEqual(state.loops, []);
    assert.equal(artifact.schema, OPEN_LOOP_STORE_ARTIFACT_SCHEMA);
    assert.equal(artifact.status, 'missing-file-fallback');
    assert.equal(artifact.ok, true);
    assert.equal(artifact.fallbackUsed, true);
    assert.equal(artifact.filePath, filePath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ensureOpenLoopFile creates an empty local store in the configured path only', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'nested', 'penny-open-loops.test.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 12, 0, 0),
  });

  try {
    const artifact = api.ensureOpenLoopFile();
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.equal(artifact.status, 'created');
    assert.equal(parsed.schema, OPEN_LOOP_SCHEMA);
    assert.deepEqual(parsed.loops, []);
    assert.deepEqual(fs.readdirSync(path.dirname(filePath)), ['penny-open-loops.test.json']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('writeOpenLoopState writes normalized open-loop state atomically', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.test.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 12, 30, 0),
  });

  try {
    const { state, artifact } = api.writeOpenLoopState({
      loops: [
        {
          id: ' static-live-advisory ',
          title: ' Static live advisory ',
          status: 'active',
          priority: 'urgent',
          authority: 'canonical',
          nextStep: 'Test stale correction guardrails.',
        },
        {
          id: 'invalid-loop',
          title: 'Missing status is ignored',
        },
      ],
    });
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.equal(artifact.operation, 'write');
    assert.equal(artifact.ok, true);
    assert.equal(artifact.loopCount, 1);
    assert.equal(state.updatedAt, '2026-04-22T12:30:00.000Z');
    assert.equal(parsed.updatedAt, '2026-04-22T12:30:00.000Z');
    assert.deepEqual(parsed.loops.map((loop) => ({
      id: loop.id,
      status: loop.status,
      priority: loop.priority,
      authority: loop.authority,
      nextLikelyStep: loop.nextLikelyStep,
    })), [
      {
        id: 'static-live-advisory',
        status: OPEN_LOOP_STATUSES.IN_PROGRESS,
        priority: 'critical',
        authority: 'advisory',
        nextLikelyStep: 'Test stale correction guardrails.',
      },
    ]);
    assert.deepEqual(fs.readdirSync(root), ['penny-open-loops.test.json']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('corrupt JSON produces an explicit fallback artifact without overwriting the file', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.corrupt.json');
  fs.writeFileSync(filePath, '{ not valid json', 'utf8');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 13, 0, 0),
  });

  try {
    const { state, artifact } = api.readOpenLoopState();

    assert.equal(state.schema, OPEN_LOOP_SCHEMA);
    assert.deepEqual(state.loops, []);
    assert.equal(artifact.schema, OPEN_LOOP_STORE_ARTIFACT_SCHEMA);
    assert.equal(artifact.status, 'corrupt-json-fallback');
    assert.equal(artifact.ok, false);
    assert.equal(artifact.fallbackUsed, true);
    assert.equal(artifact.error.name, 'SyntaxError');
    assert.match(artifact.error.message, /JSON/);
    assert.equal(fs.readFileSync(filePath, 'utf8'), '{ not valid json');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('disposable QA config points PENNY_OPEN_LOOP_FILE at a temporary state file', () => {
  const root = makeTempDir();

  try {
    const config = buildDisposableOpenLoopStateConfig({
      rootDir: root,
      slug: 'runtime fit case',
      stamp: '2026-04-22T12:00:00.000Z',
      env: { KEEP: 'yes' },
    });

    assert.equal(config.env.KEEP, 'yes');
    assert.equal(config.env.PENNY_OPEN_LOOP_FILE, config.openLoopFile);
    assert.deepEqual(config.disposableFiles, [config.openLoopFile]);
    assert.equal(path.dirname(config.openLoopFile), root);
    assert.match(path.basename(config.openLoopFile), /^penny-open-loops\.runtime-fit-case\.2026-04-22t12-00-00-000z\.json$/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('createOpenLoop writes a normalized loop with source-backed lifecycle history', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.lifecycle.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 14, 0, 0),
  });

  try {
    const { state, loop, artifact } = api.createOpenLoop({
      id: ' lifecycle-ops ',
      title: ' Lifecycle operations ',
      priority: 'high',
      nextLikelyStep: 'Add safe completion and dismissal operations.',
      sourceRefs: [
        { type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' },
      ],
    }, {
      reason: 'slice-o7',
      basis: 'manual-command',
    });
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.equal(artifact.operation, 'create');
    assert.equal(artifact.ok, true);
    assert.equal(artifact.loopId, 'lifecycle-ops');
    assert.deepEqual(artifact.changedLoopIds, ['lifecycle-ops']);
    assert.equal(state.loops.length, 1);
    assert.equal(loop.status, OPEN_LOOP_STATUSES.OPEN);
    assert.equal(loop.authority, 'advisory');
    assert.equal(loop.lastTouchedAt, '2026-04-22T14:00:00.000Z');
    assert.deepEqual(loop.history.map((item) => ({
      action: item.action,
      status: item.status,
      basis: item.basis,
      reason: item.reason,
    })), [
      {
        action: OPEN_LOOP_LIFECYCLE_ACTIONS.CREATE,
        status: OPEN_LOOP_STATUSES.OPEN,
        basis: OPEN_LOOP_COMPLETION_BASES.MANUAL_COMMAND,
        reason: 'slice-o7',
      },
    ]);
    assert.deepEqual(parsed.loops[0].history, loop.history);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('updateOpenLoop preserves prior source refs and appends update receipts', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.lifecycle.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 14, 30, 0),
  });

  try {
    api.writeOpenLoopState({
      loops: [
        {
          id: 'lifecycle-ops',
          title: 'Lifecycle operations',
          status: 'in-progress',
          sourceRefs: [{ type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' }],
          history: [
            {
              action: 'create',
              at: '2026-04-22T14:00:00.000Z',
              status: 'in-progress',
              basis: 'manual-command',
              reason: 'created',
            },
          ],
        },
      ],
    });

    const { loop, artifact } = api.updateOpenLoop('lifecycle-ops', {
      priority: 'critical',
      nextLikelyStep: 'Run focused lifecycle store tests.',
      sourceRefs: [{ type: 'test', path: 'test/penny-open-loop-store.test.js' }],
    }, {
      reason: 'test-receipt-added',
      basis: 'test-receipt',
    });

    assert.equal(artifact.operation, 'update');
    assert.equal(artifact.ok, true);
    assert.equal(loop.priority, 'critical');
    assert.equal(loop.nextLikelyStep, 'Run focused lifecycle store tests.');
    assert.deepEqual(loop.sourceRefs.map((ref) => `${ref.type}:${ref.path}`), [
      'doc:docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md',
      'test:test/penny-open-loop-store.test.js',
    ]);
    assert.deepEqual(loop.history.map((item) => item.action), [
      OPEN_LOOP_LIFECYCLE_ACTIONS.CREATE,
      OPEN_LOOP_LIFECYCLE_ACTIONS.UPDATE,
    ]);
    assert.equal(loop.history[1].basis, OPEN_LOOP_COMPLETION_BASES.TEST_RECEIPT);
    assert.deepEqual(loop.history[1].sourceRefs, [
      { type: 'test', path: 'test/penny-open-loop-store.test.js' },
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('updateOpenLoop refuses terminal status shortcuts', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.lifecycle.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 15, 0, 0),
  });

  try {
    api.writeOpenLoopState({
      loops: [
        { id: 'lifecycle-ops', title: 'Lifecycle operations', status: 'in-progress' },
      ],
    });

    const created = api.createOpenLoop({
      id: 'created-completed',
      title: 'Created already completed',
      status: 'completed',
    });
    const { state, artifact } = api.updateOpenLoop('lifecycle-ops', { status: 'completed' });
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    assert.equal(created.artifact.operation, 'create');
    assert.equal(created.artifact.status, 'invalid-lifecycle-update');
    assert.equal(created.artifact.ok, false);
    assert.match(created.artifact.error.message, /cannot create terminal lifecycle status/i);
    assert.equal(artifact.operation, 'update');
    assert.equal(artifact.status, 'invalid-lifecycle-update');
    assert.equal(artifact.ok, false);
    assert.match(artifact.error.message, /terminal lifecycle status/i);
    assert.equal(state.loops[0].status, OPEN_LOOP_STATUSES.IN_PROGRESS);
    assert.equal(parsed.loops[0].status, OPEN_LOOP_STATUSES.IN_PROGRESS);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('completeOpenLoop requires an explicit allowed completion basis', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.lifecycle.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 15, 30, 0),
  });

  try {
    api.writeOpenLoopState({
      loops: [
        { id: 'lifecycle-ops', title: 'Lifecycle operations', status: 'in-progress' },
      ],
    });

    const refused = api.completeOpenLoop('lifecycle-ops', { reason: 'model vibes say done' });
    assert.equal(refused.artifact.status, 'completion-basis-required');
    assert.equal(refused.artifact.ok, false);
    assert.equal(refused.state.loops[0].status, OPEN_LOOP_STATUSES.IN_PROGRESS);

    const completed = api.completeOpenLoop('lifecycle-ops', {
      basis: 'explicit-user-statement',
      reason: 'user said the lifecycle slice is complete',
      sourceRefs: [{ type: 'conversation', id: 'turn-o7-complete' }],
    });
    const summary = api.summarizeStoredOpenLoops({ now: '2026-04-22T15:31:00.000Z' }).summary;

    assert.equal(completed.artifact.ok, true);
    assert.equal(completed.loop.status, OPEN_LOOP_STATUSES.COMPLETED);
    assert.equal(completed.loop.completedAt, '2026-04-22T15:30:00.000Z');
    assert.equal(completed.loop.history.at(-1).action, OPEN_LOOP_LIFECYCLE_ACTIONS.COMPLETE);
    assert.equal(completed.loop.history.at(-1).basis, OPEN_LOOP_COMPLETION_BASES.EXPLICIT_USER_STATEMENT);
    assert.deepEqual(summary.surfaceableLoopIds, []);
    assert.equal(summary.statusCounts[OPEN_LOOP_STATUSES.COMPLETED], 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('dismissOpenLoop and deferOpenLoop safely change resurfacing behavior', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.lifecycle.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 16, 0, 0),
  });

  try {
    api.writeOpenLoopState({
      loops: [
        { id: 'nagging-loop', title: 'Nagging loop', status: 'open' },
        { id: 'parked-loop', title: 'Parked loop', status: 'in-progress' },
      ],
    });

    const dismissed = api.dismissOpenLoop('nagging-loop', {
      reason: 'user dismissed reminder',
      sourceRefs: [{ type: 'conversation', id: 'turn-dismiss' }],
    });
    const refusedDefer = api.deferOpenLoop('nagging-loop', {
      reason: 'do not revive a dismissed loop',
    });
    const deferred = api.deferOpenLoop('parked-loop', {
      reason: 'wait for compare harness',
      nextLikelyStep: 'Revisit after O8 compare.',
      expiresAt: '2026-05-01T00:00:00.000Z',
      sourceRefs: [{ type: 'doc', path: 'docs/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md' }],
    });
    const summary = api.summarizeStoredOpenLoops({ now: '2026-04-22T16:01:00.000Z' }).summary;

    assert.equal(dismissed.loop.status, OPEN_LOOP_STATUSES.DISMISSED);
    assert.equal(dismissed.loop.dismissed, true);
    assert.equal(refusedDefer.artifact.status, 'invalid-lifecycle-update');
    assert.equal(refusedDefer.artifact.ok, false);
    assert.match(refusedDefer.artifact.error.message, /cannot reactivate/i);
    assert.equal(deferred.loop.status, OPEN_LOOP_STATUSES.DEFERRED);
    assert.equal(deferred.loop.nextLikelyStep, 'Revisit after O8 compare.');
    assert.equal(deferred.loop.surfacePolicy.expiresAt, '2026-05-01T00:00:00.000Z');
    assert.equal(deferred.loop.history.at(-1).action, OPEN_LOOP_LIFECYCLE_ACTIONS.DEFER);
    assert.deepEqual(summary.surfaceableLoopIds, ['parked-loop']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('expireOpenLoops mutates only stale active loops with deterministic history', () => {
  const root = makeTempDir();
  const filePath = path.join(root, 'penny-open-loops.lifecycle.json');
  const api = createOpenLoopStoreApi({
    fs,
    path,
    OPEN_LOOP_FILE: filePath,
    nowMs: () => Date.UTC(2026, 3, 22, 17, 0, 0),
  });

  try {
    api.writeOpenLoopState({
      loops: [
        {
          id: 'stale-loop',
          title: 'Stale loop',
          status: 'open',
          surfacePolicy: { expiresAt: '2026-04-01T00:00:00.000Z' },
        },
        {
          id: 'fresh-loop',
          title: 'Fresh loop',
          status: 'open',
          surfacePolicy: { expiresAt: '2026-05-01T00:00:00.000Z' },
        },
        {
          id: 'completed-loop',
          title: 'Completed loop',
          status: 'completed',
          completedAt: '2026-04-20T00:00:00.000Z',
          surfacePolicy: { expiresAt: '2026-04-01T00:00:00.000Z' },
        },
      ],
    });

    const result = api.expireOpenLoops({
      reason: 'surface policy expired',
      sourceRefs: [{ type: 'artifact', id: 'open-loop-expiry-clock' }],
    });

    assert.equal(result.artifact.operation, 'expire');
    assert.equal(result.artifact.ok, true);
    assert.deepEqual(result.expiredLoopIds, ['stale-loop']);
    assert.deepEqual(result.state.loops.map((loop) => ({ id: loop.id, status: loop.status })), [
      { id: 'stale-loop', status: OPEN_LOOP_STATUSES.EXPIRED },
      { id: 'fresh-loop', status: OPEN_LOOP_STATUSES.OPEN },
      { id: 'completed-loop', status: OPEN_LOOP_STATUSES.COMPLETED },
    ]);
    assert.equal(result.state.loops[0].history.at(-1).action, OPEN_LOOP_LIFECYCLE_ACTIONS.EXPIRE);
    assert.equal(result.state.loops[0].history.at(-1).basis, OPEN_LOOP_COMPLETION_BASES.DETERMINISTIC_ARTIFACT);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
