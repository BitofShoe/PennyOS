const fs = require('node:fs');
const path = require('node:path');

const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'output',
  'logs',
  'tmp',
  '.qa-pw',
  '.playwright-cli',
  'test-results',
  'qa-transitions',
  'qa-composer-visual',
]);

const ALLOWED_DATA_FILES = new Set([
  'data/penny-memory.seed.json',
  'data/penny-memory-books.seed.json',
]);

function normalizeRelativePath(relativePath = '') {
  return String(relativePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .trim();
}

function shouldIncludeRelativePath(relativePath = '') {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized) return true;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => EXCLUDED_DIRS.has(segment))) return false;
  const base = segments[segments.length - 1] || '';
  if (base === '.lyra-server.pid' || base === '.lyra-server.meta.json') return false;
  if (/\.log$/i.test(base)) return false;
  if (normalized.startsWith('data/')) {
    if (ALLOWED_DATA_FILES.has(normalized)) return true;
    if (/^data\/penny-memory(?:-archive|-embeddings|-books)?(?:\..+)?\.json$/i.test(normalized)) return false;
  }
  return true;
}

function ensureDir(dirPath = '') {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyReviewBundle({
  rootDir = process.cwd(),
  outDir = path.join(rootDir, 'tmp', 'review-bundle'),
} = {}) {
  const sourceRoot = path.resolve(rootDir);
  const bundleRoot = path.resolve(outDir);
  fs.rmSync(bundleRoot, { recursive: true, force: true });
  ensureDir(bundleRoot);
  const copied = [];

  function walk(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const sourcePath = path.join(currentDir, entry.name);
      const relativePath = normalizeRelativePath(path.relative(sourceRoot, sourcePath));
      if (!shouldIncludeRelativePath(relativePath)) continue;
      const targetPath = path.join(bundleRoot, relativePath);
      if (entry.isDirectory()) {
        ensureDir(targetPath);
        walk(sourcePath);
        continue;
      }
      ensureDir(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
      copied.push(relativePath);
    }
  }

  walk(sourceRoot);

  return {
    rootDir: sourceRoot,
    outDir: bundleRoot,
    copiedCount: copied.length,
    copied,
  };
}

function main(argv = process.argv.slice(2)) {
  const outIndex = argv.indexOf('--out');
  const outDir = outIndex >= 0 ? argv[outIndex + 1] : '';
  const report = copyReviewBundle({
    rootDir: process.cwd(),
    outDir: outDir ? path.resolve(process.cwd(), outDir) : undefined,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  copyReviewBundle,
  normalizeRelativePath,
  shouldIncludeRelativePath,
};
