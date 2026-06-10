# Penny Release Decisions

Status: current release decision notes for the installable local companion branch.

These are not excuses. They are the explicit product calls for items that are real but too large or wrong-shaped to fix by surprise in this release hardening pass.

## Memory Transparency

Decision: Memory is visible by default, but the deep inspector remains an advanced/debug surface for this release.

Why:

- The default surface now separates remembered facts, thinking-about-saving suggestions, and memory connections from route artifacts, prompt receipts, archive retrieval traces, and developer diagnostics.
- PromptTruth, archive traces, tool receipts, purge buttons, and raw diagnostics stay in the collapsed Advanced diagnostics area.
- Canonical explicit memory is inspectable without `?debug=1`; memory mutation/review routes remain token-gated by default.

Acceptance criteria for further Memory polish:

- The default surface shows stable explicit facts, pending suggestions, corrections, and purge/export controls in plain language.
- Archive context and retrieval traces are clearly labeled advisory, low-confidence, or debug-only.
- PromptTruth, route artifacts, tool receipts, and raw diagnostic traces stay behind an Advanced toggle.
- Tests prove the default URL shows only safe memory content, while Advanced diagnostics exposes developer receipts.

## Desktop Installer

Decision: the final Tauri desktop package is still deferred, but the repo now carries a developer-preview Tauri shell. The release ZIP also ships a Windows installer script and the Tauri note records the wrapper boundary plus future sidecar options.

What ships now:

- `Install-Penny.ps1` for PowerShell users.
- `Install-Penny.cmd` for double-click source ZIP installs.
- The installer checks Node.js 24 and npm 11, runs `npm ci`, creates `.env`, and creates PennyOS Start/Stop/Open shortcuts.
- The generated `.env` local companion profile enables bounded aliveness features with conservative caps while preserving env opt-outs and raw server defaults.
- [penny-tauri-wrapper-options-2026-05-19.md](./penny-tauri-wrapper-options-2026-05-19.md) records the developer-preview Tauri wrapper and the future bundled-sidecar path.

Acceptance criteria for a later consumer installer:

- Local server lifecycle is owned by the wrapper.
- LAN/token posture remains visible and opt-in.
- Memory files, logs, and `.env` stay local and ignored.
- The source release still works with plain `npm start`.
- Tauri prerequisites, WebView2/system dependency posture, sidecar permissions, and sidecar lifecycle work are handled before claiming cross-platform packaging.

## Package Artifact Shape

Decision: `npm pack` is a source/dev bundle for this release, not a slim runtime bundle.

What that means:

- It intentionally includes tests, fixtures, docs, and scripts so reviewers can audit the release checks from the same artifact.
- It is still marked `private: true` so nobody accidentally treats npm publish as the distribution path.
- The GitHub source ZIP and the local `npm pack` artifact are installable developer/source artifacts, not a polished consumer installer.
- The correct public language is source-available technical preview, local/private runtime, and not intended for public internet exposure.
- The local brain language should say LM Studio default and llama.cpp/OpenAI-compatible endpoint supported; historical `PENNY_LMSTUDIO_*` names are compatibility names for the configured local endpoint.

Acceptance criteria for a later runtime bundle:

- Include runtime code, installer/start/stop helpers, core docs, sprites, seed data, security/privacy docs, and `.env.example`.
- Exclude test suites, eval fixtures, historical docs, generated QA output, and developer-only review scaffolding unless explicitly requested.
- Keep the source/dev bundle available for public review, because Penny's whole "receipts, babe" thing gets very awkward if we hide the receipts.

## Pending Workspace Writes

Decision: pending workspace writes now persist only in ignored local state for approval continuity.

Why: this keeps proposed edits local and approval-gated without losing the queue on a restart.

Persistence criteria:

- Store pending edits only in an ignored local file.
- Include base file hash, creation time, TTL, exact path, and patch/content.
- Approval must re-check the current file hash before applying.

## Known Memory QA Risk

Decision: do not claim all memory behavior is solved by this release cleanup.

Known local evidence from the handoff says semantic archive QA passed, while a mixed correction-drift hard case still needs follow-up. This branch should claim release packaging and security hardening, not perfect memory quality.

## Web Fetch SSRF Follow-Up

Decision: current web URL safety is acceptable for this release only because web reading stays opt-in and off by default.

What ships now:

- Web reading/search requires `PENNY_WEB_SEARCH_ENABLED=1`.
- Private, loopback, link-local, multicast, reserved, and metadata-style targets are blocked by hostname/IP checks and DNS resolution before fetch.
- Redirects are revalidated through the same URL safety path.

Known remaining hardening work:

- Close the DNS rebinding time-of-check/time-of-use gap before web reading becomes more prominent or default-on.
- Prefer a fetch path that connects to a verified resolved address, preserves Host/SNI correctly, revalidates every redirect, and rejects private final socket addresses.
