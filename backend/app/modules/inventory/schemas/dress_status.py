"""Dress status change request/response schemas."""

from __future__ import annotations

from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import APIModel


class DressStatusChangeRequest(APIModel):
    """Request a status transition via the Status Engine."""

    new_status: str = Field(min_length=1, max_length=32)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("new_status", mode="before")
    @classmethod
    def _strip_status(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("reason", mode="before")
    @classmethod
    def _strip_reason(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DressStatusChangeData(APIModel):
    """Status transition result payload."""

    dress_id: UUID
    previous_status: str
    new_status: str
    allowed_transitions: list[str]
    reason: str | None = None


class DressStatusChangeResponse(APIModel):
    """Envelope for status change."""

    success: bool = True
    data: DressStatusChangeData
