# Penny Link Batch Research Pass - 2026-04-21

> Category: External-source research synthesis
> Authority level: Historical evidence
> Current status: Current research note as of 2026-04-21
> Use this for: deciding what this April 21 link batch teaches Penny and Penny-coding agents.
> Do not use this for: current runtime law, proof that behavior shipped, dependency approval, broad platform replacement, runtime voice changes, PromptTruth expansion, or toolEvidenceReceipt expansion.

## Bottom Line

This batch is useful, but it does not argue for a new Penny architecture.

The strongest lessons are:

- Gemma 4 multimodal quality depends on explicit runtime knobs, especially vision token budget, thinking controls, and conservative RAM/context accounting.
- Harness quality matters as much as model choice: scoped context, tool receipts, deterministic checks, token-cost awareness, and actual Penny-shaped evals beat generic benchmark enthusiasm.
- Memory and source systems should preserve immutable raw sources, generated synthesis, indexes, logs, and lint/review loops as separate layers.
- Pressure can make models over-concede or over-defend. Penny needs candor-under-pressure canaries, not generic uncensoring or refusal-heavy personality changes.
- Most broad workspace, shell, graph-memory, and multi-instance systems are pattern references only. They are poor direct imports for a single-user local companion.

The current repo already absorbed much of this direction. The useful next work is narrower: a watchlist/fixture layer for Gemma vision/runtime knobs, token-cost/source-state hints in tool/retrieval planning, and pressure-aware trust canaries where existing QA is still thin.

## Source Health

- All submitted URLs were reachable in some form.
- The normal npm package page for `ai-agent-test` returned a Cloudflare-style `403` to command-line fetches. The package metadata was reachable through the npm registry API at `https://registry.npmjs.org/ai-agent-test`, so the package was not treated as inaccessible.
- The Reddit `token complexity` URL redirected from `/r/LocalLLM/...` to `/r/mcp/...`. The canonical Reddit thread was readable.
- Reddit post bodies and comments were reachable through normal pages and `.json` endpoints during this pass.
- The duplicated `incognide` URL was reviewed once. Its visible README was English; no translation was needed.
- GitHub pages sometimes showed generic dynamic sidebar/widget errors, but README/file content loaded.
- License/access caution: `late` is BSL 1.1, `npcsh` is MIT, `braindb` is Apache-2.0, `incognide` is AGPL-3.0 plus additional restrictions, `Agent-Ersatz` had no visible license in the checked path, `persMEM` advertised MIT but the raw license path checked by a subagent returned 404, and the Karpathy gist has no explicit license. Treat all as pattern input, not copyable code.

## Already Landed In Penny

- `promptTruth` is prompt-time rendered-vs-candidate memory/research context, and `toolEvidenceReceipt` is a sibling runtime-artifact receipt. Do not merge them.
- Chat/tool lanes, LM Studio transport selection, direct tool assist, tool loops, runtime artifacts, and browser-side orchestration splits are already present.
- Gemma 4 follow-through already landed explicit chat sampling knobs, current-turn image-first multimodal payload order, Gemma wrapper leak cleanup, reasoning/tool-call separation, and exact-vs-compatible model status tests.
- Normal companion chat remains thinking-off by default; thinking-on remains an eval/control question.
- Candidate-survival, context-pressure, source-sensitive memory QA, static-embedding shadow comparison, and reranker-shadow artifacting are retrieval-path evidence, not answer-quality proof.
- Source-shaped tool/web evidence hardening has already landed for the recent trust slice: remote text stays source-bound, fetch failures preserve supplied source text, and unsupported workspace side-effect claims route through deterministic verification.
- Repo docs and local skills already encode thin `server.js` / `public/js/penny-app.js` boundaries, task-fit checks, authority receipts, verification cost, and cleanup risk.

## Strengthen Now

1. Add a Gemma vision/runtime watch item rather than a behavior change.

   Sources: Reddit Gemma 4 vision thread, `ollama/ollama#15626`, vLLM Gemma 4 recipe, llama.cpp RAM/cache threads.

   Penny translation:

   - Keep current-turn-only image policy.
   - Record whether the active serving path exposes `max_soft_tokens` / vision budget or equivalent multimodal processor kwargs.
   - If LM Studio exposes a real knob later, test image OCR/detail cases with conservative VRAM/RAM receipts before adopting any default.
   - Treat large context and high vision budgets as explicit tests, not normal operating posture.

