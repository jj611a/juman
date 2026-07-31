# Juman Recovery Guide (Phase 7.0)

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

## PostgreSQL silent install failed

1. Read `%ProgramFiles%\Juman\logs\postgresql-install.log` (written by `scripts\install-postgresql.ps1`).
2. Also check `%ProgramFiles%\Juman\logs\postgresql-edb-debugtrace.log` and `%TEMP%\installbuilder_installer_*.log` (EDB installer).
3. Confirm no leftover broken service: `sc query postgresql-x64-16`
4. Re-run elevated:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%ProgramFiles%\Juman\scripts\install-postgresql.ps1" `
  -InstallDir "%ProgramFiles%\Juman"
```

Requires `config\.install-secrets.env` with `PG_SUPER_PASSWORD` (created at install). Installer EXE must exist under `resources\vendor\postgresql\` or `vendor\postgresql\`.

5. Data directory is `%ProgramData%\Juman\PostgreSQL\16\data` (not under Program Files) to avoid ACL/initcluster failures.
6. If init still fails: uninstall broken EDB PostgreSQL from Apps & Features, delete `%ProgramData%\Juman\PostgreSQL` if empty/corrupt, reboot, Repair from Start Menu.