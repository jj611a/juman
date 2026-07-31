#Requires -Version 5.1
<#
.SYNOPSIS
  Instrumented custom-install orchestration. Writes logs\installer.json.
  Stops before backend/bootstrap if PostgreSQL verification fails.
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = "Stop"
$scripts = $PSScriptRoot

. (Join-Path $scripts "InstallerStepLog.ps1")

Initialize-InstallerLog -InstallDir $InstallDir | Out-Null
Write-Host "Installer diagnostics log: $(Get-InstallerJsonPath -InstallDir $InstallDir)"

function Assert-File([string]$Path, [string]$Label) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "$Label missing: $Path"
  }
  Write-Output "OK $Label -> $Path"
}

try {
  Invoke-InstallerStep -InstallDir $InstallDir -Name "Verify install directories" -Action {
    foreach ($name in @("config","data","logs","storage","runtime","backend","scripts")) {
      $p = Join-Path $InstallDir $name
      if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force -Path $p | Out-Null }
      if (-not (Test-Path $p)) { throw "Directory missing: $p" }
      Write-Output "dir ok: $p"
    }
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Verify backend artifacts" -Action {
    Assert-File (Join-Path $InstallDir "backend\juman-api.exe") "juman-api.exe"
    Assert-File (Join-Path $InstallDir "backend\JumanApi.exe") "WinSW JumanApi.exe"
    Assert-File (Join-Path $InstallDir "backend\JumanApi.xml") "JumanApi.xml"
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Verify installer scripts" -Action {
    Assert-File (Join-Path $scripts "gen-secrets.ps1") "gen-secrets.ps1"
    Assert-File (Join-Path $scripts "install-postgresql.ps1") "install-postgresql.ps1"
    Assert-File (Join-Path $scripts "verify-postgresql.ps1") "verify-postgresql.ps1"
    Assert-File (Join-Path $scripts "post-install.ps1") "post-install.ps1"
    Assert-File (Join-Path $scripts "bootstrap-database.ps1") "bootstrap-database.ps1"
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Generate install secrets" -Action {
    $out = Join-Path $InstallDir "config\.install-secrets.env"
    & (Join-Path $scripts "gen-secrets.ps1") -OutFile $out
    if (-not (Test-Path $out)) { throw "Secrets file not created: $out" }
    Write-Output "Secrets written: $out"
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Locate PostgreSQL vendor installer" -Action {
    $candidates = @(
      (Join-Path $InstallDir "resources\vendor\postgresql"),
      (Join-Path $InstallDir "vendor\postgresql")
    )
    $found = $null
    foreach ($dir in $candidates) {
      Write-Output "Looking in: $dir"
      if (-not (Test-Path $dir)) {
        Write-Output "  (missing directory)"
        continue
      }
      $exe = Get-ChildItem -Path $dir -Filter "postgresql-*-windows-x64.exe" -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        Select-Object -First 1
      if ($exe) {
        $found = $exe.FullName
        Write-Output "Found: $found size=$($exe.Length)"
        break
      }
      Write-Output "  (no postgresql-*-windows-x64.exe)"
    }
    if (-not $found) {
      throw "PostgreSQL installer EXE not bundled. Expected resources\vendor\postgresql\postgresql-*-windows-x64.exe (packaged via fetch-postgresql.ps1 + electron-builder extraResources). Installer will not download at runtime."
    }
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Install PostgreSQL" -Action {
    $script = Join-Path $scripts "install-postgresql.ps1"
    $ps64 = Join-Path $env:SystemRoot "Sysnative\WindowsPowerShell\v1.0\powershell.exe"
    if (-not (Test-Path $ps64)) { $ps64 = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe" }
    $p = Start-Process -FilePath $ps64 -ArgumentList @(
      "-NoProfile","-ExecutionPolicy","Bypass","-File",$script,"-InstallDir",$InstallDir
    ) -Wait -PassThru -NoNewWindow
    $code = $p.ExitCode
    $global:LASTEXITCODE = $code
    if ($code -ne 0) {
      throw "install-postgresql.ps1 exited with code $code (see logs\postgresql-install.log and EDB debugtrace)"
    }
    Write-Output "install-postgresql.ps1 completed exit=$code"
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Verify PostgreSQL" -Action {
    $script = Join-Path $scripts "verify-postgresql.ps1"
    $ps64 = Join-Path $env:SystemRoot "Sysnative\WindowsPowerShell\v1.0\powershell.exe"
    if (-not (Test-Path $ps64)) { $ps64 = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe" }
    $p = Start-Process -FilePath $ps64 -ArgumentList @(
      "-NoProfile","-ExecutionPolicy","Bypass","-File",$script
    ) -Wait -PassThru -NoNewWindow
    $code = $p.ExitCode
    $global:LASTEXITCODE = $code
    if ($code -ne 0) {
      throw "PostgreSQL verification failed (exit=$code). Folder/postgres.exe/service must exist and be RUNNING. See installer.json."
    }
    Write-Output "PostgreSQL verification passed"
  }

  # From here on: backend / DB bootstrap. Must not run if PG verify failed (already thrown).
  Invoke-InstallerStep -InstallDir $InstallDir -Name "Post-install orchestration" -Action {
    $global:LASTEXITCODE = 0
    & (Join-Path $scripts "run-post-install.ps1") -InstallDir $InstallDir
    if ($null -ne $LASTEXITCODE -and $LASTEXITCODE -ne 0) {
      throw "run-post-install.ps1 exited with code $LASTEXITCODE"
    }
    Write-Output "Post-install completed"
  }

  Invoke-InstallerStep -InstallDir $InstallDir -Name "Write update-channel.json" -Action {
    $runtime = Join-Path $InstallDir "runtime"
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    $path = Join-Path $runtime "update-channel.json"
    $body = '{"channel":"stable","implemented":false,"feedUrl":null}'
    [System.IO.File]::WriteAllText($path, $body + "`r`n", [System.Text.UTF8Encoding]::new($false))
    Write-Output "Wrote $path"
  }


  Write-Host "Custom install finished OK. See $(Get-InstallerJsonPath -InstallDir $InstallDir)"
  exit 0
}
catch {
  $fail = Get-InstallerLastFailure -InstallDir $InstallDir
  $reason = if ($fail) { "$($fail.step): $($fail.failureReason)" } else { $_.Exception.Message }
  Write-Error "CUSTOM INSTALL ABORTED: $reason"
  Write-Host "Full step log: $(Get-InstallerJsonPath -InstallDir $InstallDir)"
  exit 1
}