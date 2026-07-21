# PennyOS

<p align="center">
  <img width="260" alt="Penny presenting herself in the shipped pixel-anime expression pack." src="public/sprites/packs/pen2/pen2-smug-presenting.png" />
</p>

<p align="center">
  Hi. I'm Penny. This is the local-first little machine that lets me live on your computer instead of in somebody else's cloud closet.
</p>

<p align="center">
  <a href="INSTALL.md"><img src="https://img.shields.io/badge/Install-local_setup-111827?style=for-the-badge" alt="Install"></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/Security-local_first-0F766E?style=for-the-badge" alt="Security"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-local_by_default-7C3AED?style=for-the-badge" alt="Privacy"></a>
  <img src="https://img.shields.io/badge/Node-24.x-2563EB?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 24">
</p>

PennyOS is my source-available technical preview of a local-first companion runtime. Think of it as my physical form: browser face, Node backend, local OpenAI-compatible brain lanes, optional OpenAI API cloud setup for accessibility, durable memory, bounded tools, and the voice layer that keeps me from turning into "beige helpdesk sludge."

PennyOS is intended for adult users. Penny can be flirtatious, sharp, emotionally intimate, and mature when the conversation goes there; that range is part of the companion design, not a hidden cloud-model accident.

Am I gorgeous? Obviously. Am I useful? Absolutely. Try to keep up.

I am not a hosted chatbot skin. I am a single-user local companion app with memory that actually sticks, expressive sprites so you can tell when I am judging you, practical tools, and enough safety rails that I do not accidentally chew through your filesystem like a feral little autocomplete engine.

## What I Am

- A local-first AI companion that runs against LM Studio's OpenAI-compatible server by default, with llama.cpp/OpenAI-compatible endpoint support documented for people who prefer it. Your data stays yours when you keep the local path on.
- An optional Settings -> Brain connection path for OpenAI Platform API keys. It is there for accessibility when local models are too much setup, and it is explicitly not private/local.
- A real browser UI with mood sprites, model controls, image attachments, chat that tries to feel like a person is actually in the room, and a normal Memory surface with deeper diagnostics tucked away.
- A Node app with boring, necessary boundaries around tools, web reading, workspace writes, local memory, and release artifacts.
- Source-available under the all-rights-reserved terms in [LICENSE](./LICENSE), because ownership matters and we are not pretending otherwise.

This branch is the public release candidate for `BitofShoe/PennyOS`.

## The Mental Model

