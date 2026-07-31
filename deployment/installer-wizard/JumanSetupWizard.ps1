#Requires -Version 5.1
#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Elevated WinForms setup wizard for Juman (external PostgreSQL 16).
  Fail-closed: no fake juman.env; postgres superuser password never written to disk.
#>
param(
  [Parameter(Mandatory = $true)][string]$InstallDir
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:WizardRoot = $PSScriptRoot
. (Join-Path $script:WizardRoot "PgProbe.ps1")
. (Join-Path $script:WizardRoot "PgBootstrap.ps1")
. (Join-Path $script:WizardRoot "Write-JumanEnv.ps1")
. (Join-Path $script:WizardRoot "Install-BackendService.ps1")
. (Join-Path $script:WizardRoot "Write-InstallerReport.ps1")

$stepLog = Join-Path $InstallDir "scripts\InstallerStepLog.ps1"
if (Test-Path $stepLog) { . $stepLog }
else {
  function Initialize-InstallerLog { param($InstallDir) New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "logs") | Out-Null }
  function Invoke-InstallerStep {
    param([string]$InstallDir, [string]$Name, [scriptblock]$Action)
    Write-Host "STEP $Name"
    & $Action
  }
  function Add-InstallerStepRecord {
    param([string]$InstallDir, [hashtable]$Record)
    $path = Join-Path $InstallDir "logs\installer.json"
    $arr = @()
    if (Test-Path $path) {
      try { $arr = @(Get-Content $path -Raw | ConvertFrom-Json) } catch { $arr = @() }
    }
    $arr += [pscustomobject]$Record
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [IO.File]::WriteAllText($path, ($arr | ConvertTo-Json -Depth 8), $utf8NoBom)
  }
}

Initialize-InstallerLog -InstallDir $InstallDir

$script:State = [ordered]@{
  PageIndex = 0
  Probe = $null
  DbHost = "localhost"
  Port = 5432
  Superuser = "postgres"
  SuperPassword = ""
  DbName = "juman"
  AppUser = "juman_app"
  AppPassword = ""
  GenerateAppPassword = $true
  ConnectionOk = $false
  ConnectionMessage = ""
  BootstrapOk = $false
  MigrateOk = $false
  AlembicRevision = ""
  EnvPath = ""
  EnvReadable = $false
  ServiceOk = $false
  HealthOk = $false
  ValidationOk = $false
  LastError = $null
  OverallOk = $false
  ReportPath = ""
  Notes = New-Object System.Collections.Generic.List[string]
}

function New-SecurePasswordLocal([int]$Len = 24) {
  $b = New-Object byte[] $Len
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
  return ([Convert]::ToBase64String($b) -replace '[+/=]', 'A').Substring(0, [Math]::Min($Len, 28))
}

function Clear-SuperPassword {
  $script:State.SuperPassword = ""
  if ($null -ne $script:txtSuperPass) { $script:txtSuperPass.Text = "" }
}

function Write-FailReport([string]$Technical) {
  try {
    $probeVer = "n/a"
    $probePrefix = "n/a"
    if ($null -ne $script:State.Probe) {
      $probeVer = $script:State.Probe.Version
      $probePrefix = $script:State.Probe.Prefix
    }
    $script:State.ReportPath = Write-InstallerConfigurationReport -InstallDir $InstallDir -Data @{
      OverallOk = $false
      PgVersion = $probeVer
      PgPrefix = $probePrefix
      PgService = "postgresql-x64-16"
      ConnectionTest = $script:State.ConnectionMessage
      DatabaseCreation = $(if ($script:State.BootstrapOk) { "ok" } else { "failed/incomplete" })
      UserCreation = $(if ($script:State.BootstrapOk) { "ok" } else { "failed/incomplete" })
      MigrationStatus = $(if ($script:State.MigrateOk) { "ok" } else { "failed/incomplete" })
      AlembicRevision = $script:State.AlembicRevision
      EnvPath = $script:State.EnvPath
      EnvReadable = $script:State.EnvReadable
      ServiceInstall = $(if ($script:State.ServiceOk) { "ok" } else { "failed/incomplete" })
      ServiceValidation = $(if ($script:State.ValidationOk) { "ok" } else { "failed/incomplete" })
      Health = $(if ($script:State.HealthOk) { "ok" } else { "failed/incomplete" })
      Notes = (($script:State.Notes | ForEach-Object { "- $_" }) -join "`n")
      Technical = $Technical
    }
  } catch {
    Write-Host "Report write failed: $($_.Exception.Message)"
  }
}

