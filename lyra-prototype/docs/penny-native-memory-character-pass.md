# Penny Native Memory and Character Pass

This note captures the accepted Agnai and RisuAI concepts for Penny, the ideas we are explicitly rejecting, and the guardrails future agents should keep in view.

## What We Kept

- `Scoped memory books`: a small, inspectable middle layer between canonical explicit memory and archive recall.
- `Prompt-slot registry`: fixed prompt order and lane-aware overlays so authored Penny voice stays in control.
- `Long-session compression fallback`: a backup path for weak retrieval, missing embeddings, or very long sessions.
- `Expression pack manifest`: modular mood-to-asset mapping that keeps Penny's current character visuals, but makes them easier to extend.

## What We Rejected

- Open-ended prompt DSLs or scripting surfaces.
- Broad plugin ecosystems.
- Full lorebook / world-info platforms that would turn Penny into generic feature soup.
- Multi-user or platform-first assumptions.
- Direct code copying from Agnai or RisuAI.

## Why These Fit Penny

- They reinforce Penny's authored identity instead of flattening it.
- They stay compatible with the existing hybrid memory branch and LM Studio dual-lane setup.
- They improve continuity, presentation, and recall without demanding a full subsystem transplant.
- They keep memory inspectable and bounded rather than mystical or unbounded.

## Guardrails

- Explicit memory in `data/penny-memory.json` stays canonical.
- Archive memory remains additive and review-gated.
- Memory books must not mutate canonical memory or promotion queues.
- Prompt overlays stay finite, authored, and lane-aware.
- Compression is a fallback, not Penny's primary memory strategy.
- Expression packs may change presentation, but not the backend mood contract.

## Recommended Build Order

1. Prompt-slot registry and lane-aware overlays.
2. Scoped memory books with provenance and caps.
3. Long-session compression fallback for weak retrieval and oversized sessions.
4. Expression pack manifest with safe defaults.

## Source Links

- [Agnai official site](https://agnai.chat/)
- [Agnai GitHub README](https://github.com/agnaistic/agnai)
- [Agnai license](https://github.com/agnaistic/agnai/blob/dev/LICENSE.md)
- [Agnai memory books](https://agnai.guide/docs/memory/memory-books.html)
- [Agnai embeddings](https://agnai.guide/docs/memory/embeddings.html)
- [RisuAI official site](https://risuai.net/)
- [RisuAI GitHub README](https://github.com/kwaroran/RisuAI)
- [RisuAI license](https://github.com/kwaroran/RisuAI/blob/main/LICENSE)
- [RisuAI Lorebook wiki](https://github.com/kwaroran/RisuAI/wiki/Lorebook)
- [RisuAI SupaMemory wiki](https://github.com/kwaroran/RisuAI/wiki/SupaMemory)
- [RisuAI @ Syntaxes wiki](https://github.com/kwaroran/RisuAI/wiki/%40-Syntaxes)
- [RisuAI Curly Brased Syntaxes wiki](https://github.com/kwaroran/RisuAI/wiki/Curly-Brased-Syntaxes)

## What To Verify Later

- The inspector can explain why a memory book matched and what got injected.
- Compression only appears when retrieval confidence or session size justifies it.
- Mood assets still render the same visible Penny states when the manifest is missing or partial.
- New prompts keep Penny feeling authored, not generic.
- Nothing in the new layers increases prompt bloat or creates hidden continuity drift.
