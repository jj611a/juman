#Requires -Version 5.1
param([Parameter(Mandatory=$true)][string]$OutFile)
$ErrorActionPreference = "Stop"
function New-Secret([int]$Bytes) {
  $b = New-Object byte[] $Bytes
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[+/=]', 'x')
}
$lines = @(
  (New-Secret 32),
  (New-Secret 18).Substring(0, [Math]::Min(24, (New-Secret 18).Length)),
  (New-Secret 12),
  (New-Secret 18)
)
# regenerate cleanly
$sk = New-Secret 32
$db = (New-Secret 24).Substring(0, 20)
$boot = (New-Secret 16).Substring(0, 14)
$pg = (New-Secret 24).Substring(0, 20)
@(
  "SECRET_KEY=$sk"
  "DB_PASSWORD=$db"
  "BOOTSTRAP_PASSWORD=$boot"
  "PG_SUPER_PASSWORD=$pg"
) | Set-Content -Path $OutFile -Encoding ASCII
Write-Host "Wrote $OutFile"