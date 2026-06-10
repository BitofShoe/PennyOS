const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeReviewMarkdown,
  checkReviewFile,
} = require('../scripts/check-penny-source-review');

function completeReview(extra = '') {
  return `# Penny External Link Review - 2026-06-10

> Category: External-source research synthesis
> Do not use this for: runtime law, memory ingestion, PromptTruth expansion, toolEvidenceReceipt expansion, runtime voice changes, hosted telemetry, live LM Studio checks, or dependency approval.

## Source Health
Read source list and sampled linked resources.

## Already Landed
Penny already has fixture QA and local receipts.

## Strengthen Now
Add a deterministic verifier with owner seams.

## Maybe Later
Consider trace viewing only after a local need appears.

## Do Not Add
No hosted telemetry, no source-batch ingestion into memory, no PromptTruth expansion, no toolEvidenceReceipt expansion, no runtime voice changes, no default context changes, and no live LM Studio/user-memory QA without operator approval.

## License/Access Risk
The list license does not cover linked repos.

## Privacy/Local-Data Risk
Keep traces local, redacted, and fixture-first.

## Platformization Risk
Do not turn Penny into a multi-user agent platform.

## Current-Law Conflict
External sources are evidence, not Penny law.

## Owner Seams
- \`scripts/\`
- \`test/\`

## Verification Commands
\`\`\`bash
git diff --check
npm run check:source-reviews
\`\`\`

## Artifact Scope/Limits
Historical evidence only; live runtime checks are not run.

## Receipts
Environment: local/static.
Checks not run: live Penny runtime, live LM Studio, Hermes Agent tests.

${extra}
`;
}

test('source review checker accepts a complete Penny link-review artifact', () => {
  const result = analyzeReviewMarkdown(completeReview(), {
    filePath: 'docs/example-link-review.md',
  });

  assert.deepEqual(result.failures, []);
  assert.equal(result.ok, true);
});

test('source review checker reports missing required buckets by code', () => {
  const result = analyzeReviewMarkdown(`## Source Health\nRead.\n`, {
    filePath: 'docs/thin.md',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'missing-bucket:Already Landed'));
  assert(result.failures.some((failure) => failure.code === 'missing-bucket:Strengthen Now'));
  assert(result.failures.some((failure) => failure.message.includes('docs/thin.md')));
});

test('source review checker rejects missing no-mutation guardrails', () => {
  const riskyReview = completeReview()
    .replace(/PromptTruth/g, 'prompt authority')
    .replace(/toolEvidenceReceipt/g, 'tool evidence')
    .replace(/runtime voice/g, 'voice layer')
    .replace(/default context/g, 'context layer');
  const result = analyzeReviewMarkdown(riskyReview, {
    filePath: 'docs/risky.md',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'missing-guardrail:PromptTruth'));
  assert(result.failures.some((failure) => failure.code === 'missing-guardrail:toolEvidenceReceipt'));
  assert(result.failures.some((failure) => failure.code === 'missing-guardrail:runtime voice'));
});

test('source review checker reads files and reports a compact summary', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-source-review-'));
  const reviewPath = path.join(dir, 'review.md');
  fs.writeFileSync(reviewPath, completeReview(), 'utf8');

  const result = checkReviewFile(reviewPath);

  assert.equal(result.ok, true);
  assert.equal(result.filePath, reviewPath);
  assert.deepEqual(result.failures, []);
});

test('release package wiring keeps harness receipts executable from source bundles', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

  assert.match(packageJson.scripts['check:release'], /check:harness-receipts/);
  assert.match(packageJson.scripts.prepack, /check:harness-receipts/);
  assert.ok(packageJson.files.includes('docs/penny-harness-engineering-link-review-2026-06-10.md'));
});
