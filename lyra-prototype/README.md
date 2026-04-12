# Penny Companion Prototype

A self-contained local prototype for a distinct Penny companion presence.

## What it includes

- animated Penny companion core UI
- mood-aware visual states
- chat / memory / settings panels
- durable disk-backed Penny memory + browser cache fallback
- bond meter
- local backend route: `POST /api/penny/chat`
- stable local Penny backend route (temporary stabilization mode)
- no frontend API keys
- no external npm dependencies required

## Run

### Durable launcher (recommended)

Stable default mode:

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\start-lyra.ps1
```

Optional shadow-test mode (keeps normal chat route local-stable; only enables `/api/penny/chat/shadow`):

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\start-lyra.ps1 -Shadow
```

Optional custom shadow timeout:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-lyra.ps1 -Shadow -ShadowTimeoutMs 12000
```

Then open:

- <http://localhost:4317>

To stop it later:

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
powershell -ExecutionPolicy Bypass -File .\stop-lyra.ps1
```

### Foreground mode

```powershell
cd C:\Users\malac\.openclaw\workspace-main\lyra-prototype
npm start
```

## Notes

This build is no longer using the old deterministic fake-reply core.

Current backend path:
- browser UI sends to `/api/penny/chat`
- local Node server generates a stable Penny-style reply
- UI parses the hidden mood tag and updates the vessel
- browser storage preserves lightweight continuity
- server also saves structured Penny memory to `data/penny-memory.json`

There is still a browser-local cache for:
- lightweight remembered facts
- recent session notes
- bond / relationship score
- user name
- voice toggle

That cache is for vessel continuity, not the final long-term memory architecture.

## Shadow mode notes

- `PENNY_OPENCLAW_ENABLED=1` enables Penny's optional experimental OpenClaw lane.
- LM Studio remains Penny's main chat brain on `/api/penny/chat`.
- On the main chat route, selecting `brainMode=shadow` sends the turn through the OpenClaw shadow lane and blocks the reply if that lane fails. It should not silently fake success.
- The legacy `/api/penny/chat/shadow` route still exists for isolated experiments and currently falls back to a local Penny placeholder reply if OpenClaw errors.
- Keep shadow parked unless it proves it adds real agentic/browser/PC value that the LM Studio lane does not already cover well.

## Planned next steps

1. validate shadow mode repeatedly under intentional start conditions
2. compare response quality / contamination / timeout behavior
3. only then consider selective promotion of the OpenClaw path
4. optional voice input
5. ambient idle / always-on shell behaviors
