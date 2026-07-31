# WinSW for JumanApi

Place `WinSW-x64.exe` here (or run `deployment\scripts\fetch-winsw.ps1`).

At install time the file is copied to `%INSTDIR%\backend\JumanApi.exe` beside `JumanApi.xml`.

After first-launch bootstrap, WinSW runs:

`backend\.venv\Scripts\python.exe run_api.py`