"""System maintenance run repository."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.system_admin.constants import MaintenanceRunStatus
from app.modules.system_admin.models.maintenance_run import SystemMaintenanceRun
from app.repositories.base import AsyncRepository


class SystemMaintenanceRunRepository(AsyncRepository[SystemMaintenanceRun]):
    """Persistence helpers for maintenance execution history."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, SystemMaintenanceRun)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> SystemMaintenanceRun | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            SystemMaintenanceRun.id == entity_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def has_running(self) -> bool:
        stmt = (
            select(func.count())
            .select_from(SystemMaintenanceRun)
            .where(
                SystemMaintenanceRun.is_deleted.is_(False),
                SystemMaintenanceRun.status == MaintenanceRunStatus.RUNNING.value,
            )
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one()) > 0

    async def list_filtered(
        self,
        *,
        task_key: str | None = None,
        status: str | None = None,
        executed_by_user_id: UUID | None = None,
        sort_by: str = "started_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[SystemMaintenanceRun]:
        stmt = self._base_query()
        if task_key:
            stmt = stmt.where(SystemMaintenanceRun.task_key == task_key)
        if status:
            stmt = stmt.where(SystemMaintenanceRun.status == status)
        if executed_by_user_id is not None:
            stmt = stmt.where(
                SystemMaintenanceRun.executed_by_user_id == executed_by_user_id
            )
        column = getattr(SystemMaintenanceRun, sort_by, SystemMaintenanceRun.started_at)
        order = asc(column) if sort_dir.lower() == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        *,
        task_key: str | None = None,
        status: str | None = None,
        executed_by_user_id: UUID | None = None,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(SystemMaintenanceRun)
            .where(SystemMaintenanceRun.is_deleted.is_(False))
        )
        if task_key:
            stmt = stmt.where(SystemMaintenanceRun.task_key == task_key)
        if status:
            stmt = stmt.where(SystemMaintenanceRun.status == status)
        if executed_by_user_id is not None:
            stmt = stmt.where(
                SystemMaintenanceRun.executed_by_user_id == executed_by_user_id
            )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
