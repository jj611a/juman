"""StoredFile ORM model — blob metadata only."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, Boolean, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel

if TYPE_CHECKING:
    from app.modules.media.models.file_reference import FileReference


class StoredFile(AuditedSoftDeleteModel):
    """Persisted metadata for a binary object in a storage provider."""

    __tablename__ = "stored_files"
    __table_args__ = (
        Index("ix_stored_files_sha256_hash", "sha256_hash"),
        Index("ix_stored_files_storage_provider", "storage_provider"),
    )

    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    stored_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    extension: Mapped[str] = mapped_column(String(50), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(50), nullable=False)
    relative_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    uploaded_by: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    references: Mapped[list[FileReference]] = relationship(
        "FileReference",
        back_populates="stored_file",
        lazy="selectin",
    )
