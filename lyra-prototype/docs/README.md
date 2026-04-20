# Docs Guide

This is the map for Penny's documentation. Use it to tell current law from philosophy, plans, history, public explanation, source material, and generated artifacts.

If a document is persuasive but the code, tests, or runtime artifacts disagree, trust the code, tests, and receipts first, then fix the doc.

## Read this first

If you are a new agent or contributor, use this order:

1. [../AGENTS.md](../AGENTS.md)
2. [../README.md](../README.md)
3. [../CODEBASE.md](../CODEBASE.md)
4. [../ARCHITECTURE.md](../ARCHITECTURE.md)
5. [penny-runtime-authority-contract-2026-04-17.md](./penny-runtime-authority-contract-2026-04-17.md)
6. [penny-prompttruth-contract-2026-04-19.md](./penny-prompttruth-contract-2026-04-19.md) if your question is specifically about prompt visibility, rendered-vs-candidate truth, or holdback semantics
7. [../server-js-section-map.md](../server-js-section-map.md), [../frontend-section-map.md](../frontend-section-map.md), and [penny-module-ownership.md](./penny-module-ownership.md) if you are editing orchestration or ownership boundaries
8. Only then open handoffs, plans, reviews, public explainers, or raw source material

If you want outward-facing or layperson docs instead of repo law, start with [penny-public/README.md](./penny-public/README.md).
If you need the recurring product instinct behind Penny's bounded slices after you finish current-law docs, read [penny-secret-third-thing-bounded-third-option-design.md](./penny-secret-third-thing-bounded-third-option-design.md).

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
| [../AGENTS.md](../AGENTS.md) | Repo contract and guardrails | Binding/current law | Current | session ritual, repo truths, guardrails | detailed architecture history |
| [../README.md](../README.md) | Contributor/operator entrypoint | Binding/current law | Current | current runtime shape, runbook, memory/runtime overview | public marketing or historical archaeology |
| [../CODEBASE.md](../CODEBASE.md) | Repo map and source-vs-generated boundary | Binding/current law | Current | where code lives, what is generated, edit boundaries | product philosophy |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Current engineering architecture | Binding/current law | Current | present-tense architecture and subsystem behavior | public-facing explanation |
| [penny-runtime-authority-contract-2026-04-17.md](./penny-runtime-authority-contract-2026-04-17.md) | Runtime authority contract | Binding/current law | Current | memory authority, prompt truth, advisory vs canonical rules | full project history |
| [penny-prompttruth-contract-2026-04-19.md](./penny-prompttruth-contract-2026-04-19.md) | Prompt-truth contract | Binding/current law | Current | rendered-vs-candidate truth, prompt visibility rules, holdback semantics | full runtime authority beyond prompt context |

### 2. Strong guidance and continuity docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [../server-js-section-map.md](../server-js-section-map.md), [../frontend-section-map.md](../frontend-section-map.md), [penny-module-ownership.md](./penny-module-ownership.md) | Ownership and orchestration boundaries | Strong guidance | Current | who owns what when editing shells and subsystems | product-law disputes without code checks |
| [../OPENCLAW_SHADOW_EVAL.md](../OPENCLAW_SHADOW_EVAL.md) | Shadow-mode verdict | Strong guidance | Current | current keep/park policy for shadow mode | general runtime law beyond shadow scope |
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
| [penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md](./penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md) | External-memory fit note | Historical evidence | Current | recent apply-vs-poor-fit synthesis for CharMemory and Mnemosyne-style ideas | current runtime contract or storage law |

### 6. Review/audit docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [penny-review-2026-04-18.md](./penny-review-2026-04-18.md), [penny-review-commit-5c08ac0.md](./penny-review-commit-5c08ac0.md), and [penny-memory-archive-audit.md](./penny-memory-archive-audit.md) | Review snapshots | Historical evidence | Historical | bugs, risks, and pressure-test findings tied to a snapshot | standing law |

### 7. Bounded implementation plans

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [plans/](./plans/) and [plans/TEMPLATE.md](./plans/TEMPLATE.md) | Implementation plans | Implementation plan | Draft | bounded next slices and planning format | proof that behavior shipped |
| [plans/prompttruth-v2-completion-note-2026-04-19.md](./plans/prompttruth-v2-completion-note-2026-04-19.md) | Completion note | Strong guidance | Current | compact landed-vs-deferred summary for PromptTruth v2 and `toolEvidenceReceipt` | overriding contracts, code, tests, or runtime artifacts |

### 8. Public/external explanation docs

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [penny-public/README.md](./penny-public/README.md) | Public pack index | Public/external explanation | Current | route humans to the right public doc | contributor law |
| [penny-public/how-to-use-penny.md](./penny-public/how-to-use-penny.md), [penny-public/penny-for-humans.md](./penny-public/penny-for-humans.md) | Public onboarding and explanation | Public/external explanation | Current | onboarding and honest capability framing | exact model or runtime contract |
| [penny-public/PennyPedia.md](./penny-public/PennyPedia.md) | Public field guide | Public/external explanation | Current | plain-English mental model of Penny's machinery | governing architecture law |

### 9. Raw/source material

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [../Penny's Playground/](../Penny's%20Playground), [../penny-voice/distilled/](../penny-voice/distilled), root `Personality *.md` files | Voice and canon source inputs | Raw/source material | Needs verification | voice refinement, source instincts, historical canon | live runtime authority |

### 10. Generated/temporary material

| Document | Category | Authority level | Current status | Use this for | Do not use this for |
| --- | --- | --- | --- | --- | --- |
| [2506.06941v3.agent.md](./2506.06941v3.agent.md) | Machine-extracted source text | Generated/temporary | Generated | source extraction for research work | project policy or law |
| [../output/](../output), [../tmp/](../tmp), [../logs/](../logs), [../data/](../data), [../test-results/](../test-results) | Runtime and QA artifacts | Generated/temporary | Generated | QA evidence, runtime state, debugging | governing documentation |

## High-risk docs that should not outrank current law

Treat these as evidence or continuity helpers unless and until their claims are promoted into current law:

- [penny-docs-and-live-qa-agent-brief.md](./penny-docs-and-live-qa-agent-brief.md)
- [penny-secret-third-thing-bounded-third-option-design.md](./penny-secret-third-thing-bounded-third-option-design.md)
- [penny-progress-handoff-2026-04-17.md](./penny-progress-handoff-2026-04-17.md)
- [penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md](./penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md)
- [penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md](./penny-sillytavern-charmemory-mnemosyne-note-2026-04-20.md)
- [../PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md](../PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md)
- [../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
- [../Today's Plan.md](../Today's%20Plan.md)

The point of this guide is not to turn the docs folder into another doctrine pile. It is to make authority obvious enough that future agents stop repeating the right slogans while enforcing the wrong layer.
