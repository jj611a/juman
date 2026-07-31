#Requires -Version 5.1
<#
.SYNOPSIS
  Assemble a portable Juman ZIP (no NSIS / no WinSW required).
  Requires existing PostgreSQL with matching config\juman.env.
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Version = "",
  [switch]$SkipPack
)

$ErrorActionPreference = "Stop"
$frontend = Join-Path $RepoRoot "frontend"
$scripts = Join-Path $RepoRoot "deployment\scripts"

if (-not $Version) {
  $pkg = Get-Content (Join-Path $frontend "package.json") -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}

if (-not $SkipPack) {
  & (Join-Path $scripts "fetch-winsw.ps1")
  if (-not (Test-Path (Join-Path $RepoRoot "deployment\dist\backend\juman-api.exe"))) {
    & (Join-Path $scripts "build-backend.ps1") -RepoRoot $RepoRoot
  }
  Push-Location $frontend
  try {
    pnpm run dist:dir
    if ($LASTEXITCODE -ne 0) { throw "pnpm run dist:dir failed exit=$LASTEXITCODE" }
  } finally { Pop-Location }
}

$unpacked = Join-Path $frontend "release\win-unpacked"
if (-not (Test-Path (Join-Path $unpacked "Juman.exe"))) {
  throw "win-unpacked\Juman.exe missing. Run without -SkipPack or build first."
}

$outName = "Juman-Portable-v$Version"
$outDir = Join-Path $frontend "release\$outName"
if (Test-Path $outDir) { Remove-Item -Recurse -Force $outDir }
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Write-Host "Copying Electron app..."
Copy-Item -Path (Join-Path $unpacked "*") -Destination $outDir -Recurse -Force

# Flatten backend next to Juman.exe (same layout as installed product)
$backendDest = Join-Path $outDir "backend"
New-Item -ItemType Directory -Force -Path $backendDest | Out-Null
$resBackend = Join-Path $outDir "resources\backend"
if (Test-Path $resBackend) {
  Copy-Item -Path (Join-Path $resBackend "*") -Destination $backendDest -Recurse -Force
} else {
  Copy-Item -Path (Join-Path $RepoRoot "deployment\dist\backend\*") -Destination $backendDest -Recurse -Force
}

# WinSW optional (not used by portable launcher) + XML for reference
$svc = Join-Path $RepoRoot "deployment\services"
if (Test-Path (Join-Path $svc "WinSW-x64.exe")) {
  Copy-Item (Join-Path $svc "WinSW-x64.exe") (Join-Path $backendDest "JumanApi.exe") -Force
}
if (Test-Path (Join-Path $svc "JumanApi.xml")) {
  Copy-Item (Join-Path $svc "JumanApi.xml") (Join-Path $backendDest "JumanApi.xml") -Force
}

# Scripts (diagnostics / ops; WinSW scripts unused in portable)
$scriptsDest = Join-Path $outDir "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDest | Out-Null
$resScripts = Join-Path $outDir "resources\scripts"
if (Test-Path $resScripts) {
  Copy-Item -Path (Join-Path $resScripts "*") -Destination $scriptsDest -Force
} else {
  Copy-Item -Path (Join-Path $RepoRoot "deployment\scripts\*.ps1") -Destination $scriptsDest -Force
  Copy-Item -Path (Join-Path $RepoRoot "deployment\scripts\*.cmd") -Destination $scriptsDest -Force -ErrorAction SilentlyContinue
}

foreach ($d in @("config","data","logs","storage","runtime")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $outDir $d) | Out-Null
}

# Marker + launcher + README + env example
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[IO.File]::WriteAllText((Join-Path $outDir "portable.marker"), "Juman portable package`n", $utf8NoBom)

$kit = Join-Path $RepoRoot "deployment\portable-kit"
Copy-Item (Join-Path $kit "Start Juman Portable.cmd") (Join-Path $outDir "Start Juman Portable.cmd") -Force
Copy-Item (Join-Path $kit "README-PORTABLE.txt") (Join-Path $outDir "README-PORTABLE.txt") -Force
Copy-Item (Join-Path $kit "juman.env.example") (Join-Path $outDir "config\juman.env.example") -Force

if (-not (Test-Path (Join-Path $outDir "backend\juman-api.exe"))) {
  throw "Portable package missing backend\juman-api.exe"
}
if (-not (Test-Path (Join-Path $outDir "Juman.exe"))) {
  throw "Portable package missing Juman.exe"
}

$zipPath = Join-Path $frontend "release\$outName.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $outDir "*") -DestinationPath $zipPath -Force

$hash = (Get-FileHash $zipPath -Algorithm SHA256).Hash
[IO.File]::WriteAllText("$zipPath.sha256", $hash, $utf8NoBom)

Write-Host "Portable folder: $outDir"
Write-Host "Portable ZIP:    $zipPath"
Write-Host "SHA-256:         $hash"