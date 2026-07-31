# Juman Upgrade Guide (Phase 7.0)

## In-place upgrade

1. Build a new Setup with `package-installer.ps1`.
2. Run Setup over the existing install directory (default `C:\Program Files\Juman`).
3. NSIS copies new app/backend binaries.
4. Repair/post-install path re-runs `juman-api.exe migrate` (forward-only).
5. `config\juman.env`, database, and `storage\` are **preserved**.

## Do not

- Do not delete `config\juman.env` before upgrade.
- Do not drop the database unless intentionally resetting.
- Do not replace PostgreSQL major version without a backup/restore plan.

## After upgrade

1. Confirm `sc query JumanApi` is RUNNING.
2. Hit `http://127.0.0.1:8000/api/v1/health`.
3. Open the desktop app and smoke-test login.