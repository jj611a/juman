#Requires -Version 5.1
function Write-InstallerConfigurationReport {
  param(
    [Parameter(Mandatory)][string]$InstallDir,
    [hashtable]$Data
  )
  $logs = Join-Path $InstallDir "logs"
  New-Item -ItemType Directory -Force -Path $logs | Out-Null
  $path = Join-Path $logs "INSTALLER_CONFIGURATION_REPORT.md"
  $overall = if ($Data.OverallOk) { "SUCCESS" } else { "FAILED" }
  $lines = @(
    "# Juman Installer Configuration Report",
    "",
    "- Generated: $((Get-Date).ToUniversalTime().ToString('o'))",
    "- InstallDir: $InstallDir",
    "- Overall status: **$overall**",
    "",
    "## PostgreSQL",
    "- Version: $($Data.PgVersion)",
    "- Prefix: $($Data.PgPrefix)",
    "- Service: $($Data.PgService)",
    "- Connection test: $($Data.ConnectionTest)",
    "",
    "## Database",
    "- Database creation: $($Data.DatabaseCreation)",
    "- User creation: $($Data.UserCreation)",
    "- Migration status: $($Data.MigrationStatus)",
    "- Alembic revision: $($Data.AlembicRevision)",
    "",
    "## Configuration",
    "- juman.env: $($Data.EnvPath)",
    "- Readable: $($Data.EnvReadable)",
    "- App user only (no postgres password stored): yes",
    "",
    "## Backend",
    "- Service install: $($Data.ServiceInstall)",
    "- Service validation: $($Data.ServiceValidation)",
    "- Health: $($Data.Health)",
    "",
    "## Notes",
    $($Data.Notes),
    "",
    "## Technical",
    '```',
    $($Data.Technical),
    '```'
  )
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllLines($path, $lines, $utf8NoBom)
  return $path
}