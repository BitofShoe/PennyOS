---
name: penny-repo-startup-orientation
description: Use when starting Penny/PennyOS work, especially when the cwd is lyra-prototype, startup docs appear missing, root and shim paths disagree, or an agent must decide current repo law without inventing absent AGENTS/SOUL/USER/MEMORY files.
---

# Penny Repo Startup Orientation

Use this skill before deeper Penny work when startup paths are confusing. Its job is to prevent time-wasting root/shim rediscovery, not to replace task-specific Penny skills.

## Core Rule

Verify the real git root, then read only startup docs that actually exist. If a shim points to parent `AGENTS.md`, `SOUL.md`, `USER.md`, or `MEMORY.md` and those parent files are absent, record that as a startup receipt. Do not invent, create, or claim to have read missing parent identity or memory files unless the user explicitly asks for that work.

## First Moves

Run these checks from whatever directory the session starts in:

```bash
pwd
git rev-parse --show-toplevel
```

Use the `git rev-parse` result as the edit/root authority for plans, artifacts, and repo-level docs. If it returns the parent workspace while the shell is inside `lyra-prototype`, treat `lyra-prototype` as the app/shim layer unless a task explicitly targets files there.

Check startup-doc presence at both layers:

```bash
for f in AGENTS.md SOUL.md USER.md README.md CODEBASE.md ARCHITECTURE.md MEMORY.md docs/README.md; do
  if [ -e "$f" ]; then printf 'root present %s\n' "$f"; else printf 'root missing %s\n' "$f"; fi
done

for f in lyra-prototype/AGENTS.md lyra-prototype/SOUL.md lyra-prototype/USER.md lyra-prototype/README.md lyra-prototype/CODEBASE.md lyra-prototype/ARCHITECTURE.md lyra-prototype/MEMORY.md lyra-prototype/.codex/skills/README.md; do
  if [ -e "$f" ]; then printf 'nested present %s\n' "$f"; else printf 'nested missing %s\n' "$f"; fi
done
```

If already inside `lyra-prototype`, either run the second loop from the git root or adjust paths to `./AGENTS.md`, `./SOUL.md`, and so on.

## Reading Order

1. Read any session-provided `AGENTS.md` instructions first, then verify filesystem truth.
2. If `lyra-prototype/AGENTS.md` exists, read it for app-local law and shim semantics.
3. Read the root files that exist among `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and `docs/README.md`.
4. If root `AGENTS.md`, `SOUL.md`, `USER.md`, or `MEMORY.md` are missing, say `missing by filesystem check` instead of treating that as a failed read.
5. Read `.codex/skills/README.md` from the app layer when choosing repo-local Penny skills.

Do not let missing identity shims override current implementation evidence: source files, tests, package scripts, command output, and docs authority maps still define current repo truth.

## Startup Receipt Template

Keep the receipt brief:

```text
Repo root:
Started in:
Present startup docs:
Missing startup docs:
Shim notes:
Current law used:
Edit root:
Not inventing/creating:
```

For the known Penny layout, a valid receipt can say that the parent workspace lacks `AGENTS.md`, `SOUL.md`, `USER.md`, and `MEMORY.md`; `lyra-prototype` has shim files for some of them; and the agent is proceeding from the available shim plus root `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and `docs/README.md`.

## Common Traps

- Do not block on missing parent identity/memory files when the filesystem confirms they are absent.
- Do not claim parent `SOUL.md`, `USER.md`, or `MEMORY.md` was read if only the shim was read.
- Do not create replacement parent startup docs as a "fix" unless the user asks for that explicitly.
- Do not write plans or repo-level artifacts under `lyra-prototype` just because the session started there, unless the real git root or task scope points there.
- If the user pasted an `AGENTS.md` block into chat, treat it as active session instruction and still report what exists on disk.