function Show-StepFailure([string]$Problem, [string]$Reason, [string]$Fix, [string]$Technical) {
  $script:State.LastError = [pscustomobject]@{ Problem = $Problem; Reason = $Reason; Fix = $Fix; Technical = $Technical }
  $script:lblProblem.Text = "Problem: $Problem"
  $script:lblReason.Text = "Reason: $Reason"
  $script:lblFix.Text = "Recommended Fix: $Fix"
  $script:txtTech.Text = $Technical
  $script:pnlFail.Visible = $true
  Write-FailReport $Technical
  try {
    Add-InstallerStepRecord -InstallDir $InstallDir -Record @{
      step = "wizard_failure"
      success = $false
      failureReason = $Problem
      exception = $Reason
      stderr = $Technical
      startTime = (Get-Date).ToString("o")
      endTime = (Get-Date).ToString("o")
    }
  } catch {}
}

function Hide-StepFailure {
  $script:pnlFail.Visible = $false
  $script:State.LastError = $null
}

function Set-Status([string]$Text) {
  $script:lblStatus.Text = $Text
  [System.Windows.Forms.Application]::DoEvents()
}

$PageNames = @(
  "Welcome",
  "Requirements",
  "Verify PostgreSQL",
  "Database Configuration",
  "Connection Test",
  "Database Initialization",
  "Backend Installation",
  "Configuration Generation",
  "Service Installation",
  "Validation",
  "Finish"
)

$form = New-Object System.Windows.Forms.Form
$form.Text = "Juman Setup Wizard"
$form.Size = New-Object System.Drawing.Size(780, 620)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.Font = New-Object System.Drawing.Font("Segoe UI", 10)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Location = New-Object System.Drawing.Point(20, 12)
$lblTitle.Size = New-Object System.Drawing.Size(720, 28)
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 14, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($lblTitle)

$lblStatus = New-Object System.Windows.Forms.Label
$lblStatus.Location = New-Object System.Drawing.Point(20, 48)
$lblStatus.Size = New-Object System.Drawing.Size(720, 22)
$lblStatus.ForeColor = [System.Drawing.Color]::DimGray
$form.Controls.Add($lblStatus)
$script:lblStatus = $lblStatus

$pnlContent = New-Object System.Windows.Forms.Panel
$pnlContent.Location = New-Object System.Drawing.Point(20, 78)
$pnlContent.Size = New-Object System.Drawing.Size(720, 340)
$pnlContent.BorderStyle = "FixedSingle"
$form.Controls.Add($pnlContent)

$pnlFail = New-Object System.Windows.Forms.Panel
$pnlFail.Location = New-Object System.Drawing.Point(20, 78)
$pnlFail.Size = New-Object System.Drawing.Size(720, 340)
$pnlFail.BackColor = [System.Drawing.Color]::FromArgb(255, 250, 245)
$pnlFail.Visible = $false
$form.Controls.Add($pnlFail)
$script:pnlFail = $pnlFail

$lblProblem = New-Object System.Windows.Forms.Label
$lblProblem.Location = New-Object System.Drawing.Point(12, 10)
$lblProblem.Size = New-Object System.Drawing.Size(690, 40)
$lblProblem.ForeColor = [System.Drawing.Color]::DarkRed
$pnlFail.Controls.Add($lblProblem)
$script:lblProblem = $lblProblem

$lblReason = New-Object System.Windows.Forms.Label
$lblReason.Location = New-Object System.Drawing.Point(12, 55)
$lblReason.Size = New-Object System.Drawing.Size(690, 40)
$pnlFail.Controls.Add($lblReason)
$script:lblReason = $lblReason

