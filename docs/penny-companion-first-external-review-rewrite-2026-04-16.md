# Penny Companion-First External Review Rewrite

This file captures the April 16, 2026 external review rewrite as an internal guidance note for Penny's next pre-user-testing hardening passes.

## Companion-First Frame

The review evaluated Penny primarily as:

- a character/companion AI
- a presence
- a relationship-shaped interface

It explicitly did **not** treat Penny primarily as:

- a research agent
- a generic coding copilot
- a task automation dashboard

That framing changes what counts as a serious bug. A small metadata lie is not just a dev-tool blemish if it makes Penny feel more self-flattering than truthful.

## Highest-Risk Findings

### 1. Deterministic turns were overstating model involvement

The review called out turns that answered correctly through bounded tool paths while still reporting model-heavy receipts like:

- resolved model ids
- warm readiness
- model roundtrip timing

Companion-first interpretation:

- Penny should not look more magical than she really was.
- Honest boundedness is better than fake agentic sheen.

Requested fix direction:

- add an explicit execution-path truth field
- stop pretending deterministic tool turns used the model
- make the UI show that clearly

### 2. Research-ledger timing was stale enough to create drift between the notebook and the receipt

The review observed cases where:

1. a new investigation was recorded
2. the persisted artifact still showed the older topic
3. the inspector then reused the stale artifact

Companion-first interpretation:

- this makes Penny feel mentally "off" even if the underlying data eventually updates
- the issue is not just async timing, but visible coherence

Requested fix direction:

- either update ledger state before freezing the turn artifact
- or explicitly mark the artifact as pre-update
- do not swallow ledger-update failures silently

### 3. Research-ledger prompt injection was the most cuttable subsystem if complexity had to be reduced

The strongest caution in the review was **not** to delete the entire ledger or inspector.

The specific subsystem under pressure was:

- feeding ledger continuity back into the live prompt

Why it was flagged:

- prompt contamination risk
- stale-state weirdness
- Penny sounding "researchy" instead of relational
- self-reinforcing phrasing loops

Proposed cut if needed:

- keep ledger storage and inspector value
- disable ledger prompt injection unless it proves clear value

## Team Response / Important Nuance

The repo owner's pushback was valid and should be preserved:

- the product goal is not to avoid all cross-turn inference
- the desired answer shape is cautious continuity, not sterile amnesia

Example target behavior:

- worst: "I dunno, you never told me"
- acceptable: "In Oakland, duh"
- best: "Uhhm probably Oakland, right?"

Important boundary:

- the current research ledger is **not** the system that should learn general personal facts like "I work at KDOL" plus "I live in Oakland"
- that kind of relational inference belongs to explicit/archive memory work, not the research ledger

So the right next move was:

- keep the research ledger research-only
- keep the prompt bridge measurable instead of blindly deleting it
- add an ON/OFF compare so the question becomes empirical

## Final Verdict From The Review

The review's closing assessment was strongly positive:

- Penny is now a real architecture, not a shallow wrapper
- the QA harness is real
- the artifact/provenance layer is real
- the memory system is real

The new risk is **false confidence**, not chaos.

Most memorable line from the verdict:

> Penny is no longer fighting herself the way she used to. Now she needs to stop flattering herself in the receipts.

## What This Note Should Influence

Use this review when prioritizing:

- trace-truth fixes
- provenance honesty
- ledger timing correctness
- prompt-injection compare work
- companion-first simplification decisions after user testing

Do **not** use this note as evidence to broaden the research ledger into general relational memory. The review was specifically about truthfulness and boundedness, not about making Penny less inferential across the board.
