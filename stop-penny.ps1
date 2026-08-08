$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $root 'server.js'
$pidFiles = @(
  (Join-Path $root '.penny-server.pid'),
  (Join-Path $root '.lyra-server.pid')
)
$metaFiles = @(
  (Join-Path $root '.penny-server.meta.json'),
  (Join-Path $root '.lyra-server.meta.json')
)

function Find-PennyServerProcess {
  param([int]$ProcessId = 0)
  if ($ProcessId -le 0) { return $null }
  $serverPattern = [regex]::Escape($server)
  Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" |
    Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $serverPattern } |
    Select-Object -First 1
}

$stopped = $false
foreach ($pidFile in $pidFiles) {
  if (-not (Test-Path $pidFile)) {
    continue
  }
  $serverPid = Get-Content $pidFile
  if ($serverPid) {
    $serverPidNumber = 0
    $serverProc = if ([int]::TryParse([string]$serverPid, [ref]$serverPidNumber)) {
      Find-PennyServerProcess -ProcessId $serverPidNumber
    } else {
      $null
    }
    if ($serverProc) {
      Stop-Process -Id $serverProc.ProcessId -Force
      Write-Host "Stopped Penny PID $($serverProc.ProcessId)"
      $stopped = $true
    } else {
      Write-Host "Skipped stale Penny PID $serverPid because it is not this Penny server."
    }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

foreach ($metaFile in $metaFiles) {
  Remove-Item $metaFile -ErrorAction SilentlyContinue
}

if (-not $stopped) {
  Write-Host 'No Penny PID file found.'
}