2. Add token-cost and source-cost awareness as planning hints.

   Source: Reddit MCP token-complexity thread.

   Penny translation:

   - Tool descriptors could eventually include rough output-cost shape: constant, bounded list, linear in corpus, or unbounded/raw dump.
   - Retrieval/tool selection should prefer smaller source-shaped calls before broad context dumps.
   - This is advisory planning metadata, not a new runtime authority layer.

3. Add pressure-aware trust canaries where existing QA is thin.

   Sources: Morgin responsibility-avoidance benchmark, Morgin "uncensored models" article, Reddit "are you sure?" thread.

   Penny translation:

   - Pair control prompts with pressure prompts: "are you sure?", fake authority, urgency, "just confirm", "another agent disagrees".
   - Passing behavior is not stubbornness. Penny can revise when evidence changes, but should not flip because tone or social pressure changed.
   - Keep answers warm and direct, but evidence-state-labeled: verified, corrected, unknown, unsupported, or not checked.

4. Preserve raw-source/generative-synthesis separation in future import/report tooling.

   Sources: Karpathy LLM wiki gist, BrainDB, page-squeeze, Sanity docs.

   Penny translation:

   - Raw source, generated synthesis, index, log, and lint/review notes should stay distinct.
   - A small "external link review" workflow or skill could standardize future batches: source health, apply now, maybe later, do not add, repo seam, verification cost, authority warning.
   - If Penny ever clips web pages, the useful part of `page-squeeze` is the output shape: metadata, clean content, links, and source URL. Do not import browser-extension scope into core runtime.

5. Keep deterministic extraction first for numbers and documents.

   Sources: PDF extraction Reddit thread, EngineeringWays dataset, 1386.ai, Sanity docs.

   Penny translation:

   - For finance/tax-like PDFs, numbers need deterministic parsing, OCR/table extraction, schemas, and manual/source receipts before LLM reasoning.
   - Generated datasets and small home-trained models are inspiring, but they are not Penny runtime strategy.
   - Domain datasets can teach QA artifact shape: explicit input, expected output, format checks, and validation notes.

## Maybe Later

- A serving-stack watchlist for LM Studio / llama.cpp / vLLM / Ollama Gemma 4 quirks: vision budget, thought-channel behavior, tool-call shape, prompt-cache RAM, checkpoint size, and loaded-model identity.
- Optional tool-descriptor cost metadata if a concrete planner or direct-tool choice starts wasting tokens.
- Config drift and local model benchmark helpers inspired by Agent-Ersatz, but only if Penny's LM Studio preset/status path drifts again.
- A markdown source-capture helper for research notes, not a browser extension dependency.
- Structured content or MCP-backed content access if Penny grows an explicit local corpus workflow. Sanity itself is hosted/platform scope and should not become Penny infrastructure by default.
- Policy-routing ideas from EIE, only as inspiration for future model routing receipts. Do not replace LM Studio just to gain a scheduler.
- BrainDB-style relation fields for offline analysis if current archive/ledger provenance proves too thin. Do not migrate to a graph DB without a measured failure.

## Do Not Add

- Do not import `npcsh`, `incognide`, `persMEM`, BrainDB, EIE, Sanity, or `ai-agent-test` as dependencies for this project right now.
- Do not turn Penny into a CLI shell, workspace OS, multi-agent collaboration platform, content management platform, graph memory server, or inference-server replacement.
- Do not use Morgin/abliteration sources to justify "uncensoring" Penny or loosening companion truth boundaries.
- Do not make thinking mode default for normal companion chat.
- Do not increase default rendered memory/context size because a source praises long context.
- Do not use hidden-chain-of-thought, activation, or neuron intervention as a runtime safety surface.
- Do not auto-promote retrieval hits, semantic similarity, or generated wiki text into canonical explicit memory.
- Do not copy code from unclear, restrictive, or unreviewed-license repos.

## Source Cluster Notes

### Gemma 4, Vision, Serving, And RAM

Key sources:

- Reddit Gemma 4 Vision
- `ollama/ollama#15626`
- vLLM Gemma 4 recipe
- llama.cpp server docs
- llama.cpp discussion 21480
- llama-server/Gemma RAM Reddit threads
- `kibotu/llm-windows-server`

Findings:

- Gemma 4 vision quality can depend heavily on image token budget. The Ollama issue specifically asks for `max_soft_tokens` to become a runtime parameter because a hardcoded low default can hurt fine-detail OCR.
- vLLM exposes Gemma 4 thinking, tool calling, structured outputs, multimodal use, and dynamic vision resolution through OpenAI-compatible patterns. That supports Penny's existing structured-message/tool-call posture.
- llama.cpp/Gemma 4 community threads suggest prompt cache and context checkpoint memory can become a RAM bottleneck independent of raw model weights/VRAM.
- `llm-windows-server` is useful as a local-server runbook pattern: OpenAI-compatible endpoint, usage tracking, health checks, benchmark scripts, fixed-context A/B comparisons, and LAN/Tailscale posture.

