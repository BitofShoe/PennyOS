# Penny Companion Prototype

Local-first Penny companion app with:

- a single-page browser UI
- a single Node backend
- LM Studio as the main brain
- hybrid memory with canonical explicit memory, advisory archive recall, and bounded research continuity
- advisory open-loop continuity for unresolved threads, kept separate from explicit memory
- opt-in bounded initiative that can offer at most one source-aware, dismissible suggestion
- opt-in ephemeral turn-state scaffolding for current-turn response shape
- runtime voice assets under `penny-voice/runtime/`
- an optional experimental OpenClaw shadow lane

If you landed here from the wider `workspace-main/` ritual docs, start with [docs/README.md](./docs/README.md) for the docs hierarchy, then [CODEBASE.md](./CODEBASE.md) for the runnable app map.

> Operator note:
> This README is the contributor-facing current-state map for the repo.
> Start with [docs/README.md](./docs/README.md) if you need the docs hierarchy and authority map.
> Use [docs/penny-public/README.md](./docs/penny-public/README.md) for public-facing explainers.

## Start here

Read these in order if you need the current truth:

1. [docs/README.md](./docs/README.md)
2. [CODEBASE.md](./CODEBASE.md)
3. [ARCHITECTURE.md](./ARCHITECTURE.md)
4. [docs/penny-runtime-authority-contract-2026-04-17.md](./docs/penny-runtime-authority-contract-2026-04-17.md)
5. [server-js-section-map.md](./server-js-section-map.md)

## Current runtime truth

- Penny routes local turns through two automatic LM Studio lanes:
  - chat lane for companion turns and memory-heavy conversation
  - tool lane for bounded inspect/search/read/edit/runtime/git/web turns
- `server.js` is still the main backend monolith, but lane selection, LM Studio status/model resolution, visible-reply salvage, tool-loop orchestration, transports, direct-intent parsing/replies, direct tool-assist, and concrete tools now live under `lib/`.
- `public/app.js` is bootstrap glue. The main browser logic lives under `public/js/`, with separate modules for LM Studio diagnostics/model UI, transcript rendering, expression runtime, ambient chrome/emoji behavior, memory-inspector rendering, attachments, and local persistence.
- Penny's live prompt stack comes from `penny-voice/runtime/`, not the giant raw personality docs.
- Wording-recall turns now get a phrase-first recall path: Penny is taught to answer remembered wording before premise caveats, while direct canon-memory questions still stay canon-first.
- LM Studio is Penny's real primary brain.
- OpenClaw shadow exists, but it is optional and experimental.
- Browser storage uses the `penny:v3` key for local vessel/settings continuity.
- Browser snapshots intentionally strip raw image payloads; uploaded images are turn-local instead of being cached into later localStorage restores.
- Durable memory defaults to an untracked `data/penny-memory.json`, seeded from tracked `data/penny-memory.seed.json` when missing.
- Penny uses a hybrid memory stack:
  - canonical explicit facts/settings in `data/penny-memory.json`
  - archive + semantic recall in `data/penny-memory-archive.json` and `data/penny-memory-embeddings.json`
  - a bounded research continuity ledger in `data/penny-memory-ledger.json`
  - the archive layer is additive and reviewable; it does not silently overwrite explicit facts
