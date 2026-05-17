const fs = require('node:fs');
const path = require('node:path');

const EXCLUDED_DIRS = new Set([
  '.git',
  '.codex',
  '.openclaw',
  'node_modules',
  'output',
  'logs',
  'tmp',
  'lyra-prototype',
  '.qa-pw',
  '.playwright-cli',
  'test-results',
  'qa-transitions',
  'qa-composer-visual',
]);

const EXPERIENCE_DIR = 'review-experience';

const EXPERIENCE_ARTIFACT_PATTERNS = [
  { kind: 'voice-qa', dir: 'output', regex: /^voice-redo-qa-.*\.json$/i },
  { kind: 'memory-qa', dir: 'output', regex: /^memory-qa-.*\.json$/i },
  { kind: 'runtime-fit', dir: 'output', regex: /^runtime-fit-.*\.(?:json|md)$/i },
  { kind: 'model-eval', dir: 'output', regex: /^model-eval-.*\.json$/i },
  { kind: 'browser-smoke', dir: 'output/playwright', regex: /^penny-browser-smoke-.*\.(?:json|png)$/i },
];

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
  if (base === '.lyra-local-env.ps1' || base === '.lyra-local-preferences.json' || base === '.penny-local-preferences.json') return false;
  if (/^\.env(?:\..*)?$/i.test(base) && base !== '.env.example') return false;
  if (/\.log$/i.test(base)) return false;
  if (normalized.startsWith('data/')) {
    if (ALLOWED_DATA_FILES.has(normalized)) return true;
    if (/^data\/penny-memory(?:-archive|-embeddings|-books|-ledger)?(?:\..+)?\.json$/i.test(normalized)) return false;
  }
  return true;
}

function ensureDir(dirPath = '') {
  fs.mkdirSync(dirPath, { recursive: true });
}

function classifyExperienceArtifact(relativePath = '') {
  const normalized = normalizeRelativePath(relativePath);
  const base = path.basename(normalized);
  if (/voice-redo-qa-.*\.json$/i.test(base)) return 'voice-qa';
  if (/memory-qa-.*\.json$/i.test(base)) return 'memory-qa';
  if (/runtime-fit-.*\.(?:json|md)$/i.test(base)) return 'runtime-fit';
  if (/model-eval-.*\.json$/i.test(base)) return 'model-eval';
  if (/penny-browser-smoke-.*\.(?:json|png)$/i.test(base)) return 'browser-smoke';
  return 'operator-selected';
}

