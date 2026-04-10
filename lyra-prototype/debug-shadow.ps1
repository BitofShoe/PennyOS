$ErrorActionPreference = 'Stop'
$openclaw = Join-Path $env:APPDATA 'npm\openclaw.cmd'
$message = @"
Say exactly: bridge ok
[MOOD:calm]
"@

& $openclaw agent --agent main --json --session-id penny-bridge-debug-ps --message $message --thinking low
