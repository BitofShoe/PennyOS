---
name: penny-lmstudio-ops
description: Use when working on Penny's LM Studio setup, local model readiness, preset wiring, lane fallback diagnosis, startup preparation, or preflight checks. Prefer this skill before changing LM Studio helper scripts or interpreting local readiness problems.
compatibility:
  os:
    - Windows
  shell:
    - PowerShell
  node: ">=24 <25"
  npm: ">=11 <12"
  services:
    - LM Studio local API
  models:
    chat:
      - google/gemma-4-31b
      - unsloth/gemma-4-31b-it
    tool:
      - google/gemma-4-e4b
    embed:
      - text-embedding-nomic-embed-text-v1.5 (soft dependency)
allowed-tools:
  - functions.shell_command
  - functions.read_thread_terminal
---

# Penny LM Studio Ops

Use this skill for Penny's local LM Studio workflow, not for general model advice.

## Use It When

- Penny startup, preflight, or model-readiness work is involved
- `@local:penny` preset wiring needs inspection or repair
- Penny is falling back between chat/tool/embed lanes and you need the real reason
- you need to run the repo's LM Studio helper scripts in the right order

## Default Workflow

1. Check the repo commands in `package.json`.
2. Run `npm run preflight` for an honest report-first pass.
3. Run `npm run lmstudio:prepare` when you need Penny-ready LM Studio setup.
4. Run `npm run preset:lmstudio` only when preset wiring needs repair.
5. Use the reference doc before touching LM Studio scripts.

## Guardrails

- Do not add per-turn model hot-swapping.
- Do not run broad unload/reload loops unless the task explicitly asks for them.
- Treat `google/gemma-4-e4b` as the tool lane target.
- Treat the embed model as a soft dependency. Penny should degrade gracefully when it is unavailable.
- Report fallback truth plainly instead of pretending Penny is fully dual-lane ready.

## Reference

- [REFERENCE.md](./references/REFERENCE.md)
