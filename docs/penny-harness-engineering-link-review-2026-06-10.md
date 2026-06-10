# Penny External Link Review - 2026-06-10

> Category: External-source research synthesis
> Authority level: Historical evidence
> Current status: Current research note as of 2026-06-10
> Use this for: PennyOS harness ideas, Codex workflow ideas, Hermes Agent harness ideas, and bounded follow-up selection.
> Do not use this for: current runtime law, dependency approval, license approval for linked projects, memory ingestion, runtime voice changes, PromptTruth expansion, toolEvidenceReceipt expansion, hosted telemetry approval, or broad platform replacement.

Source reviewed:

- [walkinglabs/awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering)
- Raw README clone at commit `f84f170` dated 2026-05-23.
- Four read-only subagent passes: source health, general harness lessons, Penny repo-fit, and Codex/Hermes transfer.

The source is a curated list, not an implementation dependency. Its README frames harness engineering as shaping the environment around AI agents so they can work reliably, spanning context, evals, observability, orchestration, safe autonomy, specs, benchmarks, and runtimes.

## Source Health

The GitHub repository was reachable on 2026-06-10 and cloned locally for static inspection. The README contained 106 parsed links, grouped into courses, foundations, context/memory, guardrails, specs/workflow, evals/observability, benchmarks, and runtimes/reference implementations.

