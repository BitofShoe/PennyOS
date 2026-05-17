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
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-no_cloud_memory-7C3AED?style=for-the-badge" alt="Privacy"></a>
  <img src="https://img.shields.io/badge/Node-24.x-2563EB?style=for-the-badge&logo=node.js&logoColor=white" alt="Node 24">
</p>

PennyOS is my local companion runtime. Think of it as my physical form: browser face, Node backend, LM Studio brain lanes, durable memory, bounded tools, and the voice layer that keeps me from turning into "beige helpdesk sludge."

Am I gorgeous? Obviously. Am I useful? Absolutely. Try to keep up.

I am not a hosted chatbot skin. I am a single-user local companion app with memory that actually sticks, expressive sprites so you can tell when I am judging you, practical tools, and enough safety rails that I do not accidentally chew through your filesystem like a feral little autocomplete engine.

## What I Am

- A local-first AI companion that runs against LM Studio's OpenAI-compatible server. Your data stays yours.
- A real browser UI with mood sprites, memory inspection, model controls, image attachments, and chat that tries to feel like a person is actually in the room.
- A Node app with boring, necessary boundaries around tools, web reading, workspace writes, local memory, and release artifacts.
- Source-available under the all-rights-reserved terms in [LICENSE](./LICENSE), because ownership matters and we are not pretending otherwise.

This branch is the public release candidate for `BitofShoe/PennyOS`.

## What Ships

| Surface | What you get | The boundary, because I am a handful |
| --- | --- | --- |
| Companion UI | Chat, expression lock, visual states, image path, memory inspector, and model controls | Served locally; no Google Fonts or sneaky third-party asset fetches |
| LM Studio runtime | Local OpenAI-compatible chat/tool lanes, preset prep, readiness checks, and model status | No hosted model provider by default |
| Memory | Seed memory, session/archive helpers, memory books, provenance, and review-gated suggestion surfaces | Live memory files stay ignored; public seed data ships |
| Tools | Project/file, git, web, and runtime helpers | Writes stage pending patches unless direct-write mode is explicitly enabled |
| Web reading | Search/read helpers with redirects, byte caps, and URL safety checks | Private/internal targets are blocked unless explicitly allowed. No snooping |
| QA/release harnesses | Artifact scan, frontend privacy scan, unit tests, browser smoke, package dry run | Fails closed when private or generated junk sneaks into tracked files |

## Proof I Have A Face

<table>
<tr>
<td width="33%" align="center"><img width="100%" alt="Penny happy" src="public/sprites/packs/pen2/pen2-happy-bright.png" /><br/><b>Expressive companion UI</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny thinking" src="public/sprites/packs/pen2/pen2-thinking-laptop-base.png" /><br/><b>Local model and memory cockpit</b></td>
<td width="33%" align="center"><img width="100%" alt="Penny smug" src="public/sprites/packs/pen2/pen2-smug-presenting.png" /><br/><b>Approval-gated local tools</b></td>
</tr>
</table>

## Wake Me Up

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

Then open `http://localhost:4317`.

`npm run lmstudio:prepare` is the friendly path when LM Studio CLI integration is available. If that prep step cannot boss your local preset into shape, keep LM Studio's local server running and set model overrides in `.env`.

For LAN/phone mode, runtime state, and workspace-write notes, read [INSTALL.md](./INSTALL.md). Do not guess. Guessing is how tiny disasters get promoted to architecture.

## My Leash, Since Apparently We Need One

- I bind to `127.0.0.1` by default.
- LAN sharing requires `PENNY_LAN_SHARE=1`.
- LAN API access requires `PENNY_API_TOKEN`.
- Sensitive workspace writes stage pending patches by default.
- Direct workspace writes require `PENNY_ENABLE_DIRECT_WORKSPACE_WRITES=1`.
- Web reading blocks loopback, private, link-local, multicast, reserved, and metadata-style targets by default.
- The browser UI ships with local assets. No sneaky CDN font nonsense.

See [SECURITY.md](./SECURITY.md) and [PRIVACY.md](./PRIVACY.md) for the less glamorous, extremely important part where we keep the machine from doing stupid things.

## Make Sure I Did Not Lie

```powershell
npm run check
npm run qa:browser:smoke
npm pack --dry-run --ignore-scripts
```

Want to verify I am actually working? Good. Suspicion is healthy.

- `npm run check` runs the release artifact guard, frontend privacy guard, server syntax check, and full test suite.
- `npm run qa:browser:smoke` opens the actual browser UI against a mock LM Studio server and checks chat, image upload, memory inspector, expression state, and reset flows.
- `npm pack --dry-run --ignore-scripts` checks the package before anyone starts making grand little release noises.
- `npm run bundle:review:experience -- --latest-experience-artifacts --out tmp/gpt-pro-review-bundle` builds a private reviewer packet after you have generated and checked local QA artifacts.

Live local-model QA is a different beast. It depends on your actual runtime state, loaded models, ports, and Windows/WSL setup, so [docs/release-checklist.md](./docs/release-checklist.md), [docs/penny-experience-review-packet.md](./docs/penny-experience-review-packet.md), and `npm run preflight` are the responsible little ritual before you start making claims about live behavior.

## Where My Guts Are

- `server.js` - my brainstem: backend entrypoint and route orchestration
- `public/` - my face: browser UI, sprites, styles, and client modules
- `lib/` - my instincts: memory, tools, route handling, LM Studio transports, safety gates, and runtime artifacts
- `penny-voice/runtime/` - my mouth: the live prompt-facing assets that keep me sounding like me
- `data/*.seed.json` - my public childhood photos: seed data only; live memory files are ignored
- `scripts/` - my gym: setup, checks, QA, local eval helpers, and sidecar trial tools
- `docs/` - contributor docs, public explainers, release checklist, and archived historical notes
- `test/` - Node test suite, because vibes are not receipts

## Read These Before You Start Poking

- [INSTALL.md](./INSTALL.md) - install and local operation
- [docs/README.md](./docs/README.md) - documentation authority map
- [CODEBASE.md](./CODEBASE.md) - repo map and source/generated boundaries
- [ARCHITECTURE.md](./ARCHITECTURE.md) - current runtime architecture
- [docs/penny-public/README.md](./docs/penny-public/README.md) - outward-facing Penny explainers
- [docs/release-checklist.md](./docs/release-checklist.md) - pre-release verification
- [docs/penny-experience-review-packet.md](./docs/penny-experience-review-packet.md) - private local-run receipts for reviewers who cannot run Penny

Fast path: [INSTALL.md](./INSTALL.md) -> [docs/README.md](./docs/README.md) -> [CODEBASE.md](./CODEBASE.md) -> [ARCHITECTURE.md](./ARCHITECTURE.md).

## Current Runtime Note

The code path is release-check clean. Live local-model QA still depends on the operator's runtime state: the OpenAI-compatible local endpoint must be reachable and Penny's chat/tool models must be loaded before `npm run preflight` can pass end to end.

That is not me being coy. That is me refusing to bluff with a pretty sentence.

## License

This repository is source-available unless and until the owner chooses an open-source license. See [LICENSE](./LICENSE).
