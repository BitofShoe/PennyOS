# Penny Experience Review Packet

Status: Current strong guidance.
Authority: This is an external-review workflow, not runtime law. Code, tests, runtime artifacts, and local operator truth still outrank this doc.

## Why This Exists

Static repo review can verify that Penny has real machinery: routes, memory architecture, stream handling, tool gates, tests, and privacy boundaries.

It cannot verify the lived companion layer by itself. For Penny, that layer matters: voice over multiple turns, natural memory use, correction handling, latency, tool-use tone retention, and whether the UI expressions feel alive or ornamental.

The answer is not to commit private transcripts or generated QA artifacts. The answer is to generate a private review bundle that includes clean source plus selected local run receipts.

## What To Give A Reviewer

Give them:

- the source review bundle
- `REVIEW_EXPERIENCE.md`
- selected untracked artifacts from local live or smoke runs
- a prompt that asks them to separate code-verified, artifact-verified, and still-unverified claims

Do not give them:

- `.env` files
- local memory JSON
- local server logs unless you have reviewed them
- raw Tauri clean-proof or consumer-smoke receipts unless you have redacted local usernames, paths, app-data file details, and tool inventory
- private generated output you do not want them to read
- artifacts that you have not checked for sensitive content

## Build A Source-Only Bundle

```powershell
npm run bundle:review -- --out tmp/gpt-pro-source-bundle
```

This copies the repo while excluding generated clutter such as `output/`, `logs/`, `tmp/`, local memory files, `.env` files, `.openclaw/`, and the old nested `lyra-prototype/` residue if it exists in the workspace.

Use this bundle command instead of sending a raw `git archive` or whole checkout zip. The bundle intentionally excludes historical/operator docs, checkpoints, distilled prompt-engineering docs, generated outputs, and private local state.

## Build An Experience Bundle

After you have run local QA and reviewed the artifact contents:

```powershell
npm run bundle:review:experience -- --artifact output/voice-redo-qa-REPLACE_ME.json --artifact output/playwright/penny-browser-smoke-REPLACE_ME.json --out tmp/gpt-pro-review-bundle
```

If you want the latest known experience artifacts copied automatically:

```powershell
npm run bundle:review:experience -- --latest-experience-artifacts --out tmp/gpt-pro-review-bundle
```

That command is intentionally opt-in. The bundle script does not normally copy `output/` because those files can contain real local conversation material.

## Suggested Local Receipts

Run only the receipts you actually want reviewed.

```powershell
npm run qa:voice:tiebreak
npm run qa:memory:smoke
npm run qa:browser:smoke
```

Interpretation:

- `qa:voice:tiebreak` is the best compact receipt for Penny voice, warmth, bite, repair, and spirit-first recall.
- `qa:memory:smoke` is a lighter memory receipt, not the full heavy memory suite.
- `qa:browser:smoke` proves UI, streaming, image upload, and expression plumbing. If it uses the mock backend, do not treat it as live model voice proof.

## llama.cpp Or Already-Running Local Runtime

If Penny is pointed at llama.cpp or another OpenAI-compatible local endpoint, keep model management out of the review run unless you explicitly want the harness to manage LM Studio:

```powershell
$env:PENNY_QA_STRICT_NO_MODEL_OPS='1'
$env:PENNY_QA_SPAWN_SERVER='1'
$env:PENNY_LMSTUDIO_BASE='http://127.0.0.1:18080/v1'
$env:PENNY_QA_CHAT_MODEL='your-loaded-chat-model-id'
npm run qa:voice:tiebreak
```

Use the actual local `/v1` endpoint and loaded model ID. Strict no-model-ops mode expects the requested models to already be visible to Penny; if your llama.cpp setup exposes only one chat model and no embed model, record that limitation in the reviewer prompt instead of pretending the full QA surface was exercised.

Prefer `PENNY_QA_SPAWN_SERVER=1` for review receipts because it uses disposable Penny memory files. Running against the main server can pollute real local memory unless you clean every generated layer afterward.

## Prompt For GPT Pro

```text
Please review PennyOS as both code and lived companion behavior.

The repository itself shows implementation truth. The review-experience artifacts are selected receipts from local live or smoke runs. Please separate:

1. Code-verified claims.
2. Artifact-verified experiential claims.
3. Claims that still require a live local run.

For the experience layer, focus on:

- whether Penny sounds like Penny over multiple turns
- whether memory recall feels natural instead of database-shaped
- whether correction and false-premise pressure are handled gracefully
- whether tool use preserves the companion voice
- whether latency seems tolerable for the tested local model
- whether UI expression and browser behavior feel alive or decorative
- where she collapses into generic assistant sludge, if she does

Do not treat fixture-only or mock-browser artifacts as proof of live model feel. Do not overclaim from one run. If the artifacts are insufficient, say exactly what receipt is missing.
```

## Reviewer Reading Order

Inside the bundle, start with:

1. `README.md`
2. `CODEBASE.md`
3. `ARCHITECTURE.md`
4. `docs/README.md`
5. `docs/penny-experience-review-packet.md`
6. `REVIEW_EXPERIENCE.md`
7. `review-experience/manifest.json`
8. the listed files under `review-experience/artifacts/`

## What Counts As A Real Answer To The Gap

A good review does not need to say "Penny is verified perfect." It should say something like:

- "The code supports the claimed architecture."
- "These artifacts show Penny held or failed the companion voice in these scenarios."
- "This memory behavior looked natural or database-shaped for these turns."
- "This UI artifact proves the browser path, but not live model feeling."
- "The remaining unverified layer is X, and the next receipt should be Y."

That gives the reviewer the show, not just the stage directions.
