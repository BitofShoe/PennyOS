# Penny Release Checklist

Run before cutting a public release branch or package:

- `npm ci`
- `npm run check`
- `npm test`
- `npm run doctor`
- `npm run qa:browser:install`
- `npm run qa:browser:smoke`
- `npm run tauri:sidecar:manifest`
- `npm run tauri:sidecar:build`
- `node --test test/penny-tauri-wrapper.test.js`
- `cargo check` from `src-tauri/`
- `npm run tauri:build:check`
- `npm pack --dry-run --json`
- `npm pack --dry-run --ignore-scripts --json`
- `git diff --check`
- `node --test test/penny-installer.test.js`
- `node scripts/check-release-artifacts.js`
- `node scripts/check-frontend-privacy.js`
- `node scripts/check-public-path-leaks.js`

Source-archive simulation:

```bash
rm -rf /tmp/pennyos-source-archive
mkdir -p /tmp/pennyos-source-archive
git archive --format=tar HEAD | tar -x -C /tmp/pennyos-source-archive
cd /tmp/pennyos-source-archive
npm ci
npm run check:release
npm pack --dry-run
```

GitHub release-page checks:

- Root README presents the project as `PennyOS`, not as an internal branch note.
- README preview image renders from a tracked `public/sprites/` asset.
- `package.json` repository, homepage, bugs URL, description, and keywords point at `BitofShoe/PennyOS`.
- Historical handoffs and chat-era notes live under `docs/archive/`, not at repo root.
- `docs/README.md` labels archived, public, historical, generated, and current-law docs clearly.

Expected release properties:

- GitHub source ZIP users get root `Install-Penny.ps1` and `Install-Penny.cmd`.
- The installer checks Node 24/npm 11, creates `.env`, runs `npm ci`, and creates PennyOS shortcuts.
- default bind host is loopback
- LAN sharing requires `PENNY_LAN_SHARE=1`
- LAN API access requires a token
- workspace write tools stage pending patches unless direct-write mode is explicitly enabled
- pending workspace edits stay approval-gated in ignored local state and re-check the base file hash before applying
- web reading/search is off unless `PENNY_WEB_SEARCH_ENABLED=1`
- web fetches block private/internal targets unless explicitly allowed
- generated artifacts, local memory, local logs, private notes, and secrets are not tracked
- README, install, security, and privacy docs match the current code
- Tauri build-machine prerequisites are documented separately from installed-app requirements
- Tauri staging creates `src-tauri/gen/penny-runtime/`, `src-tauri/gen/penny-runtime-manifest.json`, and `src-tauri/binaries/penny-node-<target-triple>` while excluding live memory, `.env`, `node_modules`, logs, tmp/output/artifacts, and `src-tauri/target`
- the installed Tauri app launches Penny without Node, npm, Rust, Cargo, or a repo checkout on the end user's `PATH`
- the installed Tauri app binds `127.0.0.1`, waits for `/api/penny/status`, writes app-data logs/state, and opens the normal Penny UI
- missing LM Studio/llama.cpp/OpenAI-compatible endpoint readiness is reported honestly and is not disguised as a packaging failure

Tauri clean Windows proof:

```powershell
where.exe node
where.exe npm
where.exe cargo
where.exe rustc
Get-Command node,npm,cargo,rustc -ErrorAction SilentlyContinue
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4317/api/penny/status
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4317
```

Capture the installer path, installed executable path, `src-tauri/gen/penny-runtime-manifest.json`, app-data log path, `/api/penny/status` response, UI screenshot, and uninstall behavior.

## Latest Local Release Receipt

Date: 2026-05-18 local time / 2026-05-19 UTC.

Scope: local static/package checks plus mock-browser QA for `codex/penny-installable-local-companion-release`. This does not claim a live LM Studio model-quality pass.

Environment:

- WSL shell: Node `v24.15.0`, npm `11.12.1`.
- Windows `cmd.exe` probe: Node `v24.14.0`, npm `11.9.0`; `node scripts\check-release-engine.js` passed.
- Browser smoke: disposable/mock QA server path, not the user's live loaded LM Studio model.

Passed:

- `npm ci` - added 1 package, audited 2 packages, 0 vulnerabilities.
- `npm run check` - release checks passed; `990` tests, `987` pass, `3` todo.
- `npm pack --dry-run` - prepack checks passed; dry-run tarball reported `370` files and about `89.6 MB` packaged.
- `npm run qa:browser:install` - Playwright Chromium installed/available.
- `npm run qa:browser:smoke` - passed; artifact: `output/playwright/penny-browser-smoke-2026-05-19T01-33-50-907Z.json`.

