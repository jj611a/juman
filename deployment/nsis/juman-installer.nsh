; Juman NSIS helpers - external PostgreSQL required (wizard configures DB).
; Backend deps install on first desktop launch (live PyPI + WinSW).

!include LogicLib.nsh
!include FileFunc.nsh
!include x64.nsh

Var RetainDatabase
Var RetainStorage
Var Ps64

!macro preInit
  SetRegView 64
!macroend

!macro customInit
  StrCpy $RetainDatabase "1"
  StrCpy $RetainStorage "1"
!macroend

!macro ResolvePowerShell64
  IfFileExists "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe" 0 ps_sys32
    StrCpy $Ps64 "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
    Goto ps_done
  ps_sys32:
    StrCpy $Ps64 "$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
  ps_done:
!macroend

!macro customInstall
  !insertmacro ResolvePowerShell64

  DetailPrint "Creating Juman directories..."
  CreateDirectory "$INSTDIR\config"
  CreateDirectory "$INSTDIR\data"
  CreateDirectory "$INSTDIR\logs"
  CreateDirectory "$INSTDIR\storage"
  CreateDirectory "$INSTDIR\runtime"
  CreateDirectory "$INSTDIR\backend"
  CreateDirectory "$INSTDIR\scripts"
  CreateDirectory "$INSTDIR\installer-wizard"

  IfFileExists "$INSTDIR\resources\backend\run_api.py" 0 missing_api
    nsExec::ExecToLog 'cmd /c xcopy /E /I /Y "$INSTDIR\resources\backend\*" "$INSTDIR\backend\"'
    Pop $0
    Goto after_api
  missing_api:
    MessageBox MB_ICONSTOP "Backend runtime missing (run_api.py). Rebuild with deployment\scripts\package-installer.ps1."
    Abort
  after_api:

  IfFileExists "$INSTDIR\resources\runtime\python\python.exe" 0 missing_py
    nsExec::ExecToLog 'cmd /c xcopy /E /I /Y "$INSTDIR\resources\runtime\*" "$INSTDIR\runtime\"'
    Pop $0
    Goto after_py
  missing_py:
    MessageBox MB_ICONSTOP "Embeddable Python missing under resources\runtime\python. Run fetch-python-embed.ps1."
    Abort
  after_py:

  IfFileExists "$INSTDIR\resources\services\JumanApi.xml" 0 missing_xml
    CopyFiles /SILENT "$INSTDIR\resources\services\JumanApi.xml" "$INSTDIR\backend\JumanApi.xml"
    Goto after_xml
  missing_xml:
    MessageBox MB_ICONSTOP "JumanApi.xml missing."
    Abort
  after_xml:

  IfFileExists "$INSTDIR\resources\services\WinSW-x64.exe" 0 missing_winsw
    CopyFiles /SILENT "$INSTDIR\resources\services\WinSW-x64.exe" "$INSTDIR\backend\JumanApi.exe"
    Goto after_winsw
  missing_winsw:
    MessageBox MB_ICONSTOP "WinSW-x64.exe missing. Run fetch-winsw.ps1 before packaging."
    Abort
  after_winsw:

  IfFileExists "$INSTDIR\resources\scripts\gen-secrets.ps1" 0 missing_scripts
    CopyFiles /SILENT "$INSTDIR\resources\scripts\*.ps1" "$INSTDIR\scripts"
    CopyFiles /SILENT "$INSTDIR\resources\scripts\*.cmd" "$INSTDIR\scripts"
    Goto after_scripts
  missing_scripts:
    MessageBox MB_ICONSTOP "Installer scripts missing from resources\scripts."
    Abort
  after_scripts:

  IfFileExists "$INSTDIR\resources\installer-wizard\JumanSetupWizard.ps1" 0 missing_wizard
    CopyFiles /SILENT "$INSTDIR\resources\installer-wizard\*.*" "$INSTDIR\installer-wizard"
    Goto after_wizard
  missing_wizard:
    MessageBox MB_ICONSTOP "Installer wizard missing (resources\installer-wizard). Rebuild package."
    Abort
  after_wizard:

  DetailPrint "Launching Juman Setup Wizard (PostgreSQL must already be installed)..."
  nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\installer-wizard\JumanSetupWizard.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  IntCmp $0 0 wizard_ok wizard_fail wizard_fail
  wizard_fail:
    DetailPrint "Setup wizard FAILED exit=$0"
    MessageBox MB_ICONSTOP "Juman setup failed (exit $0).$\r$\n$\r$\nPostgreSQL must be installed and running BEFORE Install Juman.$\r$\nSee:$\r$\n  $INSTDIR\logs\installer.json$\r$\n  $INSTDIR\logs\INSTALLER_CONFIGURATION_REPORT.md$\r$\n$\r$\nInstall aborted. No fake config will be generated."
    Abort
  wizard_ok:
    DetailPrint "Setup wizard completed. Backend Python packages install on first Juman launch."

  CreateDirectory "$SMPROGRAMS\Juman"
  CreateShortCut "$SMPROGRAMS\Juman\Juman.lnk" "$INSTDIR\Juman.exe"
  CreateShortCut "$DESKTOP\Juman.lnk" "$INSTDIR\Juman.exe"
  CreateShortCut "$SMPROGRAMS\Juman\Repair Juman Services.lnk" "$INSTDIR\scripts\elevate-repair.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Start Juman Services.lnk" "$INSTDIR\scripts\elevate-start-services.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Bootstrap Backend.lnk" "$INSTDIR\scripts\elevate-bootstrap.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Diagnostics.lnk" "$INSTDIR\Juman.exe" "--diagnostics"
  CreateShortCut "$SMPROGRAMS\Juman\Setup Wizard.lnk" "$Ps64" '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\installer-wizard\JumanSetupWizard.ps1" -InstallDir "$INSTDIR"'
