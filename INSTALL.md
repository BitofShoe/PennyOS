# Install PennyOS

## Requirements

- Node.js `>=24 <25`
- npm `>=11 <12`
- LM Studio running a local OpenAI-compatible server

The default LM Studio base URL is `http://127.0.0.1:1234/v1`.
Penny pins Node 24.x for the current release-supported test/runtime surface; use Node 24 even if older versions appear to run part of the app.

## Setup

```powershell
npm ci
copy .env.example .env
npm run doctor
npm run lmstudio:prepare
npm start
```

Then open `http://localhost:4317`.

On macOS/Linux, use `cp .env.example .env` instead of PowerShell `copy`. The durable background launcher is currently a Windows PowerShell helper; `npm start` is the portable foreground path.

`npm run doctor` is the same local environment check as `npm run preflight`. It reports Node/npm posture, LM Studio reachability, selected models, semantic-memory fallback, web-reading state, and LAN/token posture.

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
