#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [string]$PgService = "postgresql-x64-16",
  [switch]$ForceBootstrap
)
$ErrorActionPreference = "Stop"
# Repair: never drop DB / wipe storage
sc.exe query $PgService | Out-Null

$boot = Join-Path $InstallDir "scripts\bootstrap-backend-venv.ps1"
if (-not (Test-Path $boot)) { throw "Missing bootstrap-backend-venv.ps1 — reinstall required" }
if (-not (Test-Path (Join-Path $InstallDir "config\juman.env"))) {
  throw "Missing config\juman.env — cannot repair without config"
}
if (-not (Test-Path (Join-Path $InstallDir "runtime\python\python.exe"))) {
  throw "Missing runtime\python — reinstall required"
}
if (-not (Test-Path (Join-Path $InstallDir "backend\JumanApi.exe"))) {
  throw "Missing JumanApi.exe (WinSW) — reinstall required"
}

$bootArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $boot, "-InstallDir", $InstallDir)
if ($ForceBootstrap) { $bootArgs += "-Force" }
& powershell.exe @bootArgs
if ($LASTEXITCODE -ne 0) { throw "bootstrap-backend-venv failed exit=$LASTEXITCODE" }

$sw = [Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt 120) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -lt 500) {
      & (Join-Path $PSScriptRoot "set-install-acls.ps1") -InstallDir $InstallDir
      Write-Host "Repair ok"
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds 2
}
throw "Repair health check failed"
