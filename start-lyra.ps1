param(
  [switch]$Shadow,
  [int]$ShadowTimeoutMs = 20000,
  [int]$Port = 4317,
  [int]$ReadyTimeoutMs = 30000
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root 'start-penny.ps1'

Write-Warning 'start-lyra.ps1 is a compatibility alias. Use start-penny.ps1 for PennyOS release runs.'

& $target -Shadow:$Shadow -ShadowTimeoutMs $ShadowTimeoutMs -Port $Port -ReadyTimeoutMs $ReadyTimeoutMs
exit $LASTEXITCODE
