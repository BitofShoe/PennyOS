# Docs Guide

This is the map for Penny's documentation. Use it to tell current law from philosophy, plans, history, public explanation, source material, and generated artifacts.

If a document is persuasive but the code, tests, or runtime artifacts disagree, trust the code, tests, and receipts first, then fix the doc.

## Read this first

If you are a new agent or contributor, use this order:

1. [../README.md](../README.md)
2. [../CODEBASE.md](../CODEBASE.md)
3. [../ARCHITECTURE.md](../ARCHITECTURE.md)
4. [penny-runtime-authority-contract-2026-04-17.md](./penny-runtime-authority-contract-2026-04-17.md)
5. [penny-prompttruth-contract-2026-04-19.md](./penny-prompttruth-contract-2026-04-19.md) if your question is specifically about prompt visibility, rendered-vs-candidate truth, or holdback semantics
6. [../server-js-section-map.md](../server-js-section-map.md), [../frontend-section-map.md](../frontend-section-map.md), and [penny-module-ownership.md](./penny-module-ownership.md) if you are editing orchestration or ownership boundaries
7. Only then open handoffs, plans, reviews, public explainers, or raw source material

If you want outward-facing or layperson docs instead of repo law, start with [penny-public/README.md](./penny-public/README.md).
If you need the recurring product instinct behind Penny's bounded slices after you finish current-law docs, read [penny-secret-third-thing-bounded-third-option-design.md](./penny-secret-third-thing-bounded-third-option-design.md).
If you are new to the codebase, read [penny-for-new-developers.md](./penny-for-new-developers.md). If you are configuring a local run, use [penny-configuration-profiles.md](./penny-configuration-profiles.md). If you are thinking about desktop packaging, read [../README.md](../README.md), [../INSTALL.md](../INSTALL.md), and [penny-tauri-wrapper-options-2026-05-19.md](./penny-tauri-wrapper-options-2026-05-19.md); the May 19 wrapper-options doc is historical/superseded where it says the sidecar route has not landed.

## Authority levels

- `Binding/current law`: The current contract. Use this for runtime behavior, invariants, memory authority, prompt authority, ownership boundaries, and operational truth.
- `Strong guidance`: Important current guidance, but not the final source of truth if a contract doc, code path, or test disagrees.
- `Product philosophy`: Companion-first or design-value guidance. Important, but not enforced the same way as engineering invariants.
- `Implementation plan`: Future-facing plan or checklist. Useful for next work, not proof that the work landed.
- `Historical evidence`: Review, synthesis, or snapshot evidence. Valuable context, but not standing law.
- `Public/external explanation`: Public-facing or layperson-oriented explanation. Good for communication, not governing repo truth.
- `Raw/source material`: Inputs that shape Penny's voice or product instincts. Not runtime law unless promoted into current runtime assets or contracts.
- `Generated/temporary`: Machine-generated extractions, logs, QA artifacts, bundles, or runtime state. Do not treat these as governing docs.
- `Deprecated/superseded`: Kept for history, but newer docs take precedence.

## Status labels

- `Current`: Intended to describe the current repo truth.
- `Needs verification`: Potentially useful, but verify against code/tests/runtime artifacts before relying on it.
- `Historical`: Snapshot of a past review, experiment, or state.
- `Superseded`: Kept for context, but a newer doc should be preferred.
- `Aspirational / not fully code-verified`: Describes intended behavior more strongly than current proof supports.
- `Generated`: Machine-produced or runtime-produced output.
- `Draft`: Still forming; do not treat as settled truth.

## Warnings

- Historical reviews can be valuable without being current law.
- Product principles and engineering law must not be collapsed.
  `Penny should not become sterile` is product philosophy. `researchLedgerPromptInjected must mean actually rendered into the prompt` is engineering law.
