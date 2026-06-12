param(
  [string]$Installer = "",
  [string]$InstallDir = "",
  [string]$ProofDir = "",
  [int]$Port = 4317,
  [int]$TimeoutSeconds = 45,
  [switch]$AllowDevToolsOnPath,
  [switch]$AllowExistingPenny,
  [switch]$NoScreenshot,
  [switch]$KeepInstalled
)

$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  if ($PSCommandPath) {
    $scriptDir = Split-Path -Parent $PSCommandPath
    $candidate = Join-Path $scriptDir ".."
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }
  return (Get-Location).Path
}

function Find-CommandSource {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  return $null
}

function Get-DevToolPresence {
  return [ordered]@{
    node = Find-CommandSource "node"
    npm = Find-CommandSource "npm"
    cargo = Find-CommandSource "cargo"
    rustc = Find-CommandSource "rustc"
  }
}

function Test-AnyValue {
  param($Table)
  foreach ($key in $Table.Keys) {
    if ($Table[$key]) { return $true }
  }
  return $false
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

function Get-ProcessSnapshot {
  return @(Get-CimInstance Win32_Process |
    Where-Object { $_.Name -ieq "penny-node.exe" -or $_.Name -ieq "pennyos.exe" } |
    Select-Object ProcessId, Name, CommandLine)
}

function Stop-StartedProcesses {
  param(
    [object]$MainProcess,
    [array]$SidecarPids
  )
  if ($MainProcess -and -not $MainProcess.HasExited) {
    Stop-Process -Id $MainProcess.Id -Force -ErrorAction SilentlyContinue
  }
  foreach ($sidecarPid in $SidecarPids) {
    Stop-Process -Id $sidecarPid -Force -ErrorAction SilentlyContinue
  }
}

function Save-PrimaryScreenshot {
  param([string]$Path)
  try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $bitmap.Dispose()
    return [ordered]@{ path = $Path; captured = $true; error = $null }
  } catch {
    return [ordered]@{ path = $Path; captured = $false; error = $_.Exception.Message }
  }
}

function Get-ShortcutInfo {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    return [ordered]@{ path = $Path; exists = $false; target = $null; arguments = $null; workingDirectory = $null }
  }
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($Path)
  return [ordered]@{
    path = $Path
    exists = $true
    target = $shortcut.TargetPath
    arguments = $shortcut.Arguments
    workingDirectory = $shortcut.WorkingDirectory
  }
}

function Get-SelectedFiles {
  param(
    [string]$Root,
    [string]$Pattern
  )
  if (-not (Test-Path $Root)) { return @() }
  return @(Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match $Pattern } |
    Select-Object -First 40 FullName, Length, LastWriteTime)
}

function Test-InstallDataClean {
  param([string]$Root)
  $dataDir = Join-Path $Root "penny-runtime\data"
  $files = @()
  if (Test-Path $dataDir) {
    $files = @(Get-ChildItem -LiteralPath $dataDir -File | Select-Object FullName, Length, LastWriteTime)
  }
  $bad = @($files | Where-Object { $_.FullName -notmatch "\.seed\.json$" })
  return [ordered]@{
    dataDir = $dataDir
    exists = (Test-Path $dataDir)
    files = $files
    forbiddenFiles = $bad
    clean = ($bad.Count -eq 0)
  }
}

$repoRoot = Resolve-RepoRoot
if (-not $ProofDir) {
  $ProofDir = Join-Path $repoRoot "output\tauri-clean-windows-proof"
}
if (-not $Installer) {
  $repoInstaller = Join-Path $repoRoot "output\tauri-consumer-smoke\windows-bundles\PennyOS_0.1.0_x64-setup.exe"
  $sideBySideInstaller = if ($PSCommandPath) {
    Join-Path (Split-Path -Parent $PSCommandPath) "PennyOS_0.1.0_x64-setup.exe"
  } else {
    Join-Path (Get-Location).Path "PennyOS_0.1.0_x64-setup.exe"
  }
  if (Test-Path $repoInstaller) {
    $Installer = $repoInstaller
  } else {
    $Installer = $sideBySideInstaller
  }
}
if (-not $InstallDir) {
  $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\PennyOSCleanProof"
}

New-Item -ItemType Directory -Force -Path $ProofDir | Out-Null
$ProofDir = (Resolve-Path $ProofDir).Path
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$proofPath = Join-Path $ProofDir "penny-tauri-clean-windows-proof-$stamp.json"
$serverLog = Join-Path $ProofDir "penny-tauri-clean-windows-proof-$stamp-server.log"
$screenshotPath = Join-Path $ProofDir "penny-tauri-clean-windows-proof-$stamp.png"

$installerPath = (Resolve-Path $Installer).Path
$normalPathDevTools = Get-DevToolPresence
$preExistingStatus = Test-PennyStatus -ProbePort $Port

