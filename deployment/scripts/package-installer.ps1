#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$SkipBuildBackend,
  [switch]$BuildReleaseZip
)
$ErrorActionPreference = "Stop"
$scripts = Join-Path $RepoRoot "deployment\scripts"

& (Join-Path $scripts "fetch-winsw.ps1")
# PostgreSQL is NOT bundled in Install Juman.exe — use build-release-zip.ps1 for the release kit.
if (-not $SkipBuildBackend) {
  & (Join-Path $scripts "build-backend.ps1") -RepoRoot $RepoRoot
}

$required = @(
  (Join-Path $RepoRoot "deployment\services\WinSW-x64.exe"),
  (Join-Path $RepoRoot "deployment\dist\backend\juman-api.exe"),
  (Join-Path $RepoRoot "deployment\installer-wizard\JumanSetupWizard.ps1")
)
foreach ($p in $required) {
  if (-not (Test-Path $p)) { throw "Required artifact missing: $p" }
}

Push-Location (Join-Path $RepoRoot "frontend")
try {
  pnpm dist:win
  if ($LASTEXITCODE -ne 0) { throw "pnpm dist:win failed with exit=$LASTEXITCODE" }
}
finally {
  Pop-Location
}
Write-Host "Installer packaging finished"

if ($BuildReleaseZip) {
  & (Join-Path $scripts "build-release-zip.ps1") -RepoRoot $RepoRoot
}