- The archive layer can do bounded post-turn shadow vector prewarm for recent chat history, but only when explicitly enabled and only off the reply-latency path. It still shares the same process, embedding backend, and cache/store.
- The backend memory inspector now exposes runtime artifacts, trace provenance, research continuity topics, recency protection, bounded background-vectorization telemetry, compact prompt-slot composition, prompt-truth receipts, cleanup-transform class/materiality, reasoning-policy receipts, approximate-path policy, and advisory-merge provenance summaries. The in-app Memory debug tab now starts with a latest-reply-at-a-glance summary, then keeps the deeper inspector sections below it.
- Runtime artifacts now keep prompt-time `promptTruth` separate from sibling `toolEvidenceReceipt`: `promptTruth` covers candidate-vs-rendered memory/research context plus holdback truth, while `toolEvidenceReceipt` covers deterministic-only, provenance-only, prompt-visible raw JSON, auto-verification, and summarized tool-evidence paths without widening PromptTruth. Tool-cost hints and `toolCostSummary` are advisory sibling runtime artifact metadata; they do not change planner behavior or make cost metadata a runtime authority layer.
- Context-pressure and source-sensitive memory QA now have lightweight fixture-only artifacts and helpers that record estimated prompt tokens, selected/rendered memory counts, lane/model identity placeholders, fixture-assumed semantic readiness, nullable latency fields, `not-run` answer drift, source-sensitive retrieval expectations, candidate-survival correlation, and separate answer outcome buckets without making long context the default.
- Pressure-watch trust canaries now live in QA/eval coverage and `penny-pressure-watch-qa.v1` artifacts. They test truthfulness under user, source, social, companion-feedback, and agent-integrity pressure without changing runtime voice.
- Gemma runtime watch now lives as fixture/status artifact coverage and status/preflight output, not as a behavior change. It records watch items such as vision budget exposure, thinking-control state, prompt-cache/RAM risk, loaded-model identity, and chat sampling without enabling default thinking, raising default context, or changing the default embedding provider.
- The April 21 external-link follow-through did not import external dependencies, change runtime voice, expand `promptTruth`, broaden `toolEvidenceReceipt` beyond optional cost metadata on existing runtime artifact surfaces, enable default thinking, raise default context/rendered-memory limits, or switch embedding providers.
- Static embedding live sidecar support is opt-in. Normal repo work leaves `PENNY_STATIC_EMBED_MODE` unset or `off`; QA/shadow comparison uses `qa-shadow` or `npm run eval:static-embedding-live-compare`. Local experimental Penny runs may set `PENNY_STATIC_EMBED_MODE=live-advisory`, but static candidates remain advisory, static-only rendered items stay capped, prompt limits stay unchanged, and PromptTruth / `toolEvidenceReceipt` do not expand.
- Open-loop tracker state is advisory continuity, not explicit memory. `data/penny-open-loops.json` can hold unresolved project/session threads with source refs, status, expiry, and lifecycle history; dismissed, completed, or expired loops stay suppressed, and completion requires an explicit allowed basis instead of model vibes.
- The live open-loop prompt bridge is bounded and opt-in: `PENNY_ENABLE_OPEN_LOOP_PROMPT=1` may render at most one relevant advisory snippet, capped by `PENNY_OPEN_LOOP_MAX_RENDERED` and `PENNY_OPEN_LOOP_MAX_TOKENS`, while normal defaults leave it off. Slice O8 measured the mock-route bridge as eligible for opt-in, not as permission to raise prompt limits, expand PromptTruth, merge `toolEvidenceReceipt`, or let Penny take initiative the user did not grant.
- Bounded initiative is also opt-in: `PENNY_ENABLE_BOUNDED_INITIATIVE=1` may render at most one source-aware optional suggestion from `lib/penny-initiative-policy.js`, with `PENNY_INITIATIVE_MAX_PER_TURN` capped at 1 and `PENNY_INITIATIVE_COOLDOWN_TURNS` controlling repeat suppression. It is suggest-only, respects user opt-out and dismissal language, cannot take actions or write memory, and records a sibling `modelAdvisory.initiativePromptBridge` receipt without expanding PromptTruth or `toolEvidenceReceipt`.
- Ephemeral turn-state scaffolding is opt-in: `PENNY_ENABLE_TURN_STATE_PROMPT=1` may render one compact current-turn response-shaping snippet from `lib/penny-turn-state.js`, capped by `PENNY_TURN_STATE_MAX_TOKENS`. It helps Penny match requested depth, mode, source posture, visual-context caution, and current-law constraints, but it is not memory, not chain-of-thought, not truth authority, and records only a redacted sibling `modelAdvisory.turnStatePromptBridge` receipt without expanding PromptTruth or `toolEvidenceReceipt`.
- The bounded aliveness compare harness now records whether static-live, turn-state, open-loop, and initiative scaffolds make Penny more situated without weakening truth boundaries. `npm run eval:aliveness:fixture` is fixture-only and can only support live-shadow review; `node scripts/eval-penny-aliveness-compare.js --live-isolated` uses disposable Penny servers plus a mock LM Studio backend and can support live-advisory review when trust, annoyance, prompt, latency, environment, and cleanup gates pass. Default enablement remains blocked without repeated real compare passes, completed manual review, available user controls, and current docs.
- Penny Frame Budget Principle: every turn has a runtime/context frame budget. Spend it first on relevance, source authority, and candidate selection before spending it on more rendered context. Faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory. This applies to static live memory reflex, open loops, turn-state, initiative, session reflection, dynamic memory linking, and aliveness/frame-budget compares; it does not expand PromptTruth, merge `toolEvidenceReceipt`, change runtime voice, raise default prompt/rendered-memory limits, make frame-budget artifacts answer-quality proof, or broaden `server.js`.
- Frame-budget runtime follow-through has landed as bounded runtime-shape evidence, not a default verbosity increase. `lib/penny-frame-budget.js` owns receipts, sidecar schedules, and candidate-merge budget plans; runtime artifacts fold existing performance/PromptTruth/static/open-loop/turn-state sidecar facts into a sibling `frameBudget`; archive selection can skip optional static expansion or degrade gracefully under tight budgets; `lib/penny-background-frame.js` provides a local-only bounded background queue; and `npm run eval:frame-budget` writes fixture-only compare artifacts for `baseline`, `static-live-shadow`, `static-live-advisory`, `static+open-loops`, and `bounded-aliveness`.
- Session reflection and memory-suggestion work has landed as a reviewable helper/fixture stack, not as default live memory behavior. `lib/penny-session-reflection.js`, `lib/penny-memory-suggestions.js`, `lib/penny-memory-suggestion-queue.js`, the open-loop bridge, `npm run qa:session-reflection`, and `npm run eval:session-reflection-compare` can build artifacts, classify suggestions, queue review items, route explicit approvals through the existing explicit-memory helper, propose advisory open-loop updates, and compare a compact prompt bridge. Reflection still cannot silently write canonical explicit memory, reflection summaries are not truth proof, every suggestion remains support/sensitivity/approval/non-promotion labeled, and the compact bridge is compare evidence with broad/default live rendering kept disabled.
- Dynamic memory linking now has helper/fixture/QA/compare code plus gated conservative correction scoring via `PENNY_MEMORY_LINK_SCORING=correction-v1`. The core rule is still fixed: a memory link is a retrieval/navigation hint, not proof that either side is true. Links do not make advisory memory canonical, do not replace explicit memory, do not activate broad project/research/open-loop scoring, do not expand PromptTruth or `toolEvidenceReceipt`, do not change runtime voice, and do not imply a graph DB or universal memory index.
- Semantic identifier contracts now exist as pure local helpers in `lib/penny-semantic-ids.js`. They mint and validate stable `penny:*` IDs for sources, claims, entities, predicates, domains, links, vector sources, and rendered context, but those IDs are opaque local identifiers only: they are not URL fetch instructions, authority claims, memory promotion, PromptTruth expansion, `toolEvidenceReceipt` changes, graph infrastructure, or runtime prompt behavior.
- Semantic predicate contracts now exist as a pure local registry in `lib/penny-semantic-predicates.js`. The registry defines a small typed predicate set plus explicit ranking, receipt, inverse, and memory-sensitivity flags; unknown predicates fail closed, labels do not decide behavior, and no runtime scoring, PromptTruth, `toolEvidenceReceipt`, memory-promotion, graph, or prompt behavior changes are implied.
- Semantic claim contracts now exist as pure local helpers in `lib/penny-semantic-claims.js`. They normalize, validate, and summarize subject-predicate-object assertions with source, authority, support, temporal, and stale-status fields; candidate-only/static claims cannot become canonical, archive claims default advisory, and the helper does not wire claims into runtime retrieval, PromptTruth, `toolEvidenceReceipt`, memory promotion, graph infrastructure, or prompt limits.
- The research continuity ledger is question-scoped instead of file-scoped: one repo anchor can hold multiple bounded topics, and the inspector exposes each topic's anchor/scope identity instead of flattening them together.
- Question-scoped ledger topics only settle when verified non-`query` evidence supports an evidence-tight summary. Otherwise Penny keeps the topic provisional, leaves the durable conclusion empty, and falls back to the question or open follow-up instead of laundering assistant wording into continuity.
- Generic authored file-write turns stay out of the research ledger unless the turn was genuinely research-shaped and anchored by verified read evidence. Penny's Playground free-writing can matter to archive/audit continuity without pretending it was research provenance.
- Session archive buckets keep a bounded `recentAuditTrail` with compact turn slices: selected lane/mode/path, selected-vs-rendered retrieval ids, prompt-truth counts/holdbacks, artifact summary, and post-turn ledger update status. `lastRetrieval` keeps its old compatibility role but now carries the same compact summary so the two views stay aligned.
- Canon-first recall handling covers more natural personal-memory shapes like "What color is my..." or "What do I like again?", but it is gated by question phrasing plus actual explicit-memory overlap so repo/file questions do not get misclassified as personal recall.

