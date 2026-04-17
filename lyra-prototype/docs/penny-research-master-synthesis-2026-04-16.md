# Penny Research Master Synthesis

Date: 2026-04-16

This note consolidates Penny's current research and planning corpus into one master decision document.

Scope is intentionally locked to synthesis:

- no runtime changes
- no prompt rewrites
- no QA reruns
- no memory-file mutations

This pass consolidates the current research-style docs rather than recreating every upstream bibliography from scratch.

The source set was normalized to 15 primary research/planning inputs in the initial pass.
A short late addendum at the end folds in 10 direct external references received afterward.

Normalization notes:

- this document treats the prior synthesis notes as source documents, not as competing outputs
- when a numbered source below points to an existing synthesis artifact, that source already contains its own raw external citations and appendices
- operational support artifacts such as [penny-browser-manual-checklist.md](./penny-browser-manual-checklist.md), [penny-review-bundle.md](./penny-review-bundle.md), and [docs/plans/TEMPLATE.md](./plans/TEMPLATE.md) were intentionally left out of the matrix because they are process aids, not research conclusions
- public-facing collateral such as `docs/penny-public/*`, plus general repo orientation docs like `README.md`, `ARCHITECTURE.md`, and `CODEBASE.md`, were also left out of the matrix so this note stays focused on research, audits, evaluations, and planning conclusions
- the current dirty tree was not treated as a blocker for this documentation pass; the safest move here was to leave the existing worktree alone and produce one canonical synthesis artifact
- the bare [Open WebUI profile link](https://openwebui.com/u/atgehrhardt) was treated only as a discovery pointer; the specific posts and docs it led to carry the actual signal in the late addendum
- a second late external batch received afterward is tracked separately in [penny-external-research-late-batch-2-2026-04-16.md](./penny-external-research-late-batch-2-2026-04-16.md) so this master note can stay canonical without swallowing every new bibliography whole

This is a synthesis document, not copied code or copied prompt text.

## Executive Summary

The clearest cross-document conclusion is simple:

Penny does not need a giant new platform layer.
She needs a tighter contract around the good architecture and product instincts she already has.

The strongest convergence across the research docs is remarkably consistent:

1. `Canonical truth must stay small, explicit, and reviewable`
  - Explicit memory should remain canonical.
  - Archive memory, chapter fallback, and memory books should stay additive and inspectable.
  - Contradiction state should be tracked explicitly instead of left to vibes.
2. `Prompt structure matters more than prompt bulk`
  - Penny does better with clear layering and mode separation than with giant catch-all context dumps.
  - The runtime should distinguish stable facts, active session context, contradictions/open questions, and advisory retrieval.
  - Character should be preserved by structure, not by throwing more canon into the prompt.
3. `Chat/tool boundaries are a strength, not debt`
  - The research and repo-local notes both argue for stable lane routing, stable tool surfaces, and deterministic fast paths where possible.
  - Penny should keep LM Studio as the main brain and keep OpenClaw/shadow optional unless it produces a real capability win.
4. `Trace-first QA is the next real leverage point`
  - Probe-first methodology, replayable traces, fresh-server validity, and Penny-shaped rubrics show up again and again.
  - The right question is no longer "can Penny answer?"
  - The right questions are "did Penny route correctly, remember the right thing, resist the false premise, stay specific, and fail honestly when the environment was weak?"
5. `Human-like reactions are a runtime truth problem and a presentation problem`
  - Better acting sprites, richer visual reactions, and stronger expression surfaces matter.
  - But they only help if the underlying memory/uncertainty/premise handling is honest.
  - The project should avoid the trap of polishing Penny's face while her retrieval and epistemic footing stay soft.

The biggest "do not import this" warnings are just as important:

- do not clean up the whole tree before every useful doc pass
- do not add another giant memory layer because retrieval still misses
- do not let archive or compression silently rewrite canonical truth
- do not collapse Penny into a generic agent platform, plugin ecosystem, or swarm
- do not chase model surgery, federated training, or repeated-layer experiments before the app itself is steadier
- do not sanitize Penny into a safer but blander character while fixing engineering problems

Direct answers to the big Penny questions:

- `What should strengthen long-term memory without bloating prompts?`
  - contradiction-aware provenance
  - compact wake-state structure
  - memory books as a bounded middle layer
  - chapter/index-based fallback instead of cursed blob stuffing
- `What should improve provenance, contradiction handling, and identity continuity?`
  - explicit old-truth -> new-truth tracking
  - archive observations with source references
  - inspector-visible retrieval traces
  - review-gated promotion only
- `What should preserve Penny's funniest, most human reactions without making her bland?`
  - stronger premise resistance
  - better uncertainty behavior
  - compact prompt layering that keeps the authored voice intact
  - acting/presentation work that amplifies, not replaces, runtime truth
- `What should preserve Penny's chat/tool split rather than collapsing it?`
  - stable per-request lane choice
  - stable dispatcher-style tool surface
  - deterministic fast paths for obvious inspect/read/edit asks
  - shadow lane kept optional unless it proves a distinct capability win
- `What should improve replayability, observability, and future planning quality?`
  - probe-first QA
  - fresh/disposable server runs for serious verdicts
  - trace artifacts with route, retrieval, provenance, and timing
  - planning docs that keep conclusions and guardrails explicit
- `Should the dirty tree be addressed first?`
  - Not for this synthesis pass.
  - It matters before cleanup, staging, or shipping decisions.
  - It does not need to block one new canonical doc.

## Source Matrix

Confidence tier rubric:

- `High`: concrete synthesis, audit, evaluation, or review docs with direct repo touchpoints and repeatable implications
- `Medium`: directional product or planning notes with clear conclusions but less direct verification power
- `Low`: exploratory notes or tactical reminders that are still useful, but narrower or less authoritative


| #   | Source                                                                                                              | Type                | Confidence | Core claim                                                                                                                                                             | Penny relevance                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | [penny-memory-external-research-synthesis-2026-04-16.md](./penny-memory-external-research-synthesis-2026-04-16.md)  | Research synthesis  | High       | The 73-source external sweep argues for wake protocol, provenance-heavy retrieval, stable lane routing, trace-first evals, and bounded offline learning.               | Canonical external research baseline for memory, observability, and lane design.          |
| 2   | [penny-external-llm-research-pass.md](./penny-external-llm-research-pass.md)                                        | Research synthesis  | High       | Structure beats raw context length; contradiction-aware memory, prompt layering, compression tightening, and stronger QA are the best near-term imports.               | Best bridge between external LLM research and Penny's current runtime choices.            |
| 3   | [penny-native-memory-character-pass.md](./penny-native-memory-character-pass.md)                                    | Adaptation pass     | High       | Scoped memory books, prompt-slot registry, compression fallback, and expression packs fit Penny; lorebook/plugin sprawl does not.                                      | Canonical guide for borrowing "native-memory" ideas without flattening Penny.             |
| 4   | [penny-memory-archive-audit.md](./penny-memory-archive-audit.md)                                                    | Policy audit        | High       | Explicit memory must stay canonical, archive recall advisory, contradictions stronger than stale detail, and compression fallback assistive rather than authoritative. | Core governance doc for Penny's long-term memory behavior.                                |
| 5   | [penny-module-ownership.md](./penny-module-ownership.md)                                                            | Ownership note      | High       | Large modules need explicit ownership, inputs, outputs, and "must not own" boundaries to avoid re-monolithing.                                                         | Helps map research conclusions onto the actual codebase without hand-waving.              |
| 6   | [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)                                       | Branch handoff      | High       | Many memory/prompt/acting pieces already landed; next work should harden trust boundaries, QA rules, and compression quality instead of inventing new systems.         | Current implementation truth for what is already real versus still pending.               |
| 7   | [PENNY_MODEL_EVAL.md](../PENNY_MODEL_EVAL.md)                                                                       | Eval runbook        | High       | Repeatable local model testing needs apples-to-apples lane splits, disposable servers when needed, and clear artifact reading discipline.                              | Strong source for future QA and model-selection methodology.                              |
| 8   | [PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md](../PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md)                               | Product handoff     | Medium     | Penny is a companion first, assistant second; the companion side is more mature than the agentic side, and that product truth should steer the roadmap.                | Protects against generic-agent drift and keeps the product north star explicit.           |
| 9   | [OPENCLAW_SHADOW_EVAL.md](../OPENCLAW_SHADOW_EVAL.md)                                                               | Evaluation note     | High       | OpenClaw/shadow should stay experimental unless it unlocks real browser, exec, or scheduled-task leverage that LM Studio does not already cover.                       | Critical boundary-setting for the shadow lane and anti-sprawl discipline.                 |
| 10  | [LOCAL_LLAMA_THREAD_FINDINGS.md](../LOCAL_LLAMA_THREAD_FINDINGS.md)                                                 | Research note       | Medium     | Modular docs, incremental refactors, deterministic fast paths, and anti-slop discipline matter more than "smarter models."                                             | Reinforces architecture hygiene, testing, and bounded autonomy.                           |
| 11  | [RYS_FOLLOWUP_REVIEW.md](../RYS_FOLLOWUP_REVIEW.md)                                                                 | Research note       | High       | Probe-first then validate-later is the right evaluation pattern, and Penny's semantic-core -> voice-render split is directionally strong.                              | Strong methodological source for QA design and runtime architecture interpretation.       |
| 12  | [Notes on Penny's Code From a Project Manager.md](../Notes%20on%20Penny's%20Code%20From%20a%20Project%20Manager.md) | External review     | High       | Documentation honesty is ahead of code modularity; the remaining long-term risk is still the server/frontend monoliths and thin boundary coverage.                     | Blunt but credible engineering risk summary.                                              |
| 13  | [penny-document-chunking-notes.md](./penny-document-chunking-notes.md)                                              | Tactical note       | Medium     | Clean chapters plus a compact index beat giant blob context stuffing when precision matters.                                                                           | Direct fit for long-document ingestion, chapter fallback, and retrieval design.           |
| 14  | [PENNY_REDESIGN_PLAN.md](../PENNY_REDESIGN_PLAN.md)                                                                 | Product design plan | Medium     | Penny's reaction surface should be anime/chibi-techwear, expressive, bratty-sweet, and emotionally real, not corporate or sanitized.                                   | Important guide for the "human-like reactions without blandness" goal on the visual side. |
| 15  | [PENNY_UI_HANDOFF.md](../PENNY_UI_HANDOFF.md)                                                                       | UI handoff          | Medium     | The best next UI move is stronger acting and more dramatic reaction states, not another long anatomy pass.                                                             | Supports the presentation/acting side of Penny's human-like reaction goal.                |


## Penny Applicability

### Memory / Retrieval

`What should strengthen Penny's long-term memory without bloating prompts?`

- `Canonical explicit truth plus advisory archive`
  - Research evidence: `#1`, `#2`, `#3`, `#4`, `#6`, `#13`
  - Penny touchpoints: [lib/penny-memory.js](../lib/penny-memory.js), [lib/penny-memory-archive.js](../lib/penny-memory-archive.js), [lib/penny-memory-books.js](../lib/penny-memory-books.js)
  - Read: the convergence is very strong here. Penny should keep explicit memory as canonical, keep archive/chapter/book layers advisory and inspectable, and avoid inventing another giant memory tier just because retrieval still has misses.
- `Contradiction-aware provenance and wake-state structure`
  - Research evidence: `#1`, `#2`, `#4`, `#6`, `#11`
  - Penny touchpoints: [lib/penny-memory.js](../lib/penny-memory.js), [lib/penny-runtime-artifacts.js](../lib/penny-runtime-artifacts.js), [public/js/penny-memory-panel.mjs](../public/js/penny-memory-panel.mjs)
  - Read: Penny should wake from a small, explicit hierarchy: stable facts, active session context, contradictions/open questions, then advisory retrieval hints. Old truth and new truth should both be visible internally when a correction happened.
- `Memory books as a bounded middle layer`
  - Research evidence: `#1`, `#3`, `#4`, `#6`
  - Penny touchpoints: [lib/penny-memory-books.js](../lib/penny-memory-books.js), [lib/penny-prompt-stack.js](../lib/penny-prompt-stack.js)
  - Read: memory books are worth keeping because they are inspectable, small, and expressive. They help Penny stay authored without letting archive inference or giant lorebook behavior swallow canonical truth.
- `Chapter/index-based fallback over cursed blob stuffing`
  - Research evidence: `#2`, `#4`, `#6`, `#13`
  - Penny touchpoints: [lib/penny-memory-archive.js](../lib/penny-memory-archive.js), [scripts/qa-penny-memory.js](../scripts/qa-penny-memory.js)
  - Read: when retrieval is weak or sources get large, the right move is cleaner chapters, compact indexes, and bounded source maps. It is not "dump more raw text into context and pray."

What the research reinforces here:

- better bookkeeping beats more memory volume
- provenance and contradiction handling are the missing leverage, not another storage layer
- compression fallback should stay a backup path, not a hidden authority

### Prompt / Character Surface

`What should preserve Penny's funniest, most human reactions without making her bland?`

- `Explicit prompt layering and mode separation`
  - Research evidence: `#1`, `#2`, `#3`, `#5`, `#6`, `#11`
  - Penny touchpoints: [lib/penny-prompt-stack.js](../lib/penny-prompt-stack.js), [penny-voice/runtime/penny-chat-directives.md](../penny-voice/runtime/penny-chat-directives.md), [lib/penny-prompt-assets.js](../lib/penny-prompt-assets.js)
  - Read: Penny works best when voice, directives, overlays, memory, and current-turn material are distinct surfaces with bounded rules. The docs do not support turning her runtime into one giant prompt blob.
- `Character-preserving anti-blandness guardrails`
  - Research evidence: `#2`, `#3`, `#8`, `#14`, `#15`
  - Penny touchpoints: [penny-voice/runtime/penny-operational-blend.md](../penny-voice/runtime/penny-operational-blend.md), [penny-voice/runtime/penny-chat-directives.md](../penny-voice/runtime/penny-chat-directives.md), [public/js/penny-expression-runtime.mjs](../public/js/penny-expression-runtime.mjs)
  - Read: the right quality bar is not "safer and smoother." It is "sharper, more honest, more specific, and still warmly Penny." Premise resistance and uncertainty handling should improve without sanding off her bite.
- `Presentation amplifies truth; it does not replace it`
  - Research evidence: `#8`, `#14`, `#15`
  - Penny touchpoints: [public/js/penny-expression-runtime.mjs](../public/js/penny-expression-runtime.mjs), [public/js/penny-app.js](../public/js/penny-app.js), [public/sprites/packs/default/manifest.json](../public/sprites/packs/default/manifest.json)
  - Read: richer acting sprites and expression states matter because Penny is a character product. But presentation should sit on top of honest retrieval, better premise handling, and stronger runtime voice rather than covering for weak memory behavior.

What the research reinforces here:

- the authored voice is a core product surface, not an optional garnish
- better reaction quality is partly backend truthfulness and partly UI/acting polish
- Penny should become more human-like by being more grounded and more expressive, not more generic

### Tool and Lane Architecture

`What should preserve Penny's chat/tool lane split rather than collapsing it?`

- `Stable chat/tool split and stable router surface`
  - Research evidence: `#1`, `#2`, `#5`, `#6`, `#9`, `#10`, `#12`
  - Penny touchpoints: [lib/penny-local-lanes.js](../lib/penny-local-lanes.js), [lib/penny-direct-intents.js](../lib/penny-direct-intents.js), [lib/penny-route-handlers.js](../lib/penny-route-handlers.js)
  - Read: the docs consistently reward early lane choice, bounded deterministic fast paths, and a stable tool/router surface. They do not support per-turn chaos or collapsing chat and tool work into one fuzzy lane.
- `Thin-shell ownership over re-monolithing`
  - Research evidence: `#5`, `#6`, `#10`, `#12`
  - Penny touchpoints: [lib/penny-server-http.js](../lib/penny-server-http.js), [lib/penny-chat-runtime.js](../lib/penny-chat-runtime.js), [public/js/penny-transcript-ui.mjs](../public/js/penny-transcript-ui.mjs), [public/js/penny-memory-panel.mjs](../public/js/penny-memory-panel.mjs)
  - Read: the correct move is to keep growing extracted owners with explicit boundaries. The repo is already documenting this; the next step is to keep honoring it in implementation work.
- `Shadow/OpenClaw remains optional until it clearly wins`
  - Research evidence: `#8`, `#9`, `#10`
  - Penny touchpoints: [OPENCLAW_SHADOW_EVAL.md](../OPENCLAW_SHADOW_EVAL.md), [ARCHITECTURE.md](../ARCHITECTURE.md)
  - Read: there is no evidence in the current docs that shadow should become the mainline. If it cannot do distinct browser/exec/scheduled-task work, it should stay parked as an experiment.

What the research reinforces here:

- Penny's lane split is a strength
- architecture discipline matters more than adding another tool or another agent
- the next win is contract hardening, not lane collapse

### Observability and Evals

`What should improve replayability, observability, and Penny-shaped evals?`

- `Probe-first, validate-later QA`
  - Research evidence: `#1`, `#2`, `#6`, `#7`, `#11`, `#12`
  - Penny touchpoints: [scripts/eval-penny-probes.js](../scripts/eval-penny-probes.js), [scripts/qa-penny-voice-redo.js](../scripts/qa-penny-voice-redo.js), [scripts/qa-penny-memory.js](../scripts/qa-penny-memory.js)
  - Read: fast, orthogonal probes should search the space cheaply. Only promising candidates should graduate to the heavier memory, voice, and browser-style validation passes.
- `Fresh-server validity and replayable traces`
  - Research evidence: `#1`, `#6`, `#7`, `#11`, `#12`
  - Penny touchpoints: [lib/penny-runtime-artifacts.js](../lib/penny-runtime-artifacts.js), [lib/penny-qa-validity.js](../lib/penny-qa-validity.js), [public/js/penny-memory-panel.mjs](../public/js/penny-memory-panel.mjs)
  - Read: weak environment state should be marked invalid, not blended into Penny behavior conclusions. Replayable route/retrieval/provenance artifacts are now part of the contract, not extra polish.
- `Penny-shaped scoring instead of generic benchmark theater`
  - Research evidence: `#1`, `#2`, `#7`, `#11`, `#12`
  - Penny touchpoints: [scripts/eval-penny-models.js](../scripts/eval-penny-models.js), [scripts/qa-penny-voice-redo.js](../scripts/qa-penny-voice-redo.js), [scripts/qa-penny-memory.js](../scripts/qa-penny-memory.js)
  - Read: the scorecard should prioritize contradiction handling, unsupported-side-effect honesty, route correctness, long-session drift, repetition, latency, and the style of recall. Generic "model leaderboard" thinking is too shallow for this product.

What the research reinforces here:

- observability is one of the strongest convergences in the whole corpus
- Penny needs trustworthy verdicts more than she needs more benchmark screenshots
- the eval culture is already promising; it now needs sharper structure and cleaner validity gates

### Workflow / Subagents

`What should improve the engineering loop without turning Penny into a platform company?`

- `Small docs, explicit skills, and bounded refactors`
  - Research evidence: `#1`, `#5`, `#10`, `#12`
  - Penny touchpoints: [docs/plans/TEMPLATE.md](./plans/TEMPLATE.md), [.codex/skills/README.md](../.codex/skills/README.md), [server-js-section-map.md](../server-js-section-map.md)
  - Read: the recurring advice is to keep shared rules in docs and skills, refactor in small slices, and stop asking giant files or giant agents to improvise structure out of chaos.
- `One coordinator, bounded specialists`
  - Research evidence: `#1`, `#6`, `#9`, `#10`
  - Penny touchpoints: [ARCHITECTURE.md](../ARCHITECTURE.md), [OPENCLAW_SHADOW_EVAL.md](../OPENCLAW_SHADOW_EVAL.md)
  - Read: when the work fans out, the good pattern is a primary coordinator with narrow helpers. The docs do not support turning Penny into an uncontrolled swarm.
- `Canonical research and handoff docs are a product asset`
  - Research evidence: `#6`, `#8`, `#11`, `#12`
  - Penny touchpoints: [docs](./), [PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md](../PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md), [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md)
  - Read: part of Penny's advantage is that the repo already has unusually honest handoffs and review notes. The right next step is consolidation and canonicalization, not deleting the paper trail.

What the research reinforces here:

- better boundaries beat "smarter agents"
- docs and runbooks are part of the engineering system, not a side hobby
- this master synthesis exists because the corpus was already worth consolidating

### Offline Learning and Watchlist

`What belongs later, and only in bounded form?`

- `Offline improvement only on verifiable subproblems`
  - Research evidence: `#1`, `#2`, `#7`, `#11`
  - Penny touchpoints: [output](../output), [scripts/eval-penny-models.js](../scripts/eval-penny-models.js), [scripts/qa-penny-memory.js](../scripts/qa-penny-memory.js)
  - Read: future learning work is only justified where the reward signal is bounded enough to inspect. Retrieval ranking, route choice, and evidence shaping may qualify later. Open-ended persona rewriting does not.
- `Runtime/performance ideas stay on watchlist until they beat the current stack honestly`
  - Research evidence: `#2`, `#7`, `#11`, `#12`
  - Penny touchpoints: [PENNY_MODEL_EVAL.md](../PENNY_MODEL_EVAL.md), [lib/penny-lmstudio-status.js](../lib/penny-lmstudio-status.js), [lib/penny-lmstudio-transports.js](../lib/penny-lmstudio-transports.js)
  - Read: repeated-layer variants, quant/runtime tricks, speculative decoding, and deeper model surgery are interesting only if the measurement path is clean and the app layer is already stable enough to benefit.

What the research reinforces here:

- Penny is not a model-lab-first project
- offline improvement is a later seam, not the immediate fix
- the near-term wins are still memory truth, QA trustworthiness, and character reliability

## Rejected or De-Weighted Ideas

The following ideas were explicitly rejected or de-weighted in this master pass.

- `Treating the dirty tree as a prerequisite for every useful planning move`
  - Sources: `#6`, `#12`
  - Why de-weighted: the tree is noisy, but it is not a blocker for one new synthesis artifact.
  - What survives: clean it before staging, shipping, or broad cleanup work, not before every doc pass.
- `Another giant memory layer`
  - Sources: `#1`, `#2`, `#3`, `#4`, `#6`
  - Why rejected: the docs keep pointing to better provenance, wake structure, and bounded middle layers, not another ungoverned storage system.
  - What survives: canonical explicit memory, advisory archive, bounded memory books, and review-gated promotion.
- `Silent self-modifying memory or truth mutation`
  - Sources: `#1`, `#2`, `#4`, `#6`
  - Why rejected: archive and compression are useful only while they remain inspectable and subordinate to explicit truth.
  - What survives: explicit provenance, contradiction tracking, and human-reviewable promotion.
- `Giant cursed blob context stuffing`
  - Sources: `#2`, `#4`, `#13`
  - Why rejected: both the external research and the tactical document-ingestion note argue that structure beats brute force.
  - What survives: chapter/index-based retrieval and compact context packs.
- `Plugin/lorebook/platform sprawl`
  - Sources: `#1`, `#2`, `#3`, `#8`, `#9`
  - Why rejected: Penny is a single-user local companion, not an omnichannel platform company.
  - What survives: small skills, stable tool contracts, and bounded specialist surfaces.
- `Making OpenClaw/shadow the mainline`
  - Sources: `#8`, `#9`, `#10`
  - Why rejected: the docs do not show a real capability win yet.
  - What survives: keep shadow available only if it eventually unlocks browser, exec, or scheduled-task leverage worth the complexity.
- `Model surgery or distributed training before app hygiene`
  - Sources: `#2`, `#7`, `#11`, `#12`
  - Why rejected: the app's nearer bottlenecks are still memory contract quality, QA trustworthiness, and monolith pressure.
  - What survives: contained benchmark/watchlist work only.
- `Sanitizing Penny into a nicer but duller character`
  - Sources: `#3`, `#8`, `#14`, `#15`
  - Why rejected: this would "fix" the wrong thing. Penny's value is her authored warmth, teeth, and presence.
  - What survives: sharper premise resistance, better uncertainty calibration, stronger acting, and less blandness.

## Candidate Follow-Ups

These are ranked future seams only.
They are not a full implementation plan yet.

1. `Retrieval truth pass`
  - Why first: this is the tightest convergence in the entire corpus.
  - Research evidence: `#1`, `#2`, `#3`, `#4`, `#6`, `#13`
  - Penny touchpoints: `lib/penny-memory.js`, `lib/penny-memory-archive.js`, `lib/penny-memory-books.js`, `lib/penny-runtime-artifacts.js`
  - Guardrail: improve provenance, contradiction handling, and compression quality without adding another memory monarchy.
2. `QA trustworthiness pass`
  - Why second: a lot of good work is already in place, but the verdict discipline now matters as much as the prompt/runtime changes themselves.
  - Research evidence: `#6`, `#7`, `#11`, `#12`
  - Penny touchpoints: `scripts/qa-penny-memory.js`, `scripts/qa-penny-voice-redo.js`, `scripts/eval-penny-probes.js`, `lib/penny-qa-validity.js`
  - Guardrail: invalid environments must stay invalid; do not mix LM Studio drift into product conclusions.
3. `Character reliability pass`
  - Why third: Penny should get more human-like by becoming truer, sharper, and less overeager to inherit false premises.
  - Research evidence: `#2`, `#3`, `#8`, `#14`, `#15`
  - Penny touchpoints: `penny-voice/runtime/*`, `lib/penny-prompt-stack.js`, `public/js/penny-expression-runtime.mjs`
  - Guardrail: do not trade blunt honesty and specificity for generic "assistant niceness."
4. `Stable lane/router contract pass`
  - Why fourth: Penny already has the right split; the opportunity is to make it more durable and inspectable.
  - Research evidence: `#1`, `#5`, `#6`, `#9`, `#10`, `#12`
  - Penny touchpoints: `lib/penny-local-lanes.js`, `lib/penny-direct-intents.js`, `lib/penny-route-handlers.js`
  - Guardrail: no every-turn schema churn, no lane collapse, no shadow-first rewrite.
5. `Source-map and chapter-index ingestion pass`
  - Why fifth: this becomes more valuable as Penny works with larger documents, notes, and memory archives.
  - Research evidence: `#4`, `#6`, `#13`
  - Penny touchpoints: `lib/penny-memory-archive.js`, `scripts/import-penny-conversations.js`, future document-ingest seams
  - Guardrail: keep it targeted and citeable; do not build a generic RAG cathedral.
6. `Presentation and acting polish pass`
  - Why sixth: once runtime truth is steadier, stronger acting surfaces can amplify Penny's reactions in the right direction.
  - Research evidence: `#8`, `#14`, `#15`
  - Penny touchpoints: `public/js/penny-expression-runtime.mjs`, `public/js/penny-app.js`, `public/styles.css`, `public/sprites/`
  - Guardrail: no anatomy death march, no corporate sanitization, no visual polish that hides backend dishonesty.
7. `Bounded offline improvement watchlist`
  - Why seventh: worth keeping alive conceptually, but only after the traces and rubrics are stable enough to support it.
  - Research evidence: `#1`, `#2`, `#7`, `#11`
  - Penny touchpoints: `output/*`, `scripts/*qa*`, `scripts/*eval*`
  - Guardrail: no live self-modifying persona, no automatic explicit-memory mutation, no model-lab detour before the app earns it.

## Late Addendum

This addendum folds in the late links sent after the initial master pass.
The useful signal is real, but it is concentrated in a narrow place:

- provenance-aware artifacts and inspector surfaces look even more important
- explicit web search still belongs in the "later, bounded tool" bucket
- dynamic model routing and app-builder stacks remain mostly cautionary for Penny right now

Late addendum confidence rubric:

- `High`: peer-reviewed or preprint-style source with a concrete mechanism that maps cleanly onto Penny
- `Medium`: repo or product docs with directly portable UI or systems ideas
- `Low`: community-function posts that are still useful for pattern-spotting, but weaker as engineering proof


| #   | Source                                                                                                                          | Type                    | Confidence | Core claim                                                                                                                                                | Penny relevance                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | [Figures as Interfaces: Toward LLM-Native Artifacts for Scientific Discovery](https://arxiv.org/html/2604.08491v1)              | Research paper          | High       | Human-legible artifacts become much more powerful when they are also machine-addressable and carry full provenance, code, and transformation history.     | Strong support for Penny trace artifacts, retrieval provenance panels, and inspectable memory/debug surfaces.                            |
| 17  | [gallamaUI](https://github.com/remichu-ai/gallamaUI)                                                                            | Repo                    | Medium     | A local-model UI can expose thinking, artifacts, and explicit model load/unload controls without pretending the model layer is invisible.                 | Useful UI/operator inspiration for Penny inspector and LM Studio control surfaces; not a stack import.                                   |
| 18  | [LlamaCoder](https://github.com/Nutlope/llamacoder)                                                                             | Repo                    | Medium     | Artifact-style generation plus sandboxed execution can make one-shot outputs more inspectable and iterative.                                              | Low-priority inspiration for future Penny artifact rendering; not directly relevant to current memory/character work.                    |
| 19  | [Fragments](https://github.com/e2b-dev/fragments)                                                                               | Repo                    | Medium     | Fully AI-generated app flows become safer and more usable when they run inside a sandboxed execution template with streaming feedback.                    | Future-facing pattern for isolated runnable artifacts only; too app-builder-oriented for Penny's current milestone.                      |
| 20  | [Artifacts (DEPRECATED)](https://openwebui.com/posts/artifacts_deprecated_b96936ea)                                             | Community function post | Low        | Renderable HTML/CSS/JS/SVG outputs can live beside chat as a distinct artifact surface.                                                                   | Useful as a product pattern only; the deprecated implementation itself should not be imported.                                           |
| 21  | [Artifacts / Open WebUI](https://docs.openwebui.com/features/chat-conversations/chat-features/code-execution/artifacts/)        | Product docs            | Medium     | Artifact windows, version switching, and targeted updates make substantial outputs easier to inspect and iterate on than burying them in chat.            | Strong support for a Penny inspector artifact panel that can show traces, versions, and compact provenance views.                        |
| 22  | [Live Search](https://openwebui.com/posts/live_search_862eceef)                                                                 | Community function post | Low        | Search can be exposed as a direct tool over external engines, but scraping-based approaches are operationally fragile.                                    | Reinforces that any future Penny web search should be explicit, provenance-heavy, and optional rather than silently blended into memory. |
| 23  | [Agentic Search & URL Fetching / Open WebUI](https://docs.openwebui.com/features/chat-conversations/web-search/agentic-search/) | Product docs            | Medium     | Agentic search works best when the model can explicitly decide to search, fetch, verify, and stop, rather than hiding search inside opaque RAG injection. | Supports a future explicit Penny search tool, but also warns that small local models may struggle with this pattern.                     |
| 24  | [Semantic Model Router](https://openwebui.com/posts/semantic_model_router_199852f2)                                             | Community function post | Low        | A small model can route requests to larger or modality-specific models based on intent.                                                                   | Mostly cautionary for Penny right now because more routing volatility would worsen coherence, QA stability, and LM Studio load churn.    |
| 25  | [Pipes / Open WebUI](https://docs.openwebui.com/pipelines/pipes/)                                                               | Product docs            | Medium     | Custom logic can be surfaced as model-like, bounded external functions with explicit contracts.                                                           | Supports stable, inspectable tool surfaces in principle, but not a reason to add another Penny routing layer today.                      |


### Addendum Impact

- `Artifacts and provenance got stronger`
  - Evidence: `#16`, `#17`, `#20`, `#21`
  - Read: this is the clearest new convergence. The best import is not "Penny should become an artifact generator." It is "Penny should expose richer, queryable, versionable internal artifacts for humans and QA."
- `Explicit web search stayed in the future-tool bucket`
  - Evidence: `#22`, `#23`
  - Read: the web-search links are useful mostly because they sharpen the shape of a future Penny search tool. Search should be explicit, inspectable, and easy to turn off. It should not masquerade as memory or silently rewrite Penny's confidence.
- `Dynamic model routing stayed de-weighted`
  - Evidence: `#24`, `#25`, plus existing `#6`, `#7`, `#12`
  - Read: Penny already has enough lane and runtime complexity. Adding intent-based model-router churn would likely make Penny less coherent and harder to QA, especially under LM Studio load drift.
- `Sandboxed artifact generation remained later-only`
  - Evidence: `#18`, `#19`
  - Read: the app-builder repos are interesting if Penny ever needs to emit runnable, isolated mini-artifacts. They do not outrank current needs like retrieval truth, inspector clarity, or character reliability.

## Concrete Next-Step Recommendation

If these late links change one near-term priority, it should be this:

1. `Build a Penny Trace Artifact panel before adding more memory or routing complexity`
  - Why this wins: it is the tightest overlap between the new links and the existing master synthesis. It improves observability, memory debugging, QA trust, and future UI polish without changing Penny's public behavior or flattening her voice.
  - Research evidence: `#16`, `#17`, `#20`, `#21`, plus existing `#1`, `#6`, `#11`
  - Penny touchpoints: `lib/penny-runtime-artifacts.js`, `public/js/penny-memory-panel.mjs`, `public/js/penny-expression-runtime.mjs`, optional new inspector-side UI module
  - Scope: expose one per-turn internal artifact that shows lane choice, wake hierarchy, retrieval channels, contradiction/open-question state, injected-vs-rejected evidence, and environment validity when QA is active
  - Guardrail: this should be an internal inspector/debug surface first, not a public-facing app-builder feature and not a new route/model router
  - Why now instead of later: it gives the next memory and character passes a clearer truth surface, and it directly supports the user's wider goal of making Penny feel more human without making her more bland, because it helps us debug what she actually "believed" on a turn before we try to tune her reactions