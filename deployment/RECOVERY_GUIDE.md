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