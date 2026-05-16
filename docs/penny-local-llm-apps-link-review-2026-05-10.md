# Penny Local LLM Apps Link Review - 2026-05-10

> Category: External-source research synthesis
> Authority level: Historical evidence
> Current status: Current research note as of 2026-05-10
> Use this for: Penny-native and local-LLM setup ideas from the supplied LocalLLaMA thread, `awesome-llm-services`, OpenCode/Pi provider docs, and adjacent app examples.
> Do not use this for: dependency approval, runtime law, model-selection proof, default model swaps, broad agent-platform adoption, memory-ingestion permission, PromptTruth expansion, `toolEvidenceReceipt` expansion, hidden-reasoning persistence, or prompt-limit increases.

## Source Health

- Supplied GitHub catalog: <https://github.com/av/awesome-llm-services>
  - Reachable via GitHub and raw README.
  - The raw README currently exposes categories for Frontends, Backends, Satellites, Workflow & Automation, API & Proxies, Audio & Speech, CLI Tools, Evaluation, and MCP Tools.
  - A local parse found 186 listed entries, including duplicates across categories. Treat this as a discovery index, not a curated approval list.
  - The catalog appears generated from Harbor metadata. Its project labels and short descriptions are useful triage hints, not evidence that any project is safe or Penny-fit.
  - License/access caveat from the subagent spot check: the list repository exposed an MIT license file while `package.json` reported `CC0-1.0`. That mismatch only affects the catalog metadata; every linked project still needs its own license check.
- Supplied Reddit shortlink: <https://www.reddit.com/r/LocalLLaMA/s/nky8MSYGOq>
  - Resolved to: <https://www.reddit.com/r/LocalLLaMA/comments/1t8b4sr/after_youve_setup_local_models_where_can_you_find/>
  - Normal logged-out `curl` hit a Reddit verification page after redirect.
  - Reddit JSON and old Reddit worked for the subagent: JSON reported 25 comments, with 22 parsed comment objects and no `more` placeholders.
  - The thread is small and anecdotal. It is good for operator patterns, not model or dependency proof.
- Additional source checks used:
  - Frigate GenAI docs: <https://docs.frigate.video/configuration/genai/genai_config/>
  - OpenCode provider docs: <https://opencode.ai/docs/providers>
  - Pi custom model docs: <https://pi.dev/docs/latest/models>
  - Prior repo note: `docs/penny-qwen36-localllama-reddit-lessons-2026-04-22.md`

## Executive Read

Correction after user feedback: the apps and borrowable app ideas are the point of this note. The guardrails below are support material so an agent does not accidentally turn "look at useful local LLM apps" into "quietly rebuild Penny into a platform." Read this document app-first.

The useful ecosystem idea is that a local OpenAI-compatible endpoint can become the boring interop seam for interesting sidecars:

- LM Studio or `llama.cpp` serves local models.
- Penny remains the companion app and memory/runtime owner.
- OpenCode, Pi, Open WebUI, Frigate, Home Assistant, n8n, research tools, and terminal helpers can be evaluated as separate tools with their own scope.
- No sidecar gets automatic access to Penny memory, private runtime artifacts, browser history, camera data, shell, email, or home-control authority.

For your current setup, the most interesting direction is:

- keep Penny for the companion interface;
- use Gemma 4 31B Q6 or Qwen 3.6 27B Q4-Q6 as the local "brain" behind app experiments;
- use the embedding model for retrieval/memory/search sidecars when they need it;
- try apps one by one as sidecars, then steal only the patterns that actually feel useful.

## App-First Shortlist

### 1. Coding/operator agents: OpenCode, Pi, Aider, aichat, Fabric

Why this is interesting:

- This is probably the most directly useful cluster for your current Qwen/Gemma setup.
- OpenCode and Pi can point at local OpenAI-compatible endpoints, so Qwen 3.6 27B can be tested as a strict coding/operator agent without changing Penny.
- Aider/aichat/Fabric are useful comparison points for "small terminal tool that does one thing" versus "big agent environment."

Concrete idea to try:

- Pick one coding sidecar, preferably OpenCode or Pi.
- Point it at LM Studio or `llama.cpp` serving Qwen 3.6 27B.
- Give it a disposable repo or throwaway branch.
- Score whether it edits, tests, and admits failures better than the current Penny/Codex workflow.

