# Juman Administrator Manual — v1.0.0

Install, upgrade, repair, security, and backup ownership for جمان.

## Canonical guides (do not fork content)

| Topic | Document |
|-------|----------|
| Clean install | [`deployment/INSTALLATION_GUIDE.md`](../../deployment/INSTALLATION_GUIDE.md) |
| Upgrade | [`deployment/UPGRADE_GUIDE.md`](../../deployment/UPGRADE_GUIDE.md) |
| Recovery / services | [`deployment/RECOVERY_GUIDE.md`](../../deployment/RECOVERY_GUIDE.md) |
| Uninstall | [`deployment/UNINSTALL_GUIDE.md`](../../deployment/UNINSTALL_GUIDE.md) |
| RC VM certification | [`docs/certification/OPERATOR_VM_RUNBOOK.md`](../certification/OPERATOR_VM_RUNBOOK.md) |
| Post-install smoke | `deployment/scripts/certify-smoke.ps1` |

## Services

Expected order: PostgreSQL (`postgresql-x64-16`) → `JumanApi` (WinSW) → Electron client (HTTP to `127.0.0.1:8000`).

Health: `http://127.0.0.1:8000/health`

## Configuration

- `config\juman.env` — production secrets and DSN (installer-generated)
- Restrict ACLs: Administrators + SYSTEM; not world-writable
- `config\install-credentials.txt` — bootstrap credentials; rotate admin password after first run

## Users and RBAC

Manage users and roles in Administration. UI PermissionGates are UX-only; API enforces permissions. Do not grant broad roles on shared kiosks.

## Backup and restore

Use System Administration backup/restore flows. Prefer scheduled backups before upgrades. Restore is destructive — snapshot first. See `docs/BACKUP_ENGINE.md` and `docs/RESTORE_ENGINE.md` for design detail.

## Hardware stations

Per-PC settings under Hardware. Network printers need reachable IP/port. Validate with diagnostics before go-live.

## Security checklist

- No JWT in renderer (architecture)
- Confirm installer ACLs on `config\`
- Keep `APP_DEBUG=false` in production env
- Cloud updates are **not** available — distribute Setup.exe via trusted channel and verify SHA-256 from release pack

## Packaging (build machine)

```powershell
powershell -File deployment\scripts\package-installer.ps1
powershell -File deployment\scripts\validate-release.ps1 -RequireArtifacts
```

Binaries are not committed to git.