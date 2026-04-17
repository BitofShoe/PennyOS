# Penny Memory Truth-Hardening Plan

## Goal and success criteria

- Goal:
  Tighten Penny's current memory/platform pass so background vectorization and retrieval behavior are more truthful, more inspectable, and less likely to create false confidence.
- User-facing or engineering success criteria:
  Background vectorization stays bounded, additive embeddings writes stop dropping fresh vectors, semantic downgrade stops being silent, direct memory-authority questions bias toward canon, and the in-app inspector shows one practical background-vectorization summary.
- What will be considered done:
  The runtime and inspector metadata tell the truth about eager vs background embedding work, direct memory-authority prompts are less advisory-crowded, docs match live behavior, and the targeted tests pass.

## Decisions already locked

- Constraint or decision:
  Penny stays companion-first. No personality rewrite and no broad platformization.
- Constraint or decision:
  Explicit memory remains canonical. Archive and research-ledger context remain advisory.
- Constraint or decision:
  ToolCapabilityDescriptor stays frozen at the current seam.
- Constraint or decision:
  Utility scoring stays a bounded heuristic. It does not become a live forgetting policy in this pass.

## Blind spots / what are we not considering?

- Unknown or risk:
  Merge-on-write reduces stale overwrite risk, but it is still not a multi-process locking system.
- Adjacent system that could drift:
  Judged retrieve/forget failures may still need deeper retrieval-shaping work after user testing.
- What would make this plan wrong:
  If the bounded prompt authority change makes direct memory questions less useful when canon is sparse, we may need a narrower branch after user testing.

## Delegation map

- Read-only exploration tasks and assigned subagents:
  Godel inspected archive/vectorization write safety and telemetry. Bacon inspected prompt/UI/doc drift.
- QA inspection tasks and assigned subagents:
  Godel mapped the smallest concurrency and telemetry regressions to add.
- Doc mapping tasks and assigned subagents:
  Bacon mapped the top-level wording drifts in README/CODEBASE/ARCHITECTURE.
- Single primary editor per file boundary:
  Main agent edits backend, prompt, UI, tests, and docs after consolidating the read-only findings.

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
  `lib/penny-memory-archive.js`, `lib/penny-memory.js`, `public/js/penny-memory-panel.mjs`, `test/penny-memory-archive.test.js`, `test/penny-memory.test.js`, `test/penny-memory-panel.test.js`, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`
- Commands to run:
  `npm test`
- Ownership boundaries to confirm:
  Archive truth stays in `lib/penny-memory-archive.js`, prompt-memory shaping stays in `lib/penny-memory.js`, inspector rendering stays in `public/js/penny-memory-panel.mjs`.
- Known risks:
  Over-fixing by introducing broader concurrency architecture, broader prompt rules, or a larger inspector surface.

## Proposed change set

- `lib/penny-memory-archive.js`:
  Add merge-aware additive embeddings commits, explicit semantic-downgrade metadata, eager-vs-background telemetry split, and a bounded archive-pending truth hint.
- `lib/penny-memory.js`:
  Narrow direct memory-authority questions so canonical explicit memory stays foregrounded under advisory pressure.
- `public/js/penny-memory-panel.mjs`:
  Surface one compact background-vectorization inspector block with status, counts, and async-lag hints.
- `test/penny-memory-archive.test.js`:
  Add stale-write coverage and extend vectorization telemetry assertions.
- `test/penny-memory.test.js`:
  Add direct memory-authority coverage.
- `test/penny-memory-panel.test.js`:
  Add background-vectorization view-model and rendering coverage.
- `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`:
  Update wording so "off hot path," utility scoring, and inspector visibility match the runtime truth.

## Verification plan

- Automated checks:
  `npm test`
- Manual checks:
  None beyond reviewing the targeted diffs and inspector-facing wording.
- What should stay unchanged:
  No new runtime surfaces, no ToolCapabilityDescriptor expansion, no live pruning policy, no personality or product rewrite.
- What would count as out-of-scope drift:
  New connector runtime behavior, new background jobs, or broader retrieval-policy rewrites.

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
  None besides normal test output.
- What should be persisted:
  The plan doc, code, tests, and doc updates.
- What should be cleaned up before sign-off:
  No disposable QA artifacts should remain from this bounded pass.

## Out-of-scope list

- Explicitly out of scope:
  Live pruning or forgetting automation.
- Explicitly out of scope:
  New connector adapters or broader platform routing.
- Explicitly out of scope:
  Larger judged memory redesign beyond explicit downgrade visibility and prompt authority.

## Notes

- External review baseline is `D:/downloads/penny_memory_platform_review_handoff.md`.
- The priority is runtime truthfulness and debuggability, not feature growth.