!macroend

!macro customUnInstall
  !insertmacro ResolvePowerShell64
  StrCpy $RetainDatabase "1"
  StrCpy $RetainStorage "1"

  MessageBox MB_YESNO|MB_ICONQUESTION "Keep Juman database?$\r$\nYes = keep / No = drop juman DB only" IDYES keep_db IDNO drop_db
  keep_db:
    Goto after_db
  drop_db:
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Confirm DROP DATABASE juman?" IDYES do_drop IDNO after_db
    do_drop:
      nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\drop-database.ps1" -InstallDir "$INSTDIR"'
      Pop $0
  after_db:

  MessageBox MB_YESNO|MB_ICONQUESTION "Keep uploaded files (storage)?$\r$\nYes = keep / No = delete" IDYES after_st IDNO drop_st
  drop_st:
    RMDir /r "$INSTDIR\storage"
  after_st:

  ; PostgreSQL is operator-owned - Juman does not uninstall it automatically.

  IfFileExists "$INSTDIR\backend\JumanApi.exe" 0 skip_svc
    nsExec::ExecToLog '"$INSTDIR\backend\JumanApi.exe" stop'
    Pop $0
    nsExec::ExecToLog '"$INSTDIR\backend\JumanApi.exe" uninstall'
    Pop $0
  skip_svc:

  Delete "$DESKTOP\Juman.lnk"
  RMDir /r "$SMPROGRAMS\Juman"
!macroend

!macro customInstallMode
  !insertmacro ResolvePowerShell64
  DetailPrint "Repairing Juman (preserve DB + storage)..."
  IfFileExists "$INSTDIR\resources\backend\run_api.py" 0 +2
    nsExec::ExecToLog 'cmd /c xcopy /E /I /Y "$INSTDIR\resources\backend\*" "$INSTDIR\backend\"'
    Pop $0
  IfFileExists "$INSTDIR\resources\runtime\python\python.exe" 0 +2
    nsExec::ExecToLog 'cmd /c xcopy /E /I /Y "$INSTDIR\resources\runtime\*" "$INSTDIR\runtime\"'
    Pop $0
  IfFileExists "$INSTDIR\resources\services\WinSW-x64.exe" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\services\WinSW-x64.exe" "$INSTDIR\backend\JumanApi.exe"
  IfFileExists "$INSTDIR\resources\services\JumanApi.xml" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\services\JumanApi.xml" "$INSTDIR\backend\JumanApi.xml"
  IfFileExists "$INSTDIR\resources\scripts\*.ps1" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\scripts\*.ps1" "$INSTDIR\scripts"
  IfFileExists "$INSTDIR\resources\scripts\*.cmd" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\scripts\*.cmd" "$INSTDIR\scripts"
  IfFileExists "$INSTDIR\resources\installer-wizard\*.ps1" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\installer-wizard\*.*" "$INSTDIR\installer-wizard"
  nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\bootstrap-backend-venv.ps1" -InstallDir "$INSTDIR" -Force'
  Pop $0
  IntCmp $0 0 +2 +1 +1
    MessageBox MB_ICONEXCLAMATION "Backend bootstrap finished with exit code $0"
!macroend