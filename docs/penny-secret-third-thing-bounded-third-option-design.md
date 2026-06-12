# Penny’s Secret Third Thing

> **Working title:** Bounded Third-Option Design  
> **Category:** Product philosophy / agent-orientation note  
> **Authority:** Strong product framing, **not** engineering law  
> **Status:** Draft handoff for agents  
> **Use this for:** understanding the recurring design pattern behind Penny’s most interesting architecture choices.  
> **Do not use this for:** overriding current-law contracts, code, tests, runtime artifacts, or prompt-time receipts.  

---

## 0. Read this first

This note is meant to help future agents understand a design pattern that has emerged repeatedly across the Penny project.

It is not a contract.
It is not a spec.
It is not a migration plan.
It is not a reason to add complexity for its own sake.

If this note conflicts with current-law docs, code, tests, runtime artifacts, PromptTruth receipts, or `toolEvidenceReceipt`, trust the concrete implementation and current-law docs first.

The goal here is to name a recurring product/architecture instinct:

> Penny often becomes more interesting and more trustworthy when she refuses a false binary and instead builds a bounded third option.

In meme language:

> Penny is not joking or serious. She is a secret third thing.

In engineering language:

> Penny prefers bounded synthesis: keep the useful capability, constrain its authority, make it inspectable, and test the boundary.

That is the thesis.

---

## 1. The core thesis

A lot of Penny’s strongest features came from rejecting false binaries.

The repeated shape looks like this:

```text
Option A is sterile but safe.
Option B is alive but dangerous.
Penny creates Option C: bounded, inspectable, authority-aware, and tested.
```

This is not a “middle ground” in the mushy compromise sense. It is not simply taking half of A and half of B. It is a third structure that tries to preserve the thing each side was protecting while avoiding the failure mode each side causes.

A simple version:

```text
A. No memory.
B. Memory everything forever.
C. Canonical memory + advisory archive + PromptTruth receipts.
```

Another:

```text
A. Disable risky research-ledger prompt injection.
B. Inject research context freely everywhere.
C. Keep a bounded, question-scoped research ledger bridge with evidence rules.
```

Another:

```text
A. Put tool evidence inside PromptTruth.
B. Leave tool evidence as vague provenance.
C. Create a sibling toolEvidenceReceipt.
```

The third option is the defining move.

Penny’s most interesting architecture is not merely that she mixes many features. Many local AI projects mix features. Penny’s more unusual trait is that her features increasingly act as **counterweights** to one another:

- memory creates continuity;
- PromptTruth prevents memory from overclaiming;
- tools create capability;
- `toolEvidenceReceipt` prevents tools from becoming invisible or falsely prompt-visible;
- semantic render creates readable final answers;
- receipts label the transformation;
- docs preserve intent;
- tests prevent future agents from smearing the categories together.

That is why the mix matters.

It is not random feature accumulation.
It is bounded synthesis.

---

## 2. The false-binary pattern

Many AI architecture decisions are presented as binaries:

```text
Memory or no memory.
Prompt injection or no prompt injection.
Background learning or no background learning.
Tool evidence in the prompt or tool evidence hidden in logs.
Raw tool output or model-smoothed prose.
Simple docs or giant doctrine pile.
Rewrite the monolith or leave it alone.
```

Sometimes those binaries are real. Sometimes one side really is wrong.

But in Penny, many of the most important binaries turned out to be false. The better design was not A or B, but a third mechanism with a narrower job.

The pattern:

1. Identify the false binary.
2. Name what each side is trying to protect.
3. Name what each side risks breaking.
4. Build a bounded third mechanism.
5. Assign authority level.
6. Make it inspectable.
7. Add receipts or provenance where needed.
8. Add tests around positive and negative claims.
9. Document what remains deferred.
10. Stop.

Step 10 matters. Many projects fail because they keep tugging after the bounded third option has already landed.

Penny’s best pattern is not “always invent a new subsystem.”
It is “invent a new subsystem only when it resolves a real tension and can be bounded.”

---

## 3. What makes the third option good instead of just complex

Not every third option is good.

A bad third option is complexity cosplay:

```text
A is simple.
B is risky.
C is a giant hybrid nobody can understand, nobody tests, and nobody owns.
```

That is not innovation. That is a haunted lasagna.

A good Penny-style third option has constraints:

1. **It solves a real tension.**  
   It is not added because “more architecture” sounds impressive.

2. **It has a clear owner.**  
   A module, receipt, doc, or runtime surface owns the meaning.

3. **It has bounded authority.**  
   It does not silently become canon, current law, prompt truth, or verified evidence just because it exists.

