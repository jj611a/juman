"""Reservation header — customer hold for a future rental window."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class Reservation(AuditedSoftDeleteModel):
    """Draft/confirmed hold of one or more dresses for a rental period."""

    __tablename__ = "reservations"
    __table_args__ = (
        Index(
            "uq_reservations_number_alive",
            "reservation_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    reservation_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", name="fk_reservations_customer_id_customers", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reservation_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    rental_start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    expected_return_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    items = relationship(
        "ReservationItem",
        back_populates="reservation",
        lazy="selectin",
    )
    customer = relationship("Customer", lazy="selectin", foreign_keys=[customer_id])

    def __repr__(self) -> str:
        return (
            f"<Reservation number={self.reservation_number!r} "
            f"status={self.status!r} customer_id={self.customer_id!r}>"
        )
