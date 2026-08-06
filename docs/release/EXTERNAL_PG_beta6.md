## Juman v1.0.0-beta.6 — External PostgreSQL + Setup Wizard

### Breaking install change
PostgreSQL is **no longer** silently installed inside Setup. Use the release ZIP:

1. Run **Install PostgreSQL.exe** first (EDB UI). Remember the postgres password. Confirm service `postgresql-x64-16` is Running.
2. Run **Install Juman.exe** as Administrator. Complete the elevated Setup Wizard.

### Wizard
- Verifies PostgreSQL 16 (fail-closed if missing/wrong major)
- Collects DB settings; generates app password by default
- Creates DB/user/grants, runs migrations, writes `config\juman.env` (**app user only** — postgres password never saved)
- Installs WinSW `JumanApi` and validates health
- Writes `logs\installer.json` + `logs\INSTALLER_CONFIGURATION_REPORT.md`

### Artifact
- Primary: `Juman-v1.0.0.zip` (five required top-level entries)
- SHA-256 (ZIP): `F1C05276A1C69205C3ADA3120CB882338D9E059F8142374D04E3219F32075A4E`
- Also: `Juman-Setup-1.0.0.exe` (= Install Juman.exe inside the ZIP)
- SHA-256 (Setup): `2275830E6E96ECCADFA6F931817ED9AC128EBCA31D07EC07DA0972EAB6857459`
- Commit: `bef5e03`
