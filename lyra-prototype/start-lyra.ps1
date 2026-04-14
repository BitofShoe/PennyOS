param(
  [switch]$Shadow,
  [int]$ShadowTimeoutMs = 20000,
  [int]$Port = 4317,
  [int]$ReadyTimeoutMs = 30000
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $root 'server.js'
$pidFile = Join-Path $root '.lyra-server.pid'
$stdoutLog = Join-Path $root 'lyra-server.out.log'
$stderrLog = Join-Path $root 'lyra-server.err.log'
$metaFile = Join-Path $root '.lyra-server.meta.json'
$waitScript = Join-Path $root 'scripts\penny-wait-ready.js'
$prepareScript = Join-Path $root 'scripts\penny-lmstudio-prepare.js'
$readyUrl = "http://127.0.0.1:$Port/api/penny/status"

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

if ($env:PENNY_SKIP_LMSTUDIO_PREP -ne '1') {
  Write-Host 'Preparing LM Studio for Penny startup (best-effort)...'
  & node $prepareScript --best-effort
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'LM Studio prepare hit an unexpected error. Continuing with Penny startup anyway.'
  }
}

if ($Shadow) {
  $command = 'set "PORT=' + $Port + '" && set "PENNY_OPENCLAW_ENABLED=1" && set "PENNY_OPENCLAW_TIMEOUT_MS=' + $ShadowTimeoutMs + '" && node "' + $server + '"'
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $command) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
} else {
  $command = 'set "PORT=' + $Port + '" && node "' + $server + '"'
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $command) -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
}

$proc.Id | Set-Content $pidFile

$meta = [ordered]@{
  pid = $proc.Id
  port = $Port
  shadow = [bool]$Shadow
  shadowTimeoutMs = $ShadowTimeoutMs
  startedAt = (Get-Date).ToString('o')
}
$meta | ConvertTo-Json | Set-Content $metaFile

Start-Sleep -Milliseconds 300

if ($proc.HasExited) {
  Write-Host 'Penny failed to start.'
  if (Test-Path $stderrLog) { Get-Content $stderrLog }
  exit 1
}

& node $waitScript --url $readyUrl --timeout-ms $ReadyTimeoutMs

if ($LASTEXITCODE -ne 0) {
  Write-Host "Penny never became ready at $readyUrl."
  if (-not $proc.HasExited) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  Remove-Item $metaFile -ErrorAction SilentlyContinue
  if (Test-Path $stderrLog) { Get-Content $stderrLog }
  exit 1
}

if ($Shadow) {
  Write-Host "Penny started at http://localhost:$Port (PID $($proc.Id)) [shadow ON, timeout ${ShadowTimeoutMs}ms]"
} else {
  Write-Host "Penny started at http://localhost:$Port (PID $($proc.Id)) [shadow OFF]"
}
