#Requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$InstallDir)
$ErrorActionPreference = "Stop"
$secrets = Join-Path $InstallDir "config\.install-secrets.env"
$pgPass = $null
if (Test-Path $secrets) {
  Get-Content $secrets | ForEach-Object {
    if ($_ -match "^PG_SUPER_PASSWORD=(.*)$") { $pgPass = $matches[1] }
  }
}
$psql = "$env:ProgramFiles\PostgreSQL\16\bin\psql.exe"
if (-not (Test-Path $psql)) { throw "psql not found" }
if (-not $pgPass) { throw "PG super password unknown — cannot drop safely" }
$env:PGPASSWORD = $pgPass
& $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='juman' AND pid <> pg_backend_pid();"
& $psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS juman;"
Write-Host "Dropped database juman"