Pattern to steal for Penny:

- local-provider config with explicit compatibility flags;
- clear session logs;
- model/tool receipts;
- "ask before destructive shell/write" behavior;
- easy switching between chat-like and coding-like local models.

### 2. Local lab cockpit: Open WebUI, AnythingLLM, Lobe Chat, LibreChat

Why this is interesting:

- These are not Penny replacements, but they are useful as a local model playground.
- Open WebUI especially is a good lab for comparing local models, prompts, RAG behavior, OpenAI-compatible endpoints, and tool-ish workflows without touching Penny.
- The Reddit thread's "where do I find apps?" energy points here: one dashboard where a lot of local-model experiments can be tried quickly.

Concrete idea to try:

- Install one lab UI in isolation, probably Open WebUI first if you want the broadest local experimentation surface.
- Connect it to LM Studio or `llama.cpp`.
- Use it for model/app experiments only: no Penny memory import, no private runtime artifact upload.

Pattern to steal for Penny:

- model picker ergonomics;
- tool/RAG visibility;
- artifact panels;
- per-chat/provider configuration;
- quick local experiments that do not mutate the main app.

### 3. Home and camera/event sidecars: Frigate, Home Assistant

Why this is interesting:

- This is the most "local LLMs become real-world useful" cluster in the Reddit thread.
- Frigate can use a local/OpenAI-compatible GenAI endpoint for event descriptions.
- Home Assistant can make local model output feel practical when it summarizes state instead of just chatting.

Concrete idea to try:

- Start read-only.
- Use a vision-capable local model only if the exact loaded model and server support image/video input.
- Ask for summaries like "what happened in the driveway today?" or "summarize unusual home events," not direct control.

Pattern to steal for Penny:

- source-grounded event summaries;
- read-only home status cards;
- confirmation before any action;
- "this came from camera/home state, not memory" labeling.

### 4. Workflow automation sidecars: n8n, Windmill, Activepieces

Why this is interesting:

- This is where local LLMs can become glue: classify an incoming thing, summarize it, route it, draft a response, or prepare a checklist.
- It could make a local model useful outside chat without putting that automation burden inside Penny.

Concrete idea to try:

- Create one local-only toy flow: feed a text payload to local Qwen/Gemma, get a structured summary back, write it to a local file.
- No email, posting, cloud webhooks, or real home/system actions in the first pass.

Pattern to steal for Penny:

- reviewable action queues;
- structured output contracts;
- dry-run mode;
- per-tool side-effect labels.

### 5. Local research/search sidecars: SearXNG, Local Deep Research, Perplexica, Morphic

Why this is interesting:

- This gives local models a "go look things up and cite what you found" surface.
- It is a cleaner fit as a sidecar than stuffing web/RAG/search complexity into Penny's companion loop.

Concrete idea to try:

- Use SearXNG plus one research UI/tool.
- Ask for source-cited digests of low-risk public topics.
- Keep output as a reviewable report, not memory.

Pattern to steal for Penny:

- citation-first summaries;
- source lists separated from conclusions;
- "unknown/not verified" as a normal answer;
- small digests that can be reviewed before anything durable is saved.

### 6. Document/RAG workspaces: Paperless-ngx, Kotaemon, Onyx, txtai, RAGLite, Qdrant

Why this is interesting:

- If you want "ask my local documents questions," these apps are more natural starting points than forcing Penny to become a document platform.
- Paperless-style workflows are especially interesting if the input is scanned documents, bills, PDFs, receipts, or old records.

Concrete idea to try:

- Build a tiny document sandbox with non-sensitive test docs.
- Compare whether the app answers with citations, handles updates, and separates document truth from model inference.

Pattern to steal for Penny:

- document chunk provenance;
- citation UX;
- explicit "document says" versus "model infers";
- review-gated promotion into memory.

### 7. Audio/voice sidecars: Speaches, openedai-speech, faster-whisper-server, Parler

Why this is interesting:

- This could make a local setup feel more embodied without making Penny depend on a hosted speech service.
- Speaches/openedai-speech are interesting because OpenAI-compatible speech endpoints are easier to plug into existing app patterns.

Concrete idea to try:

