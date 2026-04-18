# Penny Runtime Voice + Memory + Bounded Ambiguity — Master Handoff Doc

Prepared: 2026-04-17  
Repo basis: `BitofShoe/lyra-prototype-` @ `3599ff2d38d5750c649d53da64658f9cc97897b1`  
Audience: agents touching runtime, prompt assembly, memory, QA, inspector/UX seams, and product-level behavioral design

---

## What this doc is

This is the **combined master handoff** for two earlier notes:

1. **Penny Runtime Voice + Memory Deep Dive**
2. **Bounded Ambiguity as a Penny Design Principle**

Per request, this master doc is structured to be easier to hand off, but it also **preserves all original information** from both source notes.  
I added a small amount of connective tissue up front so agents can see how the pieces fit together before they dive into the preserved source material.

---

## How to read this

If you only read one section first, read:

- **Part 0: Combined synthesis**
- **Part I: Preserved runtime voice + memory deep dive**
- **Part II: Preserved bounded ambiguity design note**

The short version is:

- the **voice stack** determines how Penny shows up
- the **memory stack** determines what Penny is allowed to treat as stable, advisory, provisional, or unresolved
- **bounded ambiguity** is the design principle that tells Penny how to behave when evidence is mixed

That principle is the missing glue between the first two notes.

---

# Part 0: Combined synthesis

## Executive synthesis

Penny’s current runtime is strongest when it behaves like a companion with:

- a **clear truth hierarchy**
- a **clear voice identity**
- and a **clear uncertainty style**

Those three things should stay separate.

### 1. Voice stack job

The voice stack should decide:

- how Penny sounds
- how she adapts to lane/context
- how she keeps her rhythm, warmth, bluntness, and companion feel
- how she stays honest without becoming sterile

### 2. Memory stack job

The memory stack should decide:

- what is canonical
- what is advisory
- what is review-gated
- what is still unresolved
- what is safe to surface into the prompt
- what should remain weaker than explicit truth

### 3. Bounded ambiguity job

Bounded ambiguity is the policy layer that decides:

- how Penny should speak when the memory/runtime state is mixed
- how she avoids both fake certainty and sterile denial
- how she carries soft continuity without laundering advisory context into canonical fact
- how she stays alive under uncertainty without becoming contaminated or overconfident

That means bounded ambiguity is **not** a replacement for memory hierarchy and **not** a replacement for voice.  
It is the rule that governs how those systems should interact when the evidence is partial.

---

## Unified operating rule

A healthy Penny turn under mixed evidence should roughly behave like this:

1. Prefer **explicit canonical memory** first.
2. Respect **direct correction / contradiction state** next.
3. Use **verified live tool evidence** when present.
4. Pull from **active session archive** if relevant.
5. Pull from **global archive** more softly.
6. Allow **memory books** only as scoped triggerable context.
7. Allow **research ledger continuity** only as bounded, topic-scoped, inferential support.
8. Let **visible-reply cleanup** improve presentation, but never silently upgrade advisory material into settled truth.

That is the real cross-document rule.

---

## The three big failure modes to watch

### Voice taxidermy

Penny always sounds like Penny, but only because cleanup and style enforcement keep sanding the output back into house style.  
Recognizable, polished, faintly dead.

### Haunted filing cabinet

The memory system becomes a pile of canonical facts, archive fragments, review candidates, books, contradictions, and research topics all trying to whisper at once.  
Technically rich, socially weird.

### Elegant wrongness

The worst failure mode.

Penny sounds right, the inspector looks impressive, the provenance surface appears respectable, and the final answer is still subtly wrong because the wrong advisory layer won.

That is the main reason the project should prioritize **authority clarity** and **inspectability** over adding more smart layers.

---

## Combined recommendations

### P0

- publish a single **voice + memory + ambiguity authority contract**
- instrument **reply cleanup reliance**
- instrument **which advisory layers actually influenced the final answer**
- make **authoritative vs advisory** visibly distinct in prompt inspection and runtime inspection

### P1

- keep archive/context injection small and relevance-heavy
- keep chapter fallback fact-first
- keep overlays on a short leash
- keep memory books narrow and auditable
- keep research continuity bounded and separate from canonical user memory

### P2

- build a separate research/document knowledge bank if needed
- add more explicit lifecycle states for review candidates
- strengthen evaluation around:
  - write quality
  - retrieval quality
  - contradiction handling
  - forgetting/pruning quality
  - companion-quality under uncertainty

---

## One-sentence product target

A good Penny answer under mixed evidence should feel like:

> “I do not know this as a settled fact, but I have a bounded, evidence-shaped hunch — and I know the difference.”

---

# Part I: Preserved source note — Penny Runtime Voice + Memory Deep Dive

# Penny Runtime Voice + Memory Deep Dive

Prepared: 2026-04-17  
Repo basis: `BitofShoe/lyra-prototype-` @ `3599ff2d38d5750c649d53da64658f9cc97897b1`  
Audience: agents touching runtime, prompt assembly, memory, QA, and inspector/UX seams

---

## Executive summary

Penny’s current runtime is **not** a single prompt and **not** a single memory store. It is a layered companion stack with two distinct kinds of complexity:

