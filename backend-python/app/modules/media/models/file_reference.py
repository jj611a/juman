"""FileReference ORM model — opaque polymorphic link to a StoredFile."""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel

if TYPE_CHECKING:
    from app.modules.media.models.stored_file import StoredFile


class FileReference(AuditedSoftDeleteModel):
    """Opaque ownership link from any caller module/entity to a stored file."""

    __tablename__ = "file_references"
    __table_args__ = (
        Index(
            "ix_file_references_module_entity",
            "module_name",
            "entity_type",
            "entity_id",
        ),
        Index("ix_file_references_stored_file_id", "stored_file_id"),
        Index("ix_file_references_purpose", "purpose"),
    )

    stored_file_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("stored_files.id", name="fk_file_references_stored_file_id"),
        nullable=False,
    )
    module_name: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), nullable=False)
    purpose: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )

    stored_file: Mapped[StoredFile] = relationship(
        "StoredFile",
        back_populates="references",
        lazy="selectin",
    )
