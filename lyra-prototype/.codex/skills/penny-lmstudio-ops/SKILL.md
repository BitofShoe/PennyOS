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
      - unsloth/gemma-4-31b-it@q6_k
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

## Task Fit

- Blockers: missing LM Studio, unavailable models, broken preset wiring, or port conflicts.
- Complexity: keep readiness checks separate from model-management changes.
- Confidence: verify with command output, not stale chat context.
- Touched owners: prefer helper scripts and `lib/` readiness owners before expanding route shells.
- Verification cost: start with `npm run preflight`; run heavier QA only when readiness truth affects behavior.
- Cleanup risk: do not leave experimental presets, loaded-model churn, or QA artifacts behind.

## Authority and Receipts

- Treat `npm run preflight`, `lms ps --json`, direct local API probes, and Penny status output as readiness receipts.
- Distinguish verified readiness from graceful fallback. Missing embed support can be acceptable when fallback retrieval is active.
- Do not imply PromptTruth proves tool-lane readiness; PromptTruth is prompt-time evidence, while tool execution needs its own receipt.

## Guardrails

- Do not add per-turn model hot-swapping.
- Do not run broad unload/reload loops unless the task explicitly asks for them.
- Treat Q6 `unsloth/gemma-4-31b-it@q6_k` as the practical heavy-QA chat default on this machine.
- Treat `google/gemma-4-e4b` as the tool lane target.
- Avoid treating Q8-class chat models as implicit test defaults.
- Do not broaden a normal readiness check into dual-lane stress testing unless that is the task.
- Treat the embed model as a soft dependency. Penny should degrade gracefully when it is unavailable.
- Report fallback truth plainly instead of pretending Penny is fully dual-lane ready.

## Reference

- [REFERENCE.md](./references/REFERENCE.md)
