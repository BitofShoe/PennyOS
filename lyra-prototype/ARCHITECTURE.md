# Architecture

This file describes how Penny currently works in this repo.

If code, tests, or runtime artifacts disagree with this doc, trust those first and then update the doc.

It is intentionally blunt about what is "real architecture" versus "current monolith that still needs to be split."

## Related docs

- [CODEBASE.md](./CODEBASE.md)
Practical repo map and "where to touch what" guide.
- [frontend-section-map.md](./frontend-section-map.md)
Current browser-side ownership map for the orchestration shell.
- [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md)
Current verdict on whether shadow mode is actually worth keeping around.
- [LOCAL_LLAMA_THREAD_FINDINGS.md](./LOCAL_LLAMA_THREAD_FINDINGS.md)
Outside review notes pulled from the LocalLLaMA maintainability discussion and compared against this repo.
- [PENNY'S_BRAIN.md](./Penny's Playground/PENNY'S_BRAIN.md)
Higher-level Penny intent and personality source material.
- [Operational system prompt source](./Penny's Playground/PENNY — OPERATIONAL SYSTEM PROMPT.md)
Legacy/source operational prompt material.
- [Romantic overlay source](./Penny's Playground/PENNY — ROMANTIC OVERLAY.md)
Legacy/source romantic blend material.
- [High-intensity overlay source](./Penny's Playground/PENNY — HIGH-INTENSITY ROMANTIC + EROTIC OVERLAY.md)
Legacy/source high-intensity overlay material.

## Delegation note

When a task crosses backend, frontend, tests, and docs, break the work into read-only exploration, QA inspection, and doc mapping first, then consolidate into one primary editor per file boundary before any write happens.

## System shape

Today the app is a single-process local web application with one large Node server and one browser UI:

- `server.js`
Main backend orchestration, API surface, durable memory handling, LM Studio transport selection, tool loop, semantic render pass, shadow lane, and static file serving.
- `lib/*`
Extracted backend modules for memory helpers, research continuity, route/runtime artifact assembly, QA trace/trust helpers, direct-intent parsing/replies, direct tool assist, and concrete project/web/git/runtime tools.
- `public/index.html`
Single-page shell for the Penny UI.
- `public/app.js`
Frontend bootstrap only.
- `public/js/*`
Browser-side coordination plus extracted helpers for transcript rendering, expression runtime, ambient chrome/emoji behavior, memory-inspector rendering, attachments, and local persistence.
- `public/styles.css`
UI styling and animation.
- `penny-voice/runtime/*`
The prompt-facing voice system actually injected into Penny's live runtime.

This is not a distributed system. It is a single-user local prototype with a monolithic server.

## Boring-sprint ownership boundaries

The current cleanup sprint is about making the repo structurally boring, not adding new platform layers.

- `server.js` should stay a thin entrypoint, router, and wiring shell.
- `public/js/penny-app.js` should stay a UI orchestration shell.
- New backend behavior should land in a named `lib/` helper or a new route-specific module before it grows inside `server.js`.
- New browser behavior should land in a small `public/js/` module before it grows inside `penny-app.js`.
- If a helper starts answering more than one subsystem, split it before adding the next feature.
- If a route or UI path needs a one-off exception, document the reason code and keep the fallback local to the owning subsystem.

The same delegation rule applies to repo work:

- use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping
- remember the live-agent ceiling: Codex only gets six active subagents at once, so a spawn-limit error is a real workflow failure that should be fixed immediately by closing or reusing agents
- keep one primary editing agent per file boundary
- consolidate findings before writing, especially when a change touches both runtime ownership and the docs that describe it
- if the change is cross-cutting enough to need a written plan, start from [docs/plans/TEMPLATE.md](./docs/plans/TEMPLATE.md) so the delegation map, blind spots, and verification plan stay standardized

## Runtime modes

There are two runtime brain families:

1. Main lane: LM Studio

- This is Penny's real primary brain.
- The browser talks to `POST /api/penny/chat`.
- The backend automatically picks one of two LM Studio sub-lanes before any model call:
  - chat lane for companion turns, memory recall, softness, banter, and image chat
  - tool lane for direct inspect/search/read/edit/runtime/git/web turns and the full bounded tool loop
- The chosen lane stays fixed for the whole request. Penny does not do a second 31B restyle pass after tool work.
- Image chat stays on the chat lane and is marked `attachment-bounded` in runtime artifacts instead of getting routed through the tool lane.
- Chat lane defaults to `google/gemma-4-31b`.
- Tool lane defaults to `google/gemma-4-e4b`.
- Chat-lane sampling defaults are `temperature=1.0`, `top_p=0.95`, and `top_k=64`. Tool-lane, tool-summary, and semantic-render temperatures stay separately configured.
- The settings-panel model picker is a chat-lane override only.
- The local `@local:penny` preset belongs to LM Studio; Penny only verifies and reasserts the local wiring for startup and QA flows.

1. Optional lane: OpenClaw shadow

- This is experimental and secondary.
- It is not the default brain.
- In the current implementation, the shadow path is just a prompt handoff to `openclaw/main`.
- It does not currently expose the richer OpenClaw browser/exec/task features through Penny's main runtime path.

See also: [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md)

## Request flow

Normal chat flow:

1. Browser sends `POST /api/penny/chat?stream=1`
2. `server.js` reads request body and attachments
3. Backend merges browser memory settings with durable disk memory
4. Backend chooses `brainMode`
5. For local mode, backend selects `chat` vs `tool` lane
6. For chat-like turns, backend retrieves bounded archive context plus bounded research-ledger context
7. If explicitly enabled, the open-loop prompt bridge may merge one relevant advisory loop into prompt context; canon-first recall suppresses this bridge for direct personal-memory questions
8. If explicitly enabled, the bounded initiative bridge may add one source-aware optional suggestion scaffold; direct commands, opt-outs, cooldowns, weak evidence, pressure, high-risk actions, and canon-first recall can hold it back
9. If explicitly enabled, the ephemeral turn-state bridge may add one compact current-turn response scaffold for depth, response mode, source posture, visual-context caution, and relevant current-law constraints
10. Wording-recall turns are treated as recall-heavy chat turns so Penny answers remembered phrasing before caveating, while direct canon-memory questions still suppress stale history canon-first
11. The selected lane resolves its preferred model and transport family
12. If the turn includes an image, the LM Studio payload carries only that current image before the text part; later text-only turns do not replay earlier image blobs
13. Reply comes back with a visible text response plus a hidden mood tag, and Penny records a runtime artifact / trace summary for the turn
14. Frontend parses the mood tag and updates Penny's visual state
15. Canonical explicit memory is written back to `data/penny-memory.json`
16. Archive consolidation runs after successful turns and writes episodic/derived memory to `data/penny-memory-archive.json`
17. Research-ledger updates run after qualifying turns and write bounded advisory continuity to `data/penny-memory-ledger.json`

## Backend subsystems

### 1. Prompt assets

Prompt assets live in `penny-voice/runtime/` and are loaded by `server.js`.

Current live runtime assets:

- `penny-operational-blend.md`
- `penny-chat-directives.md`
- `penny-voice-examples.md`

These are the prompt-facing truth for Penny's normal chat voice.

Raw source docs and distilled sidecars are for refinement work, not normal runtime prompt baggage.

If you need the older canon/source stack that informed the runtime blend, start with:

- [penny-voice/canon-sources.md](./penny-voice/canon-sources.md)
- [Personality Reference (1).md](./Penny's Playground/Personality Reference (1).md)
- [BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md](./Penny's Playground/BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md)

### 2. Durable memory

Canonical explicit memory is stored in a local runtime file at `data/penny-memory.json`, seeded from tracked `data/penny-memory.seed.json` when missing.

The explicit memory model currently tracks:

- `sessionId`
- `userName`
- `memories[]`
- `voiceOn`
- `brainMode`
- `lmStudioThread`
- `updatedAt`

Important behavior:

- browser state is not the source of truth
- server merges browser settings with disk-backed state
- memory selection for prompts is relevance-scored, not full-dump
- obvious test sessions are purged on server startup

Hybrid archive overlay:

- `data/penny-memory-archive.json`
  - global episodes, summaries, patterns, and promotion queue
  - session buckets with episodic history, summaries, open loops, bounded `recentAuditTrail` turn slices, and `lastRetrieval` compatibility state aligned to that newest audit summary
- `data/penny-memory-embeddings.json`
  - embedding cache used for semantic archive retrieval when a local embed model is available
  - vectors are scoped by embedding model so a future EmbeddingGemma comparison cannot reuse stale Nomic vectors
  - bounded background-vectorization status for default-on post-turn shadow prewarm work that can still be disabled by env
- `data/penny-memory-ledger.json`
  - bounded research continuity topics with evidence refs, contradictions, open follow-ups, source session/turn identity, additive question-scoped identity (`kind`, `anchorType`, `anchorRef`, `scopeKey`, `scopeLabel`), and truth metadata (`sourceClass`, `summaryClass`, `summaryEvidenceRefs`)
  - advisory only; this does not mutate canonical explicit memory by itself
- `data/penny-open-loops.json`
  - advisory unresolved-thread state with source refs, status, priority, expiry, next likely step, and lifecycle history
  - separate from explicit memory; this does not mutate canonical explicit memory, auto-promote summaries, or authorize autonomous task execution

Current archive-policy behavior:

- explicit memory is still canonical
- archive retrieval is owned by `lib/penny-memory-archive.js`
- archive candidate/ranking policy is owned by `lib/penny-memory-archive-policy.js`
- archive utility scoring lives in `lib/penny-memory-archive-policy.js`
- that utility score is currently used for evals plus live background-prewarm candidate ranking, not live auto-forgetting
- archive retrieval scoring defaults to the `baseline` profile
- `PENNY_ARCHIVE_SCORING_PROFILE=hybrid-v1` explicitly activates the sharper hybrid candidate-ordering profile; empty or invalid values fall back to `baseline`
- `hybrid-v1` can change which archive candidates survive ranking, but it does not increase `SESSION_PROMPT_LIMIT`, `GLOBAL_PROMPT_LIMIT`, memory-book limits, or rendered archive counts
- profile comparison in candidate-survival archive-unit QA is model-answer-free and compares baseline vs `hybrid-v1` on the same fixture stores
- the scoring profile gate does not change the default embedding provider, does not auto-promote archive hits into explicit memory, and does not expand `promptTruth` or `toolEvidenceReceipt`
- static embedding live sidecar support is explicit-mode only: normal repo default is `off`, `qa-shadow` is for QA comparison, `live-shadow` records trace-only candidates, and local experimental `live-advisory` can merge static candidates into archive selection only under authority/source/correction gates and the static-only rendered cap
- static embedding sidecar cache files are derived retrieval artifacts, separate from LM Studio embedding vectors, and do not become authored memory or canonical truth
- semantic identifier contracts are owned by `lib/penny-semantic-ids.js` as pure local ID helpers. They can mint stable `penny:*` IDs for future claims, links, traces, vector sources, and rendered-context receipts, but identifier text is opaque and never implies network dereference permission, source authority, canonical memory, PromptTruth expansion, `toolEvidenceReceipt` changes, or runtime prompt rendering.
- semantic predicate contracts are owned by `lib/penny-semantic-predicates.js` as a pure local registry. Predicate IDs, inverse links, receipt requirements, ranking flags, and memory-sensitivity flags are explicit and testable, but the registry does not change live ranking, canonical memory, PromptTruth, `toolEvidenceReceipt`, prompt limits, runtime voice, or graph infrastructure.
- semantic domain contracts are owned by `lib/penny-semantic-domains.js` as a pure local authority registry. Explicit memory and repo-current-law can be canonical only inside their domain boundaries; archive, research-ledger, open-loop, document-extraction, runtime-artifact, and fixture domains stay advisory or non-live as declared; static candidates stay candidate-only; tool evidence stays eligible for sibling `toolEvidenceReceipt` but not PromptTruth; unknown domains fail closed. This registry does not change live ranking, PromptTruth, `toolEvidenceReceipt`, prompt limits, memory promotion, runtime voice, or graph infrastructure.
- semantic claim contracts are owned by `lib/penny-semantic-claims.js` as pure local assertion helpers. They can normalize, validate, and summarize source-attributed subject/predicate/object claims with authority, support, temporal, stale-status, and registered authority-domain fields; candidate-only/static claims cannot be canonical, archive claims default advisory, and raw claim graphs do not enter PromptTruth, `toolEvidenceReceipt`, prompt limits, memory promotion, runtime voice, or graph infrastructure.
- semantic source-ID audit is owned by `lib/penny-semantic-source-audit.js` as fixture/local QA only. It can report missing source IDs, unstable source IDs, static cache/source mismatches, PromptTruth rendered items without source IDs, tool-evidence source gaps, dynamic-link source/claim endpoint gaps, invalid semantic link IDs, and semantic-claim source/claim ID drift, but it does not change runtime retrieval, PromptTruth, `toolEvidenceReceipt`, prompt limits, URI dereferencing, memory promotion, runtime voice, or graph infrastructure.
- semantic claim traces are owned by `lib/penny-candidate-survival-qa.js` with archive trace pass-through in `lib/penny-memory-archive.js` / `lib/penny-memory-archive-policy.js`. They are sibling candidate-survival QA metadata for distinguishing structured expected claims, unstructured advisory text, wrong-predicate matches, and candidate-only static/semantic claims; they do not add raw claim graphs to prompt-facing `archiveContext`, PromptTruth, `toolEvidenceReceipt`, memory promotion, URI dereferencing, graph infrastructure, or default ranking/prompt limits.
- prompt rendering authority guardrails are owned by `lib/penny-prompttruth.js`, `lib/penny-memory.js`, and the compact archive item projection in `lib/penny-memory-archive.js`. When an archive claim summary actually renders, PromptTruth may record a compact `renderedClaims[]` item with `renderedClaimId`, `domainId`, `sourceAuthority`, `supportState`, and `temporalScope`; held-back, stale, fixture-only, and candidate-only claims stay out, and raw candidate traces, dynamic links, source graph internals, static similarity traces, and tool evidence stay outside PromptTruth.
- open-loop state is owned by `lib/penny-open-loops.js` and `lib/penny-open-loop-store.js`, with fixture suggestions in `lib/penny-open-loop-extraction.js`; loops can be created, updated, deferred, dismissed, expired, or completed, but completion requires an explicit user statement, deterministic artifact, test/source receipt, or manual command basis
- the live open-loop prompt bridge is opt-in via `PENNY_ENABLE_OPEN_LOOP_PROMPT=1`, capped by `PENNY_OPEN_LOOP_MAX_RENDERED` and `PENNY_OPEN_LOOP_MAX_TOKENS`, and measured by `npm run eval:open-loop-compare`; passing compare makes it eligible for local opt-in, not default runtime law
- bounded initiative policy is owned by `lib/penny-initiative-policy.js`; its live bridge is opt-in via `PENNY_ENABLE_BOUNDED_INITIATIVE=1`, capped by `PENNY_INITIATIVE_MAX_PER_TURN=1`, cooldown-aware through `PENNY_INITIATIVE_COOLDOWN_TURNS`, and limited to suggest-only scaffolds with no action-taking, memory writes, or unchecked source claims
- ephemeral turn-state is owned by `lib/penny-turn-state.js`; its live bridge is opt-in via `PENNY_ENABLE_TURN_STATE_PROMPT=1`, capped by `PENNY_TURN_STATE_MAX_TOKENS`, and limited to current-turn response-shaping cues. It is not memory, not chain-of-thought, not truth authority, not PromptTruth, not tool evidence, and runtime artifacts retain only a redacted summary/retention policy instead of the full card.
- bounded aliveness adoption evidence is owned by `lib/penny-aliveness-qa.js` and `scripts/eval-penny-aliveness-compare.js`; fixture mode is scenario-only, while live-isolated mode uses disposable Penny servers plus a mock LM Studio backend to compare baseline vs feature-on without touching real user memory or real loaded models
- background chat vectorization now defaults on, but it still runs only after `archiveCompletedTurn`, never in prompt assembly, and can be disabled with `PENNY_ENABLE_BACKGROUND_CHAT_VECTORS=0`. It is off the reply-latency path, but it still shares process, embedding-backend, and cache/store capacity.
- inspector payloads expose background-vectorization telemetry, including the session `lastArchivedAt` timestamp, and the in-app panel now surfaces a compact background-vectorization summary so the behavior stays inspectable in practice

Candidate-survival QA is an artifact layer over retrieval, not a new runtime authority layer. It records whether the expected memory/source existed, entered the raw candidate set, passed eligibility gates, what rank it received, whether it was selected/rendered/held back, and why it ranked that way. It does not prove answer quality; `answer-layer-failure` means retrieval supplied the expected support and the answer layer should be inspected first.

Important trust boundary:

- explicit memory remains canonical
- archive-derived summaries/patterns do not auto-overwrite `memories[]`
- promotion into stronger explicit memory requires inspector review
- research ledger context is advisory continuity, not canonical truth
- open-loop context is advisory continuity, not canonical truth, and user dismissal/completion/expiry should keep loops from resurfacing
- initiative context is an optional response scaffold, not authority; user opt-out, dismissal, pressure/cooldown gates, and risk gates outrank any suggested next move

### 3. LM Studio transport layer

LM Studio is the real engine behind Penny's main chat lane.

Current transport stack is owned by `lib/penny-lmstudio-transports.js`:

- stateful chat (`/api/v1/chat`) when available
- chat completions (`/v1/chat/completions`) fallback
- responses (`/v1/responses`) fallback

Important architecture detail:

- the server resolves the actually loaded runtime model instead of blindly trusting the configured pretty model id
- streamed chat is the normal frontend path
- the streamed stateful lane now preserves Penny's LM Studio thread across turns instead of clearing it after every reply
- chat-completions prompt building now carries at most one vision payload per request: only the latest user turn can include an image attachment
- stateful input only includes an image part on the current image turn; later text-only continuations stay text-only even if an earlier user message had an image

### 4. Direct tool intents

For certain technical or inspect-style requests, Penny does not need a full open-ended planning pass.

`server.js` now composes a deterministic direct-intent layer whose parser lives in `lib/penny-direct-intents.js`, whose reply-composition helpers live in `lib/penny-direct-intent-replies.js`, and whose execution branch lives in `lib/penny-direct-tool-assist.js`.

That layer can route things like:

- read/search project files
- runtime status
- git status / diff
- web search / fetch
- direct file write / replace / append

This exists to keep simple asks fast and honest.

### 5. Tool loop

If a request is more complex than a direct deterministic lane, Penny can use a local tool loop.

Tool categories currently include:

- project file listing / reading
- text search
- file editing
- syntax checking
- git inspection
- log reads
- lightweight web search and page fetch

The planner/manual tool loops now live in `lib/penny-tool-loop.js`, while the concrete tool implementations and dispatch switchboard live in:

- `lib/penny-project-tools.js`
- `lib/penny-web-tools.js`
- `lib/penny-git-tools.js`
- `lib/penny-runtime-tools.js`
- `lib/penny-tool-registry.js`

The tool registry now also exposes an internal `ToolCapabilityDescriptor` contract:

- current tools are all marked `surface: native`
- the contract is shaped for future `mcp` and `openapi` surfaces
- descriptors include advisory `outputCostShape`, `sourceShape`, `defaultOutputBound`, and `planningHint` metadata so future planners can reason about rough output/source cost without dumping broad context by default
- that cost metadata is not runtime authority and does not currently change planner/tool-loop behavior
- optional `toolCostSummary` and source-ref cost hints stay sibling runtime artifact metadata; they are not a PromptTruth expansion
- this is a planning seam only; Penny is not running live connector adapters in production

### 6. Research continuity and provenance

Penny now has an explicit research continuity layer in `lib/penny-research-ledger.js`:

- qualifying tool/research turns can update a bounded advisory ledger
- topic identity is now question-scoped, so one file or repo anchor can hold multiple bounded topics without collapsing into one ledger row
- settled non-contradiction topics require verified non-`query` evidence plus an evidence-tight summary; otherwise the topic stays provisional and the durable `conclusion` stays empty
- raw assistant synthesis is not persisted as a durable anchored-topic conclusion; prompt context falls back through open follow-up, evidence-tight conclusion, question, then topic label
- generic authored write turns do not auto-create research continuity just because a workspace write and `git status` happened; successful writes now need genuinely research-shaped intent plus anchored verified read evidence before the ledger treats them as continuity-worthy
- prompt assembly can surface a small number of open/provisional topics as wake context, preferring direct anchor-plus-scope overlap over adjacent same-file topics
- the memory inspector can render those topics with evidence refs, summary-evidence refs, truth/source class, and the additive anchor/scope identity summary

The runtime artifact layer in `lib/penny-runtime-artifacts.js` now carries:

- retrieval channels used or held back
- contradiction/open-loop/ongoing-investigation context
- accepted vs rejected evidence summaries
- a provenance block that exposes source identity for archive and research-ledger inputs
- cleanup metadata split into legacy visible-reply cleanup plus a typed `cleanupTransform` summary
- compact prompt-slot composition from `PROMPT_SLOT_REGISTRY`
- prompt-time `promptTruth` receipts for `stableFacts`, `memoryBooks`, `sessionArchive`, `globalArchive`, and `researchLedger`, including candidate vs rendered ids/counts plus holdback reasons
- sibling `toolEvidenceReceipt` items for deterministic-only, provenance-only, prompt-visible raw JSON, prompt-visible auto-verification JSON, summarized write-rescue context, and summarized semantic-render context
- sibling `toolCostSummary` metadata derived from advisory tool descriptors so broad, bounded, external-source, and raw-dump-risk calls stay inspectable without expanding PromptTruth or changing planner behavior
- sibling `initiativePromptBridge` metadata for the opt-in bounded initiative scaffold, including enabled/held-back state, selected max-one suggestion identity, cooldown, and explicit no-PromptTruth/no-tool-evidence/no-side-effect receipts
- sibling `turnStatePromptBridge` metadata for the opt-in ephemeral turn-state scaffold, including enabled/held-back state, redacted summary fields, retention policy, prompt cap, and explicit no-PromptTruth/no-tool-evidence/no-memory-write receipts
- a bounded `reasoningPolicy` receipt derived from latency budget plus execution path, with `minimal`, `deliberate`, `verifier-first`, and `attachment-bounded` modes instead of any raw reasoning text surface
- explicit approximate-path policy metadata from the latency budget and runtime fallback state
- advisory-merge summaries that distinguish lossy merge pressure from canonical memory authority
- a bounded session `recentAuditTrail` that freezes compact prompt-time/runtime-turn truth before post-turn ledger mutation and keeps `lastRetrieval` summary fields aligned with the newest slice
- additive rendered-only audit ids (`renderedSessionIds`, `renderedGlobalIds`, `renderedBookIds`, `renderedLedgerIds`) alongside candidate continuity ids, so prompt-visible identity does not get inferred from broader retrieval payloads
- headline summary text and wake-hierarchy prose derived from rendered `promptTruth`, so zero-rendered advisory channels are described as held back or not rendered instead of sounding like silent support

Important receipt rule:

- prompt assembly is the source of truth for advisory usage
- `promptTruth` stays narrow to prompt-time memory/research context; `toolEvidenceReceipt` is a sibling artifact receipt, not a PromptTruth channel
- initiative prompt bridge receipts stay sibling model-advisory metadata; they do not add PromptTruth channels, merge into `toolEvidenceReceipt`, or authorize action/memory side effects
- turn-state prompt bridge receipts stay sibling model-advisory metadata; they do not add PromptTruth channels, merge into `toolEvidenceReceipt`, store a full turn-state card, expose chain-of-thought, or authorize memory/action side effects
- `researchLedgerPromptInjected` now means the ledger was actually rendered into the prompt
- `selected*Ids` stay candidate continuity fields, while additive `rendered*Ids` carry prompt-visible identity
- post-reply ledger mutation stays in `researchLedgerUpdate` instead of being backfilled into prompt-use receipts
- `server.js` only owns the semantic-render source-fact seam here; shared PromptTruth and generic tool-evidence semantics live in helper modules
- direct canon-authority questions share one detector across latency policy, prompt/history suppression, and memory-state writes
- that detector now covers broader personal recall shapes such as preference, attribute, and location questions, but it is still gated by question phrasing, possessive framing, and explicit-memory overlap so repo questions do not bleed into canon recall
- verifier-first exactness is explicit for deterministic tool paths and other short-circuited verified turns, but Penny still does not expose chain-of-thought as a runtime trust surface

This is meant to improve auditability, not to create a new autonomous memory system.

### 7. Semantic render pass

Harder technical turns can go through a semantic render phase:

- tools gather verified facts
- the facts are compressed into a semantic core
- Penny does a final "say this like Penny" pass without inventing extra facts

This is useful, but it is also a latency multiplier and should be used selectively.

### 8. QA and eval trust surfaces

The QA/eval harnesses now share small helper layers and script-owned fixture modes:

- `lib/penny-qa-trace.js`
  - normalized replayable trace envelopes for QA/eval runs, including a compact `runIdentity` canary for resolved models, loaded models, execution-path facts, semantic readiness, runtime-artifact version, and degraded/fallback counters
  - additive drift/fixation canaries such as first drift reason/turn, fixation repeat count, and recovered-after-drift
- `lib/penny-qa-validity.js`
  - environment/readiness validation so harnesses can mark runs invalid or degraded for machine reasons instead of blaming Penny
- `lib/penny-qa-trust.js`
  - normalized trust/verdict summaries such as `pass`, `invalid`, `ambiguous`, `fallback`, and `degraded`, plus pressure-watch outcome taxonomy for social folds, source-boundary failures, agent-integrity failures, evidence-sensitive updates, and voice-tone failures
- `lib/penny-context-pressure-qa.js`
  - fixture schemas for context-pressure and source-sensitive answer fixtures, estimated prompt tokens, selected/rendered memory counts, fixture-assumed semantic readiness shapes, nullable latency fields, answer-drift classes, and source-sensitive support outcomes
- `lib/penny-candidate-survival-qa.js`
  - candidate-survival fixture/archive-unit schemas, outcome and failure-mode taxonomy, candidate trace interpretation, structured semantic candidate-contract checks, baseline-vs-`hybrid-v1` profile comparison, fixture reranker-shadow summaries, and static embedding comparison without changing normal defaults
- `lib/penny-semantic-source-audit.js` and `scripts/qa-penny-semantic-source-audit.js`
  - fixture/local source-ID continuity artifacts across semantic, static, link, rendered, and tool-evidence surfaces without live model calls or runtime behavior changes
- `lib/penny-static-memory-index.js`
  - explicit-mode static sidecar indexing/query status for live-shadow and live-advisory retrieval traces
- `lib/penny-gemma-runtime-watch.js`
  - fixture/status schema for Gemma runtime watch items such as vision-budget exposure, thinking-control default-off state, current-turn image policy, prompt-cache/RAM risk, compatible loaded-model fallback, and chat sampling
- `lib/penny-initiative-policy.js` and `scripts/eval-penny-initiative-fixture.js`
  - bounded initiative policy, prompt scaffold, user-control, memory-suggestion review gate, pressure/annoyance fixture coverage, and live-bridge guardrail receipts without default enablement
- `lib/penny-turn-state.js` and `scripts/eval-penny-turn-state-fixture.js`
  - ephemeral turn-state schema, signal extraction, compact prompt scaffold, retention policy, visual/source/pressure cases, and live-bridge guardrail receipts without default enablement
- `scripts/eval-penny-open-loop-compare.js`
  - disposable mock-route compare for open-loop-off vs open-loop-on, measuring continuity wins against adjacent-topic bleed, annoyance, overclaim, and prompt-token delta before local opt-in
- `scripts/eval-penny-static-embedding-live-compare.js`
  - disposable-server three-arm compare for static-off, static-live-shadow, and static-live-advisory route behavior
- `scripts/qa-penny-memory.js`
  - combined segmented memory QA plus a judged `write / retrieve / forget` mode, with semantic replacement grading for premise-correction cases, fixture-only source-sensitive mode, fixture-only candidate-survival mode, and archive-unit candidate-survival runner so wording noise does not create fake regressions
- `scripts/eval-penny-runtime-fit.js`
  - runtime-fit harness for context-length and semantic-fallback tradeoffs, plus fixture-only context-pressure and Gemma runtime watch modes that record field/status shape before any live drift or behavior claim
- `scripts/eval-penny-ledger-compare.js`
  - comparative ledger-prompt harness for bounded research/memory prompt strategies

This does not make Penny “judge herself” in production. It makes the existing harnesses more honest about whether a run is trustworthy, polluted by environment drift, or behaviorally red.

The April 21 pressure/Gemma/tool-cost follow-through is artifact and QA coverage only unless a later explicit slice says otherwise: no runtime voice change, no `promptTruth` expansion, no `toolEvidenceReceipt` expansion beyond optional sibling cost metadata, no default thinking, no default context increase, no default embedding-provider change, and no external dependency import. The bounded initiative and ephemeral turn-state bridges follow the same posture: fixture and opt-in scaffolding first, default enablement only after bounded aliveness compare evidence shows a real benefit without annoyance, overclaim, pressure, privacy leakage, latency, or prompt-bloat regressions.

The bounded aliveness compare harness interprets "more alive" as a measured outcome, not a vibe. Positive outcomes are human-observable wins and continuity wins. Blocking outcomes include overclaim, stale-correction failure, source-boundary failure, candidate-only truth laundering, unsupported action/source claims, recurring annoyance, prompt bloat, latency regression, invalid environment, or failed disposable cleanup. A fixture artifact can support live-shadow review; a live-isolated mock-route artifact can support live-advisory review; default enablement remains a separate adoption stage that needs repeated real compare passes, completed manual review, user controls, and current docs.

The Penny Frame Budget Principle is current architecture discipline for these follow-through slices: every turn has a runtime/context frame budget, and Penny should spend it first on relevance, source authority, and candidate selection before rendering more context. Faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory. This applies to static live memory reflex, open-loop tracking, turn-state cards, initiative policy, session reflection, dynamic memory linking, and aliveness/frame-budget compares, without expanding PromptTruth, merging `toolEvidenceReceipt`, changing runtime voice, raising default prompt/rendered-memory limits, treating frame-budget artifacts as answer-quality proof, or broadening `server.js`.

Frame-budget follow-through is implemented as inspectable receipts and helper-owned degradation paths. `lib/penny-frame-budget.js` owns `penny-frame-budget.v1`, sidecar receipts, sidecar schedules, candidate-merge budget plans, health summaries, and compare-mode normalization. Runtime artifacts derive `frameBudget` from existing performance, prompt-truth counts, and sidecar receipts; static memory, open-loop relevance, turn-state, archive candidate merge, and runtime-fit/aliveness eval paths can report deadlines, skipped/degraded work, selected/rendered counts, prompt-token deltas, and measured latency when available. `lib/penny-background-frame.js` adds a bounded local queue for post-turn/background work such as static-index updates, open-loop refreshes, reflection prep, memory-link refreshes, pulse prep, and artifact summaries. Missed or skipped background jobs and sidecars must not be described as completed work, and optional rendered-context work should be skipped before prompt or rendered-memory limits are raised.

Session reflection follows the same authority boundary across the landed helper, fixture, review-queue, approval, open-loop, and compare slices. A reflection artifact may summarize a session, surface decisions, draft advisory open-loop updates, and propose memory suggestions for review, but it is reviewable synthesis rather than canonical memory. It cannot silently write `data/penny-memory.json`, promote archive/semantic/static candidates into explicit facts, treat generated summaries as truth proof, expand PromptTruth, merge into `toolEvidenceReceipt`, store hidden chain-of-thought, or change runtime voice. Memory suggestions must carry support state, sensitivity, `requiresApproval: true`, and `autoPromoted: false`; explicit approvals route through the existing explicit-memory helper rather than a new authority path. The compact prompt bridge is currently compare-only evidence, with default broad/live rendering still disabled.

Dynamic memory linking is helper-owned and bounded: schema/helpers, fixture traces, candidate-survival reporting, reflection link suggestions, semantic link-contract metadata, a fixture compare harness, and conservative current-vs-stale correction scoring behind `PENNY_MEMORY_LINK_SCORING=correction-v1` now exist. The current law is still deliberately small: a memory link is never proof that either endpoint is true. Links may carry local `linkId`, registered `predicateId`, claim endpoints, source authority, support state, and evidence receipts, but those receipts are retrieval/provenance contracts rather than truth authority. Links must not make archive/research/semantic/static candidates canonical, must not promote advisory memories, must not let candidate-only support count as verified support, must not expand PromptTruth or `toolEvidenceReceipt`, must not change runtime voice, and must not trigger a graph DB or universal index migration. Same-project-thread, research-pattern, and open-loop links remain shadow/advisory until separately measured.

Semantic identity/provenance follow-through is still artifact-first. Candidate-survival archive-unit runs can report `penny-semantic-claim-trace.v1` beside existing trace/link/contract summaries for QA inspection, while prompt-time receipts preserve only compact rendered-claim authority labels for archive items that actually rendered. Raw claim graphs, candidate-only claims, dynamic links, static similarity traces, and source graph internals remain outside PromptTruth.

### 9. Mood / vessel presentation

The visible Penny vessel is driven by reply mood tags such as:

- `calm`
- `happy`
- `excited`
- `thinking`
- `surprised`
- `flirty`
- `smug`
- `annoyed`

Frontend sprite selection and animation are tied to these tags.

## How to extend without re-monolithing

When adding backend behavior, prefer the smallest named owner that already matches the job:

- routing and request glue stay in `server.js`
- stateful logic goes in `lib/`
- repeated prompt or transport behavior gets a dedicated helper module
- any new heuristic should come with a reason code and a small test fixture

When adding frontend behavior, keep `public/app.js` as bootstrap only and use `public/js/penny-app.js` as coordination only:

- UI state that belongs to one slice should move into a dedicated `public/js/` module
- transcript, memory, LM Studio diagnostics, and attachment handling should not be merged back together
- if a browser helper becomes reusable, extract it before adding more features to it

## API surface

Current important endpoints:

- `GET /api/penny/status`
- `GET /api/penny/memory`
- `POST /api/penny/memory`
- `GET /api/penny/memory/inspector`
- `POST /api/penny/memory/review`
- `POST /api/penny/memory/purge`
- `POST /api/penny/consolidate`
- `GET /api/penny/lmstudio/status`
- `POST /api/penny/lmstudio/model`
- `GET /api/penny/shadow-status`
- `POST /api/penny/chat`
- `POST /api/penny/chat/shadow`

`/api/companion/*` aliases also exist for the main status/chat route.

## Frontend architecture

The frontend is a single-page app with no build step.

Current split:

- `public/app.js`
tiny module bootstrap
- `public/js/penny-app.js`
main SPA orchestration and wiring shell
- `public/js/penny-transcript-ui.mjs`
transcript rendering and streaming presentation helpers
- `public/js/penny-expression-runtime.mjs`
expression/mood runtime helpers
- `public/js/penny-ambient-chrome.mjs`
boot overlay, emoji picker, particle, and idle/parallax chrome helpers
- `public/js/penny-memory-panel.mjs`
memory-inspector rendering for the latest-reply summary plus explicit memory, archive state, runtime artifacts, trace provenance, and research continuity
- `public/js/penny-lmstudio-ui.js`
LM Studio diagnostics/model UI helpers
- `public/js/penny-attachments.js`
image/file attachment prep and preview handling; pending attachments are cleared after send so the next turn starts clean
- `public/js/penny-storage.js`
local browser persistence/session helpers; archive inspector data stays server-side, and restored snapshots keep attachment markers but not raw image/file payload bodies

Main remaining responsibilities in `public/js/penny-app.js`:

- local browser state
- chat composer and transcript rendering
- SSE streaming consumption
- memory/settings UI
- mood-driven sprite swaps
- settings and model list fetches

This is intentionally dependency-light, but the tradeoff is that `public/js/penny-app.js` is still large and stateful even though `public/app.js` is only bootstrap glue.

## Operational scripts

Important scripts:

- `start-lyra.ps1`
Starts Penny in the background and writes PID / meta files.
- `stop-lyra.ps1`
Stops the background Penny server.
- `scripts/ensure-lmstudio-penny-preset.js`
Reasserts the LM Studio preset/default state Penny expects.
- `scripts/penny-lmstudio-prepare.js`
Shared LM Studio preparation flow used by startup, preflight, QA, and eval scripts.
- `scripts/penny-preflight.js`
Cheap local environment and LM Studio readiness checks.
- `scripts/penny-wait-ready.js`
Readiness poller used by the durable launcher and tests.
- `scripts/eval-penny-models.js`
Comparative chat-lane model harness with a fixed tool-lane model.
- `scripts/eval-penny-probes.js`
Tool-lane leaning probe harness that prefers E4B by default.
- `scripts/eval-penny-epistemic-compare.js`
Epistemic compare harness; current favored primary pair is `off` vs `synthesis-only`.
- `scripts/eval-penny-ledger-compare.js`
Ledger compare harness for bounded research-ledger prompt strategies.
- `scripts/eval-penny-static-embedding-live-compare.js`
Static embedding sidecar compare harness that runs static-off, live-shadow, and live-advisory modes against disposable per-case servers and a mock LM Studio backend. It is the normal receipt path before treating local `PENNY_STATIC_EMBED_MODE=live-advisory` experiments as useful.
- `scripts/eval-penny-aliveness-compare.js`
Bounded aliveness compare harness. `--fixture` / `npm run eval:aliveness:fixture` writes scenario-only artifacts with null/not-run runtime metrics; `--live-isolated` runs baseline vs bounded-aliveness-on through disposable memory, archive, embeddings, static-cache, ledger, open-loop, initiative-session, and memory-book files, then records prompt/context deltas, trust-pressure gates, manual-review fields, and A9 adoption-checklist status.
- `scripts/eval-penny-runtime-fit.js`
Runtime-fit harness for context-length and semantic-fallback tradeoff measurement, with a fixture-only context-pressure mode for short/medium/long rendered-context artifacts whose answer drift remains `not-run` until live eval.
- `scripts/qa-penny-memory.js`
Segmented memory QA harness with trace-first runtime artifact validation, judged `write / retrieve / forget` suites, fixture-only source-sensitive memory cases, fixture-only candidate-survival schema output with structured candidate-contract checks, and archive-unit candidate-survival artifacts.
- `scripts/qa-penny-semantic-source-audit.js`
Fixture-only semantic source-ID audit runner for missing source IDs, static cache/source mismatches, rendered PromptTruth source gaps, tool-evidence source gaps, dynamic-link endpoint gaps, and semantic-claim source/claim ID drift.
- `scripts/qa-penny-voice-redo.js`
Chat-lane voice QA harness that records prompt-set, lane/model/fallback metadata, and normalized trust.
- `scripts/qa-penny-browser-smoke.js`
Disposable-server browser smoke harness for the real streamed `/api/penny/chat?stream=1` path.
- `scripts/qa-penny-next-cycle.js`
Fixed-order wrapper for the standard next-cycle rerun sequence.
- `scripts/build-review-bundle.js`
Builds a filtered repo copy for outside review without dragging along runtime debris and local logs.
- Route/regression tests and similar local verification should use an isolated mock or a dedicated temporary LM Studio server, not the user's live loaded model.
- That isolation pattern has already proven itself in-project; keep carrying it forward so verification stays repeatable and does not disturb the live brain.

## Speed realities

The biggest runtime latency costs today are:

- first-turn prompt ingestion on a large local model
- overlapping requests against LM Studio
- large prompt/context processing
- extra semantic render passes on turns that do not need them

Recent mitigations already in place:

- live model resolution now prefers the actually loaded LM Studio runtime id
- high-trust QA favors disposable or restart-gated servers instead of the stale long-lived main process
- streamed stateful LM Studio chat now keeps the thread alive between turns
- normal chat output budget is capped lower than the tool/coding paths
- casual chat history is clipped more aggressively

## What is stable vs unstable

Reasonably stable:

- single-page UI shell
- durable memory file shape
- LM Studio as the main chat brain
- runtime voice asset layout in `penny-voice/runtime`

Still volatile:

- `server.js` internal shape
- tool loop heuristics
- semantic render heuristics
- shadow/OpenClaw integration boundary
- performance tuning

## Known architectural debt

The biggest architectural problem is straightforward:

- `server.js` is doing too many jobs

It currently mixes:

- config and environment parsing
- prompt asset loading
- memory model logic
- tool loop planning and LM Studio orchestration
- prompt building
- LM Studio transport handling
- shadow/OpenClaw transport
- SSE helpers
- route handling
- startup housekeeping

That is the first thing that should eventually be split if this repo keeps growing.

## If this repo were split cleanly later

A sensible future shape would probably look like:

- `src/config/*`
- `src/memory/*`
- `src/prompting/*`
- `src/lmstudio/*`
- `src/tools/*`
- `src/routes/*`
- `src/shadow/*`
- `src/ui-contract/*`

That is not the current state. This file describes the current state.
