const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_BUCKETS = [
  'Source Health',
  'Already Landed',
  'Strengthen Now',
  'Maybe Later',
  'Do Not Add',
  'License/Access Risk',
  'Privacy/Local-Data Risk',
  'Platformization Risk',
  'Current-Law Conflict',
  'Owner Seams',
  'Verification Commands',
  'Artifact Scope/Limits',
];

const REQUIRED_GUARDRAILS = [
  'memory',
  'PromptTruth',
  'toolEvidenceReceipt',
  'runtime voice',
  'default context',
  'live LM Studio',
];

const ENVIRONMENT_LABELS = [
  'cloud/static',
  'local/static',
  'local/live',
  'not run',
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

function includesInsensitive(text, term) {
  return String(text || '').toLowerCase().includes(String(term || '').toLowerCase());
}

function makeFailure(filePath, code, message) {
  return {
    code,
    message: `${filePath}: ${message}`,
  };
}

function analyzeReviewMarkdown(markdown, { filePath = '<markdown>' } = {}) {
  const text = String(markdown || '');
  const headings = extractHeadings(text);
  const failures = [];

  for (const bucket of REQUIRED_BUCKETS) {
    if (!headings.has(normalizeHeading(bucket))) {
      failures.push(makeFailure(
        filePath,
        `missing-bucket:${bucket}`,
        `missing required source-review bucket "${bucket}"`,
      ));
    }
  }

  for (const guardrail of REQUIRED_GUARDRAILS) {
    if (!includesInsensitive(text, guardrail)) {
      failures.push(makeFailure(
        filePath,
        `missing-guardrail:${guardrail}`,
        `missing no-mutation/local-safety guardrail mention for "${guardrail}"`,
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
      'missing explicit "not run" receipts for skipped live checks',
    ));
  }

  if (!includesInsensitive(text, 'git diff --check')) {
    failures.push(makeFailure(
      filePath,
      'missing-verification:git-diff-check',
      'missing docs-safe verification command "git diff --check"',
    ));
  }

  return {
    ok: failures.length === 0,
    filePath,
    failures,
  };
}

function checkReviewFile(filePath) {
  const resolved = path.resolve(filePath);
  const markdown = fs.readFileSync(resolved, 'utf8');
  return analyzeReviewMarkdown(markdown, { filePath });
}

function checkReviewFiles(filePaths) {
  return filePaths.map(checkReviewFile);
}

function main(argv = process.argv.slice(2)) {
  const filePaths = argv.filter((arg) => !arg.startsWith('-'));
  if (!filePaths.length) {
    console.error('Usage: node scripts/check-penny-source-review.js <review.md> [more-review.md ...]');
    process.exit(2);
  }

  const results = checkReviewFiles(filePaths);
  const failures = results.flatMap((result) => result.failures);
  if (failures.length) {
    console.error(`Penny source-review check failed (${failures.length} finding${failures.length === 1 ? '' : 's'}):`);
    for (const failure of failures) {
      console.error(`- ${failure.code}: ${failure.message}`);
    }
    process.exit(1);
  }

  console.log(`Penny source-review check passed (${results.length} file${results.length === 1 ? '' : 's'}).`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Penny source-review check failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  ENVIRONMENT_LABELS,
  REQUIRED_BUCKETS,
  REQUIRED_GUARDRAILS,
  analyzeReviewMarkdown,
  checkReviewFile,
  checkReviewFiles,
  extractHeadings,
  normalizeHeading,
};
