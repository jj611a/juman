"""Customer repository — soft-delete-aware queries."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.customers.constants import CustomerSortField
from app.modules.customers.models.customer import Customer
from app.repositories.base import AsyncRepository


class CustomerRepository(AsyncRepository[Customer]):
    """Persistence helpers for customers."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Customer)

    async def get_by_customer_number(
        self,
        customer_number: str,
        *,
        exclude_id: UUID | None = None,
        include_deleted: bool = False,
    ) -> Customer | None:
        """Return a customer with the given number, if any."""
        stmt = self._base_query(include_deleted=include_deleted).where(
            Customer.customer_number == customer_number
        )
        if exclude_id is not None:
            stmt = stmt.where(Customer.id != exclude_id)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    def _filter_query(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
    ) -> Select[tuple[Customer]]:
        stmt = self._base_query()
        if active_only:
            stmt = stmt.where(Customer.is_active.is_(True))
        if q:
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Customer.customer_number.ilike(pattern),
                    Customer.full_name.ilike(pattern),
                    Customer.phone.ilike(pattern),
                    Customer.alternative_phone.ilike(pattern),
                    Customer.national_id.ilike(pattern),
                )
            )
        return stmt

    def _order_clause(
        self,
        *,
        sort_by: CustomerSortField | str,
        sort_dir: str,
    ):
        field = str(sort_by)
        column = {
            CustomerSortField.CUSTOMER_NUMBER.value: Customer.customer_number,
            CustomerSortField.FULL_NAME.value: Customer.full_name,
            CustomerSortField.PHONE.value: Customer.phone,
            CustomerSortField.CREATED_AT.value: Customer.created_at,
        }.get(field, Customer.full_name)
        direction = desc if sort_dir.lower() == "desc" else asc
        primary = direction(column)
        if column is Customer.full_name:
            return primary, asc(Customer.created_at)
        return primary, asc(Customer.full_name)

    async def list_filtered(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
        sort_by: CustomerSortField | str = CustomerSortField.FULL_NAME,
        sort_dir: str = "asc",
        offset: int = 0,
        limit: int = 50,
    ) -> list[Customer]:
        """List live customers with search, sort, and pagination."""
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
        """Count live customers matching filters."""
        base = self._filter_query(active_only=active_only, q=q).subquery()
        stmt = select(func.count()).select_from(base)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())
