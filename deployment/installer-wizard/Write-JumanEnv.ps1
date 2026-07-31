#Requires -Version 5.1
function New-SecureAppSecret([int]$Bytes = 24) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[+/=]', 'x')
}

function Write-JumanEnvFile {
  param(
    [Parameter(Mandatory)][string]$InstallDir,
    [Parameter(Mandatory)][string]$DbHost,
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][string]$DbName,
    [Parameter(Mandatory)][string]$AppUser,
    [Parameter(Mandatory)][string]$AppPassword,
    [string]$BootstrapPassword = "",
    [string]$SecretKey = "",
    [string]$Company = "Juman"
  )
  if (-not $SecretKey) { $SecretKey = New-SecureAppSecret 32 }
  if (-not $BootstrapPassword) { $BootstrapPassword = (New-SecureAppSecret 16).Substring(0, 14) }

  $configDir = Join-Path $InstallDir "config"
  $storage = Join-Path $InstallDir "storage"
  $logs = Join-Path $InstallDir "logs"
  New-Item -ItemType Directory -Force -Path $configDir, $storage, $logs, (Join-Path $InstallDir "data"), (Join-Path $InstallDir "runtime"), (Join-Path $storage "media"), (Join-Path $storage "backups") | Out-Null

  $dbUrlUser = [uri]::EscapeDataString($AppUser)
  $dbUrlPass = [uri]::EscapeDataString($AppPassword)
  $dsn = "postgresql+asyncpg://${dbUrlUser}:${dbUrlPass}@${DbHost}:${Port}/${DbName}"
  $storagePosix = $storage -replace "\\", "/"
  $installPosix = $InstallDir -replace "\\", "/"

  $envPath = Join-Path $configDir "juman.env"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  $lines = @(
    "APP_NAME=Juman"
    "APP_ENV=production"
    "APP_DEBUG=false"
    "SECRET_KEY=$SecretKey"
    "HOST=127.0.0.1"
    "PORT=8000"
    "DATABASE_URL=$dsn"
    "MEDIA_STORAGE_ROOT=$storagePosix"
    "IDENTITY_BOOTSTRAP_USERNAME=admin"
    "IDENTITY_BOOTSTRAP_PASSWORD=$BootstrapPassword"
    "JUMAN_COMPANY_NAME=$Company"
    "JUMAN_TIMEZONE=Asia/Baghdad"
    "JUMAN_LANGUAGE=ar"
    "JUMAN_INSTALL_DIR=$installPosix"
    "JUMAN_DB_WAIT_TIMEOUT=180"
    "LOG_LEVEL=INFO"
    "LOG_JSON=false"
  )
  [System.IO.File]::WriteAllLines($envPath, $lines, $utf8NoBom)

  # App credentials only - never postgres superuser password
  $credPath = Join-Path $configDir "install-credentials.txt"
  $cred = @(
    "Generated at install - change admin password on first run."
    "IDENTITY_BOOTSTRAP_USERNAME=admin"
    "IDENTITY_BOOTSTRAP_PASSWORD=$BootstrapPassword"
    "DB_USER=$AppUser"
    "DB_PASSWORD=$AppPassword"
    "DB_NAME=$DbName"
    "DB_HOST=$DbHost"
    "DB_PORT=$Port"
  )
  [System.IO.File]::WriteAllLines($credPath, $cred, $utf8NoBom)

  if (-not (Test-Path $envPath)) { throw "juman.env was not created" }
  $readable = $false
  try { Get-Content -LiteralPath $envPath -TotalCount 1 | Out-Null; $readable = $true } catch { throw "juman.env not readable: $($_.Exception.Message)" }

  return [pscustomobject]@{
    Ok = $true
    EnvPath = $envPath
    CredentialsPath = $credPath
    Readable = $readable
    SecretKey = $SecretKey
    BootstrapPassword = $BootstrapPassword
    Message = "Configuration written (app credentials only)"
  }
}