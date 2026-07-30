"""LoginHistoryService — append-only authentication event recording."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.constants import (
    AuthenticationFailureReason,
    LoginHistoryEventType,
)
from app.modules.identity.models.login_history import LoginHistory
from app.modules.identity.repositories.login_history import LoginHistoryRepository
from app.utils.datetime import utc_now


class LoginHistoryService:
    """Record and query authentication-related history events."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        repository: LoginHistoryRepository | None = None,
    ) -> None:
        self.session = session
        self.history = repository or LoginHistoryRepository(session)

    async def record(
        self,
        *,
        event_type: LoginHistoryEventType | str,
        username_attempted: str,
        success: bool,
        user_id: UUID | None = None,
        failure_reason: str | None = None,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
        session_id: UUID | None = None,
    ) -> LoginHistory:
        """Insert a single append-only history row."""
        row = LoginHistory(
            user_id=user_id,
            username_attempted=username_attempted.lower(),
            event_type=str(event_type),
            success=success,
            failure_reason=failure_reason,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
            session_id=session_id,
            created_at=utc_now(),
        )
        return await self.history.add(row)

    async def record_login_success(
        self,
        *,
        username_attempted: str,
        user_id: UUID,
        session_id: UUID | None = None,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> LoginHistory:
        return await self.record(
            event_type=LoginHistoryEventType.LOGIN,
            username_attempted=username_attempted,
            success=True,
            user_id=user_id,
            session_id=session_id,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )

    async def record_login_failure(
        self,
        *,
        username_attempted: str,
        failure_reason: AuthenticationFailureReason | str,
        user_id: UUID | None = None,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> LoginHistory:
        return await self.record(
            event_type=LoginHistoryEventType.LOGIN,
            username_attempted=username_attempted,
            success=False,
            user_id=user_id,
            failure_reason=str(failure_reason),
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )

    async def record_logout(
        self,
        *,
        username_attempted: str,
        user_id: UUID,
        session_id: UUID | None = None,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> LoginHistory:
        return await self.record(
            event_type=LoginHistoryEventType.LOGOUT,
            username_attempted=username_attempted,
            success=True,
            user_id=user_id,
            session_id=session_id,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )

    async def record_account_locked(
        self,
        *,
        username_attempted: str,
        user_id: UUID,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> LoginHistory:
        return await self.record(
            event_type=LoginHistoryEventType.ACCOUNT_LOCKED,
            username_attempted=username_attempted,
            success=False,
            user_id=user_id,
            failure_reason=AuthenticationFailureReason.LOCKED.value,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )

    async def record_password_reset(
        self,
        *,
        username_attempted: str,
        user_id: UUID,
        ip_address: str | None = None,
        device_name: str | None = None,
        user_agent: str | None = None,
    ) -> LoginHistory:
        return await self.record(
            event_type=LoginHistoryEventType.PASSWORD_RESET,
            username_attempted=username_attempted,
            success=True,
            user_id=user_id,
            ip_address=ip_address,
            device_name=device_name,
            user_agent=user_agent,
        )

    async def list_history(
        self,
        *,
        user_id: UUID | None = None,
        username: str | None = None,
        event_type: str | None = None,
        success: bool | None = None,
        failure_reason: str | None = None,
        q: str | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[LoginHistory], int]:
        """List and count filtered history rows."""
        items = await self.history.list_filtered(
            user_id=user_id,
            username=username,
            event_type=event_type,
            success=success,
            failure_reason=failure_reason,
            q=q,
            created_from=created_from,
            created_to=created_to,
            offset=offset,
            limit=limit,
        )
        total = await self.history.count_filtered(
            user_id=user_id,
            username=username,
            event_type=event_type,
            success=success,
            failure_reason=failure_reason,
            q=q,
            created_from=created_from,
            created_to=created_to,
        )
        return items, total