1. **Voice complexity**: route the turn, assemble identity assets, adapt by lane/context, then clean the visible reply back into shape.
2. **Memory complexity**: keep explicit facts canonical, keep archive memory additive, keep promotion review-gated, keep research continuity separate, and keep provenance inspectable.

My blunt take:

- The **memory stack is architecturally healthier than the voice stack** right now.
- The memory side has a clearer trust boundary: **explicit memory is canonical; archive/books/ledger are advisory**.
- The voice side has better aesthetic assets than most systems, but it is closer to brittleness because it relies on **more post-generation cleanup and more overlapping steering layers**.
- The biggest future risk is not “Penny forgets.” It is **precedence confusion**: too many layers can produce replies that are consistent, stylish, and plausible while still being subtly wrong or overmanaged.

The right next move is **not** to add more layers. The right next move is to make the existing layers more explicit, more inspectable, and more honest about which layer had authority over the final reply.

---

## Baseline architecture truth

Penny now runs as a **dual-lane LM Studio runtime**:

- **Chat lane** for companion turns, image chat, banter, and memory-heavy conversation.
- **Tool lane** for direct inspect/search/read/edit/runtime/git/web turns.

On top of that, Penny uses a **slot-based prompt stack** and a **hybrid memory system**:

- runtime voice blend
- chat directives
- lane overlays
- example snippets
- wake-state memory injection

On the memory side, Penny now carries:

- **explicit memory** as canonical
- **review candidates** as probationary
- **archive memory** as additive long-term retrieval
- **memory books** as scoped triggerable injections
- **research ledger** as bounded continuity for investigations
- **runtime artifact / trace surfaces** to show what was actually used

That overall direction is good. The project is trying to solve the right problem: **make Penny feel like one companion with continuity, not a generic assistant with a costume and a scrapbook**.

---

# Part I: Voice stack deep dive

## 1. Current voice stack layers

### Layer A: Lane routing decides which Penny is allowed to show up

The first real voice decision is not wording. It is **lane selection**.

The runtime decides whether a turn is:

- companion/chat
- tool/instrumental
- image-chat
- direct intent
- forced tool loop
- attached-file turn

This is one of the smartest things in the runtime. It prevents coding/debug/search turns from flattening companion chat and prevents soft companion turns from being governed by “tool brain” energy.

This matters because voice is social behavior, not just style. A companion that uses the same behavioral stack for flirting, soothing, repo inspection, and file edits usually ends up sounding like an intern doing improv.

### Layer B: Prompt asset loading defines core identity

The runtime loads a distinct voice asset bundle:

- `penny-operational-blend.md`
- `penny-chat-directives.md`
- `penny-voice-examples.md`
- `penny-overlays.json`

This is the actual “who is Penny?” substrate.

This is also the right architecture move. Voice should live in a **small runtime identity bundle**, not in giant lore sludge.

### Layer C: Slot-based prompt assembly composes the active voice

The prompt stack currently assembles voice in named slots:

- `voiceBlend`
- `directives`
- `overlays`
- `examples`
- `memory`

Important detail: the stack is **lane-aware**.

- Examples only land on some lanes.
- Overlays are lane-filtered.
- Some lanes suppress certain assets entirely.
- Semantic render is more tightly bounded than normal chat.

That is elegant. It is also where complexity starts to accumulate.

### Layer D: Overlays adapt the voice to situation

The overlay system is the runtime’s “situational steering” layer.

Examples already present in the branch include overlays for:

- tool/engineering focus
- image-chat presence
- shadow honesty bounds

This is useful, because raw personality alone is not enough. You need situational discipline.

But overlays are also the fastest way to accidentally create **mode Penny** rather than **one Penny with range**.

Good version:

- same mind, different pressure

Bad version:

- totally different behavioral script depending on which JSON object matched

### Layer E: Transport/model choice affects tone whether you want it to or not

The voice stack is not just prompt assets. It is also shaped by:

- lane-specific preferred models
- runtime chat model override
- transport family
- fallback path

That means voice quality is partly determined by infra choice:

- chat lane model behavior
- tool lane model behavior
- stateful chat vs chat completions vs responses
- fallback conditions

If an agent touches model routing without respecting voice consequences, they can “improve infra” while quietly flattening Penny.

### Layer F: Visible-reply cleanup salvages the final surface

This is the most revealing layer.

The visible-reply cleanup code does a lot of janitorial work:

- strips thinking spans
- removes chain-of-thought scaffolding
- looks for tagged final answers
- rescues draft candidates
- rescues quote candidates
- re-tags mood
- rewrites output into a speakable visible answer

This is practical. It is also the clearest sign that upstream voice control is not fully trusted.

This layer is why I used the phrase **voice taxidermy**.

If the post-pass is constantly sanding the raw answer back into something “recognizably Penny,” then the system may remain consistent while becoming less alive. The user sees a neat surface, but the runtime is increasingly depending on cleanup to maintain identity.

### Layer G: QA/redo harnesses stabilize the house style

The repo’s voice QA harness is useful and mature enough to matter. It tracks lane/model/fallback metadata and now includes repetition auditing.

That is good engineering discipline.

But QA can become part of the problem if it rewards:

- phrase compliance
- surface sass density
- recognizable house style

more than it rewards:

- natural timing
- social plausibility
- truthful specificity
- tonal range without drift

