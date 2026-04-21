# Penny LAN / Phone Reset Runbook

Status: Current operational note
Authority: Strong guidance. Verify against live `Get-NetTCPConnection`, `/api/penny/status`, and the checked-out scripts if anything disagrees.

This note captures the April 21, 2026 phone-access reset so future agents do not rediscover the same WSL, PowerShell, PID, and LAN-address traps.

## Problem Shape

The user could reach Penny from a phone one day, then the phone URL stopped working the next day.

Observed symptoms:

- `http://10.0.0.141:4317` had worked before, then stopped responding.
- `http://127.0.0.1:4317/api/penny/status` and `http://10.0.0.141:4317/api/penny/status` initially failed from Windows-side probes.
- Port `4317` could be clear, stale, or owned by an orphaned process depending on which failed reset path had just run.
- The launcher path behaved differently when called from WSL through `powershell.exe` than when run normally in Windows.

The short answer for a user is usually: yes, Penny's server needs a reset.

## Current Phone URL Rule

Use the Windows Wi-Fi IPv4 address, not localhost and not the WSL adapter.

In the April 21 run, the working phone URL was:

```text
http://10.0.0.141:4317
```

Do not send the user to:

```text
http://172.29.64.1:4317
```

That address is the WSL virtual adapter. It may appear in Penny's LAN-address printout, but phones on Wi-Fi normally cannot reach it.

If the Wi-Fi IP changes, get the current one from Windows:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -notlike '169.254*' -and $_.IPAddress -ne '127.0.0.1' } |
  Select-Object InterfaceAlias,IPAddress,PrefixLength,AddressState
```

Pick the `Wi-Fi` address.

## Correct Reset Procedure

When the user asks for a phone-access reset, prefer preserving the loaded LM Studio model state unless they explicitly want model preparation or reloads.

From the repo root in WSL, use Windows PowerShell for Windows process and port truth:

```bash
cd /mnt/c/Users/malac/.openclaw/workspace-main/lyra-prototype

powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\Users\malac\.openclaw\workspace-main\lyra-prototype\stop-lyra.ps1'

powershell.exe -NoProfile -Command 'Get-NetTCPConnection -LocalPort 4317 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess | Format-Table -AutoSize'
```

If anything is still listening on `4317`, kill the owning process before restarting:

```bash
powershell.exe -NoProfile -Command '$listeners = Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue; foreach ($listener in $listeners) { Stop-Process -Id $listener.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output "Stopped listener PID $($listener.OwningProcess)" }'
```

Restart Penny while skipping LM Studio preparation:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command '$env:PENNY_SKIP_LMSTUDIO_PREP="1"; & "C:\Users\malac\.openclaw\workspace-main\lyra-prototype\start-lyra.ps1" -ReadyTimeoutMs 60000'
```

Then verify localhost and LAN status from Windows:

```bash
powershell.exe -NoProfile -Command 'try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 http://127.0.0.1:4317/api/penny/status).Content } catch { "ERROR: $($_.Exception.Message)" }'

powershell.exe -NoProfile -Command 'try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 http://10.0.0.141:4317/api/penny/status).Content } catch { "ERROR: $($_.Exception.Message)" }'
```

A good result has:

- `ok: true`
- `backend: local-lmstudio`
- `readiness.chatModelReady: true`
- `readiness.embeddingReady: true`, unless embeddings are intentionally unavailable and Penny is in graceful fallback
- one listener on port `4317`

## What Went Wrong On April 21

The first failure was ordinary: Penny was simply not responding on the LAN URL or localhost status route.

The reset became annoying because several tooling seams interacted:

- The old `start-lyra.ps1` called plain `node`, which could resolve badly from a WSL-launched PowerShell context.
- Calling the wrapper from WSL could start `cmd.exe` and then leave the actual `node.exe server.js` process as the real listener.
- The PID file could track the wrapper PID instead of the real Node server PID.
- A readiness timeout could kill or exit the wrapper while leaving the child listener around.
- WSL-side `127.0.0.1` is not the same truth source as Windows-side loopback for this Windows Node / LM Studio setup.

The durable fix in `start-lyra.ps1` is:

- resolve an absolute `node.exe`
- use that absolute path for LM Studio prepare and server startup
- track the real `node.exe server.js` process as `.lyra-server.pid`
- record the wrapper PID separately in `.lyra-server.meta.json`
- use a PowerShell readiness loop against `http://127.0.0.1:4317/api/penny/status`
- print the real server PID in the success message

## Do Not Waste Time Here

- Do not tell the user to use `localhost` on the phone. That means the phone itself.
- Do not use the WSL adapter address for phone testing.
- Do not trust `.lyra-server.pid` by itself when the port is acting weird. Inspect `Get-NetTCPConnection -LocalPort 4317`.
- Do not assume `npm run stop` cleared the port. Verify the listener.
- Do not run broad LM Studio unload/reload loops for a basic phone-access reset.
- Do not treat WSL-side localhost failures as proof that Windows-side Penny or LM Studio is down.
- Do not leave foreground diagnostic servers running. End with one normal background Penny listener.

## Fast User-Facing Summary

If this happens again, tell the user:

```text
Penny's server had gone stale. I reset the Windows-side listener on 4317, restarted Penny without reloading LM Studio, and verified the LAN status route. Use http://<current Wi-Fi IPv4>:4317 on your phone, not localhost and not the WSL adapter address.
```
