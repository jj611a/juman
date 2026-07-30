#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$PgSuperPassword,
  [Parameter(Mandatory = $true)][string]$DbPassword,
  [Parameter(Mandatory = $true)][string]$BootstrapPassword,
  [Parameter(Mandatory = $true)][string]$SecretKey,
  [string]$PgService = "postgresql-x64-16",
  [string]$PgPrefix = "$env:ProgramFiles\PostgreSQL\16",
  [string]$Company = "Juman",
  [switch]$SkipPgInstallWait
)
$ErrorActionPreference = "Stop"
$scripts = $PSScriptRoot

function Wait-ServiceRunning([string]$Name, [int]$TimeoutSec = 180) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    $q = sc.exe query $Name 2>$null | Out-String
    if ($q -match "RUNNING") { return }
    if ($q -match "STOPPED") { sc.exe start $Name | Out-Null }
    Start-Sleep -Seconds 2
  }
  throw "Service $Name not running"
}

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 120) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { return }
    } catch { }
    Start-Sleep -Seconds 2
  }
  throw "Health check failed: $Url"
}

if (-not $SkipPgInstallWait) {
  Wait-ServiceRunning -Name $PgService
}

$pgBin = Join-Path $PgPrefix "bin"
& (Join-Path $scripts "bootstrap-database.ps1") `
  -PgBin $pgBin `
  -PgSuperPassword $PgSuperPassword `
  -DbUser "juman" `
  -DbPassword $DbPassword `
  -DbName "juman"

New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "config") | Out-Null
$envPy = Join-Path $InstallDir "backend\juman-api.exe"
# Write env using PowerShell (no Python required on target)
$storage = (Join-Path $InstallDir "storage") -replace "\\", "/"
$installPosix = $InstallDir -replace "\\", "/"
$dbUrlUser = [uri]::EscapeDataString("juman")
$dbUrlPass = [uri]::EscapeDataString($DbPassword)
$dsn = "postgresql+asyncpg://$($dbUrlUser):$($dbUrlPass)@127.0.0.1:5432/juman"
$envPath = Join-Path $InstallDir "config\juman.env"
@(
  "APP_NAME=Juman"
  "APP_ENV=production"
  "APP_DEBUG=false"
  "SECRET_KEY=$SecretKey"
  "HOST=127.0.0.1"
  "PORT=8000"
  "DATABASE_URL=$dsn"
  "MEDIA_STORAGE_ROOT=$storage"
  "IDENTITY_BOOTSTRAP_USERNAME=admin"
  "IDENTITY_BOOTSTRAP_PASSWORD=$BootstrapPassword"
  "JUMAN_COMPANY_NAME=$Company"
  "JUMAN_TIMEZONE=Asia/Baghdad"
  "JUMAN_LANGUAGE=ar"
  "JUMAN_INSTALL_DIR=$installPosix"
  "JUMAN_DB_WAIT_TIMEOUT=180"
  "LOG_LEVEL=INFO"
  "LOG_JSON=false"
) | Set-Content -Path $envPath -Encoding UTF8

# Persist install secrets for recovery (ACL restricted by installer)
$credPath = Join-Path $InstallDir "config\install-credentials.txt"
@(
  "Generated at install — change admin password on first run."
  "IDENTITY_BOOTSTRAP_USERNAME=admin"
  "IDENTITY_BOOTSTRAP_PASSWORD=$BootstrapPassword"
  "DB_USER=juman"
  "DB_PASSWORD=$DbPassword"
) | Set-Content -Path $credPath -Encoding UTF8

$api = Join-Path $InstallDir "backend\juman-api.exe"
if (-not (Test-Path $api)) { throw "Missing juman-api.exe" }
& $api migrate
if ($LASTEXITCODE -ne 0) { throw "Migration failed exit=$LASTEXITCODE" }

$winsw = Join-Path $InstallDir "backend\JumanApi.exe"
if (-not (Test-Path $winsw)) { throw "Missing WinSW wrapper JumanApi.exe" }
& $winsw install
& $winsw start
Wait-HttpOk -Url "http://127.0.0.1:8000/health"
Write-Host "Post-install complete"