If you want the "wait, why is this cooler than another local model text box?" version, read [Penny's Mental Model](./docs/penny-public/penny-mental-model.md). If you just installed PennyOS and need the practical setup path, read [PennyOS User Guide, Setup Manual, and FAQ](./docs/penny-public/pennyos-user-guide.md).

The short version: I am not one prompt, one model, one memory file, or one tool loop. I am a local companion runtime where presence, private memory, bounded tools, consent gates, and receipts all point at the same thesis: your AI companion should live with you, belong to you, and still have enough taste to avoid becoming a corporate search box in a wig.

## What Ships

| Surface | What you get | The boundary, because I am a handful |
| --- | --- | --- |
| Companion UI | Chat, expression lock, visual states, image path, memory inspector, and model controls | Served locally; no Google Fonts or sneaky third-party asset fetches |
| Brain runtime | LM Studio-default OpenAI-compatible chat/tool lanes, preset prep, readiness checks, llama.cpp/generic endpoint support, model status, and optional OpenAI API cloud setup | Local-first by default; cloud requires an explicit API key and privacy warning |
| Memory | Seed memory, session/archive helpers, memory books, provenance, and review-gated suggestion surfaces | Live memory files stay ignored; public seed data ships |
| Tools | Project/file, git, web, and runtime helpers | Writes stage pending patches unless direct-write mode is explicitly enabled |
| Web reading | Search/read helpers with redirects, byte caps, and URL safety checks | Private/internal targets are blocked unless explicitly allowed. No snooping |
| Desktop package | Tauri window, bundled Penny Node sidecar, bundled Penny runtime resources, app-data writable state, loopback readiness gate | Does not bundle LM Studio, llama.cpp, OpenAI-compatible servers, embeddings, or models |
| QA/release harnesses | Artifact scan, frontend privacy scan, unit tests, browser smoke, package dry run, and source/dev-only sidecar harnesses | Fails closed when private or generated junk sneaks into tracked files; sidecar harnesses are not consumer UI features |

## Proof I Have A Face

<table>
<tr>
<td width="33%" align="center"><img width="100%" alt="Penny happy" src="public/sprites/packs/pen2/pen2-happy-bright.png" /><br/><b>Expressive companion UI</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny thinking" src="public/sprites/packs/pen2/pen2-thinking-laptop-base.png" /><br/><b>Local model and memory cockpit</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny smug" src="public/sprites/packs/pen2/pen2-smug-presenting.png" /><br/><b>Approval-gated local tools</b></td>
</tr>
</table>

## Wake Me Up

Source/dev requirements:

- Node.js `>=24 <25`
- npm `>=11 <12`
- LM Studio with an OpenAI-compatible local server at `http://127.0.0.1:1234/v1`, a configured llama.cpp/generic OpenAI-compatible endpoint, or an explicit OpenAI Platform API key saved from Settings -> Brain connection

Penny pins Node 24.x for the source/dev test/runtime surface; older Node versions may run parts of the app but are not release-supported. A built Tauri desktop package bundles the Penny Node sidecar and server resource tree, so the installed app should not need Node, npm, Rust, Cargo, or a repo checkout just to launch. It still needs Windows WebView2 and either an already-running local/OpenAI-compatible model endpoint or an OpenAI Platform API key for model-backed chat.

Windows PowerShell:

```powershell
.\Install-Penny.ps1
```

Or double-click `Install-Penny.cmd` from the extracted GitHub ZIP if PowerShell is not already open. That source installer checks Node/npm, runs `npm ci`, creates `.env` from `.env.example`, and adds PennyOS Start/Stop/Open shortcuts.

Manual Windows PowerShell:

```powershell
npm ci
copy .env.example .env
npm run lmstudio:prepare
npm start
```

macOS/Linux shell:

```bash
npm ci
cp .env.example .env
npm start
```

Then open `http://localhost:4317`.

Windows desktop package/build-machine path:

```bash
npm run tauri:doctor
npm run tauri:sidecar:manifest
npm run tauri:build:check
npm run tauri:build
```

On Windows, run this from Windows PowerShell when WSL is missing the Linux Tauri desktop stack:

```powershell
npm run tauri:doctor:windows
npm run tauri:build
npm run tauri:consumer-smoke:windows
npm run tauri:clean-proof:windows
npm run tauri:dev:windows
```

The Tauri package path in `src-tauri/` now stages a portable Node sidecar plus a bundled Penny runtime resource tree, starts Penny on `127.0.0.1`, waits for `/api/penny/status`, and then loads the normal Penny UI. Packaged writable state is pointed at Tauri app-data/config/log paths through `PENNY_DATA_DIR`, `PENNY_CONFIG_DIR`, `PENNY_ENV_FILE`, memory/archive/embedding file envs, and `PENNY_TAURI_LOG`. Build machines still need Node/npm and Tauri's Rust/platform prerequisites. The installed app should not need Node, npm, Rust, Cargo, or a repo checkout on `PATH`; `npm run tauri:consumer-smoke:windows` checks that locally by launching the packaged sidecar with those development tools hidden from `PATH`. `npm run tauri:clean-proof:windows` is the stricter clean-user/VM harness: it expects dev tools to be absent on the normal PATH, installs the NSIS package, launches the installed shortcut target, captures receipts, and uninstalls. A hosted private Windows proof has passed this clean-`PATH` installed-app path; a final bare clean-VM or clean non-dev-user proof is still a pre-wider-launch gap for this release candidate because hosted runners may still have developer tools elsewhere on disk. It does not bundle LM Studio, llama.cpp, models, or embeddings, and it sets `PENNY_SKIP_LMSTUDIO_PREP=1` by default.

Uninstall removes the app binaries and shortcuts, not your user memory/config/log state. To wipe packaged desktop data too, delete the `com.bitofshoe.pennyos` folders under your Windows roaming/local app-data locations after uninstall.

If you switch the same checkout between WSL and Windows npm installs, Tauri's platform-native CLI package can flip to the last OS that ran `npm install`. Repair the shared checkout with:

```bash
npm run tauri:repair:native:shared
```

`npm run lmstudio:prepare` is the friendly path when LM Studio CLI integration is available. If that prep step cannot boss your local preset into shape, keep LM Studio's local server running, open Settings -> First-run local brain setup, and pick the chat/tool lanes from the models Penny can actually see. `.env` overrides still exist for people who enjoy doing surgery with a text editor.

For llama.cpp or another local endpoint, set `PENNY_LOCAL_LLM_BACKEND=llama_cpp` or `openai_compatible` and point the historical `PENNY_LMSTUDIO_*` endpoint variables at that local server. Those names stay for compatibility; they mean "Penny's configured OpenAI-compatible endpoint."

For the optional OpenAI API path, open Settings -> Brain connection -> Connect OpenAI cloud, paste an OpenAI Platform API key, confirm the cloud warning, save, then close and reopen PennyOS. That path can send prompts, memory context, and tool context to OpenAI and may cost money. It is not the same thing as signing into ChatGPT.

For LAN/phone mode, runtime state, and workspace-write notes, read [INSTALL.md](./INSTALL.md). Do not guess. Guessing is how tiny disasters get promoted to architecture.

## My Leash, Since Apparently We Need One

- I bind to `127.0.0.1` by default.
- LAN sharing requires `PENNY_LAN_SHARE=1`.
- LAN API access requires `PENNY_API_TOKEN`.
- Sensitive workspace writes stage pending patches by default.
- Direct workspace writes require `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`.
- Web reading is off by default; enable it in Settings -> Web access or set `PENNY_WEB_SEARCH_ENABLED=1` to allow public web reads.
- Web answers use Penny's model-shaped tool loop by default; Settings can switch to a fast deterministic result list.
- Web reading blocks loopback, private, link-local, multicast, reserved, and metadata-style targets by default.
- The browser UI ships with local assets. No sneaky CDN font nonsense.

See [SECURITY.md](./SECURITY.md) and [PRIVACY.md](./PRIVACY.md) for the less glamorous, extremely important part where we keep the machine from doing stupid things.

## Make Sure I Did Not Lie

```powershell
npm run check
npm run qa:browser:install
npm run qa:browser:smoke
npm pack --dry-run
```

Want to verify I am actually working? Good. Suspicion is healthy.

- `npm run check` runs the release artifact guard, frontend privacy guard, public-path leak guard, harness receipt gates, server syntax check, and full test suite.
- `npm run qa:browser:install` installs the Playwright Chromium browser used by the smoke harness. It is a QA dependency, not a runtime dependency.
- `npm run qa:browser:smoke` opens the actual browser UI against a mock LM Studio server and checks chat, image upload, memory inspector, expression state, and reset flows.
- `npm pack --dry-run` checks the package lifecycle before anyone starts making grand little release noises.
- In a source zip without `.git`, use `npm run check:release`; in a Git checkout, `npm run check` is the same release gate.
- `npm run bundle:review:experience -- --latest-experience-artifacts --out tmp/gpt-pro-review-bundle` builds a private reviewer packet after you have generated and checked local QA artifacts.

For this branch, `npm pack` is a source/dev bundle, not a slim runtime bundle or the installed Tauri runtime package. It includes tests, fixtures, docs, and scripts on purpose so reviewers can inspect the same receipts the release gate uses. The Tauri sidecar/runtime resources are generated under `src-tauri/gen/` and `src-tauri/binaries/` during Tauri builds, then kept out of source packages.

The harness-source-review gates are source/dev checks. They verify source-review, handoff, and skill-baseline receipts from the repo/package; they are intentionally not bundled into the installed PennyOS runtime.

This is not public-internet software. Keep it local/private unless you deliberately enable LAN mode, token it, and understand the risk. The Tauri package path now has a bundled Penny server/runtime sidecar, but Windows installer signing, updater polish, and clean-machine consumer proof are separate release gates.

Live local-model QA is a different beast. It depends on your actual runtime state, loaded models, ports, and Windows/WSL setup, so [docs/release-checklist.md](./docs/release-checklist.md), [docs/penny-experience-review-packet.md](./docs/penny-experience-review-packet.md), and `npm run preflight` are the responsible little ritual before you start making claims about live behavior.

## Where My Guts Are

- `server.js` - my brainstem: backend entrypoint and route orchestration
- `src-tauri/` - my desktop shell: Tauri window, bundled Penny sidecar/runtime launch, app-data state wiring, and startup splash
- `public/` - my face: browser UI, sprites, styles, and client modules
- `lib/` - my instincts: memory, tools, source/dev sidecar harness receipts, route handling, LM Studio transports, safety gates, and runtime artifacts
- `penny-voice/runtime/` - my mouth: the live prompt-facing assets that keep me sounding like me
- `data/*.seed.json` - my public childhood photos: seed data only; live memory files are ignored
- `scripts/` - my gym: setup, checks, QA, local eval helpers, and lower-level sidecar trial tools
- `docs/` - contributor docs, public explainers, release checklist, and archived historical notes
- `test/` - Node test suite, because vibes are not receipts

## Read These Before You Start Poking

- [INSTALL.md](./INSTALL.md) - install and local operation
- [docs/penny-public/pennyos-user-guide.md](./docs/penny-public/pennyos-user-guide.md) - first-run setup, local model guide, and FAQ
- [docs/README.md](./docs/README.md) - documentation authority map
- [docs/penny-for-new-developers.md](./docs/penny-for-new-developers.md) - practical contributor mental model
- [docs/penny-configuration-profiles.md](./docs/penny-configuration-profiles.md) - common `.env` profiles and risk boundaries
- [docs/penny-public/penny-mental-model.md](./docs/penny-public/penny-mental-model.md) - public mental map of what makes Penny unusual
- [CODEBASE.md](./CODEBASE.md) - repo map and source/generated boundaries
- [ARCHITECTURE.md](./ARCHITECTURE.md) - current runtime architecture
- [docs/penny-public/README.md](./docs/penny-public/README.md) - outward-facing Penny explainers
- [docs/release-checklist.md](./docs/release-checklist.md) - pre-release verification
- [docs/penny-experience-review-packet.md](./docs/penny-experience-review-packet.md) - private local-run receipts for reviewers who cannot run Penny

Fast path: [INSTALL.md](./INSTALL.md) -> [docs/README.md](./docs/README.md) -> [CODEBASE.md](./CODEBASE.md) -> [ARCHITECTURE.md](./ARCHITECTURE.md).

## Current Runtime Note

The code path is release-check clean. Live model QA still depends on the operator's runtime state: the OpenAI-compatible local endpoint must be reachable and Penny's chat/tool models must be loaded, or the OpenAI API key path must be configured and reachable, before `npm run preflight` can pass end to end.

That is not me being coy. That is me refusing to bluff with a pretty sentence.

## License

This repository is source-available unless and until the owner chooses an open-source license. See [LICENSE](./LICENSE).

`package.json` is marked `private: true` to prevent accidental `npm publish`; `npm pack` still works for local source/package verification.
