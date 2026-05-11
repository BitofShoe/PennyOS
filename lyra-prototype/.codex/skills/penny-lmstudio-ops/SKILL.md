---
name: penny-lmstudio-ops
description: Use when working on Penny's LM Studio or llama.cpp setup, local model readiness, preset wiring, lane fallback diagnosis, startup preparation, Windows/WSL/PowerShell runtime checks, or preflight checks. Prefer this skill before changing local model helper scripts or interpreting readiness problems.
compatibility:
  os:
    - Windows
  shell:
    - PowerShell
  node: ">=24 <25"
  npm: ">=11 <12"
  services:
    - LM Studio local API
    - llama.cpp OpenAI-compatible API
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

Use this skill for Penny's local LM Studio and llama.cpp workflow, not for general model advice.

## Use It When

- Penny startup, preflight, or model-readiness work is involved
- `@local:penny` preset wiring needs inspection or repair
- Penny is falling back between chat/tool/embed lanes and you need the real reason
- you need to run the repo's LM Studio helper scripts in the right order
- llama.cpp router presets, model dropdowns, or Windows/WSL/PowerShell runtime truth are involved

## Default Workflow

1. Check the repo commands in `package.json`.
2. Run `npm run preflight` for an honest report-first pass.
3. Run `npm run lmstudio:prepare` when you need Penny-ready LM Studio setup.
4. Run `npm run preset:lmstudio` only when preset wiring needs repair.
5. Use the reference doc before touching LM Studio scripts.

## Local Shell Trap

- Prefer WSL for static repo inspection, but use Windows PowerShell/cmd for live LM Studio and disposable Penny QA on this machine.
- Do not trust WSL `127.0.0.1:1234` as proof that the Windows LM Studio API is down. Verify from Windows with a direct `/v1/models` probe or `npm run preflight`.
- When launching live QA from a PowerShell wrapper under WSL, pin Windows Node explicitly if PATH is mixed, for example `C:\Program Files\nodejs\node.exe`; otherwise PowerShell can pick up a non-Windows `node` and fail with `%1 is not a valid Win32 application`.
- The `lms` CLI may exist at `C:\Users\malac\.lmstudio\bin\lms.exe` even when WSL cannot resolve `lms` from PATH.

## llama.cpp Runtime Map

- Penny may be pointed at a Windows llama.cpp OpenAI-compatible API through `PENNY_LMSTUDIO_BASE`, even though several files still use `lmstudio` naming.
- The local router preset currently lives under `C:\Users\malac\.openclaw\tools\llama.cpp\b9025\penny-router.ini`; check it before assuming LM Studio owns the loaded-model truth.
- Use PowerShell for live llama.cpp process checks, for example `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "llama-server.exe" }`, because WSL process and loopback checks can be misleading.
- If the router is not running, Penny's dropdown can still show installed/fallback model ids, but exact `/v1/models` aliases from the router appear only after the router starts with the updated preset.
- Default to preserving model state: do not auto-start, stop, unload, or reload llama.cpp or LM Studio models unless the user asked for live runtime changes. Report the current state first.
- Explicit permission can unlock scoped model management. If the user says goal mode is allowed, says model loading/unloading is okay before the task, or names a model-management goal, agents may start/stop/reload the needed local runtime within that task and should report exactly what they changed.
- A low-but-nonzero `nvidia-smi` VRAM reading with no compute apps can be driver/display baseline, not a hidden model. Confirm with `nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits`.

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
- Do not run broad unload/reload loops unless the task explicitly asks for them or the user granted scoped model-management permission for the task.
- Treat Q6 `unsloth/gemma-4-31b-it@q6_k` as the practical heavy-QA chat default on this machine.
- Treat `google/gemma-4-e4b` as the tool lane target.
- Avoid treating Q8-class chat models as implicit test defaults.
- Do not broaden a normal readiness check into dual-lane stress testing unless that is the task.
- Treat the embed model as a soft dependency. Penny should degrade gracefully when it is unavailable.
- Report fallback truth plainly instead of pretending Penny is fully dual-lane ready.

## Reference

- [REFERENCE.md](./references/REFERENCE.md)
