"""Return request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.returns.models.return_item import ReturnItem
from app.modules.returns.models.return_record import Return
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class ReturnCreateRequest(APIModel):
    """Create a full return for an ACTIVE rental."""

    rental_id: UUID
    customer_id: UUID | None = None
    returned_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ReturnItemResponse(APIModel):
    """Return line response."""

    id: UUID
    return_id: UUID
    rental_item_id: UUID
    dress_id: UUID
    returned_at: datetime
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, item: ReturnItem) -> ReturnItemResponse:
        return cls(
            id=item.id,
            return_id=item.return_id,
            rental_item_id=item.rental_item_id,
            dress_id=item.dress_id,
            returned_at=ensure_utc(item.returned_at),
            notes=item.notes,
            created_at=ensure_utc(item.created_at),
            updated_at=ensure_utc(item.updated_at),
        )


class ReturnResponse(APIModel):
    """Return header + live items."""

    id: UUID
    return_number: str
    rental_id: UUID
    customer_id: UUID
    returned_at: datetime
    status: str
    returned_by: UUID | None = None
    notes: str | None = None
    items: list[ReturnItemResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, record: Return) -> ReturnResponse:
        live = [i for i in (record.items or []) if not i.is_deleted]
        return cls(
            id=record.id,
            return_number=record.return_number,
            rental_id=record.rental_id,
            customer_id=record.customer_id,
            returned_at=ensure_utc(record.returned_at),
            status=record.status,
            returned_by=record.returned_by,
            notes=record.notes,
            items=[ReturnItemResponse.from_model(i) for i in live],
            created_at=ensure_utc(record.created_at),
            updated_at=ensure_utc(record.updated_at),
        )


class ReturnListResponse(APIModel):
    success: bool = True
    data: list[ReturnResponse]
    meta: PaginationMeta


class ReturnItemEnvelope(APIModel):
    success: bool = True
    data: ReturnResponse