Known local-live gap:

- `npm run doctor` passed Node/npm and local policy checks, but failed in this WSL shell because the LM Studio CLI was not on WSL `PATH` and `http://127.0.0.1:1234/v1` was not reachable from WSL. Treat that as the remaining live Windows/LM Studio setup check, not as a source/package failure.

## Latest Tauri Packaging Receipt

Date: 2026-06-09 local time / 2026-06-10 UTC. Latest follow-up receipts refreshed on 2026-06-10 UTC.

Scope: local WSL/static Tauri package checks, Windows PowerShell package-artifact smoke checks, and a hosted private GitHub Actions Windows proof for the installed NSIS package with Node/npm/Rust/Cargo removed from `PATH`. This does not claim a live LM Studio/llama.cpp/model-quality pass.

Environment:

- WSL shell target triple: `x86_64-unknown-linux-gnu`.
- Sidecar source: current Node binary copied to `src-tauri/binaries/penny-node-x86_64-unknown-linux-gnu`.
- Runtime resource: `src-tauri/gen/penny-runtime/` plus `src-tauri/gen/penny-runtime-manifest.json`.
- Windows PowerShell consumer-smoke probes deliberately stripped `PATH` to `C:\Windows\System32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0` and verified `node`, `npm`, `cargo`, and `rustc` were not discoverable before launch.
- Hosted Windows proof: private GitHub Actions run `27292397084` on `windows-latest` downloaded the existing NSIS installer asset, stripped `PATH`, verified `node`, `npm`, `cargo`, and `rustc` were not discoverable, installed PennyOS, launched the installed shortcut target, reached `/api/penny/status`, and uninstalled cleanly.
- Local Windows VM attempt: Windows Sandbox/VirtualBox/VMware were not available from the non-elevated shell. A disposable Docker/KVM Windows VM path was attempted, but the host bugchecked twice before proof could run; that VM path was abandoned and cleaned up instead of repeatedly stressing the local hypervisor stack.

Passed:

