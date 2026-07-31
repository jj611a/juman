; Phase 7.0 NSIS helpers for Juman (electron-builder include).

!include LogicLib.nsh
!include FileFunc.nsh
!include x64.nsh

Var RetainDatabase
Var RetainStorage

!macro preInit
  SetRegView 64
!macroend

!macro customInit
  StrCpy $RetainDatabase "1"
  StrCpy $RetainStorage "1"
!macroend

!macro customInstall
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

  DetailPrint "Generating install secrets..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\gen-secrets.ps1" -OutFile "$INSTDIR\config\.install-secrets.env"'
  Pop $0
  IfFileExists "$INSTDIR\config\.install-secrets.env" 0 secrets_fail
    Goto secrets_ok
  secrets_fail:
    MessageBox MB_ICONSTOP "Failed to generate install secrets."
    Abort
  secrets_ok:

  ; Silent PostgreSQL via dedicated script (logs to $INSTDIR\logs\postgresql-install.log)
  IfFileExists "$INSTDIR\resources\vendor\postgresql\*.exe" 0 skip_pg
    DetailPrint "Installing PostgreSQL 16 (silent, logged)..."
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\install-postgresql.ps1" -InstallDir "$INSTDIR"'
    Pop $0
    IntCmp $0 0 pg_ok pg_warn pg_warn
    pg_warn:
      MessageBox MB_ICONEXCLAMATION "PostgreSQL silent install returned $0. See $INSTDIR\logs\postgresql-install.log. If PG is already installed, post-install may still succeed."
    pg_ok:
  skip_pg:

  DetailPrint "DB bootstrap + migrate + JumanApi service + health..."
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\run-post-install.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  IntCmp $0 0 post_ok post_fail post_fail
  post_fail:
    MessageBox MB_ICONSTOP "Post-install failed (exit $0). Use Start Menu > Repair Juman Services after fixing errors. See $INSTDIR\logs"
    Goto after_post
  post_ok:
    DetailPrint "Post-install succeeded."
  after_post:

  FileOpen $3 "$INSTDIR\runtime\update-channel.json" w
  FileWrite $3 '{"channel":"stable","implemented":false,"feedUrl":null}$\r$\n'
  FileClose $3

  CreateDirectory "$SMPROGRAMS\Juman"
  CreateShortCut "$SMPROGRAMS\Juman\Juman.lnk" "$INSTDIR\Juman.exe"
  CreateShortCut "$DESKTOP\Juman.lnk" "$INSTDIR\Juman.exe"
  CreateShortCut "$SMPROGRAMS\Juman\Repair Juman Services.lnk" "$INSTDIR\scripts\elevate-repair.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Start Juman Services.lnk" "$INSTDIR\scripts\elevate-start-services.cmd"
  CreateShortCut "$SMPROGRAMS\Juman\Diagnostics.lnk" "$INSTDIR\Juman.exe" "--diagnostics"
!macroend

!macro customUnInstall
  StrCpy $RetainDatabase "1"
  StrCpy $RetainStorage "1"

  MessageBox MB_YESNO|MB_ICONQUESTION "Keep Juman database?$\r$\nYes = keep / No = drop juman DB only" IDYES keep_db IDNO drop_db
  keep_db:
    Goto after_db
  drop_db:
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "Confirm DROP DATABASE juman?" IDYES do_drop IDNO after_db
    do_drop:
      nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\drop-database.ps1" -InstallDir "$INSTDIR"'
      Pop $0
  after_db:

  MessageBox MB_YESNO|MB_ICONQUESTION "Keep uploaded files (storage)?$\r$\nYes = keep / No = delete" IDYES after_st IDNO drop_st
  drop_st:
    RMDir /r "$INSTDIR\storage"
  after_st:

  MessageBox MB_YESNO|MB_ICONQUESTION "Uninstall PostgreSQL 16 product too?" IDYES rem_pg IDNO skip_pg
  rem_pg:
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$u=Join-Path $$env:ProgramFiles ''PostgreSQL\16\uninstall-postgresql.exe''; if(Test-Path $$u){ Start-Process $$u -Wait }"'
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
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\repair-install.ps1" -InstallDir "$INSTDIR"'
  Pop $0
  IntCmp $0 0 +2 +1 +1
    MessageBox MB_ICONEXCLAMATION "Repair finished with exit code $0"
!macroend