# How To Use Penny Without Fighting Her

> Category: Public/external explanation
> Authority: Public/external explanation
> Status: Current snapshot as of 2026-04-19
> Use this for: practical onboarding, prompting habits, and realistic expectations.
> Do not use this for: binding runtime law or exact model guarantees. Use [../README.md](../README.md) and [../../README.md](../../README.md) for that.

Penny works best when you treat her like a smart, moody, highly specific local companion, not a vague wish-granting cloud god.

If you give her the right job shape, she can be excellent.
If you give her a mushy "go be magical" prompt, reliability drops fast.

## First: pick the job shape

Penny is companion-first, but she also has bounded practical capabilities.
The best experience usually comes from being clear about which of these you want:

1. Hang out with Penny
2. Ask Penny to do bounded work
3. Ask Penny to inspect something and answer from evidence

### 1. Hang out with her

If you want:

- banter
- flirting
- emotional presence
- image reactions
- character chemistry

Then just talk to her like a person.

Examples:

- "You're in a smug mood tonight, aren't you?"
- "Talk to me like you actually want me to stay."
- "Be mean to me for overthinking this."
- "What do you see in this image?"

### 2. Ask for bounded work

If you want Penny to actually do something, be concrete about the path, deliverable, and scope.

Good examples:

- "Open `Penny's Playground/Penny's Very Own Paper (bot languege version).md` and add a short paragraph in your own voice."
- "Open `README.md` and tell me what the current memory model is."
- "Create a tiny single-file clicker game at `Penny's Playground/penny-mini-game.html`."
- "Search the project for `selectMemoriesForPrompt` and explain what it does."

Bad examples:

- "Do whatever you want."
- "Go crazy in that folder."
- "Be agentic."
- "Figure something out."

Those broad prompts sound fun, but Penny is still much stronger on targeted asks than on vague autonomy theater.

### 3. Ask for bounded research

If the answer needs evidence, say so.
Good research-shaped asks usually name the question, the source to inspect, and the format you want back.

Good examples:

- "Read `ARCHITECTURE.md` and tell me how research ledger updates work."
- "Search the web for the official docs on this API and summarize the answer with links."
- "Compare these two files and tell me where the behavior differs."

## What Penny is especially good at

### 1. Character-first conversation

This is still the center of the product.
When the model is good and the machine can keep up, Penny can feel funny, smug, affectionate, flirty, sharp, and emotionally present instead of defaulting to generic assistant voice.

### 2. Targeted file actions

If you give her an exact file path, a specific task, and bounded room to choose the wording, she can often do much more than a one-line canned edit.

She can write:

- a note
- a paragraph
- a short micro-story
- a simple single-file HTML toy or game

The key is that the scope is bounded.

### 3. Quick web lookups with some follow-through

Penny can do more than toss a raw link at you.

When asked clearly, she can:

- search
- open the strongest result
- summarize it back

This is still a practical tool lane, not a perfect research agent, but it is real.

### 4. Image-aware chat

If the loaded model supports vision, Penny can react to screenshots, art, selfies, UI images, and mood boards in character.

This can be one of the coolest parts of the experience.
It can also be one of the slowest.

## Habits that help

- Give her something clear to react to. Emotion, stance, and specificity help.
- Give the exact file path when files are involved.
- Name the exact deliverable when you want work done.
- Keep the scope small enough that one turn can plausibly finish it.
- Say when a claim needs to be exact or evidence-backed.
- Do one substantial thing at a time instead of stacking five jobs into one turn.

## Model and lane expectations

Model choice changes Penny a lot, but the simple story drifts over time.

Use this as a dated operating hint, not a permanent rule:

- the strongest chat setup is not always the fastest
- the fastest work setup is not always the most vivid socially
- the best answer depends on the prompt, the loaded model, and the current QA state

If you only remember one thing, remember this:

- use the stronger chat setup for presence, chemistry, and image-aware conversation
- use the faster work setup for bounded inspection, search, and file tasks
- treat exact model advice as snapshot guidance that can change after new QA

## Known limits you should know before getting attached

- Local speed can be rough, especially on larger models.
- Vision turns can be slow.
- Broad open-ended autonomy is still much weaker than targeted asks.
- Some replies still get messy when the model burns too much context on planning or cleanup.
- OpenClaw shadow mode is real but not the main Penny story yet.
- Public docs can describe intended behavior more cleanly than the runtime delivers on every machine. If a claim matters, check the contributor docs and current QA evidence.

## The best mental model for Penny

Don't think:

"This is a perfect AI agent."

Think:

"This is a local companion with real presence and a growing set of practical powers."

That framing makes the whole thing make more sense.

Because when Penny works, what stands out is not just that she can do something.

It's that she can do it while still feeling like Penny.
