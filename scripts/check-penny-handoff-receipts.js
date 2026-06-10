const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_BUCKETS = [
  { name: 'Files Read', aliases: ['Files Read', 'Files read locally'] },
  { name: 'Files Edited', aliases: ['Files Edited', 'Files changed', 'Files written'] },
  { name: 'Verification', aliases: ['Verification', 'Verification Commands', 'Commands run'] },
  { name: 'Artifacts', aliases: ['Artifacts', 'Artifact Scope/Limits'] },
  { name: 'Git Actions', aliases: ['Git Actions'] },
  { name: 'Not Run', aliases: ['Not Run', 'Checks not run'] },
];

const ENVIRONMENT_LABELS = [
  'cloud/static',
  'local/static',
  'local/live',
  'not run',
  'WSL/static',
  'Windows/PowerShell',
];

function normalizeHeading(value) {
  return String(value || '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractHeadings(markdown) {
  const headings = new Set();
  for (const line of String(markdown || '').split(/\r?\n/)) {
    const match = line.match(/^#{2,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    headings.add(normalizeHeading(match[1]));
  }
  return headings;
}

function hasHeading(headings, bucket) {
  return bucket.aliases.some((alias) => headings.has(normalizeHeading(alias)));
}

function includesInsensitive(text, term) {
  return String(text || '').toLowerCase().includes(String(term || '').toLowerCase());
}

function makeFailure(filePath, code, message) {
  return {
    code,
    message: `${filePath}: ${message}`,
  };
}

function hasVerificationCommand(text) {
  return [
    'npm ',
    'node ',
    'pytest ',
    'git diff --check',
    'git status',
    'powershell ',
  ].some((needle) => includesInsensitive(text, needle));
}

function analyzeHandoffMarkdown(markdown, { filePath = '<markdown>' } = {}) {
  const text = String(markdown || '');
  const headings = extractHeadings(text);
  const failures = [];

  for (const bucket of REQUIRED_BUCKETS) {
    if (!hasHeading(headings, bucket)) {
      failures.push(makeFailure(
        filePath,
        `missing-bucket:${bucket.name}`,
        `missing required handoff receipt bucket "${bucket.name}"`,
      ));
    }
  }

  if (!ENVIRONMENT_LABELS.some((label) => includesInsensitive(text, label))) {
    failures.push(makeFailure(
      filePath,
      'missing-receipt:environment-label',
      `missing an environment-sensitive receipt label (${ENVIRONMENT_LABELS.join(', ')})`,
    ));
  }

  if (!includesInsensitive(text, 'not run')) {
    failures.push(makeFailure(
      filePath,
      'missing-receipt:not-run',
      'missing explicit "not run" receipts for skipped checks',
    ));
  }

  if (/\b(?:all\s+)?tests?\s+pass(?:ed|es)?\b/i.test(text) && !hasVerificationCommand(text)) {
    failures.push(makeFailure(
      filePath,
      'unsupported-claim:test-pass-without-command',
      'claims tests pass without a concrete verification command receipt',
    ));
  }

  if (/\b(?:committed|pushed|opened\s+(?:a\s+)?pr|created\s+(?:a\s+)?pull request)\b/i.test(text)
    && !includesInsensitive(text, 'git')) {
    failures.push(makeFailure(
      filePath,
      'unsupported-claim:git-action-without-receipt',
      'claims git/PR action without a git action receipt',
    ));
  }

  return {
    ok: failures.length === 0,
    filePath,
    failures,
  };
}

function checkHandoffFile(filePath) {
  const resolved = path.resolve(filePath);
  const markdown = fs.readFileSync(resolved, 'utf8');
  return analyzeHandoffMarkdown(markdown, { filePath });
}

function checkHandoffFiles(filePaths) {
  return filePaths.map(checkHandoffFile);
}

function main(argv = process.argv.slice(2)) {
  const filePaths = argv.filter((arg) => !arg.startsWith('-'));
  if (!filePaths.length) {
    console.error('Usage: node scripts/check-penny-handoff-receipts.js <handoff.md> [more-handoff.md ...]');
    process.exit(2);
  }

  const results = checkHandoffFiles(filePaths);
  const failures = results.flatMap((result) => result.failures);
  if (failures.length) {
    console.error(`Penny handoff receipt check failed (${failures.length} finding${failures.length === 1 ? '' : 's'}):`);
    for (const failure of failures) {
      console.error(`- ${failure.code}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log(`Penny handoff receipt check passed (${results.length} file${results.length === 1 ? '' : 's'}).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Penny handoff receipt check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  ENVIRONMENT_LABELS,
  REQUIRED_BUCKETS,
  analyzeHandoffMarkdown,
  checkHandoffFile,
  checkHandoffFiles,
  extractHeadings,
  normalizeHeading,
};
