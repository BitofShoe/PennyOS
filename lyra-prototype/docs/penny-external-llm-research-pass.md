# Penny External LLM Research Pass

> Canonical note: the main consolidated entrypoint is [docs/penny-research-master-synthesis-2026-04-16.md](./penny-research-master-synthesis-2026-04-16.md). Keep this file as cited source material, not the primary front door.
>
> Newer frontier-prompt-specific follow-through lives in [docs/penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md](./penny-cl4ritas-frontier-prompt-lessons-2026-04-20.md). Use that note when the question is about prompt layering, runtime-voice follow-through, or what to borrow structurally from frontier prompt stacks without importing their bulk.

This note consolidates the recent external research sweep into a Penny-native decision document.

Scope is intentionally locked to `Action + Watchlist`:

- actionable ideas Penny can absorb soon without changing her identity or stack
- medium-term runtime and model watchlist items that are interesting but not yet justified
- hard rejects that would push Penny toward generic platform sprawl, hidden self-modification, or backend churn without a clear product win

This is a clean-room synthesis. The linked material is being used as design and engineering reference, not as copied code or copied prompt text.

## Executive Verdict

The strongest cross-source lesson is simple: structure beats raw context length.

Penny gets the most value from:

1. `Contradiction-aware external memory`
2. `Compact prompt layering and mode separation`
3. `Stronger QA for long-session drift, repetition, and truth replacement`

The weakest fit is the flashy material:

- decentralized training
- self-modifying memory systems
- copied giant system prompts
- generic MCP/plugin platform ambitions
- backend-specific inference tricks that do not fit today's Windows + LM Studio path

The practical product stance should stay the same:

- Penny remains `memory-first`, not `training-first`
- Penny remains `inference-first`, not `research-lab-first`
- prompt layering should stay explicit, compact, and Penny-authored
- runtime speedups only matter if they improve Penny's actual long-session latency on the current stack

## Adopt Soon

| Rank | Recommendation | Penny Fit | Complexity | Backend Risk | Product Value | Why It Fits |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Contradiction-aware memory provenance | Very high | Medium | Low | Very high | Best match to the reasoning/forgetting research and Penny's existing hybrid memory design |
| 2 | Prompt layering and mode separation | Very high | Low-medium | Low | High | Reinforces Penny's authored identity while improving control and evalability |
| 3 | Compression fallback tightening | High | Medium | Low | High | Refines an existing weak point instead of inventing a new subsystem |
| 4 | QA for contradictions, repetition, and long-session drift | Very high | Medium | Low | High | Converts research claims into measurable regression protection |

### 1. Contradiction-Aware Memory Provenance

What to take:

- Treat premise changes as first-class memory events, not just new transcript text.
- Track `old value -> new value` explicitly when stable facts or working assumptions change.
- Preserve dependency-aware provenance so Penny can distinguish:
  - the current truth
  - the older truth
  - what downstream details may now be stale

Why this matters:

- The Reddit catastrophic-forgetting thread and the Zenodo structural-persistence notes all point toward the same pattern: contradictions and premise drift damage reasoning when they are left mixed together.
- Zenodo `19584698` is especially relevant because it reports better logical consistency when contradictory updates are externally organized instead of left to the model to sort out.
- Zenodo `19584998` is a useful warning that naive sequential adaptation behaves more like overwrite than clean accumulation.

How it applies to Penny:

- This should extend the current hybrid memory seams in `lib/penny-memory.js` and `lib/penny-memory-archive.js`.
- The right shape is not "more memory." The right shape is "better bookkeeping."
- Penny should be able to say, internally and inspectably, "this used to be true, this is true now, and these older episode details may be attached to the previous premise."

Guardrails:

- Do not turn this into a full knowledge-graph project.
- Do not silently mutate canonical explicit memory without provenance.
- Do not let archive inference overwrite explicit facts just because it sounds coherent.

### 2. Prompt Layering and Mode Separation

What to take:

- Keep prompt layers explicit by job:
  - authored identity and runtime voice
  - lane or mode overlays
  - tool policy
  - memory injection
  - current turn
- Keep mode switches small, stable, and measurable.
- Use structure from frontier prompt stacks as inspiration, not wording.

Why this matters:

