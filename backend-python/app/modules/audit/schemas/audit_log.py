"""Audit log request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from app.modules.audit.models.audit_log import AuditLog
from app.schemas.common import APIModel, PaginationMeta


class AuditLogResponse(APIModel):
    """Single audit log row."""

    id: UUID
    module: str
    entity_type: str
    entity_id: str | None = None
    action: str
    old_values: dict[str, Any] | list[Any] | None = None
    new_values: dict[str, Any] | list[Any] | None = None
    user_id: UUID | None = None
    username: str | None = None
    ip_address: str | None = None
    metadata: dict[str, Any] | list[Any] | None = None
    message: str | None = None
    created_at: datetime

    @classmethod
    def from_model(cls, row: AuditLog) -> AuditLogResponse:
        """Map ORM row to API schema (``metadata_json`` → ``metadata``)."""
        return cls(
            id=row.id,
            module=row.module,
            entity_type=row.entity_type,
            entity_id=row.entity_id,
            action=row.action,
            old_values=row.old_values,
            new_values=row.new_values,
            user_id=row.user_id,
            username=row.username,
            ip_address=row.ip_address,
            metadata=row.metadata_json,
            message=row.message,
            created_at=row.created_at,
        )


class AuditLogListResponse(APIModel):
    """Paginated audit log list envelope."""

    success: bool = True
    data: list[AuditLogResponse]
    meta: PaginationMeta


class AuditLogItemResponse(APIModel):
    """Single audit log envelope."""

    success: bool = True
    data: AuditLogResponse
