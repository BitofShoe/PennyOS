const { spawnSync } = require('child_process');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || PROJECT_ROOT,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || `${command} failed`).trim();
    throw new Error(detail);
  }
  return result.stdout;
}

function normalizeRel(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function isGeneratedOrPrivateTrackedFile(rel) {
  if (!rel) return false;
  if (/^lyra-prototype\//.test(rel)) return true;
  if (/^obsidian-vault\//.test(rel)) return true;
  if (/^(?:output|artifacts|test-results|tmp|logs|node_modules)\//.test(rel)) return true;
  if (/^(?:AGENTS|BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE|HEARTBEAT|IDENTITY|MEMORY|SOUL|TOOLS|USER)\.md$/i.test(rel)) return true;
  if (/^(?:LITBITS|LYRA)(?:_MASTER_BRAIN|_OPENCLAW_COMPANION|_MASTER_BRAIN_OPENCLAW)?\.md$/i.test(rel)) return true;
  if (/^PENNY'S_BRAIN\.md$/i.test(rel)) return true;
  if (/^Personality_Reference\.md$/i.test(rel)) return true;
  if (/^(?:High and Finally Recovered|The Recovery Report|hiiiii Penny!!!! how|hiiiii penny my best pt 2) - 2026-04-09 /i.test(rel)) return true;
  if (/^penny fav \d+\.(?:png|jpg|jpeg|webp)$/i.test(rel)) return true;
  if (/^Penny's Playground\//.test(rel)) return true;
  if (/^Personality .+\.md$/i.test(rel)) return true;
  if (/^qa-.+\.png$/i.test(rel)) return true;
  if (/^lyra-server\..+\.log$/i.test(rel)) return true;
  if (/^\.lyra-/.test(rel)) return true;
  if (/^\.codex\//.test(rel)) return true;
  if (/^data\/penny-memory.*\.json$/i.test(rel)) {
    return !/^data\/penny-memory(?:-books)?\.seed\.json$/i.test(rel);
  }
  if (/^data\/penny-open-loops.*\.json$/i.test(rel)) return true;
  return false;
}

function main() {
  const repoRoot = run('git', ['rev-parse', '--show-toplevel']).trim();
  const projectRel = normalizeRel(path.relative(repoRoot, PROJECT_ROOT));
  const raw = run('git', ['ls-files', '-z', '--', projectRel ? `${projectRel}/` : '.'], { cwd: repoRoot });
  const tracked = raw
    .split('\0')
    .filter(Boolean)
    .map((filePath) => {
      const normalized = normalizeRel(filePath);
      return projectRel && normalized.startsWith(`${projectRel}/`)
        ? normalized.slice(projectRel.length + 1)
        : normalized;
    });
  const failures = tracked.filter(isGeneratedOrPrivateTrackedFile);
  if (failures.length) {
    console.error('Release artifact check failed; these files are still tracked:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(`Release artifact check passed (${tracked.length} tracked files scanned).`);
}

try {
  main();
} catch (error) {
  console.error(`Release artifact check failed: ${error.message}`);
  process.exit(1);
}
