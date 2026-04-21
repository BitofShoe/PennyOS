---
name: penny-memory-inspector
description: Use when inspecting, explaining, reviewing, or carefully cleaning Penny's hybrid memory system. Prefer this skill for explicit memory, archive memory, embedding cache, promotion queue, provenance, and purge-scope work.
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
    embed:
      - text-embedding-nomic-embed-text-v1.5 (soft dependency)
allowed-tools:
  - functions.shell_command
  - functions.read_thread_terminal
---

# Penny Memory Inspector

Use this skill when the task is about what Penny remembers, how she remembers it, and what should or should not become canonical.

## Use It When

- you need to explain Penny's memory layers
- archive memory, semantic retrieval, or promotion review is involved
- you need to inspect whether QA junk or stale sessions leaked into memory
- you need to verify purge scope or provenance before changing anything

## Default Workflow

1. Identify which memory layer the question is really about.
2. Confirm the on-disk source before making any claim.
3. Distinguish explicit facts, archive memory, and embeddings in plain language.
4. Treat promotion review as a separate step from storage or retrieval.
5. Use the reference doc before touching memory files or routes.

## Task Fit

- Blockers: unclear purge scope, mixed memory layers, missing provenance, or live QA pollution.
- Complexity: separate inspection, cleanup, promotion, and retrieval changes.
- Confidence: cite on-disk files or route output before making memory claims.
- Touched owners: keep memory edits in the dedicated data files, helpers, or routes that own the layer under review.
- Verification cost: choose the narrowest inspection or regression that proves the affected layer.
- Cleanup risk: identify every explicit, archive, embedding, and generated artifact that a QA pass may leave behind.

## Authority and Receipts

- Explicit memory is canonical; archive memory and ledgers are inspectable evidence, not automatic truth.
- Embedding files are derived retrieval artifacts. Do not treat them as authored memory.
- Prefer current disk state, tests, and live route responses over prose summaries when deciding what Penny remembers.

## Guardrails

- Canonical explicit memory stays the source of truth.
- Archive memory is additive, not automatically canonical.
- Never auto-promote derived memory.
- Never claim semantic memory is broken just because the embed model is missing; fallback retrieval is expected.
- Never do a broad purge without explicit user intent and clear scope labels.

## Reference

- [REFERENCE.md](./references/REFERENCE.md)
