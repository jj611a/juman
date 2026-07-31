#Requires -Version 5.1
function Install-JumanBackendService {
  param([Parameter(Mandatory)][string]$InstallDir)
  $winsw = Join-Path $InstallDir "backend\JumanApi.exe"
  $xml = Join-Path $InstallDir "backend\JumanApi.xml"
  $api = Join-Path $InstallDir "backend\juman-api.exe"
  if (-not (Test-Path $winsw)) { throw "WinSW wrapper missing: $winsw" }
  if (-not (Test-Path $xml)) { throw "JumanApi.xml missing: $xml" }
  if (-not (Test-Path $api)) { throw "juman-api.exe missing: $api" }

  Push-Location (Join-Path $InstallDir "backend")
  try {
    & $winsw stop 2>$null | Out-Null
    & $winsw uninstall 2>$null | Out-Null
    $global:LASTEXITCODE = 0
    & $winsw install
    if ($LASTEXITCODE -ne 0) { throw "WinSW install failed exit=$LASTEXITCODE" }
    $global:LASTEXITCODE = 0
    & $winsw start
    if ($LASTEXITCODE -ne 0) {
      Start-Sleep -Seconds 5
      $global:LASTEXITCODE = 0
      & $winsw start
      if ($LASTEXITCODE -ne 0) { throw "WinSW start failed exit=$LASTEXITCODE" }
    }
  } finally { Pop-Location }

  return [pscustomobject]@{ Ok = $true; ServiceName = "JumanApi"; Message = "JumanApi service installed and started" }
}

function Wait-JumanHealth {
  param([string]$Url = "http://127.0.0.1:8000/api/v1/health", [int]$TimeoutSec = 120)
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $last = $null
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    try {
      $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
        return [pscustomobject]@{ Ok = $true; StatusCode = $r.StatusCode; Body = $r.Content; Message = "Health OK" }
      }
      $last = "HTTP $($r.StatusCode)"
    } catch {
      $last = $_.Exception.Message
    }
    Start-Sleep -Seconds 2
  }
  throw "Health check failed: $Url - $last"
}

function Test-JumanApiServiceRunning {
  $sc = Join-Path $env:SystemRoot "System32\sc.exe"
  $q = & $sc query JumanApi 2>&1 | Out-String
  $running = $q -match "STATE\s*:\s*\d+\s+RUNNING"
  return [pscustomobject]@{ Ok = $running; Raw = $q; Message = $(if ($running) { "JumanApi RUNNING" } else { "JumanApi not RUNNING" }) }
}

function Restart-PostgreSQLService {
  param([string]$ServiceName = "postgresql-x64-16")
  $sc = Join-Path $env:SystemRoot "System32\sc.exe"
  & $sc stop $ServiceName 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  & $sc start $ServiceName 2>&1 | Out-Null
  Start-Sleep -Seconds 3
  $q = & $sc query $ServiceName 2>&1 | Out-String
  if ($q -notmatch "RUNNING") { throw "Failed to restart $ServiceName" }
  return $true
}