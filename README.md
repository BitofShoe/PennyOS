<p align="center">
  <img width="220" alt="Penny local companion" src="public/sprites/packs/pen2/pen2-happy-sparkle.png" />
</p>

<h1 align="center">Penny Local Companion</h1>

<p align="center">
  A full-fat local-first companion app: expressive browser UI, durable memory, LM Studio chat and tool lanes, bounded project tools, and release-safe defaults.
</p>

<p align="center">
  <a href="INSTALL.md"><img src="https://img.shields.io/badge/Install-local_setup-111827?style=for-the-badge" alt="Install"></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/Security-local_first-0F766E?style=for-the-badge" alt="Security"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-no_cloud_memory-7C3AED?style=for-the-badge" alt="Privacy"></a>
  <img src="https://img.shields.io/badge/Node-24.x-2563EB?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 24">
</p>

Penny is not a demo shell. This branch keeps the real local companion app and makes the GitHub-facing repo safer to inspect, install, and package: private workspace residue is out, default network exposure is loopback-only, write tools stage patches for approval, and generated artifacts are guarded before release.

## Runtime Snapshot

| Surface | What exists now | Default boundary |
| --- | --- | --- |
| Browser companion UI | Chat, memory inspector, model controls, image attachment path, expression lock, mood sprites, and visual Penny states | Served locally; no Google Fonts or third-party asset fetches |
| LM Studio runtime | Local OpenAI-compatible chat/tool lanes, preset preparation, preflight checks, model readiness reporting | No hosted provider by default; live QA requires loaded local models |
| Memory system | Session memory, archive recall, memory books, semantic/source-trust helpers, recency protection, and inspection artifacts | Live memory files are ignored; only public seed data ships |
| Project tools | Read/search/list plus bounded write/replace/insert tool surfaces | Workspace writes stage pending patches unless direct writes are explicitly unlocked |
| Web reading | Search/read helpers with redirects and byte caps | Private, loopback, link-local, metadata, multicast, and reserved targets are blocked unless explicitly allowed |
| Release guardrails | Package allowlist, privacy scan, artifact scan, CI check, browser smoke, and package dry-run path | Fails closed when private/generated residue is tracked |

## Quick Start

Requirements:

- Node.js 24.x
- npm 11.x
- LM Studio with an OpenAI-compatible server at `http://127.0.0.1:1234/v1`

```powershell
npm ci
copy .env.example .env
npm run lmstudio:prepare
npm start
```

Open `http://localhost:4317`.

For the full setup path, see [INSTALL.md](./INSTALL.md).

## Preview

<table>
<tr>
<td width="33%" align="center"><img width="100%" alt="Penny happy" src="public/sprites/packs/pen2/pen2-happy-bright.png" /><br/><b>Expressive companion UI</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny thinking" src="public/sprites/packs/pen2/pen2-thinking-laptop-base.png" /><br/><b>Local model and memory cockpit</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny smug" src="public/sprites/packs/pen2/pen2-smug-presenting.png" /><br/><b>Approval-gated local tools</b></td>
</tr>
</table>

## Three-Minute Proof Loop

```powershell
npm run check
npm run qa:browser:smoke
npm pack --dry-run --ignore-scripts --json
```

`npm run check` runs the release artifact guard, frontend privacy guard, server syntax check, and full test suite. `qa:browser:smoke` opens the actual browser UI against a mock LM Studio server and verifies chat, image upload, memory inspector, expression state, and reset flows.

## Local-First Boundaries

- Penny binds to `127.0.0.1` by default.
- `PENNY_LAN_SHARE=1` is required before binding for LAN/phone access.
- LAN API access requires the Penny access token on every `/api/*` request.
- Sensitive local mutations require a token even outside LAN mode.
- Workspace writes stage pending patches by default.
- Direct writes require `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`.
- Web fetches block local/private/internal network targets unless `PENNY_WEB_ALLOW_PRIVATE_NET=1`.
- Browser assets are local; the shipped UI does not call Google Fonts or CDNs.

See [SECURITY.md](./SECURITY.md) and [PRIVACY.md](./PRIVACY.md).

## Repository Map

- `server.js` - local backend entrypoint and route orchestration.
- `public/` - browser UI, client modules, CSS, and Penny sprite assets.
- `lib/` - memory, LM Studio transport, route, tool, safety, QA, and runtime helper modules.
- `penny-voice/runtime/` - shipped runtime voice assets.
- `data/*.seed.json` - public seed data only.
- `scripts/` - setup, release checks, QA, local evals, and sidecar helpers.
- `docs/` - implementation notes, public docs, plans, and sidecar references.
- `test/` - Node test suite.

## Packaging

The npm package uses a `files` allowlist and release guards so generated output, local memory, private notes, and test artifacts do not ship.

```powershell
npm run check
npm pack --dry-run --ignore-scripts --json
```

## Current Runtime Note

The code path is release-check clean. Live LM Studio QA still depends on the operator's local runtime state: the Windows LM Studio API must be reachable and Penny's chat/tool models must be loaded before `npm run preflight` can pass end to end.

## License

This repository is source-available unless and until the owner chooses an open-source license. See [LICENSE](./LICENSE).
