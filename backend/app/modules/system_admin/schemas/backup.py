"""Backup API schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.system_admin.models.backup import SystemBackup
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class BackupCreateRequest(APIModel):
    include_media: bool | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value


class BackupResponse(APIModel):
    id: UUID
    filename: str
    storage_path: str
    status: str
    checksum_sha256: str | None
    compressed_size_bytes: int | None
    format_version: int
    include_media: bool
    app_version: str | None
    alembic_revision: str | None
    created_by_user_id: UUID | None
    notes: str | None
    error_message: str | None
    audit_log_id: UUID | None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    duration_ms: int | None = None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, entity: SystemBackup) -> BackupResponse:
        return cls(
            id=entity.id,
            filename=entity.filename,
            storage_path=entity.storage_path,
            status=entity.status,
            checksum_sha256=entity.checksum_sha256,
            compressed_size_bytes=entity.compressed_size_bytes,
            format_version=entity.format_version,
            include_media=entity.include_media,
            app_version=entity.app_version,
            alembic_revision=entity.alembic_revision,
            created_by_user_id=entity.created_by_user_id,
            notes=entity.notes,
            error_message=entity.error_message,
            audit_log_id=entity.audit_log_id,
            started_at=ensure_utc(entity.started_at) if entity.started_at else None,
            finished_at=ensure_utc(entity.finished_at) if entity.finished_at else None,
            duration_ms=entity.duration_ms,
            created_at=ensure_utc(entity.created_at),
            updated_at=ensure_utc(entity.updated_at),
        )


class BackupItemEnvelope(APIModel):
    data: BackupResponse


class BackupListResponse(APIModel):
    data: list[BackupResponse]
    meta: PaginationMeta