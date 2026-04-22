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
