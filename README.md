# PennyOS

<p align="center">
  <img width="240" alt="Penny presenting herself in the shipped pixel-anime expression pack." src="public/sprites/packs/pen2/pen2-smug-presenting.png" />
</p>

<p align="center">
  A local-first AI companion runtime for LM Studio: expressive browser UI, durable memory, bounded tools, authored voice, and release-safe defaults.
</p>

<p align="center">
  <a href="INSTALL.md"><img src="https://img.shields.io/badge/Install-local_setup-111827?style=for-the-badge" alt="Install"></a>
  <a href="SECURITY.md"><img src="https://img.shields.io/badge/Security-local_first-0F766E?style=for-the-badge" alt="Security"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-no_cloud_memory-7C3AED?style=for-the-badge" alt="Privacy"></a>
  <img src="https://img.shields.io/badge/Node-24.x-2563EB?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 24">
</p>

PennyOS packages Penny's browser UI, Node backend, local memory, model lanes, bounded tools, and prompt-facing runtime voice into one source-available local app repo.

Penny is not a hosted chatbot skin. She is a single-user local companion app with a strong character layer, durable local memory, expressive sprite presentation, and practical tools that stay bounded by local safety defaults.

## Release Posture

This branch is shaped as a public GitHub/package release candidate:

- source-available under the all-rights-reserved terms in [LICENSE](./LICENSE)
- local-first by default; no hosted model API calls or telemetry
- designed for LM Studio's OpenAI-compatible local server
- localhost-only unless LAN sharing is explicitly enabled
- release guards for private/generated files and frontend third-party asset calls
- public seed memory only; live memory files stay ignored

The current target repository name is `BitofShoe/PennyOS`.

## Runtime Snapshot

| Surface | What exists now | Default boundary |
| --- | --- | --- |
| Browser companion UI | Chat, memory inspector, model controls, image attachment path, expression lock, mood sprites, and visual Penny states | Served locally; no Google Fonts or third-party asset fetches |
| LM Studio runtime | Local OpenAI-compatible chat/tool lanes, preset preparation, preflight checks, model readiness reporting | No hosted provider by default; live QA requires loaded local models |
| Memory system | Session memory, archive recall, memory books, semantic/source-trust helpers, recency protection, and inspection artifacts | Live memory files are ignored; only public seed data ships |
| Project tools | Read/search/list plus bounded write/replace/insert tool surfaces | Workspace writes stage pending patches unless direct writes are explicitly unlocked |
| Web reading | Search/read helpers with redirects and byte caps | Private, loopback, link-local, metadata, multicast, and reserved targets are blocked unless explicitly allowed |
| Release guardrails | Package allowlist, privacy scan, artifact scan, CI check, browser smoke, and package dry-run path | Fails closed when private/generated residue is tracked |

## Preview

<table>
<tr>
<td width="33%" align="center"><img width="100%" alt="Penny happy" src="public/sprites/packs/pen2/pen2-happy-bright.png" /><br/><b>Expressive companion UI</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny thinking" src="public/sprites/packs/pen2/pen2-thinking-laptop-base.png" /><br/><b>Local model and memory cockpit</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny smug" src="public/sprites/packs/pen2/pen2-smug-presenting.png" /><br/><b>Approval-gated local tools</b></td>
</tr>
</table>

## Quick Start

Requirements:

- Node.js `>=24 <25`
- npm `>=11 <12`
- LM Studio with an OpenAI-compatible local server at `http://127.0.0.1:1234/v1`

Windows PowerShell:

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

Open `http://localhost:4317`.

`npm run lmstudio:prepare` is the friendliest path when LM Studio CLI integration is available. If it cannot prepare the local preset on your machine, keep LM Studio's local server running and set model overrides in `.env`.

Use [INSTALL.md](./INSTALL.md) for LAN/phone mode, runtime state, and workspace-write notes.

## Three-Minute Proof Loop

```powershell
npm run check
npm run qa:browser:smoke
npm pack --dry-run --ignore-scripts
```

`npm run check` runs the release artifact guard, frontend privacy guard, server syntax check, and full test suite. `qa:browser:smoke` opens the actual browser UI against a mock LM Studio server and verifies chat, image upload, memory inspector, expression state, and reset flows.

## Safety Defaults

- Penny binds to `127.0.0.1` by default.
- LAN sharing requires `PENNY_LAN_SHARE=1`.
- LAN API access requires `PENNY_API_TOKEN`.
- Sensitive workspace writes stage pending patches by default.
- Direct workspace writes require `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`.
- Web reading blocks loopback, private, link-local, multicast, reserved, and metadata-style targets by default.
- Browser assets are local; the shipped UI does not call Google Fonts or CDNs.

See [SECURITY.md](./SECURITY.md) and [PRIVACY.md](./PRIVACY.md).

## Repository Map

- `server.js` - local backend entrypoint and route orchestration
- `public/` - browser UI, sprites, styles, and client modules
- `lib/` - runtime helpers for memory, tools, route handling, LM Studio transports, safety gates, and artifacts
- `penny-voice/runtime/` - the shipped Penny runtime voice assets
- `data/*.seed.json` - public seed data only; live memory files are ignored
- `scripts/` - setup, checks, QA, local eval helpers, and sidecar trial tools
- `docs/` - contributor docs, public explainers, release checklist, and archived historical notes
- `test/` - Node test suite

## Docs To Read Next

- [INSTALL.md](./INSTALL.md) - install and local operation
- [docs/README.md](./docs/README.md) - documentation authority map
- [CODEBASE.md](./CODEBASE.md) - repo map and source/generated boundaries
- [ARCHITECTURE.md](./ARCHITECTURE.md) - current runtime architecture
- [docs/penny-public/README.md](./docs/penny-public/README.md) - outward-facing Penny explainers
- [docs/release-checklist.md](./docs/release-checklist.md) - pre-release verification

## Current Runtime Note

The code path is release-check clean. Live LM Studio QA still depends on the operator's local runtime state: the Windows LM Studio API must be reachable and Penny's chat/tool models must be loaded before `npm run preflight` can pass end to end.

## License

This repository is source-available unless and until the owner chooses an open-source license. See [LICENSE](./LICENSE).