## Project layout

- `server.js`
Main backend orchestration: routes, memory persistence, lane-aware local routing, semantic render gating, and static file serving.
- `public/`
Browser UI shell, styles, sprites, and client logic.
- `penny-voice/runtime/`
Live runtime voice assets injected into prompts.
- `lib/`
Extracted backend helpers with cheap regression tests. Current high-value modules include local lane routing, LM Studio status/model resolution, visible reply salvage, transports, tool-loop orchestration, direct intents, direct tool assist, concrete tool implementations, hybrid memory helpers, runtime artifacts, QA trace/trust helpers, and the research continuity ledger.
- `scripts/`
QA, eval, browser-smoke, review-bundle, and LM Studio helper scripts.
- `data/`
Durable runtime state.

For the fuller map, use [CODEBASE.md](./CODEBASE.md).

## Run

### Durable launcher

Recommended:

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\start-lyra.ps1
```

That launcher now waits for `GET /api/penny/status` before it claims Penny is up.
It also runs `npm run lmstudio:prepare` in best-effort mode first unless `PENNY_SKIP_LMSTUDIO_PREP=1`.

Then open:

- [http://localhost:4317](http://localhost:4317)

For phone access, use the Windows Wi-Fi IPv4 address printed by the server, for example `http://10.0.0.141:4317`. Do not use the WSL adapter address such as `172.29.x.x` on a phone. If phone/LAN access stops working, use [docs/penny-lan-phone-reset-runbook-2026-04-21.md](./docs/penny-lan-phone-reset-runbook-2026-04-21.md) before debugging from scratch.

