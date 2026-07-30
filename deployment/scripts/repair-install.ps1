#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [string]$PgService = "postgresql-x64-16"
)
$ErrorActionPreference = "Stop"
# Repair: never drop DB / wipe storage
sc.exe query $PgService | Out-Null
$api = Join-Path $InstallDir "backend\juman-api.exe"
$winsw = Join-Path $InstallDir "backend\JumanApi.exe"
if (-not (Test-Path $api)) { throw "Missing juman-api.exe — reinstall required" }
if (-not (Test-Path $winsw)) { throw "Missing JumanApi.exe — reinstall required" }
if (-not (Test-Path (Join-Path $InstallDir "config\juman.env"))) {
  throw "Missing config\juman.env — cannot repair without config"
}
& $api migrate
& $winsw stop 2>$null
& $winsw uninstall 2>$null
& $winsw install
& $winsw start
$sw = [Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt 120) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -lt 500) {
      & (Join-Path $PSScriptRoot "set-install-acls.ps1") -InstallDir $InstallDir
      Write-Host "Repair ok"
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds 2
}
throw "Repair health check failed"