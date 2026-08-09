const { writeJsonFileAtomicSync } = require('./penny-atomic-json');

function createDurableJsonStore({
  fs,
  path,
  filePath = '',
  name = 'durable JSON store',
  buildDefault = () => ({}),
  validate = () => true,
  normalize = (value) => value,
  ensureFile = () => {},
  backupSuffix = '.bak',
} = {}) {
  if (!fs
    || typeof fs.readFileSync !== 'function'
    || typeof fs.existsSync !== 'function'
    || typeof fs.mkdirSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function') {
    throw new TypeError('createDurableJsonStore requires readable/writable fs helpers');
  }
  if (!path || typeof path.dirname !== 'function' || typeof path.basename !== 'function' || typeof path.join !== 'function') {
    throw new TypeError('createDurableJsonStore requires path helpers');
  }
  const target = String(filePath || '').trim();
  if (!target) throw new TypeError('createDurableJsonStore requires filePath');
  if (typeof buildDefault !== 'function') throw new TypeError('createDurableJsonStore requires buildDefault');
  if (typeof validate !== 'function') throw new TypeError('createDurableJsonStore requires validate');
  if (typeof normalize !== 'function') throw new TypeError('createDurableJsonStore requires normalize');
  if (typeof ensureFile !== 'function') throw new TypeError('createDurableJsonStore requires ensureFile');

  let lastStatus = {
    ok: true,
    code: 'ok',
    filePath: target,
    message: '',
  };

  function invalidSchemaError(detail = '') {
    const suffix = String(detail || '').trim();
    const error = new Error(`${name} has an invalid schema${suffix ? `: ${suffix}` : '.'}`);
    error.code = 'invalid-schema';
    error.statusCode = 409;
    return error;
  }

  function assertValid(value) {
    const result = validate(value);
    if (result === false) throw invalidSchemaError();
    if (typeof result === 'string' && result.trim()) throw invalidSchemaError(result);
    if (result && typeof result === 'object' && result.ok === false) {
      throw invalidSchemaError(result.message || result.reason || 'validation failed.');
    }
  }

  function fallbackStatus(error) {
    const code = error?.code === 'invalid-schema'
      ? 'invalid-schema'
      : (error instanceof SyntaxError ? 'corrupt-json' : 'read-failed');
    return {
      ok: false,
      code,
      filePath: target,
      message: code === 'invalid-schema'
        ? `Penny ${name} has an invalid schema. It remains untouched until it is repaired.`
        : `Penny ${name} could not be read. It remains untouched until it is repaired.`,
    };
  }

  function readState() {
    try {
      ensureFile();
      const raw = fs.readFileSync(target, 'utf8');
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new SyntaxError(`${name} must contain a JSON object.`);
      }
      assertValid(parsed);
      const value = normalize(parsed);
      assertValid(value);
      lastStatus = {
        ok: true,
        code: 'ok',
        filePath: target,
        message: '',
      };
      return { value, status: { ...lastStatus } };
    } catch (error) {
      lastStatus = fallbackStatus(error);
      return {
        value: normalize(buildDefault()),
        status: { ...lastStatus },
      };
    }
  }

  function read() {
    return readState().value;
  }

  function write(value = buildDefault()) {
    const current = readState();
    if (!current.status.ok) {
      const error = new Error(current.status.message);
      error.code = current.status.code;
      error.statusCode = current.status.code === 'invalid-schema' ? 409 : 500;
      throw error;
    }
    assertValid(value);
    const normalized = normalize(value);
    assertValid(normalized);
    const backupPath = `${target}${backupSuffix}`;
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: backupPath,
      value: current.value,
    });
    writeJsonFileAtomicSync({
      fs,
      path,
      filePath: target,
      value: normalized,
    });
    lastStatus = {
      ok: true,
      code: 'ok',
      filePath: target,
      message: '',
    };
    return normalized;
  }

  return {
    read,
    readState,
    write,
    getStatus: () => ({ ...lastStatus }),
  };
}

module.exports = {
  createDurableJsonStore,
};
