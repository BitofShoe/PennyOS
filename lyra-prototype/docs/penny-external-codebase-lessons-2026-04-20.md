# Penny External Codebase Lessons

> Category: External-source research synthesis
> Authority: Historical evidence / current research note
> Status: Current as of 2026-04-20 local PDT / 2026-04-21 UTC
> Use this for: deciding which lessons from the reviewed external repos are worth applying to Penny or to agents coding Penny.
> Do not use this for: current runtime law, license to import code, or proof that any follow-up work has shipped.

## Scope

Reviewed links:

- [thunderbird/thunderbolt](https://github.com/thunderbird/thunderbolt)
- [paperless-ngx/paperless-ngx](https://github.com/paperless-ngx/paperless-ngx)
- [koala73/worldmonitor](https://github.com/koala73/worldmonitor)
- [openai/openai-agents-python](https://github.com/openai/openai-agents-python)
- [pi-hole/pi-hole](https://github.com/pi-hole/pi-hole)
- [XTLS/Xray-core](https://github.com/XTLS/Xray-core)
- [jamiepine/voicebox](https://github.com/jamiepine/voicebox)
- [gtsteffaniak/filebrowser](https://github.com/gtsteffaniak/filebrowser)
- [mvanhorn/last30days-skill](https://github.com/mvanhorn/last30days-skill)
- [appcypher/awesome-mcp-servers](https://github.com/appcypher/awesome-mcp-servers)
- [ColeMurray/background-agents](https://github.com/ColeMurray/background-agents)
- [zackees/transcribe-anything](https://github.com/zackees/transcribe-anything)
- [quiet-node/thuki](https://github.com/quiet-node/thuki)
- [coleam00/Archon](https://github.com/coleam00/Archon)
- [teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py)
- [dcramer/dex](https://github.com/dcramer/dex)

All links resolved during this pass. The review used current GitHub pages, GitHub API metadata, raw repo docs where useful, and six read-only subagent slices. No runtime code was changed.

Existing unrelated dirty files were present before this report and were left alone:

- `package.json`
- `scripts/qa-penny-voice-redo.js`
- `test/penny-voice-redo.test.js`

## Bottom Line

There is useful material here, but the useful material is smaller than the repos look.

The best imports are:

1. Tighten Penny's repo-local skill and planning contracts so future coding agents have clearer task-fit, verification, and receipt checklists.
2. Make Penny's existing readiness and receipt state easier to inspect at a glance, without adding a platform dashboard.
3. Harden offline ingestion provenance: raw source identity, derived chunk identity, dedup, review-only promotion, and capability-gated media paths.
4. Preserve Penny's existing `PromptTruth` / `toolEvidenceReceipt` split and use external agent frameworks as vocabulary pressure, not architecture pressure.
5. If richer audio or desktop presence ever lands, require capability receipts before UI promises.

The bad imports are also clear:

- no enterprise AI-client platform
- no cloud background-agent control plane
- no broad MCP marketplace ingestion
- no multi-user auth/sharing/file-server surface
- no direct NotebookLM or Google-cookie connector
- no voice-cloning studio ambition
- no news/geopolitical monitoring product
- no task-manager data inside Penny's companion memory

Penny is already on the right axis: local, companion-first, explicit-memory-canonical, archive/research advisory, receipt-heavy, and bounded. These repos mostly say: make that axis more operationally boring and inspectable.

## Highest-Value Follow-Ups

### 1. Apply Now: Docs / Skills Task-Fit Hardening

This is the best first slice because it helps future agents immediately and does not touch runtime behavior.

External inspiration:

- Thunderbolt's `Thunderbot` workflow layer and task assessment style
- `last30days-skill` skill-contract discipline
- Archon's explicit workflow phases and validation gates
- Dex's "ticket, not todo" task context
- Background-agents' single-tenant honesty and debugging/correlation posture

Penny landing zones:

- [.codex/skills/README.md](../.codex/skills/README.md)
- `.codex/skills/penny-lmstudio-ops/SKILL.md`
- `.codex/skills/penny-memory-inspector/SKILL.md`
- `.codex/skills/penny-qa-release/SKILL.md`
- [docs/plans/TEMPLATE.md](./plans/TEMPLATE.md)
- [AGENTS.md](../AGENTS.md)

Suggested shape:

- put hard laws and failure modes earlier in the skills
- add a task-fit rubric for implementation slices: blockers, complexity, confidence, touched owners, verification cost
- add a receipt/authority checklist: PromptTruth vs tool evidence, explicit memory vs archive/ledger, runtime artifacts vs prose
- add a safe-refactor checklist for `server.js` and `public/js/penny-app.js`: scan, impact map, ordered tasks, behavior-preserving tests, review
- add result/evidence fields to plan artifacts so handoffs capture what landed, what was verified, and what was deferred

Why it fits:

- it reinforces current Penny workflow without adding product surface
- it reduces future agent drift
- it respects the repo's existing plan-before-code preference

### 2. Apply Next: Friendlier Runtime / Readiness Summary

Penny already has readiness data, PromptTruth, `toolEvidenceReceipt`, recent audit slices, and inspector views. The useful external lesson is not "add diagnostics from scratch"; it is "make the current truth easier to answer quickly."

External inspiration:

- Pi-hole's CLI/web parity and debug discipline
- World Monitor's health/freshness metadata
- FileBrowser's source scoping and visible permission model
- Xray's explicit route/policy/config boundaries
- OpenAI Agents SDK tracing/result-surface vocabulary

Penny landing zones:

- `lib/penny-runtime-artifacts.js`
- `lib/penny-route-handlers.js`
- `lib/penny-lmstudio-status.js`
- `scripts/penny-preflight.js`
- `public/js/penny-memory-panel.mjs`
- `public/js/penny-lmstudio-ui.js`

Suggested shape:

- a compact local-only "latest turn / runtime health" summary
- lane/model/transport readiness
- semantic memory ready vs fallback
- memory source counts and canonical/advisory boundary
- PromptTruth rendered/held-back summary
- tool evidence present/absent summary
- tool capability/scope/write-risk summary for technical turns
- same facts available in CLI/preflight and browser inspector where practical

Risks:

- avoid duplicating the existing inspector into another dashboard
- do not infer truth from `executionPath`, `toolRecords`, or zero counts alone
- do not move generic receipt semantics back into `server.js`

### 3. Apply Next: Offline Ingestion Provenance Hardening

This one is especially relevant because Penny already has knowledge ingestion code:

- `lib/penny-knowledge-contracts.js`
- `lib/penny-knowledge-ingestion.js`
- `scripts/import-penny-conversations.js`

External inspiration:

- Paperless-ngx's consume pipeline and original-vs-derived artifact discipline
- transcribe-anything's backend capability gates and stable output artifacts
- NotebookLM-py's instability warnings and health-check mindset

Suggested shape:

- add raw source identity and checksum fields
- add source artifact id and derived chunk ids
- record processing status and degraded/capability state
- keep promotion packets review-only
- keep media/transcript import offline and optional
- never let imported transcript/document facts auto-promote into explicit memory

Why it fits:

- Penny already creates `ConversationThread`, `ThreadChunk`, extracted facts, temporal preferences, knowledge nodes, and promotion packets
- the missing pressure is stronger raw-vs-derived provenance, dedup, and capability truth

Risks:

- do not turn this into Paperless
- do not add email/scanner/share/link/multi-user document features
- do not import copyleft code from GPL/AGPL projects

### 4. Maybe Later: Dangerous Tool Approval Metadata

External inspiration:

- OpenAI Agents SDK guardrails / human-in-the-loop concepts
- awesome-mcp-servers security warning
- FileBrowser permission scoping

Penny landing zones:

- `lib/penny-tool-registry.js`
- `lib/penny-direct-tool-assist.js`
- `lib/penny-tool-loop.js`
- `lib/penny-runtime-artifacts.js`

Suggested shape:

- only for future irreversible or sensitive tools
- add metadata such as `approvalRequired`, `scope`, `sideEffectClass`, and `promptVisibility`
- keep it local and receipt-backed
- do not build a broad policy engine now

Current state:

- Penny already has `ToolCapabilityDescriptor` with `surface`, `operationKind`, `sideEffectClass`, and `executionSupport`
- current tools are local/native, while `mcp` and `openapi` are planning surfaces, not live connector adapters

### 5. Maybe Later: Presence / Audio Capability Receipts

External inspiration:

- Voicebox capability-gated TTS engines, generation versions, effects provenance, and queues
- Thuki's quick contextual invocation loop
- Thunderbolt's structured UI/widget discipline

Penny landing zones:

- `penny-voice/runtime/*`
- `lib/penny-runtime-artifacts.js`
- possible future `lib/penny-audio-runtime.js`
- `public/js/penny-expression-runtime.mjs`
- `public/js/penny-transcript-ui.mjs`
- `public/js/penny-attachments.js`

Suggested shape:

- do not add a voice platform
- if spoken output becomes real, record what engine/profile/effects actually rendered
- queue or cancel expensive audio work instead of putting it on the chat hot path
- expose "speaking / queued / cancelled / fallback" states only when backed by real capability
- keep screenshot/clipboard/screen capture opt-in and bounded

Risks:

- voice cloning has consent, storage, and safety costs
- desktop screen permissions are a major trust jump
- slash commands should only map to existing bounded intent paths

## Repo-by-Repo Findings

### thunderbird/thunderbolt

What it is:

- Cross-platform AI client aimed at model choice, on-prem deployment, sync, optional encryption, and integrations.
- It is early and active, with docs for architecture, deployment, development, features, and Claude Code skills.
- The most transferable part is not the product platform. It is the repo's agent-workflow layer around setup, task assessment, quality gates, and structured UI.

Useful for Penny:

- `already-landed`: local/on-prem instincts, model-provider awareness, docs hierarchy, skills, and setup commands already map to Penny's repo-local skills and LM Studio runbooks.
- `strengthen-now`: task-fit scoring before implementation slices. A small rubric could prevent agents from starting broad edits when the task actually needs read-only analysis, QA, or a docs-only pass.
- `strengthen-now`: structured UI artifacts should derive from deterministic facts where possible. This reinforces Penny's existing receipt approach.
- `maybe-later`: a tiny fixed registry for inspector/transcript affordances, if Penny needs richer structured display parts.

Poor fit:

- enterprise sync
- mobile cross-platform expansion
- auth/OIDC
- provider marketplace posture
- broad integration platform

Penny interpretation:

Thunderbolt is useful as negative space. It shows how quickly an AI client becomes a platform. Penny should borrow the task discipline and reject the gravitational pull.

### paperless-ngx/paperless-ngx

What it is:

- Mature document management system for scanned/imported documents.
- It consumes documents, OCRs/parses them, stores originals and archive variants, indexes content, detects duplicates, and applies metadata/workflows.

Useful for Penny:

- `strengthen-now`: treat ingestion as a pipeline: preflight, normalize, chunk, extract, dedup, emit review packets.
- `strengthen-now`: preserve original-vs-derived identity. Penny should know the raw source artifact separately from derived chunks, extracted facts, and promotion packets.
- `strengthen-now`: metadata assignment should stay reviewable. Auto-derived memory candidates should not mutate canonical explicit memory.
- `maybe-later`: tiny ingestion-only rules such as "never promote from this source" or speaker/source labeling.

Poor fit:

- document management product surface
- scanner/email ingest
- multi-user permissions
- share links
- storage-path templating
- broad document chat

License caution:

Paperless-ngx is GPL-3.0. Borrow architecture ideas only, not code.

Penny interpretation:

The best lesson is artifact provenance. Penny's current knowledge ingestion is already small and Penny-shaped; the next improvement is raw source and derived artifact accounting.

### koala73/worldmonitor

What it is:

- Real-time global intelligence dashboard with many feeds, AI-synthesized briefs, data source catalogs, variants, caching, and health/freshness checks.

Useful for Penny:

- `strengthen-now`: freshness/readiness metadata belongs close to the operator surface.
- `strengthen-now`: health state should be summarized, not buried.
- `maybe-later`: a compact readiness strip in the Memory/debug UI for LM Studio lanes, semantic memory, archive/ledger state, and latest receipt state.

Poor fit:

- news surveillance
- 500-feed aggregation
- geopolitical dashboards
- Redis/edge/CDN cache architecture
- app variants

Penny interpretation:

The useful idea is "what is fresh, stale, degraded, or missing?" Not "make Penny a monitoring dashboard."

### openai/openai-agents-python

What it is:

- Official OpenAI Python SDK for agent loops, tools, handoffs, sessions, guardrails, tracing, human-in-the-loop, and sandbox agents.
- Official docs emphasize a small primitive set: agents, handoffs/agents-as-tools, and guardrails, with tracing and sessions around them.

Useful for Penny:

- `already-landed`: Penny already owns her loop locally: lane selection, bounded tool loop, memory selection, runtime artifacts, PromptTruth, and `toolEvidenceReceipt`.
- `strengthen-now`: use result-surface vocabulary pressure. Visible reply, raw model/tool events, prompt-rendered context, and deterministic tool evidence should stay separate.
- `strengthen-now`: session history is not the same as durable memory. This maps directly to Penny's explicit memory vs archive vs research-ledger split.
- `maybe-later`: tool guardrail/HITL ideas for genuinely dangerous future tools.

Poor fit:

- replacing Penny's LM Studio path with the Agents SDK
- hosted tool abstraction
- generic multi-agent handoff architecture
- sandbox agents as product direction

Penny interpretation:

Use it as a receipt-quality and naming reference, not as a runtime migration plan.

### pi-hole/pi-hole

What it is:

- Local/network DNS sinkhole with installer, CLI, optional web dashboard, debug flows, and privacy-first local control.

Useful for Penny:

- `already-landed`: Penny's local-appliance posture is a strength, not a temporary stage.
- `strengthen-now`: CLI/Web parity. If Memory Debug can show a fact, a script should often be able to print the same fact.
- `strengthen-now`: one boring diagnostic path is better than scattered "try rerunning" habits.
- `maybe-later`: a redacted local debug bundle for outside review, building on `scripts/build-review-bundle.js`.

Poor fit:

- network appliance posture
- DHCP/DNS style always-on administration
- LAN exposure hardening as a current priority

Penny interpretation:

Borrow the boring admin/debug discipline. Do not turn Penny into a home-server appliance.

### XTLS/Xray-core

What it is:

- Modular proxy/network core with many protocols, transports, config formats, CLI subcommands, and ecosystem clients.

Useful for Penny:

- `already-landed`: explicit routing and policy boundaries map to Penny's chat/tool/shadow lane split.
- `strengthen-now`: config normalization should say what env/browser/disk setting won and why.
- `strengthen-now`: route decisions should be inspectable policy facts, not invisible branches.
- `maybe-later`: a more explicit capability registry only if direct-intent/tool-loop auditability gets painful.

Poor fit:

- protocol sprawl
- many deployment topologies
- third-party panels and clients
- network tunneling product scope

Penny interpretation:

Borrow modular policy/accounting patterns. Reject ecosystem expansion.

### jamiepine/voicebox

What it is:

- Local-first voice synthesis studio with Tauri, React, FastAPI, SQLite, multiple TTS engines, voice profiles, effects, transcription, stories/timeline, and REST API.

Useful for Penny:

- `strengthen-now`: capability honesty. UI should not promise paralinguistic tags, streaming, voice cloning, or effects unless the selected backend supports them.
- `strengthen-now`: queue and cancellation discipline for GPU/audio work.
- `maybe-later`: audio generation provenance: original text, engine, profile, effects, seed/take, and lineage.
- `maybe-later`: tag UX only after a proven TTS backend exists.

Poor fit:

- voice synthesis studio
- multi-engine ambition
- voice cloning by default
- effects/timeline product surface

Penny interpretation:

Voicebox is most useful as a warning: audio features need capability receipts before they need UI polish.

### gtsteffaniak/filebrowser

What it is:

- Self-hosted web file manager with backend/frontend split, source scoping, auth modes, sharing/access controls, indexing/search, previews, editing, WebDAV, and Swagger.

Useful for Penny:

- `already-landed`: source/authority separation maps to explicit memory vs advisory archive/research plus PromptTruth/tool evidence.
- `strengthen-now`: tool safety UI should expose capability, scope, and write risk clearly.
- `strengthen-now`: file/project tools need path/source scoping and regression tests.
- `strengthen-now`: removing shell commands is a useful product-boundary example.

Poor fit:

- multi-user auth
- LDAP/OIDC
- sharing links
- WebDAV
- long-lived public API tokens
- full file-browser UI inside Penny

Penny interpretation:

Penny's file powers should stay narrow, local, visible, and receipt-backed.

### mvanhorn/last30days-skill

What it is:

- Agent skill for recent cross-platform research across community/social/web sources, with explicit setup and output contracts.

Useful for Penny:

- `strengthen-now`: skill docs should put non-negotiable laws and failure modes near the top.
- `strengthen-now`: source/synthesis boundaries should be explicit. The engine's output is not the same as final synthesis.
- `strengthen-now`: entity pre-resolution is a good research pattern, especially for people/projects.
- `maybe-later`: a Penny external-link-review skill that emits `already-landed / strengthen-now / maybe-later / poor-fit`.

Poor fit:

- social API sprawl
- API key/browser-session setup
- community sentiment engine inside Penny runtime
- engagement scoring as truth

Penny interpretation:

This is more useful for agents coding Penny than for Penny herself.

### appcypher/awesome-mcp-servers

What it is:

- Curated list of MCP servers with an explicit security warning that unsandboxed servers can access local files, network, system resources, execute code, and leak data.

Useful for Penny:

- `already-landed`: Penny has native/local tool seams and a sibling `toolEvidenceReceipt`.
- `strengthen-now`: use the catalog as a risk checklist for any new tool: scope, sandboxing, prompt injection, data exposure, monitoring, and source facts.
- `maybe-later`: a small approved-local-tools registry for Penny-owned tools.

Poor fit:

- broad MCP marketplace ingestion
- remote/cloud/social/communication connectors
- generic connector hub posture

Penny interpretation:

The MCP list is mostly useful as a caution label. Do not add servers because they exist.

### ColeMurray/background-agents

What it is:

- Hosted background coding-agent system with control plane, sandboxed dev environments, session streaming, automations, integrations, and PR creation.

Useful for Penny:

- `already-landed`: single-tenant honesty reinforces Penny's single-user local prototype framing.
- `strengthen-now`: stable correlation fields across logs, artifacts, QA output, and inspector views.
- `strengthen-now`: provider/tool expansion should require a small boundary note before implementation.
- `maybe-later`: bounded automations can be useful, but should remain local/thread-style.

Poor fit:

- cloud control plane
- Modal/Cloudflare infrastructure
- Slack/Linear/GitHub bot expansion
- multiplayer sessions
- shared GitHub App credential model

Penny interpretation:

Borrow observability and scope honesty. Reject the hosted platform architecture.

### zackees/transcribe-anything

What it is:

- Python Whisper wrapper for transcribing local files or URLs across CPU/CUDA/MLX and other backend modes, with optional diarization and stable output artifacts.

Useful for Penny:

- `strengthen-now`: if media import lands, backend capability must be probed and reported.
- `strengthen-now`: normalize backend-specific outputs into a stable local artifact contract before memory ingestion.
- `strengthen-now`: speaker diarization is advisory structure, not canonical memory.
- `maybe-later`: domain vocabulary prompt files for Penny-specific names, repo terms, and user vocabulary.

Poor fit:

- live chat transcription path
- GPU-heavy dependency bundled into Penny
- automatic memory promotion from transcripts

Penny interpretation:

Best fit is offline import: audio/video/conversation export to reviewable memory candidates.

### quiet-node/thuki

What it is:

- Local macOS floating AI secretary with Tauri, React, Rust, SQLite, Ollama, global summon hotkey, selected-text context, screenshots, slash commands, and local history.

Useful for Penny:

- `already-landed`: attachment-bounded image turns are validated by this shape.
- `strengthen-now`: selected context should have quote caps and receipt/source state.
- `maybe-later`: lightweight slash-command shorthands can be ergonomic if they map to existing bounded intent paths.
- `maybe-later`: a small quick-ask/presence affordance might fit Penny better than expanding the main dashboard.

Poor fit:

- default global screen/Accessibility permissions
- always-on desktop agent posture
- secretary superpower roadmap
- broad MCP/provider expansion

Penny interpretation:

Borrow "available, contextual, dismissible." Do not turn Penny into a throwaway utility or system-wide desktop agent by default.

### coleam00/Archon

What it is:

- Deterministic AI coding workflow harness using YAML DAGs, isolated worktrees, validation gates, human approval nodes, and scripted/AI node composition.

Useful for Penny:

- `already-landed`: plan-before-code and one primary editor per boundary are validated.
- `strengthen-now`: safe-refactor workflow maps well to `server.js` and `public/js/penny-app.js` cleanup.
- `strengthen-now`: structured plan artifacts can reduce repeated agent drift.
- `maybe-later`: a repo-local safe-refactor skill/checklist if this keeps recurring.

Poor fit:

- installing Archon as a dependency
- YAML workflow engine inside Penny
- Slack/Telegram/GitHub adapter layers

Penny interpretation:

Archon's determinism is attractive. The Penny-sized import is a checklist and artifact discipline, not a workflow engine.

### teng-lin/notebooklm-py

What it is:

- Unofficial Python API, CLI, and agent skill for NotebookLM using undocumented Google RPCs.

Useful for Penny:

- `already-landed`: external/research artifacts are advisory, not canonical memory.
- `strengthen-now`: explicit instability contracts for brittle external seams.
- `strengthen-now`: health checks that distinguish API mismatch, auth failure, and infrastructure failure.
- `strengthen-now`: namespaced client APIs are a good reminder to keep ingestion/research helpers out of `server.js`.
- `maybe-later`: skill packaging patterns for activation rules, autonomy rules, and output expectations.

Poor fit:

- direct NotebookLM integration
- Google account cookie/session handling
- cloud source ingestion
- broad content-generation features

Penny interpretation:

NotebookLM-py is a good warning about unofficial connectors. If an external seam is brittle, label it and health-check it. Do not absorb it into Penny's core.

### dcramer/dex

What it is:

- Git-friendly persistent task tracking for AI agents, with structured task context, result fields, hierarchy, JSONL storage, MCP tools, and verification-first completion.

Useful for Penny:

- `already-landed`: Penny's plans and handoff docs already do some of this.
- `strengthen-now`: tickets, not todos. Handoffs should include what/why/how/done, result, verification, and follow-ups.
- `strengthen-now`: never mark QA/refactor/memory work complete without command evidence and artifact truth.
- `maybe-later`: local task ledger only if multi-session Penny epics become hard to track in docs/plans.

Poor fit:

- task tickets inside Penny's companion memory
- generic project-management identity
- MCP task manager in the runtime

Penny interpretation:

Dex is for agents coding Penny, not for Penny's memory of the human.

## Cross-Source Lessons

### Already Landed In Penny

- explicit memory is canonical
- archive memory, memory books, and research ledger are advisory
- PromptTruth is prompt-time context authority, not whole-answer provenance
- `toolEvidenceReceipt` is sibling evidence/provenance, not a PromptTruth channel
- runtime artifacts carry readiness/performance/evidence facts
- repo-local skills exist for LM Studio ops, memory inspection, and QA/release work
- route/tool behavior is increasingly helper-owned rather than `server.js` owned
- browser behavior is supposed to stay helper-owned rather than `penny-app.js` owned
- external-source research should become repo-local notes, not platform pivots

### Strengthen Now

- Skill docs and planning template should get stronger task-fit and verification contracts.
- Readiness/receipt summaries should be easier to inspect at a glance.
- Offline ingestion should record raw-vs-derived artifact identity and dedup state.
- Future tool expansion should use capability/scope/write-risk metadata.
- QA/report artifacts should keep stable correlation fields where gaps remain.

### Maybe Later

- Audio capability receipts.
- Quick contextual invocation or slash-command shorthands.
- Small fixed structured UI parts for inspector/transcript affordances.
- Dangerous-tool approval metadata.
- Local debug bundle.
- Worktree automation for large refactors.

### Poor Fit

- direct imports of external frameworks or code
- broad platformization
- connector marketplaces
- cloud control planes
- multi-user auth/sharing
- public/LAN service posture
- social research engines inside Penny runtime
- Google account based source ingestion
- voice cloning default path
- task/project management inside companion memory

## Recommended Next Slice

Best immediate next slice:

1. Update Penny repo-local skills and `docs/plans/TEMPLATE.md` with a compact task-fit, authority/receipt, and verification checklist.
2. Keep it docs/skills-only.
3. Do not touch runtime behavior in that slice.

Best runtime slice after that:

1. Add a friendlier local readiness/receipt summary that consolidates existing runtime truth.
2. Keep `PromptTruth` and `toolEvidenceReceipt` separate.
3. Keep generic receipt semantics in `lib/` owners, not `server.js`.

Best memory/ingestion slice after that:

1. Harden `lib/penny-knowledge-contracts.js` and `lib/penny-knowledge-ingestion.js` with source artifact identity, checksums, derived chunk identity, degraded/capability state, and review-only promotion language.
2. Keep it offline and optional.
3. Do not add document-management or transcription platform scope.

## Sources

External source pages and docs used:

- [Thunderbolt README](https://github.com/thunderbird/thunderbolt)
- [Thunderbolt architecture](https://github.com/thunderbird/thunderbolt/blob/main/docs/architecture.md)
- [Thunderbolt Claude Code skills](https://github.com/thunderbird/thunderbolt/blob/main/docs/claude-code.md)
- [Paperless-ngx README](https://github.com/paperless-ngx/paperless-ngx)
- [Paperless-ngx documentation](https://docs.paperless-ngx.com/)
- [World Monitor README](https://github.com/koala73/worldmonitor)
- [OpenAI Agents SDK repo](https://github.com/openai/openai-agents-python)
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/)
- [Pi-hole README](https://github.com/pi-hole/pi-hole)
- [Xray-core README](https://github.com/XTLS/Xray-core)
- [Voicebox README](https://github.com/jamiepine/voicebox)
- [FileBrowser Quantum README](https://github.com/gtsteffaniak/filebrowser)
- [last30days-skill README](https://github.com/mvanhorn/last30days-skill)
- [awesome-mcp-servers README](https://github.com/appcypher/awesome-mcp-servers)
- [background-agents README](https://github.com/ColeMurray/background-agents)
- [transcribe-anything README](https://github.com/zackees/transcribe-anything)
- [Thuki README](https://github.com/quiet-node/thuki)
- [Archon README](https://github.com/coleam00/Archon)
- [notebooklm-py README](https://github.com/teng-lin/notebooklm-py)
- [dex README](https://github.com/dcramer/dex)

Penny-local grounding used:

- [docs/README.md](./README.md)
- [README.md](../README.md)
- [CODEBASE.md](../CODEBASE.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
- [docs/penny-runtime-authority-contract-2026-04-17.md](./penny-runtime-authority-contract-2026-04-17.md)
- [docs/penny-prompttruth-contract-2026-04-19.md](./penny-prompttruth-contract-2026-04-19.md)
- [docs/plans/TEMPLATE.md](./plans/TEMPLATE.md)
- [.codex/skills/README.md](../.codex/skills/README.md)
- `lib/penny-runtime-artifacts.js`
- `lib/penny-tool-registry.js`
- `lib/penny-knowledge-contracts.js`
- `lib/penny-knowledge-ingestion.js`
- `public/js/penny-memory-panel.mjs`