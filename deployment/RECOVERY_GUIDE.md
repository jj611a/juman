# Juman Recovery Guide (Phase 7.0)

## Backend service down

1. Confirm PostgreSQL: `sc query postgresql-x64-16`
2. Start API: `sc start JumanApi` or Start Menu → **Repair Juman Services**
3. Open logs: `%ProgramFiles%\Juman\logs` (or app “open logs”)

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