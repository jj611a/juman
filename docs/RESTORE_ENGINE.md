# Restore Engine - Juman

**Document type:** Domain module design  
**Audience:** Backend implementers, operators  
**Status:** Implemented (Phase 3 — Restore)  
**Scope:** Validate and apply `.juman` packages (by `backup_id` or upload), mandatory verified pre-restore safety backup, sync in-place apply, automatic safety rollback on failure, Admin-only APIs, history + audit — **no scheduling**

Related: [BACKUP_ENGINE.md](BACKUP_ENGINE.md), [SYSTEM_ADMINISTRATION.md](SYSTEM_ADMINISTRATION.md), [DATABASE_GUIDELINES.md](DATABASE_GUIDELINES.md) §18.

---

## 1. Purpose

Restore a single-store desktop database from a Phase 2 `.juman` package. Every destructive apply is preceded by a verified safety backup; apply failure automatically re-applies that safety dump.

---

## 2. Package source

| Source | Behavior |
|---|---|
| `backup_id` | `system_backups` row must be `COMPLETED`, not soft-deleted; file under `backup.storage_root` |
| Multipart upload | Temporary file under confined backup workdir; cleaned up after success or failure |

Exactly one source per request.

---

## 3. Validation pipeline

`RestoreValidator` (no DB mutate except optional temp extract):

1. File is ZIP; `ZipFile.testzip()` clean  
2. Required members: `manifest.json`, `metadata.json`, `database.dump`, `checksum.sha256`  
3. `format == "juman.backup"`; `format_version` in `{1}`  
4. Recompute SHA-256 for every path in `checksum.sha256`  
5. Cross-check `manifest.files[]` vs members vs checksum file  
6. `database.dump` non-empty  
7. Compatibility checks (section 4)  
8. Optional caller `expected_checksum` must match archive SHA-256  

`POST /system/restore/validate` returns a structured report without starting restore.

---

## 4. Compatibility (exact schema match)

| Check | Rule |
|---|---|
| Format / version | `juman.backup` + version in `{1}` |
| `database_engine` | Must equal live dialect (`postgresql` / `sqlite`) |
| `alembic_current` | Sorted set **must equal** live `alembic_version` (no older/newer) |
| `app_version` | Informational only; does not block if Alembic matches |

Forward/backward schema restore is out of scope.

---

## 5. Restore pipeline

1. Acquire restore lock (or **409**)  
2. Validate package  
3. Insert `system_restores` `RUNNING` + write **sidecar JSON** on disk (survives DB wipe)  
4. Create + verify safety backup via `BackupService.create(include_media=false)` with notes `pre-restore-safety`  
5. Apply target `database.dump` (Postgres `psql` / SQLite file apply)  
6. On success: optional media copy; rewrite history `COMPLETED` from sidecar; audit success  
7. On apply failure: re-apply safety dump; rewrite history `FAILED`; audit failure  
8. Release lock; delete workdir / upload temp  

**Confirmation (required):** `confirm: true` and `confirm_checksum` equal to package archive SHA-256. Missing/wrong → **422**.

**Media:** copied after successful DB apply. Media failure → status `COMPLETED` + `warning_message` (no DB rollback). DB apply failure → `FAILED` only.

---

## 6. Rollback / sidecar

Plain SQL replace wipes live rows including the in-flight restore history. Strategy:

- Sidecar on disk holds restore id, actor, package checksum, `safety_backup_id`, storage paths, timestamps, notes  
- Safety package verified (`testzip`, manifest, non-empty dump) before apply  
- After success or failure, history is **re-inserted/updated from sidecar**  
- Safety `system_backups` row re-inserted if absent (target dump predates the safety row)  
- If safety re-apply also fails → `FAILED` with catastrophic Arabic guidance  

---

## 7. History model

Table `system_restores` (`AuditedSoftDeleteModel`):

| Column | Notes |
|---|---|
| `status` | `PENDING_VALIDATION` / `RUNNING` / `COMPLETED` / `FAILED` |
| `source_type` | `BACKUP_ID` / `UPLOAD` |
| `source_backup_id` | FK when restoring from history |
| `package_checksum_sha256` | Archive digest |
| `safety_backup_id` | Auto safety backup |
| `error_message` / `warning_message` | Failure / media warnings |
| `started_at` / `finished_at` / `duration_ms` | Timing |

No soft-delete API in v1 (append-only for operators).

---

## 8. API (`system.restore`)

| Method | Path | Behavior |
|---|---|---|
| POST | `/api/v1/system/restore/validate` | `{ backup_id? }` or multipart file |
| POST | `/api/v1/system/restore` | Source + `confirm` + `confirm_checksum` + optional `notes`; sync full pipeline |
| GET | `/api/v1/system/restore/history` | Paginated list |
| GET | `/api/v1/system/restore/history/{id}` | Detail |

No scheduling. No automatic restore on boot.

---

## 9. Concurrency

- Module `_RESTORE_BUSY` + `asyncio.Lock` (same pattern as backup)  
- Reject if any restore or backup is `RUNNING`  
- Backup create also rejects if restore `RUNNING` (safety create uses `bypass_restore_busy`)  
- HTTP **409** Arabic: استعادة قيد التنفيذ  

---

## 10. Audit

| Event | Action | Metadata |
|---|---|---|
| Validate | `CUSTOM` | `entity_type=system_restore_validation` |
| Restore start | `CUSTOM` | `restore_outcome=started` |
| Success | `CUSTOM` | `restore_outcome=success` |
| Failure | `CUSTOM` | `restore_outcome=failure` |

`module=system_admin`, `entity_type=system_restore` when restore id is known. Uses `CUSTOM` to avoid colliding with soft-undelete `RESTORE`.

---

## 11. Security

- All routes: **`system.restore`** (Admin only)  
- Path confinement for uploads and extracts  
- Never log/return DSN, passwords, Redis URLs; scrub `psql` argv  
- Confirmation gate on destructive `POST /restore`  

---

## 12. Explicit exclusions

Scheduling, remote restore, encryption, WAL/PITR, schema upgrade/downgrade bridges, Electron UI, maintenance execute, multi-node orchestration.

Migration: `20260731_0031_system_restores`.

Mutual exclusion: backup, restore, and maintenance refuse to start while another of those operations is `RUNNING`. See [MAINTENANCE_AND_DIAGNOSTICS.md](MAINTENANCE_AND_DIAGNOSTICS.md).

Security & audit: see [SYSTEM_SECURITY.md](SYSTEM_SECURITY.md).
