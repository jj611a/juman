# Fetch pinned official PostgreSQL Windows installer (do not commit the binary).
# Usage: powershell -File deployment/scripts/fetch-postgresql.ps1

param(
  [string]$Version = "16.9-1",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
if (-not $OutDir) {
  $OutDir = Join-Path $PSScriptRoot "..\vendor\postgresql"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# EnterpriseDB community Windows x86-64 installer naming
$fileName = "postgresql-$Version-windows-x64.exe"
$uri = "https://get.enterprisedb.com/postgresql/$fileName"
$dest = Join-Path $OutDir $fileName

if (Test-Path $dest) {
  Write-Host "Already present: $dest"
  exit 0
}

Write-Host "Downloading $uri ..."
Invoke-WebRequest -Uri $uri -OutFile $dest
Write-Host "Saved $dest"
Write-Host "NOTE: Review EULA / redistribution terms for your release channel."
