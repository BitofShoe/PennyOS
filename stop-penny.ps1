$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFiles = @(
  (Join-Path $root '.penny-server.pid'),
  (Join-Path $root '.lyra-server.pid')
)
$metaFiles = @(
  (Join-Path $root '.penny-server.meta.json'),
  (Join-Path $root '.lyra-server.meta.json')
)

$stopped = $false
foreach ($pidFile in $pidFiles) {
  if (-not (Test-Path $pidFile)) {
    continue
  }
  $serverPid = Get-Content $pidFile
  if ($serverPid) {
    Stop-Process -Id $serverPid -Force
    Write-Host "Stopped Penny PID $serverPid"
    $stopped = $true
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

foreach ($metaFile in $metaFiles) {
  Remove-Item $metaFile -ErrorAction SilentlyContinue
}

if (-not $stopped) {
  Write-Host 'No Penny PID file found.'
}
