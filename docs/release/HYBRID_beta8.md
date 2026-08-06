## Juman v1.0.0-beta.8 — Live-PyPI hybrid installer

Production Setup no longer ships frozen `juman-api.exe`.

### Install flow
1. Install PostgreSQL 16 (external) then Install Juman.exe
2. Setup Wizard: DB/role + `config\juman.env` only
3. First desktop launch (UAC): embed Python venv + live PyPI pip + migrate + WinSW `JumanApi`
4. Progress: `logs\install-progress.json` + `logs\INSTALL_PROGRESS.md` + on-screen progress window

### Fixes in this patch
- First-run password UX (show real API errors; min 10 + complexity)
- Absolute `storage\media` / `storage\backups` sync so system diagnostics pass
- psql discovery under Program Files; disk usage fallback
- Install progress logging for wizard + bootstrap

### Requirements
- Outbound HTTPS to PyPI on first launch
- PostgreSQL 16 / service `postgresql-x64-16`

### Asset
- `Juman-Setup-1.0.0.exe`
- SHA-256: `7C3BEA01246D1BE4EF5758156426E8255A98BD46708BACF2AD886C8794EC3911`

Commits: `3c569e5` (progress UI), `c1e3b70` (hybrid install)