- `npm test` - 1050 tests passed in the latest follow-up run.
- `node --test test/penny-installer.test.js test/penny-tauri-wrapper.test.js test/penny-required-release-files.test.js test/penny-release-artifacts.test.js` - 23 tests passed.
- `node --test test/penny-tauri-wrapper.test.js` - 12 tests passed, including non-empty `externalBin`, runtime resources, app-data envs, consumer-smoke and clean-proof script coverage, and sidecar staging assertions.
- `npm pack --dry-run --json` - latest prepack checks passed; dry-run tarball reported 393 files, included `scripts/penny-tauri-clean-windows-proof.ps1`, and no generated sidecar/runtime leaks.
- `npm pack --dry-run --ignore-scripts --json` - latest raw dry-run tarball reported 393 files, included `scripts/penny-tauri-clean-windows-proof.ps1`, and excluded `output/`, `src-tauri/gen/`, `src-tauri/target/`, `src-tauri/binaries/`, `.env`, and live memory files.
- `npm run qa:browser:install` - Playwright Chromium installed/available.
- `npm run qa:browser:smoke` with `PENNY_SKIP_LMSTUDIO_PREP=1` - passed; artifact: `output/playwright/penny-browser-smoke-2026-06-10T17-18-24-594Z.json`; screenshot: `output/playwright/penny-browser-smoke-2026-06-10T17-18-24-594Z.png`.
- `npm run tauri:doctor` - WSL build prerequisites ready, including Rust, Tauri CLI, WebKitGTK, and `rsvg-convert`.
- `node scripts/penny-tauri-build-sidecar.js --dry-run --json --target x86_64-unknown-linux-gnu` - dry-run manifest reported 182 runtime files and excluded live memory, `.env`, `node_modules`, logs, tmp/output/artifacts, and Tauri generated build dirs.
- `npm run tauri:sidecar:build -- --target x86_64-unknown-linux-gnu` - staged `src-tauri/binaries/penny-node-x86_64-unknown-linux-gnu`, `src-tauri/gen/penny-runtime/`, and `src-tauri/gen/penny-runtime-manifest.json`.
- `cargo check --manifest-path src-tauri/Cargo.toml` - passed after sidecar staging.
- `npm run tauri:build:check` - passed `tauri build --no-bundle` and built `src-tauri/target/release/pennyos`.
- `APPIMAGE_EXTRACT_AND_RUN=1 npm run tauri:build` - passed and emitted fresh Linux `.deb`, `.rpm`, and `.AppImage` bundles; log: `output/tauri-clean-windows-proof-github-20260610-165940/tauri-build-linux-20260610-1712.log`.
- `node scripts/penny-tauri-cli.js build --bundles appimage -v` after Linux sidecar staging - built `src-tauri/target/release/bundle/appimage/PennyOS_0.1.0_amd64.AppImage`; verbose log: `output/tauri-consumer-smoke/appimage-build-20260609-214811.log`.
- `node scripts/penny-tauri-cli.js build --bundles deb rpm` - rebuilt Linux `.deb` and `.rpm` bundles under `src-tauri/target/release/bundle/`; log: `output/tauri-consumer-smoke/linux-deb-rpm-build-20260609-221123.log`.
- `dpkg-deb -c src-tauri/target/release/bundle/deb/PennyOS_0.1.0_amd64.deb` - confirmed bundled `usr/bin/penny-node`, `usr/lib/PennyOS/penny-runtime/server.js`, and seed memory resource entries.
- staged sidecar smoke - launched `src-tauri/binaries/penny-node-x86_64-unknown-linux-gnu` from `src-tauri/gen/penny-runtime/` with disposable app-data env vars, probed `/api/penny/status`, got `name: "Penny"` and `ok: true`, then confirmed the process stopped; artifact: `tmp/penny-tauri-sidecar-smoke-2026-06-10T03-52-10Z/`.
- `powershell -ExecutionPolicy Bypass -File .\scripts\penny-tauri-consumer-smoke.ps1 -Exe .\src-tauri\target\release\pennyos.exe -Port 4457` - launched the Windows release executable with Node/npm/Cargo/rustc hidden from `PATH`, started `penny-node.exe server.js`, probed `/api/penny/status`, got `name: "Penny"` and HTTP 200, and stopped the app; artifact: `output/tauri-consumer-smoke/penny-tauri-consumer-smoke-20260609-213559.json`.
- `msiexec /a src-tauri\target\release\bundle\msi\PennyOS_0.1.0_x64_en-US.msi /qn TARGETDIR=output\tauri-consumer-smoke\msi-admin-extract /L*v output\tauri-consumer-smoke\msi-admin-extract.log` - extracted the MSI into a throwaway installed-layout directory containing `pennyos.exe`, `penny-node.exe`, `penny-runtime/server.js`, and seed-only bundled memory data.
- `powershell -ExecutionPolicy Bypass -File .\scripts\penny-tauri-consumer-smoke.ps1 -Exe .\output\tauri-consumer-smoke\msi-admin-extract\PFiles\PennyOS\pennyos.exe -Port 4458` - launched the extracted MSI package copy with Node/npm/Cargo/rustc hidden from `PATH`, started the package-local `penny-node.exe server.js`, probed `/api/penny/status`, got `name: "Penny"` and HTTP 200, and stopped the app; artifact: `output/tauri-consumer-smoke/penny-tauri-consumer-smoke-20260609-214059.json`.
- `output/tauri-consumer-smoke/windows-bundles/PennyOS_0.1.0_x64-setup.exe /S /D=%LOCALAPPDATA%\Programs\PennyOSConsumerSmoke` - silently installed the NSIS package to a throwaway user-writable directory with 185 files including `pennyos.exe`, `penny-node.exe`, `penny-runtime/server.js`, and `uninstall.exe`; artifact: `output/tauri-consumer-smoke/nsis-install-smoke-20260609-225010.json`.
- `powershell -ExecutionPolicy Bypass -File .\scripts\penny-tauri-consumer-smoke.ps1 -Exe %LOCALAPPDATA%\Programs\PennyOSConsumerSmoke\pennyos.exe -Port 4459` - launched the real installed NSIS copy with Node/npm/Cargo/rustc hidden from `PATH`, started the installed `penny-node.exe server.js`, probed `/api/penny/status`, got `name: "Penny"` and HTTP 200, and stopped the app; artifact: `output/tauri-consumer-smoke/penny-tauri-consumer-smoke-20260609-225156.json`.
- installed-package state check - `%LOCALAPPDATA%\Programs\PennyOSConsumerSmoke\penny-runtime\data` remained seed-only after launch, while Tauri/WebView state appeared under `%LOCALAPPDATA%\com.bitofshoe.pennyos` and Penny app-data files were under `%APPDATA%\com.bitofshoe.pennyos\data`.
- `%LOCALAPPDATA%\Programs\PennyOSConsumerSmoke\uninstall.exe /S` - removed the throwaway install directory and Start Menu shortcut and left no `pennyos.exe` or `penny-node.exe` process running; artifact: `output/tauri-consumer-smoke/nsis-uninstall-smoke-20260609-225916.json`.
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\penny-tauri-clean-windows-proof.ps1 -Installer .\output\tauri-consumer-smoke\windows-bundles\PennyOS_0.1.0_x64-setup.exe -InstallDir "%LOCALAPPDATA%\Programs\PennyOSCleanProofHarness" -ProofDir .\output\tauri-clean-windows-proof-local -Port 4460 -AllowDevToolsOnPath -NoScreenshot` - developer-machine rehearsal passed, installed through the NSIS package, launched the Start Menu shortcut target with stripped `PATH`, reached `/api/penny/status` HTTP 200 with `name: "Penny"`, kept install-dir data seed-only, uninstalled, and left no processes; artifact: `output/tauri-clean-windows-proof-local/penny-tauri-clean-windows-proof-20260609-232807.json`. This is rehearsal only because the normal user `PATH` had development tools and the run used `-AllowDevToolsOnPath`.
- Hosted private Windows proof, GitHub Actions run `27292397084` - passed in 1m35s. The proof artifact `output/tauri-clean-windows-proof-github-20260610-165940/penny-tauri-clean-windows-proof-20260610-170415.json` shows `normalPathDevTools` and `strippedPathDevTools` all `null`, installer launch from the workflow `proof-input` directory, install dir `%LOCALAPPDATA%\Programs\PennyOSCleanProofActions`, sidecar process `%LOCALAPPDATA%\Programs\PennyOSCleanProofActions\penny-node.exe server.js`, `/api/penny/status` HTTP 200, seed-only install-dir data, writable state under `AppData`, silent uninstall exit code 0, no remaining Penny processes, and no remaining Start Menu shortcut. Server log: `output/tauri-clean-windows-proof-github-20260610-165940/penny-tauri-clean-windows-proof-20260610-170415-server.log`; run log: `output/tauri-clean-windows-proof-github-20260610-165940/github-run-27292397084.log`.
- `git diff --check` - no whitespace errors; Git warned that `Install-Penny.ps1` will be normalized from LF to CRLF on the next Git touch.
- `npm run check:public-path-leaks` - passed after the receipt was kept package/environment-relative.

Known Tauri release gaps:

- Fresh Windows `npm run tauri:build` was not rerun in this follow-up. Existing Windows MSI/NSIS artifacts were preserved under `output/tauri-consumer-smoke/windows-bundles/` and the hosted proof used the NSIS installer hash `74dbf2224914fda7a1272987d791331a0ded1e1a82944ac83ba0fe08395abeb5`.
- A bare local Windows VM screenshot proof is still not captured. The hosted Windows runner proof is stronger than developer-PC smoke because the proof process had no dev tools on `PATH`, but the runner may still have developer tools installed elsewhere on disk. The clean-room VM path was stopped after two host bugchecks.
- Live external endpoint readiness was not run in this packaging pass; LM Studio, llama.cpp, and OpenAI-compatible model endpoints remain external runtime dependencies.
- Windows installer signing/updater polish is not claimed here.
- LM Studio, llama.cpp, OpenAI-compatible servers, models, and embeddings remain external end-user/runtime dependencies.

Clean Windows VM proof recipe:

1. Copy `output/tauri-consumer-smoke/windows-bundles/PennyOS_0.1.0_x64-setup.exe` and `scripts/penny-tauri-clean-windows-proof.ps1` into a fresh Windows user/VM. Keep them side by side, or pass `-Installer` explicitly.
2. Run `powershell -ExecutionPolicy Bypass -File .\penny-tauri-clean-windows-proof.ps1`. Do not pass `-AllowDevToolsOnPath` for release proof; the script should fail if `node`, `npm`, `cargo`, or `rustc` are visible on the normal user `PATH`.
3. Keep the emitted `penny-tauri-clean-windows-proof-*.json`, server log, and screenshot. The proof should show installer exit code 0, Start Menu shortcut target, stripped-PATH launch, `/api/penny/status` HTTP 200 with `name: "Penny"`, seed-only install-dir data, app-data/config/log paths outside the install directory, silent uninstall, and no remaining `pennyos.exe`/`penny-node.exe` processes.
4. Optional developer-machine rehearsal: run the same script with `-AllowDevToolsOnPath -NoScreenshot -InstallDir "$env:LOCALAPPDATA\Programs\PennyOSCleanProofHarness"` and label the result as rehearsal only, not clean Windows proof.
5. Hosted CI fallback: a private Windows runner can provide a clean-`PATH` installed proof by downloading the NSIS installer and proof script, setting `PATH` to Windows/PowerShell directories only, verifying `node`, `npm`, `cargo`, and `rustc` are unavailable, then running the same proof script with `-NoScreenshot`. Label this as hosted clean-`PATH` proof, not as a bare VM screenshot proof.
