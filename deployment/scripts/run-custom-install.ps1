#Requires -Version 5.1
<#
.SYNOPSIS
  Thin launcher for the elevated WinForms setup wizard (external PostgreSQL).
  Kept for Repair/shortcuts and ops; NSIS invokes JumanSetupWizard.ps1 directly.
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = "Stop"

$wizard = Join-Path $InstallDir "installer-wizard\JumanSetupWizard.ps1"
if (-not (Test-Path -LiteralPath $wizard)) {
  $wizard = Join-Path $PSScriptRoot "..\installer-wizard\JumanSetupWizard.ps1"
}
if (-not (Test-Path -LiteralPath $wizard)) {
  throw "JumanSetupWizard.ps1 not found. Rebuild the installer package."
}

$ps64 = Join-Path $env:SystemRoot "Sysnative\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path $ps64)) {
  $ps64 = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
}

$p = Start-Process -FilePath $ps64 -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $wizard,
  "-InstallDir", $InstallDir
) -Wait -PassThru -NoNewWindow

exit $p.ExitCode
