@echo off
REM Elevate and start PostgreSQL + JumanApi (UAC).
set "SCRIPTS=%~dp0"
set "ROOT=%SCRIPTS%.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%SCRIPTS%start-services-elevated.ps1','-InstallDir','%ROOT%'"