- The SmolLM3 writeup shows that explicit interface design matters: reasoning mode, non-reasoning mode, and tool schemas are deliberate parts of the chat template.
- The LocalLLM system-prompt thread is strongest when it argues that local models often lack a real operating manual, not when it argues for giant prompt dumps.
- The `x1xhlol/system-prompts-and-models-of-ai-tools` repo is useful as a pattern archive because it makes layering visible: identity, metadata, tool-use rules, and process rules are distinct.

How it applies to Penny:

- Extend the current `lib/penny-prompt-stack.js` approach rather than replacing it.
- Keep Penny's runtime voice and mode behavior authored and compact.
- Prefer a small number of explicit mode boundaries over giant catch-all prompt blobs.

Guardrails:

- Do not cargo-cult leaked prompts.
- Do not let operational rules flatten Penny into a generic coding assistant.
- Do not bloat the prompt stack unless evals show the added tokens are paying for themselves.

### 3. Compression Fallback Tightening

What to take:

- Refine chapter and fallback summaries so they privilege:
  - concrete nouns
  - scene anchors
  - durable personal details
  - premise changes
- Down-rank repeated scaffolding, format instructions, and generic interaction patterns.

Why this matters:

- The memory research argues for explicit structure over mixed, noisy context.
- Our own QA already shows the current fallback works, but can keep the scene family while dropping one of the target details.
- This is exactly the kind of place where "more compression" is not the answer; better selection is.

How it applies to Penny:

- This is a refinement of the existing chapter/compression path in `lib/penny-memory-archive.js`.
- It should stay a fallback path, not become Penny's primary memory strategy.
- The goal is not abstract semantic vibe. The goal is higher-fidelity recall under stress.

Guardrails:

- Do not invent a new parallel memory subsystem.
- Do not let fallback summaries become generic narration.
- Keep the inspector explanation path intact so future agents can see why compressed context was chosen.

### 4. QA for Contradictions, Repetition, and Long-Session Drift

What to take:

- Add targeted eval scenarios for:
  - stable fact replacement
  - contradiction resolution
  - long-session drift
  - repeated catchphrases and pet insults
  - context-budget regressions
- Score for coherence and truth replacement, not just "did Penny answer."

Why this matters:

- Several of the research sources are best read as eval warnings, not as implementation recipes.
- The "how much do models memorize?" paper is a reminder that memory is finite and selective.
- The system-prompt discussion is right that prompt quality must be benchmarked, not argued about by vibe alone.

How it applies to Penny:

- Extend the current QA/eval seams in:
  - `scripts/qa-penny-memory.js`
  - `scripts/qa-penny-voice-redo.js`
  - `scripts/eval-penny-models.js`
- Add scenarios where Penny must preserve the new truth without hallucinating the old truth away.
- Add repetition scoring for catchphrase drift like overused teasing labels.

Guardrails:

- Keep QA aligned to Penny's real runtime and real prompt stack.
- Do not reduce voice QA to sterile factual probes.
- Avoid benchmark theater where the harness stops matching live use.

## Watchlist

These ideas are worth tracking, but they should not enter the active Penny backlog without a clear gate.

| Item | Current Fit | Gate | Why It Stays a Watchlist Item |
| --- | --- | --- | --- |
| Prefix/KV reuse and cache persistence | Medium | Only pursue if Penny-specific traces show clear TTFT wins on long, memory-heavy chats | Interesting for latency, but backend-specific and not yet aligned to current LM Studio control surfaces |
| Speculative decoding | Medium-low | Only pursue if Penny moves beyond today's Windows + LM Studio path | DFlash-style gains are real, but mostly backend/runtime work and not prompt/memory work |
| MoE hot-expert caching | Low | Only pursue if Penny adopts a MoE-oriented backend where expert offload is a real bottleneck | The ParmesanParty fork is clever, but highly specific and CUDA/MoE-centric |
| Training/model-lab papers | Low for app work | Keep in a future model-pack or benchmarking bucket only | Important if Penny ever trains or merges models, not for the current app layer |

### Prefix/KV Reuse and Cache Persistence

Why it is interesting:

- oMLX and TurboQuant-style discussion both point at cache pressure as a real long-context bottleneck.
- Penny's latency logs already show prompt evaluation is often more painful than generation.

Why it is not active work yet:

- Today's repo has strong LM Studio abstractions, but not fine-grained cache-control ownership.
- Penny should not take a backend dependency leap just because a runtime paper sounds fast.

### Speculative Decoding

Why it is interesting:

- DFlash-style draft-and-verify strategies can materially improve decode throughput.

Why it is not active work yet:

- The practical implementations in this sweep are Apple/MLX-facing or otherwise runtime-specific.
- The research helps the infra lane more than the product lane.

### MoE Hot-Expert Caching

Why it is interesting:

- The ParmesanParty `llama.cpp` fork is a strong example of targeted runtime engineering for sparse expert models that do not fit cleanly in VRAM.

Why it is not active work yet:

- Penny does not currently own that backend surface.
- This is a model-runtime optimization, not a memory or identity improvement.

### Training / Model-Lab Papers

Papers to keep in the watch bucket:

- [INT v.s. FP: A Comprehensive Study of Fine-Grained Low-bit Quantization Formats](https://arxiv.org/abs/2510.25602)
- [Pretraining Large Language Models with NVFP4](https://arxiv.org/abs/2509.25149)
- [Unbiased Gradient Low-Rank Projection](https://arxiv.org/abs/2510.17802)
- [NoLoCo: No-all-reduce Low Communication Training Method for Large Models](https://arxiv.org/abs/2506.10911)
- [No Need to Talk: Asynchronous Mixture of Language Models](https://arxiv.org/abs/2410.03529)
- [MergeME: Model Merging Techniques for Homogeneous and Heterogeneous MoEs](https://arxiv.org/abs/2502.00997)

Why they stay out of the app backlog:

- They inform future runtime procurement, benchmarking, and model-pack decisions.
- They do not justify changing Penny's application architecture today.

## Reject

These are the wrong next moves for Penny.

### Decentralized or Federated Training

Reject because:

- Penny is explicitly a single-user local companion.
- Distributed training and peer-style schemes solve a different problem than the one Penny has.
- They add coordination and infrastructure complexity without helping Penny's authored identity or inspectable memory.

### Naive Continual LoRA / Adaptor Updates as Memory

Reject because:

- The Zenodo continual-learning note suggests overwrite-like behavior and dependent-collapse problems.
- Penny's memory needs to stay readable, auditable, and reviewable.
- Weight updates are not a substitute for durable companion memory.

### LLM-Managed Self-Improvement Databases

Reject because:

- The MCP/self-learning-memory discussion is most useful as a warning: letting the model manage its own store tends to inject noise and invented detail.
- Penny's architecture should own the memory database and promotion rules.
- Human-readable memory and inspector provenance are core product values here.

### Blindly Copied Leaked System Prompts

Reject because:

- Structure is transferable; wording usually is not.
- Copying giant product-specific prompts would import assumptions that do not fit Penny's tone or runtime constraints.
- This is the fastest way to make Penny feel generic, derivative, and bloated.

### Generic MCP / Plugin Ecosystems or Broad RAG / Lorebook Platforming

Reject because:

- Penny is not trying to become a general assistant platform.
- Generic plugin and lorebook sprawl would fight the current bounded memory and authored-character design.
- Broad platforming is exactly how Penny would turn into feature soup.

## Repo Touchpoints

The useful research ideas already have obvious landing zones in the repo.

### Memory and Provenance

- `lib/penny-memory.js`
- `lib/penny-memory-archive.js`

These are the right seams for contradiction-aware provenance, premise replacement notes, and compression-fallback tightening.

### Prompt Assembly

- `lib/penny-prompt-stack.js`
- `penny-voice/runtime/`

These are the right seams for prompt layering, lane-aware mode separation, and compact authored control surfaces.

### Runtime Constraints

- `lib/penny-lmstudio-status.js`
- `lib/penny-lmstudio-transports.js`

These are the right seams for evaluating future runtime-watchlist ideas without pretending Penny owns the entire backend stack today.

### QA and Eval

- `scripts/qa-penny-memory.js`
- `scripts/qa-penny-voice-redo.js`
- `scripts/eval-penny-models.js`

These are the right seams for contradiction, repetition, long-session, and context-budget regression coverage.

## Follow-On Backlog

This is the short backlog that should later become its own implementation plan.

1. Add contradiction-aware provenance notes to the hybrid memory model.
2. Tighten chapter/fallback summarization toward concrete detail retention.
3. Add QA scenarios for truth replacement, contradiction handling, and long-session drift.
4. Add repetition metrics for catchphrases and recurring pet-insult drift.
5. Review the current prompt stack for small, explicit mode-control improvements without growing token bloat.
6. Keep a separate infra note for cache/prefix/speculative-decoding watch items instead of mixing them into the product backlog.

## Implementation Note

The first follow-on hardening pass has now started landing in the repo.

The implemented direction matches this note's original recommendation set:

- contradiction-aware provenance stays external and inspectable
- prompt layering stays compact and lane-aware
- compression fallback is being tightened rather than replaced
- QA is being expanded around contradiction handling, repetition, and long-session drift

The important thing future agents should preserve is the framing:

- this is still a Penny-native refinement of existing subsystems
- it is not a justification for weight-updating memory, giant prompt imports, or backend churn

## Source Appendix

### Reasoning / Memory Degradation

- [Reddit: The decline in LLM reasoning and catastrophic forgetting might share the same root cause](https://www.reddit.com/r/LocalLLaMA/comments/1slv4ez/the_decline_in_llm_reasoning_and_catastrophic/)
- [Zenodo 19584667](https://zenodo.org/records/19584667)
- [Zenodo 19584698](https://zenodo.org/records/19584698)
- [Zenodo 19584998](https://zenodo.org/records/19584998)
- [How much do language models memorize?](https://arxiv.org/abs/2505.24832)

### Prompting / Control Plane

- [SmolLM3](https://huggingface.co/blog/smollm3)
- [LocalLLM system prompts thread](https://www.reddit.com/r/LocalLLM/comments/1skwxr0/system_prompts_the_missing_link_for_local_llms/)
- [x1xhlol/system-prompts-and-models-of-ai-tools](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools)

### Runtime / Performance Watchlist

- [Reddit: Hot Experts in your VRAM! Dynamic expert cache in llama.cpp](https://www.reddit.com/r/LocalLLaMA/comments/1slue0z/hot_experts_in_your_vram_dynamic_expert_cache_in/)
- [ParmesanParty/llama.cpp](https://github.com/ParmesanParty/llama.cpp)
- [Reddit: DFlash Doubles the T/S Gen Speed of Qwen3.5 27B](https://www.reddit.com/r/LocalLLaMA/comments/1sltncp/dflash_doubles_the_ts_gen_speed_of_qwen35_27b/)
- [dflash-mlx](https://github.com/bstnxbt/dflash-mlx)
- [oMLX](https://omlx.ai/)
- [Reddit: About TurboQuant](https://www.reddit.com/r/LocalLLaMA/comments/1sjrnlq/about_turboquant/)

### Self-Improvement / Decentralization Caveats

- [MCP self-learning memory thread](https://www.reddit.com/r/LocalLLaMA/comments/1slsp4j/can_mcps_make_local_llms_smarter_with_self/)
- [Decentralized training thread](https://www.reddit.com/r/LocalLLaMA/comments/1slr5bt/any_there_any_realistic_avenues_to_decentralised/)

### Future Model-Lab / Benchmarking Watchlist

- [INT v.s. FP: A Comprehensive Study of Fine-Grained Low-bit Quantization Formats](https://arxiv.org/abs/2510.25602)
- [Pretraining Large Language Models with NVFP4](https://arxiv.org/abs/2509.25149)
- [Unbiased Gradient Low-Rank Projection](https://arxiv.org/abs/2510.17802)
- [NoLoCo: No-all-reduce Low Communication Training Method for Large Models](https://arxiv.org/abs/2506.10911)
- [No Need to Talk: Asynchronous Mixture of Language Models](https://arxiv.org/abs/2410.03529)
- [MergeME: Model Merging Techniques for Homogeneous and Heterogeneous MoEs](https://arxiv.org/abs/2502.00997)

## Assumptions

- Scope is intentionally locked to `Action + Watchlist`.
- This pass is a research synthesis note, not a backend swap and not a code change proposal by itself.
- Penny remains a `single-user`, `local`, `LM Studio`-backed companion during this pass.
- All useful transfers from these sources should be reimplemented in Penny-native form, with explicit QA and maintainability checks.
