# AGENTS.md

This repo is the Penny app. If an agent wakes up inside `lyra-prototype`, this file should be enough to get oriented on Penny even if the wider workspace is not present.

## Read order

1. `./SOUL.md`
2. `./USER.md`
3. `./README.md`
4. `./CODEBASE.md`
5. `./ARCHITECTURE.md`
6. In direct chats with the human, also read `./MEMORY.md`

Optional overlay context:

- If `../AGENTS.md`, `../SOUL.md`, `../USER.md`, or `../memory/YYYY-MM-DD.md` exist, treat them as workspace-level overlay context.
- Do not depend on the parent workspace being present. This repo should still make sense on its own.

## Memory rule

- When this repo is inside the main workspace, `../memory/` is the canonical day-by-day continuity folder.
- When the repo is used standalone and there is no parent memory folder, use `./memory/`.
- Never split the same day-by-day continuity across both locations.
- `./memory/` is always acceptable for app-local troubleshooting or disposable Penny-only notes.

## Project truths

- Penny is currently a single-user local prototype.
- LM Studio is the main brain.
- Tool behavior should stay bounded, honest, and companion-first.
- Do not sand Penny down into a generic assistant while fixing engineering issues.
- Explicit memory in `data/penny-memory.json` is canonical.
- Archive memory in `data/penny-memory-archive.json` is additive, inspectable, and review-gated before promotion.
- Semantic memory depends softly on `PENNY_LMSTUDIO_EMBED_MODEL`; fallback keyword retrieval is expected when the embed model is missing or unloaded.
- `server.js` is now supposed to be a thin orchestration shell; extend extracted backend owners in `lib/` before growing it again.
- `public/js/penny-app.js` is now supposed to be a thin browser orchestration shell; extend extracted browser owners in `public/js/` before growing it again.

## Commands

- Start in foreground: `npm start`
- Start in background with readiness gate: `npm run start:durable`
- Stop background server: `npm run stop`
- Local environment check: `npm run preflight`
- Tests: `npm test`
- Phone/LAN reset runbook: `docs/penny-lan-phone-reset-runbook-2026-04-21.md`

## File map

- `server.js`: backend orchestration and routes
- `lib/`: extracted backend helpers, including hybrid archive memory
- `public/`: browser UI shell and modules
- `penny-voice/runtime/`: live prompt-facing voice assets
- `scripts/`: QA, eval, and launcher helpers

## Repo-local skills

- This repo now ships a local skill pack in `./.codex/skills/`.
- Start with `./.codex/skills/README.md` when a task smells like LM Studio ops, memory inspection, or Penny QA/release work.
- Use those skills to avoid rediscovering the same Penny-specific workflows from scratch.
- Keep the first wave narrow: LM Studio ops, memory inspector, and QA/release only.
- Before cross-cutting implementation, use the skill task-fit checks and [docs/plans/TEMPLATE.md](./docs/plans/TEMPLATE.md) to capture blockers, owners, authority receipts, verification cost, cleanup risk, and landed/deferred results.

## Guardrails

- Prefer read-only investigation in parallel and one main editing agent for actual changes.
- Avoid editing overlapping files from multiple agents at the same time.
- Keep docs honest about the current implementation, especially around local-only, single-user, and frontend/backend ownership boundaries.
- Route/regression verification must use an isolated mock or dedicated temporary LM Studio server instead of the user's live loaded model. This pattern is proven in-project and should carry forward.
- Heavy LM Studio QA and eval runs should happen one harness at a time. Do not overlap full voice QA, memory QA, and probe/eval runs against the same local model setup.
- For phone/LAN access failures, do not rediscover WSL/PowerShell behavior from scratch. Use [docs/penny-lan-phone-reset-runbook-2026-04-21.md](./docs/penny-lan-phone-reset-runbook-2026-04-21.md): verify Windows port `4317`, clear orphaned listeners, restart with `PENNY_SKIP_LMSTUDIO_PREP=1` when preserving the loaded model state, and give the phone the Windows Wi-Fi IPv4 URL, not `localhost` or the WSL adapter.
- After QA runs, clear all disposable QA-generated explicit memory, archive memory, and embedding files so the next pass does not inherit test pollution.

## Delegation-First Workflow

- Use subagents aggressively for independent read-only exploration, QA inspection, and doc mapping.
- Codex can have at most six live subagents at once; trying to spawn more without closing or reusing older ones will error.
- If a subagent spawn fails because the active-agent limit was hit, fix that immediately before continuing. Do not pretend the delegation succeeded.
- Full-context forks (`fork_context=true`) inherit the current thread history, instructions, and model/reasoning settings unless those are explicitly overridden. For Penny, that inherited context is usually a feature for aligned repo work, not a bug by itself.
- Do not confuse "this child is too anchored to the parent and is not an independent second opinion" with "subagent spawning/runtime failed." The first is expected inheritance behavior. The second is a real tooling/runtime problem and must be called out plainly instead of hand-waved away.
- If the task needs a fresh review, disagreement check, or different operating mode, spawn without a full-context fork or override the model/reasoning settings on purpose. If the child hangs, errors, or returns uselessly thin work, stop and diagnose that as a delegation failure before continuing the main slice.
- Keep one primary editing agent per file boundary.
- Consolidate what the subagents find before writing anything.
- If a task crosses backend, frontend, tests, and docs, treat that as the cue to delegate the independent reads and QA slices before a single editor applies the final patch.
- For cross-cutting Penny work that needs a written plan, start from [docs/plans/TEMPLATE.md](./docs/plans/TEMPLATE.md) and keep the delegation map plus verification plan in that artifact instead of scattering the policy across handoff notes.

## Current ownership hints

- Backend orchestration splits now live primarily in:
  - `lib/penny-route-handlers.js`
  - `lib/penny-server-http.js`
  - `lib/penny-prompt-assets.js`
  - `lib/penny-chat-runtime.js`
- Browser orchestration splits now live primarily in:
  - `public/js/penny-expression-runtime.mjs`
  - `public/js/penny-transcript-ui.mjs`
  - `public/js/penny-memory-panel.mjs`