- Smoke-test local STT or TTS outside Penny.
- Measure latency, quality, and setup burden before wiring anything into the UI.

Pattern to steal for Penny:

- local voice endpoint abstraction;
- push-to-talk or explicit recording, not ambient listening;
- transcript review before memory writes;
- voice as an optional interface, not hidden capture.

### 8. Model/server ops sidecars: llama.cpp, llama-swap, Harbor, vLLM, SGLang

Why this is interesting:

- This is the "make local models less annoying to run" cluster.
- `llama.cpp` is already aligned with your setup.
- llama-swap/Harbor-style orchestration becomes interesting if you want to switch between Qwen/Gemma/embed models without babysitting each process.

Concrete idea to try:

- Only test this after there is an actual pain: slow switching, bad cache behavior, LM Studio limitations, or wanting one endpoint that swaps models.
- Keep the first test outside Penny and compare endpoint reliability.

Pattern to steal for Penny:

- model identity receipts;
- load/unload visibility;
- one-heavy-model-at-a-time discipline;
- endpoint compatibility checks.

### 9. Eval tools: Promptfoo, lm-evaluation-harness, Harbor Bench

Why this is interesting:

- This is less exciting as an app, but useful if you want to compare local models or prompts without inventing every harness yourself.
- It becomes relevant when "Qwen feels better" or "Gemma feels warmer" needs evidence.

Concrete idea to try:

- Do not start here unless you want a model/prompt tournament.
- If you do, use a tiny Penny-like prompt set and compare Qwen/Gemma outputs.

Pattern to steal for Penny:

- repeatable scenarios;
- side-by-side scoring;
- artifact paths;
- regression checks for prompts and RAG.

## Already Landed

- Penny already treats LM Studio as the real primary brain, with chat and tool lanes separated in current architecture.
- Penny already keeps OpenClaw shadow optional and secondary, not a replacement runtime.
- Penny already has a hybrid memory stack with canonical explicit memory, advisory archive/semantic recall, model-aware embedding caches, bounded research continuity, and review-gated promotion.
- Static embedding live sidecars already exist as opt-in/advisory modes. They discover candidates; they do not verify truth, raise prompt limits, or become canonical memory.
- Runtime artifacts already separate `promptTruth` from sibling `toolEvidenceReceipt`, which is exactly the right posture for external tools and source receipts.
- Penny already has runtime-fit, Gemma watch, static embedding compare, candidate-survival, semantic source audit, bounded aliveness, and model eval harnesses.
- The existing Qwen note already recommends adding Qwen 3.6 as a measured candidate, not a default swap.
- A Q6+E4B vs Qwen single-model compare plan already exists, with disposable state, lane receipts, cleanup rules, and a scenario matrix.
- Tool capability descriptors already exist as a future planning seam for native, MCP, and OpenAPI surfaces, but Penny is not running live connector adapters in production.

## Strengthen Now

### 1. Execute a Qwen-vs-Gemma profile compare, not a model vibe debate

Use the existing compare shape, but adjust the Qwen profile to the model you actually have loaded or can run safely: Qwen 3.6 27B Q4-Q6 through LM Studio/`llama.cpp`, instead of treating the earlier Qwen 35B-A3B plan as the only path.

Record:

- resolved model id
- quant
- serving backend
- context length
- chat template
- thinking/non-thinking setting
- developer-vs-system role behavior
- tool-call reliability
- memory readiness
- route/lane selected
- write/read/search evidence

This should answer a practical question: "Can Qwen be my stricter local coding/tool model without making Penny less Penny?"

### 2. Treat OpenCode and Pi as operator sidecars

OpenCode docs explicitly support local models through OpenAI-compatible configuration, including LM Studio local endpoints such as `http://127.0.0.1:1234/v1` and custom OpenAI-compatible providers.

Pi docs also support local providers such as Ollama, LM Studio, and vLLM through `~/.pi/agent/models.json`. The important Pi compatibility knobs for local servers are:

- set provider/model compatibility when the backend does not support the `developer` role
- disable `reasoning_effort` when the local OpenAI-compatible server does not support it
- use Qwen-specific thinking/template controls only as explicit model config, not Penny runtime law

Suggested trial:

- Run OpenCode or Pi against Qwen 3.6 27B for coding tasks only.
- Keep Penny memory and runtime artifacts out of the sidecar context.
- Start in a throwaway worktree or a disposable repo task.
- Score it against Codex/Penny with actual receipts: files changed, tests run, hallucinated success claims, and how often tool use needs rescue.

### 3. Add a small local endpoint compatibility note

A docs-only note would be useful for future-you:

- LM Studio endpoint: `http://127.0.0.1:1234/v1`
- `llama.cpp` server endpoint: typically an OpenAI-compatible `/v1`
- local apps should prefer chat-completions compatibility first
- local servers may not accept `developer` role, `reasoning_effort`, long context, vision, or Qwen thinking flags
- each sidecar needs its own scope, logs, and cleanup rule

This note should be operator guidance, not a new Penny adapter.

### 4. Generalize Gemma watch into model-runtime watch

Penny has Gemma runtime watch receipts. The new sources suggest the next useful hardening is a neutral watch surface for Gemma, Qwen, and local OpenAI-compatible backends:

- loaded model id and quant
- backend family: LM Studio, `llama.cpp`, vLLM, SGLang, etc.
- whether current endpoint supports `/v1/chat/completions`, `/v1/responses`, or stateful chat
- whether it tolerates `developer` role
- whether it tolerates `reasoning_effort`
- whether Qwen thinking controls are on/off
- whether vision is actually available
- whether prompt/KV cache behavior is exposed

Keep this observational. Do not enable thinking, raise context, or change defaults because a field exists.

### 5. Keep the app catalog as sidecar discovery

High-signal categories from `awesome-llm-services`:

- Backends: `llama.cpp`, KoboldCpp, Ollama, vLLM, SGLang, LocalAI, TabbyAPI.
- Audio/speech: Speaches, openedai-speech, faster-whisper-server, Parler.
- Evaluation: Promptfoo, lm-evaluation-harness, Harbor Bench.
- CLI/operator tools: aichat, Aider, Fabric, OpenCode, Repopack.
- Search/RAG/research sidecars: SearXNG, Local Deep Research, Kotaemon, txtai, RAGLite, Qdrant.

The best Penny use is pattern mining:

- local endpoint setup ideas
- local speech service shape
- eval harness ideas
- isolated research workflows
- operator packaging helpers

Do not import these as dependencies or runtime surfaces without a specific Penny pain.

## Maybe Later

- Frigate/Home Assistant sidecar: interesting if you want local home/camera event summaries, but only if the model is vision-capable and every home-control action is read-only or explicitly confirmed.
- Open WebUI as a lab cockpit: useful for trying model/app combos, not as Penny's replacement UI.
- SearXNG plus Local Deep Research: useful for local research digests with citations, not auto-ingested memory.
- Speaches/openedai-speech: possible local STT/TTS service if Penny voice input/output becomes a priority.
- Promptfoo: useful only if Penny's native eval scripts hit a ceiling.
- llama-swap: worth a look only if direct `llama.cpp` model switching becomes painful.
- Repopack: useful as an operator-only review bundle helper, but never include Penny memory, private data, or runtime artifacts by default.
- `llama.cpp`/vLLM/SGLang serving experiments: only after measured LM Studio pain around latency, context reparse, cache, model availability, or tool-call compatibility.

## Do Not Add

- Do not replace Penny with Open WebUI, AnythingLLM, LibreChat, Lobe Chat, Onyx, SillyTavern, OpenClaw, Hermes Agent, OpenHands, AutoGPT, or an agent OS.
- Do not add a workflow platform such as n8n, Dify, Flowise, LangFlow, Windmill, or Activepieces to Penny core.
- Do not add MCP gateway/control-plane behavior such as MCP Forge, MetaMCP, mcpo, SuperGateway, or Open Terminal as a default Penny layer.
- Do not add ambient capture, browser-history capture, continuous screen context, camera history, email automation, social posting, webhooks, public comms, or cron-like autonomy to Penny core.
- Do not auto-ingest Reddit, awesome lists, sidecar outputs, docs, web pages, camera summaries, or Open WebUI knowledge bases into Penny memory.
- Do not raise context or rendered-memory limits because a model or app advertises long context.
- Do not enable default thinking or persist hidden reasoning because Qwen/Pi/OpenCode exposes thinking controls.
- Do not merge tool evidence into PromptTruth for convenience.
- Do not expose Penny's local LAN or model server through tunnels as a default access pattern.

