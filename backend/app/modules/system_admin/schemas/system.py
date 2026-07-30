"""System Administration response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from app.schemas.common import APIModel, PaginationMeta


class SystemInfoResponse(APIModel):
    app_name: str
    app_name_ar: str
    app_version: str
    api_version: str
    environment: str
    python_version: str
    operating_system: str
    started_at: datetime | None
    uptime_seconds: float | None
    server_time_utc: datetime
    default_timezone: str
    alembic_head: list[str]
    alembic_current: list[str]
    migrations_pending: bool
    database_dialect: str | None
    database_name: str | None
    database_server_version: str | None
    database_size_bytes: int | None
    media_storage_provider: str | None
    media_storage_root: str | None
    redis_enabled: bool
    redis_configured: bool


class DiagnosticCheckResult(APIModel):
    id: str
    status: Literal["pass", "warn", "fail", "skip"]
    message: str
    latency_ms: float | None = None
    details: dict[str, Any] | None = None


class DiagnosticsResponse(APIModel):
    overall: Literal["ok", "degraded", "down"]
    checked_at: datetime
    checks: list[DiagnosticCheckResult]


class MaintenanceTaskInfo(APIModel):
    id: str
    title: str
    description: str
    phase: str
    category: str
    requires_confirmation: bool


class MaintenanceTasksResponse(APIModel):
    items: list[MaintenanceTaskInfo]


class MaintenanceExecuteRequest(APIModel):
    confirm: bool = False
    dry_run: bool = False


class MaintenanceRunResponse(APIModel):
    id: str
    task_key: str
    task_title: str
    category: str
    status: str
    dry_run: bool
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    executed_by_user_id: str | None
    summary: str | None
    result_details: dict[str, Any] | None
    error_message: str | None
    audit_log_id: str | None

    @classmethod
    def from_model(cls, row) -> "MaintenanceRunResponse":  # noqa: ANN001
        return cls(
            id=str(row.id),
            task_key=row.task_key,
            task_title=row.task_title,
            category=row.category,
            status=row.status,
            dry_run=bool(row.dry_run),
            started_at=row.started_at,
            finished_at=row.finished_at,
            duration_ms=row.duration_ms,
            executed_by_user_id=str(row.executed_by_user_id) if row.executed_by_user_id else None,
            summary=row.summary,
            result_details=row.result_details,
            error_message=row.error_message,
            audit_log_id=str(row.audit_log_id) if row.audit_log_id else None,
        )


class MaintenanceRunItemEnvelope(APIModel):
    data: MaintenanceRunResponse


class MaintenanceHistoryListResponse(APIModel):
    data: list[MaintenanceRunResponse]
    meta: PaginationMeta
