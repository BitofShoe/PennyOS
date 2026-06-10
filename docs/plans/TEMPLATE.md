# Planning Template

> Category: Planning scaffold
> Authority: Implementation plan
> Status: Draft
> Use this for: planning future work, delegation maps, risks, and verification plans.
> Do not use this for: proof that anything already shipped or as a substitute for current law.

Use this template for cross-cutting Penny work that needs a written plan before editing.

## Goal and success criteria

- Goal:
- User-facing or engineering success criteria:
- What will be considered done:

## Task fit

- Blockers:
- Complexity:
- Confidence:
- Touched owners:
- Verification cost:
- Cleanup risk:
- Execution environment: local-only / cloud-safe / mixed / unknown

## Decisions already locked

- Constraint or decision:
- Constraint or decision:

## Blind spots / what are we not considering?

- Unknown or risk:
- Adjacent system that could drift:
- What would make this plan wrong:

## Delegation map

- Read-only exploration tasks and assigned subagents:
- QA inspection tasks and assigned subagents:
- Doc mapping tasks and assigned subagents:
- Single primary editor per file boundary:
- Subagent closeout criteria: source URLs, local line refs, command receipts, artifacts, or advisory-only label

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Task environment and receipts

- Environment-sensitive claims should be labeled `cloud/static`, `local/static`, `local/live`, or `not run`.
- Cloud-safe work:
- Local-only work:
- Source/tool lookups used, if any:
- Sanitized query or data-withheld note, if source tools such as Context7 were used:
- Receipt checklist:
  - Files read:
  - Files edited:
  - Commands/tests run:
  - Artifact paths:
  - Git actions:
  - Checks not run and why:

## Evidence to gather

- Files to read:
- Commands to run:
- Ownership boundaries to confirm:
- Authority / receipt checks:
  - Code, tests, runtime output, or artifacts that outrank prose:
  - PromptTruth versus tool evidence:
  - Explicit memory versus archive, ledger, or embedding artifacts:
- Known risks:

## External link review / source batch

Use this section when a plan is driven by external URLs, repos, papers, docs, posts, or link batches. For full workflow guidance, use [penny-link-review](../../.codex/skills/penny-link-review/SKILL.md).

- Source health:
- Already landed:
- Strengthen now:
- Maybe later:
- Do not add:
- License/access risk:
- Privacy/local-data risk:
- Platformization risk:
- Current-law conflict:
- Owner seams:
- OpenClaw skill intake:
  - Does the skill inject host-process env vars, API keys, or secrets?
  - Does it require host binaries, installers, ClawHub, hosted services, or network accounts?
  - Does it increase always-loaded skill-list token load or belong in OpenClaw-native `<workspace>/skills` instead of Codex `.codex/skills`?
  - Does it alter Penny runtime context, PromptTruth, tool evidence, memory, or model lanes?
- Verification commands:
- Artifact scope/limits:

## Safe-refactor map

- Thin shell or orchestration file involved:
- Extracted owner to extend first:
- Behavior-preserving tests or receipts:
- Ordered implementation steps:
- Review point before expanding scope:

## Proposed change set

- File or doc:
- Reason:
- Expected impact:

## Verification plan

- Automated checks:
- Manual checks:
- What should stay unchanged:
- What would count as out-of-scope drift:

## Artifact lifecycle / cleanup

- Which debug, QA, or bundle artifacts will be created:
- What should be persisted:
- What should be cleaned up before sign-off:

## Results and handoff

- Landed:
- Verified:
- Deferred:
- Cleanup completed:
- Follow-up owner or next slice:

## Out-of-scope list

- Explicitly out of scope:
- Explicitly out of scope:

## Notes

- Capture decisions, tradeoffs, delegation results, and follow-up items here.
