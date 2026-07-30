#Requires -Version 5.1
<#
.SYNOPSIS
  Apply production ACLs so LocalSystem (JumanApi) and Administrators can manage
  the install tree, while interactive Users can use the app (read config, write storage/logs).
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir
)
$ErrorActionPreference = "Stop"

if (-not (Test-Path $InstallDir)) {
  throw "InstallDir not found: $InstallDir"
}

function Invoke-Icacls([string]$Path, [string[]]$Args) {
  if (-not (Test-Path $Path)) { return }
  & icacls.exe $Path @Args | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "icacls failed on $Path (exit=$LASTEXITCODE)"
  }
}

# Reset inheritance noise on sensitive trees, then grant explicitly.
$dirs = @(
  $InstallDir,
  (Join-Path $InstallDir "config"),
  (Join-Path $InstallDir "storage"),
  (Join-Path $InstallDir "logs"),
  (Join-Path $InstallDir "data"),
  (Join-Path $InstallDir "runtime"),
  (Join-Path $InstallDir "backend"),
  (Join-Path $InstallDir "scripts")
)
foreach ($d in $dirs) {
  New-Item -ItemType Directory -Force -Path $d | Out-Null
}

# Install root: SYSTEM + Admins full; Users read/execute (launch app, list dirs)
Invoke-Icacls $InstallDir @("/inheritance:e", "/grant:r", "SYSTEM:(OI)(CI)F", "/grant:r", "Administrators:(OI)(CI)F", "/grant:r", "Users:(OI)(CI)RX")

# Writable app data for the service (LocalSystem) and operators
foreach ($w in @("storage", "logs", "data", "runtime")) {
  $p = Join-Path $InstallDir $w
  Invoke-Icacls $p @("/inheritance:e", "/grant:r", "SYSTEM:(OI)(CI)F", "/grant:r", "Administrators:(OI)(CI)F", "/grant:r", "Users:(OI)(CI)M")
}

# Config readable by Users (Electron readEnv) + full for SYSTEM/Admins
$config = Join-Path $InstallDir "config"
Invoke-Icacls $config @("/inheritance:e", "/grant:r", "SYSTEM:(OI)(CI)F", "/grant:r", "Administrators:(OI)(CI)F", "/grant:r", "Users:(OI)(CI)RX")

# Secrets: SYSTEM + Administrators only (no Users)
foreach ($secret in @(".install-secrets.env", "install-credentials.txt")) {
  $sp = Join-Path $config $secret
  if (Test-Path $sp) {
    Invoke-Icacls $sp @("/inheritance:r", "/grant:r", "SYSTEM:F", "/grant:r", "Administrators:F")
  }
}

# juman.env must be readable by LocalSystem service and Users (status/first-run)
$envFile = Join-Path $config "juman.env"
if (Test-Path $envFile) {
  Invoke-Icacls $envFile @("/inheritance:r", "/grant:r", "SYSTEM:F", "/grant:r", "Administrators:F", "/grant:r", "Users:R")
}

Write-Host "Install ACLs applied under $InstallDir"
