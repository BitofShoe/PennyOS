# Best Practices for Saving Context Space

This document is for keeping long OpenClaw work sessions reliable instead of letting them turn into bloated, fragile token soup.

## Why this exists

When context gets too full, the assistant becomes more likely to:

- time out or get interrupted mid-task
- lose track of what was finished vs not finished
- reread too much unnecessarily
- make sloppier edits
- waste turns re-establishing state that should have been written down

The fix is not "try harder." The fix is to work in a way that uses files and checkpoints instead of relying on one giant chat context.

---

## Core rules

### 1. Use files as the source of truth
Do not rely on chat history alone to preserve important state.

If something matters, write it down in the workspace:

- current status
- checkpoints
- plans
- decisions
- rollback notes
- known good versions

### 2. Keep turns small and scoped
Avoid giant multi-goal turns like:

- fix backend
- improve memory
- retune personality
- clean UI
- test everything

in one go.

Prefer:

- one clear target per pass
- one experiment at a time
- one validation step at a time

### 3. Checkpoint before experimentation
Before making risky or high-variance changes:

- save a known-good version
- label it clearly
- make rollback easy

This prevents every new experiment from feeling like walking on eggshells.

### 4. If interrupted, state exactly what finished and what did not
Do not smooth over interruptions.

If context, time, or tools cut a task short, explicitly say:

- what completed
- what partially completed
- what did not happen yet
- what the next safe step is

### 5. Avoid repeatedly rereading huge files
Do targeted reads whenever possible.

Prefer:

- specific file sections
- exact functions/blocks
- narrow searches

instead of reloading whole files over and over unless absolutely necessary.

### 6. Externalize operational rules
If a useful process rule is discovered during work, write it to a workspace document.

Examples:

- how to checkpoint safely
- how to test a feature
- how to recover a baseline
- how to avoid context bloat

### 7. Separate stable layers from experimental layers
Know which parts are protected and which are safe to play with.

Example:

- protected: current good personality baseline
- experimental: spicier prompt variants
- careful: memory/backend improvements

This keeps experiments from accidentally wrecking the part that actually works.

---

## Good operational habits

### Before a risky change
Write down:

- current baseline
- what is being changed
- what is not being changed
- rollback path

### During a long task
Pause and summarize if the work starts sprawling.

Write a short status note such as:

- current objective
- files touched
- what remains
- whether the build/state is stable

### After a useful breakthrough
Write down:

- what worked
- why it worked
- what should now be treated as a floor/baseline

### After a failure
Write down:

- what regressed
- likely cause
- whether to revert, simplify, or isolate variables

---

## Practical anti-bloat rules for this workspace

### For Penny work specifically

1. Keep personality tuning separate from memory tuning whenever possible.
2. Do not stack many tiny prompt patches forever; periodically clean and refactor.
3. Save a known-good Penny checkpoint before higher-risk experimentation.
4. Test internally before handing clearly experimental versions back to the user.
5. If a version is only "good enough," label it clearly as a fallback baseline.
6. When a pass is incomplete, say so directly.

---

## Simple honesty rule

Never imply a task completed cleanly if it was interrupted.

Better:

> "I finished the prompt cleanup, but the checkpoint copy is only partially done."

Worse:

> "All good" when context or tools cut the work off.

Accuracy saves more time and tokens than face-saving does.

---

## Preferred working rhythm

1. define one goal
2. inspect only relevant files
3. make the smallest useful change
4. test it
5. checkpoint if good
6. summarize status plainly
7. then move to the next pass

---

## Short version

To save context space and reduce failures:

- write things down
- keep scope narrow
- checkpoint often
- separate stable from experimental
- do not hide interruptions
- prefer small clean passes over giant blended ones
