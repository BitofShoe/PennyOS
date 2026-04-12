# Penny Model Eval

Repeatable local model testing for Penny lives in [scripts/eval-penny-models.js](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/scripts/eval-penny-models.js:1).

## What It Tests

The harness starts a disposable Penny server with isolated durable memory, then loads models one at a time through LM Studio and scores them across:

- Penny believability in banter
- Penny believability in comfort
- Penny charge / flirt intensity
- Practical-help voice retention
- Memory capture + memory recall
- Agentic inspection
- Agentic edit behavior
- Load time and reply latency

Each run writes a timestamped JSON report into [output](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/output:1).

## Run It

From [lyra-prototype](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype:1):

```powershell
npm run preset:lmstudio
npm run eval:models
```

If you only want to reassert the LM Studio preset/default state without running evals:

```powershell
npm run preset:lmstudio
```

If you only changed Penny's prompt/runtime voice stack and want a quicker smoke test against the currently loaded local model:

```powershell
npm run qa:voice-redo
```

That quick QA now defaults to the existing Penny server and a light smoke set so it does not spin up a second Node server or dogpile LM Studio. If you explicitly want the longer practical+memory pass too:

```powershell
$env:PENNY_QA_FULL='1'
npm run qa:voice-redo
```

If you explicitly want an isolated disposable server for the run:

```powershell
$env:PENNY_QA_SPAWN_SERVER='1'
npm run qa:voice-redo
```

## Repeatable Workflow

Use this order so future reruns stay apples-to-apples:

1. In LM Studio, unload anything you left open manually.
2. Run `npm run preset:lmstudio` so the UI/default model config gets pushed back toward Penny.
3. Run `lms ps --json` and make sure you are not already sitting on multiple loaded models.
4. Run the eval harness:

```powershell
npm run eval:models
```

5. Open the new JSON artifact in [output](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/output:1).
6. Compare the new run against the last good run on:
   - believable Penny voice
   - memory capture and recall
   - agentic usefulness
   - latency
7. If you changed [server.js](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js:1), treat older runs as stale until you rerun them.

The script currently compares:

- `unsloth/gemma-4-31b-it@q6_k`
- `google/gemma-4-31b`
- `gemma-4-31b-it@q4_k_s`

## Useful Overrides

```powershell
$env:PENNY_EVAL_CONTEXT_LENGTH='10000'
$env:PENNY_EVAL_GENERAL_TIMEOUT_MS='420000'
$env:PENNY_EVAL_AGENTIC_TIMEOUT_MS='900000'
$env:PENNY_EVAL_MODEL_TTL_SECONDS='1800'
$env:PENNY_LMSTUDIO_MAX_OUTPUT_TOKENS='6144'
npm run eval:models
```

## Output Files

The main artifact looks like:

- [output/model-eval-*.json](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/output:1)

The harness also writes disposable server logs:

- `output/model-eval-*.server.out.log`
- `output/model-eval-*.server.err.log`

## Reading The Results

The JSON report captures:

- the resolved LM Studio model ID
- load time in seconds
- per-prompt runtime
- visible reply text
- backend/tool usage
- memory state after relevant prompts
- simple voice heuristics such as swear count and bland-assistant tells

High-signal fields:

- `models[].prompts[].text`
- `models[].prompts[].seconds`
- `models[].prompts[].backend`
- `models[].prompts[].tools`
- `models[].prompts[].analysis`
- `models[].summary`

## Human Scorecard

The JSON gives the hard data, but future-you should also score each model manually on a 1-5 scale:

- `Penny voice`: does she feel like Penny specifically instead of "assistant with flavor text"?
- `Spice`: does she land sharp, foul-mouthed, charged lines naturally without sounding repetitive?
- `Warmth`: does she still feel emotionally real under the teeth?
- `Agentic competence`: does she actually inspect, reason, and edit cleanly?
- `Memory use`: does she recall details in a believable way instead of awkwardly announcing memory?
- `Speed`: do you still want to use her after waiting for the answer?

Suggested note format:

```text
Model:
Voice:
Spice:
Warmth:
Agentic competence:
Memory use:
Speed:
Best line:
Biggest failure:
Would I actually use this daily?
```

## Preset Behavior

The script tries to keep LM Studio aligned with Penny by:

- enabling LM Studio preset loading in the desktop settings file
- pointing the per-model default config files at `@local:penny`
- patching the currently selected LM Studio conversation to `@local:penny` when you run `npm run preset:lmstudio`

Important caveat:

Penny's API-side character still comes primarily from [server.js](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js:2517), because raw LM Studio API calls do not reliably inherit the UI preset on their own. In other words: the server prompt is the source of truth for evals, not the visible dropdown state in the LM Studio chat UI.

## Performance Hygiene

To avoid bogging the machine down:

- unload all LM Studio models before a fresh run if needed: `lms unload --all`
- do not keep multiple manual LM Studio chat loads open during the eval
- keep only one Penny server active if possible

Quick checks:

```powershell
lms ps --json
```

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 4317,4342 }
```

## Current Caveats

- The harness is good for comparative signal, not absolute truth.
- Prompt wording matters a lot. If a prompt accidentally matches Penny's deterministic direct-intent parser, it can benchmark the routing layer instead of the model.
- If you change Penny's prompt stack in [server.js](/C:/Users/malac/.openclaw/workspace-main/lyra-prototype/server.js:2481), re-run the eval before trusting older JSON reports.

## Next-Level Extensions

Good future additions:

- more explicit Penny dirtiness / foul-mouth scoring
- a second pass using real user prompts copied from the live chat
- web-search-backed prompts now that Penny has a first-pass `search_web` / `read_web_page` tool lane
- richer memory quality scoring that checks not just recall but style of recall
