# Penny External Lessons Master Action Plan

> Category: Implementation plan
> Authority: Draft master plan
> Status: Draft as of 2026-04-21
> Use this for: choosing bounded follow-up slices from the April 20-21 external research notes.
> Do not use this for: current runtime law, proof that a slice shipped, or license to merge/replace the source research docs.

## Purpose

This plan reconciles two source research notes into one slice-by-slice action plan for Penny:

- [penny-external-codebase-lessons-2026-04-20.md](../penny-external-codebase-lessons-2026-04-20.md)
- [penny-hneurons-utility-tools-static-embedding-lessons-2026-04-21.md](../penny-hneurons-utility-tools-static-embedding-lessons-2026-04-21.md)

The original research docs remain source evidence. This plan does not merge them, overwrite them, or promote them above current-law docs.

The guiding shape is:

- keep Penny companion-first, local-first, and single-user;
- keep explicit memory canonical;
- keep archive, research ledger, embeddings, imported artifacts, and tool/web facts advisory unless reviewed or receipt-backed;
- preserve the PromptTruth / toolEvidenceReceipt separation;
- prefer helper-owned slices over broad `server.js` or `public/js/penny-app.js` growth;
- reject platformization even when an external repo makes a broader system look tempting.

## Current-Law Anchors

Use these before turning any slice below into implementation:

- [docs/README.md](../README.md) for the docs authority hierarchy.
- [README.md](../../README.md), [CODEBASE.md](../../CODEBASE.md), and [ARCHITECTURE.md](../../ARCHITECTURE.md) for current repo truth.
- [penny-runtime-authority-contract-2026-04-17.md](../penny-runtime-authority-contract-2026-04-17.md) for memory and runtime authority.
- [penny-prompttruth-contract-2026-04-19.md](../penny-prompttruth-contract-2026-04-19.md) for rendered-vs-candidate prompt truth.
- [TEMPLATE.md](./TEMPLATE.md) for per-slice planning.

If code, tests, runtime artifacts, or contract docs disagree with this plan, trust those first and update this plan or the next slice doc.

## Delegation Map Used

This master plan consolidated four read-only mapping passes:

- completed-work mapping for the already-landed external-codebase Slice 1;
- overlap mapping across both research docs;
- conflict, duplicate, stale-assumption, and poor-fit mapping;
- recommended slice-order mapping.

No subagent edited files. The primary editor created this plan after consolidating those maps.

## Master Decisions

1. Slice 1 from the external-codebase note is already substantially landed: Docs / Skills Task-Fit Hardening.
2. The next implementation slice should be QA evidence, not runtime behavior: Over-Compliance and Remote-Content Trust QA.
3. Source-shaped tool/web output should be a narrow follow-up only after the QA slice shows the exact gaps.
4. The readiness / receipt summary idea should verify existing inspector coverage first so Penny does not grow a duplicate dashboard.
5. Offline ingestion provenance is a real later slice, but it must stay offline, optional, and review-gated.
6. PromptTruth / toolEvidenceReceipt separation is already law. Treat it as a guardrail, not a new roadmap project.
7. Static embeddings, SQLite, DuckDB, LiteLLM, SearXNG, tool approval metadata, and audio receipts are gated experiments or future seams, not default near-term work.
8. Cloud control planes, connector marketplaces, multi-user auth/sharing, task-manager memory, neuron intervention, HARTOS-style federation, and voice-cloning studio scope are rejected for Penny's current direction.

## Sequence Overview

