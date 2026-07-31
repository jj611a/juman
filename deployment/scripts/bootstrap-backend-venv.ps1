#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [switch]$Force,
  [switch]$SkipService,
  [switch]$SkipMigrate
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Install-Progress.ps1")

$InstallDir = [System.IO.Path]::GetFullPath($InstallDir)
$backend = Join-Path $InstallDir "backend"
$runtimePy = Join-Path $InstallDir "runtime\python\python.exe"
$req = Join-Path $backend "requirements.txt"
$reqHashFile = Join-Path $backend "requirements.sha256"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"
$marker = Join-Path $InstallDir "config\backend.bootstrap.ok"
$logs = Join-Path $InstallDir "logs"
New-Item -ItemType Directory -Force -Path $logs | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "config") | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $logs "bootstrap-$stamp.log"

function Write-BootLog([string]$Msg) {
  $line = "$(Get-Date -Format o) $Msg"
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-ReqFingerprint {
  if (Test-Path -LiteralPath $reqHashFile) {
    return (Get-Content -LiteralPath $reqHashFile -Raw).Trim().ToLowerInvariant()
  }
  if (-not (Test-Path -LiteralPath $req)) { throw "Missing requirements.txt: $req" }
  return (Get-FileHash -Algorithm SHA256 -Path $req).Hash.ToLowerInvariant()
}

function Test-BootstrapCurrent([string]$WantHash) {
  if ($Force) { return $false }
  if (-not (Test-Path -LiteralPath $marker)) { return $false }
  if (-not (Test-Path -LiteralPath $venvPy)) { return $false }
  try {
    $body = Get-Content -LiteralPath $marker -Raw
    if ($body -notmatch "(?m)^requirements_sha256=(.+)$") { return $false }
    $have = $Matches[1].Trim().ToLowerInvariant()
    return ($have -eq $WantHash)
  } catch {
    return $false
  }
}

try {
  Write-BootLog "Bootstrap start InstallDir=$InstallDir"
  Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "start" -Percent 5 -Message "بدء تهيئة الخادم الخلفي" -LogFile $logFile
  if (-not (Test-Path -LiteralPath $runtimePy)) {
    throw "Embeddable Python missing: $runtimePy (reinstall Juman)"
  }
  if (-not (Test-Path -LiteralPath $req)) {
    throw "requirements.txt missing: $req"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $backend "run_api.py"))) {
    throw "run_api.py missing under $backend"
  }
  if (-not (Test-Path -LiteralPath (Join-Path $InstallDir "config\juman.env"))) {
    throw "config\juman.env missing - run Setup Wizard first"
  }

  $wantHash = Get-ReqFingerprint
  Write-BootLog "requirements fingerprint=$wantHash"

  if (Test-BootstrapCurrent $wantHash) {
    Write-BootLog "Bootstrap marker current - skipping pip"
  } else {
    Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "venv" -Percent 15 -Message "إنشاء بيئة Python (.venv)" -LogFile $logFile
    Write-BootLog "Creating/updating venv..."
    $venvDir = Join-Path $backend ".venv"
    if (Test-Path -LiteralPath $venvDir) {
      $winsw = Join-Path $backend "JumanApi.exe"
      if (Test-Path $winsw) {
        & $winsw stop 2>$null | Out-Null
      }
      Remove-Item -LiteralPath $venvDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    $env:JUMAN_INSTALL_DIR = $InstallDir
    # Embeddable CPython has no ensurepip/venv module; use virtualenv (shipped in runtime via fetch-python-embed).
    & $runtimePy -m virtualenv $venvDir
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvPy)) {
      Write-BootLog "virtualenv missing; installing..."
      & $runtimePy -m pip install virtualenv --no-warn-script-location
      if ($LASTEXITCODE -ne 0) { throw "pip install virtualenv failed exit=$LASTEXITCODE" }
      & $runtimePy -m virtualenv $venvDir
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path $venvPy)) {
        throw "Failed to create venv at $venvDir (see $logFile)"
      }
    }

    Write-BootLog "Upgrading pip in venv..."
    & $venvPy -m pip install --upgrade pip setuptools wheel
    if ($LASTEXITCODE -ne 0) { throw "venv pip upgrade failed exit=$LASTEXITCODE" }

    Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "pip" -Percent 35 -Message "تثبيت مكتبات Python من PyPI (قد يستغرق دقائق)" -LogFile $logFile
    Write-BootLog "pip install -r requirements.txt (live PyPI)..."
    $reqText = Get-Content -LiteralPath $req -Raw
    if ($reqText -match "(?m)^\s*--hash=") {
      Write-BootLog "Using --require-hashes"
      & $venvPy -m pip install --require-hashes -r $req
    } else {
      & $venvPy -m pip install -r $req
    }
    if ($LASTEXITCODE -ne 0) {
      throw "pip install failed exit=$LASTEXITCODE (network/PyPI required). Log: $logFile"
    }
    Write-BootLog "pip install ok"
    Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "pip_done" -Percent 70 -Message "اكتمل تثبيت المكتبات" -LogFile $logFile
  }

  if (-not $SkipMigrate) {
    Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "migrate" -Percent 80 -Message "تشغيل ترحيلات قاعدة البيانات" -LogFile $logFile
    Write-BootLog "Running migrations..."
    $env:JUMAN_INSTALL_DIR = $InstallDir
    & $venvPy (Join-Path $backend "run_api.py") migrate
    if ($LASTEXITCODE -ne 0) { throw "migrate failed exit=$LASTEXITCODE" }
    Write-BootLog "migrate ok"
  }

  if (-not $SkipService) {
    $wizardSvc = Join-Path $InstallDir "installer-wizard\Install-BackendService.ps1"
    if (-not (Test-Path $wizardSvc)) {
      $wizardSvc = Join-Path $PSScriptRoot "..\installer-wizard\Install-BackendService.ps1"
    }
    if (-not (Test-Path $wizardSvc)) { throw "Install-BackendService.ps1 missing" }
    . $wizardSvc
    Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "winsw" -Percent 90 -Message "تسجيل وتشغيل خدمة JumanApi" -LogFile $logFile
    Write-BootLog "Installing WinSW JumanApi..."
    $svc = Install-JumanBackendService -InstallDir $InstallDir
    Write-BootLog $svc.Message
  }

  $pyVer = & $runtimePy -c "import sys; print('%d.%d.%d' % sys.version_info[:3])"
  $markerBody = @(
    "ok=1"
    "requirements_sha256=$wantHash"
    "python_version=$pyVer"
    "bootstrapped_at=$(Get-Date -Format o)"
    "log=$logFile"
  ) -join "`n"
  [System.IO.File]::WriteAllText($marker, $markerBody + "`n")
  Write-BootLog "Wrote marker $marker"
  # Ensure media/backups folders exist for diagnostics
    $storage = Join-Path $InstallDir "storage"
    New-Item -ItemType Directory -Force -Path $storage, (Join-Path $storage "media"), (Join-Path $storage "backups") | Out-Null
    Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "done" -Percent 100 -Message "اكتملت تهيئة الخادم — جاهز للتشغيل" -LogFile $logFile
    Write-BootLog "Bootstrap complete"
  exit 0
}
catch {
  Write-JumanInstallProgress -InstallDir $InstallDir -Phase "bootstrap" -Step "error" -Percent 100 -Message ("فشل: " + $_.Exception.Message) -LogFile $logFile
  Write-BootLog "ERROR: $($_.Exception.Message)"
  if ($_.ScriptStackTrace) { Write-BootLog $_.ScriptStackTrace }
  throw
}