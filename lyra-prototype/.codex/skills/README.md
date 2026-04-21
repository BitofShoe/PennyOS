# Penny Repo Skills

These are repo-local Penny skills for future agents waking up inside this app.

Use them when the task clearly matches the workflow instead of re-discovering the same runbooks from scratch.

## Skills

- [penny-lmstudio-ops](./penny-lmstudio-ops/SKILL.md)
  - Use for LM Studio prep, preset wiring, model readiness, lane fallback diagnosis, and local startup checks.
- [penny-memory-inspector](./penny-memory-inspector/SKILL.md)
  - Use for Penny's hybrid memory model: explicit memory, archive memory, embeddings, promotion review, and purge scope.
- [penny-qa-release](./penny-qa-release/SKILL.md)
  - Use for Penny release-style QA, artifact interpretation, and safe test ordering.
- [penny-link-review](./penny-link-review/SKILL.md)
  - Use for external link batches, source-health checks, repo-fit synthesis, risk buckets, and bounded next-slice planning.

## Ground Rules

- Keep this first wave narrow. These skills are for reusable repo workflows, not for changing Penny's runtime behavior.
- Favor progressive disclosure. Read the `SKILL.md` first, then load its `references/REFERENCE.md` only if needed.
- Before implementation work, make a task-fit pass: name blockers, complexity, confidence, touched owners, verification cost, and cleanup risk.
- Treat runtime code, tests, live command output, and generated artifacts as stronger implementation evidence than planning prose.
- For external source batches, verify source health first and keep `already landed`, `strengthen now`, `maybe later`, and `do not add` separate.
- When a task crosses backend, frontend, tests, or docs, start from [docs/plans/TEMPLATE.md](../../docs/plans/TEMPLATE.md) and capture landed, verified, deferred, and cleanup results there.
- Do not run heavy local evals in parallel.
- Respect the current local model split:
  - routine QA chat/memory: `unsloth/gemma-4-31b-it@q6_k`
  - tool lane: `google/gemma-4-e4b`
  - semantic memory embed model: `text-embedding-nomic-embed-text-v1.5` (soft dependency)
- Do not treat Q8-class chat models as the default QA path, and do not broaden a normal QA pass into a dual-lane test unless that specific behavior is under inspection.

## Sources of Truth

- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [CODEBASE.md](../../CODEBASE.md)
- [server-js-section-map.md](../../server-js-section-map.md)
- [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