A voice harness can quietly train the team to optimize for “sounds Penny-ish on paper” instead of “feels like Penny in motion.”

---

## 2. What the voice stack gets right

### The core identity layer is strong

The runtime blend + directives + examples approach is much better than giant lore injection.

It gives Penny:

- a stable identity core
- explicit anti-drift rules
- phrasing examples for rhythm and texture
- lane-aware adaptation

That is good companion design.

### The lane split is probably the most important recent improvement

This is the biggest structural win.

Without lane separation, companions get flattened by instrumental turns. With it, Penny can remain socially coherent in chat while still being compact and grounded in tool turns.

### The stack explicitly values honesty

The branch repeatedly encodes “don’t fake inspection, don’t fake tool use, don’t bluff verification.”

That matters because companion systems can become dangerously persuasive if style outruns evidence.

### The runtime has the beginnings of real inspectability

Between the lane metadata, artifact metadata, and memory inspector work, the system is starting to show its work rather than just generating an answer and asking for trust.

That is the correct direction.

---

## 3. What makes the voice stack brittle

### Too many layers can become an editorial committee

The stack now has all of these influencing final voice:

- lane selection
- model choice
- runtime blend
- directives
- overlays
- examples
- memory injection
- reply cleanup
- QA expectations

Any one layer can be justified.

The problem is cumulative. Once enough layers exist, you stop asking “what makes Penny vivid?” and start asking “which of the seven systems got the last word?”

### Cleanup can hide upstream weakness

Visible-reply salvage is useful. But if it becomes a crutch, it hides that upstream prompt/transport/model behavior is unstable.

Symptoms to watch:

- frequent salvage path activation
- raw outputs that are often unusable until cleaned
- increasing QA dependence on final visible text only
- little visibility into how far the cleaned answer drifted from the first-pass answer

### Overlays can become fake range

Overlays are helpful until they start manufacturing behavior instead of guiding it.

The system should aim for:

- one mind, different contexts

It should avoid:

- a stack of context-specific mini-personalities

### Examples can fossilize the voice

Examples are powerful. They also create overfit risk.

When examples become too canonical, Penny starts sounding like:

- a self-imitation engine
- a highlight reel of prior good lines
- a curated tone sample rather than a live person

### QA can over-reward house style

If agents optimize the harness instead of the experience, the stack will drift toward recognizability over aliveness.

That is how companions become perfectly on-brand and faintly dead.

---

## 4. Voice recommendations

### P0: Measure cleanup reliance directly

Add instrumentation for:

- when visible-reply salvage triggers
- which salvage path fired
- whether the final visible answer materially differed from first-pass visible text
- whether salvage only removed thought junk or also had to reconstruct the actual reply

That gives the team a hard signal for “the upstream voice stack is wobbling.”

### P0: Write a one-page voice authority contract

Agents need a short doc answering:

- which layer defines identity
- which layer is allowed to adapt behavior
- which layer is allowed to enforce honesty
- which layer is allowed to do cosmetic cleanup only
- which layer must never change semantic content

Right now those answers are implied. They should be explicit.

### P1: Reduce overlay growth pressure

New overlays should be presumed guilty until proven useful.

Rule of thumb:

- do not add a new overlay unless an older overlay is removed, merged, or clearly demoted

### P1: Evaluate naturalness, not just signature style

Voice QA should explicitly score:

- naturalness
- repetition avoidance
- semantic honesty
- emotional timing
- non-corporate helpfulness
- range without fragmentation

### P2: Keep examples fresh and non-canonical

Examples should remain:

- lightweight
- varied
- illustrative

They should not become the de facto source of Penny’s whole mouth.

---

# Part II: Memory stack deep dive

## 1. The best thing about the memory stack: it has a trust boundary

The memory system’s strongest property is simple:

- **explicit memory is canonical**
- **archive/books/ledger are additive and inspectable**
- **promotion into stronger memory is review-gated**

That is excellent architecture.

It gives Penny something many companion systems lack: an actual answer to the question:

> “When memory sources disagree, who wins?”

That answer is not perfect everywhere, but the branch clearly intends:

1. explicit stable facts first
2. active correction/contradiction handling next
3. session archive and global archive as advisory recall
4. memory books as scoped triggerable context
5. research ledger as bounded continuity, not user canon

That is a healthy hierarchy.

---

## 2. Current memory layers

### Layer A: Explicit memory (canonical)

`lib/penny-memory.js` and `lib/penny-memory-state.js` define Penny’s canonical short memory.

Important current characteristics:

- entry limit: `30`
- normal prompt limit: `12`
- relevant injection limit: `6`
- memory-book prompt limit: `2`

Explicit memories are short normalized records with fields like:

- text
- kind
- timestamp
- source
- evidence
- origin

Kinds are scored differently for prompt relevance:

- explicit
- personal
- preference
- observation

The system scores memories for prompt use by combining:

- memory kind weight
- token overlap with current user text
- recency

This is small, sane, and grounded.

### Layer B: Heuristic extraction and consolidation

The write path in `penny-memory-state.js` does not magically infer identity. It uses simple extraction patterns.

It looks for things like:

