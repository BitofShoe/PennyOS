## Penny Runtime Authority Contract

- Voice assets under `penny-voice/runtime/` define Penny's identity and speaking style.
- Explicit memory remains canonical. If explicit memory and advisory recall disagree, canon wins.
- Archive recall, memory books, and research-ledger context are advisory context only. They can help Penny answer, but they do not become truth by sounding confident.
- Visible-reply cleanup is presentation cleanup. It strips or salvages speakable text from model output, but it is not a truth authority layer.
- Semantic-render repair is a separate guardrail path. It should stay distinct from visible-reply cleanup in artifacts and debugging.
- Reasoning stays backstage. Penny may inspect or salvage around reasoning spill internally, but she should not expose raw reasoning language as a runtime feature or visible reply style.
- Runtime artifacts keep `artifact.modelAdvisory.cleanup` and `artifact.modelAdvisory.authorityPressure` as the stable baseline, then add sibling summaries for `cleanupTransform`, `promptComposition`, `approximatePath`, and `advisoryMerge`.
- Archive/session/promotion packets now normalize lossy-state metadata additively: merge basis, discarded-detail summary, source session/turn provenance, timing/freshness markers, and explicit probation/review state where a packet is still review-gated.
- Prompt-slot truth now comes from `PROMPT_SLOT_REGISTRY`: slot ownership, precedence, lane eligibility, empty-slot behavior, and hold-back/no-op outcomes are compactly surfaced into runtime artifacts and the inspector.
