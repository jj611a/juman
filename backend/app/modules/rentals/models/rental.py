"""Rental header — dresses handed to a customer."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class Rental(AuditedSoftDeleteModel):
    """Active (or future) rental contract for one or more dresses."""

    __tablename__ = "rentals"
    __table_args__ = (
        Index(
            "uq_rentals_number_alive",
            "rental_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
    )

    rental_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", name="fk_rentals_customer_id_customers", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reservation_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "reservations.id",
            name="fk_rentals_reservation_id_reservations",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
    rental_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    expected_return_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    initial_payment_type: Mapped[str] = mapped_column(String(20), nullable=False)
    initial_payment_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    initial_payment_value: Mapped[int] = mapped_column(BigInteger, nullable=False)
    estimated_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    items = relationship(
        "RentalItem",
        back_populates="rental",
        lazy="selectin",
    )
    customer = relationship("Customer", lazy="selectin", foreign_keys=[customer_id])

    def __repr__(self) -> str:
        return (
            f"<Rental number={self.rental_number!r} "
            f"status={self.status!r} customer_id={self.customer_id!r}>"
        )