$lblFix = New-Object System.Windows.Forms.Label
$lblFix.Location = New-Object System.Drawing.Point(12, 100)
$lblFix.Size = New-Object System.Drawing.Size(690, 60)
$pnlFail.Controls.Add($lblFix)
$script:lblFix = $lblFix

$lblTechHdr = New-Object System.Windows.Forms.Label
$lblTechHdr.Text = "Technical Details"
$lblTechHdr.Location = New-Object System.Drawing.Point(12, 165)
$lblTechHdr.Size = New-Object System.Drawing.Size(200, 20)
$pnlFail.Controls.Add($lblTechHdr)

$txtTech = New-Object System.Windows.Forms.TextBox
$txtTech.Multiline = $true
$txtTech.ScrollBars = "Vertical"
$txtTech.ReadOnly = $true
$txtTech.Location = New-Object System.Drawing.Point(12, 188)
$txtTech.Size = New-Object System.Drawing.Size(690, 100)
$txtTech.Font = New-Object System.Drawing.Font("Consolas", 8)
$pnlFail.Controls.Add($txtTech)
$script:txtTech = $txtTech

$btnRetry = New-Object System.Windows.Forms.Button
$btnRetry.Text = "Retry step"
$btnRetry.Location = New-Object System.Drawing.Point(12, 298)
$btnRetry.Size = New-Object System.Drawing.Size(110, 28)
$pnlFail.Controls.Add($btnRetry)

$btnRetest = New-Object System.Windows.Forms.Button
$btnRetest.Text = "Re-test connection"
$btnRetest.Location = New-Object System.Drawing.Point(130, 298)
$btnRetest.Size = New-Object System.Drawing.Size(140, 28)
$pnlFail.Controls.Add($btnRetest)

$btnRestartPg = New-Object System.Windows.Forms.Button
$btnRestartPg.Text = "Restart PostgreSQL"
$btnRestartPg.Location = New-Object System.Drawing.Point(280, 298)
$btnRestartPg.Size = New-Object System.Drawing.Size(140, 28)
$pnlFail.Controls.Add($btnRestartPg)

$btnRegen = New-Object System.Windows.Forms.Button
$btnRegen.Text = "Regenerate config"
$btnRegen.Location = New-Object System.Drawing.Point(430, 298)
$btnRegen.Size = New-Object System.Drawing.Size(130, 28)
$pnlFail.Controls.Add($btnRegen)

$btnRemigrate = New-Object System.Windows.Forms.Button
$btnRemigrate.Text = "Re-run migrations"
$btnRemigrate.Location = New-Object System.Drawing.Point(570, 298)
$btnRemigrate.Size = New-Object System.Drawing.Size(130, 28)
$pnlFail.Controls.Add($btnRemigrate)

$lblBody = New-Object System.Windows.Forms.Label
$lblBody.Location = New-Object System.Drawing.Point(16, 16)
$lblBody.Size = New-Object System.Drawing.Size(680, 300)
$lblBody.AutoSize = $false
$pnlContent.Controls.Add($lblBody)

function New-FieldLabel([string]$Text, [int]$Y) {
  $l = New-Object System.Windows.Forms.Label
  $l.Text = $Text
  $l.Location = New-Object System.Drawing.Point(16, $Y)
  $l.Size = New-Object System.Drawing.Size(200, 22)
  $l.Visible = $false
  $pnlContent.Controls.Add($l)
  return $l
}
function New-FieldBox([int]$Y, [bool]$Password = $false) {
  $t = New-Object System.Windows.Forms.TextBox
  $t.Location = New-Object System.Drawing.Point(230, $Y)
  $t.Size = New-Object System.Drawing.Size(280, 24)
  $t.Visible = $false
  if ($Password) { $t.UseSystemPasswordChar = $true }
  $pnlContent.Controls.Add($t)
  return $t
}