Stop it later with:

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\stop-lyra.ps1
```

### Foreground mode

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
npm start
```

## Useful commands

```powershell
npm run preflight
npm run lmstudio:prepare
npm test
npm run qa:memory:smoke
npm run qa:memory
npm run qa:memory:judged
npm run qa:memory:source-sensitive
npm run qa:memory:candidate-survival-fixture
npm run qa:memory:candidate-survival
npm run qa:voice:tiebreak
npm run qa:browser:smoke
npm run qa:next-cycle
npm run eval:probes
npm run eval:epistemic-compare
npm run eval:epistemic-compare:synthesis
npm run eval:ledger-compare
npm run eval:open-loop-compare
npm run qa:session-reflection
npm run eval:session-reflection-compare
npm run eval:aliveness:fixture
node scripts/eval-penny-aliveness-compare.js --live-isolated
npm run eval:frame-budget
npm run eval:static-embedding-live-compare
npm run eval:runtime-fit
npm run eval:runtime-fit:context-pressure
npm run eval:runtime-fit:gemma-watch
npm run qa:voice-redo
npm run eval:models
npm run ingest:conversations
npm run preset:lmstudio
npm run bundle:review
```

Practical notes:

- `npm run qa:browser:smoke` checks the real streaming browser path against a disposable current-code server and mock LM Studio.
- `npm run eval:static-embedding-live-compare` compares static-off, static-live-shadow, and static-live-advisory through disposable per-case Penny servers and a mock LM Studio route backend.
- `npm run eval:open-loop-compare` compares open-loop-off vs open-loop-on through disposable per-case Penny servers and a mock LM Studio route backend. It treats the bridge as eligible only when continuity wins beat annoyance, overclaim, adjacent-topic bleed, and prompt-token regressions.
- `npm run qa:session-reflection` writes a fixture-only session reflection artifact covering summary/decision/open-loop/memory-suggestion gates, explicit approval routing, and no automatic memory writes.
- `npm run eval:session-reflection-compare` compares baseline/off/compact/verbose reflection prompt shapes in fixture mode. The compact result can support live-shadow review only; default broad rendering stays disabled.
- `npm run eval:aliveness:fixture` writes a fixture-only `penny-aliveness-compare.v1` artifact from Penny-native A2 scenarios. It does not spawn a server or call LM Studio; a passing fixture can recommend only `eligible-for-live-shadow`.
- `node scripts/eval-penny-aliveness-compare.js --live-isolated` runs paired baseline vs bounded-aliveness prompts through disposable Penny servers and a mock LM Studio backend. It measures human-observable wins, continuity wins, trust/pressure blockers, prompt and latency deltas, rendered advisory counts, manual-review fields, and A9 adoption checklist status while touching only disposable memory, archive, embedding, static-cache, ledger, open-loop, initiative-session, and memory-book files.
- `npm run eval:frame-budget` writes a fixture-only `penny-frame-budget-compare.v1` artifact across baseline/static/open-loop/bounded-aliveness modes. It records budget shape, selected/rendered candidate counts, prompt-token deltas, expected wins/regressions, and null/not-run live latency; it can recommend live frame-budget measurement, not default enablement or answer quality.
- `npm run eval:runtime-fit` measures latency/context/semantic-readiness tradeoffs instead of only correctness. Runtime token counts are request-message estimates unless a future artifact exposes true assembled-prompt/tokenizer counts.
- `npm run eval:runtime-fit:context-pressure` writes a cheap short/medium/long rendered-context fixture-only artifact with nullable latency fields and a candidate-survival correlation appendix; answer drift remains `not-run` until live eval, and semantic readiness may be fixture-assumed.
- `npm run eval:runtime-fit:gemma-watch` writes a status/preflight-only Gemma runtime watch artifact. It does not run live chat generation, change LM Studio defaults, enable thinking by default, or raise context/vision budgets.
- `node scripts/eval-penny-turn-state-fixture.js` writes the fixture-only turn-state prompt-bridge artifact. It proves the snippets stay compact, ephemeral, sanitized, and separate from memory, PromptTruth, `toolEvidenceReceipt`, and autonomous action.
- `npm run qa:memory:source-sensitive` writes the source-sensitive memory QA fixture with subject/relation/object/source/surface cases and outcome classes.
- `npm run qa:memory:candidate-survival-fixture` writes the fixture-only candidate-survival schema and failure taxonomy. It is model-answer-free and does not require LM Studio.
- `npm run qa:memory:candidate-survival` writes the archive-unit candidate-survival artifact against disposable seeded stores, compares `baseline` and gated `hybrid-v1` profile ordering, and cleans the disposable memory/archive/embedding/book/ledger state. It is model-answer-free and does not require LM Studio.
- `npm run bundle:review` builds a filtered copy under `tmp/review-bundle/` for outside review.

