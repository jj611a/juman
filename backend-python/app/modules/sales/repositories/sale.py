"""Sale repositories."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.sales.models.item import SaleItem
from app.modules.sales.models.payment import SalePayment
from app.modules.sales.models.sale import Sale
from app.repositories.base import AsyncRepository


class SaleRepository(AsyncRepository[Sale]):
    """Persistence helpers for sales."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Sale)

    async def get_by_id(
        self,
        entity_id: UUID,
        *,
        include_deleted: bool = False,
    ) -> Sale | None:
        stmt = (
            self._base_query(include_deleted=include_deleted)
            .options(
                selectinload(Sale.items),
                selectinload(Sale.payments),
            )
            .where(Sale.id == entity_id)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_sale_number(
        self,
        sale_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = True,
    ) -> Sale | None:
        stmt = self._base_query(include_deleted=include_deleted).where(
            Sale.sale_number == sale_number
        )
        if exclude_id is not None:
            stmt = stmt.where(Sale.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_filtered(
        self,
        *,
        status: str | None = None,
        origin: str | None = None,
        customer_id: UUID | None = None,
        sort_by: str = "created_at",
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Sale]:
        stmt = self._base_query().options(
            selectinload(Sale.items),
            selectinload(Sale.payments),
        )
        if status is not None:
            stmt = stmt.where(Sale.status == status)
        if origin is not None:
            stmt = stmt.where(Sale.origin == origin)
        if customer_id is not None:
            stmt = stmt.where(Sale.customer_id == customer_id)
        column = getattr(Sale, sort_by, Sale.created_at)
        order = asc(column) if sort_dir == "asc" else desc(column)
        stmt = stmt.order_by(order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        status: str | None = None,
        origin: str | None = None,
        customer_id: UUID | None = None,
    ) -> int:
        stmt = select(func.count()).select_from(Sale).where(Sale.is_deleted.is_(False))
        if status is not None:
            stmt = stmt.where(Sale.status == status)
        if origin is not None:
            stmt = stmt.where(Sale.origin == origin)
        if customer_id is not None:
            stmt = stmt.where(Sale.customer_id == customer_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class SaleItemRepository:
    """Append-only persistence for sale line items."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: SaleItem) -> SaleItem:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def get_by_inspection_item_id(
        self,
        inspection_item_id: UUID,
    ) -> SaleItem | None:
        stmt = select(SaleItem).where(SaleItem.inspection_item_id == inspection_item_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_sale(self, sale_id: UUID) -> list[SaleItem]:
        stmt = (
            select(SaleItem)
            .where(SaleItem.sale_id == sale_id)
            .order_by(asc(SaleItem.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class SalePaymentRepository:
    """Append-only persistence for sale payments."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def add(self, entity: SalePayment) -> SalePayment:
        self.session.add(entity)
        await self.session.flush()
        await self.session.refresh(entity)
        return entity

    async def list_for_sale(self, sale_id: UUID) -> list[SalePayment]:
        stmt = (
            select(SalePayment)
            .where(SalePayment.sale_id == sale_id)
            .order_by(asc(SalePayment.created_at))
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
