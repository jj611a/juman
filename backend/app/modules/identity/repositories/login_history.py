"""LoginHistory repository — append-only queries (Identity Phase 5)."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models.login_history import LoginHistory


class LoginHistoryRepository:
    """Persistence helpers for login history (no soft-delete)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: LoginHistory) -> LoginHistory:
        """Persist a new history row."""
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    def _filter_query(
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
    ) -> Select[tuple[LoginHistory]]:
        stmt = select(LoginHistory)
        if user_id is not None:
            stmt = stmt.where(LoginHistory.user_id == user_id)
        if username:
            stmt = stmt.where(LoginHistory.username_attempted == username.lower())
        if event_type:
            stmt = stmt.where(LoginHistory.event_type == event_type)
        if success is not None:
            stmt = stmt.where(LoginHistory.success.is_(success))
        if failure_reason:
            stmt = stmt.where(LoginHistory.failure_reason == failure_reason)
        if q:
            pattern = f"%{q.lower()}%"
            stmt = stmt.where(LoginHistory.username_attempted.ilike(pattern))
        if created_from is not None:
            stmt = stmt.where(LoginHistory.created_at >= created_from)
        if created_to is not None:
            stmt = stmt.where(LoginHistory.created_at <= created_to)
        return stmt

    async def list_filtered(
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
    ) -> list[LoginHistory]:
        """List history rows newest-first with filters."""
        stmt = (
            self._filter_query(
                user_id=user_id,
                username=username,
                event_type=event_type,
                success=success,
                failure_reason=failure_reason,
                q=q,
                created_from=created_from,
                created_to=created_to,
            )
            .order_by(LoginHistory.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_filtered(
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
    ) -> int:
        """Count history rows matching filters."""
        base = self._filter_query(
            user_id=user_id,
            username=username,
            event_type=event_type,
            success=success,
            failure_reason=failure_reason,
            q=q,
            created_from=created_from,
            created_to=created_to,
        ).subquery()
        stmt = select(func.count()).select_from(base)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