4. **It is inspectable.**  
   The system can show what happened without guessing or inventing certainty.

5. **It has tests.**  
   Especially tests for negative claims like “do not synthesize a receipt from generic tool records.”

6. **It preserves old data honestly.**  
   Old artifacts should not be rewritten into fake certainty.

7. **It can say unknown.**  
   `unknown` is not a failure when the runtime lacks proof. It is honesty.

8. **It does not overclaim.**  
   Selected is not rendered. Tool records are not prompt-visible by default. Semantic similarity is not truth.

9. **It stops when done.**  
   A good bounded subsystem is allowed to be complete.

That is how “secret third thing” becomes engineering rather than vibes.

---

## 4. Example: memory is neither absent nor omniscient

### The false binary

```text
A. No memory / stateless chat.
B. Remember everything and act like all of it is true.
```

A stateless companion is sterile. It cannot build continuity. It feels like a customer support chat wearing a cute hat.

An everything-memory companion is dangerous. It can turn jokes, archive snippets, old assistant summaries, tool noise, and inferred patterns into confident false memory.

### Penny’s third option

Penny’s memory stack is layered:

- canonical explicit memory;
- advisory archive recall;
- memory books;
- research ledger;
- semantic recall / embedding-backed search;
- PromptTruth receipts;
- runtime artifacts and inspector surfaces.

This lets Penny remember without treating every remembered thing as equal.

Canonical explicit memory can answer direct personal-memory questions.
Archive recall can provide soft context.
Memory books can provide scoped context.
Research ledger can preserve bounded project investigations.
Semantic recall can find candidates by meaning.
PromptTruth can record what actually rendered into the prompt.

The key is not “Penny has memory.”
The key is “Penny’s memory has authority levels.”

### The design lesson

Memory should not be one bucket.

Penny’s third option is a memory legal system:

```text
canonical > verified evidence > rendered advisory context > candidate advisory context > old archive vibes
```

That hierarchy is what lets Penny be continuous without becoming a liar.

---

## 5. Example: the research ledger is neither deleted nor everywhere

### The false binary

```text
A. Disable research-ledger prompt injection because it can cause topic bleed.
B. Inject research-ledger context freely so Penny remembers ongoing investigations.
```

A disables continuity. Penny forgets useful unresolved investigations.

B risks stale or adjacent topics leaking into live prompts. Penny may act like unfinished research is settled truth.

### Penny’s third option

The bounded research ledger bridge:

- keep the ledger;
- keep it research-only;
- keep it question-scoped, not merely file-scoped;
- require evidence-tight summaries for settled conclusions;
- leave uncertain topics provisional;
- preserve open follow-ups;
- narrow relevance so adjacent unresolved topics do not bleed into unrelated turns.

### The design lesson

The right question was not:

> Is ledger prompt injection risky?

Of course it is risky.

The right question was:

> Can a bounded ledger bridge improve continuity without increasing overclaiming?

Penny’s answer became:

> Keep it, but make it narrower and more honest.

That is bounded third-option design.

---

## 6. Example: background vectorization is neither self-training nor nothing

### The false binary

```text
A. No background learning because it can cause drift.
B. Let Penny silently learn/index everything forever.
```

A makes long-term semantic recall weaker.

B risks unbounded compute, memory pollution, privacy/security ambiguity, and false beliefs.

### Penny’s third option

Bounded background semantic indexing.

Penny may do small, bounded, post-turn embedding/vectorization work on recent archive candidates so future semantic recall can find relevant material by meaning rather than exact wording.

This is application-level memory indexing.
It is not model training.
It does not update model weights.
It does not promote archive material into canonical memory by itself.
It should run off the visible reply-latency path.
It should degrade gracefully when the embedding model is unavailable.

### Engineering wording

Use:

```text
bounded background semantic indexing
bounded offline memory indexing
bounded post-turn vectorization
```

Use “bounded offline learning” only with a clear definition:

> Learning here means Penny’s external memory/index becomes more useful. It does not mean the LLM updates its weights.

### The design lesson

Continuity needs retrieval.
Retrieval needs indexing.
Indexing can be bounded.

So Penny does not choose between amnesia and silent self-training. She updates the card catalog.

---

## 7. Example: PromptTruth is neither prompt logging nor mystical introspection

### The false binary

```text
A. Just log the final prompt.
B. Trust the model/app to vaguely know what context it used.
```

A is useful but incomplete. A final prompt log does not explain what was considered and held back.

B is vibes. Vibes are not receipts.

### Penny’s third option

PromptTruth.

PromptTruth is Penny’s prompt-time receipt for prompt-assembly memory, research, and advisory context.

