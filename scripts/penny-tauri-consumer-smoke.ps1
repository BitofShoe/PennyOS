param(
  [string]$Exe = "",
  [int]$Port = 4457,
  [int]$TimeoutSeconds = 45,
  [string]$ProofDir = "",
  [switch]$KeepAppRunning
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  $scriptDir = Split-Path -Parent $PSCommandPath
  return (Resolve-Path (Join-Path $scriptDir "..")).Path
}

function Find-CommandSource {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return $null
}

function Test-PennyStatus {
  param([int]$ProbePort)
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$ProbePort/api/penny/status" -UseBasicParsing -TimeoutSec 2
    $body = [string]$response.Content
    $parsed = $body | ConvertFrom-Json -ErrorAction SilentlyContinue
    return [pscustomobject]@{
      Ready = ([int]$response.StatusCode -eq 200 -and $parsed.name -eq "Penny")
      StatusCode = [int]$response.StatusCode
      Body = $body
    }
  } catch {
    return [pscustomobject]@{
      Ready = $false
      StatusCode = $null
      Body = $null
    }
  }
}

$repoRoot = Resolve-RepoRoot
if (-not $Exe) {
  $Exe = Join-Path $repoRoot "src-tauri\target\release\pennyos.exe"
}
if (-not $ProofDir) {
  $ProofDir = Join-Path $repoRoot "output\tauri-consumer-smoke"
}

$exePath = (Resolve-Path $Exe).Path
New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $ProofDir "penny-tauri-consumer-smoke-$stamp.log"
$jsonPath = Join-Path $ProofDir "penny-tauri-consumer-smoke-$stamp.json"

$oldPath = $env:PATH
$oldForceSidecar = $env:PENNY_TAURI_FORCE_SIDECAR
$oldPort = $env:PENNY_TAURI_PORT
$oldTimeout = $env:PENNY_TAURI_READY_TIMEOUT_MS
$oldLog = $env:PENNY_TAURI_LOG
$oldSkipPrep = $env:PENNY_SKIP_LMSTUDIO_PREP

$process = $null
$startedSidecarPids = @()

try {
  $env:PATH = "C:\Windows\System32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0"
  $toolPresence = [ordered]@{
    node = Find-CommandSource "node"
    npm = Find-CommandSource "npm"
    cargo = Find-CommandSource "cargo"
    rustc = Find-CommandSource "rustc"
  }

  $env:PENNY_TAURI_FORCE_SIDECAR = "1"
  $env:PENNY_TAURI_PORT = [string]$Port
  $env:PENNY_TAURI_READY_TIMEOUT_MS = [string]($TimeoutSeconds * 1000)
  $env:PENNY_TAURI_LOG = $logPath
  $env:PENNY_SKIP_LMSTUDIO_PREP = "1"

  $startedAt = Get-Date
  $process = Start-Process -FilePath $exePath -WorkingDirectory $env:TEMP -PassThru

  $ready = $false
  $statusCode = $null
  $statusBody = $null
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $probe = Test-PennyStatus -ProbePort $Port
    $statusCode = $probe.StatusCode
    $statusBody = $probe.Body
    if ($probe.Ready) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }

  $sidecars = @(Get-CimInstance Win32_Process |
    Where-Object { $_.Name -ieq "penny-node.exe" } |
    Select-Object ProcessId, Name, CommandLine)
  $startedSidecarPids = @($sidecars | ForEach-Object { $_.ProcessId })

  $proof = [ordered]@{
    kind = "penny-tauri-consumer-style-release-exe-smoke"
    startedAt = $startedAt.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    exe = $exePath
    strippedPath = $env:PATH
    devToolsOnPath = $toolPresence
    port = $Port
    ready = $ready
    statusCode = $statusCode
    statusBodyPreview = if ($statusBody) { $statusBody.Substring(0, [Math]::Min(500, $statusBody.Length)) } else { $null }
    log = $logPath
    proof = $jsonPath
    processId = $process.Id
    sidecarProcesses = $sidecars
    keptAppRunning = [bool]$KeepAppRunning
  }

  $proof | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
  $proof | ConvertTo-Json -Depth 6

  if (-not $ready) {
    exit 2
  }
} finally {
  if (-not $KeepAppRunning) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
    foreach ($sidecarPid in $startedSidecarPids) {
      Stop-Process -Id $sidecarPid -Force -ErrorAction SilentlyContinue
    }
  }

  $env:PATH = $oldPath
  $env:PENNY_TAURI_FORCE_SIDECAR = $oldForceSidecar
  $env:PENNY_TAURI_PORT = $oldPort
  $env:PENNY_TAURI_READY_TIMEOUT_MS = $oldTimeout
  $env:PENNY_TAURI_LOG = $oldLog
  $env:PENNY_SKIP_LMSTUDIO_PREP = $oldSkipPrep
}
