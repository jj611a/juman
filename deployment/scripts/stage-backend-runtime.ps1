#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)
$ErrorActionPreference = "Stop"

$backendSrc = Join-Path $RepoRoot "backend-python"
$outDir = Join-Path $RepoRoot "deployment\dist\backend"
$runApiSrc = Join-Path $RepoRoot "deployment\backend\run_api.py"
$waitSrc = Join-Path $RepoRoot "deployment\backend\wait_for_db.py"

if (-not (Test-Path $runApiSrc)) { throw "Missing $runApiSrc" }
if (-not (Test-Path $waitSrc)) { throw "Missing $waitSrc" }
if (-not (Test-Path (Join-Path $backendSrc "app"))) { throw "Missing backend-python\app" }
if (-not (Test-Path (Join-Path $backendSrc "alembic"))) { throw "Missing backend-python\alembic" }
if (-not (Test-Path (Join-Path $backendSrc "alembic.ini"))) { throw "Missing backend-python\alembic.ini" }
if (-not (Test-Path (Join-Path $backendSrc "uv.lock"))) { throw "Missing backend-python\uv.lock" }

if (Test-Path $outDir) {
  Remove-Item -LiteralPath $outDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Copy-Item -LiteralPath (Join-Path $backendSrc "app") -Destination (Join-Path $outDir "app") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $backendSrc "alembic") -Destination (Join-Path $outDir "alembic") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $backendSrc "alembic.ini") -Destination (Join-Path $outDir "alembic.ini") -Force
Copy-Item -LiteralPath $runApiSrc -Destination (Join-Path $outDir "run_api.py") -Force
Copy-Item -LiteralPath $waitSrc -Destination (Join-Path $outDir "wait_for_db.py") -Force

$reqOut = Join-Path $outDir "requirements.txt"
Push-Location $backendSrc
try {
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    throw "uv is required to export locked requirements from uv.lock"
  }
  # uv export includes hashes by default (omit with --no-hashes).
  uv export --frozen --no-dev --no-emit-project --output-file $reqOut
  if ($LASTEXITCODE -ne 0) { throw "uv export failed exit=$LASTEXITCODE" }
}
finally {
  Pop-Location
}

if (-not (Test-Path $reqOut)) { throw "requirements.txt was not produced" }
$reqBody = Get-Content -LiteralPath $reqOut -Raw
if ([string]::IsNullOrWhiteSpace($reqBody)) { throw "requirements.txt is empty" }

$hash = (Get-FileHash -Algorithm SHA256 -Path $reqOut).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $outDir "requirements.sha256") -Value $hash -Encoding ASCII

Write-Host "Staged backend runtime at $outDir"
Write-Host "requirements fingerprint: $hash"