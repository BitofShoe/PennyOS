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

## Working rules

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Keep one primary editing agent per file boundary.
- Consolidate findings before writing.
- If the task crosses backend, frontend, tests, and docs, treat that as a delegation trigger.

## Evidence to gather

- Files to read:
- Commands to run:
- Ownership boundaries to confirm:
- Known risks:

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

## Out-of-scope list

- Explicitly out of scope:
- Explicitly out of scope:

## Notes

- Capture decisions, tradeoffs, delegation results, and follow-up items here.
