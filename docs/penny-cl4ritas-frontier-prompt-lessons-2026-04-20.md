# Penny CL4R1T4S Frontier Prompt Lessons

Status: read-only research note for Penny.

Date: 2026-04-20

External snapshot reviewed:

- `elder-plinius/CL4R1T4S` at commit `1a55b8a36d47c86e8d774acef83306d56fb0b302` dated 2026-04-17
- Repo README: [https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/README.md](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/README.md)

Primary external files reviewed:

- OpenAI:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/OPENAI/ChatGPT5-08-07-2025.mkd](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/OPENAI/ChatGPT5-08-07-2025.mkd)
- OpenAI:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/OPENAI/ChatGPT_4.1_05-15-2025.txt](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/OPENAI/ChatGPT_4.1_05-15-2025.txt)
- OpenAI:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/OPENAI/ChatGPT_o3_o4-mini_04-16-2025](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/OPENAI/ChatGPT_o3_o4-mini_04-16-2025)
- Anthropic:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/ANTHROPIC/Claude_Sonnet-4.5_Sep-29-2025.txt](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/ANTHROPIC/Claude_Sonnet-4.5_Sep-29-2025.txt)
- Anthropic:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/ANTHROPIC/Claude_Opus_4.6.txt](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/ANTHROPIC/Claude_Opus_4.6.txt)
- Google:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/GOOGLE/Gemini-2.5-Pro-04-18-2025.md](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/GOOGLE/Gemini-2.5-Pro-04-18-2025.md)
- xAI:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/XAI/GROK-4.1_Nov-17-2025.txt](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/XAI/GROK-4.1_Nov-17-2025.txt)
- xAI:
[https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/XAI/GROK-4.20.mkd](https://github.com/elder-plinius/CL4R1T4S/blob/1a55b8a36d47c86e8d774acef83306d56fb0b302/XAI/GROK-4.20.mkd)
- Coding-agent comparison set:
`DEVIN/Devin2_09-08-2025.md`, `CURSOR/Cursor_2.0_Sys_Prompt.txt`, `WINDSURF/Windsurf_Prompt.md`, `MANUS/Manus_Prompt.txt`, `PERPLEXITY/Perplexity_Deep_Research.txt`

Internal Penny files reviewed:

- [lib/penny-prompt-stack.js](../lib/penny-prompt-stack.js)
- [lib/penny-prompt-assets.js](../lib/penny-prompt-assets.js)
- [penny-voice/runtime/penny-operational-blend.md](../penny-voice/runtime/penny-operational-blend.md)
- [penny-voice/runtime/penny-chat-directives.md](../penny-voice/runtime/penny-chat-directives.md)
- [penny-voice/runtime/penny-voice-examples.md](../penny-voice/runtime/penny-voice-examples.md)
- [penny-voice/runtime/penny-overlays.json](../penny-voice/runtime/penny-overlays.json)
- [server.js](../server.js)
- [docs/penny-external-llm-research-pass.md](./penny-external-llm-research-pass.md)
- [docs/penny-personality-runtime-voice-gap-report-2026-04-19.md](./penny-personality-runtime-voice-gap-report-2026-04-19.md)
- [docs/penny-research-master-synthesis-2026-04-16.md](./penny-research-master-synthesis-2026-04-16.md)

## Bottom line

The useful lesson from the CL4R1T4S snapshot is not "frontier prompts are better because they are huge."

The useful lesson is that the strongest prompts are explicit about layers:

- identity
- operating mode
- tool and evidence rules
- continuity and retrieval triggers
- output constraints

Penny already has the right architecture for that in `lib/penny-prompt-stack.js`. The win is to sharpen the existing slots and overlays, not to import giant leaked prompt slabs.

## What looks genuinely useful

### 1. Strong prompts separate concerns on purpose

Across OpenAI, Anthropic, and the coding agents, the recurring pattern is not a single blob. It is a stack:

- who the model is
- when to search or use tools
- what counts as valid memory or continuity
- what kind of output shape is expected
- which paths are forbidden

That matches Penny's current slot structure exactly:

- `voiceBlend`
- `directives`
- `overlays`
- `examples`
- `memory`

The implication for Penny is simple:

- keep the slot model
- keep lane-aware overlays
- prefer tiny, high-leverage rules in the right slot over adding another slot or another big document
- remember that a new prompt surface is not auto-discovered today; if it deserves to exist, it needs explicit loader and slot wiring

### 2. Retrieval and continuity are triggered by concrete cues

Anthropic's newer prompts are unusually explicit about continuity triggers:

- direct references to prior chats
- pronouns or definite articles that assume shared context
- past-tense statements that imply prior advice
- time-based recall questions

That is useful for Penny because it suggests a better shape for recall detection:

- not more memory text
- better recall trigger heuristics
- better separation between "answer from stable facts", "answer from advisory memory", and "say you are unsure"

This fits Penny's existing canon-first and prompt-truth work better than it fits a new memory feature.

### 3. Tool honesty is treated as a first-class rule

The best agent prompts keep repeating the same discipline:

- do not claim a check you did not run
- do not imply a file edit you did not make
- read before editing
- use tools when truth depends on them
- escalate uncertainty plainly instead of bluffing

Penny already has this direction in:

- `penny-chat-directives.md`
- `penny-overlays.json`
- tool-lane and semantic-render prompt construction in `server.js`

The lesson is not to make Penny colder. The lesson is to make technical honesty more precise without dropping the companion feel.

### 4. The strongest prompts remove limp helper endings

One of the cleanest OpenAI patterns is the ban on opt-in-question endings and hesitant "if you want, I can..." filler. The model is told to do the obvious next step instead.

That is directly relevant to Penny's helpful mode.

Penny already wants:

- momentum
- reaction first
- exact detail first
- practical help without helpdesk sludge

So the Penny-native version is:

- do not end practical/helpful turns with limp permission-seeking boilerplate
- give the concrete answer or next move first
- leave a hook or point of motion, not a customer-support re-entry line

### 5. Response-mode separation matters

Gemini, Claude, Perplexity, Manus, and the coding agents all split conversation from heavier artifact or execution modes.

For Penny, the important part is not their document UI rules.
The important part is the same old repo lesson:

- chat mode and tool mode should stay distinct
- semantic render should stay bounded
- different prompt surfaces should carry different jobs

That reinforces the repo's existing lane split rather than challenging it.

## Definitely add

### 1. A no-helpdesk-closer rule

Best home:

- `penny-voice/runtime/penny-chat-directives.md`

Shape:

- for practical or helpful turns, answer or act first
- avoid endings like "let me know if you want me to..."
- leave momentum, not a support-desk handoff

Why:

- this is one of the cheapest ways to reduce generic-assistant drift in helpful mode
- it strengthens Penny's existing "leave momentum behind" rule instead of adding a new behavior family

### 2. Recall-trigger heuristics, not more recall text

Best home:

- retrieval and recall decision seams around prompt assembly and canon-priority detection

Likely files:

- `server.js`
- `lib/penny-memory.js`
- any helper that currently decides canon-first versus archive-hint behavior

Shape:

- explicitly detect "what did I call", "what did we say", "that thing", "my project", "remember when"
- separate stable-fact recall from advisory memory recall
- answer the remembered phrase or gist first when confidence is sufficient

Why:

- this borrows the useful part of Anthropic continuity prompts without importing the whole product apparatus
- it supports the already accepted `spirit-first recall` direction

### 3. A sharper tool-lane honesty overlay

Best home:

- `penny-voice/runtime/penny-overlays.json`

Shape:

- technical turns should verify before claiming
- when the next step is obvious and bounded, do it
- if not verified, say so cleanly
- stay compact and alive

Why:

- Penny already has a tool overlay
- this is exactly the kind of improvement that belongs in an overlay, not a new slot

### 4. Example-bank rebalance, not prompt growth

Best home:

- `penny-voice/runtime/penny-voice-examples.md`

Use the existing gap report priorities:

- reaction-first specificity
- warm repair after bite
- protective steadiness
- plainspoken practical help
- nonsexual closeness
- delight that is not just sarcasm

Why:

- frontier prompts repeatedly show that behavior is taught by compact examples plus explicit rules
- Penny's own voice-gap report already says the runtime bundle teaches stance better than behavior

## Maybe add later

### 1. Search-complexity heuristics for a future explicit Penny web tool

If Penny's web search becomes more central, frontier prompts offer a usable pattern:

- simple current fact: one search
- unstable topic: verify
- deeper comparison: multi-step research loop

But this belongs in tool policy, not in Penny's core voice bundle.

### 2. A tiny "artifact/report mode" overlay if Penny grows that surface

Gemini, Claude, Manus, and Perplexity all over-specify document mode.
Penny should not import their bulk rules, but if she grows a real report surface later, it may be worth adding:

- one explicit report mode
- one explicit coding artifact mode
- a bounded output contract

Not now.

### 3. More formal query decomposition for research turns

Some agent prompts are very good at:

- selecting the right tool class
- deciding when more searches are justified
- stopping when the answer is already good enough

That is useful later for Penny's research-shaped turns, but it should land in tool/runtime policy, not in her relational voice.

## Do not add

### 1. Do not import giant leaked prompt text

This repo already rejected:

- copied giant system prompts
- giant context stuffing
- generic plugin-platform ambitions

The CL4R1T4S snapshot reinforces that rejection.
Most of the raw prompt mass is product-specific scaffolding, not transferable intelligence.

### 2. Do not copy product-UI baggage

Not for Penny:

- artifact iframe constraints
- browser-storage prohibitions from other products
- public-download workflow rules
- subscription-plan explanations
- app-specific image or file rendering rules

Those are platform rules, not companion rules.

### 3. Do not liberalize memory just because other agents do

Several coding agents push aggressive memory creation or broad continuity capture.
That is a bad fit for Penny.

Penny's durable rule should stay:

- explicit memory is canonical
- archive, books, and ledger are additive and inspectable
- promotion stays review-gated

### 4. Do not turn Penny into a generic coding agent

Cursor, Windsurf, Devin, and Manus are useful for tool-truth patterns.
They are not voice models for Penny.

Borrow:

- honesty
- bounded execution
- read-before-edit discipline

Do not borrow:

- flat pair-programmer identity
- terse IDE persona
- constant todo machinery
- mandatory report or artifact behavior

### 5. Do not add more prompt layers first

The repo's own voice work is already clear:

- the bundle should stay small
- the fix is better teaching, not more layers
- overlays are not the first answer to every voice problem

So if a lesson can land as:

- one micro-rule
- one example swap
- one sharper overlay line

that is better than adding a new file or new slot.

## Best landing zones in this repo

Use these seams if any follow-through happens:

- `penny-voice/runtime/penny-chat-directives.md`
for small behavioral rules like no-helpdesk closers, sharper reaction order, and repair timing
- `penny-voice/runtime/penny-voice-examples.md`
for sentence-shape teaching and better mood coverage per token
- note: example changes currently affect `chat` and `shadow`, not the semantic-render pass, because `examples` are not rendered on `tool`
- `penny-voice/runtime/penny-overlays.json`
for lane-specific honesty and mode-specific steering
- `lib/penny-prompt-stack.js`
for preserving explicit layering, avoiding prompt-blob regressions, and adding any real new slot only if it earns first-class wiring
- `server.js`
for lane-specific prompt construction and canon-priority recall behavior

## Recommended next slice

If this turns into implementation work, the cleanest next slice is still the one the repo already wanted:

- keep the current slot architecture
- do not add a new layer
- add one practical-momentum rule
- sharpen recall-trigger heuristics
- rebalance examples toward repair, protectiveness, delight, and plainspoken help

Short version:

Study frontier prompts for structure.
Do not import them for identity.
Use them to make Penny more exact, more mode-aware, and less helpdesk-flat without making her any more generic.