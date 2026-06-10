[CmdletBinding()]
param(
  [switch]$DoctorOnly
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

function Add-PathDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if ((Test-Path $Path) -and ($env:Path -notlike "*$Path*")) {
    $env:Path = "$Path;$env:Path"
  }
}

function Require-Command {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$InstallHint
  )

  $Command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $Command) {
    Write-Host "Missing required command: $Name" -ForegroundColor Red
    if ($InstallHint) {
      Write-Host $InstallHint -ForegroundColor Yellow
    }
    exit 1
  }
  return $Command
}

function Test-WebView2 {
  $Paths = @(
    "HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\Software\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  )

  foreach ($Path in $Paths) {
    if (Test-Path $Path) {
      return $true
    }
  }
  return $false
}

Add-PathDirectory (Join-Path $env:USERPROFILE ".cargo\bin")

$Node = Require-Command "node" "Install Node.js 24.x and make sure it is available in this PowerShell session."
$Npm = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
if (-not $Npm) {
  $Npm = Require-Command "npm" "Install npm 11.x with Node.js 24.x."
}
$Cargo = Require-Command "cargo" "Install Rust with rustup before running the Tauri desktop shell."
$Rustc = Require-Command "rustc" "Install Rust with rustup before running the Tauri desktop shell."

if (-not (Test-WebView2)) {
  Write-Host "WebView2 was not detected by the registry probe. Modern Windows 10/11 often already has it, but Tauri may ask for it." -ForegroundColor Yellow
}

if (-not $env:PENNY_SKIP_LMSTUDIO_PREP) {
  $env:PENNY_SKIP_LMSTUDIO_PREP = "1"
}
if (-not $env:PENNY_TAURI_SERVER_ROOT) {
  $env:PENNY_TAURI_SERVER_ROOT = $RepoRoot
}

Write-Host "Node: $($Node.Source)" -ForegroundColor DarkGray
Write-Host "npm: $($Npm.Source)" -ForegroundColor DarkGray
Write-Host "cargo: $($Cargo.Source)" -ForegroundColor DarkGray
Write-Host "rustc: $($Rustc.Source)" -ForegroundColor DarkGray
Write-Host "Penny server root: $env:PENNY_TAURI_SERVER_ROOT" -ForegroundColor DarkGray
Write-Host "PENNY_SKIP_LMSTUDIO_PREP=$env:PENNY_SKIP_LMSTUDIO_PREP" -ForegroundColor DarkGray

& $Npm.Source run tauri:doctor
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if ($DoctorOnly) {
  exit 0
}

& $Npm.Source run tauri:dev
exit $LASTEXITCODE
