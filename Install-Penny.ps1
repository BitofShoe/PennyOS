param(
  [switch]$Start,
  [switch]$SkipNpmInstall,
  [switch]$NoShortcut,
  [switch]$ForceEnv,
  [int]$Port = 4317
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 3.0

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root '.env'
$envExample = Join-Path $root '.env.example'
$startScript = Join-Path $root 'start-penny.ps1'
$stopScript = Join-Path $root 'stop-penny.ps1'
$pennyUrl = "http://localhost:$Port/"

function Write-Step {
  param([string]$Message)
  Write-Host "[Penny installer] $Message"
}

function Write-Warn {
  param([string]$Message)
  Write-Host "[Penny installer] WARNING: $Message" -ForegroundColor Yellow
}

function Stop-Install {
  param([string]$Message)
  throw "[Penny installer] $Message"
}

function Test-IsWindows {
  try {
    return [System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform(
      [System.Runtime.InteropServices.OSPlatform]::Windows
    )
  } catch {
    return $env:OS -eq 'Windows_NT'
  }
}

function Resolve-FirstCommand {
  param([string[]]$Names)
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
      return $command.Source
    }
  }
  return $null
}

function Get-MajorVersion {
  param([string]$VersionText)
  $match = [regex]::Match($VersionText, 'v?(\d+)')
  if (-not $match.Success) {
    Stop-Install "Could not parse version from '$VersionText'."
  }
  return [int]$match.Groups[1].Value
}

function Invoke-NativeProcess {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )

  $stdoutFile = [System.IO.Path]::GetTempFileName()
  $stderrFile = [System.IO.Path]::GetTempFileName()
  try {
    $proc = Start-Process `
      -FilePath $FilePath `
      -ArgumentList $Arguments `
      -WorkingDirectory $root `
      -Wait `
      -PassThru `
      -RedirectStandardOutput $stdoutFile `
      -RedirectStandardError $stderrFile
    $stdout = if (Test-Path $stdoutFile) { Get-Content -Raw $stdoutFile } else { '' }
    $stderr = if (Test-Path $stderrFile) { Get-Content -Raw $stderrFile } else { '' }
    return [pscustomobject]@{
      ExitCode = [int]$proc.ExitCode
      Stdout = [string]$stdout
      Stderr = [string]$stderr
    }
  } finally {
    Remove-Item $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-CaptureNative {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )
  $result = Invoke-NativeProcess -FilePath $FilePath -Arguments $Arguments
  $output = (@($result.Stdout, $result.Stderr) -join "`n").Trim()
  if ($result.ExitCode -ne 0) {
    Stop-Install "$FilePath $($Arguments -join ' ') failed: $output"
  }
  return $output
}

function Invoke-LoggedNative {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )
  Write-Step "$FilePath $($Arguments -join ' ')"
  $result = Invoke-NativeProcess -FilePath $FilePath -Arguments $Arguments
  if ($result.Stdout) { Write-Host $result.Stdout.TrimEnd() }
  if ($result.Stderr) { Write-Host $result.Stderr.TrimEnd() }
  if ($result.ExitCode -ne 0) {
    Stop-Install "$FilePath $($Arguments -join ' ') failed with exit code $($result.ExitCode)."
  }
}

function Ensure-ReleaseFiles {
  $required = @(
    'package.json',
    'server.js',
    '.env.example',
    'start-penny.ps1',
    'stop-penny.ps1',
    'public\index.html'
  )
  $missing = @()
  foreach ($rel in $required) {
    if (-not (Test-Path (Join-Path $root $rel))) {
      $missing += $rel
    }
  }
  if ($missing.Count -gt 0) {
    Stop-Install "This does not look like a complete PennyOS release. Missing: $($missing -join ', ')"
  }
}

function Ensure-EnvFile {
  if ((Test-Path $envFile) -and -not $ForceEnv) {
    Write-Step ".env already exists; leaving it alone."
    return
  }

  if (-not (Test-Path $envExample)) {
    Stop-Install '.env.example is missing.'
  }

  if ((Test-Path $envFile) -and $ForceEnv) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $root ".env.backup-$stamp"
    Copy-Item $envFile $backup
    Write-Warn "Backed up existing .env to $backup before replacing it."
  }

  Copy-Item $envExample $envFile -Force
  Write-Step 'Created .env from .env.example.'
}

