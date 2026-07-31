#Requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$InstallDir)
$ErrorActionPreference = "SilentlyContinue"
$path = Join-Path $InstallDir "logs\installer.json"
if (-not (Test-Path $path)) {
  Write-Output "installer.json missing at $path"
  exit 0
}
try {
  $steps = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($steps -isnot [System.Array]) { $steps = @($steps) }
  for ($i = $steps.Count - 1; $i -ge 0; $i--) {
    if ($steps[$i].success -eq $false) {
      $s = $steps[$i]
      $msg = "FAILED STEP: $($s.step)`nexitCode=$($s.exitCode)`n$($s.failureReason)"
      if ($s.stderr) { $msg += "`nstderr: $($s.stderr.Substring(0, [Math]::Min(400, $s.stderr.Length)))" }
      Write-Output $msg
      # Also write for NSIS to pick up
      $out = Join-Path $InstallDir "logs\installer-last-failure.txt"
      [IO.File]::WriteAllText($out, $msg, [Text.UTF8Encoding]::new($false))
      exit 0
    }
  }
  Write-Output "No failed step recorded in installer.json"
} catch {
  Write-Output $_.Exception.Message
}