$flHost = New-FieldLabel "Host" 16
$txtHost = New-FieldBox 14
$txtHost.Text = "localhost"
$flPort = New-FieldLabel "Port" 46
$txtPort = New-FieldBox 44
$txtPort.Text = "5432"
$flSuper = New-FieldLabel "Superuser" 76
$txtSuper = New-FieldBox 74
$txtSuper.Text = "postgres"
$flSuperPass = New-FieldLabel "Superuser Password" 106
$txtSuperPass = New-FieldBox 104 $true
$script:txtSuperPass = $txtSuperPass
$flDb = New-FieldLabel "Database Name" 136
$txtDb = New-FieldBox 134
$txtDb.Text = "juman"
$flAppUser = New-FieldLabel "App User" 166
$txtAppUser = New-FieldBox 164
$txtAppUser.Text = "juman_app"
$flAppPass = New-FieldLabel "App Password" 196
$txtAppPass = New-FieldBox 194 $true
$chkGen = New-Object System.Windows.Forms.CheckBox
$chkGen.Text = "Generate Secure Password (recommended)"
$chkGen.Checked = $true
$chkGen.Location = New-Object System.Drawing.Point(230, 226)
$chkGen.Size = New-Object System.Drawing.Size(360, 24)
$chkGen.Visible = $false
$pnlContent.Controls.Add($chkGen)
$btnGenNow = New-Object System.Windows.Forms.Button
$btnGenNow.Text = "Generate now"
$btnGenNow.Location = New-Object System.Drawing.Point(520, 194)
$btnGenNow.Size = New-Object System.Drawing.Size(110, 26)
$btnGenNow.Visible = $false
$pnlContent.Controls.Add($btnGenNow)

$configControls = @($flHost,$txtHost,$flPort,$txtPort,$flSuper,$txtSuper,$flSuperPass,$txtSuperPass,$flDb,$txtDb,$flAppUser,$txtAppUser,$flAppPass,$txtAppPass,$chkGen,$btnGenNow)

$btnBack = New-Object System.Windows.Forms.Button
$btnBack.Text = "Back"
$btnBack.Location = New-Object System.Drawing.Point(360, 530)
$btnBack.Size = New-Object System.Drawing.Size(100, 32)
$form.Controls.Add($btnBack)

$btnNext = New-Object System.Windows.Forms.Button
$btnNext.Text = "Next"
$btnNext.Location = New-Object System.Drawing.Point(470, 530)
$btnNext.Size = New-Object System.Drawing.Size(120, 32)
$form.Controls.Add($btnNext)

$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.Location = New-Object System.Drawing.Point(600, 530)
$btnCancel.Size = New-Object System.Drawing.Size(100, 32)
$form.Controls.Add($btnCancel)

$script:ExitCode = 1

function Show-ConfigFields([bool]$Show) {
  foreach ($c in $configControls) { $c.Visible = $Show }
  $lblBody.Visible = (-not $Show)
}

function Read-ConfigFromUi {
  $script:State.DbHost = $txtHost.Text.Trim()
  $script:State.Port = [int]$txtPort.Text.Trim()
  $script:State.Superuser = $txtSuper.Text.Trim()
  $script:State.SuperPassword = $txtSuperPass.Text
  $script:State.DbName = $txtDb.Text.Trim()
  $script:State.AppUser = $txtAppUser.Text.Trim()
  $script:State.GenerateAppPassword = $chkGen.Checked
  if ($chkGen.Checked -or [string]::IsNullOrWhiteSpace($txtAppPass.Text)) {
    $script:State.AppPassword = New-SecurePasswordLocal
    $txtAppPass.Text = $script:State.AppPassword
  } else {
    $script:State.AppPassword = $txtAppPass.Text
  }
}

