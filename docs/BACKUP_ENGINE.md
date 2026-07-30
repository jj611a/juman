# Backup Engine - Juman

**Document type:** Domain module design  
**Audience:** Backend implementers, operators  
**Status:** Implemented (Phase 2 — Backup)  
**Scope:** Local versioned .juman backup packages, history, Admin APIs

Restore: see [RESTORE_ENGINE.md](RESTORE_ENGINE.md).

Related: [SYSTEM_ADMINISTRATION.md](SYSTEM_ADMINISTRATION.md), [DATABASE_GUIDELINES.md](DATABASE_GUIDELINES.md) §18.

---

## 1. Purpose

Create portable, checksummed database backups for a single-store desktop deployment. Binary archives live on disk; history metadata lives in Postgres (system_backups).

---

## 2. Package format (.juman = ZIP)

`	ext
juman-backup-YYYYMMDDTHHMMSSZ-<8hex>.juman
├── manifest.json
├── metadata.json
├── database.dump
├── checksum.sha256
└── media/                 # only when include_media=true
`

- manifest.json — format contract (ormat: juman.backup, ormat_version: 1)
- metadata.json — operational context (hostname, OS, dump tool, duration)
- database.dump — plain SQL
- checksum.sha256 — "<sha256>  <relative-path>" lines for payload files

---

## 3. Dump tools

| Engine | Tool |
|---|---|
| PostgreSQL | pg_dump --no-owner --no-acl --format=plain |
| SQLite (tests) | sqlite3 connection iterdump |

If pg_dump is missing on PATH → business error (Arabic). Connection password is passed via PGPASSWORD only; never logged.

---

## 4. Settings (category system)

| Key | Default |
|---|---|
| ackup.storage_root | ./storage/backups |
| ackup.include_media_default | alse |

Storage root is auto-created. Path confinement rejects .. escapes.

---

## 5. API (system.backup required)

| Method | Path | Behavior |
|---|---|---|
| POST | /api/v1/system/backups | Sync create; body { include_media?, notes? } |
| GET | /api/v1/system/backups | Paginated history |
| GET | /api/v1/system/backups/{id} | Detail (no binary) |
| GET | /api/v1/system/backups/{id}/download | Stream .juman attachment |
| DELETE | /api/v1/system/backups/{id} | Soft-delete + unlink file |

Create waits until completion (timeout risk for huge DBs). Concurrent create → **409**.

Media: default off; if include_media=true and media root missing/unreadable → fail.

---

## 6. History & audit

Statuses: RUNNING | COMPLETED | FAILED | DELETED.

On **COMPLETED**: audit create (module=system_admin, entity_type=system_backup) and store udit_log_id.  
On **FAILED**: history row only (no success audit).  
On **DELETE**: audit update + file removed.

---

## 7. Security

- Admin-only via system.backup
- Never return/log DATABASE_URL, passwords, Redis URLs
- Download only for COMPLETED, not soft-deleted, file present

---

## 8. Explicit exclusions

Scheduling, remote/S3, archive encryption, WAL/PITR, Electron UI, maintenance execute.

Restore/import/apply: [RESTORE_ENGINE.md](RESTORE_ENGINE.md).

Migration: 20260730_0030_system_backups.

Mutual exclusion: backup, restore, and maintenance refuse to start while another of those operations is `RUNNING`. See [MAINTENANCE_AND_DIAGNOSTICS.md](MAINTENANCE_AND_DIAGNOSTICS.md).

Security & audit: see [SYSTEM_SECURITY.md](SYSTEM_SECURITY.md).