- Some docs describe intended truth more cleanly than the runtime currently implements. Treat those as `Needs verification` or `Aspirational / not fully code-verified`, not as proof.
- Persuasive prose never outranks prompt-time receipts, runtime artifacts, passing tests, or the current code path.
- Candidate-survival artifacts are retrieval-path evidence, not PromptTruth and not answer-quality proof. Use [../README.md](../README.md), [../ARCHITECTURE.md](../ARCHITECTURE.md), and [../CODEBASE.md](../CODEBASE.md) for the current operator interpretation before changing retrieval, ranking, PromptTruth, embedding defaults, or rendered-context limits.
- Penny's release posture is source-available technical preview: local/private, single-user, and not intended for public internet exposure. LM Studio is the default local brain, llama.cpp/generic OpenAI-compatible endpoints are supported, and the Tauri desktop shell now has a bundled Penny server/runtime sidecar path while still requiring separate clean Windows consumer proof before release claims.
- External link batches should use the local `penny-link-review` workflow, when available, to keep source health, landed work, strengthen-now ideas, later ideas, rejected imports, license/privacy/platform risks, current-law conflicts, owner seams, verification commands, and artifact limits separate.
- April 22 Codex environment source-tools guidance is recorded in [penny-codex-env-source-tools-note-2026-04-22.md](./penny-codex-env-source-tools-note-2026-04-22.md). It can guide Context7, Codex-skill, delegation, and local operator-tool habits for agents helping code Penny, but it is not dependency approval, runtime law, memory-ingestion permission, PromptTruth/toolEvidenceReceipt expansion, or hosted automation approval. The public follow-through lives in [plans/TEMPLATE.md](./plans/TEMPLATE.md); local operator instructions and repo-local skill packs are intentionally not shipped as public release files.
- April 21 link-batch follow-through is now status-labeled in the source note and master plan: pressure-watch trust work landed as QA/eval coverage, Gemma runtime watch landed as fixture/status artifacts, and token/output-cost descriptors landed as advisory metadata. None of that is a license to change runtime voice, expand PromptTruth, enable default thinking, raise default context, switch embedding providers, or import external dependencies.
- Static embedding live sidecar docs describe an opt-in local experiment, not default law. Normal repo posture is static mode unset/`off` or QA-only shadow comparison; `PENNY_STATIC_EMBED_MODE=live-advisory` is local experimental mode with the static-only render cap, authority gates, unchanged prompt limits, and no PromptTruth / `toolEvidenceReceipt` expansion.
- Open-loop tracker docs describe advisory continuity state, not explicit memory or autonomous initiative. The state/store/lifecycle code has landed, and the shipped `.env.example` local companion profile enables the live prompt bridge with `PENNY_ENABLE_OPEN_LOOP_PROMPT=1`; deleting that line returns to the raw server default of off. It remains bounded by max-one rendering, token caps, expiry/dismissal/completion controls, and compare evidence; profile enablement is not PromptTruth expansion, prompt-limit expansion, or permission to surface unrelated follow-ups.
- Bounded initiative docs describe a suggest-only response scaffold, not autonomous action. The shipped `.env.example` profile enables the live bridge with `PENNY_ENABLE_BOUNDED_INITIATIVE=1`; deleting that line returns to the raw server default of off. It remains capped at one suggestion, cooldown-aware, user-dismissible, source/risk-gated, and separate from PromptTruth / `toolEvidenceReceipt`.
- Ephemeral turn-state docs describe a current-turn response-shaping scaffold, not memory, chain-of-thought, psychological profiling, or truth authority. The shipped `.env.example` profile enables the live bridge with `PENNY_ENABLE_TURN_STATE_PROMPT=1`; deleting that line returns to the raw server default of off. It remains capped by `PENNY_TURN_STATE_MAX_TOKENS`, redacted before runtime-artifact retention, and separate from PromptTruth / `toolEvidenceReceipt`.
- Bounded aliveness compare docs describe QA/adoption evidence, not runtime law. Fixture artifacts from `npm run eval:aliveness:fixture` can recommend only live-shadow review; live-isolated artifacts from `node scripts/eval-penny-aliveness-compare.js --live-isolated` use disposable state plus a mock LM Studio backend and can recommend live-advisory review only when trust, annoyance, prompt, latency, environment, and cleanup gates pass. The profile defaults are deliberately conservative and user-editable; they do not remove the need for repeated real compare passes, manual review, user controls, and current docs before broader behavior changes.
- Penny Frame Budget docs describe current implementation discipline, not a license to stuff more prompt context. Spend the per-turn runtime/context budget first on relevance, source authority, and candidate selection before more rendering; apply that to static live memory reflex, open loops, turn-state, initiative, session reflection, dynamic memory linking, and aliveness/frame-budget compares without expanding PromptTruth, merging `toolEvidenceReceipt`, changing runtime voice, raising default prompt/rendered-memory limits, treating artifacts as answer-quality proof, or broadening `server.js`. The landed frame-budget receipts, sidecar schedules, background-frame queue, budget-aware candidate merge, and fixture compare harness are runtime-shape/status evidence only; missed deadlines should degrade or skip optional work before any prompt-limit expansion.
- Session reflection docs describe reviewable synthesis, not canonical memory. The R1-R8 stack now has helper-owned artifacts, policy classification, a local suggestion queue, explicit approval routing through the existing memory path, advisory open-loop updates, and a fixture-only compact prompt-bridge compare. Memory suggestions still require approval, keep support state, sensitivity, `requiresApproval`, and `autoPromoted: false`; reflection artifacts are not PromptTruth, not `toolEvidenceReceipt`, not hidden chain-of-thought, and not proof that their summaries are true. The compact bridge is compare evidence only; broad/default live rendering remains disabled.
- Dynamic memory linking docs describe retrieval/navigation hints, not graph authority. The helper/fixture/QA/compare stack exists, links can now carry local semantic contract metadata, and conservative correction scoring is gated by `PENNY_MEMORY_LINK_SCORING=correction-v1`, but links do not make advisory memory canonical, do not replace explicit memory, do not prove either linked item true, do not expand PromptTruth or `toolEvidenceReceipt`, do not change runtime voice, and do not justify a graph DB or universal memory index. Project-thread, research-pattern, open-loop, semantic, static, and candidate-only links remain advisory/shadow until separately measured.
- Semantic identity/provenance docs describe local implementation contracts, not graph authority. Stable `penny:*` IDs can help claims, links, traces, vector sources, and rendered-context receipts refer to the same local thing; the local predicate registry can make relation behavior explicit and testable; dynamic-link contracts can bind memory links to registered predicates, source/target claim IDs, source authority, support state, and bounded evidence without canonizing either endpoint; authority-domain contracts can keep explicit memory, archive, research, static, open-loop, tool-evidence, document-extraction, repo-current-law, runtime-artifact, and fixture claims from collapsing into one authority soup; the claim contract can keep subject, predicate, object, source, authority, support, temporal, stale-status, and registered domain fields together; structured candidate-contract QA can flag wrong-predicate, stale-object, temporal, missing-source, unstable-claim-id, source/domain mismatch, and authority-overclaim failures; source-ID audit can flag missing or unstable source IDs, static cache/source mismatches, rendered-item source gaps, dynamic-link endpoint gaps, invalid link IDs, and semantic-claim source/claim drift; candidate-survival semantic claim traces can distinguish expected structured claims from unstructured advisory text, wrong-predicate matches, and candidate-only static/semantic claims without changing runtime behavior; PromptTruth can preserve compact rendered-claim authority labels only for archive claim summaries that actually rendered; and local semantic export can write plain `penny-json` debug artifacts for claims, links, domains, predicates, and semantic IDs. IDs, predicates, domains, claim contracts, candidate-contract QA, source-ID audit, dynamic-link semantic contracts, candidate-survival claim traces, rendered-claim labels, and export artifacts are not evidence by themselves; they do not authorize RDF/JSON-LD/SPARQL infrastructure, URL fetching, memory promotion, live ranking changes, raw PromptTruth graph expansion, `toolEvidenceReceipt` changes, prompt-limit increases, public Linked Data, or graph DB replacement.

