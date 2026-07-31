@echo off
setlocal
set "INSTALLDIR=%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0bootstrap-backend-venv.ps1','-InstallDir','%INSTALLDIR%')"
endlocal