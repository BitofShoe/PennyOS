const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const FILESYSTEM_EXCLUDED_DIRS = new Set([
  '.git',
  '.codex',
  '.openclaw',
  '.qa-pw',
  '.playwright-cli',
  'node_modules',
  'output',
  'tmp',
  'logs',
  'test-results',
  'lyra-prototype',
]);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || PROJECT_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
}

function normalizeRel(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function isGeneratedOrPrivateTrackedFile(rel) {
  const filePath = normalizeRel(rel);
  if (!filePath) return false;
  if (/^lyra-prototype\//.test(filePath)) return true;
  if (/^obsidian-vault\//.test(filePath)) return true;
  if (/^(?:output|artifacts|test-results|tmp|logs|node_modules)\//.test(filePath)) return true;
  if (/^(?:AGENTS|BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE|HEARTBEAT|IDENTITY|MEMORY|SOUL|TOOLS|USER)\.md$/i.test(filePath)) return true;
  if (/^(?:LITBITS|LYRA)(?:_MASTER_BRAIN|_OPENCLAW_COMPANION|_MASTER_BRAIN_OPENCLAW)?\.md$/i.test(filePath)) return true;
  if (/^PENNY'S_BRAIN\.md$/i.test(filePath)) return true;
  if (/^Personality_Reference\.md$/i.test(filePath)) return true;
  if (/^(?:High and Finally Recovered|The Recovery Report|hiiiii Penny!!!! how|hiiiii penny my best pt 2) - 2026-04-09 /i.test(filePath)) return true;
  if (/^penny fav \d+\.(?:png|jpg|jpeg|webp)$/i.test(filePath)) return true;
  if (/^Penny's Playground\//.test(filePath)) return true;
  if (/^Personality .+\.md$/i.test(filePath)) return true;
  if (/^qa-.+\.png$/i.test(filePath)) return true;
  if (/^debug-shadow(?:-oneline)?\.(?:js|ps1)$/i.test(filePath)) return true;
  if (/^Today's Plan\.md$/i.test(filePath)) return true;
  if (/^lyra-server\..+\.log$/i.test(filePath)) return true;
  if (/^penny-server\..+\.log$/i.test(filePath)) return true;
  if (/^\.lyra-/.test(filePath)) return true;
  if (/^\.penny-server\./.test(filePath)) return true;
  if (/^\.codex\//.test(filePath)) return true;
  if (/^data\/penny-memory.*\.json$/i.test(filePath)) {
    return !/^data\/penny-memory(?:-books)?\.seed\.json$/i.test(filePath);
  }
  if (/^data\/penny-open-loops.*\.json$/i.test(filePath)) return true;
  return false;
}

function gitReleaseFiles(rootDir = PROJECT_ROOT) {
  const root = path.resolve(rootDir);
  const revParse = run('git', ['rev-parse', '--show-toplevel'], { cwd: root });
  if (revParse.status !== 0) return null;
  const repoRoot = path.resolve(String(revParse.stdout || '').trim());
  if (repoRoot !== root) return null;
  const listed = run('git', ['ls-files', '-z', '--', '.'], { cwd: root });
  if (listed.status !== 0) return null;
  return String(listed.stdout || '')
    .split('\0')
    .filter(Boolean)
    .map(normalizeRel)
    .sort((a, b) => a.localeCompare(b));
}

function walkReleaseFiles(rootDir = PROJECT_ROOT) {
  const root = path.resolve(rootDir);
  const files = [];
  const queue = ['.'];
  while (queue.length) {
    const relDir = queue.shift();
    const absDir = relDir === '.' ? root : path.join(root, relDir);
    const entries = fs.readdirSync(absDir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    for (const entry of entries) {
      const rel = normalizeRel(relDir === '.' ? entry.name : path.join(relDir, entry.name));
      if (entry.isDirectory()) {
        if (FILESYSTEM_EXCLUDED_DIRS.has(entry.name) || FILESYSTEM_EXCLUDED_DIRS.has(rel)) continue;
        queue.push(rel);
        continue;
      }
      if (entry.isFile()) files.push(rel);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function listReleaseFiles({ rootDir = PROJECT_ROOT } = {}) {
  const gitFiles = gitReleaseFiles(rootDir);
  if (gitFiles) return { mode: 'git', files: gitFiles };
  return { mode: 'filesystem', files: walkReleaseFiles(rootDir) };
}

function main() {
  const { mode, files } = listReleaseFiles({ rootDir: PROJECT_ROOT });
  const failures = files.filter(isGeneratedOrPrivateTrackedFile);
  if (failures.length) {
    console.error(`Release artifact check failed in ${mode} mode; these files are still present:`);
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Release artifact check passed in ${mode} mode (${files.length} files scanned).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Release artifact check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  isGeneratedOrPrivateTrackedFile,
  listReleaseFiles,
  normalizeRel,
};
