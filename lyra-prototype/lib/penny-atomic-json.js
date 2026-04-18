function buildAtomicTempPath(pathModule, filePath = '', {
  nowMs = () => Date.now(),
  pid = process.pid,
  random = () => Math.random(),
} = {}) {
  if (!pathModule || typeof pathModule.dirname !== 'function' || typeof pathModule.basename !== 'function' || typeof pathModule.join !== 'function') {
    throw new TypeError('buildAtomicTempPath requires path helpers');
  }
  const dir = pathModule.dirname(filePath);
  const base = pathModule.basename(filePath);
  const stamp = Number(nowMs()).toString(36);
  const nonce = Math.floor(Number(random()) * 1e9).toString(36).padStart(6, '0');
  return pathModule.join(dir, `.${base}.${pid}.${stamp}.${nonce}.tmp`);
}

function writeJsonFileAtomicSync({
  fs,
  path,
  filePath = '',
  value = {},
} = {}) {
  if (!fs
    || typeof fs.mkdirSync !== 'function'
    || typeof fs.writeFileSync !== 'function'
    || typeof fs.renameSync !== 'function'
    || typeof fs.unlinkSync !== 'function') {
    throw new TypeError('writeJsonFileAtomicSync requires fs mkdir/write/rename/unlink helpers');
  }
  if (!path || typeof path.dirname !== 'function' || typeof path.basename !== 'function' || typeof path.join !== 'function') {
    throw new TypeError('writeJsonFileAtomicSync requires path helpers');
  }
  const target = String(filePath || '').trim();
  if (!target) throw new TypeError('writeJsonFileAtomicSync requires filePath');

  const dir = path.dirname(target);
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const tempPath = buildAtomicTempPath(path, target);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(tempPath, payload, 'utf8');
    fs.renameSync(tempPath, target);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch {}
    throw error;
  }
  return target;
}

module.exports = {
  buildAtomicTempPath,
  writeJsonFileAtomicSync,
};
