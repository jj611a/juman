"""Reservation repository."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.reservations.models.reservation import Reservation
from app.modules.reservations.models.reservation_item import ReservationItem
from app.repositories.base import AsyncRepository


class ReservationRepository(AsyncRepository[Reservation]):
    """Persistence helpers for reservations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Reservation)

    def _with_items(self, stmt: Select[tuple[Reservation]]) -> Select[tuple[Reservation]]:
        return stmt.options(selectinload(Reservation.items))

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Reservation | None:
        stmt = self._with_items(self._base_query(include_deleted=include_deleted)).where(
            Reservation.id == entity_id
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_reservation_number(
        self,
        reservation_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> Reservation | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            Reservation.reservation_number == reservation_number
        )
        if exclude_id is not None:
            stmt = stmt.where(Reservation.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        rental_from: datetime | None = None,
        rental_to: datetime | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Reservation]:
        stmt = self._with_items(self._base_query())
        if status is not None:
            stmt = stmt.where(Reservation.status == status)
        if customer_id is not None:
            stmt = stmt.where(Reservation.customer_id == customer_id)
        if rental_from is not None:
            stmt = stmt.where(Reservation.rental_start_at >= rental_from)
        if rental_to is not None:
            stmt = stmt.where(Reservation.rental_start_at < rental_to)
        column = getattr(Reservation, sort_by, Reservation.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        customer_id: UUID | None = None,
        rental_from: datetime | None = None,
        rental_to: datetime | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Reservation).where(Reservation.is_deleted.is_(False))
        if status is not None:
            stmt = stmt.where(Reservation.status == status)
        if customer_id is not None:
            stmt = stmt.where(Reservation.customer_id == customer_id)
        if rental_from is not None:
            stmt = stmt.where(Reservation.rental_start_at >= rental_from)
        if rental_to is not None:
            stmt = stmt.where(Reservation.rental_start_at < rental_to)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class ReservationItemRepository(AsyncRepository[ReservationItem]):
    """Persistence helpers for reservation items."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ReservationItem)

    async def list_live_for_reservation(self, reservation_id: UUID) -> list[ReservationItem]:
        stmt = (
            self._base_query()
            .where(ReservationItem.reservation_id == reservation_id)
            .order_by(asc(ReservationItem.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
