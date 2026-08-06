## Juman v1.0.0-beta.7 — Portable build

Lab/demo ZIP that runs **without** Install Juman.exe / WinSW.

### Contents
- `Juman-Portable-v1.0.0.zip`
- SHA-256: `F355F4BB244987EF9D2244AD35B2BCA53D0EAF74D0076AA2CBEA6E11205CC3D7`

### Requirements
- Existing PostgreSQL (create DB/user, copy `config\juman.env.example` → `config\juman.env`)
- Run `Start Juman Portable.cmd` (or `Juman.exe`; portable marker auto-starts API)

### Included fixes
- `juman-api.exe diagnose` uses asyncpg (no missing psycopg)
- Electron `asInvoker` (no admin required to launch portable)
- Pre-pack exe smoke script

### Notes
Not a substitute for the production Setup + WinSW release kit (`v1.0.0-beta.6`).
Commit: `710b19b`