function listFilesRecursive(dirPath = '') {
  const files = [];
  if (!dirPath || !fs.existsSync(dirPath)) return files;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function findLatestMatchingArtifact(rootDir = process.cwd(), pattern = {}) {
  const searchDir = path.join(rootDir, pattern.dir || '');
  const matches = listFilesRecursive(searchDir)
    .filter((filePath) => pattern.regex?.test(path.basename(filePath)))
    .map((filePath) => ({
      filePath,
      mtimeMs: fs.statSync(filePath).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return matches[0]?.filePath || '';
}

function findLatestExperienceArtifacts(rootDir = process.cwd()) {
  return EXPERIENCE_ARTIFACT_PATTERNS
    .map((pattern) => findLatestMatchingArtifact(rootDir, pattern))
    .filter(Boolean);
}

function bundleRelativeArtifactPath(rootDir = process.cwd(), artifactPath = '') {
  const sourcePath = path.resolve(rootDir, artifactPath);
  const relative = path.relative(rootDir, sourcePath);
  const insideRoot = relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  const safeRelative = insideRoot
    ? normalizeRelativePath(relative)
    : path.basename(sourcePath);
  return normalizeRelativePath(path.join(EXPERIENCE_DIR, 'artifacts', safeRelative));
}

function copyExperienceArtifacts({
  rootDir = process.cwd(),
  bundleRoot = path.join(rootDir, 'tmp', 'review-bundle'),
  artifacts = [],
} = {}) {
  const copied = [];
  const skipped = [];
  const seenTargets = new Set();

  for (const rawPath of artifacts) {
    const sourcePath = path.resolve(rootDir, rawPath);
    const sourceForReport = normalizeRelativePath(path.relative(rootDir, sourcePath)) || String(rawPath || '');
    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      skipped.push({ source: sourceForReport, reason: 'missing-or-not-a-file' });
      continue;
    }
    const targetRelativePath = bundleRelativeArtifactPath(rootDir, sourcePath);
    if (seenTargets.has(targetRelativePath)) continue;
    seenTargets.add(targetRelativePath);
    const targetPath = path.join(bundleRoot, targetRelativePath);
    ensureDir(path.dirname(targetPath));
    fs.copyFileSync(sourcePath, targetPath);
    const stat = fs.statSync(sourcePath);
    copied.push({
      kind: classifyExperienceArtifact(sourceForReport),
      source: sourceForReport,
      bundlePath: targetRelativePath,
      bytes: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    });
  }

  return { copied, skipped };
}

function buildExperienceReviewMarkdown({
  generatedAt = new Date().toISOString(),
  artifacts = [],
  skipped = [],
} = {}) {
  const artifactRows = artifacts.length
    ? artifacts.map((item) => `| ${item.kind} | \`${item.bundlePath}\` | \`${item.source}\` |`).join('\n')
    : '| none | not included | run local QA, then rebuild with `--artifact <path>` or `--latest-experience-artifacts` |';
  const skippedRows = skipped.length
    ? `\n\n## Skipped Artifact Inputs\n\n${skipped.map((item) => `- \`${item.source}\`: ${item.reason}`).join('\n')}\n`
    : '';

  return `# Penny Experience Review Packet

Generated: ${generatedAt}

This packet exists for reviewers who can inspect the repo but cannot run live Penny locally. It does not ask them to trust vibe claims from code alone. It gives them code plus selected local run artifacts so they can judge the companion experience with receipts.

## What This Can Help Judge

- Whether Penny keeps her authored voice across ordinary chat turns.
- Whether memory recall feels natural instead of database-shaped.
- Whether correction, uncertainty, and pressure handling stay graceful.
- Whether tool use preserves the companion voice instead of collapsing into generic assistant mode.
- Whether UI, streaming, image, and expression surfaces look alive in browser smoke artifacts.
- Whether latency and local model behavior are tolerable for the tested setup.

## Boundaries

- A mock browser smoke artifact proves UI and streaming plumbing, not live model voice.
- A voice QA artifact is model and runtime specific. Check the artifact's environment, model, base URL, and timestamp.
- Fixture-only artifacts are useful for contracts, not for judging Penny's lived feel.
- These artifacts may contain private local conversation material. Keep this packet private unless the operator has reviewed it.

## Included Artifacts

| Kind | Bundle path | Original source |
| --- | --- | --- |
${artifactRows}

## Suggested Reviewer Prompt

Paste this with the bundle:

\`\`\`text
Please review PennyOS as both code and lived companion behavior. The repo shows the implementation, but the review-experience artifacts are the receipts for real or smoke-tested runs.

Please separate:
1. Code-verified claims.
2. Artifact-verified experiential claims.
3. Claims that still require a live local run.

For the experience layer, look especially at voice durability, memory naturalness, correction handling, latency, tool-use tone retention, UI/expression believability, and any moments where Penny becomes generic assistant sludge. Do not treat fixture or mock artifacts as proof of live model feel.
\`\`\`

## How To Refresh This Packet

\`\`\`powershell
npm run qa:voice:tiebreak
npm run qa:browser:smoke
npm run bundle:review:experience -- --latest-experience-artifacts --out tmp/gpt-pro-review-bundle
\`\`\`

For a llama.cpp or already-running local model runtime, preserve the loaded state and spawn disposable Penny memory against the existing OpenAI-compatible endpoint:

\`\`\`powershell
$env:PENNY_QA_STRICT_NO_MODEL_OPS='1'
$env:PENNY_QA_SPAWN_SERVER='1'
$env:PENNY_LMSTUDIO_BASE='http://127.0.0.1:18080/v1'
$env:PENNY_QA_CHAT_MODEL='your-loaded-chat-model-id'
npm run qa:voice:tiebreak
npm run bundle:review:experience -- --latest-experience-artifacts --out tmp/gpt-pro-review-bundle
\`\`\`
${skippedRows}`;
}

function writeExperienceReviewPack({
  rootDir = process.cwd(),
  bundleRoot = path.join(rootDir, 'tmp', 'review-bundle'),
  artifacts = [],
} = {}) {
  const generatedAt = new Date().toISOString();
  const artifactCopy = copyExperienceArtifacts({ rootDir, bundleRoot, artifacts });
  const manifest = {
    schema: 'penny-review-experience-pack.v1',
    generatedAt,
    artifactCount: artifactCopy.copied.length,
    artifacts: artifactCopy.copied,
    skipped: artifactCopy.skipped,
    privacyNote: 'Operator-selected local artifacts may contain private live conversation material. Review before sharing.',
  };
  const experienceDir = path.join(bundleRoot, EXPERIENCE_DIR);
  ensureDir(experienceDir);
  fs.writeFileSync(
    path.join(bundleRoot, 'REVIEW_EXPERIENCE.md'),
    buildExperienceReviewMarkdown({
      generatedAt,
      artifacts: artifactCopy.copied,
      skipped: artifactCopy.skipped,
    }),
    'utf8',
  );
  fs.writeFileSync(
    path.join(experienceDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  return {
    generatedAt,
    artifactCount: artifactCopy.copied.length,
    artifacts: artifactCopy.copied,
    skipped: artifactCopy.skipped,
    files: [
      'REVIEW_EXPERIENCE.md',
      `${EXPERIENCE_DIR}/manifest.json`,
    ],
  };
}

function copyReviewBundle({
  rootDir = process.cwd(),
  outDir = path.join(rootDir, 'tmp', 'review-bundle'),
  includeExperience = false,
  experienceArtifacts = [],
  includeLatestExperienceArtifacts = false,
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

  let experience = null;
  if (includeExperience) {
    const artifactInputs = [
      ...experienceArtifacts,
      ...(includeLatestExperienceArtifacts ? findLatestExperienceArtifacts(sourceRoot) : []),
    ];
    experience = writeExperienceReviewPack({
      rootDir: sourceRoot,
      bundleRoot,
      artifacts: artifactInputs,
    });
    copied.push(...experience.files);
    copied.push(...experience.artifacts.map((item) => item.bundlePath));
  }

  return {
    rootDir: sourceRoot,
    outDir: bundleRoot,
    copiedCount: copied.length,
    copied,
    experience,
  };
}

function hasFlag(argv = [], name = '') {
  const flag = `--${name}`;
  return argv.some((value) => String(value || '') === flag);
}

function readArgValue(argv = [], name = '') {
  const flag = `--${name}`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '');
    if (value === flag) return argv[index + 1] || '';
    if (value.startsWith(`${flag}=`)) return value.slice(flag.length + 1);
  }
  return '';
}

function readArgValues(argv = [], name = '') {
  const flag = `--${name}`;
  const values = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || '');
    if (value === flag && argv[index + 1]) values.push(argv[index + 1]);
    if (value.startsWith(`${flag}=`)) values.push(value.slice(flag.length + 1));
  }
  return values;
}

function main(argv = process.argv.slice(2)) {
  const outDir = readArgValue(argv, 'out');
  const report = copyReviewBundle({
    rootDir: process.cwd(),
    outDir: outDir ? path.resolve(process.cwd(), outDir) : undefined,
    includeExperience: hasFlag(argv, 'experience'),
    experienceArtifacts: readArgValues(argv, 'artifact'),
    includeLatestExperienceArtifacts: hasFlag(argv, 'latest-experience-artifacts'),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  copyReviewBundle,
  findLatestExperienceArtifacts,
  normalizeRelativePath,
  shouldIncludeRelativePath,
  writeExperienceReviewPack,
};
