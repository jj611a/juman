#Requires -Version 5.1
<#
.SYNOPSIS
  Start PostgreSQL + JumanApi with elevation (UAC). Used from Electron first-run / repair.
#>
param(
  [string]$InstallDir = "$env:ProgramFiles\Juman",
  [string]$PgService = "postgresql-x64-16",
  [string]$ApiService = "JumanApi",
  [int]$HealthTimeoutSec = 90
)
$ErrorActionPreference = "Stop"

function Ensure-Service([string]$Name) {
  $q = sc.exe query $Name 2>&1 | Out-String
  if ($q -notmatch "SERVICE_NAME") {
    throw "Service '$Name' is not installed. Run Repair Juman Services as Administrator."
  }
  if ($q -match "RUNNING") { return }
  sc.exe start $Name | Out-Null
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt 60) {
    $q2 = sc.exe query $Name 2>&1 | Out-String
    if ($q2 -match "RUNNING") { return }
    Start-Sleep -Seconds 2
  }
  throw "Service '$Name' did not reach RUNNING"
}

Ensure-Service -Name $PgService
Ensure-Service -Name $ApiService

# Re-apply ACLs (safe / idempotent) when scripts are present
$acl = Join-Path $InstallDir "scripts\set-install-acls.ps1"
if (Test-Path $acl) {
  & $acl -InstallDir $InstallDir
}

$sw = [Diagnostics.Stopwatch]::StartNew()
while ($sw.Elapsed.TotalSeconds -lt $HealthTimeoutSec) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -UseBasicParsing -TimeoutSec 5
    if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
      Write-Host "OK health"
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds 2
}
throw "Health check failed after starting services"