## Memory model

Penny stores two different kinds of continuity:

- Browser-side vessel/settings state in `localStorage`
This is lightweight UI continuity like voice toggle, selected brain mode, and other client-side preferences.
- Durable server-side memory in `data/penny-memory.json`
This is the actual runtime memory store used for prompt relevance and longer continuity. The repo tracks `data/penny-memory.seed.json`; the live `data/penny-memory.json` is created on first run and stays local.

Penny's runtime memory is hybrid:

- Canonical explicit memory in `data/penny-memory.json`
  This stays the source of truth for direct facts, preferences, user name, brain mode, and other explicit state.
- Archive memory in `data/penny-memory-archive.json`
  This stores raw episodic turns, rolling summaries, longer-term patterns, utility-scored archive candidates, the review queue for candidate promotions, and a bounded per-session `recentAuditTrail` for compact "what Penny actually used on this turn" slices.
- Embedding cache in `data/penny-memory-embeddings.json`
  This supports semantic recall when a local embedding model is available, and can optionally record bounded post-turn background-vectorization telemetry, including eager-vs-background counts.
- Research continuity ledger in `data/penny-memory-ledger.json`
  This stores bounded advisory topics, evidence refs, open follow-ups, source session/turn identity, additive topic identity metadata (`kind`, `anchorType`, `anchorRef`, `scopeKey`, `scopeLabel`), and ledger truth metadata (`sourceClass`, `summaryClass`, `summaryEvidenceRefs`) so Penny can keep multiple distinct questions about the same file or repo area separate without overstating what has actually been verified.
