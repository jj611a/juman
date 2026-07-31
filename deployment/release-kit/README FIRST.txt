README FIRST - Juman Release Package
====================================

Install order (required):

1) Install PostgreSQL.exe
   - Official EnterpriseDB PostgreSQL 16 Windows x64 installer
   - Choose a strong postgres superuser password and WRITE IT DOWN
   - Keep default port 5432
   - After install, confirm Windows service "postgresql-x64-16" is Running

2) Install Juman.exe
   - Run as Administrator
   - The Setup Wizard verifies PostgreSQL, creates the app database/user,
     writes config (app credentials only), installs the JumanApi service,
     and validates health
   - The postgres superuser password is used only during the wizard and is
     NEVER saved to disk

Do NOT run Install Juman.exe before PostgreSQL is installed and running.
If PostgreSQL is missing, the wizard stops at "Verify PostgreSQL" with fix steps.

After success:
- Launch Juman from the Start Menu
- Bootstrap admin credentials: %ProgramFiles%\Juman\config\install-credentials.txt
- Install report: %ProgramFiles%\Juman\logs\INSTALLER_CONFIGURATION_REPORT.md
- Step log: %ProgramFiles%\Juman\logs\installer.json

See also:
- PostgreSQL Installation Guide.pdf
- Quick Start.pdf