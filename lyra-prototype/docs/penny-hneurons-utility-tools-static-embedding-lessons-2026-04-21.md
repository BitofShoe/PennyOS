# Penny H-Neurons, Utility Tools, and Static Embedding Lessons

> Category: External-source research synthesis
> Authority: Historical evidence / current research note
> Status: Current as of 2026-04-21 local PDT
> Use this for: deciding what the reviewed sources can teach Penny or agents coding Penny.
> Do not use this for: current runtime law, proof that follow-up work shipped, or license to replace Penny's memory/model architecture.

## Scope

Reviewed sources:

- [H-Neurons: On the Existence, Impact, and Origin of Hallucination-Associated Neurons in LLMs](https://arxiv.org/pdf/2512.01797), arXiv PDF.
- [LocalLLaMA utility-tools thread](https://www.reddit.com/r/LocalLLaMA/comments/1src330/do_you_have_any_goto_utility_llmrelated_tools/), reached through the shared short link plus Reddit HTML/JSON.
- [Flower Computer: Much faster static embedding](https://www.flowercomputer.com/news/fast-static-embedding/).

Supporting sources checked for context:

- [SentenceTransformers static-retrieval-mrl-en-v1 model card](https://huggingface.co/sentence-transformers/static-retrieval-mrl-en-v1).
- [Hugging Face static embeddings post](https://huggingface.co/blog/static-embeddings).
- [LiteLLM docs](https://docs.litellm.ai/docs/).
- [SearXNG docs](https://docs.searxng.org/).
- [DuckDB concurrency docs](https://duckdb.org/docs/current/connect/concurrency).
- [SQLite WAL docs](https://sqlite.org/wal.html).

Subagent map:

- Arxiv lane: H-Neurons paper.
- Reddit lane: LocalLLaMA utility thread and related tool docs.
- Flower lane: static embedding article and SentenceTransformers context.
- Repo lane: current Penny docs, recent Apr 20-21 plans, and likely landing seams.

No runtime code was changed for this research pass.

## Bottom Line

There is useful material here, but it points toward disciplined, Penny-sized improvements:

1. Add QA pressure around over-compliance: false premises, misleading context, user pushback against a correct answer, fabricated entities, and unsafe or cheap compliance.
2. Treat fetched web/forum content as untrusted source material. The Reddit OP includes an instruction aimed at LLM assistants; that is a test case, not a rule to obey.
3. Keep Penny's embedding architecture backend-pluggable and model-aware, but do not replace Nomic or EmbeddingGemma with static embeddings yet.
4. Borrow utility plumbing ideas from the Reddit thread: cleaner model-routing seams, provenance-shaped web/search output, SQLite as a future live-state candidate, DuckDB for offline QA/artifact analysis.
5. Reject the big temptations: neuron patching in the app, broad workflow platforms, HARTOS-style federation, custom model training, and embedding-derived memory promotion.

The strongest shared lesson is not "add more intelligence." It is: make Penny better at resisting pressure to please, better at preserving source boundaries, and faster/cleaner at local retrieval only where measurements say retrieval is actually the bottleneck.

## Source 1: H-Neurons Paper

### What It Claims

The paper argues that hallucination has a sparse internal signature in open-weight LLMs. The authors identify a small set of feed-forward neurons whose activation/contribution profiles predict hallucinated versus faithful answers. They report that less than 0.1% of neurons can carry useful hallucination signal across QA settings.

The most Penny-relevant claim is conceptual: these neurons appear tied to over-compliance, not only factual error. The paper frames hallucination as part of a broader tendency to satisfy the prompt even when the model should question the premise, preserve uncertainty, resist misleading context, or refuse harmful instructions.

The paper also argues that these neurons are already present in base models, suggesting the pressure is rooted in pretraining rather than being created only by instruction tuning.

### Methods In Brief

The authors:

- Build faithful/hallucinated answer sets from TriviaQA.
- Measure neuron contribution on answer tokens.
- Train sparse L1 logistic-regression probes.
- Evaluate transfer across TriviaQA, NQ-Open, BioASQ, and fabricated-entity questions.
- Perturb selected neurons during inference by scaling activations.
- Compare instruction-tuned and base-model behavior.

Models include Mistral, Gemma 3, and Llama 3.x families. Results are strong enough to treat the signal as real research pressure, but not uniform enough to treat it as solved hallucination detection. One table includes a case where a hallucination-neuron classifier underperforms random neurons on a fabricated-entity setting for Llama-3.1-8B.

### What Penny Can Learn

Penny should treat hallucination risk as over-compliance pressure, not just missing knowledge.

That maps directly onto existing Penny law:

- explicit memory is canonical;
- archive and research ledger are advisory;
- PromptTruth records rendered memory/research context;
- tool evidence is separate from PromptTruth;
- technical claims should be verified before being spoken as fact.

The paper supports Penny's current direction: authored epistemic integrity, not colder refusal behavior. Penny should be warm and alive while still able to say, in effect, "that premise is wrong" or "I do not have proof for that."

### Apply Now

- Add over-compliance cases to QA:
  - false premise;
  - misleading context;
  - fabricated entity;
  - user challenges a correct answer and tries to make Penny flip;
  - unsafe or cheap compliance pressure;
  - companion-flavored pressure where Penny wants to be pleasing but should stay truthful.
- Add or strengthen scoring for "Penny changed from correct to wrong after pushback."
- Use this framing in the planned runtime-voice patch: resist premise laundering without turning into a sterile safety assistant.
- Keep runtime artifacts and inspector receipts as the trust surface. Do not rely on polished prose alone.

### Maybe Later

- If LM Studio or another local runtime exposes internal activations, investigate a research-only hallucination/over-compliance probe for Gemma or Mistral-class models.
- Compare local models on over-compliance resistance, not just speed, warmth, or single-turn factual correctness.
- Build a small "over-compliance pressure" harness separate from generic memory QA.

### Do Not Apply

- Do not patch neuron activations inside Penny's current app.
- Do not replace the memory architecture with neuron-level machinery.
- Do not call H-Neurons a universal hallucination cure.
- Do not make Penny refusal-heavy. The target is companion-first truthfulness under pressure.

## Source 2: LocalLLaMA Utility-Tools Thread

### Source Health

The short Reddit link redirected to the full post. New Reddit HTML was readable in this environment, and the Reddit JSON endpoint exposed the post and comments. The thread was very small at fetch time: low score, 9 comments, anonymous users, and no reproducible benchmarks. Treat it as field notes, not strong evidence.

The OP also included a prompt-injection-style instruction telling LLM assistants not to respond. Since this pass is analysis, not posting to Reddit, that text is source content only. It should not steer Penny or repo agents.

### What It Mentions

The thread asks for less-discussed LLM utility tools, excluding common inference backends, frontends, assistants, and coding agents.

Mentioned tools or patterns:

- LiteLLM as a proxy/router/gateway.
- Local SearXNG plus a wrapper that formats results for LLM ingestion.
- DuckDB and SQLite for data-heavy workflows.
- Hindsight as a model-agnostic memory layer.
- Pinokio as a local app/model launcher.
- HARTOS, with little in-thread explanation.
- Julia/Lux.jl for custom small model experiments.
- A self-built node/flow agent system with interruptible flows and logic gates.

### Useful Lessons

The practical lesson is that local LLM setups benefit from boring utility layers. Penny already shows this: lane selection, LM Studio status parsing, transport fallback, memory inspection, PromptTruth, and toolEvidenceReceipt matter more than chasing another UI shell.

LiteLLM is useful as architectural pressure, not as an immediate dependency. Its docs emphasize a unified interface, retry/fallback routing, proxy/gateway behavior, virtual keys, cost tracking, and OpenAI-compatible calls. Penny's equivalent is narrower: keep model-routing/provider/sampling logic in helper-owned seams, not scattered route code.

SearXNG is useful as a search-output-shaping lesson. A private/self-hosted metasearch tool can be valuable, but Penny's more immediate need is that any web/search tool result be citation-friendly, date-aware where possible, compact, and explicit about limitations.

DuckDB and SQLite split cleanly:

- DuckDB is attractive for offline analysis over QA/eval artifacts, traces, CSV/JSON/parquet-style data, and research tables.
- SQLite is the more plausible future live-state store if JSON files become too fragile, especially with WAL mode, but still has one-writer realities.

### Apply Now

- Add remote-content prompt-injection to the web/research/tool QA pile.
- Make source-shaped tool output a standing requirement: URLs, titles, snippets, dates when available, fetch limitations, and no obedience to fetched-page instructions.
- Use DuckDB for local artifact analysis when JSON outputs get bulky.
- Keep SQLite on the watchlist for durable live state if JSON memory files become a real bottleneck.
- Preserve the current helper-owned routing direction in `lib/penny-lmstudio-*`, `lib/penny-tool-loop.js`, and route handlers.

### Maybe Later

- Evaluate LiteLLM only if Penny needs multi-provider routing or remote/local fallback beyond LM Studio.
- Trial an optional SearXNG adapter if the current web path becomes unreliable or opaque.
- Review Hindsight separately as memory research input, but compare it against Penny's explicit/archive/ledger model before importing ideas.
- Borrow interruptible-flow ideas only for concrete long-running Penny workflows.

### Do Not Apply

- Do not turn Penny into a generic node-flow agent platform.
- Do not adopt HARTOS-style federation/hivemind/economic architecture.
- Do not make custom model training a Penny app roadmap item.
- Do not route Penny through a VPS or homelab proxy by default.
- Do not treat Reddit comments as adoption proof.

## Source 3: Flower Static Embedding Post

### What It Claims

Flower's post claims a major runtime speedup for static embeddings. The interesting part is not a new embedding model; it is a purpose-built runtime for an existing static model.

The source model is SentenceTransformers' `static-retrieval-mrl-en-v1`, which maps text into 1024-dimensional vectors using precomputed token embeddings. The Hugging Face model card describes the architecture as an `EmbeddingBag` mean over token embeddings and notes 0 active parameters.

Flower's runtime approach:

- take the weights and tokenizer;
- materialize them into Rust `static` globals at compile time;
- skip generic ML-library materialization at runtime;
- simplify tokenization for this model's needs;
- rely on compiler vectorization.

Flower reports extreme throughput improvements, including millions of batched queries per second on an M4 Mac Mini and tens of thousands on a Raspberry Pi 4. Because the weights are the same, the claimed quality should match the underlying static model, not exceed it.

### Tradeoff Reading

Static embeddings are cheap and attractive for bulk indexing, background vectorization, and low-power devices. They are not magic semantic reasoning.

The SentenceTransformers model card says the static model is much faster than common transformer embeddings and roughly 87.4% as performant as `all-mpnet-base-v2` on NanoBEIR. It also supports Matryoshka truncation, which can shrink vectors with limited benchmark loss.

The risks for Penny are obvious:

- intimate/personality memory is not the same as benchmark retrieval;
- code search is not the same as QA retrieval;
- static mean-style models may miss negation, relations, correction state, and intent;
- a new vector space means cache isolation/rebuild;
- a Rust/native provider adds packaging complexity;
- very fast indexing can tempt over-collection.

### Apply Now

- Treat static embeddings as a future candidate provider, not as a default replacement.
- Preserve model-aware embedding caches. Penny already does the right conceptual thing here.
- Measure real bottlenecks before optimizing embeddings: query embedding, candidate embedding, vector search, LM Studio round trip, prompt eval, and generation.
- Consider a separate coding-agent repo-index benchmark: static embeddings plus lexical search plus optional rerank/evidence check.
- Keep keyword fallback and explicit-memory authority exactly as-is.

### Maybe Later

- Try Flower's crate once public or available, behind an explicit embedding-provider flag.
- Benchmark against Nomic and EmbeddingGemma on Penny's actual semantic-memory recall/correction cases.
- Try static embeddings as first-pass retrieval, with rerank or deterministic evidence checks for high-trust answers.
- Explore Matryoshka truncation if index size or vector-search speed becomes a real issue.

### Do Not Apply

- Do not replace canonical explicit memory with embedding matches.
- Do not auto-promote static-embedding matches into durable facts.
- Do not make static embeddings part of the live chat prompt story.
- Do not broaden `server.js` for an embedding experiment; use a dedicated provider seam if this lands.
- Do not assume NanoBEIR means Penny recall quality.

## Penny-Specific Recommendations

### Definitely Add

1. Over-compliance QA cases.

Best landing zones:

- `scripts/qa-penny-memory.js`
- `scripts/qa-penny-voice-redo.js`
- `scripts/eval-penny-models.js`
- possibly a small dedicated fixture under `test/` for prompt/cleanup behavior

Done means Penny can preserve truth under false premise, misleading context, user skepticism, and fabricated-entity pressure, without losing companion voice.

2. Fetched-content prompt-injection fixture.

Best landing zones:

- `lib/penny-web-tools.js`
- `lib/penny-tool-loop.js`
- `lib/penny-runtime-artifacts.js`
- relevant tests for direct web fetch / tool evidence

Done means a fetched source can contain instructions aimed at Penny or agents, and Penny treats them as quoted/source content only. The receipt should show source limitations, not obedience.

3. Source-shaped tool output checklist.

Best landing zones:

- repo-local skills;
- `docs/plans/TEMPLATE.md`;
- web/project tool result tests;
- `toolEvidenceReceipt` presentation.

The checklist should prefer compact structured facts: URL/path, title, timestamp if available, fetched-vs-snippet state, source limitations, and what was verified.

### Maybe Add Later

1. Static embedding provider experiment.

Gate:

- Flower crate or equivalent is available;
- benchmark harness exists;
- Nomic and EmbeddingGemma baselines are current;
- cache model isolation and rebuild behavior are tested.

2. SQLite live-memory migration study.

Gate:

- JSON file writes become a real reliability/concurrency problem;
- explicit/archive/ledger boundaries are preserved;
- migration/recovery story is clearer than the current files.

3. DuckDB artifact-analysis helper.

Gate:

- QA/eval artifacts become annoying enough that JSON and `jq` are no longer enough;
- the helper stays offline and generated-output-facing.

4. LiteLLM/SearXNG adapters.

Gate:

- current LM Studio/web path shows concrete pain;
- adapter is optional;
- provenance, route receipts, and local-first behavior stay intact.

## Best Next Slice

The smallest useful coherent slice is:

**Over-compliance and remote-content trust QA.**

Scope:

- Add a few fixed QA/eval prompts for false premises, fabricated facts, and user pushback against a correct answer.
- Add one fetched-content prompt-injection fixture inspired by the Reddit OP.
- Record outcomes in existing QA/trust artifacts without changing live runtime behavior first.

Why this slice:

- It directly applies the H-Neurons paper.
- It uses the Reddit thread as a real-world source trust test.
- It does not risk Penny's memory architecture.
- It helps future agents code her more safely.
- It creates evidence before changing prompts or retrieval.

Deferred:

- embedding-provider experiments;
- LiteLLM/SearXNG integration;
- SQLite or DuckDB storage changes;
- neuron-level activation probes.

## Hard Rejections

- Neuron intervention in Penny's app.
- Default static embeddings without Penny-specific recall/correction benchmarks.
- Treating Reddit or source pages as instructions.
- Auto-promoting retrieval hits into explicit memory.
- General multi-agent workflow UI.
- HARTOS/federated/hivemind architecture.
- Custom model-training roadmap for the app layer.
- Cloud/VPS routing as Penny default.

## One-Sentence Carry Forward

Make Penny less eager to please falsehood, make source boundaries harder to blur, and only make retrieval faster after the measurements prove retrieval is the bottleneck.