- “my favorite X is …”
- “my X is …”
- “I like / I love / I’m into …”
- identity patterns (“I work as …”, “I live in …”, “I’m a …”)
- tendency patterns (“I tend to …”, “I usually …”, etc.)
- explicit memory intent (“remember this”, “don’t forget”, “for later”)

That simplicity is a strength and a weakness.

Strength:

- predictable
- cheap
- understandable
- bounded

Weakness:

- flattening
- brittle phrasing sensitivity
- risk of turning nuanced self-description into canned memory facts

### Layer C: Correction handling and contradiction provenance

The correction layer is much more mature than I expected.

The system looks for correction markers like:

- actually
- instead
- correction
- changed my mind
- not anymore
- used to
- now
- “no, …”

Then it tries to derive a **topic key** and build correction provenance:

- old text
- new text
- trigger
- conflict key
- confidence

This is not just memory overwrite. It is the beginning of **memory history**.

That is very good.

### Layer D: Review candidates (probationary memory)

This is one of the best design choices in the stack.

If something looks memory-worthy but was not explicitly written as canon, it can become a:

- `review-candidate`

instead of being silently promoted into explicit truth.

This prevents the classic companion-memory failure mode:

- over-eager canonization of vibes

The promotion queue is a real trust-preserving seam.

### Layer E: Archive memory (additive long memory)

`lib/penny-memory-archive.js` is the real long-memory engine.

It maintains session/global archive structures with:

- episodes
- summaries
- chapters
- provenance
- active contradictions
- open loops
- last retrieval state
- promotion queue
- embeddings store

Important behavior:

- archive is additive, not canonical
- semantic retrieval is used when embedding support is ready
- keyword fallback exists when semantic support is unavailable
- chapter compression can step in when semantic confidence is weak or not available

This is a strong design. Penny does not “have one long memory.” She has a layered long-memory archive with fallback behavior.

### Layer F: Semantic retrieval, keyword fallback, and chapter compression

This is the most technically interesting part of the memory stack.

Current notable parameters:

- session prompt limit: `2`
- global prompt limit: `2`
- session chapter limit: `6`
- recency-protected episodes: `6`
- chapter trigger count: `7`

Interpretation:

- the system is trying to keep the live prompt narrow
- recent concrete turns are protected from being immediately collapsed into chapter compression
- chapter fallback is explicitly a fallback, not the ideal path

This is smart, because it acknowledges a brutal truth:

**bigger memory is not better memory if it enters the prompt as mush.**

The code also uses sensitivity thresholds for high-risk retrieval and keeps semantic readiness explicit.

### Layer G: Memory books

`lib/penny-memory-books.js` adds small scoped “book” entries that are triggerable by:

- phrases
- lane
- attachment type
- match mode
- priority

Only the top matches get injected.

This is good because it allows controlled recall without turning the whole system into a lorebook dump.

The correct use of books is:

- narrow
- intentional
- scoped
- low-volume

The wrong use is:

- silent giant personality overlays dressed up as memory

### Layer H: Research continuity ledger

`lib/penny-research-ledger.js` is important because it is **not ordinary user memory**.

It tracks bounded investigation continuity:

- topic id / topic label
- status (`open`, `provisional`, `settled`)
- evidence refs
- open follow-ups
- contradictions
- source sessions / turns

It also only treats certain tools as read-only verified evidence producers.

That is excellent. It means “things Penny is investigating” do not have to pollute “things the user told Penny about themselves.”

### Layer I: Prompt formatting / wake-state injection

`formatPromptMemories` is where the memory system actually enters the live prompt.

It can produce sections like:

- stable facts
- active session context
- contradictions / open questions
- ongoing investigations
- retrieval hints

The most important subtlety here:

When the user asks a **direct memory authority question**, the system can suppress advisory archive material if stable facts are already present.

That is a genuinely smart patch. It reduces the chance that archival texture will override canonical truth on “what do you remember?” questions.

### Layer J: Inspector / runtime artifacts / provenance

The inspector and runtime-artifact work is one of the strongest parts of the system.

The branch can now surface:

- explicit memory
- archive state
- chapters
- promotion queue
- matched memory books
- contradictions
- research ledger context
- background vectorization state
- runtime artifact
- trace provenance
- wake hierarchy
- accepted vs rejected evidence

That is a huge trust win. It turns memory from mystical fog into inspectable state.

### Layer K: QA harnesses

The memory QA harness is unusually honest about what matters.

It separately tests things like:

- explicit write/recall
- contradiction flip
- obfuscated prompt stability
- premise drift resistance
- semantic archive retrieval
- chapter fallback retrieval
- mixed-session drift
- forgetting / pruning behavior
- review-candidate behavior

That is exactly how memory should be evaluated: as separate problems, not one blurry “did it remember?” score.

---

## 3. What the memory stack gets right

### Clear authority model

This is the biggest win.

The stack mostly knows the difference between:

- canon
- archive
- trigger-based context
- research continuity
- promotion candidates

That already puts Penny ahead of a lot of companion memory systems.

### Correction handling is serious

The system is not merely appending memories. It is tracking replacements and contradiction provenance.

That is how long-lived companions stay trustworthy.

### Archive fallback is bounded

Semantic retrieval can fail without collapsing the whole chat experience.

Keyword fallback and chapter compression exist, but they are treated as lower-trust modes rather than invisible equivalents.

