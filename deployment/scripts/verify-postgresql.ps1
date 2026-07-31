#Requires -Version 5.1
<#
.SYNOPSIS
  Verify PostgreSQL 16 product after silent install. Throws with exact reasons on failure.
#>
param(
  [string]$PgPrefix = "$env:ProgramFiles\PostgreSQL\16",
  [string]$PgService = "postgresql-x64-16",
  [string]$PostgresExe = ""
)

$ErrorActionPreference = "Stop"

if (-not $PostgresExe) {
  $PostgresExe = Join-Path $PgPrefix "bin\postgres.exe"
}

$reasons = New-Object System.Collections.Generic.List[string]
$evidence = [ordered]@{
  pgPrefix = $PgPrefix
  postgresExe = $PostgresExe
  pgService = $PgService
  folderExists = $false
  postgresExeExists = $false
  serviceExists = $false
  serviceRunning = $false
  scQuery = $null
}

if (Test-Path -LiteralPath $PgPrefix) {
  $evidence.folderExists = $true
} else {
  [void]$reasons.Add("PostgreSQL folder missing: $PgPrefix")
}

if (Test-Path -LiteralPath $PostgresExe) {
  $evidence.postgresExeExists = $true
} else {
  [void]$reasons.Add("postgres.exe missing: $PostgresExe")
}

$q = sc.exe query $PgService 2>&1 | Out-String
$evidence.scQuery = $q
if ($q -match "SERVICE_NAME") {
  $evidence.serviceExists = $true
} else {
  [void]$reasons.Add("Windows service missing: $PgService")
}

if ($evidence.serviceExists) {
  if ($q -match "STATE\s*:\s*\d+\s+RUNNING") {
    $evidence.serviceRunning = $true
  } else {
    # try start once then re-query
    sc.exe start $PgService 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    $q2 = sc.exe query $PgService 2>&1 | Out-String
    $evidence.scQuery = $q2
    if ($q2 -match "STATE\s*:\s*\d+\s+RUNNING") {
      $evidence.serviceRunning = $true
    } else {
      [void]$reasons.Add("Windows service not RUNNING: $PgService")
    }
  }
}

$result = [pscustomobject]@{
  ok = ($reasons.Count -eq 0)
  reasons = @($reasons)
  evidence = $evidence
}

$json = $result | ConvertTo-Json -Depth 6 -Compress
Write-Host $json

if (-not $result.ok) {
  $msg = "PostgreSQL verification failed: " + ($reasons -join "; ")
  throw $msg
}

exit 0