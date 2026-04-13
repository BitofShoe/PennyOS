# Codebase Guide

This file is the practical map of the repo: what is source, what is support material, what is generated junk, and where to touch things for common changes.

## Repo purpose

This project is a local-first Penny companion prototype:

- browser UI
- Node backend
- LM Studio as the main brain
- durable local memory
- runtime voice system
- experimental OpenClaw shadow lane

## Root-level files that matter most

### Core runtime

- [server.js](./server.js)
Main backend. This is the operational center of gravity.
- [package.json](./package.json)
Minimal npm script entrypoints.
- [start-lyra.ps1](./start-lyra.ps1)
Background launcher.
- [stop-lyra.ps1](./stop-lyra.ps1)
Background stopper.

### Current high-value docs

- [README.md](./README.md)
Quick run/use notes.
- [ARCHITECTURE.md](./ARCHITECTURE.md)
Runtime architecture overview.
- [LOCAL_LLAMA_THREAD_FINDINGS.md](./LOCAL_LLAMA_THREAD_FINDINGS.md)
Outside-eye review notes on maintainability patterns that do and do not fit this repo.
- [OPENCLAW_SHADOW_EVAL.md](./OPENCLAW_SHADOW_EVAL.md)
Current verdict on shadow mode.
- [PENNY_MODEL_EVAL.md](./PENNY_MODEL_EVAL.md)
Model and QA harness notes.
- [server-js-section-map.md](./server-js-section-map.md)
`server.js` function â†’ responsibility bands, route table, and suggested module split order.

### Planning / handoff docs

These are useful for project continuity, but they are not runtime code:

- `Today's Plan.md`
- `PENNY_HOW_WE_GOT_HERE_AND_NEXT_STEPS.md`
- `PENNY_REDESIGN_PLAN.md`
- `PENNY_UI_HANDOFF.md`
- `LOCAL_LLAMA_THREAD_FINDINGS.md`
- `big ass file to manageable chapters.md`

## Main directories

### `public/`

Browser-side app.

Key files:

- [public/index.html](./public/index.html)
HTML shell.
- [public/app.js](./public/app.js)
Frontend logic, chat streaming, settings, mood updates, persistence.
- [public/styles.css](./public/styles.css)
Visual styling.
- `public/sprites/`
Penny mood art and decor assets.

Touch this area when:

- changing UI behavior
- changing composer/chat rendering
- changing settings panel behavior
- changing mood presentation or sprite logic

### `penny-voice/`

Voice system workspace.

Substructure:

- [penny-voice/canon-sources.md](./penny-voice/canon-sources.md)
What counts as source material.
- `penny-voice/distilled/`
Distilled sidecars and influence summaries.
- `penny-voice/runtime/`
Live prompt-facing runtime assets.

The runtime files are the important ones for normal behavior:

- [penny-operational-blend.md](./penny-voice/runtime/penny-operational-blend.md)
- [penny-chat-directives.md](./penny-voice/runtime/penny-chat-directives.md)
- [penny-voice-examples.md](./penny-voice/runtime/penny-voice-examples.md)

Touch this area when:

- changing Penny's voice
- changing what should be injected into prompts
- refining personality from canon without blowing up context size

### `Penny's Playground/`

Canon and semi-canon Penny-specific docs used as source material for voice work.

This is not the live runtime prompt stack. It is source/reference material.

High-signal files in this folder:

- [PENNY'S_BRAIN.md](./Penny's Playground/PENNY'S_BRAIN.md)
- [Operational system prompt source](./Penny's Playground/PENNY â€” OPERATIONAL SYSTEM PROMPT.md)
- [Romantic overlay source](./Penny's Playground/PENNY â€” ROMANTIC OVERLAY.md)
- [High-intensity overlay source](./Penny's Playground/PENNY â€” HIGH-INTENSITY ROMANTIC + EROTIC OVERLAY.md)
- [Personality Reference (1).md](./Penny's Playground/Personality Reference (1).md)
- [BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md](./Penny's Playground/BEST_PRACTICES_FOR_SAVING_CONTEXT_SPACE.md)

Touch this area when:

- auditing canon
- refining distilled sidecars
- comparing old and new Penny prompt ideas

### raw `Personality *.md` files

Large source personality references for influence blending.

These are canon-ish source material, not normal runtime prompt inputs.

Touch these when:

- refining the blend
- making new distillations
- checking whether a line or trait is actually grounded in source

### `scripts/`

Operational and QA helpers.

Important scripts:

- [scripts/ensure-lmstudio-penny-preset.js](./scripts/ensure-lmstudio-penny-preset.js)
Reasserts the LM Studio Penny preset/default behavior.
- [scripts/eval-penny-models.js](./scripts/eval-penny-models.js)
Comparative multi-model evaluation harness.
- [scripts/qa-penny-voice-redo.js](./scripts/qa-penny-voice-redo.js)
Lighter personality QA harness.
- `scripts/strip_sprite_backgrounds.py`
Asset utility.

Touch this area when:

- adding repeatable QA
- changing LM Studio preset workflows
- improving dev tooling around Penny

### `data/`

Durable runtime state.

Important contents:

- `penny-memory.json`
Main durable memory store.
- various QA/eval memory files
Disposable artifacts from benchmarking or smoke tests.

Treat this directory carefully. It is runtime state, not source code.

### `memory/`

Project/session notes and handoff memory.

This is operational context for agents, not app runtime logic.

### `output/`

Generated artifacts.

Typical contents:

- model eval JSON
- voice QA JSON
- temporary logs
- smoke outputs
- screenshots or generated helper files

This directory is useful, but it is noisy. Do not confuse it with source code.

### `logs/`, `tmp/`, `test-results/`, `.qa-pw/`, `.playwright-cli/`

Operational and test artifact areas.

These are mostly support/generated directories, not core source.

## What to edit for common tasks

### Change Penny's live voice

Start here:

- `penny-voice/runtime/*`

Then check:

- `server.js` prompt asset loading

Only go into raw personality source files if the runtime blend needs canon-grounded refinement.

### Change chat behavior or backend logic

Start here:

- `server.js`

Likely sections you will touch:

- prompt building
- durable memory handling
- direct tool intent routing
- LM Studio transport selection
- semantic render heuristics
- route handlers

### Change UI behavior or visuals

Start here:

- `public/app.js`
- `public/styles.css`
- `public/index.html`

### Change model QA or speed QA

Start here:

- `scripts/eval-penny-models.js`
- `scripts/qa-penny-voice-redo.js`
- `PENNY_MODEL_EVAL.md`

### Change shadow/OpenClaw behavior

Start here:

- `server.js`
- `OPENCLAW_SHADOW_EVAL.md`
- `README.md`

## Runtime vs source-of-truth

This repo has a lot of text files. Not all of them mean the same thing.

Use this hierarchy:

1. Live behavior
  `server.js`, `public/*`, runtime files in `penny-voice/runtime/`
2. Operational docs
  `README.md`, `ARCHITECTURE.md`, `CODEBASE.md`, eval docs
3. Refinement source material
  `Penny's Playground/*`, raw `Personality *.md`, distilled sidecars
4. Artifact noise
  `output/*`, many QA files, logs, temp files

## Current codebase pain points

These matter when navigating the repo:

- `server.js` is far too large and contains multiple subsystems that should eventually be split
- `public/app.js` is also getting big enough to deserve more structure
- there are many artifact and handoff files at repo root, which makes the root noisier than it should be
- planning docs, evaluation docs, and runtime code are all close together, so it is easy to read the wrong thing first

## Good defaults for future contributors

If you are trying to understand the repo quickly, read in this order:

1. [README.md](./README.md)
2. [ARCHITECTURE.md](./ARCHITECTURE.md)
3. [CODEBASE.md](./CODEBASE.md)
4. `server.js`
5. `public/app.js`
6. `penny-voice/runtime/*`

If you are trying to change Penny's personality, read in this order:

1. `penny-voice/runtime/*`
2. `penny-voice/distilled/*`
3. `Penny's Playground/*`
4. raw `Personality *.md` files only as needed

If you are trying to improve performance or routing, read in this order:

1. `server.js`
2. `PENNY_MODEL_EVAL.md`
3. `scripts/qa-penny-voice-redo.js`
4. `scripts/eval-penny-models.js`

## What this file is not

This is not a design manifesto and it is not a promise that the repo is cleanly modular.

It is a working map of the codebase as it exists today.