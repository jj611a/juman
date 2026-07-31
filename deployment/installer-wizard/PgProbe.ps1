#Requires -Version 5.1
function Get-ProgramFiles64 {
  if ($env:ProgramW6432) { return $env:ProgramW6432 }
  return $env:ProgramFiles
}

function Find-PostgreSQLPrefix {
  $pf = Get-ProgramFiles64
  $candidates = @(
    (Join-Path $pf "PostgreSQL\16"),
    (Join-Path $pf "PostgreSQL\17"),
    (Join-Path $pf "PostgreSQL\15")
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c "bin\postgres.exe")) { return $c }
  }
  # registry
  $keys = @(
    "HKLM:\SOFTWARE\PostgreSQL\Installations\*",
    "HKLM:\SOFTWARE\WOW6432Node\PostgreSQL\Installations\*"
  )
  foreach ($pat in $keys) {
    Get-Item $pat -ErrorAction SilentlyContinue | ForEach-Object {
      $base = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).BaseDirectory
      if ($base -and (Test-Path (Join-Path $base "bin\postgres.exe"))) { return $base }
    }
  }
  return $null
}

function Get-PostgreSQLVersionString([string]$Prefix) {
  $exe = Join-Path $Prefix "bin\postgres.exe"
  if (-not (Test-Path $exe)) { return $null }
  $r = & $exe --version 2>&1 | Out-String
  return $r.Trim()
}

function Test-PostgreSQLMajor16([string]$VersionText) {
  if ([string]::IsNullOrWhiteSpace($VersionText)) { return $false }
  return ($VersionText -match '(?i)postgresql\s+16\b') -or ($VersionText -match '\b16\.\d+')
}

function Test-PgService([string]$ServiceName = "postgresql-x64-16") {
  $sc = Join-Path $env:SystemRoot "System32\sc.exe"
  $q = & $sc query $ServiceName 2>&1 | Out-String
  $exists = $q -match "SERVICE_NAME"
  $running = $q -match "STATE\s*:\s*\d+\s+RUNNING"
  return [pscustomobject]@{ Name = $ServiceName; Exists = $exists; Running = $running; Raw = $q }
}

function Invoke-PostgreSQLProbe {
  param([string]$ServiceName = "postgresql-x64-16", [int]$RequiredMajor = 16)

  $problems = New-Object System.Collections.Generic.List[string]
  $prefix = Find-PostgreSQLPrefix
  $postgresExe = $null
  $version = $null
  $svc = Test-PgService -ServiceName $ServiceName

  if (-not $prefix) {
    [void]$problems.Add("PostgreSQL installation folder / postgres.exe not found under Program Files.")
  } else {
    $postgresExe = Join-Path $prefix "bin\postgres.exe"
    if (-not (Test-Path $postgresExe)) {
      [void]$problems.Add("postgres.exe missing: $postgresExe")
    } else {
      $version = Get-PostgreSQLVersionString -Prefix $prefix
      if (-not (Test-PostgreSQLMajor16 -VersionText $version)) {
        [void]$problems.Add("Unsupported PostgreSQL version (need major $RequiredMajor): $version")
      }
    }
  }

  if (-not $svc.Exists) {
    [void]$problems.Add("Windows service missing: $ServiceName")
  } elseif (-not $svc.Running) {
    [void]$problems.Add("Windows service not RUNNING: $ServiceName")
  }

  $ok = ($problems.Count -eq 0)
  $fix = if (-not $ok) {
    "1) Install PostgreSQL 16 using 'Install PostgreSQL.exe' from the release package.`n2) Remember the postgres superuser password.`n3) Ensure service $ServiceName is Running.`n4) Re-run Install Juman."
  } else { $null }

  return [pscustomobject]@{
    Ok = $ok
    Prefix = $prefix
    PostgresExe = $postgresExe
    PsqlExe = if ($prefix) { Join-Path $prefix "bin\psql.exe" } else { $null }
    Version = $version
    Service = $svc
    Problems = @($problems)
    RecommendedFix = $fix
    TechnicalDetails = (@(
      "Prefix=$prefix",
      "Version=$version",
      "ServiceExists=$($svc.Exists)",
      "ServiceRunning=$($svc.Running)",
      $svc.Raw
    ) -join "`n")
  }
}

function Test-PgConnection {
  param(
    [Parameter(Mandatory)][string]$PsqlExe,
    [Parameter(Mandatory)][string]$DbHost,
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][string]$Superuser,
    [Parameter(Mandatory)][string]$SuperPassword,
    [string]$Database = "postgres"
  )
  if (-not (Test-Path $PsqlExe)) { throw "psql.exe not found: $PsqlExe" }
  $env:PGPASSWORD = $SuperPassword
  $env:PGCLIENTENCODING = "UTF8"
  try {
    $out = & $PsqlExe -h $DbHost -p $Port -U $Superuser -d $Database -tAc "SHOW server_version;" 2>&1
    if ($LASTEXITCODE -ne 0) {
      throw ("Connection failed: " + ($out | Out-String))
    }
    $ver = ("$out").Trim()
    return [pscustomobject]@{ Ok = $true; ServerVersion = $ver; Message = "Connection successful ($ver)" }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}