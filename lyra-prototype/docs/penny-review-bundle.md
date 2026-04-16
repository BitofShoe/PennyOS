# Penny Review Bundle Standard

Use the review bundle for handoffs and outside review when the raw repo workspace is too noisy.

## Goal

Share the product and engineering surface, not the attic clutter.

Keep:
- source
- tests
- docs
- seed data
- intentional small assets

Drop:
- `output/`
- `logs/`
- `tmp/`
- `.qa-pw/`
- `.playwright-cli/`
- `test-results/`
- QA-generated memory/archive/embeddings files
- `.lyra-server.pid`
- `.lyra-server.meta.json`
- stray `*.log`

## Script

Build a filtered bundle with:

```powershell
node scripts/build-review-bundle.js
```

Default output:

- `tmp/review-bundle/`

Optional custom output:

```powershell
node scripts/build-review-bundle.js --out tmp/review-bundle-demo
```

## Why this exists

Repo hygiene and review-surface hygiene are different problems.

The repo can be reasonably clean while a handoff copy is still annoying to inspect because it includes:

- heavy QA artifacts
- stale logs
- local runtime debris
- files that are truthful but irrelevant to the review

The bundle script keeps reviews focused on the actual code and docs under discussion.
