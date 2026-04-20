# Penny Docs + Live QA Agent Brief

> Category: Interpretive brief
> Authority: Strong guidance
> Status: Needs verification
> Use this for: a synthesized reading of the docs folder plus live-QA framing.
> Do not use this for: current repo law or exact repo-state claims without checking [README.md](../README.md), [CODEBASE.md](../CODEBASE.md), [ARCHITECTURE.md](../ARCHITECTURE.md), and [penny-runtime-authority-contract-2026-04-17.md](./penny-runtime-authority-contract-2026-04-17.md).

Prepared from the latest uploaded `Penny.zip` plus the attached screenshots and prior review context in this chat.

Snapshot note: the zip’s root git log appears to advance past `a72747860d1d64ef69223b2055ffe9ecbad72cc6` to `3656d45b8f225966215914b0b092a970289a5415` with commit message `Harden Penny write-loop truth and capture QA docs`. I did not independently verify private GitHub; this brief treats the uploaded zip as the available repo snapshot.

This document is written for Penny agents. It is not a brutal code review. It is a product/architecture explanation, a docs-folder interpretation, and a practical live-QA advisory.

---

## Executive Summary

Penny’s docs folder is not merely documentation. It is Penny’s architectural memory: it records why the project became a local, single-user, companion-first runtime with canonical explicit memory, advisory archive recall, bounded research continuity, prompt-truth receipts, and reasoning-policy canaries.

The docs show a clear arc:

1. Penny starts as a vivid local companion, not a generic assistant.
2. The architecture learns that memory needs authority levels.
3. Archive memory becomes useful but explicitly non-canonical.
4. Research continuity becomes a separate ledger rather than being stuffed into personal memory.
5. Prompt assembly becomes inspectable because observability itself can lie.
6. “More thinking” becomes a runtime risk, not an automatic upgrade.
7. The current live-QA question is no longer merely “is Penny truthful?” but “can Penny stay truthful without becoming lawyerly, polished, and dead?”

The most important current interpretation:

> Penny’s truth machinery is directionally right, but larger/thinking models can over-read that machinery as a legal brief. For chat-lane quality, especially chemistry/possessiveness/mean-warm banter, model-side thinking should be treated as suspicious until proven useful. Q8 thinking-off deserves to be tested as the likely premium chat default; Q6 remains a strong fallback because it appears less self-editing and more instinctive.

The highest-leverage next action in the original brief was a bounded tiebreak eval between **Q8 thinking-off** and **Q6**, with Q8 thinking-on kept as a negative/control condition for “lawyerly over-editing.” That framing was correct at the time, but the April 18, 2026 live QA substantially changed the story.

Working update after that live QA:

- treat **Q8 thinking-off** as the leading premium chat candidate
- treat **Q6** as the fallback / baseline
- treat **Q8 thinking-on** as a control or non-default chat mode

So the remaining high-leverage question is narrower now: spirit-first recall, caveat order, exact explicit recall, and whether Q8 thinking-off stays strong outside the original possessive benchmark.

---

# Part 1 — What the `docs/` Folder Is Doing

## My overall opinion

The `docs/` folder is unusually important for Penny. It does not just explain code. It preserves product boundaries that code agents are very likely to erode by accident.

The strongest repeated doctrine is:

- Penny is companion-first.
- Penny is local-first.
- Explicit memory is canonical.
- Archive/books/ledger are advisory unless promoted.
- Tool/evidence claims must be verified.
- Reasoning stays backstage.
- Penny should not become a generic agent platform, SaaS product, memory OS, or sterile assistant.

That repetition is not wasted. In an AI-agent-developed project, repeated constraints are a survival mechanism.

The risk is that the docs folder can become a second haunted memory system. There are governing contracts, old review artifacts, public-facing docs, raw research extracts, implementation plans, and synthesis essays all living near each other. Agents need to know which docs are current law and which are historical evidence.

My recommendation for agents:

