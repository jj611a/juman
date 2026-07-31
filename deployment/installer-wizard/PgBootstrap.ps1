#Requires -Version 5.1
function Invoke-PgBootstrap {
  param(
    [Parameter(Mandatory)][string]$PsqlExe,
    [Parameter(Mandatory)][string]$DbHost,
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][string]$Superuser,
    [Parameter(Mandatory)][string]$SuperPassword,
    [Parameter(Mandatory)][string]$DbName,
    [Parameter(Mandatory)][string]$AppUser,
    [Parameter(Mandatory)][string]$AppPassword
  )
  $env:PGPASSWORD = $SuperPassword
  $env:PGCLIENTENCODING = "UTF8"
  try {
    function Invoke-Psql([string]$Sql, [string]$Db = "postgres") {
      $r = & $PsqlExe -h $DbHost -p $Port -U $Superuser -d $Db -v ON_ERROR_STOP=1 -c $Sql 2>&1
      if ($LASTEXITCODE -ne 0) { throw ("psql failed: $Sql`n" + ($r | Out-String)) }
      return $r
    }

    $safeUser = $AppUser -replace "[^a-zA-Z0-9_]", ""
    if ($safeUser -ne $AppUser) { throw "Application user must be alphanumeric/underscore: $AppUser" }
    $safeDb = $DbName -replace "[^a-zA-Z0-9_]", ""
    if ($safeDb -ne $DbName) { throw "Database name must be alphanumeric/underscore: $DbName" }
    $safePass = $AppPassword.Replace("'", "''")

    Invoke-Psql "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$safeUser') THEN CREATE ROLE $safeUser LOGIN PASSWORD '$safePass'; ELSE ALTER ROLE $safeUser WITH LOGIN PASSWORD '$safePass'; END IF; END `$`$;"

    $exists = & $PsqlExe -h $DbHost -p $Port -U $Superuser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$safeDb'" 2>&1
    if (("$exists").Trim() -ne "1") {
      Invoke-Psql "CREATE DATABASE $safeDb OWNER $safeUser;"
    } else {
      Invoke-Psql "ALTER DATABASE $safeDb OWNER TO $safeUser;"
    }
    Invoke-Psql "GRANT ALL PRIVILEGES ON DATABASE $safeDb TO $safeUser;"
    # schema privileges for future objects
    Invoke-Psql "GRANT ALL ON SCHEMA public TO $safeUser;" $safeDb
    Invoke-Psql "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $safeUser;" $safeDb
    Invoke-Psql "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $safeUser;" $safeDb

    return [pscustomobject]@{ Ok = $true; Database = $safeDb; AppUser = $safeUser; Message = "Database and application user ready" }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Invoke-AlembicMigrate {
  param([Parameter(Mandatory)][string]$InstallDir)
  $venvPy = Join-Path $InstallDir "backend\.venv\Scripts\python.exe"
  $runApi = Join-Path $InstallDir "backend\run_api.py"
  if (-not (Test-Path $venvPy)) {
    throw "Backend venv missing ($venvPy). Launch Juman once to bootstrap (needs PyPI), or run scripts\bootstrap-backend-venv.ps1"
  }
  if (-not (Test-Path $runApi)) { throw "run_api.py missing: $runApi" }
  $env:JUMAN_INSTALL_DIR = $InstallDir
  $p = Start-Process -FilePath $venvPy -ArgumentList @($runApi, "migrate") -WorkingDirectory (Join-Path $InstallDir "backend") -Wait -PassThru -NoNewWindow
  if ($p.ExitCode -ne 0) { throw "run_api.py migrate failed exit=$($p.ExitCode)" }
  return [pscustomobject]@{ Ok = $true; ExitCode = $p.ExitCode; Message = "Migrations applied (upgrade head)" }
}

function Test-AlembicHead {
  param(
    [Parameter(Mandatory)][string]$PsqlExe,
    [Parameter(Mandatory)][string]$DbHost,
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][string]$AppUser,
    [Parameter(Mandatory)][string]$AppPassword,
    [Parameter(Mandatory)][string]$DbName
  )
  $env:PGPASSWORD = $AppPassword
  try {
    $rev = & $PsqlExe -h $DbHost -p $Port -U $AppUser -d $DbName -tAc "SELECT version_num FROM alembic_version ORDER BY version_num DESC LIMIT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) { throw ("alembic_version query failed: " + ($rev | Out-String)) }
    $v = ("$rev").Trim()
    if ([string]::IsNullOrWhiteSpace($v)) { throw "alembic_version empty - migrations may not have run" }
    return [pscustomobject]@{ Ok = $true; Revision = $v; Message = "HEAD revision present: $v" }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}