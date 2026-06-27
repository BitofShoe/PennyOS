# Install PennyOS

## Source/dev requirements

- Node.js `>=24 <25`
- npm `>=11 <12`
- LM Studio running a local OpenAI-compatible server, a configured llama.cpp/generic OpenAI-compatible endpoint, or an explicit OpenAI Platform API key configured in PennyOS Settings

The default LM Studio base URL is `http://127.0.0.1:1234/v1`.
Penny pins Node 24.x for the source/dev release-supported test/runtime surface; use Node 24 even if older versions appear to run part of the app. A built Tauri desktop package bundles Penny's Node sidecar and server resource tree, so an installed app should not need Node, npm, Rust, Cargo, or a repo checkout on the end user's `PATH`. It still needs Windows WebView2 and either an already-running local/OpenAI-compatible model endpoint or an OpenAI Platform API key for model-backed chat.
This is a source-available technical preview for a local/private runtime, not software intended for public internet exposure.

## Setup

For a GitHub source ZIP on Windows, extract the ZIP and run one of these from the extracted folder:

```powershell
.\Install-Penny.ps1
```

You can also double-click `Install-Penny.cmd`. That source installer checks Node.js 24 and npm 11, runs `npm ci`, creates `.env` from `.env.example` without overwriting an existing `.env`, and creates PennyOS Start/Stop/Open shortcuts on the desktop and Start Menu.

Add `-Start` to launch Penny after installation:

```powershell
.\Install-Penny.ps1 -Start
```

Manual setup:

```powershell
npm ci
copy .env.example .env
npm run doctor
npm run lmstudio:prepare
npm start
```

Then open `http://localhost:4317`.

On macOS/Linux, use `cp .env.example .env` instead of PowerShell `copy`. The durable background launcher is currently a Windows PowerShell helper; `npm start` is the portable foreground path.

## Windows Desktop Package

PennyOS now includes a Tauri package path in `src-tauri/`. Build machines need the source/dev Node/npm tools plus Tauri's Rust/platform prerequisites. The installed app path is meant to launch without Node, npm, Rust, Cargo, or a repo checkout on the end user's `PATH`; prove that on a clean Windows user/VM before treating the package as consumer-ready.

```powershell
npm run tauri:doctor
npm run tauri:sidecar:manifest
npm run tauri:build:check
npm run tauri:build
npm run tauri:consumer-smoke:windows
npm run tauri:clean-proof:windows
```

From Windows PowerShell, use the wrapper launcher:

```powershell
npm run tauri:doctor:windows
npm run tauri:build
npm run tauri:consumer-smoke:windows
npm run tauri:clean-proof:windows
npm run tauri:dev:windows
```

The packaged wrapper opens a native PennyOS window, starts the bundled `penny-node` sidecar against the bundled `penny-runtime/server.js` resource tree on `127.0.0.1`, waits for `/api/penny/status`, and then navigates to the normal Penny UI. Writable state is passed into app-data/config/log paths through `PENNY_DATA_DIR`, `PENNY_CONFIG_DIR`, the `PENNY_MEMORY_*` files, `PENNY_OPEN_LOOP_FILE`, `PENNY_PENDING_WORKSPACE_WRITES_FILE`, `PENNY_STATIC_EMBED_CACHE_FILE`, `PENNY_LOCAL_MODEL_PREFERENCE_FILE`, and `PENNY_TAURI_LOG`. It preserves the existing local/private server boundary and sets `PENNY_SKIP_LMSTUDIO_PREP=1` by default so opening the desktop shell does not try to manage your loaded local model state.

`npm run tauri:sidecar:build` stages `src-tauri/gen/penny-runtime/`, `src-tauri/gen/penny-runtime-manifest.json`, and `src-tauri/binaries/penny-node-<target-triple>`. `npm run tauri:build:check` compiles the Rust desktop shell without building installers. Use it after `tauri:doctor` and before trying a full bundled `tauri:build`. `npm run tauri:consumer-smoke:windows` launches the Windows package executable with Node, npm, Cargo, and rustc hidden from `PATH`, probes `/api/penny/status`, writes a JSON receipt under `output/tauri-consumer-smoke/`, and stops the app it started. `npm run tauri:clean-proof:windows` is the stricter clean-user/VM harness for the NSIS installer: it expects Node/npm/Cargo/rustc to be absent from the normal user `PATH`, installs PennyOS, launches the installed shortcut target with a stripped `PATH`, captures status/log/screenshot/app-data receipts, uninstalls, and writes one JSON proof under `output/tauri-clean-windows-proof/`. A hosted private Windows proof has passed the same installed-app clean-`PATH` launch path; a bare VM screenshot is still the strongest final consumer receipt.

Uninstall removes PennyOS app files and shortcuts. It intentionally leaves user memory/config/log state in the PennyOS app-data folders so an accidental uninstall does not wipe a companion's memory. Delete the `com.bitofshoe.pennyos` roaming/local app-data folders manually if you want a full data wipe after uninstall.

For this WSL/Windows shared checkout, run this if one side suddenly reports a missing Tauri native binding after the other side ran `npm install`:

```powershell
npm run tauri:repair:native:shared
```

