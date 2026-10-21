# The demo scenario in the Chrome of this Windows computer (GPU), lower priority so the machine stays usable.
#   powershell -File scripts/e2e-local.ps1 [-Project desktop|mobile] [-Perf] [-- more playwright args]
# The stack must be up (WSL: bash scripts/dev-up.sh) and the demo data fresh (WSL: bash scripts/reset-db.sh).
param(
  [string]$Project = 'desktop',
  [switch]$Perf,
  [Parameter(ValueFromRemainingArguments = $true)] [string[]]$Rest
)
$ErrorActionPreference = 'Stop'
(Get-Process -Id $PID).PriorityClass = 'BelowNormal' # Chrome, started below, inherits it
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root 'e2e')
if ($Perf) { $env:PERF = '1' }
$env:BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { 'http://localhost:8000' }
node node_modules/@playwright/test/cli.js test -c playwright.local.config.ts "--project=$Project" @Rest
exit $LASTEXITCODE
