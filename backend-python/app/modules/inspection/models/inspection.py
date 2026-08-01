"""Inspection header — condition assessment after return."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class Inspection(AuditedSoftDeleteModel):
    """Inspection of all dresses on a return."""

    __tablename__ = "inspections"
    __table_args__ = (
        Index(
            "uq_inspections_number_alive",
            "inspection_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
        Index(
            "uq_inspections_return_id_alive",
            "return_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    inspection_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    return_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("returns.id", name="fk_inspections_return_id_returns", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    inspected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )
    inspected_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    items = relationship(
        "InspectionItem",
        back_populates="inspection",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Inspection number={self.inspection_number!r} "
            f"status={self.status!r} return_id={self.return_id!r}>"
        )
