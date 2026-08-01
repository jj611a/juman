"""Reservation request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.reservations.models.reservation import Reservation
from app.modules.reservations.models.reservation_item import ReservationItem
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class ReservationItemInput(APIModel):
    """Item payload for create/update."""

    dress_id: UUID
    reserved_daily_rental_price: int | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ReservationCreateRequest(APIModel):
    """Create a Draft reservation."""

    customer_id: UUID
    rental_start_at: datetime
    expected_return_at: datetime
    reservation_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)
    items: list[ReservationItemInput] = Field(min_length=1)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ReservationUpdateRequest(APIModel):
    """Patch a Draft reservation."""

    customer_id: UUID | None = None
    reservation_at: datetime | None = None
    rental_start_at: datetime | None = None
    expected_return_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)
    clear_notes: bool = False
    items: list[ReservationItemInput] | None = Field(default=None, min_length=1)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ReservationItemResponse(APIModel):
    """Reservation line response."""

    id: UUID
    reservation_id: UUID
    dress_id: UUID
    reserved_daily_rental_price: int
    notes: str | None = None
    calendar_block_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, item: ReservationItem) -> ReservationItemResponse:
        return cls(
            id=item.id,
            reservation_id=item.reservation_id,
            dress_id=item.dress_id,
            reserved_daily_rental_price=item.reserved_daily_rental_price,
            notes=item.notes,
            calendar_block_id=item.calendar_block_id,
            created_at=ensure_utc(item.created_at),
            updated_at=ensure_utc(item.updated_at),
        )


class ReservationResponse(APIModel):
    """Reservation header + live items."""

    id: UUID
    reservation_number: str
    customer_id: UUID
    reservation_at: datetime
    rental_start_at: datetime
    expected_return_at: datetime
    status: str
    notes: str | None = None
    items: list[ReservationItemResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, reservation: Reservation) -> ReservationResponse:
        live = [i for i in (reservation.items or []) if not i.is_deleted]
        return cls(
            id=reservation.id,
            reservation_number=reservation.reservation_number,
            customer_id=reservation.customer_id,
            reservation_at=ensure_utc(reservation.reservation_at),
            rental_start_at=ensure_utc(reservation.rental_start_at),
            expected_return_at=ensure_utc(reservation.expected_return_at),
            status=reservation.status,
            notes=reservation.notes,
            items=[ReservationItemResponse.from_model(i) for i in live],
            created_at=ensure_utc(reservation.created_at),
            updated_at=ensure_utc(reservation.updated_at),
        )


class ReservationListResponse(APIModel):
    success: bool = True
    data: list[ReservationResponse]
    meta: PaginationMeta


class ReservationItemEnvelope(APIModel):
    success: bool = True
    data: ReservationResponse


class MessageOnlyResponse(APIModel):
    success: bool = True
    message: str
