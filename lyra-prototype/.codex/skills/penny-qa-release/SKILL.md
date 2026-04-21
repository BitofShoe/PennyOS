---
name: penny-qa-release
description: Use when running or interpreting Penny's release-style QA, readiness checks, or local eval artifacts. Prefer this skill for test ordering, artifact reading, lane-aware QA, and avoiding machine-overload mistakes.
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

# Penny QA Release

Use this skill for Penny QA runs and artifact interpretation, not for generic repo testing.

## Use It When

- you need to decide what QA to run next
- you need to interpret a Penny voice/probe/model artifact
- you are preparing a branch for user testing
- you want to avoid rerunning heavy local evals in a dumb order

## Default Workflow

1. Start with `npm test`.
2. Run `npm run preflight` before any heavy LM Studio QA.
3. Run `npm run qa:voice-redo` for chat-lane companion quality.
4. Run `npm run eval:probes` for tool-lane sanity.
5. Run `npm run eval:models` only when comparing chat-model behavior.

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
