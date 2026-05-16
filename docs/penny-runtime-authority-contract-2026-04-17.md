# Penny Runtime Authority Contract

> Category: Engineering law
> Authority: Binding/current law
> Status: Current
> Use this for: runtime authority, memory precedence, prompt-truth semantics, and advisory-vs-canonical rules.
> Do not use this for: project history, public explanation, or future planning.

For the narrow prompt-time receipt law, use [penny-prompttruth-contract-2026-04-19.md](./penny-prompttruth-contract-2026-04-19.md).

- Voice assets under `penny-voice/runtime/` define Penny's identity and speaking style.
- Explicit memory remains canonical. If explicit memory and advisory recall disagree, canon wins.
- Archive recall, memory books, and research-ledger context are advisory context only. They can help Penny answer, but they do not become truth by sounding confident.
- Visible-reply cleanup is presentation cleanup. It strips or salvages speakable text from model output, but it is not a truth authority layer.
- Semantic-render repair is a separate guardrail path. It should stay distinct from visible-reply cleanup in artifacts and debugging.
- Reasoning stays backstage. Penny may inspect or salvage around reasoning spill internally, but she should not expose raw reasoning language as a runtime feature or visible reply style.
- Penny Frame Budget Principle: every turn has a runtime/context frame budget. Spend it first on relevance, source authority, and candidate selection before spending it on more rendered context; faster runtime should make Penny more selective and more situated, not merely more verbose or more stuffed with memory. This principle does not expand PromptTruth, merge `toolEvidenceReceipt`, change runtime voice, raise default prompt/rendered-memory limits, make frame-budget artifacts answer-quality proof, or broaden `server.js`.
- Runtime artifacts keep `artifact.modelAdvisory.cleanup` and `artifact.modelAdvisory.authorityPressure` as the stable baseline, then add sibling summaries for `cleanupTransform`, `promptComposition`, `promptTruth`, `toolEvidenceReceipt`, `reasoningPolicy`, `approximatePath`, and `advisoryMerge`.
- Archive/session/promotion packets now normalize lossy-state metadata additively: merge basis, discarded-detail summary, source session/turn provenance, timing/freshness markers, and explicit probation/review state where a packet is still review-gated.
- Prompt-slot truth now comes from `PROMPT_SLOT_REGISTRY`: slot ownership, precedence, lane eligibility, empty-slot behavior, and hold-back/no-op outcomes are compactly surfaced into runtime artifacts and the inspector.
- `promptTruth` is now the literal prompt-time receipt for advisory usage. It records per-channel state plus candidate vs rendered counts/source ids and any holdback reason for `stableFacts`, `memoryBooks`, `sessionArchive`, `globalArchive`, and `researchLedger`.
- `promptTruth` now also carries a lightweight schema marker, currently `promptTruth.schema = "penny-prompttruth.v1"`. This marks the receipt shape only; it is not a standalone turn envelope and does not replace runtime-artifact versioning.
- `toolEvidenceReceipt` is a sibling runtime-artifact receipt at `artifact.toolEvidenceReceipt`. It is not a PromptTruth channel. It records explicit tool-path source facts such as deterministic-only use, provenance-only use, prompt-visible raw JSON, prompt-visible auto-verification JSON, summarized write-rescue context, and summarized semantic-render context.
- Old artifacts that never recorded `toolEvidenceReceipt` remain valid and normalize to `null`; Penny must not backfill them with synthetic `unknown` receipt items just because `executionPath`, `modelUsed`, or generic tool records exist.
- `researchLedgerRendered` is now the canonical rendered-name boolean for whether research-ledger content actually rendered into the prompt.
- `researchLedgerPromptInjected` remains for compatibility, but it now means exactly the same thing as `researchLedgerRendered`, not merely selected-before-the-turn ledger context.
- Retrieval-trace `rendered` plus `authorityPressure.advisoryChannelsRendered` / `advisoryItemsRendered` are now the canonical rendered-name fields for prompt-visible advisory context.
- Retrieval-trace `injected` plus `authorityPressure.advisoryChannelsInjected` / `advisoryItemsInjected` remain compatibility aliases, but they count rendered prompt context only.
- QA compare traces now serialize additive `promptRenderedCases` / `promptNotRenderedCases` counts while keeping `promptInjectedCases` / `promptHeldCases` as compatibility aliases.
- Authority-pressure, advisory-merge, retrieval-trace rendered/not-rendered compatibility fields, QA witness traces, and inspector summaries should be derived from rendered `promptTruth` receipts only. Post-reply ledger mutation belongs in `researchLedgerUpdate`, not in prompt-use receipts.
- `server.js` no longer owns a standalone semantic read of PromptTruth. It forwards `promptTruth`, and compatibility booleans such as `researchLedgerPromptInjected` are derived downstream from shared PromptTruth readers.
- Canon-question handling is now shared across latency policy, prompt/history suppression, and memory-state writes so natural questions like "What tea do I like again?" still take the canon-first path.
- That canon-question detector now covers broader personal recall shapes such as "What color is my..." and "Where is my...", but it is still gated by question phrasing, possessive framing, and explicit-memory overlap so repo/file questions do not get misclassified as personal canon recall.
- Research-ledger topics now carry additive question-scoped identity metadata: `identity.kind`, `identity.anchorType`, `identity.anchorRef`, `identity.scopeKey`, and `identity.scopeLabel`. The ledger can keep multiple distinct questions about the same repo anchor without overwriting them into one file-scoped row.
- Research-ledger topics also carry additive truth metadata: `sourceClass`, `summaryClass`, and `summaryEvidenceRefs`. Settled non-contradiction topics require verified non-`query` evidence plus an evidence-tight summary; otherwise they remain `provisional`, keep `conclusion` empty, and fall back to the question or open follow-up instead of durable assistant synthesis.
- Human-readable artifact summary text and wake-hierarchy prose must be derived from rendered `promptTruth` counts plus holdback reasons. If advisory channels rendered zero items, the prose must say they were held back or not rendered; it must not imply they supported the reply.
- `reasoningPolicy` is a bounded execution receipt, not exposed chain-of-thought. It may say a turn was `minimal`, `deliberate`, `verifier-first`, or `attachment-bounded`, whether verifier-style evidence was used, and whether the runtime short-circuited early.
- Session archive buckets now keep a bounded `recentAuditTrail` of compact turn slices. Each slice freezes prompt-time/runtime-turn truth before post-turn ledger mutation and carries compact retrieval ids, per-channel prompt-truth counts/holdbacks, artifact summary, and post-turn ledger update status. `lastRetrieval` stays for compatibility but now carries the same compact summary so the two views stay aligned.
- In that compact audit summary, `selected*Ids` remain candidate-selection continuity fields by contract. Additive `renderedSessionIds`, `renderedGlobalIds`, `renderedBookIds`, and `renderedLedgerIds` are the prompt-visible identity receipt for what actually rendered.
- QA trace payloads now carry an additive `runIdentity` block with run mode/segment, resolved chat/tool/embed models, loaded-model snapshot, execution-path facts, runtime-artifact version, semantic-readiness state, max output tokens, and degraded/fallback counters. This is a harness-drift canary, not a new runtime authority layer.
- QA trace payloads also carry additive drift/fixation canaries such as first drift reason/turn, fixation repeat count, and recovered-after-drift. These are diagnostic facts derived from artifacts and scenario progression, not confidence scores.
