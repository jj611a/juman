#Requires -Version 5.1
<#
.SYNOPSIS
  Packaging presence gate for RC certification (AUTO-05).
.DESCRIPTION
  Verifies packaging scripts exist, .gitignore excludes binaries, and optionally
  checks whether build artifacts are present on disk (PASS only if present).
  Use -RequireArtifacts to fail when Setup/backend exe are missing.
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$RequireArtifacts
)
$ErrorActionPreference = "Stop"
$failed = 0

function Write-Check([string]$Name, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) {
    Write-Host "[PASS] $Name $(if ($Detail) { "- $Detail" })"
  } else {
    Write-Host "[FAIL] $Name $(if ($Detail) { "- $Detail" })"
    $script:failed++
  }
}

Write-Host "=== Juman certify-packaging-gate ==="
Write-Host "RepoRoot=$RepoRoot"

$scripts = @(
  "deployment\scripts\package-installer.ps1",
  "deployment\scripts\build-backend.ps1",
  "deployment\scripts\fetch-python-embed.ps1",
  "deployment\scripts\stage-backend-runtime.ps1",
  "deployment\scripts\bootstrap-backend-venv.ps1",
  "deployment\scripts\fetch-winsw.ps1",
  "deployment\scripts\fetch-postgresql.ps1",
  "deployment\scripts\post-install.ps1",
  "deployment\scripts\repair-install.ps1",
  "deployment\scripts\certify-smoke.ps1",
  "deployment\scripts\certify-packaging-gate.ps1"
)
foreach ($rel in $scripts) {
  $p = Join-Path $RepoRoot $rel
  Write-Check "Script exists: $rel" (Test-Path $p)
}

$gitignore = Join-Path $RepoRoot ".gitignore"
$gi = if (Test-Path $gitignore) { Get-Content -Raw $gitignore } else { "" }
Write-Check ".gitignore excludes frontend/release/" ($gi -match "frontend/release")
Write-Check ".gitignore excludes deployment/dist/backend/*.exe" ($gi -match "deployment/dist/backend")
Write-Check ".gitignore excludes WinSW-x64.exe" ($gi -match "WinSW-x64\.exe")
Write-Check ".gitignore excludes vendor/postgresql" ($gi -match "vendor/postgresql")

$artifacts = @(
  @{ Rel = "deployment\services\WinSW-x64.exe"; Name = "WinSW binary" },
  @{ Rel = "deployment\dist\backend\run_api.py"; Name = "run_api.py" },
  @{ Rel = "deployment\runtime\python\python.exe"; Name = "embed python" },
  @{ Rel = "deployment\scripts\bootstrap-backend-venv.ps1"; Name = "bootstrap script" }
)
$setup = Get-ChildItem -Path (Join-Path $RepoRoot "frontend\release") -Filter "Juman-Setup-*.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

foreach ($a in $artifacts) {
  $p = Join-Path $RepoRoot $a.Rel
  $present = Test-Path $p
  if ($RequireArtifacts) {
    Write-Check "Artifact present: $($a.Name)" $present $p
  } else {
    if ($present) {
      Write-Host "[PASS] Artifact present: $($a.Name) - $p"
    } else {
      Write-Host "[INFO] Artifact absent (not required without -RequireArtifacts): $p"
    }
  }
}

if ($RequireArtifacts) {
  Write-Check "Setup.exe present under frontend\release" ($null -ne $setup) $(if ($setup) { $setup.FullName } else { "none" })
} else {
  if ($setup) {
    Write-Host "[PASS] Setup.exe present - $($setup.FullName)"
  } else {
    Write-Host "[INFO] Setup.exe absent (not required without -RequireArtifacts)"
  }
}

Write-Host "=== Summary: failed=$failed ==="
if ($failed -gt 0) { exit 1 }
exit 0