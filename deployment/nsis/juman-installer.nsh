; Phase 7.0 NSIS helpers for Juman (electron-builder include).
; Installer step diagnostics: scripts\run-custom-install.ps1 -> logs\installer.json
; PostgreSQL failure MUST Abort (never continue to backend / fake config).
; Always invoke 64-bit PowerShell via Sysnative (NSIS stub is 32-bit / Wow64).

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

  IfFileExists "$INSTDIR\resources\backend\juman-api.exe" 0 missing_api
    CopyFiles /SILENT "$INSTDIR\resources\backend\*.*" "$INSTDIR\backend"
    Goto after_api
  missing_api:
    MessageBox MB_ICONSTOP "juman-api.exe missing. Rebuild with deployment\scripts\package-installer.ps1."
    Abort
  after_api:

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

  IfFileExists "$INSTDIR\resources\vendor\postgresql\*.exe" 0 missing_pg_vendor
    Goto have_pg_vendor
  missing_pg_vendor:
    MessageBox MB_ICONSTOP "PostgreSQL installer EXE is not bundled under resources\vendor\postgresql\.$\r$\nRebuild with deployment\scripts\fetch-postgresql.ps1 then package-installer.ps1.$\r$\nInstall aborted (will not continue to backend)."
    Abort
  have_pg_vendor:

  DetailPrint "Running instrumented install via 64-bit PowerShell..."
  nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\run-custom-install.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  IntCmp $0 0 custom_ok custom_fail custom_fail
  custom_fail:
    DetailPrint "Custom install FAILED exit=$0"
    nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\show-install-failure.ps1" -InstallDir "$INSTDIR"'
    Pop $1
    IfFileExists "$INSTDIR\logs\installer-last-failure.txt" 0 fail_generic
      FileOpen $3 "$INSTDIR\logs\installer-last-failure.txt" r
      FileRead $3 $4
      FileClose $3
      MessageBox MB_ICONSTOP "Juman install failed (exit $0).$\r$\n$\r$\n$4$\r$\n$\r$\nSee:$\r$\n  $INSTDIR\logs\installer.json$\r$\n  $INSTDIR\logs\postgresql-install.log$\r$\n$\r$\nInstall aborted. No fake config will be generated.$\r$\nPrefer install to C:\Program Files\Juman (per-machine)."
      Abort
    fail_generic:
      MessageBox MB_ICONSTOP "Juman install failed (exit $0).$\r$\n$\r$\nPostgreSQL must be installed and verified before backend setup.$\r$\nSee:$\r$\n  $INSTDIR\logs\installer.json$\r$\n  $INSTDIR\logs\postgresql-install.log$\r$\n$\r$\nInstall aborted. No fake config will be generated."
      Abort
  custom_ok:
    DetailPrint "Custom install succeeded (see logs\installer.json)."

  CreateDirectory "$SMPROGRAMS\Juman"
  CreateShortCut "$SMPROGRAMS\Juman\Juman.lnk" "$INSTDIR\Juman.exe"
  CreateShortCut "$DESKTOP\Juman.lnk" "$INSTDIR\Juman.exe"
  CreateShortCut "$SMPROGRAMS\Juman\Repair Juman Services.lnk" "$INSTDIR\scripts\elevate-repair.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Start Juman Services.lnk" "$INSTDIR\scripts\elevate-start-services.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Diagnostics.lnk" "$INSTDIR\Juman.exe" "--diagnostics"
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

  MessageBox MB_YESNO|MB_ICONQUESTION "Uninstall PostgreSQL 16 product too?" IDYES rem_pg IDNO skip_pg
  rem_pg:
    nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -Command "$$u=Join-Path $$env:ProgramW6432 ''PostgreSQL\16\uninstall-postgresql.exe''; if(-not (Test-Path $$u)){ $$u=Join-Path $$env:ProgramFiles ''PostgreSQL\16\uninstall-postgresql.exe'' }; if(Test-Path $$u){ Start-Process $$u -Wait }"'
    Pop $0
  skip_pg:

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
  IfFileExists "$INSTDIR\resources\backend\juman-api.exe" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\backend\*.*" "$INSTDIR\backend"
  IfFileExists "$INSTDIR\resources\services\WinSW-x64.exe" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\services\WinSW-x64.exe" "$INSTDIR\backend\JumanApi.exe"
  IfFileExists "$INSTDIR\resources\services\JumanApi.xml" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\services\JumanApi.xml" "$INSTDIR\backend\JumanApi.xml"
  IfFileExists "$INSTDIR\resources\scripts\*.ps1" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\scripts\*.ps1" "$INSTDIR\scripts"
  IfFileExists "$INSTDIR\resources\scripts\*.cmd" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\scripts\*.cmd" "$INSTDIR\scripts"
  nsExec::ExecToLog '"$Ps64" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\repair-install.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  IntCmp $0 0 +2 +1 +1
    MessageBox MB_ICONEXCLAMATION "Repair finished with exit code $0"
!macroend