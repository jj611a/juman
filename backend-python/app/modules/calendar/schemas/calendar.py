"""Calendar request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.calendar.models.dress_calendar_block import DressCalendarBlock
from app.schemas.common import APIModel
from app.utils.datetime import ensure_utc


class CalendarBlockCreateRequest(APIModel):
    """Create a busy calendar block."""

    dress_id: UUID
    block_type: str = Field(min_length=1, max_length=32)
    start_at: datetime
    end_at: datetime
    reference_module: str | None = Field(default=None, max_length=50)
    reference_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("block_type", mode="before")
    @classmethod
    def _upper_type(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("reference_module", "notes", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class CalendarBlockUpdateRequest(APIModel):
    """Move / patch a calendar block."""

    start_at: datetime | None = None
    end_at: datetime | None = None
    block_type: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=1000)
    clear_notes: bool = False

    @field_validator("block_type", mode="before")
    @classmethod
    def _upper_type(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class CalendarBlockResponse(APIModel):
    """Calendar block API representation."""

    id: UUID
    dress_id: UUID
    block_type: str
    reference_module: str | None = None
    reference_id: UUID | None = None
    start_at: datetime
    end_at: datetime
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, block: DressCalendarBlock) -> CalendarBlockResponse:
        return cls(
            id=block.id,
            dress_id=block.dress_id,
            block_type=block.block_type,
            reference_module=block.reference_module,
            reference_id=block.reference_id,
            start_at=ensure_utc(block.start_at),
            end_at=ensure_utc(block.end_at),
            notes=block.notes,
            created_at=ensure_utc(block.created_at),
            updated_at=ensure_utc(block.updated_at),
        )


class CalendarConflictItem(APIModel):
    """One overlap conflict."""

    block_id: UUID
    block_type: str
    start_at: datetime
    end_at: datetime
    reference_module: str | None = None
    reference_id: UUID | None = None
    conflict_kind: str = "overlap"


class CalendarBlockListResponse(APIModel):
    """Timeline list envelope."""

    success: bool = True
    data: list[CalendarBlockResponse]


class CalendarBlockItemResponse(APIModel):
    """Single block envelope."""

    success: bool = True
    data: CalendarBlockResponse


class AvailabilityData(APIModel):
    """Availability payload."""

    dress_id: UUID
    start_at: datetime
    end_at: datetime
    available: bool


class AvailabilityResponse(APIModel):
    """Interval availability result."""

    success: bool = True
    data: AvailabilityData


class NextAvailableData(APIModel):
    """Next free slot payload."""

    dress_id: UUID
    after: datetime
    duration_seconds: int
    next_available_start: datetime | None = None


class NextAvailableResponse(APIModel):
    """Next-available envelope."""

    success: bool = True
    data: NextAvailableData


class ConflictsData(APIModel):
    """Conflicts payload."""

    dress_id: UUID
    start_at: datetime
    end_at: datetime
    conflicts: list[CalendarConflictItem]


class ConflictsResponse(APIModel):
    """Conflicts envelope."""

    success: bool = True
    data: ConflictsData


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
