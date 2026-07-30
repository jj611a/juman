"""Rental repositories."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.rentals.models.rental import Rental
from app.modules.rentals.models.rental_item import RentalItem
from app.repositories.base import AsyncRepository


class RentalRepository(AsyncRepository[Rental]):
    """Persistence helpers for rentals."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Rental)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Rental | None:
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .options(selectinload(Rental.items))
            .where(Rental.id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_rental_number(
        self,
        rental_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> Rental | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            Rental.rental_number == rental_number
        )
        if exclude_id is not None:
            stmt = stmt.where(Rental.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        reservation_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Rental]:
        stmt = self._base_query().options(selectinload(Rental.items))
        if status is not None:
            stmt = stmt.where(Rental.status == status)
        if customer_id is not None:
            stmt = stmt.where(Rental.customer_id == customer_id)
        if reservation_id is not None:
            stmt = stmt.where(Rental.reservation_id == reservation_id)
        column = getattr(Rental, sort_by, Rental.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        reservation_id: UUID | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Rental).where(Rental.is_deleted.is_(False))
        if status is not None:
            stmt = stmt.where(Rental.status == status)
        if customer_id is not None:
            stmt = stmt.where(Rental.customer_id == customer_id)
        if reservation_id is not None:
            stmt = stmt.where(Rental.reservation_id == reservation_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class RentalItemRepository(AsyncRepository[RentalItem]):
    """Persistence helpers for rental items."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, RentalItem)

    async def list_live_for_rental(self, rental_id: UUID) -> list[RentalItem]:
        stmt = (
            self._base_query()
            .where(RentalItem.rental_id == rental_id)
            .order_by(asc(RentalItem.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