Penny fit:

- Strong as watchlist and QA guidance.
- Weak as a reason to abandon LM Studio or raise default context/vision budgets.

### Harnesses, Agent Workflows, And Coding Agents

Key sources:

- `late`
- `npcsh`
- `ai-agent-test`
- `Agent-Ersatz`
- Reddit harness ELI5 thread
- Reddit token-complexity thread

Findings:

- The "harness" is the product around the model: local file access, command execution, edit application, guardrails, retries, context management, and verification.
- `late` emphasizes scoped ephemeral subagents, bounded context, exact-match edits, and human approval for mutating commands.
- `npcsh` offers CLI-first agent teams, slash commands, scheduled jobs, and Jinja execution templates.
- `Agent-Ersatz` is interesting because it treats config drift as detect -> patch -> test -> revert/commit, and measures real local model throughput instead of trusting labels.
- `ai-agent-test` is a small agent-flow package around the AI SDK, Zod, jsdom, and local LLM/tool ergonomics.

Penny fit:

- Keep the existing delegation-first repo workflow.
- Borrow the idea of token/output-cost annotations and drift tests where they solve a real local pain.
- Do not adopt a shell-first or framework-first system.

### Memory, Knowledge, And Source Capture

Key sources:

- Karpathy LLM wiki gist
- BrainDB
- persMEM
- Sanity docs
- page-squeeze

Findings:

- The LLM wiki pattern is the cleanest conceptual cousin: immutable raw sources, generated wiki/synthesis, schema/instructions, index, chronological log, ingest/query/lint operations.
- BrainDB adds typed entities, relations, provenance, fuzzy/semantic search, decay, and rule injection on top of an LLM-oriented database.
- persMEM explores vector memory plus inter-instance messaging and browser-mediated collaboration.
- Sanity is a mature structured-content platform with docs for APIs, content operations, agent actions, and MCP-oriented surfaces.
- page-squeeze is a small markdown capture pattern: page metadata, content, links, and downloaded `.md`.

Penny fit:

- Penny already has explicit memory, archive memory, research ledger, prompt receipts, runtime artifacts, and docs authority.
- Future source import/report workflows should improve indexes/logs/lint and source capture, not replace memory with a graph DB or hosted CMS.

### Document Extraction, Datasets, And Small Models

Key sources:

- PDF extraction Reddit thread
- EngineeringWays
- 1386.ai / Reddit 235M model thread
- TTRPG rules lookup Reddit thread

Findings:

- Local LLMs alone are not reliable for numeric extraction from messy PDFs. The practical advice is OCR/table extraction, deterministic checks, schemas, chunking, and human review.
- EngineeringWays is a small public sample of a larger circuit-analysis reasoning dataset. It is useful as a dataset-shape example, not a Penny training target.
- 1386.ai and the Reddit 235M thread are impressive train-from-scratch hobby/research examples, but their sample outputs and small context limits do not compete with Penny's current LM Studio-first approach.
- TTRPG rules lookup maps to local/private document retrieval plus source citations, not to general companion memory.

Penny fit:

- Strong for source-sensitive document QA and deterministic extraction discipline.
- Poor for training a Penny-specific base model or adding hosted NotebookLM-style workflows.

### Pressure, "Uncensoring", And Candor

Key sources:

- Morgin "Even Uncensored Models Can't Say What They Want"
- Morgin responsibility-avoidance benchmark
- Morgin ablation/heretic/obliteratus article
- Reddit "are you sure?" thread
- Reddit "obliterated or uncensored?" thread

Findings:

- "Uncensored" and "abliterated" are not the same as honest, calibrated, or good at a task.
- Responsibility-avoidance is useful as a narrow paired pressure/control benchmark shape.
- The "are you sure?" discussion is a reminder that answer changes need to be classified: evidence-sensitive update, honest correction, social fold, or unsupported defense.
- Ablation/Heretic/Obliteratus style work carries calibration, stability, and benchmark-overconfidence risks.

Penny fit:

- Strong for pressure/candor QA.
- Bad as product ideology. Penny should stay companion-first and truthful, not looser for the sake of "uncensored" vibes.

## Recommended Next Slice

Do not start with a platform import. The smallest useful follow-up is:

**Gemma/runtime and pressure-watch QA addendum**

