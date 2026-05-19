# Install PennyOS

## Requirements

- Node.js `>=24 <25`
- npm `>=11 <12`
- LM Studio running a local OpenAI-compatible server

The default LM Studio base URL is `http://127.0.0.1:1234/v1`.
Penny pins Node 24.x for the current release-supported test/runtime surface; use Node 24 even if older versions appear to run part of the app.

## Setup

For a GitHub source ZIP on Windows, extract the ZIP and run one of these from the extracted folder:

```powershell
.\Install-Penny.ps1
```

You can also double-click `Install-Penny.cmd`. The installer checks Node.js 24 and npm 11, runs `npm ci`, creates `.env` from `.env.example` without overwriting an existing `.env`, and creates PennyOS Start/Stop/Open shortcuts on the desktop and Start Menu.

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

`npm run doctor` is the same local environment check as `npm run preflight`. It reports Node/npm posture, local endpoint reachability, selected models, semantic-memory fallback, web-reading state, and LAN/token posture.

For llama.cpp or another already-running OpenAI-compatible endpoint, set the endpoint and backend in `.env`:

```dotenv
PENNY_LMSTUDIO_BASE=http://127.0.0.1:18080/v1
PENNY_LOCAL_LLM_BACKEND=llama_cpp
PENNY_LOCAL_LLM_TRANSPORT=chat
```

In that mode, `npm run doctor` skips LM Studio CLI/preset checks and validates `/v1/models` plus Penny's configured chat/tool lanes. The `PENNY_LMSTUDIO_*` names are historical; they still point at the local OpenAI-compatible endpoint Penny uses.

## First-Run Model Setup

After Penny opens, go to Settings -> First-run local brain setup. Penny will detect the LM Studio model list, show whether the chat/tool lanes are actually ready, and let you pick:

- the chat model
- the tool model
- whether Penny may fall back to another compatible loaded model when the preferred model is missing

Those picks are saved in the local ignored preferences file, so you do not have to crack open `.env` just because LM Studio calls your model something slightly different. Embeddings are shown there too, but they are optional: when the embedding model is missing or unloaded, Penny should say so and use keyword fallback instead of faceplanting.

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

Pending workspace edits are temporary and disappear when Penny restarts.

## Release Checks

For a normal checkout:

```powershell
npm run check
npm run qa:browser:install
npm run qa:browser:smoke
npm pack --dry-run
```

For a source zip or package-style tree without `.git`, run `npm run check:release`. The browser install step is only for QA smoke tests, not normal Penny runtime.
