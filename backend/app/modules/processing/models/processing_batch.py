"""Processing batch — laundry / readiness work order."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class ProcessingBatch(AuditedSoftDeleteModel):
    """Batch of dresses undergoing post-inspection processing."""

    __tablename__ = "processing_batches"
    __table_args__ = (
        Index(
            "uq_processing_batches_number_alive",
            "processing_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    processing_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    mandatory_processing_end_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    optional_extra_day_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    final_processing_end_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    started_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    completed_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    items = relationship(
        "ProcessingItem",
        back_populates="batch",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<ProcessingBatch number={self.processing_number!r} "
            f"status={self.status!r}>"
        )
