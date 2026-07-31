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
- **Outbound HTTPS to PyPI** on first desktop launch (backend packages install once into `backend\.venv`)

## Prerequisites (build machine)

- Windows 10/11 x64, Administrator
- Node.js + pnpm (frontend)
- Python 3.13+ / `uv` (export locked requirements; no PyInstaller on release path)
- Network to fetch WinSW, embeddable CPython, and (for release ZIP) EDB PostgreSQL installer

## Build & package

```powershell
# From repo root — builds Install Juman.exe (no PG inside)
powershell -File deployment\scripts\package-installer.ps1

# Assemble release ZIP (fetches EDB as Install PostgreSQL.exe + guides)
powershell -File deployment\scripts\package-installer.ps1 -BuildReleaseZip
```

Output:

- Setup: `frontend\release\Juman-Setup-*.exe` (renamed in ZIP to `Install Juman.exe`)
- Kit: `frontend\release\Juman-v*\` and `.zip`

Packaging **fails** if embeddable Python, staged `run_api.py` / `requirements.txt`, `WinSW-x64.exe`, or the Setup Wizard is missing.

### Backend model (live PyPI + WinSW hybrid)

1. Installer ships embeddable Python under `runtime\python` and backend source under `backend\` (no frozen `juman-api.exe`).
2. Setup Wizard creates DB/role and `config\juman.env` only (migrate + WinSW deferred).
3. First launch of **Juman** (elevated bootstrap) creates `backend\.venv`, `pip install -r requirements.txt` from PyPI (versions locked from `uv.lock` at package time), runs migrate, registers WinSW `JumanApi`.
4. Later launches only ensure the Windows service is RUNNING.

Air-gapped PCs will fail closed at first launch without PyPI access.

### Portable ZIP (lab / demo)

May still use a frozen backend for labs; production store PCs should use Install Juman.exe.

```powershell
powershell -File deployment\scripts\build-portable.ps1
```

## Clean PC install flow

1. Read **README FIRST.txt**.
2. Run **Install PostgreSQL.exe** (manual EDB UI). Keep port 5432; note postgres password.
3. Confirm `sc query postgresql-x64-16` → RUNNING.
4. Run **Install Juman.exe** as Administrator.
5. Setup Wizard (elevated WinForms):
   - Requirements → Verify PostgreSQL (fail-closed if missing/wrong major)
   - Database Configuration → Connection Test → Database Init (create role/DB/grants; **no migrate yet**)
   - Confirm staged backend + embed Python files
   - Write `config\juman.env` (**app user only**)
   - Service/API validation deferred to first desktop launch
6. Launch **Juman** from Desktop (UAC bootstrap once; needs internet).
7. Electron first-run company/admin wizard.

## Boot order (after first bootstrap)

Windows → `postgresql-x64-16` → `JumanApi` (venv `python run_api.py`, wait-for-DB) → Electron (HTTP only).

## Manual QA

- [ ] Without PG: Install Juman stops at Verify
- [ ] With PG 16: wizard completes; `juman.env` has `juman_app` only; API not required RUNNING yet
- [ ] First Juman launch: bootstrap + health OK; `config\backend.bootstrap.ok` present
- [ ] Second launch: no pip; service start only
- [ ] Offline first launch: fail-closed with bootstrap log under `logs\bootstrap-*.log`

## Installer diagnostics

- Step log: `%ProgramFiles%\Juman\logs\installer.json`
- Bootstrap: `%ProgramFiles%\Juman\logs\bootstrap-*.log`
- Configuration report: `%ProgramFiles%\Juman\logs\INSTALLER_CONFIGURATION_REPORT.md`