## License/Access Risk

- The GitHub catalog license metadata is only for the catalog, and it appears internally inconsistent across files. It does not license linked projects.
- Linked projects vary widely. Subagent spot checks flagged low-friction MIT projects, AGPL projects such as KoboldCpp/SillyTavern/Open Interpreter/SearXNG, and ambiguous or commercial/fair-code surfaces such as Open WebUI, n8n, Lobe Chat, Onyx, and LiteLLM.
- Treat every project as "read for ideas only" until its current license, install shape, data flow, and dependency tree are checked.
- Reddit comments are public discussion, not implementation material.

## Privacy/Local-Data Risk

The highest-risk ideas in the Reddit thread are also the most seductive:

- camera/event summaries
- Home Assistant control
- firewall/syslog/CVE summaries
- Proxmox/server actions
- Obsidian vault organization
- CV editing
- diet-photo logging
- email automation
- n8n automations
- shell command helpers

These can be useful as sidecars, but they cross into personal/home/system data. Penny should require explicit scope, source receipts, read-only defaults, confirmation before writes/actions, and no silent durable memory writes.

## Platformization Risk

The catalog is full of things that want to become the center:

- replacement chat UIs
- hosted-style knowledge platforms
- workflow builders
- connector hubs
- general-purpose agents
- MCP gateways
- browser/computer-control stacks

That is exactly the wrong gravitational pull for Penny. Penny's core should stay local, single-user, companion-first, and receipt-bound. The external ecosystem is a toolbox, not a migration plan.

## Current-Law Conflict

- External RAG apps conflict with Penny memory law if their outputs are treated as canonical memory.
- Agent/control apps conflict with Penny initiative law if they can act without explicit user approval.
- Model docs and app configs conflict with Penny runtime law if they imply default thinking, hidden-reasoning storage, larger context, or broader tool authority.
- Broad MCP/proxy/gateway apps conflict with Penny's current tool descriptor seam if they are added as live adapters before a concrete workflow exists.
- Home/camera/system integrations conflict with Penny's privacy posture unless kept sidecar, scoped, and confirmation-gated.

## Owner Seams

- Model/runtime compare: `scripts/eval-penny-models.js`, `scripts/eval-penny-runtime-fit.js`, `PENNY_MODEL_EVAL.md`
- Existing Qwen compare plan: `docs/plans/penny-q6-e4b-vs-qwen-single-model-compare-2026-04-20.md`
- LM Studio model/status/transport facts: `lib/penny-lmstudio-status.js`, `lib/penny-lmstudio-transports.js`, `scripts/penny-preflight.js`
- Runtime watch: `lib/penny-gemma-runtime-watch.js`, or a future neutral `lib/penny-model-runtime-watch.js`
- Embedding candidate behavior: `lib/penny-embedding-providers.js`, `lib/penny-static-embedding-cache.js`, `lib/penny-static-memory-index.js`, `scripts/eval-penny-static-embedding-live-compare.js`
- Tool-loop reliability: `lib/penny-tool-loop.js`, `lib/penny-direct-tool-assist.js`, `lib/penny-tool-registry.js`, `lib/penny-runtime-artifacts.js`
- Privacy/initiative gates: `lib/penny-initiative-policy.js`, `lib/penny-open-loops.js`, public docs if a user-facing boundary is added

## Verification Commands

For this docs-only note:

```bash
git diff --check
```

For the recommended model compare:

```bash
npm run preflight
PENNY_EVAL_MODELS=<qwen-local-model-id>,unsloth/gemma-4-31b-it@q6_k npm run eval:models
npm run eval:runtime-fit
git diff --check
```

For the existing Q6+E4B vs Qwen profile plan:

```bash
npm test
npm run preflight
npm run qa:voice:tiebreak
npm run qa:memory:semantic
npm run qa:memory:mixed
PENNY_BROWSER_SMOKE_IMAGE_ONLY=1 npm run qa:browser:smoke
```

Run heavy local model checks one harness at a time, verify the loaded LM Studio/`llama.cpp` state first, and clean disposable memory/archive/embedding residue afterward.

## Artifact Scope/Limits