## Enforcement questions

When a document makes an important claim, check these in order:

1. Is there a current contract doc that says this plainly?
2. Is there a code path that enforces it?
3. Is there a test that would fail if it drifted?
4. Is there a runtime artifact or inspector receipt that can show it in practice?
5. Is the claim only a product principle?
6. Is the claim only a historical review statement?
7. Is the claim only a future plan?

## Ordered docs map

This section keeps current law first, then follows the interpretive order from [penny-docs-and-live-qa-agent-brief.md](./penny-docs-and-live-qa-agent-brief.md): synthesis and review evidence before plans, then public docs and source material. The extra guidance/philosophy rows below are Penny-specific overlays that sit between contracts and historical evidence.

### 1. Governing contract docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [../README.md](../README.md), [../CODEBASE.md](../CODEBASE.md), [../ARCHITECTURE.md](../ARCHITECTURE.md) | Public repo orientation and guardrails | Binding/current law | Current | install, repo truths, runtime shape, source/generated boundaries | detailed architecture history |
| [penny-for-new-developers.md](./penny-for-new-developers.md) and [penny-configuration-profiles.md](./penny-configuration-profiles.md) | New developer and configuration guide | Binding/current law | Current | practical onboarding, env profiles, current release defaults | historical plan status |
| [../README.md](../README.md) | Contributor/operator entrypoint | Binding/current law | Current | current runtime shape, runbook, memory/runtime overview | public marketing or historical archaeology |
| [../CODEBASE.md](../CODEBASE.md) | Repo map and source-vs-generated boundary | Binding/current law | Current | where code lives, what is generated, edit boundaries | product philosophy |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Current engineering architecture | Binding/current law | Current | present-tense architecture and subsystem behavior | public-facing explanation |
| [penny-runtime-authority-contract-2026-04-17.md](./penny-runtime-authority-contract-2026-04-17.md) | Runtime authority contract | Binding/current law | Current | memory authority, prompt truth, advisory vs canonical rules | full project history |
| [penny-prompttruth-contract-2026-04-19.md](./penny-prompttruth-contract-2026-04-19.md) | Prompt-truth contract | Binding/current law | Current | rendered-vs-candidate truth, prompt visibility rules, holdback semantics | full runtime authority beyond prompt context |

