const fs = require('node:fs');
const path = require('node:path');

const { listReleaseFiles } = require('./check-release-artifacts');

const ROOT = path.resolve(__dirname, '..');

const TEXT_EXTENSIONS = new Set([
  '',
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.txt',
  '.yml',
  '.yaml',
]);

const LEAK_PATTERNS = [
  /C:\\Users\\/i,
  /C:\/Users\//i,
  /\/mnt\/c\/Users\/malac\b/i,
  /\.openclaw[\\/]+workspace-main/i,
  /workspace-main[\\/]+lyra-prototype/i,
  /\bUsers[\\/]+malac\b/i,
];

const CURRENT_PUBLIC_DOCS = [
  'docs/README.md',
  'docs/penny-browser-manual-checklist.md',
  'docs/release-checklist.md',
  'docs/penny-for-new-developers.md',
  'docs/penny-configuration-profiles.md',
  'docs/penny-release-decisions-2026-05-18.md',
];

function normalizeRel(filePath = '') {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function isTextFile(rel) {
  return TEXT_EXTENSIONS.has(path.extname(rel).toLowerCase());
}

function isHistoricalOrLocalOperatorDoc(rel) {
  const filePath = normalizeRel(rel);
  if (!filePath.startsWith('docs/')) return false;
  if (CURRENT_PUBLIC_DOCS.includes(filePath)) return false;
  if (filePath.startsWith('docs/penny-public/')) return false;
  return true;
}

function findPublicPathLeaks({ rootDir = ROOT } = {}) {
  const { mode, files } = listReleaseFiles({ rootDir });
  const failures = [];
  for (const rel of files) {
    const filePath = normalizeRel(rel);
    if (filePath === 'scripts/check-public-path-leaks.js') continue;
    if (!isTextFile(filePath)) continue;
    if (isHistoricalOrLocalOperatorDoc(filePath)) continue;
    const abs = path.join(rootDir, filePath);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!LEAK_PATTERNS.some((pattern) => pattern.test(line))) continue;
      failures.push({
        path: filePath,
        line: index + 1,
        text: line.trim().slice(0, 220),
      });
    }
  }
  return { mode, failures };
}

function main() {
  const { mode, failures } = findPublicPathLeaks({ rootDir: ROOT });
  if (failures.length) {
    console.error(`Public path leak check failed in ${mode} mode:`);
    for (const failure of failures) {
      console.error(`- ${failure.path}:${failure.line}: ${failure.text}`);
    }
    process.exit(1);
  }
  console.log(`Public path leak check passed in ${mode} mode.`);
}

if (require.main === module) main();

module.exports = {
  findPublicPathLeaks,
  isHistoricalOrLocalOperatorDoc,
};