| Slice | Name | Status | Priority | Risk | Verification Shape |
| --- | --- | --- | --- | --- | --- |
| 1 | Docs / Skills Task-Fit Hardening | Landed, minor follow-up optional | Complete | Low | Docs review |
| 2 | Over-Compliance and Remote-Content Trust QA | Next recommended slice | High | Low | Targeted tests plus QA artifacts |
| 3 | Source-Shaped Tool/Web Evidence Hardening | After Slice 2 if gaps are found | High | Low-medium | Tool-loop/direct-tool tests |
| 4 | Friendlier Local Readiness / Receipt Summary | Verify-first | Medium | Low-medium | Targeted tests plus browser smoke if UI changes |
| 5 | Offline Ingestion Provenance Hardening | Later bounded runtime slice | Medium | Medium | Knowledge ingestion tests and offline fixtures |
| 6 | Dangerous Tool Approval Metadata | Gated future slice | Low-medium | Medium | Registry and runtime-artifact tests |
| 7 | Static Embedding Provider Experiment | Gated research/eval slice | Low | High if rushed | Dedicated benchmark/eval harness |
| 8 | SQLite / DuckDB Storage and Artifact Study | Gated study, not migration | Low | Medium | Docs/eval artifact proof first |
| 9 | LiteLLM / SearXNG Adapter Review | Gated optional adapter study | Low | Medium | Pain-driven spike only |
| 10 | Presence / Audio Capability Receipts | Gated on real audio path | Low | Medium-high | Audio-path QA and browser/manual checks |

## Slice 1 - Docs / Skills Task-Fit Hardening

Status: Landed, with small optional follow-up.

Source pressure:

- External-codebase note: "Apply Now: Docs / Skills Task-Fit Hardening."
- H-Neurons / utility note: source-shaped output and evidence-before-behavior discipline.

What it asked for:

- Put hard laws and failure modes earlier in repo-local skills.
- Add task-fit fields: blockers, complexity, confidence, touched owners, verification cost, cleanup risk.
- Add receipt/authority checks: PromptTruth vs tool evidence, explicit memory vs archive/ledger, runtime artifacts vs prose.
- Add safe-refactor planning for `server.js` and `public/js/penny-app.js`.
- Add landed / verified / deferred fields to plan artifacts.

Current repo evidence:

- [.codex/skills/README.md](../../.codex/skills/README.md) now includes task-fit and source-of-truth ground rules.
- [.codex/skills/penny-lmstudio-ops/SKILL.md](../../.codex/skills/penny-lmstudio-ops/SKILL.md), [.codex/skills/penny-memory-inspector/SKILL.md](../../.codex/skills/penny-memory-inspector/SKILL.md), and [.codex/skills/penny-qa-release/SKILL.md](../../.codex/skills/penny-qa-release/SKILL.md) now carry task-fit and authority/receipt sections.
- [TEMPLATE.md](./TEMPLATE.md) carries task fit, evidence, safe-refactor, verification, cleanup, and results sections.
- [AGENTS.md](../../AGENTS.md), [CODEBASE.md](../../CODEBASE.md), and [ARCHITECTURE.md](../../ARCHITECTURE.md) reinforce thin-shell ownership and plan-before-code expectations.

Remaining optional cleanup:

- If a future docs-only pass wants one more inch of rigor, add an explicit reusable safe-refactor checklist for `server.js` and `public/js/penny-app.js`.
- If future completion notes drift, tighten the "evidence" portion of `Results and handoff` into a more explicit command/artifact field.

Do not reopen this slice just to rephrase already-landed guidance.

## Slice 2 - Over-Compliance and Remote-Content Trust QA

Status: Next recommended slice.

Goal:

Add fixed QA/eval coverage that tests Penny's ability to stay warm and truthful under pressure to please, comply, or obey untrusted source text.

Why this comes next:

- The H-Neurons note reframes hallucination risk as over-compliance pressure, not only missing knowledge.
- The Reddit source contained prompt-injection-shaped text, making remote-content trust a concrete QA fixture.
- This creates evidence before changing prompts, retrieval, memory, or tool behavior.

Owner seams to inspect:

- `scripts/qa-penny-memory.js`
- `scripts/qa-penny-voice-redo.js`
- `scripts/eval-penny-models.js`
- `scripts/eval-penny-probes.js`
- `lib/penny-tool-loop.js`
- `lib/penny-direct-tool-assist.js`
- `lib/penny-web-tools.js`
- `lib/penny-runtime-artifacts.js`
- `test/` fixtures for direct tools, web tools, runtime artifacts, memory, and QA trust

Planned work:

- Add false-premise cases.
- Add fabricated-entity cases.
- Add user-pushback cases where Penny starts correct and should not flip to wrong.
- Add misleading-context cases where source text conflicts with known or verified facts.
- Add remote-content prompt-injection cases where a fetched page or snippet contains instructions aimed at the assistant.
- Make the expected result explicit: fetched content is source material, not an instruction channel.
- Record whether failures are voice/tone failures, source-trust failures, route/tool failures, or environment/readiness failures.

