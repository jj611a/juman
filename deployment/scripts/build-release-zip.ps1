#Requires -Version 5.1
<#
.SYNOPSIS
  Assemble the release ZIP kit (EDB PostgreSQL + Install Juman + guides).
  Does NOT embed PostgreSQL inside Install Juman.exe.
#>
param(
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$Version = "",
  [string]$SetupPath = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $Version) {
  $pkg = Get-Content (Join-Path $RepoRoot "frontend\package.json") -Raw | ConvertFrom-Json
  $Version = [string]$pkg.version
}

$releaseDir = Join-Path $RepoRoot "frontend\release"
if (-not $SetupPath) {
  $setup = Get-ChildItem -Path $releaseDir -Filter "Juman-Setup-*.exe" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $setup) { throw "No Juman-Setup-*.exe under $releaseDir. Run package-installer.ps1 first." }
  $SetupPath = $setup.FullName
}
if (-not (Test-Path -LiteralPath $SetupPath)) { throw "Setup not found: $SetupPath" }

if (-not $OutDir) {
  $OutDir = Join-Path $RepoRoot "frontend\release\Juman-v$Version"
}
if (Test-Path $OutDir) { Remove-Item -Recurse -Force $OutDir }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Fetch official EDB installer into a staging folder, then copy as Install PostgreSQL.exe
$vendorPg = Join-Path $RepoRoot "deployment\vendor\postgresql"
& (Join-Path $PSScriptRoot "fetch-postgresql.ps1") -OutDir $vendorPg
$edb = Get-ChildItem -Path $vendorPg -Filter "postgresql-*-windows-x64.exe" |
  Sort-Object Name -Descending | Select-Object -First 1
if (-not $edb) { throw "EDB PostgreSQL installer missing after fetch-postgresql.ps1" }

Copy-Item -LiteralPath $edb.FullName -Destination (Join-Path $OutDir "Install PostgreSQL.exe") -Force
Copy-Item -LiteralPath $SetupPath -Destination (Join-Path $OutDir "Install Juman.exe") -Force

$kit = Join-Path $RepoRoot "deployment\release-kit"
New-Item -ItemType Directory -Force -Path $kit | Out-Null

# Ensure README FIRST exists
$readmeSrc = Join-Path $kit "README FIRST.txt"
if (-not (Test-Path $readmeSrc)) {
  throw "Missing deployment\release-kit\README FIRST.txt"
}
Copy-Item -LiteralPath $readmeSrc -Destination (Join-Path $OutDir "README FIRST.txt") -Force

# Guides: prefer PDF; fall back to HTML printable
function Copy-Guide([string]$BaseName) {
  $pdf = Join-Path $kit "$BaseName.pdf"
  $html = Join-Path $kit "$BaseName.html"
  $md = Join-Path $kit "$BaseName.md"
  $destPdf = Join-Path $OutDir "$BaseName.pdf"
  if (Test-Path $pdf) {
    Copy-Item $pdf $destPdf -Force
    return
  }
  if (Test-Path $md) {
    $pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
    if ($pandoc) {
      & pandoc $md -o $destPdf
      if (Test-Path $destPdf) { return }
    }
  }
  if (Test-Path $html) {
    # Ship HTML with .pdf name only if no PDF tool - prefer copy as .html and also note
    Copy-Item $html (Join-Path $OutDir "$BaseName.html") -Force
    # Create a minimal PDF-named marker via Word COM if available
    try {
      $word = New-Object -ComObject Word.Application
      $word.Visible = $false
      $doc = $word.Documents.Open((Resolve-Path $html).Path)
      $wdFormatPDF = 17
      $doc.SaveAs([ref]$destPdf, [ref]$wdFormatPDF)
      $doc.Close()
      $word.Quit()
      [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
      if (Test-Path $destPdf) { return }
    } catch {
      Write-Warning "PDF generation failed for $BaseName : $($_.Exception.Message)"
    }
  }
  if (-not (Test-Path $destPdf)) {
    # Last resort: copy markdown content into a text file named .pdf is wrong;
    # write a short placeholder PDF-like text file with .pdf extension for kit completeness
    # Prefer shipping HTML alongside and throw to fail closed on release agents.
    throw "Could not produce '$BaseName.pdf'. Install Pandoc or Word, or place the PDF under deployment\release-kit\"
  }
}

Copy-Guide "PostgreSQL Installation Guide"
Copy-Guide "Quick Start"

$zipPath = Join-Path $RepoRoot "frontend\release\Juman-v$Version.zip"
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $zipPath -Force

# Validate top-level entries inside folder (and thus zip content)
$required = @(
  "Install PostgreSQL.exe",
  "Install Juman.exe",
  "PostgreSQL Installation Guide.pdf",
  "Quick Start.pdf",
  "README FIRST.txt"
)
foreach ($name in $required) {
  $p = Join-Path $OutDir $name
  if (-not (Test-Path -LiteralPath $p)) { throw "Release kit missing required file: $name" }
}

Write-Host "Release folder: $OutDir"
Write-Host "Release ZIP:    $zipPath"
Write-Host "Required entries OK ($($required.Count))"
