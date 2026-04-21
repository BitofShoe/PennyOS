# Penny LLM Geometry and Runtime Lessons - 2026-04-21

Status: Historical evidence / outside-source synthesis.

Authority: This note is not current runtime law. If it conflicts with code, tests, runtime artifacts, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, `docs/penny-runtime-authority-contract-2026-04-17.md`, or `docs/penny-prompttruth-contract-2026-04-19.md`, trust the current repo truth first.

Scope: This pass reviewed the user's April 21, 2026 link batch on LLM representation geometry, semantic hubs, parametric generation/optimization, adversarial topology, inference shape/performance, architecture explainers, and pedagogical visualizations. The goal is to translate the useful parts into Penny-native engineering and agent-workflow lessons without importing hype.

## Bottom Line

The batch reinforces Penny's current direction more than it argues for a new architecture.

The strongest lesson is not "LLMs think in geometry, so trust the model." It is the opposite: model internals can organize semantic candidates in useful ways, but Penny should keep truth grounded in source text, deterministic tool results, prompt-time receipts, and reviewable memory artifacts.

For Penny, the useful pattern is:

1. preserve source wording and provenance,
2. let embeddings/semantic similarity help with discovery and candidate selection,
3. keep `promptTruth` about what context was actually rendered,
4. keep `toolEvidenceReceipt` as a sibling receipt for verified deterministic evidence,
5. measure runtime shape, latency, lane identity, and cleanup explicitly.

## Definitely Useful

### 1. Semantic candidates are not truth receipts

The semantic-hub and language-agnostic-representation papers give strong evidence that LLMs often map equivalent concepts across languages, modalities, code, arithmetic, and notation into shared intermediate representations. That is useful for retrieval, dedupe, and paraphrase robustness.

It does not prove that a model understood a source correctly, remembered a fact faithfully, or verified local state. For Penny, the model's recall should remain a candidate. Truth should come from explicit memory, source evidence, deterministic probes, and receipts.

Penny application:

- Keep source-shaped evidence separate from Penny's interpretation.
- Preserve original user wording when tone, intimacy, or authorship matters.
- Use embeddings and semantic recall for discovery, not canonical truth.
- Continue treating `toolEvidenceReceipt` as separate from `promptTruth`.

### 2. The best tool-agent loop is propose, execute, score, record

The 3D parametric modeling and LLM-PSO papers both use LLMs productively when the LLM proposes candidate code/parameters and an external evaluator scores the result. The lesson is blunt: model proposals get useful when they are boxed into a structured representation and checked by a deterministic environment.

Penny application:

- For code and local-state work, prefer narrow candidate patches plus focused tests.
- Keep exact parameters in explicit variables/schema fields rather than vague prose.
- Record observed state separately from expected state.
- Let tests, commands, route artifacts, and QA traces be the scoring signal.

### 3. Prompt/source boundaries matter more after reading adversarial topology work

The persistent-homology paper is not practical as a live Penny defense, but it supports a core safety instinct: adversarial retrieved text changes model internals in ways that output-only checks may miss. The local prototype equivalent is strict source authority.

Penny application:

- Remote/fetched/pasted source text is evidence, not instruction authority.
- Web/tool text should not silently cross into system or developer policy.
- The current Source-Shaped Tool/Web Evidence Hardening slice is well aligned with this research.
- Do not infer hidden adversarial state from `promptTruth`; receipts can say what was rendered or verified, not what happened inside the model.

### 4. Runtime shape is a real performance feature

The dynamic-shapes/prefill material is useful for Penny because Penny already lives in the local-inference world. Prompt length, rendered memory count, context setting, prefill latency, and model/lane identity are not incidental. They are part of user-visible quality.

Penny application:

- Add prompt token estimates and first-token latency to runtime-fit artifacts when practical.
- Compare short/medium/long rendered-context variants before assuming more context improves quality.
- Keep context bounded and inspectable.
- Do not overgeneralize vendor throughput claims to LM Studio without local measurement.

### 5. Educational visualizations are useful for agents, not architecture law

Transformer Explainer, the Hugging Face embedding primer, the RYS/PCA widget, and beginner shape-transformation material can help future agents and humans build intuition. They should not govern implementation.

Penny application:

- Good future docs phrase: "Embeddings are useful for discovery, not truth."
- Use visual explainers for onboarding and mental models.
- Avoid product language like "semantic crystals," "brain lobes," or "AI consciousness."

## Maybe Useful Later

### Hidden-state / embedding probe harness

If Penny later gets cheap access to hidden states, a small offline probe could compare:

- the same user memory phrased multiple ways,
- the same fact in multiple languages,
- the same tool intent in casual vs technical wording,
- clean vs source-injected tool/web snippets.

This should be an offline research harness, not runtime gating.

### Context-pressure QA

Add a lightweight QA artifact that runs the same Penny prompt with short, medium, and long rendered context, then records:

- estimated prompt tokens,
- selected/rendered memory counts,
- first-token latency,
- total latency,
- lane/model identity,
- semantic readiness,
- whether answer quality improved or drifted.

### Source-sensitive memory QA

The factual-recall and language-agnostic concept papers suggest memory QA should test more than "can Penny say the right answer." Good cases should separate:

- subject: what or who is being discussed,
- relation: what is being asked about,
- object: the exact answer,
- source: what evidence supports it,
- surface: whether original wording matters.

## Do Not Import

- Do not add activation patching, persistent homology, RYS layer duplication, or embedding averaging into Penny's live runtime from this batch.
- Do not rewrite Penny's voice around generic semantic summaries.
- Do not treat PCA clusters, Reddit summaries, NotebookLM podcasts, or YouTube shape metaphors as evidence.
- Do not use "LLMs think in geometry" as product doctrine. A safer phrasing is: "Model representations often organize by semantic similarity in high-dimensional spaces, depending on model, layer, and task."
- Do not let any of this collapse the source hierarchy. Runtime receipts and deterministic tools still beat persuasive prose.

