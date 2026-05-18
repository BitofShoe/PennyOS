param(
  [switch]$Shadow,
  [int]$ShadowTimeoutMs = 20000,
  [int]$Port = 0,
  [int]$ReadyTimeoutMs = 30000
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $root 'server.js'
$pidFile = Join-Path $root '.penny-server.pid'
$stdoutLog = Join-Path $root 'penny-server.out.log'
$stderrLog = Join-Path $root 'penny-server.err.log'
$metaFile = Join-Path $root '.penny-server.meta.json'
$envFile = Join-Path $root '.env'
$localEnvFile = Join-Path $root '.penny-local-env.ps1'
$legacyLocalEnvFile = Join-Path $root '.lyra-local-env.ps1'
$prepareScript = Join-Path $root 'scripts\penny-lmstudio-prepare.js'
$nodeCommand = Get-Command 'node.exe' -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:ProgramFiles 'nodejs\node.exe' }

if (-not (Test-Path $nodeExe)) {
  throw "Could not find node.exe. Install Node.js or add node.exe to PATH."
}

function Import-PennyDotEnv {
  param([string]$Path)
  if (-not (Test-Path $Path)) { return }
  Write-Host "Loading Penny .env from $Path"
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $entry = $trimmed -replace '^export\s+', ''
    $equals = $entry.IndexOf('=')
    if ($equals -le 0) { continue }
    $key = $entry.Substring(0, $equals).Trim()
    if ($key -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
    if ($null -ne [Environment]::GetEnvironmentVariable($key, 'Process')) { continue }
    $value = $entry.Substring($equals + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    } else {
      $value = ($value -replace '\s+#.*$', '').Trim()
    }
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
  }
}

Import-PennyDotEnv -Path $envFile

if (Test-Path $localEnvFile) {
  Write-Host "Loading Penny local environment overlay from $localEnvFile"
  . $localEnvFile
} elseif (Test-Path $legacyLocalEnvFile) {
  Write-Host "Loading legacy Lyra local environment overlay from $legacyLocalEnvFile"
  . $legacyLocalEnvFile
}

$envPort = 0
if ($env:PORT) {
  [void][int]::TryParse($env:PORT, [ref]$envPort)
}
$effectivePort = if ($PSBoundParameters.ContainsKey('Port') -and $Port -gt 0) {
  $Port
} elseif ($envPort -gt 0) {
  $envPort
} else {
  4317
}
$env:PORT = [string]$effectivePort
$readyUrl = "http://127.0.0.1:$effectivePort/api/penny/status"

function Wait-PennyReady {
  param(
    [string]$Url,
    [int]$TimeoutMs
  )

  $deadline = (Get-Date).AddMilliseconds($TimeoutMs)
  $lastError = ''

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri $Url
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "Penny is ready at $Url."
        return $true
      }
      $lastError = "status $($response.StatusCode)"
    } catch {
      $lastError = $_.Exception.Message
    }

    Start-Sleep -Milliseconds 500
  }

  if ($lastError) {
    Write-Host "Last readiness error: $lastError"
  }
  return $false
}

function Find-PennyServerProcess {
  $serverPattern = [regex]::Escape($server)
  Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match $serverPattern } |
    Sort-Object CreationDate -Descending |
    Select-Object -First 1
}

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
  & $nodeExe $prepareScript --best-effort
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'LM Studio prepare hit an unexpected error. Continuing with Penny startup anyway.'
  }
}

$commandParts = @('set "PORT=' + $effectivePort + '"')
if ($Shadow) {
  $commandParts += 'set "PENNY_OPENCLAW_ENABLED=1"'
  $commandParts += 'set "PENNY_OPENCLAW_TIMEOUT_MS=' + $ShadowTimeoutMs + '"'
}

$commandParts += '"' + $nodeExe + '" "' + $server + '"'
$command = ($commandParts -join ' && ') + ' > "' + $stdoutLog + '" 2> "' + $stderrLog + '"'
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $command) -WorkingDirectory $root -WindowStyle Hidden -PassThru

$serverProc = $null
for ($i = 0; $i -lt 25 -and -not $serverProc; $i++) {
  Start-Sleep -Milliseconds 200
  $serverProc = Find-PennyServerProcess
}

if (-not $serverProc) {
  Write-Host 'Penny failed to start.'
  if (Test-Path $stderrLog) { Get-Content $stderrLog }
  exit 1
}

$serverPid = $serverProc.ProcessId
$serverPid | Set-Content $pidFile

$meta = [ordered]@{
  pid = $serverPid
  wrapperPid = $proc.Id
  port = $effectivePort
  shadow = [bool]$Shadow
  shadowTimeoutMs = $ShadowTimeoutMs
  startedAt = (Get-Date).ToString('o')
  startMethod = 'absolute-node'
}
$meta | ConvertTo-Json | Set-Content $metaFile

if (-not (Wait-PennyReady -Url $readyUrl -TimeoutMs $ReadyTimeoutMs)) {
  Write-Host "Penny never became ready at $readyUrl."
  Stop-Process -Id $serverPid -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
  Remove-Item $pidFile -ErrorAction SilentlyContinue
  Remove-Item $metaFile -ErrorAction SilentlyContinue
  if (Test-Path $stderrLog) { Get-Content $stderrLog }
  exit 1
}

if ($Shadow) {
  Write-Host "Penny started at http://localhost:$effectivePort (PID $serverPid) [shadow ON, timeout ${ShadowTimeoutMs}ms]"
} else {
  Write-Host "Penny started at http://localhost:$effectivePort (PID $serverPid) [shadow OFF]"
}
