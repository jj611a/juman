#Requires -Version 5.1
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Version = "3.13.13"
)
$ErrorActionPreference = "Stop"

$outDir = Join-Path $RepoRoot "deployment\runtime\python"
$marker = Join-Path $outDir ".juman-python-version"
$zipName = "python-$Version-embed-amd64.zip"
$uri = "https://www.python.org/ftp/python/$Version/$zipName"
$cacheDir = Join-Path $RepoRoot "deployment\vendor\python"
$zipPath = Join-Path $cacheDir $zipName
$getPip = Join-Path $cacheDir "get-pip.py"

New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

if ((Test-Path (Join-Path $outDir "python.exe")) -and (Test-Path $marker)) {
  $have = (Get-Content -LiteralPath $marker -Raw).Trim()
  $pipOk = (Test-Path (Join-Path $outDir "Scripts\pip.exe")) -or (Test-Path (Join-Path $outDir "Lib\site-packages\pip"))
  if ($have -eq $Version -and $pipOk) {
    Write-Host "Embeddable Python $Version already prepared: $outDir"
    exit 0
  }
}

if (-not (Test-Path $zipPath)) {
  Write-Host "Downloading $uri ..."
  Invoke-WebRequest -Uri $uri -OutFile $zipPath -UseBasicParsing
}
if (-not (Test-Path $zipPath)) { throw "Failed to download $zipName" }

if (Test-Path $outDir) {
  Remove-Item -LiteralPath $outDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $outDir -Force

$pth = Get-ChildItem -LiteralPath $outDir -Filter "python*._pth" | Select-Object -First 1
if (-not $pth) { throw "python*._pth missing under $outDir" }
$pthText = Get-Content -LiteralPath $pth.FullName -Raw
$pthText = $pthText -replace "(?m)^#\s*import site\s*$", "import site"
if ($pthText -notmatch "(?m)^import site\s*$") {
  $pthText = $pthText.TrimEnd() + "`r`nimport site`r`n"
}
if ($pthText -notmatch "(?m)^Lib\\site-packages\s*$") {
  $pthText = $pthText.TrimEnd() + "`r`nLib\site-packages`r`n"
}
[System.IO.File]::WriteAllText($pth.FullName, $pthText)

if (-not (Test-Path $getPip)) {
  Write-Host "Downloading get-pip.py ..."
  Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $getPip -UseBasicParsing
}

$py = Join-Path $outDir "python.exe"
Write-Host "Installing pip into embeddable Python..."
& $py $getPip --no-warn-script-location
if ($LASTEXITCODE -ne 0) { throw "get-pip.py failed exit=$LASTEXITCODE" }

& $py -m pip install --upgrade pip setuptools wheel virtualenv --no-warn-script-location | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pip upgrade failed exit=$LASTEXITCODE" }

Set-Content -LiteralPath $marker -Value $Version -Encoding ASCII
Write-Host "Prepared embeddable Python $Version at $outDir"