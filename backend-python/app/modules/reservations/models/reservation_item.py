"""Reservation line — one dress with an agreed daily rental price snapshot."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class ReservationItem(AuditedSoftDeleteModel):
    """A dress included on a reservation with a commercial price agreement."""

    __tablename__ = "reservation_items"
    __table_args__ = (
        Index("ix_reservation_items_reservation_id_dress_id", "reservation_id", "dress_id"),
    )

    reservation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "reservations.id",
            name="fk_reservation_items_reservation_id_reservations",
            ondelete="RESTRICT",
        ),
        nullable=False,
        index=True,
    )
    dress_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("dresses.id", name="fk_reservation_items_dress_id_dresses", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reserved_daily_rental_price: Mapped[int] = mapped_column(BigInteger, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    calendar_block_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    reservation = relationship(
        "Reservation",
        back_populates="items",
        lazy="selectin",
    )
    dress = relationship("Dress", lazy="selectin", foreign_keys=[dress_id])

    def __repr__(self) -> str:
        return (
            f"<ReservationItem reservation_id={self.reservation_id!r} "
            f"dress_id={self.dress_id!r}>"
        )
