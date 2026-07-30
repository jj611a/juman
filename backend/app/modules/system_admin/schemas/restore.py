"""Restore API schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.modules.system_admin.models.restore import SystemRestore
from app.modules.system_admin.services.restore_validator import ValidationResult
from app.schemas.common import APIModel, PaginationMeta
from app.utils.datetime import ensure_utc


class RestoreValidateJsonRequest(APIModel):
    backup_id: UUID | None = None
    expected_checksum: str | None = Field(default=None, max_length=64)


class RestoreExecuteJsonRequest(APIModel):
    backup_id: UUID | None = None
    confirm: bool = False
    confirm_checksum: str = Field(min_length=64, max_length=64)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("notes", mode="before")
    @classmethod
    def _strip_notes(cls, value: object) -> object:
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        return value

    @field_validator("confirm_checksum", mode="before")
    @classmethod
    def _norm_checksum(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value


class RestoreValidationResponse(APIModel):
    ok: bool
    errors: list[str]
    warnings: list[str]
    format: str | None
    format_version: int | None
    app_version: str | None
    alembic_current: list[str]
    alembic_head: list[str]
    database_engine: str | None
    include_media: bool
    package_checksum_sha256: str | None

    @classmethod
    def from_result(cls, result: ValidationResult) -> RestoreValidationResponse:
        return cls(
            ok=result.ok,
            errors=list(result.errors),
            warnings=list(result.warnings),
            format=result.format,
            format_version=result.format_version,
            app_version=result.app_version,
            alembic_current=list(result.alembic_current),
            alembic_head=list(result.alembic_head),
            database_engine=result.database_engine,
            include_media=result.include_media,
            package_checksum_sha256=result.package_checksum_sha256,
        )


class RestoreValidationEnvelope(APIModel):
    data: RestoreValidationResponse


class RestoreResponse(APIModel):
    id: UUID
    status: str
    source_type: str
    source_backup_id: UUID | None
    source_filename: str
    package_checksum_sha256: str | None
    safety_backup_id: UUID | None
    format_version: int | None
    app_version: str | None
    alembic_revision: str | None
    started_at: datetime
    finished_at: datetime | None
    duration_ms: int | None
    created_by_user_id: UUID | None
    notes: str | None
    error_message: str | None
    warning_message: str | None
    audit_log_id: UUID | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, entity: SystemRestore) -> RestoreResponse:
        return cls(
            id=entity.id,
            status=entity.status,
            source_type=entity.source_type,
            source_backup_id=entity.source_backup_id,
            source_filename=entity.source_filename,
            package_checksum_sha256=entity.package_checksum_sha256,
            safety_backup_id=entity.safety_backup_id,
            format_version=entity.format_version,
            app_version=entity.app_version,
            alembic_revision=entity.alembic_revision,
            started_at=ensure_utc(entity.started_at),
            finished_at=ensure_utc(entity.finished_at) if entity.finished_at else None,
            duration_ms=entity.duration_ms,
            created_by_user_id=entity.created_by_user_id,
            notes=entity.notes,
            error_message=entity.error_message,
            warning_message=entity.warning_message,
            audit_log_id=entity.audit_log_id,
            created_at=ensure_utc(entity.created_at),
            updated_at=ensure_utc(entity.updated_at),
        )


class RestoreItemEnvelope(APIModel):
    data: RestoreResponse


class RestoreListResponse(APIModel):
    data: list[RestoreResponse]
    meta: PaginationMeta
