# Penny External Research Late Batch II

Date: 2026-04-16

This note consolidates a second late batch of external research links into one Penny-specific synthesis artifact.

Scope is intentionally locked to synthesis:

- no runtime changes
- no prompt rewrites
- no QA reruns
- no memory-file mutations

This pass covers 16 external URLs plus one local metadata file supplied alongside the Zenodo record.

Normalization notes:

- all 16 external URLs were reachable in this pass; none were blocked or dead
- Reddit threads and comments are treated as low-confidence practitioner signals unless they point to stronger primary material
- the Zenodo record is the primary source for the RTE paper; the local file `C:/Users/malac/Downloads/19614078.json` was used as a provenance mirror, not as independent technical evidence
- this document follows the same house style as the master synthesis, but stays separate so the master note remains readable
- this is a synthesis document, not copied code or copied prompt text

## Executive Summary

This batch reinforces a pattern that has already been showing up across Penny research:

Penny does not need a more magical memory system.
She needs a better contract around retrieval quality, work continuity, bounded tools, and inspectable capability packaging.

The clearest convergences are:

1. `Retrieval quality should be judged by survival, not vibes`
  - The embedding-model discussions point toward recall-oriented evaluation, especially whether the right candidates survive early retrieval at all. [1][4]
  - A reranker cannot rescue a memory that never made it into the candidate set. [1]
  - Code search and conversational memory are not the same problem, and Penny should resist forcing them through one shared embedding/index strategy. [4]
2. `Continuity memory should preserve work product, not raw transcript`
  - The “agents keep forgetting” and repeated-research threads both describe the same pain: the system restarts the investigation instead of resuming it. [8][12]
  - The best abstraction for Penny is not “store more chat,” but “remember question -> evidence -> conclusion -> open follow-up.” [3][8][12]
  - This fits Penny’s current explicit-memory plus archive split better than importing a brand-new memory engine wholesale. [3][13]
3. `Stable resident lanes beat per-turn hot-swapping`
  - The ephemeral local pipeline discussion is useful mainly as a caution: just-in-time orchestration sounds elegant, but cold loads, warm-up, and churn are real costs. [2]
  - The Gemma 4 guide and the local benchmark thread both reinforce a practical lesson Penny already learned the hard way: shorter, bounded contexts and stable runtime wiring often beat “bigger context plus more cleverness.” [5][6]
4. `Tool safety belongs in code, not only in prompt text`
  - The Gemma `ls -R` thread is basically a warning label for prompt-only control of filesystem behavior. [16]
  - The right answer is safe primitives, bounded traversal, allowlisted wrappers, and project-map style tools, not stronger wording in the system prompt. [16]
  - This aligns with Penny’s current tool-lane direction and argues for more deterministic runtime constraints, not more open-ended shell freedom. [2][16]
5. `Skills are valuable when they are small, testable, and subordinate to repo truth`
  - The skills-directory and Cupel material argue for explicit capability packaging, clean activation rules, and judgeable outputs. [7][10][11]
  - The scraped-skills discussion also warns that giant imported skill corpora can override repo-local rules and produce drift. [10]
  - For Penny, the useful import is a curated repo-native skill layer, not a marketplace dump.
6. `Reasoning topology research is interesting, but it is a later experiment`
  - The RTE paper is a real signal that workflow shape matters and that parallel paths can outperform linear chains at the same call budget. [14][15][17]
  - It is not evidence that Penny should ship an evolved DAG runtime in the live companion loop.
  - The near-term lesson is “be deliberate about reasoning structure,” not “add graph search.”

Direct answers to the big Penny questions from this batch:

- `What should strengthen long-term memory without bloating prompts?`
  - recall-oriented retrieval evals
  - work-product memory ledgers
  - separate treatment for code retrieval vs conversational memory
  - provenance- and confidence-aware retrieval policy instead of raw semantic matches
- `What should improve provenance, contradiction handling, and identity continuity?`
  - remembering what was checked and concluded
  - reviewable promotion paths
  - better distinction between strong canonical facts and soft advisory memory
  - richer trace artifacts that show rejected as well as accepted evidence
- `What should preserve Penny's funniest, most human reactions without making her bland?`
  - stable resident lanes instead of runtime churn
  - bounded context windows that keep the model focused
  - stronger runtime tool safety so Penny can be sharp without bluffing or wandering
  - skill packaging that supports her behavior instead of fighting it
- `What should preserve Penny's chat/tool split rather than collapsing it?`
  - keep the lane split
  - keep a bounded tool lane with safer primitives
  - keep model routing stable and avoid per-turn hot-swapping as a default
  - keep “agentic” behavior as controlled orchestration, not always-on autonomy
