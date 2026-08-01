"""Inspection line — condition of one returned dress."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import BigInteger, Boolean, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class InspectionItem(AuditedSoftDeleteModel):
    """Condition and flags for one return item."""

    __tablename__ = "inspection_items"
    __table_args__ = (
        Index("ix_inspection_items_inspection_id_dress_id", "inspection_id", "dress_id"),
        Index(
            "uq_inspection_items_return_item_alive",
            "return_item_id",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    inspection_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "inspections.id",
            name="fk_inspection_items_inspection_id_inspections",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    return_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "return_items.id",
            name="fk_inspection_items_return_item_id_return_items",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_inspection_items_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    condition: Mapped[str | None] = mapped_column(String(32), nullable=True)
    repair_penalty_amount: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    repair_notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    requires_laundry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    send_to_ruined: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    inspection = relationship("Inspection", back_populates="items", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<InspectionItem inspection_id={self.inspection_id!r} "
            f"dress_id={self.dress_id!r} condition={self.condition!r}>"
        )
