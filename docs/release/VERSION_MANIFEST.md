# Version Manifest — Juman v1.0.0

| Component | Version |
|-----------|---------|
| Product / release | 1.0.0 |
| Root `package.json` | 1.0.0 |
| Frontend `@juman/frontend` | 1.0.0 |
| Backend `juman-backend` (`pyproject.toml`) | 1.0.0 |
| Backend `APP_VERSION` default | 1.0.0 |
| Installer artifact name | `Juman-Setup-1.0.0.exe` |
| Electron (devDependency) | ^35.1.5 |
| Alembic head (schema) | `20260802_0033_system_backups_duration` |

UI surfaces: Login footer, shell status bar, and About dialog show desktop package version via `app.getVersion()` and backend `/version`.

Machine-readable companion: [`BUILD_MANIFEST.json`](./BUILD_MANIFEST.json).