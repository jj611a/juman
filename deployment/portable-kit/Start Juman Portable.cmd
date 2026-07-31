@echo off
setlocal
cd /d "%~dp0"

set JUMAN_INSTALL_DIR=%~dp0
set JUMAN_PORTABLE=1

if not exist "%~dp0config\juman.env" (
  echo ERROR: config\juman.env is missing.
  echo Copy config\juman.env.example to config\juman.env and set DATABASE_URL.
  echo PostgreSQL must already be running.
  pause
  exit /b 1
)

if not exist "%~dp0backend\juman-api.exe" (
  echo ERROR: backend\juman-api.exe missing.
  pause
  exit /b 1
)

echo Starting Juman API (portable, no Windows service)...
start "Juman API" /MIN "%~dp0backend\juman-api.exe"

echo Waiting for API health...
powershell -NoProfile -Command ^
  "$ok=$false; for($i=0;$i -lt 60;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/v1/health -TimeoutSec 2; if($r.StatusCode -ge 200){ $ok=$true; break } } catch {} ; Start-Sleep 1 }; if(-not $ok){ exit 1 }"
if errorlevel 1 (
  echo WARNING: API health check timed out. Desktop will still open.
)

echo Starting Juman desktop...
start "" "%~dp0Juman.exe"

echo.
echo Portable mode: API runs in a minimized console window.
echo Close that window to stop the API.
endlocal