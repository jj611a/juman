"""Rental line — one dress with agreed price and expected days."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class RentalItem(AuditedSoftDeleteModel):
    """A dress included on a rental with commercial snapshots."""

    __tablename__ = "rental_items"
    __table_args__ = (
        Index("ix_rental_items_rental_id_dress_id", "rental_id", "dress_id"),
    )

    rental_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("rentals.id", name="fk_rental_items_rental_id_rentals", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_rental_items_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    agreed_daily_rental_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    expected_rental_days: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    calendar_block_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    rental = relationship("Rental", back_populates="items", lazy="selectin")
    dress = relationship("Dress", lazy="selectin", foreign_keys=[dress_id])

    def __repr__(self) -> str:
        return f"<RentalItem rental_id={self.rental_id!r} dress_id={self.dress_id!r}>"
