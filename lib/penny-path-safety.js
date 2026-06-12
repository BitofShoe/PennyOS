const defaultFs = require('node:fs');
const defaultPath = require('node:path');

function isPathInsideRoot(root, candidate, { pathModule = defaultPath } = {}) {
  const resolvedRoot = pathModule.resolve(String(root || ''));
  const resolvedCandidate = pathModule.resolve(String(candidate || ''));
  const relative = pathModule.relative(resolvedRoot, resolvedCandidate);
  return relative === '' || (
    relative
    && !relative.startsWith('..')
    && !pathModule.isAbsolute(relative)
  );
}

function realpath(fsModule, targetPath) {
  if (typeof fsModule?.realpathSync?.native === 'function') {
    return fsModule.realpathSync.native(targetPath);
  }
  return fsModule.realpathSync(targetPath);
}

function resolveRealPathForContainment(targetPath, { fsModule = defaultFs, pathModule = defaultPath } = {}) {
  const resolvedTarget = pathModule.resolve(String(targetPath || ''));
  const missingSegments = [];
  let existingPath = resolvedTarget;
  while (!fsModule.existsSync(existingPath)) {
    const parent = pathModule.dirname(existingPath);
    if (parent === existingPath) return resolvedTarget;
    missingSegments.unshift(pathModule.basename(existingPath));
    existingPath = parent;
  }
  return missingSegments.length
    ? pathModule.join(realpath(fsModule, existingPath), ...missingSegments)
    : realpath(fsModule, existingPath);
}

function isRealPathInsideRoot(root, candidate, { fsModule = defaultFs, pathModule = defaultPath } = {}) {
  const realRoot = resolveRealPathForContainment(root, { fsModule, pathModule });
  const realCandidate = resolveRealPathForContainment(candidate, { fsModule, pathModule });
  return isPathInsideRoot(realRoot, realCandidate, { pathModule });
}

module.exports = {
  isPathInsideRoot,
  isRealPathInsideRoot,
  resolveRealPathForContainment,
};
