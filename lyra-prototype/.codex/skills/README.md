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

## Ground Rules

- Keep this first wave narrow. These skills are for reusable repo workflows, not for changing Penny's runtime behavior.
- Favor progressive disclosure. Read the `SKILL.md` first, then load its `references/REFERENCE.md` only if needed.
- Do not run heavy local evals in parallel.
- Respect the current local model split:
  - chat lane: `google/gemma-4-31b` or `unsloth/gemma-4-31b-it`
  - tool lane: `google/gemma-4-e4b`
  - semantic memory embed model: `text-embedding-nomic-embed-text-v1.5` (soft dependency)

## Sources of Truth

- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [CODEBASE.md](../../CODEBASE.md)
- [server-js-section-map.md](../../server-js-section-map.md)
- [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
