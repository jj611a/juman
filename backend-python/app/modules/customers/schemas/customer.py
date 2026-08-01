"""Customer request/response schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.customers.models.customer import Customer
from app.schemas.common import APIModel, PaginationMeta


class CustomerCreateRequest(APIModel):
    """Create customer payload (customer_number is server-generated)."""

    full_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=1, max_length=50)
    alternative_phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=2000)
    national_id: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=5000)
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    is_active: bool = True

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def _strip_required(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator(
        "alternative_phone",
        "address",
        "national_id",
        "notes",
        "gender",
        mode="before",
    )
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class CustomerUpdateRequest(APIModel):
    """Partial update payload (customer_number immutable — not accepted)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, min_length=1, max_length=50)
    alternative_phone: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=2000)
    national_id: str | None = Field(default=None, max_length=50)
    notes: str | None = Field(default=None, max_length=5000)
    gender: str | None = Field(default=None, max_length=20)
    birth_date: date | None = None
    clear_birth_date: bool = False
    is_active: bool | None = None

    @field_validator("full_name", "phone", mode="before")
    @classmethod
    def _strip_required(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator(
        "alternative_phone",
        "address",
        "national_id",
        "notes",
        "gender",
        mode="before",
    )
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class CustomerResponse(APIModel):
    """Customer API representation."""

    id: UUID
    customer_number: str
    full_name: str
    phone: str
    alternative_phone: str | None = None
    address: str | None = None
    national_id: str | None = None
    notes: str | None = None
    gender: str | None = None
    birth_date: date | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, customer: Customer) -> CustomerResponse:
        return cls(
            id=customer.id,
            customer_number=customer.customer_number,
            full_name=customer.full_name,
            phone=customer.phone,
            alternative_phone=customer.alternative_phone,
            address=customer.address,
            national_id=customer.national_id,
            notes=customer.notes,
            gender=customer.gender,
            birth_date=customer.birth_date,
            is_active=customer.is_active,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
        )


class CustomerListResponse(APIModel):
    """Paginated customer list."""

    success: bool = True
    data: list[CustomerResponse]
    meta: PaginationMeta


class CustomerItemResponse(APIModel):
    """Single customer envelope."""

    success: bool = True
    data: CustomerResponse


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
