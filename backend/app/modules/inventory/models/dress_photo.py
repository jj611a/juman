"""DressPhoto model — gallery link from Dress to Media StoredFile."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class DressPhoto(AuditedSoftDeleteModel):
    """Reference from a dress asset to a Media stored image file."""

    __tablename__ = "dress_photos"
    __table_args__ = (
        Index(
            "uq_dress_photos_cover_alive",
            "dress_id",
            unique=True,
            postgresql_where=text("is_cover = true AND is_deleted = false"),
            sqlite_where=text("is_cover = 1 AND is_deleted = 0"),
        ),
        Index("ix_dress_photos_dress_id_display_order", "dress_id", "display_order"),
    )

    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_dress_photos_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    stored_file_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "stored_files.id",
            name="fk_dress_photos_stored_file_id_stored_files",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    display_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    is_cover: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)

    dress = relationship("Dress", lazy="selectin", foreign_keys=[dress_id])
    stored_file = relationship("StoredFile", lazy="selectin", foreign_keys=[stored_file_id])

    def __repr__(self) -> str:
        return (
            f"<DressPhoto dress_id={self.dress_id!r} "
            f"stored_file_id={self.stored_file_id!r} is_cover={self.is_cover!r}>"
        )
