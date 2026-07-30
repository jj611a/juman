"""Inspection request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.inspection.models.inspection import Inspection
from app.modules.inspection.models.inspection_item import InspectionItem
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class InspectionCreateRequest(APIModel):
    """Create a PENDING inspection scaffold for a return."""

    return_id: UUID
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class InspectionItemUpdateInput(APIModel):
    """Item payload for PATCH."""

    id: UUID
    condition: str
    repair_penalty_amount: int | None = Field(default=None, ge=0)
    repair_notes: str | None = Field(default=None, max_length=2000)
    requires_laundry: bool = False
    send_to_ruined: bool = False
    notes: str | None = Field(default=None, max_length=1000)

    @field_validator("condition", mode="before")
    @classmethod
    def _normalize_condition(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("repair_notes", "notes", mode="before")
    @classmethod
    def _strip_optional(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class InspectionUpdateRequest(APIModel):
    """Update PENDING inspection; optionally complete."""

    notes: str | None = Field(default=None, max_length=2000)
    clear_notes: bool = False
    items: list[InspectionItemUpdateInput] | None = None
    complete: bool = False

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class InspectionItemResponse(APIModel):
    id: UUID
    inspection_id: UUID
    return_item_id: UUID
    dress_id: UUID
    condition: str | None = None
    repair_penalty_amount: int | None = None
    repair_notes: str | None = None
    requires_laundry: bool
    send_to_ruined: bool
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, item: InspectionItem) -> InspectionItemResponse:
        return cls(
            id=item.id,
            inspection_id=item.inspection_id,
            return_item_id=item.return_item_id,
            dress_id=item.dress_id,
            condition=item.condition,
            repair_penalty_amount=item.repair_penalty_amount,
            repair_notes=item.repair_notes,
            requires_laundry=item.requires_laundry,
            send_to_ruined=item.send_to_ruined,
            notes=item.notes,
            created_at=ensure_utc(item.created_at),
            updated_at=ensure_utc(item.updated_at),
        )


class InspectionResponse(APIModel):
    id: UUID
    inspection_number: str
    return_id: UUID
    inspected_at: datetime | None = None
    inspected_by: UUID | None = None
    status: str
    notes: str | None = None
    items: list[InspectionItemResponse]
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, record: Inspection) -> InspectionResponse:
        live = [i for i in (record.items or []) if not i.is_deleted]
        return cls(
            id=record.id,
            inspection_number=record.inspection_number,
            return_id=record.return_id,
            inspected_at=ensure_utc(record.inspected_at) if record.inspected_at else None,
            inspected_by=record.inspected_by,
            status=record.status,
            notes=record.notes,
            items=[InspectionItemResponse.from_model(i) for i in live],
            created_at=ensure_utc(record.created_at),
            updated_at=ensure_utc(record.updated_at),
        )


class InspectionListResponse(APIModel):
    success: bool = True
    data: list[InspectionResponse]
    meta: PaginationMeta


class InspectionItemEnvelope(APIModel):
    success: bool = True
    data: InspectionResponse
