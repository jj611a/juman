"""Dress photo request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.inventory.models.dress_photo import DressPhoto
from app.modules.media.models.stored_file import StoredFile
from app.schemas.common import APIModel


class DressPhotoCreateRequest(APIModel):
    """Attach an existing Media file to a dress."""

    stored_file_id: UUID
    caption: str | None = Field(default=None, max_length=500)
    is_cover: bool = False
    display_order: int | None = Field(default=None, ge=0)

    @field_validator("caption", mode="before")
    @classmethod
    def _strip_caption(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DressPhotoUpdateRequest(APIModel):
    """Partial update for a dress photo."""

    caption: str | None = Field(default=None, max_length=500)
    clear_caption: bool = False
    display_order: int | None = Field(default=None, ge=0)
    is_cover: bool | None = None

    @field_validator("caption", mode="before")
    @classmethod
    def _strip_caption(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class DressPhotoReorderRequest(APIModel):
    """Exact ordered list of live photo ids for a dress."""

    photo_ids: list[UUID] = Field(min_length=0)


class DressPhotoCoverRequest(APIModel):
    """Set cover photo for a dress."""

    photo_id: UUID


class StoredFileMeta(APIModel):
    """Minimal Media metadata for gallery UI (no bytes)."""

    id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int

    @classmethod
    def from_model(cls, stored: StoredFile) -> StoredFileMeta:
        return cls(
            id=stored.id,
            original_filename=stored.original_filename,
            mime_type=stored.mime_type,
            size_bytes=stored.size_bytes,
        )


class DressPhotoResponse(APIModel):
    """Dress photo API representation."""

    id: UUID
    dress_id: UUID
    stored_file_id: UUID
    display_order: int
    is_cover: bool
    caption: str | None = None
    file: StoredFileMeta | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, photo: DressPhoto) -> DressPhotoResponse:
        file_meta = None
        stored = getattr(photo, "stored_file", None)
        if stored is not None and not getattr(stored, "is_deleted", False):
            file_meta = StoredFileMeta.from_model(stored)
        return cls(
            id=photo.id,
            dress_id=photo.dress_id,
            stored_file_id=photo.stored_file_id,
            display_order=photo.display_order,
            is_cover=photo.is_cover,
            caption=photo.caption,
            file=file_meta,
            created_at=photo.created_at,
            updated_at=photo.updated_at,
        )


class DressPhotoListResponse(APIModel):
    """Photo list envelope."""

    success: bool = True
    data: list[DressPhotoResponse]


class DressPhotoItemResponse(APIModel):
    """Single photo envelope."""

    success: bool = True
    data: DressPhotoResponse


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
