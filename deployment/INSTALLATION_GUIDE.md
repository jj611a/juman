# Juman Installation Guide (Phase 7.0)

Single Windows installer: official PostgreSQL + `juman-api.exe` (WinSW) + Electron desktop.

## Prerequisites (build machine)

- Windows 10/11 x64, Administrator
- Node.js + pnpm (frontend)
- Python 3.11+ / `uv` (backend freeze)
- Network to fetch WinSW + PostgreSQL EDB installer (or pre-place artifacts)

## Build & package

```powershell
# From repo root
powershell -File deployment\scripts\package-installer.ps1
```

Or step-by-step:

1. `deployment\scripts\fetch-winsw.ps1`
2. `deployment\scripts\fetch-postgresql.ps1`
3. `deployment\scripts\build-backend.ps1`
4. `cd frontend; pnpm dist:win`

Output: `frontend\release\Juman-Setup-*.exe`

Packaging **fails** if `juman-api.exe` or `WinSW-x64.exe` is missing.

## Clean PC install flow

1. Run Setup as Administrator.
2. Silent PostgreSQL 16 via `scripts\install-postgresql.ps1` (EDB unattended; data under `%ProgramData%\Juman\PostgreSQL\16\data`; log: `logs\postgresql-install.log`) → service `postgresql-x64-16`.
3. Generate secrets → `config\.install-secrets.env` + `config\install-credentials.txt`.
4. Create role/database `juman`, privileges.
5. Write `config\juman.env` (includes `SECRET_KEY`).
6. `juman-api.exe migrate` (Alembic).
7. Install/start WinSW service `JumanApi` (depends on PostgreSQL).
8. Poll `http://127.0.0.1:8000/api/v1/health`.
9. Desktop + Start Menu shortcuts; optional **Repair Juman Services**.
10. Launch Electron → first-run wizard.

## First-run wizard

Persists:

- Company name (`settings` `company_name` + env)
- Timezone / language (`JUMAN_TIMEZONE`, `JUMAN_LANGUAGE=ar`)
- Storage path (`MEDIA_STORAGE_ROOT` + API restart)
- Admin password (login with bootstrap → change password)
- Then `firstrun.done`

Bootstrap password is in `config\install-credentials.txt` (protect this file).

## Boot order

Windows → `postgresql-x64-16` → `JumanApi` (wait-for-DB) → Electron (HTTP only).

Electron never starts PostgreSQL.

## Manual QA (operator VM)

- [ ] Clean Windows VM install
- [ ] Services running after reboot
- [ ] First-run completes and login works
- [ ] Repair from Start Menu
- [ ] Upgrade over existing install (preserve DB/storage)
- [ ] Uninstall retain DB + storage

## Installer step diagnostics

Every custom-install step is recorded in:

`%ProgramFiles%\Juman\logs\installer.json`

Each entry includes: step, startTime, endTime, duration (ms), success, exitCode, stdout, stderr, exception, failureReason.

### PostgreSQL packaging notes

- The EDB installer is **bundled** at build time via `deployment\scripts\fetch-postgresql.ps1` into `deployment\vendor\postgresql\`.
- electron-builder copies it to `resources\vendor\postgresql\` inside the Setup.
- Runtime install does **not** download PostgreSQL; if the EXE is missing, NSIS **Aborts**.
- `install-postgresql.ps1` launches the EDB EXE with `Start-Process -Wait` and records the real exit code.
- After install, `verify-postgresql.ps1` checks: folder, `postgres.exe`, service exists, service RUNNING.
- On verification failure the installer **stops** and does **not** run backend bootstrap or write `juman.env`.