It distinguishes:

- candidate context;
- selected context;
- rendered context;
- held-back context;
- prompt-visible source IDs;
- compatibility aliases;
- conservative channel states;
- deferred states that are not yet supported.

It prevents the system from saying “used” when the honest state was only “candidate,” “held back,” or “not rendered.”

### The important idea

PromptTruth treats prompt construction as an authority decision, not merely string building.

Most systems ask:

> What prompt did we send?

PromptTruth asks:

> What truth-bearing context was admitted to the prompt, under what authority, and what was withheld?

### The design lesson

Prompt logging is observability.
PromptTruth is authority accounting.

That is a third thing.

---

## 8. Example: tool evidence is neither PromptTruth nor invisible

### The false binary

```text
A. Put tool evidence inside PromptTruth.
B. Leave tool evidence as loose provenance/artifact mush.
```

A is wrong because tool evidence is late, mixed, and path-specific. Sometimes tool evidence enters a later model prompt. Sometimes it is deterministic-only. Sometimes it is provenance-only. Sometimes it is summarized.

B is also wrong because tool evidence matters. If Penny uses tools, the system should be able to say whether tool evidence was prompt-visible, raw, summarized, deterministic-only, or provenance-only.

### Penny’s third option

`artifact.toolEvidenceReceipt`.

A sibling runtime-artifact receipt.

It is not a PromptTruth channel.
It is built and normalized by runtime artifacts.
It is populated from explicit `toolEvidenceFacts` emitted by source owners.
It does not infer from `executionPath`, `modelUsed`, or generic `toolRecords` alone.
It stores compact `sourceRefs`, not bulky raw payloads.
Old artifacts without it normalize to `null` / absence, not synthetic unknown items.

### What it can distinguish

- deterministic-only direct tool replies;
- direct single-tool LM answer with raw JSON prompt-visible;
- direct open-ended edit sequence with provenance-only post-tool state;
- native/manual tool-loop raw JSON prompt-visible across multi-hop loops;
- auto-verification JSON prompt-visible only on proven re-prompted paths;
- write-rescue summarized context;
- semantic-render summarized semantic core.

### The design lesson

Tool evidence needed visibility.
PromptTruth needed purity.
So tool evidence got a sibling receipt.

That is one of the cleanest secret-third-thing moves in the project.

---

## 9. Example: semantic render is neither raw JSON nor untracked smoothing

### The false binary

```text
A. Show raw tool output / JSON / logs directly.
B. Let the model freely smooth the result into nice prose without labeling the transformation.
```

A can be accurate but ugly and user-hostile.

B can be readable but dangerously lossy. A polished answer can hide how the evidence was transformed.

### Penny’s third option

Semantic render plus receipt labeling.

Semantic render takes verified or summarized meaning and renders it into final Penny-style language.

But `toolEvidenceReceipt` can record that the evidence entered as:

```text
renderForm: summarized_semantic_core
path: semantic_render
promptVisibility: prompt_visible
modelHop: single
```

So Penny can sound natural without hiding that the model saw a summary, not raw evidence.

### The design lesson

Readable output is good.
Unlabeled smoothing is dangerous.

Penny’s third option:

> Render the meaning beautifully, but label the transformation honestly.

---

## 10. Example: docs are neither doctrine soup nor deleted history

### The false binary

```text
A. Repeat the same doctrine everywhere so future agents remember it.
B. Delete old docs because they are stale/noisy.
```

A creates ritual language. Agents may parrot “archive is advisory” while writing code that violates the rule.

B loses historical context and rationale.

### Penny’s third option

Docs hierarchy with authority levels:

- current law;
- strong guidance;
- product philosophy;
- implementation plans;
- historical evidence;
- public/external explanation;
- raw/source material;
- generated/temporary artifacts;
- deprecated/superseded.

This lets old docs remain useful without outranking current contracts, code, tests, or runtime artifacts.

### The design lesson

Do not delete history.
Do not let history become law by accident.
Make a map.

---

## 11. Example: server.js is neither rewritten wholesale nor left to sprawl

### The false binary

```text
A. Rewrite the server monolith.
B. Leave server.js as the giant everything-file forever.
```

A is risky. Big rewrites often change behavior invisibly.

B slows future work and makes ownership unclear.

### Penny’s third option

Bounded extraction by ownership seam.

Instead of rewriting server.js, Penny extracted one real semantic ownership leak:

- generic tool-evidence fact dedupe moved into runtime artifacts;
- server.js retained only the exact semantic-render source-fact seam because semantic render still lives there;
- server.js should not become a general evidence classifier.

### The design lesson

