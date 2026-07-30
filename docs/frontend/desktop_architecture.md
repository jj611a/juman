# Desktop Architecture & Security

## Electron security

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- Navigation allowlist (localhost / file); deny unexpected popups
- IPC channel whitelist only (`electron/shared/channels.ts`)

## Session & credentials

| Token | Storage |
|---|---|
| Access | Main-process memory only |
| Refresh | Electron `safeStorage` encrypted blob under `userData/credentials` (OS crypto on Windows) |

Interface: `CredentialStore` — can be replaced later with Windows Credential Manager / keytar without changing the renderer.

## Preload API (`window.juman`)

- `auth.*` — session ops (no token values returned)
- `api.system.health|version`
- `app.getConfig`
- `desktop.dialogs|window|fs|print|barcode` (fs/print/barcode are foundation stubs)

## Dev vs production URL

Main reads `JUMAN_API_BASE_URL` (default `http://127.0.0.1:8000/api/v1`). Renderer never reads this. Production packaging injects the URL in Main; CORS is irrelevant for Main→backend HTTP.

## Hardware (Phase 6.1)

- IPC under `window.juman.hardware` (config, printers, receipt/label/drawer, scan events, backend service diagnose).
- Station config: `userData/hardware-station.json`.
- See [`frontend/docs/hardware.md`](../../frontend/docs/hardware.md).

## Installer (Phase 6.2)

- electron-builder NSIS + official PostgreSQL + frozen API + WinSW.
- Electron never starts PostgreSQL.
- See [`frontend/docs/installer.md`](../../frontend/docs/installer.md) and [`deployment/INSTALLATION_GUIDE.md`](../../deployment/INSTALLATION_GUIDE.md).

## Testing readiness

See `frontend/tests/electron.readme.md`. Unit: Vitest + Testing Library.