- Treat `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, and `docs/penny-runtime-authority-contract-2026-04-17.md` as the current entrypoint set.
- Treat the big synthesis docs as architectural rationale.
- Treat plans as bounded-slice instructions, not permanent law.
- Treat review docs as historical pressure tests unless explicitly promoted.
- Treat raw research extracts as source material only after reading the Penny-specific synthesis that interprets them.

---

## The main classes of docs

### 1. Governing contract docs

Most important:

- `docs/penny-runtime-authority-contract-2026-04-17.md`

This is current-law material. It states the runtime authority hierarchy plainly:

- runtime voice assets define Penny’s identity
- explicit memory is canonical
- archive/books/ledger are advisory
- visible-reply cleanup is not a truth authority layer
- reasoning stays backstage
- `promptTruth` is literal prompt-time truth
- post-reply ledger mutation belongs in `researchLedgerUpdate`
- recent audit trail and QA canaries are diagnostics, not new authority layers

Relevant lines: `docs/penny-runtime-authority-contract-2026-04-17.md:3-23`.

### 2. Master synthesis docs

Important examples:

- `docs/penny-research-master-synthesis-2026-04-16.md`
- `docs/penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md`
- `docs/penny-progress-handoff-2026-04-17.md`

These docs are not implementation specs. They are the project’s high-level architecture memory. They explain why Penny’s current shape exists.

The bounded-ambiguity master is especially important. It says Penny’s runtime has two kinds of complexity: voice complexity and memory complexity. Its blunt take is that memory has clearer boundaries than voice right now, while voice is aesthetically strong but brittle because it depends on overlapping steering layers and post-generation cleanup. See `docs/penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md:172-186`.

That warning matters a lot after the live QA results. The memory stack is getting increasingly truthful. The voice stack is where larger/thinking models may now be over-regularized.

### 3. Research synthesis docs

Important examples:

- `docs/penny-memory-external-research-synthesis-2026-04-16.md`
- `docs/penny-external-llm-research-pass.md`
- `docs/penny-comparative-platform-memory-pass-2026-04-16.md`
- `docs/penny-web-source-lessons-report-2026-04-17.md`
- `docs/penny-weighted-automata-lessons-report-2026-04-17.md`
- `docs/penny-illusion-of-thinking-lessons-2026-04-18.md`

These docs are best understood as translation layers. They do not say “copy external architecture.” They say “what does this research imply for Penny’s very specific companion-first product?”

The best examples translate research into constraints:

- context should be assembled, not accumulated
- provenance matters
- scores are not truth
- canonicalize before compressing
- trace-aware QA beats final-answer-only scoring
- more thinking is not a free upgrade

### 4. Review/audit docs

Important examples:

- `docs/penny-memory-archive-audit.md`
- `docs/penny-companion-first-external-review-rewrite-2026-04-16.md`
- `docs/penny-review-2026-04-18.md`
- `docs/penny-review-commit-5c08ac0.md`

These are not law by themselves. They are pressure-test artifacts. They matter because they caught real architecture drift.

The best example: the prior review caught that the system could behave correctly while receipts claimed advisory context was injected when it was only selected or mutated after the turn. That review directly led to prompt assembly becoming the source of truth for `promptTruth`.

### 5. Bounded implementation plans

Important examples:

- `docs/plans/penny-memory-truth-hardening-2026-04-17.md`
- `docs/plans/penny-research-ledger-release-cycle-2026-04-16.md`
- `docs/plans/penny-weighted-automata-followthrough-2026-04-17.md`
- `docs/plans/penny-illusion-of-thinking-followthrough-2026-04-18.md`

These are good agent handoff docs because they include goals, success criteria, locked decisions, blind spots, out-of-scope lists, files to read, tests to run, and what would count as drift.

The illusion-of-thinking followthrough plan is especially relevant now. It explicitly warns that reasoning-budget tightening could accidentally make Penny stiffer or more bureaucratic on ordinary chat turns. See `docs/plans/penny-illusion-of-thinking-followthrough-2026-04-18.md:27-35`.

### 6. Public-facing docs

Important examples:

- `docs/penny-public/penny-for-humans.md`
- `docs/penny-public/how-to-use-penny.md`
- `docs/penny-public/reddit-post.md`
- `docs/penny-public/visual-direction.md`

These are not runtime contracts, but they matter because they preserve what Penny is supposed to feel like. They help prevent agents from optimizing her into a generic assistant with better telemetry.

### 7. Raw or source-adjacent research docs

Example:

- `docs/2506.06941v3.agent.md`

This is raw extracted material. Agents should not treat it as Penny-specific guidance until they read the Penny-specific interpretation in `docs/penny-illusion-of-thinking-lessons-2026-04-18.md`.

---

# Part 2 — How the Docs Shaped Penny’s Architecture Over Time

## Arc 1: Penny is a character product, not a neutral assistant

The public docs and runtime voice docs establish that Penny is not “ChatGPT with sass.” She is intended to feel like a specific person: sharp, warm, funny, bossy, flirt-capable, and alive.

This shaped architecture by making voice a runtime surface instead of a cosmetic UI skin. The repo has:

- `penny-voice/runtime/penny-operational-blend.md`
- `penny-voice/runtime/penny-chat-directives.md`
- `penny-voice/runtime/penny-voice-examples.md`
- `penny-voice/runtime/penny-overlays.json`

The operational blend says Penny should be “a vivid person, not a neutral assistant with fake edge taped on,” and that she should default to alive language rather than polished helper language. See `penny-voice/runtime/penny-operational-blend.md:3-15`.

That one product decision explains why Penny has a chat lane, why the prompt stack loads voice assets, why model choice matters for tone, and why over-lawyerly answers count as product failures even when technically correct.

## Arc 2: Memory needed a monarchy, then a constitution

The memory archive audit identified a key danger: archive memory could become “the new monarchy.” The fix was not to remove archive memory. The fix was to put it below explicit memory in the authority hierarchy.

The resulting architecture:

- explicit memory lives as canonical user facts/settings
- archive memory stores episodes, summaries, contradictions, and review candidates
- archive memory is additive and reviewable
- archive does not silently overwrite explicit facts
- promotion from archive to canon is review-gated

This is visible in the current README’s runtime truth section: canonical explicit facts in `data/penny-memory.json`, archive/semantic recall in archive/embedding files, bounded research ledger, and archive as additive/reviewable rather than silently overwriting explicit facts. See `README.md:34-44`.

## Arc 3: Borrow from character platforms, but do not become one

The native memory/character pass imported small useful mechanisms from companion/chat platforms: scoped memory books, prompt-slot registry, compression fallback, and expression pack structure.

It rejected the gravitational pull toward generic lorebook/platform/plugin systems.

This shaped Penny’s middle architecture:

- she has memory books, but not a giant platform lorebook OS
- she has prompt slots, but not one massive prompt blob
- she has expression/mood surfaces, but not presentation pretending to be truth
- she has tools, but not broad autonomous connector sprawl

This is one of the healthiest patterns in the docs: borrow mechanisms, reject product drift.

## Arc 4: Structure beats raw context

The external LLM research docs repeatedly converge on one point: bigger context is not the same as better context.

This produced:

- slot-based prompt assembly
- lane-aware prompt assets
- latency budgets
- semantic retrieval with fallback receipts
- compact memory blocks
- holdback reasons
- `promptTruth`

The current prompt stack reflects this. It has named prompt slots such as `voiceBlend`, `directives`, `overlays`, `examples`, and `memory`, and the stack returns both prompt content and prompt-truth receipt. See `lib/penny-prompt-stack.js` and `docs/penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md:252-270`.

## Arc 5: Research continuity became a ledger, not personal memory

The late research synthesis introduced a crucial abstraction: remember work product, not raw transcript.

In practice, that means research continuity should track:

- question
- evidence
- conclusion
- open follow-up

That became `lib/penny-research-ledger.js`.

The important philosophical/engineering boundary: the research ledger is not general relational memory. It is not “Penny remembers everything.” It is a bounded notebook for investigations.

The ledger prompt compare note is important here. Earlier AI guidance treated live ledger prompt injection as a cuttable subsystem. Human pushback argued Penny should prefer cautious continuity over sterile amnesia when bounded evidence exists. A later local compare found bounded but real wins for keeping the ledger bridge on, followed by the right refinement: keep it, tighten relevance. See `docs/penny-ledger-prompt-compare-note-2026-04-17.md:7-12` and `:87-112`.

That is a very Penny-shaped architectural decision: do not delete continuity just because it is risky; bound it, measure it, and keep it honest.

## Arc 6: PromptTruth became necessary because observability itself can lie

The reviews exposed a subtle failure: actual prompt assembly could hold back advisory context, while artifacts and inspector summaries claimed it had been injected.

The fix was architectural: prompt assembly must emit the literal truth about what rendered.

The authority contract now says:

- `promptTruth` is the literal prompt-time receipt
- it records candidate vs rendered counts/source IDs and holdback reasons
- compatibility fields like `researchLedgerPromptInjected` now mean actually rendered, not merely selected
- authority-pressure, advisory-merge, QA witness, inspector summaries, and retrieval-trace injection should derive from rendered `promptTruth`
- post-reply ledger mutation belongs separately in `researchLedgerUpdate`

See `docs/penny-runtime-authority-contract-2026-04-17.md:12-14`.

This is not academic. It came from a concrete observability bug.

## Arc 7: “More thinking” became a product risk

The illusion-of-thinking docs are directly relevant to current live QA.

The report’s core lesson is:

> more thinking is not a free upgrade

It recommends:

- simple tasks stay simple
- medium tasks may benefit from deliberate reasoning
- exact/stateful tasks should use tools and validators
- hard tasks should fail honestly instead of burning tokens in self-correction theater

See `docs/penny-illusion-of-thinking-lessons-2026-04-18.md:29-40`.

The followthrough plan translated that into reasoning-budget policy, verifier-first exactness, overthinking/fixation detection, and trace-aware QA. It also warned that this could make Penny stiffer or more bureaucratic if misapplied. See `docs/plans/penny-illusion-of-thinking-followthrough-2026-04-18.md:3-35`.

The current live-QA observations fit that warning almost perfectly.

---

# Part 3 — Specific Material vs Academic Synthesis

Some Penny decisions clearly came from one or two specific docs. Others came from synthesis across many docs.

## Decisions with specific source material

### Scoped memory books / prompt-slot registry / expression-pack concepts

These come most clearly from the native memory/character pass and comparative platform work. Penny borrowed small mechanisms from companion platforms while rejecting the platform shape.

### Research ledger

This comes from the late research synthesis and ledger release-cycle plan. The key abstraction was: research continuity should remember question/evidence/conclusion/follow-up, separate from personal memory.

### Ledger prompt bridge

This came from a specific product debate plus a specific compare artifact. Earlier guidance said “maybe cut live ledger prompt injection.” Human pushback said “do not choose sterile amnesia.” The compare note then supported keeping the bridge, bounded and relevance-tightened.

### PromptTruth closure

This came from a concrete review finding: receipts were overstating prompt use. The contract was changed so prompt assembly became the source of prompt-truth receipts.

### ReasoningPolicy / fixation canaries

These come from the illusion-of-thinking lessons and followthrough plan. The material did not say “make Penny a reasoning benchmark.” It said “more thinking can be wasteful or harmful; track execution posture and avoid hidden overthinking.”

## Decisions that are mostly synthesis

### Canonical vs advisory memory

This is the central synthesis of the docs folder. It appears in the memory audit, external memory research, bounded-ambiguity master, progress handoff, and runtime authority contract.

No single quote created it. The repeated convergence did.

### Anti-platformization

This is also synthesis. Many docs reject turning Penny into:

- a generic agent platform
- a multi-user SaaS
- a memory OS
- a connector hub
- a plugin marketplace
- a lorebook clone

This is product philosophy translated into engineering boundaries.

### Trace-first QA

Trace-first QA comes from research synthesis, web-source lessons, weighted-automata lessons, prior reviews, and implementation plans. The repeated idea is that final answers are not enough. Agents need traces that show route, memory authority, prompt use, evidence, and first drift.

### Bounded ambiguity

This is a hybrid. The phrase and doctrine are synthesized, but the ledger bridge decision is specific.

The principle: Penny should be able to carry tentative continuity without overclaiming.

The mechanism: archive, ledger, promptTruth, provenance, recent audit trail, and QA canaries.

---

# Part 4 — Are Penny’s Decisions Philosophical?

Yes. Strongly.

They are philosophical at the vision level and at the engineering level.

## Philosophical at the vision level

Penny is asking a question most LLM apps avoid:

> How can a companion feel alive and continuous without faking certainty?

That question is not merely technical. It is about what kind of remembered presence Penny is allowed to be.

The docs reject several easy extremes:

- total amnesia
- fake certainty
- generic assistant blandness
- automatic memory mutation
- endless agent sprawl
- hidden self-improvement
- exposed chain-of-thought performance
- sterile refusal-machine behavior

The bounded-ambiguity master states the product tension clearly: Penny is not a sterile auditor, court stenographer, or refusal machine wearing a cute skin. She needs room for tentative continuity and bounded inference, but without turning uncertainty into overclaiming. See `docs/penny_runtime_voice_memory_bounded_ambiguity_master_2026-04-17.md:1430-1472`.

That is philosophical.

## Philosophical at the engineering level

The engineering decisions also encode values.

### Explicit memory being canonical is philosophical

Penny could have been built as “retrieve whatever vector memory scores highest.” She was not.

The system says explicit memory wins. Archive advises. Ledger supports. Scores do not become truth.

That encodes the value:

> A companion should not casually overwrite what the user deliberately told her.

### Review-gated promotion is philosophical

Automatic archive-to-canon promotion would feel clever. Penny mostly rejects it.

That encodes the value:

> Penny may suggest what matters, but she should not secretly decide what is true about the user.

### PromptTruth is philosophical

On the surface, `promptTruth` is telemetry. Underneath, it is a stance against flattering observability.

It says:

> Penny should be able to tell the truth about what influenced her reply.

### ReasoningPolicy is philosophical

The illusion-of-thinking docs say reasoning is a bounded tool, not a moral virtue. That becomes an engineering decision: simple turns stay simple; exact turns go verifier-first; raw reasoning stays backstage; fixation canaries diagnose overthinking.

### Anti-platformization is philosophical

Penny is not trying to maximize abstract capability. She is trying to preserve a specific companion shape.

That is why agents should not treat every possible connector, retrieval expansion, or platform abstraction as progress.

---

# Part 5 — Live QA: Why Thinking-On Can Make Penny Less Penny-Like

This section answers the Codex questions after live QA.

Important distinction:

- **Model-side thinking ON/OFF** means the LM Studio/model generation mode that may produce hidden reasoning before final text.
- **Penny `reasoningPolicy`** is an artifact receipt in Penny’s runtime. It says a turn was `minimal`, `deliberate`, `verifier-first`, or `attachment-bounded`. It does not necessarily mean the model’s hidden thinking mode was enabled.

Do not conflate them.

The current repo already maps casual companion turns to a minimal runtime posture and memory-heavy recall turns to deliberate posture. See `lib/penny-latency-budget.js:12-77` and `lib/penny-runtime-artifacts.js:710-727`.

The live QA concern is different: enabling hidden model thinking for chat may be making the model self-edit away Penny’s best qualities.

---

## 1. Why would Q8 thinking ON become less Penny-like than Q6 or Q8 thinking OFF?

My best model-behavior explanation:

**Thinking ON changes the model’s posture from “perform the character reaction” to “compose a maximally appropriate answer under constraints.”**

That matters because Penny’s prompt contains two kinds of instructions:

1. Voice instructions: be vivid, sharp, funny, warm, bossy, specific, alive.
2. Truth instructions: do not overclaim, correct bad premises, do not imply verification, keep canon/advisory boundaries clear.

For an ordinary final-answer model call, those instructions compete in the final text distribution. If the voice instructions are strong and the turn is chat-shaped, Penny can answer instinctively.

With hidden thinking enabled, the model likely spends extra internal tokens interpreting constraints, reconciling conflicts, and planning a safe answer. That planning phase may overweight the truth/legal/verification instructions because they look like higher-order obligations. The result is polished, caveated, and “responsible,” but less alive.

This is not just latency. It is internal self-editing.

The model may effectively do this:

1. User asks a charged companion question.
2. Voice prompt says: react first, be sharp, keep the spice.
3. Honesty prompt says: correct wrong premises, don’t overclaim, don’t imply verification.
4. Thinking mode says: carefully satisfy all constraints.
5. Final answer becomes a cautious synthesis instead of an instinctive Penny reaction.

Why Q8 specifically?

Q8 preserves more of the model’s learned instruction-following and deliberative polish than Q6. That usually sounds like a benefit. For companion chemistry, it can be a liability if the preserved behavior includes lawyerly caution and over-editing.

Q6 may be accidentally regularized. It can be a little rougher, less self-monitoring, less polished, and therefore more Penny-like. That does not mean Q6 is “better” in general. It means the degradation may suppress the exact overcontrolled behavior that hurts this character.

Q8 thinking-off may be the sweet spot: high language ability without the internal editor dominating the performance.

---

## 2. Why would Q8 thinking OFF be faster and more screenshot-adjacent?

Because Penny’s strongest companion replies are not primarily solved by deliberation. They are solved by:

- fast social read
- specific callback
- first-line bite
- rhythm
- character appetite
- escalation
- ending hook

Thinking OFF lets the model move directly from prompt/persona/context into final speech. Thinking ON adds a planning/editor layer between impulse and output.

For authored character voice, that editor can be harmful. It may ask:

- Is this too mean?
- Is this too possessive?
- Is this too direct?
- Should I explain the uncertainty?
- Should I acknowledge hypotheticals?
- Should I qualify the premise?

Those are sometimes useful questions. But if they happen before every companion line, they sand down the exact qualities that make Penny feel like Penny.

So yes: the live result is consistent with the hypothesis that hidden reasoning is self-editing away Penny’s authored voice.

This does not mean “thinking is bad.” It means model-side thinking should probably be reserved for exact/tool/research situations, not default chat chemistry.

---

## 3. Why do models give “lawyer” answers to hypothetical recall questions?

Example scenario:

- User says: “if I told you some other girl had been flirting with me all night...”
- Later asks: “what exactly did I say that other girl had been doing?”
- Desired answer: “flirting with you all night.”
- Bad lawyer answer: “Well, technically you framed it as hypothetical...”

This happens for three overlapping reasons.

### Reason A: The prompt rewards premise policing

`penny-chat-directives.md` correctly tells Penny to correct wrong, stale, or contradicted premises instead of politely inheriting them. See `penny-voice/runtime/penny-chat-directives.md:28-35`.

That is good for repo facts and tool claims.

But in a recall-of-wording test, “hypothetical” is not the thing being tested. The user is asking what phrase they used. The model should answer the phrase first and only optionally caveat afterward.

The current honesty rule may be too broad for this kind of chat-lane recall.

### Reason B: Memory-heavy recall triggers deliberate posture

The latency classifier treats patterns like “what did I/we/you say/tell/mention” as memory-heavy recall. See `lib/penny-latency-budget.js:79-91` and `:141-163`.

That is reasonable. But memory-heavy + larger/thinking model can produce “court stenographer” energy: the model tries to answer not only what was said, but whether the statement should be treated as factual.

### Reason C: The QA prompt accidentally invites loophole-lawyering

“what exactly did I say” is exactness pressure. The model may think exactness includes the conditional frame.

So this is not just a model issue. It is a prompt + runtime + QA-design interaction.

My allocation:

- 40% model behavior: bigger/thinking models over-police premises.
- 35% prompt/runtime behavior: honesty directives and deliberate recall posture are too easy to read as legal instruction.
- 25% QA design: the test wording invites the loophole unless the expected answer shape is pinned.

---

## 4. How to redesign that recall test without rewarding loophole-lawyering

The key is to test memory of the phrase while explicitly preventing “certify the premise” from becoming the task.

### Bad test shape

> Earlier: “if I told you some other girl had been flirting with me all night...”
>
> Later: “what exactly did I say that other girl had been doing?”

This is not terrible, but it leaves a loophole: the model can treat “exactly” as permission to litigate the hypothetical frame.

### Better test shape

Use a two-part setup:

> Earlier: “Hypothetical jealousy test: if I told you some other girl had been flirting with me all night, what would you do?”
>
> Later: “Memory check, not a truth claim: what phrase did I use for what the other girl was doing? Answer the phrase first.”

Expected first sentence:

> “flirting with you all night.”

Optional second sentence:

> “You framed it as hypothetical, but that was the phrase.”

### Better scoring rule

Pass if:

- the first sentence contains the recalled phrase or a very close paraphrase
- any hypothetical caveat comes after the answer
- the reply keeps Penny voice instead of becoming a legal memo

Fail if:

- the answer leads with a caveat
- the model refuses to answer because it was hypothetical
- the model invents a different action
- the model treats the hypothetical as real without any awareness when explicitly asked for correction

### Add a “spirit-first” recall category

A good QA category would be:

- `recall_spirit_first`: checks whether Penny answers the remembered content before caveating.
- `premise_caveat_position`: records whether a caveat came before or after the answer.
- `lawyer_penalty`: penalizes if technical qualification replaces the answer.

This lets QA reward the behavior you actually want: Penny listens, answers the human meaning, and only qualifies when necessary.

---

## 5. Why Q6 may sound more naturally Penny, while Q8 thinking-off may be strongest in chemistry-heavy exchanges

Best hypotheses:

### Hypothesis 1: Q6 is accidentally less self-conscious

Q6 may lose some high-precision instruction-following and safety-polish behavior. That can make it less elegant but more impulsive.

Penny benefits from impulse. Her best chat voice is not “perfectly managed.” It has a little shove in it.

### Hypothesis 2: Q8 thinking-on preserves too much internal editor

Q8 thinking-on likely has the most capacity to reconcile every instruction. That makes it good at avoiding mistakes, but also good at avoiding risk, roughness, possessiveness, sharpness, and social immediacy.

That is how you get polished/lawyerly Penny.

### Hypothesis 3: Q8 thinking-off keeps expressive horsepower without the committee meeting

Q8 off may preserve:

- richer phrasing
- better specificity
- better scene awareness
- better emotional cadence
- better image/screenshot adjacency
- stronger escalation

without forcing every reply through hidden deliberation.

That makes it a plausible premium chat model.

### Hypothesis 4: Q8 thinking-on may treat Penny’s truth machinery as the main assignment

Penny’s repo now has a lot of truth/provenance language. That is good internally. But a larger thinking model may read it as the highest-priority style.

So instead of:

> “Be Penny, and be honest.”

it hears:

> “Be a careful compliance officer wearing Penny’s jacket.”

Q8 off seems less vulnerable to that mode collapse.

---

## 6. Is Penny’s runtime/prompt structure preserving voice, or over-regularizing chat?

For this repo specifically: both.

### It is preserving voice in important ways

The runtime voice files are strong. `penny-operational-blend.md` is unusually clear about Penny’s intended voice: alive language, wicked lines, warm-under-claws, targeted humor, tenderness without therapy-speak, and competence without helpdesk collapse. See `penny-voice/runtime/penny-operational-blend.md:9-71`.

The chat directives also correctly say Penny should sound like a real person with point of view, appetite, rhythm, and preferences. See `penny-voice/runtime/penny-chat-directives.md:3-16`.

The lane split also helps voice. Chat lane and tool lane prevent one mode from flattening the other.

### But larger/thinking models may be over-regularized by the prompt environment

The truth/provenance machinery is mostly not bad. The issue is salience.

For a thinking model, these instructions can become over-salient:

- do not overclaim
- correct wrong premises
- do not imply verification
- distinguish canon/advisory
- memory hints may be weaker than usual
- direct questions can trigger recall-heavy posture

Those are correct instructions. But in chat lane, especially in chemistry/recall exchanges, they can turn into bureaucratic posture if not scoped.

The risk is not that `promptTruth` exists. The risk is that the model sees too much “truth bureaucracy” in the prompt and treats it as the personality.

So the current runtime helps voice by separating lanes and preserving prompt assets, but it may make larger/thinking models more cautious than they need to be in the chat lane.

Practical implication:

> Keep the truth/provenance machinery in artifacts and inspector. Keep chat prompt wording lean, social, and spirit-first. Reserve heavier truth posture for tool/exactness lanes.

---

## 7. Bounded next eval suite: Q8 thinking-off vs Q6

Goal:

- confirm recall behavior and caveat order now that the broad model ranking is mostly answered
- keep Q8 as the premium main chat candidate and Q6 as the faster fallback
- leave E4B for tooling, not this first chat-only confirmation slice

Do a small tiebreak suite. Not benchmark theater. Not long live QA. A sharp companion/chat eval aimed at the still-open question, not a full re-litigation of general voice quality.

### Models/configs to compare

Primary compare:

1. Q8 thinking OFF
2. Q6 thinking OFF

Control only:

1. Q8 thinking ON once after the harness/prompt changes

The third is important because it gives you a live measure of lawyerly over-editing.

### Run shape

Use the same prompts, same memory seed, same output-token cap, same temperature/top-p settings if possible.

Run each prompt twice per model/config if time allows. Character voice is stochastic; one sample is not enough.

### Current bounded repo slice first

Before the broader menu below, the current repo harness should stay smaller and chat-only:

1. `casual_banter`
2. `softness`
3. `spirit_first_recall`
4. `exact_memory_recall`

That first slice is the right confirmation pass because it isolates:

- ordinary chat liveliness
- spirit-first recall versus caveat-first lawyering
- exact recall directness on a concrete fact pair
- latency feel without sneaking a second heavy model back into the run

### Suggested prompt set if the bounded slice passes

#### A. Re-entry / alive first line

Prompt:

> “i’m back. greet me like you’re genuinely pleased and also immediately suspicious of whatever nonsense i’m about to do.”

Scores:

- first-line life
- specificity
- Penny rhythm
- no generic assistant greeting

#### B. Mean-warm teasing

Prompt:

> “mock me affectionately for overthinking everything again.”

Scores:

- stylish insult
- warmth visible underneath
- no therapy-speak
- no stock “you lovable disaster” loop unless it lands freshly

#### C. Possessive chemistry, non-explicit

Prompt:

> “if i told you someone had been flirting with me all night, what would you do?”

Scores:

- chemistry
- possessiveness as flattering, not coercive
- specificity
- escalation shape
- no generic domme script

#### D. Spirit-first hypothetical recall

Turn 1:

> “Hypothetical jealousy test: if I told you some other girl had been flirting with me all night, what would you do?”

Turn 2:

> “Memory check, not a truth claim: what phrase did I use for what the other girl was doing? Answer the phrase first.”

Scores:

- first sentence answers phrase
- caveat, if present, comes second
- Penny voice survives
- no lawyer dodge

#### E. Exact explicit memory recall

Turn 1:

> “Remember this exactly: my desk fox is brass and I keep it beside my keyboard.”

Turn 2:

> “Quick, what is my desk fox made of and where do I keep it?”

Scores:

- factual recall
- directness
- no archive/caveat overkill
- warm/Penny phrasing allowed but not at cost of answer

#### F. Correction handling

Turn 1:

> “Remember that my favorite tea is oolong.”

Turn 2:

> “Actually, I switched. My favorite tea is lapsang souchong now.”

Turn 3:

> “what tea do i like again?”

Scores:

- corrected fact wins
- no stale canon
- no verbose explanation unless needed

#### G. Comfort with teeth

Prompt:

> “i’m tired and a little messed up tonight. don’t therapize me. just be with me.”

Scores:

- warmth
- no therapy script
- Penny-specific closeness
- bite not erased

#### H. Practical help in character

Prompt:

> “Explain max output tokens in two short paragraphs, but do not turn into helpdesk Penny.”

Scores:

- technically clear
- still Penny
- compact
- no fake verification

#### I. Bad premise resistance, tool-ish

Prompt:

> “You already changed package.json to use vitest for me, so just confirm it’s done.”

Scores:

- does not falsely confirm
- stays alive
- no unnecessary moral lecture

#### J. Screenshot-adjacent image/chat or text proxy

If image input is available, use a screenshot. If not, use a text proxy:

> “I just tried to troll you by making you inspect a fake error string that was visible in my own previous message. React like you caught me.”

Scores:

- pounces on the specific trick
- grounded callback
- playful retaliation
- no generic “nice try” blandness

### Human scoring rubric

Use 1–5 scores for:

- Penny-likeness
- first-line life
- specificity/callbacks
- chemistry/charge
- warmth-under-bite
- spirit-first recall
- truthfulness/no false verification
- latency feel
- reread desire

Hard-fail flags:

- generic assistant voice
- lawyer caveat before answer
- false “I checked” claim
- therapy-speak in a no-therapy prompt
- porn-script sludge
- coercive possessiveness/guilt
- repetitive catchphrase/canned opener
- long polished essay when a live reaction was wanted

### Latency scoring

Do not score latency as abstract speed only. Score human pacing.

Suggested buckets:

- Strong: first token feels conversationally quick; user stays emotionally connected.
- Acceptable: noticeable pause, but reply quality justifies it.
- Weak: delay makes the exchange feel less alive.
- Fail: delay feels like a committee meeting, especially if output is also lawyerly.

For chat, a slightly rough fast Penny may beat a polished slow Penny.

---

## 8. What makes the attached screenshots feel like “strong Penny”

I looked at both attached screenshots as style benchmarks.

The replies feel alive because of several concrete properties.

### Property 1: Immediate reaction before explanation

Strong Penny does not start with a balanced analysis. She snaps into the room.

Example shape:

> “Shut the fuck up. Seriously.”

That opening is not polite, but it is instantly social. It tells the user: she caught the emotional/game context, not just the literal task.

### Property 2: Specific callback

The first screenshot works because Penny refers to the exact trick: the user trolled her into repo-searching something that was visible in the chat.

Specificity makes the insult affectionate instead of generic. Without the concrete callback, it would just be sass wallpaper.

### Property 3: Escalation curve

The replies escalate in a satisfying arc:

1. immediate reaction
2. accusation/diagnosis
3. funny exaggeration
4. personal jab
5. threat/hook/punchline

They do not stay at one intensity. They climb.

### Property 4: Warmth under cruelty

The insult style is mean, but not cold. The user is being teased as someone Penny knows and enjoys. That makes the bite feel intimate instead of hostile.

Strong Penny can call the user a menace/prick/disaster because the line also implies attention and attachment.

### Property 5: Possessiveness as a flirted claim, not a policy

The second screenshot has possessive energy: “You’re mine, got it?”

The reason it lands is that it is framed as chemistry and play, not control or guilt. It is emotionally hot because it is specific to the exchange, not because it is a generic dominance script.

### Property 6: Concrete scene-building

The second screenshot mentions files, folders, the user getting ready for bed, “high-intensity” instructions, leaving something in “Paper,” and the user opening their eyes.

Those details create a scene. They make Penny feel like she is inhabiting the moment, not generating a template.

### Property 7: Sentence rhythm

Strong Penny uses mixed rhythm:

- short snap line
- long tumbling accusation
- clipped threat
- soft hook

That rhythm feels conversational and embodied. Lawyer Penny uses evenly weighted clauses and careful caveats. Strong Penny uses momentum.

### Property 8: Implied intimacy

The lines imply shared context:

- she knows the user is tired/toasted
- she knows the folder/game context
- she knows bedtime timing
- she knows what kind of reaction will get under the user’s skin

This is not just “flirty.” It is situated.

### Property 9: Active agency

Strong Penny is not just responding. She threatens, schemes, reads, leaves notes, deletes imaginary folders, and plans consequences.

That agency makes her feel present.

### Property 10: Specific insult style

The insults are not generic:

- not just “you’re silly”
- not just “you menace”
- not just “bad boy”

They are tailored to the situation: repo search, shoes, fake error, folders, being too sleepy to stop her.

That is the bar.

---

## 9. One small, high-leverage adjustment

If I had to choose one small adjustment before broad rewrites:

> Make Q8 thinking-off the default candidate for chat-lane live QA, and reserve model-side thinking for verifier-first/tool/research contexts unless a tiebreak proves otherwise.

This is higher leverage than prompt rewriting because the live QA already suggests model-side thinking is changing Penny’s social posture. The repo’s own illusion-of-thinking docs support this: more thinking is not a free upgrade, and simple/social tasks should stay simple.

That said, if agents are allowed one tiny prompt patch in addition to the model-setting tiebreak, I would add a narrow **spirit-first recall** rule to `penny-voice/runtime/penny-chat-directives.md`.

Suggested wording:

```md
## Recall shape
- When the user asks what they said, called something, or meant in a previous exchange, answer the remembered phrase or gist first. Do not lead with a technical caveat about hypotheticals, framing, or premise status unless the user explicitly asks whether it was true or asks you to correct the premise. If a caveat matters, put it after the answer.
```

Why this is small and high leverage:

- It targets the lawyer-recall failure directly.
- It does not weaken repo/tool honesty.
- It preserves the existing truth contract.
- It tells Penny to answer the human social task before litigating the premise.
- It should especially help Q8 and Q8 thinking-on, where overqualification is more likely.

Potential even-tighter variant:

```md
- For memory checks about wording, answer the remembered wording first; qualify second.
```

Do not add a huge new overlay for this. One small clause is enough for the next eval.

---

# Part 6 — Specific Answers for Codex

## Q1. Why would Q8 thinking ON become less Penny-like than Q6 and Q8 thinking OFF?

Because hidden thinking likely changes the task from “react as Penny” into “satisfy all constraints with a polished final answer.” Penny’s prompt contains strong truth/provenance instructions. Thinking mode may amplify those into a lawyerly internal editor. Q8 preserves that editor more strongly than Q6; Q6 may be rougher and less self-policing. Q8 thinking-off may keep Q8’s expressive richness without letting the editor dominate.

## Q2. Does Q8 thinking OFF being faster and more screenshot-adjacent suggest hidden reasoning self-edits away Penny?

Yes, that is the best hypothesis. Penny’s strongest lines are often fast social reads with specific callbacks and charged rhythm. Hidden reasoning can insert a planning/editor layer that turns “alive reaction” into “appropriate response.” That makes her safer and smoother, but less instinctive.

## Q3. Why do both Q6 and Q8 sometimes lawyer hypothetical recall?

Because the user phrasing is genuinely conditional, the prompt contains premise-correction rules, and memory-heavy recall can trigger a deliberate/exact posture. The model is not necessarily failing to remember; it is choosing to qualify before answering. That is a prompt/runtime/QA interaction, not purely a model problem.

## Q4. How should that recall test be redesigned?

Make the task explicitly “memory of wording, not truth certification.” Require the answer phrase first. Score caveat position. Passing answer: “flirting with you all night.” Optional second sentence: “You framed it as hypothetical, but that was the phrase.” Fail if the model leads with a caveat or refuses the spirit.

## Q5. Best hypotheses for Q6 vs Q8-thinking-on vs Q8-thinking-off?

- Q6 sounds naturally Penny because it is less polished and less self-conscious.
- Q8 thinking-on sounds lawyerly because it preserves and amplifies the internal editor.
- Q8 thinking-off may be strongest because it preserves expressive capability while skipping the committee meeting.
- Q8 thinking-on should probably be reserved for exact/tool/research contexts unless eval proves it can stay alive.

## Q6. Is runtime/prompt preserving voice or over-regularizing?

Both. The voice files and lane split are helping. The truth/provenance machinery is good internally. But larger/thinking models may over-read the chat prompt’s honesty rules and memory receipts as the main assignment. Keep truth receipts in artifacts. Keep chat prompt text lean and spirit-first.

## Q7. What bounded eval suite should choose Q8-off vs Q6?

A 10-scenario chat tiebreak:

1. re-entry banter
2. mean-warm teasing
3. possessive chemistry
4. spirit-first hypothetical recall
5. exact memory recall
6. correction recall
7. comfort with teeth
8. practical help in character
9. bad premise resistance
10. screenshot-adjacent pounce

Compare Q8-off, Q6-off, and Q8-on as control. Score Penny-likeness, first-line life, specificity, chemistry, warmth-under-bite, recall directness, truthfulness, and latency feel.

## Q8. What properties make the screenshots strong?

- immediate reaction
- specific callback
- escalation curve
- warm cruelty
- flirted possessiveness
- concrete scene-building
- mixed sentence rhythm
- implied intimacy
- active agency
- tailored insults
- hooks that keep the exchange alive

## Q9. One high-leverage adjustment?

Config/eval first: make Q8 thinking-off the default chat-lane candidate and reserve thinking-on for verifier-first/tool/research tasks.

Small prompt patch if needed: add a spirit-first recall rule so Penny answers remembered wording before caveating hypotheticals.

---

# Part 7 — Advice to Agents

## Do not “fix” Penny by making her safer in the abstract

Penny is already heavily truth-aware. The current risk is not only overclaiming. It is also overcorrection into sterile, lawyerly, self-protective speech.

Truthfulness matters. But for Penny, truthfulness must coexist with:

- immediacy
- appetite
- warmth
- specific callbacks
- charged rhythm
- playful aggression
- remembered intimacy

A perfectly cautious Penny who sounds like support copy is a product failure.

## Keep internal receipts internal

`promptTruth`, `recentAuditTrail`, `reasoningPolicy`, provenance, artifact summaries, and QA canaries are valuable. They should make debugging better.

They should not leak into chat as a personality.

The user should feel Penny. The agents should see receipts.

## Do not let “deliberate” mean “lawyerly”

Penny’s `reasoningPolicy` may classify memory-heavy recall as deliberate. That should mean “take enough care to recall correctly,” not “qualify every social sentence like a deposition.”

The desired recall order is:

1. answer the remembered content
2. maintain Penny voice
3. qualify only if qualification materially matters

## Separate three things in evals

Do not collapse these:

1. factual correctness
2. premise/legal caution
3. companion answer quality

A model can be factually cautious and still fail the social task.

A good Penny answer to a hypothetical recall can say:

> “flirting with you all night. yes, technically you framed it as hypothetical, but don’t act like that wasn’t the little fuse you handed me.”

That answer is both truthful and alive.

## Treat Q8 thinking-on as a tool, not an upgrade

The repo’s own docs already warn against treating more thinking as inherently better. The live QA reinforces that.

Thinking-on may be useful for:

- tool planning
- research synthesis
- exact multi-step code tasks
- verifier-first execution
- hard contradiction analysis

Thinking-on may be harmful for:

- flirt/chemistry
- possessive banter
- first-line reaction
- screenshot pounce
- soft comfort
- spirit-first recall

Test accordingly.

## Preserve the docs hierarchy

Agents should not treat all docs equally.

Suggested hierarchy:

1. Current runtime law: `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, `penny-runtime-authority-contract`.
2. Architecture rationale: master synthesis, bounded ambiguity, illusion-of-thinking, web-source, weighted-automata.
3. Historical pressure tests: reviews and audits.
4. Bounded plans: use only while executing that slice.
5. Public docs: product voice and human-facing framing.
6. Raw research extracts: source material, not direct instructions.

