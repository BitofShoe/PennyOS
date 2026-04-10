$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root '.lyra-server.pid'
$metaFile = Join-Path $root '.lyra-server.meta.json'

if (-not (Test-Path $pidFile)) {
  Write-Host 'No Penny PID file found.'
  exit 0
}

$serverPid = Get-Content $pidFile
if ($serverPid) {
  Stop-Process -Id $serverPid -Force
  Write-Host "Stopped Penny PID $serverPid"
}

Remove-Item $pidFile -ErrorAction SilentlyContinue
Remove-Item $metaFile -ErrorAction SilentlyContinue