function Render-Page {
  $i = $script:State.PageIndex
  $lblTitle.Text = "($($i+1)/$($PageNames.Count)) $($PageNames[$i])"
  Hide-StepFailure
  Show-ConfigFields $false
  $btnBack.Enabled = ($i -gt 0 -and $i -lt ($PageNames.Count - 1))
  $btnNext.Enabled = $true
  if ($i -eq ($PageNames.Count - 1)) { $btnNext.Text = "Close" } else { $btnNext.Text = "Next" }
  $btnCancel.Enabled = ($i -lt ($PageNames.Count - 1))

  switch ($i) {
    0 {
      $sb = New-Object System.Text.StringBuilder
      [void]$sb.AppendLine("Welcome to Juman Setup.")
      [void]$sb.AppendLine("")
      [void]$sb.AppendLine("This wizard configures Juman against an existing PostgreSQL 16 installation.")
      [void]$sb.AppendLine("PostgreSQL is NOT installed by this wizard.")
      [void]$sb.AppendLine("")
      [void]$sb.AppendLine("Before continuing:")
      [void]$sb.AppendLine("1) Run Install PostgreSQL.exe from the release package (if needed).")
      [void]$sb.AppendLine("2) Remember the postgres superuser password.")
      [void]$sb.AppendLine("3) Ensure Windows service postgresql-x64-16 is Running.")
      [void]$sb.AppendLine("")
      [void]$sb.AppendLine("InstallDir: $InstallDir")
      $lblBody.Text = $sb.ToString()
      Set-Status "Ready"
    }
    1 {
      $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
      $os = [Environment]::OSVersion.VersionString
      $driveLetter = (Get-Item $InstallDir).PSDrive.Name
      $freeGB = [math]::Round((Get-PSDrive $driveLetter).Free / 1GB, 1)
      $okDisk = $freeGB -ge 2
      $adminText = if ($isAdmin) { "OK" } else { "MISSING - re-run elevated" }
      $diskText = if ($okDisk) { "OK" } else { "need >= 2 GB" }
      $lines = @(
        "Administrator: $adminText",
        "Windows: $os",
        "Free disk on ${driveLetter}: : ${freeGB} GB ($diskText)",
        "Install directory: $InstallDir"
      )
      $lblBody.Text = ($lines -join "`r`n`r`n")
      if (-not $isAdmin -or -not $okDisk) {
        Show-StepFailure "Requirements not met" "Admin and/or disk space check failed" "Run as Administrator; free disk space; retry." ($lines -join "`n")
        $btnNext.Enabled = $false
      } else { Set-Status "Requirements OK" }
    }
    2 {
      Set-Status "Probing PostgreSQL..."
      $probe = Invoke-PostgreSQLProbe
      $script:State.Probe = $probe
      if (-not $probe.Ok) {
        $lblBody.Text = "PostgreSQL verification FAILED.`r`n`r`n" + ($probe.Problems -join "`r`n")
        Show-StepFailure "PostgreSQL not ready" (($probe.Problems) -join "; ") $probe.RecommendedFix $probe.TechnicalDetails
        $btnNext.Enabled = $false
      } else {
        $lblBody.Text = "PostgreSQL verified.`r`n`r`nVersion: $($probe.Version)`r`nPrefix: $($probe.Prefix)`r`nService: $($probe.Service.Name) RUNNING"
        Set-Status "PostgreSQL OK"
      }
    }
    3 {
      Show-ConfigFields $true
      $lblBody.Text = ""
      Set-Status "Enter database settings (postgres password is never saved to disk)"
    }
    4 {
      if ($script:State.ConnectionOk) {
        $lblBody.Text = "Connection OK:`r`n$($script:State.ConnectionMessage)`r`n`r`nClick Next to continue."
      } else {
        $lblBody.Text = "Click Next to test the connection with the credentials you entered."
      }
      Set-Status "Connection test"
    }
    5 {
      $lblBody.Text = "Next will create the database/user, run migrations, and verify Alembic HEAD."
      Set-Status "Database initialization"
    }
    6 {
      $api = Test-Path (Join-Path $InstallDir "backend\juman-api.exe")
      $winsw = Test-Path (Join-Path $InstallDir "backend\JumanApi.exe")
      $xml = Test-Path (Join-Path $InstallDir "backend\JumanApi.xml")
      $ok = $api -and $winsw -and $xml
      $apiT = if ($api) { "OK" } else { "MISSING" }
      $winswT = if ($winsw) { "OK" } else { "MISSING" }
      $xmlT = if ($xml) { "OK" } else { "MISSING" }
      $lblBody.Text = "Backend files (copied by NSIS):`r`n`r`njuman-api.exe: $apiT`r`nJumanApi.exe (WinSW): $winswT`r`nJumanApi.xml: $xmlT"
      if (-not $ok) {
        Show-StepFailure "Backend files missing" "NSIS copy incomplete" "Re-run Install Juman.exe" $lblBody.Text
        $btnNext.Enabled = $false
      } else { Set-Status "Backend files present" }
    }
    7 {
      $lblBody.Text = "Next writes config\juman.env with the application DB user only (no postgres password)."
      Set-Status "Configuration generation"
    }
    8 {
      $lblBody.Text = "Next installs and starts the JumanApi Windows service (WinSW)."
      Set-Status "Service installation"
    }
    9 {
      $lblBody.Text = "Next validates app-user DB access, health endpoint, storage folders, and service RUNNING."
      Set-Status "Validation"
    }
    10 {
      $overall = if ($script:State.OverallOk) { "COMPLETED SUCCESSFULLY" } else { "INCOMPLETE" }
      $health = if ($script:State.HealthOk) { "OK" } else { "N/A" }
      $summary = @(
        "Setup $overall",
        "",
        "PostgreSQL: $($script:State.Probe.Version)",
        "Database: $($script:State.DbName) / user $($script:State.AppUser)",
        "Alembic: $($script:State.AlembicRevision)",
        "Env: $($script:State.EnvPath)",
        "Health: $health",
        "Report: $($script:State.ReportPath)",
        "",
        "Launch Juman from the Start Menu. Change the bootstrap admin password on first run.",
        "Credentials file: config\install-credentials.txt"
      )
      $lblBody.Text = ($summary -join "`r`n")
      if ($script:State.OverallOk) { Set-Status "Finished" } else { Set-Status "Finished with errors - see report" }
    }
  }
}

