# Installer Step Diagnostics — Release Report (v1.0.0-beta.5)

## Summary

This patch instruments every custom-install step into `%ProgramFiles%\Juman\logs\installer.json` and **stops the installer** if PostgreSQL is missing, fails silent install, or fails post-install verification. Backend bootstrap and `juman.env` are **not** written after a PostgreSQL failure.

PostgreSQL silent-install arguments were **not** changed in this patch (diagnostics only).

## Root cause (pre-patch)

NSIS previously:

1. **Skipped** PostgreSQL entirely when `resources\vendor\postgresql\*.exe` was missing (`skip_pg`).
2. On non-zero silent-install exit, showed only `MB_ICONEXCLAMATION` and **continued** to post-install.

That allowed backend/config steps to run without a working PostgreSQL.

## PostgreSQL packaging path (audit)

| Stage | Behavior |
|-------|----------|
| Download | Build-time only: `deployment/scripts/fetch-postgresql.ps1` → EDB `postgresql-16.9-1-windows-x64.exe` |
| Vendor dir | `deployment/vendor/postgresql/` (gitignored; not committed) |
| Bundle | electron-builder `extraResources` → Setup `resources/vendor/postgresql/` |
| Runtime download | **None** — install does not fetch PostgreSQL |
| Launch | `scripts/install-postgresql.ps1` → `Start-Process -Wait` on bundled EDB EXE |
| Wait | Yes (`-Wait -PassThru`) |
| Exit code | Surfaced to `installer.json` (e.g. 1603); parent uses isolated `powershell -File` so `exit N` cannot abort logging early |

## New / changed files

- `deployment/scripts/InstallerStepLog.ps1` — JSON step logger
- `deployment/scripts/run-custom-install.ps1` — orchestrated instrumented install
- `deployment/scripts/verify-postgresql.ps1` — folder / postgres.exe / service exists / RUNNING
- `deployment/nsis/juman-installer.nsh` — require vendor EXE; Abort on failure; call orchestrator
- `deployment/scripts/post-install.ps1` — substeps logged to `installer.json`
- `deployment/scripts/install-postgresql.ps1` — preserve real EDB exit codes on failure
- Docs: `INSTALLATION_GUIDE.md`, `RECOVERY_GUIDE.md`

## `installer.json` record shape

```json
{
  "step": "Install PostgreSQL",
  "startTime": "…",
  "endTime": "…",
  "duration": 32441,
  "success": false,
  "exitCode": 1603,
  "stdout": "…",
  "stderr": "…",
  "exception": "…",
  "failureReason": "…"
}
```

Path: `C:\Program Files\Juman\logs\installer.json`

## Verification gate (after PG install)

Must all pass or installer **Aborts**:

1. `%ProgramFiles%\PostgreSQL\16` exists
2. `bin\postgres.exe` exists
3. Service `postgresql-x64-16` exists
4. Service is RUNNING

## Operator instructions

1. Install `Juman-Setup-1.0.0.exe` from this release.
2. If install stops on PostgreSQL, open `logs\installer.json` and find the first `"success": false` entry.
3. Also check `logs\postgresql-install.log` and `logs\postgresql-edb-debugtrace.log`.
4. Do not expect `config\juman.env` if PG verification failed — that is intentional.

## Out of scope (this patch)

- Changing EDB silent-install flags / fixing cluster init ACL failures
- Auto-repair of broken PostgreSQL installs