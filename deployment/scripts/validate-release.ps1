#Requires -Version 5.1
<#
.SYNOPSIS
  Validate Juman v1.0.0 release artifacts and package metadata.
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$ExpectedVersion = "1.0.0",
  [switch]$RequireArtifacts,
  [switch]$WriteChecksum,
  [switch]$UpdateBuildManifest
)
$ErrorActionPreference = "Stop"
$failed = 0

function Write-Check([string]$Name, [bool]$Ok, [string]$Detail = "") {
  if ($Ok) { Write-Host "[PASS] $Name $(if ($Detail) { "- $Detail" })" }
  else { Write-Host "[FAIL] $Name $(if ($Detail) { "- $Detail" })"; $script:failed++ }
}

Write-Host "=== validate-release v$ExpectedVersion ==="

# Package versions
$rootPkg = Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
$fePkg = Get-Content (Join-Path $RepoRoot "frontend\package.json") -Raw | ConvertFrom-Json
$py = Get-Content (Join-Path $RepoRoot "backend\pyproject.toml") -Raw
Write-Check "root package.json version" ($rootPkg.version -eq $ExpectedVersion) $rootPkg.version
Write-Check "frontend package.json version" ($fePkg.version -eq $ExpectedVersion) $fePkg.version
Write-Check "backend pyproject version" ($py -match "(?m)^version\s*=\s*`"$ExpectedVersion`"") 

$eb = Get-Content (Join-Path $RepoRoot "frontend\electron-builder.yml") -Raw
Write-Check "electron-builder win.icon" ($eb -match "icon:\s*build/icon.ico")
Write-Check "icon.ico exists" (Test-Path (Join-Path $RepoRoot "frontend\build\icon.ico"))
Write-Check "LICENSE exists" (Test-Path (Join-Path $RepoRoot "LICENSE"))

$scripts = @(
  "deployment\scripts\package-installer.ps1",
  "deployment\scripts\certify-smoke.ps1",
  "deployment\scripts\validate-release.ps1"
)
foreach ($s in $scripts) {
  Write-Check "script $s" (Test-Path (Join-Path $RepoRoot $s))
}

$docs = @(
  "docs\RELEASE_NOTES_v1.0.0.md",
  "docs\release\OPERATOR_MANUAL.md",
  "docs\release\ADMINISTRATOR_MANUAL.md",
  "docs\release\VERSION_MANIFEST.md",
  "docs\release\DEVELOPER_BUILD_MANIFEST.md",
  "docs\PRODUCTION_RELEASE_CHECKLIST.md"
)
foreach ($d in $docs) {
  Write-Check "doc $d" (Test-Path (Join-Path $RepoRoot $d))
}

$setup = Get-ChildItem -Path (Join-Path $RepoRoot "frontend\release") -Filter "Juman-Setup-$ExpectedVersion.exe" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1

$checksum = $null
if ($setup) {
  Write-Check "Setup artifact present" $true $setup.FullName
  if ($WriteChecksum -or $RequireArtifacts) {
    $hash = (Get-FileHash -Algorithm SHA256 -Path $setup.FullName).Hash.ToLowerInvariant()
    $checksum = $hash
    $sumPath = "$($setup.FullName).sha256"
    "$hash  $($setup.Name)" | Set-Content -Path $sumPath -Encoding ASCII
    Write-Check "SHA-256 written" (Test-Path $sumPath) $hash
  }
} else {
  if ($RequireArtifacts) {
    Write-Check "Setup artifact present" $false "expected frontend\release\Juman-Setup-$ExpectedVersion.exe"
  } else {
    Write-Host "[INFO] Setup artifact absent (pass without -RequireArtifacts)"
  }
}

if ($UpdateBuildManifest) {
  $git = $null
  try { $git = (git -C $RepoRoot rev-parse HEAD 2>$null).Trim() } catch {}
  $electron = [string]$fePkg.devDependencies.electron
  $manifest = [ordered]@{
    applicationVersion = $ExpectedVersion
    backendVersion     = $ExpectedVersion
    schemaVersion      = "20260802_0033_system_backups_duration"
    migrationVersion   = "20260802_0033_system_backups_duration"
    electronVersion    = $electron
    buildTimestamp     = (Get-Date).ToUniversalTime().ToString("o")
    gitCommit          = $git
    artifactName       = $(if ($setup) { $setup.Name } else { $null })
    artifactSha256     = $checksum
    productName        = "Juman"
    appId              = "com.juman.desktop"
  }
  $out = Join-Path $RepoRoot "docs\release\BUILD_MANIFEST.json"
  ($manifest | ConvertTo-Json -Depth 5) | Set-Content -Path $out -Encoding UTF8
  Write-Host "[INFO] Updated $out"
}

Write-Host "=== Summary: failed=$failed ==="
if ($failed -gt 0) { exit 1 }
exit 0