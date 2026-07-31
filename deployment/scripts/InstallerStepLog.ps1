#Requires -Version 5.1
<#
.SYNOPSIS
  Shared installer step logger -> InstallDir\logs\installer.json
#>

function Get-InstallerJsonPath {
  param([Parameter(Mandatory = $true)][string]$InstallDir)
  return (Join-Path $InstallDir "logs\installer.json")
}

function Initialize-InstallerLog {
  param([Parameter(Mandatory = $true)][string]$InstallDir)
  $logDir = Join-Path $InstallDir "logs"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $path = Get-InstallerJsonPath -InstallDir $InstallDir
  [System.IO.File]::WriteAllText($path, "[]`r`n", [System.Text.UTF8Encoding]::new($false))
  return $path
}

function Read-InstallerSteps {
  param([Parameter(Mandatory = $true)][string]$InstallDir)
  $path = Get-InstallerJsonPath -InstallDir $InstallDir
  if (-not (Test-Path $path)) { return @() }
  try {
    $raw = Get-Content -LiteralPath $path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    $parsed = $raw | ConvertFrom-Json
    if ($null -eq $parsed) { return @() }
    if ($parsed -is [System.Array]) { return @($parsed) }
    return @($parsed)
  } catch {
    return @()
  }
}

function Write-InstallerSteps {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)]$Steps
  )
  $path = Get-InstallerJsonPath -InstallDir $InstallDir
  $logDir = Split-Path $path -Parent
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $json = ($Steps | ConvertTo-Json -Depth 8)
  if ($null -eq $json) { $json = "[]" }
  if ($Steps.Count -eq 1 -and $json.TrimStart().StartsWith("{")) {
    $json = "[$json]"
  }
  $tmp = "$path.tmp"
  [System.IO.File]::WriteAllText($tmp, $json + "`r`n", [System.Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $tmp -Destination $path -Force
}

function Add-InstallerStepRecord {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][hashtable]$Record
  )
  $steps = [System.Collections.ArrayList]@(Read-InstallerSteps -InstallDir $InstallDir)
  [void]$steps.Add([pscustomobject]$Record)
  Write-InstallerSteps -InstallDir $InstallDir -Steps $steps
}

function Get-InstallerLastFailure {
  param([Parameter(Mandatory = $true)][string]$InstallDir)
  $steps = Read-InstallerSteps -InstallDir $InstallDir
  for ($i = $steps.Count - 1; $i -ge 0; $i--) {
    $s = $steps[$i]
    if ($s.success -eq $false) { return $s }
  }
  return $null
}

function Invoke-InstallerStep {
  param(
    [Parameter(Mandatory = $true)][string]$InstallDir,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][scriptblock]$Action
  )

  $started = [DateTime]::UtcNow
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $stdoutLines = New-Object System.Collections.Generic.List[string]
  $stderrLines = New-Object System.Collections.Generic.List[string]
  $exitCode = 0
  $exceptionText = $null
  $failureReason = $null
  $success = $false

  Write-Host "=== STEP START: $Name ==="
  $global:LASTEXITCODE = 0

  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $output = & $Action 2>&1
    $ErrorActionPreference = $prevEap

    foreach ($item in @($output)) {
      if ($null -eq $item) { continue }
      if ($item -is [System.Management.Automation.ErrorRecord]) {
        [void]$stderrLines.Add($item.ToString())
      } else {
        [void]$stdoutLines.Add([string]$item)
        Write-Host $item
      }
    }

    # Native exit codes from child scripts (exit N) - do not treat leftover sc.exe codes from prior commands
    if ($null -ne $global:LASTEXITCODE -and $global:LASTEXITCODE -ne 0) {
      $exitCode = [int]$global:LASTEXITCODE
      $failureReason = "Process exit code $exitCode"
      throw $failureReason
    }

    $success = $true
  } catch {
    $success = $false
    if ($exitCode -eq 0 -and $null -ne $global:LASTEXITCODE -and $global:LASTEXITCODE -ne 0) {
      $exitCode = [int]$global:LASTEXITCODE
    }
    if ($exitCode -eq 0) { $exitCode = 1 }
    $exceptionText = $_.Exception.ToString()
    if ($_.ScriptStackTrace) {
      $exceptionText = "$exceptionText`n$($_.ScriptStackTrace)"
    }
    if (-not $failureReason) {
      $failureReason = $_.Exception.Message
    }
    if ($stderrLines.Count -eq 0 -and $failureReason) {
      [void]$stderrLines.Add($failureReason)
    }
    Write-Host "=== STEP FAIL: $Name - $failureReason ==="
  } finally {
    $sw.Stop()
    $ended = [DateTime]::UtcNow
    $record = @{
      step          = $Name
      startTime     = $started.ToString("o")
      endTime       = $ended.ToString("o")
      duration      = [int]$sw.ElapsedMilliseconds
      success       = $success
      exitCode      = $exitCode
      stdout        = ($stdoutLines -join "`n")
      stderr        = ($stderrLines -join "`n")
      exception     = $exceptionText
      failureReason = $failureReason
    }
    try {
      Add-InstallerStepRecord -InstallDir $InstallDir -Record $record
    } catch {
      Write-Host "WARN: failed to write installer.json: $($_.Exception.Message)"
    }
  }

  if (-not $success) {
    throw "Installer step failed: $Name - $failureReason"
  }

  Write-Host "=== STEP OK: $Name ($([int]$sw.ElapsedMilliseconds) ms) ==="
  return $true
}