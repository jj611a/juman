"""Return repositories."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.returns.models.return_item import ReturnItem
from app.modules.returns.models.return_record import Return
from app.repositories.base import AsyncRepository


class ReturnRepository(AsyncRepository[Return]):
    """Persistence helpers for returns."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Return)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Return | None:
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .options(selectinload(Return.items))
            .where(Return.id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_return_number(
        self,
        return_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> Return | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            Return.return_number == return_number
        )
        if exclude_id is not None:
            stmt = stmt.where(Return.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_live_by_rental_id(self, rental_id: UUID) -> Return | None:
        stmt = self._base_query().where(Return.rental_id == rental_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        rental_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Return]:
        stmt = self._base_query().options(selectinload(Return.items))
        if status is not None:
            stmt = stmt.where(Return.status == status)
        if customer_id is not None:
            stmt = stmt.where(Return.customer_id == customer_id)
        if rental_id is not None:
            stmt = stmt.where(Return.rental_id == rental_id)
        column = getattr(Return, sort_by, Return.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        rental_id: UUID | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Return).where(Return.is_deleted.is_(False))
        if status is not None:
            stmt = stmt.where(Return.status == status)
        if customer_id is not None:
            stmt = stmt.where(Return.customer_id == customer_id)
        if rental_id is not None:
            stmt = stmt.where(Return.rental_id == rental_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class ReturnItemRepository(AsyncRepository[ReturnItem]):
    """Persistence helpers for return items."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ReturnItem)

    async def list_live_for_return(self, return_id: UUID) -> list[ReturnItem]:
        stmt = (
            self._base_query()
            .where(ReturnItem.return_id == return_id)
            .order_by(asc(ReturnItem.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
