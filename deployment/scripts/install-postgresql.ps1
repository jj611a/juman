#Requires -Version 5.1
<#
.SYNOPSIS
  OPTIONAL ops tool: silent install (or reuse) of PostgreSQL 16 for Juman.
.NOTES
  NOT invoked by Install Juman.exe / Setup Wizard. Supported path is external
  Install PostgreSQL.exe from the release ZIP, then the WinForms wizard.
  Always target 64-bit Program Files via ProgramW6432 (NSIS is 32-bit / Wow64).
  Copies the EDB EXE to a short TEMP path before launch (EDB path-length issues).
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [string]$SecretsFile = "",
  [string]$VendorDir = "",
  [string]$PgService = "postgresql-x64-16",
  [string]$PgPrefix = "",
  [string]$PgData = "$env:ProgramData\Juman\PostgreSQL\16\data",
  [int]$Port = 5432,
  [string]$ServiceAccount = "NT AUTHORITY\NetworkService"
)
$ErrorActionPreference = "Stop"

# 64-bit Program Files even when invoked from Wow64 PowerShell
$ProgramFiles64 = $env:ProgramW6432
if ([string]::IsNullOrWhiteSpace($ProgramFiles64)) { $ProgramFiles64 = $env:ProgramFiles }
if (-not $PgPrefix) { $PgPrefix = Join-Path $ProgramFiles64 "PostgreSQL\16" }

if (-not $SecretsFile) {
  $SecretsFile = Join-Path $InstallDir "config\.install-secrets.env"
}
if (-not $VendorDir) {
  $VendorDir = Join-Path $InstallDir "resources\vendor\postgresql"
  if (-not (Test-Path $VendorDir)) {
    $VendorDir = Join-Path $InstallDir "vendor\postgresql"
  }
}

$logDir = Join-Path $InstallDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logPath = Join-Path $logDir "postgresql-install.log"

function Write-Log([string]$Message) {
  $line = "{0:o} {1}" -f (Get-Date).ToUniversalTime(), $Message
  Add-Content -Path $logPath -Value $line -Encoding UTF8
  Write-Host $Message
}

function Get-SecretMap([string]$Path) {
  $map = @{}
  if (-not (Test-Path $Path)) { throw "Secrets file missing: $Path" }
  Get-Content -Path $Path -Encoding UTF8 | ForEach-Object {
    if ($_ -match "^(.*?)=(.*)$") { $map[$matches[1]] = $matches[2] }
  }
  if (-not $map.ContainsKey("PG_SUPER_PASSWORD") -or [string]::IsNullOrWhiteSpace($map["PG_SUPER_PASSWORD"])) {
    throw "PG_SUPER_PASSWORD missing in secrets"
  }
  return $map
}

function Test-ServiceRunning([string]$Name) {
  $q = & "$env:SystemRoot\System32\sc.exe" query $Name 2>&1 | Out-String
  return ($q -match "RUNNING")
}

function Test-ServiceExists([string]$Name) {
  $q = & "$env:SystemRoot\System32\sc.exe" query $Name 2>&1 | Out-String
  return ($q -match "SERVICE_NAME")
}

function Wait-ServiceRunning([string]$Name, [int]$TimeoutSec = 180) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if (Test-ServiceRunning $Name) { return }
    if (Test-ServiceExists $Name) {
      & "$env:SystemRoot\System32\sc.exe" start $Name 2>$null | Out-Null
    }
    Start-Sleep -Seconds 2
  }
  throw "Service $Name not RUNNING after ${TimeoutSec}s"
}

function Clear-FailedPgData([string]$Path) {
  if (-not (Test-Path $Path)) { return }
  if (Test-Path (Join-Path $Path "PG_VERSION")) {
    Write-Log "WARN leaving existing cluster at $Path"
    return
  }
  Write-Log "Removing incomplete data directory $Path"
  Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
}

function Copy-InstallerToShortPath([string]$SourceExe) {
  $dir = Join-Path $env:TEMP "juman-pg-setup"
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $dest = Join-Path $dir "postgresql-setup.exe"
  Write-Log "Copying installer to short path: $dest"
  Copy-Item -LiteralPath $SourceExe -Destination $dest -Force
  return $dest
}

