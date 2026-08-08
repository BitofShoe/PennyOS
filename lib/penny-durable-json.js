const { writeJsonFileAtomicSync } = require('./penny-atomic-json');

function createDurableJsonStore({
  fs,
  path,
  filePath = '',
  name = 'durable JSON store',
  buildDefault = () => ({}),
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
  if (typeof normalize !== 'function') throw new TypeError('createDurableJsonStore requires normalize');
  if (typeof ensureFile !== 'function') throw new TypeError('createDurableJsonStore requires ensureFile');

  let lastStatus = {
    ok: true,
    code: 'ok',
    filePath: target,
    message: '',
  };

  function fallbackStatus(error) {
    const code = error instanceof SyntaxError ? 'corrupt-json' : 'read-failed';
    return {
      ok: false,
      code,
      filePath: target,
      message: `Penny ${name} could not be read. It remains untouched until it is repaired.`,
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
      const value = normalize(parsed);
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
      throw new Error(current.status.message);
    }
    const normalized = normalize(value);
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