function Invoke-ConnectionTest {
  Read-ConfigFromUi
  if ([string]::IsNullOrWhiteSpace($script:State.SuperPassword)) {
    throw "Superuser password is required"
  }
  if ($null -eq $script:State.Probe -or [string]::IsNullOrWhiteSpace([string]$script:State.Probe.PsqlExe)) {
    $script:State.Probe = Invoke-PostgreSQLProbe
  }
  $r = Test-PgConnection -PsqlExe $script:State.Probe.PsqlExe -DbHost $script:State.DbHost -Port $script:State.Port `
    -Superuser $script:State.Superuser -SuperPassword $script:State.SuperPassword
  $script:State.ConnectionOk = $true
  $script:State.ConnectionMessage = $r.Message
  return $r
}

function Invoke-DbInit {
  Read-ConfigFromUi
  Invoke-InstallerStep -InstallDir $InstallDir -Name "bootstrap_database" -Action {
    $b = Invoke-PgBootstrap -PsqlExe $script:State.Probe.PsqlExe -DbHost $script:State.DbHost -Port $script:State.Port `
      -Superuser $script:State.Superuser -SuperPassword $script:State.SuperPassword `
      -DbName $script:State.DbName -AppUser $script:State.AppUser -AppPassword $script:State.AppPassword
    $script:State.BootstrapOk = $true
    [void]$script:State.Notes.Add($b.Message)
  }
  $envResult = Write-JumanEnvFile -InstallDir $InstallDir -DbHost $script:State.DbHost -Port $script:State.Port `
    -DbName $script:State.DbName -AppUser $script:State.AppUser -AppPassword $script:State.AppPassword
  $script:State.EnvPath = $envResult.EnvPath
  $script:State.EnvReadable = $envResult.Readable
  Invoke-SetInstallAcls

  Invoke-InstallerStep -InstallDir $InstallDir -Name "migrate" -Action {
    $m = Invoke-AlembicMigrate -InstallDir $InstallDir
    $script:State.MigrateOk = $true
    [void]$script:State.Notes.Add($m.Message)
  }
  $head = Test-AlembicHead -PsqlExe $script:State.Probe.PsqlExe -DbHost $script:State.DbHost -Port $script:State.Port `
    -AppUser $script:State.AppUser -AppPassword $script:State.AppPassword -DbName $script:State.DbName
  $script:State.AlembicRevision = $head.Revision
  [void]$script:State.Notes.Add($head.Message)
}

function Invoke-SetInstallAcls {
  $acl = Join-Path $InstallDir "scripts\set-install-acls.ps1"
  if (Test-Path -LiteralPath $acl) {
    & $acl -InstallDir $InstallDir
  }
}

function Invoke-WriteEnvOnly {
  Read-ConfigFromUi
  $envResult = Write-JumanEnvFile -InstallDir $InstallDir -DbHost $script:State.DbHost -Port $script:State.Port `
    -DbName $script:State.DbName -AppUser $script:State.AppUser -AppPassword $script:State.AppPassword
  $script:State.EnvPath = $envResult.EnvPath
  $script:State.EnvReadable = $envResult.Readable
  if (-not $envResult.Readable) { throw "juman.env not readable after write" }
  Invoke-SetInstallAcls
}

