# Install PennyOS

## Requirements

- Node.js `>=24 <25`
- npm `>=11 <12`
- LM Studio running a local OpenAI-compatible server

The default LM Studio base URL is `http://127.0.0.1:1234/v1`.

## Setup

```powershell
npm ci
copy .env.example .env
npm run lmstudio:prepare
npm start
```

Then open `http://localhost:4317`.

On macOS/Linux, use `cp .env.example .env` instead of PowerShell `copy`. The durable background launcher is currently a Windows PowerShell helper; `npm start` is the portable foreground path.

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
