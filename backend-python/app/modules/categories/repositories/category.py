"""Category repository — soft-delete-aware queries."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.categories.constants import CategorySortField
from app.modules.categories.models.category import Category
from app.repositories.base import AsyncRepository


class CategoryRepository(AsyncRepository[Category]):
    """Persistence helpers for categories."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Category)

    async def get_by_name_ar(
        self,
        name_ar: str,
        *,
        exclude_id: UUID | None = None,
    ) -> Category | None:
        """Return a live category with the given Arabic name, if any."""
        stmt = self._base_query().where(Category.name_ar == name_ar)
        if exclude_id is not None:
            stmt = stmt.where(Category.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _filter_query(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
    ) -> Select[tuple[Category]]:
        stmt = self._base_query()
        if active_only:
            stmt = stmt.where(Category.is_active.is_(True))
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Category.name_ar.ilike(pattern),
                    Category.name_en.ilike(pattern),
                    Category.description.ilike(pattern),
                )
            )
        return stmt

    def _order_clause(
        self,
        *,
        sort_by: CategorySortField | str,
        sort_dir: str,
    ):
        field = str(sort_by)
        column = {
            CategorySortField.DISPLAY_ORDER.value: Category.display_order,
            CategorySortField.NAME_AR.value: Category.name_ar,
            CategorySortField.NAME_EN.value: Category.name_en,
            CategorySortField.CREATED_AT.value: Category.created_at,
            CategorySortField.IS_ACTIVE.value: Category.is_active,
        }.get(field, Category.display_order)
        direction = desc if sort_dir.lower() == "desc" else asc
        primary = direction(column)
        # Stable secondary sort.
        if column is Category.display_order:
            return primary, asc(Category.name_ar)
        return primary, asc(Category.display_order)

    async def list_filtered(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
        sort_by: CategorySortField | str = CategorySortField.DISPLAY_ORDER,
        sort_dir: str = "asc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Category]:
        """List live categories with filters, sort, and pagination."""
        order = self._order_clause(sort_by=sort_by, sort_dir=sort_dir)
        stmt = (
            self._filter_query(active_only=active_only, q=q)
            .order_by(*order)
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_filtered(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
    ) -> int:
        """Count live categories matching filters."""
        base = self._filter_query(active_only=active_only, q=q).subquery()
        stmt = select(func.count()).select_from(base)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
