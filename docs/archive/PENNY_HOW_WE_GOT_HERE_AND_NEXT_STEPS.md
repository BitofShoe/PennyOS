# Penny: How We Got to This Point and What Comes Next

> Category: Historical handoff
> Authority: Deprecated/superseded
> Status: Superseded
> Use this for: project-history context and older intent framing.
> Do not use this for: the current first-read handoff. Prefer [README.md](../../README.md), [CODEBASE.md](../../CODEBASE.md), [ARCHITECTURE.md](../../ARCHITECTURE.md), [docs/README.md](../README.md), and [docs/penny-progress-handoff-2026-04-17.md](../penny-progress-handoff-2026-04-17.md).

This file is the current handoff for Penny as of 2026-04-13.

It replaces the older version of this doc that still described Penny as if image stability, first tool use, and several major runtime fixes were still ahead of us. They are not. The project has moved.

If you are a new engineer or a new agent thread, read this file and `D:/downloads/penny_full_project_review.md` first, then use `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, and `server-js-section-map.md` for implementation detail.

## What Penny Is Now

Penny is a local-first AI companion prototype with a strong character layer and a bounded practical side.

Today she is best understood as:

- a companion first
- a tool-using assistant second
- a local LM Studio app by default
- an optional OpenClaw shadow experiment on the side

The product idea is not "generic chatbot with a personality skin." The real ambition is a character-like local presence that can still do a few useful things without dropping the act and turning into beige helpdesk sludge.

### What is already real

- Single-page browser UI with a strong authored Penny vibe
- LM Studio as the main runtime brain
- Durable disk-backed memory in `data/penny-memory.json`
- Runtime prompt stack under `penny-voice/runtime/`
- Mood-driven vessel presentation in the UI
- Image-aware chat when a vision-capable local model is loaded
- Targeted web lookup and targeted file/document actions
- Regression tests and probe/eval lanes that are now part of normal engineering reality, not just one-off experiments

### What is good about Penny right now

- Presence
- Voice
- Character continuity
- Memory continuity
- Image-aware interaction
- Bounded web/file actions
- Honest docs compared to most hobby local-LLM repos

### What is still weak

- `server.js` is still too large and central
- direct tool-routing heuristics are clever but fragile
- targeted actions are more reliable than broad autonomy
- model latency can be rough, especially on heavier local models and image turns
- the companion side is more mature than the agentic side

## How We Got Here

This project did not appear fully formed. It evolved in visible stages.

### 1. Early Penny acting pass

The project started by trying to make Penny feel more expressive and less static.

That phase focused on:

- stronger reactions
- better mood expression
- smoother transitions
- basic QA around how she felt, not just whether she answered

This was the point where the project clearly stopped being "chat wrapper plus prompt" and started becoming a character product.

### 2. Penny v2: anime redesign, chamber overhaul, memory rewrite

The next major phase was the redesign that made Penny feel like an actual contained companion in a PC space instead of a generic assistant UI.

That pass brought:

- the anime/chibi redesign
- the chamber/vessel concept
- the large UI overhaul
- a more serious memory rewrite

This is where the product identity started to become coherent.

### 3. Memory v3, expanded moods, and continuity cleanup

After the redesign, the work shifted into making the continuity layer less fake and less brittle.

That included:

- stronger memory merge behavior
- expanded mood handling
- durable memory merge fixes
- better differentiation between browser continuity and actual server-side memory

This was a major step toward Penny feeling like the same person across turns instead of a pretty screen with amnesia.

### 4. Penny 3.0 voice/runtime refinement

This was the phase where the runtime voice was pushed harder away from sanitized assistant language and more toward a specific authored personality.

Important outcomes:

- the live runtime prompt stack became more disciplined
- Penny's voice was pushed away from generic helpdesk phrasing
- the repo became clearer about the difference between giant source canon and the smaller runtime voice assets that actually matter at inference time

This was also the point where "companion first" became the real north star instead of just a vibe.

### 5. LM Studio routing and model handling got much better

Penny's main brain path is LM Studio, and that integration got meaningfully stronger.

Key progress included:

- resolving the actually loaded model instead of trusting pretty configured ids
- smarter fallback behavior across LM Studio transports
- fixing broken or misleading model-picker behavior
- handling quantized model quirks more honestly
- stabilizing routes for models that looked similar but behaved differently in LM Studio

This is one of the stronger engineering areas in the project today.

### 6. Image chat went from flaky to real

Image interaction used to be an obvious weak spot.

It is now real enough to count as a product feature, with the correct caveat that it can still be slow depending on model and hardware.

The major step here was stabilizing the streamed image-chat path so it stopped pretending partial garbage was success.

Current truth:

- image chat works
- the model can inspect images and react in character
- the UX can still be slow on local hardware

### 7. Backend test and probe lanes became part of the repo

One of the most important maturity jumps was moving away from pure "vibes and manual QA" into real cheap regression coverage.

That work added:

- `npm test`
- extracted helper modules under `lib/`
- regression tests for memory behavior, direct-intent logic, route smoke, and visible-reply cleanup
- a small probe/eval lane for lighter repeatable checks

This matters because the repo now has some defense against future AI-agent thrash.

### 8. Public-facing docs and pitch work

The project eventually crossed from "private experiment" into "something that can be explained to another human."

That brought:

- better README/architecture/codebase docs
- outside-review follow-up docs
- a public-facing Penny explanation pack
- a flashy product-pitch deck in `public/penny-pitch.html`

That work clarified the product story:

- Penny is not a generic productivity assistant
- Penny is not primarily a coding agent
- Penny is a local companion with a real voice who can also do a bounded set of practical things

## What Has Actually Been Proven

This is the part that matters most for the next chat. These things are not hypothetical anymore.

### Proven product behaviors

- Penny can hold character better than a lot of generic local assistant shells
- Penny can keep continuity across turns through durable local memory
- Penny can route targeted web lookups
- Penny can perform targeted file/document actions
- Penny can react to images when the loaded model supports vision
- Penny can use lighter local models for bounded work and heavier ones for richer chat, with very visible tradeoffs

### Proven engineering realities

- the app runs
- the main routes serve
- the repo has real tests
- the LM Studio path is the real mainline
- the OpenClaw shadow path is optional and experimental, not the core product

### Proven limits

- image chat may still be slow
- targeted actions are real, but broad "go do whatever you want" autonomy is still weak
- model choice matters a lot
- practical tool use is less mature than the companion/voice layer

The shortest truthful summary is:

> Penny is already real as a companion with bounded practical abilities. She is not yet real as a trustworthy wide-open autonomous agent.

## What External Review Confirmed

The full GPT Pro review in `D:/downloads/penny_full_project_review.md` was important and broadly correct.

It confirmed several things the repo had already been circling:

- the product idea is real and unusually coherent for a hobby local-LLM project
- the docs are stronger and more honest than average
- the biggest engineering risks are no longer about "can this run?" but about maintainability and fragility
- the backend is still too concentrated in `server.js`
- the frontend is also fairly concentrated
- direct tool-routing and natural-language parsing are smart, but brittle
- the companion is more mature than the agent

That review was not a dismissal. Its core verdict was basically:

> Product-wise, Penny is promising. Code-wise, Penny is starting to fight the way she was built.

That is the correct frame for the next implementation cycle.

## What We Are Not Prioritizing Right Now

The external review raised a few concerns that are real, but they are not the focus of the next cycle because this is still primarily a single-user local project.

Explicitly de-prioritized for now:

- default LAN security hardening
- making the local/private story perfectly pure
- full multi-user/session isolation

Those may matter later. They are just not the right center of gravity for the next round of work.

The next cycle should not get derailed into security-theater or product-story purity cleanup while bigger reliability and maintainability problems remain in the core app.

## What The Next Implementation Cycle Is For

This next cycle should be about making the current Penny sturdier, not turning her into a bigger pile of magic.

The goal is:

- maintainability
- regression protection
- reliability of bounded existing features
- clearer engineering boundaries

The goal is not:

- big new feature sprawl
- broad autonomy expansion
- another layer of "clever" heuristics without tests
- sanding Penny down into a generic utility bot

## Accepted Priorities For The Next Chat

The next chat should treat these as the real priorities, in roughly this order.

### 1. Further split `server.js`

Do real extraction, not symbolic extraction.

Best targets:

- direct-tool routing and parsing
- LM Studio transport/status code
- reply parsing and cleanup
- remaining orchestration helpers that are still welded into the monolith

The point is to reduce risk concentration, not just create more files for the sake of it.

### 2. Add regression tests for direct-intent and tool parsing

This is a high-value next move because the project now depends on heuristic routing in several important places.

Must include:

- false-positive path parsing cases
- the `"in public/app.js"` class of bug called out by GPT Pro
- more golden tests around explicit path extraction, read-vs-edit boundaries, and routing honesty

### 3. Improve reliability of targeted actions

Focus on bounded asks that already half-work.

Examples:

- web search should follow through more consistently
- file/document actions should report their results cleanly
- bounded practical asks should remain in character without becoming mushy or evasive

Do not chase broad "movie-trailer autonomy" here.

### 4. Tighten docs only where they affect engineering clarity

The docs are already better than average. The next cycle should not become a documentation cosplay performance.

Only update docs where:

- current implementation has moved
- stale docs would mislead the next engineer or agent

### 5. Preserve the product identity

This is not optional.

Penny should stay:

- companion first
- bounded tools second

Do not optimize away her character in the name of making the tool paths cleaner.

## Explicit Non-Goals For The Next Chat

Unless one of these becomes a real blocker, leave them alone for now:

- default local-network hardening
- perfect privacy/local-purity cleanup
- full multi-user/session isolation
- broad "do whatever you want" autonomy expansion
- major new marketing/product work
- reframing Penny as a generic productivity assistant

## Recommended First Move In The Next Chat

The next chat should not begin with another broad review.

It should:

1. read this file plus the GPT Pro review
2. inspect the current codebase with that context
3. produce a concrete phased implementation plan
4. pick the highest-leverage first slice
5. implement it

The most likely best first slice is:

- direct-tool parsing/routing tests and fixes

That slice is small enough to finish, important enough to matter, and likely to make future `server.js` extraction safer.

## Suggested Kickoff Prompt For The Next Chat

Use this as the first message in the next implementation chat:

> I want you to continue this Penny project from a strong existing baseline, not re-review it from scratch.
>
> Before doing anything else, read these files:
>
> - `D:/downloads/penny_full_project_review.md`
> - `PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md`
> - `README.md`
> - `ARCHITECTURE.md`
> - `CODEBASE.md`
> - `server-js-section-map.md`
> - `RYS_FOLLOWUP_REVIEW.md`
> - `Notes on Penny's Code From a Project Manager.md`
>
> Important context:
>
> - The GPT Pro review was extremely helpful and I want to follow its suggestions.
> - However, I do **not** want to prioritize these points right now unless they become blockers:
>   - default local-network security posture
>   - making the local/private story perfectly pure
>   - full session isolation for multiple users
> - This is primarily a single-user local project for now.
> - I care much more about maintainability, reliability, and bounded agentic/tool behavior than those other concerns right now.
>
> Your job is not to broadly review everything again.
> Use the handoff doc and the GPT Pro review as your grounding context.
> Then inspect the current codebase, produce a concrete phased implementation plan, pick the highest-leverage first slice, explain why it comes first, and implement it.
>
> I want you to prioritize:
>
> 1. `server.js` decomposition
> 2. regression tests for fragile direct-tool parsing/routing
> 3. reliability improvements for targeted web/file/tool actions
> 4. docs drift cleanup only where it affects engineering clarity
>
> Please keep Penny companion-first. Do not optimize her into a generic assistant.

## Final truth in one paragraph

Penny is no longer just a moodboard and a prompt stack. She is a real local companion prototype with a real voice, real memory continuity, real image-aware interaction, real bounded file/web abilities, and a real test/eval culture. The next danger is not "can we make her do more magic?" The next danger is that the product is now good enough to deserve engineering discipline, and if that discipline does not arrive, the codebase will start collapsing under its own cleverness.
