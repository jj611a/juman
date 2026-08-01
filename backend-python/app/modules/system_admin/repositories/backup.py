"""System backup history repository."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.system_admin.constants import BackupStatus
from app.modules.system_admin.models.backup import SystemBackup
from app.repositories.base import AsyncRepository


class SystemBackupRepository(AsyncRepository[SystemBackup]):
    """Persistence helpers for backup history."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SystemBackup)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> SystemBackup | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            SystemBackup.id == entity_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def has_running(self) -> bool:
        stmt = (
            select(func.count())
            .select_from(SystemBackup)
            .where(
                SystemBackup.is_deleted.is_(False),
                SystemBackup.status == BackupStatus.RUNNING.value,
            )
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one()) > 0

    async def list_filtered(
        self,
        *,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[SystemBackup]:
        stmt = self._base_query()
        column = getattr(SystemBackup, sort_by, SystemBackup.created_at)
        order = asc(column) if sort_dir.lower() == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_filtered(self) -> int:
        stmt = (
            select(func.count())
            .select_from(SystemBackup)
            .where(SystemBackup.is_deleted.is_(False))
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())