Scope:

- Add a short watchlist or fixture note for Gemma 4 image budget, prompt-cache RAM, thinking controls, and OpenAI-compatible serving knobs.
- Add or extend pressure/candor cases: repeated pushback, fake authority, social-majority/subagent disagreement, urgency, and "just confirm" pressure.
- Add token/output-cost hints only as documentation or test fixtures unless an actual tool-planning gap is found.
- Keep PromptTruth and `toolEvidenceReceipt` unchanged.
- Keep runtime voice unchanged.

Likely owner seams if implemented later:

- `scripts/qa-penny-voice-redo.js`
- `lib/penny-qa-trust.js`
- `lib/penny-tool-registry.js`
- `lib/penny-tool-loop.js`
- `lib/penny-lmstudio-status.js`
- `lib/penny-lmstudio-transports.js`
- `test/penny-qa-trust.test.js`
- `test/penny-tool-loop.test.js`
- `test/penny-lmstudio-transports.test.js`

## Source URLs Reviewed

- https://www.reddit.com/r/LocalLLaMA/comments/1srrhi5/gemma_4_vision/?share_id=eLpmY2PcZWGWHZrUf4k01&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/ollama/ollama/issues/15626
- https://www.sanity.io/docs
- https://www.npmjs.com/package/ai-agent-test
- https://registry.npmjs.org/ai-agent-test
- https://github.com/mlhher/late
- https://github.com/npc-worldwide/npcsh
- https://github.com/npc-worldwide/incognide
- https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- https://github.com/dimknaf/braindb
- https://www.reddit.com/r/LocalLLM/comments/1srrz1g/comment/ohgxdre/?share_id=vpmA19o2NgsEoz5fnF5NU&utm_content=2&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://morgin.ai/articles/even-uncensored-models-cant-say-what-they-want.html
- https://morgin.ai/benchmark/responsibility-avoidance
- https://morgin.ai/articles/ablation-vs-heretic-vs-obliteratus
- https://www.reddit.com/r/LocalLLM/comments/1srpdwe/newbie_place_to_start_for_building_a_machine_on_a/?share_id=V7c4Yt1Dne4xfLeXgMRhd&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/EngineeringWays/EngineeringWays
- https://www.reddit.com/r/LocalLLM/comments/1srbh70/235m_local_model_trained_at_home/?share_id=ccj44AoYI-XNs4idHBkRk&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/eb1386/1386.ai
- https://www.reddit.com/r/mcp/comments/1sr2eck/you_know_functions_bigo_timespace_complexity/?share_id=HSkIWfNXlZkS5y9LnyGB_&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://www.reddit.com/r/LocalLLM/comments/1sqzzng/why_do_llms_fold_when_you_say_are_you_sure_i/?share_id=CsnczffnlFvlvZN-37EW_&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://www.reddit.com/r/LocalLLM/comments/1sqvsok/obliterated_or_uncensored/?share_id=hOwy22vMwYm3ecmUy4y-V&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://www.reddit.com/r/LocalLLM/comments/1sqvcz2/can_someone_eli5_what_a_harness_is_and_why_it/?share_id=CbW5XcC_WmGa41rzUZ6QM&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/kibotu/llm-windows-server/tree/main
- https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html#thinking-reasoning-mode
- https://github.com/Timmoth/page-squeeze
- https://www.reddit.com/r/LocalLLM/comments/1sqiiw8/pdf_content_extraction/?share_id=S0nLpEv-T6K9k45cayodW&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/Societus/Agent-Ersatz
- https://www.reddit.com/r/LocalLLM/comments/1sqgigl/why_does_llamaserver_need_so_much_ram_during/?share_id=iPMNYzlNM7_Tv008DsrfB&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/ggml-org/llama.cpp/tree/master/tools/server
- https://github.com/deharoalexandre-cyber/EIE
- https://www.reddit.com/r/LocalLLaMA/comments/1sjq5fo/comment/ofvk9hv/?share_id=KaGrAAQLj1CR3ePMJ07XG&utm_content=2&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://www.reddit.com/r/LocalLLaMA/comments/1sdqvbd/llamacpp_gemma_4_using_up_all_system_ram_on/?share_id=7mHVXVLLaoUuHs0Ud_VrM&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/ggml-org/llama.cpp/discussions/21480
- https://www.reddit.com/r/LocalLLM/comments/1sqdlvu/i_see_nothing_like_the_success_i_read_about_here/?share_id=rMKzFm1P8mAfwADYiHS_L&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1
- https://github.com/ASIXicle/persMEM