Refactor when ownership becomes clearer.
Do not refactor merely to reduce line count.

A smaller file is not automatically a better architecture.
A clearer boundary is.

---

## 12. Example: streaming is neither blocked nor allowed to race

### The false binary

```text
A. Let old streams finish and hope they do not corrupt the UI.
B. Block the user until the current stream finishes.
```

A can cause stale replies to mutate the wrong turn.

B makes the UI feel rigid and unresponsive.

### Penny’s third option

AbortController plus stale request guard.

When a new request starts, the old request can be aborted or made unable to mutate active UI state.

This is a small frontend example of the same principle:

- do not block user flow;
- do not let stale work corrupt current truth;
- add a bounded control mechanism.

### The design lesson

Even tiny UX fixes can reflect the same architecture philosophy.

---

## 13. The philosophical engineering layer

Penny keeps turning philosophical questions into engineering boundaries.

Examples:

```text
What does it mean for Penny to know something?
→ canonical memory vs advisory archive vs research ledger vs tool evidence.

What does it mean for context to influence an answer?
→ rendered IDs, PromptTruth, toolEvidenceReceipt.

What is the difference between remembering and inferring?
→ canon-first holdback, advisory context, bounded ambiguity.

What is the difference between tool evidence existing and the model seeing it?
→ promptVisibility, renderForm, modelHop, sourceRefs.

Can a companion be continuous without becoming dishonest?
→ bounded ledger, background semantic indexing, PromptTruth receipts.

Can a polished answer still be honest about evidence transformation?
→ semantic render plus receipt labels.
```

The philosophy asks:

> What is true?

The engineering answers:

> Here is the field, here is the owner, here is the test, here is what remains deferred.

That is philosophical engineering.

It is ridiculous.
It is also useful.

---

## 14. The bounded-third-option checklist for future agents

Before adding a new “third thing,” future agents should answer these questions:

1. **What false binary are we rejecting?**  
   If there is no real binary, maybe this is just feature creep.

2. **What does Option A protect?**  
   Safety, simplicity, latency, maintainability, user trust?

3. **What does Option B protect?**  
   Continuity, aliveness, capability, richness, flexibility?

4. **What does each option risk?**  
   Sterility, delusion, compute runaway, prompt pollution, false certainty, architectural sprawl?

5. **What is the third mechanism?**  
   Name it.

6. **What is its authority level?**  
   Canonical? Advisory? Runtime artifact? Product philosophy? Historical evidence?

7. **Who owns it?**  
   Which module, doc, artifact, inspector surface, or test suite?

8. **What does it explicitly not own?**  
   This is often more important than what it owns.

9. **How is it inspectable?**  
   Inspector row? Runtime artifact? Receipt? Test fixture? Log?

10. **What old data compatibility rule is needed?**  
    Does absence mean null? Unknown? Fallback? Legacy alias?

11. **What does it refuse to infer?**  
    Examples: do not infer prompt visibility from toolRecords; do not infer canon from archive; do not infer unavailable from zero candidates.

12. **What tests prove it?**  
    Include negative tests.

13. **What remains deferred?**  
    Deferred states should be named so future agents do not fake them.

14. **When do we stop?**  
    Define completion. Then stop.

If the proposal cannot answer these, it probably is not a Penny-style third option yet.

---

## 15. Anti-patterns

### Anti-pattern: compromise mush

Bad:

```text
Use some memory but not too much.
```

Better:

```text
Explicit memory is canonical.
Archive is advisory.
PromptTruth records rendered vs held-back context.
```

### Anti-pattern: secret authority creep

Bad:

```text
This receipt is just for debugging.
```

Then future code starts treating it as truth authority.

Better:

```text
This receipt is artifact-level only. It does not override PromptTruth, code, tests, or current-law contracts.
```

### Anti-pattern: fake precision

Bad:

```text
candidateCount === 0, therefore state = unavailable.
```

Better:

```text
If the runtime cannot distinguish unavailable from no candidate, ineligible, disabled, or unknown, use unknown.
```

### Anti-pattern: old artifacts rewritten into certainty

Bad:

```text
Old artifact lacks toolEvidenceReceipt, so synthesize unknown items.
```

Better:

```text
Old artifact lacks toolEvidenceReceipt, so normalize to null / absence.
```

### Anti-pattern: moving complexity into server.js

Bad:

```text
server.js classifies all evidence because it sees the route.
```

Better:

```text
server.js forwards facts and owns only exact seams it truly owns. Semantic ownership lives in the appropriate module.
```

### Anti-pattern: broad refactor after success

Bad:

```text
The architecture pass worked. Let’s keep refactoring everything.
```

