# Juman Recovery Guide

## Backend service down

1. Confirm PostgreSQL: `sc query postgresql-x64-16`
2. Prefer Start Menu → **Start Juman Services** (requests Administrator / UAC)
3. Or Repair: Start Menu → **Repair Juman Services**
4. Open logs: `%ProgramFiles%\Juman\logs`

Starting `JumanApi` / repairing WinSW requires elevation. The desktop app prompts UAC when you use **تشغيل خدمة API** on first-run.

## Permission / ACL repair

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%ProgramFiles%\Juman\scripts\set-install-acls.ps1" -InstallDir "%ProgramFiles%\Juman"
```

Run elevated. Ensures LocalSystem can read `config\juman.env` and write `storage\` / `logs\`.

## Migrations behind / schema errors

```bat
"%ProgramFiles%\Juman\backend\juman-api.exe" migrate
"%ProgramFiles%\Juman\backend\JumanApi.exe" restart
```

Or Start Menu → **Setup Wizard** → recovery **Re-run migrations**.

## Lost bootstrap password

See `config\install-credentials.txt` (install-time). After first-run password change, use the operator password. Resetting admin requires DBA/SQL procedures outside this guide.

## Corrupt WinSW registration

```bat
"%ProgramFiles%\Juman\backend\JumanApi.exe" stop
"%ProgramFiles%\Juman\backend\JumanApi.exe" uninstall
"%ProgramFiles%\Juman\backend\JumanApi.exe" install
"%ProgramFiles%\Juman\backend\JumanApi.exe" start
```

Or run `scripts\repair-install.ps1 -InstallDir "..."` (never drops DB/storage).

## Port 8000 conflict

Stop the conflicting process or change `PORT=` in `config\juman.env`, then restart `JumanApi`.

## Startup Diagnostics & Recovery Center

Use the in-app **مركز التشخيص والاستعادة** before manual recovery:

- Help → التشخيص والاستعادة… (`Ctrl+Shift+D`)
- `Juman.exe --diagnostics`
- Start Menu → Juman → Diagnostics
- Opens automatically when the desktop gate cannot reach the API

Full check/repair catalog: [`docs/STARTUP_DIAGNOSTICS.md`](../docs/STARTUP_DIAGNOSTICS.md).

## Installer step log / configuration report

- `%ProgramFiles%\Juman\logs\installer.json` — every wizard/install step
- `%ProgramFiles%\Juman\logs\INSTALLER_CONFIGURATION_REPORT.md` — human-readable summary (success or failure)

If PostgreSQL was missing or wrong major version, the wizard stops at **Verify PostgreSQL** (fail-closed). Install PostgreSQL 16 with **Install PostgreSQL.exe** from the release ZIP, then re-run Setup Wizard.

## PostgreSQL not installed or not running

Juman Setup does **not** silently install PostgreSQL.

1. Run **Install PostgreSQL.exe** from the release package (EDB UI).
2. Confirm service: `sc query postgresql-x64-16` → RUNNING.
3. Re-run Start Menu → Juman → **Setup Wizard** (or reinstall Install Juman.exe).
4. Use wizard recovery: **Restart PostgreSQL**, **Re-test connection**, **Retry step**.

Optional ops-only script `scripts\install-postgresql.ps1` may exist for advanced operators; it is **not** the supported primary path and is not invoked by the installer.

## Regenerate configuration

Start Menu → Setup Wizard → recovery **Regenerate config**, or re-run the wizard.
`config\juman.env` stores the **application** DB user only — never the postgres superuser password.
