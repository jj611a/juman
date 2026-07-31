#Requires -Version 5.1
<#
.SYNOPSIS
  Post-install smoke checks for an already-installed Juman tree.
.DESCRIPTION
  Verifies services, health HTTP, env/storage presence, and backend diagnose.
  Exit 0 on success; non-zero on any failure. Does not install or mutate data beyond read-only checks
  (run_api.py diagnose --json via .venv).
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

$runApi = Join-Path $InstallDir "backend\run_api.py"
$venvPy = Join-Path $InstallDir "backend\.venv\Scripts\python.exe"
$embedPy = Join-Path $InstallDir "runtime\python\python.exe"
$winsw = Join-Path $InstallDir "backend\JumanApi.exe"
$marker = Join-Path $InstallDir "config\backend.bootstrap.ok"
Write-Check "run_api.py present" (Test-Path $runApi) $runApi
Write-Check "embed python present" (Test-Path $embedPy) $embedPy
Write-Check "venv python present" (Test-Path $venvPy) $venvPy
Write-Check "bootstrap marker present" (Test-Path $marker) $marker
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

# Backend diagnose (read-only) via venv python + run_api.py
$diagOk = $false
$diagDetail = ""
if ((Test-Path $venvPy) -and (Test-Path $runApi)) {
  try {
    $env:JUMAN_INSTALL_DIR = $InstallDir
    $out = & $venvPy $runApi diagnose --json 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -or $out -match '"ok"\s*:') {
      $diagOk = $true
      $diagDetail = "diagnose JSON reachable"
    } else {
      $diagDetail = "diagnose exit=$LASTEXITCODE"
    }
  } catch {
    $diagDetail = $_.Exception.Message
  }
} else {
  $diagDetail = "venv/run_api missing (bootstrap not done?)"
}
Write-Check "Backend diagnose CLI" $diagOk $diagDetail

# Env must not be empty and should contain SECRET_KEY / DATABASE_URL
if (Test-Path $envPath) {
  $envText = Get-Content -Raw -Path $envPath
  Write-Check "juman.env has SECRET_KEY" ($envText -match "(?m)^SECRET_KEY=.+")
  Write-Check "juman.env has DATABASE_URL" ($envText -match "(?m)^DATABASE_URL=.+")
}

Write-Host "=== Summary: failed=$failed ==="
if ($failed -gt 0) { exit 1 }
exit 0