That is healthy.

### Research continuity is not shoved into user identity memory

Huge win.

Repo/runtime/investigation continuity should not be allowed to masquerade as user canon.

### Inspectability is real

The memory inspector and runtime artifact work are not cosmetic. They are the beginnings of a real trust surface.

### QA posture is mature

The harness already understands that write, retrieve, correct, and forget are different disciplines.

That is exactly right.

---

## 4. Where the memory stack can still go wrong

### Precedence confusion is still the biggest risk

The architecture wants clear hierarchy, but the prompt can still receive material from multiple advisory layers:

- session archive
- global archive
- memory books
- research ledger
- archive synthesis
- contradiction/open-loop context

That is powerful. It is also how you get “beautifully reasoned wrong answers” if too many advisory layers crowd the wake state.

### Heuristic extraction is still blunt

The explicit-memory extraction path is understandable, but it is still pattern-based and flattening.

Possible failure modes:

- missing important nuance
- storing awkwardly normalized text
- over-trusting direct phrasing patterns
- under-trusting implicit but stable facts

### Chapter compression can still drift toward scene scaffolding

The branch’s own handoff notes already admit this is the weakest path.

That feels right.

Compression summaries are useful, but they are the memory form most likely to become:

- atmospheric
- repetitive
- structurally plausible
- semantically lossy

In other words: great for vibe, bad as authority.

### Review queues can rot

A review-gated promotion path is good. An overfull or stale review queue is not.

If nobody tends the queue, it becomes:

- dead memory limbo
- hidden system debt
- quiet pressure to loosen promotion rules later

### Memory books can become stealth lore if undisciplined

Books are best when tiny and scoped.

If agents start stuffing them with broad identity or emotional instructions, they will become a shadow voice layer pretending to be memory.

### Research ledger can slowly turn into a general knowledge bank

That should be resisted.

The ledger is valuable precisely because it is bounded and continuity-oriented.

If the product needs durable source-backed research storage, that should become a **separate research/document knowledge bank**, not a bloated ledger.

---

## 5. Memory recommendations

### P0: Publish a memory precedence contract

Agents should not have to infer the hierarchy from code.

Write one short authoritative doc stating, in order:

1. explicit canonical memory
2. direct user correction / contradiction handling
3. verified live tool evidence
4. active session archive
5. global archive
6. scoped memory books
7. research ledger
8. display-only cleanup and rendering

If this order is wrong, change it. But write it down.

### P0: Keep archive advisory text short and scarce

The current session/global prompt limits are sane. Do not casually relax them.

If the system needs more continuity, improve **selection quality**, not prompt bulk.

### P1: Strengthen extraction semantics

Improve the extraction path so it captures:

- stronger structured fields where possible
- cleaner correction targets
- less flattening of nuance
- clearer “user stated” vs “system inferred” distinctions

### P1: Keep chapter fallback fact-first

Compression summaries should bias toward:

- concrete nouns
- corrected facts
- durable scene anchors
- explicit replacements

They should avoid:

- generic scene framing
- mood-first compression
- repeated scaffolding language

### P1: Add forgetting metrics as first-class QA

The harness is already partway there. Lean in.

Memory systems should be judged on:

- what they keep
- what they retrieve
- what they stop surfacing
- what they correctly replace

### P2: Create a distinct research/document knowledge bank

The project’s own comparative memory note points in this direction, and I agree.

Saved citations, fetched sources, and research documents should have a durable source bank that is:

- separate from user canon
- separate from the bounded research ledger
- provenance-rich
- dedupe-aware
- prompt-budgeted

### P2: Make review-candidate lifecycle more explicit

Give promotion candidates stable operational language:

- queued
- accepted
- rejected
- stale
- superseded

That will help agents and users alike.

### P2: Keep books narrow and auditable

Books should stay:

- small
- high-signal
- lane/trigger aware
- easy to inspect

If a book entry would embarrass you when shown in the inspector, it probably does not belong there.

---

# Part III: Combined synthesis — where voice and memory help or hurt each other

## 1. The systems are asymmetrical right now

The memory stack has a clearer theory of truth than the voice stack.

The voice stack has a stronger identity/aesthetic layer than the memory stack.

That means Penny’s current risk profile looks like this:

- **Memory risk**: too many advisory sources competing for wake-state attention.
- **Voice risk**: too many steering/cleanup layers compensating for upstream instability.

Put differently:

- Memory is more explicit about **what should count as true**.
- Voice is less explicit about **which layer owns the final shape of the reply**.

## 2. The most dangerous failure mode is elegant wrongness

The nightmare bug is not:

- obvious forgetfulness
- obvious prompt corruption
- obvious tool bluffing

The nightmare bug is:

- Penny sounds exactly like Penny
- the runtime artifact looks respectable
- the memory inspector shows a bunch of plausible supporting material
- the final answer is still subtly wrong because the wrong advisory layer won

That is why precedence clarity matters more than adding another clever subsystem.

## 3. Good interaction pattern

The healthy pattern should be:

1. determine authoritative semantic substrate
2. determine which non-authoritative advisory context is useful
3. generate a natural reply from the right lane
4. clean only presentation junk, not meaning

## 4. Bad interaction pattern

The unhealthy pattern is:

