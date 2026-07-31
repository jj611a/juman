#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$SkipBuildBackend,
  [switch]$BuildReleaseZip,
  [switch]$SkipExeSmoke
)
$ErrorActionPreference = "Stop"
$scripts = Join-Path $RepoRoot "deployment\scripts"

& (Join-Path $scripts "fetch-winsw.ps1")
# PostgreSQL is NOT bundled in Install Juman.exe - use build-release-zip.ps1 for the release kit.
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
  # Build unpacked app first so we can smoke-test Juman.exe before NSIS.
  pnpm run dist:dir
  if ($LASTEXITCODE -ne 0) { throw "pnpm run dist:dir failed with exit=$LASTEXITCODE" }
}
finally {
  Pop-Location
}

if (-not $SkipExeSmoke) {
  & (Join-Path $scripts "test-packaged-exes.ps1") -RepoRoot $RepoRoot -SkipRebuildBackend
}

Push-Location (Join-Path $RepoRoot "frontend")
try {
  # Package NSIS from already-built win-unpacked (avoids a second full Electron rebuild).
  pnpm exec electron-builder --win nsis --prepackaged release/win-unpacked
  if ($LASTEXITCODE -ne 0) { throw "electron-builder nsis failed with exit=$LASTEXITCODE" }
}
finally {
  Pop-Location
}
Write-Host "Installer packaging finished"

if ($BuildReleaseZip) {
  & (Join-Path $scripts "build-release-zip.ps1") -RepoRoot $RepoRoot
}
