#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$SkipStageBackend,
  [switch]$SkipFetchPython,
  [switch]$BuildReleaseZip,
  [switch]$SkipExeSmoke
)
$ErrorActionPreference = "Stop"
$scripts = Join-Path $RepoRoot "deployment\scripts"

& (Join-Path $scripts "fetch-winsw.ps1")
# PostgreSQL is NOT bundled in Install Juman.exe - use build-release-zip.ps1 for the release kit.

if (-not $SkipFetchPython) {
  & (Join-Path $scripts "fetch-python-embed.ps1") -RepoRoot $RepoRoot
}
if (-not $SkipStageBackend) {
  & (Join-Path $scripts "stage-backend-runtime.ps1") -RepoRoot $RepoRoot
}

$required = @(
  (Join-Path $RepoRoot "deployment\services\WinSW-x64.exe"),
  (Join-Path $RepoRoot "deployment\runtime\python\python.exe"),
  (Join-Path $RepoRoot "deployment\dist\backend\run_api.py"),
  (Join-Path $RepoRoot "deployment\dist\backend\requirements.txt"),
  (Join-Path $RepoRoot "deployment\dist\backend\app"),
  (Join-Path $RepoRoot "deployment\installer-wizard\JumanSetupWizard.ps1"),
  (Join-Path $RepoRoot "deployment\scripts\bootstrap-backend-venv.ps1")
)
foreach ($p in $required) {
  if (-not (Test-Path $p)) { throw "Required artifact missing: $p" }
}

Push-Location (Join-Path $RepoRoot "frontend")
try {
  pnpm run dist:dir
  if ($LASTEXITCODE -ne 0) { throw "pnpm run dist:dir failed with exit=$LASTEXITCODE" }
}
finally {
  Pop-Location
}

if (-not $SkipExeSmoke) {
  # SkipService: avoid registering machine-wide JumanApi during packaging smoke.
  & (Join-Path $scripts "test-packaged-exes.ps1") -RepoRoot $RepoRoot -SkipRebuildBackend -SkipService
}

Push-Location (Join-Path $RepoRoot "frontend")
try {
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
