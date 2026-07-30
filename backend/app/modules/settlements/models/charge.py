"""Immutable settlement charge lines."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.common.mixins import AuditMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.database.base import Base


class RentalSettlementCharge(UUIDPrimaryKeyMixin, TimestampMixin, AuditMixin, Base):
    """Append-only charge / credit line on a settlement."""

    __tablename__ = "rental_settlement_charges"
    __table_args__ = (
        UniqueConstraint(
            "inspection_item_id",
            name="uq_rental_settlement_charges_inspection_item",
        ),
        Index("ix_rental_settlement_charges_settlement_id", "settlement_id"),
    )

    settlement_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "rental_settlements.id",
            name="fk_rental_settlement_charges_settlement_id",
            ondelete="RESTRICT",
        ),
        nullable=False,
    )
    charge_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    rental_item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "rental_items.id",
            name="fk_rental_settlement_charges_rental_item_id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
    inspection_item_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey(
            "inspection_items.id",
            name="fk_rental_settlement_charges_inspection_item_id",
            ondelete="RESTRICT",
        ),
        nullable=True,
        index=True,
    )
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)

    settlement = relationship("RentalSettlement", back_populates="charges", lazy="selectin")

    def __repr__(self) -> str:
        return (
            f"<RentalSettlementCharge type={self.charge_type!r} "
            f"amount={self.amount!r}>"
        )