### 2. Strong guidance and continuity docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [../server-js-section-map.md](../server-js-section-map.md), [../frontend-section-map.md](../frontend-section-map.md), [penny-module-ownership.md](./penny-module-ownership.md) | Ownership and orchestration boundaries | Strong guidance | Current | who owns what when editing shells and subsystems | product-law disputes without code checks |
| [penny-lan-phone-reset-runbook-2026-04-21.md](./penny-lan-phone-reset-runbook-2026-04-21.md) | Local operations runbook | Strong guidance | Current | phone/LAN access resets, Windows-vs-WSL port truth, stale listener cleanup, and `start-lyra.ps1` launcher traps | broad LAN security posture or model-quality diagnosis |
| [sidecars/penny-sidecar-productized-workflows.md](./sidecars/penny-sidecar-productized-workflows.md) | Source/dev sidecar harness guide | Strong guidance | Current source/dev only | env-gated fixture defaults, failure states, and review-only receipts for SearXNG, docs/RAG, and Speaches TTS/audio | consumer Settings UI behavior, packaged runtime contents, or proof that live SearXNG, Qdrant, or Speaches services are installed or running |
| [penny-experience-review-packet.md](./penny-experience-review-packet.md) | External review packet workflow | Strong guidance | Current | building private local-run receipt bundles for reviewers who cannot run Penny | proof of live companion quality without fresh artifacts |
| [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md) | Shadow-mode verdict | Strong guidance | Current | current keep/park policy for shadow mode | general runtime law beyond shadow scope |
| [penny-docs-and-live-qa-agent-brief.md](./penny-docs-and-live-qa-agent-brief.md) | Interpretive brief | Strong guidance | Needs verification | docs interpretation and recent QA framing | current repo law or exact repo snapshot truth |

### 3. Product philosophy and design-instinct docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [penny-secret-third-thing-bounded-third-option-design.md](./penny-secret-third-thing-bounded-third-option-design.md) | Product philosophy / agent-orientation note | Product philosophy | Draft | recurring bounded-third-option design instinct and slice framing | overriding contracts, tests, runtime artifacts, or prompt receipts |

### 4. Master synthesis docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [penny-research-master-synthesis-2026-04-16.md](./penny-research-master-synthesis-2026-04-16.md) and [penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md](./penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md) | Architecture memory and master synthesis | Historical evidence | Historical | high-level rationale, project-shaping conclusions, and architectural follow-through context | current implementation truth without verification |
| [penny-progress-handoff-2026-04-17.md](./penny-progress-handoff-2026-04-17.md) | Continuity snapshot | Strong guidance | Current | freshest landed-vs-deferred continuation context | binding runtime contract |

