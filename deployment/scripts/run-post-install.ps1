#Requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$InstallDir)
$ErrorActionPreference = "Stop"
$secretsFile = Join-Path $InstallDir "config\.install-secrets.env"
if (-not (Test-Path $secretsFile)) {
  & (Join-Path $PSScriptRoot "gen-secrets.ps1") -OutFile $secretsFile
}
$map = @{}
Get-Content $secretsFile | ForEach-Object {
  if ($_ -match "^(.*?)=(.*)$") { $map[$matches[1]] = $matches[2] }
}
& (Join-Path $PSScriptRoot "post-install.ps1") `
  -InstallDir $InstallDir `
  -PgSuperPassword $map["PG_SUPER_PASSWORD"] `
  -DbPassword $map["DB_PASSWORD"] `
  -BootstrapPassword $map["BOOTSTRAP_PASSWORD"] `
  -SecretKey $map["SECRET_KEY"]