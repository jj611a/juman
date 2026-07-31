# Quick Start - Juman

## 1. Install PostgreSQL first

1. Open the release folder.
2. Run Install PostgreSQL.exe.
3. Remember the postgres password.
4. Confirm service postgresql-x64-16 is Running.

Details: PostgreSQL Installation Guide.pdf

## 2. Install Juman

1. Run Install Juman.exe as Administrator.
2. Follow the Setup Wizard:
   - Verify PostgreSQL
   - Enter host/port (defaults: localhost / 5432)
   - Enter the postgres password (not saved to disk)
   - Accept defaults for database juman and user juman_app (or customize)
   - Allow secure app password generation
3. Wait until Validation succeeds and Finish shows SUCCESS.

## 3. First launch

1. Start Juman from the Start Menu or Desktop.
2. Use bootstrap credentials from:

%ProgramFiles%\Juman\config\install-credentials.txt

3. Complete the in-app first-run company/admin flow.

## If something fails

- Report: %ProgramFiles%\Juman\logs\INSTALLER_CONFIGURATION_REPORT.md
- Steps: %ProgramFiles%\Juman\logs\installer.json
- Re-open Setup Wizard from Start Menu -> Juman -> Setup Wizard
- Use recovery actions: Retry, Re-test connection, Restart PostgreSQL, Regenerate config, Re-run migrations

Juman never silently installs PostgreSQL. Always use Install PostgreSQL.exe first.