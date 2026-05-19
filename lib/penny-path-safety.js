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

module.exports = {
  isPathInsideRoot,
};