function Invoke-EdbInstaller([string]$ExePath, [string[]]$ArgList) {
  Write-Log ("Launching: {0} {1}" -f $ExePath, (($ArgList | ForEach-Object { if ($_ -match '\s') { '"{0}"' -f $_ } else { $_ } }) -join ' '))
  $p = Start-Process -FilePath $ExePath -ArgumentList $ArgList -WorkingDirectory (Split-Path $ExePath -Parent) -Wait -PassThru -NoNewWindow
  Write-Log "Installer exit code=$($p.ExitCode)"
  return [int]$p.ExitCode
}

Write-Log "=== install-postgresql begin InstallDir=$InstallDir ProgramFiles64=$ProgramFiles64 Prefix=$PgPrefix ==="

if (Test-ServiceRunning $PgService) {
  Write-Log "Service $PgService already RUNNING - reuse"
  exit 0
}

if (Test-ServiceExists $PgService) {
  Write-Log "Service $PgService exists - attempting start"
  try {
    Wait-ServiceRunning -Name $PgService -TimeoutSec 120
    Write-Log "Started existing $PgService"
    exit 0
  } catch {
    Write-Log "WARN existing service start failed: $($_.Exception.Message)"
  }
}

$exe = Get-ChildItem -Path $VendorDir -Filter "postgresql-*-windows-x64.exe" -ErrorAction SilentlyContinue |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $exe) {
  Write-Log "PostgreSQL installer not found under $VendorDir"
  exit 2
}
Write-Log "Using bundled installer $($exe.FullName) size=$($exe.Length)"

$map = Get-SecretMap -Path $SecretsFile
$superPassword = $map["PG_SUPER_PASSWORD"]

New-Item -ItemType Directory -Force -Path (Split-Path $PgData -Parent) | Out-Null
Clear-FailedPgData -Path $PgData

$debugTrace = Join-Path $logDir "postgresql-edb-debugtrace.log"
$shortExe = Copy-InstallerToShortPath -SourceExe $exe.FullName

$common = @(
  "--mode", "unattended",
  "--unattendedmodeui", "none",
  "--superpassword", $superPassword,
  "--servicename", $PgService,
  "--serverport", "$Port",
  "--prefix", $PgPrefix,
  "--datadir", $PgData,
  "--install_runtimes", "1",
  "--enable_acledit", "1",
  "--disable-components", "pgAdmin,stackbuilder",
  "--debugtrace", $debugTrace
)

# Attempt 1: NetworkService + English locale
$code = Invoke-EdbInstaller -ExePath $shortExe -ArgList ($common + @("--serviceaccount", $ServiceAccount, "--locale", "English, United States"))
if ($code -ne 0) {
  Clear-FailedPgData -Path $PgData
  Write-Log "WARN attempt 1 failed (exit=$code) - retry without serviceaccount/locale"
  $code = Invoke-EdbInstaller -ExePath $shortExe -ArgList $common
}

if ($code -ne 0) {
  Clear-FailedPgData -Path $PgData
  Write-Log "WARN attempt 2 failed (exit=$code) - retry with default datadir under prefix"
  $fallbackData = Join-Path $PgPrefix "data"
  Clear-FailedPgData -Path $fallbackData
  $args3 = @(
    "--mode", "unattended",
    "--unattendedmodeui", "none",
    "--superpassword", $superPassword,
    "--servicename", $PgService,
    "--serverport", "$Port",
    "--prefix", $PgPrefix,
    "--datadir", $fallbackData,
    "--install_runtimes", "1",
    "--enable_acledit", "1",
    "--disable-components", "pgAdmin,stackbuilder",
    "--debugtrace", $debugTrace
  )
  $code = Invoke-EdbInstaller -ExePath $shortExe -ArgList $args3
}

if ($code -ne 0) {
  # Capture newest installbuilder log snippet
  $temp = $env:TEMP
  $ib = Get-ChildItem -Path $temp -Filter "installbuilder_installer*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if ($ib) {
    Write-Log "EDB installbuilder log: $($ib.FullName)"
    try {
      $tail = Get-Content -LiteralPath $ib.FullName -Tail 80 -ErrorAction SilentlyContinue
      foreach ($l in $tail) { Write-Log ("IB: " + $l) }
    } catch {}
  }
  Write-Log "PostgreSQL silent install failed (exit=$code). See $logPath and $debugTrace"
  exit $code
}

Wait-ServiceRunning -Name $PgService -TimeoutSec 240
Write-Log "=== install-postgresql success ==="
exit 0