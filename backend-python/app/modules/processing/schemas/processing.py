"""Processing request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.processing.models.processing_batch import ProcessingBatch
from app.modules.processing.models.processing_item import ProcessingItem
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class ProcessingCreateRequest(APIModel):
    """Create a PENDING processing batch from inspection items."""

    inspection_item_ids: list[UUID] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=2000)
    enable_optional_day: bool = False

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProcessingUpdateRequest(APIModel):
    """Update notes on a PENDING / IN_PROCESS batch."""

    notes: str | None = Field(default=None, max_length=2000)
    clear_notes: bool = False

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class ProcessingStartRequest(APIModel):
    """Start a PENDING batch; optionally enable the second day."""

    enable_optional_day: bool | None = None


class ProcessingItemResponse(APIModel):
    id: UUID
    processing_batch_id: UUID
    dress_id: UUID
    inspection_item_id: UUID
    return_item_id: UUID
    rental_item_id: UUID
    calendar_block_id: UUID | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, item: ProcessingItem) -> ProcessingItemResponse:
        return cls(
            id=item.id,
            processing_batch_id=item.processing_batch_id,
            dress_id=item.dress_id,
            inspection_item_id=item.inspection_item_id,
            return_item_id=item.return_item_id,
            rental_item_id=item.rental_item_id,
            calendar_block_id=item.calendar_block_id,
            status=item.status,
            notes=item.notes,
            created_at=ensure_utc(item.created_at),
            updated_at=ensure_utc(item.updated_at),
        )


class ProcessingResponse(APIModel):
    id: UUID
    processing_number: str
    status: str
    started_at: datetime | None = None
    mandatory_processing_end_at: datetime | None = None
    optional_extra_day_enabled: bool
    final_processing_end_at: datetime | None = None
    completed_at: datetime | None = None
    started_by: UUID | None = None
    completed_by: UUID | None = None
    notes: str | None = None
    items: list[ProcessingItemResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, record: ProcessingBatch) -> ProcessingResponse:
        live = [i for i in (record.items or []) if not i.is_deleted]
        return cls(
            id=record.id,
            processing_number=record.processing_number,
            status=record.status,
            started_at=ensure_utc(record.started_at) if record.started_at else None,
            mandatory_processing_end_at=(
                ensure_utc(record.mandatory_processing_end_at)
                if record.mandatory_processing_end_at
                else None
            ),
            optional_extra_day_enabled=record.optional_extra_day_enabled,
            final_processing_end_at=(
                ensure_utc(record.final_processing_end_at)
                if record.final_processing_end_at
                else None
            ),
            completed_at=ensure_utc(record.completed_at) if record.completed_at else None,
            started_by=record.started_by,
            completed_by=record.completed_by,
            notes=record.notes,
            items=[ProcessingItemResponse.from_model(i) for i in live],
            created_at=ensure_utc(record.created_at),
            updated_at=ensure_utc(record.updated_at),
        )


class ProcessingListResponse(APIModel):
    success: bool = True
    data: list[ProcessingResponse]
    meta: PaginationMeta


class ProcessingItemEnvelope(APIModel):
    success: bool = True
    data: ProcessingResponse
