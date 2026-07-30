# System Administration Security - Juman

**Document type:** Security & audit reference  
**Audience:** Backend implementers, operators  
**Status:** Implemented (Phase 5 — Audit & Security Integration)  
**Scope:** Permission model, authz fail-closed behaviour, audit strategy, operation history

Related: [SYSTEM_ADMINISTRATION.md](SYSTEM_ADMINISTRATION.md), [BACKUP_ENGINE.md](BACKUP_ENGINE.md), [RESTORE_ENGINE.md](RESTORE_ENGINE.md), [MAINTENANCE_AND_DIAGNOSTICS.md](MAINTENANCE_AND_DIAGNOSTICS.md).

---

## 1. Permission model

| Key | Operations |
|---|---|
| `system.view` | Info, diagnostics, metrics, list maintenance tasks |
| `system.backup` | Create, list, get, download, delete backups |
| `system.restore` | Validate package, restore, restore history |
| `system.maintenance` | Execute tasks, maintenance history |

Admin-only. Cashier / Inventory / Laundry receive none.

Package integrity validation is **not** a separate backup permission — it is part of restore (`POST /system/restore/validate`, `system.restore`).

---

## 2. Authentication & fail-closed authz

```
Bearer token -> get_current_user -> require_permission(key)
```

`get_current_user` denies (401) when:

- Missing / invalid token
- User missing or soft-deleted
- `user.is_active` is false
- `user.is_locked` is true
- Session / SID mismatch

`require_permission` denies (403) when the role lacks the key.

`role_has_permission` also fail-closed on roles:

- Missing / soft-deleted role → deny
- `Role.is_active` is false → deny immediately without evaluating RolePermission links
- Reactivating the role restores grants; RolePermission rows are preserved on deactivate

---

## 3. Audit strategy

`module=system_admin`. Privileged mutating / export / validation events use outcome metadata:

| Event | Action | entity_type | Outcome key |
|---|---|---|---|
| Backup created | `create` | `system_backup` | `backup_outcome=success` |
| Backup failed | `custom` | `system_backup` | `backup_outcome=failure` |
| Backup deleted | `delete` | `system_backup` | `backup_outcome=deleted` |
| Backup download | `export` | `system_backup` | `backup_outcome=download` |
| Restore validation | `custom` | `system_restore_validation` | `restore_outcome=validation_ok` / `validation_failed` |
| Restore started | `custom` | `system_restore` | `restore_outcome=started` |
| Restore completed | `custom` | `system_restore` | `restore_outcome=success` |
| Restore failed | `custom` | `system_restore` | `restore_outcome=failure` |
| Maintenance started | `custom` | `system_maintenance_run` | `maintenance_outcome=started` |
| Maintenance completed | `custom` | `system_maintenance_run` | `maintenance_outcome=success` / `dry_run` |
| Maintenance failed | `custom` | `system_maintenance_run` | `maintenance_outcome=failure` |

**Not audited:** ordinary GET info/diagnostics/metrics/task list/history list & detail / backup list & detail.

Audit metadata must never include DSN credentials, passwords, or Redis URLs.

---

## 4. History model

| Table | Who | When | Duration | Result | Error | Audit ref |
|---|---|---|---|---|---|---|
| `system_backups` | `created_by_user_id` | `started_at` / `finished_at` / timestamps | `duration_ms` | `status` | `error_message` | `audit_log_id` |
| `system_restores` | `created_by_user_id` | `started_at` / `finished_at` | `duration_ms` | `status` | `error_message` / `warning_message` | `audit_log_id` (terminal) |
| `system_maintenance_runs` | `executed_by_user_id` | `started_at` / `finished_at` | `duration_ms` | `status` | `error_message` | `audit_log_id` (terminal) |

---

## 5. Mutual exclusion

Backup, restore, and maintenance refuse to start while another of those operations is `RUNNING` (in-process lock + DB status). Arabic 409 messages:

- `نسخة احتياطية قيد التنفيذ`
- `استعادة قيد التنفيذ`
- `مهمة صيانة قيد التنفيذ`

---

## 6. Error responses

Arabic `message` for operators; English machine `code` from the shared exception envelope (`validation_error`, `conflict`, `not_found`, `authentication_error`, `authorization_error`, `business_error`).

Confirmation gates (cleanup / restore) and checksum mismatches → 422.

---

## 7. Migration

`20260802_0033_system_backups_duration` — adds `started_at`, `finished_at`, `duration_ms` to `system_backups`.
