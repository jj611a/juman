"""Rental request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.rentals.models.rental import Rental
from app.modules.rentals.models.rental_item import RentalItem
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class RentalItemInput(APIModel):
    """Item payload for walk-in create."""

    dress_id: UUID
    agreed_daily_rental_price: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class RentalCreateRequest(APIModel):
    """Create an Active rental (walk-in or from confirmed reservation)."""

    customer_id: UUID
    expected_return_at: datetime
    initial_payment_type: str
    rental_at: datetime | None = None
    reservation_id: UUID | None = None
    initial_payment_value: int | None = Field(default=None, ge=0)
    initial_payment_rate: int | None = Field(default=None, ge=1, le=100)
    notes: str | None = Field(default=None, max_length=2000)
    items: list[RentalItemInput] | None = None

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("initial_payment_type", mode="before")
    @classmethod
    def _normalize_payment_type(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value


class RentalUpdateRequest(APIModel):
    """Patch notes on an Active rental."""

    notes: str | None = Field(default=None, max_length=2000)
    clear_notes: bool = False

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class RentalItemResponse(APIModel):
    """Rental line response."""

    id: UUID
    rental_id: UUID
    dress_id: UUID
    agreed_daily_rental_price: int
    expected_rental_days: int
    notes: str | None = None
    calendar_block_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, item: RentalItem) -> RentalItemResponse:
        return cls(
            id=item.id,
            rental_id=item.rental_id,
            dress_id=item.dress_id,
            agreed_daily_rental_price=item.agreed_daily_rental_price,
            expected_rental_days=item.expected_rental_days,
            notes=item.notes,
            calendar_block_id=item.calendar_block_id,
            created_at=ensure_utc(item.created_at),
            updated_at=ensure_utc(item.updated_at),
        )


class RentalResponse(APIModel):
    """Rental header + live items."""

    id: UUID
    rental_number: str
    customer_id: UUID
    reservation_id: UUID | None = None
    rental_at: datetime
    expected_return_at: datetime
    status: str
    initial_payment_type: str
    initial_payment_rate: int | None = None
    initial_payment_value: int
    estimated_total: int
    remaining_balance: int  # derived: estimated_total - initial_payment_value
    notes: str | None = None
    items: list[RentalItemResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, rental: Rental) -> RentalResponse:
        live = [i for i in (rental.items or []) if not i.is_deleted]
        return cls(
            id=rental.id,
            rental_number=rental.rental_number,
            customer_id=rental.customer_id,
            reservation_id=rental.reservation_id,
            rental_at=ensure_utc(rental.rental_at),
            expected_return_at=ensure_utc(rental.expected_return_at),
            status=rental.status,
            initial_payment_type=rental.initial_payment_type,
            initial_payment_rate=rental.initial_payment_rate,
            initial_payment_value=rental.initial_payment_value,
            estimated_total=rental.estimated_total,
            remaining_balance=int(rental.estimated_total) - int(rental.initial_payment_value),
            notes=rental.notes,
            items=[RentalItemResponse.from_model(i) for i in live],
            created_at=ensure_utc(rental.created_at),
            updated_at=ensure_utc(rental.updated_at),
        )


class RentalListResponse(APIModel):
    success: bool = True
    data: list[RentalResponse]
    meta: PaginationMeta


class RentalItemEnvelope(APIModel):
    success: bool = True
    data: RentalResponse
