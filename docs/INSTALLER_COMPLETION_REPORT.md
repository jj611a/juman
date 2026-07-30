# Installer Completion Report — Phase 7.0

**Date:** 2026-07-30  
**Verdict:** **CODE-COMPLETE** for unified Windows installer path (1A/2A).  
**Operator VM validation:** required before production store rollout (not executed in this agent session).

## Installed components (target layout)

| Component | Location |
|-----------|----------|
| Electron app | `C:\Program Files\Juman\Juman.exe` |
| Frozen API | `backend\juman-api.exe` |
| WinSW wrapper | `backend\JumanApi.exe` + `JumanApi.xml` |
| Config | `config\juman.env`, secrets files |
| Storage / logs | `storage\`, `logs\` |
| Scripts | `scripts\*.ps1` |
| PostgreSQL 16 | Official EDB silent install → service `postgresql-x64-16` |

## Services

| Service | Role |
|---------|------|
| `postgresql-x64-16` | Database |
| `JumanApi` | FastAPI via WinSW; depends on PostgreSQL; wait-for-DB on start |

Boot order: PostgreSQL → JumanApi → Electron HTTP client.

## Database setup

- Install-time secrets generated (`gen-secrets.ps1`)
- Role + database `juman` via `bootstrap-database.ps1`
- `SECRET_KEY` always written to env
- Credentials mirrored to `config\install-credentials.txt`

## Migration validation

- `juman-api.exe migrate` CLI wraps Alembic `upgrade head`
- Invoked from post-install and repair
- Unit-tested CLI dispatch (mocked)

## Repair / upgrade / uninstall

| Mode | Behavior |
|------|----------|
| Repair | Re-copy binaries, re-register WinSW, migrate; **never** drop DB/storage |
| Upgrade | In-place Setup; preserve env/DB/storage; migrate forward |
| Uninstall | Remove service/app; prompts for DB drop, storage delete, optional PG product remove |

## Tests run (in-repo)

| Suite | Result |
|-------|--------|
| `deployment/backend/test_generate_env.py` | 7 passed |
| `frontend/tests/unit/installer-retention.test.ts` | 5 passed |

## Remaining limitations

1. Clean-VM install/repair/upgrade/uninstall **not** automated in CI — operator checklist required.
2. PostgreSQL / WinSW / `juman-api.exe` binaries are **fetched/built at package time**, not committed.
3. Cloud auto-update remains stub (`implemented: false`).
4. First-run requires bootstrap password from install credentials file.
5. NSIS post-install failure leaves a repairable partial install (by design) rather than silent hollow success.

## Release readiness

**Installer packaging path: READY for operator packaging + VM certification.**  
Not yet “store-certified” until the VM matrix in `INSTALLATION_GUIDE.md` is checked off.