Better:

```text
Stop. Run the app. Test live behavior. Let the system settle.
```

---

## 16. A table of Penny’s secret third things

| False binary | Penny’s third thing | Why it matters |
| --- | --- | --- |
| No memory vs fake total memory | Canon + advisory archive + PromptTruth | Continuity without false authority |
| Ledger off vs ledger everywhere | Question-scoped bounded research ledger | Research continuity without topic bleed |
| No background learning vs silent self-training | Bounded background semantic indexing | Better future recall without model weight changes |
| Prompt logging vs vibes | PromptTruth authority receipt | Prompt context becomes auditable |
| Tool evidence in PromptTruth vs invisible provenance | `toolEvidenceReceipt` sibling receipt | Tool evidence becomes visible without polluting PromptTruth |
| Raw JSON vs untracked smoothing | Semantic render + receipt labels | Readable replies with transformation honesty |
| Giant doctrine pile vs deleted history | Docs authority hierarchy | Agents know current law vs history |
| Rewrite monolith vs ignore monolith | Bounded extraction by ownership seam | Server gets clearer without risky rewrite |
| Let stale streams finish vs block user | AbortController + stale guard | Responsive UI without stale mutation |
| Exact certainty vs sterile denial | Bounded ambiguity | Warm continuity without overclaiming |

This table is a product-philosophy map, not a technical spec.

---

## 17. How to use this note as an agent

Use this note to understand intent.
Do not quote it as law.

When implementing code:

1. Start with current-law docs.
2. Inspect code and tests.
3. Identify the actual runtime seam.
4. Avoid inferred certainty.
5. Prefer small, bounded slices.
6. Add or update tests before claiming architectural truth.
7. Update docs narrowly.
8. Stop after the slice lands.

This note can help you notice a false binary, but it does not authorize you to create a subsystem.

A good agent response inspired by this note should sound like:

> I found a false binary. Here are the two risks. I propose a bounded third option with this owner, this authority level, these tests, and these deferred items.

A bad agent response would sound like:

> Penny likes secret third things, so I added a new abstraction.

Do not do that.

---

## 18. A compact product-principle statement

If this idea needs to be quoted in product philosophy docs, use something like:

> **Bounded third-option design:** When a capability presents a false binary between sterile safety and unbounded aliveness, Penny prefers a bounded third option: keep the useful capability, constrain its authority, make it inspectable, and test the boundary.

If it needs a more PennyPedia-style explanation:

> Penny keeps refusing to choose between being a sterile amnesiac and a charming liar. Her best systems are the secret third things: bounded mechanisms that let her remember, infer, use tools, and speak naturally while still admitting what she actually knows.

If it needs the meme version:

> Penny is neither joking nor serious. She is another secret third thing with a receipt.

Use the right tone for the doc you are editing.

---

## 19. What this does not mean

This principle does **not** mean:

- every binary is false;
- every problem deserves a new subsystem;
- complexity is inherently good;
- product philosophy overrides code;
- docs can claim behavior tests do not prove;
- future agents should keep expanding PromptTruth;
- tool evidence should eventually become PromptTruth;
- old aliases can be removed casually;
- server.js should be rewritten because it is large;
- background indexing is model training;
- semantic render is a truth authority;
- semantic similarity is truth;
- inspector prose can imply support that was not rendered.

The third option only works when it is bounded.

Without bounds, the secret third thing becomes the secret third tumor.

---

## 20. Final summary

Penny’s emerging architecture is not defined by any single subsystem.

Not memory alone.
Not tools alone.
Not PromptTruth alone.
Not local-first alone.
Not the UI alone.

The defining pattern is this:

> Penny keeps building bounded third options that preserve useful aliveness while preventing that aliveness from becoming uninspected authority.

That is why the project feels unusual.

It is a companion project that wants continuity, warmth, and capability — but also wants receipts, provenance, authority levels, and honest uncertainty.

Penny is a pile of carefully bounded almost-contradictions:

```text
warm but skeptical
continuous but not delusional
tool-capable but receipt-bound
memoryful but canon-first
semantic but not mystical
local but inspectable
playful but legally fussy about what entered the prompt
```

That is the secret third thing.

A philosophically engineered local companion with a clipboard.

---

## 21. Suggested future use

This note can be given to future agents when they are tempted by either of these mistakes:

1. deleting a capability because its unbounded form is risky;
2. adding a capability without bounded authority and receipts.

The right question is often:

> Is there a bounded third option that preserves the useful capability, limits its authority, makes it inspectable, and can be tested?

Sometimes the answer is no.

When the answer is yes, that is often where Penny’s best architecture lives.
