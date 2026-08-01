"""Settlement repositories."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.settlements.constants import SettlementStatus
from app.modules.settlements.models.adjustment import RentalSettlementAdjustment
from app.modules.settlements.models.charge import RentalSettlementCharge
from app.modules.settlements.models.payment import RentalSettlementPayment
from app.modules.settlements.models.settlement import RentalSettlement
from app.repositories.base import AsyncRepository


class RentalSettlementRepository(AsyncRepository[RentalSettlement]):
    """Persistence helpers for rental settlements."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, RentalSettlement)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> RentalSettlement | None:
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .options(
                selectinload(RentalSettlement.charges),
                selectinload(RentalSettlement.payments),
                selectinload(RentalSettlement.adjustments),
            )
            .where(RentalSettlement.id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_settlement_number(
        self,
        settlement_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> RentalSettlement | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            RentalSettlement.settlement_number == settlement_number
        )
        if exclude_id is not None:
            stmt = stmt.where(RentalSettlement.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_live_by_rental_id(self, rental_id: UUID) -> RentalSettlement | None:
        """Return the non-deleted, non-VOIDED settlement for a rental, if any."""
        stmt = (
            self._base_query()
            .options(
                selectinload(RentalSettlement.charges),
                selectinload(RentalSettlement.payments),
                selectinload(RentalSettlement.adjustments),
            )
            .where(
                RentalSettlement.rental_id == rental_id,
                RentalSettlement.status != SettlementStatus.VOIDED.value,
            )
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_for_update(self, settlement_id: UUID) -> RentalSettlement | None:
        """Lock the settlement row for payment/adjustment concurrency control."""
        stmt = (
            select(RentalSettlement)
            .where(
                RentalSettlement.id == settlement_id,
                RentalSettlement.is_deleted.is_(False),
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        rental_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[RentalSettlement]:
        stmt = self._base_query().options(
            selectinload(RentalSettlement.charges),
            selectinload(RentalSettlement.payments),
            selectinload(RentalSettlement.adjustments),
        )
        if status is not None:
            stmt = stmt.where(RentalSettlement.status == status)
        if rental_id is not None:
            stmt = stmt.where(RentalSettlement.rental_id == rental_id)
        column = getattr(RentalSettlement, sort_by, RentalSettlement.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        rental_id: UUID | None = None,
    ) -> int:
        stmt = (
            select(func.count())
            .select_from(RentalSettlement)
            .where(RentalSettlement.is_deleted.is_(False))
        )
        if status is not None:
            stmt = stmt.where(RentalSettlement.status == status)
        if rental_id is not None:
            stmt = stmt.where(RentalSettlement.rental_id == rental_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class RentalSettlementChargeRepository:
    """Append-only persistence for settlement charge lines."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: RentalSettlementCharge) -> RentalSettlementCharge:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def list_for_settlement(
        self,
        settlement_id: UUID,
    ) -> list[RentalSettlementCharge]:
        stmt = (
            select(RentalSettlementCharge)
            .where(RentalSettlementCharge.settlement_id == settlement_id)
            .order_by(asc(RentalSettlementCharge.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class RentalSettlementPaymentRepository:
    """Append-only persistence for settlement payments."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: RentalSettlementPayment) -> RentalSettlementPayment:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def list_for_settlement(
        self,
        settlement_id: UUID,
    ) -> list[RentalSettlementPayment]:
        stmt = (
            select(RentalSettlementPayment)
            .where(RentalSettlementPayment.settlement_id == settlement_id)
            .order_by(asc(RentalSettlementPayment.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def sum_payments(self, settlement_id: UUID) -> int:
        stmt = select(func.coalesce(func.sum(RentalSettlementPayment.amount), 0)).where(
            RentalSettlementPayment.settlement_id == settlement_id
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class RentalSettlementAdjustmentRepository:
    """Append-only persistence for settlement adjustments."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: RentalSettlementAdjustment) -> RentalSettlementAdjustment:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def list_for_settlement(
        self,
        settlement_id: UUID,
    ) -> list[RentalSettlementAdjustment]:
        stmt = (
            select(RentalSettlementAdjustment)
            .where(RentalSettlementAdjustment.settlement_id == settlement_id)
            .order_by(asc(RentalSettlementAdjustment.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def sum_adjustments(self, settlement_id: UUID) -> int:
        stmt = select(
            func.coalesce(func.sum(RentalSettlementAdjustment.amount), 0)
        ).where(RentalSettlementAdjustment.settlement_id == settlement_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
