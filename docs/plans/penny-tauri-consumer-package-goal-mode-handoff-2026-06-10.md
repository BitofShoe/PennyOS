# PennyOS Tauri Consumer Package Goal-Mode Handoff

> Category: Goal-mode implementation handoff
> Authority: Future implementation plan, not proof of shipped behavior
> Status: Draft for new goal-mode thread
> Date: 2026-06-10

## Goal and success criteria

Goal: turn the current PennyOS Tauri developer preview into a real Windows-first consumer package where the installed app launches Penny without requiring the end user to install Rust, Cargo, Node, npm, or a repo checkout.

Done means:

- A built Tauri installer/app launches Penny from the Start Menu or app executable on a clean Windows user/VM.
- The installed app starts Penny's local server/runtime through a bundled sidecar path, binds to `127.0.0.1`, waits for `/api/penny/status`, and opens the normal Penny UI.
- End users do not need Rust/Cargo/Node/npm. Those remain build-machine prerequisites only.
- Penny still uses an external local model endpoint for the first package slice. Existing LM Studio, llama.cpp, or OpenAI-compatible endpoints are configured, detected, and reported honestly, not bundled or managed.
- Writable state goes to an app-data location, not the installed read-only resource directory.
- Docs stop calling the consumer package a developer preview once the acceptance gates pass, while still preserving honest source/dev setup instructions.

## Locked decisions

- Keep Penny local, single-user, loopback-first, companion-first.
- Do not bundle, download, load, unload, or quality-test model weights in this packaging slice.
- Do not auto-start, stop, unload, reload, or swap the user's LM Studio or llama.cpp model state.
- Keep `PENNY_SKIP_LMSTUDIO_PREP=1` as the Tauri default unless the user explicitly widens scope.
- Keep LAN off by default and keep token/security posture visible.
- Use one primary editor for implementation. Subagents are for read-only exploration, QA mapping, docs mapping, and independent review unless explicitly assigned a non-overlapping file boundary.
- Treat current dirty worktree changes as user/prior-agent work. Do not revert unrelated changes.

## Current state receipts

The current Tauri wrapper is not yet a consumer package:

- `src-tauri/tauri.conf.json` has bundling active but `bundle.externalBin` is empty.
- `src-tauri/src/main.rs` discovers a checkout, finds `server.js`, chooses `node.exe` or `node`, and runs `node server.js`.
- The Rust wrapper already has useful lifecycle pieces: status probing, readiness wait, child log capture, and child cleanup on app exit.
- `README.md`, `INSTALL.md`, and `docs/penny-tauri-wrapper-options-2026-05-19.md` say the wrapper still expects Node/npm and Tauri/Rust/platform prerequisites and does not bundle Node, LM Studio, llama.cpp, or models.
- `test/penny-tauri-wrapper.test.js` currently asserts `externalBin` is empty and checks the developer-preview launcher behavior. Those tests must change when the package becomes real.
- `scripts/penny-tauri-prereq-check.js` currently checks build/dev prerequisites. It should distinguish build-machine requirements from end-user runtime requirements.

Official docs to re-check before implementation:

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri sidecars: https://v2.tauri.app/develop/sidecar/
- Tauri distribution: https://v2.tauri.app/distribute/
- Node single executable apps, if considering SEA later: https://nodejs.org/api/single-executable-applications.html

## Required skills and repo instructions

At the start of the goal-mode thread:

1. Read `AGENTS.md`, then the repo read order it names: `SOUL.md`, `USER.md`, `README.md`, `CODEBASE.md`, `ARCHITECTURE.md`, and `MEMORY.md` for direct human chat.
2. Read `.codex/skills/README.md`.
3. Use `penny-qa-release` for release QA order, runtime truth labeling, and avoiding LM Studio/llama.cpp state mistakes.
4. Use `penny-lmstudio-ops` only if runtime endpoint readiness needs diagnosis. Do not manage live model state unless the user explicitly opts in.
5. Use `superpowers:using-git-worktrees` if creating an isolated implementation worktree or branch.
6. Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to execute the plan task-by-task.
7. Use `superpowers:systematic-debugging` when builds/tests fail.
8. Use `superpowers:verification-before-completion` before claiming the consumer package works.
9. Use official external docs only for version-sensitive Tauri/Node details. Keep queries stripped of secrets, private source, Penny memory contents, and personal data.

## Delegation map

Coordinator/editor:

- Owns final architecture choices, applies patches, keeps file boundaries coherent, and consolidates subagent findings before editing.

Subagent A: Tauri launch and sidecar shape, read-only first.