$proof = [ordered]@{
  kind = "penny-tauri-clean-windows-proof"
  startedAt = (Get-Date).ToString("o")
  finishedAt = $null
  installer = $installerPath
  installDir = $InstallDir
  proof = $proofPath
  port = $Port
  timeoutSeconds = $TimeoutSeconds
  normalPath = $env:PATH
  normalPathDevTools = $normalPathDevTools
  requiredDevToolsAbsent = -not [bool]$AllowDevToolsOnPath
  preExistingStatusReady = $preExistingStatus.Ready
  install = $null
  shortcut = $null
  launch = $null
  screenshot = $null
  installData = $null
  appData = $null
  uninstall = $null
  verdict = "not-run"
  error = $null
}

$mainProcess = $null
$startedSidecarPids = @()
$oldPath = $env:PATH
$oldForceSidecar = $env:PENNY_TAURI_FORCE_SIDECAR
$oldPort = $env:PENNY_TAURI_PORT
$oldTimeout = $env:PENNY_TAURI_READY_TIMEOUT_MS
$oldLog = $env:PENNY_TAURI_LOG
$oldSkipPrep = $env:PENNY_SKIP_LMSTUDIO_PREP

try {
  if ((Test-AnyValue $normalPathDevTools) -and -not $AllowDevToolsOnPath) {
    throw "Clean Windows proof requires node, npm, cargo, and rustc to be absent from the normal user PATH. Re-run with -AllowDevToolsOnPath only for developer-machine rehearsal."
  }
  if ($preExistingStatus.Ready -and -not $AllowExistingPenny) {
    throw "Penny is already ready on port $Port before this proof launched it. Stop the existing server or use a different -Port."
  }

  if (Test-Path $InstallDir) {
    Remove-Item -LiteralPath $InstallDir -Recurse -Force
  }

  $installStarted = Get-Date
  $installProcess = Start-Process -FilePath $installerPath -ArgumentList @("/S", "/D=$InstallDir") -Wait -PassThru
  Start-Sleep -Seconds 2
  $proof.install = [ordered]@{
    startedAt = $installStarted.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    exitCode = $installProcess.ExitCode
    installDirExists = (Test-Path $InstallDir)
    fileCount = if (Test-Path $InstallDir) { @(Get-ChildItem -LiteralPath $InstallDir -Recurse -File).Count } else { 0 }
    keyFiles = Get-SelectedFiles -Root $InstallDir -Pattern "pennyos\.exe$|penny-node\.exe$|penny-runtime\\server\.js$|uninstall\.exe$"
  }
  if ($installProcess.ExitCode -ne 0) { throw "Installer exited with code $($installProcess.ExitCode)." }

  $shortcutPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\PennyOS.lnk"
  $shortcutInfo = Get-ShortcutInfo -Path $shortcutPath
  $proof.shortcut = $shortcutInfo
  if (-not $shortcutInfo.exists) { throw "Start Menu shortcut was not created: $shortcutPath" }
  if (-not (Test-Path $shortcutInfo.target)) { throw "Shortcut target does not exist: $($shortcutInfo.target)" }

  $env:PATH = "C:\Windows\System32;C:\Windows;C:\Windows\System32\WindowsPowerShell\v1.0"
  $strippedPathDevTools = Get-DevToolPresence
  $env:PENNY_TAURI_FORCE_SIDECAR = "1"
  $env:PENNY_TAURI_PORT = [string]$Port
  $env:PENNY_TAURI_READY_TIMEOUT_MS = [string]($TimeoutSeconds * 1000)
  $env:PENNY_TAURI_LOG = $serverLog
  $env:PENNY_SKIP_LMSTUDIO_PREP = "1"

  $launchStarted = Get-Date
  $mainProcess = Start-Process -FilePath $shortcutInfo.target -WorkingDirectory $shortcutInfo.workingDirectory -PassThru
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
    Where-Object { $_.Name -ieq "penny-node.exe" -and $_.CommandLine -match [regex]::Escape($InstallDir) } |
    Select-Object ProcessId, Name, CommandLine)
  $startedSidecarPids = @($sidecars | ForEach-Object { $_.ProcessId })
  $proof.launch = [ordered]@{
    startedAt = $launchStarted.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    launchTarget = $shortcutInfo.target
    workingDirectory = $shortcutInfo.workingDirectory
    strippedPath = $env:PATH
    strippedPathDevTools = $strippedPathDevTools
    ready = $ready
    statusCode = $statusCode
    statusBodyPreview = if ($statusBody) { $statusBody.Substring(0, [Math]::Min(500, $statusBody.Length)) } else { $null }
    processId = $mainProcess.Id
    sidecarProcesses = $sidecars
    log = $serverLog
  }
  if (-not $ready) { throw "Installed PennyOS did not become ready on port $Port." }

  Start-Sleep -Seconds 2
  if (-not $NoScreenshot) {
    $proof.screenshot = Save-PrimaryScreenshot -Path $screenshotPath
  }

  $proof.installData = Test-InstallDataClean -Root $InstallDir
  $roamingRoot = Join-Path $env:APPDATA "com.bitofshoe.pennyos"
  $localRoot = Join-Path $env:LOCALAPPDATA "com.bitofshoe.pennyos"
  $proof.appData = [ordered]@{
    roamingRoot = $roamingRoot
    roamingExists = (Test-Path $roamingRoot)
    selectedRoamingFiles = Get-SelectedFiles -Root $roamingRoot -Pattern "penny-memory|penny-open-loop|penny-pending-workspace|\.env$|penny-local-preferences"
    localRoot = $localRoot
    localExists = (Test-Path $localRoot)
    selectedLocalFiles = Get-SelectedFiles -Root $localRoot -Pattern "EBWebView|penny|log"
  }
  if (-not $proof.installData.clean) {
    throw "Packaged install directory contains writable Penny state under penny-runtime\\data."
  }

  Stop-StartedProcesses -MainProcess $mainProcess -SidecarPids $startedSidecarPids
  $mainProcess = $null
  $startedSidecarPids = @()

  $uninstallPath = Join-Path $InstallDir "uninstall.exe"
  $uninstallStarted = Get-Date
  $uninstallExitCode = $null
  if (-not $KeepInstalled) {
    if (-not (Test-Path $uninstallPath)) { throw "Uninstaller was missing: $uninstallPath" }
    $uninstallProcess = Start-Process -FilePath $uninstallPath -ArgumentList @("/S") -Wait -PassThru
    $uninstallExitCode = $uninstallProcess.ExitCode
    Start-Sleep -Seconds 2
  }
  $remainingProcesses = @(Get-ProcessSnapshot)
  $proof.uninstall = [ordered]@{
    skipped = [bool]$KeepInstalled
    startedAt = $uninstallStarted.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    uninstaller = $uninstallPath
    exitCode = $uninstallExitCode
    installDirExists = (Test-Path $InstallDir)
    shortcutExists = (Test-Path $shortcutPath)
    remainingProcesses = $remainingProcesses
  }
  if (-not $KeepInstalled) {
    if ($uninstallExitCode -ne 0) { throw "Uninstaller exited with code $uninstallExitCode." }
    if (Test-Path $InstallDir) { throw "Install directory still exists after uninstall: $InstallDir" }
    if (Test-Path $shortcutPath) { throw "Start Menu shortcut still exists after uninstall: $shortcutPath" }
    if ($remainingProcesses.Count -gt 0) { throw "Penny processes remained after uninstall." }
  }

  $proof.verdict = "passed"
} catch {
  $proof.verdict = "failed"
  $proof.error = $_.Exception.Message
  Stop-StartedProcesses -MainProcess $mainProcess -SidecarPids $startedSidecarPids
  if (-not $KeepInstalled) {
    $cleanupUninstaller = Join-Path $InstallDir "uninstall.exe"
    if (Test-Path $cleanupUninstaller) {
      try {
        $cleanupProcess = Start-Process -FilePath $cleanupUninstaller -ArgumentList @("/S") -Wait -PassThru
        Start-Sleep -Seconds 2
        $proof.uninstall = [ordered]@{
          cleanupAfterFailure = $true
          uninstaller = $cleanupUninstaller
          exitCode = $cleanupProcess.ExitCode
          installDirExists = (Test-Path $InstallDir)
          shortcutExists = (Test-Path (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\PennyOS.lnk"))
          remainingProcesses = @(Get-ProcessSnapshot)
        }
      } catch {
        $proof.uninstall = [ordered]@{
          cleanupAfterFailure = $true
          uninstaller = $cleanupUninstaller
          error = $_.Exception.Message
          installDirExists = (Test-Path $InstallDir)
          remainingProcesses = @(Get-ProcessSnapshot)
        }
      }
    }
  }
  throw
} finally {
  $env:PATH = $oldPath
  $env:PENNY_TAURI_FORCE_SIDECAR = $oldForceSidecar
  $env:PENNY_TAURI_PORT = $oldPort
  $env:PENNY_TAURI_READY_TIMEOUT_MS = $oldTimeout
  $env:PENNY_TAURI_LOG = $oldLog
  $env:PENNY_SKIP_LMSTUDIO_PREP = $oldSkipPrep

  $proof.finishedAt = (Get-Date).ToString("o")
  $proof | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $proofPath -Encoding UTF8
  $proof | ConvertTo-Json -Depth 8
}
