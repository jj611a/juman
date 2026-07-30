"""Session API schemas — Identity Phase 4."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.modules.identity.models.login_session import LoginSession
from app.modules.identity.models.user import User
from app.schemas.common import APIModel


@dataclass(frozen=True, slots=True)
class AuthenticatedPrincipal:
    """Authenticated caller resolved from Bearer access token + active session."""

    user: User
    session_id: UUID


class SessionResponse(APIModel):
    """Public representation of a login session."""

    id: UUID
    device_name: str | None
    ip_address: str | None
    created_at: datetime
    last_activity_at: datetime | None
    expires_at: datetime
    remember_me: bool
    is_current: bool = False

    @classmethod
    def from_model(
        cls,
        session: LoginSession,
        *,
        is_current: bool = False,
    ) -> SessionResponse:
        return cls(
            id=session.id,
            device_name=session.device_name,
            ip_address=session.ip_address,
            created_at=session.created_at,
            last_activity_at=session.last_activity_at,
            expires_at=session.expires_at,
            remember_me=session.remember_me,
            is_current=is_current,
        )


class SessionListResponse(APIModel):
    """List envelope for sessions."""

    success: bool = True
    data: list[SessionResponse]