function Invoke-ServiceInstall {
  Invoke-InstallerStep -InstallDir $InstallDir -Name "winsw_install" -Action {
    $s = Install-JumanBackendService -InstallDir $InstallDir
    $script:State.ServiceOk = $true
    [void]$script:State.Notes.Add($s.Message)
  }
}

function Invoke-Validation {
  $head = Test-AlembicHead -PsqlExe $script:State.Probe.PsqlExe -DbHost $script:State.DbHost -Port $script:State.Port `
    -AppUser $script:State.AppUser -AppPassword $script:State.AppPassword -DbName $script:State.DbName
  $script:State.AlembicRevision = $head.Revision

  foreach ($d in @("storage","logs","config","data","runtime")) {
    $p = Join-Path $InstallDir $d
    if (-not (Test-Path $p)) { throw "Missing folder: $p" }
  }

  $svc = Test-JumanApiServiceRunning
  if (-not $svc.Ok) { throw $svc.Message }

  $h = Wait-JumanHealth -TimeoutSec 120
  $script:State.HealthOk = $true
  $script:State.ValidationOk = $true
  [void]$script:State.Notes.Add($h.Message)
  [void]$script:State.Notes.Add($svc.Message)
}

function Advance-FromPage {
  $i = $script:State.PageIndex
  try {
    switch ($i) {
      3 {
        Read-ConfigFromUi
        if ([string]::IsNullOrWhiteSpace($script:State.SuperPassword)) {
          Show-StepFailure "Missing password" "Superuser password empty" "Enter the postgres password from PostgreSQL install." ""
          return $false
        }
      }
      4 {
        Set-Status "Testing connection..."
        Invoke-InstallerStep -InstallDir $InstallDir -Name "connection_test" -Action { Invoke-ConnectionTest | Out-Null }
        Set-Status $script:State.ConnectionMessage
      }
      5 {
        Set-Status "Initializing database..."
        Invoke-DbInit
        Set-Status "Database ready; Alembic $($script:State.AlembicRevision)"
      }
      7 {
        Set-Status "Writing juman.env..."
        Invoke-InstallerStep -InstallDir $InstallDir -Name "write_env" -Action { Invoke-WriteEnvOnly }
        Set-Status "Configuration written"
      }
      8 {
        Set-Status "Installing service..."
        Invoke-ServiceInstall
        Set-Status "Service started"
      }
      9 {
        Set-Status "Validating..."
        Invoke-InstallerStep -InstallDir $InstallDir -Name "validation" -Action { Invoke-Validation }
        $script:State.OverallOk = $true
        $script:State.ReportPath = Write-InstallerConfigurationReport -InstallDir $InstallDir -Data @{
          OverallOk = $true
          PgVersion = $script:State.Probe.Version
          PgPrefix = $script:State.Probe.Prefix
          PgService = $script:State.Probe.Service.Name
          ConnectionTest = $script:State.ConnectionMessage
          DatabaseCreation = "ok"
          UserCreation = "ok"
          MigrationStatus = "ok"
          AlembicRevision = $script:State.AlembicRevision
          EnvPath = $script:State.EnvPath
          EnvReadable = $script:State.EnvReadable
          ServiceInstall = "ok"
          ServiceValidation = "ok"
          Health = "ok"
          Notes = (($script:State.Notes | ForEach-Object { "- $_" }) -join "`n")
          Technical = "Wizard completed successfully"
        }
        Clear-SuperPassword
        Set-Status "Validation OK"
      }
    }
    return $true
  } catch {
    $tech = $_.Exception.Message
    if ($_.ScriptStackTrace) { $tech += "`n$($_.ScriptStackTrace)" }
    Show-StepFailure $PageNames[$i] $_.Exception.Message "Use recovery buttons below, then Retry." $tech
    return $false
  }
}

