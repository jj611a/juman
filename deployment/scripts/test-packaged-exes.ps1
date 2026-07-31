#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [switch]$SkipRebuildBackend,
  [switch]$SkipService,
  [string]$DatabaseUrl = $env:JUMAN_SMOKE_DATABASE_URL
)
$ErrorActionPreference = "Stop"

function Pass([string]$m) { Write-Host "[PASS] $m" }
function Fail([string]$m) { Write-Host "[FAIL] $m"; throw $m }

$scripts = Join-Path $RepoRoot "deployment\scripts"
if (-not $SkipRebuildBackend) {
  & (Join-Path $scripts "fetch-python-embed.ps1") -RepoRoot $RepoRoot
  & (Join-Path $scripts "stage-backend-runtime.ps1") -RepoRoot $RepoRoot
}

$stage = Join-Path $RepoRoot "deployment\dist\smoke-stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
foreach ($d in @("logs","config","storage","data","scripts","installer-wizard","backend","runtime")) {
  New-Item -ItemType Directory -Force -Path (Join-Path $stage $d) | Out-Null
}

Copy-Item (Join-Path $RepoRoot "deployment\dist\backend\*") (Join-Path $stage "backend") -Recurse -Force
Copy-Item (Join-Path $RepoRoot "deployment\runtime\*") (Join-Path $stage "runtime") -Recurse -Force
Copy-Item (Join-Path $RepoRoot "deployment\scripts\bootstrap-backend-venv.ps1") (Join-Path $stage "scripts\") -Force
Copy-Item (Join-Path $RepoRoot "deployment\installer-wizard\Install-BackendService.ps1") (Join-Path $stage "installer-wizard\") -Force
if (Test-Path (Join-Path $RepoRoot "deployment\services\WinSW-x64.exe")) {
  Copy-Item (Join-Path $RepoRoot "deployment\services\WinSW-x64.exe") (Join-Path $stage "backend\JumanApi.exe") -Force
  Copy-Item (Join-Path $RepoRoot "deployment\services\JumanApi.xml") (Join-Path $stage "backend\JumanApi.xml") -Force
}

if (-not (Test-Path (Join-Path $stage "backend\run_api.py"))) { Fail "staged run_api.py missing" }
if (-not (Test-Path (Join-Path $stage "runtime\python\python.exe"))) { Fail "embed python missing" }

if (-not $DatabaseUrl) {
  $DatabaseUrl = "postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/juman_smoke"
}
@(
  "DATABASE_URL=$DatabaseUrl"
  "HOST=127.0.0.1"
  "PORT=8000"
  "JUMAN_INSTALL_DIR=$stage"
) | Set-Content -LiteralPath (Join-Path $stage "config\juman.env") -Encoding UTF8

Write-Host "=== Bootstrap (live PyPI) ==="
if ($SkipService) { & (Join-Path $stage "scripts\bootstrap-backend-venv.ps1") -InstallDir $stage -SkipService } else { & (Join-Path $stage "scripts\bootstrap-backend-venv.ps1") -InstallDir $stage }
if ($LASTEXITCODE -ne 0) { Fail "bootstrap exit=$LASTEXITCODE" }
Pass "bootstrap ok"

$venvPy = Join-Path $stage "backend\.venv\Scripts\python.exe"
$runApi = Join-Path $stage "backend\run_api.py"
if (-not (Test-Path $venvPy)) { Fail "venv python missing" }

Write-Host "=== diagnose ==="
$p = Start-Process -FilePath $venvPy -ArgumentList @($runApi, "diagnose", "--json") -WorkingDirectory (Join-Path $stage "backend") -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $stage "logs\diagnose.out") -RedirectStandardError (Join-Path $stage "logs\diagnose.err")
if ($p.ExitCode -eq 0 -or $p.ExitCode -eq 1) { Pass "diagnose exit=$($p.ExitCode)" } else { Fail "diagnose exit=$($p.ExitCode)" }

Write-Host "=== migrate ==="
$p = Start-Process -FilePath $venvPy -ArgumentList @($runApi, "migrate") -WorkingDirectory (Join-Path $stage "backend") -Wait -PassThru -NoNewWindow -RedirectStandardOutput (Join-Path $stage "logs\migrate.out") -RedirectStandardError (Join-Path $stage "logs\migrate.err")
if ($p.ExitCode -eq 0) { Pass "migrate ok" } else { Fail "migrate exit=$($p.ExitCode)"; Get-Content (Join-Path $stage "logs\migrate.err") -ErrorAction SilentlyContinue }

if ($SkipService) {
  Write-Host "=== ephemeral API health ==="
  $api = Start-Process -FilePath $venvPy -ArgumentList @($runApi) -WorkingDirectory (Join-Path $stage "backend") -PassThru -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stage "logs\api.out") -RedirectStandardError (Join-Path $stage "logs\api.err")
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $ok = $false
  while ($sw.Elapsed.TotalSeconds -lt 90) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/health" -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -lt 500) { $ok = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
  }
  try { Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue } catch {}
  if ($ok) { Pass "ephemeral health OK" } else { Fail "ephemeral health timeout" }
} else {
  Write-Host "=== service health ==="
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $ok = $false
  while ($sw.Elapsed.TotalSeconds -lt 90) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/health" -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -lt 500) { $ok = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
  }
  if ($ok) { Pass "health OK" } else { Fail "health timeout" }
}

Pass "All packaged backend smoke checks passed"