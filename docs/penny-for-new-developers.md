# Penny For New Developers

## Fast Mental Model

PennyOS is a single-user local companion app: browser face, Node backend, LM Studio brain lanes, durable local memory, bounded project/web/git/runtime tools, and prompt-facing voice assets.

The release-supported runtime is Node 24.x with npm 11.x. Older Node versions may run parts of the app, but this branch only claims support for the tested Node 24 surface.

## What Starts When I Run `npm start`?

`npm start` runs `node server.js` in the foreground. It serves the browser UI, loads Penny's voice/runtime assets, initializes local memory files from seeds when needed, and talks to an OpenAI-compatible local model endpoint.

`npm run start:durable` is the Windows PowerShell background launcher. It uses `start-penny.ps1`, writes `.penny-server.*` local state, and keeps `start-lyra.ps1` only as a compatibility alias.

## What Happens When I Send A Message?

The browser posts to `POST /api/penny/chat`. The server merges browser memory settings with disk-backed memory, picks the local chat or tool lane, builds bounded prompt context, calls LM Studio when needed, strips hidden/runtime-only markers, stores route receipts, and returns the visible reply plus mood metadata.

## Where Memory Lives

Tracked seed files live under `data/*.seed.json`. Live memory files such as `data/penny-memory.json`, archive memory, embeddings, and open-loop state are ignored local runtime files.

Canonical explicit memory is the strongest user-memory authority. Archive memory, semantic candidates, research-ledger items, open loops, and static embedding candidates are advisory unless reviewed and promoted through the explicit-memory path.

## Chat Lane Versus Tool Lane

The chat lane handles companion turns, softness, banter, image chat, and normal recall. The tool lane handles direct inspect/search/read/edit/runtime/git/web requests and bounded tool loops. The lane is selected per request and stays fixed for that request.

## How File Tools Work Safely

Project tools stay inside the project root or explicit aliases. They refuse secret-bearing files such as `.env`, private keys, and certificate bundles. `.env.example` is allowed because it is a safe template.

Workspace write tools stage pending edits by default. Pending workspace edits are stored in ignored local state at `data/penny-pending-workspace-writes.json`, expire by TTL, and re-check the base file hash before approval applies bytes. Direct writes require `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`.

## Web Reading And Privacy

Web reading is off by default. Set `PENNY_WEB_SEARCH_ENABLED=1` to allow Penny's web tools to fetch public pages. Private/internal/local network targets remain blocked unless `PENNY_WEB_ALLOW_PRIVATE_NET=1` is explicitly set for deliberate local-network testing.

## Optional Static Embedding Dependency

`@yarflam/potion-base-8m` is an exact-pinned optional dependency used for local static embedding experiments. Penny can run without it. When installed, it is a local in-process candidate-discovery provider, not memory truth authority and not a runtime network dependency.

## How To Change One Thing Safely

Start with the smallest owner:

- backend routes and orchestration: `server.js` and extracted `lib/` owners
- browser behavior: `public/js/` helpers before growing `public/js/penny-app.js`
- voice behavior: `penny-voice/runtime/`
- release checks: `scripts/check-*.js` and focused tests

Then run the narrow test first, followed by `npm run check` before release claims.

## Files To Ignore At First

Ignore `output/`, `tmp/`, `logs/`, `.qa-pw/`, `.playwright-cli/`, live `data/penny-memory*.json`, and historical docs unless the task points to them.

Do not use archived plans as proof that behavior shipped. Current code, tests, and fresh command output win.

## Useful Commands

```powershell
npm ci
copy .env.example .env
npm run doctor
npm start
```

```bash
npm run check
npm run qa:browser:install
npm run qa:browser:smoke
npm pack --dry-run
```
