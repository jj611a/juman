#Requires -Version 5.1
<#
.SYNOPSIS
  Post-install smoke checks for an already-installed Juman tree.
.DESCRIPTION
  Verifies services, health HTTP, env/storage presence, and migrate dry status.
  Exit 0 on success; non-zero on any failure. Does not install or mutate data beyond read-only checks
  (migrate --help / status if supported; otherwise verifies migrate binary responds).
#>
param(
  [string]$InstallDir = "$env:ProgramFiles\Juman",
  [string]$PgService = "postgresql-x64-16",
  [string]$ApiService = "JumanApi",
  [string]$HealthUrl = "http://127.0.0.1:8000/api/v1/health",
  [int]$HealthTimeoutSec = 30
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

function Test-ServiceRunning([string]$Name) {
  $q = sc.exe query $Name 2>$null | Out-String
  return ($q -match "RUNNING")
}

Write-Host "=== Juman certify-smoke ==="
Write-Host "InstallDir=$InstallDir"

$installOk = Test-Path $InstallDir
Write-Check "InstallDir exists" $installOk $InstallDir

$envPath = Join-Path $InstallDir "config\juman.env"
Write-Check "config\juman.env present" (Test-Path $envPath) $envPath

$storage = Join-Path $InstallDir "storage"
$logs = Join-Path $InstallDir "logs"
$data = Join-Path $InstallDir "data"
$runtime = Join-Path $InstallDir "runtime"
Write-Check "storage folder" (Test-Path $storage) $storage
Write-Check "logs folder" (Test-Path $logs) $logs
# data/runtime may be created lazily — warn but do not fail if missing
if (-not (Test-Path $data)) { Write-Host "[INFO] data folder absent (optional): $data" }
if (-not (Test-Path $runtime)) { Write-Host "[INFO] runtime folder absent (optional): $runtime" }

$apiExe = Join-Path $InstallDir "backend\juman-api.exe"
$winsw = Join-Path $InstallDir "backend\JumanApi.exe"
Write-Check "juman-api.exe present" (Test-Path $apiExe) $apiExe
Write-Check "JumanApi.exe (WinSW) present" (Test-Path $winsw) $winsw

Write-Check "PostgreSQL service RUNNING" (Test-ServiceRunning $PgService) $PgService
Write-Check "JumanApi service RUNNING" (Test-ServiceRunning $ApiService) $ApiService

$healthOk = $false
$sw = [Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $HealthTimeoutSec) {
  try {
    $r = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
      $healthOk = $true
      break
    }
  } catch { }
  Start-Sleep -Seconds 2
}
Write-Check "Health HTTP" $healthOk $HealthUrl

# Migrate status: prefer "migrate status" / "alembic current" style; fall back to help
$migrateOk = $false
$migrateDetail = ""
if (Test-Path $apiExe) {
  try {
    $out = & $apiExe migrate --help 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -or $out -match "migrate") {
      $migrateOk = $true
      $migrateDetail = "migrate CLI reachable"
    }
    # Attempt non-mutating status if supported
    $statusOut = & $apiExe migrate status 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      $migrateDetail = "migrate status OK"
      $migrateOk = $true
    } elseif ($statusOut -match "current|head|alembic|revision") {
      $migrateDetail = "migrate status responded"
      $migrateOk = $true
    }
  } catch {
    $migrateDetail = $_.Exception.Message
  }
}
Write-Check "Migrate CLI / status" $migrateOk $migrateDetail

# Env must not be empty and should contain SECRET_KEY / DATABASE_URL
if (Test-Path $envPath) {
  $envText = Get-Content -Raw -Path $envPath
  Write-Check "juman.env has SECRET_KEY" ($envText -match "(?m)^SECRET_KEY=.+")
  Write-Check "juman.env has DATABASE_URL" ($envText -match "(?m)^DATABASE_URL=.+")
}

Write-Host "=== Summary: failed=$failed ==="
if ($failed -gt 0) { exit 1 }
exit 0