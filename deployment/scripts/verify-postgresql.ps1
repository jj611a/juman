#Requires -Version 5.1
param(
  [string]$PgPrefix = "",
  [string]$PgService = "postgresql-x64-16",
  [string]$PostgresExe = ""
)
$ErrorActionPreference = "Stop"

$ProgramFiles64 = $env:ProgramW6432
if ([string]::IsNullOrWhiteSpace($ProgramFiles64)) { $ProgramFiles64 = $env:ProgramFiles }
if (-not $PgPrefix) { $PgPrefix = Join-Path $ProgramFiles64 "PostgreSQL\16" }
if (-not $PostgresExe) { $PostgresExe = Join-Path $PgPrefix "bin\postgres.exe" }

$reasons = New-Object System.Collections.Generic.List[string]
$evidence = [ordered]@{
  programFiles64 = $ProgramFiles64
  pgPrefix = $PgPrefix
  postgresExe = $PostgresExe
  pgService = $PgService
  folderExists = $false
  postgresExeExists = $false
  serviceExists = $false
  serviceRunning = $false
  scQuery = $null
}

if (Test-Path -LiteralPath $PgPrefix) { $evidence.folderExists = $true }
else { [void]$reasons.Add("PostgreSQL folder missing: $PgPrefix") }

if (Test-Path -LiteralPath $PostgresExe) { $evidence.postgresExeExists = $true }
else { [void]$reasons.Add("postgres.exe missing: $PostgresExe") }

$sc = Join-Path $env:SystemRoot "System32\sc.exe"
$q = & $sc query $PgService 2>&1 | Out-String
$evidence.scQuery = $q
if ($q -match "SERVICE_NAME") { $evidence.serviceExists = $true }
else { [void]$reasons.Add("Windows service missing: $PgService") }

if ($evidence.serviceExists) {
  if ($q -match "STATE\s*:\s*\d+\s+RUNNING") {
    $evidence.serviceRunning = $true
  } else {
    & $sc start $PgService 2>&1 | Out-Null
    Start-Sleep -Seconds 3
    $q2 = & $sc query $PgService 2>&1 | Out-String
    $evidence.scQuery = $q2
    if ($q2 -match "STATE\s*:\s*\d+\s+RUNNING") { $evidence.serviceRunning = $true }
    else { [void]$reasons.Add("Windows service not RUNNING: $PgService") }
  }
}

$result = [pscustomobject]@{ ok = ($reasons.Count -eq 0); reasons = @($reasons); evidence = $evidence }
Write-Host ($result | ConvertTo-Json -Depth 6 -Compress)
if (-not $result.ok) { throw ("PostgreSQL verification failed: " + ($reasons -join "; ")) }
exit 0