- Open-loop continuity state in `data/penny-open-loops.json`
  This stores unresolved project/session threads with status, priority, source refs, expiry, and lifecycle history. It is advisory, dismissible, deferrable, completable, and expire-able; it is not canonical explicit memory, does not auto-promote into `data/penny-memory.json`, and does not authorize Penny to execute tasks autonomously.
- Bounded initiative prompt bridge receipts in runtime artifacts
  These record whether the opt-in initiative bridge was enabled, what max-one suggestion was selected or held back, cooldown/user-control reasons, and explicit no-side-effect/no-memory-write guardrails. They are sibling model-advisory metadata, not PromptTruth, not tool evidence, and not permission for autonomous follow-through.
- Ephemeral turn-state prompt bridge receipts in runtime artifacts
  These record whether the opt-in turn-state bridge was enabled plus a redacted summary of the compact prompt scaffold. The full turn-state card, raw user intent, energy evidence, hidden reasoning-shaped fields, and sensitive/private inference are not stored; the receipt is sibling model-advisory metadata, not memory, not PromptTruth, and not tool evidence.
- Prompt-truth receipts in runtime artifacts
  These record what advisory context was selected as candidate, what was actually rendered into the prompt, what was held back canon-first or disabled, and which rendered-only audit ids were prompt-visible for the turn.
- Tool-evidence receipts in runtime artifacts
  These stay sibling to `promptTruth` and record deterministic-only, provenance-only, raw-json, auto-verification, write-rescue, and semantic-render tool-evidence paths without inferring from coarse tool metadata alone.
- Bounded reasoning-policy receipts in runtime artifacts
  Penny records whether a turn was `minimal`, `deliberate`, `verifier-first`, or `attachment-bounded`, whether verifier-style evidence actually drove the turn, and whether the runtime short-circuited early. This is a policy/execution receipt, not exposed chain-of-thought.
- Artifact prose derived from prompt truth
  Human-facing artifact summaries and wake-hierarchy notes now derive from rendered `promptTruth` counts and holdback reasons, so "held back" and "not rendered" stay honest instead of implying advisory support Penny did not actually use.

For memory QA, use `npm run qa:memory:smoke` for the fast regression slice, `npm run qa:memory` for the full combined release-style run, and `npm run qa:memory:judged` for the grouped `write / retrieve / forget` trust pass. On the current Q6 setup the full combined run is expected to take roughly 80-90 minutes end to end.
Use `npm run qa:memory:source-sensitive` for the cheap fixture-only source-sensitive cases. It separates subject, relation, object, source, surface wording, retrieval expectations, and answer outcome buckets, and keeps `correct-but-unsupported` diagnostic unless support is rendered or canonical by the case contract.
Use `npm run qa:memory:candidate-survival` for the model-answer-free archive-unit candidate survival fixture. It compares baseline archive scoring against the gated `hybrid-v1` profile on the same disposable stores, can be correlated with rendered context pressure, and treats candidate survival as retrieval-path evidence rather than answer-quality evidence. Add `-- --shadow-embed-provider=static` or set `PENNY_EMBED_SHADOW_PROVIDER=static` to append a deterministic static embedding comparison for disposable candidate-survival measurement only.
Use `npm run eval:open-loop-compare` before considering local opt-in for `PENNY_ENABLE_OPEN_LOOP_PROMPT=1`. The bridge should stay bounded to one relevant advisory loop, and any adjacent-topic bleed, overclaim, recurring annoyance, or unacceptable prompt delta should keep it off for normal runs.
Use the bounded aliveness compare harness before considering local live-advisory opt-in for the combined aliveness stack. Trust regressions dominate wins: overclaim, stale-correction failure, candidate-only truth laundering, unsupported action/source claims, pressure folds, prompt bloat, latency regressions, environment failure, or dirty disposable cleanup should block adoption even if some replies feel more present.
Keep `PENNY_ENABLE_BOUNDED_INITIATIVE` and `PENNY_ENABLE_TURN_STATE_PROMPT` off by default unless a bounded aliveness artifact clears the relevant A9 stage. Fixture evidence proves shape and can support live-shadow review; live-isolated mock-route evidence can support live-advisory review; default enablement still needs repeated real compare passes, manual review, user controls, and current docs.
For automated QA, the standard baseline is Q6 chat/memory plus `google/gemma-4-e4b` tooling. Do not treat a Q8-class chat model or a dual-lane stress setup as the default unless that is the specific thing under test.
The QA/eval artifacts also carry a normalized trust summary (`pass`, `invalid`, `ambiguous`, `fallback`, `degraded`) so outside review can distinguish Penny-behavior failures from environment drift.
They also carry a compact `runIdentity` canary with the resolved models, loaded-model snapshot, execution-path facts, runtime-artifact version, semantic-readiness state, and fallback/degraded counters so harness drift is easier to spot before blaming Penny.
They also carry additive drift/fixation canaries such as first drift reason/turn, fixation repeat count, and whether the run recovered after drift. These are diagnostic facts derived from artifacts, not a thinking-quality score.

