# Developer Build Manifest — Juman v1.0.0

## How to produce a release build

1. Clean working tree preferred; note git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>".
2. From repo root:
   ```powershell
   powershell -File deployment\scripts\package-installer.ps1
   ```
3. Validate:
   ```powershell
   powershell -File deployment\scripts\validate-release.ps1 -RequireArtifacts
   ```
4. Refresh [`BUILD_MANIFEST.json`](./BUILD_MANIFEST.json) fields (script may update checksum + timestamp).
5. Distribute `frontend/release/Juman-Setup-1.0.0.exe` + `.sha256` — **do not commit** binaries.

## Layout expectations (packaged)

| Source | Install / extraResources |
|--------|--------------------------|
| `deployment/dist/backend/juman-api.exe` | `backend/` |
| `deployment/services/WinSW-x64.exe` + `JumanApi.xml` | `services/` → WinSW as `JumanApi.exe` at install |
| `deployment/scripts/*.ps1` | `scripts/` |
| `deployment/vendor/postgresql` | `vendor/` (installer silent PG) |

## Environment

Installer writes `APP_ENV=production`, `APP_DEBUG=false`, generated `SECRET_KEY`. Bare backend defaults in `settings.py` are for development only.

## Tests (developer gate)

- Frontend: `pnpm test` in `frontend/`
- Backend smoke: targeted pytest (health, security, config, tokens, rbac defaults)
- Installer units: `deployment/backend/test_generate_env.py`, `installer-retention.test.ts`

## Icons

1. Pad logo to square PNG under `frontend/build/icon-1024.png`.
2. `cd frontend && node --input-type=module -e "import fs from 'fs'; import pngToIco from 'png-to-ico'; fs.writeFileSync('build/icon.ico', await pngToIco('build/icon-1024.png'))"`
3. `electron-builder.yml` references `win.icon: build/icon.ico`.