"""System metrics response schemas."""

from __future__ import annotations

from datetime import datetime

from app.schemas.common import APIModel


class SystemMetricsResponse(APIModel):
    users: int
    dresses: int
    customers: int
    active_rentals: int
    reservations: int
    sales: int
    audit_logs: int
    backups: int
    last_backup_at: datetime | None
    database_size_bytes: int | None
    uptime_seconds: float | None
    environment: str
    collected_at: datetime
