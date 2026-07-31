# Juman Installation Guide

Release artifact is a **ZIP folder**, not a single all-in-one Setup that embeds PostgreSQL.

```
Juman-vX.Y.Z/
  Install PostgreSQL.exe          # official EDB Windows x64 installer
  Install Juman.exe               # electron-builder NSIS (no vendor PG)
  PostgreSQL Installation Guide.pdf
  Quick Start.pdf
  README FIRST.txt
```

## Prerequisites (target PC)

- Windows 10/11 x64, Administrator
- **PostgreSQL 16** installed and service `postgresql-x64-16` Running **before** Install Juman
- Remember the postgres superuser password (used once in the wizard; never stored)

## Prerequisites (build machine)

- Windows 10/11 x64, Administrator
- Node.js + pnpm (frontend)
- Python 3.11+ / `uv` (backend freeze)
- Network to fetch WinSW + (for release ZIP) EDB PostgreSQL installer

## Build & package

```powershell
# From repo root — builds Install Juman.exe (no PG inside)
powershell -File deployment\scripts\package-installer.ps1

# Assemble release ZIP (fetches EDB as Install PostgreSQL.exe + guides)
powershell -File deployment\scripts\package-installer.ps1 -BuildReleaseZip
# or:
powershell -File deployment\scripts\build-release-zip.ps1
```

Output:

- Setup: `frontend\release\Juman-Setup-*.exe` (renamed in ZIP to `Install Juman.exe`)
- Kit: `frontend\release\Juman-v*\` and `.zip`

Packaging **fails** if `juman-api.exe`, `WinSW-x64.exe`, or `installer-wizard\JumanSetupWizard.ps1` is missing.

### Portable ZIP (lab / demo)

No NSIS installer and no WinSW service. Requires existing PostgreSQL 16.

```powershell
powershell -File deployment\scripts\build-portable.ps1
```

Output: `frontend\release\Juman-Portable-v*\` and `.zip` (see `README-PORTABLE.txt` inside).
Not a substitute for the per-machine Setup on production store PCs.

## Clean PC install flow

1. Read **README FIRST.txt**.
2. Run **Install PostgreSQL.exe** (manual EDB UI). Keep port 5432; note postgres password.
3. Confirm `sc query postgresql-x64-16` → RUNNING.
4. Run **Install Juman.exe** as Administrator.
5. Setup Wizard (elevated WinForms):
   - Requirements → Verify PostgreSQL (fail-closed if missing/wrong major)
   - Database Configuration (defaults: localhost, 5432, postgres, db `juman`, user `juman_app`, generate app password ON)
   - Connection Test → Database Init (create role/DB/grants + `juman-api.exe migrate`)
   - Write `config\juman.env` (**app user only**; no postgres password on disk)
   - Install/start WinSW `JumanApi` → Validation (health, folders, service RUNNING)
6. Launch Electron → first-run company/admin wizard.

## First-run wizard (desktop)

Persists company name, timezone/language, storage path, admin password change, then `firstrun.done`.

Bootstrap password is in `config\install-credentials.txt` (protect this file).

## Boot order

Windows → `postgresql-x64-16` → `JumanApi` (wait-for-DB) → Electron (HTTP only).

Electron never starts PostgreSQL. Juman Setup never silently installs PostgreSQL.

## Manual QA (operator VM)

- [ ] Without PG: Install Juman stops at Verify with instructions
- [ ] With PG 16: wizard completes; health OK; `juman.env` has `juman_app` only
- [ ] Release ZIP has the five required top-level entries
- [ ] `installer.json` + `INSTALLER_CONFIGURATION_REPORT.md` under `%ProgramFiles%\Juman\logs\`
- [ ] First-run completes and login works
- [ ] Upgrade over existing install (preserve DB/storage)
- [ ] Uninstall retain DB + storage (PostgreSQL product left for operator)

## Installer diagnostics

- Step log: `%ProgramFiles%\Juman\logs\installer.json`
- Configuration report: `%ProgramFiles%\Juman\logs\INSTALLER_CONFIGURATION_REPORT.md`

Template: [`docs/release/INSTALLER_CONFIGURATION_REPORT.md`](../docs/release/INSTALLER_CONFIGURATION_REPORT.md)

### Notes

- `install-postgresql.ps1` remains as an optional ops tool; it is **not** invoked by Setup.
- WinSW `<depend>postgresql-x64-16</depend>` — service name must match a supported PG 16 install.
