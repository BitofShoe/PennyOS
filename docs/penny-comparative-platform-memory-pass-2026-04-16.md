# Penny Comparative Platform and Memory Pass

Date: 2026-04-16

This note is a standalone comparative research report for the link bundle provided in chat:

- RisuAI
- Open WebUI
- Agnai
- SillyTavern
- external long-term-memory / agent-memory repos

Scope is intentionally limited:

- no runtime changes
- no prompt rewrites
- no test runs
- no memory-file mutations
- docs-only output

## Reachability

I verified the full provided link set before analysis.

- Total distinct URLs checked from this environment: `71`
- Dead-link blocker count: `0`
- Result: every provided URL resolved successfully on `2026-04-16`

Important caveat:

- the [RisuAI wiki home](https://github.com/kwaroran/RisuAI/wiki) explicitly presents itself as outdated and in-progress, so it is useful as a feature-signal source, but weaker as implementation truth than issue threads or repo code/readme.

## Method

This pass used:

- direct local Penny repo review against [README.md](../README.md), [CODEBASE.md](../CODEBASE.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md](../PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md), and current memory/runtime modules under `lib/` and `public/js/`
- a six-lane read-only research split across source clusters
- consolidation against current Penny state so repeated ideas are tagged as:
  - `already-landed`
  - `strengthen-now`
  - `later`
  - `poor-fit`

That distinction matters here, because several ideas that look "new" from outside are already in Penny.

## Executive Verdict

The main conclusion is reinforcement, not reversal.

These links do **not** make a strong case for throwing out Penny's current architecture.
They mostly reinforce the current direction:

- compact canonical explicit memory
- additive archive memory
- review-gated promotion
- bounded research continuity ledger
- provenance-visible retrieval
- companion-first local UX

The strongest genuinely useful lessons are narrower and more operational:

1. `strengthen-now`: add a clearer boundary between canonical text, request shaping, and display-only rendering.
2. `strengthen-now`: add a durable "research knowledge bank" path for cited web/document sources instead of overloading user-memory or the research ledger.
3. `strengthen-now`: make memory operations more explicitly statusful and object-like: IDs, correction targets, delete targets, ingest/consolidate/promotion states.
4. `strengthen-now`: make prompt assembly more inspectable, not just retrieval/artifact outcomes.
5. `strengthen-now`: evaluate memory as separate write / retrieve / forget problems instead of one blended "did it remember?" score.
6. `later`: consider more explicit standards-based connector/tool seams if Penny widens her connector surface.

The evidence **does not** justify:

- replacing Penny with a generic plugin platform
- turning Penny into a SillyTavern-style power-user cockpit
- broad scripting or regex DSL exposure
- multi-user redesign
- memory-OS scope creep
- model-surgery memory research in the live product
- automatic archive-to-canonical promotion

## Penny Baseline Before Applying Outside Lessons

Several imported-looking ideas are already live in Penny and should not be described as hypothetical:

- canonical explicit memory is already the source of truth in [lib/penny-memory.js](../lib/penny-memory.js) and [lib/penny-memory-state.js](../lib/penny-memory-state.js)
- archive memory is already additive, inspectable, provenance-aware, contradiction-aware, and review-gated in [lib/penny-memory-archive.js](../lib/penny-memory-archive.js)
- semantic retrieval already degrades gracefully when embeddings are missing rather than breaking chat
- research continuity is already separate and bounded in [lib/penny-research-ledger.js](../lib/penny-research-ledger.js)
- runtime artifacts and trace provenance are already visible in [lib/penny-runtime-artifacts.js](../lib/penny-runtime-artifacts.js)
- memory books already exist in [lib/penny-memory-books.js](../lib/penny-memory-books.js)
- prompt-slot assembly already exists in [lib/penny-prompt-stack.js](../lib/penny-prompt-stack.js)
- the inspector already surfaces explicit memory, archive state, provenance, ledger context, compression, and recency protection in [public/js/penny-memory-panel.mjs](../public/js/penny-memory-panel.mjs)
- expression runtime / vessel modularity already exists in [public/js/penny-expression-runtime.mjs](../public/js/penny-expression-runtime.mjs)

Because of that, this report focuses on:

- what is actually new
- what should deepen existing seams
- what should stay on the watchlist only

## Cluster-by-Cluster Findings

### 1. RisuAI

Most useful transferable ideas:

- a stronger conceptual split between:
  - input transforms
  - output transforms
  - request transforms
  - display-only transforms
- selective, trigger-based contextual injection rather than giant always-on lore
- lightweight companion-surface polish like image/emotion/TTS layers
- small declarative extension seams instead of gigantic plugin frameworks

High-value evidence:

- [Regex Script](https://github.com/kwaroran/RisuAI/wiki/Regex-Script) explicitly separates `Modify Input`, `Modify Output`, `Modify Request`, and `Modify Display`
- [Issue #1051](https://github.com/kwaroran/RisuAI/issues/1051) shows a concrete summarization failure caused by message-order invariants: `SystemMessageOrderError`
- [Plugin Docs](https://github.com/kwaroran/RisuAI/wiki/Plugin-Docs) point toward small declarative extension points
- [Lorebook](https://github.com/kwaroran/RisuAI/wiki/Lorebook) and [SupaMemory](https://github.com/kwaroran/RisuAI/wiki/SupaMemory) reinforce selective recall and summary layers

What feels new for Penny:

- `strengthen-now`: formalize a display-only transform boundary so cosmetic rendering changes never mutate canonical stored chat text
- `strengthen-now`: validate compression/summarization output against message-order invariants before accepting it
- `strengthen-now`: prefer structural parsing over regex-only rewriting for any tool/thought trace post-processing
- `strengthen-now`: separate "tool/plugin registered" from "provider/model can actually execute this tool path"
- `later`: ephemeral author-note style steering could be useful if it stays non-canonical and clearly separate from memory

What looks like poor fit:

- broad roleplay platform behavior
- group-chat-first design
- open-ended prompt DSL sprawl
- feature-count copying for its own sake

### 2. Open WebUI

Most useful transferable ideas:

- memory as a visible, model-addressable system
- explicit separation between memory and knowledge
- one-click bridge from web search results into durable knowledge
- clearer standards language for tools and connectors
- persistent operator settings mirrored between env and UI/admin surfaces

High-value evidence:

- [Memory & Personalization](https://docs.openwebui.com/features/chat-conversations/memory/) exposes `add_memory`, `search_memories`, `replace_memory_content`, `delete_memory`, and `list_memories`
- [Save Search Results to Knowledge](https://docs.openwebui.com/features/chat-conversations/web-search/save-to-knowledge/) shows a direct "citations -> knowledge base" workflow with duplicate detection
- [Tools](https://docs.openwebui.com/features/extensibility/plugin/tools/) provides a cleaner MCP/OpenAPI/native-tool vocabulary
- [Env Configuration](https://docs.openwebui.com/reference/env-configuration/) highlights persistent config as a first-class operator surface

What feels new for Penny:

- `strengthen-now`: introduce a distinct research/document knowledge-bank path for saved citations and fetched sources
- `strengthen-now`: add more explicit object semantics around memory items: IDs, timestamps, correction targets, deletion targets
- `strengthen-now`: make critical runtime/operator settings easier to understand as persistent config instead of only code/env trivia
- `later`: if Penny expands integrations, prefer MCP/OpenAPI-style adapters over ad hoc bespoke seams

What to adapt carefully:

- model-facing CRUD is powerful, but Penny should keep human review and provenance stronger than Open WebUI's docs currently emphasize

What looks like poor fit:

- workspace-level arbitrary Python execution as a casual product feature
- multitenant/platform complexity
- broad "home for every model" ambition

### 3. Agnai

Most useful transferable ideas:

- context is a scarce budget, not an entitlement
- memory should be placed well, not merely stored
- scenario, character, and memory are distinct layers
- off-topic behavior is often a systems/tuning problem, not just a prompt-writing problem
- small authorable memory entries beat giant undifferentiated dumps

High-value evidence:

- [Memory Books](https://agnai.guide/docs/memory/memory-books.html) uses explicit `priority`, `weight`, `depth`, and context-budget rules
- [Off Topic Responses](https://agnai.guide/docs/tips-tricks-and-troubleshooting/off-topic-responses.html) ties drift to context pressure and token-probability settings like temperature and repetition penalties
- [What Is LLM Context](https://agnai.guide/docs/what-is-an-llm/context-and-context-limits.html) reinforces that larger context is not automatically better
- [Scenarios](https://agnai.guide/docs/library/scenarios) and [Creating a Character](https://agnai.guide/docs/creating-a-character/) keep scenario/state separate from character definition

What feels new for Penny:

- `strengthen-now`: if Penny exposes user-authored memory-book editing later, use small keyword-triggered entries with explicit ranking and scan-depth controls
- `strengthen-now`: make tuning guidance more explicit in Penny diagnostics when behavior failures are likely context/sampling issues rather than memory corruption
- `later`: if Penny ever supports richer overlays, keep scenario/state/event layers separate from voice/personality layers
- `later`: explicit prompt-template contracts may matter if Penny becomes more customizable

What looks like poor fit:

- browser-authoritative memory
- heavy scenario/event scripting in the main product
- randomness features touching factual continuity

### 4. SillyTavern

Most useful transferable ideas:

- prompt assembly should be layered and inspectable
- retrieval scopes should stay separate
- document retrieval and chat retrieval are different jobs
- vessel/presence layers are runtime systems, not just static images
- automation is safest when explicit and debuggable

High-value evidence:

- [Prompt Manager](https://docs.sillytavern.app/usage/prompts/prompt-manager/) makes role, position, depth, and order explicit
- [World Info](https://docs.sillytavern.app/usage/core-concepts/worldinfo/) shows scoped conditional injection rather than a single monolithic memory pile
- [Data Bank](https://docs.sillytavern.app/usage/core-concepts/data-bank/) and [Chat Vectorization](https://docs.sillytavern.app/extensions/chat-vectorization/) distinguish long-lived document retrieval from chat-history vectorization
- [Writing Extensions](https://docs.sillytavern.app/for-contributors/writing-extensions/) reinforces stable APIs, cleanup discipline, and modular browser behavior

What feels new for Penny:

- `strengthen-now`: add a lightweight prompt inspector so operators can see assembled prompt layers, not only downstream artifacts
- `strengthen-now`: keep document knowledge attachments separate from conversational memory and give them explicit quotas/insertion rules
- `later`: background vectorization of current chat history might help recovery, but only if it stays off the hot path and does not worsen latency or caching
- `later`: tiny macro/helper surfaces could support quick replies or hotkeys if they stay bounded and non-programmer-facing

What looks like poor fit:

- full power-user control-panel UX
- broad regex/script feature exposure
- retrieval-layer sprawl that turns into prompt soup
- multi-user product assumptions

### 5. External Agent-Memory / Long-Term-Memory Repos

Most useful transferable ideas:

- benchmark memory separately from exploration or generic task performance
- make memory objects editable and inspectable
- treat memory operations as pipelines with states, not mystical black boxes
- evaluate forgetting deliberately instead of only evaluating storage and recall
- keep scope boundaries explicit

High-value evidence:

- [Memory Maze](https://github.com/jurgisp/memory-maze) is valuable because it isolates long-term memory from confounds and exposes hidden-state probe signals
- [ChatMemory](https://github.com/uezo/chatmemory) argues for small, boring, understandable memory pipelines
- [MemOS](https://github.com/MemTensor/MemOS) is useful mainly for editable object semantics, correction, and deletion ideas
- [memU](https://github.com/NevaMind-AI/memU) is useful mainly for pipeline/status semantics around memory operations
- [Awesome-Agent-Memory](https://github.com/TeleAI-UAGI/Awesome-Agent-Memory) and [GitHub's long-term-memory topic](https://github.com/topics/long-term-memory) are useful field maps
- [SakanaAI/evo-memory](https://github.com/SakanaAI/evo-memory) is a reminder that forgetting is a design problem, but not a practical near-term Penny import

What feels new for Penny:

- `strengthen-now`: treat memory objects more explicitly as records with IDs, lifecycle states, and correction/delete targets
- `strengthen-now`: split evals into write quality, retrieval quality, and forgetting quality
- `strengthen-now`: consider clearer namespaces for skill/tool/document/research-thread memory, rather than treating every artifact as a generic memory candidate
- `later`: utility-based pruning / forgetting policy may be worth exploring as a rule system

What looks like poor fit:

- model-surgery memory architectures
- cloud/shared multi-agent memory products
- full "memory OS" ambitions
- packaging hype that claims retrieval-plus-metadata is somehow a fundamentally new ontology

## Net-New Lessons That Look Worthwhile

This is the shortest list of findings that felt both:

- actually new enough to matter
- still compatible with Penny's current architecture

### 1. Add a research knowledge bank distinct from user memory and the research ledger

Tag: `strengthen-now`

Why it matters:

- Open WebUI's "save search results to knowledge" pattern is genuinely useful
- Penny already has a research ledger, but it is advisory topic continuity, not a durable source bank
- user/profile memory, archive memory, and research sources should stay different things

Practical implication:

- saved citations, fetched docs, and repo/web research sources should have a durable home with source identity, dedupe, and retrieval budgets
- this should not mutate canonical explicit memory automatically
- this should not broaden the research ledger into general memory

Best evidence:

- [Save Search Results to Knowledge](https://docs.openwebui.com/features/chat-conversations/web-search/save-to-knowledge/)
- [Features](https://docs.openwebui.com/features/)
- Penny-local guardrail in [docs/penny-companion-first-external-review-rewrite-2026-04-16.md](./penny-companion-first-external-review-rewrite-2026-04-16.md)

### 2. Make prompt assembly inspectable, not just retrieval/artifact output

Tag: `strengthen-now`

Why it matters:

- SillyTavern and Agnai are both much more explicit about prompt-placement mechanics
- Penny already has a real prompt stack, overlays, and memory-book path, but the operator view is stronger on artifacts than on assembled prompt structure

Practical implication:

- add a small debug/operator view for:
  - which prompt slots were active
  - which overlays were injected
  - which memory books matched
  - where major prompt chunks landed
  - token-budget roughness per layer if possible

Best evidence:

- [Prompt Manager](https://docs.sillytavern.app/usage/prompts/prompt-manager/)
- [Memory Books](https://agnai.guide/docs/memory/memory-books.html)
- Penny-local prompt owner [lib/penny-prompt-stack.js](../lib/penny-prompt-stack.js)

### 3. Formalize display-only transforms

Tag: `strengthen-now`

Why it matters:

- RisuAI's `Modify Display` concept is a genuinely clean separation Penny can learn from
- presentation-layer tweaks should not silently mutate canonical records or evidence

Practical implication:

- keep a sharper boundary between:
  - canonical stored text
  - request/transit shaping
  - display-only formatting or cosmetic cleanup

Best evidence:

- [Regex Script](https://github.com/kwaroran/RisuAI/wiki/Regex-Script)

### 4. Memory operations should be more object-like and statusful

Tag: `strengthen-now`

Why it matters:

- several memory systems outside Penny are strongest not because they "remember more," but because they expose IDs, statuses, and correction semantics
- Penny already has review-gated promotion and provenance, but the lifecycle language could become clearer

Practical implication:

- distinguish ingest / consolidate / retrieve / promote / reject / correct / delete as explicit operations
- give review targets stable IDs and clearer status/state semantics
- expose more exact correction/delete targeting instead of only coarse inspection/purge stories

Best evidence:

- [Memory & Personalization](https://docs.openwebui.com/features/chat-conversations/memory/)
- [memU](https://github.com/NevaMind-AI/memU)
- [MemOS](https://github.com/MemTensor/MemOS)

### 5. Evaluate forgetting on purpose

Tag: `strengthen-now`

Why it matters:

- many systems implicitly optimize retention but not forgetting quality
- Penny's current failures are not just "store more"; they are often retrieval drift, premise drift, and bad fallback behavior

Practical implication:

- separate memory evals into:
  - write quality
  - retrieval quality
  - forgetting/pruning quality
  - contradiction/correction quality

Best evidence:

- [Memory Maze](https://github.com/jurgisp/memory-maze)
- [evo-memory](https://github.com/SakanaAI/evo-memory)
- Penny-local QA posture in [docs/penny-research-master-synthesis-2026-04-16.md](./penny-research-master-synthesis-2026-04-16.md)

### 6. Tool and extension seams need explicit capability verification

Tag: `strengthen-now`

Why it matters:

- RisuAI issue threads show the difference between registration and actual execution support
- Open WebUI gives a better vocabulary for native tools, MCP, and OpenAPI-style bridges

Practical implication:

- verify separately:
  - tool declared
  - tool registered
  - provider/model route supports it
  - route executed successfully
  - result surfaced honestly

Best evidence:

- [RisuAI issue #1338](https://github.com/kwaroran/RisuAI/issues/1338)
- [Open WebUI Tools](https://docs.openwebui.com/features/extensibility/plugin/tools/)

## Strong Reinforcements, But Not Truly New

These sources strongly reinforce ideas Penny already holds:

- keep canonical explicit memory small and trusted
- keep archive memory additive and inspectable
- keep research continuity bounded
- keep provenance visible
- keep prompt context compact
- treat off-topic drift as a systems problem, not only a prompt-writing problem
- keep companion embodiment as a runtime presentation layer
- avoid platform sprawl

The outside ecosystems did not overturn any of those decisions.

## Weak or Poor-Fit Imports

These showed up as tempting patterns, but I do **not** think they are justified imports right now:

### Poor fit now

- generic plugin ecosystems as a product goal
- public scripting/regex languages for ordinary users
- multi-user redesign
- provider-agnostic platform ambition
- broad roleplay-scene/state-machine systems
- memory-OS expansion
- live self-modifying character/persona systems
- model-surgery memory research in production

### Maybe later, but only bounded

- user-authored memory-book editing
- background vectorization of current chat history
- knowledge/document-bank retrieval layers
- standards-based connector expansion
- utility-based pruning policies
- judged write/retrieve/forget eval suites

## Highest-Confidence Recommendation

If this report is used to create the next bounded plan later, the best target is **not** "replace Penny's memory system."

The best target is:

1. deepen prompt and provenance inspectability
2. separate research-source storage from user memory
3. make memory objects and operations more explicit
4. improve evaluation discipline around retrieval and forgetting
5. keep the product companion-first and local-first while doing all of the above

That is where the best evidence converged across these links.

## Suggested Tagging For Future Planning

Use this rubric when converting findings into actual work items:

- `already-landed`
  - maps to current Penny docs/code and should not be re-sold as a future concept
- `strengthen-now`
  - the core exists, but quality, visibility, or discipline should deepen
- `later`
  - plausible future seam, but only after current trust surfaces improve
- `poor-fit`
  - would flatten Penny into a generic platform or expand scope past the current product truth

## Source Appendix

The following groups reflect the provided source bundle. Duplicate URLs were collapsed for reachability checking, but every distinct provided URL was included in the pass.

### RisuAI

- [https://github.com/kwaroran/RisuAI/issues/1051?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/issues/1051?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki/Curly-Brased-Syntaxes?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki/Curly-Brased-Syntaxes?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki/Regex-Script?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki/Regex-Script?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki/%40-Syntaxes?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki/%40-Syntaxes?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki/SupaMemory?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki/SupaMemory?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki/Lorebook/768e5ec04d83dbf506ec6d5eb61b2fdf4f95112e?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki/Lorebook/768e5ec04d83dbf506ec6d5eb61b2fdf4f95112e?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/wiki/Plugin-Docs?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/wiki/Plugin-Docs?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI?utm_source=chatgpt.com)
- [https://github.com/kwaroran/Risuai?utm_source=chatgpt.com](https://github.com/kwaroran/Risuai?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/blob/main/README.md?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/blob/main/README.md?utm_source=chatgpt.com)
- [https://github.com/kwaroran/RisuAI/issues?utm_source=chatgpt.com](https://github.com/kwaroran/RisuAI/issues?utm_source=chatgpt.com)

### Open WebUI

- [https://docs.openwebui.com/features/chat-conversations/memory/?utm_source=chatgpt.com](https://docs.openwebui.com/features/chat-conversations/memory/?utm_source=chatgpt.com)
- [https://docs.openwebui.com/features/?utm_source=chatgpt.com](https://docs.openwebui.com/features/?utm_source=chatgpt.com)
- [https://docs.openwebui.com/features/chat-conversations/web-search/save-to-knowledge/?utm_source=chatgpt.com](https://docs.openwebui.com/features/chat-conversations/web-search/save-to-knowledge/?utm_source=chatgpt.com)
- [https://docs.openwebui.com/?utm_source=chatgpt.com](https://docs.openwebui.com/?utm_source=chatgpt.com)
- [https://docs.openwebui.com/reference/env-configuration/?utm_source=chatgpt.com](https://docs.openwebui.com/reference/env-configuration/?utm_source=chatgpt.com)
- [https://docs.openwebui.com/features/extensibility/plugin/tools/?utm_source=chatgpt.com](https://docs.openwebui.com/features/extensibility/plugin/tools/?utm_source=chatgpt.com)
- [https://docs.openwebui.com/mission/?utm_source=chatgpt.com](https://docs.openwebui.com/mission/?utm_source=chatgpt.com)

### Agnai

- [https://agnai.guide/docs/memory/embeddings.html?utm_source=chatgpt.com](https://agnai.guide/docs/memory/embeddings.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/memory/?utm_source=chatgpt.com](https://agnai.guide/docs/memory/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/memory/memory-books.html?utm_source=chatgpt.com](https://agnai.guide/docs/memory/memory-books.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/quick-start/?utm_source=chatgpt.com](https://agnai.guide/docs/quick-start/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/vocabulary/?utm_source=chatgpt.com](https://agnai.guide/docs/vocabulary/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/tips-tricks-and-troubleshooting/less-is-more.html?utm_source=chatgpt.com](https://agnai.guide/docs/tips-tricks-and-troubleshooting/less-is-more.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/chat-settings/?utm_source=chatgpt.com](https://agnai.guide/docs/chat-settings/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/library/scenarios?utm_source=chatgpt.com](https://agnai.guide/docs/library/scenarios?utm_source=chatgpt.com)
- [https://agnai.guide/docs/library/?utm_source=chatgpt.com](https://agnai.guide/docs/library/?utm_source=chatgpt.com)
- [https://agnai.guide/?utm_source=chatgpt.com](https://agnai.guide/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/tips-tricks-and-troubleshooting/off-topic-responses.html?utm_source=chatgpt.com](https://agnai.guide/docs/tips-tricks-and-troubleshooting/off-topic-responses.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/chat-settings/advanced-settings.html?utm_source=chatgpt.com](https://agnai.guide/docs/chat-settings/advanced-settings.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/creating-a-character/?utm_source=chatgpt.com](https://agnai.guide/docs/creating-a-character/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/running-locally/?utm_source=chatgpt.com](https://agnai.guide/docs/running-locally/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/tips-tricks-and-troubleshooting/random-and-roll.html?utm_source=chatgpt.com](https://agnai.guide/docs/tips-tricks-and-troubleshooting/random-and-roll.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/what-is-an-llm/context-and-context-limits.html?utm_source=chatgpt.com](https://agnai.guide/docs/what-is-an-llm/context-and-context-limits.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/what-is-an-llm/?utm_source=chatgpt.com](https://agnai.guide/docs/what-is-an-llm/?utm_source=chatgpt.com)
- [https://agnai.guide/docs/chat-settings/prompt-templates.html?utm_source=chatgpt.com](https://agnai.guide/docs/chat-settings/prompt-templates.html?utm_source=chatgpt.com)
- [https://agnai.guide/docs/tips-tricks-and-troubleshooting/?utm_source=chatgpt.com](https://agnai.guide/docs/tips-tricks-and-troubleshooting/?utm_source=chatgpt.com)

### SillyTavern

- [https://docs.sillytavern.app/usage/prompts/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/prompts/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/core-concepts/data-bank/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/core-concepts/data-bank/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/expression-images/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/expression-images/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/tags/vector-storage/?utm_source=chatgpt.com](https://docs.sillytavern.app/tags/vector-storage/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/?utm_source=chatgpt.com](https://docs.sillytavern.app/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/tags/vectors/?utm_source=chatgpt.com](https://docs.sillytavern.app/tags/vectors/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/chat-vectorization/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/chat-vectorization/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/core-concepts/worldinfo/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/core-concepts/worldinfo/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/prompts/cfg/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/prompts/cfg/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/core-concepts/instructmode/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/core-concepts/instructmode/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/st-script/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/st-script/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/faq/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/faq/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/captioning/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/captioning/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/core-concepts/personas/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/core-concepts/personas/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/vrm/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/vrm/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/core-concepts/macros/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/core-concepts/macros/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/tts/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/tts/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/live2d/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/live2d/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/extensions/regex/?utm_source=chatgpt.com](https://docs.sillytavern.app/extensions/regex/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/characters/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/characters/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/hotkeys/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/hotkeys/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/administration/multi-user/?utm_source=chatgpt.com](https://docs.sillytavern.app/administration/multi-user/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/?utm_source=chatgpt.com](https://docs.sillytavern.app/installation/st-1.12.0-migration-guide/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/for-contributors/writing-extensions/?utm_source=chatgpt.com](https://docs.sillytavern.app/for-contributors/writing-extensions/?utm_source=chatgpt.com)
- [https://docs.sillytavern.app/usage/prompts/prompt-manager/?utm_source=chatgpt.com](https://docs.sillytavern.app/usage/prompts/prompt-manager/?utm_source=chatgpt.com)

### External Memory Repos and Maps

- [https://github.com/jurgisp/memory-maze?utm_source=chatgpt.com](https://github.com/jurgisp/memory-maze?utm_source=chatgpt.com)
- [https://github.com/TeleAI-UAGI/Awesome-Agent-Memory?utm_source=chatgpt.com](https://github.com/TeleAI-UAGI/Awesome-Agent-Memory?utm_source=chatgpt.com)
- [https://github.com/uezo/chatmemory?utm_source=chatgpt.com](https://github.com/uezo/chatmemory?utm_source=chatgpt.com)
- [https://github.com/topics/long-term-memory?utm_source=chatgpt.com](https://github.com/topics/long-term-memory?utm_source=chatgpt.com)
- [https://github.com/SakanaAI/evo-memory?utm_source=chatgpt.com](https://github.com/SakanaAI/evo-memory?utm_source=chatgpt.com)
- [https://github.com/MemTensor/MemOS?utm_source=chatgpt.com](https://github.com/MemTensor/MemOS?utm_source=chatgpt.com)
- [https://github.com/NevaMind-AI/memU?utm_source=chatgpt.com](https://github.com/NevaMind-AI/memU?utm_source=chatgpt.com)

