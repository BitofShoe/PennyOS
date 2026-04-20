# Penny PromptTruth Contract

> Category: Engineering law
> Authority: Binding/current law
> Status: Current
> Use this for: prompt-time context receipts, rendered-vs-candidate truth, holdback semantics, and naming rules around prompt visibility.
> Do not use this for: answer-quality judgment, voice evaluation, provenance replacement, or post-turn continuity outcomes.

- `promptTruth` is Penny's prompt-time receipt of prompt-context authority.
- Its job is narrow: tell the truth about what context was actually allowed to influence the live model request for a turn.
- `promptTruth` is not an eval score, not a proof that the answer was correct, not a voice-quality rubric, and not a replacement for provenance, traces, or tests.
- Prompt assembly is the source of truth for `promptTruth`. Compatibility summaries, inspector prose, and QA witness language must derive from the rendered receipt, not the reverse.

## Governance role

- In Penny, prompt construction is an authority-governed admission step, not just string building.
- Prompt assembly decides which context is allowed to influence the turn, which weaker context is suppressed by stronger authority, and which candidate context never becomes prompt-visible.
- `promptTruth` is therefore an accountability object, not just a debug log. It exists so later artifact layers can say what was admitted, held back, or absent without flattering the runtime.
- In current Penny law, `promptTruth` governs prompt-context authority for the memory/research side of prompt assembly, while `promptComposition` governs slot eligibility, lane gating, fill state, and slot-level holdback for the broader stack.

## State distinctions

- Stored context is not the same thing as prompt context. A fact can exist in explicit memory, archive memory, a memory book, or the research ledger without appearing in `promptTruth` at all.
- Penny must distinguish selection from rendering. In the current receipt shape, pre-render selection is represented by `candidateCount` and `candidateSourceIds`, while actual prompt inclusion is represented by `renderedCount` and `renderedSourceIds`.
- Penny must distinguish rendered context from held-back context. If a source was selected but suppressed before the live request, that suppression belongs in `heldBackReason`.
- Penny should distinguish deliberately held-back context from merely absent context. A zero-candidate channel is not the same thing as a held-back channel.
- Penny must distinguish prompt-time context from post-reply mutation. Post-turn research continuity changes belong in `researchLedgerUpdate`, not in `promptTruth`.

## Naming rules

- A source must not be described as injected, used, rendered, prompt-visible, or prompt-present unless its text or structured representation actually entered the live model request.
- A source may be described as candidate, selected, considered, or prompt-eligible when it was evaluated during prompt construction but not necessarily rendered.
- If a source appears under `candidateSourceIds` but not under `renderedSourceIds`, it was not prompt-visible for that turn.
- If a channel has `candidateCount > 0` and `renderedCount = 0`, summaries must describe that channel as held back or not rendered. They must not imply silent support.

## Current receipt shape

`promptTruth` currently records:

- top-level `schema` marker, currently `penny-prompttruth.v1`
- top-level flags `canonicalFactsPresent` and `canonicalOverrideActive`
- per-channel receipts for `stableFacts`, `memoryBooks`, `sessionArchive`, `globalArchive`, and `researchLedger`
- per-channel `state` using the bounded vocabulary `rendered`, `held_back`, `candidate`, `no_candidate`, `ineligible`, `disabled`, `unknown`, with `unavailable` reserved for future code that can prove it honestly
- per-channel `candidateCount`, `renderedCount`, `candidateSourceIds`, `renderedSourceIds`, and `heldBackReason`
- In current Penny law, `stableFacts` represents canonical explicit-memory prompt context, while `memoryBooks`, `sessionArchive`, `globalArchive`, and `researchLedger` are advisory channels.
- In current Penny law, `researchLedgerRendered` is the canonical rendered-name boolean for whether research-ledger context actually rendered into the live prompt.
- In current Penny law, `researchLedgerPromptInjected` may only mean the same thing as `researchLedgerRendered`, which in turn may only mean that `promptTruth.channels.researchLedger.renderedCount > 0`.
- In current Penny law, retrieval-trace `rendered` and `authorityPressure.advisoryChannelsRendered` / `advisoryItemsRendered` are the canonical rendered-name compatibility surfaces for prompt-visible advisory context.
- In current Penny law, retrieval-trace `injected`, `authorityPressure.advisoryChannelsInjected` / `advisoryItemsInjected`, and QA compare `promptInjectedCases` remain compatibility aliases for those rendered-name fields. They must not be narrated as broader selection state.

