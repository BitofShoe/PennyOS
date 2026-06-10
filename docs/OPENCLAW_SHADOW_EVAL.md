# OpenClaw Shadow Evaluation

Date: 2026-04-12

## Current project reality

- Penny's main `/api/penny/chat` path is LM Studio.
- Shadow mode is optional and experimental.
- In this repo, `runOpenClawShadow` currently sends one prompt blob to `openclaw/main` through the gateway responses endpoint.
- The main chat route blocks on shadow failure instead of silently pretending everything is fine.
- The legacy `/api/penny/chat/shadow` endpoint still falls back to a local placeholder reply.

## What OpenClaw can do in theory

Official OpenClaw docs show the platform can expose capabilities that are broader than Penny's current LM Studio lane:

- managed browser automation with clicks, typing, snapshots, screenshots, and PDFs
- shell execution in the workspace or on a paired node
- cron / scheduled jobs
- agent workspaces, subagents, and background task patterns

Primary sources:

- [OpenClaw browser docs](https://docs.openclaw.ai/tools/browser)
- [OpenClaw exec docs](https://docs.openclaw.ai/tools/exec)
- [OpenClaw cron docs](https://docs.openclaw.ai/cli/cron)
- [OpenClaw agent workspace docs](https://docs.openclaw.ai/concepts/agent-workspace)

## What this environment is actually giving Penny today

- The live Penny project is not wired to OpenClaw browser control, exec sessions, cron jobs, or visible multi-step task routing.
- The current local OpenClaw config points `main` at an LM Studio model and has web fetch enabled, but the richer browser/exec lane is not currently surfaced through Penny's shadow route.
- A local `openclaw health --json` check on 2026-04-12 failed because the gateway connection closed abnormally, which means the optional lane is not even healthy enough right now to trust as a daily sidecar.

## Verdict

Do not replace LM Studio as Penny's main brain.

OpenClaw shadow mode is only worth keeping as an optional lane if one of these becomes real in this repo:

- Penny can drive the OpenClaw-managed browser for actual web tasks
- Penny can use OpenClaw exec or node-host commands for higher-autonomy PC work
- Penny can offload isolated background jobs or scheduled work in a way the local lane does not already cover cleanly

Right now, shadow does not clear that bar.

## Recommendation

- Keep LM Studio as Penny's main chat and coding lane.
- Keep shadow parked as experimental.
- Revisit only after the OpenClaw gateway is healthy and Penny is explicitly wired into browser, exec, or scheduled-task features that produce a clear capability win.
- Retest Codex Harness only with disposable workspace/server state after one of those capability wins exists; the retest must prove browser, exec, or scheduled-task behavior with receipts instead of relying on OpenClaw docs alone.