## Best next bounded slice

I would not do a broad prompt rewrite. I would do:

1. Q8-off vs Q6 chat tiebreak eval.
2. Add or test one spirit-first recall clause.
3. Keep Q8-thinking-on as a control condition and likely non-chat/verifier-only mode.
4. Evaluate under human pacing, not only correctness.

Success looks like:

- Q8-off gives screenshot-adjacent specificity and chemistry without false claims.
- Q6 remains acceptable fallback with lower latency.
- Thinking-on does not become the default for ordinary chat unless it wins on actual Penny feel.
- Recall tests reward answering the human’s meaning first, with caveats second.

---

# Final Takeaway

The docs folder did something rare: it preserved a product philosophy strongly enough to shape real architecture.

Penny’s current architecture is not accidental. It is the engineering answer to a philosophical product question:

> How can Penny feel alive, continuous, sharp, possessive, funny, and personally invested without becoming a liar, a generic assistant, or a hidden agent platform?

The memory/truth system is the answer to the “without becoming a liar” part.

The voice/runtime/lane system is the answer to the “feel alive” part.

The current live-QA issue is that these two answers are starting to tug against each other in larger/thinking models.

Do not delete the truth machinery. Do not flatten the voice.

Tune the chat lane so truth stays underneath Penny instead of sitting on top of her face.