- This file is a historical external-source synthesis.
- It is not runtime law.
- It is not model approval.
- It is not dependency approval.
- It is not evidence that Qwen 3.6 27B beats Gemma 4 31B Q6 for Penny.
- It is not evidence that Gemma beats Qwen for coding/tool use.
- It is not permission to expand Penny's authority, memory, prompt context, PromptTruth, tool evidence, connector surface, or model defaults.

## Implementation Status - 2026-05-11

The first repo-integrated scaffold has landed. It translates this note into structured, reviewable, disabled-by-default surfaces:

- App catalog and shortlist: `npm run penny:apps`.
- Sidecar trial contracts and scoring: `npm run penny:sidecars`.
- Endpoint compatibility probe: `npm run penny:endpoint:probe`.
- Neutral model-runtime watch: `npm run penny:model-watch`.
- Qwen-vs-Gemma compare prep: `npm run penny:model-compare`.
- Pi/OpenCode operator helper templates: `npm run penny:pi:template`, `npm run penny:opencode:template`.
- Pattern mining queue: `npm run penny:patterns`.
- Descriptor-only registry: `npm run penny:sidecar:descriptors`.
- Deterministic fixture bundle: `npm run penny:sidecar:test-fixtures`.

This status does not mean any live sidecar install, license approval, dependency approval, default model change, memory promotion, PromptTruth expansion, `toolEvidenceReceipt` merge, hidden-reasoning persistence, context-limit increase, public automation, or home/camera/email authority shipped.

### Corrective Section 2-7 Trial Pass - 2026-05-11

The scaffold-only gap for sections 2-7 is now closed with runnable local trial commands, JSON artifacts, tests, and a section-completion gate.

Packaged checkpoint: `docs/sidecars/penny-local-llm-sidecar-campaign-checkpoint-2026-05-12.md`.

| Section | Cluster | Primary app/harness | Status | Rerun |
|---|---|---|---|---|
| 2 | Local lab cockpit | Open WebUI live mock model route via disposable OpenAI-compatible backend | LIVE_VERIFIED | `OPEN_WEBUI_BASE_URL=http://127.0.0.1:13000 PENNY_MOCK_OPENAI_BASE_URL=http://127.0.0.1:18081/v1 npm run penny:sidecar:lab-cockpit -- --fixture --live-probe --openwebui-mock-model-trial --openwebui-base-url http://127.0.0.1:13000 --mock-openai-base-url http://127.0.0.1:18081/v1 --openwebui-auth-token-file /tmp/penny-openwebui-signup.json --json --artifact-out artifacts/sidecar-trials/section-2-lab-cockpit-openwebui.json` |
| 3 | Home/camera event | Frigate live version probe plus Home Assistant auth-blocker probe | LIVE_VERIFIED | `FRIGATE_URL=http://127.0.0.1:15000 HOME_ASSISTANT_URL=http://127.0.0.1:18123 npm run penny:sidecar:home-camera -- --fixture --live-probe --frigate-base-url http://127.0.0.1:15000 --home-assistant-base-url http://127.0.0.1:18123 --json --artifact-out artifacts/sidecar-trials/section-3-home-camera-frigate.json` |
| 4 | Workflow automation | n8n live manual workflow import/export plus dry-run toy flow | LIVE_VERIFIED | `npm run penny:sidecar:workflow -- --fixture --live-probe --n8n-workflow-trial --n8n-base-url http://127.0.0.1:15678 --n8n-container-name penny-n8n-workflow-trial --json --artifact-out artifacts/sidecar-trials/section-4-workflow-n8n-toy-flow.json` |
| 5 | Research/search | SearXNG live JSON query smoke plus review digest | LIVE_VERIFIED | `npm run penny:sidecar:research -- --fixture --live-probe --searxng-base-url http://127.0.0.1:18089 --json --artifact-out artifacts/sidecar-trials/section-5-research-searxng-digest.json` |
| 6 | Document/RAG | Qdrant live create/upsert/search/delete plus fixture RAG sandbox | LIVE_VERIFIED | `npm run penny:sidecar:rag -- --fixture --live-probe --qdrant-write-trial --qdrant-base-url http://127.0.0.1:16333 --json --artifact-out artifacts/sidecar-trials/section-6-rag-document-sandbox.json` |
| 7 | Audio/voice | Speaches live TTS fixture plus transcript review | LIVE_VERIFIED | `SPEACHES_BASE_URL=http://127.0.0.1:18000 npm run penny:sidecar:audio -- --fixture --live-probe --speaches-tts-trial --speaches-base-url http://127.0.0.1:18000 --json --artifact-out artifacts/sidecar-trials/section-7-audio-transcript-review.json` |