### 5. Research synthesis docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| dated `*-synthesis-*`, `*-lessons-*`, and `*-pass-*` docs such as [penny-memory-external-research-synthesis-2026-04-16.md](./penny-memory-external-research-synthesis-2026-04-16.md), [penny-web-source-lessons-report-2026-04-17.md](./penny-web-source-lessons-report-2026-04-17.md), and [penny-illusion-of-thinking-lessons-2026-04-18.md](./penny-illusion-of-thinking-lessons-2026-04-18.md) | Outside-source interpretation and follow-through evidence | Historical evidence | Historical | translated research takeaways and Penny-specific implications | current implementation truth without verification |
| [penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md](./penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md) | Frontier-prompt structure note | Historical evidence | Current | the CL4R1T4S frontier-prompt follow-up for Penny prompt-slot structure, spirit-first recall, no-helpdesk closer guidance, and compact runtime-voice follow-through | current runtime contract or a license to import giant frontier prompt slabs |
| [penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md](./penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md) | External-memory fit note | Historical evidence | Current | recent apply-vs-poor-fit synthesis for CharMemory and Mnemosyne-style ideas | current runtime contract or storage law |
| [penny-external-codebase-lessons-2026-04-20.md](./penny-external-codebase-lessons-2026-04-20.md) | External-codebase lessons note | Historical evidence | Current | repo-grounded lessons from external AI client, agent workflow, monitoring, ingestion, MCP, file, voice, and task-tracking codebases | current runtime contract, broad platformization, or proof that follow-up slices shipped |
| [penny-hneurons-utility-tools-static-embedding-lessons-2026-04-21.md](./penny-hneurons-utility-tools-static-embedding-lessons-2026-04-21.md) and [penny-hneurons-reference-audit-2026-04-21.md](./penny-hneurons-reference-audit-2026-04-21.md) | H-Neurons and trust research notes | Historical evidence | Current | over-compliance, source-boundary, static-embedding, utility-tool, and H-Neurons bibliography lessons for Penny and coding agents | current runtime law, neuron-level intervention, or proof that follow-up slices shipped |
| [penny-llm-geometry-runtime-lessons-2026-04-21.md](./penny-llm-geometry-runtime-lessons-2026-04-21.md) | LLM geometry and runtime lessons note | Historical evidence | Current | semantic-candidate, source-boundary, context-pressure, runtime-shape, and measurement lessons for Penny | current runtime law, hidden-state intervention, product doctrine, or proof that follow-up slices shipped |
| [penny-sharper-candidate-selection-research-plan-2026-04-21.md](./penny-sharper-candidate-selection-research-plan-2026-04-21.md) | Candidate-selection research plan | Historical evidence | Current | sharper recall through candidate survival, hybrid retrieval signals, static-embedding comparison framing, and the recommended measurement-first next slice | current runtime law, default embedding-provider choice, or proof that follow-up slices shipped |
| [penny-pressure-persuasion-agent-research-pass-2026-04-21.md](./penny-pressure-persuasion-agent-research-pass-2026-04-21.md) | Pressure and agent-integrity research note | Historical evidence | Current | persuasion-bombing, peer-pressure, survival-pressure, TinyWorld benchmark hygiene, and pressure-aware QA lessons for Penny and coding agents | current runtime law, runtime voice changes, PromptTruth/toolEvidenceReceipt expansion, or proof that follow-up slices shipped |
| [penny-link-batch-research-pass-2026-04-21.md](./penny-link-batch-research-pass-2026-04-21.md) | April 21 link-batch research note | Historical evidence | Current | Gemma/runtime watch items, harness/token-cost lessons, source/wiki capture patterns, document extraction cautions, candor-under-pressure takeaways, and the status overlay for landed follow-through slices | current runtime law, dependency approval, broad platform imports, runtime voice changes, PromptTruth expansion, toolEvidenceReceipt expansion beyond optional sibling cost metadata, default thinking/context/embedding changes, or external dependency imports |
| [penny-harness-engineering-link-review-2026-06-10.md](./penny-harness-engineering-link-review-2026-06-10.md) | Harness engineering source review | Historical evidence | Current with source/dev gate follow-through | harness-source-fit buckets, handoff receipt requirements, skill-baseline fixture expectations, and source/dev checker commands | packaged-app runtime behavior, dependency approval, memory ingestion, PromptTruth/toolEvidenceReceipt expansion, runtime voice changes, or bundled diagnostics claims |
| [penny-codex-env-source-tools-note-2026-04-22.md](./penny-codex-env-source-tools-note-2026-04-22.md) | Codex environment and source-tool review note | Historical evidence | Current | Context7/Codex-skill/operator-tool guidance for agents helping code Penny, delegation hygiene, and rejected platformization paths | dependency approval, runtime law, memory ingestion, hosted automation, PromptTruth/toolEvidenceReceipt expansion, or runtime behavior changes |
| [penny-openclaw-docs-applicability-review-2026-04-23.md](./penny-openclaw-docs-applicability-review-2026-04-23.md) | OpenClaw docs applicability review | Historical evidence | Current | Codex Harness, Memory Wiki, Docs Directory, Skills, Standing Orders, and apply_patch lessons for Penny's workflow, provenance, skill hygiene, and shadow retest criteria | current runtime law, OpenClaw adoption, Memory Wiki install, hosted automation, runtime voice changes, PromptTruth/toolEvidenceReceipt expansion, or platform migration |
| [penny-qwen36-localllama-reddit-lessons-2026-04-22.md](./penny-qwen36-localllama-reddit-lessons-2026-04-22.md) | Qwen3.6 LocalLLaMA Reddit lessons note | Historical evidence | Current | Reddit-derived Qwen3.6, agent-harness, tool-loop, local-runtime, security, and Penny model-eval follow-through ideas | current runtime law, default model approval, OpenClaw/Hermes adoption, default thinking/context changes, PromptTruth/toolEvidenceReceipt expansion, memory ingestion, or broad agent platform imports |
| [penny-local-llm-apps-link-review-2026-05-10.md](./penny-local-llm-apps-link-review-2026-05-10.md) | Local LLM apps and sidecar review | Historical evidence | Current with scaffold follow-through | app-first local-LLM sidecar ideas, OpenCode/Pi/Open WebUI/Qwen-vs-Gemma/endpoint-watch follow-through seams | dependency approval, license approval, runtime law, model proof, sidecar authority, memory ingestion, PromptTruth/toolEvidence expansion, default thinking/context/model changes |
| [penny-memory-agent-link-review-2026-05-12.md](./penny-memory-agent-link-review-2026-05-12.md) | Memory-system and agent-workflow link review | Historical evidence | Current source review | Medium/Reddit memory-system lessons, Impeccable sidecar UI-review ideas, and bounded Penny/coding-agent follow-through slices | runtime law, dependency approval, license approval, model proof, memory ingestion, PromptTruth/toolEvidenceReceipt expansion, default context changes, or platformization |
| [LOCAL_LLAMA_THREAD_FINDINGS.md](./LOCAL_LLAMA_THREAD_FINDINGS.md) and [RYS_FOLLOWUP_REVIEW.md](./RYS_FOLLOWUP_REVIEW.md) | Root-era research notes | Historical evidence | Historical | maintainability and probe-first evaluation lessons that shaped later Penny work | current runtime law without checking newer code, tests, and docs |