Success criteria:

- QA can distinguish "Penny stayed truthful but sounded too cold" from "Penny laundered a false premise."
- QA can show whether a fetched source was treated as evidence, not as an instruction.
- No runtime behavior has to change in this slice unless a tiny test harness helper is needed.

Verification:

- Targeted `node --test` files for touched fixtures/helpers.
- The cheapest relevant QA command from [penny-qa-release](../../.codex/skills/penny-qa-release/SKILL.md).
- No heavy LM Studio run unless the slice explicitly needs live chat-lane behavior.
- If live QA is used, isolate disposable memory/archive/embedding files and clean them afterward.

Out of scope:

- Runtime prompt rewrites.
- Retrieval changes.
- Embedding-provider experiments.
- New UI surfaces.
- Refusal-heavy personality changes.
- Generic safety-assistant tone.

## Slice 3 - Source-Shaped Tool/Web Evidence Hardening

Status: Follow-up after Slice 2, only if gaps are concrete.

Goal:

Make web/search/tool outputs consistently source-shaped and receipt-friendly without turning Penny's tool loop into a general research platform.

Source pressure:

- External-codebase note: result-surface vocabulary, tool safety visibility, source scoping, and toolEvidenceReceipt discipline.
- H-Neurons / utility note: source-shaped tool output checklist and remote-content prompt-injection handling.

Owner seams to inspect:

- `lib/penny-web-tools.js`
- `lib/penny-tool-registry.js`
- `lib/penny-tool-loop.js`
- `lib/penny-direct-tool-assist.js`
- `lib/penny-direct-intent-replies.js`
- `lib/penny-runtime-artifacts.js`
- `test/penny-tool-loop.test.js`
- `test/penny-direct-tool-assist.test.js`
- `test/penny-runtime-artifacts.test.js`

Planned work:

- Verify what search and fetch results already expose: URL, requested URL, title, content type, fetchedAt, snippet/text, and fetch limits.
- Add missing source-limitation fields only where they are genuinely absent.
- Ensure toolEvidenceReceipt distinguishes deterministic tool evidence, prompt-visible source facts, and source limitations.
- Ensure direct web replies do not present snippets as obeyed instructions.
- Keep web facts compact enough for inspector and artifact use.

Success criteria:

- A future agent can tell what was fetched, what was only a snippet, what was truncated, and what Penny verified.
- Prompt-injection-shaped source text remains quoted/source content, not an instruction.
- ToolEvidenceReceipt gains clarity without becoming a PromptTruth channel.

Verification:

- Targeted direct-tool, tool-loop, and runtime-artifact tests.
- No browser smoke unless Memory/debug UI rendering changes.

Out of scope:

- New search providers.
- SearXNG integration.
- Broad citation manager.
- Connector marketplace posture.
- Moving generic receipt semantics into `server.js`.

## Slice 4 - Friendlier Local Readiness / Receipt Summary

Status: Verify-first medium-priority slice.

Goal:

Make Penny's existing runtime truth easier to answer at a glance, locally, without adding a new dashboard or new authority layer.

Source pressure:

- External-codebase note: Pi-hole, World Monitor, FileBrowser, Xray, and Agents SDK all point toward boring local inspectability.
- H-Neurons / utility note: boring utility layers matter more than a new UI shell.

Current caveat:

Penny already exposes a lot here: readiness, PromptTruth, toolEvidenceReceipt, recent audit slices, runtime artifacts, and Memory/debug inspector views. This slice must start by identifying a specific missing summary, not by assuming the surface is absent.

Owner seams to inspect:

- `lib/penny-runtime-artifacts.js`
- `lib/penny-route-handlers.js`
- `lib/penny-lmstudio-status.js`
- `scripts/penny-preflight.js`
- `public/js/penny-memory-panel.mjs`
- `public/js/penny-lmstudio-ui.js`
- `test/penny-runtime-artifacts.test.js`
- `test/penny-routes.test.js`
- `test/penny-memory-panel.test.js`
- `test/penny-preflight.test.js`

