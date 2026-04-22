# Penny Codex Environment Source Tools Note - 2026-04-22

> Category: External-source research synthesis
> Authority level: Historical evidence
> Current status: Current research note as of 2026-04-22
> Use this for: Context7/Codex-skill/operator-tool follow-through for agents helping code Penny.
> Do not use this for: current runtime law, dependency approval, broad platform replacement, runtime voice changes, PromptTruth expansion, toolEvidenceReceipt expansion, hosted automation, or memory ingestion.

## Scope

This note consolidates the April 22 review of:

- [trimstray/the-book-of-secret-knowledge](https://github.com/trimstray/the-book-of-secret-knowledge)
- [Context7](https://context7.com/)
- [Context7 Skills](https://context7.com/skills)
- [openai/codex issue #18319](https://github.com/openai/codex/issues/18319?issue=openai%7Ccodex%7C16996) and related [#16996](https://github.com/openai/codex/issues/16996)
- [ComposioHQ/awesome-codex-skills](https://github.com/ComposioHQ/awesome-codex-skills)

The goal is to improve the Codex environment and Penny coding-agent workflow without changing Penny's runtime behavior.

## Source Health

- `trimstray/the-book-of-secret-knowledge` was reachable through GitHub and raw README access. GitHub reports MIT license at the repo level. Treat individual linked tools as separate sources with separate licenses and maintenance states.
- Context7 was reachable. The `/skills` landing page is mostly client-rendered, so concrete claims should come from [Context7 docs](https://context7.com/docs/overview), [Context7 CLI docs](https://context7.com/docs/clients/cli), [Context7 skills docs](https://context7.com/docs/skills), [Context7 MCP clients docs](https://context7.com/docs/resources/all-clients), [Context7 data privacy docs](https://context7.com/docs/security/data-privacy), and [upstash/context7](https://github.com/upstash/context7).
- Context7 pricing/access was visible at [Context7 pricing](https://context7.com/plans): public-doc use is available on Free with rate limits; private repo support is paid; enterprise/self-hosted options are vendor-managed.
- `openai/codex` issue #18319 was reachable and closed. Related issue #16996 was reachable and open as of this review. These are product-behavior reports, not Penny repo law.
- `ComposioHQ/awesome-codex-skills` was reachable and active. GitHub API did not report a top-level license for the root repository during review; inspect each skill or linked repo before copying or installing anything.

## Already Landed

- Penny already has the main guardrails these sources point toward: repo-local skills, source-health review, bounded external-source buckets, isolated QA, advisory runtime artifacts, and clear current-law docs.
- `AGENTS.md` already requires bounded subagent use for independent read-only exploration, QA inspection, and doc mapping, with explicit handling for spawn failures and full-context fork behavior.
- Penny already favors small, inspectable, local-first tooling over broad platform layers.
- Penny's docs already warn that external link batches are evidence, not permission to change runtime voice, PromptTruth, `toolEvidenceReceipt`, default context, or memory authority.

## Strengthen Now

### Context7 Use Rule

Use Context7 only as a narrow documentation sidecar when a coding task depends on current library/API behavior, version-specific examples, setup options, or migration details.

Rules for agents:

- Prefer current official docs or Context7 for unstable library/API questions.
- Keep Context7 queries short, technical, and sanitized.
- Do not send API keys, tokens, credentials, proprietary source snippets, private conversation content, Penny memory contents, or user personal data in lookup queries.
- Treat Context7 output as external source evidence. It can inform implementation, but it does not outrank local code, tests, runtime artifacts, or Penny current-law docs.
- Do not auto-ingest Context7 output into Penny memory, archive memory, the research ledger, PromptTruth, `toolEvidenceReceipt`, or runtime voice assets.

Useful verification commands before adopting locally:

```bash
npx ctx7@latest --help
npx ctx7@latest library react "How to clean up useEffect with async operations"
npx ctx7@latest docs /facebook/react "How to clean up useEffect with async operations"
```

If MCP setup is desired for Codex, use the official Context7 Codex configuration guidance and verify startup in the Codex environment before adding project guidance. Prefer local/user setup over committing secrets or machine-specific configuration to the repo.

### Delegation Hygiene

When the user explicitly asks for subagents, agent-only research, or parallel delegated review, the parent agent should coordinate and synthesize instead of duplicating the same deep work in the parent thread.

Rules for agents:

- Delegate concrete, bounded sidecar tasks with clear source scope and output shape.
- Do not repeat the same deep research locally unless the user asked for parallel verification or the main thread needs a light source-health spot check.
- If a spawn fails, say that plainly and fix the workflow before pretending the delegated pass happened.
- If repo-level instructions and session/tool policy appear to conflict, surface the conflict instead of inventing an invisible rule.
- If a finding depends on which instruction file supplied a rule, cite the specific file path in the final synthesis because current Codex issue reports show provenance can be ambiguous.

### Penny Operator Stack

Keep a trimmed local operator stack for agents working on Penny. The useful pattern from `the-book-of-secret-knowledge` is not the giant catalog; it is a small, repeatable, inspectable command vocabulary.

Preferred stack:

- `rg` / `rg --files`: fast repo search and file discovery.
- `jq`: JSON inspection for artifacts, package metadata, API responses, and GitHub output.
- `curl`: source-health checks, local route checks, and API smoke calls.
- `lsof` / `fuser`: stale listener and port ownership checks, especially around `4317`.
- `tmux`: long-running local observation if a terminal session needs persistence.
- `fzf`: optional local navigation helper, not a repo dependency.
- `tldr`: quick command reminders when man pages are too slow.
- `HTTPie` or `hurl`: optional local HTTP debugging if already installed.

Use this as a human/operator note, not a package list. Do not add dependencies unless a repeated Penny workflow proves the need.

## Maybe Later

- Add Context7 as a personal Codex MCP/CLI setup if current library docs become a recurring bottleneck.
- Add a tiny repo-local skill or reference note for Context7 only after repeated use proves it saves time.
- Consider a review-only skill such as Brooks-style maintainability review for occasional second-pass critique, after checking license and dependency behavior.
- Consider `mcp-builder` only if Penny needs a tightly scoped local MCP server with an explicit owner and evaluation plan.
- Consider a small changelog/report-generation workflow only if Penny develops a real release cadence.

## Do Not Add

- Do not turn Penny into a generic knowledge platform, source warehouse, hosted sync system, marketplace, or app-control hub.
- Do not install Composio `connect`, Notion, Slack, Linear, lead-research, support-triage, or broad hosted-action skills into Penny core.
- Do not import offensive-security or reconnaissance tooling from `the-book-of-secret-knowledge` into Penny's default companion behavior.
- Do not copy random shell one-liners into runtime behavior without local safety review and a repeatable verification path.
- Do not add broad multi-agent orchestration frameworks such as worktree-fanout systems or all-in-one mode packs unless a separate plan proves the current Codex subagent tools are insufficient.
- Do not change runtime voice, PromptTruth, `toolEvidenceReceipt`, default context/rendered-memory limits, embedding defaults, LM Studio defaults, or memory authority from this review.

## License/Access Risk

- `trimstray/the-book-of-secret-knowledge` and `upstash/context7` are MIT at the repo level, but leaf links and indexed docs have their own licenses.
- `ComposioHQ/awesome-codex-skills` did not expose a top-level GitHub license through the API during review. Treat it as a catalog until each skill folder or linked repo is license-checked.
- Context7 private repo support and higher limits are paid. Do not assume private-source indexing is free or local-only.
- Third-party skill installation can execute local scripts or call hosted services. Review every `SKILL.md`, script, dependency, and license before installing.

## Privacy/Local-Data Risk

- Context7 says documentation lookup sends the formulated query, library name or id, API key if provided, client metadata, transport type, and HTTP rate-limiting metadata; it says full prompts, code, and conversation history are not sent. Still, agents must sanitize query text.
- Hosted skills and app connectors can move data off-machine. Keep them out of Penny core unless the user explicitly approves a separate external-action workflow.
- Do not send Penny memory files, runtime artifacts with personal data, private repo snippets, or user context into external lookup tools.

## Platformization Risk

- Low risk: targeted docs lookup for current framework/API questions.
- Medium risk: installing many generic skills globally without task-specific need.
- High risk: hosted app actions, marketplace automation, broad multi-agent orchestrators, or source warehouses that make Penny less local, less inspectable, or less companion-first.

## Current-Law Conflict

No runtime change is authorized by this note.

Current law still holds:

- Penny is a single-user local prototype.
- LM Studio remains the main brain.
- External sources are evidence, not repo law.
- Explicit memory remains canonical.
- Archive, research, open-loop, static, initiative, turn-state, and semantic surfaces remain bounded/advisory as documented.
- PromptTruth and `toolEvidenceReceipt` remain separate and must not be widened by this note.

## Owner Seams

If follow-up is approved, likely owners are:

- `AGENTS.md`: startup-path delegation and source-tool guardrails.
- `docs/README.md`: authority index entry and warnings.
- `docs/penny-codex-env-source-tools-note-2026-04-22.md`: this historical evidence note.
- Personal Codex config outside the repo: optional Context7 MCP/CLI setup. Do not commit API keys or machine-specific config.

Runtime owners that should not change for this slice:

- `server.js`
- `lib/`
- `public/js/`
- `penny-voice/runtime/`
- `data/`

## Verification Commands

Docs-only verification:

```bash
git diff --check
```

Optional local Context7 smoke, only if the user wants setup tested:

```bash
npx ctx7@latest --help
npx ctx7@latest library react "How to clean up useEffect with async operations"
```

Do not run LM Studio QA, browser smoke, or full `npm test` for this docs-only source-tools note unless another change touches runtime code or testable contracts.

## Artifact Scope/Limits

This is a historical evidence and workflow-guidance note. It can guide future agents, but it is not:

- dependency approval
- current runtime law
- a security audit of every linked tool
- a license audit of every skill
- permission to install external services
- permission to change Penny runtime behavior

## Suggested Next Slice

If this note proves useful, the next small slice is personal-environment setup only:

1. Decide whether Context7 should be installed for this user's Codex environment.
2. If yes, configure it outside the repo using official Codex/Context7 instructions.
3. Run a sanitized docs lookup smoke.
4. Record any machine-local setup detail in an ignored/local note, not committed repo law.

Non-goals remain unchanged: no hosted app actions, no external memory ingestion, no runtime behavior changes, and no broad multi-agent platform layer.