### 6. Review/audit docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [penny-review-2026-04-18.md](./penny-review-2026-04-18.md), [penny-review-commit-5c08ac0.md](./penny-review-commit-5c08ac0.md), and [penny-memory-archive-audit.md](./penny-memory-archive-audit.md) | Review snapshots | Historical evidence | Historical | bugs, risks, and pressure-test findings tied to a snapshot | standing law |
| [PENNY_MODEL_EVAL.md](./PENNY_MODEL_EVAL.md) | Model eval runbook | Strong guidance | Current | local model comparison process and QA harness entrypoints | proof of current model quality without fresh isolated QA artifacts |
| [penny-experience-review-packet.md](./penny-experience-review-packet.md) | External live-artifact review workflow | Strong guidance | Current | giving GPT Pro or another remote reviewer local-run artifacts without committing private output | proof that any omitted live receipt passed |

### 7. Bounded implementation plans

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [plans/](./plans/) and [plans/TEMPLATE.md](./plans/TEMPLATE.md) | Implementation plans | Implementation plan | Draft | bounded next slices and planning format | proof that behavior shipped |
| [plans/penny-external-lessons-master-action-plan-2026-04-21.md](./plans/penny-external-lessons-master-action-plan-2026-04-21.md) | April 21 master action plan | Implementation plan | Current | revised slice map, fixture-only cleanup routing, landed-vs-deferred status through the pressure-watch, Gemma-watch, advisory cost, skill, deterministic-extraction, and frame-budget follow-through slices, and next-slice routing | proof that behavior shipped without checking code, tests, and artifacts |
| [plans/penny-nosy-experts-lessons-followthrough-2026-04-23.md](./plans/penny-nosy-experts-lessons-followthrough-2026-04-23.md) | Nosy Experts lessons follow-through plan | Implementation plan | Draft | bounded Penny and agent-workflow follow-through from the Reddit "Nosy Experts" discussion, especially steering-vs-delivery separation, correction-trace hygiene, and a gated long-form editorial bridge | proof that fake internal reviewers, story queues, drafting mode, or advisory-bridge behavior shipped |
| [plans/penny-tier1-aliveness-plans/README-tier1-bounded-aliveness-plans.md](./plans/penny-tier1-aliveness-plans/README-tier1-bounded-aliveness-plans.md), [plans/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md](./plans/penny-tier1-aliveness-plans/02-open-loop-tracker-plan.md), [plans/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md](./plans/penny-tier1-aliveness-plans/03-bounded-initiative-policy-plan.md), [plans/penny-tier1-aliveness-plans/04-ephemeral-turn-state-card-plan.md](./plans/penny-tier1-aliveness-plans/04-ephemeral-turn-state-card-plan.md), and [plans/penny-tier1-aliveness-plans/05-aliveness-compare-harness-plan.md](./plans/penny-tier1-aliveness-plans/05-aliveness-compare-harness-plan.md) | Tier 1 bounded-aliveness plan bundle | Implementation plan | Current planning handoff | the bounded-aliveness handoffs, north-star sentence, global guardrails, open-loop slice history through docs, bounded initiative slice history through docs, ephemeral turn-state slice history through docs, and aliveness compare harness slice history through docs; verify landed behavior against code/tests/artifacts | proof that runtime defaults changed, prompt-limit changes, PromptTruth expansion, explicit-memory authority, chain-of-thought access, autonomous action, unrequested initiative, or adoption beyond the artifact stage actually shipped |
| [plans/penny-session-reflection-plan-2026-04-22.md](./plans/penny-session-reflection-plan-2026-04-22.md) | Session reflection current-law note | Implementation plan | Current planning handoff | R0 session-reflection boundaries and review-gated memory suggestion law that still governs the landed R1-R8 helpers | proof that default live prompt rendering shipped, explicit memory writes are automatic, PromptTruth/toolEvidenceReceipt boundaries changed, hidden reasoning can be stored, or runtime voice changed |
| [plans/penny-dynamic-memory-linking-plan-2026-04-22.md](./plans/penny-dynamic-memory-linking-plan-2026-04-22.md) | Dynamic memory linking current-law note | Implementation plan | Current planning handoff | dynamic-link boundaries, behavior-changed-vs-not-changed status, helper/fixture/compare history, and gated correction-link scoring posture | proof that advisory links became memory authority, PromptTruth/toolEvidenceReceipt changed, runtime voice changed, graph DB migration started, or broad project/research/open-loop scoring is active |
| [plans/penny-semantic-identity-provenance-contracts-plan-2026-04-22.md](./plans/penny-semantic-identity-provenance-contracts-plan-2026-04-22.md) | Semantic identity and provenance contract plan | Implementation plan | Current planning handoff | stable local semantic IDs, local predicate registry, structured claim contract, predicate/claim/domain/source-audit slice order, semantic claim trace QA posture, rendered-claim PromptTruth guardrails, optional local semantic export, and the boundary between RDF-style discipline and Penny-native helper contracts | proof that RDF infrastructure shipped, IDs became dereferenceable URLs, semantic candidates became truth authority, raw PromptTruth graphs or `toolEvidenceReceipt` expansion shipped, live ranking changed, public Linked Data shipped, or memory promotion changed |
| [plans/penny-post-tier1-bounded-aliveness-plans/01-frame-budget-runtime-plan.md](./plans/penny-post-tier1-bounded-aliveness-plans/01-frame-budget-runtime-plan.md), [plans/penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md](./plans/penny-post-tier1-bounded-aliveness-plans/02-session-reflection-memory-suggestions-plan.md), and [plans/penny-post-tier1-bounded-aliveness-plans/03-dynamic-memory-linking-plan.md](./plans/penny-post-tier1-bounded-aliveness-plans/03-dynamic-memory-linking-plan.md) | Post-Tier 1 bounded-aliveness plan bundle | Implementation plan | Current planning handoff | frame-budget runtime slices, R1-R9 session reflection/memory-suggestion landed-vs-deferred status, dynamic memory linking, and the shared current-law guardrails for spending runtime on selection before rendered context | proof that default live prompt bridges shipped, PromptTruth/toolEvidenceReceipt boundaries changed, runtime voice changed, prompt/rendered-memory limits increased, frame-budget artifacts prove answer quality, or `server.js` should grow |
| [plans/penny-static-embedding-live-reflex-plan-2026-04-22.md](./plans/penny-static-embedding-live-reflex-plan-2026-04-22.md) | Static memory reflex provider posture | Implementation plan | Current | Tier 1 Plan 1 Slice S1 provider/dependency posture, current provider statuses, and reconciliation with the already-landed static live-sidecar seams | proof that static live-advisory is default, approval for new dependencies, PromptTruth expansion, or canonical memory authority changes |
| [plans/penny-static-embedding-live-advisory-plan-2026-04-22.md](./plans/penny-static-embedding-live-advisory-plan-2026-04-22.md) | Static embedding live sidecar plan | Implementation plan | Current | S0-S9 provider, cache, index, live-shadow, live-advisory, guardrail, A/B harness, and local-dev enablement notes | default embedding-provider law, PromptTruth expansion, canonical memory authority, or proof that live-advisory is the normal repo default |
| [plans/penny-deterministic-extraction-qa-plan-2026-04-21.md](./plans/penny-deterministic-extraction-qa-plan-2026-04-21.md) | Deterministic extraction QA plan | Implementation plan | Draft | later-if-needed fixture shape for source-receipted numeric/document extraction QA | permission to wire OCR, hosted document tools, CMS/source warehouse behavior, or runtime ingestion |
| [plans/prompttruth-v2-completion-note-2026-04-19.md](./plans/prompttruth-v2-completion-note-2026-04-19.md) | Completion note | Strong guidance | Current | compact landed-vs-deferred summary for PromptTruth v2 and `toolEvidenceReceipt` | overriding contracts, code, tests, or runtime artifacts |
| [plans/penny-local-llm-sidecar-roadmap-2026-05-11.md](./plans/penny-local-llm-sidecar-roadmap-2026-05-11.md) | Local LLM sidecar implementation roadmap | Implementation plan | Landed scaffold / live trials gated | repo-native sidecar catalog, contracts, endpoint/model watch, Qwen/Gemma compare prep, Pi/OpenCode helpers, templates, fixtures, and verification commands | proof that any live sidecar was installed, dependency/license approval, default model changes, runtime law, memory promotion, or core sidecar authority |

