"""Login history API schemas — Identity Phase 5."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from app.modules.identity.models.login_history import LoginHistory
from app.schemas.common import APIModel, PaginationMeta


class LoginHistoryResponse(APIModel):
    """Public login-history row."""

    id: UUID
    user_id: UUID | None
    username_attempted: str
    event_type: str
    success: bool
    failure_reason: str | None
    ip_address: str | None
    device_name: str | None
    user_agent: str | None
    session_id: UUID | None
    created_at: datetime

    @classmethod
    def from_model(cls, row: LoginHistory) -> LoginHistoryResponse:
        return cls(
            id=row.id,
            user_id=row.user_id,
            username_attempted=row.username_attempted,
            event_type=row.event_type,
            success=row.success,
            failure_reason=row.failure_reason,
            ip_address=row.ip_address,
            device_name=row.device_name,
            user_agent=row.user_agent,
            session_id=row.session_id,
            created_at=row.created_at,
        )


class LoginHistoryListResponse(APIModel):
    """Paginated login-history envelope."""

    success: bool = True
    data: list[LoginHistoryResponse]
    meta: PaginationMeta