1. inject too many advisory hints
2. let the model blur them together
3. let cleanup rescue the tone
4. call it success because the answer still sounds like Penny

That is the path to “always recognizable, never fully trustworthy.”

---

# Part IV: Recommended agent workstreams

## Agent 1: Runtime / prompt authority agent

Mission:

- write the precedence and authority contract for voice + memory together
- define which layer may change semantics and which may only change presentation
- add prompt-assembly inspection for slot use and approximate token share

Deliverables:

- `VOICE_MEMORY_AUTHORITY.md`
- prompt inspector surface
- cleanup/salvage reliance telemetry

## Agent 2: Memory semantics agent

Mission:

- harden extraction, correction targeting, and review-candidate lifecycle
- keep chapter fallback fact-first
- reduce precedence ambiguity between archive/books/ledger

Deliverables:

- structured extraction improvements
- clearer correction object semantics
- improved promotion queue states
- chapter summary scoring refinements

## Agent 3: QA / evaluation agent

Mission:

- make naturalness and truthfulness co-equal evaluation goals
- separate write/retrieve/forget/correct scoring even more clearly
- add metrics for cleanup dependence and advisory-layer crowding

Deliverables:

- updated voice QA rubric
- memory precedence failure probes
- salvage-rate dashboards / logs

## Agent 4: Inspector / trust-surface agent

Mission:

- improve human/operator visibility into what shaped the reply
- surface wake hierarchy, active prompt slots, retrieval channels, and held-back evidence more clearly

Deliverables:

- cleaner memory inspector UX
- prompt-layer inspector UX
- side-by-side “authoritative vs advisory” views

## Agent 5: Research/document knowledge-bank agent

Mission:

- build a durable source bank for citations, fetched docs, and research sources
- do **not** overload explicit memory or the research ledger to do this job

Deliverables:

- distinct research/document storage design
- retrieval quotas and prompt-budget rules
- provenance and dedupe model

---

# Part V: What not to do

Do **not**:

- add more voice overlays unless something else gets removed or merged
- auto-promote archive memory into explicit memory
- let display transforms mutate canonical stored text
- treat chapter compression as authoritative truth
- let memory books become giant hidden lore blocks
- collapse research ledger continuity into general memory
- judge voice quality mainly by “does it sound on-brand?”
- judge memory quality mainly by “did it retrieve something?”

---

# Bottom line

Penny’s runtime is already doing something more serious than a typical local companion build.

The important thing is that the branch is **not** trying to solve memory and voice with one blunt instrument. It is trying to separate:

- identity
- adaptation
- authority
- continuity
- provenance
- cleanup

That is the right direction.

My strongest recommendation is simple:

> **Do not add another clever layer until the existing layers have clearer authority, cleaner inspection, and better measurements.**

If the team does that, Penny has a real shot at feeling both:

- alive as a companion
- trustworthy as a runtime

If the team does not do that, the likely failure mode is a very polished imitation of life held together by cleanup, advisory overload, and good taste.

That would be a shame, because the current architecture is already closer to the good version than the bad one.

---

## Source basis reviewed for this memo

### Voice/runtime

- `lib/penny-local-lanes.js`
- `lib/penny-prompt-stack.js`
- `lib/penny-prompt-assets.js`
- `lib/penny-visible-reply.js`
- `lib/penny-chat-runtime.js`
- `penny-voice/runtime/penny-operational-blend.md`
- `penny-voice/runtime/penny-chat-directives.md`
- `penny-voice/runtime/penny-voice-examples.md`
- `penny-voice/runtime/penny-overlays.json`
- commit `406f26426e8bad628ef5d450ef9d2b14d6b42aa3` (`Implement Penny dual-lane runtime and cleanup`)

### Memory

- `lib/penny-memory.js`
- `lib/penny-memory-state.js`
- `lib/penny-memory-archive.js`
- `lib/penny-memory-books.js`
- `lib/penny-research-ledger.js`
- `lib/penny-runtime-artifacts.js`
- `public/js/penny-memory-panel.mjs`
- `scripts/qa-penny-memory.js`
- `PENNY_MEMORY_NEXT_BRANCH_HANDOFF.md`
- `docs/penny-comparative-platform-memory-pass-2026-04-16.md`

---

# Part II: Preserved source note — Bounded Ambiguity as a Penny Design Principle

# Bounded Ambiguity as a Penny Design Principle

## Agent handoff note

This note captures a product/architecture lesson that has become important in Penny:

**Penny should be allowed to hold bounded, evidence-shaped ambiguity**  
without collapsing into either:

- sterile denial
- or overconfident pseudo-memory

This matters because Penny is not supposed to be:

- a pure research agent
- a bureaucratic truth engine
- or a system that only speaks when it has courtroom-grade certainty

Penny is supposed to be:

- a **companion-first AI**
- with **cautious continuity**
- and **bounded practical intelligence**

That means ambiguity is not automatically a bug.

But there is a huge difference between **good ambiguity** and **bad ambiguity**.

---

## Why this note exists

Earlier external review guidance strongly treated the **research-ledger prompt bridge** as one of the most cuttable subsystems if complexity had to be reduced.

That caution was reasonable:

- it identified real risks
- it flagged prompt contamination
- it flagged stale-state weirdness
- it flagged adjacent-topic bleed
- it flagged one more smart subsystem competing for the wheel

