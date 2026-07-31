#Requires -Version 5.1
function Write-JumanInstallProgress {
  param(
    [Parameter(Mandatory)][string]$InstallDir,
    [Parameter(Mandatory)][string]$Phase,
    [Parameter(Mandatory)][string]$Step,
    [Parameter(Mandatory)][int]$Percent,
    [Parameter(Mandatory)][string]$Message,
    [string]$LogFile = ""
  )
  $logs = Join-Path $InstallDir "logs"
  New-Item -ItemType Directory -Force -Path $logs | Out-Null
  $progressPath = Join-Path $logs "install-progress.json"
  $mdPath = Join-Path $logs "INSTALL_PROGRESS.md"
  $obj = [ordered]@{
    phase       = $Phase
    step        = $Step
    percent     = [Math]::Max(0, [Math]::Min(100, $Percent))
    message     = $Message
    updated_at  = (Get-Date -Format o)
    log_file    = $LogFile
    install_dir = $InstallDir
  }
  $json = ($obj | ConvertTo-Json -Compress)
  [System.IO.File]::WriteAllText($progressPath, $json + "`n", [System.Text.UTF8Encoding]::new($false))
  $line = "- $(Get-Date -Format o) [$Phase/$Step] $($obj.percent)% - $Message"
  Add-Content -LiteralPath $mdPath -Value $line -Encoding UTF8
  Write-Host $line
}