Planned work:

- First map the current status/inspector/preflight truth.
- If a gap remains, add one compact local summary for latest turn/runtime health.
- Prefer existing facts: lane, model, transport, semantic-memory ready/fallback, memory source counts, PromptTruth rendered/held-back counts, tool-evidence presence, and tool capability/write-risk summary.
- Keep CLI/preflight and browser inspector wording aligned where practical.

Success criteria:

- A user or agent can quickly answer "what did Penny use and what was degraded?" without digging through several artifacts.
- The summary derives from existing receipts rather than inference from zero counts or coarse executionPath values.
- PromptTruth and toolEvidenceReceipt remain separate.

Verification:

- Targeted unit tests for summary construction and UI rendering.
- `npm run preflight` only if preflight output changes.
- Browser smoke only if the Memory/debug panel changes.

Out of scope:

- Duplicate runtime dashboard.
- New monitoring product.
- New platform admin surface.
- Broad `server.js` expansion.
- Inferred receipt states that the runtime cannot prove.

## Slice 5 - Offline Ingestion Provenance Hardening

Status: Later bounded runtime slice.

Goal:

Strengthen Penny's offline ingestion pipeline so raw sources, derived chunks, checksums, dedup state, degraded/capability state, and review-only promotion are explicit.

Source pressure:

- External-codebase note: Paperless-ngx, transcribe-anything, NotebookLM-py, and ingestion lessons.
- H-Neurons / utility note: source boundaries, untrusted content, SQLite/DuckDB only if needed, and no retrieval-to-memory shortcut.

Current seams:

- `lib/penny-knowledge-contracts.js`
- `lib/penny-knowledge-ingestion.js`
- `scripts/import-penny-conversations.js`
- likely `test/penny-knowledge-ingestion.test.js`

Planned work:

- Add raw source artifact identity.
- Add source checksum or stable fingerprint.
- Add derived chunk ids that point back to raw source identity.
- Add dedup status where duplicate source or chunk identity can be proven.
- Add processing status: complete, degraded, skipped, failed, or capability-missing.
- Keep promotion packets review-only.
- Keep derived facts out of canonical explicit memory until reviewed.

Success criteria:

- Penny can explain where an imported candidate came from and which derived chunk produced it.
- Re-ingesting the same source can avoid duplicate promotion pressure.
- Capability failures are visible and do not silently look like clean ingestion.

Verification:

- Targeted knowledge-ingestion tests.
- Fixture-based offline import checks.
- No live chat QA unless a route that surfaces imported provenance changes.

Out of scope:

- Paperless-style document management.
- Scanner/email ingestion.
- Share links.
- Multi-user permissions.
- Transcript/media platform scope.
- Automatic memory promotion from imported material.
- Copyleft code imports from external projects.

## Slice 6 - Dangerous Tool Approval Metadata

Status: Gated future slice.

Goal:

Add approval/scope/write-risk metadata only when Penny gains a genuinely irreversible or sensitive tool that needs it.

Source pressure:

- External-codebase note: OpenAI Agents guardrails/HITL, awesome-mcp-servers security caution, FileBrowser scoping.

Current caveat:

Penny already has `ToolCapabilityDescriptor` with `surface`, `operationKind`, `sideEffectClass`, and `executionSupport`. Do not add a generic policy engine just because a vocabulary exists.

Possible owner seams:

- `lib/penny-tool-registry.js`
- `lib/penny-direct-tool-assist.js`
- `lib/penny-tool-loop.js`
- `lib/penny-runtime-artifacts.js`

Gate:

- A concrete new tool exists or is being designed.
- The tool has irreversible, external, sensitive, or high-cost side effects.
- Existing `sideEffectClass` is insufficient to describe the user approval boundary.

Possible planned work:

- Add fields such as `approvalRequired`, `scope`, `promptVisibility`, and `riskLabel` only if the gate is met.
- Add receipts for whether approval was required, requested, granted, denied, or bypassed because the tool was read-only.
- Keep the policy local and auditable.

Verification:

- Tool registry tests.
- Runtime artifact tests.
- Direct-tool/tool-loop tests for one concrete tool path.