### Candidate-survival operator guide

Candidate survival QA shows retrieval-path evidence: whether the expected memory/source existed, whether it entered the raw candidate set, whether it passed eligibility gates, what rank it received, whether it was selected/rendered/held back, and why it ranked that way. It does not prove answer quality by itself.

Read failure modes as a pointer to the layer to inspect:

- `missing-from-raw`: inspect candidate discovery, lexical matching, semantic readiness, and archive seeding.
- `filtered-out`: inspect sensitivity and eligibility gates before touching ranking.
- `low-rank`: inspect scoring/ranking, exact anchors, source authority, and contradiction repair.
- `selected-not-rendered`: inspect prompt budget, render limits, and authority suppression.
- `wrong-authority-selected`: inspect stale advisory/current correction handling.
- `forbidden-rendered`: treat this as a trust-boundary bug.
- `answer-layer-failure`: retrieval worked; do not fix retrieval first.
- `no-failure`: retrieval path met the case expectation.

Non-goals are intentionally boring: candidate-survival trace is not PromptTruth; PromptTruth remains prompt-time rendered/candidate memory/research context; tool evidence remains separate; retrieved candidates are not canonical memory; candidate-only support is not verified answer truth; default prompt/rendered memory limits are unchanged; the default embedding provider is unchanged unless a later explicit slice changes it; runtime voice is unchanged.

Example interpretation:

```text
If the silver thermos candidate appears at raw rank 3 and selected=false because prompt limit is 2, the failure is low-rank/prompt-selection, not absent memory. Do not fix this by expanding PromptTruth or claiming Penny verified the detail.
```

For handoffs and outside review, use `npm run bundle:review` to build a filtered copy under `tmp/review-bundle/` without QA artifacts, local logs, or runtime debris.

The browser cache is not the source of truth for long-term memory.

## LM Studio notes

- Penny resolves the actually loaded LM Studio model instead of blindly trusting the configured pretty model id.
- Chat lane and tool lane have separate preferred models:
  - `PENNY_LMSTUDIO_CHAT_MODEL` defaults to `google/gemma-4-31b`
  - `PENNY_LMSTUDIO_TOOL_MODEL` defaults to `google/gemma-4-e4b`
- Chat-lane sampling is explicit and separate from tool/semantic-render settings:
  - `PENNY_LMSTUDIO_CHAT_TEMPERATURE` defaults to `1.0`
  - `PENNY_LMSTUDIO_CHAT_TOP_P` defaults to `0.95`
  - `PENNY_LMSTUDIO_CHAT_TOP_K` defaults to `64`
- Gemma runtime watch is observational only: status and eval artifacts can record vision-budget exposure, thinking-control availability/default-off state, prompt-cache/RAM risk, compatible loaded-model fallback, and chat sampling, but Penny does not enable thinking by default or raise context/vision budgets because those fields exist.
- Semantic memory uses a separate soft-dependency model:
  - `PENNY_LMSTUDIO_EMBED_MODEL` defaults to `text-embedding-nomic-embed-text-v1.5`
  - if that model is missing or unloaded, Penny falls back to keyword-style archive retrieval instead of failing chat
  - EmbeddingGemma is supported as a comparison candidate, but it is not the default; the embedding cache is model-aware so vectors from one embedding model are not reused in another model's vector space
  - static embedding support is a separate opt-in sidecar, not a replacement for the LM Studio embedding default
  - normal repo default is `PENNY_STATIC_EMBED_MODE=off` or QA-only shadow comparison; local experimental live mode is `PENNY_STATIC_EMBED_MODE=live-advisory`, with `PENNY_STATIC_EMBED_MAX_STATIC_ONLY_RENDERED` still enforcing the static-only render cap
