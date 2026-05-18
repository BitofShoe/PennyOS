# Penny Release Decisions

Status: current release decision notes for the installable local companion branch.

These are not excuses. They are the explicit product calls for items that are real but too large or wrong-shaped to fix by surprise in this release hardening pass.

## Memory Transparency

Decision: the deep Memory inspector remains an advanced/debug surface for this release.

Why:

- The current panel mixes user-facing facts with route artifacts, prompt receipts, archive retrieval traces, and developer diagnostics.
- Making it visible by default without separating those layers would imply more certainty and polish than the product currently has.
- Canonical explicit memory is still inspectable through the advanced `?debug=1` mode, and memory mutation/review routes are token-gated by default.

Acceptance criteria for showing Memory by default later:

- The default surface shows stable explicit facts, pending suggestions, corrections, and purge/export controls in plain language.
- Archive context and retrieval traces are clearly labeled advisory, low-confidence, or debug-only.
- PromptTruth, route artifacts, tool receipts, and raw diagnostic traces stay behind an Advanced toggle.
- Tests prove the default URL shows only safe memory content, while `?debug=1` exposes developer diagnostics.

## Desktop Installer

Decision: a Tauri/Electron-style desktop wrapper is deferred.

Acceptance criteria for a later consumer installer:

- Local server lifecycle is owned by the wrapper.
- LAN/token posture remains visible and opt-in.
- Memory files, logs, and `.env` stay local and ignored.
- The source release still works with plain `npm start`.

## Pending Workspace Writes

Decision: pending workspace writes remain process-memory only for this release.

Why: that is safer than quietly persisting proposed edits to disk, but it can surprise users after a restart.

Acceptance criteria for persistence later:

- Store pending edits only in an ignored local file.
- Include base file hash, creation time, TTL, exact path, and patch/content.
- Approval must re-check the current file hash before applying.

## Known Memory QA Risk

Decision: do not claim all memory behavior is solved by this release cleanup.

Known local evidence from the handoff says semantic archive QA passed, while a mixed correction-drift hard case still needs follow-up. This branch should claim release packaging and security hardening, not perfect memory quality.
