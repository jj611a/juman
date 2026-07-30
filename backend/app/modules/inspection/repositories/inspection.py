"""Inspection repositories."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.inspection.models.inspection import Inspection
from app.modules.inspection.models.inspection_item import InspectionItem
from app.repositories.base import AsyncRepository


class InspectionRepository(AsyncRepository[Inspection]):
    """Persistence helpers for inspections."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Inspection)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Inspection | None:
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .options(selectinload(Inspection.items))
            .where(Inspection.id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_inspection_number(
        self,
        inspection_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> Inspection | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            Inspection.inspection_number == inspection_number
        )
        if exclude_id is not None:
            stmt = stmt.where(Inspection.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_live_by_return_id(self, return_id: UUID) -> Inspection | None:
        stmt = self._base_query().where(Inspection.return_id == return_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        return_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Inspection]:
        stmt = self._base_query().options(selectinload(Inspection.items))
        if status is not None:
            stmt = stmt.where(Inspection.status == status)
        if return_id is not None:
            stmt = stmt.where(Inspection.return_id == return_id)
        column = getattr(Inspection, sort_by, Inspection.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        return_id: UUID | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Inspection).where(Inspection.is_deleted.is_(False))
        if status is not None:
            stmt = stmt.where(Inspection.status == status)
        if return_id is not None:
            stmt = stmt.where(Inspection.return_id == return_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class InspectionItemRepository(AsyncRepository[InspectionItem]):
    """Persistence helpers for inspection items."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, InspectionItem)

    async def list_live_for_inspection(self, inspection_id: UUID) -> list[InspectionItem]:
        stmt = (
            self._base_query()
            .where(InspectionItem.inspection_id == inspection_id)
            .order_by(asc(InspectionItem.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(self, entity_id: UUID, *, include_deleted: bool = False) -> InspectionItem | None:
        stmt = self._base_query(include_deleted=include_deleted).where(InspectionItem.id == entity_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
