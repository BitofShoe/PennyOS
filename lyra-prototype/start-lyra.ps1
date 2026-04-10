param(
  [switch]$Shadow,
  [int]$ShadowTimeoutMs = 20000
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $root 'server.js'
$pidFile = Join-Path $root '.lyra-server.pid'
$stdoutLog = Join-Path $root 'lyra-server.out.log'
$stderrLog = Join-Path $root 'lyra-server.err.log'
$metaFile = Join-Path $root '.lyra-server.meta.json'

if (Test-Path $pidFile) {
  $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
  if ($existingPid) {
    $proc = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($proc) {
      Write-Host "Penny is already running on PID $existingPid"
      exit 0
    }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

if ($Shadow) {
  $command = 'set "PENNY_OPENCLAW_ENABLED=1" && set "PENNY_OPENCLAW_TIMEOUT_MS=' + $ShadowTimeoutMs + '" && node "' + $server + '"'
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $command) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
} else {
  $proc = Start-Process -FilePath 'node' -ArgumentList @($server) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
}

$proc.Id | Set-Content $pidFile

$meta = [ordered]@{
  pid = $proc.Id
  shadow = [bool]$Shadow
  shadowTimeoutMs = $ShadowTimeoutMs
  startedAt = (Get-Date).ToString('o')
}
$meta | ConvertTo-Json | Set-Content $metaFile

Start-Sleep -Milliseconds 800

if ($proc.HasExited) {
  Write-Host 'Penny failed to start.'
  if (Test-Path $stderrLog) { Get-Content $stderrLog }
  exit 1
}

if ($Shadow) {
  Write-Host "Penny started at http://localhost:4317 (PID $($proc.Id)) [shadow ON, timeout ${ShadowTimeoutMs}ms]"
} else {
  Write-Host "Penny started at http://localhost:4317 (PID $($proc.Id)) [shadow OFF]"
}