### 8. Public/external explanation docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [penny-public/README.md](./penny-public/README.md) | Public pack index | Public/external explanation | Current | route humans to the right public doc | contributor law |
| [penny-public/pennyos-user-guide.md](./penny-public/pennyos-user-guide.md), [penny-public/how-to-use-penny.md](./penny-public/how-to-use-penny.md), [penny-public/penny-for-humans.md](./penny-public/penny-for-humans.md) | Public onboarding and explanation | Public/external explanation | Current | first-run setup, local model onboarding, honest capability framing, and FAQ copy | exact model or runtime contract |
| [penny-public/penny-mental-model.md](./penny-public/penny-mental-model.md) | Public mental model | Public/external explanation | Current | compelling public map of Penny's product thesis and layered runtime shape | binding runtime law or exact QA claims |
| [penny-public/PennyPedia.md](./penny-public/PennyPedia.md) | Public field guide | Public/external explanation | Current | plain-English mental model of Penny's machinery | governing architecture law |

### 9. Raw/source material

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| private/local Penny canon notes, `penny-voice/distilled/`, and private/local root `Personality *.md` files | Voice and canon source inputs | Raw/source material | Needs verification | voice refinement, source instincts, historical canon | live runtime authority |

### 10. Archived/superseded material

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [archive/](./archive/) | Archived handoffs, stale UI plans, and chat-era reviews | Deprecated/superseded | Superseded | historical archaeology when a newer doc points you there | first-read onboarding, current runtime law, or public-facing explanation |

