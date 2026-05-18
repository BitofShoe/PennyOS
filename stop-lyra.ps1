$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root 'stop-penny.ps1'

Write-Warning 'stop-lyra.ps1 is a compatibility alias. Use stop-penny.ps1 for PennyOS release runs.'

& $target
exit $LASTEXITCODE