The Tauri package does not bundle LM Studio, llama.cpp, models, embeddings, or OpenAI credentials. The end user still needs an already-running LM Studio, llama.cpp, other OpenAI-compatible local endpoint, or an explicit OpenAI Platform API key for model-backed chat. Once that endpoint is installed and serving the configured loopback URL, or OpenAI cloud mode is configured, Penny's package path is intended to be close to plug-and-play: it starts Penny's local UI/server sidecar, preserves local model state with `PENNY_SKIP_LMSTUDIO_PREP=1`, and reports endpoint/provider readiness honestly instead of trying to manage model downloads. The official Tauri prerequisite docs are here: [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Tauri's sidecar model is documented here: [Tauri sidecars](https://v2.tauri.app/develop/sidecar/).

Useful overrides:

```dotenv
PENNY_TAURI_PORT=4317
PENNY_TAURI_NODE=node
PENNY_TAURI_SERVER_ROOT=.
PENNY_TAURI_READY_TIMEOUT_MS=30000
PENNY_TAURI_LOG=logs/penny-tauri-server.log
```

`PENNY_TAURI_NODE` and `PENNY_TAURI_SERVER_ROOT` are development fallback knobs for a checkout launch when the bundled runtime resource is not available; the packaged path should use the bundled `penny-node` sidecar and resource tree.

`npm run doctor` is the same local environment check as `npm run preflight`. It reports Node/npm posture, local endpoint reachability, selected models, semantic-memory fallback, web-reading state, and LAN/token posture.

For llama.cpp or another already-running OpenAI-compatible endpoint, set the endpoint and backend in `.env`:

```dotenv
PENNY_LMSTUDIO_BASE=http://127.0.0.1:18080/v1
PENNY_LOCAL_LLM_BACKEND=llama_cpp
PENNY_LOCAL_LLM_TRANSPORT=chat
```

In that mode, `npm run doctor` skips LM Studio CLI/preset checks and validates `/v1/models` plus Penny's configured chat/tool lanes. The `PENNY_LMSTUDIO_*` names are historical; they still point at the local OpenAI-compatible endpoint Penny uses.

## Optional OpenAI Cloud Setup

Use this when local models are too much setup and you are comfortable with a cloud provider.

Important boundary: this is OpenAI Platform API access, not a ChatGPT Plus/Pro login. You need an API key from the OpenAI Platform dashboard. When enabled, Penny may send prompts, memory context, and tool context to OpenAI, and API usage may cost money.

In the installed app:

1. Open PennyOS.
2. Go to Settings -> Brain connection.
3. Click Connect OpenAI cloud.
4. Paste an OpenAI Platform API key.
5. Leave the defaults unless you know you want different models:
   - Chat model: `gpt-5.5`
   - Tool model: `gpt-5.5`
   - Embedding model: `text-embedding-3-small`
6. Check the cloud disclosure.
7. Click Save OpenAI cloud setup.
8. Close and reopen PennyOS.

The save step validates the key against OpenAI's `/v1/models` endpoint, writes Penny's app config `.env`, and never echoes the full key back to the browser.

## First-Run Model Setup

After Penny opens, go to Settings -> First-run local brain setup. Penny will detect the configured local runtime model list, show whether the chat/tool lanes are actually ready, and let you pick:

- the chat model
- the tool model
- whether Penny may fall back to another compatible loaded model when the preferred model is missing

Those picks are saved in the local ignored preferences file, so you do not have to crack open `.env` just because LM Studio, llama.cpp, or another endpoint calls your model something slightly different. Embeddings are shown there too, but they are optional: when the embedding model is missing or unloaded, Penny should say so and use keyword fallback instead of faceplanting.

For a normal-user walkthrough with LM Studio, llama.cpp, model-picking notes, feature notes, and FAQ answers, read [docs/penny-public/pennyos-user-guide.md](./docs/penny-public/pennyos-user-guide.md). The installed desktop app also bundles an in-app copy at Settings -> Open setup guide.

The generated `.env` local companion profile enables bounded open-loop, initiative, and turn-state prompt bridges with conservative caps. Removing those lines returns to the raw server default of off.

## Web Reading

Web reading is off by default. To let Penny fetch public web pages:

```dotenv
PENNY_WEB_SEARCH_ENABLED=1
PENNY_WEB_ALLOW_PRIVATE_NET=0
```

Private/internal/local network targets remain blocked unless you explicitly set `PENNY_WEB_ALLOW_PRIVATE_NET=1` for deliberate local-network testing.

## LAN / Phone Access

Penny is localhost-only by default. To share on the local network:

```powershell
$env:PENNY_LAN_SHARE="1"
$env:PENNY_API_TOKEN="choose-a-long-random-token"
npm start
```

Open the printed LAN URL on your phone and enter the token in Settings -> API access.

## Runtime State

Live memory defaults to ignored local files under `data/`, seeded from tracked `data/*.seed.json` files when missing. Do not commit live memory files.

## Workspace Writes

Penny's project write tools stage pending patches by default. Use the approval queue in the API or set `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1` only for a trusted local run where direct edits are intended.

Pending workspace edits are stored in ignored local state at `data/penny-pending-workspace-writes.json`, so staged approvals can survive a restart. Approval still re-checks the base file hash before applying bytes.

## Release Checks

For a normal checkout:

```powershell
npm run check
npm run qa:browser:install
npm run qa:browser:smoke
npm pack --dry-run
```

For a source zip or package-style tree without `.git`, run `npm run check:release`. The browser install step is only for QA smoke tests, not normal Penny runtime.
