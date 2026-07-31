#Requires -Version 5.1
<#
.SYNOPSIS
  Pre-pack smoke test for frozen backend + unpacked Electron (before NSIS/ZIP).
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$PgHost = "127.0.0.1",
  [int]$PgPort = 5432,
  [string]$PgSuperUser = "postgres",
  [string]$PgSuperPassword = "postgres",
  [switch]$SkipFrontend,
  [switch]$SkipRebuildBackend
)

$ErrorActionPreference = "Stop"
$failed = 0
function Pass([string]$m) { Write-Host "[PASS] $m" }
function Fail([string]$m) { Write-Host "[FAIL] $m"; $script:failed++ }

$apiDist = Join-Path $RepoRoot "deployment\dist\backend\juman-api.exe"
$unpacked = Join-Path $RepoRoot "frontend\release\win-unpacked\Juman.exe"

if (-not $SkipRebuildBackend) {
  & (Join-Path $RepoRoot "deployment\scripts\build-backend.ps1") -RepoRoot $RepoRoot
}

if (-not (Test-Path $apiDist)) { throw "Missing $apiDist - build backend first" }

$psql = $null
foreach ($v in @("16", "17", "15")) {
  $c = Join-Path ${env:ProgramFiles} "PostgreSQL\$v\bin\psql.exe"
  if (Test-Path $c) { $psql = $c; break }
}
if (-not $psql) { throw "psql.exe not found under Program Files\PostgreSQL" }

$env:PGPASSWORD = $PgSuperPassword
$env:PGCLIENTENCODING = "UTF8"
function Invoke-Psql([string]$Sql, [string]$Db = "postgres") {
  & $psql -h $PgHost -p $PgPort -U $PgSuperUser -d $Db -v ON_ERROR_STOP=1 -c $Sql 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "psql failed: $Sql" }
}

Write-Host "=== Preparing smoke database ==="
Invoke-Psql "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'juman_app') THEN CREATE ROLE juman_app LOGIN PASSWORD 'juman_smoke_pw'; ELSE ALTER ROLE juman_app WITH LOGIN PASSWORD 'juman_smoke_pw'; END IF; END `$`$;"
$exists = & $psql -h $PgHost -p $PgPort -U $PgSuperUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='juman_smoke'" 2>&1
if (("$exists").Trim() -ne "1") { Invoke-Psql "CREATE DATABASE juman_smoke OWNER juman_app;" }
Invoke-Psql "GRANT ALL PRIVILEGES ON DATABASE juman_smoke TO juman_app;"
Invoke-Psql "GRANT ALL ON SCHEMA public TO juman_app;" "juman_smoke"

$stage = Join-Path $RepoRoot "frontend\release\_smoke-stage"
Get-Process juman-api -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Force -Path "$stage\backend", "$stage\config", "$stage\storage", "$stage\logs", "$stage\data", "$stage\runtime" | Out-Null
Copy-Item $apiDist "$stage\backend\juman-api.exe" -Force

$utf8 = New-Object System.Text.UTF8Encoding $false
$stagePosix = ($stage -replace "\\", "/")
$lines = @(
  "APP_NAME=Juman",
  "APP_ENV=production",
  "APP_DEBUG=false",
  "SECRET_KEY=smoke-test-secret-key-not-for-prod",
  "HOST=127.0.0.1",
  "PORT=8000",
  "DATABASE_URL=postgresql+asyncpg://juman_app:juman_smoke_pw@${PgHost}:${PgPort}/juman_smoke",
  "MEDIA_STORAGE_ROOT=$stagePosix/storage",
  "IDENTITY_BOOTSTRAP_USERNAME=admin",
  "IDENTITY_BOOTSTRAP_PASSWORD=Admin123!",
  "JUMAN_COMPANY_NAME=JumanSmoke",
  "JUMAN_TIMEZONE=Asia/Baghdad",
  "JUMAN_LANGUAGE=ar",
  "JUMAN_INSTALL_DIR=$stagePosix",
  "JUMAN_DB_WAIT_TIMEOUT=60",
  "LOG_LEVEL=INFO",
  "LOG_JSON=false"
)
[IO.File]::WriteAllLines((Join-Path $stage "config\juman.env"), $lines, $utf8)
$env:JUMAN_INSTALL_DIR = $stage

Write-Host "=== Backend: diagnose ==="
$p = Start-Process -FilePath "$stage\backend\juman-api.exe" -ArgumentList @("diagnose", "--json") -WorkingDirectory "$stage\backend" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$stage\logs\diagnose.out" -RedirectStandardError "$stage\logs\diagnose.err"
$dout = Get-Content "$stage\logs\diagnose.out" -Raw -ErrorAction SilentlyContinue
if ($p.ExitCode -eq 0 -and $dout -match '"ok":\s*true') { Pass "diagnose ok" } else { Fail "diagnose exit=$($p.ExitCode) $dout" }

Write-Host "=== Backend: migrate ==="
$p = Start-Process -FilePath "$stage\backend\juman-api.exe" -ArgumentList @("migrate") -WorkingDirectory "$stage\backend" -Wait -PassThru -NoNewWindow -RedirectStandardOutput "$stage\logs\migrate.out" -RedirectStandardError "$stage\logs\migrate.err"
if ($p.ExitCode -eq 0) { Pass "migrate ok" } else { Fail "migrate exit=$($p.ExitCode)"; Get-Content "$stage\logs\migrate.err" -ErrorAction SilentlyContinue }

Write-Host "=== Backend: health ==="
Get-Process juman-api -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1
$api = Start-Process -FilePath "$stage\backend\juman-api.exe" -WorkingDirectory "$stage\backend" -PassThru -WindowStyle Hidden -RedirectStandardOutput "$stage\logs\api.out" -RedirectStandardError "$stage\logs\api.err"
$ok = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { Start-Sleep 1 }
}
if ($ok) { Pass "health 200" } else { Fail "health failed"; Get-Content "$stage\logs\api.err" -Tail 30 -ErrorAction SilentlyContinue }

if (-not $SkipFrontend) {
  Write-Host "=== Frontend: ensure win-unpacked ==="
  if (-not (Test-Path $unpacked)) {
    Push-Location (Join-Path $RepoRoot "frontend")
    try {
      pnpm run dist:dir
      if ($LASTEXITCODE -ne 0) { throw "pnpm run dist:dir failed" }
    } finally { Pop-Location }
  }
  if (-not (Test-Path $unpacked)) { Fail "win-unpacked\Juman.exe missing" }
  else {
    $fe = Start-Process -FilePath $unpacked -ArgumentList @("--diagnostics") -WorkingDirectory (Split-Path $unpacked) -PassThru -WindowStyle Minimized
    Start-Sleep 8
    if ($fe.HasExited) {
      Fail "Juman.exe exited early code=$($fe.ExitCode) - check requestedExecutionLevel=asInvoker"
    } else {
      Pass "Juman.exe stayed running (pid=$($fe.Id))"
      Stop-Process -Id $fe.Id -Force -ErrorAction SilentlyContinue
    }
  }
}

Get-Process juman-api -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

Write-Host "=== Summary failed=$failed ==="
if ($failed -gt 0) { exit 1 }
exit 0
