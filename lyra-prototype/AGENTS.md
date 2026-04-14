# AGENTS.md

This repo is the Penny app. If an agent wakes up inside `lyra-prototype`, this file should be enough to get oriented even if the wider workspace is not present.

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

## Commands

- Start in foreground: `npm start`
- Start in background with readiness gate: `npm run start:durable`
- Stop background server: `npm run stop`
- Local environment check: `npm run preflight`
- Tests: `npm test`

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

## Guardrails

- Prefer read-only investigation in parallel and one main editing agent for actual changes.
- Avoid editing overlapping files from multiple agents at the same time.
- Keep docs honest about the current implementation, especially around local-only, single-user, and frontend/backend ownership boundaries.