## Holdback rules

- `heldBackReason` means selected context was intentionally suppressed after selection and before the live model request.
- Current live holdback reasons include `canon-priority-suppression` and `ledger-prompt-disabled`.
- New holdback reason codes are allowed only if they stay explicit, bounded, and truthful at artifact and inspector surfaces.
- Human-readable wording may prettify a holdback reason, but it must not change the underlying meaning.

## Current limits

- Penny does not currently emit a live per-channel `unavailable` or `excluded-before-candidate` receipt. Those states remain deferred until runtime code can prove them honestly.
- `unknown` is required when zero-candidate state cannot be justified from real runtime context. Zero counts alone are not enough to infer `no_candidate`.
- In current live code, `ineligible` is only proven for archive channels when the turn never ran archive recall, and `disabled` is only proven for the prompt-disabled research-ledger channel.
- Penny does not currently store turn metadata like `turnId`, `promptBuiltAt`, `lane`, or `model` inside `promptTruth` itself. Those belong to the surrounding runtime artifact.
- Penny does not currently store `postReplyUpdates` inside `promptTruth`. Post-turn archive and ledger outcomes belong to `sideEffects`, `recentAuditTrail`, and `researchLedgerUpdate`.
- Penny does not currently treat verified tool evidence as a first-class `promptTruth` channel. Tool evidence belongs to artifact evidence/provenance surfaces unless that evidence was also literally rendered into the prompt.
- Penny does not currently store rendered-only IDs inside `recentAuditTrail.retrieval.selected*Ids`. Those audit fields are candidate-selection summaries, not prompt-visibility receipts.
- Penny now stores additive rendered-only audit identity fields alongside those candidate summaries: `renderedSessionIds`, `renderedGlobalIds`, `renderedBookIds`, and `renderedLedgerIds`. These are prompt-visibility receipts; they must not be inferred from broader retrieval payloads.

## Deferred v2 hooks

- This section is non-binding. It records future-plan seams without promoting them into current law.
- If runtime code begins to distinguish `unavailable` from `excluded-before-candidate`, a future `promptTruth` revision may add explicit receipt states or bounded exclusion reasons for those cases.
- If Penny ever renders verified tool evidence into the live prompt as its own truth-bearing channel, a future `promptTruth` revision may add a first-class rendered tool-evidence receipt instead of inferring that state from provenance.
- Future audit revisions may extend the additive rendered-ID receipt beyond `renderedSessionIds`, `renderedGlobalIds`, `renderedBookIds`, and `renderedLedgerIds`, but they should keep `selected*Ids` as candidate continuity rather than reinterpreting them.
- If compatibility consumers can migrate cleanly, a future versioned cleanup pass may remove old aliases such as `researchLedgerPromptInjected`, retrieval-trace `injected`, `authorityPressure.*Injected`, and QA compare `promptInjectedCases` after the rendered-name fields have become the only canonical terms in code, inspector, QA, and docs.
- If turn-level receipt metadata becomes necessary, a future revision may add an outer PromptTruth envelope for fields like turn, lane, build time, and model instead of overloading per-channel rows.

## Boundaries

- `promptTruth` does not explain the entire answer.
- `promptTruth` does not prove the final answer was correct, emotionally appropriate, well-written, or fully grounded.
- `promptTruth` does not replace `promptComposition`. Slot eligibility and stack-slot holdback for `voiceBlend`, `directives`, `overlays`, `examples`, and the `memory` block belong to `promptComposition`.
- `promptTruth` does not replace runtime evidence or provenance. Verified tool evidence belongs in the artifact `authority`, `evidence`, `trace`, and `provenance` surfaces unless that evidence was also literally rendered into the prompt.
- `promptTruth` does not replace `researchLedgerUpdate`, which records post-reply continuity mutation rather than prompt-time influence.

The strength of `promptTruth` is its narrowness: it tells the truth about prompt context and does not pretend to govern everything else.
