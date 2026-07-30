@echo off
REM Elevate and repair Juman services (UAC). Never drops DB/storage.
set "SCRIPTS=%~dp0"
set "ROOT=%SCRIPTS%.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%SCRIPTS%repair-install.ps1','-InstallDir','%ROOT%'"
