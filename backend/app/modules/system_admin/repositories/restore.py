"""System restore history repository."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.system_admin.constants import RestoreStatus
from app.modules.system_admin.models.restore import SystemRestore
from app.repositories.base import AsyncRepository


class SystemRestoreRepository(AsyncRepository[SystemRestore]):
    """Persistence helpers for restore history."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SystemRestore)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> SystemRestore | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            SystemRestore.id == entity_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def has_running(self) -> bool:
        stmt = (
            select(func.count())
            .select_from(SystemRestore)
            .where(
                SystemRestore.is_deleted.is_(False),
                SystemRestore.status == RestoreStatus.RUNNING.value,
            )
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one()) > 0

    async def list_filtered(
        self,
        *,
        sort_by: str = "started_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[SystemRestore]:
        stmt = self._base_query()
        column = getattr(SystemRestore, sort_by, SystemRestore.started_at)
        order = asc(column) if sort_dir.lower() == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_filtered(self) -> int:
        stmt = (
            select(func.count())
            .select_from(SystemRestore)
            .where(SystemRestore.is_deleted.is_(False))
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
