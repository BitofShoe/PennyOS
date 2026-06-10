---
name: penny-tauri-consumer-package
description: Use when working on PennyOS Tauri packaging, bundled sidecar/runtime launch, Windows installer proof, clean PATH consumer checks, AppImage/linuxdeploy failures, app-data state isolation, or docs that describe whether the desktop package needs Node/npm/Rust/Cargo.
allowed-tools:
  - functions.shell_command
  - functions.read_thread_terminal
---

# Penny Tauri Consumer Package

Use this skill for PennyOS desktop packaging work, not for generic Tauri apps.

Expected environments: Windows, WSL, or Linux build shells; PowerShell or bash; Node `>=24 <25`; npm `>=11 <12`.

## Core Rule

The consumer package must launch Penny without end-user Node, npm, Rust, Cargo, or a repo checkout. Build-machine prerequisites are fine. End-user prerequisites are not.

Keep the model/runtime scope tight: do not bundle LM Studio, llama.cpp, models, embeddings, or model-manager behavior. Keep `PENNY_SKIP_LMSTUDIO_PREP=1` as the Tauri default and preserve the user's live model state unless explicitly told otherwise.

## First Moves

1. Verify the real git root; if starting inside `lyra-prototype`, confirm whether the actual root is the parent checkout.
2. Read repo instructions, then use `penny-qa-release`. Use `penny-lmstudio-ops` only for endpoint readiness diagnosis, not model management.
3. Inspect current truth before editing: `README.md`, `INSTALL.md`, `docs/release-checklist.md`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `scripts/penny-tauri-build-sidecar.js`, `scripts/penny-tauri-consumer-smoke.ps1`, `scripts/penny-tauri-clean-windows-proof.ps1`, and `test/penny-tauri-wrapper.test.js`.
4. Preserve dirty worktree changes you did not make. Keep one primary editor for overlapping packaging files.

## Architecture Bias

Prefer the current first-pass architecture:

- portable `penny-node` sidecar staged under `src-tauri/binaries/`
- generated runtime resource tree under `src-tauri/gen/penny-runtime/`
- non-empty Tauri `bundle.externalBin`
- packaged Rust path starts the bundled sidecar, binds Penny to `127.0.0.1`, waits for `/api/penny/status`, then opens the normal UI
- development fallback may use checkout `node server.js`
- writable state goes to app-data/config/log paths via `PENNY_DATA_DIR`, `PENNY_CONFIG_DIR`, `PENNY_ENV_FILE`, `PENNY_MEMORY_*`, `PENNY_OPEN_LOOP_FILE`, `PENNY_PENDING_WORKSPACE_WRITES_FILE`, `PENNY_STATIC_EMBED_CACHE_FILE`, `PENNY_LOCAL_MODEL_PREFERENCE_FILE`, and `PENNY_TAURI_LOG`

Treat Node SEA, Rust server rewrites, bundled model runtimes, or broad first-run model management as later/explicitly approved work.

## Verification Ladder

Run the cheapest check that proves the claim, then escalate:

- focused tests: `node --test test/penny-tauri-wrapper.test.js`
- broad tests: `npm test`
- source package checks: `npm pack --dry-run --json` and `npm pack --dry-run --ignore-scripts --json`
- sidecar manifest/build: `npm run tauri:sidecar:manifest`, `npm run tauri:sidecar:build`
- Rust/Tauri build check: `npm run tauri:build:check`
- browser smoke with model prep skipped: `PENNY_SKIP_LMSTUDIO_PREP=1 npm run qa:browser:smoke`
- Windows consumer smoke: `npm run tauri:consumer-smoke:windows`
- clean installed proof: `npm run tauri:clean-proof:windows` on a clean user/VM, or a clearly labeled hosted clean-`PATH` Windows proof
- final sanity: `npm run check:public-path-leaks`, `git diff --check`, `git status --short`

For command details and fallback recipes, load [REFERENCE.md](./references/REFERENCE.md).

## Known Traps

- WSL `127.0.0.1` is not proof that Windows LM Studio/llama.cpp is down. Verify live endpoint truth from Windows when needed.
- Local Windows VM proof can stress Hyper-V/KVM/Docker paths. If the host bugchecks or resets, stop that route and use hosted clean-`PATH` proof or a manual clean VM.
- `linuxdeploy`/AppImage failures in WSL can be FUSE/runtime extraction issues. Try `APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri:build` before treating AppImage packaging as broken.
- `npm pack --dry-run --json` can include lifecycle stdout before the JSON. Capture raw output and parse the final JSON array when needed.
- Public docs must not include local user paths from Windows runners or build trees. Use package/environment-relative wording.
- Do not run the source/dev Penny server and packaged Penny on the same port at the same time.

## Reporting

Final reports should include:

- files changed
- tests and commands run, with pass/fail/not-run labels
- installer/bundle paths
- proof JSON/log/screenshot paths
- cleanup performed, including temporary branches/releases/VM/container scratch
- exact remaining external dependencies: Windows WebView2 and an already-running LM Studio/llama.cpp/OpenAI-compatible endpoint for model-backed chat

Do not claim "clean Windows proof" unless the proof shows dev tools absent from normal or sanitized `PATH`, installed shortcut/exe launch, `/api/penny/status` HTTP 200, app-data writes outside install dir, clean uninstall, and no leftover Penny processes.

## Reference

- [REFERENCE.md](./references/REFERENCE.md)