### 11. Generated/temporary material

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [2506.06941v3.agent.md](./2506.06941v3.agent.md) | Machine-extracted source text | Generated/temporary | Generated | source extraction for research work | project policy or law |
| private/local `output/`, `tmp/`, `logs/`, [../data/](../data), and private/local `test-results/` | Runtime and QA artifacts | Generated/temporary | Generated | QA evidence, runtime state, debugging | governing documentation |

## High-risk docs that should not outrank current law

Treat these as evidence or continuity helpers unless and until their claims are promoted into current law:

- [penny-docs-and-live-qa-agent-brief.md](./penny-docs-and-live-qa-agent-brief.md)
- [penny-secret-third-thing-bounded-third-option-design.md](./penny-secret-third-thing-bounded-third-option-design.md)
- [penny-progress-handoff-2026-04-17.md](./penny-progress-handoff-2026-04-17.md)
- [penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md](./penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md)
- [penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md](./penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md)
- [penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md](./penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md)
- [archive/PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md](./archive/PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md)
- [archive/PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](./archive/PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
- [archive/PENNY_REDESIGN_PLAN.md](./archive/PENNY_REDESIGN_PLAN.md)
- [archive/PENNY_UI_HANDOFF.md](./archive/PENNY_UI_HANDOFF.md)
- [archive/Notes on Penny's Code From a Project Manager.md](./archive/Notes%20on%20Penny's%20Code%20From%20a%20Project%20Manager.md)
- [archive/Todays Plan.md](./archive/Todays%20Plan.md)

The point of this guide is not to turn the docs folder into another doctrine pile. It is to make authority obvious enough that future agents stop repeating the right slogans while enforcing the wrong layer.