$btnNext.Add_Click({
  if ($script:State.PageIndex -eq ($PageNames.Count - 1)) {
    if ($script:State.OverallOk) { $script:ExitCode = 0 } else { $script:ExitCode = 1 }
    $form.Close()
    return
  }
  if (-not (Advance-FromPage)) { return }
  $script:State.PageIndex++
  Render-Page
})

$btnBack.Add_Click({
  if ($script:State.PageIndex -gt 0) {
    $script:State.PageIndex--
    Render-Page
  }
})

$btnCancel.Add_Click({
  Write-FailReport "User cancelled"
  Clear-SuperPassword
  $script:ExitCode = 1
  $form.Close()
})

$btnRetry.Add_Click({
  Hide-StepFailure
  if (Advance-FromPage) {
    $script:State.PageIndex++
    Render-Page
  }
})

$btnRetest.Add_Click({
  try {
    Hide-StepFailure
    Set-Status "Re-testing..."
    Invoke-ConnectionTest | Out-Null
    Set-Status $script:State.ConnectionMessage
    [System.Windows.Forms.MessageBox]::Show($script:State.ConnectionMessage, "Connection Test", "OK", "Information") | Out-Null
  } catch {
    Show-StepFailure "Connection test" $_.Exception.Message "Check host/port/password; ensure PostgreSQL is running." $_.Exception.Message
  }
})

$btnRestartPg.Add_Click({
  try {
    Restart-PostgreSQLService | Out-Null
    Set-Status "PostgreSQL service restarted"
    [System.Windows.Forms.MessageBox]::Show("postgresql-x64-16 restarted.", "PostgreSQL", "OK", "Information") | Out-Null
  } catch {
    Show-StepFailure "Restart PostgreSQL" $_.Exception.Message "Start service manually via services.msc" $_.Exception.Message
  }
})

$btnRegen.Add_Click({
  try {
    Hide-StepFailure
    Invoke-WriteEnvOnly
    Set-Status "Configuration regenerated"
    [System.Windows.Forms.MessageBox]::Show("juman.env rewritten (app credentials only).", "Config", "OK", "Information") | Out-Null
  } catch {
    Show-StepFailure "Regenerate config" $_.Exception.Message "Retry after fixing permissions on InstallDir\config" $_.Exception.Message
  }
})

$btnRemigrate.Add_Click({
  try {
    Hide-StepFailure
    Invoke-AlembicMigrate -InstallDir $InstallDir | Out-Null
    $head = Test-AlembicHead -PsqlExe $script:State.Probe.PsqlExe -DbHost $script:State.DbHost -Port $script:State.Port `
      -AppUser $script:State.AppUser -AppPassword $script:State.AppPassword -DbName $script:State.DbName
    $script:State.AlembicRevision = $head.Revision
    $script:State.MigrateOk = $true
    Set-Status $head.Message
    [System.Windows.Forms.MessageBox]::Show($head.Message, "Migrations", "OK", "Information") | Out-Null
  } catch {
    Show-StepFailure "Re-run migrations" $_.Exception.Message "Ensure juman.env DATABASE_URL is correct; retry." $_.Exception.Message
  }
})

$btnGenNow.Add_Click({
  $txtAppPass.Text = New-SecurePasswordLocal
  $chkGen.Checked = $false
})

$chkGen.Add_CheckedChanged({
  $txtAppPass.Enabled = (-not $chkGen.Checked)
})

$form.Add_Shown({ Render-Page })
$form.Add_FormClosed({ Clear-SuperPassword })

[void]$form.ShowDialog()
exit $script:ExitCode
