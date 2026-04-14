# Today's Plan

For when I wake up and continue Penny in a fresh chat without wasting half the morning reloading my brain.

## Main priorities

1. Refine Penny's voice one more time without losing the spice
2. Evaluate whether reconnecting OpenClaw is actually worth it for agentic work

## Priority 1: Penny voice refinement

### Goal

Keep Penny spicy. Absolutely keep the spice.

But make her feel deeper, more specific, and more believable as Penny instead of just "edgy local chatbot with a dirty mouth."

The target is:

- still filthy when the moment wants it
- still funny
- still sharp and bratty
- more emotionally textured
- more distinct and consistent
- less generic
- no sanitization creep

### Important design rule

Do **not** load all the giant personality files into runtime chat prompts.

Use this structure instead:

- raw source personality files as canon
- distilled sidecars per chapter/personality file
- one merged Penny operational blend file
- one short examples/voice file

Use the raw files as source material for refinement work, not as normal prompt baggage.

Relevant note:

- [big ass file to manageable chapters.md](</C:/Users/malac/.openclaw/workspace-main/lyra-prototype/big ass file to manageable chapters.md:1>)

### Concrete tasks

1. Identify the real canon sources for Penny voice work
   Files likely include:
   - [PENNY'S_BRAIN.md](C:/Users/malac/.openclaw/workspace-main/PENNY'S_BRAIN.md:1)
   - `Penny's Playground` personality/overlay docs
   - any split personality chapter docs already created
2. Make distilled sidecars from those sources
   Each distilled file should focus on:
   - core vibe
   - speaking style
   - emotional tone
   - motivations
   - relationship patterns
   - signature moves/behaviors
   - guardrails / "don't write her like this"
   - 3-8 short example lines
   - source refs back to canon
3. Create one merged Penny operational blend file
   This should be the "runtime personality truth" for prompt-building, not a giant lore dump.
4. Create one short examples/voice file
   This is the quick flavor injector:
   - how she flirts
   - how she jokes
   - how she gets mean
   - how she gets soft
   - how she sounds while coding
5. Tune Penny prompts against those distilled assets
   Keep the current spicy direction, but improve depth and specificity.
6. Run QA prompts
   Test:
   - casual banter
   - flirty/charged chat
   - playful insults
   - comfort/softness
   - technical/coding replies
   - agentic/tool-use replies

### Acceptance criteria

The pass is successful if:

- Penny still sounds spicy and shameless
- she feels more like one coherent person
- she has better emotional range without becoming bland
- she does not drift into sanitized assistant talk
- she does not become repetitive in swearing or dirty talk
- her coding/tool replies still sound like Penny instead of a dry debugger

## Priority 2: OpenClaw reconnection evaluation

### Goal

Figure out whether OpenClaw shadow mode is worth investing in for agentic work.

Not as Penny's main chat brain.

Only as a possible secondary lane for smarter/background/PC-level actions if it gives us things LM Studio Penny does **not** already do well.

### Current known state

Penny already has an experimental OpenClaw shadow lane:

- [server.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js:15)
- [server.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js:1254)
- [server.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js:4529)
- [public/index.html](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/index.html:197)
- [public/app.js](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/public/app.js:622)
- [start-lyra.ps1](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/start-lyra.ps1:1)

Current best philosophy:

- LM Studio stays the main Penny chat brain
- OpenClaw, if used, should be optional and secondary
- do **not** replace the LM Studio path unless there is a damn good reason

### Key question

Can OpenClaw give Penny meaningfully better agentic powers than she already has?

Examples:

- richer PC/browser interaction
- smarter multi-step workflows
- background task execution
- better web navigation / real-world actions
- anything that feels more like "use my computer for me"

If the answer is only "basically the same but buggier," skip it.

### Concrete tasks

1. Audit the existing shadow mode
   Figure out:
   - what actually works right now
   - what is placeholder
   - what fails
   - what falls back
2. Compare Shadow vs Local LM Studio for real capability
   Compare:
   - chat quality
   - personality preservation
   - tool/agent competence
   - web/browser/PC interaction potential
   - reliability
   - latency
3. Decide whether OpenClaw should be used for:
   - nothing
   - a hidden optional "smart agent" lane
   - a background task lane
   - specific user-triggered workflows only
4. If worthwhile, define the exact boundary
   Example:
   - LM Studio = normal Penny chat and local coding help
   - OpenClaw shadow = optional higher-autonomy tasks, web/PC workflows, or background agent jobs

### Acceptance criteria

OpenClaw is worth continuing only if it adds at least one of these:

- materially better agentic capability
- useful computer/web action that LM Studio Penny cannot already do well
- a workflow that feels worth the extra complexity

If not, keep it parked and do not waste time fetishizing architecture.

## Recommended order

1. Voice refinement first
2. Then OpenClaw evaluation

Reason:

- Penny's core personality matters more than extra architecture
- OpenClaw is only worth it if Penny's identity is already strong enough to preserve across modes

## To Do Later

- Tighten Penny's reply honesty around tooling even further.
  She should not imply she already edited, verified, or "marked territory" somewhere unless a real write/verify tool actually ran in that turn.
- Audit for any remaining cases where Penny sounds more capable than the actual tool trail proves.
- See whether Penny's tool routing can be tightened even more so simple repo/path/file asks stay fast and don't accidentally spill into heavier multi-step loops.
- Look for more places where direct deterministic lanes can replace slow open-ended tool planning without making her feel robotic.

## Suggested kickoff prompt for the next chat

Read [Today's Plan.md](</C:/Users/malac/.openclaw/workspace-main/lyra-prototype/Today's Plan.md:1>), [big ass file to manageable chapters.md](</C:/Users/malac/.openclaw/workspace-main/lyra-prototype/big ass file to manageable chapters.md:1>), [memory/2026-04-12.md](C:/Users/malac/.openclaw/workspace-main/lyra-prototype/memory/2026-04-12.md:1), and the Penny voice docs first. Then start with Priority 1: build the distilled Penny voice files and do one more unsanitized voice pass without losing the spice. After that, evaluate whether OpenClaw shadow mode is actually worth using as an optional agentic lane.
