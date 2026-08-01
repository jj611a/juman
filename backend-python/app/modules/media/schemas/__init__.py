"""Media request/response schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.modules.media.models.file_reference import FileReference
from app.modules.media.models.stored_file import StoredFile
from app.schemas.common import APIModel, PaginationMeta


class StoredFileResponse(APIModel):
    """Public stored-file metadata (no storage root)."""

    id: UUID
    original_filename: str
    stored_filename: str
    extension: str
    mime_type: str
    size_bytes: int
    sha256_hash: str
    storage_provider: str
    relative_path: str
    is_public: bool
    uploaded_by: UUID | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, entity: StoredFile) -> StoredFileResponse:
        return cls(
            id=entity.id,
            original_filename=entity.original_filename,
            stored_filename=entity.stored_filename,
            extension=entity.extension,
            mime_type=entity.mime_type,
            size_bytes=entity.size_bytes,
            sha256_hash=entity.sha256_hash,
            storage_provider=entity.storage_provider,
            relative_path=entity.relative_path,
            is_public=entity.is_public,
            uploaded_by=entity.uploaded_by,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )


class StoredFileItemResponse(APIModel):
    """Single stored-file envelope."""

    success: bool = True
    data: StoredFileResponse


class FileReferenceCreateRequest(APIModel):
    """Create an opaque file reference."""

    stored_file_id: UUID
    module_name: str = Field(min_length=1, max_length=100)
    entity_type: str = Field(min_length=1, max_length=100)
    entity_id: UUID
    purpose: str = Field(min_length=1, max_length=100)
    display_order: int = 0
    is_primary: bool = False


class FileReferenceUpdateRequest(APIModel):
    """Patch mutable reference fields."""

    purpose: str | None = Field(default=None, min_length=1, max_length=100)
    display_order: int | None = None
    is_primary: bool | None = None


class FileReferenceResponse(APIModel):
    """Public file-reference representation."""

    id: UUID
    stored_file_id: UUID
    module_name: str
    entity_type: str
    entity_id: UUID
    purpose: str
    display_order: int
    is_primary: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, entity: FileReference) -> FileReferenceResponse:
        return cls(
            id=entity.id,
            stored_file_id=entity.stored_file_id,
            module_name=entity.module_name,
            entity_type=entity.entity_type,
            entity_id=entity.entity_id,
            purpose=entity.purpose,
            display_order=entity.display_order,
            is_primary=entity.is_primary,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )


class FileReferenceItemResponse(APIModel):
    """Single reference envelope."""

    success: bool = True
    data: FileReferenceResponse


class FileReferenceListResponse(APIModel):
    """Paginated reference list envelope."""

    success: bool = True
    data: list[FileReferenceResponse]
    meta: PaginationMeta


class MessageOnlyResponse(APIModel):
    """Simple success message."""

    success: bool = True
    message: str
