"""CustomerService — CRUD and activation for store customers."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import NotFoundError, ValidationError
from app.modules.audit.constants import AuditAction
from app.modules.audit.services.audit_log import AuditService
from app.modules.customers.constants import CustomerSortField
from app.modules.customers.models.customer import Customer
from app.modules.customers.repositories.customer import CustomerRepository
from app.modules.customers.services.customer_number import CustomerNumberService
from app.modules.customers.validators import (
    normalize_optional_text,
    validate_birth_date,
    validate_full_name,
    validate_gender,
    validate_national_id,
    validate_optional_phone,
    validate_required_phone,
)
from app.modules.settings.services.setting import SettingService
from app.services.base import BaseService
from app.utils.datetime import utc_now


def _snapshot(customer: Customer) -> dict[str, Any]:
    return {
        "customer_number": customer.customer_number,
        "full_name": customer.full_name,
        "phone": customer.phone,
        "alternative_phone": customer.alternative_phone,
        "address": customer.address,
        "national_id": customer.national_id,
        "notes": customer.notes,
        "gender": customer.gender,
        "birth_date": customer.birth_date.isoformat() if customer.birth_date else None,
        "is_active": customer.is_active,
    }


class CustomerService(BaseService):
    """Manage customer contact records (no rental/reservation logic)."""

    def __init__(
        self,
        session: AsyncSession,
        *,
        repository: CustomerRepository | None = None,
        numbers: CustomerNumberService | None = None,
        settings: SettingService | None = None,
        audit: AuditService | None = None,
    ) -> None:
        super().__init__(session)
        self.customers = repository or CustomerRepository(session)
        self.settings = settings or SettingService(session)
        self.numbers = numbers or CustomerNumberService(
            session,
            settings=self.settings,
            customers=self.customers,
        )
        self.audit = audit or AuditService(session)

    async def get_customer(self, customer_id: UUID) -> Customer:
        """Return a live customer or raise NotFoundError."""
        customer = await self.customers.get_by_id(customer_id)
        if customer is None:
            raise NotFoundError("العميل غير موجود")
        return customer

    async def get_customer_by_number(self, customer_number: str) -> Customer:
        """Return a live customer by exact customer number."""
        value = customer_number.strip()
        if not value:
            raise ValidationError("رقم العميل مطلوب", details={"field": "customer_number"})
        customer = await self.customers.get_by_customer_number(value, include_deleted=False)
        if customer is None:
            raise NotFoundError("العميل غير موجود")
        return customer

    async def list_customers(
        self,
        *,
        active_only: bool = False,
        q: str | None = None,
        sort_by: CustomerSortField | str = CustomerSortField.FULL_NAME,
        sort_dir: str = "asc",
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Customer], int]:
        """List customers with search, sort, and pagination."""
        allowed = {field.value for field in CustomerSortField}
        sort_key = str(sort_by)
        if sort_key not in allowed:
            raise ValidationError(
                "حقل الترتيب غير صالح",
                details={"sort_by": sort_key, "allowed": sorted(allowed)},
            )
        direction = sort_dir.lower()
        if direction not in {"asc", "desc"}:
            raise ValidationError(
                "اتجاه الترتيب غير صالح",
                details={"sort_dir": sort_dir},
            )
        items = await self.customers.list_filtered(
            active_only=active_only,
            q=q,
            sort_by=sort_key,
            sort_dir=direction,
            offset=offset,
            limit=limit,
        )
        total = await self.customers.count_filtered(active_only=active_only, q=q)
        return items, total

    async def create_customer(
        self,
        *,
        full_name: str,
        phone: str,
        address: str | None = None,
        national_id: str | None = None,
        notes: str | None = None,
        alternative_phone: str | None = None,
        gender: str | None = None,
        birth_date: date | None = None,
        is_active: bool = True,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Customer:
        """Create a customer with an auto-generated immutable customer number."""
        customer_number = await self.numbers.generate_next()
        customer = Customer(
            customer_number=customer_number,
            full_name=validate_full_name(full_name),
            phone=validate_required_phone(phone),
            alternative_phone=validate_optional_phone(alternative_phone),
            address=normalize_optional_text(address, max_length=2000),
            national_id=validate_national_id(national_id),
            notes=normalize_optional_text(notes, max_length=5000),
            gender=validate_gender(gender),
            birth_date=validate_birth_date(birth_date),
            is_active=is_active,
            created_by=actor_id,
            updated_by=actor_id,
        )
        customer = await self.customers.add(customer)
        await self.audit.record_create(
            module="customers",
            entity_type="Customer",
            entity_id=customer.id,
            new_values=_snapshot(customer),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return customer

    async def update_customer(
        self,
        customer_id: UUID,
        *,
        full_name: str | None = None,
        phone: str | None = None,
        address: str | None = None,
        national_id: str | None = None,
        notes: str | None = None,
        alternative_phone: str | None = None,
        gender: str | None = None,
        birth_date: date | None = None,
        clear_birth_date: bool = False,
        is_active: bool | None = None,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Customer:
        """Update mutable customer fields (customer_number is immutable)."""
        customer = await self.get_customer(customer_id)
        old_values = _snapshot(customer)

        fields: dict[str, object] = {
            "updated_by": actor_id,
            "updated_at": utc_now(),
        }
        if full_name is not None:
            fields["full_name"] = validate_full_name(full_name)
        if phone is not None:
            fields["phone"] = validate_required_phone(phone)
        if alternative_phone is not None:
            fields["alternative_phone"] = validate_optional_phone(alternative_phone)
        if address is not None:
            fields["address"] = normalize_optional_text(address, max_length=2000)
        if national_id is not None:
            fields["national_id"] = validate_national_id(national_id)
        if notes is not None:
            fields["notes"] = normalize_optional_text(notes, max_length=5000)
        if gender is not None:
            fields["gender"] = validate_gender(gender)
        if clear_birth_date:
            fields["birth_date"] = None
        elif birth_date is not None:
            fields["birth_date"] = validate_birth_date(birth_date)
        if is_active is not None:
            fields["is_active"] = is_active

        customer = await self.customers.update_fields(customer, **fields)
        await self.audit.record_update(
            module="customers",
            entity_type="Customer",
            entity_id=customer.id,
            old_values=old_values,
            new_values=_snapshot(customer),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return customer

    async def activate(
        self,
        customer_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Customer:
        """Set is_active=true."""
        customer = await self.get_customer(customer_id)
        old_values = _snapshot(customer)
        customer = await self.customers.update_fields(
            customer,
            is_active=True,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="customers",
            entity_type="Customer",
            entity_id=customer.id,
            action=AuditAction.ACTIVATE,
            old_values=old_values,
            new_values=_snapshot(customer),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return customer

    async def deactivate(
        self,
        customer_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> Customer:
        """Set is_active=false."""
        customer = await self.get_customer(customer_id)
        old_values = _snapshot(customer)
        customer = await self.customers.update_fields(
            customer,
            is_active=False,
            updated_by=actor_id,
            updated_at=utc_now(),
        )
        await self.audit.record(
            module="customers",
            entity_type="Customer",
            entity_id=customer.id,
            action=AuditAction.DEACTIVATE,
            old_values=old_values,
            new_values=_snapshot(customer),
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
        )
        return customer

    async def soft_delete(
        self,
        customer_id: UUID,
        *,
        actor_id: UUID | None = None,
        actor_username: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Soft-delete a customer (number remains reserved historically)."""
        customer = await self.get_customer(customer_id)
        old_values = _snapshot(customer)
        await self.customers.delete(customer, deleted_by=actor_id)
        await self.audit.record_delete(
            module="customers",
            entity_type="Customer",
            entity_id=customer_id,
            old_values=old_values,
            user_id=actor_id,
            username=actor_username,
            ip_address=ip_address,
            soft=True,
        )
