const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  analyzeHandoffMarkdown,
  checkHandoffFile,
} = require('../scripts/check-penny-handoff-receipts');

function completeHandoff(extra = '') {
  return `# Penny Handoff

## Goal
Ship a bounded harness checker.

## Acceptance Criteria
- The checker fails thin handoffs.

## Environment
- local/static

## Files Read
- README.md
- ARCHITECTURE.md

## Files Edited
- scripts/check-penny-handoff-receipts.js
- test/penny-handoff-receipts-check.test.js

## Verification
- node --test test/penny-handoff-receipts-check.test.js
- git diff --check

## Artifacts
- docs/example-handoff.md

## Git Actions
- not run; no commit requested

## Not Run
- live Penny runtime
- live LM Studio
- Hermes Agent tests

## Limits
This handoff is not runtime law and does not claim unrun checks passed.

${extra}
`;
}

test('handoff checker accepts a complete receipt-backed handoff', () => {
  const result = analyzeHandoffMarkdown(completeHandoff(), {
    filePath: 'docs/example-handoff.md',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test('handoff checker rejects missing receipt buckets and environment labels', () => {
  const result = analyzeHandoffMarkdown(`## Goal\nDo work.\n`, {
    filePath: 'docs/thin-handoff.md',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'missing-bucket:Files Read'));
  assert(result.failures.some((failure) => failure.code === 'missing-bucket:Verification'));
  assert(result.failures.some((failure) => failure.code === 'missing-receipt:environment-label'));
});

test('handoff checker rejects pass claims without command receipts', () => {
  const result = analyzeHandoffMarkdown(completeHandoff()
    .replace(/## Verification[\s\S]*?## Artifacts/, '## Verification\nAll tests pass.\n\n## Artifacts'), {
    filePath: 'docs/fake-pass.md',
  });

  assert.equal(result.ok, false);
  assert(result.failures.some((failure) => failure.code === 'unsupported-claim:test-pass-without-command'));
});

test('handoff checker reads files and reports compact status', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'penny-handoff-'));
  const handoffPath = path.join(dir, 'handoff.md');
  fs.writeFileSync(handoffPath, completeHandoff(), 'utf8');

  const result = checkHandoffFile(handoffPath);

  assert.equal(result.ok, true);
  assert.equal(result.filePath, handoffPath);
  assert.deepEqual(result.failures, []);
});
