"""Return line — one dress from a rental item."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class ReturnItem(AuditedSoftDeleteModel):
    """A dress included on a return."""

    __tablename__ = "return_items"
    __table_args__ = (
        Index("ix_return_items_return_id_dress_id", "return_id", "dress_id"),
    )

    return_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("returns.id", name="fk_return_items_return_id_returns", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    rental_item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "rental_items.id",
            name="fk_return_items_rental_item_id_rental_items",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_return_items_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    returned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    return_record = relationship("Return", back_populates="items", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ReturnItem return_id={self.return_id!r} dress_id={self.dress_id!r}>"
