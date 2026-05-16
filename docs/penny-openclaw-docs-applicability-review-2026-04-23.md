# Penny OpenClaw Docs Applicability Review - 2026-04-23

> Category: External-source research synthesis
> Authority level: Historical evidence
> Current status: Current research note as of 2026-04-23
> Use this for: Penny-native follow-through ideas from selected OpenClaw docs, especially source/provenance, skill hygiene, standing-order boundaries, Codex-harness shadow retest criteria, and docs routing.
> Do not use this for: current runtime law, dependency approval, OpenClaw adoption, hosted automation approval, memory ingestion, runtime voice changes, PromptTruth expansion, toolEvidenceReceipt expansion, default context increases, LM Studio replacement, or broad platform migration.

## Scope

The reviewed source set came from `Agent-Shared/Opie Links.md`, with deep focus on the six links the user highlighted:

- [Codex Harness](https://docs.openclaw.ai/plugins/codex-harness)
- [Memory Wiki](https://docs.openclaw.ai/plugins/memory-wiki)
- [Docs Directory](https://docs.openclaw.ai/start/docs-directory)
- [Skills](https://docs.openclaw.ai/tools/skills)
- [Standing Orders](https://docs.openclaw.ai/automation/standing-orders)
- [apply_patch Tool](https://docs.openclaw.ai/tools/apply-patch)

This pass used the repo-local `penny-link-review` workflow, direct source-health checks, and three read-only subagent passes:

- Codex Harness + apply_patch tooling.
- Memory Wiki + Docs Directory.
- Skills + Standing Orders.

The source links are OpenClaw docs. They can pressure Penny's workflow and future planning, but they do not outrank Penny's current code, tests, runtime artifacts, or authority docs.

## Source Health

- All six highlighted docs were reachable over HTTPS on 2026-04-23. `curl -I -L` returned `HTTP/2 200` for every highlighted URL.
- The docs are generated web pages, but they exposed enough text for source review and line-referenced excerpts through the browser reader.
- No paywall or login was encountered.
- The sources appear version-sensitive. Treat exact OpenClaw config names, Codex harness defaults, and tool policy details as current-source claims to re-check before implementation.
- The Obsidian note also lists broader OpenClaw docs around onboarding, nodes, gateways, multi-agent concepts, taskflow, subagents, ACP agents, and nodes/images. This report does not deep-read all of those. It scopes deep synthesis to the six highlighted links and uses the wider list only as topic context.

## Source Claims

### Codex Harness

- OpenClaw's Codex Harness lets OpenClaw run embedded agent turns through Codex app-server instead of the built-in PI harness. In that split, Codex owns low-level agent session execution, model discovery, native thread resume, native compaction, and app-server execution, while OpenClaw still owns channels, session files, model selection, tools, approvals, media delivery, and transcript mirror.
- The harness is off by default. It is selected for `codex/*` model refs or explicit runtime forcing, while non-Codex model refs keep their existing paths.
- The model prefix distinction matters:
  - `openai/*` means direct OpenAI provider through OpenClaw/PI plumbing.
  - `openai-codex/*` means Codex OAuth through PI.
  - `codex/*` means bundled Codex provider plus Codex app-server harness.
- Requirements include the bundled `codex` plugin, Codex app-server `0.118.0` or newer, and Codex auth available to the app-server process.
- For proving Codex-only execution, the docs recommend disabling PI fallback so harness/config errors fail early.
- Tools, media, approvals, and visible transcript delivery still remain OpenClaw-owned even when Codex runs the low-level harness.

### Memory Wiki

- `memory-wiki` is a companion plugin beside active memory, not a replacement for active memory. The active memory plugin still owns recall, promotion, indexing, and dreaming.
- It compiles durable knowledge into a wiki with deterministic pages, structured claims/evidence, provenance, confidence, contradictions, open questions, dashboards, search/get/apply/lint tools, and machine-readable digests.
- Vault modes are `isolated`, `bridge`, and `unsafe-local`. Bridge mode imports public active-memory artifacts through SDK seams; unsafe-local is an explicit local escape hatch.
- The compile pipeline writes machine-facing artifacts such as `agent-digest.json` and `claims.jsonl` so agents/runtime code do not have to scrape Markdown pages.
- Built-in report concepts include open questions, contradictions, low confidence, claim health, stale pages, provenance gaps, and unresolved questions.
- Prompt digest inclusion is opt-in because it changes prompt shape.

### Docs Directory

- The docs directory is a curated index, not an architectural contract.
- Its useful pattern is routing: start here, providers/UX, companion apps, operations/safety.
- Penny's `docs/README.md` already does a stricter version of this by separating authority level, status, intended use, and "do not use this for" boundaries.

### Skills

- OpenClaw skills are `SKILL.md` folders with frontmatter and instructions, loaded from bundled and local sources and filtered by environment, config, and binary presence.
- Skill precedence is workspace-first: workspace skills outrank project-agent skills, personal skills, managed/local skills, bundled skills, and extra dirs.
- In multi-agent setups, each agent can have its own workspace and effective skill set.
- Agent allowlists can restrict skill visibility. A non-empty per-agent list is final rather than merged with defaults.
- Plugin skills can be shipped by plugins and are low-precedence unless overridden by local/user/workspace skills.

### Standing Orders

- Standing orders grant durable operating authority for defined programs with scope, trigger, approval gates, and escalation rules.
- They are best kept in `AGENTS.md` or explicitly referenced by it because workspace bootstrap auto-injects only known top-level instruction files.
- Cron or heartbeat triggers should reference standing orders rather than duplicating the full procedure.
- The strongest reusable pattern is Execute, Verify, Report: do the work, confirm the result, then report what happened and what was verified.
- Best practice is narrow authority, explicit approval gates, "what not to do" sections, logs, and avoiding broad "do whatever" grants.

### apply_patch Tool

- OpenClaw's `apply_patch` is a structured patch tool for multi-file and multi-hunk edits.
- It takes one patch-formatted input string with add/update/delete operations.
- Paths may be relative to the workspace or absolute.
- `workspaceOnly` defaults to true. Disabling that should be intentional.
- The tool can be disabled or model-gated under OpenClaw's `tools.exec` config.

## Already Landed

- Penny already has a repo-local source-batch workflow through `penny-link-review`, including source health, landed/now/later/reject buckets, license/privacy/platform risks, current-law conflicts, owner seams, verification commands, and artifact limits.
- Penny already separates docs authority in [docs/README.md](./README.md): current law, strong guidance, product philosophy, implementation plans, historical evidence, public explanation, raw/source material, generated artifacts, and deprecated docs are not the same thing.
- Penny already has repo-local skills under `.codex/skills/`, plus tests that enforce the expected skill pack shape.
- Penny already has semantic IDs, predicates, domains, claims, source-audit checks, rendered-claim labels, local semantic export, dynamic links, and candidate-survival artifacts. That covers much of the Memory Wiki "structured claims/provenance" lesson without adopting a wiki plugin, graph DB, or hosted source warehouse.
- Penny already has source-sensitive and candidate-survival QA that distinguishes retrieval-path evidence from answer-quality proof.
- Penny already treats explicit memory as canonical and archive/research/open-loop/static/initiative/turn-state surfaces as bounded or advisory unless a current-law doc and code path say otherwise.
- Penny already keeps PromptTruth and `toolEvidenceReceipt` separate. External docs do not justify merging or widening them.
- Penny already keeps LM Studio as the primary brain and OpenClaw shadow as optional/experimental. Current shadow is a prompt handoff, not a full OpenClaw browser/exec/task surface.
- Penny's AGENTS and planning template already encode a lot of the Standing Orders discipline: task receipts, execution environments, source/tool hygiene, delegation maps, and explicit checks not run.

## Strengthen Now

These are small, Penny-native improvements that fit the current repo shape.

1. Preserve this review as historical evidence.
   - Owner: `docs/README.md`, this file.
   - Status: done by this note.
   - Why: future agents should not re-litigate whether these docs authorize platformization or runtime memory changes.

2. Add OpenClaw-skill intake questions to future skill reviews.
   - Owner: `.codex/skills/README.md`, `.codex/skills/penny-link-review/SKILL.md`, or `docs/plans/TEMPLATE.md`.
   - Questions: Does the skill inject host-process env/API keys? Require host binaries? Include installers? Depend on ClawHub or hosted services? Increase skill-list token load? Need OpenClaw-native `<workspace>/skills` placement rather than Codex `.codex/skills` placement?
   - Verification: `node --test test/penny-skill-pack.test.js`, `git diff --check`.

3. Add a Codex Harness retest condition to OpenClaw shadow guidance.
   - Owner: `docs/OPENCLAW_SHADOW_EVAL.md`.
   - Suggested wording: revisit shadow only when gateway health plus a disposable Codex-harness smoke can prove `codex/*` model routing, fallback behavior, tool availability, and a real browser/exec/background-task capability win without touching Penny memory or live LM Studio.
   - Verification: `git diff --check`.

4. Add wiki-like health counters only to existing local artifacts if review pain appears.
   - Owner: `lib/penny-semantic-source-audit.js`, `lib/penny-semantic-export.js`, `public/js/penny-memory-panel.mjs`.
   - Examples: open questions, contradictions, low-confidence claims, stale claims, missing evidence/source IDs.
   - Constraint: keep these as local inspection/export/report fields first, not prompt input.
   - Verification: `npm run qa:semantic:source-audit`, `npm run export:semantic-claims`, focused tests for touched owners.

5. Keep a compact standing-order posture, not an autonomous workflow.
   - Owner: `AGENTS.md`, parent `../AGENTS.md`, or `../HEARTBEAT.md` only if the user wants proactive checks.
   - Useful rule: read-only background checks are allowed when scoped; external sends/actions require approval; every proactive task ends with Execute, Verify, Report receipts.
   - Constraint: do not activate a heartbeat checklist without a real bounded need.

## Maybe Later

- Mirror selected Penny skills into OpenClaw-native skill locations only if OpenClaw agents actually need them. Codex `.codex/skills` and OpenClaw `<workspace>/skills` are adjacent ideas, not automatically the same runtime surface.
- Add a disposable OpenClaw-shadow smoke harness if shadow becomes active again. It should prove `/codex status`, model prefix behavior, fallback behavior, and tool availability without touching Penny user memory or live LM Studio.
- Add Obsidian-friendly semantic export if local semantic export becomes hard for humans to inspect.
- Add a `wiki_get`-style inspector navigation view only after real inspector use shows that claim/source browsing is painful.
- Use OpenClaw skill allowlists for dedicated OpenClaw agent roles only if multi-agent OpenClaw usage becomes real in this repo.
- Consider a referenced `standing-orders.md` only if `AGENTS.md` gets too crowded. Until then, core guardrails belong where agents actually load them.

## Do Not Add

- Do not replace LM Studio as Penny's main brain with Codex Harness or OpenClaw.
- Do not turn OpenClaw shadow into the default runtime from these docs.
- Do not install `memory-wiki` as Penny core or make it the source of truth for memory.
- Do not use Memory Wiki bridge/unsafe-local modes to ingest private daily notes, root memory files, or Penny runtime memory into an external plugin.
- Do not auto-ingest OpenClaw docs, ClawHub catalogs, third-party skills, external pages, or wiki digests into Penny memory.
- Do not enable compiled memory/wiki digests in Penny prompts by default.
- Do not expose `apply_patch` as a general Penny companion runtime file-write feature. Editing tools belong in bounded coding/tool workflows with receipts.
- Do not import OpenClaw YOLO/danger-style operating posture into Penny's runtime safety model.
- Do not store OpenClaw transcript mirrors, plan records, compaction traces, or app-server state in Penny memory.
- Do not create a CMS, source warehouse, hosted sync layer, universal memory wiki, graph DB, RDF/JSON-LD/SPARQL stack, marketplace, or broad multi-agent platform layer.
- Do not change runtime voice, PromptTruth, `toolEvidenceReceipt`, default context/rendered-memory limits, embedding defaults, LM Studio defaults, memory authority, or live prompt bridges from this review.

## License/Access Risk

- Reading and paraphrasing the public OpenClaw docs is low risk.
- Do not copy substantial doc text into Penny docs.
- Re-check exact OpenClaw source and license before copying examples, config blocks, or source material into committed repo docs.
- Third-party skill catalogs and plugin bundles require separate license/dependency/security review before installation.

## Privacy/Local-Data Risk

- Memory Wiki bridge and unsafe-local modes are the highest-risk ideas for this project because they can pull private memory, daily notes, or local files into another OpenClaw layer.
- OpenClaw skills may receive host-process environment variables or API keys depending on configuration. Do not put secrets in repo files.
- Hosted skills, app connectors, browser capture, and automation channels can move data off-machine. Keep them out of Penny core unless the user explicitly approves a separate workflow.
- OpenClaw transcript mirrors and Codex app-server threads are not Penny memory and should not be imported into Penny's memory system by default.

## Platformization Risk

- Low risk: using these docs as workflow evidence for better source review, skill intake, and shadow retest conditions.
- Medium risk: adding OpenClaw-native skill mirrors before there is a real OpenClaw agent role.
- High risk: adopting Memory Wiki, ClawHub skills, standing-order automations, Codex Harness, or apply_patch as core Penny runtime infrastructure.
- Bright line: Penny is a single-user local companion prototype. These OpenClaw docs can improve how agents work around Penny; they should not make Penny into a general OpenClaw platform front-end.

## Current-Law Conflict

- Replacing active memory with Memory Wiki conflicts with explicit-memory canonical law.
- Treating structured claims, wiki pages, links, semantic IDs, or compiled digests as truth conflicts with Penny's authority model.
- Adding prompt digests conflicts with PromptTruth/frame-budget boundaries unless the prompt rendering is explicit, capped, receipted, and measured.
- Treating OpenClaw docs-directory routing as repo law conflicts with Penny's stronger docs authority index.
- Treating standing orders as permission for autonomous external action conflicts with Penny's current local, single-user, approval-gated posture.
- Treating Codex Harness as Penny's main runtime conflicts with current LM Studio main-brain law and the parked OpenClaw-shadow verdict.
- Treating apply_patch as a runtime user-facing Penny action conflicts with bounded tool-loop receipts and explicit file-write verification rules.

## Owner Seams

- Docs/source-batch routing:
  - `docs/README.md`
  - `docs/penny-openclaw-docs-applicability-review-2026-04-23.md`
  - `docs/penny-codex-env-source-tools-note-2026-04-22.md`

- Skills/workflow:
  - `.codex/skills/README.md`
  - `.codex/skills/penny-link-review/SKILL.md`
  - `test/penny-skill-pack.test.js`
  - `docs/plans/TEMPLATE.md`

- Standing-order / heartbeat posture:
  - `AGENTS.md`
  - `../AGENTS.md`
  - `../HEARTBEAT.md`

- Memory/wiki-like local inspection:
  - `lib/penny-semantic-source-audit.js`
  - `lib/penny-semantic-export.js`
  - `scripts/qa-penny-semantic-source-audit.js`
  - `scripts/export-penny-semantic-claims.js`
  - `public/js/penny-memory-panel.mjs`

- OpenClaw shadow retest:
  - `docs/OPENCLAW_SHADOW_EVAL.md`
  - `server.js` only if a later approved implementation changes `runOpenClawShadow`
  - route tests only if shadow behavior changes

- Owners that should not change from this review:
  - `penny-voice/runtime/`
  - `data/`
  - PromptTruth or `toolEvidenceReceipt` schemas
  - LM Studio defaults

## Verification Commands

Source-health checks used in this pass:

```bash
curl -I -L --max-time 15 https://docs.openclaw.ai/plugins/codex-harness
curl -I -L --max-time 15 https://docs.openclaw.ai/plugins/memory-wiki
curl -I -L --max-time 15 https://docs.openclaw.ai/start/docs-directory
curl -I -L --max-time 15 https://docs.openclaw.ai/tools/skills
curl -I -L --max-time 15 https://docs.openclaw.ai/automation/standing-orders
curl -I -L --max-time 15 https://docs.openclaw.ai/tools/apply-patch
```

Docs-only verification:

```bash
git diff --check
```

Skill-pack follow-up, if skill docs change:

```bash
node --test test/penny-skill-pack.test.js
```

Memory/wiki-style artifact follow-up, if local inspection fields change:

```bash
npm run qa:semantic:source-audit
npm run export:semantic-claims
npm run qa:memory:candidate-survival-fixture
```

OpenClaw-shadow follow-up, only if explicitly approved later:

```bash
rg -n "OpenClaw|Codex Harness|apply_patch|runOpenClawShadow|PENNY_OPENCLAW_ENABLED" README.md ARCHITECTURE.md CODEBASE.md docs docs/OPENCLAW_SHADOW_EVAL.md server.js
```

Not run for this docs-only pass:

- `npm test`
- LM Studio QA
- browser smoke
- OpenClaw CLI checks
- live OpenClaw gateway or Codex-harness smoke

## Artifact Scope/Limits

This note is historical evidence and repo-fit synthesis. It records why these OpenClaw docs are interesting for Penny, which lessons already landed, what tiny follow-through might be worthwhile, and which imports are bad fits.

This note is not:

- dependency approval
- current runtime law
- source license audit
- security audit
- implementation proof
- automation authorization
- memory-ingestion permission
- PromptTruth or `toolEvidenceReceipt` expansion
- OpenClaw-shadow adoption approval
- permission to install OpenClaw plugins or skills

## Suggested Next Slice

The smallest useful next slice is docs/skill hygiene, not runtime:

1. Add OpenClaw-specific skill intake questions to the repo skill guidance or planning template.
2. Add a one-paragraph OpenClaw shadow retest condition to `docs/OPENCLAW_SHADOW_EVAL.md`.
3. Verify with `node --test test/penny-skill-pack.test.js` if skill docs changed, plus `git diff --check`.

Explicit non-goals:

- no runtime code
- no OpenClaw plugin install
- no Memory Wiki vault
- no live prompt digest
- no PromptTruth or `toolEvidenceReceipt` change
- no LM Studio or model-default change
- no standing-order automation activation