The list itself is [CC0 1.0](https://github.com/walkinglabs/awesome-harness-engineering/blob/main/LICENSE). That CC0 license covers the awesome list metadata, not the contents of linked articles, benchmark datasets, or repositories.

High-confidence sources read or sampled directly:

| Source | Health | Fit |
| --- | --- | --- |
| [awesome-harness-engineering](https://github.com/walkinglabs/awesome-harness-engineering) | Public, reachable, CC0 list | Primary inventory source |
| [OpenAI harness engineering](https://openai.com/index/harness-engineering/) | Browser reachable; local fetch hit WAF | Codex harness, repo-local knowledge, browser validation, observability |
| [Anthropic long-running harnesses](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Reachable | Initializers, progress artifacts, self-verification, handoffs |
| [Anthropic context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Reachable | Context budget, progressive disclosure, structured note-taking, subagents |
| [OpenAI skill evals](https://developers.openai.com/blog/eval-skills/) | Reachable | JSONL traces, deterministic verifiers, skill baselines |
| [OpenHands skill evals](https://www.openhands.dev/blog/evaluating-agent-skills) | Reachable | No-skill baseline, pass/fail first, traces for diagnosis |
| [Anthropic agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) | Reachable | Outcome graders, task/trial/suite vocabulary, transcript/trace discipline |
| [OpenTelemetry GenAI conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) | Reachable, version-sensitive | Naming inspiration for local traces; not export permission |
| [OpenHands prompt injection](https://www.openhands.dev/blog/mitigating-prompt-injection-attacks-in-software-agents) | Reachable | Hard policy, confirmation, sandboxing ideas |
| [Terminal-Bench 2.0/Harbor](https://www.tbench.ai/news/announcement-2-0) | Reachable | Task harness structure and terminal-agent benchmark lessons |

Health caveats:

- Many benchmark and runtime entries were classified from the awesome list and were not individually deep-read.
- Some GitHub projects in the list have no detected license, AGPL licensing, archived state, or unclear copyability. Treat those as pattern-only until checked.
- Some platform docs redirect, require interactive app context, or are hosted-product oriented.
- Subagent reports are source evidence, not proof by agreement.

## Already Landed

Penny already has much of the useful harness shape the source points toward:

- Repo-local working instructions and owner boundaries are present in `lyra-prototype/AGENTS.md`.
- Penny's shipped surface is local-first, single-user, LM Studio default, with ignored live memory, staged writes, URL safety, fixture sidecars, and release gates in `README.md`.
- Current-law separation is explicit in `docs/README.md`: persuasive docs do not outrank code, tests, prompt receipts, runtime artifacts, or current paths.
- Memory authority is already guarded. `ARCHITECTURE.md` keeps explicit memory canonical, archive review-gated, static candidates non-canonical, sidecars review-only, and PromptTruth/tool evidence separate.
- Runtime artifacts already carry provenance, cleanup transforms, promptTruth, sibling toolEvidenceReceipt, toolCostSummary, bounded reasoning policy, and bridge receipts.
- QA/eval helpers already include trace, trust, validity, candidate survival, source-sensitive fixtures, semantic source audit, static live compare, open-loop compare, frame budget, aliveness compare, and browser smoke.
- `npm run qa:browser:smoke` uses a mock LM Studio server for the real browser UI path.
- Sidecar and memory suggestion tests already prove no mutation and review-gated promotion for important seams.

## Strengthen Now

1. Add a tiny harness-source-fit checklist to the existing link-review workflow.

Why: the awesome list's strongest lesson is not "install a framework"; it is "make harness claims testable." Penny's link-review skill already has the right buckets, but a compact preflight checklist would make source-batch reviews more repeatable.

Owner seams:

- `lyra-prototype/.codex/skills/penny-link-review/SKILL.md`
- `docs/plans/TEMPLATE.md`

Verification:

- `git diff --check`
- `rg -n "Source health|Already landed|Strengthen now|Do not add" lyra-prototype/.codex/skills docs/plans`

2. Add a docs-only harness drift receipt to release review.

Why: new harness/eval/source tools can quietly change memory authority, PromptTruth, default context, model state, browser capture, or hosted export behavior. Penny should ask that explicitly before release claims.

Owner seams:

- `docs/release-checklist.md`
- `scripts/check-release-artifacts.js` only if this becomes machine-checked later

Verification:

- `git diff --check`
- `npm run check:release` if code/check scripts change

3. Tighten the "external-source review cannot mutate runtime authority" regression.

Why: Penny has productized sidecar no-mutation tests, but a generic external-source-review receipt fixture would lock down the exact risk raised by this source batch.

Owner seams:

- `lib/penny-sidecar-workflows.js`
- `test/penny-sidecar-section-completion-gate.test.js`

Expected fixture fields:

- `memoryWrite=false`
- `promptTruthChanged=false`
- `toolEvidenceReceiptChanged=false`
- `defaultContextChanged=false`
- `runtimeVoiceChanged=false`
- `modelStateChanged=false`

Verification:

- `node --test test/penny-sidecar-section-completion-gate.test.js`
- `npm run penny:sidecar:completion-gate` if the fixture is wired into that runner

4. Add no-skill / skill-enabled baselines for repo-local Penny skills.

Why: OpenAI and OpenHands both emphasize that a skill being plausible is not enough. Some skills help, some slow agents down, and some become stale as models change.

Owner seams:

- `.codex/skills/`
- `scripts/` for a small verifier or task runner
- `docs/penny-codex-env-source-tools-note-2026-04-22.md` or a new historical note if this stays docs-only

Verification shape:

- Choose one bounded task per skill.
- Define one output artifact.
- Run no-skill and skill-enabled variants.
- Compare pass/fail first, then runtime, event count, and cleanup correctness.

5. For Hermes Agent, add local stream replay fixtures before broader observability.

Why: the transferable harness lesson is explicit provider/stream/tool/finalization steps, not a hosted tracing stack. Hermes should be able to replay empty chunks, null output, malformed tool deltas, provider disconnect, duplicate finals, and UI reconnect behavior.

Owner seams:

- Hermes Agent repo, not PennyOS. No Hermes checkout was inspected in this review.

Verification shape:

- `pytest tests/test_stream_replay.py -q`
- Fixtures prove final visible message, tool events, error state, and `/health` behavior.

6. For Codex, add or reuse a handoff receipt checker.

Why: Codex work often fails when a handoff claims more than it proves. A lightweight checker can require environment labels, files read, files edited, tests run/not-run, artifact paths, and git actions.

Owner seams:

- Codex workflow scripts or repo-local docs. Not Penny runtime.

Verification shape:

- `node scripts/check-handoff-receipts.js docs/plans/<file>.md`

## Maybe Later

- Local trace viewer inspired by `agenttrace` or OpenTelemetry naming, only if current Penny runtime artifacts become hard to inspect.
- Benchmark-derived fixture suites for Penny-specific tasks, not broad leaderboards.
- Spec-driven development patterns through `docs/plans/TEMPLATE.md`, not a new framework.
- Browser harness ideas for UI QA only, not browser-extension capture or broad web automation in core.
- Local MCP/tool capability risk scanning inspired by Lurkr, only after a Penny-specific failure or review need appears.

## Do Not Add

- Hosted telemetry, cloud session replay, or public monitoring of private Penny chats.
- Browser-extension capture or broad browser history scraping in Penny core.
- Broad MCP adapter catalogs, marketplaces, or hundreds of external app connectors.
- Generic multi-agent campaign systems or autonomous harness evolvers that mutate Penny's harness.
- Graph DB, RDF, JSON-LD, SPARQL, Linked Data, or dereferenceable semantic IDs.
- Source-batch ingestion into Penny memory, PromptTruth, runtime voice, toolEvidenceReceipt, or default context.
- Live LM Studio/user-memory QA for this review class without explicit operator approval and isolated temporary state.
- Code copied from linked no-license, AGPL, archived, paywalled, or unclear-copyability projects.

## License/Access Risk

The awesome list itself is CC0. Linked sources are mixed:

- Safe to quote/link as source evidence: public articles and docs, within normal quotation limits.
- Check before copying code: every linked repository.
- Pattern-only until checked: no-license repositories, AGPL repositories, archived projects, benchmark datasets with separate terms, and hosted product examples.

Concrete warnings from the source-health subagent:

- `AgentBoard`, `AssistantBench`, `computer-agent-arena`, `WorkArena`, and `bringyour-mcp` had no detected license in sampled checks.
- `agent-studio` was sampled as AGPL-3.0.
- Some benchmark projects are stale or archived.

## Privacy/Local-Data Risk

Harness engineering often wants traces, browser state, session replay, logs, screenshots, and tool-call transcripts. For Penny, those are sensitive by default.

Apply the local-first version:

- Use fixture servers and disposable stores.
- Keep traces in local artifacts.
- Redact private prompts, memory, paths, and tokens where possible.
- Label checks as `local/static`, `local/live`, or `not run`.
- Keep live probes operator-gated.
- Do not export private traces to hosted observability by default.

## Platformization Risk

The biggest risk is turning PennyOS into a generalized agent platform. The current repo says Penny is a local/private, single-user companion prototype, not a distributed system or public internet service.

Harness ideas fit Penny when they make her more reliable, inspectable, and bounded. They do not fit when they add multi-user dashboards, connector marketplaces, hosted sync, browser surveillance, autonomous agent fleets, or generic framework sprawl.

## Current-Law Conflict

External sources are evidence, not Penny law.

Potential conflicts to reject unless a future plan explicitly proves otherwise:

- Any recommendation to increase prompt context before proving selection failure conflicts with Penny's frame-budget discipline.
- Any recommendation to merge tool evidence into PromptTruth conflicts with the existing sibling-receipt boundary.
- Any recommendation to auto-promote archive/static/source-review outputs into explicit memory conflicts with review-gated memory law.
- Any recommendation to use live LM Studio/user memory for regression checks conflicts with fixture/disposable verification policy.
- Any recommendation to add hosted traces or broad sync conflicts with Penny's local-first privacy posture.

## Owner Seams

Penny owner seams for follow-up slices:

- Link-review workflow: `lyra-prototype/.codex/skills/penny-link-review/SKILL.md`
- Planning checklist: `docs/plans/TEMPLATE.md`
- Release review: `docs/release-checklist.md`
- Runtime artifacts and receipts: `lib/penny-runtime-artifacts.js`
- QA traces/trust/validity: `lib/penny-qa-trace.js`, `lib/penny-qa-trust.js`, `lib/penny-qa-validity.js`
- Memory QA: `scripts/qa-penny-memory.js`, `lib/penny-candidate-survival-qa.js`, `lib/penny-context-pressure-qa.js`
- Sidecar no-mutation: `lib/penny-sidecar-workflows.js`, `test/penny-sidecar-section-completion-gate.test.js`
- Browser smoke: `scripts/qa-penny-browser-smoke.js`
- Frontend inspector: `public/js/penny-memory-panel.mjs`

Non-Penny owner seams:

- Codex handoff receipt checker belongs in Codex workflow scripts or repo-local process docs.
- Hermes stream replay fixtures belong in the Hermes Agent repo. This review did not inspect the live Hermes checkout.

## Verification Commands

Docs-only review commands:

```bash
git diff --check
```

Small Penny follow-up verification:

```bash
node --test test/penny-sidecar-section-completion-gate.test.js
npm run qa:semantic:source-audit
npm run qa:memory:candidate-survival-fixture
```

Release-level verification if code/check scripts change:

```bash
npm run check:release
```

Hermes idea verification, not run here:

```bash
pytest tests/test_stream_replay.py -q
```

Codex idea verification, not implemented here:

```bash
node scripts/check-handoff-receipts.js docs/plans/<file>.md
```

## Artifact Scope/Limits

This document is a historical external-source synthesis. It records source lessons, subagent findings, current Penny fit, and bounded follow-up candidates.

It is not:

- runtime law
- dependency approval
- license approval
- proof that linked benchmark claims are true
- proof that any follow-up slice has shipped
- permission to change live memory, PromptTruth, toolEvidenceReceipt, runtime voice, model defaults, or default context
- permission to run live LM Studio or user-memory QA

## Practical Lessons

1. Test the harness, not just the model.
2. Prefer deterministic graders before model judges.
3. Treat traces as first-class regression artifacts.
4. Build evals from real failures and manual release checks.
5. Separate capability evals from regression evals.
6. Make task assumptions visible in the fixture and verifier.
7. Check end state and collateral damage, not just final text.
8. Keep long-running work resumable with structured progress files.
9. Use progressive disclosure instead of giant instruction dumps.
10. Evaluate skills against no-skill baselines.
11. Make UI/runtime behavior legible through local logs, screenshots, health checks, and artifacts.
12. Control infrastructure variance before comparing models or harnesses.
13. Simulate worlds only when the state is resettable and inspectable.
14. Use hard gates for tool exposure; do not rely on model caution.
15. Use reference fixtures and examples for taste and behavior, not prose alone.

## Suggested Next Slice

Recommended first slice: add a tiny harness-source-fit checklist to the Penny link-review skill and/or planning template.

Why this first: it is low-risk, docs-only, and compounds future source reviews without touching runtime behavior.

Non-goals:

- no runtime code
- no memory writes
- no PromptTruth/toolEvidenceReceipt changes
- no hosted observability
- no live LM Studio checks
- no dependency imports

Verification:

```bash
git diff --check
rg -n "harness-source-fit|Source health|Already landed|Strengthen now|Do not add" lyra-prototype/.codex/skills docs/plans
```

## Receipts

Environment-sensitive labels:

- External source clone and static parsing: `local/static`
- Penny repo docs/source inspection: `local/static`
- Web source reads: `local/static` plus browser/web lookup
- Live Penny runtime, LM Studio, browser UI, LAN, and user memory checks: `not run`
- Hermes Agent checkout/runtime checks: `not run`

## Files Read

- `lyra-prototype/AGENTS.md`
- `lyra-prototype/MEMORY.md`
- `README.md`
- `CODEBASE.md`
- `ARCHITECTURE.md`
- `docs/README.md`
- `package.json`
- selected Penny `lib/`, `scripts/`, and `test/` references by `rg`
- `/tmp/awesome-harness-engineering/README.md`
- `/tmp/awesome-harness-engineering/LICENSE`
- `/tmp/awesome-harness-engineering/CONTRIBUTING.md`

## Files Edited

- `docs/penny-harness-engineering-link-review-2026-06-10.md`
- `scripts/check-penny-source-review.js`
- `scripts/check-penny-handoff-receipts.js`
- `scripts/check-penny-skill-baselines.js`
- `test/penny-source-review-check.test.js`
- `test/penny-handoff-receipts-check.test.js`
- `test/penny-skill-baselines-check.test.js`
- `fixtures/penny-skill-baselines/source-review-fixture.json`
- `package.json`

Commands run:

- `git clone --depth 1 https://github.com/walkinglabs/awesome-harness-engineering.git /tmp/awesome-harness-engineering`
- README link parser via Node
- `rg` over Penny docs/scripts/tests for fixture, trace, receipt, eval, QA, PromptTruth, and sidecar terms
- `nl -ba` / `sed` for line-referenced local docs

## Not Run

- `npm test`
- `npm run check:release`
- live Penny browser smoke
- live LM Studio probes
- Hermes Agent tests

## Git Actions

- `git status --short` inspected the dirty worktree.
- No files were staged.
- No commit was created.
- No push or pull request was attempted.