Gate:

```bash
npm run penny:sidecar:completion-gate -- --matrix artifacts/sidecar-trials/section-completion-matrix.json --out artifacts/sidecar-trials/section-completion-gate-result.json --json
```

The gate result is `all_required_sections_complete=true` with sections 2, 3, 4, 5, 6, and 7 live-verified and 0 failures. Disposable Docker smokes verified Open WebUI on port 13000 with a mock OpenAI-compatible backend on port 18081, Frigate on port 15000, Home Assistant auth status on port 18123, n8n on port 15678, SearXNG on port 18089, Qdrant on port 16333, and Speaches on port 18000. WSL `curl` and Windows PowerShell both got HTTP 200 from the safe live endpoints used in the artifacts, except Home Assistant `/api/`, which returned HTTP 401 from both sides and is recorded as `blocked_by_auth=true`. The refreshed Open WebUI artifact goes beyond health/config: it used a disposable local signup token, saw `penny-sidecar-toy-model` through `/api/models`, submitted a non-private toy prompt to `/api/chat/completions`, got an async task receipt, and proved the route reached the mock backend when mock `chat_requests` increased by 1. The refreshed Frigate artifact uses a no-camera config and records only `/api/version`; no stream endpoint, camera history endpoint, Home Assistant state endpoint, service-call endpoint, device-control path, microphone, or ambient capture path was requested. The refreshed n8n artifact goes beyond `/healthz`: it imported workflow id `penny-sidecar-local-toy-flow` through the disposable container CLI, verified export, and recorded credentials/webhooks/schedules/email/cloud/public/home/system actions all false. The refreshed Qdrant artifact goes beyond `/collections`: it created a temporary `penny_sidecar_trial_*` collection, upserted two non-sensitive fixture vectors, ran vector search, deleted the collection, and recorded `private_docs_used=false`, `penny_memory_imported=false`, and `memory_write=false`. The refreshed Speaches artifact goes beyond health/model probes: it checked the text-to-speech registry, requested `speaches-ai/Kokoro-82M-v1.0-ONNX`, confirmed it in `/v1/models`, generated `244780` bytes of `audio/wav` from fixture text, deleted the temp output, and recorded `microphone_access=false`, `recording_started=false`, `ambient_capture=false`, `input_audio_uploaded=false`, `private_audio_used=false`, `penny_memory_imported=false`, and `memory_write=false`. SearXNG used `fixtures/sidecar-trials/searxng-json-settings.yml` to enable JSON for the disposable trial; the artifact parsed live source titles/URLs but kept the digest review-only. Port 18080 was rejected because Windows already had a `llama.cpp` listener there even though WSL could reach Docker on that port. The Docker containers were removed after verification. No live openedai-speech, faster-whisper, or Parler service was found by the safe read-only probes.

Penny remains the companion/runtime owner. These artifacts are review outputs, not memory. The pass does not approve installs, change Penny memory, change PromptTruth, merge tool evidence into PromptTruth, change the default model, change runtime prompts, raise prompt/context limits, persist hidden reasoning, expose LAN/tunnels, add public/email/social automation, enable home control, or add ambient camera/microphone/screen/browser-history capture.

## Suggested Next Slice

Best next sidecar slice: review and commit the packaged checkpoint, or run one optional all-sections-from-empty disposable rerun if another receipt pass is desired. Keep it lab-only: do not route Penny through Open WebUI, do not touch the user's live LM Studio model state, and do not import Penny memory or private runtime artifacts.

Acceptance criteria:

- The completion gate still reports `all_required_sections_complete=true`, all required sections live-verified, and 0 failures.
- All disposable sidecar containers are stopped after verification.
- The artifacts keep `memory_imported=false`, `private_runtime_artifacts_uploaded=false`, `memory_write=false`, `runtime_changed=false`, `default_model_changed=false`, and `prompttruth_changed=false`.
