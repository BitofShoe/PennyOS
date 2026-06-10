# Penny Tauri Wrapper Options

Status: historical / partially superseded by the June 10 consumer-package slice. `src-tauri/` now stages a bundled `penny-node` sidecar plus `penny-runtime` resources, launches Penny on loopback, waits for the real status route, and then navigates to the normal Penny UI. This doc remains useful for the original decision record, but its "sidecar later" language is no longer current law. It is still true that Penny does not bundle LM Studio, llama.cpp, models, embeddings, a tray app, updater, or signed consumer release proof in this slice.

## Decision

Use Tauri as the Windows-first desktop package path with a bundled Penny Node sidecar/runtime. Remaining later work is tray/lifecycle polish, installer signing, updater policy, and clean Windows consumer proof.

## Current Release Boundary

- Penny stays a source-available technical preview.
- The current app remains a local/private Node server plus browser UI, with an optional Tauri desktop package path.
- The Windows PowerShell source installer remains the source ZIP install helper; Tauri installers are the desktop-package path.
- macOS/Linux users can still use `npm start`; Tauri build/dev additionally requires Rust and platform WebView/build dependencies.
- This branch bundles Node/Penny server runtime for Tauri packages, but does not bundle LM Studio, llama.cpp, models, or embeddings.

## Official Tauri Notes

The official Tauri v2 prerequisites page says desktop development needs system dependencies plus Rust. On Windows, Tauri development uses Microsoft C++ Build Tools and Microsoft Edge WebView2; WebView2 is already installed on modern Windows 10+ in many cases, but the runtime is still part of the platform assumption. On Linux, Tauri needs WebKitGTK and related build packages. On macOS, Xcode or Command Line Tools are part of the development setup.

Source: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

The official sidecar docs describe bundling external executables through `tauri.conf.json` `externalBin`, with per-target binary naming and explicit shell permissions before a sidecar can be executed or spawned. Penny now uses that model for the first-pass `penny-node` sidecar; the build still has to produce platform-specific binaries, permission scopes, lifecycle handling, stdout/stderr capture, port readiness, shutdown behavior, and update semantics.

Source: [Tauri sidecars / embedding external binaries](https://v2.tauri.app/develop/sidecar/).

## Penny-Specific Fit

Current shape and remaining fit:

- Tauri owns the desktop window and local URL loading now.
- Penny's Node server remains an internal local service bound to `127.0.0.1` by the wrapper.
- The wrapper sets `PENNY_SKIP_LMSTUDIO_PREP=1` by default so desktop startup does not disturb loaded LM Studio or llama.cpp model state.
- The wrapper shows first-run local brain readiness: endpoint reachable, model loaded, embeddings available/fallback, memory writable, LAN off, web reading off.
- The wrapper preserves current `.env` / ignored data boundaries until a migration plan exists.

Resolved / remaining decisions:

- Node is bundled as the first-pass `penny-node` sidecar; Node SEA remains optional/later, not the default first move.
- How to handle LM Studio versus llama.cpp without pretending either is bundled.
- How to sign/notarize installers and handle updates.
- How to keep LAN/token/security posture visible instead of hiding it behind a native shell.

Non-goals for this slice:

- No signed/updating public release claim until clean Windows proof is captured.
- No model/runtime bundling.
- No change to the source/dev bundle shape.

## Current Package Path

Run:

```bash
npm run tauri:doctor
npm run tauri:sidecar:manifest
npm run tauri:build:check
npm run tauri:build
```

On Windows, prefer:

```powershell
npm run tauri:doctor:windows
npm run tauri:build
npm run tauri:dev:windows
```

Configuration:

- `src-tauri/tauri.conf.json` embeds `src-tauri/loading/index.html` as the startup page, maps `gen/penny-runtime/` to `penny-runtime/`, and declares `externalBin: ["binaries/penny-node"]`.
- `src-tauri/src/main.rs` starts the bundled `penny-node` sidecar against bundled `penny-runtime/server.js` in packaged mode, probes `GET /api/penny/status`, and navigates the main window to `http://127.0.0.1:4317/` when Penny is ready. Debug/source runs can still fall back to `node server.js`.
- `src-tauri/src/main.rs` writes child server output to app-data logs, or to `PENNY_TAURI_LOG` when set, so startup failures are inspectable.
- `PENNY_TAURI_PORT`, `PENNY_TAURI_NODE`, `PENNY_TAURI_SERVER_ROOT`, `PENNY_TAURI_READY_TIMEOUT_MS`, `PENNY_TAURI_LOG`, `PENNY_TAURI_FORCE_SIDECAR`, `PENNY_TAURI_FORCE_DEV_NODE`, and `PENNY_TAURI_ALLOW_DEV_FALLBACK` are supported for local development and diagnosis.
- The wrapper only kills the child server process it started; if another Penny server was already running on the port, it leaves that process alone.
- `start-penny-tauri.ps1` is the Windows PowerShell helper for checking Node, npm, Rust/Cargo, WebView2 posture, and launching `tauri dev` with `PENNY_SKIP_LMSTUDIO_PREP=1`.
- `scripts/penny-tauri-cli.js` runs the local Tauri CLI through Node and refreshes the Rust cargo path so Windows/WSL launches do not depend on brittle shell shims.
- `npm run tauri:repair:native:shared` restores both WSL x64 and Windows x64 Tauri native CLI packages after a cross-OS `npm install` flips the optional dependency set.

Verification:

- `node --test test/penny-tauri-wrapper.test.js` checks the scaffold, package scripts, local splash, sidecar staging manifest, app-data env contract, and server-launch contract.
- `npm run tauri:doctor` checks local Rust/Tauri/WebView prerequisites without trying to start Penny.
- `npm run tauri:build:check` compiles the Tauri shell with `tauri build --no-bundle`.
- `npm run tauri:info` checks local Tauri prerequisites. On machines without Rust or Linux WebKitGTK dependencies, this can report missing prerequisites while still confirming the app config shape.