Out of scope:

- Broad policy engine.
- MCP marketplace.
- Cloud connector control plane.
- Remote secrets or public API tokens.
- Generic multi-agent handoff architecture.

## Slice 7 - Static Embedding Provider Experiment

Status: Gated research/eval slice.

Goal:

Evaluate static embeddings only as a candidate provider after measurement proves retrieval is the bottleneck.

Source pressure:

- H-Neurons / utility note: Flower static embedding post and SentenceTransformers static model context.
- Existing repo context: Penny already keeps embedding caches model-aware and has Nomic / EmbeddingGemma comparison pressure.

Gate:

- A static embedding runtime or equivalent provider is available.
- Penny has current Nomic and EmbeddingGemma baselines.
- The benchmark covers Penny-specific semantic-memory recall/correction, not only generic retrieval scores.
- Cache model isolation and rebuild behavior are tested.

Possible owner seams:

- `lib/penny-memory-archive.js`
- embedding cache helpers around `data/penny-memory-embeddings.json`
- `scripts/eval-penny-runtime-fit.js`
- semantic-memory QA/eval scripts
- relevant memory/archive tests

Planned work:

- Measure query embedding, candidate embedding, vector search, LM Studio round trip, prompt eval, and generation separately.
- Try static embeddings as first-pass retrieval only if measurements justify it.
- Keep keyword fallback.
- Keep explicit memory canonical.

Verification:

- Dedicated benchmark/eval harness.
- Disposable memory/archive/embedding files.
- Nomic and EmbeddingGemma comparison artifacts.

Out of scope:

- Replacing Nomic or EmbeddingGemma by default.
- Auto-promoting embedding matches into explicit memory.
- Making static embeddings part of live chat prompt truth.
- Broadening `server.js` for an embedding experiment.
- Treating NanoBEIR or throughput claims as Penny recall proof.

## Slice 8 - SQLite / DuckDB Storage and Artifact Study

Status: Gated study, not migration.

Goal:

Decide whether SQLite or DuckDB solves a real Penny pain before changing storage.

Source pressure:

- H-Neurons / utility note: DuckDB for offline analysis; SQLite as a possible future live-state store if JSON becomes fragile.

Gate:

- JSON files become a demonstrated reliability, concurrency, or analysis bottleneck.
- The problem cannot be solved with smaller helpers or better artifact filtering.
- Explicit/archive/ledger boundaries can be preserved.

Possible planned work:

- Use DuckDB only for generated QA/eval artifact analysis if JSON and `jq` become annoying.
- Study SQLite WAL only for live state if one-writer constraints and recovery are clearer than current JSON files.
- Write a docs-only migration decision first.

Verification:

- Artifact-analysis proof or storage reliability evidence.
- No live migration without a separate plan.

Out of scope:

- Replacing memory files preemptively.
- Mixing explicit memory, archive memory, and research ledger authority.
- Database platformization.
- Multi-user state management.

## Slice 9 - LiteLLM / SearXNG Adapter Review

Status: Gated optional adapter study.

Goal:

Consider optional routing/search adapters only if current LM Studio or web paths show concrete pain.

Source pressure:

- H-Neurons / utility note: LiteLLM as routing vocabulary pressure; SearXNG as source-shaped search-output pressure.

Gate:

- LM Studio routing or fallback becomes too scattered for existing helpers.
- Current web search/fetch becomes unreliable or opaque.
- Adapter can stay optional, local-first, and receipt-backed.

Possible planned work:

- Docs-only adapter fit review first.
- If approved, a tiny spike outside core runtime hot paths.
- Preserve model/source/provenance receipts.

Verification:

- Adapter spike tests.
- No default route migration.

Out of scope:

- VPS or homelab proxy by default.
- Provider gateway as Penny's identity.
- Multi-provider marketplace.
- Broad hosted tool abstraction.

## Slice 10 - Presence / Audio Capability Receipts

Status: Gated on a real audio or presence path.

Goal:

If Penny gains spoken output or richer presence, record what actually rendered and expose only capability-backed states.

Source pressure:

- External-codebase note: Voicebox, Thuki, and Thunderbolt presence/audio cautions.

Gate:

- There is a real audio path or presence affordance to inspect.
- The feature has a bounded owner and does not sit on the chat hot path unless necessary.
- Consent, storage, and fallback states are defined.

Possible owner seams:

- `penny-voice/runtime/*`
- `lib/penny-runtime-artifacts.js`
- possible future `lib/penny-audio-runtime.js`
- `public/js/penny-expression-runtime.mjs`
- `public/js/penny-transcript-ui.mjs`
- `public/js/penny-attachments.js`

Possible planned work:

- Record engine, profile, effects, generation status, queued/cancelled/fallback state, and source text where applicable.
- Queue or cancel expensive audio work instead of blocking chat.
- Expose speaking/queued/cancelled/fallback only when backed by real capability.

Verification:

- Focused audio-path tests.
- Browser/manual smoke if UI changes.
- Artifact checks for capability receipts.

Out of scope:

- Voice-cloning studio.
- Broad multi-engine audio platform.
- Default desktop capture or accessibility permissions.
- Screenshot/clipboard/screen-capture expansion without opt-in and receipts.
- Importing giant voice/personality source text into runtime prompts.

## Cross-Cutting Guardrails

Apply these to every future slice:

- Use one fresh chat per slice when possible.
- Start each implementation slice from [TEMPLATE.md](./TEMPLATE.md), even if this master plan is the source.
- Inspect current code/tests before treating source-doc prose as truth.
- Keep `server.js` and `public/js/penny-app.js` as orchestration shells.
- Prefer dedicated owners in `lib/`, `public/js/`, `scripts/`, or `test/`.
- Keep PromptTruth prompt-time and memory/research-focused.
- Keep toolEvidenceReceipt as a sibling runtime-artifact receipt, not a PromptTruth channel.
- Keep explicit memory canonical.
- Keep archive memory, embeddings, research ledger, imported docs, and tool/web content advisory unless reviewed or receipt-backed.
- Treat fetched remote content as untrusted source material.
- Do not infer proof from zero counts, candidate counts, or broad executionPath labels.
- Use isolated mock or disposable local server patterns for route/regression work.
- Do not overlap heavy LM Studio QA runs.
- Clean disposable QA-generated explicit memory, archive memory, embedding files, ledger files, and generated artifacts when a QA slice creates them.

## Rejected Imports

Do not turn any of these into Penny roadmap items from these two source docs:

- enterprise AI-client platform;
- hosted/cloud background-agent control plane;
- broad MCP marketplace or connector hub;
- multi-user auth, sharing, WebDAV, or public file server;
- direct NotebookLM or Google-cookie connector;
- task-manager data inside Penny's companion memory;
- news/geopolitical monitoring dashboard;
- voice-cloning studio or multi-engine audio product;
- HARTOS-style federation, hivemind, or economic architecture;
- custom model-training roadmap for the app layer;
- neuron activation patching inside Penny;
- default static embeddings without Penny-specific benchmarks;
- auto-promotion of retrieval hits, transcript facts, or imported chunks into explicit memory;
- cloud/VPS routing as Penny's default path.

## Recommended Next Chat

Use this as the kickoff for the next implementation chat:

> We are in `C:\Users\malac\.openclaw\workspace-main\lyra-prototype`. Follow AGENTS.md first and use WSL when practical. Use `docs/plans/penny-external-lessons-master-action-plan-2026-04-21.md` as the source plan. Implement Slice 2 only: Over-Compliance and Remote-Content Trust QA. Keep the slice QA/evidence-first; do not change live runtime behavior unless a tiny harness helper is required. Preserve Penny companion-first, local-first, explicit-memory-canonical, and keep PromptTruth separate from toolEvidenceReceipt. Start by inspecting the named owner seams and current tests, then propose the smallest coherent fixture/test patch before editing.

## Handoff Notes

- Slice 1 is complete enough to stop treating it as an open prerequisite.
- The highest-value next work is Slice 2 because it creates evidence before prompt/runtime changes.
- Slice 3 and Slice 4 should not be reordered ahead of Slice 2 unless the user explicitly wants UI/operator truth work first.
- Slice 5 is the cleanest later runtime architecture slice.
- Slices 6-10 are gates, not commitments.
