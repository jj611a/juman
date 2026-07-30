"""DressCalendarBlock — immutable-style busy interval on a dress timeline."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class DressCalendarBlock(AuditedSoftDeleteModel):
    """A period when a dress is unavailable for overlapping bookings."""

    __tablename__ = "dress_calendar_blocks"
    __table_args__ = (
        Index("ix_dress_calendar_blocks_dress_id_start_at", "dress_id", "start_at"),
        Index("ix_dress_calendar_blocks_dress_id_end_at", "dress_id", "end_at"),
    )

    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "dresses.id",
            name="fk_dress_calendar_blocks_dress_id_dresses",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    block_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    reference_module: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    dress = relationship("Dress", lazy="selectin", foreign_keys=[dress_id])

    def __repr__(self) -> str:
        return (
            f"<DressCalendarBlock dress_id={self.dress_id!r} "
            f"type={self.block_type!r} start={self.start_at!r}>"
        )
