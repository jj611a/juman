#Requires -Version 5.1
param(
  [string]$OutDir = (Join-Path $PSScriptRoot "..\services"),
  [string]$Version = "2.12.0"
)
$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$dest = Join-Path $OutDir "WinSW-x64.exe"
if (Test-Path $dest) {
  Write-Host "WinSW already present: $dest"
  exit 0
}
$uri = "https://github.com/winsw/winsw/releases/download/v$Version/WinSW-x64.exe"
Write-Host "Downloading $uri ..."
Invoke-WebRequest -Uri $uri -OutFile $dest -UseBasicParsing
if (-not (Test-Path $dest)) { throw "Failed to download WinSW" }
Write-Host "Saved $dest"