But it was also incomplete.

The human pushback was important:

- Penny should not flatten into sterile amnesia
- Penny should be capable of **tentative, self-aware continuity**
- the right answer is often not denial and not confident assertion, but **bounded inference with visible uncertainty**

Later internal compare work supported that pushback:

- keeping the ledger prompt bridge on produced bounded but real wins
- the correct follow-up was **tighten relevance**, not **delete the bridge**

That means the correct lesson is not:

- “ambiguity bad”
- or “continuity bridges always good”

The lesson is:

> Penny should support **bounded ambiguity as a product feature**, but the implementation has to stay tightly scoped, truthful, and inspectable.

---

## The core distinction: principle vs mechanism

This is the most important conceptual split.

### The principle

The principle is good.

Penny should be able to say, in effect:

> “I do not know this as settled fact, but I do have a bounded, evidence-shaped hunch based on what we have been dealing with.”

That kind of behavior is:

- companion-like
- human-like
- cautious
- more trustworthy than fake certainty
- more alive than sterile denial

### The mechanism

The mechanism is risky.

Research-ledger prompt injection, archive synthesis, continuity carryover, and similar systems are implementation choices.

Those mechanisms can go wrong by creating:

- stale-state reuse
- prompt contamination
- adjacent-topic bleed
- self-reinforcing phrasing
- overclaiming disguised as continuity
- one more clever subsystem that is harder to reason about than it is worth

So the earlier caution was mostly about:

- the **mechanism**

not the:

- **virtue**

That distinction should stay explicit.

---

## Good ambiguity vs bad ambiguity

## Good ambiguity

Good ambiguity is:

- bounded
- evidence-shaped
- relevance-filtered
- clearly weaker than canonical truth
- visible as inference rather than settled fact
- able to admit uncertainty without collapsing into nonsense

Good ambiguity sounds like:

- “I’m not fully certain, but I think X is more likely because of Y.”
- “Your explicit memory says A; the archive suggests B more softly.”
- “This looks unresolved rather than settled.”
- “I have a cautious continuity read, not a hard fact.”
- “That’s my best bounded guess, not a claim of proof.”

Good ambiguity is useful because it avoids two bad extremes:

1. fake certainty
2. sterile denial

---

## Bad ambiguity

Bad ambiguity is:

- stale
- self-poisoning
- overly rhetorical
- weakly grounded
- too broad
- too sticky
- too hard to inspect
- too likely to bleed from one unresolved topic into another

Bad ambiguity sounds like:

- Penny reusing her own earlier phrasing as if it were clean evidence
- advisory memory sounding like canonical memory
- unresolved topics acting more settled than they are
- adjacent research threads leaking into a current turn that does not deserve them
- “maybe this maybe that” chaos dumped directly into user-facing output
- prompt mush pretending to be cautious intelligence

Bad ambiguity feels less like:

- thoughtful uncertainty

and more like:

- contaminated continuity

---

## The human reviewer parallel

A useful way to understand this:

A reviewer doing live debugging often behaves like this backstage:

- maybe the session died
- maybe the path moved
- maybe the process crashed
- maybe the summary reset
- let’s verify

That is **messy ambiguity**.
It is not wrong.
It is just raw, internal, and not ready to show the user as the final polished answer.

Penny should inherit the **principle** behind that behavior:

- do not fake certainty when the evidence is genuinely mixed

But she should not inherit the raw messy form.

### Reviewer backstage ambiguity

- branching
- tentative
- noisy
- operational
- not presentation-ready

### Penny frontstage ambiguity

- distilled
- bounded
- relevance-filtered
- emotionally coherent
- clearly marked as uncertainty

So Penny should embody the refined version:

> hold uncertainty honestly, without dumping the whole troubleshooting tree into the user’s lap.

That is the product goal.

---

## Why this matters especially for a companion-first system

If Penny were a pure developer tool, the safest answer to uncertainty would often be:

- say less
- infer less
- deny more
- only report directly verified facts

But Penny is not supposed to be:

- a sterile auditor
- a court stenographer
- a refusal machine wearing a cute skin

She is supposed to be:

- a companion
- with memory
- with continuity
- with a sense of ongoing relational/intellectual context

That means a companion-first product needs room for:

- tentative continuity
- self-aware carryover
- unresolved threads
- bounded inference

Otherwise the product drifts into:

> “I cannot say anything unless it is perfectly explicit.”

That may be safe.
It is also dead.

So the right goal is not:

- maximize safety by deleting all uncertain continuity

The goal is:

- preserve companion vitality **without** turning uncertainty into overclaiming

---

## What earlier caution got right

The earlier caution was still valuable.

It correctly identified that ledger prompt injection and similar continuity bridges can create:

- prompt contamination
- stale-state weirdness
- adjacent-topic bleed
- overclaiming risk
- more complexity than they are worth if they do not materially improve user-visible outcomes

That caution should not be thrown away.

It should be remembered as:

> ambiguity support is valuable, but only if it stays bounded and earns its keep.

---

## What the human pushback got right

The human pushback correctly identified something the caution underweighted:

