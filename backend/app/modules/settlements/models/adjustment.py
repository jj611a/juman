"""Immutable settlement adjustment records."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.mixins import AuditMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.database.base import Base


class RentalSettlementAdjustment(UUIDPrimaryKeyMixin, TimestampMixin, AuditMixin, Base):
    """Append-only signed adjustment on a rental settlement."""

    __tablename__ = "rental_settlement_adjustments"
    __table_args__ = (Index("ix_rental_settlement_adjustments_settlement_id", "settlement_id"),)

    settlement_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "rental_settlements.id",
            name="fk_rental_settlement_adjustments_settlement_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)

    settlement = relationship("RentalSettlement", back_populates="adjustments", lazy="selectin")

    def __repr__(self) -> str:
        return f"<RentalSettlementAdjustment amount={self.amount!r}>"
