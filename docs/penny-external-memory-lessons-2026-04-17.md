# Penny External Memory Lessons - 2026-04-17

Sources reviewed:

- [ocean1/thinklang](https://github.com/ocean1/thinklang)
- [SyntheticAutonomicMind/CLIO](https://github.com/SyntheticAutonomicMind/CLIO)
- [CLIO memory architecture](https://github.com/SyntheticAutonomicMind/CLIO/blob/main/docs/MEMORY.md)
- [LocalLLaMA thread on token-speed drops under VRAM pressure](https://www.reddit.com/r/LocalLLaMA/comments/1so2rqh/7900xtx_qwen_36_35b_a3b_150ts_that_drops_to_50ts/)

## What Landed Now

- Penny memory persistence now uses atomic temp-and-rename writes for the live explicit memory store, archive store, embeddings store, memory books store, and research ledger store. Canonical memory, archive, embeddings, and research-ledger stores retain a `.bak` copy before each successful write and fail closed on malformed JSON instead of replacing damaged bytes with an empty store.
- Reason for landing now:
  - directly reduces corruption / half-write risk
  - helps concurrent or interrupted local runs
  - does not change Penny's personality, routing, or product framing

## Lessons Worth Keeping In Mind

### ThinkLang

- Good reminder: compact, typed internal reasoning formats can be useful for internal traces and eval artifacts.
- Not a fit for Penny's live companion voice.
- If reused later, keep it strictly internal to QA / debugging, not user-visible output.

### CLIO

- Strongest lesson for Penny: persistent memory writes should be atomic and boring.
- Also useful:
  - keep the distinction between current-task context and long-lived memory clear
  - prefer targeted recovery over spraying large archive blobs into prompts
  - keep memory layers legible and inspectable

## Explicit Deferrals

- No automatic always-on long-term injection expansion.
- No new task-anchor subsystem in this pass.
- No broader memory compiler or policy engine.
- No reasoning-language feature in Penny's runtime prompts or visible replies.

## Runtime QA Reminder

- The LocalLLaMA VRAM thread is a useful operations reminder, not a product design blueprint.
- For Penny QA:
  - keep background vectorization tiny
  - do not interpret a single degraded run as product truth without checking LM Studio / VRAM conditions
  - clear disposable QA memory artifacts after runs so follow-up testing stays honest
