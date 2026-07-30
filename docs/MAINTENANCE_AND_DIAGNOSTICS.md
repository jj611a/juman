# Maintenance & Diagnostics - Juman

**Document type:** Domain module design  
**Audience:** Backend implementers, operators  
**Status:** Implemented (Phase 4 — Maintenance & Diagnostics)  
**Scope:** Extended diagnostics, read-only metrics, executable verify/cleanup maintenance tasks, run history

Related: [SYSTEM_ADMINISTRATION.md](SYSTEM_ADMINISTRATION.md), [BACKUP_ENGINE.md](BACKUP_ENGINE.md), [RESTORE_ENGINE.md](RESTORE_ENGINE.md).

---

## 1. Purpose

Phase 4 turns the Phase 1 maintenance registry into live operational tooling:

- Extended health checks on `GET /system/diagnostics`
- Safe counters on `GET /system/metrics`
- Synchronous verify (`verify_*`) and cleanup (`cleanup_*`) tasks with history

**Out of scope:** repairing calendar/dress/financial business data, scheduling, async workers, `VACUUM`, cache rebuild, Electron UI.

---

## 2. Permissions

| Key | Use |
|---|---|
| `system.view` | Diagnostics, metrics, task list |
| `system.maintenance` | Execute tasks + history |

Admin only.

---

## 3. Diagnostics extensions

Same overall model: `ok` | `degraded` | `down`. Check statuses: `pass` | `warn` | `fail` | `skip`.

New checks:

| Id | Behavior |
|---|---|
| `backup_storage_root_exists` | `backup.storage_root` exists as a directory |
| `backup_storage_writable` | Temp write/delete under backup root |
| `restore_readiness` | SQLite always ready; Postgres requires `psql` on PATH (else warn) |
| `disk_usage` | Free/total for media + backup roots; warn if free < 1 GiB |
| `app_runtime` | Environment + uptime (always pass with details) |

No secrets / DSNs / Redis URLs in details.

---

## 4. Metrics

`GET /api/v1/system/metrics` returns non-deleted counts for users, dresses, customers, active rentals, reservations, sales; audit log count; completed backups + `last_backup_at`; `database_size_bytes`; `uptime_seconds`; `environment`; `collected_at`.

---

## 5. Maintenance tasks

| Task key | Category | Confirm |
|---|---|---|
| `cleanup_sessions` | cleanup | yes (unless `dry_run`) |
| `cleanup_orphan_media_references` | cleanup | yes |
| `cleanup_orphan_media_files` | cleanup | yes |
| `verify_media_integrity` | verification | no |
| `verify_calendar_consistency` | verification | no |
| `verify_dress_status_consistency` | verification | no |
| `verify_foreign_reference_integrity` | verification | no |

- Cleanup without `dry_run` and without `confirm: true` → **422**
- Unknown task → **404**
- `dry_run: true` on cleanup: counts only; history stores `dry_run=true`
- `phase` on listed tasks is `"current"`

Not registered: `vacuum_database`, `rebuild_cache`, `refresh_statistics`, combined `cleanup_orphan_media`.

---

## 6. Execution & concurrency

```
POST /api/v1/system/maintenance/tasks/{task_key}/execute
Body: { "confirm"?: bool, "dry_run"?: bool }
```

Global in-process maintenance lock (one run at a time). Also rejected with **409** while a backup or restore is `RUNNING`:

- Maintenance busy → `مهمة صيانة قيد التنفيذ`
- Backup busy → `نسخة احتياطية قيد التنفيذ`
- Restore busy → `استعادة قيد التنفيذ`

Backup and restore engines likewise reject when a maintenance run is `RUNNING`.

History: `system_maintenance_runs` (`AuditedSoftDeleteModel`). List/filter/detail under `/system/maintenance/history*`.

---

## 7. Audit

After terminal status, `AuditAction.CUSTOM` with metadata:

- `maintenance_outcome` = `success` | `failure` | `dry_run`
- `task_key`, `execution_id`, summary snippet
- `module=system_admin`, `entity_type=system_maintenance_run`

Diagnostics and metrics GETs are not audited.

---

## 8. Safety

- Media/disk cleanup confined under `MEDIA_STORAGE_ROOT`
- No DSN/password/Redis URL leakage
- Business-data repair is intentionally absent

---

## 9. Migration

`20260801_0032_system_maintenance_runs`

Security & audit: see [SYSTEM_SECURITY.md](SYSTEM_SECURITY.md).
