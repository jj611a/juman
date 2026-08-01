"""Rental settlement header — post-return financial obligations."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import AuditedSoftDeleteModel


class RentalSettlement(AuditedSoftDeleteModel):
    """Financial settlement for one returned rental."""

    __tablename__ = "rental_settlements"
    __table_args__ = (
        Index(
            "uq_rental_settlements_number_alive",
            "settlement_number",
            unique=True,
            postgresql_where=text("is_deleted = false"),
            sqlite_where=text("is_deleted = 0"),
        ),
        Index(
            "uq_rental_settlements_rental_active",
            "rental_id",
            unique=True,
            postgresql_where=text("is_deleted = false AND status != 'VOIDED'"),
            sqlite_where=text("is_deleted = 0 AND status != 'VOIDED'"),
        ),
    )

    settlement_number: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    rental_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("rentals.id", name="fk_rental_settlements_rental_id_rentals", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    return_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("returns.id", name="fk_rental_settlements_return_id_returns", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    rental_charge_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    initial_payment_credit: Mapped[int] = mapped_column(BigInteger, nullable=False)
    late_penalty_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    minor_damage_penalty_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    manual_adjustment_amount: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    gross_total: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_due: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_paid: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    remaining_balance: Mapped[int] = mapped_column(BigInteger, nullable=False)
    settled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    settled_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    charges = relationship("RentalSettlementCharge", back_populates="settlement", lazy="selectin")
    payments = relationship("RentalSettlementPayment", back_populates="settlement", lazy="selectin")
    adjustments = relationship(
        "RentalSettlementAdjustment",
        back_populates="settlement",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<RentalSettlement number={self.settlement_number!r} "
            f"status={self.status!r} rental_id={self.rental_id!r}>"
        )