function New-PennyShortcut {
  param(
    [string]$Directory,
    [string]$Name,
    [string]$TargetPath,
    [string]$Arguments = '',
    [string]$WorkingDirectory = $root
  )
  if (-not $Directory) { return }
  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut((Join-Path $Directory $Name))
  $shortcut.TargetPath = $TargetPath
  $shortcut.Arguments = $Arguments
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Description = 'PennyOS local companion'
  $shortcut.Save()
}

function New-PennyUrlShortcut {
  param([string]$Directory)
  if (-not $Directory) { return }
  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $urlFile = Join-Path $Directory 'PennyOS Open.url'
  "[InternetShortcut]`r`nURL=$pennyUrl`r`n" | Set-Content -Encoding ASCII $urlFile
}

function Install-Shortcuts {
  if ($NoShortcut) {
    Write-Step 'Skipping shortcuts because -NoShortcut was provided.'
    return
  }
  if (-not (Test-IsWindows)) {
    Write-Warn 'Shortcut creation is only supported on Windows.'
    return
  }

  $powershellExe = Resolve-FirstCommand @('pwsh.exe', 'powershell.exe')
  if (-not $powershellExe) {
    Write-Warn 'Could not find PowerShell for shortcut targets.'
    return
  }

  $startArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$startScript`" -Port $Port"
  $stopArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$stopScript`""
  $desktop = [Environment]::GetFolderPath('DesktopDirectory')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\PennyOS'

  foreach ($directory in @($desktop, $startMenu)) {
    New-PennyShortcut -Directory $directory -Name 'PennyOS Start.lnk' -TargetPath $powershellExe -Arguments $startArgs
    New-PennyShortcut -Directory $directory -Name 'PennyOS Stop.lnk' -TargetPath $powershellExe -Arguments $stopArgs
    New-PennyUrlShortcut -Directory $directory
  }

  Write-Step 'Created PennyOS Start, Stop, and Open shortcuts on the desktop and Start Menu.'
}

Push-Location $root
try {
  Write-Step "Installing PennyOS from $root"

  if (-not (Test-IsWindows)) {
    Stop-Install 'This installer is for Windows source ZIP users. On macOS/Linux, run: npm ci; cp .env.example .env; npm start'
  }

  Ensure-ReleaseFiles

  $nodeExe = Resolve-FirstCommand @('node.exe', 'node')
  if (-not $nodeExe) {
    Stop-Install 'Node.js is missing. Install Node.js 24.x from https://nodejs.org/ and rerun this installer.'
  }
  $nodeVersion = Invoke-CaptureNative -FilePath $nodeExe -Arguments @('--version')
  if ((Get-MajorVersion $nodeVersion) -ne 24) {
    Stop-Install "PennyOS requires Node.js 24.x. Found $nodeVersion. Install Node.js 24.x from https://nodejs.org/ and rerun this installer."
  }
  Write-Step "Found Node.js $nodeVersion."

  $npmExe = Resolve-FirstCommand @('npm.cmd', 'npm')
  if (-not $npmExe) {
    Stop-Install 'npm is missing. Reinstall Node.js 24.x with npm enabled, then rerun this installer.'
  }
  $npmVersion = Invoke-CaptureNative -FilePath $npmExe -Arguments @('-v')
  if ((Get-MajorVersion $npmVersion) -ne 11) {
    Stop-Install "PennyOS requires npm 11.x. Found npm $npmVersion. Install Node.js 24.x or update npm to 11.x, then rerun this installer."
  }
  Write-Step "Found npm $npmVersion."

  Ensure-EnvFile

  if (-not $SkipNpmInstall) {
    Invoke-LoggedNative -FilePath $npmExe -Arguments @('ci')
  } else {
    Write-Step 'Skipping npm ci because -SkipNpmInstall was provided.'
  }

  Install-Shortcuts

  Write-Step 'Install complete.'
  Write-Host ''
  Write-Host 'Next steps:'
  Write-Host '  1. Start your configured local model server (LM Studio by default) and enable its OpenAI-compatible API.'
  Write-Host '  2. Start Penny with the PennyOS Start shortcut or:'
  Write-Host '     powershell -ExecutionPolicy Bypass -File .\start-penny.ps1'
  Write-Host "  3. Open $pennyUrl"
  Write-Host ''
  Write-Host 'Optional check: npm run doctor'

  if ($Start) {
    $powershellExe = Resolve-FirstCommand @('pwsh.exe', 'powershell.exe')
    if (-not $powershellExe) {
      Stop-Install 'Could not find PowerShell to start Penny.'
    }
    Invoke-LoggedNative -FilePath $powershellExe -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $startScript, '-Port', [string]$Port)
    Start-Process $pennyUrl
  }
} finally {
  Pop-Location
}
