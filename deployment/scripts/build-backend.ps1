#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)
$ErrorActionPreference = "Stop"
$backend = Join-Path $RepoRoot "backend"
$spec = Join-Path $RepoRoot "deployment\backend\juman-api.spec"
$outDir = Join-Path $RepoRoot "deployment\dist\backend"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Push-Location $backend
try {
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv is required to build juman-api.exe (avoids system/hermes Python without PyInstaller)"
  }
  uv sync --group dev
  # Packaging tool — not a runtime dependency; install into the project venv
  uv pip install --upgrade pyinstaller
  $distpath = Join-Path $RepoRoot "deployment\dist\pyi"
  $workpath = Join-Path $RepoRoot "deployment\dist\pyi-work"
  uv run python -m PyInstaller $spec --noconfirm --distpath $distpath --workpath $workpath
  $built = Join-Path $distpath "juman-api.exe"
  if (-not (Test-Path $built)) {
    $alt = Join-Path $backend "dist\juman-api.exe"
    if (Test-Path $alt) { $built = $alt }
  }
  if (-not (Test-Path $built)) { throw "juman-api.exe not produced" }
  Copy-Item -Force $built (Join-Path $outDir "juman-api.exe")
  Write-Host "Copied to $outDir\juman-api.exe"
}
finally {
  Pop-Location
}