- Archive retrieval scoring defaults to `PENNY_ARCHIVE_SCORING_PROFILE=baseline`.
  - `PENNY_ARCHIVE_SCORING_PROFILE=hybrid-v1` is an explicit gated profile for candidate ordering only
  - invalid or empty profile values fall back to `baseline`
  - `hybrid-v1` does not increase `SESSION_PROMPT_LIMIT`, `GLOBAL_PROMPT_LIMIT`, memory-book limits, or rendered archive counts
  - the profile gate does not change the embedding provider and does not expand `promptTruth` or `toolEvidenceReceipt`
- `PENNY_ENABLE_BACKGROUND_CHAT_VECTORS` defaults to on for bounded post-turn background vectorization of recent chat-history candidates. Set it to `0` to turn that shadow prewarm work off.
- `PENNY_BACKGROUND_CHAT_VECTOR_BATCH_LIMIT` defaults to `2` and caps that background vector work per archived turn.
- `npm run lmstudio:prepare` verifies local preset wiring, checks installed/loaded models, and tries to load the requested chat model for QA/startup flows.
- The settings-panel model picker is a chat-lane override only. Tool-lane selection is config-driven.
- The local `@local:penny` preset is operator-owned LM Studio state. Penny can verify and reassert the wiring, but the repo does not own the preset body.
- Depending on the loaded model, Penny may use native stateful chat, chat completions, or responses-style fallbacks.
- LM Studio `Context Length` still matters even though Penny chats through this app instead of the LM Studio UI. Penny still sends her prompt stack, recent conversation, and memory context into the loaded LM Studio runtime each turn, and the native stateful lane can preserve a live LM Studio thread across turns.
- Context pressure is recorded before it becomes doctrine. Fixture-only artifacts define short, medium, and long rendered-context shapes with nullable latency fields and candidate-survival correlation; fixture/unit correlation does not prove live answer quality, live answer drift still requires a real runtime-fit run against isolated disposable state, and fixture semantic readiness may be fixture-assumed.
- Image turns are intentionally attachment-bounded: Penny sends the current turn's image payload before the text part, and later text-only turns do not replay older image blobs back into LM Studio.
- Practical default on this machine is roughly `10k-12k` context for normal Penny use. Raising it helps with longer pasted inputs, longer live threads, and heavier prompt injection, but it also increases prompt-eval latency and memory pressure.
- `PENNY_CHAT_HISTORY_LIMIT` counts individual recent messages, not user/assistant pairs. The main chat path now defaults to `6`, while the shadow path keeps its own tighter handling.
- In Penny's UI, `New chat` creates a fresh Penny session and a fresh LM Studio thread context. `Clear memory` is the stronger reset if you also want to wipe the current session's saved memory state.
- Large local models can be slow, especially on first turn and on image turns.
- The max output token cap is a ceiling, not a target. Raising it prevents clipping; it does not force Penny to ramble if the model naturally stops earlier.
- An in-app local embedding path was considered and intentionally deferred. This cycle uses LM Studio embeddings only, with graceful fallback when they are unavailable.

## Shadow mode

- `PENNY_OPENCLAW_ENABLED=1` enables the optional shadow lane.
- LM Studio remains Penny's main chat brain.
- Shadow mode should stay parked unless it proves a real capability win.

See [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md) for the current verdict.

## Local security posture

This is a single-user local prototype. Treat it that way:

- keep it bound to local/private use
- do not expose the raw server to the public internet
- be careful with tool-enabled routes, because this app can inspect and edit project files by design

## Known limits

- `server.js` is still too large and still owns too many subsystems, even after the lane/status/transport/tool extractions.
- `public/js/penny-app.js` is still large and stateful even though `public/app.js` is now just bootstrap glue.
- Local 31B models can be painfully slow on commodity hardware, especially for image turns and long generations.
- The docs are more honest than the codebase is modular, which is useful but also a trap if you stop there.

## Source material vs runtime assets

Use this hierarchy:

1. Runtime behavior
  `server.js`, `public/*`, `penny-voice/runtime/*`
2. Operational docs
  `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, eval docs
3. Canon/source material
  `Penny's Playground/*`, raw `Personality *.md`, distilled sidecars

Do not load the giant raw personality files into normal runtime prompt context unless you are doing deliberate refinement work.
