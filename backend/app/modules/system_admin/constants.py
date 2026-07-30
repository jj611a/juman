"""System Administration constants."""

from enum import StrEnum


class SystemPermission(StrEnum):
    """RBAC permission keys for System Administration APIs."""

    VIEW = "system.view"
    MAINTENANCE = "system.maintenance"
    BACKUP = "system.backup"
    RESTORE = "system.restore"


class DiagnosticCheckId(StrEnum):
    """Stable diagnostic check identifiers."""

    DATABASE_CONNECTIVITY = "database_connectivity"
    DATABASE_LATENCY = "database_latency"
    ALEMBIC_UP_TO_DATE = "alembic_up_to_date"
    SETTINGS_AVAILABLE = "settings_available"
    AUDIT_AVAILABLE = "audit_available"
    MEDIA_ROOT_EXISTS = "media_root_exists"
    MEDIA_ROOT_WRITABLE = "media_root_writable"
    REDIS = "redis"
    BACKUP_STORAGE_ROOT_EXISTS = "backup_storage_root_exists"
    BACKUP_STORAGE_WRITABLE = "backup_storage_writable"
    RESTORE_READINESS = "restore_readiness"
    DISK_USAGE = "disk_usage"
    APP_RUNTIME = "app_runtime"


class DiagnosticStatus(StrEnum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    SKIP = "skip"


class OverallDiagnosticStatus(StrEnum):
    OK = "ok"
    DEGRADED = "degraded"
    DOWN = "down"


class MaintenanceTaskCategory(StrEnum):
    """Maintenance task categories (Phase 4)."""

    VERIFICATION = "verification"
    CLEANUP = "cleanup"


class MaintenanceTaskId(StrEnum):
    """Registered Phase 4 maintenance task ids."""

    CLEANUP_SESSIONS = "cleanup_sessions"
    CLEANUP_ORPHAN_MEDIA_REFERENCES = "cleanup_orphan_media_references"
    CLEANUP_ORPHAN_MEDIA_FILES = "cleanup_orphan_media_files"
    VERIFY_MEDIA_INTEGRITY = "verify_media_integrity"
    VERIFY_CALENDAR_CONSISTENCY = "verify_calendar_consistency"
    VERIFY_DRESS_STATUS_CONSISTENCY = "verify_dress_status_consistency"
    VERIFY_FOREIGN_REFERENCE_INTEGRITY = "verify_foreign_reference_integrity"


class MaintenanceRunStatus(StrEnum):
    """Lifecycle status for system_maintenance_runs."""

    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class MaintenanceRunSortField(StrEnum):
    """Allow-listed sort fields for maintenance history list."""

    STARTED_AT = "started_at"
    FINISHED_AT = "finished_at"
    STATUS = "status"
    CREATED_AT = "created_at"
    TASK_KEY = "task_key"


DATABASE_LATENCY_WARN_MS = 500
DISK_FREE_WARN_BYTES = 1 * 1024 * 1024 * 1024  # 1 GiB


class BackupStatus(StrEnum):
    """Lifecycle status for system_backups history rows."""

    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DELETED = "DELETED"


class BackupSortField(StrEnum):
    """Allow-listed sort fields for backup history list."""

    CREATED_AT = "created_at"
    FILENAME = "filename"
    STATUS = "status"
    COMPRESSED_SIZE_BYTES = "compressed_size_bytes"


BACKUP_FORMAT = "juman.backup"
BACKUP_FORMAT_VERSION = 1
BACKUP_PACKAGE_EXTENSION = ".juman"


class RestoreStatus(StrEnum):
    """Lifecycle status for system_restores history rows."""

    PENDING_VALIDATION = "PENDING_VALIDATION"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class RestoreSourceType(StrEnum):
    """How the restore package was supplied."""

    BACKUP_ID = "BACKUP_ID"
    UPLOAD = "UPLOAD"


class RestoreSortField(StrEnum):
    """Allow-listed sort fields for restore history list."""

    STARTED_AT = "started_at"
    FINISHED_AT = "finished_at"
    STATUS = "status"
    CREATED_AT = "created_at"


SUPPORTED_BACKUP_FORMAT_VERSIONS: frozenset[int] = frozenset({BACKUP_FORMAT_VERSION})
PRE_RESTORE_SAFETY_NOTES = "pre-restore-safety"