- `What should be deferred because it is hype, overbuilt, or not locally verifiable?`
  - giant skills imports
  - per-turn ephemeral model orchestration
  - evolved reasoning DAG search in the live runtime
  - one-index-fits-all retrieval for both repo/code search and conversational memory

The strongest concrete import from this batch is a `topic-level research ledger`:

Penny should get better at remembering the state of an investigation, not just the words inside it.

## Source Matrix

Confidence tier rubric:

- `High`: primary docs, repos, or records with concrete mechanisms or directly inspectable implementation details
- `Medium`: strong practitioner writeups or detailed benchmarks that are still self-reported or environment-specific
- `Low`: Reddit comments, removed posts, or narrow anecdotal claims that are still directionally useful


| #   | Source                                                                                                                                                                                                                                                                              | Type                    | Confidence | Core claim                                                                                                                           | Penny relevance                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| 1   | [Harrier-27B vs Voyage-4 vs zembed-1 benchmark](https://www.reddit.com/r/LocalLLaMA/comments/1siisn2/i_compared_harrier27b_vs_voyage4_vs_zembed1/?share_id=53c8VBJG9HNhx5_p-h-3w&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)              | Reddit benchmark thread | Medium     | Retrieval should be judged by downstream recall and candidate survival; smaller embed models can still win recall-heavy comparisons. | Supports recall-oriented evals for Penny semantic memory.                                  |
| 2   | [Experimenting with ephemeral local LLM pipelines](https://www.reddit.com/r/LocalLLaMA/comments/1sh5a6h/experimenting_with_ephemeral_local_llm_pipelines/?share_id=r8YSkM0cQqGpqlR1e9QSs&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)      | Reddit discussion       | Low        | Just-in-time local orchestration is interesting, but hot-swapping and lazy-loading assumptions break down in practice.               | Argues for stable resident lanes instead of routine unload/reload churn.                   |
| 3   | [Comment on large-repo retrieval](https://www.reddit.com/r/LocalLLaMA/comments/1sgt2ii/comment/of7ltdi/?share_id=FdKT8LKu-2eH5emoE7ffk&utm_content=2&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)                                                        | Reddit comment          | Low        | Large-repo work needs better retrieval than grep; hybrid retrieval and indexing matter.                                              | Supports separate code-search treatment and better research continuity.                    |
| 4   | [Best embedding model for code search in custom agent](https://www.reddit.com/r/LocalLLaMA/comments/1sfkjxz/best_embedding_model_for_code_search_in_custom/?share_id=ERmVG5uo1RSGHrp3YSXcm&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)    | Reddit thread           | Low        | Code-search embedding needs differ from general semantic recall.                                                                     | Reinforces splitting code retrieval from conversational memory retrieval.                  |
| 5   | [M5 Max benchmark: Qwen 3.5 122B vs Gemma family](https://www.reddit.com/r/LocalLLaMA/comments/1sfr6u4/m5_max_128gb_17_models_23_prompts_qwen_35_122b_is/?share_id=qWcCKA1gAuFPNdG9PFqhH&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)      | Reddit benchmark thread | Medium     | Model/runtime pairing and tool scaffolding matter as much as raw size.                                                               | Directional evidence for bounded tool-lane model choices and practical context limits.     |
| 6   | [A Visual Guide to Gemma 4](https://newsletter.maartengrootendorst.com/p/a-visual-guide-to-gemma-4)                                                                                                                                                                                 | Technical explainer     | Medium     | Gemma 4 uses mixed local/global attention and efficient mechanisms for larger contexts, but efficiency still has real runtime costs. | Supports Penny’s shorter-context baseline and efficient tool-lane use of E4B-class models. |
| 7   | [cupel](https://github.com/tolitius/cupel)                                                                                                                                                                                                                                          | GitHub repo             | High       | Capability evaluation should have explicit adapters, scored runs, and judge reasoning instead of living only in prompts.             | Good model for Penny eval hooks, capability surfaces, and judged outputs.                  |
| 8   | [My agents keep forgeting](https://www.reddit.com/r/LocalLLaMA/comments/1sc8xx2/my_agents_keep_forgeting/?share_id=15DyE6xvq-NBIat7r6wRl&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)                                                      | Reddit thread           | Low        | Users want continuity across sessions, not repeated re-discovery.                                                                    | Supports work-product memory and wake-state continuity.                                    |
| 9   | [What people are actually building with AI agent skills](https://www.reddit.com/r/LocalLLaMA/comments/1sbf60j/what_people_are_actually_building_with_ai_agent/?share_id=E83yg22Bh7uacQHf04K6U&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1) | Reddit thread           | Low        | Real agent products benefit from clearer orchestration boundaries, narrow tasks, and inspectable control.                            | Supports bounded tool lanes and runtime enforcement over autopilot.                        |
| 10  | [Scraped 90k skills from skills.sh](https://www.reddit.com/r/cursor/comments/1sbfb4k/scraped_90k_skills_from_skillssh_trying_to_find/?share_id=qgkIeqT_LdKctOhqbUs99&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)                          | Reddit thread           | Low        | Giant skill imports create drift and can override repo-local rules.                                                                  | Warning against bulk skill ingestion without precedence rules.                             |
| 11  | [Antigravity Skills Directory](https://antigravityskills.directory/)                                                                                                                                                                                                                | Skills directory        | Medium     | Skills are most useful when they are searchable, composable, and clearly bounded.                                                    | Good structural model for a tiny Penny-native skill registry.                              |
| 12  | [Repeated AI research across sessions](https://www.reddit.com/r/LocalLLaMA/comments/1snab5d/does_anyone_also_face_repeated_ai_research_across/?share_id=qLH71FJQOOJBmW4bN8jgk&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)                 | Reddit thread           | Low        | Repeated research is a continuity failure, not just a prompt failure.                                                                | Strong argument for a research ledger and “already checked” memory.                        |
| 13  | [Memorie-AI](https://github.com/tazwaryayyyy/Memorie-AI)                                                                                                                                                                                                                            | GitHub repo             | High       | A memory engine benefits from policy layers like trust, uncertainty, and lifecycle state on top of raw semantic recall.              | Useful for retrieval policy ideas, but not for replacing Penny’s canonical/archive design. |
| 14  | [Evolved reasoning DAG structures thread](https://www.reddit.com/r/LocalLLaMA/comments/1sna27a/evolved_reasoning_dag_structures_for_a_15b_model/?share_id=AVwPEXnAix15PbOjH9RhL&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)               | Reddit thread           | Low        | Workflow topology can matter as much as call budget.                                                                                 | Pointer to later orchestration experiments, not a near-term import.                        |
| 15  | [Zenodo record: Reasoning Topology Evolution](https://zenodo.org/records/19614078)                                                                                                                                                                                                  | Preprint record         | High       | Evolved reasoning DAGs can outperform linear chains in a constrained benchmark, but complexity can also hurt if structure is poor.   | Supports later fixed-topology experiments, not live-runtime graph search.                  |
| 16  | [Gemma4 quirk to use ls -R; can we do better?](https://www.reddit.com/r/LocalLLaMA/comments/1sn9zc0/gemma4_quirk_to_use_ls_r_can_we_do_better/?share_id=iPNaksmbS7-CqCq_WqaNA&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)                 | Reddit thread           | Low        | Prompt-only tool safety is brittle; narrow wrappers and traversal limits are better.                                                 | Reinforces safe tool primitives and bounded project-map commands.                          |
| 17  | [19614078.json](C:/Users/malac/Downloads/19614078.json)                                                                                                                                                                                                                             | Local metadata file     | Medium     | Confirms provenance and metadata for the Zenodo RTE record.                                                                          | Citation hygiene and traceability for the paper source.                                    |


## Penny Applicability

### Memory / Retrieval

The memory-side lesson from this batch is unusually clear:

Penny should remember the state of work, not just the text that happened around the work. [3][8][12]

The most promising imports are:

- `Topic-level research ledgers`
  - Store `question`, `evidence used`, `conclusion reached`, and `open follow-up`.
  - This gives Penny a way to resume an investigation without re-running it from scratch. [8][12]
- `Recall-first retrieval evaluation`
  - Add semantic-memory evals that explicitly check whether the right candidate survives early retrieval at all.
  - Favor `recall@K`, candidate survival, and contradiction-sensitive retrieval, not only later rerank quality. [1][13]
- `Different retrieval policies for different domains`
  - Code search should not automatically inherit the same embed/index strategy as conversational memory or archive recall. [3][4]
  - If Penny’s repo inspection keeps growing, code retrieval may deserve its own lane, index, or reranker policy.
- `Confidence-aware advisory memory`
  - Borrow the policy-layer instinct from Memorie-AI without copying its lifecycle model wholesale. [13]
  - The useful concept is distinguishing `strong`, `soft`, and `uncertain` retrieval signals while leaving canonical truth small and reviewable.

Best near-term fit for Penny:

- keep explicit memory canonical
- keep archive additive and review-gated
- improve retrieval policy and traceability on top of that

### Tool And Lane Architecture

This batch strongly supports Penny’s current architectural instinct:

keep the chat lane and tool lane split, and make the tool lane safer and narrower instead of more autonomous. [2][5][9][16]

The strongest imports are:

- `Resident lanes over routine hot-swapping`
  - Stable loaded lanes beat clever unload/reload churn on local hardware. [2]
  - Hot-swapping is still useful as an exception path, not as the default rhythm.
- `Bounded, explicit tool primitives`
  - Replace generic recursive shell habits with safe wrappers, depth limits, and project-map style tools. [16]
  - This matters because prompt text is not a dependable enforcement boundary. [16]
- `Model choice by controllability and fit, not only size`
  - Hardware-specific benchmark threads are not decisive, but they reinforce that runtime wiring and task fit matter as much as raw model size. [5]
  - That is a good fit for Penny’s `Q6 chat + E4B tool` style reasoning.

### Observability And Evals

Cupel is the standout source here. [7]

The useful lesson is not “adopt Cupel.”
It is “treat capabilities as explicit surfaces with scored outputs and judgeable contracts.”

That suggests:

- `Judgeable capability evals`
  - Memory retrieval, repo honesty, tool correctness, and premise resistance should each have explicit acceptance bars. [7]
- `Trace artifacts that show rejected paths`
  - Not only what evidence was used, but what was considered and rejected. [7][13]
- `Environment-aware eval discipline`
  - The more local and orchestration-heavy Penny gets, the more evals need to record runtime state and not quietly mix invalid environments into product conclusions. [2][5][7]

### Workflow / Skills

The skills ecosystem material gives Penny a useful direction with a very strong caution attached. [7][10][11]

Import:

- a tiny repo-native skill registry
- narrow leaf skills
- clear activation conditions
- declared inputs and outputs
- explicit “use / do not use” boundaries

Reject:

- giant marketplace imports
- prose-only skills with no executable backing
- skill packs that override repo-local guidance or persona contracts

Best Penny-shaped version:

- one light orchestrator layer
- a few narrow operational skills for memory inspection, LM Studio readiness, QA/release, browser checks, and prompt editing [7][11]

### Offline Learning / Later Experiments

The reasoning-topology work belongs here. [14][15][17]

Useful lesson:

- fixed structure can beat linear chains
- parallel retrieval or parallel evidence checks might be worth benchmarking later

Not useful right now:

- evolutionary DAG search in the live runtime
- hidden multi-branch orchestration inside ordinary companion turns
- treating a narrow arithmetic benchmark as direct proof for Penny’s workload

Best bounded import:

- later benchmark a small number of fixed Penny-shaped topologies on repo inspection or retrieval tasks, rather than shipping graph search

## Rejected Or De-Weighted Ideas

This batch had several ideas that were interesting, but wrong-fit or prematurely seductive for Penny:

1. `Per-turn ephemeral local orchestration as a default`
  - Too sensitive to cold starts, warm-up, and load churn on local hardware. [2]
2. `One embedding/index strategy for every kind of retrieval`
  - Code search, conversational continuity, and canonical memory lookup are different jobs. [3][4][13]
3. `Mass skill ingestion`
  - The shape is useful; the bulk is not. Large imported corpora create drift, precedence bugs, and style pollution. [10][11]
4. `Prompt-only filesystem safety`
  - The Gemma `ls -R` discussion is a pretty direct warning against trusting prompt wording to constrain shell behavior. [16]
5. `Graph-search reasoning in the live companion loop`
  - The RTE work is real research, but it is not near-term product evidence for Penny. [14][15]

## Candidate Follow-Ups

Ranked in likely order of value:

1. `Add a topic-level research ledger to Penny memory`
  - Store `question`, `evidence`, `conclusion`, and `open follow-up`.
  - This is the single clearest import from the forgetting and repeated-research sources. [3][8][12]
2. `Upgrade semantic-memory evals to include recall-first metrics`
  - Add `recall@K`, candidate survival, and contradiction-aware retrieval checks before reranking. [1][13]
3. `Separate code-search retrieval from conversational/archive retrieval`
  - Keep the current human-memory stack intact, but stop assuming repo inspection wants the same retrieval policy. [3][4]
4. `Add or harden safe project-map / bounded traversal tools`
  - Reduce the chance of dumb recursive filesystem explosions and make large-project inspection more deterministic. [16]
5. `Create a tiny Penny-native skill registry`
  - Not a marketplace.
  - A small curated layer over already-real scripts and modules, with activation metadata and explicit limits. [7][10][11]
6. `Later: benchmark one or two fixed structured-reasoning patterns`
  - Only on bounded repo/retrieval tasks.
  - No evolved DAG runtime in ordinary chat. [14][15]

## Recommendation

One concrete next-step recommendation comes out of this batch more clearly than anything else:

Build a `research continuity ledger` for Penny before adding more retrieval cleverness.

Why this first:

- it directly addresses the “redoing the same research” failure mode [8][12]
- it strengthens long-term memory without bloating the prompt [3][8][12]
- it gives better traceability for later semantic-memory eval work [1][13]
- it helps Penny feel more human by resuming investigations instead of forgetting them

Practical shape:

- a bounded per-topic record
- explicit evidence references
- conclusion state
- contradiction/open-question state
- inspector-visible trace
- no auto-promotion into canonical fact memory

That is the highest-signal import from this batch.

The `OFF vs synthesis-only` compare is still worth doing after this research pass, but it should be treated as a separate runtime decision gate, not as the primary conclusion from these sources.

## Sources

[1] [Harrier-27B vs Voyage-4 vs zembed-1 benchmark](https://www.reddit.com/r/LocalLLaMA/comments/1siisn2/i_compared_harrier27b_vs_voyage4_vs_zembed1/?share_id=53c8VBJG9HNhx5_p-h-3w&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[2] [Experimenting with ephemeral local LLM pipelines](https://www.reddit.com/r/LocalLLaMA/comments/1sh5a6h/experimenting_with_ephemeral_local_llm_pipelines/?share_id=r8YSkM0cQqGpqlR1e9QSs&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[3] [Comment on large-repo retrieval](https://www.reddit.com/r/LocalLLaMA/comments/1sgt2ii/comment/of7ltdi/?share_id=FdKT8LKu-2eH5emoE7ffk&utm_content=2&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[4] [Best embedding model for code search in custom agent](https://www.reddit.com/r/LocalLLaMA/comments/1sfkjxz/best_embedding_model_for_code_search_in_custom/?share_id=ERmVG5uo1RSGHrp3YSXcm&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[5] [M5 Max benchmark: Qwen 3.5 122B vs Gemma family](https://www.reddit.com/r/LocalLLaMA/comments/1sfr6u4/m5_max_128gb_17_models_23_prompts_qwen_35_122b_is/?share_id=qWcCKA1gAuFPNdG9PFqhH&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[6] [A Visual Guide to Gemma 4](https://newsletter.maartengrootendorst.com/p/a-visual-guide-to-gemma-4)  
[7] [cupel](https://github.com/tolitius/cupel)  
[8] [My agents keep forgeting](https://www.reddit.com/r/LocalLLaMA/comments/1sc8xx2/my_agents_keep_forgeting/?share_id=15DyE6xvq-NBIat7r6wRl&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[9] [What people are actually building with AI agent skills](https://www.reddit.com/r/LocalLLaMA/comments/1sbf60j/what_people_are_actually_building_with_ai_agent/?share_id=E83yg22Bh7uacQHf04K6U&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[10] [Scraped 90k skills from skills.sh](https://www.reddit.com/r/cursor/comments/1sbfb4k/scraped_90k_skills_from_skillssh_trying_to_find/?share_id=qgkIeqT_LdKctOhqbUs99&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[11] [Antigravity Skills Directory](https://antigravityskills.directory/)  
[12] [Repeated AI research across sessions](https://www.reddit.com/r/LocalLLaMA/comments/1snab5d/does_anyone_also_face_repeated_ai_research_across/?share_id=qLH71FJQOOJBmW4bN8jgk&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[13] [Memorie-AI](https://github.com/tazwaryayyyy/Memorie-AI)  
[14] [Evolved reasoning DAG structures thread](https://www.reddit.com/r/LocalLLaMA/comments/1sna27a/evolved_reasoning_dag_structures_for_a_15b_model/?share_id=AVwPEXnAix15PbOjH9RhL&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[15] [Zenodo record: Reasoning Topology Evolution](https://zenodo.org/records/19614078)  
[16] [Gemma4 quirk to use ls -R; can we do better?](https://www.reddit.com/r/LocalLLaMA/comments/1sn9zc0/gemma4_quirk_to_use_ls_r_can_we_do_better/?share_id=iPNaksmbS7-CqCq_WqaNA&utm_content=1&utm_medium=android_app&utm_name=androidcss&utm_source=share&utm_term=1)  
[17] [19614078.json](C:/Users/malac/Downloads/19614078.json)