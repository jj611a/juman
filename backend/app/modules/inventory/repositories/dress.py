"""Dress repository — soft-delete-aware search queries."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.modules.categories.models.category import Category
from app.modules.inventory.constants import DressSortField
from app.modules.inventory.models.dress import Dress
from app.repositories.base import AsyncRepository


class DressRepository(AsyncRepository[Dress]):
    """Persistence helpers for dresses."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Dress)

    async def get_for_update(self, dress_id: UUID) -> Dress | None:
        """Lock the dress row for sale/status concurrency control."""
        stmt = (
            select(Dress)
            .where(
                Dress.id == dress_id,
                Dress.is_deleted.is_(False),
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_barcode(
        self,
        barcode: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = False,
    ) -> Dress | None:
        """Return a dress with the given barcode, if any."""
        stmt = self._base_query(include_deleted=include_deleted).where(Dress.barcode == barcode)
        if exclude_id is not None:
            stmt = stmt.where(Dress.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_by_category(self, category_id: UUID) -> int:
        """Count live dresses referencing a category."""
        stmt = (
            select(func.count())
            .select_from(Dress)
            .where(
                Dress.category_id == category_id,
                Dress.is_deleted.is_(False),
            )
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    def build_search_stmt(
        self,
        *,
        q: str | None = None,
        barcode: str | None = None,
        category_id: UUID | None = None,
        status: str | None = None,
        brand: str | None = None,
        size: str | None = None,
        colour: str | None = None,
        is_active: bool | None = None,
        purchase_price_min: int | None = None,
        purchase_price_max: int | None = None,
        rental_price_min: int | None = None,
        rental_price_max: int | None = None,
        sale_price_min: int | None = None,
        sale_price_max: int | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        updated_from: datetime | None = None,
        updated_to: datetime | None = None,
        sort_by: DressSortField | str | None = None,
    ) -> tuple[Select[tuple[Dress]], object | None]:
        """
        Build a composable filtered SELECT of live dresses (no ORDER/OFFSET/LIMIT).

        Joins ``categories`` when free-text ``q`` is set or sort is by category.
        Returns ``(stmt, category_alias_or_none)``.
        """
        sort_key = str(sort_by) if sort_by is not None else None
        need_category = (q is not None and bool(q.strip())) or (
            sort_key == DressSortField.CATEGORY.value
        )
        cat = aliased(Category) if need_category else None

        stmt = self._base_query()
        if cat is not None:
            stmt = stmt.join(cat, Dress.category_id == cat.id)

        if barcode is not None:
            value = barcode.strip()
            if value:
                stmt = stmt.where(Dress.barcode == value)
        if category_id is not None:
            stmt = stmt.where(Dress.category_id == category_id)
        if status is not None:
            stmt = stmt.where(Dress.status == status)
        if brand is not None and brand.strip():
            stmt = stmt.where(Dress.brand.ilike(f"%{brand.strip()}%"))
        if size is not None:
            stmt = stmt.where(Dress.size == size)
        if colour is not None:
            stmt = stmt.where(Dress.colour == colour)
        if is_active is not None:
            stmt = stmt.where(Dress.is_active.is_(is_active))
        if purchase_price_min is not None:
            stmt = stmt.where(Dress.purchase_price >= purchase_price_min)
        if purchase_price_max is not None:
            stmt = stmt.where(Dress.purchase_price <= purchase_price_max)
        if rental_price_min is not None:
            stmt = stmt.where(Dress.default_daily_rental_price >= rental_price_min)
        if rental_price_max is not None:
            stmt = stmt.where(Dress.default_daily_rental_price <= rental_price_max)
        if sale_price_min is not None:
            stmt = stmt.where(Dress.default_sale_price >= sale_price_min)
        if sale_price_max is not None:
            stmt = stmt.where(Dress.default_sale_price <= sale_price_max)
        if created_from is not None:
            stmt = stmt.where(Dress.created_at >= created_from)
        if created_to is not None:
            stmt = stmt.where(Dress.created_at <= created_to)
        if updated_from is not None:
            stmt = stmt.where(Dress.updated_at >= updated_from)
        if updated_to is not None:
            stmt = stmt.where(Dress.updated_at <= updated_to)

        if q is not None and q.strip():
            pattern = f"%{q.strip()}%"
            clauses = [
                Dress.name_ar.ilike(pattern),
                Dress.name_en.ilike(pattern),
                Dress.brand.ilike(pattern),
                Dress.description.ilike(pattern),
            ]
            if barcode is None or not barcode.strip():
                clauses.insert(0, Dress.barcode.ilike(pattern))
            if cat is not None:
                clauses.extend([cat.name_ar.ilike(pattern), cat.name_en.ilike(pattern)])
            stmt = stmt.where(or_(*clauses))

        return stmt, cat

    def _order_clause(
        self,
        *,
        sort_by: DressSortField | str,
        sort_dir: str,
        category_alias: object | None,
    ):
        field = str(sort_by)
        direction = desc if sort_dir.lower() == "desc" else asc
        if field == DressSortField.CATEGORY.value:
            if category_alias is None:
                raise ValueError("category join required for category sort")
            primary = direction(category_alias.name_ar)  # type: ignore[attr-defined]
        else:
            column = {
                DressSortField.BARCODE.value: Dress.barcode,
                DressSortField.NAME_AR.value: Dress.name_ar,
                DressSortField.PURCHASE_PRICE.value: Dress.purchase_price,
                DressSortField.DEFAULT_DAILY_RENTAL_PRICE.value: Dress.default_daily_rental_price,
                DressSortField.DEFAULT_SALE_PRICE.value: Dress.default_sale_price,
                DressSortField.CREATED_AT.value: Dress.created_at,
                DressSortField.UPDATED_AT.value: Dress.updated_at,
            }.get(field, Dress.created_at)
            primary = direction(column)
        return primary, asc(Dress.id)

    async def list_filtered(
        self,
        *,
        q: str | None = None,
        barcode: str | None = None,
        category_id: UUID | None = None,
        status: str | None = None,
        brand: str | None = None,
        size: str | None = None,
        colour: str | None = None,
        is_active: bool | None = None,
        purchase_price_min: int | None = None,
        purchase_price_max: int | None = None,
        rental_price_min: int | None = None,
        rental_price_max: int | None = None,
        sale_price_min: int | None = None,
        sale_price_max: int | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        updated_from: datetime | None = None,
        updated_to: datetime | None = None,
        sort_by: DressSortField | str = DressSortField.CREATED_AT,
        sort_dir: str = "desc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Dress]:
        """List live dresses with filters, sort, and pagination."""
        stmt, cat = self.build_search_stmt(
            q=q,
            barcode=barcode,
            category_id=category_id,
            status=status,
            brand=brand,
            size=size,
            colour=colour,
            is_active=is_active,
            purchase_price_min=purchase_price_min,
            purchase_price_max=purchase_price_max,
            rental_price_min=rental_price_min,
            rental_price_max=rental_price_max,
            sale_price_min=sale_price_min,
            sale_price_max=sale_price_max,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
            sort_by=sort_by,
        )
        order = self._order_clause(
            sort_by=sort_by,
            sort_dir=sort_dir,
            category_alias=cat,
        )
        stmt = stmt.order_by(*order).offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().unique().all())

    async def count_filtered(
        self,
        *,
        q: str | None = None,
        barcode: str | None = None,
        category_id: UUID | None = None,
        status: str | None = None,
        brand: str | None = None,
        size: str | None = None,
        colour: str | None = None,
        is_active: bool | None = None,
        purchase_price_min: int | None = None,
        purchase_price_max: int | None = None,
        rental_price_min: int | None = None,
        rental_price_max: int | None = None,
        sale_price_min: int | None = None,
        sale_price_max: int | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
        updated_from: datetime | None = None,
        updated_to: datetime | None = None,
        sort_by: DressSortField | str | None = None,
    ) -> int:
        """Count live dresses matching filters."""
        base, _ = self.build_search_stmt(
            q=q,
            barcode=barcode,
            category_id=category_id,
            status=status,
            brand=brand,
            size=size,
            colour=colour,
            is_active=is_active,
            purchase_price_min=purchase_price_min,
            purchase_price_max=purchase_price_max,
            rental_price_min=rental_price_min,
            rental_price_max=rental_price_max,
            sale_price_min=sale_price_min,
            sale_price_max=sale_price_max,
            created_from=created_from,
            created_to=created_to,
            updated_from=updated_from,
            updated_to=updated_to,
            sort_by=sort_by,
        )
        stmt = select(func.count()).select_from(base.subquery())
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