- Inspect `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, Tauri sidecar docs, and current tests.
- Output exact file/line receipts and recommend whether to use Rust `std::process::Command` against resolved resources or Tauri shell sidecar APIs.

Subagent B: Server/runtime packaging, read-only first.

- Inspect `server.js`, `lib/`, `public/`, `data` usage, env vars, asset path assumptions, and package `files`.
- Identify read-only resource paths versus writable app-data paths.
- Compare first-pass portable Node sidecar versus Node SEA. Mark SEA as optional/later unless it is clearly safer.

Subagent C: QA and clean-machine gate, read-only first.

- Convert this handoff into a runnable QA ladder for WSL/static, Windows/PowerShell, and clean Windows VM.
- Identify required screenshots, logs, bundle artifacts, and proof that Node/Rust/Cargo are absent on the consumer machine.

Subagent D: Docs and release truth, read-only first.

- Map every doc that says "developer preview," "requires Node," "requires Rust," "does not bundle Node/server," or describes installer expectations.
- Propose exact docs to update after code works.

Closeout rule for every subagent:

- Results must include local line refs, command receipts, artifact paths, source URLs, or an explicit "advisory only" label.
- Subagent agreement is not proof. Code, tests, build output, clean-machine logs, and screenshots outrank prose.

## Recommended architecture

Implement the first consumer package as a bundled server/runtime sidecar, not a full server rewrite and not model bundling.

Preferred first pass:

- Bundle a platform-specific executable sidecar for Penny's server launcher.
- Bundle the Penny server/app resource tree needed by that launcher.
- Keep the existing Node server code as intact as possible.
- In production/package mode, Tauri launches the bundled sidecar/resources.
- In development mode, keep a fallback that can still run `node server.js` from the checkout.

Two viable sidecar shapes:

1. Portable Node sidecar plus resource tree, recommended first.
   - Tauri `externalBin` includes a renamed/platform-suffixed Node executable or small Penny launcher.
   - Tauri resources include the server JS, `lib/`, `public/`, package runtime files, and other read-only assets.
   - Rust starts the sidecar with `PORT`, `HOST`, `PENNY_HOST`, `PENNY_TAURI=1`, `PENNY_SKIP_LMSTUDIO_PREP=1`, and app-data path env vars.
   - Pros: least behavior risk, preserves current server, easier to debug.
   - Cons: larger bundle; must manage resource paths carefully.

2. Node SEA or compiled server executable, optional later.
   - Build `server.js` and its dependencies into a single executable sidecar.
   - Pros: cleaner bundle shape.
   - Cons: Node SEA has module/filesystem/native-addon constraints and will likely require a bundling pass before it behaves like the current app.

Avoid for this slice:

- Rewriting the server in Rust/Tauri commands.
- Bundling llama.cpp, LM Studio, models, embedding weights, or model-manager behavior.
- Changing Penny's personality, memory authority, PromptTruth, or sidecar review-only policies as part of packaging.

## Implementation phases

### Phase 0: Baseline and branch hygiene

- Confirm repo root with `git rev-parse --show-toplevel`.
- Capture `git status --short` before edits.
- Do not revert unrelated dirty files.
- Run cheap static tests if the environment is ready:

```bash
npm test
node --test test/penny-tauri-wrapper.test.js
npm pack --dry-run --json
```

- Label checks as `local/static`, `local/live`, `Windows/PowerShell`, or `not run`.

### Phase 1: Decide exact sidecar resource model

Read and map:

- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml`
- `server.js`
- `package.json`
- `.npmignore`
- `scripts/penny-tauri-*.js`
- `test/penny-tauri-wrapper.test.js`

Decide:

- Sidecar binary name, target suffix handling, and generated output directory.
- Resource directory for bundled Penny server assets.
- App-data directory env var names and migration behavior.
- Whether production launch uses Tauri shell sidecar API or resolved resource path plus Rust process spawning.

Acceptance:

- A short design note exists in the implementation thread before code changes.
- The chosen approach can be tested without touching live model state.

### Phase 2: Add sidecar build owner

Likely create:

- `scripts/penny-tauri-build-sidecar.js`

Responsibilities:

- Stage a generated runtime tree, likely under `src-tauri/gen/penny-runtime/`.
- Copy only needed server/runtime files.
- Exclude generated/private artifacts, test pollution, `data`, logs, `.env`, `src-tauri/target`, and `src-tauri/gen` from source packages unless explicitly needed as build output.
- Place the target-specific executable sidecar under `src-tauri/binaries/` or another Tauri-supported generated binary path.
- Fail loudly if the target binary or required runtime files are missing.
- Provide a dry-run or manifest mode that tests can inspect without building a full installer.

Update:

- `package.json` scripts, for example `tauri:sidecar:build`, `tauri:build`, and `tauri:build:check` as needed.
- `package.json` `files` if new source scripts/docs must ship in source package.
- `.npmignore` if generated artifacts need explicit exclusion.

### Phase 3: Update Tauri config and Rust launch path

Modify:

- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/Cargo.toml` only if the chosen sidecar API requires a new dependency/plugin.

Requirements:

- `bundle.externalBin` is no longer empty once the sidecar exists.
- Add bundled resources if the runtime tree is resource-based.
- Production launch prefers the bundled sidecar.
- Dev launch still supports checkout-based `node server.js` for local development.
- Existing env contract remains: `PORT`, `HOST`, `PENNY_HOST`, `PENNY_TAURI`, `PENNY_SKIP_LMSTUDIO_PREP`.
- Add app-data env vars for logs, memory, archive memory, config, and other writable files if the current server needs them.
- Startup failures should surface in the loading window and write logs to an inspectable path.
- Cleanup should kill only the child process Penny started.

### Phase 4: Fix writable-path assumptions

Audit server/runtime writes:

- Explicit memory file.
- Archive memory file.
- Embedding/cache files.
- Logs.
- `.env` or first-run config.
- Browser smoke/disposable artifacts.

Requirements:

- Installed app resources are treated as read-only.
- App data is the default writable location for packaged Tauri mode.
- Source/dev mode keeps current repo-local behavior unless the user explicitly approves migration.
- Existing `data/penny-memory.json` remains canonical for source/dev installs.

### Phase 5: Tests

Update or add tests so current false assumptions fail:

- `test/penny-tauri-wrapper.test.js` should no longer assert empty `externalBin` for the consumer package.
- Add tests for sidecar config, resource config, production-vs-dev launch contract, and `PENNY_SKIP_LMSTUDIO_PREP=1`.
- Add tests for build-script manifest/dry-run behavior.
- Add tests that generated/private artifacts do not leak into source package outputs.
- Add a test or QA script proving docs distinguish build-machine prerequisites from end-user runtime prerequisites.

Possible new script:

- `scripts/qa-penny-tauri-consumer-smoke.js`

Purpose:

- Launch the built sidecar/server in a disposable app-data directory.
- Probe `http://127.0.0.1:<port>/api/penny/status`.
- Use a mock OpenAI-compatible endpoint if chat readiness is needed.
- Avoid live LM Studio/llama.cpp model management.

### Phase 6: Build and clean-machine QA

Static/source release gate:

```bash
npm ci
npm run check
node --test test/penny-installer.test.js test/penny-tauri-wrapper.test.js test/penny-required-release-files.test.js test/penny-release-artifacts.test.js
npm pack --dry-run --json
npm pack --dry-run --ignore-scripts --json
git diff --check
```

Mock browser smoke:

```bash
npm run qa:browser:install
npm run qa:browser:smoke
```

Tauri build gate:

```powershell
npm run tauri:doctor:windows
npm run tauri:build
Get-ChildItem -Recurse .\src-tauri\target\release\bundle | Select-Object FullName,Length
```

Clean Windows VM gate:

- Install the produced Tauri artifact.
- Confirm `node`, `npm`, `cargo`, and `rustc` are not installed or not on `PATH`.
- Launch PennyOS from Start Menu/app executable.
- Confirm native window reaches the Penny UI.
- Probe `http://127.0.0.1:4317/api/penny/status`.
- Capture server logs, Tauri logs, screenshot, and installer/bundle path.
- Confirm first-run model readiness is honest if no endpoint is available.
- Confirm uninstall removes app files and does not delete user app-data unless the installer explicitly offers that choice.

### Phase 7: Docs and release truth

Update after code works:

- `README.md`
- `INSTALL.md`
- `CODEBASE.md`
- `ARCHITECTURE.md`
- `docs/penny-tauri-wrapper-options-2026-05-19.md` or a successor doc
- `docs/release-checklist.md`
- Any tests/docs that mention Tauri still requiring Node/Rust for end users

Docs must distinguish:

- Source/dev setup: Node/npm and build prerequisites may still apply.
- Build machine: Rust/Cargo/Tauri/platform deps required.
- Consumer install: Rust/Cargo/Node/npm not required.
- Model runtime: external LM Studio/llama.cpp/OpenAI-compatible endpoint still required for full chat quality, but the app should launch and explain readiness without crashing.

## Verification rules

- Do not claim clean-machine success without a clean Windows VM or equivalent user account proof.
- Do not infer Windows runtime truth from WSL loopback alone.
- Do not treat a missing local model endpoint as packaging failure if Penny launches and reports readiness honestly.
- Do not call the package consumer-ready if Node/npm/Rust/Cargo remain required on the installed machine.
- Do not run heavy model QA in parallel with packaging QA.
- Clean disposable QA-generated memory, archive memory, embedding files, browser artifacts, and mock endpoint artifacts unless intentionally preserved as receipts.

## Out of scope

- Bundling llama.cpp.
- Bundling LM Studio.
- Bundling or downloading model weights.
- Model quality evaluation.
- LAN/phone packaging acceptance.
- Multi-user/cloud deployment.
- PromptTruth, memory authority, runtime voice, or sidecar-output ingestion changes.
- Cosmetic UI redesign unrelated to first-run/package readiness.

## Final handoff expectations

The implementation thread should close with:

- Files changed.
- Commands/tests run, labeled by environment.
- Bundle/installer artifact paths.
- Clean-machine proof and screenshots/log paths, or `not run` with a clear blocker.
- Exact statement of whether end users still need Node/npm/Rust/Cargo.
- Exact statement of what remains external: LM Studio, llama.cpp, model weights, embeddings.
- Cleanup performed.
- Known follow-up tasks, especially signing/notarization/updater work if not completed.
