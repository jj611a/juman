"""Processing line — one dress in a processing batch."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class ProcessingItem(AuditedSoftDeleteModel):
    """Traceable processing work for one inspected dress."""

    __tablename__ = "processing_items"
    __table_args__ = (
        Index(
            "ix_processing_items_batch_id_dress_id",
            "processing_batch_id",
            "dress_id",
        ),
        Index(
            "uq_processing_items_inspection_item_active",
            "inspection_item_id",
            unique=True,
            postgresql_where=text(
                "is_deleted = false AND status IN ('PENDING', 'IN_PROCESS')"
            ),
            sqlite_where=text(
                "is_deleted = 0 AND status IN ('PENDING', 'IN_PROCESS')"
            ),
        ),
        Index(
            "uq_processing_items_dress_active",
            "dress_id",
            unique=True,
            postgresql_where=text(
                "is_deleted = false AND status IN ('PENDING', 'IN_PROCESS')"
            ),
            sqlite_where=text(
                "is_deleted = 0 AND status IN ('PENDING', 'IN_PROCESS')"
            ),
        ),
    )

    processing_batch_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "processing_batches.id",
            name="fk_processing_items_batch_id_processing_batches",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_processing_items_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    inspection_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "inspection_items.id",
            name="fk_processing_items_inspection_item_id_inspection_items",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    return_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "return_items.id",
            name="fk_processing_items_return_item_id_return_items",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    rental_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "rental_items.id",
            name="fk_processing_items_rental_item_id_rental_items",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    calendar_block_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "dress_calendar_blocks.id",
            name="fk_processing_items_calendar_block_id_dress_calendar_blocks",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    batch = relationship("ProcessingBatch", back_populates="items", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<ProcessingItem batch_id={self.processing_batch_id!r} "
            f"dress_id={self.dress_id!r} status={self.status!r}>"
        )
