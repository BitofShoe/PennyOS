---
name: penny-qa-release
description: Use when running or interpreting Penny's release-style QA, readiness checks, local eval artifacts, or llama.cpp/LM Studio model QA on Windows/WSL. Prefer this skill for test ordering, artifact reading, lane-aware QA, runtime truth checks, and avoiding machine-overload mistakes.
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

# Penny QA Release

Use this skill for Penny QA runs and artifact interpretation, not for generic repo testing.

## Use It When

- you need to decide what QA to run next
- you need to interpret a Penny voice/probe/model artifact
- you are preparing a branch for user testing
- you want to avoid rerunning heavy local evals in a dumb order
- you are validating a llama.cpp-hosted Penny model from WSL/Codex

## Default Workflow

1. Start with `npm test`.
2. Run `npm run preflight` before any heavy local-model QA, but treat it as one signal, not final truth.
3. Confirm the actual runtime from Windows PowerShell when llama.cpp or LM Studio may be involved.
4. Run `npm run qa:voice-redo` for chat-lane companion quality.
5. Run `npm run eval:probes` for tool-lane sanity.
6. Run `npm run eval:models` only when comparing chat-model behavior.

## Local Runtime QA Trap

- Label runtime-sensitive checks as Windows/PowerShell, WSL/static, or WSL-via-Windows-gateway in the handoff.
- Do not treat WSL `127.0.0.1` failures as proof that a Windows-hosted llama.cpp or LM Studio API is down. Probe from PowerShell or use the Windows host/gateway address when needed.
- For llama.cpp router checks, inspect the router preset and process command line before assuming which model is selectable or loaded.
- When the user asks to preserve loaded-model state, restart Penny with `PENNY_SKIP_LMSTUDIO_PREP=1` and avoid model prep/unload loops.
- When the user explicitly grants model-management permission up front, such as goal mode or "it is okay to load/unload models for this task", agents may load, unload, or restart the local runtime as needed for that QA. Keep it scoped to the requested model/task, serialize heavy runs, and report the exact runtime actions taken.
- Heavy model QA should be one harness at a time. If the target is only one model, do not quietly rerun or load comparison models.

## Task Fit

- Blockers: failing unit tests, stale server state, mismatched loaded models, or unclear artifact freshness.
- Complexity: separate route regressions, voice QA, tool probes, and model comparisons.
- Confidence: prefer fresh artifacts with command output and timestamps over interrupted or inherited runs.
- Touched owners: map failures back to backend helpers, browser owners, prompt assets, scripts, or docs before editing.
- Verification cost: run the cheapest check that proves the claim; escalate to heavy LM Studio QA only when needed.
- Cleanup risk: plan memory and artifact cleanup before starting any QA that can write disposable state.

## Authority and Receipts

- Treat tests, command logs, and generated artifact files as QA receipts.
- Distinguish PromptTruth prompt visibility from sibling runtime receipts such as tool evidence or route output.
- Record what landed, what was verified, what was deferred, and which artifacts were cleaned up in the final handoff.

## Guardrails

- Do not run heavy local evals in parallel.
- Default heavy QA to Q6 chat/memory and `google/gemma-4-e4b` tooling.
- Do not auto-test a Q8 chat path unless the task explicitly asks for it.
- Do not turn a normal QA pass into a dual-lane stress test unless lane-routing behavior is the thing being tested.
- Voice QA is chat-lane leaning.
- Probes are tool-lane leaning.
- Always include artifact paths in the summary.
- Always clear any QA-generated memory files after testing, including explicit memory, archive memory, and embeddings artifacts.
- Distinguish stale or interrupted runs from trustworthy runs.

## Reference

- [REFERENCE.md](./references/REFERENCE.md)
