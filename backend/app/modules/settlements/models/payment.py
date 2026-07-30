"""Immutable settlement payment records."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.mixins import AuditMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.database.base import Base


class RentalSettlementPayment(UUIDPrimaryKeyMixin, TimestampMixin, AuditMixin, Base):
    """Append-only payment against a rental settlement."""

    __tablename__ = "rental_settlement_payments"
    __table_args__ = (Index("ix_rental_settlement_payments_settlement_id", "settlement_id"),)

    settlement_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "rental_settlements.id",
            name="fk_rental_settlement_payments_settlement_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(32), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    received_by: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    reference_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    settlement = relationship("RentalSettlement", back_populates="payments", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<RentalSettlementPayment amount={self.amount!r} "
            f"method={self.payment_method!r}>"
        )