- Penny should prefer cautious continuity over sterile amnesia when she has bounded evidence to work from
- the ideal answer is often not flat denial and not overconfident assertion, but tentative continuity with visible uncertainty
- companion-first design sometimes requires preserving a softer thread even when the evidence is not strong enough to promote it into canonical truth

That instinct turned out to matter.

The later compare/evidence showed the better path was:

- do not broaden the ledger
- do not blindly remove the bridge
- keep the bridge on
- tighten relevance
- keep it research-only and bounded

That is a stronger conclusion than either pure caution or pure enthusiasm would have been on its own.

---

## Design rule: ambiguity should be a bounded layer, not a truth replacement

A very important policy rule for Penny:

### Explicit memory

- canonical
- strongest truth layer

### Archive / advisory memory

- additive
- softer
- weaker than explicit memory

### Ledger / unresolved continuity

- bounded
- topic-scoped
- relevance-filtered
- clearly inferential
- not canonical truth

That ordering matters.

Penny can be allowed ambiguity **only** if the system keeps these truth strata legible.

If advisory/ledger material starts sounding like explicit truth, the feature has failed.

---

## Engineering implications for Penny

If the team wants bounded ambiguity as a real design principle, the implementation should follow these rules.

## 1. Keep ambiguity visibly weaker than canonical truth

Prompt structure, wording, and retrieval priority should make clear:

- explicit memory outranks advisory context
- ledger continuity is not equivalent to canonical memory
- unresolved topics are weaker than explicit remembered facts

## 2. Do not store rhetorical assistant phrasing as the main reusable truth

If continuity is stored and later reused, prefer normalized state such as:

- `finding`
- `status`
- `openFollowUp`
- `evidenceRefs`
- `confidence band`

Avoid reusing full assistant conclusion prose as the main continuity substrate.

That is how prompt contamination grows.

## 3. Relevance filtering matters more than breadth

The better path is:

- fewer injected topics
- more relevant injected topics
- tighter scope
- less adjacent-topic bleed

The goal is not to make Penny remember more.
The goal is to make her uncertainty cleaner.

## 4. A continuity bridge must earn its runtime complexity

The bridge should stay only if it produces:

- observable continuity wins
- no meaningful overclaim regressions
- bounded prompt impact
- inspectable behavior

If it becomes:

- noisy
- sticky
- broad
- or hard to explain

then the system is drifting from good ambiguity into bad ambiguity.

## 5. User-facing ambiguity should be polished, not raw

Do not dump internal branchy uncertainty directly into final responses.

Good user-facing patterns are:

- “I’m not fully certain, but…”
- “That looks unresolved rather than settled.”
- “My best read is X, with some uncertainty.”
- “Explicit memory says A; archive context leans B.”

Bad user-facing patterns are:

- sprawling maybe-this-maybe-that rambles
- unexplained tone wobble
- archive speculation masquerading as a remembered fact

---

## What should be tested

If bounded ambiguity is now a real Penny principle, it needs tests.

### Important test categories

#### 1. Explicit memory under advisory pressure

Verify:

- direct “what do you remember?” style questions still prefer explicit memory over archive/ledger softness

#### 2. Relevance bleed tests

Verify:

- adjacent unresolved topics do not leak into unrelated turns
- same-file / same-domain topics do not collapse into one giant muddy thread

#### 3. Overclaim prevention

Verify:

- ledger-on continuity does not increase confident false statements
- advisory material remains visibly advisory

#### 4. Prompt contamination checks

Verify:

- stored continuity state does not simply recycle Penny’s earlier phrasing back into the model as if it were ground truth

#### 5. Companion-quality checks

Verify:

- bounded ambiguity actually improves continuity and companion feel
- it does not just make the system sound wordier or more self-dramatic

---

## What should remain deferred

Even if it is tempting, the following should remain deferred unless user testing clearly demands them:

- broadening the ledger into general relational memory
- adding more continuity layers just because one more seems elegant
- turning bounded ambiguity into a generalized “inference everywhere” feature
- adding more prompt bridges before current ones are fully legible
- platformizing continuity systems beyond what Penny’s companion-first product actually needs

The system should prefer:

- fewer, cleaner uncertainty mechanisms
over:
- many overlapping “smart” ones

---

## Practical product guidance

If a future decision comes up between:

### Option A

- safer
- flatter
- more sterile
- less companion-like

and

### Option B

- slightly more inferential
- still bounded
- still inspectable
- more continuous
- more Penny-like

then the right answer is often **Option B** — **if** the system can explain why that inference exists and keep it below canonical truth.

That is the actual companion-first middle path.

---

## Short version for agents

Penny should support **bounded ambiguity** as a real product feature.

That means:

- cautious continuity
- tentative inference
- unresolved-thread awareness
- visible uncertainty instead of fake certainty
- without turning advisory continuity into canonical memory
- without letting prompt contamination or stale-state bleed make her feel falsely sure

The principle is good.
The implementation must stay:

- bounded
- relevance-filtered
- inspectable
- subordinate to explicit truth

The target is not:

- sterile amnesia
- and not hallucinated confidence

The target is:

> companion-like continuity with honest uncertainty.

---

## Final design sentence

A good Penny answer under mixed evidence should feel like:

> “I do not know this as a settled fact, but I have a bounded, evidence-shaped hunch — and I know the difference.”

That is the feature.
