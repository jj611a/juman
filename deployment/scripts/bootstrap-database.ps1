#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$PgBin,
  [Parameter(Mandatory = $true)][string]$PgSuperPassword,
  [Parameter(Mandatory = $true)][string]$DbUser,
  [Parameter(Mandatory = $true)][string]$DbPassword,
  [string]$DbName = "juman",
  [string]$Host = "127.0.0.1",
  [int]$Port = 5432
)
$ErrorActionPreference = "Stop"
$psql = Join-Path $PgBin "psql.exe"
if (-not (Test-Path $psql)) { throw "psql.exe not found at $psql" }

$env:PGPASSWORD = $PgSuperPassword
$env:PGCLIENTENCODING = "UTF8"

function Invoke-Psql([string]$Sql) {
  & $psql -h $Host -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

Write-Host "Waiting for PostgreSQL accept connections..."
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    & $psql -h $Host -p $Port -U postgres -d postgres -c "SELECT 1;" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $ok = $true; break }
  } catch { }
  Start-Sleep -Seconds 2
}
if (-not $ok) { throw "PostgreSQL not reachable" }

$safeUser = $DbUser.Replace("'", "''")
$safePass = $DbPassword.Replace("'", "''")
$safeDb = $DbName.Replace("'", "''")

Invoke-Psql "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$safeUser') THEN CREATE ROLE $DbUser LOGIN PASSWORD '$safePass'; ELSE ALTER ROLE $DbUser WITH LOGIN PASSWORD '$safePass'; END IF; END `$`$;"
$exists = & $psql -h $Host -p $Port -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$safeDb'"
if ("$exists".Trim() -ne "1") {
  Invoke-Psql "CREATE DATABASE $DbName OWNER $DbUser;"
}
Invoke-Psql "GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;"
Write-Host "Database bootstrap ok"