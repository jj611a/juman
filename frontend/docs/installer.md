# Installer & packaging (Phase 7.0)

Single Windows installer: official PostgreSQL (1A) + frozen `juman-api.exe` + WinSW (2A) + Electron.

## Build pipeline

```powershell
powershell -File deployment\scripts\package-installer.ps1
```

Requires: WinSW, PostgreSQL vendor exe (optional but recommended), `juman-api.exe`.

## Layout after install

```
C:\Program Files\Juman\
  Juman.exe
  backend\juman-api.exe
  backend\JumanApi.exe
  backend\JumanApi.xml
  config\juman.env
  scripts\*.ps1
  logs\
  storage\
  runtime\update-channel.json
```

## Service order

Windows Boot → PostgreSQL → JumanApi → Electron (HTTP only).

## First-run

Wizard persists company, timezone, language, storage, admin password; then `firstrun.done`.

## Guides

See `deployment/INSTALLATION_GUIDE.md`, `UPGRADE_GUIDE.md`, `RECOVERY_GUIDE.md`, `UNINSTALL_GUIDE.md`.