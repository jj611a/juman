"""PasswordHistory repository — Identity Phase 6."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.models.password_history import PasswordHistory


class PasswordHistoryRepository:
    """Persistence helpers for password history (append-only + prune)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: PasswordHistory) -> PasswordHistory:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def list_for_user(
        self,
        user_id: UUID,
        *,
        limit: int | None = None,
    ) -> list[PasswordHistory]:
        """Return history newest-first."""
        stmt = (
            select(PasswordHistory)
            .where(PasswordHistory.user_id == user_id)
            .order_by(PasswordHistory.created_at.desc())
        )
        if limit is not None:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def prune_for_user(self, user_id: UUID, *, keep: int) -> int:
        """Hard-delete oldest rows beyond ``keep``. Returns deleted count."""
        keep = max(0, keep)
        rows = await self.list_for_user(user_id)
        to_delete = rows[keep:]
        if not to_delete:
            return 0
        ids = [row.id for row in to_delete]
        await self.session.execute(
            delete(PasswordHistory).where(PasswordHistory.id.in_(ids))
        )
        await self.session.flush()
        return len(ids)
