const nodeFs = require('node:fs');
const nodePath = require('node:path');

const { writeJsonFileAtomicSync } = require('./penny-atomic-json');
const {
  OPEN_LOOP_SCHEMA,
  normalizeOpenLoopState,
  summarizeOpenLoopState,
} = require('./penny-open-loops');

const DEFAULT_OPEN_LOOP_FILE = 'data/penny-open-loops.json';
const OPEN_LOOP_STORE_ARTIFACT_SCHEMA = 'penny-open-loop-store-artifact.v1';

function cleanText(value = '', limit = 1000) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= limit ? text : `${text.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function cleanSlug(value = '', fallback = 'qa') {
  const slug = String(value || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function nowIso(nowMs = () => Date.now()) {
  const time = Number(typeof nowMs === 'function' ? nowMs() : nowMs);
  return new Date(Number.isFinite(time) ? time : Date.now()).toISOString();
}

function normalizeError(error) {
  if (!error) return null;
  return {
    name: cleanText(error.name || 'Error', 120),
    message: cleanText(error.message || String(error), 500),
    ...(error.code ? { code: cleanText(error.code, 80) } : {}),
  };
}

function requireFsHelpers(fsImpl) {
  if (!fsImpl
    || typeof fsImpl.existsSync !== 'function'
    || typeof fsImpl.readFileSync !== 'function'
    || typeof fsImpl.mkdirSync !== 'function'
    || typeof fsImpl.writeFileSync !== 'function'
    || typeof fsImpl.renameSync !== 'function'
    || typeof fsImpl.unlinkSync !== 'function') {
    throw new TypeError('createOpenLoopStoreApi requires fs helpers');
  }
}

function requirePathHelpers(pathImpl) {
  if (!pathImpl
    || typeof pathImpl.dirname !== 'function'
    || typeof pathImpl.join !== 'function'
    || typeof pathImpl.resolve !== 'function'
    || typeof pathImpl.isAbsolute !== 'function') {
    throw new TypeError('createOpenLoopStoreApi requires path helpers');
  }
}

function resolveOpenLoopFile({
  env = process.env,
  cwd = process.cwd(),
  filePath = '',
  path = nodePath,
} = {}) {
  requirePathHelpers(path);
  const configured = cleanText(filePath || env?.PENNY_OPEN_LOOP_FILE || DEFAULT_OPEN_LOOP_FILE);
  const target = configured || DEFAULT_OPEN_LOOP_FILE;
  return path.isAbsolute(target) ? target : path.resolve(cwd, target);
}

function buildEmptyOpenLoopState() {
  return normalizeOpenLoopState({
    schema: OPEN_LOOP_SCHEMA,
    updatedAt: '',
    loops: [],
  });
}

function buildOpenLoopStoreArtifact({
  operation = 'read',
  status = 'ok',
  ok = true,
  fallbackUsed = false,
  filePath = '',
  at = '',
  loopCount = 0,
  error = null,
} = {}) {
  const normalizedError = normalizeError(error);
  return {
    schema: OPEN_LOOP_STORE_ARTIFACT_SCHEMA,
    operation: cleanText(operation, 80) || 'read',
    status: cleanText(status, 120) || 'ok',
    ok: ok === true,
    fallbackUsed: fallbackUsed === true,
    filePath: cleanText(filePath, 1000),
    at: cleanText(at, 80),
    loopCount: Math.max(0, Math.round(Number(loopCount) || 0)),
    ...(normalizedError ? { error: normalizedError } : {}),
  };
}

function createOpenLoopStoreApi({
  fs = nodeFs,
  path = nodePath,
  env = process.env,
  cwd = process.cwd(),
  OPEN_LOOP_FILE = '',
  nowMs = () => Date.now(),
} = {}) {
  requireFsHelpers(fs);
  requirePathHelpers(path);

  const openLoopFile = resolveOpenLoopFile({
    env,
    cwd,
    filePath: OPEN_LOOP_FILE,
    path,
  });

  function artifact(fields = {}) {
    return buildOpenLoopStoreArtifact({
      filePath: openLoopFile,
      at: nowIso(nowMs),
      ...fields,
    });
  }

  function ensureOpenLoopFile() {
    fs.mkdirSync(path.dirname(openLoopFile), { recursive: true });
    if (fs.existsSync(openLoopFile)) {
      return artifact({ operation: 'ensure', status: 'exists', ok: true });
    }
    const state = buildEmptyOpenLoopState();
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: openLoopFile,
      value: state,
    });
    return artifact({ operation: 'ensure', status: 'created', ok: true, loopCount: 0 });
  }

  function readOpenLoopState({ createIfMissing = true } = {}) {
    if (createIfMissing) ensureOpenLoopFile();
    if (!fs.existsSync(openLoopFile)) {
      return {
        state: buildEmptyOpenLoopState(),
        artifact: artifact({
          operation: 'read',
          status: 'missing-file-fallback',
          ok: true,
          fallbackUsed: true,
          loopCount: 0,
        }),
      };
    }

    try {
      const raw = fs.readFileSync(openLoopFile, 'utf8');
      const state = normalizeOpenLoopState(raw ? JSON.parse(raw) : {});
      return {
        state,
        artifact: artifact({
          operation: 'read',
          status: 'ok',
          ok: true,
          loopCount: state.loops.length,
        }),
      };
    } catch (error) {
      return {
        state: buildEmptyOpenLoopState(),
        artifact: artifact({
          operation: 'read',
          status: 'corrupt-json-fallback',
          ok: false,
          fallbackUsed: true,
          loopCount: 0,
          error,
        }),
      };
    }
  }

  function writeOpenLoopState(stateLike = {}) {
    const state = normalizeOpenLoopState(stateLike);
    state.updatedAt = nowIso(nowMs);
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: openLoopFile,
      value: state,
    });
    return {
      state,
      artifact: artifact({
        operation: 'write',
        status: 'ok',
        ok: true,
        loopCount: state.loops.length,
      }),
    };
  }

  function summarizeStoredOpenLoops(options = {}) {
    const { state, artifact: readArtifact } = readOpenLoopState();
    return {
      summary: summarizeOpenLoopState(state, options),
      artifact: readArtifact,
    };
  }

  return {
    openLoopFile,
    ensureOpenLoopFile,
    readOpenLoopState,
    writeOpenLoopState,
    summarizeStoredOpenLoops,
  };
}

function buildDisposableOpenLoopStateConfig({
  rootDir = '',
  slug = 'qa',
  stamp = '',
  env = {},
  path = nodePath,
} = {}) {
  requirePathHelpers(path);
  const root = cleanText(rootDir, 1000);
  if (!root) throw new TypeError('buildDisposableOpenLoopStateConfig requires rootDir');
  const safeSlug = cleanSlug(slug, 'qa');
  const safeStamp = cleanSlug(stamp, '');
  const fileName = safeStamp
    ? `penny-open-loops.${safeSlug}.${safeStamp}.json`
    : `penny-open-loops.${safeSlug}.json`;
  const openLoopFile = path.join(root, fileName);
  return {
    openLoopFile,
    env: {
      ...env,
      PENNY_OPEN_LOOP_FILE: openLoopFile,
    },
    disposableFiles: [openLoopFile],
  };
}

module.exports = {
  DEFAULT_OPEN_LOOP_FILE,
  OPEN_LOOP_STORE_ARTIFACT_SCHEMA,
  buildDisposableOpenLoopStateConfig,
  buildEmptyOpenLoopState,
  buildOpenLoopStoreArtifact,
  createOpenLoopStoreApi,
  resolveOpenLoopFile,
};
