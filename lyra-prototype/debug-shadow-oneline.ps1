$ErrorActionPreference = 'Stop'
$openclaw = Join-Path $env:APPDATA 'npm\openclaw.cmd'
& $openclaw agent --agent main --json --session-id penny-bridge-debug-ps-oneline --message 'Say exactly: bridge ok [MOOD:calm]' --thinking low