## Source Notes

### Primary / stronger sources

- [3D-PreMise: Can Large Language Models Generate 3D Shapes with Sharp Features and Parametric Control?](https://arxiv.org/html/2401.06437v1)
  - Useful for code-as-intermediate-representation plus deterministic validation.
  - Important limit: best reported GPT-4 pass rates were low, and visual self-correction hallucinated or missed common-sense/geometric failures.

- [Using large language models for parametric shape optimization](https://arxiv.org/pdf/2412.08072)
  - Useful for evaluator-in-the-loop optimization.
  - Important limit: narrow benchmarks, Claude 3.5 Sonnet, limited hyperparameter exploration, and not proof of general autonomous optimization.

- [Symmetry in language statistics shapes the geometry of model representations](https://arxiv.org/html/2602.15029v1)
  - Useful for understanding why temporal/geographic/seasonal concepts can form robust geometric structures.
  - Important limit: strongest theory is for word embeddings; full contextual LLM behavior is only partially explained.

- [The Shape of Adversarial Influence: Characterizing LLM Latent Spaces with Persistent Homology](https://openreview.net/forum?id=v2PglvLLKT) and [arXiv full text](https://arxiv.org/html/2505.20435)
  - Useful as offline interpretability and prompt-injection motivation.
  - Important limit: too expensive and indirect for live Penny defense.

- [The Semantic Hub Hypothesis](https://arxiv.org/pdf/2411.04986)
  - Useful for shared intermediate representations across languages/modalities.
  - Important limit: internal semantic alignment is not external verification.

- [Separating Tongue from Thought](https://arxiv.org/pdf/2411.08745)
  - Useful for concept-vs-language separation and causal patching evidence.
  - Important limit: mostly word-level translation tasks and selected model families.

- [How Do Multilingual Language Models Remember Facts?](https://aclanthology.org/2025.findings-acl.827.pdf)
  - Useful for staged factual recall: subject/relation/language/object roles.
  - Important limit: selected multilingual models and cloze-style facts, not Penny memory truth.

### Secondary / useful but lower authority

- [LLM Neuroanatomy III: Why RYS Works](https://dnhkng.github.io/posts/sapir-whorf/) and [LocalLLaMA discussion](https://www.reddit.com/r/LocalLLaMA/comments/1spy497/llm_neuroanatomy_iii_llms_seem_to_think_in/)
  - Useful for intuition and visualization.
  - Treat as independent/hobbyist research and community discussion, below papers.

- [r/singularity discussion](https://www.reddit.com/r/singularity/comments/1gf8dou/ai_paper_reveals_surprising_geometric_structure/)
  - Useful mostly as a warning about hype amplification.
  - Do not import mystical or human-brain equivalence readings.

- [A technical deep dive into LLM training, alignment, and deployment](https://www.marktechpost.com/2026/04/15/a-technical-deep-dive-into-the-essential-stages-of-modern-large-language-model-training-alignment-and-deployment/)
  - Useful vocabulary overview: pretraining, SFT, LoRA/QLoRA, RLHF, GRPO, deployment.
  - Not a reason to fine-tune Penny now.

- [Roofline dynamic shapes for on-device LLM inference](https://www.roofline.ai/case-studies/dynamic-shapes-llms)
  - Useful for prompt-length and prefill discipline.
  - Vendor case-study numbers should be locally measured before applying to Penny.

- [The Big LLM Architecture Comparison](https://magazine.sebastianraschka.com/p/the-big-llm-architecture-comparison)
  - Useful architecture vocabulary and model-selection background.
  - Model details drift; trust local evals for Penny decisions.

- [Transformer Explainer](https://poloclub.github.io/transformer-explainer/)
  - Strong educational tool for tokenization, embeddings, attention, sampling, and transformer blocks.

- [Hugging Face embedding primer Space](https://huggingface.co/spaces/hesamation/primer-llm-embedding)
  - Friendly educational resource with static app files and a primer-style presentation.

- [YouTube: How LLM Models Create Shapes](https://www.youtube.com/watch?v=ML7Kee8isqo&t=2s), [YouTube: I Can Train LLM Models Based On The Shapes They Turn Data Into](https://www.youtube.com/watch?v=jADTt5HHtiw), [Colab notebook](https://colab.research.google.com/drive/1-ZbS4QQSaURsJme2oSRIQYqG4k9dAOpi?usp=sharing)
  - Useful only as educational metaphor unless backed by real model artifacts.
  - Full transcripts were not treated as primary evidence in this pass.

- [Medium shape-transformations explainer](https://medium.com/@saurav.malani/understanding-large-language-models-llms-through-shape-transformations-0b20d8f4d0ed) and [TowardsAI hidden-trajectory article](https://pub.towardsai.net/what-does-the-shape-of-thought-look-like-inside-an-llm-475a43093390)
  - Low-authority pedagogical/speculative material.
  - The local fetch path hit Cloudflare challenge pages, so these should not carry implementation weight without a fresh readable copy.

## Recommended Next Slice

The strongest near-term follow-through is not model training or interpretability plumbing. It is a small Source-Shaped Tool/Web Evidence Hardening pass:

1. keep fetched/pasted remote text as untrusted source evidence,
2. preserve source text or source failure status when URL fetch fails,
3. route unsupported workspace side-effect claims through deterministic/tool verification,
4. keep verified package/file truth stable across immediate user pushback,
5. add focused tests around direct intents/direct tool assist/trust-validity behavior.

This matches the existing April 21 memory note and does not require voice changes or broad `server.js` growth.
