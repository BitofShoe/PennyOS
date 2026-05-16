# Penny Local Companion

Penny is a full local-first companion app: a browser UI, a Node backend, durable local memory, LM Studio chat/tool lanes, bounded project tools, and the Penny runtime voice/personality assets.

This branch is shaped for a public GitHub/package release without turning Penny into a stripped demo. It keeps the real local app while adding safer defaults for LAN access, workspace writes, web fetching, frontend assets, and release artifacts.

## Quick Start

Requirements:

- Node.js 24.x
- npm 11.x
- LM Studio with an OpenAI-compatible local server available at `http://127.0.0.1:1234/v1`

Install and run:

```powershell
npm ci
copy .env.example .env
npm run lmstudio:prepare
npm start
```

Open `http://localhost:4317`.

For more setup details, use [INSTALL.md](./INSTALL.md).

## Local-First Boundaries

- Penny binds to `127.0.0.1` by default.
- Set `PENNY_LAN_SHARE=1` only when you deliberately want phone/LAN access.
- In LAN mode, every `/api/*` request requires the Penny API token.
- Workspace write tools stage pending patches by default. Direct writes require `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`.
- Web reading blocks loopback, private, link-local, multicast, reserved, and metadata-style network targets by default. Deliberate private-network fetches require `PENNY_WEB_ALLOW_PRIVATE_NET=1`.
- The browser UI ships without third-party font/CDN calls.

See [SECURITY.md](./SECURITY.md) and [PRIVACY.md](./PRIVACY.md).

## Useful Commands

```powershell
npm run check
npm test
npm run preflight
npm run qa:browser:smoke
```

`npm run check` runs the release artifact guard, frontend privacy guard, a syntax check, and the test suite.

## Project Layout

- `server.js` - local backend entrypoint and route orchestration.
- `public/` - browser UI, sprites, styles, and client modules.
- `lib/` - runtime helpers for memory, tools, route handling, LM Studio transports, safety gates, and artifacts.
- `penny-voice/runtime/` - the shipped Penny runtime voice assets.
- `data/*.seed.json` - public seed data only; live memory files are ignored.
- `scripts/` - setup, checks, QA, and local eval helpers.

## Packaging

The package uses a `files` allowlist and release guards so generated output, local memory, private notes, and test artifacts do not ship. Run this before publishing or cutting a release:

```powershell
npm run check
npm pack --dry-run --ignore-scripts
```

## License

This repository is source-available unless and until the owner chooses an open-source license. See [LICENSE](./LICENSE).
