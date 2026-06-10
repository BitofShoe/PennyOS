# Penny Tauri Consumer Package Reference

Load this only when actively packaging, testing, or writing handoff docs.

## Main Commands

```bash
git rev-parse --show-toplevel
node --test test/penny-tauri-wrapper.test.js
npm test
npm run check:public-path-leaks
npm pack --dry-run --json
npm pack --dry-run --ignore-scripts --json
npm run tauri:sidecar:manifest
npm run tauri:sidecar:build
npm run tauri:build:check
APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri:build
PENNY_SKIP_LMSTUDIO_PREP=1 npm run qa:browser:smoke
git diff --check
git status --short
```

Windows package smoke/proof:

```powershell
npm run tauri:doctor:windows
npm run tauri:build
npm run tauri:consumer-smoke:windows
npm run tauri:clean-proof:windows
```

Manual clean proof:

```powershell
powershell -ExecutionPolicy Bypass -File .\penny-tauri-clean-windows-proof.ps1 `
  -Installer .\PennyOS_0.1.0_x64-setup.exe
```

Developer-machine rehearsal only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\penny-tauri-clean-windows-proof.ps1 `
  -Installer .\output\tauri-consumer-smoke\windows-bundles\PennyOS_0.1.0_x64-setup.exe `
  -InstallDir "$env:LOCALAPPDATA\Programs\PennyOSCleanProofHarness" `
  -ProofDir .\output\tauri-clean-windows-proof-local `
  -Port 4460 `
  -AllowDevToolsOnPath `
  -NoScreenshot
```

## Hosted Clean-PATH Proof Pattern

Use only in a private repo/runner context.

1. Upload the already-built NSIS installer and `scripts/penny-tauri-clean-windows-proof.ps1` to a temporary private release or other private artifact store.
2. Push a temporary workflow branch that runs on `windows-latest`.
3. In the workflow, set `PATH` to Windows/PowerShell directories only and verify `Get-Command node,npm,cargo,rustc` returns nothing.
4. Run the clean proof script with `-NoScreenshot`, explicit `-Installer`, and a throwaway install dir.
5. Upload proof JSON/log artifacts.
6. Delete temporary release/tag/branch and keep only local proof receipts.

Label this "hosted clean-PATH proof," not a bare clean-VM screenshot proof.

## Proof Fields To Inspect

The clean proof JSON should show:

- `verdict: "passed"`
- `normalPathDevTools` and/or `strippedPathDevTools` have `node`, `npm`, `cargo`, and `rustc` absent
- installer exit code `0`
- shortcut target or package exe exists
- launch uses installed package path, not repo checkout
- `launch.ready: true`
- `launch.statusCode: 200`
- `sidecarProcesses` includes `penny-node.exe ... server.js`
- install-dir `penny-runtime\data` remains seed-only
- app-data files appear under the Tauri app-data/config locations
- uninstall exit code `0`
- install dir and Start Menu shortcut removed
- no `pennyos.exe` or `penny-node.exe` processes remain

## State Separation

Packaged Penny should write to:

- `%APPDATA%\com.bitofshoe.pennyos\data` for Penny memory/config-style app data on Windows
- `%LOCALAPPDATA%\com.bitofshoe.pennyos` for WebView/local app state on Windows

Source/dev Penny usually writes to repo-local `data/` unless env overrides point elsewhere.

Memory overlap risk is low if the packaged app keeps Tauri app-data env vars. Port overlap risk remains: do not run source/dev Penny and packaged Penny on the same `4317` port at once.

## Installer/Bundles To Mention

Common artifacts:

- `output/tauri-consumer-smoke/windows-bundles/PennyOS_0.1.0_x64-setup.exe`
- `output/tauri-consumer-smoke/windows-bundles/PennyOS_0.1.0_x64_en-US.msi`
- `src-tauri/target/release/bundle/appimage/PennyOS_0.1.0_amd64.AppImage`
- `src-tauri/target/release/bundle/deb/PennyOS_0.1.0_amd64.deb`
- `src-tauri/target/release/bundle/rpm/PennyOS-0.1.0-1.x86_64.rpm`

## Docs Truth

Be explicit:

- source/dev install still needs Node/npm and a checkout
- built Tauri package should not need Node/npm/Rust/Cargo/repo checkout on end-user `PATH`
- package does not bundle LM Studio, llama.cpp, OpenAI-compatible servers, embeddings, or models
- model-backed chat still needs an already-running endpoint
- the package should report endpoint readiness honestly and preserve model state
- Windows signing/updater polish is a separate release gate unless already implemented and verified

## Useful Source URLs

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri sidecars: https://v2.tauri.app/develop/sidecar/
- Tauri distribution: https://v2.tauri.app/distribute/
- Node SEA, optional later only: https://nodejs.org/api/single-executable-applications.html
