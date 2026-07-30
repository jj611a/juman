"""System restore history model."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import AuditedSoftDeleteModel


class SystemRestore(AuditedSoftDeleteModel):
    """History row for a restore attempt from a .juman package."""

    __tablename__ = "system_restores"

    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_backup_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("system_backups.id", name="fk_system_restores_source_backup_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    source_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    package_checksum_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    safety_backup_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("system_backups.id", name="fk_system_restores_safety_backup_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    format_version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    app_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    alembic_revision: Mapped[str | None] = mapped_column(String(128), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_by_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", name="fk_system_restores_created_by_user_id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    warning_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    audit_log_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("audit_logs.id", name="fk_system_restores_audit_log_id", ondelete="SET NULL"),
        nullable=True,
    )
