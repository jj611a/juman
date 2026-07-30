# System Administration - Juman

**Document type:** Domain module design  
**Audience:** Backend implementers, operators  
**Status:** Implemented (Phase 1–5 — Foundation + Backup + Restore + Maintenance + Security)  
**Scope:** System information, diagnostics, metrics, maintenance execute/history, RBAC, local .juman backups and restore

Related: [DATABASE_GUIDELINES.md](DATABASE_GUIDELINES.md), public health at `/api/v1/health`.

---

## 1. Purpose

System Administration owns system-level operational visibility for authenticated administrators.

Business modules must not embed admin tooling. Public liveness probes (`/api/v1/health`, `/api/v1/version`) remain unauthenticated and unchanged.

---

## 2. Architecture

Package: `backend/app/modules/system_admin/`

| Layer | Role |
|---|---|
| `api/` | Auth-gated routes under `/api/v1/system` |
| `services/` | System info, diagnostics, metrics, maintenance execute, backup, restore |
| `maintenance/` | Task protocol, verify/cleanup tasks, registry |
| `schemas/` | Response models |
| `constants.py` | Permissions and check ids |

Tables: `system_backups`, `system_restores`, `system_maintenance_runs`. Permissions seeded from `20260729_0029_system_admin`.

---

## 3. Permissions

| Key | Use | Roles |
|---|---|---|
| `system.view` | Info / diagnostics / maintenance list | Admin |
| `system.maintenance` | Execute maintenance + history | Admin |
| `system.backup` | Backup Engine APIs | Admin |
| `system.restore` | Restore Engine APIs | Admin |

Cashier / Inventory / Laundry: none.

---

## 4. API

| Method | Path | Perm |
|---|---|---|
| GET | `/api/v1/system/info` | `system.view` |
| GET | `/api/v1/system/diagnostics` | `system.view` |
| GET | `/api/v1/system/metrics` | `system.view` |
| GET | `/api/v1/system/maintenance/tasks` | `system.view` |
| POST | `/api/v1/system/maintenance/tasks/{task_key}/execute` | `system.maintenance` |
| GET | `/api/v1/system/maintenance/history` | `system.maintenance` |
| GET | `/api/v1/system/maintenance/history/{execution_id}` | `system.maintenance` |
| POST/GET/DELETE | `/api/v1/system/backups*` | `system.backup` — see [BACKUP_ENGINE.md](BACKUP_ENGINE.md) |
| POST/GET | `/api/v1/system/restore*` | `system.restore` — see [RESTORE_ENGINE.md](RESTORE_ENGINE.md) |

Maintenance & diagnostics details: [MAINTENANCE_AND_DIAGNOSTICS.md](MAINTENANCE_AND_DIAGNOSTICS.md).

---

## 5. System information

`/system/info` returns: app identity/version, environment, Python/OS, `started_at` / uptime, UTC time, default timezone, Alembic head/current/pending, database dialect/name/server version/size (Postgres size only), media provider/root, Redis enabled/configured flags.

**Never exposed:** secrets, passwords, tokens, full `DATABASE_URL` / `REDIS_URL`, connection credentials.

Database name is parsed from the DSN path only.

---

## 6. Diagnostics

Read-only checks with `pass|warn|fail|skip` and overall `ok|degraded|down`:

- `database_connectivity` / `database_latency` (warn ≥ 500ms)
- `alembic_up_to_date`
- `settings_available`
- `audit_available`
- `media_root_exists` / `media_root_writable` (temp file create+delete)
- `redis` (skip if disabled)
- `backup_storage_root_exists` / `backup_storage_writable`
- `restore_readiness`
- `disk_usage`
- `app_runtime`

DB connectivity failure → overall `down`. Other failures/warns → `degraded`.

---

## 7. Maintenance framework

Live verify/cleanup tasks (`phase=current`). Execute and history require `system.maintenance`. Details: [MAINTENANCE_AND_DIAGNOSTICS.md](MAINTENANCE_AND_DIAGNOSTICS.md).

---

## 8. Audit

Info / diagnostics / metrics GETs do **not** write audit rows. Privileged ops write audits with outcome metadata — see [SYSTEM_SECURITY.md](SYSTEM_SECURITY.md).

---

## 9. Security

Admin-only. Response fields scrubbed of DSN credentials. Writable media/backup probes are non-destructive. Path confinement for disk cleanup.

---

## 10. Explicit exclusions (later phases)

Scheduling, remote backup/restore, encryption, WAL/PITR, schema upgrade/downgrade bridges, business-data repair, Notifications, Electron UI, Postgres `VACUUM` / cache rebuild.

Related: [BACKUP_ENGINE.md](BACKUP_ENGINE.md), [RESTORE_ENGINE.md](RESTORE_ENGINE.md), [MAINTENANCE_AND_DIAGNOSTICS.md](MAINTENANCE_AND_DIAGNOSTICS.md), [SYSTEM_SECURITY.md](SYSTEM_SECURITY.md).

Migrations: `20260729_0029_system_admin`, `20260730_0030_system_backups`, `20260731_0031_system_restores`, `20260801_0032_system_maintenance_runs`.
