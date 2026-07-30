"""Processing repositories."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.processing.constants import ACTIVE_PROCESSING_STATUSES
from app.modules.processing.models.processing_batch import ProcessingBatch
from app.modules.processing.models.processing_item import ProcessingItem
from app.repositories.base import AsyncRepository


class ProcessingBatchRepository(AsyncRepository[ProcessingBatch]):
    """Persistence helpers for processing batches."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProcessingBatch)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> ProcessingBatch | None:
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .options(selectinload(ProcessingBatch.items))
            .where(ProcessingBatch.id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_processing_number(
        self,
        processing_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> ProcessingBatch | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            ProcessingBatch.processing_number == processing_number
        )
        if exclude_id is not None:
            stmt = stmt.where(ProcessingBatch.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        dress_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[ProcessingBatch]:
        stmt = self._base_query().options(selectinload(ProcessingBatch.items))
        if status is not None:
            stmt = stmt.where(ProcessingBatch.status == status)
        if dress_id is not None:
            stmt = stmt.join(ProcessingItem).where(
                ProcessingItem.dress_id == dress_id,
                ProcessingItem.is_deleted.is_(False),
            )
        column = getattr(ProcessingBatch, sort_by, ProcessingBatch.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        dress_id: UUID | None = None,
    ) -> int:
        if dress_id is not None:
            stmt = (
                select(func.count(func.distinct(ProcessingBatch.id)))
                .select_from(ProcessingBatch)
                .join(ProcessingItem)
                .where(
                    ProcessingBatch.is_deleted.is_(False),
                    ProcessingItem.is_deleted.is_(False),
                    ProcessingItem.dress_id == dress_id,
                )
            )
            if status is not None:
                stmt = stmt.where(ProcessingBatch.status == status)
        else:
            stmt = select(func.count()).select_from(ProcessingBatch).where(
                ProcessingBatch.is_deleted.is_(False)
            )
            if status is not None:
                stmt = stmt.where(ProcessingBatch.status == status)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class ProcessingItemRepository(AsyncRepository[ProcessingItem]):
    """Persistence helpers for processing items."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ProcessingItem)

    async def list_live_for_batch(self, batch_id: UUID) -> list[ProcessingItem]:
        stmt = (
            self._base_query()
            .where(ProcessingItem.processing_batch_id == batch_id)
            .order_by(asc(ProcessingItem.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> ProcessingItem | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            ProcessingItem.id == entity_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_for_dress(self, dress_id: UUID) -> ProcessingItem | None:
        stmt = self._base_query().where(
            ProcessingItem.dress_id == dress_id,
            ProcessingItem.status.in_(tuple(ACTIVE_PROCESSING_STATUSES)),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_active_for_inspection_item(
        self,
        inspection_item_id: UUID,
    ) -> ProcessingItem | None:
        stmt = self._base_query().where(
            ProcessingItem.inspection_item_id == inspection_item_id,
            ProcessingItem.status.in_(tuple(ACTIVE_PROCESSING_STATUSES)),
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
